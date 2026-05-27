const TOKEN_KEY  = "wc_token"
const PLAYER_KEY = "wc_player"
const LEAGUE_KEY = "wc_league"

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
export const setAuth = (token, player, league = null) => {
  localStorage.setItem(TOKEN_KEY,  token)
  localStorage.setItem(PLAYER_KEY, JSON.stringify(player))
  if (league) localStorage.setItem(LEAGUE_KEY, JSON.stringify(league))
  else        localStorage.removeItem(LEAGUE_KEY)
}
export const clearAuth = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(PLAYER_KEY)
  localStorage.removeItem(LEAGUE_KEY)
}
export const isLoggedIn = () => Boolean(getToken())
