# Home Dashboard & App Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a home dashboard, shrink the PageHero to a compact strip, separate tournament/match predictions, and clean up navigation.

**Architecture:** Four sequential changes — bug fix → hero resize → predictions restructure → new HomePage + routing. Each produces a working, committed state. No new API endpoints needed; all data comes from existing endpoints.

**Tech Stack:** React 18, React Router v6, existing `api.js` fetch helper, localStorage auth via `auth.js`

**Working directory:** `/Users/hernanrosenblum/Documents/worldcup-betting-v2/frontend`

**Run tests:** `npm test -- --run` from `frontend/`

---

## File Map

| File | Change |
|---|---|
| `src/pages/PredictionsPage.jsx` | Fix momentKey bug; add Tournament tab |
| `src/components/PageHero.jsx` | Change default height prop to 60 |
| `src/pages/SandboxPage.jsx` | Pass explicit height+opacity to restore full hero |
| `src/pages/BetsPage.jsx` | **Delete** (content moves to PredictionsPage) |
| `src/pages/HomePage.jsx` | **Create** — dashboard with 4 sections |
| `src/App.jsx` | Update routes: `/` → HomePage, `/matches` → MatchesPage, remove `/bets` |
| `src/components/BottomNav.jsx` | 5 tabs: Home · Matches · Predict · Rankings · AI |

---

## Task 1 — Bug Fix: PredictionsPage momentKey

**Files:**
- Modify: `src/pages/PredictionsPage.jsx`

- [ ] **Open `src/pages/PredictionsPage.jsx`.** Find line:
  ```jsx
  <PageHero momentKey="baggio_1994" />
  ```

- [ ] **Change to:**
  ```jsx
  <PageHero momentKey="italy_2006" />
  ```

- [ ] **Verify** — run the app and navigate to `/predict`. The hero should show Buffon (Italy 2006 WC Final) instead of falling back to Maradona.

- [ ] **Commit:**
  ```bash
  git add src/pages/PredictionsPage.jsx
  git commit -m "fix: PredictionsPage hero — use italy_2006 not deleted baggio_1994 key"
  ```

---

## Task 2 — PageHero: compact background strip

**Files:**
- Modify: `src/components/PageHero.jsx`
- Modify: `src/pages/SandboxPage.jsx`

- [ ] **In `src/components/PageHero.jsx`**, change the default height prop from `"max(220px, 30vw)"` to `60`:

  ```jsx
  export default function PageHero({ momentKey, height = 60, overlayOpacity = 0.82 }) {
  ```

  No other changes — the component already accepts height as a number (renders as px via `style={{ height }}`) or string.

- [ ] **Open `src/pages/SandboxPage.jsx`**. Find the PageHero usage. Add explicit props to restore its full cinematic size:

  ```jsx
  <PageHero momentKey="rotating" height="max(220px, 30vw)" overlayOpacity={0.82} />
  ```

- [ ] **Verify** — navigate each page. Heroes should be a thin 60px strip. Sandbox should still show the full tall rotating hero.

- [ ] **Run tests:**
  ```bash
  npm test -- --run
  ```
  Expected: all pass (PageHero tests check rendering, not pixel height).

- [ ] **Commit:**
  ```bash
  git add src/components/PageHero.jsx src/pages/SandboxPage.jsx
  git commit -m "feat: PageHero default height 60px compact strip; sandbox keeps full hero"
  ```

---

## Task 3 — Predictions: add Tournament tab; remove BetsPage

**Files:**
- Modify: `src/pages/PredictionsPage.jsx`
- Delete: `src/pages/BetsPage.jsx`

### 3a — Add Tournament tab to PredictionsPage

- [ ] **Replace `src/pages/PredictionsPage.jsx`** entirely with:

  ```jsx
  import { useState, useEffect } from "react"
  import { api } from "../api.js"
  import PredictionRow from "../components/PredictionRow.jsx"
  import TournamentBetPanel from "../components/TournamentBetPanel.jsx"
  import PageHero from "../components/PageHero.jsx"

  const STATUS_COLOR = { pending: "#fbbf24", won: "#4ade80", lost: "#f87171" }

  export default function PredictionsPage() {
    const [tab, setTab] = useState("match")
    const [entries, setEntries] = useState([])
    const [tournament, setTournament] = useState(null)
    const [error, setError] = useState(null)

    const totalPoints = entries.reduce((acc, e) => acc + (e.my_prediction?.points_awarded || 0), 0)

    async function loadMatch() {
      setError(null)
      try {
        const data = await api.get("/api/predictions")
        setEntries(data)
      } catch (err) {
        setError(err.message || "Failed to load predictions")
      }
    }

    async function loadTournament() {
      setError(null)
      try {
        const t = await api.get("/api/tournament/bets")
        setTournament(t)
      } catch (err) {
        setError(err.message || "Failed to load tournament bets")
      }
    }

    useEffect(() => {
      loadMatch()
      loadTournament()
    }, [])

    return (
      <div>
        <PageHero momentKey="italy_2006" />
        <div style={{ padding: 16 }}>
          {/* Tab pills */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {[
              { key: "match", label: "⚽ Match" },
              { key: "tournament", label: "🏆 Tournament" },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setTab(key)}
                style={{
                  background: tab === key ? "linear-gradient(135deg,#a855f7,#3b82f6)" : "#1e1b3a",
                  color: tab === key ? "#fff" : "#6b7280", border: "none",
                  borderRadius: 999, padding: "5px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>
                {label}
              </button>
            ))}
          </div>

          {error && <p style={{ color: "#f87171", textAlign: "center", fontSize: 13 }}>⚠ {error}</p>}

          {/* ── MATCH TAB ──────────────────────────────── */}
          {tab === "match" && (
            <div>
              <div style={{
                background: "#13131f", border: "1px solid #2d2b55", borderRadius: 10,
                padding: "10px 16px", marginBottom: 16,
                display: "flex", justifyContent: "space-between",
              }}>
                <span style={{ color: "#6b7280", fontSize: 13 }}>Your total points</span>
                <span className="gradient-text" style={{ fontWeight: 800, fontSize: 18 }}>{totalPoints} pts</span>
              </div>
              {entries.map((e) => <PredictionRow key={e.match_id} entry={e} onSaved={loadMatch} />)}
            </div>
          )}

          {/* ── TOURNAMENT TAB ─────────────────────────── */}
          {tab === "tournament" && (
            <div>
              <div style={{
                background: "#13131f", border: "1px solid #2d2b55",
                borderRadius: 12, padding: 16, marginBottom: 16,
              }}>
                <h3 style={{ color: "#a78bfa", fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
                  Place a Long-Term Bet
                </h3>
                <TournamentBetPanel onBetPlaced={loadTournament} />
              </div>

              {tournament && tournament.my_bets.length > 0 && (
                <div>
                  <h3 style={{
                    color: "#6b7280", fontSize: 12, fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: 1, marginBottom: 10,
                  }}>
                    Your Tournament Bets
                  </h3>
                  {tournament.my_bets.map((b) => (
                    <div key={b.id} style={{
                      background: "#13131f", border: "1px solid #2d2b55",
                      borderRadius: 10, padding: 12, marginBottom: 8,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{
                            color: "#6b7280", fontSize: 10, fontWeight: 700,
                            textTransform: "uppercase", letterSpacing: 1, marginBottom: 2,
                          }}>
                            {b.bet_type.replaceAll("_", " ")}
                          </div>
                          <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 14 }}>{b.selection}</div>
                          <div style={{ color: "#6b7280", fontSize: 11, marginTop: 4 }}>
                            {b.stake} tokens @ {b.odds}x →{" "}
                            <span style={{ color: "#4ade80" }}>win {Math.floor(b.stake * b.odds).toLocaleString()}</span>
                          </div>
                        </div>
                        <span style={{
                          color: STATUS_COLOR[b.status] || "#fbbf24",
                          fontSize: 10, fontWeight: 700,
                          background: "#0c0c14", padding: "3px 8px",
                          borderRadius: 999, border: "1px solid #2d2b55",
                        }}>
                          {b.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tournament && tournament.my_bets.length === 0 && (
                <p style={{ color: "#6b7280", textAlign: "center", fontSize: 13, marginTop: 8 }}>
                  No tournament bets yet — pick one above! 👆
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }
  ```

### 3b — Delete BetsPage

- [ ] **Delete `src/pages/BetsPage.jsx`:**
  ```bash
  git rm src/pages/BetsPage.jsx
  ```

- [ ] **Verify** — navigate to `/predict`, switch tabs. Match tab shows prediction rows + points. Tournament tab shows TournamentBetPanel + existing bets.

- [ ] **Commit:**
  ```bash
  git add src/pages/PredictionsPage.jsx
  git commit -m "feat: split Match/Tournament tabs on PredictionsPage; remove BetsPage"
  ```

---

## Task 4 — Create HomePage

**Files:**
- Create: `src/pages/HomePage.jsx`

- [ ] **Create `src/pages/HomePage.jsx`** with this full content:

  ```jsx
  import { useState, useEffect } from "react"
  import { useNavigate } from "react-router-dom"
  import { api } from "../api.js"
  import { getPlayer } from "../auth.js"
  import MatchCard from "../components/MatchCard.jsx"
  import LeaderboardRow from "../components/LeaderboardRow.jsx"
  import PageHero from "../components/PageHero.jsx"

  export default function HomePage() {
    const navigate = useNavigate()
    const player = getPlayer()

    const [upcomingMatches, setUpcomingMatches] = useState([])
    const [activeBets, setActiveBets] = useState([])
    const [leaderboard, setLeaderboard] = useState([])
    const [predictionPts, setPredictionPts] = useState(0)
    const [myRank, setMyRank] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
      async function load() {
        try {
          const [matches, predictions, tournamentData, lb] = await Promise.all([
            api.get("/api/matches"),
            api.get("/api/predictions"),
            api.get("/api/tournament/bets").catch(() => ({ my_bets: [] })),
            api.get("/api/leaderboard"),
          ])

          // Upcoming matches — sort by date, take first 3
          const upcoming = matches
            .filter((m) => m.status === "upcoming")
            .slice(0, 3)
          setUpcomingMatches(upcoming)

          // Prediction points
          const pts = predictions.reduce((acc, e) => acc + (e.my_prediction?.points_awarded || 0), 0)
          setPredictionPts(pts)

          // Active (pending) bets
          const pending = (tournamentData.my_bets || []).filter((b) => b.status === "pending")
          setActiveBets(pending)

          // Leaderboard — top 3 + me
          setLeaderboard(lb)
          const me = lb.find((p) => p.id === player?.id)
          setMyRank(me?.rank ?? null)
        } finally {
          setLoading(false)
        }
      }
      load()
    }, [])

    const top3 = leaderboard.slice(0, 3)
    const myEntry = leaderboard.find((p) => p.id === player?.id)
    const myRankInTop3 = top3.some((p) => p.id === player?.id)

    return (
      <div>
        <PageHero momentKey="rotating" />

        <div style={{ padding: 16 }}>

          {/* ── MY STATS ─────────────────────────────────── */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20,
          }}>
            {[
              { label: "💰 Tokens", value: (player?.token_balance ?? 0).toLocaleString() },
              { label: "🎯 Pred. pts", value: loading ? "…" : `${predictionPts}` },
              { label: "📊 Rank", value: loading ? "…" : (myRank ? `#${myRank}` : "—") },
            ].map(({ label, value }) => (
              <div key={label} style={{
                background: "#13131f", border: "1px solid #2d2b55",
                borderRadius: 10, padding: "10px 8px", textAlign: "center",
              }}>
                <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 4 }}>{label}</div>
                <div className="gradient-text" style={{ fontWeight: 800, fontSize: 16 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* ── UPCOMING MATCHES ─────────────────────────── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10,
            }}>
              <h2 style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: 1, margin: 0 }}>
                Next Matches
              </h2>
              <button onClick={() => navigate("/matches")} style={{
                background: "none", border: "none", color: "#a78bfa",
                fontSize: 12, cursor: "pointer", padding: 0,
              }}>
                See all →
              </button>
            </div>
            {loading && <p style={{ color: "#6b7280", fontSize: 13, textAlign: "center" }}>Loading…</p>}
            {!loading && upcomingMatches.length === 0 && (
              <p style={{ color: "#6b7280", fontSize: 13, textAlign: "center" }}>No upcoming matches</p>
            )}
            {upcomingMatches.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>

          {/* ── ACTIVE BETS ──────────────────────────────── */}
          {!loading && activeBets.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h2 style={{
                color: "#e2e8f0", fontSize: 13, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: 1, marginBottom: 10,
              }}>
                Active Bets
              </h2>
              {activeBets.map((b) => (
                <div key={b.id} style={{
                  background: "#13131f", border: "1px solid #2d2b55",
                  borderRadius: 10, padding: "10px 14px", marginBottom: 8,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div>
                    <div style={{ color: "#6b7280", fontSize: 10, fontWeight: 700,
                      textTransform: "uppercase", letterSpacing: 1 }}>
                      {b.bet_type.replaceAll("_", " ")}
                    </div>
                    <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 13 }}>{b.selection}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "#fbbf24", fontSize: 10, fontWeight: 700 }}>PENDING</div>
                    <div style={{ color: "#4ade80", fontSize: 12, fontWeight: 600 }}>
                      +{Math.floor(b.stake * b.odds).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── LEADERBOARD PREVIEW ──────────────────────── */}
          <div>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10,
            }}>
              <h2 style={{
                color: "#e2e8f0", fontSize: 13, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: 1, margin: 0,
              }}>
                Rankings
              </h2>
              <button onClick={() => navigate("/rankings")} style={{
                background: "none", border: "none", color: "#a78bfa",
                fontSize: 12, cursor: "pointer", padding: 0,
              }}>
                See all →
              </button>
            </div>
            {loading && <p style={{ color: "#6b7280", fontSize: 13, textAlign: "center" }}>Loading…</p>}
            {top3.map((p) => (
              <LeaderboardRow key={p.id} player={p} rank={p.rank} />
            ))}
            {/* Show my row if I'm not already in top 3 */}
            {!myRankInTop3 && myEntry && (
              <>
                <div style={{ textAlign: "center", color: "#2d2b55", fontSize: 18, margin: "4px 0" }}>•••</div>
                <LeaderboardRow player={myEntry} rank={myEntry.rank} />
              </>
            )}
          </div>

        </div>
      </div>
    )
  }
  ```

- [ ] **Verify file was created** — don't run the app yet (routing not wired).

- [ ] **Commit:**
  ```bash
  git add src/pages/HomePage.jsx
  git commit -m "feat: add HomePage with stats, upcoming matches, active bets, leaderboard preview"
  ```

---

## Task 5 — Update App.jsx routes

**Files:**
- Modify: `src/App.jsx`

- [ ] **Replace `src/App.jsx`** entirely with:

  ```jsx
  import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom"
  import { useEffect, useState } from "react"
  import { isLoggedIn, getPlayer } from "./auth.js"
  import { connectWS, disconnectWS } from "./ws.js"
  import JoinPage from "./pages/JoinPage.jsx"
  import HomePage from "./pages/HomePage.jsx"
  import MatchesPage from "./pages/MatchesPage.jsx"
  import MatchDetailPage from "./pages/MatchDetailPage.jsx"
  import PredictionsPage from "./pages/PredictionsPage.jsx"
  import LeaderboardPage from "./pages/LeaderboardPage.jsx"
  import AIPage from "./pages/AIPage.jsx"
  import SandboxPage from "./pages/SandboxPage.jsx"
  import BottomNav from "./components/BottomNav.jsx"
  import TopBar from "./components/TopBar.jsx"

  function ProtectedLayout() {
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
          <Outlet />
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
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/matches" element={<MatchesPage />} />
            <Route path="/matches/:id" element={<MatchDetailPage />} />
            <Route path="/predict" element={<PredictionsPage />} />
            <Route path="/rankings" element={<LeaderboardPage />} />
            <Route path="/ai" element={<AIPage />} />
            <Route path="/sandbox" element={<SandboxPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    )
  }
  ```

- [ ] **Verify** — app should compile. `/` now shows HomePage. `/bets` redirects to `/` (caught by `*`). `/matches` shows MatchesPage.

- [ ] **Commit:**
  ```bash
  git add src/App.jsx
  git commit -m "feat: route / → HomePage, /matches → MatchesPage; remove /bets route"
  ```

---

## Task 6 — Update BottomNav (5 tabs)

**Files:**
- Modify: `src/components/BottomNav.jsx`

- [ ] **Replace `src/components/BottomNav.jsx`** entirely with:

  ```jsx
  import { NavLink } from "react-router-dom"

  const tabs = [
    { to: "/",         icon: "🏠", label: "Home" },
    { to: "/matches",  icon: "⚽", label: "Matches" },
    { to: "/predict",  icon: "🎯", label: "Predict" },
    { to: "/rankings", icon: "📊", label: "Rankings" },
    { to: "/ai",       icon: "🤖", label: "AI" },
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
              <div style={{ textAlign: "center", minWidth: 44 }}>
                <div style={{ fontSize: 20 }}>{icon}</div>
                <div style={{
                  fontSize: 10,
                  fontWeight: isActive ? 700 : 400,
                  background: isActive ? "linear-gradient(90deg, #a855f7, #3b82f6)" : undefined,
                  backgroundClip: isActive ? "text" : undefined,
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

- [ ] **Run tests:**
  ```bash
  npm test -- --run
  ```
  Expected: all pass.

- [ ] **Verify** — nav shows 5 tabs. Home tab highlights on `/`. Matches tab highlights on `/matches`.

- [ ] **Commit:**
  ```bash
  git add src/components/BottomNav.jsx
  git commit -m "feat: BottomNav 5 tabs — Home · Matches · Predict · Rankings · AI"
  ```

---

## Task 7 — Final smoke test & push

- [ ] **Run full test suite:**
  ```bash
  npm test -- --run
  ```
  Expected: all pass.

- [ ] **Manual smoke test checklist:**
  - `/` — shows HomePage with stats row, upcoming matches, leaderboard preview
  - `/matches` — MatchesPage with Maradona compact strip hero
  - `/predict` → Match tab — prediction rows + points total
  - `/predict` → Tournament tab — TournamentBetPanel + bets list
  - `/rankings` — leaderboard unchanged
  - `/bets` — redirects to `/` (404 catch-all)
  - Sandbox (`/sandbox`) — full tall rotating hero still works
  - BottomNav has exactly 5 tabs, no Bets or Sandbox

- [ ] **Push:**
  ```bash
  git push
  ```
