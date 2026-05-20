from tests.conftest import join_player, make_match


async def test_save_and_get_prediction(client, db):
    m = await make_match(db)
    data = await join_player(client)
    headers = {"Authorization": f"Bearer {data['token']}"}
    resp = await client.post("/api/predictions", json={"match_id": m.id, "home_score_pred": 2, "away_score_pred": 1}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["home_score_pred"] == 2
    list_resp = await client.get("/api/predictions", headers=headers)
    assert any(p["my_prediction"] is not None for p in list_resp.json())


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
    resp = await client.post("/api/predictions", json={"match_id": m.id, "home_score_pred": 1, "away_score_pred": 0},
                             headers={"Authorization": f"Bearer {data['token']}"})
    assert resp.status_code == 400
