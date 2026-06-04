from tests.conftest import join_player, make_match


async def test_prediction_has_is_double_field(db):
    """Prediction model has is_double boolean field."""
    from app.models import Prediction
    from tests.conftest import make_match
    m = await make_match(db)
    pred = Prediction(
        player_id=1, match_id=m.id,
        home_score_pred=2, away_score_pred=1,
        is_double=True,
    )
    db.add(pred)
    await db.commit()
    await db.refresh(pred)
    assert pred.is_double is True


async def test_double_prediction_accepted(client, db):
    m = await make_match(db)
    data = await join_player(client)
    headers = {"Authorization": f"Bearer {data['token']}"}
    resp = await client.post("/api/predictions", json={
        "match_id": m.id, "home_score_pred": 2, "away_score_pred": 1, "is_double": True,
    }, headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["is_double"] is True
    assert body["doubles_used"] == 1


async def test_max_3_double_predictions(client, db):
    data = await join_player(client)
    headers = {"Authorization": f"Bearer {data['token']}"}
    for i in range(3):
        m = await make_match(db, home=f"TeamA{i}", away=f"TeamB{i}")
        resp = await client.post("/api/predictions", json={
            "match_id": m.id, "home_score_pred": 1, "away_score_pred": 0, "is_double": True,
        }, headers=headers)
        assert resp.status_code == 200
    m4 = await make_match(db, home="Extra1", away="Extra2")
    resp = await client.post("/api/predictions", json={
        "match_id": m4.id, "home_score_pred": 2, "away_score_pred": 2, "is_double": True,
    }, headers=headers)
    assert resp.status_code == 400
    assert "3 double" in resp.json()["detail"]


async def test_updating_existing_double_does_not_double_count(client, db):
    m = await make_match(db)
    headers = {"Authorization": f"Bearer {(await join_player(client))['token']}"}
    await client.post("/api/predictions", json={
        "match_id": m.id, "home_score_pred": 1, "away_score_pred": 0, "is_double": True,
    }, headers=headers)
    resp = await client.post("/api/predictions", json={
        "match_id": m.id, "home_score_pred": 2, "away_score_pred": 0, "is_double": True,
    }, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["doubles_used"] == 1


async def test_get_predictions_includes_is_double(client, db):
    m = await make_match(db)
    data = await join_player(client)
    headers = {"Authorization": f"Bearer {data['token']}"}
    await client.post("/api/predictions", json={
        "match_id": m.id, "home_score_pred": 1, "away_score_pred": 0, "is_double": True,
    }, headers=headers)
    resp = await client.get("/api/predictions", headers=headers)
    assert resp.status_code == 200
    preds = resp.json()
    my_pred = next(p for p in preds if p["my_prediction"] is not None)
    assert my_pred["my_prediction"]["is_double"] is True


async def test_double_prediction_settles_at_6pts(client, db):
    from app.poller import settle_match
    from sqlalchemy import select as sa_select
    from app.models import Prediction as PredModel
    m = await make_match(db, status="locked", home="Spain", away="France")
    data = await join_player(client)
    await client.post("/api/predictions", json={
        "match_id": m.id, "home_score_pred": 2, "away_score_pred": 1, "is_double": True,
    }, headers={"Authorization": f"Bearer {data['token']}"})
    await settle_match(db, m, {"home_score": 2, "away_score": 1, "home_red_cards": 0, "away_red_cards": 0, "corners": 0})
    pred = (await db.execute(sa_select(PredModel).where(PredModel.match_id == m.id))).scalar_one()
    assert pred.status == "correct_score"
    assert pred.points_awarded == 6


async def test_double_correct_outcome_awards_2pts(client, db):
    from app.poller import settle_match
    from sqlalchemy import select as sa_select
    from app.models import Prediction as PredModel
    m = await make_match(db, status="locked", home="Brazil", away="Argentina")
    data = await join_player(client)
    await client.post("/api/predictions", json={
        "match_id": m.id, "home_score_pred": 1, "away_score_pred": 0, "is_double": True,
    }, headers={"Authorization": f"Bearer {data['token']}"})
    await settle_match(db, m, {"home_score": 2, "away_score": 0, "home_red_cards": 0, "away_red_cards": 0, "corners": 0})
    pred = (await db.execute(sa_select(PredModel).where(PredModel.match_id == m.id))).scalar_one()
    assert pred.status == "correct_outcome"
    assert pred.points_awarded == 2


async def test_non_double_prediction_unaffected(client, db):
    from app.poller import settle_match
    from sqlalchemy import select as sa_select
    from app.models import Prediction as PredModel
    m = await make_match(db, status="locked", home="Germany", away="England")
    data = await join_player(client)
    await client.post("/api/predictions", json={
        "match_id": m.id, "home_score_pred": 3, "away_score_pred": 1, "is_double": False,
    }, headers={"Authorization": f"Bearer {data['token']}"})
    await settle_match(db, m, {"home_score": 3, "away_score": 1, "home_red_cards": 0, "away_red_cards": 0, "corners": 0})
    pred = (await db.execute(sa_select(PredModel).where(PredModel.match_id == m.id))).scalar_one()
    assert pred.status == "correct_score"
    assert pred.points_awarded == 3
