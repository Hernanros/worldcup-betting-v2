#!/usr/bin/env python
"""
One-time migration: add player_stats_cache column to matches table.

Safe to run multiple times — uses IF NOT EXISTS / idempotent checks.

Usage:
    cd backend
    ./venv/bin/python scripts/migrate_add_player_stats_cache.py
    # or via Railway:
    # railway run python scripts/migrate_add_player_stats_cache.py
"""
import asyncio
import sys
import os
import re

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import text
from app.config import settings
import app.models  # noqa: F401 — registers Match with Base.metadata


def _normalize_db_url(url: str) -> str:
    return re.sub(r"^postgres(?:ql)?://", "postgresql+asyncpg://", url)


async def run():
    from app.database import init_db
    init_db(_normalize_db_url(settings.database_url))
    from app.database import engine, AsyncSessionLocal

    print("Adding player_stats_cache column to matches...")
    async with AsyncSessionLocal() as db:
        try:
            await db.execute(text(
                "ALTER TABLE matches ADD COLUMN IF NOT EXISTS player_stats_cache TEXT DEFAULT NULL"
            ))
            await db.commit()
            print("  ✓ player_stats_cache column added (or already exists)")
        except Exception as e:
            await db.rollback()
            print(f"  ✗ Error: {e}")
            raise

    await engine.dispose()
    print("✅  Migration complete.")


if __name__ == "__main__":
    asyncio.run(run())
