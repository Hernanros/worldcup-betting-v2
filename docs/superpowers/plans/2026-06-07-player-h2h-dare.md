# Player H2H Dare Type — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Player H2H" dare type where two users bet on which named player wins a stat duel (goals or assists) in a match, auto-settled from API-Football fixture events.

**Architecture:** New `player_h2h` dare type flows through the existing Challenge pipeline unchanged — issuer/acceptor, stake/odds, streak bonuses all work identically. The only new piece is a `player_stats_cache` JSON column on `Match` (populated at settle-time from API-Football events already fetched) and a `determine_player_h2h_winner()` pure function that reads it. Ties and missing data void the challenge (full refund to both players).

**Tech Stack:** Python 3.13 / FastAPI / SQLAlchemy async / SQLite (test) + PostgreSQL (prod) / React JSX / pytest-asyncio

---

## File Map

| File | Change |
|---|---|
| `backend/app/models.py` | Add `player_stats_cache = Column(Text, nullable=True)` to `Match` |
| `backend/scripts/migrate_add_player_stats_cache.py` | New: one-time migration script |
| `backend/app/settlement.py` | Add `_normalize_name()`, `_find_player_in_cache()`, `determine_player_h2h_winner()` |
| `backend/app/results_client.py` | Extend `fetch_api_football_events()` to collect per-player goals + assists |
| `backend/app/poller.py` | Store player stats in `_enrich_match_stats()`; add void branch in `_settle_challenges()` |
| `backend/app/routers/leagues.py` | Add `POST /api/admin/matches/{id}/player-stats` endpoint |
| `backend/tests/test_settlement.py` | Tests for the three new settlement functions |
| `backend/tests/test_results_client.py` | New: tests for extended `fetch_api_football_events()` |
| `backend/tests/test_settle_match.py` | Integration tests: player stats stored, void settlement, issuer/acceptor win |
| `backend/tests/test_admin_player_stats.py` | New: tests for the admin override endpoint |
| `frontend/src/pages/AdminPage.jsx` | Add Player Stats Override section |
| `frontend/src/components/ChallengePanel.jsx` | Add `STAR_PLAYERS`, `player_h2h` dare type, `PlayerH2HPicker` component |

---

## Task 1: Add `player_stats_cache` to the Match model

**Files:**
- Modify: `backend/app/models.py`
- Create: `backend/scripts/migrate_add_player_stats_cache.py`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_settle_match.py` (import section already has `from app.models import Player, Match, ...`):

```python
async def test_match_has_player_stats_cache_column(db):
    """Match model exposes the player_stats_cache column."""
    m = await make_match(db)
    assert hasattr(m, "player_stats_cache")
    assert m.player_stats_cache is None
```

- [ ] **Step 2: Run the test — confirm it fails**

```bash
cd backend
source venv/bin/activate
pytest tests/test_settle_match.py::test_match_has_player_stats_cache_column -v
```

Expected: `FAILED` — `AttributeError` or assertion error.

- [ ] **Step 3: Add the column to `backend/app/models.py`**

In the `Match` class, after the last existing column (`went_to_pens`):

```python
    player_stats_cache = Column(Text, nullable=True)
```

The full column block at the bottom of `Match` now ends with:
```python
    went_to_et         = Column(Boolean, nullable=False, default=False)
    went_to_pens       = Column(Boolean, nullable=False, default=False)
    player_stats_cache = Column(Text, nullable=True)
```

- [ ] **Step 4: Run the test — confirm it passes**

```bash
pytest tests/test_settle_match.py::test_match_has_player_stats_cache_column -v
```

Expected: `PASSED`.

- [ ] **Step 5: Create the migration script**

Create `backend/scripts/migrate_add_player_stats_cache.py`:

```python
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
            err = str(e).lower()
            if "already exists" in err or "duplicate column" in err:
                print("  ✓ column already exists — skipping")
            else:
                print(f"  ✗ Error: {e}")
                raise

    await engine.dispose()
    print("✅  Migration complete.")


if __name__ == "__main__":
    asyncio.run(run())
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/models.py backend/scripts/migrate_add_player_stats_cache.py \
        backend/tests/test_settle_match.py
git commit -m "feat: add player_stats_cache column to Match model"
```

---

## Task 2: Settlement pure functions — normalize, find, determine

**Files:**
- Modify: `backend/app/settlement.py`
- Modify: `backend/tests/test_settlement.py`

- [ ] **Step 1: Write failing tests for `_normalize_name`**

Append to `backend/tests/test_settlement.py`:

```python
from app.settlement import _normalize_name, _find_player_in_cache, determine_player_h2h_winner


def test_normalize_strips_accents_and_lowercases():
    assert _normalize_name("Mbappé") == "mbappe"
    assert _normalize_name("L. Messi") == "l. messi"
    assert _normalize_name("Di María") == "di maria"
    assert _normalize_name("  KANE  ") == "kane"


def test_find_player_exact_match():
    cache = {"messi": {"goals": 2, "assists": 0}}
    assert _find_player_in_cache("Messi", cache) == {"goals": 2, "assists": 0}


def test_find_player_abbreviated_api_name():
    # API-Football returns "L. Messi"; chip stores "Messi"
    cache = {"l. messi": {"goals": 2, "assists": 0}}
    assert _find_player_in_cache("Messi", cache) == {"goals": 2, "assists": 0}


def test_find_player_not_found_returns_none():
    cache = {"neymar": {"goals": 1, "assists": 0}}
    assert _find_player_in_cache("Messi", cache) is None


def test_determine_h2h_issuer_wins_on_goals():
    cache_json = '{"messi": {"goals": 2, "assists": 0}, "mbappe": {"goals": 0, "assists": 1}}'
    assert determine_player_h2h_winner("Messi goals", "Mbappé goals", cache_json) == "issuer"


def test_determine_h2h_acceptor_wins_on_goals():
    cache_json = '{"messi": {"goals": 0, "assists": 0}, "mbappe": {"goals": 1, "assists": 0}}'
    assert determine_player_h2h_winner("Messi goals", "Mbappé goals", cache_json) == "acceptor"


def test_determine_h2h_tie_returns_void():
    cache_json = '{"messi": {"goals": 1, "assists": 0}, "mbappe": {"goals": 1, "assists": 0}}'
    assert determine_player_h2h_winner("Messi goals", "Mbappé goals", cache_json) == "void"


def test_determine_h2h_null_cache_returns_void():
    assert determine_player_h2h_winner("Messi goals", "Mbappé goals", None) == "void"


def test_determine_h2h_missing_player_returns_void():
    cache_json = '{"messi": {"goals": 1, "assists": 0}}'  # mbappé missing
    assert determine_player_h2h_winner("Messi goals", "Mbappé goals", cache_json) == "void"


def test_determine_h2h_assists_stat():
    cache_json = '{"messi": {"goals": 0, "assists": 2}, "mbappe": {"goals": 1, "assists": 0}}'
    assert determine_player_h2h_winner("Messi assists", "Mbappé assists", cache_json) == "issuer"


def test_determine_h2h_abbreviated_api_name_in_cache():
    # API-Football gave us "l. messi" as the key; chip stored "Messi"
    cache_json = '{"l. messi": {"goals": 3, "assists": 0}, "k. mbappe": {"goals": 1, "assists": 0}}'
    assert determine_player_h2h_winner("Messi goals", "Mbappé goals", cache_json) == "issuer"
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
pytest tests/test_settlement.py -k "normalize or find_player or determine_h2h" -v
```

Expected: `ImportError` or `AttributeError` — functions don't exist yet.

- [ ] **Step 3: Add functions to `backend/app/settlement.py`**

Add these imports at the top of `settlement.py` (after the existing `from app.bravery import apply_streak_bonus`):

```python
import json
import unicodedata
```

Add these functions at the bottom of `settlement.py`:

```python
# ── Player H2H helpers ────────────────────────────────────────────────────────

def _normalize_name(name: str) -> str:
    """Lowercase + strip accents: 'L. Mbappé' → 'l. mbappe'."""
    nfd = unicodedata.normalize("NFKD", name)
    return "".join(c for c in nfd if not unicodedata.combining(c)).lower().strip()


def _find_player_in_cache(name: str, cache: dict) -> dict | None:
    """Return the stat dict for `name` from `cache`, or None if not found.

    Tries exact normalised match first, then substring containment to handle
    API-Football abbreviations like 'L. Messi' when the chip stored 'Messi'.
    """
    norm = _normalize_name(name)
    if norm in cache:
        return cache[norm]
    for key in cache:
        if norm in key or key in norm:
            return cache[key]
    return None


def determine_player_h2h_winner(
    issuer_sel: str,
    acceptor_sel: str,
    player_stats_cache: str | None,
) -> str:
    """Determine who wins a player H2H dare.

    issuer_sel / acceptor_sel format: "{player_name} {stat}"
    where stat is "goals" or "assists".

    Returns:
        "issuer"   — issuer's player has more of the stat
        "acceptor" — acceptor's player has more
        "void"     — tie, missing cache, player not found, or parse failure
    """
    try:
        issuer_parts = issuer_sel.rsplit(" ", 1)
        acceptor_parts = acceptor_sel.rsplit(" ", 1)
        if len(issuer_parts) != 2 or len(acceptor_parts) != 2:
            return "void"
        issuer_player, issuer_stat = issuer_parts
        acceptor_player, acceptor_stat = acceptor_parts
        if issuer_stat.lower() != acceptor_stat.lower():
            return "void"
        stat = issuer_stat.lower()
        if stat not in ("goals", "assists"):
            return "void"

        if player_stats_cache is None:
            return "void"

        cache = json.loads(player_stats_cache)
        issuer_entry = _find_player_in_cache(issuer_player, cache)
        acceptor_entry = _find_player_in_cache(acceptor_player, cache)

        if issuer_entry is None or acceptor_entry is None:
            return "void"

        issuer_count = issuer_entry.get(stat, 0)
        acceptor_count = acceptor_entry.get(stat, 0)

        if issuer_count > acceptor_count:
            return "issuer"
        if acceptor_count > issuer_count:
            return "acceptor"
        return "void"
    except (json.JSONDecodeError, TypeError, AttributeError):
        return "void"
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
pytest tests/test_settlement.py -v
```

Expected: all tests pass, including the 11 new ones.

- [ ] **Step 5: Commit**

```bash
git add backend/app/settlement.py backend/tests/test_settlement.py
git commit -m "feat: add determine_player_h2h_winner + name normalization helpers"
```

---

## Task 3: Extend `fetch_api_football_events()` to collect per-player stats

**Files:**
- Modify: `backend/app/results_client.py`
- Create: `backend/tests/test_results_client.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_results_client.py`:

```python
"""Tests for results_client — per-player stats extraction."""
from unittest.mock import patch, MagicMock
from app.results_client import fetch_api_football_events


def _make_response(events: list) -> MagicMock:
    mock = MagicMock()
    mock.raise_for_status.return_value = None
    mock.json.return_value = {"response": events}
    return mock


def _goal(player_name: str, assist_name: str | None = None, detail: str = "Normal Goal") -> dict:
    return {
        "type": "Goal",
        "detail": detail,
        "player": {"name": player_name},
        "assist": {"name": assist_name} if assist_name else None,
        "team": {"name": "Argentina"},
        "time": {"elapsed": 10},
    }


def _sub(player_name: str, team: str, minute: int) -> dict:
    return {
        "type": "subst",
        "player": {"name": player_name},
        "team": {"name": team},
        "time": {"elapsed": minute},
    }


def test_player_stats_goals_counted():
    events = [_goal("L. Messi"), _goal("L. Messi"), _goal("K. Mbappe")]
    with patch("app.results_client.requests.get", return_value=_make_response(events)):
        result = fetch_api_football_events(fixture_id=99, api_key="test-key")
    assert result["player_stats"]["l. messi"]["goals"] == 2
    assert result["player_stats"]["k. mbappe"]["goals"] == 1


def test_player_stats_assists_counted():
    events = [_goal("L. Messi", assist_name="Di Maria")]
    with patch("app.results_client.requests.get", return_value=_make_response(events)):
        result = fetch_api_football_events(fixture_id=99, api_key="test-key")
    assert result["player_stats"]["l. messi"]["goals"] == 1
    assert result["player_stats"]["di maria"]["assists"] == 1
    assert result["player_stats"]["di maria"]["goals"] == 0


def test_own_goals_excluded_from_player_stats():
    events = [_goal("L. Messi", detail="Own Goal")]
    with patch("app.results_client.requests.get", return_value=_make_response(events)):
        result = fetch_api_football_events(fixture_id=99, api_key="test-key")
    assert result["player_stats"] == {}
    assert result["home_own_goals"] == 1


def test_unassisted_goal_no_assist_entry():
    events = [_goal("L. Messi", assist_name=None)]
    with patch("app.results_client.requests.get", return_value=_make_response(events)):
        result = fetch_api_football_events(fixture_id=99, api_key="test-key")
    assert result["player_stats"]["l. messi"]["assists"] == 0


def test_player_stats_empty_when_no_fixture_id():
    result = fetch_api_football_events(fixture_id=None, api_key="test-key")
    assert result["player_stats"] == {}


def test_existing_sub_goals_still_computed():
    events = [
        _sub("L. Messi", "Argentina", 60),
        _goal("L. Messi"),   # Messi subbed on at 60', goal event at minute 10 (bad data but tests logic)
    ]
    with patch("app.results_client.requests.get", return_value=_make_response(events)):
        result = fetch_api_football_events(fixture_id=99, api_key="test-key")
    # sub_goals still works (existing behaviour preserved)
    assert "sub_goals" in result
    assert "player_stats" in result
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
pytest tests/test_results_client.py -v
```

Expected: `KeyError: 'player_stats'` — the key doesn't exist in the return dict yet.

- [ ] **Step 3: Extend `fetch_api_football_events()` in `backend/app/results_client.py`**

Add this import at the top of `results_client.py`:

```python
from app.settlement import _normalize_name
```

Replace the entire `fetch_api_football_events` function:

```python
def fetch_api_football_events(fixture_id: int, api_key: str) -> dict:
    """
    Fetch goal + substitution events from API-Football for a completed match.
    Returns own goal counts, sub_goals count, and per-player goals/assists.
    Falls back to zeros/empty on any error.
    """
    base = {"home_own_goals": 0, "away_own_goals": 0, "sub_goals": 0, "player_stats": {}}
    if not fixture_id or not api_key:
        return base
    try:
        resp = requests.get(
            "https://v3.football.api-sports.io/fixtures/events",
            params={"fixture": fixture_id},
            headers={"x-apisports-key": api_key},
            timeout=10,
        )
        resp.raise_for_status()
        events = resp.json().get("response", [])
        base["sub_goals"] = compute_sub_goals(events)

        # Own goals
        total_og = sum(
            1 for e in events
            if e.get("type") == "Goal" and e.get("detail") == "Own Goal"
        )
        base["home_own_goals"] = total_og
        base["away_own_goals"] = 0

        # Per-player goals and assists (excludes own goals)
        player_stats: dict[str, dict] = {}
        for e in events:
            if e.get("type") != "Goal" or e.get("detail") == "Own Goal":
                continue
            scorer_name = (e.get("player") or {}).get("name", "")
            if scorer_name:
                key = _normalize_name(scorer_name)
                if key not in player_stats:
                    player_stats[key] = {"goals": 0, "assists": 0}
                player_stats[key]["goals"] += 1
            assist_name = (e.get("assist") or {}).get("name", "")
            if assist_name:
                key = _normalize_name(assist_name)
                if key not in player_stats:
                    player_stats[key] = {"goals": 0, "assists": 0}
                player_stats[key]["assists"] += 1
        base["player_stats"] = player_stats

    except Exception as e:
        logger.warning("API-Football events fetch failed for fixture %s: %s", fixture_id, e)
    return base
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
pytest tests/test_results_client.py -v
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/results_client.py backend/tests/test_results_client.py
git commit -m "feat: collect per-player goals and assists in fetch_api_football_events"
```

---

## Task 4: Store player stats in `_enrich_match_stats()`

**Files:**
- Modify: `backend/app/poller.py`
- Modify: `backend/tests/test_settle_match.py`

- [ ] **Step 1: Write the failing integration test**

Append to `backend/tests/test_settle_match.py`:

```python
import json as json_lib
from unittest.mock import patch


async def test_enrich_stores_player_stats_cache(db):
    """When api_fixture_id is set, settle_match populates player_stats_cache."""
    m = await make_match(db)
    m.api_fixture_id = 12345
    await db.commit()

    fake_af = {
        "home_own_goals": 0, "away_own_goals": 0, "sub_goals": 0,
        "player_stats": {
            "l. messi": {"goals": 2, "assists": 0},
            "di maria":  {"goals": 0, "assists": 1},
        }
    }
    with patch("app.poller.fetch_api_football_events", return_value=fake_af), \
         patch("app.poller.fetch_espn_match_stats", return_value={}), \
         patch("app.poller.fetch_espn_event_id_from_scoreboard", return_value=None):
        await settle_match(db, m, _result(2, 0))

    await db.refresh(m)
    assert m.player_stats_cache is not None
    cache = json_lib.loads(m.player_stats_cache)
    assert cache["l. messi"]["goals"] == 2
    assert cache["di maria"]["assists"] == 1
```

- [ ] **Step 2: Run the test — confirm it fails**

```bash
pytest tests/test_settle_match.py::test_enrich_stores_player_stats_cache -v
```

Expected: `FAILED` — `player_stats_cache` is `None` after settlement.

- [ ] **Step 3: Update `_enrich_match_stats()` in `backend/app/poller.py`**

Add `import json` to the imports at the top of `poller.py`. The current imports start with:
```python
import logging
from sqlalchemy import select
```

Change to:
```python
import json
import logging
from sqlalchemy import select
```

Replace the `if match.api_fixture_id:` block inside `_enrich_match_stats`:

```python
        if match.api_fixture_id:
            from app.config import settings
            af_stats = fetch_api_football_events(
                match.api_fixture_id,
                settings.football_api_key,
            )
            for key, val in af_stats.items():
                if key == "player_stats":
                    match.player_stats_cache = json.dumps(val)
                else:
                    setattr(match, key, val)
```

(Only change is the `if key == "player_stats"` branch; the rest of `_enrich_match_stats` is unchanged.)

- [ ] **Step 4: Run the test — confirm it passes**

```bash
pytest tests/test_settle_match.py::test_enrich_stores_player_stats_cache -v
```

Expected: `PASSED`.

- [ ] **Step 5: Run full test suite to check no regressions**

```bash
pytest tests/ -q
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/app/poller.py backend/tests/test_settle_match.py
git commit -m "feat: store player_stats_cache from API-Football events at settlement"
```

---

## Task 5: Void branch in `_settle_challenges()` for `player_h2h`

**Files:**
- Modify: `backend/app/poller.py`
- Modify: `backend/tests/test_settle_match.py`

- [ ] **Step 1: Write failing tests**

Append to `backend/tests/test_settle_match.py`. The existing `_challenge()` helper already handles creating accepted challenges — use it directly:

```python
async def test_player_h2h_voids_when_no_cache(db):
    """player_h2h challenge with no player_stats_cache → both refunded, status=voided."""
    m = await make_match(db)  # no api_fixture_id → cache stays NULL
    alice = await make_player(db, "Alice")
    bob   = await make_player(db, "Bob")
    await _challenge(db, alice, bob, m, "player_h2h", "Messi goals", "Mbappé goals",
                     istake=100, iodds=2.0, aodds=2.0)
    # stakes deducted: alice=900, bob=900
    await settle_match(db, m, _result(2, 1))
    await db.refresh(alice); await db.refresh(bob)
    assert alice.token_balance == 1000  # refunded
    assert bob.token_balance == 1000    # refunded
    # verify challenge status
    from sqlalchemy import select
    from app.models import Challenge
    ch = (await db.execute(select(Challenge).where(Challenge.match_id == m.id))).scalar_one()
    assert ch.status == "voided"


async def test_player_h2h_issuer_wins(db):
    """Issuer's player scores more goals → issuer receives payout."""
    m = await make_match(db)
    m.player_stats_cache = json_lib.dumps({
        "messi":  {"goals": 2, "assists": 0},
        "mbappe": {"goals": 0, "assists": 0},
    })
    await db.commit()
    alice = await make_player(db, "Alice", balance=1000)
    bob   = await make_player(db, "Bob",   balance=1000)
    await _challenge(db, alice, bob, m, "player_h2h", "Messi goals", "Mbappé goals",
                     istake=100, iodds=2.0, aodds=2.0)
    # alice=900, bob=900 after deduction
    await settle_match(db, m, _result(2, 0))
    await db.refresh(alice); await db.refresh(bob)
    assert alice.token_balance == 1100  # 900 + 200 payout (100 × 2.0)
    assert bob.token_balance   == 900   # lost — no payout


async def test_player_h2h_acceptor_wins(db):
    """Acceptor's player scores more goals → acceptor receives payout."""
    m = await make_match(db)
    m.player_stats_cache = json_lib.dumps({
        "messi":  {"goals": 0, "assists": 0},
        "mbappe": {"goals": 1, "assists": 0},
    })
    await db.commit()
    alice = await make_player(db, "Alice", balance=1000)
    bob   = await make_player(db, "Bob",   balance=1000)
    await _challenge(db, alice, bob, m, "player_h2h", "Messi goals", "Mbappé goals",
                     istake=100, iodds=2.0, aodds=2.0)
    await settle_match(db, m, _result(0, 1))
    await db.refresh(alice); await db.refresh(bob)
    assert alice.token_balance == 900   # lost
    assert bob.token_balance   == 1100  # 900 + 200


async def test_player_h2h_tie_voids(db):
    """Both players score equal goals → void, full refund."""
    m = await make_match(db)
    m.player_stats_cache = json_lib.dumps({
        "messi":  {"goals": 1, "assists": 0},
        "mbappe": {"goals": 1, "assists": 0},
    })
    await db.commit()
    alice = await make_player(db, "Alice", balance=1000)
    bob   = await make_player(db, "Bob",   balance=1000)
    await _challenge(db, alice, bob, m, "player_h2h", "Messi goals", "Mbappé goals")
    await settle_match(db, m, _result(1, 1))
    await db.refresh(alice); await db.refresh(bob)
    assert alice.token_balance == 1000
    assert bob.token_balance   == 1000
    from sqlalchemy import select as sa_select
    from app.models import Challenge as Chal
    ch = (await db.execute(sa_select(Chal).where(Chal.match_id == m.id))).scalar_one()
    assert ch.status == "voided"
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
pytest tests/test_settle_match.py -k "player_h2h" -v
```

Expected: all four fail — `player_h2h` is treated as an unknown bet type, challenge status stays `accepted`.

- [ ] **Step 3: Add the void branch to `_settle_challenges()` in `backend/app/poller.py`**

First, update the import at the top of `poller.py`. Find:

```python
from app.settlement import (
    settle_bet, settle_challenge_issuer, settle_challenge_acceptor,
    determine_h2h_winner, determine_correct_score_winner,
    determine_totals_winner, determine_btts_winner, determine_handicap_winner,
)
```

Replace with:

```python
from app.settlement import (
    settle_bet, settle_challenge_issuer, settle_challenge_acceptor,
    determine_h2h_winner, determine_correct_score_winner,
    determine_totals_winner, determine_btts_winner, determine_handicap_winner,
    determine_player_h2h_winner,
)
```

Then, inside `_settle_challenges()`, replace:

```python
    for ch in challenges:
        issuer_won = _evaluate_bet(ch.bet_type, ch.selection, match, result)
        issuer   = await db.get(Player, ch.issuer_id)
        acceptor = await db.get(Player, ch.acceptor_id)
```

With:

```python
    for ch in challenges:
        if ch.bet_type == "player_h2h":
            winner = determine_player_h2h_winner(
                ch.selection, ch.acceptor_selection, match.player_stats_cache
            )
            if winner == "void":
                issuer   = await db.get(Player, ch.issuer_id)
                acceptor = await db.get(Player, ch.acceptor_id)
                issuer.token_balance   += ch.issuer_stake
                acceptor.token_balance += ch.acceptor_stake
                ch.status = "voided"
                continue
            issuer_won = (winner == "issuer")
        else:
            issuer_won = _evaluate_bet(ch.bet_type, ch.selection, match, result)
        issuer   = await db.get(Player, ch.issuer_id)
        acceptor = await db.get(Player, ch.acceptor_id)
```

(The rest of the `_settle_challenges` for-loop body is unchanged — streak, payout, acceptor settlement all apply normally.)

- [ ] **Step 4: Run tests — confirm they pass**

```bash
pytest tests/test_settle_match.py -k "player_h2h" -v
```

Expected: all four tests pass.

- [ ] **Step 5: Run full test suite**

```bash
pytest tests/ -q
```

Expected: all tests pass, no regressions.

- [ ] **Step 6: Commit**

```bash
git add backend/app/poller.py backend/tests/test_settle_match.py
git commit -m "feat: settle player_h2h challenges — void on tie/missing cache, payout on winner"
```

---

## Task 6: Admin endpoint `POST /api/admin/matches/{id}/player-stats`

**Files:**
- Modify: `backend/app/routers/leagues.py`
- Create: `backend/tests/test_admin_player_stats.py`

> **Re-settlement note:** When admin overrides stats on a match that already voided a challenge (refunding both players), re-settlement pays only the **net gain** (payout − stake) to the winner. The loser keeps their voided refund. This avoids attempting to claw back tokens that may have been spent.

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_admin_player_stats.py`:

```python
"""Tests for POST /api/admin/matches/{id}/player-stats."""
import json as json_lib
from tests.conftest import make_match, make_player


async def _admin_headers(client):
    resp = await client.post("/api/auth/join", json={"name": "Admin", "code": "admin"})
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['token']}"}


async def test_set_player_stats_requires_admin(client, db):
    from tests.conftest import join_player
    m = await make_match(db, status="finished")
    alice = await join_player(client, "Alice")
    resp = await client.post(
        f"/api/admin/matches/{m.id}/player-stats",
        json={"player_stats": {"messi": {"goals": 1, "assists": 0}}},
        headers={"Authorization": f"Bearer {alice['token']}"},
    )
    assert resp.status_code == 403


async def test_set_player_stats_stores_normalised_cache(client, db):
    m = await make_match(db, status="finished")
    headers = await _admin_headers(client)
    resp = await client.post(
        f"/api/admin/matches/{m.id}/player-stats",
        json={"player_stats": {"Mbappé": {"goals": 2, "assists": 1}}},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["updated"] is True
    # keys should be normalized
    from app.models import Match
    m_db = await db.get(Match, m.id)
    await db.refresh(m_db)
    cache = json_lib.loads(m_db.player_stats_cache)
    assert "mbappe" in cache      # accent stripped, lowercased
    assert cache["mbappe"]["goals"] == 2


async def test_set_player_stats_resettles_voided_challenges(client, db):
    """Admin overrides stats → voided player_h2h challenge is re-settled to resolved."""
    from app.models import Challenge, Player
    from sqlalchemy import select

    m = await make_match(db, status="finished")
    alice = await make_player(db, "Alice2", balance=1000)
    bob   = await make_player(db, "Bob2",   balance=1000)

    # Simulate a voided challenge (both already refunded)
    ch = Challenge(
        issuer_id=alice.id, acceptor_id=bob.id, match_id=m.id,
        bet_type="player_h2h",
        selection="Messi goals", acceptor_selection="Mbappé goals",
        issuer_stake=100, acceptor_stake=100,
        issuer_odds=2.0, acceptor_odds=2.0,
        status="voided", bravery_streak_bonus_pct=0.0,
    )
    db.add(ch)
    alice.token_balance = 1000  # already refunded in void
    bob.token_balance   = 1000  # already refunded in void
    await db.commit()

    headers = await _admin_headers(client)
    resp = await client.post(
        f"/api/admin/matches/{m.id}/player-stats",
        json={"player_stats": {
            "messi":  {"goals": 2, "assists": 0},
            "mbappe": {"goals": 0, "assists": 0},
        }},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["resettled"] == 1

    await db.refresh(ch); await db.refresh(alice); await db.refresh(bob)
    assert ch.status == "resolved"
    # Alice (issuer) gets net gain: payout(200) - stake(100) = 100 extra
    assert alice.token_balance == 1100
    # Bob (acceptor) keeps their void refund, streak is reset
    assert bob.token_balance == 1000


async def test_set_player_stats_404_on_unknown_match(client, db):
    headers = await _admin_headers(client)
    resp = await client.post(
        "/api/admin/matches/99999/player-stats",
        json={"player_stats": {"messi": {"goals": 1, "assists": 0}}},
        headers=headers,
    )
    assert resp.status_code == 404
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
pytest tests/test_admin_player_stats.py -v
```

Expected: `404` on all requests — endpoint doesn't exist.

- [ ] **Step 3: Add the endpoint to `backend/app/routers/leagues.py`**

Update the imports at the top of `leagues.py`. Find:

```python
from app.settlement import determine_totals_winner
```

Replace with:

```python
from app.settlement import (
    determine_totals_winner,
    determine_player_h2h_winner,
    settle_challenge_issuer,
    settle_challenge_acceptor,
    _normalize_name,
)
```

Add these imports if not already present (check the top of `leagues.py` — add only what's missing):

```python
import json
from sqlalchemy import select
from app.models import Match, Challenge, Player
```

Append this endpoint to `leagues.py` (at the bottom, before any `if __name__` block):

```python
@router.post("/api/admin/matches/{match_id}/player-stats", status_code=200)
async def set_match_player_stats(
    match_id: int,
    data: dict,
    _=Depends(get_admin),
    db: AsyncSession = Depends(get_db),
):
    """Write per-player stats to a match and re-settle any voided player_h2h challenges.

    Body: {"player_stats": {"player_name": {"goals": N, "assists": N}, ...}}

    Keys are normalised (lowercase, accent-stripped) at write time.

    Re-settlement on already-voided challenges pays net gain only (payout - stake)
    to the winner. The loser retains their void refund.
    """
    match = await db.get(Match, match_id)
    if not match:
        raise HTTPException(404, "match not found")

    raw_stats = data.get("player_stats")
    if not raw_stats or not isinstance(raw_stats, dict):
        raise HTTPException(400, "player_stats must be a non-empty object")

    # Normalise keys at write time
    normalised = {_normalize_name(k): v for k, v in raw_stats.items()}
    match.player_stats_cache = json.dumps(normalised)
    await db.commit()

    resettled = 0
    if match.status == "finished":
        voided = (await db.execute(
            select(Challenge).where(
                Challenge.match_id == match_id,
                Challenge.bet_type == "player_h2h",
                Challenge.status == "voided",
            )
        )).scalars().all()

        for ch in voided:
            winner = determine_player_h2h_winner(
                ch.selection, ch.acceptor_selection, match.player_stats_cache
            )
            if winner == "void":
                continue  # still a tie or player missing — leave voided

            issuer   = await db.get(Player, ch.issuer_id)
            acceptor = await db.get(Player, ch.acceptor_id)
            issuer_won = (winner == "issuer")

            # Net gain only — stakes were already refunded during void settlement
            if issuer_won:
                net_gain = int(ch.issuer_stake * ch.issuer_odds) - ch.issuer_stake
                if net_gain > 0:
                    issuer.token_balance += net_gain
                acceptor.challenge_streak = 0
            else:
                net_gain = int(ch.acceptor_stake * ch.acceptor_odds) - ch.acceptor_stake
                if net_gain > 0:
                    acceptor.token_balance += net_gain
                issuer.challenge_streak = 0

            ch.status = "resolved"
            resettled += 1

        await db.commit()

    return {"updated": True, "resettled": resettled}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
pytest tests/test_admin_player_stats.py -v
```

Expected: all 4 tests pass.

- [ ] **Step 5: Run full test suite**

```bash
pytest tests/ -q
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/leagues.py backend/tests/test_admin_player_stats.py
git commit -m "feat: add POST /api/admin/matches/{id}/player-stats endpoint with re-settlement"
```

---

## Task 7: AdminPage UI — Player Stats Override section

**Files:**
- Modify: `frontend/src/pages/AdminPage.jsx`

The `AdminPage.jsx` already has settle/league management sections. This task appends a new collapsible section at the bottom.

- [ ] **Step 1: Add state variables to the `AdminPage` component**

In `AdminPage`, add these new state declarations alongside the existing ones (near the top of the function):

```jsx
// Player stats override state
const [finishedMatches, setFinishedMatches] = useState([])
const [statsMatchId, setStatsMatchId]       = useState("")
const [statsJson, setStatsJson]             = useState("")
const [statsMsg, setStatsMsg]               = useState("")
const [statsLoading, setStatsLoading]       = useState(false)
```

- [ ] **Step 2: Add `loadFinishedMatches` call inside the existing `useEffect`**

Find the existing `useEffect(() => { load(); loadMatches() }, [])` and update it:

```jsx
useEffect(() => { load(); loadMatches(); loadFinishedMatches() }, [])
```

Add this function alongside the other async loaders:

```jsx
async function loadFinishedMatches() {
  try {
    const all = await api.get("/api/matches")
    setFinishedMatches(all.filter(m => m.status === "finished"))
  } catch (_) {}
}
```

- [ ] **Step 3: Add `handleSetPlayerStats` handler**

Add alongside `handleSettle`:

```jsx
async function handleSetPlayerStats() {
  if (!statsMatchId) return setStatsMsg("✗ Select a match")
  let parsed
  try { parsed = JSON.parse(statsJson) }
  catch { return setStatsMsg("✗ Invalid JSON") }
  setStatsLoading(true); setStatsMsg("")
  try {
    const r = await api.post(`/api/admin/matches/${statsMatchId}/player-stats`,
                             { player_stats: parsed })
    setStatsMsg(`✓ Saved. Re-settled ${r.resettled} challenge(s).`)
  } catch (e) { setStatsMsg("✗ " + e.message) }
  finally { setStatsLoading(false) }
}
```

- [ ] **Step 4: Add the UI section in the JSX return**

Find the closing `</div>` of the last existing admin section (tournament settlement) and append before the component's final `</div>`:

```jsx
{/* ── Player Stats Override ──────────────────────────────────────── */}
<div style={{ background: "#0c0c14", border: "1px solid #2d2b55", borderRadius: 10,
              padding: 14, marginTop: 16 }}>
  <h3 style={{ color: "#a78bfa", fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
    ⚽ Player Stats Override
  </h3>
  <p style={{ color: "#6b7280", fontSize: 11, marginBottom: 10 }}>
    Use when API-Football had no data and player_h2h challenges were voided.
    Paste the stats JSON, save, and voided challenges re-settle automatically.
  </p>

  <div style={{ marginBottom: 8 }}>
    <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 3 }}>Match</div>
    <select
      value={statsMatchId}
      onChange={e => setStatsMatchId(e.target.value)}
      style={{ ...inputStyle, width: "100%" }}
    >
      <option value="">— select finished match —</option>
      {finishedMatches.map(m => (
        <option key={m.id} value={m.id}>
          {m.home_team} vs {m.away_team}
        </option>
      ))}
    </select>
  </div>

  <div style={{ marginBottom: 8 }}>
    <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 3 }}>
      Player stats JSON (keys lowercase, e.g. "messi", "mbappe")
    </div>
    <textarea
      value={statsJson}
      onChange={e => setStatsJson(e.target.value)}
      placeholder={'{\n  "messi": {"goals": 2, "assists": 0},\n  "mbappe": {"goals": 1, "assists": 0}\n}'}
      rows={6}
      style={{ ...inputStyle, width: "100%", fontFamily: "monospace", fontSize: 11,
               boxSizing: "border-box", resize: "vertical" }}
    />
  </div>

  <button
    onClick={handleSetPlayerStats}
    disabled={statsLoading}
    style={{ background: "linear-gradient(135deg,#a855f7,#3b82f6)", color: "#fff",
             border: "none", borderRadius: 8, padding: "8px 18px",
             fontSize: 12, fontWeight: 700,
             cursor: statsLoading ? "not-allowed" : "pointer",
             opacity: statsLoading ? 0.7 : 1 }}
  >
    {statsLoading ? "Saving..." : "💾 Save & Settle"}
  </button>

  {statsMsg && (
    <p style={{ color: statsMsg.startsWith("✓") ? "#4ade80" : "#f87171",
                fontSize: 12, marginTop: 8 }}>
      {statsMsg}
    </p>
  )}
</div>
```

- [ ] **Step 5: Manual verification**

Start the dev servers and navigate to `/admin`:
1. Confirm "Player Stats Override" section appears below tournament settlement
2. Select a finished match from the dropdown
3. Paste `{"messi": {"goals": 1, "assists": 0}}` in the textarea
4. Click "Save & Settle" — confirm success message appears

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/AdminPage.jsx
git commit -m "feat: add Player Stats Override section to AdminPage"
```

---

## Task 8: ChallengePanel — STAR_PLAYERS, PlayerH2HPicker, DARE_TYPES wiring

**Files:**
- Modify: `frontend/src/components/ChallengePanel.jsx`

- [ ] **Step 1: Add `STAR_PLAYERS` map at the top of `ChallengePanel.jsx`**

Insert after the imports, before the `DARE_TYPES` array:

```jsx
/* ── Star players by WC 2026 team ──────────────────────────────── */
const STAR_PLAYERS = {
  "Argentina":    ["Messi", "Di María", "Álvarez", "Mac Allister"],
  "France":       ["Mbappé", "Griezmann", "Dembélé", "Camavinga"],
  "Brazil":       ["Vini Jr", "Rodrygo", "Raphinha", "Paquetá"],
  "England":      ["Bellingham", "Saka", "Foden", "Kane"],
  "Portugal":     ["Ronaldo", "B. Silva", "Félix", "R. Leão"],
  "Spain":        ["Pedri", "Yamal", "Morata", "Olmo"],
  "Germany":      ["Müller", "Wirtz", "Gnabry", "Havertz"],
  "Netherlands":  ["Van Dijk", "Gakpo", "Depay", "Simons"],
  "Uruguay":      ["Núñez", "Valverde", "Araújo"],
  "Colombia":     ["James", "Díaz", "Arias"],
  "USA":          ["Pulisic", "Reyna", "Adams"],
  "Mexico":       ["Lozano", "Guardado", "Raúl"],
  "Morocco":      ["En-Nesyri", "Hakimi", "Ziyech"],
  "Senegal":      ["Mané", "Dia", "Sarr"],
  "Japan":        ["Mitoma", "Kubo", "Kamada"],
  "South Korea":  ["Son", "Lee Kang-In", "Hwang"],
  "Croatia":      ["Modrić", "Kovačić", "Gvardiol"],
  "Belgium":      ["De Bruyne", "Lukaku", "Tielemans"],
  "Italy":        ["Barella", "Tonali", "Scamacca"],
  "Poland":       ["Lewandowski", "Zieliński", "Szymański"],
  "Switzerland":  ["Xhaka", "Shaqiri", "Embolo"],
  "Australia":    ["Hrustic", "Irvine", "Boyle"],
  "Canada":       ["Davies", "David", "Buchanan"],
  "Ecuador":      ["Caicedo", "Plata", "Enner Valencia"],
  "Iran":         ["Taremi", "Jahanbakhsh", "Azmoun"],
  "Saudi Arabia": ["Al-Dawsari", "Al-Shahrani", "Al-Malki"],
  "Cameroon":     ["Onana", "Aboubakar", "Choupo-Moting"],
  "Ghana":        ["Kudus", "Partey", "Ayew"],
  "Nigeria":      ["Lookman", "Osimhen", "Iheanacho"],
  "South Africa": ["Tau", "Dolly", "Zwane"],
  "Qatar":        ["Al-Haydos", "Afif", "Al-Rawi"],
}

function _teamPool(match) {
  const home = STAR_PLAYERS[match.home_team] || []
  const away = STAR_PLAYERS[match.away_team] || []
  return [...home, ...away]
}
```

- [ ] **Step 2: Add `player_h2h` to `DARE_TYPES`**

In the `DARE_TYPES` array, append as the last entry:

```jsx
  { key: "player_h2h", label: "⚽ Player H2H", short: "Player H2H", yesNo: false, playerH2H: true,
    hint: "Dare on which player wins a stat duel — e.g. Messi vs Mbappé, who scores more goals?" },
```

- [ ] **Step 3: Write the `PlayerH2HPicker` component**

Add after the `HandicapPicker` component and before the `/* ── Main ──` comment:

```jsx
/* ── Player H2H picker ─────────────────────────────────────────── */
function PlayerH2HPicker({ match, selection, acceptorSelection, onPick }) {
  const pool = _teamPool(match)
  // Parse current selections: "Messi goals" → { player: "Messi", stat: "goals" }
  function parse(sel) {
    if (!sel) return { player: "", stat: "goals" }
    const parts = sel.split(" ")
    const stat = parts[parts.length - 1].toLowerCase()
    const player = parts.slice(0, -1).join(" ")
    return { player, stat: (stat === "goals" || stat === "assists") ? stat : "goals" }
  }
  const myParsed   = parse(selection)
  const theirParsed = parse(acceptorSelection)
  const currentStat = myParsed.stat || "goals"

  function pickMy(player) {
    const stat = currentStat
    onPick(`${player} ${stat}`, theirParsed.player ? `${theirParsed.player} ${stat}` : "")
  }
  function pickTheir(player) {
    const stat = currentStat
    onPick(myParsed.player ? `${myParsed.player} ${stat}` : "", `${player} ${stat}`)
  }
  function pickStat(stat) {
    onPick(
      myParsed.player    ? `${myParsed.player} ${stat}`    : "",
      theirParsed.player ? `${theirParsed.player} ${stat}` : "",
    )
  }

  const chipStyle = (active) => ({
    padding: "3px 10px", borderRadius: 999, fontSize: 10, fontWeight: 700,
    cursor: "pointer", border: "1px solid",
    background: active ? "rgba(168,85,247,0.2)" : "transparent",
    borderColor: active ? "rgba(168,85,247,0.6)" : "#2d2b55",
    color: active ? "#c4b5fd" : "#6b7280",
  })

  return (
    <div style={{ marginBottom: 10 }}>
      {/* Your player */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 4 }}>Your player</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {pool.map(p => (
            <button key={p} onClick={() => pickMy(p)} disabled={p === theirParsed.player}
              style={{ ...chipStyle(p === myParsed.player), opacity: p === theirParsed.player ? 0.3 : 1 }}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Their player */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 4 }}>Their player</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {pool.map(p => (
            <button key={p} onClick={() => pickTheir(p)} disabled={p === myParsed.player}
              style={{ ...chipStyle(p === theirParsed.player), opacity: p === myParsed.player ? 0.3 : 1 }}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Stat */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 4 }}>Stat</div>
        <div style={{ display: "flex", gap: 6 }}>
          {["goals", "assists"].map(s => (
            <button key={s} onClick={() => pickStat(s)} style={{
              ...chipStyle(currentStat === s),
              padding: "5px 16px", fontSize: 11,
            }}>
              {s === "goals" ? "⚽ Goals" : "🅰️ Assists"}
            </button>
          ))}
        </div>
      </div>

      {/* Summary pill */}
      {myParsed.player && theirParsed.player && (
        <div style={{ marginTop: 8, padding: "8px 10px",
          background: "rgba(168,85,247,0.08)",
          borderRadius: 8, border: "1px solid rgba(168,85,247,0.2)" }}>
          <div style={{ color: "#c4b5fd", fontSize: 11, fontWeight: 700 }}>
            ⚔️ {myParsed.player} ({currentStat}) vs {theirParsed.player} ({currentStat})
          </div>
          <div style={{ color: "#6b7280", fontSize: 10, marginTop: 2 }}>
            You back {myParsed.player} · they back {theirParsed.player}. Tie = void (full refund).
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Wire `PlayerH2HPicker` into the pick section of ChallengePanel**

In the JSX render, find the existing picker branch:

```jsx
        ) : currentType.handicap ? (
          <HandicapPicker
```

Before that line, add the new branch so the full chain reads:

```jsx
        ) : currentType.playerH2H ? (
          <PlayerH2HPicker
            match={match}
            selection={selection}
            acceptorSelection={acceptorSelection}
            onPick={(sel, acceptSel) => { setSelection(sel); setAcceptorSelection(acceptSel) }}
          />
        ) : currentType.handicap ? (
          <HandicapPicker
```

- [ ] **Step 5: Guard `issueDare` validation for `player_h2h`**

The current guard `if (!selection || !acceptorSelection) return setMsg("Pick your side first")` already covers the case where either player is not picked. No change needed — it works correctly for `player_h2h` selections.

- [ ] **Step 6: Manual end-to-end test**

Start the frontend dev server (`npm run dev` in `frontend/`). Navigate to a match detail page:
1. Open the "Dare a Friend" panel
2. Click "⚽ Player H2H" pill — confirm `PlayerH2HPicker` renders
3. Pick a "your player" chip — confirm it highlights
4. Pick a "their player" chip (different player) — confirm "your player" chip is disabled in the "their" row
5. Select a stat — confirm summary pill appears: `⚔️ Messi (goals) vs Mbappé (goals)`
6. Set stake to 50, click "💥 Send Dare" — confirm success message and balance decreases
7. Log in as another user, check the incoming dare — confirm it displays `Player H2H: Messi goals vs Mbappé goals`
8. Accept the dare — confirm balance decreases

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/ChallengePanel.jsx
git commit -m "feat: add Player H2H dare type with STAR_PLAYERS chips and PlayerH2HPicker"
```

---

## Final: Run full test suite and verify

- [ ] **Run all backend tests**

```bash
cd backend
source venv/bin/activate
pytest tests/ -v
```

Expected output — all pass, including:
- `test_match_has_player_stats_cache_column`
- `test_normalize_strips_accents_and_lowercases`
- `test_find_player_exact_match`
- `test_find_player_abbreviated_api_name`
- `test_determine_h2h_issuer_wins_on_goals`
- `test_determine_h2h_tie_returns_void`
- `test_determine_h2h_abbreviated_api_name_in_cache`
- `test_player_stats_goals_counted`
- `test_player_stats_assists_counted`
- `test_enrich_stores_player_stats_cache`
- `test_player_h2h_voids_when_no_cache`
- `test_player_h2h_issuer_wins`
- `test_player_h2h_acceptor_wins`
- `test_player_h2h_tie_voids`
- `test_set_player_stats_stores_normalised_cache`
- `test_set_player_stats_resettles_voided_challenges`

- [ ] **Run migration on prod before deploying**

```bash
railway run python scripts/migrate_add_player_stats_cache.py
```

---

## Known Limitations

- **Name matching is best-effort.** API-Football uses abbreviated names (`"L. Messi"`). The substring match handles common cases but may misfire if two players on the same team share a surname (e.g. "Ayew" for both André and Jordan Ayew). Admin override resolves edge cases.
- **Re-settlement pays net gain only.** If stats were missing at settle-time (no `api_fixture_id`), both players were refunded. Admin override pays the winner's net gain (payout − stake) without clawing back the loser's refund. Net effect: the house absorbs a loss equal to one stake in this rare path.
- **`STAR_PLAYERS` covers ~30 teams.** Extend before go-live for the full 48-team WC 2026 field using squad pages as reference. Check at least one API-Football fixture event per team to confirm name format.
