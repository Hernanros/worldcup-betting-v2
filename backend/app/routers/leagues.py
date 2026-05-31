from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.deps import get_admin
from app.models import League

router = APIRouter()


@router.post("/api/leagues", status_code=201)
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
    return [{"id": league.id, "name": league.name, "invite_code": league.invite_code} for league in leagues]


@router.post("/api/admin/seed-matches", status_code=200)
async def seed_matches(_=Depends(get_admin), db: AsyncSession = Depends(get_db)):
    """One-shot: seed WC 2026 group-stage matches. Safe to call multiple times."""
    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../.."))
    from scripts.seed_wc2026 import MATCHES
    from app.models import Match
    from sqlalchemy import select
    from datetime import datetime, timezone

    added = 0
    for home, away, kickoff_str, round_label in MATCHES:
        kickoff = datetime.fromisoformat(kickoff_str.replace("Z", "+00:00"))
        exists = (await db.execute(
            select(Match).where(Match.home_team == home, Match.away_team == away)
        )).scalar_one_or_none()
        if not exists:
            db.add(Match(home_team=home, away_team=away,
                         kickoff_time=kickoff, status="upcoming", round=round_label))
            added += 1
    await db.commit()
    return {"seeded": added, "message": f"Added {added} matches (skipped duplicates)"}
