from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import Player, League
from app.deps import make_token, get_current_player
from app.config import settings

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
    if not name:
        raise HTTPException(400, "name required")

    is_admin = code == settings.admin_code

    league = None
    if not is_admin:
        result = await db.execute(select(League).where(League.invite_code == code))
        league = result.scalar_one_or_none()
        if not league:
            raise HTTPException(403, "invalid invite code")

    # Find or create player, scoped to league
    query = select(Player).where(Player.name == name)
    if league:
        query = query.where(Player.league_id == league.id)
    else:
        query = query.where(Player.league_id.is_(None))
    result = await db.execute(query)
    player = result.scalar_one_or_none()

    if not player:
        try:
            player = Player(name=name, token_balance=1000,
                            league_id=league.id if league else None)
            db.add(player)
            await db.commit()
            await db.refresh(player)
        except IntegrityError:
            await db.rollback()
            result = await db.execute(query)
            player = result.scalar_one_or_none()

    token = make_token(player.id, is_admin)
    player.session_token = token
    await db.commit()

    return {
        "token": token,
        "player": _player_dict(player, is_admin),
        "league": {"id": league.id, "name": league.name} if league else None,
    }


@router.get("/api/me")
async def get_me(auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    player, _ = auth
    p = await db.get(Player, player.id)
    return {
        "id": p.id,
        "name": p.name,
        "token_balance": p.token_balance,
        "challenge_streak": p.challenge_streak,
        "total_challenges_issued": p.total_challenges_issued,
        "volume_milestone_reached": p.volume_milestone_reached,
    }


@router.get("/api/players/me")
async def me(auth=Depends(get_current_player)):
    player, is_admin = auth
    return _player_dict(player, is_admin)
