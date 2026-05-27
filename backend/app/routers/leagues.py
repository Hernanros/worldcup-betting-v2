from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.deps import get_admin
from app.models import League

router = APIRouter()


@router.post("/api/leagues")
async def create_league(data: dict, _=Depends(get_admin), db: AsyncSession = Depends(get_db)):
    name = (data.get("name") or "").strip()
    code = (data.get("invite_code") or "").strip()
    if not name or not code:
        raise HTTPException(400, "name and invite_code are required")
    existing = (await db.execute(
        select(League).where(League.invite_code == code)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(400, "invite_code already in use")
    league = League(name=name, invite_code=code)
    db.add(league)
    await db.commit()
    await db.refresh(league)
    return {"id": league.id, "name": league.name, "invite_code": league.invite_code}


@router.get("/api/leagues")
async def list_leagues(_=Depends(get_admin), db: AsyncSession = Depends(get_db)):
    leagues = (await db.execute(select(League))).scalars().all()
    return [{"id": l.id, "name": l.name, "invite_code": l.invite_code} for l in leagues]
