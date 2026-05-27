import logging
import re
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_db, create_tables, Base

logger = logging.getLogger(__name__)


def _normalize_db_url(url: str) -> str:
    """Rewrite postgres:// or postgresql:// → postgresql+asyncpg:// for asyncpg driver."""
    return re.sub(r"^postgres(?:ql)?://", "postgresql+asyncpg://", url)


async def _run_migrations():
    """Idempotent schema migrations — safe to run on every startup."""
    from sqlalchemy import text
    from app.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        # Add league_id column to players if it doesn't exist yet
        await db.execute(text(
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS "
            "league_id INTEGER REFERENCES leagues(id)"
        ))
        # Drop the old single-column unique constraint on name if present
        for cname in ("players_name_key", "ix_players_name", "uq_player_name"):
            await db.execute(text(
                f"ALTER TABLE players DROP CONSTRAINT IF EXISTS {cname}"
            ))
        # Add composite unique constraint (name, league_id) — ignore if already exists
        try:
            await db.execute(text(
                "ALTER TABLE players ADD CONSTRAINT uq_player_name_league "
                "UNIQUE (name, league_id)"
            ))
        except Exception:
            await db.rollback()
        await db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    url = _normalize_db_url(app.state.database_url)
    logger.info("DB driver: %s", url.split("://")[0])
    init_db(url)
    try:
        await create_tables()
        logger.info("Database tables ready")
        if not getattr(app.state, "testing", False):
            await _run_migrations()
            logger.info("Migrations applied")
    except Exception:
        logger.exception("DB init failed — check DATABASE_URL and connectivity")
        raise
    if not getattr(app.state, "testing", False):
        from app.poller import start_poller
        start_poller(app)
    yield


def create_app(database_url: str = None, testing: bool = False) -> FastAPI:
    app = FastAPI(lifespan=lifespan)
    app.state.database_url = database_url or settings.database_url
    app.state.testing = testing

    origins = settings.cors_origins.split(",") if settings.cors_origins != "*" else ["*"]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    from app.routers import auth, matches, bets, challenges, predictions, leaderboard, tournament, ai, leagues
    from app.ws import router as ws_router

    for router in [auth.router, matches.router, bets.router, challenges.router,
                   predictions.router, leaderboard.router, tournament.router, ai.router, leagues.router, ws_router]:
        app.include_router(router)

    return app


app = create_app()
