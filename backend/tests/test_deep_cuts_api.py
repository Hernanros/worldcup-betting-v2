import pytest
from tests.conftest import join_player


@pytest.mark.asyncio
async def test_get_stages(client):
    data = await join_player(client)
    headers = {"Authorization": f"Bearer {data['token']}"}
    resp = await client.get("/api/deep-cuts/stages", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert "stages" in body
    stages = {s["stage"] for s in body["stages"]}
    assert {"tournament", "group_stage", "r32", "r16", "qf", "sf", "final"} == stages


@pytest.mark.asyncio
async def test_get_markets_for_stage(client):
    data = await join_player(client)
    headers = {"Authorization": f"Bearer {data['token']}"}
    resp = await client.get("/api/deep-cuts/markets/group_stage", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert "markets" in body
    keys = {m["key"] for m in body["markets"]}
    assert "total_corners" in keys
    assert "own_goals" in keys
    assert "group_advance_A" in keys


@pytest.mark.asyncio
async def test_place_spicy_bet(client):
    data = await join_player(client)
    headers = {"Authorization": f"Bearer {data['token']}"}
    resp = await client.post("/api/deep-cuts/bets", json={
        "market_key": "own_goals",
        "stage":      "group_stage",
        "selection":  "Over 2.5",
        "stake":      100,
        "odds":       1.85,
    }, headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["new_balance"] == 900


@pytest.mark.asyncio
async def test_place_spicy_bet_insufficient_balance(client):
    data = await join_player(client, name="Poor")
    headers = {"Authorization": f"Bearer {data['token']}"}
    resp = await client.post("/api/deep-cuts/bets", json={
        "market_key": "own_goals", "stage": "group_stage",
        "selection": "Over 2.5", "stake": 9999, "odds": 1.85,
    }, headers=headers)
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_get_my_bets(client):
    data = await join_player(client, name="Bettor")
    headers = {"Authorization": f"Bearer {data['token']}"}
    await client.post("/api/deep-cuts/bets", json={
        "market_key": "total_corners", "stage": "group_stage",
        "selection": "Under 474.5", "stake": 50, "odds": 1.90,
    }, headers=headers)
    resp = await client.get("/api/deep-cuts/bets", headers=headers)
    assert resp.status_code == 200
    bets = resp.json()["bets"]
    assert len(bets) == 1
    assert bets[0]["selection"] == "Under 474.5"


@pytest.mark.asyncio
async def test_dismiss_banner(client):
    data = await join_player(client, name="Dismisser")
    headers = {"Authorization": f"Bearer {data['token']}"}
    resp = await client.post("/api/deep-cuts/dismiss/group_stage", headers=headers)
    assert resp.status_code == 200
    # Second dismiss is idempotent
    resp2 = await client.post("/api/deep-cuts/dismiss/group_stage", headers=headers)
    assert resp2.status_code == 200


@pytest.mark.asyncio
async def test_banner_respects_dismissal(client):
    data = await join_player(client, name="NoBanner")
    headers = {"Authorization": f"Bearer {data['token']}"}
    await client.post("/api/deep-cuts/dismiss/group_stage", headers=headers)
    resp = await client.get("/api/deep-cuts/banner", headers=headers)
    assert resp.status_code == 200
    stages = [b["stage"] for b in resp.json()["open_stages"]]
    assert "group_stage" not in stages
