from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import Player, League, Bet
from app.deps import make_token, get_current_player
from app.config import settings
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

router = APIRouter()


def _player_dict(player: Player, is_admin: bool = False) -> dict:
    return {
        "id": player.id,
        "name": player.name,
        "token_balance": player.token_balance,
        "challenge_streak": player.challenge_streak,
        "total_challenges_issued": player.total_challenges_issued,
        "is_admin": is_admin,
    }


@router.post("/api/auth/join")
async def join(data: dict, db: AsyncSession = Depends(get_db)):
    name = (data.get("name") or "").strip()
    code = (data.get("code") or "").strip()
    # mode: "login" = existing only, "register" = new only, "join" = find-or-create (default)
    mode = (data.get("mode") or "join").strip()
    if not name:
        raise HTTPException(400, "name required")

    is_admin = code == settings.admin_code

    league = None
    if not is_admin:
        result = await db.execute(select(League).where(League.invite_code == code))
        league = result.scalar_one_or_none()
        if not league:
            raise HTTPException(403, "invalid invite code")

    # Find existing player, scoped to league
    query = select(Player).where(Player.name == name)
    if league:
        query = query.where(Player.league_id == league.id)
    else:
        query = query.where(Player.league_id.is_(None))
    result = await db.execute(query)
    player = result.scalar_one_or_none()
    returning = player is not None  # track before possible creation

    if player:
        # Player exists
        if mode == "register" and not is_admin:
            raise HTTPException(400, "Name already taken in this group — sign in instead")
    else:
        # Player doesn't exist
        if mode == "login" and not is_admin:
            raise HTTPException(404, "Player not found in this group — check your name or register")
        try:
            player = Player(name=name, token_balance=1000,
                            league_id=league.id if league else None,
                            is_admin=is_admin)
            db.add(player)
            await db.commit()
            await db.refresh(player)
        except IntegrityError:
            await db.rollback()
            result = await db.execute(query)
            player = result.scalar_one_or_none()
            returning = True  # race condition → player was already there

    # Ensure the is_admin flag is persisted on the record (important for adoption guard)
    if is_admin and not player.is_admin:
        player.is_admin = True
    token = make_token(player.id, is_admin)
    player.session_token = token
    await db.commit()

    return {
        "token": token,
        "player": _player_dict(player, is_admin),
        "league": {"id": league.id, "name": league.name} if league else None,
        "returning": returning,
    }


@router.get("/api/me")
async def get_me(auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    player, _ = auth
    p = await db.get(Player, player.id)
    wildcards_used = (await db.execute(
        select(func.count(Bet.id))
        .where(Bet.player_id == p.id, Bet.is_wildcard == True)  # noqa: E712
    )).scalar() or 0
    return {
        "id": p.id,
        "name": p.name,
        "token_balance": p.token_balance,
        "challenge_streak": p.challenge_streak,
        "total_challenges_issued": p.total_challenges_issued,
        "volume_milestone_reached": p.volume_milestone_reached,
        "wildcards_used": wildcards_used,
    }


@router.get("/api/players/me")
async def me(auth=Depends(get_current_player)):
    player, is_admin = auth
    return _player_dict(player, is_admin)


@router.post("/api/auth/google")
async def google_auth(data: dict, db: AsyncSession = Depends(get_db)):
    if not settings.google_client_id:
        raise HTTPException(503, "Google OAuth not configured on this server")

    raw_token = (data.get("id_token") or "").strip()
    invite_code = (data.get("invite_code") or "").strip() or None
    display_name = (data.get("display_name") or "").strip() or None

    # 1. Verify the Google ID token
    try:
        payload = id_token.verify_oauth2_token(
            raw_token,
            google_requests.Request(),
            settings.google_client_id,
        )
    except ValueError as exc:
        raise HTTPException(400, f"invalid google token: {exc}")

    google_sub = payload["sub"]
    google_name = payload.get("name", "")
    google_email = payload.get("email", "")

    # 2. Look up existing player by google_sub
    # Note: `select` is already imported at the top of auth.py — no new import needed.
    result = await db.execute(
        select(Player).where(Player.google_sub == google_sub)
    )
    player = result.scalar_one_or_none()

    if player:
        # Returning player — issue JWT immediately
        token = make_token(player.id, False)
        player.session_token = token
        await db.commit()
        league = await db.get(League, player.league_id) if player.league_id else None
        return {
            "status": "ok",
            "token": token,
            "player": _player_dict(player, False),
            "league": {"id": league.id, "name": league.name} if league else None,
        }

    # 3. New player — require invite_code
    if not invite_code:
        return {"status": "new_player", "google_name": google_name, "google_email": google_email}

    result = await db.execute(
        select(League).where(League.invite_code == invite_code)
    )
    league = result.scalar_one_or_none()
    if not league:
        raise HTTPException(403, "invalid invite code")

    name = display_name or google_name
    try:
        player = Player(
            name=name,
            google_sub=google_sub,
            email=google_email,
            token_balance=1000,
            league_id=league.id,
        )
        db.add(player)
        await db.commit()
        await db.refresh(player)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(400, "Name already taken in this group — choose a different display name")

    token = make_token(player.id, False)
    player.session_token = token
    await db.commit()

    return {
        "status": "ok",
        "token": token,
        "player": _player_dict(player, False),
        "league": {"id": league.id, "name": league.name},
    }
