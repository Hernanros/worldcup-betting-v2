from tests.conftest import join_player


async def _admin_headers(client) -> dict:
    resp = await client.post("/api/auth/join", json={"name": "Admin", "code": "admin"})
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['token']}"}


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


async def test_settle_tournament_bets_winner_wins(client, db):
    """Player who bet on Spain wins when Spain is declared champion."""
    from sqlalchemy import select as sa_select
    from app.models import Player as PlayerModel
    alice = await join_player(client)
    headers = {"Authorization": f"Bearer {alice['token']}"}
    await client.post("/api/tournament/bets",
                      json={"bet_type": "winner", "selection": "Spain", "stake": 100, "odds": 5.0},
                      headers=headers)

    admin = await _admin_headers(client)
    resp = await client.post(
        "/api/admin/tournament/settle",
        json={"winner": "Spain", "golden_boot": "Mbappé"},
        headers=admin,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["settled"] == 1
    assert body["winner"] == "Spain"

    p = (await db.execute(sa_select(PlayerModel).where(PlayerModel.name == "Alice"))).scalar_one()
    assert p.token_balance == 1400  # 1000 - 100 stake + 500 payout (100 * 5.0)


async def test_settle_tournament_bets_winner_loses(client, db):
    """Player who bet on Brazil loses when Spain wins."""
    from sqlalchemy import select as sa_select
    from app.models import Player as PlayerModel
    alice = await join_player(client)
    headers = {"Authorization": f"Bearer {alice['token']}"}
    await client.post("/api/tournament/bets",
                      json={"bet_type": "winner", "selection": "Brazil", "stake": 100, "odds": 9.0},
                      headers=headers)

    admin = await _admin_headers(client)
    await client.post(
        "/api/admin/tournament/settle",
        json={"winner": "Spain", "golden_boot": "Mbappé"},
        headers=admin,
    )

    p = (await db.execute(sa_select(PlayerModel).where(PlayerModel.name == "Alice"))).scalar_one()
    assert p.token_balance == 900  # 1000 - 100 staked, nothing returned


async def test_settle_tournament_bets_case_insensitive(client, db):
    """Winner matching is case-insensitive."""
    from sqlalchemy import select as sa_select
    from app.models import Player as PlayerModel
    alice = await join_player(client)
    headers = {"Authorization": f"Bearer {alice['token']}"}
    await client.post("/api/tournament/bets",
                      json={"bet_type": "winner", "selection": "spain", "stake": 100, "odds": 5.0},
                      headers=headers)

    admin = await _admin_headers(client)
    await client.post(
        "/api/admin/tournament/settle",
        json={"winner": "Spain", "golden_boot": "Mbappé"},
        headers=admin,
    )

    p = (await db.execute(sa_select(PlayerModel).where(PlayerModel.name == "Alice"))).scalar_one()
    assert p.token_balance == 1400


async def test_settle_tournament_requires_admin(client, db):
    """Non-admin players cannot call the settlement endpoint."""
    alice = await join_player(client)
    resp = await client.post(
        "/api/admin/tournament/settle",
        json={"winner": "Spain", "golden_boot": "Mbappé"},
        headers={"Authorization": f"Bearer {alice['token']}"},
    )
    assert resp.status_code == 403
