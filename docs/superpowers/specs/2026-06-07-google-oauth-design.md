# Google OAuth Login — Design Spec
**Date:** 2026-06-07  
**Status:** Approved  
**Scope:** Replace name+code join flow with Google Sign-In; invite code becomes a one-time registration gate.

---

## Summary

Players sign in with Google. New players are asked for an invite code once to join a league; returning players go straight in. Admin login (name + ADMIN_CODE) is preserved via a hidden toggle on the join page. Display name comes from Google at registration but is editable on Screen 2 and later in settings.

---

## Data Model

### Migration: add two columns to `players`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `google_sub` | `String(200)` | UNIQUE, nullable, indexed | Google's stable user ID (`sub` claim from ID token). Primary identifier for OAuth players. |
| `email` | `String(200)` | nullable | Stored for display only; not used as a key. |

- Existing `UniqueConstraint("name", "league_id")` stays. Name conflicts on Screen 2 return `400 "Name already taken in this group"` — user edits the pre-filled name field and retries.
- `session_token`, `is_admin`, `league_id`, all other columns: unchanged.
- Migration follows the app's existing pattern: two `ALTER TABLE players ADD COLUMN IF NOT EXISTS` blocks in `_run_migrations()` in `main.py`. The `google_sub` uniqueness is enforced via a partial unique index (`WHERE google_sub IS NOT NULL`) so NULL admin players don't conflict.

---

## Backend

### New dependency
```
google-auth          # pip install google-auth
```

### New env var
`GOOGLE_CLIENT_ID` — the OAuth 2.0 Client ID from Google Console. Same value as `VITE_GOOGLE_CLIENT_ID` on the frontend.

Add to `app/config.py`:
```python
google_client_id: str = ""
```

### New endpoint: `POST /api/auth/google`

**File:** `backend/app/routers/auth.py`

**Request body:**
```json
{
  "id_token": "...",        // required — ID token from Google Sign-In SDK
  "invite_code": "...",     // required for new players only
  "display_name": "..."     // optional — overrides Google name; required on retry if name conflict
}
```

**Logic:**
1. Verify `id_token` using `google.oauth2.id_token.verify_oauth2_token()` with `GOOGLE_CLIENT_ID`.
2. Extract `sub`, `name`, `email` from verified token payload.
3. Look up `Player` by `google_sub == sub`:
   - **Found (returning player):** Issue JWT, return `{status: "ok", token, player, league}`. `invite_code` and `display_name` are ignored.
   - **Not found + no `invite_code` (new player, first call):** Return `200 {status: "new_player", google_name: name, google_email: email}`. Frontend transitions to `needs_invite` state, keeping the `id_token` in memory.
   - **Not found + `invite_code` provided (new player, second call):**
     - Validate `invite_code` → `403` if invalid.
     - Use `display_name` if provided, else fall back to Google `name`.
     - Create `Player(name=display_name, google_sub=sub, email=email, token_balance=1000, league_id=league.id)`.
     - On `IntegrityError` for name uniqueness → return `400 "Name already taken in this group"`.
     - Issue JWT, return `{status: "ok", token, player, league}`.

**`POST /api/auth/join`** — unchanged. Used by admin only.

---

## Frontend

### New dependency
```
@react-oauth/google
```

### New env var
`VITE_GOOGLE_CLIENT_ID` — same value as backend `GOOGLE_CLIENT_ID`.

### `main.jsx`
Wrap `<App />` in `<GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>`.

### `JoinPage.jsx` — rewritten

Two UI states managed with local React state:

**State `idle` (default):**
- WC Bets 2026 branding header (unchanged)
- `<GoogleLogin>` button from `@react-oauth/google` (primary action)
- Subtext: "Returning? You'll go straight in. New player? You'll enter your invite code next."
- `"Admin login →"` text link at the bottom → toggles `showAdminForm` state

**State `needs_invite` (new player only):**
- Shows Google avatar initial + display name + email as confirmation chip
- Pre-filled (editable) display name field — value initialised from Google `name`
- Invite code field (password type)
- Error display for `400` responses (name conflict, bad invite code)
- `"← Use a different Google account"` button → clears Google credential, returns to `idle`
- Submit → `POST /api/auth/google` with `{id_token, invite_code, display_name}`

**`onSuccess` callback from `<GoogleLogin>`:**
```
credential (id_token) received
→ POST /api/auth/google { id_token }
→ { status: "ok", token } → setAuth() → navigate("/")         // returning player
→ { status: "new_player", google_name, google_email }
    → set state to needs_invite, store id_token + google_name in local state  // new player
```

On Screen 2 submit:
```
→ POST /api/auth/google { id_token, invite_code, display_name }
→ { status: "ok", token } → setAuth() → navigate("/")
→ 400 name conflict → show error, name field highlighted
→ 403 bad invite code → show error on invite code field
```

**Admin toggle (`showAdminForm`):**
Renders the original name+code form inline in the same card. The 3-tab toggle (Join / Sign In / New Player) and original form JSX move into a collapsible section beneath the Google button. No separate route or page.

### Files changed
| File | Change |
|------|--------|
| `frontend/src/main.jsx` | Add `GoogleOAuthProvider` wrapper |
| `frontend/src/pages/JoinPage.jsx` | Rewrite (two states + admin toggle) |
| `backend/app/routers/auth.py` | Add `POST /api/auth/google` handler |
| `backend/app/models.py` | Add `google_sub`, `email` columns |
| `backend/app/config.py` | Add `google_client_id` setting |
| `backend/alembic/versions/xxxx_add_google_auth.py` | New migration |

### Files unchanged
`auth.js`, `api.js`, `TopBar.jsx`, `deps.py`, all other pages and routers — JWT format is identical, no consumer changes needed.

---

## Google Console Setup (manual, before deploy)

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials → Create OAuth 2.0 Client ID (Web application).
2. **Authorized JavaScript origins** (no redirect URIs needed):
   - `http://localhost:5173` (dev)
   - `https://airy-cat-production-f87a.up.railway.app` (prod)
3. Copy the Client ID → set as `GOOGLE_CLIENT_ID` in Railway backend env and `VITE_GOOGLE_CLIENT_ID` in Railway frontend env.

---

## Error Handling

| Scenario | Response | UX |
|----------|----------|----|
| Invalid/expired Google token | `400 "invalid google token"` | Toast error, return to idle |
| New player, no invite code sent | `200 { status: "new_player" }` | Frontend transitions to `needs_invite` state |
| Bad invite code | `403 "invalid invite code"` | Error on Screen 2 |
| Name conflict | `400 "Name already taken in this group"` | Error on Screen 2, name field highlighted |
| Google token valid but `GOOGLE_CLIENT_ID` mismatch | `400` | Toast error |

---

## Out of Scope

- Renaming display name after registration (settings page — future work)
- Multiple OAuth providers (GitHub, Apple)
- Linking an existing name+code account to a Google account
- Email verification or magic links
