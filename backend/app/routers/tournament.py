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

# Total goals over/under lines (WC avg ~2.5 goals/match × 64 matches = ~160)
TOTAL_GOALS_MARKETS = [
    {"name": "Over 149.5",  "odds": 2.10},
    {"name": "Under 149.5", "odds": 1.75},
    {"name": "Over 159.5",  "odds": 1.90},
    {"name": "Under 159.5", "odds": 1.90},
    {"name": "Over 169.5",  "odds": 1.75},
    {"name": "Under 169.5", "odds": 2.10},
]


@router.get("/api/tournament/markets")
async def get_tournament_markets(auth=Depends(get_current_player)):
    locked = datetime.now(timezone.utc) >= TOURNAMENT_LOCK_TIME
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
                "description": "Top scorer of the tournament — enter a player name.",
                "type": "text",
                "default_odds": 10.0,
                "hint": "e.g. Mbappé, Vinicius Jr, Bellingham",
            },
            "total_goals": {
                "label": "⚽ Total Tournament Goals",
                "description": "Total goals scored across all 64 matches.",
                "type": "pick",
                "options": TOTAL_GOALS_MARKETS,
            },
        },
    }


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
        odds = float(data.get("odds", 5.0))
    except (TypeError, ValueError):
        raise HTTPException(400, "invalid stake or odds")

    if stake < 1:
        raise HTTPException(400, "minimum stake is 1")

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
    return {"id": tbet.id, "new_balance": player.token_balance}


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
