import json
import re
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import anthropic
from app.database import get_db
from app.deps import get_current_player
from app.models import Match, Player, Bet, TournamentBet, SpicyBet
from app.config import settings

router = APIRouter()

anthropic_client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

_SYSTEM = """You are a sports betting advisor for a World Cup friend group.
Given a match and its current odds, suggest exactly 2 interesting P2P challenge ideas.
Respond ONLY with a valid JSON array — no markdown, no explanation, just the array.
Each item in the array must have exactly these fields:
{
  "title": "short label for the bet type, e.g. 'Home Win' or 'Corner Fest'",
  "bet_type": "one of: 1x2, correct_score, btts, totals, corners, offsides, total_cards",
  "my_pick": "issuer selection — team name for 1x2 | 'H-A' for correct_score (e.g. '2-1') | 'Yes'/'No' for btts | 'Over N.5'/'Under N.5' for totals/corners/offsides/total_cards",
  "their_pick": "acceptor's opposing selection in the same format",
  "my_odds": 2.5,
  "their_odds": 1.6,
  "stake": 100,
  "reason": "one sentence explaining why this pick is interesting"
}
Stakes should be between 50 and 300. Odds must be positive floats.
Vary the bet types across suggestions — don't suggest 1x2 twice.
Typical WC lines: corners ~9.5, offsides ~3.5, total cards ~3.5."""


def _build_prompt(match: Match, player: Player, odds: dict,
                  existing_bet=None, existing_prediction=None, open_challenges=None,
                  recent_bets=None, tournament_bets=None, deep_cuts_bets=None) -> str:
    lines = [
        f"Match: {match.home_team} vs {match.away_team}",
        f"Round: {match.round}",
        f"Player balance: {player.token_balance} tokens",
        f"Player challenge streak: {player.challenge_streak}",
    ]
    if existing_bet:
        lines.append(f"Player already bet: {existing_bet.selection} ({existing_bet.bet_type}), stake {existing_bet.stake} — avoid suggesting the same position")
    if existing_prediction:
        lines.append(f"Player predicted score: {existing_prediction.home_score_pred}-{existing_prediction.away_score_pred} — use this as context for their view on the match")
    if recent_bets:
        summary = "; ".join(
            f"{b.selection} ({b.bet_type}) → {b.status}" for b in recent_bets
        )
        lines.append(f"Player's last {len(recent_bets)} settled bets: {summary}")
        wins = sum(1 for b in recent_bets if b.status == "won")
        lines.append(f"Recent win rate: {wins}/{len(recent_bets)} — {'hot streak' if wins > len(recent_bets) / 2 else 'cold run'}")
    if tournament_bets:
        tb_summary = "; ".join(
            f"{b.bet_type}: {b.selection}" for b in tournament_bets
        )
        lines.append(f"Player's tournament bets: {tb_summary} — factor into suggestion (don't contradict outright, or suggest a hedge)")
    if deep_cuts_bets:
        dc_summary = "; ".join(
            f"{b.market_key}: {b.selection}" for b in deep_cuts_bets[:5]
        )
        lines.append(f"Player's recent prop bets: {dc_summary}")
    if open_challenges:
        lines.append(f"Open challenges already posted: {len(open_challenges)} — suggest something different")
    lines += ["", "Available odds:"]
    # Fallback: if no odds cached for this match, provide typical WC-style defaults
    # so Claude always has meaningful data to build suggestions from.
    if not odds:
        odds = {
            "h2h": [
                {"name": match.home_team, "price": 2.5},
                {"name": "Draw",          "price": 3.2},
                {"name": match.away_team, "price": 2.8},
            ],
            "totals": [
                {"name": "Over 2.5",  "price": 2.0},
                {"name": "Under 2.5", "price": 1.85},
            ],
            "btts": [
                {"name": "Yes", "price": 2.0},
                {"name": "No",  "price": 1.85},
            ],
            "corners": [
                {"name": "Over 9.5",  "price": 1.90},
                {"name": "Under 9.5", "price": 1.90},
            ],
            "offsides": [
                {"name": "Over 3.5",  "price": 1.90},
                {"name": "Under 3.5", "price": 1.90},
            ],
            "total_cards": [
                {"name": "Over 3.5",  "price": 1.90},
                {"name": "Under 3.5", "price": 1.90},
            ],
        }
    for market, outcomes in odds.items():
        lines.append(f"  {market}:")
        for o in outcomes:
            lines.append(f"    {o.get('name', '?')}: {o.get('price', '?')}")
    lines.append("\nReturn a JSON array of exactly 2 challenge suggestions.")
    return "\n".join(lines)


@router.post("/api/ai/suggest-challenge")
async def suggest_challenge(
    data: dict,
    auth=Depends(get_current_player),
    db: AsyncSession = Depends(get_db),
):
    player, _ = auth
    # Check AI is enabled for this player's league
    if player.league_id is not None:
        from app.models import League
        league = await db.get(League, player.league_id)
        if league and not league.ai_enabled:
            raise HTTPException(403, "AI suggestions are not enabled for your group")
    match = await db.get(Match, data.get("match_id"))
    if not match:
        raise HTTPException(404, "match not found")
    try:
        odds = json.loads(match.odds_cache) if match.odds_cache else {}
    except (json.JSONDecodeError, ValueError):
        odds = {}
    player = await db.get(Player, player.id)

    from sqlalchemy import select as sa_select
    from app.models import Bet, Prediction, Challenge
    existing_bet = (await db.execute(
        sa_select(Bet).where(Bet.player_id == player.id, Bet.match_id == match.id)
    )).scalars().first()
    existing_prediction = (await db.execute(
        sa_select(Prediction).where(Prediction.player_id == player.id, Prediction.match_id == match.id)
    )).scalars().first()
    open_challenges = (await db.execute(
        sa_select(Challenge).where(Challenge.match_id == match.id, Challenge.status == "open")
    )).scalars().all()

    # Richer context: recent bet history, tournament position, deep cuts bets
    recent_bets = (await db.execute(
        sa_select(Bet)
        .where(Bet.player_id == player.id, Bet.status.in_(["won", "lost"]))
        .order_by(Bet.id.desc())
        .limit(10)
    )).scalars().all()
    tournament_bets = (await db.execute(
        sa_select(TournamentBet).where(TournamentBet.player_id == player.id)
    )).scalars().all()
    deep_cuts_bets = (await db.execute(
        sa_select(SpicyBet)
        .where(SpicyBet.player_id == player.id)
        .order_by(SpicyBet.id.desc())
        .limit(5)
    )).scalars().all()

    prompt = _build_prompt(
        match, player, odds,
        existing_bet, existing_prediction, open_challenges,
        recent_bets=recent_bets,
        tournament_bets=tournament_bets,
        deep_cuts_bets=deep_cuts_bets,
    )
    try:
        message = anthropic_client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=600,
            system=_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip()
        # Strip optional markdown code-fence wrapping (```json ... ```)
        fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
        if fence_match:
            raw = fence_match.group(1).strip()
        # If raw starts with [ or {, parse it; otherwise try to extract the first JSON array
        if not raw.startswith("["):
            arr_match = re.search(r"\[[\s\S]*\]", raw)
            raw = arr_match.group(0) if arr_match else "[]"
        suggestions = json.loads(raw)
        if not isinstance(suggestions, list):
            suggestions = []
        # Ensure each suggestion has all required fields
        required = {"title", "bet_type", "my_pick", "their_pick", "my_odds", "their_odds", "stake", "reason"}
        suggestions = [s for s in suggestions if isinstance(s, dict) and required.issubset(s.keys())]
    except Exception:
        suggestions = []

    return {"suggestions": suggestions}
