const TOKEN_KEY = "wc_token"
const PLAYER_KEY = "wc_player"

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const getPlayer = () => {
  const raw = localStorage.getItem(PLAYER_KEY)
  return raw ? JSON.parse(raw) : null
}
export const setAuth = (token, player) => {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(PLAYER_KEY, JSON.stringify(player))
}
export const clearAuth = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(PLAYER_KEY)
}
export const isLoggedIn = () => Boolean(getToken())
