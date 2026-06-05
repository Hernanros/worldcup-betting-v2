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
    """Idempotent schema migrations — safe to run on every startup.

    ORDERING RULE: ALL DDL (ALTER TABLE / CREATE TABLE) must run before any
    ORM-based queries.  SQLAlchemy's autoflush will try to SELECT every column
    the ORM model knows about; if a column hasn't been added yet the query
    will fail with UndefinedColumnError.  Keep DDL first, data migrations last.
    """
    from sqlalchemy import text, select
    from app.database import AsyncSessionLocal
    from app.models import League, Player

    async with AsyncSessionLocal() as db:

        # ── PHASE 1: SCHEMA DDL ──────────────────────────────────────────────
        # Run every ALTER / CREATE before any ORM query touches the session.

        # players.league_id
        await db.execute(text(
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS "
            "league_id INTEGER REFERENCES leagues(id)"
        ))
        await db.commit()

        # Drop stale single-column unique constraint on players.name
        for cname in ("players_name_key", "ix_players_name", "uq_player_name"):
            await db.execute(text(
                f"ALTER TABLE players DROP CONSTRAINT IF EXISTS {cname}"
            ))
        await db.commit()

        # Composite unique constraint (name, league_id)
        try:
            await db.execute(text(
                "ALTER TABLE players ADD CONSTRAINT uq_player_name_league "
                "UNIQUE (name, league_id)"
            ))
            await db.commit()
        except Exception:
            await db.rollback()

        # leagues.ai_enabled
        await db.execute(text(
            "ALTER TABLE leagues ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN NOT NULL DEFAULT TRUE"
        ))
        await db.commit()

        # players.is_admin  (must be before any ORM Player query)
        await db.execute(text(
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE"
        ))
        await db.commit()

        # bets.is_wildcard  (must be before any ORM Bet query / autoflush)
        await db.execute(text(
            "ALTER TABLE bets ADD COLUMN IF NOT EXISTS is_wildcard BOOLEAN NOT NULL DEFAULT FALSE"
        ))
        await db.commit()

        # predictions.is_double
        await db.execute(text(
            "ALTER TABLE predictions ADD COLUMN IF NOT EXISTS is_double BOOLEAN NOT NULL DEFAULT FALSE"
        ))
        await db.commit()

        # insurance_picks table
        await db.execute(text("""
            CREATE TABLE IF NOT EXISTS insurance_picks (
                id SERIAL PRIMARY KEY,
                player_id INTEGER NOT NULL REFERENCES players(id),
                tournament_bet_id INTEGER NOT NULL REFERENCES tournament_bets(id),
                bet_type VARCHAR(30) NOT NULL,
                selection VARCHAR(100) NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'pending'
            )
        """))
        await db.commit()

        # Deep Cuts: new Match stat columns
        try:
            for col, typedef in [
                ("espn_event_id",     "VARCHAR(20)"),
                ("api_fixture_id",    "INTEGER"),
                ("home_yellow_cards", "INTEGER NOT NULL DEFAULT 0"),
                ("away_yellow_cards", "INTEGER NOT NULL DEFAULT 0"),
                ("home_own_goals",    "INTEGER NOT NULL DEFAULT 0"),
                ("away_own_goals",    "INTEGER NOT NULL DEFAULT 0"),
                ("home_corners",      "INTEGER NOT NULL DEFAULT 0"),
                ("away_corners",      "INTEGER NOT NULL DEFAULT 0"),
                ("home_offsides",     "INTEGER NOT NULL DEFAULT 0"),
                ("away_offsides",     "INTEGER NOT NULL DEFAULT 0"),
                ("sub_goals",         "INTEGER NOT NULL DEFAULT 0"),
                ("went_to_et",        "BOOLEAN NOT NULL DEFAULT FALSE"),
                ("went_to_pens",      "BOOLEAN NOT NULL DEFAULT FALSE"),
            ]:
                await db.execute(text(
                    f"ALTER TABLE matches ADD COLUMN IF NOT EXISTS {col} {typedef}"
                ))
            await db.commit()
        except Exception:
            await db.rollback()
            raise

        # ── PHASE 2: DATA MIGRATIONS (ORM queries) ───────────────────────────
        # All columns exist now — autoflush is safe.

        # Ensure a default league exists (uses settings.invite_code so existing
        # players can continue joining with their old code)
        default_code = settings.invite_code
        default_name = "Friends 2026"
        existing = (await db.execute(
            select(League).where(League.invite_code == default_code)
        )).scalar_one_or_none()

        if not existing:
            league = League(name=default_name, invite_code=default_code)
            db.add(league)
            await db.commit()
            await db.refresh(league)
            logger.info("Created default league '%s' (code: %s)", default_name, default_code)
        else:
            league = existing

        # Adopt pre-multi-league orphan players (league_id=NULL, is_admin=FALSE)
        # into the default league. Admin players stay at NULL intentionally.
        # NEVER delete a player — if there is a name collision just skip that orphan;
        # deleting triggers SQLAlchemy FK nullification which violates NOT NULL on
        # child tables (tournament_bets, bets, etc.).
        from sqlalchemy import text as _text
        orphans = (await db.execute(
            select(Player).where(Player.league_id.is_(None), Player.is_admin.is_(False))
        )).scalars().all()
        adopted = skipped = 0
        for p in orphans:
            collision = (await db.execute(
                select(Player).where(
                    Player.name == p.name,
                    Player.league_id == league.id,
                )
            )).scalar_one_or_none()
            if collision:
                skipped += 1  # keep the orphan — do not delete it
            else:
                p.league_id = league.id
                adopted += 1
        if orphans:
            await db.commit()
            logger.info("Adopted %d player(s) into league %d, skipped %d collision(s)",
                        adopted, league.id, skipped)


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

    from app.routers import auth, matches, bets, challenges, predictions, leaderboard, tournament, ai, leagues, deep_cuts
    from app.ws import router as ws_router

    for router in [auth.router, matches.router, bets.router, challenges.router,
                   predictions.router, leaderboard.router, tournament.router, ai.router, leagues.router, deep_cuts.router, ws_router]:
        app.include_router(router)

    return app


app = create_app()
