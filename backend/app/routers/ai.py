import json
import os
import re
import time
import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import anthropic
from app.database import get_db
from app.deps import get_current_player
from app.models import Match, Player, Bet, TournamentBet, SpicyBet
from app.config import settings

# ── In-memory news cache (team_pair → (timestamp, text)) ─────────────────────
_news_cache: dict[str, tuple[float, str]] = {}
_NEWS_TTL = 6 * 3600  # 6 hours

async def _fetch_team_news(home: str, away: str) -> str:
    """Search for recent team news/injuries using Serper API. Returns '' if key missing."""
    api_key = os.getenv("SERPER_API_KEY", "")
    if not api_key:
        return ""
    cache_key = f"{home}|{away}"
    now = time.time()
    if cache_key in _news_cache:
        ts, text = _news_cache[cache_key]
        if now - ts < _NEWS_TTL:
            return text
    try:
        q = f"{home} vs {away} 2026 World Cup injuries form team news"
        print(f"[Serper] fetching news for: {q}", flush=True)
        async with httpx.AsyncClient(timeout=4.0) as client:
            r = await client.post(
                "https://google.serper.dev/search",
                headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
                json={"q": q, "num": 5, "gl": "us", "hl": "en"},
            )
        snippets = [
            f"- {item.get('title','')}: {item.get('snippet','')}"
            for item in r.json().get("organic", [])[:5]
            if item.get("snippet")
        ]
        text = "\n".join(snippets) if snippets else ""
        print(f"[Serper] got {len(snippets)} snippets (status {r.status_code})", flush=True)
    except Exception as e:
        print(f"[Serper] error: {e}", flush=True)
        text = ""
    _news_cache[cache_key] = (now, text)
    return text

router = APIRouter()

anthropic_client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

_SYSTEM = """You are a dare advisor for a World Cup friend group.
Given a match, suggest exactly 2 fun, spicy P2P dare ideas.
NEVER suggest match result (1x2) or correct score — these are too generic.
Focus on prop outcomes that make matches interesting to watch beyond the final score.
Each of your 2 suggestions MUST use a different bet_type.
Prefer player_h2h when star players are listed for the match.
Prefer handicap when h2h odds show a clear favourite (one team's price noticeably lower).
Avoid repeating btts or totals — use them only when nothing else fits.
Respond ONLY with a valid JSON array — no markdown, no explanation, just the array.
Each item must have exactly these fields:
{
  "title": "short fun label, e.g. 'Messi vs Mbappé', 'Corner Fest', 'Argentina Cover'",
  "bet_type": "one of: btts, any_red_card, went_to_et, went_to_pens, totals, total_cards, corners, offsides, handicap, player_h2h",
  "my_pick": "issuer selection per type:
    btts/any_red_card/went_to_et/went_to_pens → 'Yes' or 'No'
    totals → 'Over N.5' or 'Under N.5' (e.g. 'Over 2.5')
    total_cards → 'Over N.5' or 'Under N.5' (e.g. 'Over 3.5')
    corners → 'Over N.5' or 'Under N.5' (e.g. 'Over 9.5')
    offsides → 'Over N.5' or 'Under N.5' (e.g. 'Over 3.5')
    handicap → '{team} +{line}' (e.g. 'Argentina +1.5' — backs Argentina to not lose by 2+)
    player_h2h → '{player_name} goals' or '{player_name} assists' (e.g. 'Messi goals')",
  "their_pick": "exact opposite — 'No'/'Yes', 'Under N.5'/'Over N.5', '{other_team} -{line}' for handicap, '{other_player} goals/assists' for player_h2h",
  "my_odds": 2.0,
  "their_odds": 1.85,
  "stake": 100,
  "reason": "one sentence on why this dare is juicy for this specific match"
}
Stakes 50–300. Odds must be positive floats. Vary bet_type across the 2 suggestions.
Typical WC lines: corners ~9.5, offsides ~3.5, total cards ~3.5, goals ~2.5.
For handicap: use +0.5/+1/+1.5/+2/+2.5 lines; pick the underdog when match-up is lopsided.
For player_h2h: use exactly 'goals' or 'assists' as the stat suffix."""


_STAR_PLAYERS = {
    # Group A
    "Mexico":               ["Lozano", "Jiménez", "Guardado"],
    "South Africa":         ["Tau", "Dolly", "Zwane"],
    "South Korea":          ["Son", "Lee Kang-In", "Hwang"],
    "Czechia":              ["Schick", "Souček", "Barák"],
    # Group B
    "Canada":               ["Davies", "David", "Buchanan"],
    "Switzerland":          ["Xhaka", "Shaqiri", "Embolo"],
    "Bosnia-Herzegovina":   ["Džeko", "Kolašinac", "Pjanić"],
    "Qatar":                ["Al-Haydos", "Afif"],
    # Group C
    "USA":                  ["Pulisic", "Reyna", "Adams"],
    "Turkey":               ["Calhanoglu", "Arda Güler", "Yildiz"],
    "Paraguay":             ["Almirón", "Sanabria"],
    "Australia":            ["Hrustic", "Irvine", "Boyle"],
    # Group D
    "Brazil":               ["Vini Jr", "Rodrygo", "Raphinha", "Paquetá"],
    "Morocco":              ["En-Nesyri", "Hakimi", "Ziyech"],
    "Scotland":             ["McGinn", "McTominay", "Adams"],
    # Group E
    "Germany":              ["Müller", "Wirtz", "Gnabry", "Havertz"],
    "Ivory Coast":          ["Zaha", "Gradel", "Haller"],
    "Ecuador":              ["Caicedo", "Plata", "Enner Valencia"],
    # Group F
    "Netherlands":          ["Van Dijk", "Gakpo", "Depay", "Simons"],
    "Japan":                ["Mitoma", "Kubo", "Kamada"],
    "Sweden":               ["Isak", "Forsberg", "Kulusevski"],
    "Tunisia":              ["Msakni", "Sliti", "Talbi"],
    # Group G
    "Spain":                ["Pedri", "Yamal", "Morata", "Olmo"],
    "Saudi Arabia":         ["Al-Dawsari", "Al-Shahrani"],
    "Uruguay":              ["Núñez", "Valverde", "Araújo"],
    "Cape Verde":           ["Tavares", "Andrade"],
    # Group H
    "Belgium":              ["De Bruyne", "Lukaku", "Tielemans"],
    "Egypt":                ["Salah", "Trezeguet"],
    "Iran":                 ["Taremi", "Jahanbakhsh", "Azmoun"],
    "New Zealand":          ["Wood", "McGlinchey"],
    # Group I
    "France":               ["Mbappé", "Griezmann", "Dembélé", "Camavinga"],
    "Senegal":              ["Mané", "Dia", "Sarr"],
    "Norway":               ["Haaland", "Ødegaard", "Sörloth"],
    "Iraq":                 ["Allawi", "Ali Adnan"],
    # Group J
    "Argentina":            ["Messi", "Di María", "Álvarez", "Mac Allister"],
    "Algeria":              ["Mahrez", "Benrahma", "Slimani"],
    "Austria":              ["Alaba", "Sabitzer", "Arnautovic"],
    "Jordan":               ["Al-Naimat", "Bani Attiah"],
    # Group K
    "Portugal":             ["Ronaldo", "B. Silva", "Félix", "R. Leão"],
    "DR Congo":             ["Bakambu", "Mbemba"],
    "Colombia":             ["James", "Díaz", "Arias"],
    "Uzbekistan":           ["Shomurodov", "Tursunov"],
    # Group L
    "England":              ["Bellingham", "Saka", "Foden", "Kane"],
    "Croatia":              ["Modrić", "Kovačić", "Gvardiol"],
    "Ghana":                ["Kudus", "Partey", "Ayew"],
    "Panama":               ["Davis", "Blackburn"],
}


def _build_prompt(match: Match, player: Player, odds: dict,
                  existing_bet=None, existing_prediction=None, open_challenges=None,
                  recent_bets=None, tournament_bets=None, deep_cuts_bets=None,
                  team_news: str = "") -> str:
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
    # Star players context — helps Claude favour player_h2h suggestions
    home_stars = _STAR_PLAYERS.get(match.home_team, [])
    away_stars  = _STAR_PLAYERS.get(match.away_team, [])
    all_stars   = home_stars + away_stars
    if all_stars:
        lines.append(f"Star players available (use for player_h2h): {', '.join(all_stars[:8])}")
    if team_news:
        lines.append(f"\nRecent team news (use for context — injuries, form, chatter):\n{team_news}")
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
        label = "h2h (match-result odds — use for handicap sizing)" if market == "h2h" else market
        lines.append(f"  {label}:")
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

    team_news = await _fetch_team_news(match.home_team, match.away_team)
    prompt = _build_prompt(
        match, player, odds,
        existing_bet, existing_prediction, open_challenges,
        recent_bets=recent_bets,
        tournament_bets=tournament_bets,
        deep_cuts_bets=deep_cuts_bets,
        team_news=team_news,
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


_ODDS_SYSTEM = """You are an odds compiler for a friend-group sports betting app.
Given a P2P bet between two friends, suggest fair decimal odds for each side.
Consider the implied probability of each outcome. Odds must be >= 1.01 and <= 15.
Respond ONLY with valid JSON: {"issuer_odds": X.XX, "acceptor_odds": X.XX, "reasoning": "one sentence"}
No markdown, no explanation outside the JSON."""


@router.post("/api/ai/suggest-odds")
async def suggest_odds(
    data: dict,
    auth=Depends(get_current_player),
    db: AsyncSession = Depends(get_db),
):
    player, _ = auth
    match = await db.get(Match, data.get("match_id"))
    if not match:
        raise HTTPException(404, "match not found")

    bet_type = data.get("bet_type", "")
    selection = data.get("selection", "")
    acceptor_selection = data.get("acceptor_selection", "")

    try:
        odds = json.loads(match.odds_cache) if match.odds_cache else {}
    except Exception:
        odds = {}

    odds_lines = []
    for market, outcomes in odds.items():
        for o in outcomes:
            odds_lines.append(f"  {market} {o.get('name','?')}: {o.get('price','?')}")
    odds_text = "\n".join(odds_lines) if odds_lines else "  (no market odds available)"

    prompt = (
        f"Match: {match.home_team} vs {match.away_team}\n"
        f"Bet type: {bet_type}\n"
        f"Side A (issuer) pick: {selection}\n"
        f"Side B (acceptor) pick: {acceptor_selection}\n"
        f"Available market odds:\n{odds_text}\n\n"
        "Suggest fair decimal odds for each side. "
        "Use the market odds as reference. "
        "If the bet is roughly 50/50, use ~2.0/2.0. "
        "If one side is more likely, give it lower odds."
    )

    try:
        message = anthropic_client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=120,
            system=_ODDS_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip()
        fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
        if fence:
            raw = fence.group(1).strip()
        result = json.loads(raw)
        issuer_odds = round(max(1.01, min(15.0, float(result["issuer_odds"]))), 2)
        acceptor_odds = round(max(1.01, min(15.0, float(result["acceptor_odds"]))), 2)
        reasoning = str(result.get("reasoning", ""))[:120]
    except Exception:
        issuer_odds, acceptor_odds, reasoning = 2.0, 2.0, ""

    return {"issuer_odds": issuer_odds, "acceptor_odds": acceptor_odds, "reasoning": reasoning}
