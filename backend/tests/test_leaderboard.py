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
