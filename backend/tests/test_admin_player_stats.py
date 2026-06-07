import json
import pytest
from tests.conftest import make_match, make_player, join_player
from app.models import Challenge


# ── Admin auth helper ──────────────────────────────────────────────────────────

async def _admin_headers(client):
    resp = await client.post("/api/auth/join", json={"name": "Admin", "code": "admin"})
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['token']}"}


# ── Tests ──────────────────────────────────────────────────────────────────────

async def test_set_player_stats_requires_admin(client, db):
    """Non-admin gets 403."""
    m = await make_match(db, status="finished")
    alice = await join_player(client, "Alice")
    headers = {"Authorization": f"Bearer {alice['token']}"}
    resp = await client.post(
        f"/api/admin/matches/{m.id}/player-stats",
        json={"player_stats": {"Messi": {"goals": 1, "assists": 0}}},
        headers=headers,
    )
    assert resp.status_code == 403


async def test_set_player_stats_stores_normalised_cache(client, db):
    """Admin posts accented name; DB cache has accent-stripped, lowercased key."""
    m = await make_match(db, status="finished")
    headers = await _admin_headers(client)

    resp = await client.post(
        f"/api/admin/matches/{m.id}/player-stats",
        json={"player_stats": {"Mbappé": {"goals": 2, "assists": 1}}},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["updated"] is True

    # Verify the cache in the DB has normalised key
    await db.refresh(m)
    cache = json.loads(m.player_stats_cache)
    assert "mbappe" in cache
    assert cache["mbappe"]["goals"] == 2
    assert cache["mbappe"]["assists"] == 1


async def test_set_player_stats_resettles_voided_challenges(client, db):
    """Voided player_h2h challenge is re-settled after admin posts player stats."""
    m = await make_match(db, status="finished")

    # Create issuer and acceptor with 1000 tokens each (stakes already refunded)
    issuer = await make_player(db, name="Issuer", balance=1000)
    acceptor = await make_player(db, name="Acceptor", balance=1000)

    # Create a voided challenge: issuer bets Messi goals, acceptor bets Mbappe goals
    # stake=100, issuer_odds=2.0 → net gain = int(100 * 2.0) - 100 = 100
    ch = Challenge(
        issuer_id=issuer.id,
        acceptor_id=acceptor.id,
        match_id=m.id,
        bet_type="player_h2h",
        selection="Messi goals",
        acceptor_selection="Mbappe goals",
        issuer_stake=100,
        acceptor_stake=100,
        issuer_odds=2.0,
        acceptor_odds=2.0,
        status="voided",
        bravery_streak_bonus_pct=0.0,
    )
    db.add(ch)
    await db.commit()
    await db.refresh(ch)

    # Admin posts stats: Messi 2 goals, Mbappe 0 goals → issuer wins
    headers = await _admin_headers(client)
    resp = await client.post(
        f"/api/admin/matches/{m.id}/player-stats",
        json={"player_stats": {"Messi": {"goals": 2, "assists": 0}, "Mbappe": {"goals": 0, "assists": 0}}},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["resettled"] == 1

    # Challenge should now be resolved
    await db.refresh(ch)
    assert ch.status == "resolved"

    # Issuer gets net gain: int(100 * 2.0) - 100 = 100 tokens
    await db.refresh(issuer)
    assert issuer.token_balance == 1100

    # Acceptor (loser) streak reset to 0
    await db.refresh(acceptor)
    assert acceptor.challenge_streak == 0


async def test_set_player_stats_404_on_unknown_match(client, db):
    """Returns 404 if match_id does not exist."""
    headers = await _admin_headers(client)
    resp = await client.post(
        "/api/admin/matches/99999/player-stats",
        json={"player_stats": {"Messi": {"goals": 1, "assists": 0}}},
        headers=headers,
    )
    assert resp.status_code == 404
