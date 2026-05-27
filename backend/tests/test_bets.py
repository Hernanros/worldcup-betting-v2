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


async def test_get_my_bets_returns_placed_bets(client, db):
    m = await make_match(db)
    data = await join_player(client)
    headers = {"Authorization": f"Bearer {data['token']}"}
    await client.post(f"/api/matches/{m.id}/bets", json={
        "bet_type": "1x2", "selection": "Argentina", "stake": 100, "odds": 2.5
    }, headers=headers)
    resp = await client.get("/api/bets", headers=headers)
    assert resp.status_code == 200
    bets = resp.json()
    assert len(bets) == 1
    assert bets[0]["selection"] == "Argentina"
    assert bets[0]["stake"] == 100
    assert bets[0]["home_team"] == "Argentina"
    assert bets[0]["status"] == "pending"


async def test_get_my_bets_returns_empty_when_none(client, db):
    data = await join_player(client)
    headers = {"Authorization": f"Bearer {data['token']}"}
    resp = await client.get("/api/bets", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []
