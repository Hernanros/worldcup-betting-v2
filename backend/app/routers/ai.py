import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
import anthropic
from app.database import get_db
from app.deps import get_current_player
from app.models import Match, Player
from app.config import settings

router = APIRouter()

anthropic_client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

_SYSTEM = """You are a sports betting advisor for a World Cup friend group.
Given a match and its current odds, suggest 2-3 interesting P2P challenge ideas.
For each suggestion include:
1. The market and pick (e.g. "Correct Score 2-1 Argentina")
2. A recommended stake (between 50-300 tokens)
3. One sentence explaining why this pick is interesting given the odds.
Format each suggestion with a bold header like **Challenge 1:**.
Keep it punchy and fun — this is for friends, not a casino."""


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
    lines.append("\nSuggest 2-3 challenge ideas for this match.")
    return "\n".join(lines)


async def _stream_suggestions(match: Match, player: Player, odds: dict):
    prompt = _build_prompt(match, player, odds)
    try:
        with anthropic_client.messages.stream(
            model="claude-sonnet-4-6",
            max_tokens=600,
            system=_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            for event in stream:
                if event.type == "content_block_delta":
                    yield f"data: {json.dumps({'text': event.delta.text})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
    yield "data: [DONE]\n\n"


@router.post("/api/ai/suggest-challenge")
async def suggest_challenge(data: dict, auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    player, _ = auth
    match = await db.get(Match, data.get("match_id"))
    if not match:
        raise HTTPException(404, "match not found")
    try:
        odds = json.loads(match.odds_cache) if match.odds_cache else {}
    except (json.JSONDecodeError, ValueError):
        odds = {}
    player = await db.get(Player, player.id)
    return StreamingResponse(
        _stream_suggestions(match, player, odds),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
