from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.deps import get_admin
from app.models import League, Player, Match

router = APIRouter()


def _league_dict(league: League, player_count: int = 0) -> dict:
    return {
        "id": league.id,
        "name": league.name,
        "invite_code": league.invite_code,
        "ai_enabled": league.ai_enabled,
        "player_count": player_count,
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
    # Count players per league in one query
    counts_rows = (await db.execute(
        select(Player.league_id, func.count(Player.id).label("cnt"))
        .where(Player.league_id.isnot(None))
        .group_by(Player.league_id)
    )).all()
    counts = {row.league_id: row.cnt for row in counts_rows}
    return [_league_dict(lg, counts.get(lg.id, 0)) for lg in leagues]


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


@router.post("/api/admin/settle-match", status_code=200)
async def settle_match_manual(data: dict, _=Depends(get_admin), db: AsyncSession = Depends(get_db)):
    """Manually settle a match with scores. Triggers full payout logic."""
    from app.poller import settle_match
    from app.ws import manager

    match_id = data.get("match_id")
    home_score = data.get("home_score")
    away_score = data.get("away_score")
    if match_id is None or home_score is None or away_score is None:
        raise HTTPException(400, "match_id, home_score, and away_score required")

    match = await db.get(Match, match_id)
    if not match:
        raise HTTPException(404, "match not found")
    if match.status == "finished":
        raise HTTPException(400, f"already settled: {match.home_score}-{match.away_score}")
    if match.status == "upcoming":
        # Force-lock it first so settlement logic works
        match.status = "locked"
        await db.commit()

    result = {
        "home_score": int(home_score),
        "away_score": int(away_score),
        "home_red_cards": int(data.get("home_red_cards", 0)),
        "away_red_cards": int(data.get("away_red_cards", 0)),
        "corners": int(data.get("corners", 0)),
    }
    await settle_match(db, match, result)
    await manager.broadcast({"type": "match_settled", "match_id": match.id})
    await manager.broadcast({"type": "leaderboard_updated"})
    return {"settled": match_id, "home_score": int(home_score), "away_score": int(away_score)}
