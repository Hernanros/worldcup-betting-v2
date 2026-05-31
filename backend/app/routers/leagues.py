from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.deps import get_admin
from app.models import League, Player

router = APIRouter()


def _league_dict(league: League) -> dict:
    return {
        "id": league.id,
        "name": league.name,
        "invite_code": league.invite_code,
        "ai_enabled": league.ai_enabled,
    }


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
    ai_enabled = bool(data.get("ai_enabled", True))
    league = League(name=name, invite_code=code, ai_enabled=ai_enabled)
    db.add(league)
    await db.commit()
    await db.refresh(league)
    return _league_dict(league)


@router.get("/api/leagues")
async def list_leagues(_=Depends(get_admin), db: AsyncSession = Depends(get_db)):
    leagues = (await db.execute(select(League))).scalars().all()
    return [_league_dict(lg) for lg in leagues]


@router.delete("/api/leagues/{league_id}", status_code=200)
async def delete_league(league_id: int, _=Depends(get_admin), db: AsyncSession = Depends(get_db)):
    league = await db.get(League, league_id)
    if not league:
        raise HTTPException(404, "league not found")
    # Safety: refuse if the league has players
    players = (await db.execute(
        select(Player).where(Player.league_id == league_id).limit(1)
    )).scalar_one_or_none()
    if players:
        raise HTTPException(400, "cannot delete a league that still has players — remove players first or use force=true")
    await db.delete(league)
    await db.commit()
    return {"deleted": league_id}


@router.delete("/api/leagues/{league_id}/force", status_code=200)
async def force_delete_league(league_id: int, _=Depends(get_admin), db: AsyncSession = Depends(get_db)):
    """Delete league AND all its players (use for test/mock groups)."""
    league = await db.get(League, league_id)
    if not league:
        raise HTTPException(404, "league not found")
    players = (await db.execute(
        select(Player).where(Player.league_id == league_id)
    )).scalars().all()
    player_count = len(players)
    for p in players:
        await db.delete(p)
    await db.delete(league)
    await db.commit()
    return {"deleted": league_id, "players_removed": player_count}


@router.post("/api/admin/seed-matches", status_code=200)
async def seed_matches(_=Depends(get_admin), db: AsyncSession = Depends(get_db)):
    """One-shot: seed WC 2026 group-stage matches. Safe to call multiple times."""
    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../.."))
    from scripts.seed_wc2026 import MATCHES
    from app.models import Match
    from datetime import datetime

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
