import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.deps import get_current_player
from app.models import Match, Bet, Player

router = APIRouter()

# Safe defaults used when a match has no odds_cache or the market isn't cached.
# These are deliberately conservative — no one can game a 2.0 payout to a 100x payout.
_FALLBACK_ODDS = {
    "1x2":          2.0,
    "totals":       1.90,
    "btts":         1.80,
    "correct_score": 12.0,
}


def _resolve_match_odds(match: Match, bet_type: str, selection: str) -> float:
    """Return server-authoritative odds for a bet.

    Lookup order:
    1. match.odds_cache (JSON blob written by fetch_odds.py or seed_placeholder_odds.py)
    2. _FALLBACK_ODDS per bet_type

    The client MUST NOT influence the returned value.
    """
    if match.odds_cache:
        try:
            cache: dict = json.loads(match.odds_cache)
        except (json.JSONDecodeError, ValueError):
            cache = {}

        if bet_type == "1x2":
            # Selections come in as a team name or "Draw".
            # The cache stores "Home Win" / "Away Win" / "Draw".
            if selection == match.home_team:
                canonical = "Home Win"
            elif selection == match.away_team:
                canonical = "Away Win"
            elif selection.lower() == "draw":
                canonical = "Draw"
            else:
                canonical = selection  # fallthrough → won't match, uses fallback

            for entry in cache.get("1x2", []):
                if entry.get("name") == canonical:
                    return float(entry["price"])

        elif bet_type == "totals":
            # Selection is the full label, e.g. "Over 2.5"
            for entry in cache.get("totals", []):
                if entry.get("name") == selection:
                    return float(entry["price"])

        elif bet_type == "btts":
            # Selection is "Yes" or "No"
            for entry in cache.get("btts", []):
                if entry.get("name", "").lower() == selection.lower():
                    return float(entry["price"])

        # correct_score not in the cache; fall through to default.

    return _FALLBACK_ODDS.get(bet_type, 2.0)


@router.post("/api/matches/{match_id}/bets")
async def place_bet(match_id: int, data: dict, auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    player, _ = auth
    match = await db.get(Match, match_id)
    if not match:
        raise HTTPException(404, "match not found")
    if match.status != "upcoming":
        raise HTTPException(400, "betting is closed for this match")

    bet_type = data.get("bet_type")
    selection = data.get("selection")
    if not bet_type or not selection:
        raise HTTPException(400, "bet_type and selection are required")

    try:
        stake = int(data.get("stake", 0))
    except (TypeError, ValueError):
        raise HTTPException(400, "invalid stake")

    if stake < 1:
        raise HTTPException(400, "minimum stake is 1")

    # Server-side odds — client value is intentionally ignored.
    odds = _resolve_match_odds(match, bet_type, selection)

    player = await db.get(Player, player.id)
    if player.token_balance < stake:
        raise HTTPException(400, "insufficient balance")

    bet = Bet(
        player_id=player.id,
        match_id=match_id,
        bet_type=bet_type,
        selection=selection,
        stake=stake,
        odds_at_placement=odds,
    )
    player.token_balance -= stake
    db.add(bet)
    await db.commit()
    await db.refresh(bet)

    return {"id": bet.id, "new_balance": player.token_balance, "odds": odds}


@router.get("/api/bets")
async def get_my_bets(auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    player, _ = auth
    rows = (await db.execute(
        select(Bet, Match)
        .join(Match, Bet.match_id == Match.id)
        .where(Bet.player_id == player.id)
        .order_by(Match.kickoff_time.desc())
    )).all()
    return [
        {
            "id": b.id,
            "match_id": b.match_id,
            "home_team": m.home_team,
            "away_team": m.away_team,
            "kickoff_time": m.kickoff_time.isoformat(),
            "match_status": m.status,
            "home_score": m.home_score,
            "away_score": m.away_score,
            "bet_type": b.bet_type,
            "selection": b.selection,
            "stake": b.stake,
            "odds": b.odds_at_placement,
            "status": b.status,
        }
        for b, m in rows
    ]
