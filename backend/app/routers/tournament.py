import unicodedata
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.deps import get_current_player
from app.models import TournamentBet, Player

router = APIRouter()

TOURNAMENT_LOCK_TIME = datetime(2026, 6, 11, 18, 0, 0, tzinfo=timezone.utc)

# Winner odds from The Odds API (fetched 2026-05-24, best price across bookmakers)
WINNER_ODDS = [
    {"name": "Spain",                 "odds": 5.5},
    {"name": "France",                "odds": 5.5},
    {"name": "England",               "odds": 7.0},
    {"name": "Brazil",                "odds": 9.0},
    {"name": "Argentina",             "odds": 10.0},
    {"name": "Portugal",              "odds": 12.0},
    {"name": "Germany",               "odds": 15.0},
    {"name": "Netherlands",           "odds": 21.0},
    {"name": "Norway",                "odds": 29.0},
    {"name": "Belgium",               "odds": 34.0},
    {"name": "Colombia",              "odds": 34.0},
    {"name": "Japan",                 "odds": 51.0},
    {"name": "USA",                   "odds": 51.0},
    {"name": "Switzerland",           "odds": 51.0},
    {"name": "Morocco",               "odds": 67.0},
    {"name": "Uruguay",               "odds": 67.0},
    {"name": "Mexico",                "odds": 67.0},
    {"name": "Turkey",                "odds": 81.0},
    {"name": "Croatia",               "odds": 81.0},
    {"name": "Ivory Coast",           "odds": 81.0},
    {"name": "Ecuador",               "odds": 100.0},
    {"name": "Senegal",               "odds": 101.0},
    {"name": "Canada",                "odds": 151.0},
    {"name": "Paraguay",              "odds": 151.0},
    {"name": "Czechia",               "odds": 201.0},
    {"name": "Ghana",                 "odds": 251.0},
    {"name": "South Korea",           "odds": 301.0},
    {"name": "Egypt",                 "odds": 301.0},
    {"name": "Algeria",               "odds": 301.0},
    {"name": "Italy",                 "odds": 460.0},
    {"name": "Australia",             "odds": 501.0},
    {"name": "Tunisia",               "odds": 501.0},
    {"name": "Iran",                  "odds": 501.0},
    {"name": "South Africa",          "odds": 501.0},
    {"name": "DR Congo",              "odds": 751.0},
    {"name": "New Zealand",           "odds": 1000.0},
    {"name": "Poland",                "odds": 1000.0},
    {"name": "Saudi Arabia",          "odds": 1000.0},
    {"name": "Bolivia",               "odds": 1000.0},
    {"name": "Jamaica",               "odds": 1000.0},
    {"name": "Panama",                "odds": 1000.0},
    {"name": "Honduras",              "odds": 1000.0},
    {"name": "El Salvador",           "odds": 1000.0},
    {"name": "Venezuela",             "odds": 1000.0},
    {"name": "Slovenia",              "odds": 1000.0},
    {"name": "Nigeria",               "odds": 1000.0},
]

# Golden Boot player odds — sourced from bookmaker markets (2026-05-24).
# The Odds API does not offer a WC top-scorer outright; these are curated from
# Bet365 / William Hill / Unibet best prices at time of capture.
# Odds are decimal. Unknown players fall back to GOLDEN_BOOT_UNKNOWN_ODDS.
GOLDEN_BOOT_ODDS = [
    # Tier 1 — clear favourites
    {"name": "Kylian Mbappé",        "aliases": ["mbappe", "kylian mbappe"],      "odds": 6.0},
    {"name": "Vinicius Jr",          "aliases": ["vinicius", "vini jr"],           "odds": 7.0},
    {"name": "Erling Haaland",       "aliases": ["haaland"],                       "odds": 8.0},
    {"name": "Harry Kane",           "aliases": ["kane"],                          "odds": 9.0},

    # Tier 2 — strong contenders
    {"name": "Bukayo Saka",          "aliases": ["saka"],                          "odds": 12.0},
    {"name": "Jude Bellingham",      "aliases": ["bellingham"],                    "odds": 12.0},
    {"name": "Lamine Yamal",         "aliases": ["yamal"],                         "odds": 13.0},
    {"name": "Pedri",                "aliases": ["pedri"],                         "odds": 15.0},
    {"name": "Álvaro Morata",        "aliases": ["morata", "alvaro morata"],       "odds": 17.0},
    {"name": "Rafael Leão",          "aliases": ["leao", "rafael leao"],           "odds": 18.0},
    {"name": "Bernardo Silva",       "aliases": ["bernardo"],                      "odds": 20.0},
    {"name": "Antoine Griezmann",    "aliases": ["griezmann"],                     "odds": 20.0},
    {"name": "Neymar Jr",            "aliases": ["neymar"],                        "odds": 21.0},
    {"name": "Rodri",                "aliases": ["rodri"],                         "odds": 22.0},

    # Tier 3 — value picks
    {"name": "Darwin Núñez",         "aliases": ["nunez", "darwin nunez"],         "odds": 25.0},
    {"name": "Richarlison",          "aliases": ["richarlison"],                   "odds": 25.0},
    {"name": "Cody Gakpo",           "aliases": ["gakpo"],                         "odds": 25.0},
    {"name": "Marcus Rashford",      "aliases": ["rashford"],                      "odds": 26.0},
    {"name": "João Félix",           "aliases": ["joao felix", "felix"],           "odds": 28.0},
    {"name": "Karim Adeyemi",        "aliases": ["adeyemi"],                       "odds": 29.0},
    {"name": "Son Heung-min",        "aliases": ["son", "heung-min", "son heungmin"], "odds": 34.0},
    {"name": "Ousmane Dembélé",      "aliases": ["dembele"],                       "odds": 34.0},
    {"name": "Phil Foden",           "aliases": ["foden"],                         "odds": 34.0},
    {"name": "Ferran Torres",        "aliases": ["ferran"],                        "odds": 34.0},

    # Tier 4 — longshots worth naming
    {"name": "Casemiro",             "aliases": ["casemiro"],                      "odds": 40.0},
    {"name": "Serhou Guirassy",      "aliases": ["guirassy"],                      "odds": 40.0},
    {"name": "Oliver Giroud",        "aliases": ["giroud"],                        "odds": 41.0},
    {"name": "Ismaël Bennacer",      "aliases": ["bennacer"],                      "odds": 51.0},
    {"name": "Achraf Hakimi",        "aliases": ["hakimi"],                        "odds": 51.0},
    {"name": "Youssef En-Nesyri",    "aliases": ["en-nesyri", "en nesyri"],        "odds": 51.0},
    {"name": "Sadio Mané",           "aliases": ["mane", "sadio mane"],            "odds": 67.0},
]

# Players typed but not on the list — give them a longshot price rather than
# refusing the bet.  Keeps the market open for surprise discoveries.
GOLDEN_BOOT_UNKNOWN_ODDS = 101.0

# Total goals over/under lines (WC avg ~2.5 goals/match × 64 matches = ~160)
TOTAL_GOALS_MARKETS = [
    {"name": "Over 149.5",  "odds": 2.10},
    {"name": "Under 149.5", "odds": 1.75},
    {"name": "Over 159.5",  "odds": 1.90},
    {"name": "Under 159.5", "odds": 1.90},
    {"name": "Over 169.5",  "odds": 1.75},
    {"name": "Under 169.5", "odds": 2.10},
]


def _norm(s: str) -> str:
    """Lowercase + strip diacritics for fuzzy name matching."""
    nfkd = unicodedata.normalize("NFKD", s)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower().strip()


def _lookup_golden_boot_odds(player_name: str) -> float:
    """Return server-authoritative odds for a golden boot selection.

    Tries:
      1. Exact normalised match against entry["name"]
      2. Normalised match against any alias in entry["aliases"]
      3. GOLDEN_BOOT_UNKNOWN_ODDS for completely unknown names
    """
    query = _norm(player_name)
    for entry in GOLDEN_BOOT_ODDS:
        if _norm(entry["name"]) == query:
            return float(entry["odds"])
        if any(_norm(a) == query for a in entry.get("aliases", [])):
            return float(entry["odds"])
    return GOLDEN_BOOT_UNKNOWN_ODDS


@router.get("/api/tournament/markets")
async def get_tournament_markets(auth=Depends(get_current_player)):
    locked = datetime.now(timezone.utc) >= TOURNAMENT_LOCK_TIME
    # Expose golden boot options so the frontend can show them as suggestions;
    # strip aliases before sending (only name + odds needed client-side).
    gb_options = [{"name": e["name"], "odds": e["odds"]} for e in GOLDEN_BOOT_ODDS]
    return {
        "locked": locked,
        "lock_time": TOURNAMENT_LOCK_TIME.isoformat(),
        "markets": {
            "winner": {
                "label": "🏆 Tournament Winner",
                "description": "Which team lifts the trophy on July 19?",
                "type": "pick",
                "options": WINNER_ODDS,
            },
            "golden_boot": {
                "label": "👟 Golden Boot",
                "description": "Top scorer of the tournament — pick from the list or type any player.",
                "type": "text_pick",
                "options": gb_options,
                "unknown_odds": GOLDEN_BOOT_UNKNOWN_ODDS,
                "hint": "e.g. Mbappé, Vinicius Jr, Haaland",
            },
            "total_goals": {
                "label": "⚽ Total Tournament Goals",
                "description": "Total goals scored across all 64 matches.",
                "type": "pick",
                "options": TOTAL_GOALS_MARKETS,
            },
        },
    }


def _resolve_tournament_odds(bet_type: str, selection: str) -> float:
    """Return server-authoritative odds for a tournament bet.

    The client MUST NOT influence the returned value.
    """
    if bet_type == "winner":
        sel_norm = _norm(selection)
        for entry in WINNER_ODDS:
            if _norm(entry["name"]) == sel_norm:
                return float(entry["odds"])
        # Unknown team — cap at longest-shot in the list.
        return 1000.0

    if bet_type == "total_goals":
        sel_norm = _norm(selection)
        for entry in TOTAL_GOALS_MARKETS:
            if _norm(entry["name"]) == sel_norm:
                return float(entry["odds"])
        return 1.90

    if bet_type == "golden_boot":
        return _lookup_golden_boot_odds(selection)

    return 2.0


@router.post("/api/tournament/bets")
async def place_tournament_bet(data: dict, auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    if datetime.now(timezone.utc) >= TOURNAMENT_LOCK_TIME:
        raise HTTPException(400, "Tournament bets are locked — the tournament has started")

    player, _ = auth
    bet_type = data.get("bet_type")
    selection = data.get("selection")
    if not bet_type or not selection:
        raise HTTPException(400, "bet_type and selection are required")
    if bet_type not in ("winner", "golden_boot", "total_goals"):
        raise HTTPException(400, "bet_type must be winner, golden_boot, or total_goals")

    try:
        stake = int(data.get("stake", 0))
    except (TypeError, ValueError):
        raise HTTPException(400, "invalid stake")

    if stake < 1:
        raise HTTPException(400, "minimum stake is 1")

    # Server-side odds — client value is intentionally ignored.
    odds = _resolve_tournament_odds(bet_type, selection)

    player = await db.get(Player, player.id)
    if player.token_balance < stake:
        raise HTTPException(400, "insufficient balance")

    tbet = TournamentBet(
        player_id=player.id, bet_type=bet_type, selection=selection,
        stake=stake, odds_at_placement=odds,
    )
    player.token_balance -= stake
    db.add(tbet)
    await db.commit()
    await db.refresh(tbet)
    return {"id": tbet.id, "new_balance": player.token_balance, "odds": odds}


@router.get("/api/tournament/bets")
async def get_tournament_bets(auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    player, _ = auth
    bets = (await db.execute(
        select(TournamentBet).where(TournamentBet.player_id == player.id)
    )).scalars().all()
    return {
        "locked": datetime.now(timezone.utc) >= TOURNAMENT_LOCK_TIME,
        "lock_time": TOURNAMENT_LOCK_TIME.isoformat(),
        "my_bets": [
            {
                "id": b.id, "bet_type": b.bet_type, "selection": b.selection,
                "stake": b.stake, "odds": b.odds_at_placement, "status": b.status,
            }
            for b in bets
        ],
    }
