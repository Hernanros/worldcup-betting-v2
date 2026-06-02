import datetime
from tests.conftest import join_player
from app.models import Match


async def test_leaderboard_ranked_by_balance(client, db):
    alice = await join_player(client, "Alice")
    bob = await join_player(client, "Bob")
    headers = {"Authorization": f"Bearer {alice['token']}"}
    resp = await client.get("/api/leaderboard", headers=headers)
    assert resp.status_code == 200
    ranks = {p["name"]: p["rank"] for p in resp.json()}
    assert ranks["Alice"] == ranks["Bob"] == 1  # tied at 1000


async def test_red_cards_leaderboard(client, db):
    m = Match(home_team="Spain", away_team="Italy",
              kickoff_time=datetime.datetime(2026, 6, 1),
              status="finished", round="group",
              home_red_cards=2, away_red_cards=1,
              home_score=1, away_score=0)
    db.add(m)
    await db.commit()
    data = await join_player(client)
    resp = await client.get("/api/leaderboard/red-cards", headers={"Authorization": f"Bearer {data['token']}"})
    assert resp.status_code == 200
    teams = {r["team"]: r["red_cards"] for r in resp.json()}
    assert teams["Spain"] == 2
    assert teams["Italy"] == 1


async def test_main_leaderboard_includes_prediction_pts(client, db):
    """Main leaderboard response includes each player's total prediction points."""
    from tests.conftest import make_match
    from app.models import Prediction

    alice = await join_player(client, "Alice")
    headers = {"Authorization": f"Bearer {alice['token']}"}

    m = await make_match(db, status="finished")
    db.add(Prediction(
        player_id=alice["player"]["id"], match_id=m.id,
        home_score_pred=2, away_score_pred=1,
        status="correct_score", points_awarded=3,
    ))
    await db.commit()

    resp = await client.get("/api/leaderboard", headers=headers)
    assert resp.status_code == 200
    alice_entry = next(e for e in resp.json() if e["name"] == "Alice")
    assert alice_entry["prediction_pts"] == 3


async def test_predictions_leaderboard_ranks_by_pts(client, db):
    """GET /api/leaderboard/predictions ranks players by prediction points."""
    from tests.conftest import make_match
    from app.models import Prediction

    alice = await join_player(client, "Alice")
    bob_resp = await client.post("/api/auth/join", json={"name": "Bob", "code": "friends2026"})
    bob = bob_resp.json()

    m = await make_match(db, status="finished")
    db.add(Prediction(player_id=alice["player"]["id"], match_id=m.id,
                      home_score_pred=2, away_score_pred=1,
                      status="correct_score", points_awarded=3))
    db.add(Prediction(player_id=bob["player"]["id"], match_id=m.id,
                      home_score_pred=1, away_score_pred=0,
                      status="correct_outcome", points_awarded=1))
    await db.commit()

    resp = await client.get("/api/leaderboard/predictions",
                            headers={"Authorization": f"Bearer {alice['token']}"})
    assert resp.status_code == 200
    names = [e["name"] for e in resp.json()]
    assert names.index("Alice") < names.index("Bob")
    assert resp.json()[0]["prediction_pts"] == 3
