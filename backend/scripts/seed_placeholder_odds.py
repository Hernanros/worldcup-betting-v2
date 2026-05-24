"""
Seed placeholder odds for all upcoming matches so the betting panel is testable
before the Odds API publishes real odds (typically 3-7 days before each match).

These are rough historical averages for group stage WC matches.
Real odds will overwrite these when you run fetch_odds.py closer to kickoff.

Usage:
  DATABASE_URL=<url> python scripts/seed_placeholder_odds.py
"""
import asyncio, sys, os, re, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import select
from app.database import init_db, AsyncSessionLocal, create_tables
from app.models import Match
import app.database as _db

# Teams where the "stronger" side has clearer favouritism
FAVOURITES = {
    # (home, away) -> (home_odds, draw_odds, away_odds)
    ("France", "Serbia"):         (1.55, 4.00, 6.50),
    ("Brazil", "Croatia"):        (1.65, 3.80, 5.50),
    ("Argentina", "Chile"):       (1.70, 3.60, 5.00),
    ("Spain", "Senegal"):         (1.75, 3.50, 4.75),
    ("Portugal", "Cameroon"):     (1.60, 3.75, 5.75),
    ("Germany", "Colombia"):      (1.80, 3.40, 4.50),
    ("England", "Algeria"):       (1.75, 3.50, 5.00),
    ("Netherlands", "Tunisia"):   (1.80, 3.40, 4.75),
    ("France", "Uruguay"):        (1.65, 3.60, 5.50),
    ("Brazil", "Japan"):          (1.60, 3.75, 6.00),
    ("Argentina", "Australia"):   (1.50, 4.00, 7.00),
    ("Spain", "Portugal"):        (2.50, 3.10, 2.80),  # Derby — nearly even
    ("England", "Netherlands"):   (2.40, 3.20, 2.90),  # Close
    ("Brazil", "Paraguay"):       (1.55, 3.80, 6.50),
    ("France", "South Korea"):    (1.50, 4.00, 7.00),
    ("Germany", "Saudi Arabia"):  (1.40, 4.50, 9.00),
    ("Italy", "Ivory Coast"):     (2.00, 3.20, 4.00),
}

DEFAULT_ODDS = (2.40, 3.20, 2.90)  # balanced group-stage match


def _lookup(home: str, away: str):
    key = (home, away)
    if key in FAVOURITES:
        return FAVOURITES[key]
    rev = (away, home)
    if rev in FAVOURITES:
        a, d, h = FAVOURITES[rev]
        return h, d, a
    return DEFAULT_ODDS


def _make_odds(home: str, away: str) -> dict:
    h, d, a = _lookup(home, away)
    return {
        "1x2": [
            {"name": "Home Win", "price": h},
            {"name": "Draw",     "price": d},
            {"name": "Away Win", "price": a},
        ],
        "totals": [
            {"name": "Over 2.5",  "price": 1.90},
            {"name": "Under 2.5", "price": 1.90},
            {"name": "Over 3.5",  "price": 3.00},
            {"name": "Under 3.5", "price": 1.40},
        ],
        "btts": [
            {"name": "Yes", "price": 1.85},
            {"name": "No",  "price": 1.95},
        ],
    }


async def seed():
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        print("ERROR: set DATABASE_URL env var"); sys.exit(1)
    url = re.sub(r"^postgres(?:ql)?://", "postgresql+asyncpg://", url)
    init_db(url)
    await create_tables()

    async with _db.AsyncSessionLocal() as db:
        matches = (await db.execute(
            select(Match).where(Match.status == "upcoming", Match.odds_cache == None)  # noqa: E711
        )).scalars().all()

        updated = 0
        for m in matches:
            m.odds_cache = json.dumps(_make_odds(m.home_team, m.away_team))
            updated += 1

        await db.commit()

    print(f"Done — placeholder odds set for {updated} matches.")
    print("Re-run fetch_odds.py once the Odds API publishes real lines (~June 7-10).")


asyncio.run(seed())
