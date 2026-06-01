import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.deps import get_current_player
from app.models import Match, Challenge, Player

router = APIRouter()


def _match_dict(m: Match, challenge_count: int = 0) -> dict:
    return {
        "id": m.id,
        "home_team": m.home_team,
        "away_team": m.away_team,
        "kickoff_time": m.kickoff_time.replace(tzinfo=timezone.utc).isoformat(),
        "status": m.status,
        "home_score": m.home_score,
        "away_score": m.away_score,
        "round": m.round,
        "home_team_confirmed": m.home_team_confirmed,
        "away_team_confirmed": m.away_team_confirmed,
        "challenge_count": challenge_count,
    }


def _challenge_dict(c: Challenge, issuer_name: str = "") -> dict:
    return {
        "id": c.id,
        "issuer_id": c.issuer_id,
        "issuer_name": issuer_name,
        "bet_type": c.bet_type,
        "selection": c.selection,
        "acceptor_selection": c.acceptor_selection,
        "issuer_stake": c.issuer_stake,
        "acceptor_stake": c.acceptor_stake,
        "issuer_odds": c.issuer_odds,
        "acceptor_odds": c.acceptor_odds,
        "status": c.status,
    }


async def _auto_lock(match: Match, db: AsyncSession) -> None:
    if match.status == "upcoming" and datetime.now(timezone.utc) >= match.kickoff_time.replace(tzinfo=timezone.utc):
        match.status = "locked"
        result = await db.execute(
            select(Challenge).where(Challenge.match_id == match.id, Challenge.status == "open")
        )
        for ch in result.scalars().all():
            issuer = await db.get(Player, ch.issuer_id)
            issuer.token_balance += ch.issuer_stake
            ch.status = "cancelled"
        await db.commit()


@router.get("/api/matches")
async def list_matches(auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Match).order_by(Match.kickoff_time))
    matches = result.scalars().all()
    for m in matches:
        await _auto_lock(m, db)
    # Count open challenges per match in one query
    counts_rows = (await db.execute(
        select(Challenge.match_id, func.count(Challenge.id).label("cnt"))
        .where(Challenge.status == "open")
        .group_by(Challenge.match_id)
    )).all()
    counts = {row.match_id: row.cnt for row in counts_rows}
    return [_match_dict(m, counts.get(m.id, 0)) for m in matches]


@router.get("/api/matches/{match_id}")
async def get_match(match_id: int, auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    match = await db.get(Match, match_id)
    if not match:
        raise HTTPException(404, "not found")
    await _auto_lock(match, db)

    try:
        odds = json.loads(match.odds_cache) if match.odds_cache else {}
    except (json.JSONDecodeError, ValueError):
        odds = {}

    current_player = auth[0] if auth else None
    if current_player is not None and current_player.league_id is not None:
        league_player_ids = (await db.execute(
            select(Player.id).where(Player.league_id == current_player.league_id)
        )).scalars().all()
        ch_query = select(Challenge).where(
            Challenge.match_id == match_id,
            Challenge.status == "open",
            Challenge.issuer_id.in_(league_player_ids),
        )
    else:
        ch_query = select(Challenge).where(
            Challenge.match_id == match_id, Challenge.status == "open"
        )
    open_challenges = (await db.execute(ch_query)).scalars().all()
    # Resolve issuer names in one batch
    issuer_ids = list({c.issuer_id for c in open_challenges})
    issuer_map: dict[int, str] = {}
    if issuer_ids:
        players = (await db.execute(select(Player).where(Player.id.in_(issuer_ids)))).scalars().all()
        issuer_map = {p.id: p.name for p in players}

    return {
        **_match_dict(match, len(open_challenges)),
        "odds": odds,
        "open_challenges": [_challenge_dict(c, issuer_map.get(c.issuer_id, "")) for c in open_challenges],
    }
