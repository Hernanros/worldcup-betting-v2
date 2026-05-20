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
