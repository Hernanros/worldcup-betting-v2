import { getToken, clearAuth } from "./auth.js"

const BASE = import.meta.env.VITE_API_URL || ""

async function request(method, path, body) {
  const token = getToken()
  const headers = { "Content-Type": "application/json" }
  if (token) headers["Authorization"] = `Bearer ${token}`

  const resp = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (resp.status === 401) {
    clearAuth()
    window.location.href = "/join"
    return
  }

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: "Unknown error" }))
    throw new Error(err.detail || JSON.stringify(err))
  }

  if (resp.status === 204) return null
  return resp.json()
}

export const api = {
  get: (path) => request("GET", path),
  post: (path, body) => request("POST", path, body),
}

export async function streamSuggestChallenge(matchId, onChunk, onDone) {
  const token = getToken()
  const resp = await fetch(`${BASE}/api/ai/suggest-challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ match_id: matchId }),
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: "Unknown error" }))
    onDone()
    throw new Error(err.detail || JSON.stringify(err))
  }

  if (!resp.body) { onDone(); return }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const lines = decoder.decode(value).split("\n")
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue
        const data = line.slice(6)
        if (data === "[DONE]") { onDone(); return }
        try {
          const parsed = JSON.parse(data)
          if (parsed.text) onChunk(parsed.text)
        } catch {}
      }
    }
  } finally {
    onDone()
  }
}
