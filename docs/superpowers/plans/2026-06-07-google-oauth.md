# Google OAuth Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the name+code join flow with Google Sign-In; invite code becomes a one-time registration gate for new players only.

**Architecture:** Frontend uses `@react-oauth/google` to get a Google ID token. That token is sent to a new `POST /api/auth/google` endpoint which verifies it with Google's public keys, finds or creates the player, and returns our own JWT. The existing `POST /api/auth/join` endpoint is untouched (admin still uses it). The migration follows the app's existing pattern: raw SQL `ADD COLUMN IF NOT EXISTS` in `_run_migrations()` in `main.py`.

**Tech Stack:** FastAPI, SQLAlchemy async, `google-auth` (Python), React 19, `@react-oauth/google`, Vitest + Testing Library

---

## File Map

| File | Change |
|------|--------|
| `backend/requirements.txt` | Add `google-auth` |
| `backend/app/config.py` | Add `google_client_id: str = ""` |
| `backend/app/models.py` | Add `google_sub`, `email` columns to `Player` |
| `backend/app/main.py` | Add two `ADD COLUMN IF NOT EXISTS` blocks to `_run_migrations()` |
| `backend/app/routers/auth.py` | Add `POST /api/auth/google` handler |
| `backend/tests/test_google_auth.py` | New test file for the new endpoint |
| `frontend/package.json` | Add `@react-oauth/google` (via `npm install`) |
| `frontend/.env.example` | Add `VITE_GOOGLE_CLIENT_ID=` |
| `frontend/src/main.jsx` | Wrap `<App />` with `<GoogleOAuthProvider>` |
| `frontend/src/pages/JoinPage.jsx` | Rewrite: two-state flow + admin toggle |
| `frontend/src/pages/JoinPage.test.jsx` | New: vitest tests for the new page |

---

## Task 1: Add `google-auth` to backend dependencies

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add the dependency**

Open `backend/requirements.txt` and add this line after `python-jose[cryptography]==3.3.0`:

```
google-auth==2.40.3
```

- [ ] **Step 2: Install it**

```bash
cd backend && source venv/bin/activate && pip install google-auth==2.40.3
```

Expected: `Successfully installed google-auth-2.40.3 ...`

- [ ] **Step 3: Commit**

```bash
git add backend/requirements.txt
git commit -m "deps: add google-auth for OAuth token verification"
```

---

## Task 2: Add `google_sub` and `email` to the Player model

**Files:**
- Modify: `backend/app/models.py`

- [ ] **Step 1: Add columns to the Player class**

In `backend/app/models.py`, find the `Player` class. After the `is_admin` line, add:

```python
    google_sub = Column(String(200), unique=True, nullable=True, index=True)
    email = Column(String(200), nullable=True)
```

The full `Player` column block should look like this:

```python
class Player(Base):
    __tablename__ = "players"
    __table_args__ = (UniqueConstraint("name", "league_id", name="uq_player_name_league"),)
    id = Column(Integer, primary_key=True)
    name = Column(String(50), nullable=False)
    session_token = Column(String(200), unique=True)
    token_balance = Column(Integer, nullable=False, default=1000)
    challenge_streak = Column(Integer, nullable=False, default=0)
    total_challenges_issued = Column(Integer, nullable=False, default=0)
    volume_milestone_reached = Column(Integer, nullable=False, default=0)
    is_admin = Column(Boolean, nullable=False, default=False)
    google_sub = Column(String(200), unique=True, nullable=True, index=True)
    email = Column(String(200), nullable=True)
    league_id = Column(Integer, ForeignKey("leagues.id"), nullable=True)
    # ... relationships unchanged
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/models.py
git commit -m "feat: add google_sub and email columns to Player model"
```

---

## Task 3: Add `google_client_id` to config

**Files:**
- Modify: `backend/app/config.py`

- [ ] **Step 1: Add the setting**

In `backend/app/config.py`, add `google_client_id` to the `Settings` class:

```python
class Settings(BaseSettings):
    jwt_secret: str = "dev-secret"
    invite_code: str = "friends2026"
    admin_code: str = "admin"
    google_client_id: str = ""          # ← add this line
    odds_api_key: str = ""
    football_api_key: str = ""
    anthropic_api_key: str = ""
    database_url: str = "sqlite+aiosqlite:///./worldcup.db"
    cors_origins: str = "*"

    model_config = {"env_file": ".env"}
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/config.py
git commit -m "feat: add google_client_id to settings"
```

---

## Task 4: Add migration for `google_sub` and `email` columns

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Add two `ADD COLUMN IF NOT EXISTS` blocks to `_run_migrations()`**

In `backend/app/main.py`, find the last `ALTER TABLE` block in `_run_migrations()` (the Deep Cuts block around line 96). After that block's `await db.commit()`, add:

```python
        # players.google_sub  (Google OAuth stable user ID)
        await db.execute(text(
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS "
            "google_sub VARCHAR(200)"
        ))
        await db.commit()

        # Unique index on google_sub (NULL values don't conflict)
        try:
            await db.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_players_google_sub "
                "ON players (google_sub) WHERE google_sub IS NOT NULL"
            ))
            await db.commit()
        except Exception:
            await db.rollback()

        # players.email
        await db.execute(text(
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS "
            "email VARCHAR(200)"
        ))
        await db.commit()
```

**Why the partial index:** PostgreSQL's UNIQUE constraint treats NULL = NULL (unlike SQL standard), so multiple admin players with no google_sub would violate a plain UNIQUE constraint. A partial index `WHERE google_sub IS NOT NULL` gives uniqueness only for set values.

- [ ] **Step 2: Verify the migration runs cleanly**

```bash
cd backend && source venv/bin/activate && python -c "
import asyncio
from app.main import _run_migrations
asyncio.run(_run_migrations())
print('Migration OK')
"
```

Expected: `Migration OK` (no exceptions)

- [ ] **Step 3: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: migrate players table — add google_sub and email columns"
```

---

## Task 5: Write failing tests for `POST /api/auth/google`

**Files:**
- Create: `backend/tests/test_google_auth.py`

- [ ] **Step 1: Create the test file**

Create `backend/tests/test_google_auth.py`:

```python
from unittest.mock import patch, MagicMock
import pytest
from tests.conftest import join_player


FAKE_SUB = "google-sub-12345"
FAKE_EMAIL = "hernan@gmail.com"
FAKE_NAME = "Hernan Rosenblum"

def _fake_payload():
    return {"sub": FAKE_SUB, "email": FAKE_EMAIL, "name": FAKE_NAME}


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
```

- [ ] **Step 2: Run the tests — confirm they all FAIL**

```bash
cd backend && source venv/bin/activate && pytest tests/test_google_auth.py -v 2>&1 | head -40
```

Expected: All tests fail with `404 Not Found` (endpoint doesn't exist yet) or `ImportError` if `id_token` isn't imported. That's correct — we haven't written the endpoint.

---

## Task 6: Implement `POST /api/auth/google`

**Files:**
- Modify: `backend/app/routers/auth.py`

- [ ] **Step 1: Add the imports at the top of `auth.py`**

At the top of `backend/app/routers/auth.py`, add these two imports after the existing imports:

```python
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
```

- [ ] **Step 2: Add the endpoint**

After the existing `@router.get("/api/players/me")` handler, add:

```python
@router.post("/api/auth/google")
async def google_auth(data: dict, db: AsyncSession = Depends(get_db)):
    raw_token = (data.get("id_token") or "").strip()
    invite_code = (data.get("invite_code") or "").strip() or None
    display_name = (data.get("display_name") or "").strip() or None

    # 1. Verify the Google ID token
    try:
        payload = id_token.verify_oauth2_token(
            raw_token,
            google_requests.Request(),
            settings.google_client_id if settings.google_client_id else None,
        )
    except ValueError as exc:
        raise HTTPException(400, f"invalid google token: {exc}")

    google_sub = payload["sub"]
    google_name = payload.get("name", "")
    google_email = payload.get("email", "")

    # 2. Look up existing player by google_sub
    # Note: `select` is already imported at the top of auth.py — no new import needed.
    result = await db.execute(
        select(Player).where(Player.google_sub == google_sub)
    )
    player = result.scalar_one_or_none()

    if player:
        # Returning player — issue JWT immediately
        token = make_token(player.id, False)
        player.session_token = token
        await db.commit()
        league = await db.get(League, player.league_id) if player.league_id else None
        return {
            "status": "ok",
            "token": token,
            "player": _player_dict(player, False),
            "league": {"id": league.id, "name": league.name} if league else None,
        }

    # 3. New player — require invite_code
    if not invite_code:
        return {"status": "new_player", "google_name": google_name, "google_email": google_email}

    result = await db.execute(
        select(League).where(League.invite_code == invite_code)
    )
    league = result.scalar_one_or_none()
    if not league:
        raise HTTPException(403, "invalid invite code")

    name = display_name or google_name
    try:
        player = Player(
            name=name,
            google_sub=google_sub,
            email=google_email,
            token_balance=1000,
            league_id=league.id,
        )
        db.add(player)
        await db.commit()
        await db.refresh(player)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(400, "Name already taken in this group — choose a different display name")

    token = make_token(player.id, False)
    player.session_token = token
    await db.commit()

    return {
        "status": "ok",
        "token": token,
        "player": _player_dict(player, False),
        "league": {"id": league.id, "name": league.name},
    }
```

- [ ] **Step 3: Run the tests — all should pass**

```bash
cd backend && source venv/bin/activate && pytest tests/test_google_auth.py -v
```

Expected output:
```
tests/test_google_auth.py::test_google_new_player_returns_new_player_status PASSED
tests/test_google_auth.py::test_google_new_player_registers_with_invite_code PASSED
tests/test_google_auth.py::test_google_new_player_can_set_display_name PASSED
tests/test_google_auth.py::test_google_returning_player_skips_invite_code PASSED
tests/test_google_auth.py::test_google_returning_player_same_id_each_time PASSED
tests/test_google_auth.py::test_google_invalid_token_returns_400 PASSED
tests/test_google_auth.py::test_google_bad_invite_code_returns_403 PASSED
tests/test_google_auth.py::test_google_name_conflict_returns_400 PASSED
8 passed
```

- [ ] **Step 4: Run the full backend test suite — confirm nothing broken**

```bash
cd backend && source venv/bin/activate && pytest --tb=short -q 2>&1 | tail -10
```

Expected: All existing tests still pass. New tests pass. Zero failures.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/auth.py backend/tests/test_google_auth.py
git commit -m "feat: add POST /api/auth/google endpoint with Google ID token verification"
```

---

## Task 7: Frontend — install `@react-oauth/google` and update `main.jsx`

**Files:**
- Modify: `frontend/package.json` (via npm install)
- Modify: `frontend/src/main.jsx`
- Create: `frontend/.env.example` (or update if exists)

- [ ] **Step 1: Install the package**

```bash
cd frontend && npm install @react-oauth/google
```

Expected: Package added to `node_modules` and `package.json` updated.

- [ ] **Step 2: Wrap App with GoogleOAuthProvider in `main.jsx`**

Replace the contents of `frontend/src/main.jsx` with:

```jsx
import React from "react"
import ReactDOM from "react-dom/client"
import { GoogleOAuthProvider } from "@react-oauth/google"
import App from "./App.jsx"
import "./index.css"

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || ""

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={googleClientId}>
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>
)
```

- [ ] **Step 3: Create/update `.env.example`**

Check if `frontend/.env.example` exists. If not, create it. Add this line:

```
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id-here
VITE_API_URL=
```

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/main.jsx frontend/.env.example
git commit -m "feat: install @react-oauth/google and wrap app with GoogleOAuthProvider"
```

---

## Task 8: Write failing tests for the new JoinPage

**Files:**
- Create: `frontend/src/pages/JoinPage.test.jsx`

- [ ] **Step 1: Create the test file**

Create `frontend/src/pages/JoinPage.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import JoinPage from "./JoinPage"

// Mock @react-oauth/google — provides a fake GoogleLogin button
vi.mock("@react-oauth/google", () => ({
  GoogleLogin: ({ onSuccess, onError }) => (
    <button
      data-testid="google-login-btn"
      onClick={() => onSuccess({ credential: "fake-id-token" })}
    >
      Sign in with Google
    </button>
  ),
}))

// Mock api.js
vi.mock("../api.js", () => ({
  api: {
    post: vi.fn(),
  },
}))

// Mock auth.js
vi.mock("../auth.js", () => ({
  setAuth: vi.fn(),
}))

// Mock react-router-dom navigate
const mockNavigate = vi.fn()
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useNavigate: () => mockNavigate }
})

import { api } from "../api.js"
import { setAuth } from "../auth.js"

function renderJoinPage() {
  return render(
    <MemoryRouter>
      <JoinPage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("JoinPage — Google OAuth flow", () => {
  it("renders the Google login button", () => {
    renderJoinPage()
    expect(screen.getByTestId("google-login-btn")).toBeInTheDocument()
  })

  it("renders the admin login toggle link", () => {
    renderJoinPage()
    expect(screen.getByText(/admin login/i)).toBeInTheDocument()
  })

  it("returning player: clicking Google button calls API and redirects", async () => {
    api.post.mockResolvedValue({
      status: "ok",
      token: "jwt-abc",
      player: { id: 1, name: "Hernan", token_balance: 1000 },
      league: { id: 1, name: "Test League" },
    })

    renderJoinPage()
    fireEvent.click(screen.getByTestId("google-login-btn"))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/api/auth/google", { id_token: "fake-id-token" })
      expect(setAuth).toHaveBeenCalledWith("jwt-abc", expect.objectContaining({ name: "Hernan" }), expect.objectContaining({ name: "Test League" }))
      expect(mockNavigate).toHaveBeenCalledWith("/")
    })
  })

  it("new player: API returns new_player status → shows invite code form", async () => {
    api.post.mockResolvedValue({
      status: "new_player",
      google_name: "Hernan Rosenblum",
      google_email: "hernan@gmail.com",
    })

    renderJoinPage()
    fireEvent.click(screen.getByTestId("google-login-btn"))

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/invite code/i)).toBeInTheDocument()
      // Pre-filled display name field
      expect(screen.getByDisplayValue("Hernan Rosenblum")).toBeInTheDocument()
    })
  })

  it("new player: submitting invite code registers and redirects", async () => {
    // First call → new_player
    api.post.mockResolvedValueOnce({
      status: "new_player",
      google_name: "Hernan Rosenblum",
      google_email: "hernan@gmail.com",
    })
    // Second call → ok
    api.post.mockResolvedValueOnce({
      status: "ok",
      token: "jwt-xyz",
      player: { id: 2, name: "Hernan Rosenblum", token_balance: 1000 },
      league: { id: 1, name: "Test League" },
    })

    renderJoinPage()
    fireEvent.click(screen.getByTestId("google-login-btn"))

    await waitFor(() => screen.getByPlaceholderText(/invite code/i))

    fireEvent.change(screen.getByPlaceholderText(/invite code/i), {
      target: { value: "friends2026" },
    })
    fireEvent.click(screen.getByRole("button", { name: /join the game/i }))

    await waitFor(() => {
      expect(api.post).toHaveBeenLastCalledWith("/api/auth/google", {
        id_token: "fake-id-token",
        invite_code: "friends2026",
        display_name: "Hernan Rosenblum",
      })
      expect(mockNavigate).toHaveBeenCalledWith("/")
    })
  })

  it("admin toggle reveals the name+code form", () => {
    renderJoinPage()
    // Admin form not visible initially
    expect(screen.queryByPlaceholderText(/your name/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByText(/admin login/i))

    expect(screen.getByPlaceholderText(/your name/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/admin code/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests — confirm they all FAIL**

```bash
cd frontend && npx vitest run src/pages/JoinPage.test.jsx 2>&1 | tail -20
```

Expected: Tests fail (JoinPage still has the old implementation).

---

## Task 9: Rewrite JoinPage.jsx

**Files:**
- Modify: `frontend/src/pages/JoinPage.jsx`

- [ ] **Step 1: Replace `JoinPage.jsx` entirely**

Replace the full contents of `frontend/src/pages/JoinPage.jsx` with:

```jsx
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { GoogleLogin } from "@react-oauth/google"
import { api } from "../api.js"
import { setAuth } from "../auth.js"

const CARD_STYLE = {
  position: "relative",
  background: "#13131f",
  border: "1px solid #2d2b55",
  borderRadius: 16,
  padding: 32,
  width: "100%",
  maxWidth: 360,
  boxShadow: "0 0 40px rgba(168,85,247,0.15)",
}

const INPUT_STYLE = {
  background: "#0c0c14",
  border: "1px solid #2d2b55",
  borderRadius: 8,
  padding: "10px 14px",
  color: "#e2e8f0",
  fontSize: 15,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
}

export default function JoinPage() {
  const navigate = useNavigate()

  // "idle" | "needs_invite"
  const [screen, setScreen] = useState("idle")
  const [idToken, setIdToken] = useState(null)
  const [displayName, setDisplayName] = useState("")
  const [inviteCode, setInviteCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showAdminForm, setShowAdminForm] = useState(false)

  // Admin form state
  const [adminName, setAdminName] = useState("")
  const [adminCode, setAdminCode] = useState("")
  const [adminError, setAdminError] = useState("")
  const [adminLoading, setAdminLoading] = useState(false)

  async function handleGoogleSuccess({ credential }) {
    setError("")
    setLoading(true)
    try {
      const data = await api.post("/api/auth/google", { id_token: credential })
      if (data.status === "ok") {
        setAuth(data.token, data.player, data.league ?? null)
        navigate("/")
      } else if (data.status === "new_player") {
        setIdToken(credential)
        setDisplayName(data.google_name || "")
        setScreen("needs_invite")
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleInviteSubmit(e) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const data = await api.post("/api/auth/google", {
        id_token: idToken,
        invite_code: inviteCode.trim(),
        display_name: displayName.trim(),
      })
      setAuth(data.token, data.player, data.league ?? null)
      navigate("/")
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleAdminSubmit(e) {
    e.preventDefault()
    setAdminError("")
    setAdminLoading(true)
    try {
      const data = await api.post("/api/auth/join", {
        name: adminName.trim(),
        code: adminCode.trim(),
        mode: "join",
      })
      setAuth(data.token, data.player, data.league ?? null)
      navigate("/")
    } catch (err) {
      setAdminError(err.message)
    } finally {
      setAdminLoading(false)
    }
  }

  const pageStyle = {
    minHeight: "100dvh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    background: "#0c0c14",
    backgroundImage: "url(https://upload.wikimedia.org/wikipedia/commons/2/2e/Argentina_3-3_Francia_-_Copa_Mundial_2022_-_Celebraci%C3%B3n_de_victoria.jpg)",
    backgroundSize: "cover",
    backgroundPosition: "center 30%",
    position: "relative",
  }

  return (
    <div style={pageStyle}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(12,12,20,0.82)" }} />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={CARD_STYLE}
      >
        <h1 className="gradient-text" style={{ fontSize: 28, fontWeight: 800, textAlign: "center", marginBottom: 24 }}>
          ⚡ WC Bets 2026
        </h1>

        {screen === "idle" && (
          <>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              {loading ? (
                <p style={{ color: "#6b7280", fontSize: 14 }}>Signing in…</p>
              ) : (
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError("Google sign-in failed. Please try again.")}
                  theme="filled_black"
                  size="large"
                  width="280"
                />
              )}
              {error && <p style={{ color: "#f87171", fontSize: 13, margin: 0, textAlign: "center" }}>{error}</p>}
              <p style={{ color: "#4b5563", fontSize: 12, textAlign: "center", marginTop: 4 }}>
                Returning? You'll go straight in.<br />
                New player? You'll enter your invite code next.
              </p>
            </div>

            <div style={{ marginTop: 24, borderTop: "1px solid #1e1e2e", paddingTop: 16, textAlign: "center" }}>
              <button
                type="button"
                onClick={() => setShowAdminForm(v => !v)}
                style={{ background: "none", border: "none", color: "#4b5563", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}
              >
                Admin login →
              </button>
            </div>

            {showAdminForm && (
              <form onSubmit={handleAdminSubmit} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
                <input
                  value={adminName}
                  onChange={e => setAdminName(e.target.value)}
                  placeholder="Your name"
                  required
                  maxLength={50}
                  style={INPUT_STYLE}
                />
                <input
                  value={adminCode}
                  onChange={e => setAdminCode(e.target.value)}
                  placeholder="Admin code"
                  type="password"
                  required
                  maxLength={30}
                  style={INPUT_STYLE}
                />
                {adminError && <p style={{ color: "#f87171", fontSize: 13, margin: 0 }}>{adminError}</p>}
                <button
                  type="submit"
                  disabled={adminLoading}
                  style={{
                    background: "linear-gradient(135deg, #a855f7, #3b82f6)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: adminLoading ? "not-allowed" : "pointer",
                    opacity: adminLoading ? 0.7 : 1,
                  }}
                >
                  {adminLoading ? "Signing in…" : "Sign in as admin"}
                </button>
              </form>
            )}
          </>
        )}

        {screen === "needs_invite" && (
          <form onSubmit={handleInviteSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#1a1a2e", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "linear-gradient(135deg,#a855f7,#3b82f6)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0,
              }}>
                {displayName.charAt(0).toUpperCase() || "?"}
              </div>
              <div>
                <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600 }}>{displayName}</div>
                <div style={{ color: "#6b7280", fontSize: 11 }}>via Google ✓</div>
              </div>
            </div>

            <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>Almost there! Enter your group's invite code to join.</p>

            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Display name"
              required
              maxLength={50}
              style={INPUT_STYLE}
            />
            <input
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value)}
              placeholder="Group invite code"
              type="password"
              required
              maxLength={30}
              style={INPUT_STYLE}
            />

            {error && <p style={{ color: "#f87171", fontSize: 13, margin: 0 }}>{error}</p>}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: "linear-gradient(135deg, #a855f7, #3b82f6)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "12px",
                fontSize: 15,
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Joining…" : "Join the game →"}
            </button>

            <button
              type="button"
              onClick={() => { setScreen("idle"); setIdToken(null); setError("") }}
              style={{ background: "none", border: "none", color: "#6b7280", fontSize: 12, cursor: "pointer" }}
            >
              ← Use a different Google account
            </button>
          </form>
        )}
      </motion.div>
    </div>
  )
}
```

- [ ] **Step 2: Run the frontend tests**

```bash
cd frontend && npx vitest run src/pages/JoinPage.test.jsx 2>&1 | tail -20
```

Expected:
```
✓ renders the Google login button
✓ renders the admin login toggle link
✓ returning player: clicking Google button calls API and redirects
✓ new player: API returns new_player status → shows invite code form
✓ new player: submitting invite code registers and redirects
✓ admin toggle reveals the name+code form
6 passed
```

- [ ] **Step 3: Run the full frontend test suite**

```bash
cd frontend && npx vitest run 2>&1 | tail -10
```

Expected: All existing tests pass. New tests pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/JoinPage.jsx frontend/src/pages/JoinPage.test.jsx
git commit -m "feat: rewrite JoinPage with Google OAuth two-state flow and admin toggle"
```

---

## Task 10: Manual smoke test + Google Console setup reminder

- [ ] **Step 1: Start dev environment**

```bash
# Terminal 1 — backend
cd backend && source venv/bin/activate && uvicorn app.main:app --reload

# Terminal 2 — frontend
cd frontend && npm run dev
```

- [ ] **Step 2: Verify migration ran**

Look for in backend logs:
```
Migration OK
```
(or no errors about missing columns)

- [ ] **Step 3: Confirm the join page looks right**

Open `http://localhost:5173/join`. You should see:
- ⚡ WC Bets 2026 header
- "Sign in with Google" button (may show grey/unstyled if `VITE_GOOGLE_CLIENT_ID` is not set — that's expected in dev without a real client ID)
- "Admin login →" link at the bottom

Clicking "Admin login →" should reveal the name + admin code form inline.

- [ ] **Step 4: Set up Google OAuth Client ID (one-time manual step)**

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
3. Application type: **Web application**
4. Authorized JavaScript origins (no redirect URIs needed):
   - `http://localhost:5173`
   - `https://airy-cat-production-f87a.up.railway.app`
5. Copy the **Client ID**
6. Add to `frontend/.env`: `VITE_GOOGLE_CLIENT_ID=<your-client-id>`
7. Add to Railway backend env vars: `GOOGLE_CLIENT_ID=<your-client-id>`
8. Add to Railway frontend env vars: `VITE_GOOGLE_CLIENT_ID=<your-client-id>`

- [ ] **Step 5: Full end-to-end test (requires real Client ID)**

Restart frontend with the env var set. Click "Sign in with Google", go through the flow, verify you land on the home page with your name showing in the TopBar.

- [ ] **Step 6: Final commit and push**

```bash
git add -A
git commit -m "chore: final Google OAuth integration — ready for deploy"
git push origin feat/google-oauth
```

---

## Summary of New Env Vars

| Variable | Where | Value |
|----------|-------|-------|
| `GOOGLE_CLIENT_ID` | Railway backend | Your OAuth Client ID from Google Console |
| `VITE_GOOGLE_CLIENT_ID` | Railway frontend | Same value as above |

Both can be the same string. The Client ID is **not secret** — it's safe to commit to `.env.example`.
