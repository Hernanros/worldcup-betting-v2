from tests.conftest import join_player


async def _place_tournament_bet(client, bet_type="winner", selection="Spain", stake=100):
    data = await join_player(client)
    headers = {"Authorization": f"Bearer {data['token']}"}
    resp = await client.post("/api/tournament/bets", json={"bet_type": bet_type, "selection": selection, "stake": stake}, headers=headers)
    assert resp.status_code == 200
    return data, headers


async def test_insurance_pick_model_exists(db):
    from app.models import InsurancePick
    assert hasattr(InsurancePick, "player_id")
    assert hasattr(InsurancePick, "tournament_bet_id")
    assert hasattr(InsurancePick, "bet_type")
    assert hasattr(InsurancePick, "selection")
    assert hasattr(InsurancePick, "status")


async def test_place_insurance_pick_succeeds(client):
    data, headers = await _place_tournament_bet(client, "winner", "Spain")
    resp = await client.post("/api/tournament/insurance", json={"bet_type": "winner", "selection": "France"}, headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["bet_type"] == "winner"
    assert body["selection"] == "France"
    assert body["status"] == "pending"


async def test_insurance_requires_primary_bet(client):
    data = await join_player(client)
    headers = {"Authorization": f"Bearer {data['token']}"}
    resp = await client.post("/api/tournament/insurance", json={"bet_type": "winner", "selection": "France"}, headers=headers)
    assert resp.status_code == 400
    assert "pending" in resp.json()["detail"]


async def test_insurance_only_winner_golden_boot(client):
    data, headers = await _place_tournament_bet(client, "winner", "Spain")
    resp = await client.post("/api/tournament/insurance", json={"bet_type": "total_goals", "selection": "Over 149.5"}, headers=headers)
    assert resp.status_code == 400


async def test_insurance_cannot_duplicate_primary_selection(client):
    data, headers = await _place_tournament_bet(client, "winner", "Spain")
    resp = await client.post("/api/tournament/insurance", json={"bet_type": "winner", "selection": "Spain"}, headers=headers)
    assert resp.status_code == 400
    assert "differ" in resp.json()["detail"]


async def test_one_insurance_per_market(client):
    data, headers = await _place_tournament_bet(client, "winner", "Spain")
    await client.post("/api/tournament/insurance", json={"bet_type": "winner", "selection": "France"}, headers=headers)
    resp = await client.post("/api/tournament/insurance", json={"bet_type": "winner", "selection": "Brazil"}, headers=headers)
    assert resp.status_code == 400
    assert "already" in resp.json()["detail"]


async def test_get_insurance_picks(client):
    data, headers = await _place_tournament_bet(client, "winner", "Spain")
    await client.post("/api/tournament/insurance", json={"bet_type": "winner", "selection": "France"}, headers=headers)
    resp = await client.get("/api/tournament/insurance", headers=headers)
    assert resp.status_code == 200
    picks = resp.json()
    assert len(picks) == 1
    assert picks[0]["selection"] == "France"


async def _admin_headers(client) -> dict:
    resp = await client.post("/api/auth/join", json={"name": "Admin", "code": "admin"})
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['token']}"}


async def test_insurance_correct_primary_lost_awards_half(client, db):
    from sqlalchemy import select as sa_select
    from app.models import Player as P
    data = await join_player(client)
    h = {"Authorization": f"Bearer {data['token']}"}
    # Spain @ 5.5x (server-authoritative), stake 100
    await client.post("/api/tournament/bets", json={"bet_type": "winner", "selection": "Spain", "stake": 100}, headers=h)
    await client.post("/api/tournament/insurance", json={"bet_type": "winner", "selection": "France"}, headers=h)
    admin = await _admin_headers(client)
    # France wins → Spain primary lost, France insurance correct
    await client.post("/api/admin/tournament/settle", json={"winner": "France", "golden_boot": "Mbappé"}, headers=admin)
    p = (await db.execute(sa_select(P).where(P.name == "Alice"))).scalar_one()
    # 1000 - 100 stake (Spain lost) + int(100 * 5.5 * 0.5) = 275 insurance = 1175
    assert p.token_balance == 1175


async def test_insurance_ignored_when_primary_wins(client, db):
    from sqlalchemy import select as sa_select
    from app.models import Player as P
    data = await join_player(client)
    h = {"Authorization": f"Bearer {data['token']}"}
    await client.post("/api/tournament/bets", json={"bet_type": "winner", "selection": "Spain", "stake": 100}, headers=h)
    await client.post("/api/tournament/insurance", json={"bet_type": "winner", "selection": "France"}, headers=h)
    admin = await _admin_headers(client)
    await client.post("/api/admin/tournament/settle", json={"winner": "Spain", "golden_boot": "Mbappé"}, headers=admin)
    p = (await db.execute(sa_select(P).where(P.name == "Alice"))).scalar_one()
    # Spain wins: 1000 - 100 + 550 (100*5.5) = 1450, no insurance
    assert p.token_balance == 1450


async def test_insurance_wrong_not_paid(client, db):
    from sqlalchemy import select as sa_select
    from app.models import Player as P
    data = await join_player(client)
    h = {"Authorization": f"Bearer {data['token']}"}
    await client.post("/api/tournament/bets", json={"bet_type": "winner", "selection": "Spain", "stake": 100}, headers=h)
    await client.post("/api/tournament/insurance", json={"bet_type": "winner", "selection": "France"}, headers=h)
    admin = await _admin_headers(client)
    await client.post("/api/admin/tournament/settle", json={"winner": "Argentina", "golden_boot": "Mbappé"}, headers=admin)
    p = (await db.execute(sa_select(P).where(P.name == "Alice"))).scalar_one()
    # Spain lost, France insurance wrong → 900
    assert p.token_balance == 900
