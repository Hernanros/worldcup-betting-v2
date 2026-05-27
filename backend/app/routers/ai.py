import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import anthropic
from app.database import get_db
from app.deps import get_current_player
from app.models import Match, Player
from app.config import settings

router = APIRouter()

anthropic_client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

_SYSTEM = """You are a sports betting advisor for a World Cup friend group.
Given a match and its current odds, suggest exactly 2 interesting P2P challenge ideas.
Respond ONLY with a valid JSON array — no markdown, no explanation, just the array.
Each item in the array must have exactly these fields:
{
  "title": "short label for the bet type, e.g. 'Home Win' or 'Correct Score'",
  "my_pick": "the issuer's selection, e.g. 'Argentina' or '2-1'",
  "their_pick": "the acceptor's opposing selection, e.g. 'Brazil' or '1-2'",
  "my_odds": 2.5,
  "their_odds": 1.6,
  "stake": 100,
  "reason": "one sentence explaining why this pick is interesting"
}
Stakes should be between 50 and 300. Odds must be positive floats."""


def _build_prompt(match: Match, player: Player, odds: dict) -> str:
    lines = [
        f"Match: {match.home_team} vs {match.away_team}",
        f"Round: {match.round}",
        f"Player balance: {player.token_balance} tokens",
        f"Player challenge streak: {player.challenge_streak}",
        "", "Available odds:",
    ]
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
    match = await db.get(Match, data.get("match_id"))
    if not match:
        raise HTTPException(404, "match not found")
    try:
        odds = json.loads(match.odds_cache) if match.odds_cache else {}
    except (json.JSONDecodeError, ValueError):
        odds = {}
    player = await db.get(Player, player.id)

    prompt = _build_prompt(match, player, odds)
    try:
        message = anthropic_client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=600,
            system=_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        suggestions = json.loads(message.content[0].text)
        if not isinstance(suggestions, list):
            suggestions = []
    except Exception:
        suggestions = []

    return {"suggestions": suggestions}
