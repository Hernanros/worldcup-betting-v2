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
