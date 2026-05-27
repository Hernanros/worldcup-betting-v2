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


@asynccontextmanager
async def lifespan(app: FastAPI):
    url = _normalize_db_url(app.state.database_url)
    logger.info("DB driver: %s", url.split("://")[0])
    init_db(url)
    try:
        await create_tables()
        logger.info("Database tables ready")
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
