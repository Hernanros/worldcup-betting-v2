# Multi-League Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `League` model so multiple friend groups can share one deployment, each with their own invite code, isolated leaderboard, and challenge pool.

**Architecture:** Matches remain global (everyone bets on the same WC matches). A new `League` model holds an invite code and name. `Player` gets a nullable `league_id` FK. All per-group queries (leaderboard, open challenges) filter by `current_player.league_id`. Admins create leagues via a protected endpoint; players join by entering the league's invite code. The existing `settings.invite_code` is retired — every group needs its own league record.

**Tech Stack:** FastAPI, SQLAlchemy async (SQLite dev / PostgreSQL prod), pytest-asyncio, React 18

**Working directories:**
- Backend: `/Users/hernanrosenblum/Documents/worldcup-betting-v2/backend`
- Frontend: `/Users/hernanrosenblum/Documents/worldcup-betting-v2/frontend`

**Run backend tests:** `cd backend && ./venv/bin/pytest -x -q`
**Run frontend tests:** `cd frontend && npm test -- --run`

---

## File Map

| File | Change |
|---|---|
| `backend/app/models.py` | Add `League` model; add `league_id` FK to `Player` |
| `backend/app/routers/leagues.py` | **New** — `POST /api/leagues` (admin), `GET /api/leagues` (admin) |
| `backend/app/routers/auth.py` | `join`: look up league by invite code; include league in response |
| `backend/app/routers/leaderboard.py` | Filter players by `league_id` |
| `backend/app/routers/matches.py` | Filter `open_challenges` to same league; filter `list_matches` challenges |
| `backend/app/routers/challenges.py` | Validate same league on `accept_challenge` |
| `backend/app/main.py` | Include `leagues.router` |
| `backend/tests/conftest.py` | Add `make_league` helper; seed default league in `db` fixture |
| `backend/tests/test_leagues.py` | **New** — league CRUD + cross-league isolation tests |
| `backend/scripts/create_league.py` | **New** — one-shot CLI to create first league on existing deployments |
| `frontend/src/pages/JoinPage.jsx` | Show league name after successful join; update error copy |

---

## Task 1 — League model + Player.league_id

**Files:**
- Modify: `backend/app/models.py`

- [ ] **Add the `League` model and `Player.league_id` to `backend/app/models.py`:**

  At the top of `models.py`, after the existing imports, add:
  ```python
  from datetime import datetime
  ```

  Add the `League` class **before** `Player`:
  ```python
  class League(Base):
      __tablename__ = "leagues"
      id          = Column(Integer, primary_key=True)
      name        = Column(String(100), nullable=False)
      invite_code = Column(String(50), unique=True, nullable=False)
      created_at  = Column(DateTime, nullable=False, default=datetime.utcnow)

      players = relationship("Player", back_populates="league")
  ```

  In the `Player` class add two lines after `volume_milestone_reached`:
  ```python
  league_id = Column(Integer, ForeignKey("leagues.id"), nullable=True)
  league    = relationship("League", back_populates="players")
  ```

- [ ] **Verify the app still starts (no import errors):**
  ```bash
  cd /Users/hernanrosenblum/Documents/worldcup-betting-v2/backend
  ./venv/bin/python -c "from app.models import League, Player; print('OK')"
  ```
  Expected output: `OK`

- [ ] **Run backend tests — should all still pass (DB recreated from metadata):**
  ```bash
  ./venv/bin/pytest -x -q
  ```
  Expected: all pass.

- [ ] **Commit:**
  ```bash
  git add backend/app/models.py
  git commit -m "feat: add League model and Player.league_id FK"
  ```

---

## Task 2 — Leagues router (admin CRUD)

**Files:**
- Create: `backend/app/routers/leagues.py`

- [ ] **Write the test first — create `backend/tests/test_leagues.py`:**

  ```python
  import pytest
  from tests.conftest import join_player

  ADMIN_HEADERS = None  # set in each test via join_admin helper

  async def _admin_headers(client):
      resp = await client.post("/api/auth/join", json={"name": "Admin", "code": "admin"})
      assert resp.status_code == 200
      return {"Authorization": f"Bearer {resp.json()['token']}"}


  async def test_create_league_requires_auth(client, db):
      resp = await client.post("/api/leagues", json={"name": "X", "invite_code": "x"})
      assert resp.status_code == 401


  async def test_create_league_requires_admin(client, db):
      alice = await join_player(client, "Alice")
      resp = await client.post("/api/leagues",
                               json={"name": "X", "invite_code": "x"},
                               headers={"Authorization": f"Bearer {alice['token']}"})
      assert resp.status_code == 403


  async def test_create_league_succeeds(client, db):
      headers = await _admin_headers(client)
      resp = await client.post("/api/leagues",
                               json={"name": "Office League", "invite_code": "office26"},
                               headers=headers)
      assert resp.status_code == 200
      body = resp.json()
      assert body["name"] == "Office League"
      assert body["invite_code"] == "office26"
      assert "id" in body


  async def test_create_league_duplicate_code_fails(client, db):
      headers = await _admin_headers(client)
      await client.post("/api/leagues",
                        json={"name": "A", "invite_code": "dup"},
                        headers=headers)
      resp = await client.post("/api/leagues",
                               json={"name": "B", "invite_code": "dup"},
                               headers=headers)
      assert resp.status_code == 400


  async def test_list_leagues_requires_admin(client, db):
      resp = await client.get("/api/leagues")
      assert resp.status_code == 401


  async def test_list_leagues_returns_all(client, db):
      headers = await _admin_headers(client)
      await client.post("/api/leagues",
                        json={"name": "L1", "invite_code": "l1"},
                        headers=headers)
      await client.post("/api/leagues",
                        json={"name": "L2", "invite_code": "l2"},
                        headers=headers)
      resp = await client.get("/api/leagues", headers=headers)
      assert resp.status_code == 200
      # includes the default "Test League" created in conftest + l1 + l2
      names = [l["name"] for l in resp.json()]
      assert "L1" in names
      assert "L2" in names
  ```

- [ ] **Run tests — confirm they fail (router doesn't exist yet):**
  ```bash
  ./venv/bin/pytest tests/test_leagues.py -x -q
  ```
  Expected: FAIL — `404` or import error.

- [ ] **Create `backend/app/routers/leagues.py`:**

  ```python
  from fastapi import APIRouter, Depends, HTTPException
  from sqlalchemy import select
  from sqlalchemy.ext.asyncio import AsyncSession
  from app.database import get_db
  from app.deps import get_admin
  from app.models import League

  router = APIRouter()


  @router.post("/api/leagues")
  async def create_league(data: dict, _=Depends(get_admin), db: AsyncSession = Depends(get_db)):
      name = (data.get("name") or "").strip()
      code = (data.get("invite_code") or "").strip()
      if not name or not code:
          raise HTTPException(400, "name and invite_code are required")
      existing = (await db.execute(
          select(League).where(League.invite_code == code)
      )).scalar_one_or_none()
      if existing:
          raise HTTPException(400, "invite_code already in use")
      league = League(name=name, invite_code=code)
      db.add(league)
      await db.commit()
      await db.refresh(league)
      return {"id": league.id, "name": league.name, "invite_code": league.invite_code}


  @router.get("/api/leagues")
  async def list_leagues(_=Depends(get_admin), db: AsyncSession = Depends(get_db)):
      leagues = (await db.execute(select(League))).scalars().all()
      return [{"id": l.id, "name": l.name, "invite_code": l.invite_code} for l in leagues]
  ```

- [ ] **Register the router in `backend/app/main.py`:**

  Find this line:
  ```python
  from app.routers import auth, matches, bets, challenges, predictions, leaderboard, tournament, ai
  ```
  Replace with:
  ```python
  from app.routers import auth, matches, bets, challenges, predictions, leaderboard, tournament, ai, leagues
  ```

  Find:
  ```python
  for router in [auth.router, matches.router, bets.router, challenges.router,
                 predictions.router, leaderboard.router, tournament.router, ai.router, ws_router]:
  ```
  Replace with:
  ```python
  for router in [auth.router, matches.router, bets.router, challenges.router,
                 predictions.router, leaderboard.router, tournament.router, ai.router,
                 leagues.router, ws_router]:
  ```

- [ ] **Run the league tests — confirm they pass:**
  ```bash
  ./venv/bin/pytest tests/test_leagues.py -x -q
  ```
  Expected: all pass.

- [ ] **Run full suite:**
  ```bash
  ./venv/bin/pytest -x -q
  ```
  Expected: all pass.

- [ ] **Commit:**
  ```bash
  git add backend/app/routers/leagues.py backend/app/main.py backend/tests/test_leagues.py
  git commit -m "feat: POST /api/leagues and GET /api/leagues (admin only)"
  ```

---

## Task 3 — Auth: join with league code

**Files:**
- Modify: `backend/app/routers/auth.py`
- Modify: `backend/tests/conftest.py`
- Modify: `backend/tests/test_auth.py`

The join endpoint currently checks `code` against two hardcoded settings values. After this task it looks up a `League` by `invite_code` instead. Admin code (`settings.admin_code`) still bypasses league lookup so admins can always join.

- [ ] **Update `backend/tests/conftest.py` — seed a default league in the `db` fixture and add `make_league` helper:**

  Add `make_league` after `make_match`:
  ```python
  async def make_league(db, name="Test League", code="friends2026"):
      from app.models import League
      league = League(name=name, invite_code=code)
      db.add(league)
      await db.commit()
      await db.refresh(league)
      return league
  ```

  Update the `db` fixture to seed the default league so all existing tests keep working:
  ```python
  @pytest_asyncio.fixture
  async def db(db_engine):
      session_factory = async_sessionmaker(db_engine, expire_on_commit=False)
      async with session_factory() as session:
          # Seed default league matching the test invite code
          from app.models import League
          session.add(League(name="Test League", invite_code="friends2026"))
          await session.commit()
          yield session
  ```

- [ ] **Write new auth tests — add to `backend/tests/test_auth.py`:**

  ```python
  async def test_join_with_valid_league_code_succeeds(client, db):
      resp = await client.post("/api/auth/join", json={"name": "Alice", "code": "friends2026"})
      assert resp.status_code == 200
      body = resp.json()
      assert body["league"]["name"] == "Test League"
      assert body["player"]["name"] == "Alice"


  async def test_join_with_invalid_code_returns_403(client, db):
      resp = await client.post("/api/auth/join", json={"name": "Alice", "code": "notacode"})
      assert resp.status_code == 403


  async def test_admin_join_bypasses_league(client, db):
      resp = await client.post("/api/auth/join", json={"name": "Admin", "code": "admin"})
      assert resp.status_code == 200
      assert resp.json()["league"] is None


  async def test_same_name_allowed_in_different_leagues(client, db):
      # create a second league
      admin = await client.post("/api/auth/join", json={"name": "A", "code": "admin"})
      h = {"Authorization": f"Bearer {admin.json()['token']}"}
      await client.post("/api/leagues", json={"name": "Other", "invite_code": "other26"}, headers=h)

      r1 = await client.post("/api/auth/join", json={"name": "Alice", "code": "friends2026"})
      r2 = await client.post("/api/auth/join", json={"name": "Alice", "code": "other26"})
      assert r1.status_code == 200
      assert r2.status_code == 200
      # They are different players
      assert r1.json()["player"]["id"] != r2.json()["player"]["id"]
  ```

- [ ] **Run new tests — confirm they fail:**
  ```bash
  ./venv/bin/pytest tests/test_auth.py::test_join_with_valid_league_code_succeeds -x -q
  ```
  Expected: FAIL — `AssertionError` (league not in response yet).

- [ ] **Replace `backend/app/routers/auth.py` with the updated version:**

  ```python
  from fastapi import APIRouter, Depends, HTTPException
  from sqlalchemy import select
  from sqlalchemy.ext.asyncio import AsyncSession
  from app.database import get_db
  from app.models import Player, League
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

      league = None
      if not is_admin:
          result = await db.execute(select(League).where(League.invite_code == code))
          league = result.scalar_one_or_none()
          if not league:
              raise HTTPException(403, "invalid invite code")

      # Find or create player, scoped to league
      query = select(Player).where(Player.name == name)
      if league:
          query = query.where(Player.league_id == league.id)
      else:
          query = query.where(Player.league_id.is_(None))
      result = await db.execute(query)
      player = result.scalar_one_or_none()

      if not player:
          player = Player(name=name, token_balance=1000,
                          league_id=league.id if league else None)
          db.add(player)
          await db.commit()
          await db.refresh(player)

      token = make_token(player.id, is_admin)
      player.session_token = token
      await db.commit()

      return {
          "token": token,
          "player": _player_dict(player, is_admin),
          "league": {"id": league.id, "name": league.name} if league else None,
      }


  @router.get("/api/me")
  async def get_me(auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
      player, _ = auth
      p = await db.get(Player, player.id)
      return {
          "id": p.id,
          "name": p.name,
          "token_balance": p.token_balance,
          "challenge_streak": p.challenge_streak,
          "total_challenges_issued": p.total_challenges_issued,
          "volume_milestone_reached": p.volume_milestone_reached,
      }


  @router.get("/api/players/me")
  async def me(auth=Depends(get_current_player)):
      player, is_admin = auth
      return _player_dict(player, is_admin)
  ```

- [ ] **Run all backend tests:**
  ```bash
  ./venv/bin/pytest -x -q
  ```
  Expected: all pass.

- [ ] **Commit:**
  ```bash
  git add backend/app/routers/auth.py backend/tests/conftest.py backend/tests/test_auth.py
  git commit -m "feat: join endpoint looks up league by invite code; response includes league info"
  ```

---

## Task 4 — Leaderboard scoping

**Files:**
- Modify: `backend/app/routers/leaderboard.py`
- Modify: `backend/tests/test_leagues.py`

- [ ] **Add isolation test to `backend/tests/test_leagues.py`:**

  ```python
  async def test_leaderboard_scoped_to_league(client, db):
      """Players in different leagues must not appear in each other's leaderboard."""
      # Create a second league
      headers = await _admin_headers(client)
      await client.post("/api/leagues",
                        json={"name": "Office", "invite_code": "office26"},
                        headers=headers)

      alice = await join_player(client, "Alice", "friends2026")
      bob_resp = await client.post("/api/auth/join",
                                   json={"name": "Bob", "code": "office26"})
      bob_token = bob_resp.json()["token"]

      alice_lb = (await client.get(
          "/api/leaderboard",
          headers={"Authorization": f"Bearer {alice['token']}"}
      )).json()
      bob_lb = (await client.get(
          "/api/leaderboard",
          headers={"Authorization": f"Bearer {bob_token}"}
      )).json()

      alice_names = [p["name"] for p in alice_lb]
      bob_names   = [p["name"] for p in bob_lb]

      assert "Alice" in alice_names
      assert "Bob"   not in alice_names
      assert "Bob"   in bob_names
      assert "Alice" not in bob_names
  ```

- [ ] **Run the new test — confirm it fails:**
  ```bash
  ./venv/bin/pytest tests/test_leagues.py::test_leaderboard_scoped_to_league -x -q
  ```
  Expected: FAIL — Bob appears in Alice's leaderboard.

- [ ] **Replace `backend/app/routers/leaderboard.py` with the scoped version:**

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
      player, _ = auth
      query = select(Player).order_by(desc(Player.token_balance))
      if player.league_id is not None:
          query = query.where(Player.league_id == player.league_id)
      players = (await db.execute(query)).scalars().all()
      result = []
      for i, p in enumerate(players):
          rank = result[i - 1]["rank"] if i > 0 and players[i - 1].token_balance == p.token_balance else i + 1
          result.append({"id": p.id, "name": p.name, "token_balance": p.token_balance,
                          "challenge_streak": p.challenge_streak, "rank": rank})
      return result


  @router.get("/api/leaderboard/red-cards")
  async def red_cards_leaderboard(auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
      matches = (await db.execute(select(Match).where(Match.status == "finished"))).scalars().all()
      tally: dict[str, int] = {}
      for m in matches:
          tally[m.home_team] = tally.get(m.home_team, 0) + (m.home_red_cards or 0)
          tally[m.away_team] = tally.get(m.away_team, 0) + (m.away_red_cards or 0)
      ranked = sorted(tally.items(), key=lambda x: x[1], reverse=True)
      return [{"team": team, "red_cards": count, "rank": i + 1}
              for i, (team, count) in enumerate(ranked)]
  ```

- [ ] **Run all backend tests:**
  ```bash
  ./venv/bin/pytest -x -q
  ```
  Expected: all pass.

- [ ] **Commit:**
  ```bash
  git add backend/app/routers/leaderboard.py backend/tests/test_leagues.py
  git commit -m "feat: leaderboard filtered to player's league"
  ```

---

## Task 5 — Challenge scoping

**Files:**
- Modify: `backend/app/routers/matches.py`
- Modify: `backend/app/routers/challenges.py`
- Modify: `backend/tests/test_leagues.py`

Open challenges shown on a match detail page must be limited to the viewer's league. Cross-league challenge acceptance must be rejected.

- [ ] **Add two tests to `backend/tests/test_leagues.py`:**

  ```python
  async def test_open_challenges_scoped_to_league(client, db):
      """A player must not see open challenges issued by a different league."""
      from tests.conftest import make_match
      headers = await _admin_headers(client)
      await client.post("/api/leagues",
                        json={"name": "Office", "invite_code": "office26"},
                        headers=headers)

      m = await make_match(db)
      alice = await join_player(client, "Alice", "friends2026")
      bob_resp = await client.post("/api/auth/join",
                                   json={"name": "Bob", "code": "office26"})
      bob_token = bob_resp.json()["token"]

      # Bob issues a challenge in the office league
      await client.post(f"/api/matches/{m.id}/challenges",
                        json={"bet_type": "1x2", "selection": "Argentina",
                              "acceptor_selection": "Away",
                              "issuer_stake": 100, "issuer_odds": 2.0,
                              "acceptor_odds": 2.0},
                        headers={"Authorization": f"Bearer {bob_token}"})

      # Alice fetches the match — should see no open challenges
      resp = await client.get(f"/api/matches/{m.id}",
                              headers={"Authorization": f"Bearer {alice['token']}"})
      assert resp.status_code == 200
      assert resp.json()["open_challenges"] == []


  async def test_cannot_accept_cross_league_challenge(client, db):
      """Accepting a challenge from a different league must return 403."""
      from tests.conftest import make_match
      headers = await _admin_headers(client)
      await client.post("/api/leagues",
                        json={"name": "Office", "invite_code": "office26"},
                        headers=headers)

      m = await make_match(db)
      alice = await join_player(client, "Alice", "friends2026")
      bob_resp = await client.post("/api/auth/join",
                                   json={"name": "Bob", "code": "office26"})
      bob_token = bob_resp.json()["token"]

      # Alice issues a challenge
      ch_resp = await client.post(
          f"/api/matches/{m.id}/challenges",
          json={"bet_type": "1x2", "selection": "Argentina",
                "acceptor_selection": "Away",
                "issuer_stake": 100, "issuer_odds": 2.0, "acceptor_odds": 2.0},
          headers={"Authorization": f"Bearer {alice['token']}"}
      )
      ch_id = ch_resp.json()["id"]

      # Bob (different league) tries to accept — must fail
      resp = await client.post(f"/api/challenges/{ch_id}/accept",
                               headers={"Authorization": f"Bearer {bob_token}"})
      assert resp.status_code == 403
  ```

- [ ] **Run new tests — confirm they fail:**
  ```bash
  ./venv/bin/pytest tests/test_leagues.py::test_open_challenges_scoped_to_league tests/test_leagues.py::test_cannot_accept_cross_league_challenge -x -q
  ```
  Expected: FAIL.

- [ ] **Update `GET /api/matches/{match_id}` in `backend/app/routers/matches.py` to filter open challenges by league:**

  Find the section that fetches `open_challenges` (currently near the bottom of `get_match`):
  ```python
  result = await db.execute(
      select(Challenge).where(Challenge.match_id == match_id, Challenge.status == "open")
  )
  open_challenges = result.scalars().all()
  ```

  Replace with:
  ```python
  current_player, _ = auth
  if current_player.league_id is not None:
      league_player_ids = (await db.execute(
          select(Player.id).where(Player.league_id == current_player.league_id)
      )).scalars().all()
      ch_query = select(Challenge).where(
          Challenge.match_id == match_id,
          Challenge.status == "open",
          Challenge.issuer_id.in_(league_player_ids),
      )
  else:
      ch_query = select(Challenge).where(
          Challenge.match_id == match_id, Challenge.status == "open"
      )
  open_challenges = (await db.execute(ch_query)).scalars().all()
  ```

  Also add `Player` to the imports at the top of `matches.py`:
  ```python
  from app.models import Match, Challenge, Player
  ```

- [ ] **Update `POST /api/challenges/{challenge_id}/accept` in `backend/app/routers/challenges.py` to block cross-league accepts:**

  Find the block that starts `if challenge.issuer_id == player.id:` and add a league check right after it:
  ```python
  if challenge.issuer_id == player.id:
      raise HTTPException(400, "cannot accept your own challenge")

  # Enforce same-league rule
  issuer = await db.get(Player, challenge.issuer_id)
  if issuer.league_id != player.league_id:
      raise HTTPException(403, "challenge belongs to a different league")
  ```

- [ ] **Run all backend tests:**
  ```bash
  ./venv/bin/pytest -x -q
  ```
  Expected: all pass.

- [ ] **Commit:**
  ```bash
  git add backend/app/routers/matches.py backend/app/routers/challenges.py backend/tests/test_leagues.py
  git commit -m "feat: open challenges and accepts scoped to player's league"
  ```

---

## Task 6 — Migration script for existing deployments

**Files:**
- Create: `backend/scripts/create_league.py`

Existing deployments have players with `league_id = NULL`. This script creates a league and (optionally) assigns existing null-league players to it.

- [ ] **Create `backend/scripts/create_league.py`:**

  ```python
  #!/usr/bin/env python
  """
  One-shot migration for existing deployments.

  Creates a league from a name + invite code and optionally assigns
  all players with league_id=NULL to it.

  Usage:
      cd backend
      ./venv/bin/python scripts/create_league.py "Family League" family2026 --adopt-existing
  """
  import asyncio
  import sys
  import os

  sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

  from sqlalchemy import select, update
  from app.config import settings
  from app.database import init_db, AsyncSessionLocal, Base, engine
  from app.models import League, Player


  async def main(name: str, code: str, adopt: bool):
      init_db(settings.database_url)
      async with engine.begin() as conn:
          await conn.run_sync(Base.metadata.create_all)

      async with AsyncSessionLocal() as db:
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
      if len(sys.argv) < 3:
          print("Usage: create_league.py <name> <invite_code> [--adopt-existing]")
          sys.exit(1)
      adopt = "--adopt-existing" in sys.argv
      asyncio.run(main(sys.argv[1], sys.argv[2], adopt))
  ```

- [ ] **Smoke-test the script against the local dev DB:**
  ```bash
  cd /Users/hernanrosenblum/Documents/worldcup-betting-v2/backend
  ./venv/bin/python scripts/create_league.py "Dev League" devcode --adopt-existing
  ```
  Expected output: `Created league: id=1 name='Dev League' code='devcode'` (or "already exists" if run twice).

- [ ] **Commit:**
  ```bash
  git add backend/scripts/create_league.py
  git commit -m "chore: add create_league migration script for existing deployments"
  ```

---

## Task 7 — Frontend: show league name on join

**Files:**
- Modify: `frontend/src/pages/JoinPage.jsx`

The join API now returns `{ token, player, league }`. Show the league name in the success state and update the error copy for invalid codes.

- [ ] **Read `frontend/src/pages/JoinPage.jsx` to understand the current success/error flow.**

- [ ] **In the `join()` handler, store league name from the response:**

  Find where the join response is handled. It will look like:
  ```js
  const data = await api.post("/api/auth/join", { name, code })
  login(data.token, data.player)
  navigate("/")
  ```

  Add a league name display — store it in state and show it briefly before navigating, or just pass it through. The simplest change: show a `"Welcome to {league.name}!"` message for 1.5 seconds before redirect.

  Replace the join handler's success block with:
  ```js
  const data = await api.post("/api/auth/join", { name, code })
  login(data.token, data.player)
  if (data.league) {
    setMsg(`✓ Welcome to ${data.league.name}!`)
    setTimeout(() => navigate("/"), 1200)
  } else {
    navigate("/")
  }
  ```

- [ ] **Update the error message copy** so players understand the code refers to a league:

  Find the error display and ensure the placeholder / helper text reads:
  ```
  "Enter the invite code from your group"
  ```
  instead of any generic "invite code" text.

- [ ] **Run frontend tests:**
  ```bash
  cd /Users/hernanrosenblum/Documents/worldcup-betting-v2/frontend
  npm test -- --run
  ```
  Expected: all pass.

- [ ] **Commit:**
  ```bash
  git add frontend/src/pages/JoinPage.jsx
  git commit -m "feat: show league name on successful join"
  ```

---

## Task 8 — Final verification

- [ ] **Run full backend suite:**
  ```bash
  cd /Users/hernanrosenblum/Documents/worldcup-betting-v2/backend
  ./venv/bin/pytest -x -q
  ```
  Expected: all pass.

- [ ] **Run frontend tests:**
  ```bash
  cd /Users/hernanrosenblum/Documents/worldcup-betting-v2/frontend
  npm test -- --run
  ```
  Expected: all pass.

- [ ] **Manual end-to-end smoke test:**

  1. Start the backend: `./venv/bin/uvicorn app.main:app --reload`
  2. Run the create_league script to create two leagues:
     ```bash
     ./venv/bin/python scripts/create_league.py "Family" family26
     ./venv/bin/python scripts/create_league.py "Office" office26
     ```
  3. Open the app, join as "Alice" with code `family26` — see "Welcome to Family!"
  4. Open an incognito window, join as "Bob" with code `office26`
  5. Alice's leaderboard: shows only Alice. Bob's: shows only Bob. ✓
  6. Alice issues a challenge on a match. Bob cannot see it in open challenges. ✓
  7. Entering a bad code shows a 403 error. ✓

- [ ] **Push:**
  ```bash
  git push
  ```

---

## Deployment checklist (Railway / production)

1. Push the branch and merge to main.
2. Railway redeploys automatically — `create_tables()` adds the `leagues` table on startup.
3. Run the migration script once to create your first league and adopt existing players:
   ```bash
   railway run python scripts/create_league.py "My Group" yourcode --adopt-existing
   ```
4. For each additional group, run without `--adopt-existing`:
   ```bash
   railway run python scripts/create_league.py "Office 2026" office26
   ```
5. Share each group's invite code with the right people. Done.

---

## Self-Review

**Spec coverage:**
- ✅ League model with invite code
- ✅ Admin creates leagues via API
- ✅ Players join by league code
- ✅ Leaderboard scoped to league
- ✅ Open challenges scoped to league
- ✅ Cross-league accept blocked
- ✅ Same name allowed in different leagues
- ✅ Migration script for existing deployments
- ✅ Frontend shows league name on join

**Placeholder scan:** None found. All code blocks are complete.

**Type consistency:**
- `league.id` used consistently as `league_id` FK in Player ✓
- `player.league_id` accessed in leaderboard, matches, challenges routers ✓
- Join response `league: {id, name}` matches frontend read `data.league.name` ✓
- `make_league` helper in conftest returns a `League` ORM object ✓
