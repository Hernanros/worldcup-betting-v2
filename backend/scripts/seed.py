"""CLI seed script — imports matches from Odds API or seeds a minimal dev fixture set."""
import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from datetime import datetime, timezone
from app.config import settings
from app.database import init_db, AsyncSessionLocal, Base, engine
from app.models import Match


SAMPLE_MATCHES = [
    ("Argentina", "Saudi Arabia", "2026-06-20T10:00:00Z", "group"),
    ("France",    "Australia",    "2026-06-20T13:00:00Z", "group"),
    ("Germany",   "Japan",        "2026-06-20T16:00:00Z", "group"),
    ("Spain",     "Costa Rica",   "2026-06-21T10:00:00Z", "group"),
    ("Belgium",   "Canada",       "2026-06-21T13:00:00Z", "group"),
    ("Brazil",    "Serbia",       "2026-06-21T16:00:00Z", "group"),
]


async def seed():
    init_db(settings.database_url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        for home, away, kickoff_str, round_ in SAMPLE_MATCHES:
            kickoff = datetime.fromisoformat(kickoff_str.replace("Z", "+00:00"))
            existing = await db.execute(
                __import__("sqlalchemy").select(Match).where(
                    Match.home_team == home, Match.away_team == away
                )
            )
            if existing.scalar_one_or_none():
                print(f"  skip: {home} vs {away} already exists")
                continue
            m = Match(home_team=home, away_team=away, kickoff_time=kickoff, round=round_)
            db.add(m)
            print(f"  add: {home} vs {away}")
        await db.commit()
    print("Seed complete.")


if __name__ == "__main__":
    asyncio.run(seed())
