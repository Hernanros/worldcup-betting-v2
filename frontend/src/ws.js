import { getToken, getPlayer } from "./auth.js"

const WS_BASE = import.meta.env.VITE_WS_URL || "ws://localhost:8000"

let socket = null
const listeners = new Set()
let reconnectTimeout = null
let reconnectDelay = 1000

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function notify(event) {
  listeners.forEach((fn) => fn(event))
}

export function connectWS() {
  const player = getPlayer()
  const token = getToken()
  if (!player || !token) return

  if (socket && socket.readyState === WebSocket.OPEN) return

  socket = new WebSocket(`${WS_BASE}/ws/${player.id}?token=${token}`)

  socket.onmessage = (e) => {
    try { notify(JSON.parse(e.data)) } catch {}
  }

  socket.onclose = () => {
    socket = null
    reconnectTimeout = setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, 30000)
      connectWS()
    }, reconnectDelay)
  }

  socket.onopen = () => {
    reconnectDelay = 1000
  }
}

export function disconnectWS() {
  clearTimeout(reconnectTimeout)
  if (socket) {
    socket.onclose = null   // prevent reconnect handler from firing on intentional close
    socket.close()
    socket = null
  }
}
