from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_db, engine, Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db(app.state.database_url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
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

    from app.routers import auth, matches, bets, challenges, predictions, leaderboard, tournament, ai
    from app.ws import router as ws_router

    for router in [auth.router, matches.router, bets.router, challenges.router,
                   predictions.router, leaderboard.router, tournament.router, ai.router, ws_router]:
        app.include_router(router)

    return app


app = create_app()
