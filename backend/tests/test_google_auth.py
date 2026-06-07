from unittest.mock import patch, MagicMock
import pytest
from tests.conftest import join_player


FAKE_SUB = "google-sub-12345"
FAKE_EMAIL = "hernan@gmail.com"
FAKE_NAME = "Hernan Rosenblum"

def _fake_payload():
    return {"sub": FAKE_SUB, "email": FAKE_EMAIL, "name": FAKE_NAME}


@pytest.fixture(autouse=True)
def set_google_client_id(request):
    """Ensure google_client_id is non-empty for all tests except the 503 test."""
    if request.node.name == "test_google_auth_fails_when_client_id_not_configured":
        yield
        return
    with patch("app.routers.auth.settings") as mock_settings:
        mock_settings.google_client_id = "fake-client-id.apps.googleusercontent.com"
        yield


# ── New player — first call (no invite_code) ──────────────────────────────────

async def test_google_new_player_returns_new_player_status(client):
    with patch("app.routers.auth.id_token.verify_oauth2_token", return_value=_fake_payload()):
        resp = await client.post("/api/auth/google", json={"id_token": "fake-token"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "new_player"
    assert data["google_name"] == FAKE_NAME
    assert data["google_email"] == FAKE_EMAIL
    assert "token" not in data


# ── New player — second call (with invite_code) ───────────────────────────────

async def test_google_new_player_registers_with_invite_code(client):
    with patch("app.routers.auth.id_token.verify_oauth2_token", return_value=_fake_payload()):
        resp = await client.post("/api/auth/google", json={
            "id_token": "fake-token",
            "invite_code": "friends2026",
        })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "token" in data
    assert data["player"]["name"] == FAKE_NAME
    assert data["player"]["token_balance"] == 1000
    assert data["league"]["name"] == "Test League"


async def test_google_new_player_can_set_display_name(client):
    with patch("app.routers.auth.id_token.verify_oauth2_token", return_value=_fake_payload()):
        resp = await client.post("/api/auth/google", json={
            "id_token": "fake-token",
            "invite_code": "friends2026",
            "display_name": "Nando",
        })
    assert resp.status_code == 200
    assert resp.json()["player"]["name"] == "Nando"


# ── Returning player ──────────────────────────────────────────────────────────

async def test_google_returning_player_skips_invite_code(client):
    # Register first
    with patch("app.routers.auth.id_token.verify_oauth2_token", return_value=_fake_payload()):
        await client.post("/api/auth/google", json={
            "id_token": "fake-token",
            "invite_code": "friends2026",
        })
    # Sign in again — no invite_code
    with patch("app.routers.auth.id_token.verify_oauth2_token", return_value=_fake_payload()):
        resp = await client.post("/api/auth/google", json={"id_token": "fake-token"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "token" in data


async def test_google_returning_player_same_id_each_time(client):
    for _ in range(2):
        with patch("app.routers.auth.id_token.verify_oauth2_token", return_value=_fake_payload()):
            resp = await client.post("/api/auth/google", json={
                "id_token": "fake-token",
                "invite_code": "friends2026",
            })
    # Both calls return the same player id
    with patch("app.routers.auth.id_token.verify_oauth2_token", return_value=_fake_payload()):
        resp2 = await client.post("/api/auth/google", json={"id_token": "fake-token"})
    assert resp.json()["player"]["id"] == resp2.json()["player"]["id"]


# ── Error cases ───────────────────────────────────────────────────────────────

async def test_google_invalid_token_returns_400(client):
    with patch("app.routers.auth.id_token.verify_oauth2_token", side_effect=ValueError("bad token")):
        resp = await client.post("/api/auth/google", json={"id_token": "garbage"})
    assert resp.status_code == 400


async def test_google_bad_invite_code_returns_403(client):
    with patch("app.routers.auth.id_token.verify_oauth2_token", return_value=_fake_payload()):
        resp = await client.post("/api/auth/google", json={
            "id_token": "fake-token",
            "invite_code": "wrongcode",
        })
    assert resp.status_code == 403


async def test_google_name_conflict_returns_400(client):
    # Register Alice via old join flow first
    await client.post("/api/auth/join", json={"name": FAKE_NAME, "code": "friends2026"})
    # Try to register the same display name via Google
    with patch("app.routers.auth.id_token.verify_oauth2_token", return_value=_fake_payload()):
        resp = await client.post("/api/auth/google", json={
            "id_token": "fake-token",
            "invite_code": "friends2026",
        })
    assert resp.status_code == 400
    assert "taken" in resp.json()["detail"].lower()


async def test_google_auth_fails_when_client_id_not_configured(client):
    with patch("app.routers.auth.settings") as mock_settings:
        mock_settings.google_client_id = ""
        resp = await client.post("/api/auth/google", json={"id_token": "fake-token"})
    assert resp.status_code == 503
