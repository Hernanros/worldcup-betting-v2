#!/usr/bin/env python
"""
One-time migration: add leagues table + league_id column to players.

Safe to run multiple times (uses IF NOT EXISTS / idempotent checks).

Usage:
    cd backend
    ./venv/bin/python scripts/migrate_add_leagues.py --league-name "Friends 2026" --league-code friends2026
    # or via Railway:
    # railway run python scripts/migrate_add_leagues.py --league-name "Friends 2026" --league-code friends2026
"""
import asyncio
import argparse
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import re
from sqlalchemy import text
from app.config import settings
from app.database import init_db, Base


def _normalize_db_url(url: str) -> str:
    """Convert postgres:// or postgresql:// → postgresql+asyncpg:// for async driver."""
    return re.sub(r"^postgres(?:ql)?://", "postgresql+asyncpg://", url)

# Import models so Base.metadata knows about League and Player
import app.models  # noqa: F401


async def run(league_name: str, league_code: str):
    init_db(_normalize_db_url(settings.database_url))
    from app.database import engine, AsyncSessionLocal

    # Step 1: create new tables (leagues) + ensure schema is up to date
    print("Step 1: Creating new tables if missing...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("  ✓ leagues table created (or already exists)")

    async with AsyncSessionLocal() as db:
        # Step 2: add league_id column to players if missing
        print("Step 2: Adding league_id column to players...")
        try:
            await db.execute(text(
                "ALTER TABLE players ADD COLUMN IF NOT EXISTS league_id INTEGER REFERENCES leagues(id)"
            ))
            await db.commit()
            print("  ✓ league_id column added")
        except Exception as e:
            await db.rollback()
            # PostgreSQL < 9.6 doesn't support IF NOT EXISTS on ADD COLUMN
            # Try without it and ignore "already exists" errors
            err_str = str(e).lower()
            if "already exists" in err_str or "duplicate column" in err_str:
                print("  ✓ league_id column already exists — skipping")
            else:
                print(f"  ✗ Error adding column: {e}")
                raise

        # Step 3: drop old unique constraint on name (allows same name across leagues)
        print("Step 3: Dropping old unique-name constraint if present...")
        try:
            # Try common constraint names PostgreSQL might have auto-generated
            for cname in ("players_name_key", "ix_players_name", "uq_player_name"):
                try:
                    await db.execute(text(f"ALTER TABLE players DROP CONSTRAINT IF EXISTS {cname}"))
                    await db.commit()
                except Exception:
                    await db.rollback()
            print("  ✓ old constraints cleaned up")
        except Exception as e:
            await db.rollback()
            print(f"  ⚠ Could not drop old constraint (non-fatal): {e}")

        # Step 4: add composite unique constraint (name, league_id) if missing
        print("Step 4: Adding composite unique constraint (name, league_id)...")
        try:
            await db.execute(text(
                "ALTER TABLE players ADD CONSTRAINT uq_player_name_league UNIQUE (name, league_id)"
            ))
            await db.commit()
            print("  ✓ composite constraint added")
        except Exception as e:
            await db.rollback()
            if "already exists" in str(e).lower():
                print("  ✓ composite constraint already exists — skipping")
            else:
                print(f"  ⚠ Could not add composite constraint (non-fatal): {e}")

        # Step 5: create the default league
        print(f"Step 5: Creating league '{league_name}' / code '{league_code}'...")
        from sqlalchemy import select
        from app.models import League, Player

        existing = (await db.execute(
            select(League).where(League.invite_code == league_code)
        )).scalar_one_or_none()

        if existing:
            league = existing
            print(f"  ✓ League already exists: id={league.id}")
        else:
            league = League(name=league_name, invite_code=league_code)
            db.add(league)
            await db.commit()
            await db.refresh(league)
            print(f"  ✓ Created league: id={league.id}")

        # Step 6: adopt existing players
        print("Step 6: Assigning existing players (league_id=NULL) to the league...")
        orphans = (await db.execute(
            select(Player).where(Player.league_id.is_(None))
        )).scalars().all()

        for p in orphans:
            p.league_id = league.id
        await db.commit()
        print(f"  ✓ Assigned {len(orphans)} player(s) to league {league.id}")

        # Summary
        all_players = (await db.execute(select(Player))).scalars().all()
        all_leagues = (await db.execute(select(League))).scalars().all()
        print(f"\n  Leagues in DB:  {len(all_leagues)}")
        print(f"  Players in DB:  {len(all_players)}")
        print("\n✅  Migration complete. App should be healthy now.\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--league-name", default="Friends 2026")
    parser.add_argument("--league-code", default="friends2026")
    args = parser.parse_args()
    asyncio.run(run(args.league_name, args.league_code))
