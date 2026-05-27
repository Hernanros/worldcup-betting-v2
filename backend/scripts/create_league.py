#!/usr/bin/env python
"""
One-shot migration for existing deployments.

Creates a league from a name + invite code and optionally assigns
all players with league_id=NULL to it.

Usage:
    cd backend
    ./venv/bin/python scripts/create_league.py "Family League" family2026 --adopt-existing

    # Override the database (e.g. local SQLite):
    ./venv/bin/python scripts/create_league.py "Family League" family2026 --adopt-existing \
        --db-url sqlite+aiosqlite:///./worldcup.db
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import select
from app.config import settings
import app.database as _db
from app.database import init_db, Base
from app.models import League, Player

_DEFAULT_DB_URL = "sqlite+aiosqlite:///./worldcup.db"


async def main(name: str, code: str, adopt: bool, db_url: str):
    init_db(db_url)
    # Access engine and AsyncSessionLocal after init_db populates them
    async with _db.engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with _db.AsyncSessionLocal() as db:
        existing = (await db.execute(
            select(League).where(League.invite_code == code)
        )).scalar_one_or_none()

        if existing:
            print(f"League already exists: id={existing.id} name={existing.name!r}")
            league = existing
        else:
            league = League(name=name, invite_code=code)
            db.add(league)
            await db.commit()
            await db.refresh(league)
            print(f"Created league: id={league.id} name={league.name!r} code={league.invite_code!r}")

        if adopt:
            result = await db.execute(
                select(Player).where(Player.league_id.is_(None))
            )
            orphans = result.scalars().all()
            for p in orphans:
                p.league_id = league.id
            await db.commit()
            print(f"Assigned {len(orphans)} existing player(s) to league {league.id}.")
        else:
            print("Skipping player adoption (pass --adopt-existing to assign existing players).")


if __name__ == "__main__":
    args = sys.argv[1:]
    if len(args) < 2 or args[0].startswith("--"):
        print("Usage: create_league.py <name> <invite_code> [--adopt-existing] [--db-url <url>]")
        sys.exit(1)

    name_arg = args[0]
    code_arg = args[1]
    adopt = "--adopt-existing" in args

    # Resolve database URL: --db-url flag > settings (from .env) > SQLite default
    db_url = _DEFAULT_DB_URL
    if "--db-url" in args:
        idx = args.index("--db-url")
        if idx + 1 >= len(args):
            print("Error: --db-url requires a value")
            sys.exit(1)
        db_url = args[idx + 1]
    elif not settings.database_url.startswith("postgresql://user:password@"):
        # Use settings URL only when it looks like a real configured URL
        db_url = settings.database_url

    asyncio.run(main(name_arg, code_arg, adopt, db_url))
