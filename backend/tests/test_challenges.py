from tests.conftest import join_player, make_match


async def _issue(client, match_id, token, issuer_stake=100, issuer_odds=3.0, acceptor_odds=1.5):
    return await client.post(f"/api/matches/{match_id}/challenges", json={
        "bet_type": "1x2",
        "selection": "Argentina",
        "acceptor_selection": "Away",
        "issuer_stake": issuer_stake,
        "issuer_odds": issuer_odds,
        "acceptor_odds": acceptor_odds,
    }, headers={"Authorization": f"Bearer {token}"})


async def test_issue_challenge_deducts_stake(client, db):
    m = await make_match(db)
    alice = await join_player(client, "Alice")
    resp = await _issue(client, m.id, alice["token"])
    assert resp.status_code == 200
    assert resp.json()["new_balance"] == 900


async def test_issue_challenge_grants_volume_milestone(client, db):
    m = await make_match(db)
    alice = await join_player(client, "Alice")
    # issue 5 challenges to trigger the first milestone (+50 tokens)
    for _ in range(5):
        await _issue(client, m.id, alice["token"], issuer_stake=10)
    resp = await client.get("/api/players/me", headers={"Authorization": f"Bearer {alice['token']}"})
    # started with 1000, spent 5*10=50, gained 50 milestone = 1000
    assert resp.json()["token_balance"] == 1000


async def test_accept_challenge(client, db):
    m = await make_match(db)
    alice = await join_player(client, "Alice")
    bob = await join_player(client, "Bob")

    issue_resp = await _issue(client, m.id, alice["token"])
    ch_id = issue_resp.json()["id"]

    accept_resp = await client.post(f"/api/challenges/{ch_id}/accept",
                                    headers={"Authorization": f"Bearer {bob['token']}"})
    assert accept_resp.status_code == 200
    assert accept_resp.json()["new_balance"] < 1000


async def test_cannot_accept_own_challenge(client, db):
    m = await make_match(db)
    alice = await join_player(client, "Alice")
    issue_resp = await _issue(client, m.id, alice["token"])
    ch_id = issue_resp.json()["id"]

    resp = await client.post(f"/api/challenges/{ch_id}/accept",
                             headers={"Authorization": f"Bearer {alice['token']}"})
    assert resp.status_code == 400
