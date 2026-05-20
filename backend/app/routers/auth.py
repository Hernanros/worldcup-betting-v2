from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import Player
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
    is_player = code == settings.invite_code

    if not is_admin and not is_player:
        raise HTTPException(403, "invalid code")

    result = await db.execute(select(Player).where(Player.name == name))
    player = result.scalar_one_or_none()
    if not player:
        player = Player(name=name, token_balance=1000)
        db.add(player)
        await db.commit()
        await db.refresh(player)

    token = make_token(player.id, is_admin)
    player.session_token = token
    await db.commit()

    return {"token": token, "player": _player_dict(player, is_admin)}


@router.get("/api/players/me")
async def me(auth=Depends(get_current_player)):
    player, is_admin = auth
    return _player_dict(player, is_admin)
