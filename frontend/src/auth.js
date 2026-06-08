const TOKEN_KEY    = "wc_token"
const PLAYER_KEY   = "wc_player"
const LEAGUE_KEY   = "wc_league"
const SESSIONS_KEY = "wc_sessions"   // [{token, player, league}]

export const getToken  = () => localStorage.getItem(TOKEN_KEY)
export const getPlayer = () => {
  const raw = localStorage.getItem(PLAYER_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}
export const getLeague = () => {
  const raw = localStorage.getItem(LEAGUE_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

// ── Multi-session helpers ────────────────────────────────────────────────────
export const getSessions = () => {
  const raw = localStorage.getItem(SESSIONS_KEY)
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

/** Activate a saved session by player id. Returns false if not found. */
export const switchSession = (playerId) => {
  const s = getSessions().find(s => s.player.id === playerId)
  if (!s) return false
  localStorage.setItem(TOKEN_KEY,  s.token)
  localStorage.setItem(PLAYER_KEY, JSON.stringify(s.player))
  if (s.league) localStorage.setItem(LEAGUE_KEY, JSON.stringify(s.league))
  else          localStorage.removeItem(LEAGUE_KEY)
  return true
}

/** Remove a saved session (does not affect active session keys). */
export const removeSession = (playerId) => {
  const remaining = getSessions().filter(s => s.player.id !== playerId)
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(remaining))
}
// ─────────────────────────────────────────────────────────────────────────────

export const setAuth = (token, player, league = null) => {
  localStorage.setItem(TOKEN_KEY,  token)
  localStorage.setItem(PLAYER_KEY, JSON.stringify(player))
  if (league) localStorage.setItem(LEAGUE_KEY, JSON.stringify(league))
  else        localStorage.removeItem(LEAGUE_KEY)

  // Keep the sessions list in sync — upsert by player id
  const sessions = getSessions()
  const idx = sessions.findIndex(s => s.player.id === player.id)
  const entry = { token, player, league: league ?? null }
  if (idx >= 0) sessions[idx] = entry
  else sessions.push(entry)
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
}

export const clearAuth = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(PLAYER_KEY)
  localStorage.removeItem(LEAGUE_KEY)
  // Intentionally keep SESSIONS_KEY so the switcher can still show saved groups
}

export const isLoggedIn = () => Boolean(getToken())
