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
