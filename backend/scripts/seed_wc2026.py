"""
Seed script — 2026 FIFA World Cup full schedule.
Run against production DB:
  DATABASE_URL=<railway_url> python scripts/seed_wc2026.py

Use --reset to wipe existing matches first:
  DATABASE_URL=<railway_url> python scripts/seed_wc2026.py --reset

All kickoff times are UTC.
"""
import asyncio
import sys
import os
import re
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from datetime import datetime
from sqlalchemy import select, delete
from app.database import init_db, AsyncSessionLocal, create_tables
from app.models import Match
import app.database as _db

# (home, away, kickoff_utc, round)
MATCHES = [
    # ── GROUP A (Mexico, Jamaica, Venezuela, Ecuador) ──────────────────
    ("Mexico",       "Jamaica",       "2026-06-11T23:00:00Z", "group"),
    ("Venezuela",    "Ecuador",       "2026-06-12T02:00:00Z", "group"),
    ("Mexico",       "Venezuela",     "2026-06-16T20:00:00Z", "group"),
    ("Jamaica",      "Ecuador",       "2026-06-16T23:00:00Z", "group"),
    ("Mexico",       "Ecuador",       "2026-06-23T01:00:00Z", "group"),
    ("Jamaica",      "Venezuela",     "2026-06-23T01:00:00Z", "group"),

    # ── GROUP B (USA, Panama, Bolivia, New Zealand) ────────────────────
    ("USA",          "Bolivia",       "2026-06-12T23:00:00Z", "group"),
    ("Panama",       "New Zealand",   "2026-06-13T02:00:00Z", "group"),
    ("USA",          "Panama",        "2026-06-17T20:00:00Z", "group"),
    ("Bolivia",      "New Zealand",   "2026-06-17T23:00:00Z", "group"),
    ("USA",          "New Zealand",   "2026-06-23T21:00:00Z", "group"),
    ("Bolivia",      "Panama",        "2026-06-23T21:00:00Z", "group"),

    # ── GROUP C (Canada, Honduras, Morocco, Belgium) ───────────────────
    ("Morocco",      "Belgium",       "2026-06-13T20:00:00Z", "group"),
    ("Canada",       "Honduras",      "2026-06-13T23:00:00Z", "group"),
    ("Morocco",      "Canada",        "2026-06-18T20:00:00Z", "group"),
    ("Belgium",      "Honduras",      "2026-06-18T23:00:00Z", "group"),
    ("Morocco",      "Honduras",      "2026-06-24T01:00:00Z", "group"),
    ("Belgium",      "Canada",        "2026-06-24T01:00:00Z", "group"),

    # ── GROUP D (Brazil, Paraguay, Japan, Croatia) ─────────────────────
    ("Brazil",       "Croatia",       "2026-06-14T20:00:00Z", "group"),
    ("Japan",        "Paraguay",      "2026-06-14T23:00:00Z", "group"),
    ("Brazil",       "Japan",         "2026-06-19T20:00:00Z", "group"),
    ("Croatia",      "Paraguay",      "2026-06-19T23:00:00Z", "group"),
    ("Brazil",       "Paraguay",      "2026-06-24T21:00:00Z", "group"),
    ("Japan",        "Croatia",       "2026-06-24T21:00:00Z", "group"),

    # ── GROUP E (Argentina, Chile, Australia, Poland) ──────────────────
    ("Argentina",    "Chile",         "2026-06-14T02:00:00Z", "group"),
    ("Australia",    "Poland",        "2026-06-15T02:00:00Z", "group"),
    ("Argentina",    "Australia",     "2026-06-19T02:00:00Z", "group"),
    ("Chile",        "Poland",        "2026-06-20T02:00:00Z", "group"),
    ("Argentina",    "Poland",        "2026-06-25T01:00:00Z", "group"),
    ("Chile",        "Australia",     "2026-06-25T01:00:00Z", "group"),

    # ── GROUP F (Spain, Portugal, Senegal, Cameroon) ───────────────────
    ("Spain",        "Senegal",       "2026-06-15T20:00:00Z", "group"),
    ("Portugal",     "Cameroon",      "2026-06-15T23:00:00Z", "group"),
    ("Spain",        "Cameroon",      "2026-06-20T20:00:00Z", "group"),
    ("Portugal",     "Senegal",       "2026-06-20T23:00:00Z", "group"),
    ("Spain",        "Portugal",      "2026-06-25T21:00:00Z", "group"),
    ("Senegal",      "Cameroon",      "2026-06-25T21:00:00Z", "group"),

    # ── GROUP G (France, Uruguay, South Korea, Serbia) ─────────────────
    ("France",       "Serbia",        "2026-06-16T02:00:00Z", "group"),
    ("Uruguay",      "South Korea",   "2026-06-16T05:00:00Z", "group"),
    ("France",       "Uruguay",       "2026-06-21T02:00:00Z", "group"),
    ("Serbia",       "South Korea",   "2026-06-21T05:00:00Z", "group"),
    ("France",       "South Korea",   "2026-06-26T01:00:00Z", "group"),
    ("Serbia",       "Uruguay",       "2026-06-26T01:00:00Z", "group"),

    # ── GROUP H (England, Netherlands, Algeria, Tunisia) ──────────────
    ("England",      "Algeria",       "2026-06-16T23:00:00Z", "group"),
    ("Netherlands",  "Tunisia",       "2026-06-17T02:00:00Z", "group"),
    ("England",      "Netherlands",   "2026-06-21T23:00:00Z", "group"),
    ("Algeria",      "Tunisia",       "2026-06-22T02:00:00Z", "group"),
    ("England",      "Tunisia",       "2026-06-26T21:00:00Z", "group"),
    ("Algeria",      "Netherlands",   "2026-06-26T21:00:00Z", "group"),

    # ── GROUP I (Germany, Colombia, Saudi Arabia, Slovenia) ────────────
    ("Germany",      "Colombia",      "2026-06-17T02:00:00Z", "group"),
    ("Saudi Arabia", "Slovenia",      "2026-06-17T05:00:00Z", "group"),
    ("Germany",      "Saudi Arabia",  "2026-06-22T02:00:00Z", "group"),
    ("Colombia",     "Slovenia",      "2026-06-22T05:00:00Z", "group"),
    ("Germany",      "Slovenia",      "2026-06-27T01:00:00Z", "group"),
    ("Colombia",     "Saudi Arabia",  "2026-06-27T01:00:00Z", "group"),

    # ── GROUP J (Italy, Ivory Coast, DR Congo, South Africa) ──────────
    ("Italy",        "Ivory Coast",   "2026-06-18T02:00:00Z", "group"),
    ("DR Congo",     "South Africa",  "2026-06-18T05:00:00Z", "group"),
    ("Italy",        "DR Congo",      "2026-06-23T02:00:00Z", "group"),
    ("Ivory Coast",  "South Africa",  "2026-06-23T05:00:00Z", "group"),
    ("Italy",        "South Africa",  "2026-06-27T21:00:00Z", "group"),
    ("Ivory Coast",  "DR Congo",      "2026-06-27T21:00:00Z", "group"),

    # ── GROUP K (Turkey, Czechia, Iran, Nigeria) ───────────────────────
    ("Turkey",       "Nigeria",       "2026-06-19T05:00:00Z", "group"),
    ("Czechia",      "Iran",          "2026-06-19T02:00:00Z", "group"),
    ("Turkey",       "Czechia",       "2026-06-24T05:00:00Z", "group"),
    ("Iran",         "Nigeria",       "2026-06-24T02:00:00Z", "group"),
    ("Turkey",       "Iran",          "2026-06-28T01:00:00Z", "group"),
    ("Czechia",      "Nigeria",       "2026-06-28T01:00:00Z", "group"),

    # ── GROUP L (Switzerland, Egypt, Ghana, El Salvador) ──────────────
    ("Switzerland",  "Ghana",         "2026-06-20T05:00:00Z", "group"),
    ("Egypt",        "El Salvador",   "2026-06-20T02:00:00Z", "group"),
    ("Switzerland",  "Egypt",         "2026-06-25T05:00:00Z", "group"),
    ("Ghana",        "El Salvador",   "2026-06-25T02:00:00Z", "group"),
    ("Switzerland",  "El Salvador",   "2026-06-28T21:00:00Z", "group"),
    ("Egypt",        "Ghana",         "2026-06-28T21:00:00Z", "group"),
]


async def seed(reset: bool = False):
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        print("ERROR: set DATABASE_URL env var")
        sys.exit(1)
    url = re.sub(r"^postgres(?:ql)?://", "postgresql+asyncpg://", url)

    init_db(url)
    await create_tables()

    async with _db.AsyncSessionLocal() as db:
        if reset:
            await db.execute(delete(Match))
            await db.commit()
            print("Existing matches wiped.")

        inserted = 0
        skipped = 0
        for home, away, kickoff_str, round_ in MATCHES:
            existing = (await db.execute(
                select(Match).where(Match.home_team == home, Match.away_team == away)
            )).scalar_one_or_none()
            if existing:
                print(f"  skip (exists): {home} vs {away}")
                skipped += 1
                continue
            # DB column is TIMESTAMP WITHOUT TIME ZONE — store as naive UTC
            kickoff = datetime.fromisoformat(kickoff_str.replace("Z", "+00:00")).replace(tzinfo=None)
            db.add(Match(
                home_team=home,
                away_team=away,
                kickoff_time=kickoff,
                round=round_,
                status="upcoming",
            ))
            inserted += 1
        await db.commit()

    print(f"\nDone — {inserted} matches inserted, {skipped} skipped.")
    print("Run the odds-fetch script next to populate odds_cache.")


if __name__ == "__main__":
    reset_flag = "--reset" in sys.argv
    if reset_flag:
        print("WARNING: --reset will delete all existing matches. Ctrl-C to abort.")
        import time; time.sleep(2)
    asyncio.run(seed(reset=reset_flag))
