# World Cup Betting App v2 — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the React + Vite PWA frontend for the World Cup betting app — Electric Purple/Blue visual identity, bottom-tab navigation, live score updates via WebSocket, and an AI challenge generator page with SSE streaming typewriter output.

**Architecture:** Single-page React app (no SSR needed for a private friend group). Navigation via React Router with a persistent bottom tab bar. Global auth state in localStorage. WebSocket connection managed by a singleton module that broadcasts events to components via a simple pub/sub. All API calls go through a typed `api.js` wrapper that attaches the JWT token.

**Tech Stack:** React 18, Vite 5, React Router v6, Tailwind CSS v3, shadcn/ui, Framer Motion, Vitest, React Testing Library

**Prerequisite:** Backend must be running on `http://localhost:8000` with `INVITE_CODE=friends2026`.

---

## File Structure

```
frontend/
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── api.js              # fetch wrapper — attaches JWT, throws on error
│   ├── auth.js             # localStorage token/player helpers
│   ├── ws.js               # WebSocket singleton + pub/sub
│   ├── theme.js            # Electric Purple/Blue color constants
│   ├── components/
│   │   ├── BottomNav.jsx   # 5-tab bottom navigation bar
│   │   ├── TopBar.jsx      # gradient brand + live token balance
│   │   ├── MatchCard.jsx   # match tile: flags, score, status badge, action buttons
│   │   ├── BetPanel.jsx    # market selector + stake input + submit
│   │   ├── ChallengePanel.jsx  # issue / accept challenge UI
│   │   ├── PredictionRow.jsx   # score input stepper for one match
│   │   └── LeaderboardRow.jsx  # one player row: rank, name, balance, streak
│   └── pages/
│       ├── JoinPage.jsx
│       ├── MatchesPage.jsx
│       ├── MatchDetailPage.jsx
│       ├── BetsPage.jsx
│       ├── PredictionsPage.jsx
│       ├── LeaderboardPage.jsx
│       └── AIPage.jsx
├── index.html
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── package.json
└── .env.example
```

---

## Task 1: Scaffold — Vite + Tailwind + shadcn/ui

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.js`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/postcss.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.jsx`
- Create: `frontend/.env.example`

- [ ] **Step 1: Bootstrap Vite project**

```bash
cd /Users/hernanrosenblum/Documents/worldcup-betting-v2
npm create vite@latest frontend -- --template react
cd frontend
npm install
```

- [ ] **Step 2: Install dependencies**

```bash
npm install react-router-dom@6 framer-motion
npm install -D tailwindcss@3 postcss autoprefixer vitest @vitest/coverage-v8 @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
npx tailwindcss init -p
```

- [ ] **Step 3: Install shadcn/ui**

```bash
npx shadcn-ui@latest init
```

When prompted:
- Style: Default
- Base color: Slate
- CSS variables: Yes

Then add the components we need:
```bash
npx shadcn-ui@latest add button input toast card badge
```

- [ ] **Step 4: Update `frontend/tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0c0c14",
        surface: "#13131f",
        border: "#2d2b55",
        "text-primary": "#e2e8f0",
        "text-muted": "#6b7280",
        "accent-from": "#a855f7",
        "accent-to": "#3b82f6",
        live: "#ef4444",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

```bash
npm install tailwindcss-animate
```

- [ ] **Step 5: Update `frontend/src/main.jsx`**

```jsx
import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App.jsx"
import "./index.css"

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 6: Update global CSS `frontend/src/index.css`**

Replace the generated file entirely:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  * { box-sizing: border-box; }
  body {
    background-color: #0c0c14;
    color: #e2e8f0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    min-height: 100dvh;
  }
  ::-webkit-scrollbar { width: 0; height: 0; }
}

@layer utilities {
  .gradient-text {
    background: linear-gradient(90deg, #a855f7, #3b82f6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .gradient-bg {
    background: linear-gradient(135deg, #a855f7, #3b82f6);
  }
  .glow {
    box-shadow: 0 0 30px rgba(168, 85, 247, 0.15);
  }
}
```

- [ ] **Step 7: Create `frontend/.env.example`**

```
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

Copy to `.env`:
```bash
cp .env.example .env
```

- [ ] **Step 8: Update `frontend/vite.config.js`**

```js
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test-setup.js",
  },
  server: {
    proxy: {
      "/api": "http://localhost:8000",
      "/ws": { target: "ws://localhost:8000", ws: true },
    },
  },
})
```

- [ ] **Step 9: Create `frontend/src/test-setup.js`**

```js
import "@testing-library/jest-dom"
```

- [ ] **Step 10: Verify the scaffold runs**

```bash
npm run dev
```

Open `http://localhost:5173` — expect the default Vite React page with no errors in console.

- [ ] **Step 11: Commit**

```bash
cd /Users/hernanrosenblum/Documents/worldcup-betting-v2
git add frontend/
git commit -m "feat: frontend scaffold — Vite + React + Tailwind + shadcn/ui"
```

---

## Task 2: Core Utilities — api.js, auth.js, theme.js, ws.js

**Files:**
- Create: `frontend/src/api.js`
- Create: `frontend/src/auth.js`
- Create: `frontend/src/theme.js`
- Create: `frontend/src/ws.js`

- [ ] **Step 1: Create `frontend/src/auth.js`**

```js
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
```

- [ ] **Step 2: Create `frontend/src/api.js`**

```js
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

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()

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
  onDone()
}
```

- [ ] **Step 3: Create `frontend/src/theme.js`**

```js
export const theme = {
  background: "#0c0c14",
  surface: "#13131f",
  border: "#2d2b55",
  textPrimary: "#e2e8f0",
  textMuted: "#6b7280",
  accentFrom: "#a855f7",
  accentTo: "#3b82f6",
  live: "#ef4444",
  gradient: "linear-gradient(135deg, #a855f7, #3b82f6)",
  glow: "0 0 30px rgba(168, 85, 247, 0.15)",
}
```

- [ ] **Step 4: Create `frontend/src/ws.js`**

```js
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
  if (socket) { socket.close(); socket = null }
}
```

- [ ] **Step 5: Write tests for auth.js — `frontend/src/auth.test.js`**

```js
import { describe, it, expect, beforeEach } from "vitest"
import { setAuth, getToken, getPlayer, clearAuth, isLoggedIn } from "./auth.js"

describe("auth helpers", () => {
  beforeEach(() => clearAuth())

  it("stores and retrieves token", () => {
    setAuth("tok123", { id: 1, name: "Alice" })
    expect(getToken()).toBe("tok123")
  })

  it("stores and retrieves player", () => {
    setAuth("tok", { id: 2, name: "Bob", token_balance: 500 })
    expect(getPlayer().name).toBe("Bob")
    expect(getPlayer().token_balance).toBe(500)
  })

  it("isLoggedIn reflects token presence", () => {
    expect(isLoggedIn()).toBe(false)
    setAuth("tok", { id: 1, name: "X" })
    expect(isLoggedIn()).toBe(true)
  })

  it("clearAuth removes both keys", () => {
    setAuth("tok", { id: 1, name: "Y" })
    clearAuth()
    expect(getToken()).toBeNull()
    expect(getPlayer()).toBeNull()
  })
})
```

- [ ] **Step 6: Run tests**

```bash
npm run test
```

Expected: 4 tests PASS

- [ ] **Step 7: Commit**

```bash
git add frontend/src/api.js frontend/src/auth.js frontend/src/theme.js frontend/src/ws.js frontend/src/auth.test.js
git commit -m "feat: frontend core — api wrapper, auth helpers, WebSocket client, theme"
```

---

## Task 3: App Shell — Router, JoinPage, BottomNav, TopBar

**Files:**
- Modify: `frontend/src/App.jsx`
- Create: `frontend/src/pages/JoinPage.jsx`
- Create: `frontend/src/components/BottomNav.jsx`
- Create: `frontend/src/components/TopBar.jsx`

- [ ] **Step 1: Create `frontend/src/App.jsx`**

```jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { useEffect, useState } from "react"
import { isLoggedIn, getPlayer } from "./auth.js"
import { connectWS, disconnectWS } from "./ws.js"
import JoinPage from "./pages/JoinPage.jsx"
import MatchesPage from "./pages/MatchesPage.jsx"
import MatchDetailPage from "./pages/MatchDetailPage.jsx"
import BetsPage from "./pages/BetsPage.jsx"
import PredictionsPage from "./pages/PredictionsPage.jsx"
import LeaderboardPage from "./pages/LeaderboardPage.jsx"
import AIPage from "./pages/AIPage.jsx"
import BottomNav from "./components/BottomNav.jsx"
import TopBar from "./components/TopBar.jsx"

function ProtectedLayout({ children }) {
  const [balance, setBalance] = useState(getPlayer()?.token_balance ?? 0)

  useEffect(() => {
    connectWS()
    return () => disconnectWS()
  }, [])

  if (!isLoggedIn()) return <Navigate to="/join" replace />

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      <TopBar balance={balance} onBalanceChange={setBalance} />
      <main style={{ flex: 1, overflowY: "auto", paddingBottom: "72px" }}>
        {children}
      </main>
      <BottomNav />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/join" element={<JoinPage />} />
        <Route path="/" element={<ProtectedLayout><MatchesPage /></ProtectedLayout>} />
        <Route path="/matches/:id" element={<ProtectedLayout><MatchDetailPage /></ProtectedLayout>} />
        <Route path="/bets" element={<ProtectedLayout><BetsPage /></ProtectedLayout>} />
        <Route path="/predict" element={<ProtectedLayout><PredictionsPage /></ProtectedLayout>} />
        <Route path="/rankings" element={<ProtectedLayout><LeaderboardPage /></ProtectedLayout>} />
        <Route path="/ai" element={<ProtectedLayout><AIPage /></ProtectedLayout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 2: Create stub pages** (each is a minimal placeholder)

Create `frontend/src/pages/MatchesPage.jsx`:
```jsx
export default function MatchesPage() { return <div className="p-4">Matches</div> }
```

Repeat identically for: `MatchDetailPage.jsx`, `BetsPage.jsx`, `PredictionsPage.jsx`, `LeaderboardPage.jsx`, `AIPage.jsx`

- [ ] **Step 3: Create `frontend/src/components/TopBar.jsx`**

```jsx
import { useEffect } from "react"
import { subscribe } from "../ws.js"
import { api } from "../api.js"

export default function TopBar({ balance, onBalanceChange }) {
  useEffect(() => {
    const unsub = subscribe(async (event) => {
      if (event.type === "leaderboard_updated" || event.type === "match_settled") {
        const me = await api.get("/api/players/me").catch(() => null)
        if (me) onBalanceChange(me.token_balance)
      }
    })
    return unsub
  }, [onBalanceChange])

  return (
    <header style={{
      background: "#13131f",
      borderBottom: "1px solid #2d2b55",
      padding: "10px 16px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      position: "sticky",
      top: 0,
      zIndex: 50,
    }}>
      <span className="gradient-text" style={{ fontWeight: 800, fontSize: 16 }}>
        ⚡ WC Bets 2026
      </span>
      <span style={{
        background: "linear-gradient(135deg, #a855f7, #3b82f6)",
        color: "#fff",
        fontSize: 12,
        padding: "3px 10px",
        borderRadius: 999,
        fontWeight: 700,
      }}>
        {balance.toLocaleString()} tokens
      </span>
    </header>
  )
}
```

- [ ] **Step 4: Create `frontend/src/components/BottomNav.jsx`**

```jsx
import { NavLink } from "react-router-dom"

const tabs = [
  { to: "/", icon: "⚽", label: "Matches" },
  { to: "/bets", icon: "🏆", label: "Bets" },
  { to: "/predict", icon: "🎯", label: "Predict" },
  { to: "/rankings", icon: "📊", label: "Rankings" },
  { to: "/ai", icon: "🤖", label: "AI" },
]

export default function BottomNav() {
  return (
    <nav style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      background: "#13131f",
      borderTop: "1px solid #2d2b55",
      display: "flex",
      justifyContent: "space-around",
      padding: "8px 0",
      zIndex: 50,
    }}>
      {tabs.map(({ to, icon, label }) => (
        <NavLink key={to} to={to} end={to === "/"} style={{ textDecoration: "none" }}>
          {({ isActive }) => (
            <div style={{ textAlign: "center", minWidth: 56 }}>
              <div style={{ fontSize: 20 }}>{icon}</div>
              <div style={{
                fontSize: 10,
                fontWeight: isActive ? 700 : 400,
                background: isActive ? "linear-gradient(90deg, #a855f7, #3b82f6)" : undefined,
                WebkitBackgroundClip: isActive ? "text" : undefined,
                WebkitTextFillColor: isActive ? "transparent" : "#6b7280",
              }}>{label}</div>
            </div>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
```

- [ ] **Step 5: Create `frontend/src/pages/JoinPage.jsx`**

```jsx
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { api } from "../api.js"
import { setAuth } from "../auth.js"

export default function JoinPage() {
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleJoin(e) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const data = await api.post("/api/auth/join", { name: name.trim(), code: code.trim() })
      setAuth(data.token, data.player)
      navigate("/")
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      background: "#0c0c14",
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: "#13131f",
          border: "1px solid #2d2b55",
          borderRadius: 16,
          padding: 32,
          width: "100%",
          maxWidth: 360,
          boxShadow: "0 0 40px rgba(168,85,247,0.15)",
        }}
      >
        <h1 className="gradient-text" style={{ fontSize: 28, fontWeight: 800, textAlign: "center", marginBottom: 8 }}>
          ⚡ WC Bets 2026
        </h1>
        <p style={{ color: "#6b7280", textAlign: "center", marginBottom: 28, fontSize: 14 }}>
          Enter your name and invite code to join
        </p>

        <form onSubmit={handleJoin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            required
            style={{
              background: "#0c0c14",
              border: "1px solid #2d2b55",
              borderRadius: 8,
              padding: "10px 14px",
              color: "#e2e8f0",
              fontSize: 15,
              outline: "none",
              width: "100%",
            }}
          />
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Invite code"
            type="password"
            required
            style={{
              background: "#0c0c14",
              border: "1px solid #2d2b55",
              borderRadius: 8,
              padding: "10px 14px",
              color: "#e2e8f0",
              fontSize: 15,
              outline: "none",
              width: "100%",
            }}
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
            {loading ? "Joining..." : "Join the game"}
          </button>
        </form>
      </motion.div>
    </div>
  )
}
```

- [ ] **Step 6: Verify app renders**

```bash
npm run dev
```

Navigate to `http://localhost:5173` — should redirect to `/join`. Fill in name + `friends2026` code (backend must be running). Should reach the main layout with bottom nav.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/
git commit -m "feat: app shell — router, JoinPage, TopBar, BottomNav"
```

---

## Task 4: MatchCard + MatchesPage

**Files:**
- Create: `frontend/src/components/MatchCard.jsx`
- Modify: `frontend/src/pages/MatchesPage.jsx`

- [ ] **Step 1: Write component test — `frontend/src/components/MatchCard.test.jsx`**

```jsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import MatchCard from "./MatchCard.jsx"

const upcoming = {
  id: 1, home_team: "Argentina", away_team: "Brazil",
  kickoff_time: "2026-06-20T18:00:00Z", status: "upcoming",
  home_score: null, away_score: null, round: "group",
}

const live = {
  ...upcoming, status: "locked",
  home_score: 2, away_score: 1,
}

describe("MatchCard", () => {
  it("renders team names", () => {
    render(<MemoryRouter><MatchCard match={upcoming} /></MemoryRouter>)
    expect(screen.getByText("Argentina")).toBeInTheDocument()
    expect(screen.getByText("Brazil")).toBeInTheDocument()
  })

  it("shows score when available", () => {
    render(<MemoryRouter><MatchCard match={live} /></MemoryRouter>)
    expect(screen.getByText("2")).toBeInTheDocument()
    expect(screen.getByText("1")).toBeInTheDocument()
  })

  it("shows kickoff time for upcoming", () => {
    render(<MemoryRouter><MatchCard match={upcoming} /></MemoryRouter>)
    expect(screen.getByText(/Jun/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — expect failure**

```bash
npm test -- MatchCard
```

- [ ] **Step 3: Create `frontend/src/components/MatchCard.jsx`**

```jsx
import { Link } from "react-router-dom"
import { motion } from "framer-motion"

const FLAG = {
  Argentina: "🇦🇷", Brazil: "🇧🇷", France: "🇫🇷", Germany: "🇩🇪",
  England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", Spain: "🇪🇸", Portugal: "🇵🇹", Netherlands: "🇳🇱",
  Italy: "🇮🇹", Uruguay: "🇺🇾", Mexico: "🇲🇽", USA: "🇺🇸",
}

function getFlag(team) {
  return FLAG[team] || "🏳️"
}

function formatKickoff(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " · " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
}

export default function MatchCard({ match }) {
  const isLive = match.status === "locked" && match.home_score !== null
  const isFinished = match.status === "finished"
  const hasScore = match.home_score !== null && match.away_score !== null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.98 }}
    >
      <Link to={`/matches/${match.id}`} style={{ textDecoration: "none" }}>
        <div style={{
          background: "#13131f",
          border: "1px solid #2d2b55",
          borderRadius: 12,
          padding: "14px 16px",
          marginBottom: 10,
          boxShadow: isLive ? "0 0 20px rgba(168,85,247,0.12)" : "none",
        }}>
          {/* Status row */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
            {isLive && (
              <span style={{ color: "#ef4444", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ animation: "pulse 1.5s infinite" }}>●</span> LIVE
              </span>
            )}
            {isFinished && <span style={{ color: "#6b7280", fontSize: 10, fontWeight: 700 }}>FINISHED</span>}
            {!isLive && !isFinished && (
              <span style={{ color: "#6b7280", fontSize: 10 }}>{formatKickoff(match.kickoff_time)}</span>
            )}
          </div>

          {/* Teams + score row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontSize: 28 }}>{getFlag(match.home_team)}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", marginTop: 4 }}>{match.home_team}</div>
              {hasScore && (
                <div className="gradient-text" style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>
                  {match.home_score}
                </div>
              )}
            </div>

            <div style={{ textAlign: "center", padding: "0 12px", color: "#6b7280", fontSize: 12 }}>
              {hasScore ? "—" : "vs"}
            </div>

            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontSize: 28 }}>{getFlag(match.away_team)}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", marginTop: 4 }}>{match.away_team}</div>
              {hasScore && (
                <div className="gradient-text" style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>
                  {match.away_score}
                </div>
              )}
            </div>
          </div>

          {/* Round badge */}
          <div style={{ textAlign: "center", marginTop: 10 }}>
            <span style={{
              background: "#1e1b3a", border: "1px solid #2d2b55",
              color: "#a78bfa", fontSize: 9, fontWeight: 700,
              padding: "2px 8px", borderRadius: 999, textTransform: "uppercase", letterSpacing: 1,
            }}>
              {match.round}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
```

- [ ] **Step 4: Implement `frontend/src/pages/MatchesPage.jsx`**

```jsx
import { useState, useEffect } from "react"
import { api } from "../api.js"
import { subscribe } from "../ws.js"
import MatchCard from "../components/MatchCard.jsx"

const FILTERS = ["All", "Live", "Upcoming", "Finished"]

export default function MatchesPage() {
  const [matches, setMatches] = useState([])
  const [filter, setFilter] = useState("All")
  const [loading, setLoading] = useState(true)

  async function load() {
    const data = await api.get("/api/matches").catch(() => [])
    setMatches(data)
    setLoading(false)
  }

  useEffect(() => {
    load()
    const unsub = subscribe((e) => {
      if (e.type === "match_settled" || e.type === "score_update") load()
    })
    return unsub
  }, [])

  const filtered = matches.filter((m) => {
    if (filter === "All") return true
    if (filter === "Live") return m.status === "locked" && m.home_score !== null
    if (filter === "Upcoming") return m.status === "upcoming"
    if (filter === "Finished") return m.status === "finished"
    return true
  })

  return (
    <div style={{ padding: 16 }}>
      {/* Filter pills */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto" }}>
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              background: filter === f ? "linear-gradient(135deg,#a855f7,#3b82f6)" : "#1e1b3a",
              color: filter === f ? "#fff" : "#6b7280",
              border: "none",
              borderRadius: 999,
              padding: "5px 14px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: "#6b7280", textAlign: "center" }}>Loading matches...</p>}
      {!loading && filtered.length === 0 && (
        <p style={{ color: "#6b7280", textAlign: "center" }}>No matches found.</p>
      )}
      {filtered.map((m) => <MatchCard key={m.id} match={m} />)}
    </div>
  )
}
```

- [ ] **Step 5: Run tests**

```bash
npm test -- MatchCard
```

Expected: All 3 tests PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/MatchCard.jsx frontend/src/components/MatchCard.test.jsx frontend/src/pages/MatchesPage.jsx
git commit -m "feat: MatchCard component and MatchesPage with filter pills"
```

---

## Task 5: BetPanel + ChallengePanel + MatchDetailPage

**Files:**
- Create: `frontend/src/components/BetPanel.jsx`
- Create: `frontend/src/components/ChallengePanel.jsx`
- Modify: `frontend/src/pages/MatchDetailPage.jsx`

- [ ] **Step 1: Create `frontend/src/components/BetPanel.jsx`**

```jsx
import { useState } from "react"
import { motion } from "framer-motion"
import { api } from "../api.js"

const MARKETS = {
  "1x2": ["Home Win", "Draw", "Away Win"],
  "btts": ["Yes", "No"],
  "totals": ["Over 2.5", "Under 2.5", "Over 3.5", "Under 3.5"],
  "correct_score": [],
}

export default function BetPanel({ match, odds, onBetPlaced }) {
  const [betType, setBetType] = useState("1x2")
  const [selection, setSelection] = useState("")
  const [customScore, setCustomScore] = useState("")
  const [stake, setStake] = useState(100)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState("")

  const oddsForSelection = odds?.[betType]?.find(
    (o) => o.name === (betType === "correct_score" ? customScore : selection)
  )?.price

  async function submit() {
    const sel = betType === "correct_score" ? customScore : selection
    if (!sel) return setMsg("Pick a selection first")
    setLoading(true)
    setMsg("")
    try {
      const result = await api.post(`/api/matches/${match.id}/bets`, {
        bet_type: betType, selection: sel, stake, odds: oddsForSelection || 2.0,
      })
      setMsg(`✓ Bet placed! New balance: ${result.new_balance} tokens`)
      onBetPlaced?.(result.new_balance)
    } catch (err) {
      setMsg(`✗ ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: "#13131f", border: "1px solid #2d2b55", borderRadius: 12, padding: 16, marginBottom: 12 }}>
      <h3 style={{ color: "#a78bfa", fontWeight: 700, marginBottom: 12, fontSize: 14 }}>Place a Bet</h3>

      {/* Market selector */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {Object.keys(MARKETS).map((m) => (
          <button key={m} onClick={() => { setBetType(m); setSelection("") }}
            style={{
              background: betType === m ? "linear-gradient(135deg,#a855f7,#3b82f6)" : "#1e1b3a",
              color: betType === m ? "#fff" : "#6b7280",
              border: "none", borderRadius: 999, padding: "4px 12px",
              fontSize: 11, fontWeight: 600, cursor: "pointer",
            }}>
            {m}
          </button>
        ))}
      </div>

      {/* Selections */}
      {betType === "correct_score" ? (
        <input
          placeholder="e.g. 2-1"
          value={customScore}
          onChange={(e) => setCustomScore(e.target.value)}
          style={{ background: "#0c0c14", border: "1px solid #2d2b55", borderRadius: 8,
            padding: "8px 12px", color: "#e2e8f0", fontSize: 14, width: "100%", marginBottom: 10 }}
        />
      ) : (
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {MARKETS[betType].map((sel) => {
            const price = odds?.[betType]?.find((o) => o.name === sel)?.price
            return (
              <button key={sel} onClick={() => setSelection(sel)}
                style={{
                  background: selection === sel ? "linear-gradient(135deg,#a855f7,#3b82f6)" : "#0c0c14",
                  color: selection === sel ? "#fff" : "#e2e8f0",
                  border: "1px solid #2d2b55", borderRadius: 8, padding: "8px 14px",
                  fontSize: 12, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center",
                }}>
                <span>{sel}</span>
                {price && <span style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>{price}</span>}
              </button>
            )
          })}
        </div>
      )}

      {/* Stake */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ color: "#6b7280", fontSize: 12 }}>Stake:</span>
        <input type="number" min={1} value={stake} onChange={(e) => setStake(Number(e.target.value))}
          style={{ background: "#0c0c14", border: "1px solid #2d2b55", borderRadius: 8,
            padding: "6px 10px", color: "#e2e8f0", fontSize: 14, width: 100 }} />
        <span style={{ color: "#6b7280", fontSize: 12 }}>tokens</span>
        {oddsForSelection && (
          <span style={{ color: "#4ade80", fontSize: 12, marginLeft: "auto" }}>
            Win: {Math.floor(stake * oddsForSelection)}
          </span>
        )}
      </div>

      <button onClick={submit} disabled={loading}
        style={{
          width: "100%", background: "linear-gradient(135deg,#a855f7,#3b82f6)",
          color: "#fff", border: "none", borderRadius: 8, padding: "11px",
          fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}>
        {loading ? "Placing..." : "Place Bet"}
      </button>

      {msg && <p style={{ color: msg.startsWith("✓") ? "#4ade80" : "#f87171", fontSize: 12, marginTop: 8 }}>{msg}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Create `frontend/src/components/ChallengePanel.jsx`**

```jsx
import { useState } from "react"
import { api } from "../api.js"

export default function ChallengePanel({ match, challenges, onUpdate }) {
  const [issuerStake, setIssuerStake] = useState(100)
  const [issuerOdds, setIssuerOdds] = useState(3.0)
  const [acceptorOdds, setAcceptorOdds] = useState(1.5)
  const [selection, setSelection] = useState("")
  const [acceptorSelection, setAcceptorSelection] = useState("")
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState("")

  const acceptorStake = Math.max(1, Math.round(issuerStake * (issuerOdds / acceptorOdds)))

  async function issue() {
    if (!selection || !acceptorSelection) return setMsg("Fill in both picks")
    setLoading(true); setMsg("")
    try {
      const r = await api.post(`/api/matches/${match.id}/challenges`, {
        bet_type: "1x2", selection, acceptor_selection: acceptorSelection,
        issuer_stake: issuerStake, issuer_odds: issuerOdds, acceptor_odds: acceptorOdds,
      })
      setMsg(`✓ Challenge issued! Balance: ${r.new_balance}`)
      onUpdate?.()
    } catch (err) { setMsg(`✗ ${err.message}`) }
    finally { setLoading(false) }
  }

  async function accept(challengeId) {
    try {
      const r = await api.post(`/api/challenges/${challengeId}/accept`, {})
      setMsg(`✓ Challenge accepted! Balance: ${r.new_balance}`)
      onUpdate?.()
    } catch (err) { setMsg(`✗ ${err.message}`) }
  }

  return (
    <div style={{ background: "#13131f", border: "1px solid #2d2b55", borderRadius: 12, padding: 16, marginBottom: 12 }}>
      <h3 style={{ color: "#a78bfa", fontWeight: 700, marginBottom: 12, fontSize: 14 }}>Challenges</h3>

      {/* Issue form */}
      <div style={{ background: "#0c0c14", border: "1px solid #2d2b55", borderRadius: 10, padding: 12, marginBottom: 12 }}>
        <p style={{ color: "#6b7280", fontSize: 11, marginBottom: 8 }}>Issue a new challenge</p>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input placeholder="Your pick" value={selection} onChange={(e) => setSelection(e.target.value)}
            style={{ flex: 1, background: "#13131f", border: "1px solid #2d2b55", borderRadius: 6,
              padding: "6px 10px", color: "#e2e8f0", fontSize: 12 }} />
          <input placeholder="Their pick" value={acceptorSelection} onChange={(e) => setAcceptorSelection(e.target.value)}
            style={{ flex: 1, background: "#13131f", border: "1px solid #2d2b55", borderRadius: 6,
              padding: "6px 10px", color: "#e2e8f0", fontSize: 12 }} />
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8, fontSize: 11, color: "#6b7280", alignItems: "center" }}>
          <span>Your stake:</span>
          <input type="number" value={issuerStake} onChange={(e) => setIssuerStake(Number(e.target.value))}
            style={{ width: 70, background: "#13131f", border: "1px solid #2d2b55", borderRadius: 6,
              padding: "4px 8px", color: "#e2e8f0", fontSize: 12 }} />
          <span>Your odds:</span>
          <input type="number" step="0.1" value={issuerOdds} onChange={(e) => setIssuerOdds(Number(e.target.value))}
            style={{ width: 60, background: "#13131f", border: "1px solid #2d2b55", borderRadius: 6,
              padding: "4px 8px", color: "#e2e8f0", fontSize: 12 }} />
          <span>Their odds:</span>
          <input type="number" step="0.1" value={acceptorOdds} onChange={(e) => setAcceptorOdds(Number(e.target.value))}
            style={{ width: 60, background: "#13131f", border: "1px solid #2d2b55", borderRadius: 6,
              padding: "4px 8px", color: "#e2e8f0", fontSize: 12 }} />
        </div>
        <p style={{ color: "#a78bfa", fontSize: 11, marginBottom: 8 }}>
          Their counter-stake: <strong>{acceptorStake}</strong> tokens
        </p>
        <button onClick={issue} disabled={loading}
          style={{ background: "linear-gradient(135deg,#a855f7,#3b82f6)", color: "#fff",
            border: "none", borderRadius: 6, padding: "7px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          Issue Challenge
        </button>
      </div>

      {/* Open challenges */}
      {challenges?.length > 0 && (
        <div>
          <p style={{ color: "#6b7280", fontSize: 11, marginBottom: 8 }}>Open challenges</p>
          {challenges.map((c) => (
            <div key={c.id} style={{ background: "#0c0c14", border: "1px solid #2d2b55",
              borderRadius: 8, padding: 10, marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600 }}>{c.selection}</span>
                <span style={{ color: "#6b7280", fontSize: 11 }}> vs </span>
                <span style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600 }}>{c.acceptor_selection}</span>
                <div style={{ color: "#6b7280", fontSize: 10, marginTop: 2 }}>
                  {c.issuer_stake} vs {c.acceptor_stake} tokens
                </div>
              </div>
              <button onClick={() => accept(c.id)}
                style={{ background: "#1e1b3a", color: "#a78bfa", border: "1px solid #2d2b55",
                  borderRadius: 6, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                Accept
              </button>
            </div>
          ))}
        </div>
      )}

      {msg && <p style={{ color: msg.startsWith("✓") ? "#4ade80" : "#f87171", fontSize: 12, marginTop: 8 }}>{msg}</p>}
    </div>
  )
}
```

- [ ] **Step 3: Implement `frontend/src/pages/MatchDetailPage.jsx`**

```jsx
import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { api } from "../api.js"
import BetPanel from "../components/BetPanel.jsx"
import ChallengePanel from "../components/ChallengePanel.jsx"

export default function MatchDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    const data = await api.get(`/api/matches/${id}`).catch(() => null)
    if (!data) { navigate("/"); return }
    setMatch(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  if (loading) return <div style={{ padding: 24, color: "#6b7280", textAlign: "center" }}>Loading...</div>
  if (!match) return null

  const isUpcoming = match.status === "upcoming"

  return (
    <div style={{ padding: 16 }}>
      <button onClick={() => navigate(-1)}
        style={{ color: "#a78bfa", background: "none", border: "none", fontSize: 13, cursor: "pointer", marginBottom: 16 }}>
        ← Back
      </button>

      {/* Match header */}
      <div style={{ background: "#13131f", border: "1px solid #2d2b55", borderRadius: 12,
        padding: 20, marginBottom: 16, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 40 }}>🏳️</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#e2e8f0", marginTop: 4 }}>{match.home_team}</div>
            {match.home_score !== null && (
              <div className="gradient-text" style={{ fontSize: 32, fontWeight: 800, marginTop: 6 }}>{match.home_score}</div>
            )}
          </div>
          <div style={{ color: "#6b7280" }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
              {match.status === "locked" && match.home_score !== null ? "LIVE" : match.status}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 40 }}>🏳️</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#e2e8f0", marginTop: 4 }}>{match.away_team}</div>
            {match.away_score !== null && (
              <div className="gradient-text" style={{ fontSize: 32, fontWeight: 800, marginTop: 6 }}>{match.away_score}</div>
            )}
          </div>
        </div>
      </div>

      {isUpcoming && (
        <>
          <BetPanel match={match} odds={match.odds} onBetPlaced={() => {}} />
          <ChallengePanel match={match} challenges={match.open_challenges} onUpdate={load} />
        </>
      )}

      {!isUpcoming && (
        <p style={{ color: "#6b7280", textAlign: "center", fontSize: 14 }}>
          Betting is closed for this match.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/BetPanel.jsx frontend/src/components/ChallengePanel.jsx frontend/src/pages/MatchDetailPage.jsx
git commit -m "feat: BetPanel, ChallengePanel, MatchDetailPage"
```

---

## Task 6: BetsPage, PredictionsPage, LeaderboardPage

**Files:**
- Modify: `frontend/src/pages/BetsPage.jsx`
- Modify: `frontend/src/pages/PredictionsPage.jsx`
- Modify: `frontend/src/pages/LeaderboardPage.jsx`
- Create: `frontend/src/components/PredictionRow.jsx`
- Create: `frontend/src/components/LeaderboardRow.jsx`

- [ ] **Step 1: Create `frontend/src/components/LeaderboardRow.jsx`**

```jsx
import { getPlayer } from "../auth.js"

export default function LeaderboardRow({ player, rank }) {
  const me = getPlayer()
  const isMe = me?.id === player.id

  return (
    <div style={{
      background: isMe ? "linear-gradient(135deg, rgba(168,85,247,0.1), rgba(59,130,246,0.1))" : "#13131f",
      border: `1px solid ${isMe ? "#a855f7" : "#2d2b55"}`,
      borderRadius: 10,
      padding: "12px 16px",
      marginBottom: 8,
      display: "flex",
      alignItems: "center",
      gap: 14,
    }}>
      <span style={{
        fontSize: rank <= 3 ? 20 : 14,
        fontWeight: 800,
        color: rank === 1 ? "#fbbf24" : rank === 2 ? "#9ca3af" : rank === 3 ? "#cd7c2f" : "#6b7280",
        minWidth: 28,
      }}>
        {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: "#e2e8f0" }}>
          {player.name}{isMe && " (you)"}
        </div>
        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
          Streak: {player.challenge_streak} 🔥
        </div>
      </div>
      <div className="gradient-text" style={{ fontWeight: 800, fontSize: 16 }}>
        {player.token_balance.toLocaleString()}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implement `frontend/src/pages/LeaderboardPage.jsx`**

```jsx
import { useState, useEffect } from "react"
import { api } from "../api.js"
import { subscribe } from "../ws.js"
import LeaderboardRow from "../components/LeaderboardRow.jsx"

export default function LeaderboardPage() {
  const [players, setPlayers] = useState([])
  const [redCards, setRedCards] = useState([])
  const [tab, setTab] = useState("tokens")

  async function load() {
    const [p, r] = await Promise.all([
      api.get("/api/leaderboard").catch(() => []),
      api.get("/api/leaderboard/red-cards").catch(() => []),
    ])
    setPlayers(p)
    setRedCards(r)
  }

  useEffect(() => {
    load()
    const unsub = subscribe((e) => { if (e.type === "leaderboard_updated") load() })
    return unsub
  }, [])

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["tokens", "red-cards"].map((t) => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              background: tab === t ? "linear-gradient(135deg,#a855f7,#3b82f6)" : "#1e1b3a",
              color: tab === t ? "#fff" : "#6b7280", border: "none",
              borderRadius: 999, padding: "5px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>
            {t === "tokens" ? "🏆 Tokens" : "🟥 Red Cards"}
          </button>
        ))}
      </div>

      {tab === "tokens" && players.map((p) => (
        <LeaderboardRow key={p.id} player={p} rank={p.rank} />
      ))}

      {tab === "red-cards" && redCards.map((r) => (
        <div key={r.team} style={{ background: "#13131f", border: "1px solid #2d2b55",
          borderRadius: 10, padding: "10px 16px", marginBottom: 8,
          display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#e2e8f0", fontWeight: 600 }}>#{r.rank} {r.team}</span>
          <span style={{ color: "#ef4444", fontWeight: 700 }}>{r.red_cards} 🟥</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create `frontend/src/components/PredictionRow.jsx`**

```jsx
import { useState } from "react"
import { api } from "../api.js"

export default function PredictionRow({ entry, onSaved }) {
  const [home, setHome] = useState(entry.my_prediction?.home_score_pred ?? "")
  const [away, setAway] = useState(entry.my_prediction?.away_score_pred ?? "")
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState("")

  const locked = entry.status === "finished" || entry.status === "locked"
  const pred = entry.my_prediction

  async function save() {
    if (home === "" || away === "") return
    setSaving(true)
    try {
      await api.post("/api/predictions", {
        match_id: entry.match_id,
        home_score_pred: Number(home),
        away_score_pred: Number(away),
      })
      setMsg("✓ Saved")
      onSaved?.()
    } catch (err) { setMsg(`✗ ${err.message}`) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ background: "#13131f", border: "1px solid #2d2b55", borderRadius: 10, padding: 12, marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: "#e2e8f0" }}>
          {entry.home_team} vs {entry.away_team}
        </span>
        {pred && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
            background: pred.status === "correct_score" ? "#16a34a" :
                        pred.status === "correct_outcome" ? "#2563eb" : "#374151",
            color: "#fff",
          }}>
            {pred.status === "correct_score" ? `+3 pts ✓` :
             pred.status === "correct_outcome" ? `+1 pt ~` :
             pred.status === "wrong" ? "Wrong" : "Pending"}
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
        <input type="number" min={0} value={home} onChange={(e) => setHome(e.target.value)}
          disabled={locked}
          style={{ width: 52, background: "#0c0c14", border: "1px solid #2d2b55", borderRadius: 6,
            padding: "5px 8px", color: "#e2e8f0", fontSize: 14, textAlign: "center" }} />
        <span style={{ color: "#6b7280", fontSize: 12 }}>—</span>
        <input type="number" min={0} value={away} onChange={(e) => setAway(e.target.value)}
          disabled={locked}
          style={{ width: 52, background: "#0c0c14", border: "1px solid #2d2b55", borderRadius: 6,
            padding: "5px 8px", color: "#e2e8f0", fontSize: 14, textAlign: "center" }} />
        {!locked && (
          <button onClick={save} disabled={saving}
            style={{ background: "linear-gradient(135deg,#a855f7,#3b82f6)", color: "#fff",
              border: "none", borderRadius: 6, padding: "5px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            {saving ? "..." : "Save"}
          </button>
        )}
        {msg && <span style={{ fontSize: 11, color: msg.startsWith("✓") ? "#4ade80" : "#f87171" }}>{msg}</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Implement `frontend/src/pages/PredictionsPage.jsx`**

```jsx
import { useState, useEffect } from "react"
import { api } from "../api.js"
import PredictionRow from "../components/PredictionRow.jsx"

export default function PredictionsPage() {
  const [entries, setEntries] = useState([])
  const totalPoints = entries.reduce((acc, e) => acc + (e.my_prediction?.points_awarded || 0), 0)

  async function load() {
    const data = await api.get("/api/predictions").catch(() => [])
    setEntries(data)
  }

  useEffect(() => { load() }, [])

  return (
    <div style={{ padding: 16 }}>
      <div style={{ background: "#13131f", border: "1px solid #2d2b55", borderRadius: 10,
        padding: "10px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "#6b7280", fontSize: 13 }}>Your total points</span>
        <span className="gradient-text" style={{ fontWeight: 800, fontSize: 18 }}>{totalPoints} pts</span>
      </div>
      {entries.map((e) => <PredictionRow key={e.match_id} entry={e} onSaved={load} />)}
    </div>
  )
}
```

- [ ] **Step 5: Implement `frontend/src/pages/BetsPage.jsx`**

```jsx
import { useState, useEffect } from "react"
import { api } from "../api.js"

const STATUS_COLOR = { pending: "#fbbf24", won: "#4ade80", lost: "#f87171" }

export default function BetsPage() {
  const [bets, setBets] = useState([])
  const [tournament, setTournament] = useState(null)
  const [tab, setTab] = useState("match")

  async function load() {
    const [b, t] = await Promise.all([
      api.get("/api/matches").then(async (matches) => {
        const allBets = []
        return allBets
      }).catch(() => []),
      api.get("/api/tournament/bets").catch(() => null),
    ])
    setTournament(t)
  }

  useEffect(() => { load() }, [])

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["match", "tournament"].map((t) => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              background: tab === t ? "linear-gradient(135deg,#a855f7,#3b82f6)" : "#1e1b3a",
              color: tab === t ? "#fff" : "#6b7280", border: "none",
              borderRadius: 999, padding: "5px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>
            {t === "match" ? "⚽ Match Bets" : "🏆 Tournament"}
          </button>
        ))}
      </div>

      {tab === "tournament" && tournament && (
        <div>
          <div style={{ background: "#13131f", border: "1px solid #2d2b55", borderRadius: 10,
            padding: "10px 16px", marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#6b7280", fontSize: 12 }}>Status</span>
            <span style={{ color: tournament.locked ? "#ef4444" : "#4ade80", fontWeight: 700, fontSize: 12 }}>
              {tournament.locked ? "🔒 Locked" : "🔓 Open"}
            </span>
          </div>
          {tournament.my_bets.map((b) => (
            <div key={b.id} style={{ background: "#13131f", border: "1px solid #2d2b55",
              borderRadius: 10, padding: 12, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 13 }}>{b.bet_type.replace("_", " ")}</span>
                <span style={{ color: STATUS_COLOR[b.status] || "#fbbf24", fontSize: 11, fontWeight: 700 }}>{b.status}</span>
              </div>
              <div style={{ color: "#a78bfa", fontSize: 13, marginTop: 4 }}>{b.selection}</div>
              <div style={{ color: "#6b7280", fontSize: 11, marginTop: 4 }}>
                {b.stake} tokens @ {b.odds}x → win {Math.floor(b.stake * b.odds)}
              </div>
            </div>
          ))}
          {tournament.my_bets.length === 0 && (
            <p style={{ color: "#6b7280", textAlign: "center", fontSize: 13 }}>
              No tournament bets yet.{!tournament.locked && " Go to a match to bet on long-term markets."}
            </p>
          )}
        </div>
      )}

      {tab === "match" && (
        <p style={{ color: "#6b7280", textAlign: "center", fontSize: 13 }}>
          Place bets from the match detail page.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ frontend/src/pages/
git commit -m "feat: BetsPage, PredictionsPage, LeaderboardPage, PredictionRow, LeaderboardRow"
```

---

## Task 7: AIPage — Streaming Challenge Generator

**Files:**
- Modify: `frontend/src/pages/AIPage.jsx`

- [ ] **Step 1: Implement `frontend/src/pages/AIPage.jsx`**

```jsx
import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { api, streamSuggestChallenge } from "../api.js"

export default function AIPage() {
  const [matches, setMatches] = useState([])
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [streaming, setStreaming] = useState(false)
  const [text, setText] = useState("")
  const [done, setDone] = useState(false)
  const outputRef = useRef(null)

  useEffect(() => {
    api.get("/api/matches")
      .then((data) => setMatches(data.filter((m) => m.status === "upcoming")))
      .catch(() => [])
  }, [])

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [text])

  async function generate() {
    if (!selectedMatch) return
    setText("")
    setDone(false)
    setStreaming(true)

    await streamSuggestChallenge(
      selectedMatch.id,
      (chunk) => setText((prev) => prev + chunk),
      () => { setDone(true); setStreaming(false) },
    )
  }

  return (
    <div style={{ padding: 16, maxWidth: 480, margin: "0 auto" }}>
      <h2 className="gradient-text" style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>
        🤖 AI Challenge Generator
      </h2>
      <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 20 }}>
        Pick a match and Claude will suggest spicy challenge ideas based on the current odds.
      </p>

      {/* Match picker */}
      <div style={{ marginBottom: 16 }}>
        <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: 1, marginBottom: 8 }}>Select a match</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {matches.length === 0 && (
            <p style={{ color: "#6b7280", fontSize: 13 }}>No upcoming matches.</p>
          )}
          {matches.map((m) => (
            <button key={m.id} onClick={() => setSelectedMatch(m)}
              style={{
                background: selectedMatch?.id === m.id
                  ? "linear-gradient(135deg, rgba(168,85,247,0.2), rgba(59,130,246,0.2))"
                  : "#13131f",
                border: `1px solid ${selectedMatch?.id === m.id ? "#a855f7" : "#2d2b55"}`,
                borderRadius: 10, padding: "10px 14px",
                color: "#e2e8f0", fontSize: 13, fontWeight: 600, textAlign: "left", cursor: "pointer",
              }}>
              {m.home_team} vs {m.away_team}
              <span style={{ color: "#6b7280", fontSize: 11, marginLeft: 8 }}>{m.round}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={generate}
        disabled={!selectedMatch || streaming}
        style={{
          width: "100%",
          background: !selectedMatch || streaming
            ? "#1e1b3a"
            : "linear-gradient(135deg, #a855f7, #3b82f6)",
          color: !selectedMatch || streaming ? "#6b7280" : "#fff",
          border: "none", borderRadius: 10, padding: "13px",
          fontSize: 15, fontWeight: 700, cursor: !selectedMatch || streaming ? "not-allowed" : "pointer",
          marginBottom: 20,
        }}
      >
        {streaming ? "✨ Generating..." : "✨ Generate Challenge Ideas"}
      </motion.button>

      {/* Output */}
      <AnimatePresence>
        {(text || streaming) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            ref={outputRef}
            style={{
              background: "#13131f",
              border: "1px solid #2d2b55",
              borderRadius: 12,
              padding: 16,
              maxHeight: 400,
              overflowY: "auto",
              whiteSpace: "pre-wrap",
              color: "#e2e8f0",
              fontSize: 14,
              lineHeight: 1.7,
            }}
          >
            {text}
            {streaming && (
              <span style={{
                display: "inline-block",
                width: 8, height: 14,
                background: "linear-gradient(135deg,#a855f7,#3b82f6)",
                borderRadius: 2,
                marginLeft: 2,
                animation: "pulse 1s infinite",
                verticalAlign: "middle",
              }} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {done && text && (
        <p style={{ color: "#4ade80", fontSize: 12, textAlign: "center", marginTop: 12 }}>
          ✓ Done — go to the match page to issue one of these challenges!
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify end-to-end** (backend must be running)

```bash
# In backend/: uvicorn app.main:app --reload --port 8000
# In frontend/: npm run dev
```

Open `http://localhost:5173/ai`, select a match, click Generate — should see streaming text appear word by word.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/AIPage.jsx
git commit -m "feat: AIPage — streaming Claude challenge generator with typewriter effect"
```

---

## Task 8: Final Polish + Build Verification

- [ ] **Step 1: Run frontend tests**

```bash
npm test
```

Expected: All tests PASS

- [ ] **Step 2: Build for production**

```bash
npm run build
```

Expected: `dist/` folder created, no build errors.

- [ ] **Step 3: Preview production build**

```bash
npm run preview
```

Open `http://localhost:4173` — smoke-test the join flow, match list, leaderboard, and AI page.

- [ ] **Step 4: Create `.gitignore` additions**

```bash
echo "node_modules/\ndist/\n.env" >> frontend/.gitignore
```

- [ ] **Step 5: Final commit**

```bash
git add frontend/
git commit -m "chore: production build verified, .gitignore updated"
```

---

*Backend plan: `2026-05-20-worldcup-betting-v2-backend.md`*
