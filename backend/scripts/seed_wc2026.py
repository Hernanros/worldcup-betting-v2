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
# Team names match ESPN displayName where possible.
# Exceptions handled in results_client.TEAM_NAME_MAP:
#   ESPN "United States" → "USA"
#   ESPN "Türkiye"       → "Turkey"
#   ESPN "Congo DR"      → "DR Congo"
MATCHES = [
    # ── GROUP A (Mexico, South Africa, South Korea, Czechia) ───────────
    ("Mexico",              "South Africa",         "2026-06-11T19:00:00Z", "group"),
    ("South Korea",         "Czechia",              "2026-06-12T02:00:00Z", "group"),
    ("Czechia",             "South Africa",         "2026-06-18T16:00:00Z", "group"),
    ("Mexico",              "South Korea",          "2026-06-19T01:00:00Z", "group"),
    ("Czechia",             "Mexico",               "2026-06-25T01:00:00Z", "group"),
    ("South Africa",        "South Korea",          "2026-06-25T01:00:00Z", "group"),

    # ── GROUP B (Canada, Switzerland, Bosnia-Herzegovina, Qatar) ───────
    ("Canada",              "Bosnia-Herzegovina",   "2026-06-12T19:00:00Z", "group"),
    ("Qatar",               "Switzerland",          "2026-06-13T19:00:00Z", "group"),
    ("Switzerland",         "Bosnia-Herzegovina",   "2026-06-18T19:00:00Z", "group"),
    ("Canada",              "Qatar",                "2026-06-18T22:00:00Z", "group"),
    ("Bosnia-Herzegovina",  "Qatar",                "2026-06-24T19:00:00Z", "group"),
    ("Switzerland",         "Canada",               "2026-06-24T19:00:00Z", "group"),

    # ── GROUP C (USA, Turkey, Paraguay, Australia) ──────────────────────
    ("USA",                 "Paraguay",             "2026-06-13T01:00:00Z", "group"),
    ("Australia",           "Turkey",               "2026-06-14T04:00:00Z", "group"),
    ("USA",                 "Australia",            "2026-06-19T19:00:00Z", "group"),
    ("Turkey",              "Paraguay",             "2026-06-20T03:00:00Z", "group"),
    ("Paraguay",            "Australia",            "2026-06-26T02:00:00Z", "group"),
    ("Turkey",              "USA",                  "2026-06-26T02:00:00Z", "group"),

    # ── GROUP D (Brazil, Morocco, Haiti, Scotland) ──────────────────────
    ("Brazil",              "Morocco",              "2026-06-13T22:00:00Z", "group"),
    ("Haiti",               "Scotland",             "2026-06-14T01:00:00Z", "group"),
    ("Scotland",            "Morocco",              "2026-06-19T22:00:00Z", "group"),
    ("Brazil",              "Haiti",                "2026-06-20T00:30:00Z", "group"),
    ("Morocco",             "Haiti",                "2026-06-24T22:00:00Z", "group"),
    ("Scotland",            "Brazil",               "2026-06-24T22:00:00Z", "group"),

    # ── GROUP E (Germany, Curaçao, Ivory Coast, Ecuador) ───────────────
    ("Germany",             "Curaçao",              "2026-06-14T17:00:00Z", "group"),
    ("Ivory Coast",         "Ecuador",              "2026-06-14T23:00:00Z", "group"),
    ("Germany",             "Ivory Coast",          "2026-06-20T20:00:00Z", "group"),
    ("Ecuador",             "Curaçao",              "2026-06-21T00:00:00Z", "group"),
    ("Curaçao",             "Ivory Coast",          "2026-06-25T20:00:00Z", "group"),
    ("Ecuador",             "Germany",              "2026-06-25T20:00:00Z", "group"),

    # ── GROUP F (Netherlands, Japan, Sweden, Tunisia) ──────────────────
    ("Netherlands",         "Japan",                "2026-06-14T20:00:00Z", "group"),
    ("Sweden",              "Tunisia",              "2026-06-15T02:00:00Z", "group"),
    ("Netherlands",         "Sweden",               "2026-06-20T17:00:00Z", "group"),
    ("Tunisia",             "Japan",                "2026-06-21T04:00:00Z", "group"),
    ("Japan",               "Sweden",               "2026-06-25T23:00:00Z", "group"),
    ("Tunisia",             "Netherlands",          "2026-06-25T23:00:00Z", "group"),

    # ── GROUP G (Spain, Cape Verde, Saudi Arabia, Uruguay) ─────────────
    ("Spain",               "Cape Verde",           "2026-06-15T16:00:00Z", "group"),
    ("Saudi Arabia",        "Uruguay",              "2026-06-15T22:00:00Z", "group"),
    ("Spain",               "Saudi Arabia",         "2026-06-21T16:00:00Z", "group"),
    ("Uruguay",             "Cape Verde",           "2026-06-21T22:00:00Z", "group"),
    ("Cape Verde",          "Saudi Arabia",         "2026-06-27T00:00:00Z", "group"),
    ("Uruguay",             "Spain",                "2026-06-27T00:00:00Z", "group"),

    # ── GROUP H (Belgium, Egypt, Iran, New Zealand) ─────────────────────
    ("Belgium",             "Egypt",                "2026-06-15T19:00:00Z", "group"),
    ("Iran",                "New Zealand",          "2026-06-16T01:00:00Z", "group"),
    ("Belgium",             "Iran",                 "2026-06-21T19:00:00Z", "group"),
    ("New Zealand",         "Egypt",                "2026-06-22T01:00:00Z", "group"),
    ("Egypt",               "Iran",                 "2026-06-27T03:00:00Z", "group"),
    ("New Zealand",         "Belgium",              "2026-06-27T03:00:00Z", "group"),

    # ── GROUP I (France, Senegal, Iraq, Norway) ─────────────────────────
    ("France",              "Senegal",              "2026-06-16T19:00:00Z", "group"),
    ("Iraq",                "Norway",               "2026-06-16T22:00:00Z", "group"),
    ("France",              "Iraq",                 "2026-06-22T21:00:00Z", "group"),
    ("Norway",              "Senegal",              "2026-06-23T00:00:00Z", "group"),
    ("Norway",              "France",               "2026-06-26T19:00:00Z", "group"),
    ("Senegal",             "Iraq",                 "2026-06-26T19:00:00Z", "group"),

    # ── GROUP J (Argentina, Algeria, Austria, Jordan) ───────────────────
    ("Argentina",           "Algeria",              "2026-06-17T01:00:00Z", "group"),
    ("Austria",             "Jordan",               "2026-06-17T04:00:00Z", "group"),
    ("Argentina",           "Austria",              "2026-06-22T17:00:00Z", "group"),
    ("Jordan",              "Algeria",              "2026-06-23T03:00:00Z", "group"),
    ("Algeria",             "Austria",              "2026-06-28T02:00:00Z", "group"),
    ("Jordan",              "Argentina",            "2026-06-28T02:00:00Z", "group"),

    # ── GROUP K (Portugal, DR Congo, Uzbekistan, Colombia) ─────────────
    ("Portugal",            "DR Congo",             "2026-06-17T17:00:00Z", "group"),
    ("Uzbekistan",          "Colombia",             "2026-06-18T02:00:00Z", "group"),
    ("Portugal",            "Uzbekistan",           "2026-06-23T17:00:00Z", "group"),
    ("Colombia",            "DR Congo",             "2026-06-24T02:00:00Z", "group"),
    ("Colombia",            "Portugal",             "2026-06-27T23:30:00Z", "group"),
    ("DR Congo",            "Uzbekistan",           "2026-06-27T23:30:00Z", "group"),

    # ── GROUP L (England, Croatia, Ghana, Panama) ───────────────────────
    ("England",             "Croatia",              "2026-06-17T20:00:00Z", "group"),
    ("Ghana",               "Panama",               "2026-06-17T23:00:00Z", "group"),
    ("England",             "Ghana",                "2026-06-23T20:00:00Z", "group"),
    ("Panama",              "Croatia",              "2026-06-23T23:00:00Z", "group"),
    ("Croatia",             "Ghana",                "2026-06-27T21:00:00Z", "group"),
    ("Panama",              "England",              "2026-06-27T21:00:00Z", "group"),
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
            # Must delete child records before matches (no cascade on FKs)
            from app.models import Bet, Challenge, Prediction
            await db.execute(delete(Prediction))
            await db.execute(delete(Challenge))
            await db.execute(delete(Bet))
            await db.execute(delete(Match))
            await db.commit()
            print("Existing matches, bets, challenges, and predictions wiped.")

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
