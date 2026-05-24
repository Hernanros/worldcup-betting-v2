"""
Fetch odds from The Odds API and update odds_cache for all upcoming matches.
Run after seeding matches:

  DATABASE_URL=<railway_url> ODDS_API_KEY=<key> python scripts/fetch_odds.py

Safe to run multiple times — always overwrites odds_cache with fresh data.
"""
import asyncio
import sys
import os
import re
import json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from datetime import datetime, timezone
from sqlalchemy import select
from app.database import init_db, AsyncSessionLocal, create_tables
from app.models import Match
from app.odds_client import fetch_match_odds, extract_all_markets
import app.database as _db


def _normalize_name(name: str) -> str:
    """Lowercase + strip common suffixes to help fuzzy match API team names."""
    return name.lower().strip()


def _team_matches(api_name: str, db_name: str) -> bool:
    """True if the Odds API team name and our DB name refer to the same team."""
    a = _normalize_name(api_name)
    b = _normalize_name(db_name)
    if a == b:
        return True
    # Common alias pairs
    aliases = {
        "south korea": ["korea republic", "republic of korea"],
        "usa": ["united states", "united states of america"],
        "ivory coast": ["côte d'ivoire", "cote d'ivoire"],
        "dr congo": ["congo dr", "democratic republic of congo"],
        "czechia": ["czech republic"],
        "england": ["england"],
        "netherlands": ["holland"],
    }
    for canonical, alts in aliases.items():
        all_names = [canonical] + alts
        if a in all_names and b in all_names:
            return True
    return False


async def update_odds(dry_run: bool = False):
    db_url = os.environ.get("DATABASE_URL", "")
    api_key = os.environ.get("ODDS_API_KEY", "")

    if not db_url:
        print("ERROR: set DATABASE_URL env var")
        sys.exit(1)
    if not api_key:
        print("ERROR: set ODDS_API_KEY env var")
        sys.exit(1)

    db_url = re.sub(r"^postgres(?:ql)?://", "postgresql+asyncpg://", db_url)
    init_db(db_url)
    await create_tables()

    # Fetch from Odds API
    print("Fetching odds from The Odds API...")
    try:
        result = fetch_match_odds(api_key)
    except Exception as e:
        print(f"ERROR fetching odds: {e}")
        sys.exit(1)

    events = result["data"]
    quota_remaining = result["quota_remaining"]
    print(f"  Got {len(events)} events, quota remaining: {quota_remaining}")

    async with _db.AsyncSessionLocal() as db:
        upcoming = (await db.execute(
            select(Match).where(Match.status == "upcoming")
        )).scalars().all()

        print(f"  Matching against {len(upcoming)} upcoming DB matches...")
        updated = 0
        unmatched_api = []

        for event in events:
            api_home = event.get("home_team", "")
            api_away = event.get("away_team", "")

            # Find matching DB match
            matched = None
            for m in upcoming:
                if _team_matches(api_home, m.home_team) and _team_matches(api_away, m.away_team):
                    matched = m
                    break
                # also try reversed (sometimes API flips home/away)
                if _team_matches(api_home, m.away_team) and _team_matches(api_away, m.home_team):
                    matched = m
                    break

            if not matched:
                unmatched_api.append(f"{api_home} vs {api_away}")
                continue

            markets = extract_all_markets(event)
            if not markets:
                continue

            # Normalize market keys to our naming convention
            # API uses: h2h, totals, btts → we store as: 1x2, totals, btts
            normalized = {}
            for key, outcomes in markets.items():
                if key == "h2h":
                    # Outcomes: [{"name": "TeamA", "price": 2.1}, ...]
                    # Map to our 1x2 format: Home Win / Draw / Away Win
                    norm_outcomes = []
                    for o in outcomes:
                        if o["name"] == matched.home_team or _team_matches(o["name"], matched.home_team):
                            norm_outcomes.append({"name": "Home Win", "price": o["price"]})
                        elif o["name"] == matched.away_team or _team_matches(o["name"], matched.away_team):
                            norm_outcomes.append({"name": "Away Win", "price": o["price"]})
                        elif o["name"].lower() in ("draw", "tie"):
                            norm_outcomes.append({"name": "Draw", "price": o["price"]})
                        else:
                            norm_outcomes.append({"name": o["name"], "price": o["price"]})
                    normalized["1x2"] = norm_outcomes
                elif key == "totals":
                    norm_outcomes = []
                    for o in outcomes:
                        label = f"Over {o.get('point', 2.5)}" if o["name"] == "Over" else f"Under {o.get('point', 2.5)}"
                        norm_outcomes.append({"name": label, "price": o["price"]})
                    normalized["totals"] = norm_outcomes
                elif key in ("btts", "both_teams_to_score"):
                    normalized["btts"] = [{"name": o["name"], "price": o["price"]} for o in outcomes]
                else:
                    normalized[key] = outcomes

            if dry_run:
                print(f"  [dry-run] would update: {matched.home_team} vs {matched.away_team} — markets: {list(normalized.keys())}")
            else:
                matched.odds_cache = json.dumps(normalized)
                matched.odds_fetched_at = datetime.now(timezone.utc)
                updated += 1
                print(f"  ✓ updated: {matched.home_team} vs {matched.away_team} — {list(normalized.keys())}")

        if not dry_run:
            await db.commit()

    print(f"\nDone — {updated} matches updated with odds.")
    if unmatched_api:
        print(f"\nAPI events with no DB match ({len(unmatched_api)}):")
        for name in unmatched_api[:10]:
            print(f"  - {name}")


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    asyncio.run(update_odds(dry_run=dry_run))
