import pytest
from tests.conftest import join_player


async def test_join_creates_player(client):
    resp = await client.post("/api/auth/join", json={"name": "Alice", "code": "friends2026"})
    assert resp.status_code == 200
    data = resp.json()
    assert "token" in data
    assert data["player"]["name"] == "Alice"
    assert data["player"]["token_balance"] == 1000


async def test_join_wrong_code_rejected(client):
    resp = await client.post("/api/auth/join", json={"name": "Bob", "code": "wrongcode"})
    assert resp.status_code == 403


async def test_join_same_name_returns_same_player(client):
    r1 = await client.post("/api/auth/join", json={"name": "Alice", "code": "friends2026"})
    r2 = await client.post("/api/auth/join", json={"name": "Alice", "code": "friends2026"})
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


async def test_get_me_returns_player_fields(client, db):
    data = await join_player(client)
    headers = {"Authorization": f"Bearer {data['token']}"}
    resp = await client.get("/api/me", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Alice"
    assert body["token_balance"] == 1000
    assert body["challenge_streak"] == 0
    assert body["total_challenges_issued"] == 0
    assert body["volume_milestone_reached"] == 0


async def test_get_me_requires_auth(client, db):
    resp = await client.get("/api/me", headers={"Authorization": "Bearer garbage"})
    assert resp.status_code == 401


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
