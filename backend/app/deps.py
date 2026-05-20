from fastapi import Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from jose import jwt, JWTError
from app.database import get_db
from app.models import Player
from app.config import settings


def make_token(player_id: int, is_admin: bool) -> str:
    return jwt.encode({"sub": str(player_id), "admin": is_admin}, settings.jwt_secret, algorithm="HS256")


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])


async def get_current_player(
    authorization: str = Header(...),
    db: AsyncSession = Depends(get_db),
) -> tuple[Player, bool]:
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "missing token")
    try:
        payload = decode_token(authorization[7:])
    except JWTError:
        raise HTTPException(401, "invalid token")
    player = await db.get(Player, int(payload["sub"]))
    if not player:
        raise HTTPException(401, "player not found")
    return player, payload.get("admin", False)


async def get_admin(
    authorization: str = Header(...),
) -> bool:
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "missing token")
    try:
        payload = decode_token(authorization[7:])
    except JWTError:
        raise HTTPException(401, "invalid token")
    if not payload.get("admin"):
        raise HTTPException(403, "admin required")
    return True
