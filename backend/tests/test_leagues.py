import pytest
from tests.conftest import join_player

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
