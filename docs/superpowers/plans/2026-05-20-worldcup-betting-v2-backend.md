# World Cup Betting App v2 — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a FastAPI async backend with PostgreSQL for the 2026 World Cup betting app — auth, match betting, P2P challenges, bravery bonuses, score predictions, long-term tournament bets, leaderboard, AI challenge suggestions (SSE streaming), live WebSocket updates, and an automatic background poller that settles all bets.

**Architecture:** Single FastAPI app with async SQLAlchemy 2.0 + PostgreSQL. Each domain (bets, challenges, predictions, etc.) lives in its own router file. Pure-function business logic (bravery, settlement) lives in standalone modules with no DB dependency. The poller is an APScheduler job that auto-settles bets and broadcasts over WebSocket.

**Tech Stack:** Python 3.12, FastAPI 0.115, SQLAlchemy 2.0 async, asyncpg, Alembic, python-jose, Pydantic v2, APScheduler 3.x, anthropic SDK, sse-starlette, pytest-asyncio, httpx

---

## File Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # app factory, lifespan, middleware, router registration
│   ├── config.py            # Pydantic BaseSettings
│   ├── database.py          # async engine, AsyncSessionLocal, Base, get_db
│   ├── models.py            # all 6 SQLAlchemy ORM models
│   ├── deps.py              # FastAPI dependencies: get_current_player, get_admin
│   ├── bravery.py           # pure functions: streak_bonus_pct, check_volume_milestone, apply_streak_bonus
│   ├── settlement.py        # pure functions: settle_bet, settle_challenge_*, determine_*_winner
│   ├── odds_client.py       # Odds API HTTP client
│   ├── results_client.py    # Football API HTTP client
│   ├── ws.py                # WebSocket connection manager + router
│   ├── poller.py            # APScheduler background task, full settle+broadcast logic
│   └── routers/
│       ├── __init__.py
│       ├── auth.py          # POST /api/auth/join, GET /api/players/me
│       ├── matches.py       # GET /api/matches, GET /api/matches/{id}
│       ├── bets.py          # POST /api/matches/{id}/bets
│       ├── challenges.py    # POST /api/matches/{id}/challenges, POST /api/challenges/{id}/accept
│       ├── predictions.py   # GET /api/predictions, POST /api/predictions
│       ├── leaderboard.py   # GET /api/leaderboard, GET /api/leaderboard/red-cards
│       ├── tournament.py    # GET/POST /api/tournament/bets
│       └── ai.py            # POST /api/ai/suggest-challenge (SSE)
├── alembic/
│   ├── env.py
│   └── versions/
├── scripts/
│   └── seed.py              # CLI: import matches from Odds API + seed KO bracket
├── tests/
│   ├── conftest.py
│   ├── test_auth.py
│   ├── test_matches.py
│   ├── test_bets.py
│   ├── test_challenges.py
│   ├── test_bravery.py
│   ├── test_settlement.py
│   ├── test_predictions.py
│   ├── test_leaderboard.py
│   ├── test_tournament.py
│   └── test_ai.py
├── .env.example
├── alembic.ini
├── pytest.ini
└── requirements.txt
```

---

## Task 1: Scaffold — requirements, config, database

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/.env.example`
- Create: `backend/pytest.ini`
- Create: `backend/app/__init__.py`
- Create: `backend/app/config.py`
- Create: `backend/app/database.py`

- [ ] **Step 1: Create `backend/requirements.txt`**

```
fastapi==0.115.5
uvicorn[standard]==0.32.1
sqlalchemy[asyncio]==2.0.36
asyncpg==0.30.0
aiosqlite==0.20.0
alembic==1.14.0
python-jose[cryptography]==3.3.0
pydantic-settings==2.6.1
httpx==0.28.1
requests==2.32.3
anthropic==0.40.0
sse-starlette==2.1.3
apscheduler==3.10.4
python-dotenv==1.0.1
pytest==8.3.3
pytest-asyncio==0.24.0
anyio[trio]==4.6.0
```

- [ ] **Step 2: Create `backend/.env.example`**

```
JWT_SECRET=changeme
INVITE_CODE=friends2026
ADMIN_CODE=adminchangeme
ODDS_API_KEY=your_odds_api_key
FOOTBALL_API_KEY=your_football_api_key
ANTHROPIC_API_KEY=your_anthropic_key
DATABASE_URL=postgresql+asyncpg://user:pass@localhost/worldcup
CORS_ORIGINS=http://localhost:5173
```

- [ ] **Step 3: Create `backend/pytest.ini`**

```ini
[pytest]
asyncio_mode = auto
```

- [ ] **Step 4: Create `backend/app/__init__.py`** (empty file)

- [ ] **Step 5: Create `backend/app/config.py`**

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    jwt_secret: str = "dev-secret"
    invite_code: str = "friends2026"
    admin_code: str = "admin"
    odds_api_key: str = ""
    football_api_key: str = ""
    anthropic_api_key: str = ""
    database_url: str = "sqlite+aiosqlite:///./worldcup.db"
    cors_origins: str = "*"

    model_config = {"env_file": ".env"}


settings = Settings()
```

- [ ] **Step 6: Create `backend/app/database.py`**

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


engine = None
AsyncSessionLocal = None


def init_db(url: str) -> None:
    global engine, AsyncSessionLocal
    engine = create_async_engine(url, echo=False)
    AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
```

- [ ] **Step 7: Install dependencies and verify**

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python -c "import fastapi, sqlalchemy, anthropic; print('OK')"
```

Expected: `OK`

- [ ] **Step 8: Commit**

```bash
git add backend/
git commit -m "feat: backend scaffold — requirements, config, database"
```

---

## Task 2: SQLAlchemy Models

**Files:**
- Create: `backend/app/models.py`

- [ ] **Step 1: Create `backend/app/models.py`**

```python
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Boolean,
    ForeignKey, Text, UniqueConstraint,
)
from sqlalchemy.orm import relationship
from app.database import Base


class Player(Base):
    __tablename__ = "players"
    id = Column(Integer, primary_key=True)
    name = Column(String(50), nullable=False, unique=True)
    session_token = Column(String(200), unique=True)
    token_balance = Column(Integer, nullable=False, default=1000)
    challenge_streak = Column(Integer, nullable=False, default=0)
    total_challenges_issued = Column(Integer, nullable=False, default=0)
    volume_milestone_reached = Column(Integer, nullable=False, default=0)

    bets = relationship("Bet", back_populates="player")
    tournament_bets = relationship("TournamentBet", back_populates="player")
    issued_challenges = relationship("Challenge", foreign_keys="Challenge.issuer_id", back_populates="issuer")
    accepted_challenges = relationship("Challenge", foreign_keys="Challenge.acceptor_id", back_populates="acceptor")


class Match(Base):
    __tablename__ = "matches"
    id = Column(Integer, primary_key=True)
    home_team = Column(String(50), nullable=False)
    away_team = Column(String(50), nullable=False)
    kickoff_time = Column(DateTime, nullable=False)
    status = Column(String(20), nullable=False, default="upcoming")  # upcoming/locked/finished
    odds_cache = Column(Text)
    odds_fetched_at = Column(DateTime)
    home_score = Column(Integer)
    away_score = Column(Integer)
    home_red_cards = Column(Integer, default=0)
    away_red_cards = Column(Integer, default=0)
    corners = Column(Integer, default=0)
    round = Column(String(20), nullable=False, default="group")
    home_team_confirmed = Column(Boolean, nullable=False, default=True)
    away_team_confirmed = Column(Boolean, nullable=False, default=True)
    next_match_id = Column(Integer, ForeignKey("matches.id"), nullable=True)
    next_slot = Column(String(4), nullable=True)  # 'home' or 'away'

    bets = relationship("Bet", back_populates="match")
    challenges = relationship("Challenge", back_populates="match")
    predictions = relationship("Prediction", back_populates="match")


class Bet(Base):
    __tablename__ = "bets"
    id = Column(Integer, primary_key=True)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)
    bet_type = Column(String(30), nullable=False)
    selection = Column(String(100), nullable=False)
    stake = Column(Integer, nullable=False)
    odds_at_placement = Column(Float, nullable=False)
    status = Column(String(20), nullable=False, default="pending")

    player = relationship("Player", back_populates="bets")
    match = relationship("Match", back_populates="bets")


class Challenge(Base):
    __tablename__ = "challenges"
    id = Column(Integer, primary_key=True)
    issuer_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    acceptor_id = Column(Integer, ForeignKey("players.id"), nullable=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)
    bet_type = Column(String(30), nullable=False)
    selection = Column(String(100), nullable=False)
    acceptor_selection = Column(String(100), nullable=False)
    issuer_stake = Column(Integer, nullable=False)
    acceptor_stake = Column(Integer, nullable=False)
    issuer_odds = Column(Float, nullable=False)
    acceptor_odds = Column(Float, nullable=False)
    status = Column(String(20), nullable=False, default="open")  # open/accepted/cancelled/resolved
    bravery_streak_bonus_pct = Column(Float, nullable=False, default=0.0)

    issuer = relationship("Player", foreign_keys=[issuer_id], back_populates="issued_challenges")
    acceptor = relationship("Player", foreign_keys=[acceptor_id], back_populates="accepted_challenges")
    match = relationship("Match", back_populates="challenges")


class Prediction(Base):
    __tablename__ = "predictions"
    id = Column(Integer, primary_key=True)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)
    home_score_pred = Column(Integer, nullable=False)
    away_score_pred = Column(Integer, nullable=False)
    status = Column(String(30), nullable=False, default="pending")
    points_awarded = Column(Integer, nullable=False, default=0)

    __table_args__ = (UniqueConstraint("player_id", "match_id", name="uq_pred_player_match"),)

    player = relationship("Player", backref="predictions")
    match = relationship("Match", back_populates="predictions")


class TournamentBet(Base):
    __tablename__ = "tournament_bets"
    id = Column(Integer, primary_key=True)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    bet_type = Column(String(30), nullable=False)  # winner/golden_boot/total_goals
    selection = Column(String(100), nullable=False)
    stake = Column(Integer, nullable=False)
    odds_at_placement = Column(Float, nullable=False)
    status = Column(String(20), nullable=False, default="pending")

    player = relationship("Player", back_populates="tournament_bets")
```

- [ ] **Step 2: Verify models import cleanly**

```bash
cd backend && python -c "from app.models import Player, Match, Bet, Challenge, Prediction, TournamentBet; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/models.py
git commit -m "feat: SQLAlchemy ORM models — 6 tables"
```

---

## Task 3: App Factory + Test Scaffold

**Files:**
- Create: `backend/app/main.py`
- Create: `backend/app/routers/__init__.py`
- Create: `backend/tests/conftest.py`

- [ ] **Step 1: Create `backend/app/routers/__init__.py`** (empty)

- [ ] **Step 2: Create `backend/app/main.py`**

```python
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
```

- [ ] **Step 3: Create `backend/tests/conftest.py`**

```python
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.main import create_app
from app.database import Base, get_db, init_db
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
```

- [ ] **Step 4: Create stub router files** (each just exports an empty `router`)

Create `backend/app/routers/auth.py`:
```python
from fastapi import APIRouter
router = APIRouter()
```

Repeat identically for: `matches.py`, `bets.py`, `challenges.py`, `predictions.py`, `leaderboard.py`, `tournament.py`, `ai.py`

Create `backend/app/ws.py`:
```python
from fastapi import APIRouter
router = APIRouter()
```

Create `backend/app/poller.py`:
```python
def start_poller(app): pass
```

- [ ] **Step 5: Run to verify app starts**

```bash
cd backend && python -c "from app.main import create_app; app = create_app(testing=True); print('OK')"
```

Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat: app factory, test conftest, stub routers"
```

---

## Task 4: Auth Router

**Files:**
- Modify: `backend/app/routers/auth.py`
- Create: `backend/app/deps.py`
- Create: `backend/tests/test_auth.py`

- [ ] **Step 1: Write failing tests — `backend/tests/test_auth.py`**

```python
import pytest
from tests.conftest import join_player


async def test_join_creates_player(client):
    resp = await client.post("/api/auth/join", json={"name": "Alice", "code": "testcode"})
    assert resp.status_code == 200
    data = resp.json()
    assert "token" in data
    assert data["player"]["name"] == "Alice"
    assert data["player"]["token_balance"] == 1000


async def test_join_wrong_code_rejected(client):
    resp = await client.post("/api/auth/join", json={"name": "Bob", "code": "wrongcode"})
    assert resp.status_code == 403


async def test_join_same_name_returns_same_player(client):
    r1 = await client.post("/api/auth/join", json={"name": "Alice", "code": "testcode"})
    r2 = await client.post("/api/auth/join", json={"name": "Alice", "code": "testcode"})
    assert r1.json()["player"]["id"] == r2.json()["player"]["id"]


async def test_me_returns_player(client):
    data = await join_player(client, "Alice")
    token = data["token"]
    resp = await client.get("/api/players/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Alice"


async def test_me_rejects_bad_token(client):
    resp = await client.get("/api/players/me", headers={"Authorization": "Bearer garbage"})
    assert resp.status_code == 401
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd backend && pytest tests/test_auth.py -v
```

Expected: All tests FAIL (routes return 404)

- [ ] **Step 3: Create `backend/app/deps.py`**

```python
from fastapi import Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from jose import jwt, JWTError
from app.database import get_db
from app.models import Player
from app.config import settings


def make_token(player_id: int, is_admin: bool) -> str:
    return jwt.encode({"sub": str(player_id), "admin": is_admin}, settings.jwt_secret, algorithm="HS256")


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])


async def get_current_player(
    authorization: str = Header(...),
    db: AsyncSession = Depends(get_db),
) -> tuple[Player, bool]:
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "missing token")
    try:
        payload = decode_token(authorization[7:])
    except JWTError:
        raise HTTPException(401, "invalid token")
    player = await db.get(Player, int(payload["sub"]))
    if not player:
        raise HTTPException(401, "player not found")
    return player, payload.get("admin", False)


async def get_admin(
    authorization: str = Header(...),
) -> bool:
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "missing token")
    try:
        payload = decode_token(authorization[7:])
    except JWTError:
        raise HTTPException(401, "invalid token")
    if not payload.get("admin"):
        raise HTTPException(403, "admin required")
    return True
```

- [ ] **Step 4: Implement `backend/app/routers/auth.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import Player
from app.deps import make_token, get_current_player
from app.config import settings

router = APIRouter()


def _player_dict(player: Player, is_admin: bool = False) -> dict:
    return {
        "id": player.id,
        "name": player.name,
        "token_balance": player.token_balance,
        "challenge_streak": player.challenge_streak,
        "total_challenges_issued": player.total_challenges_issued,
        "is_admin": is_admin,
    }


@router.post("/api/auth/join")
async def join(data: dict, db: AsyncSession = Depends(get_db)):
    name = (data.get("name") or "").strip()
    code = (data.get("code") or "").strip()
    if not name:
        raise HTTPException(400, "name required")

    is_admin = code == settings.admin_code
    is_player = code == settings.invite_code

    if not is_admin and not is_player:
        raise HTTPException(403, "invalid code")

    result = await db.execute(select(Player).where(Player.name == name))
    player = result.scalar_one_or_none()
    if not player:
        player = Player(name=name, token_balance=1000)
        db.add(player)
        await db.commit()
        await db.refresh(player)

    token = make_token(player.id, is_admin)
    player.session_token = token
    await db.commit()

    return {"token": token, "player": _player_dict(player, is_admin)}


@router.get("/api/players/me")
async def me(auth=Depends(get_current_player)):
    player, is_admin = auth
    return _player_dict(player, is_admin)
```

- [ ] **Step 5: Run tests — expect pass**

```bash
cd backend && pytest tests/test_auth.py -v
```

Expected: All 5 tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/deps.py backend/app/routers/auth.py backend/tests/test_auth.py
git commit -m "feat: auth — join endpoint, JWT helpers, /me route"
```

---

## Task 5: Matches Router

**Files:**
- Modify: `backend/app/routers/matches.py`
- Create: `backend/tests/test_matches.py`

- [ ] **Step 1: Write failing tests — `backend/tests/test_matches.py`**

```python
import pytest
from datetime import datetime, timezone, timedelta
from tests.conftest import join_player, make_match


async def test_list_matches_requires_auth(client):
    resp = await client.get("/api/matches")
    assert resp.status_code == 422  # missing Authorization header


async def test_list_matches_empty(client):
    data = await join_player(client)
    resp = await client.get("/api/matches", headers={"Authorization": f"Bearer {data['token']}"})
    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_matches_returns_matches(client, db):
    await make_match(db, home="France", away="Germany")
    data = await join_player(client, "Alice")
    resp = await client.get("/api/matches", headers={"Authorization": f"Bearer {data['token']}"})
    assert resp.status_code == 200
    matches = resp.json()
    assert len(matches) == 1
    assert matches[0]["home_team"] == "France"


async def test_get_match_not_found(client):
    data = await join_player(client)
    resp = await client.get("/api/matches/999", headers={"Authorization": f"Bearer {data['token']}"})
    assert resp.status_code == 404


async def test_match_auto_locks_at_kickoff(client, db):
    past_kickoff = datetime.now(timezone.utc) - timedelta(minutes=5)
    from app.models import Match
    m = Match(home_team="Spain", away_team="Italy", kickoff_time=past_kickoff,
              status="upcoming", round="group")
    db.add(m)
    await db.commit()
    await db.refresh(m)

    data = await join_player(client)
    resp = await client.get(f"/api/matches/{m.id}", headers={"Authorization": f"Bearer {data['token']}"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "locked"
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd backend && pytest tests/test_matches.py -v
```

Expected: FAIL (routes return 404)

- [ ] **Step 3: Implement `backend/app/routers/matches.py`**

```python
import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.deps import get_current_player
from app.models import Match, Challenge, Player

router = APIRouter()


def _match_dict(m: Match) -> dict:
    return {
        "id": m.id,
        "home_team": m.home_team,
        "away_team": m.away_team,
        "kickoff_time": m.kickoff_time.replace(tzinfo=timezone.utc).isoformat(),
        "status": m.status,
        "home_score": m.home_score,
        "away_score": m.away_score,
        "round": m.round,
        "home_team_confirmed": m.home_team_confirmed,
        "away_team_confirmed": m.away_team_confirmed,
    }


def _challenge_dict(c: Challenge) -> dict:
    return {
        "id": c.id,
        "issuer_id": c.issuer_id,
        "bet_type": c.bet_type,
        "selection": c.selection,
        "acceptor_selection": c.acceptor_selection,
        "issuer_stake": c.issuer_stake,
        "acceptor_stake": c.acceptor_stake,
        "issuer_odds": c.issuer_odds,
        "acceptor_odds": c.acceptor_odds,
        "status": c.status,
    }


async def _auto_lock(match: Match, db: AsyncSession) -> None:
    if match.status == "upcoming" and datetime.now(timezone.utc) >= match.kickoff_time.replace(tzinfo=timezone.utc):
        match.status = "locked"
        result = await db.execute(
            select(Challenge).where(Challenge.match_id == match.id, Challenge.status == "open")
        )
        for ch in result.scalars().all():
            issuer = await db.get(Player, ch.issuer_id)
            issuer.token_balance += ch.issuer_stake
            ch.status = "cancelled"
        await db.commit()


@router.get("/api/matches")
async def list_matches(auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Match).order_by(Match.kickoff_time))
    matches = result.scalars().all()
    for m in matches:
        await _auto_lock(m, db)
    return [_match_dict(m) for m in matches]


@router.get("/api/matches/{match_id}")
async def get_match(match_id: int, auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    match = await db.get(Match, match_id)
    if not match:
        raise HTTPException(404, "not found")
    await _auto_lock(match, db)

    try:
        odds = json.loads(match.odds_cache) if match.odds_cache else {}
    except (json.JSONDecodeError, ValueError):
        odds = {}

    result = await db.execute(
        select(Challenge).where(Challenge.match_id == match_id, Challenge.status == "open")
    )
    open_challenges = result.scalars().all()

    return {
        **_match_dict(match),
        "odds": odds,
        "open_challenges": [_challenge_dict(c) for c in open_challenges],
    }
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd backend && pytest tests/test_matches.py -v
```

Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/matches.py backend/tests/test_matches.py
git commit -m "feat: matches router — list, get, auto-lock on kickoff"
```

---

## Task 6: Bravery Pure Functions

**Files:**
- Create: `backend/app/bravery.py`
- Create: `backend/tests/test_bravery.py`

- [ ] **Step 1: Write failing tests — `backend/tests/test_bravery.py`**

```python
from app.bravery import streak_bonus_pct, check_volume_milestone, apply_streak_bonus


def test_streak_bonus_zero_for_one_two():
    assert streak_bonus_pct(0) == 0.0
    assert streak_bonus_pct(1) == 0.0
    assert streak_bonus_pct(2) == 0.0


def test_streak_bonus_three():
    assert streak_bonus_pct(3) == 0.10


def test_streak_bonus_four():
    assert streak_bonus_pct(4) == 0.20


def test_streak_bonus_five_plus():
    assert streak_bonus_pct(5) == 0.35
    assert streak_bonus_pct(10) == 0.35


def test_volume_milestone_no_crossing():
    bonus, level = check_volume_milestone(3, 0)
    assert bonus == 0
    assert level == 0


def test_volume_milestone_crosses_5():
    bonus, level = check_volume_milestone(5, 0)
    assert bonus == 50
    assert level == 1


def test_volume_milestone_crosses_10():
    bonus, level = check_volume_milestone(10, 1)
    assert bonus == 150
    assert level == 2


def test_volume_milestone_crosses_20():
    bonus, level = check_volume_milestone(20, 2)
    assert bonus == 400
    assert level == 3


def test_volume_milestone_already_reached():
    bonus, level = check_volume_milestone(20, 3)
    assert bonus == 0
    assert level == 3


def test_apply_streak_bonus():
    assert apply_streak_bonus(1000, 3) == 100
    assert apply_streak_bonus(1000, 4) == 200
    assert apply_streak_bonus(1000, 5) == 350
    assert apply_streak_bonus(1000, 0) == 0
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd backend && pytest tests/test_bravery.py -v
```

Expected: FAIL (module not found)

- [ ] **Step 3: Create `backend/app/bravery.py`**

```python
VOLUME_MILESTONES = [
    (5, 50, 1),
    (10, 150, 2),
    (20, 400, 3),
]


def streak_bonus_pct(streak: int) -> float:
    if streak >= 5:
        return 0.35
    if streak == 4:
        return 0.20
    if streak == 3:
        return 0.10
    return 0.0


def check_volume_milestone(current_total: int, current_milestone: int) -> tuple[int, int]:
    for threshold, bonus, level in VOLUME_MILESTONES:
        if current_total >= threshold and current_milestone < level:
            return bonus, level
    return 0, current_milestone


def apply_streak_bonus(winnings: int, streak: int) -> int:
    return int(winnings * streak_bonus_pct(streak))
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd backend && pytest tests/test_bravery.py -v
```

Expected: All 11 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/bravery.py backend/tests/test_bravery.py
git commit -m "feat: bravery — streak bonuses, volume milestones"
```

---

## Task 7: Settlement Pure Functions

**Files:**
- Create: `backend/app/settlement.py`
- Create: `backend/tests/test_settlement.py`

- [ ] **Step 1: Write failing tests — `backend/tests/test_settlement.py`**

```python
from app.settlement import (
    settle_bet,
    determine_h2h_winner,
    determine_correct_score_winner,
    determine_totals_winner,
    determine_btts_winner,
    settle_challenge_issuer,
    settle_challenge_acceptor,
)


def test_settle_bet_win():
    assert settle_bet(stake=100, odds=2.5, won=True) == 250


def test_settle_bet_loss():
    assert settle_bet(stake=100, odds=2.5, won=False) == 0


def test_h2h_home_win():
    assert determine_h2h_winner("Argentina", 2, 1) == "Argentina"


def test_h2h_away_win():
    assert determine_h2h_winner("Argentina", 0, 1) == "Away"


def test_h2h_draw():
    assert determine_h2h_winner("Argentina", 1, 1) == "Draw"


def test_correct_score_match():
    assert determine_correct_score_winner("2-1", 2, 1) is True


def test_correct_score_no_match():
    assert determine_correct_score_winner("2-1", 1, 0) is False


def test_totals_over():
    assert determine_totals_winner("Over 2.5", 3) is True
    assert determine_totals_winner("Over 2.5", 2) is False


def test_totals_under():
    assert determine_totals_winner("Under 2.5", 2) is True
    assert determine_totals_winner("Under 2.5", 3) is False


def test_btts_yes():
    assert determine_btts_winner("Yes", 1, 1) is True
    assert determine_btts_winner("Yes", 1, 0) is False


def test_btts_no():
    assert determine_btts_winner("No", 1, 0) is True
    assert determine_btts_winner("No", 1, 1) is False


def test_settle_challenge_issuer_win_with_streak():
    payout, bonus = settle_challenge_issuer(stake=100, odds=2.0, streak=3, won=True)
    assert payout == 200
    assert bonus == 20  # 10% of 200


def test_settle_challenge_issuer_loss():
    payout, bonus = settle_challenge_issuer(stake=100, odds=2.0, streak=5, won=False)
    assert payout == 0
    assert bonus == 0


def test_settle_challenge_acceptor_win():
    assert settle_challenge_acceptor(stake=150, odds=1.5, won=True) == 225


def test_settle_challenge_acceptor_loss():
    assert settle_challenge_acceptor(stake=150, odds=1.5, won=False) == 0
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd backend && pytest tests/test_settlement.py -v
```

Expected: FAIL (module not found)

- [ ] **Step 3: Create `backend/app/settlement.py`**

```python
from app.bravery import apply_streak_bonus


def settle_bet(stake: int, odds: float, won: bool) -> int:
    return int(stake * odds) if won else 0


def settle_challenge_issuer(stake: int, odds: float, streak: int, won: bool) -> tuple[int, int]:
    if not won:
        return 0, 0
    payout = int(stake * odds)
    bonus = apply_streak_bonus(payout, streak)
    return payout, bonus


def settle_challenge_acceptor(stake: int, odds: float, won: bool) -> int:
    return int(stake * odds) if won else 0


def determine_h2h_winner(home_team: str, home_score: int, away_score: int) -> str:
    if home_score > away_score:
        return home_team
    if away_score > home_score:
        return "Away"
    return "Draw"


def determine_correct_score_winner(selection: str, home_score: int, away_score: int) -> bool:
    try:
        h, a = selection.split("-")
        return int(h) == home_score and int(a) == away_score
    except (ValueError, AttributeError):
        return False


def determine_totals_winner(selection: str, actual_value: int) -> bool:
    parts = selection.split()
    if len(parts) != 2:
        return False
    direction, threshold = parts[0].lower(), float(parts[1])
    if direction == "over":
        return actual_value > threshold
    if direction == "under":
        return actual_value < threshold
    return False


def determine_btts_winner(selection: str, home_score: int, away_score: int) -> bool:
    both_scored = home_score > 0 and away_score > 0
    return (selection == "Yes") == both_scored
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd backend && pytest tests/test_settlement.py -v
```

Expected: All 15 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/settlement.py backend/tests/test_settlement.py
git commit -m "feat: settlement — all market determination logic"
```

---

## Task 8: Bets Router

**Files:**
- Modify: `backend/app/routers/bets.py`
- Create: `backend/tests/test_bets.py`

- [ ] **Step 1: Write failing tests — `backend/tests/test_bets.py`**

```python
from tests.conftest import join_player, make_match


async def test_place_bet_succeeds(client, db):
    m = await make_match(db)
    data = await join_player(client)
    headers = {"Authorization": f"Bearer {data['token']}"}
    resp = await client.post(f"/api/matches/{m.id}/bets", json={
        "bet_type": "1x2", "selection": "Argentina", "stake": 100, "odds": 2.5
    }, headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["new_balance"] == 900


async def test_place_bet_insufficient_balance(client, db):
    m = await make_match(db)
    data = await join_player(client)
    headers = {"Authorization": f"Bearer {data['token']}"}
    resp = await client.post(f"/api/matches/{m.id}/bets", json={
        "bet_type": "1x2", "selection": "Argentina", "stake": 2000, "odds": 2.5
    }, headers=headers)
    assert resp.status_code == 400
    assert "insufficient" in resp.json()["detail"]


async def test_place_bet_locked_match(client, db):
    m = await make_match(db, status="locked")
    data = await join_player(client)
    headers = {"Authorization": f"Bearer {data['token']}"}
    resp = await client.post(f"/api/matches/{m.id}/bets", json={
        "bet_type": "1x2", "selection": "Argentina", "stake": 100, "odds": 2.5
    }, headers=headers)
    assert resp.status_code == 400


async def test_place_bet_min_stake(client, db):
    m = await make_match(db)
    data = await join_player(client)
    headers = {"Authorization": f"Bearer {data['token']}"}
    resp = await client.post(f"/api/matches/{m.id}/bets", json={
        "bet_type": "1x2", "selection": "Argentina", "stake": 0, "odds": 2.5
    }, headers=headers)
    assert resp.status_code == 400
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd backend && pytest tests/test_bets.py -v
```

- [ ] **Step 3: Implement `backend/app/routers/bets.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.deps import get_current_player
from app.models import Match, Bet, Player

router = APIRouter()


@router.post("/api/matches/{match_id}/bets")
async def place_bet(match_id: int, data: dict, auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    player, _ = auth
    match = await db.get(Match, match_id)
    if not match:
        raise HTTPException(404, "match not found")
    if match.status != "upcoming":
        raise HTTPException(400, "betting is closed for this match")

    bet_type = data.get("bet_type")
    selection = data.get("selection")
    if not bet_type or not selection or "odds" not in data:
        raise HTTPException(400, "bet_type, selection, and odds are required")

    try:
        stake = int(data.get("stake", 0))
        odds = float(data["odds"])
    except (TypeError, ValueError):
        raise HTTPException(400, "invalid stake or odds")

    if stake < 1:
        raise HTTPException(400, "minimum stake is 1")
    if odds <= 0:
        raise HTTPException(400, "odds must be positive")

    player = await db.get(Player, player.id)
    if player.token_balance < stake:
        raise HTTPException(400, "insufficient balance")

    bet = Bet(
        player_id=player.id,
        match_id=match_id,
        bet_type=bet_type,
        selection=selection,
        stake=stake,
        odds_at_placement=odds,
    )
    player.token_balance -= stake
    db.add(bet)
    await db.commit()
    await db.refresh(bet)

    return {"id": bet.id, "new_balance": player.token_balance}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd backend && pytest tests/test_bets.py -v
```

Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/bets.py backend/tests/test_bets.py
git commit -m "feat: bets router — place match bet with balance check"
```

---

## Task 9: Challenges Router

**Files:**
- Modify: `backend/app/routers/challenges.py`
- Create: `backend/tests/test_challenges.py`

- [ ] **Step 1: Write failing tests — `backend/tests/test_challenges.py`**

```python
from tests.conftest import join_player, make_match


async def _issue(client, match_id, token, issuer_stake=100, issuer_odds=3.0, acceptor_odds=1.5):
    return await client.post(f"/api/matches/{match_id}/challenges", json={
        "bet_type": "1x2",
        "selection": "Argentina",
        "acceptor_selection": "Away",
        "issuer_stake": issuer_stake,
        "issuer_odds": issuer_odds,
        "acceptor_odds": acceptor_odds,
    }, headers={"Authorization": f"Bearer {token}"})


async def test_issue_challenge_deducts_stake(client, db):
    m = await make_match(db)
    alice = await join_player(client, "Alice")
    resp = await _issue(client, m.id, alice["token"])
    assert resp.status_code == 200
    assert resp.json()["new_balance"] == 900


async def test_issue_challenge_grants_volume_milestone(client, db):
    m = await make_match(db)
    alice = await join_player(client, "Alice")
    # issue 5 challenges to trigger the first milestone (+50 tokens)
    for _ in range(5):
        await _issue(client, m.id, alice["token"], issuer_stake=10)
    resp = await client.get("/api/players/me", headers={"Authorization": f"Bearer {alice['token']}"})
    # started with 1000, spent 5*10=50, gained 50 milestone = 1000
    assert resp.json()["token_balance"] == 1000


async def test_accept_challenge(client, db):
    m = await make_match(db)
    alice = await join_player(client, "Alice")
    bob = await join_player(client, "Bob")

    issue_resp = await _issue(client, m.id, alice["token"])
    ch_id = issue_resp.json()["id"]

    accept_resp = await client.post(f"/api/challenges/{ch_id}/accept",
                                    headers={"Authorization": f"Bearer {bob['token']}"})
    assert accept_resp.status_code == 200
    assert accept_resp.json()["new_balance"] < 1000


async def test_cannot_accept_own_challenge(client, db):
    m = await make_match(db)
    alice = await join_player(client, "Alice")
    issue_resp = await _issue(client, m.id, alice["token"])
    ch_id = issue_resp.json()["id"]

    resp = await client.post(f"/api/challenges/{ch_id}/accept",
                             headers={"Authorization": f"Bearer {alice['token']}"})
    assert resp.status_code == 400
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd backend && pytest tests/test_challenges.py -v
```

- [ ] **Step 3: Implement `backend/app/routers/challenges.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.deps import get_current_player
from app.models import Match, Challenge, Player
from app.bravery import streak_bonus_pct, check_volume_milestone

router = APIRouter()


@router.post("/api/matches/{match_id}/challenges")
async def issue_challenge(match_id: int, data: dict, auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    player, _ = auth
    match = await db.get(Match, match_id)
    if not match or match.status != "upcoming":
        raise HTTPException(400, "match not open for challenges")

    try:
        issuer_stake = int(data["issuer_stake"])
        issuer_odds = float(data["issuer_odds"])
        acceptor_odds = float(data["acceptor_odds"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(400, "issuer_stake, issuer_odds, and acceptor_odds are required")

    if issuer_odds <= 0 or acceptor_odds <= 0 or issuer_stake < 1:
        raise HTTPException(400, "invalid stake or odds")

    bet_type = (data.get("bet_type") or "").strip()
    selection = (data.get("selection") or "").strip()
    acceptor_selection = (data.get("acceptor_selection") or "").strip()
    if not bet_type or not selection or not acceptor_selection:
        raise HTTPException(400, "bet_type, selection, and acceptor_selection are required")

    acceptor_stake = max(1, round(issuer_stake * (issuer_odds / acceptor_odds)))

    player = await db.get(Player, player.id)
    if player.token_balance < issuer_stake:
        raise HTTPException(400, "insufficient balance")

    player.total_challenges_issued += 1
    player.challenge_streak += 1

    bonus_tokens, new_milestone = check_volume_milestone(player.total_challenges_issued, player.volume_milestone_reached)
    if bonus_tokens:
        player.token_balance += bonus_tokens
        player.volume_milestone_reached = new_milestone

    player.token_balance -= issuer_stake

    challenge = Challenge(
        issuer_id=player.id,
        match_id=match_id,
        bet_type=bet_type,
        selection=selection,
        acceptor_selection=acceptor_selection,
        issuer_stake=issuer_stake,
        acceptor_stake=acceptor_stake,
        issuer_odds=issuer_odds,
        acceptor_odds=acceptor_odds,
        bravery_streak_bonus_pct=streak_bonus_pct(player.challenge_streak),
    )
    db.add(challenge)
    await db.commit()
    await db.refresh(challenge)

    return {"id": challenge.id, "acceptor_stake": acceptor_stake,
            "new_balance": player.token_balance, "volume_bonus_awarded": bonus_tokens}


@router.post("/api/challenges/{challenge_id}/accept")
async def accept_challenge(challenge_id: int, auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    player, _ = auth
    challenge = await db.get(Challenge, challenge_id)
    if not challenge or challenge.status != "open":
        raise HTTPException(400, "challenge not available")
    if challenge.issuer_id == player.id:
        raise HTTPException(400, "cannot accept your own challenge")

    player = await db.get(Player, player.id)
    if player.token_balance < challenge.acceptor_stake:
        raise HTTPException(400, "insufficient balance")

    player.token_balance -= challenge.acceptor_stake
    challenge.acceptor_id = player.id
    challenge.status = "accepted"
    await db.commit()

    return {"id": challenge.id, "new_balance": player.token_balance}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd backend && pytest tests/test_challenges.py -v
```

Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/challenges.py backend/tests/test_challenges.py
git commit -m "feat: challenges router — issue, accept, bravery milestones"
```

---

## Task 10: Predictions, Leaderboard, Tournament Routers

**Files:**
- Modify: `backend/app/routers/predictions.py`
- Modify: `backend/app/routers/leaderboard.py`
- Modify: `backend/app/routers/tournament.py`
- Create: `backend/tests/test_predictions.py`
- Create: `backend/tests/test_leaderboard.py`
- Create: `backend/tests/test_tournament.py`

- [ ] **Step 1: Write `backend/tests/test_predictions.py`**

```python
from tests.conftest import join_player, make_match


async def test_save_and_get_prediction(client, db):
    m = await make_match(db)
    data = await join_player(client)
    headers = {"Authorization": f"Bearer {data['token']}"}

    resp = await client.post("/api/predictions", json={
        "match_id": m.id, "home_score_pred": 2, "away_score_pred": 1
    }, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["home_score_pred"] == 2

    list_resp = await client.get("/api/predictions", headers=headers)
    preds = list_resp.json()
    assert any(p["my_prediction"] is not None for p in preds)


async def test_update_prediction(client, db):
    m = await make_match(db)
    data = await join_player(client)
    headers = {"Authorization": f"Bearer {data['token']}"}

    await client.post("/api/predictions", json={"match_id": m.id, "home_score_pred": 1, "away_score_pred": 0}, headers=headers)
    resp = await client.post("/api/predictions", json={"match_id": m.id, "home_score_pred": 3, "away_score_pred": 2}, headers=headers)
    assert resp.json()["home_score_pred"] == 3


async def test_cannot_predict_finished_match(client, db):
    m = await make_match(db, status="finished")
    data = await join_player(client)
    resp = await client.post("/api/predictions", json={
        "match_id": m.id, "home_score_pred": 1, "away_score_pred": 0
    }, headers={"Authorization": f"Bearer {data['token']}"})
    assert resp.status_code == 400
```

- [ ] **Step 2: Write `backend/tests/test_leaderboard.py`**

```python
from tests.conftest import join_player, make_match
from app.models import Match


async def test_leaderboard_ranked_by_balance(client, db):
    alice = await join_player(client, "Alice")
    bob = await join_player(client, "Bob")
    headers = {"Authorization": f"Bearer {alice['token']}"}
    resp = await client.get("/api/leaderboard", headers=headers)
    assert resp.status_code == 200
    ranks = {p["name"]: p["rank"] for p in resp.json()}
    assert ranks["Alice"] == ranks["Bob"] == 1  # tied at 1000


async def test_red_cards_leaderboard(client, db):
    from app.models import Match as M
    m = M(home_team="Spain", away_team="Italy",
          kickoff_time=__import__("datetime").datetime(2026, 6, 1),
          status="finished", round="group",
          home_red_cards=2, away_red_cards=1,
          home_score=1, away_score=0)
    db.add(m)
    await db.commit()
    data = await join_player(client)
    resp = await client.get("/api/leaderboard/red-cards",
                            headers={"Authorization": f"Bearer {data['token']}"})
    assert resp.status_code == 200
    teams = {r["team"]: r["red_cards"] for r in resp.json()}
    assert teams["Spain"] == 2
    assert teams["Italy"] == 1
```

- [ ] **Step 3: Write `backend/tests/test_tournament.py`**

```python
from tests.conftest import join_player


async def test_place_tournament_bet(client):
    data = await join_player(client)
    headers = {"Authorization": f"Bearer {data['token']}"}
    resp = await client.post("/api/tournament/bets", json={
        "bet_type": "winner", "selection": "Argentina", "stake": 200, "odds": 5.0
    }, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["new_balance"] == 800


async def test_get_tournament_bets(client):
    data = await join_player(client)
    headers = {"Authorization": f"Bearer {data['token']}"}
    await client.post("/api/tournament/bets", json={
        "bet_type": "golden_boot", "selection": "Mbappe", "stake": 100, "odds": 8.0
    }, headers=headers)
    resp = await client.get("/api/tournament/bets", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["my_bets"]) == 1
    assert body["my_bets"][0]["selection"] == "Mbappe"
```

- [ ] **Step 4: Run all three test files — expect failure**

```bash
cd backend && pytest tests/test_predictions.py tests/test_leaderboard.py tests/test_tournament.py -v
```

- [ ] **Step 5: Implement `backend/app/routers/predictions.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.deps import get_current_player
from app.models import Match, Prediction

router = APIRouter()


@router.get("/api/predictions")
async def get_predictions(auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    player, _ = auth
    matches = (await db.execute(select(Match).order_by(Match.kickoff_time))).scalars().all()
    my_preds = {
        p.match_id: p
        for p in (await db.execute(select(Prediction).where(Prediction.player_id == player.id))).scalars().all()
    }
    result = []
    for m in matches:
        pred = my_preds.get(m.id)
        result.append({
            "match_id": m.id, "home_team": m.home_team, "away_team": m.away_team,
            "kickoff_time": m.kickoff_time.isoformat(), "status": m.status,
            "round": m.round, "home_team_confirmed": m.home_team_confirmed,
            "away_team_confirmed": m.away_team_confirmed,
            "home_score": m.home_score, "away_score": m.away_score,
            "my_prediction": {
                "home_score_pred": pred.home_score_pred, "away_score_pred": pred.away_score_pred,
                "status": pred.status, "points_awarded": pred.points_awarded,
            } if pred else None,
        })
    return result


@router.post("/api/predictions")
async def save_prediction(data: dict, auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    player, _ = auth
    match = await db.get(Match, data["match_id"])
    if not match:
        raise HTTPException(404, "match not found")
    if match.status == "finished":
        raise HTTPException(400, "match already finished")
    if not match.home_team_confirmed or not match.away_team_confirmed:
        raise HTTPException(400, "teams not yet confirmed")

    existing = (await db.execute(
        select(Prediction).where(Prediction.player_id == player.id, Prediction.match_id == data["match_id"])
    )).scalar_one_or_none()

    if existing:
        existing.home_score_pred = int(data["home_score_pred"])
        existing.away_score_pred = int(data["away_score_pred"])
        pred = existing
    else:
        pred = Prediction(
            player_id=player.id, match_id=data["match_id"],
            home_score_pred=int(data["home_score_pred"]),
            away_score_pred=int(data["away_score_pred"]),
        )
        db.add(pred)

    await db.commit()
    await db.refresh(pred)
    return {"id": pred.id, "home_score_pred": pred.home_score_pred,
            "away_score_pred": pred.away_score_pred, "status": pred.status,
            "points_awarded": pred.points_awarded}
```

- [ ] **Step 6: Implement `backend/app/routers/leaderboard.py`**

```python
from fastapi import APIRouter, Depends
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.deps import get_current_player
from app.models import Player, Match

router = APIRouter()


@router.get("/api/leaderboard")
async def leaderboard(auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    players = (await db.execute(select(Player).order_by(desc(Player.token_balance)))).scalars().all()
    return [{"id": p.id, "name": p.name, "token_balance": p.token_balance,
             "challenge_streak": p.challenge_streak, "rank": i + 1}
            for i, p in enumerate(players)]


@router.get("/api/leaderboard/red-cards")
async def red_cards_leaderboard(auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    matches = (await db.execute(select(Match).where(Match.status == "finished"))).scalars().all()
    tally: dict[str, int] = {}
    for m in matches:
        tally[m.home_team] = tally.get(m.home_team, 0) + (m.home_red_cards or 0)
        tally[m.away_team] = tally.get(m.away_team, 0) + (m.away_red_cards or 0)
    ranked = sorted(tally.items(), key=lambda x: x[1], reverse=True)
    return [{"team": team, "red_cards": count, "rank": i + 1} for i, (team, count) in enumerate(ranked)]
```

- [ ] **Step 7: Implement `backend/app/routers/tournament.py`**

```python
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.deps import get_current_player
from app.models import TournamentBet, Player

router = APIRouter()

TOURNAMENT_LOCK_TIME = datetime(2026, 6, 11, 18, 0, 0, tzinfo=timezone.utc)


@router.post("/api/tournament/bets")
async def place_tournament_bet(data: dict, auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    if datetime.now(timezone.utc) >= TOURNAMENT_LOCK_TIME:
        raise HTTPException(400, "Tournament bets are locked — the tournament has started")

    player, _ = auth
    bet_type = data.get("bet_type")
    selection = data.get("selection")
    if not bet_type or not selection:
        raise HTTPException(400, "bet_type and selection are required")
    if bet_type not in ("winner", "golden_boot", "total_goals"):
        raise HTTPException(400, "bet_type must be winner, golden_boot, or total_goals")

    try:
        stake = int(data.get("stake", 0))
        odds = float(data.get("odds", 5.0))
    except (TypeError, ValueError):
        raise HTTPException(400, "invalid stake or odds")

    if stake < 1:
        raise HTTPException(400, "minimum stake is 1")

    player = await db.get(Player, player.id)
    if player.token_balance < stake:
        raise HTTPException(400, "insufficient balance")

    tbet = TournamentBet(
        player_id=player.id,
        bet_type=bet_type,
        selection=selection,
        stake=stake,
        odds_at_placement=odds,
    )
    player.token_balance -= stake
    db.add(tbet)
    await db.commit()
    await db.refresh(tbet)
    return {"id": tbet.id, "new_balance": player.token_balance}


@router.get("/api/tournament/bets")
async def get_tournament_bets(auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    player, _ = auth
    bets = (await db.execute(
        select(TournamentBet).where(TournamentBet.player_id == player.id)
    )).scalars().all()
    return {
        "locked": datetime.now(timezone.utc) >= TOURNAMENT_LOCK_TIME,
        "lock_time": TOURNAMENT_LOCK_TIME.isoformat(),
        "my_bets": [{"id": b.id, "bet_type": b.bet_type, "selection": b.selection,
                     "stake": b.stake, "odds": b.odds_at_placement, "status": b.status}
                    for b in bets],
    }
```

- [ ] **Step 8: Run all tests — expect pass**

```bash
cd backend && pytest tests/test_predictions.py tests/test_leaderboard.py tests/test_tournament.py -v
```

Expected: All tests PASS

- [ ] **Step 9: Commit**

```bash
git add backend/app/routers/predictions.py backend/app/routers/leaderboard.py \
        backend/app/routers/tournament.py backend/tests/
git commit -m "feat: predictions, leaderboard, tournament bets routers"
```

---

## Task 11: WebSocket Hub

**Files:**
- Modify: `backend/app/ws.py`
- Create: `backend/tests/test_ws.py`

- [ ] **Step 1: Write failing test — `backend/tests/test_ws.py`**

```python
import pytest
from httpx import AsyncClient, ASGITransport
from app.ws import manager


async def test_ws_manager_connect_disconnect():
    from unittest.mock import AsyncMock, MagicMock
    mock_ws = AsyncMock()
    mock_ws.accept = AsyncMock()
    mock_ws.send_json = AsyncMock()

    await manager.connect(mock_ws, player_id=1)
    assert 1 in manager.active_connections

    manager.disconnect(mock_ws, player_id=1)
    assert 1 not in manager.active_connections


async def test_ws_broadcast():
    from unittest.mock import AsyncMock
    ws1 = AsyncMock()
    ws1.send_json = AsyncMock()
    ws2 = AsyncMock()
    ws2.send_json = AsyncMock()

    await manager.connect(ws1, player_id=1)
    await manager.connect(ws2, player_id=2)
    await manager.broadcast({"type": "leaderboard_updated"})

    ws1.send_json.assert_awaited_once_with({"type": "leaderboard_updated"})
    ws2.send_json.assert_awaited_once_with({"type": "leaderboard_updated"})

    manager.disconnect(ws1, 1)
    manager.disconnect(ws2, 2)
```

- [ ] **Step 2: Implement `backend/app/ws.py`**

```python
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from app.deps import decode_token
from jose import JWTError

router = APIRouter()


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[int, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, player_id: int):
        await websocket.accept()
        self.active_connections.setdefault(player_id, []).append(websocket)

    def disconnect(self, websocket: WebSocket, player_id: int):
        conns = self.active_connections.get(player_id, [])
        if websocket in conns:
            conns.remove(websocket)
        if not conns:
            self.active_connections.pop(player_id, None)

    async def broadcast(self, message: dict):
        dead = []
        for player_id, connections in list(self.active_connections.items()):
            for ws in connections:
                try:
                    await ws.send_json(message)
                except Exception:
                    dead.append((player_id, ws))
        for player_id, ws in dead:
            self.disconnect(ws, player_id)

    async def send_to(self, player_id: int, message: dict):
        for ws in self.active_connections.get(player_id, []):
            try:
                await ws.send_json(message)
            except Exception:
                pass


manager = ConnectionManager()


@router.websocket("/ws/{player_id}")
async def websocket_endpoint(websocket: WebSocket, player_id: int, token: str = ""):
    try:
        decode_token(token)
    except (JWTError, Exception):
        await websocket.close(code=4001)
        return

    await manager.connect(websocket, player_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, player_id)
```

- [ ] **Step 3: Run tests — expect pass**

```bash
cd backend && pytest tests/test_ws.py -v
```

Expected: Both tests PASS

- [ ] **Step 4: Commit**

```bash
git add backend/app/ws.py backend/tests/test_ws.py
git commit -m "feat: WebSocket hub — connect, broadcast, per-player send"
```

---

## Task 12: Poller + Full Settlement

**Files:**
- Modify: `backend/app/poller.py`
- Create: `backend/app/results_client.py`
- Create: `backend/app/odds_client.py`
- Create: `backend/tests/test_poller.py`

- [ ] **Step 1: Create `backend/app/odds_client.py`**

```python
import requests


def fetch_match_odds(api_key: str) -> dict:
    resp = requests.get(
        "https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds",
        params={"apiKey": api_key, "regions": "eu", "markets": "h2h,totals,btts", "oddsFormat": "decimal"},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    return {
        "data": data,
        "quota_remaining": int(resp.headers.get("x-requests-remaining", 0)),
    }


def extract_all_markets(event: dict) -> dict:
    markets: dict[str, list] = {}
    for bm in event.get("bookmakers", []):
        for market in bm.get("markets", []):
            key = market["key"]
            if key not in markets:
                markets[key] = market["outcomes"]
    return markets
```

- [ ] **Step 2: Create `backend/app/results_client.py`**

```python
import requests


def fetch_live_scores(api_key: str) -> list[dict]:
    """Return list of finished/live match results from api-football.com."""
    resp = requests.get(
        "https://v3.football.api-sports.io/fixtures",
        params={"league": "1", "season": "2026", "status": "FT"},
        headers={"x-apisports-key": api_key},
        timeout=10,
    )
    resp.raise_for_status()
    fixtures = resp.json().get("response", [])
    results = []
    for f in fixtures:
        results.append({
            "home_team": f["teams"]["home"]["name"],
            "away_team": f["teams"]["away"]["name"],
            "home_score": f["goals"]["home"],
            "away_score": f["goals"]["away"],
            "home_red_cards": sum(
                1 for e in f.get("events", [])
                if e.get("type") == "Card" and e.get("detail") == "Red Card"
                and e["team"]["id"] == f["teams"]["home"]["id"]
            ),
            "away_red_cards": sum(
                1 for e in f.get("events", [])
                if e.get("type") == "Card" and e.get("detail") == "Red Card"
                and e["team"]["id"] == f["teams"]["away"]["id"]
            ),
            "corners": 0,  # corners require a separate endpoint
        })
    return results


def fetch_top_scorer(api_key: str) -> str | None:
    """Return the top scorer's name after the tournament."""
    resp = requests.get(
        "https://v3.football.api-sports.io/players/topscorers",
        params={"league": "1", "season": "2026"},
        headers={"x-apisports-key": api_key},
        timeout=10,
    )
    resp.raise_for_status()
    response = resp.json().get("response", [])
    if response:
        p = response[0]["player"]
        return f"{p['firstname']} {p['lastname']}"
    return None
```

- [ ] **Step 3: Write `backend/tests/test_poller.py`**

```python
import pytest
from datetime import datetime, timezone
from sqlalchemy import select
from app.models import Match, Bet, Challenge, Prediction, Player, TournamentBet
from app.poller import settle_match
from tests.conftest import make_match, make_player


async def test_settle_match_wins_bet(db):
    player = await make_player(db, "Alice", balance=1000)
    match = await make_match(db, status="locked")
    bet = Bet(player_id=player.id, match_id=match.id, bet_type="1x2",
              selection="Argentina", stake=100, odds_at_placement=2.0)
    db.add(bet)
    await db.commit()

    result = {"home_score": 2, "away_score": 1, "home_red_cards": 0,
              "away_red_cards": 0, "corners": 5}
    await settle_match(db, match, result)

    await db.refresh(player)
    await db.refresh(bet)
    assert bet.status == "won"
    assert player.token_balance == 1000 - 100 + 200  # 1100


async def test_settle_match_loses_bet(db):
    player = await make_player(db, "Bob", balance=500)
    match = await make_match(db, status="locked", home="Brazil", away="France")
    bet = Bet(player_id=player.id, match_id=match.id, bet_type="1x2",
              selection="Brazil", stake=100, odds_at_placement=2.0)
    db.add(bet)
    await db.commit()

    result = {"home_score": 0, "away_score": 2, "home_red_cards": 0,
              "away_red_cards": 0, "corners": 3}
    await settle_match(db, match, result)

    await db.refresh(player)
    await db.refresh(bet)
    assert bet.status == "lost"
    assert player.token_balance == 400  # lost 100


async def test_settle_prediction_correct_score(db):
    player = await make_player(db, "Carol", balance=1000)
    match = await make_match(db, status="locked")
    pred = Prediction(player_id=player.id, match_id=match.id,
                      home_score_pred=2, away_score_pred=1)
    db.add(pred)
    await db.commit()

    result = {"home_score": 2, "away_score": 1, "home_red_cards": 0,
              "away_red_cards": 0, "corners": 0}
    await settle_match(db, match, result)

    await db.refresh(pred)
    assert pred.status == "correct_score"
    assert pred.points_awarded == 3


async def test_settle_prediction_correct_outcome(db):
    player = await make_player(db, "Dave", balance=1000)
    match = await make_match(db, status="locked")
    pred = Prediction(player_id=player.id, match_id=match.id,
                      home_score_pred=1, away_score_pred=0)
    db.add(pred)
    await db.commit()

    result = {"home_score": 3, "away_score": 0, "home_red_cards": 0,
              "away_red_cards": 0, "corners": 0}
    await settle_match(db, match, result)

    await db.refresh(pred)
    assert pred.status == "correct_outcome"
    assert pred.points_awarded == 1
```

- [ ] **Step 4: Run tests — expect failure**

```bash
cd backend && pytest tests/test_poller.py -v
```

- [ ] **Step 5: Implement `backend/app/poller.py`**

```python
import logging
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Match, Bet, Challenge, Prediction, Player, TournamentBet
from app.settlement import (
    settle_bet, settle_challenge_issuer, settle_challenge_acceptor,
    determine_h2h_winner, determine_correct_score_winner,
    determine_totals_winner, determine_btts_winner,
)

logger = logging.getLogger(__name__)


async def settle_match(db: AsyncSession, match: Match, result: dict) -> None:
    match.home_score = result["home_score"]
    match.away_score = result["away_score"]
    match.home_red_cards = result["home_red_cards"]
    match.away_red_cards = result["away_red_cards"]
    match.corners = result["corners"]
    match.status = "finished"

    await _settle_bets(db, match, result)
    await _settle_challenges(db, match, result)
    await _settle_predictions(db, match, result)
    await _propagate_winner(db, match, result)
    await db.commit()


async def _settle_bets(db: AsyncSession, match: Match, result: dict) -> None:
    bets = (await db.execute(
        select(Bet).where(Bet.match_id == match.id, Bet.status == "pending")
    )).scalars().all()

    for bet in bets:
        won = _evaluate_bet(bet.bet_type, bet.selection, match, result)
        payout = settle_bet(bet.stake, bet.odds_at_placement, won)
        bet.status = "won" if won else "lost"
        if payout:
            player = await db.get(Player, bet.player_id)
            player.token_balance += payout


def _evaluate_bet(bet_type: str, selection: str, match: Match, result: dict) -> bool:
    hs, as_ = result["home_score"], result["away_score"]
    if bet_type == "1x2":
        return selection == determine_h2h_winner(match.home_team, hs, as_)
    if bet_type == "correct_score":
        return determine_correct_score_winner(selection, hs, as_)
    if bet_type == "totals":
        return determine_totals_winner(selection, hs + as_)
    if bet_type == "btts":
        return determine_btts_winner(selection, hs, as_)
    if bet_type == "corners":
        return determine_totals_winner(selection, result.get("corners", 0))
    return False


async def _settle_challenges(db: AsyncSession, match: Match, result: dict) -> None:
    challenges = (await db.execute(
        select(Challenge).where(Challenge.match_id == match.id, Challenge.status == "accepted")
    )).scalars().all()

    for ch in challenges:
        issuer_won = _evaluate_bet(ch.bet_type, ch.selection, match, result)
        issuer = await db.get(Player, ch.issuer_id)
        acceptor = await db.get(Player, ch.acceptor_id)

        payout, bonus = settle_challenge_issuer(ch.issuer_stake, ch.issuer_odds,
                                                issuer.challenge_streak, issuer_won)
        if payout:
            issuer.token_balance += payout + bonus
        else:
            issuer.challenge_streak = 0

        acceptor_payout = settle_challenge_acceptor(ch.acceptor_stake, ch.acceptor_odds, not issuer_won)
        if acceptor_payout:
            acceptor.token_balance += acceptor_payout

        ch.status = "resolved"


async def _settle_predictions(db: AsyncSession, match: Match, result: dict) -> None:
    preds = (await db.execute(
        select(Prediction).where(Prediction.match_id == match.id, Prediction.status == "pending")
    )).scalars().all()

    hs, as_ = result["home_score"], result["away_score"]
    for pred in preds:
        if pred.home_score_pred == hs and pred.away_score_pred == as_:
            pred.status = "correct_score"
            pred.points_awarded = 3
        elif _same_outcome(pred.home_score_pred, pred.away_score_pred, hs, as_):
            pred.status = "correct_outcome"
            pred.points_awarded = 1
        else:
            pred.status = "wrong"
            pred.points_awarded = 0


def _same_outcome(ph: int, pa: int, ah: int, aa: int) -> bool:
    if ph > pa and ah > aa:
        return True
    if ph < pa and ah < aa:
        return True
    if ph == pa and ah == aa:
        return True
    return False


async def _propagate_winner(db: AsyncSession, match: Match, result: dict) -> None:
    if not match.next_match_id:
        return
    winner = determine_h2h_winner(match.home_team, result["home_score"], result["away_score"])
    winning_team = match.home_team if winner == match.home_team else match.away_team

    next_match = await db.get(Match, match.next_match_id)
    if not next_match:
        return
    if match.next_slot == "home":
        next_match.home_team = winning_team
        next_match.home_team_confirmed = True
    else:
        next_match.away_team = winning_team
        next_match.away_team_confirmed = True


def start_poller(app) -> None:
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from app.config import settings
    from app.database import AsyncSessionLocal
    from app.results_client import fetch_live_scores
    from app.ws import manager

    scheduler = AsyncIOScheduler()

    async def _poll():
        try:
            results = fetch_live_scores(settings.football_api_key)
        except Exception as e:
            logger.warning(f"Poll failed: {e}")
            return

        async with AsyncSessionLocal() as db:
            locked = (await db.execute(
                select(Match).where(Match.status == "locked")
            )).scalars().all()

            for result in results:
                match = next((m for m in locked
                              if m.home_team == result["home_team"]
                              and m.away_team == result["away_team"]), None)
                if match:
                    await settle_match(db, match, result)
                    await manager.broadcast({"type": "match_settled", "match_id": match.id})
                    await manager.broadcast({"type": "leaderboard_updated"})

            await _settle_tournament_if_final_done(db)

    async def _settle_tournament_if_final_done(db: AsyncSession) -> None:
        from app.settlement import settle_bet
        final = (await db.execute(
            select(Match).where(Match.round == "final", Match.status == "finished")
        )).scalar_one_or_none()
        if not final:
            return

        pending = (await db.execute(
            select(TournamentBet).where(TournamentBet.status == "pending")
        )).scalars().all()
        if not pending:
            return

        winner_name = determine_h2h_winner(final.home_team, final.home_score, final.away_score)
        winning_team = final.home_team if winner_name == final.home_team else final.away_team

        from app.results_client import fetch_top_scorer
        try:
            top_scorer = fetch_top_scorer(settings.football_api_key)
        except Exception:
            top_scorer = None

        all_matches = (await db.execute(select(Match).where(Match.status == "finished"))).scalars().all()
        total_goals = sum((m.home_score or 0) + (m.away_score or 0) for m in all_matches)

        for tbet in pending:
            won = False
            if tbet.bet_type == "winner":
                won = tbet.selection == winning_team
            elif tbet.bet_type == "golden_boot" and top_scorer:
                won = tbet.selection.lower() in top_scorer.lower()
            elif tbet.bet_type == "total_goals":
                won = determine_totals_winner(tbet.selection, total_goals)

            payout = settle_bet(tbet.stake, tbet.odds_at_placement, won)
            tbet.status = "won" if won else "lost"
            if payout:
                player = await db.get(Player, tbet.player_id)
                player.token_balance += payout

        await db.commit()

    scheduler.add_job(_poll, "interval", seconds=60)
    scheduler.start()
```

- [ ] **Step 6: Run tests — expect pass**

```bash
cd backend && pytest tests/test_poller.py -v
```

Expected: All 4 tests PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/poller.py backend/app/odds_client.py backend/app/results_client.py backend/tests/test_poller.py
git commit -m "feat: poller — auto-settle bets, challenges, predictions, tournament bets"
```

---

## Task 13: AI Suggest Endpoint (SSE)

**Files:**
- Modify: `backend/app/routers/ai.py`
- Create: `backend/tests/test_ai.py`

- [ ] **Step 1: Write failing test — `backend/tests/test_ai.py`**

```python
import json
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from tests.conftest import join_player, make_match


async def test_suggest_challenge_streams_response(client, db):
    m = await make_match(db)
    data = await join_player(client)
    headers = {"Authorization": f"Bearer {data['token']}"}

    fake_chunks = [
        MagicMock(type="content_block_delta", delta=MagicMock(text="**Challenge 1:** Bet Argentina to win")),
        MagicMock(type="content_block_delta", delta=MagicMock(text=" at 2.5 odds.")),
    ]

    mock_stream = MagicMock()
    mock_stream.__enter__ = MagicMock(return_value=iter(fake_chunks))
    mock_stream.__exit__ = MagicMock(return_value=False)

    with patch("app.routers.ai.anthropic_client") as mock_client:
        mock_client.messages.stream.return_value = mock_stream
        resp = await client.post(f"/api/ai/suggest-challenge",
                                 json={"match_id": m.id}, headers=headers)

    assert resp.status_code == 200
    assert "text/event-stream" in resp.headers["content-type"]


async def test_suggest_challenge_match_not_found(client, db):
    data = await join_player(client)
    headers = {"Authorization": f"Bearer {data['token']}"}
    resp = await client.post("/api/ai/suggest-challenge",
                             json={"match_id": 999}, headers=headers)
    assert resp.status_code == 404
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd backend && pytest tests/test_ai.py -v
```

- [ ] **Step 3: Implement `backend/app/routers/ai.py`**

```python
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
import anthropic
from app.database import get_db
from app.deps import get_current_player
from app.models import Match, Player
from app.config import settings

router = APIRouter()

anthropic_client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

_SYSTEM = """You are a sports betting advisor for a World Cup friend group.
Given a match and its current odds, suggest 2-3 interesting P2P challenge ideas.
For each suggestion include:
1. The market and pick (e.g. "Correct Score 2-1 Argentina")
2. A recommended stake (between 50-300 tokens)
3. One sentence explaining why this pick is interesting given the odds.
Format each suggestion with a bold header like **Challenge 1:**.
Keep it punchy and fun — this is for friends, not a casino."""


def _build_prompt(match: Match, player: Player, odds: dict) -> str:
    lines = [
        f"Match: {match.home_team} vs {match.away_team}",
        f"Round: {match.round}",
        f"Player balance: {player.token_balance} tokens",
        f"Player challenge streak: {player.challenge_streak}",
        "",
        "Available odds:",
    ]
    for market, outcomes in odds.items():
        lines.append(f"  {market}:")
        for o in outcomes:
            lines.append(f"    {o.get('name', '?')}: {o.get('price', '?')}")
    lines.append("\nSuggest 2-3 challenge ideas for this match.")
    return "\n".join(lines)


async def _stream_suggestions(match: Match, player: Player, odds: dict):
    prompt = _build_prompt(match, player, odds)
    try:
        with anthropic_client.messages.stream(
            model="claude-sonnet-4-6",
            max_tokens=600,
            system=_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            for event in stream:
                if event.type == "content_block_delta":
                    chunk = event.delta.text
                    yield f"data: {json.dumps({'text': chunk})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
    yield "data: [DONE]\n\n"


@router.post("/api/ai/suggest-challenge")
async def suggest_challenge(data: dict, auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    player, _ = auth
    match = await db.get(Match, data.get("match_id"))
    if not match:
        raise HTTPException(404, "match not found")

    try:
        odds = json.loads(match.odds_cache) if match.odds_cache else {}
    except (json.JSONDecodeError, ValueError):
        odds = {}

    player = await db.get(Player, player.id)

    return StreamingResponse(
        _stream_suggestions(match, player, odds),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd backend && pytest tests/test_ai.py -v
```

Expected: Both tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/ai.py backend/tests/test_ai.py
git commit -m "feat: AI suggest-challenge endpoint with SSE streaming"
```

---

## Task 14: Alembic + CLI Seed Script

**Files:**
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/scripts/seed.py`

- [ ] **Step 1: Initialise Alembic**

```bash
cd backend && alembic init alembic
```

- [ ] **Step 2: Update `backend/alembic/env.py`**

Replace the generated `env.py` with:

```python
import asyncio
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context
from app.config import settings
from app.database import Base
import app.models  # ensure all models are registered

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(url=settings.database_url, target_metadata=target_metadata,
                      literal_binds=True, dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 3: Generate initial migration**

```bash
cd backend && alembic revision --autogenerate -m "initial schema"
```

Expected: Creates `alembic/versions/<hash>_initial_schema.py`

- [ ] **Step 4: Create `backend/scripts/seed.py`**

```python
"""
CLI seed script — run once after first deploy.
Usage:
  python scripts/seed.py          # import matches + seed KO bracket
  python scripts/seed.py --reset  # wipe all data first (dev only)
"""
import asyncio
import json
import sys
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.config import settings
from app.database import Base
from app.models import Match
from app.odds_client import fetch_match_odds, extract_all_markets

BASE_KO = datetime(2026, 7, 1, 18, 0, tzinfo=timezone.utc)


def ko(days: int) -> datetime:
    return BASE_KO + timedelta(days=days)


async def seed(reset: bool = False):
    engine = create_async_engine(settings.database_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        if reset:
            await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with session_factory() as db:
        await _import_matches(db)
        await _seed_ko_bracket(db)
        await db.commit()

    await engine.dispose()
    print("Seed complete.")


async def _import_matches(db: AsyncSession):
    if not settings.odds_api_key:
        print("ODDS_API_KEY not set — skipping match import")
        return
    try:
        result = fetch_match_odds(settings.odds_api_key)
    except Exception as e:
        print(f"Odds API error: {e}")
        return

    imported = 0
    for event in result.get("data", []):
        existing = (await db.execute(
            select(Match).where(Match.home_team == event["home_team"],
                                Match.away_team == event["away_team"])
        )).scalar_one_or_none()
        if existing:
            existing.odds_cache = json.dumps(extract_all_markets(event))
        else:
            kickoff = datetime.fromisoformat(event["commence_time"].replace("Z", "+00:00"))
            m = Match(home_team=event["home_team"], away_team=event["away_team"],
                      kickoff_time=kickoff, odds_cache=json.dumps(extract_all_markets(event)))
            db.add(m)
            imported += 1

    print(f"Imported {imported} matches. Quota remaining: {result.get('quota_remaining', '?')}")


async def _seed_ko_bracket(db: AsyncSession):
    async def get_or_create(label: str, round_: str, kickoff: datetime):
        existing = (await db.execute(
            select(Match).where(Match.home_team == f"{label} (H)", Match.round == round_)
        )).scalar_one_or_none()
        if existing:
            return existing, False
        m = Match(home_team=f"{label} (H)", away_team=f"{label} (A)", kickoff_time=kickoff,
                  status="upcoming", round=round_, home_team_confirmed=False, away_team_confirmed=False)
        db.add(m)
        await db.flush()
        return m, True

    created = 0

    r32 = {}
    for i in range(16):
        m, new = await get_or_create(f"R32-{i+1}", "r32", ko(i % 4))
        r32[f"R32-{i+1}"] = m
        created += new

    r16 = {}
    for i in range(8):
        m, new = await get_or_create(f"R16-{i+1}", "r16", ko(10 + i % 2))
        r16[f"R16-{i+1}"] = m
        created += new

    r32_keys = list(r32.keys())
    r16_keys = list(r16.keys())
    for i, rk in enumerate(r32_keys):
        r32[rk].next_match_id = r16[r16_keys[i // 2]].id
        r32[rk].next_slot = "home" if i % 2 == 0 else "away"

    qf = {}
    for i in range(4):
        m, new = await get_or_create(f"QF-{i+1}", "qf", ko(18 + i % 2))
        qf[f"QF-{i+1}"] = m
        created += new

    for i, rk in enumerate(r16_keys):
        qf_keys = list(qf.keys())
        r16[rk].next_match_id = qf[qf_keys[i // 2]].id
        r16[rk].next_slot = "home" if i % 2 == 0 else "away"

    sf1, n1 = await get_or_create("SF-1", "sf", ko(23))
    sf2, n2 = await get_or_create("SF-2", "sf", ko(24))
    third, n3 = await get_or_create("3rd-Place", "sf", ko(26))
    final, n4 = await get_or_create("Final", "final", ko(27))
    created += n1 + n2 + n3 + n4

    qf_keys = list(qf.keys())
    qf[qf_keys[0]].next_match_id = sf1.id; qf[qf_keys[0]].next_slot = "home"
    qf[qf_keys[1]].next_match_id = sf1.id; qf[qf_keys[1]].next_slot = "away"
    qf[qf_keys[2]].next_match_id = sf2.id; qf[qf_keys[2]].next_slot = "home"
    qf[qf_keys[3]].next_match_id = sf2.id; qf[qf_keys[3]].next_slot = "away"
    sf1.next_match_id = final.id; sf1.next_slot = "home"
    sf2.next_match_id = final.id; sf2.next_slot = "away"

    print(f"KO bracket: {created} new slots created.")


if __name__ == "__main__":
    reset = "--reset" in sys.argv
    asyncio.run(seed(reset=reset))
```

- [ ] **Step 5: Run full test suite**

```bash
cd backend && pytest -v
```

Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/alembic/ backend/alembic.ini backend/scripts/seed.py
git commit -m "feat: alembic migrations + CLI seed script for match import + KO bracket"
```

---

## Task 15: Final Wiring + Smoke Test

**Files:**
- No new files — verify the whole app runs

- [ ] **Step 1: Run full test suite one final time**

```bash
cd backend && pytest -v --tb=short
```

Expected: All tests PASS, zero failures

- [ ] **Step 2: Smoke-test the running app**

```bash
cd backend && uvicorn app.main:app --reload --port 8000
```

In a second terminal:
```bash
curl -s -X POST http://localhost:8000/api/auth/join \
  -H "Content-Type: application/json" \
  -d '{"name": "TestUser", "code": "friends2026"}' | python -m json.tool
```

Expected: JSON response with `token` and `player` fields.

- [ ] **Step 3: Create `backend/Procfile` for Railway**

```
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

- [ ] **Step 4: Commit**

```bash
git add backend/Procfile
git commit -m "chore: Procfile for Railway deployment"
```

---

*Next plan: `2026-05-20-worldcup-betting-v2-frontend.md` — React + Vite + Tailwind + shadcn/ui frontend.*
