import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.main import create_app
from app.database import Base, get_db
from app.models import Player, Match
from datetime import datetime, timezone

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def db_engine():
    engine = create_async_engine(TEST_DB_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db(db_engine):
    session_factory = async_sessionmaker(db_engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_engine):
    session_factory = async_sessionmaker(db_engine, expire_on_commit=False)

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app = create_app(database_url=TEST_DB_URL, testing=True)
    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


# ── Helpers ────────────────────────────────────────────────────────────────────

async def make_player(db, name="Alice", balance=1000) -> Player:
    p = Player(name=name, token_balance=balance)
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return p


async def make_match(db, status="upcoming", home="Argentina", away="Brazil") -> Match:
    m = Match(
        home_team=home,
        away_team=away,
        kickoff_time=datetime(2026, 6, 20, 18, 0, tzinfo=timezone.utc),
        status=status,
        round="group",
    )
    db.add(m)
    await db.commit()
    await db.refresh(m)
    return m


async def join_player(client, name="Alice", code="testcode") -> dict:
    resp = await client.post("/api/auth/join", json={"name": name, "code": code})
    assert resp.status_code == 200
    return resp.json()
