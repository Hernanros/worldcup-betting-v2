# UX Overhaul — Macro Flow, Remove Bets, New Dare Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the app from a generic betting dashboard into an intuitive, social dare-first experience with smart contextual banners on the home screen.

**Architecture:** Five independent frontend tasks, executed in order because Task 1 (remove BetPanel) is a prerequisite for Task 2 (clean homepage data), and Task 5 (HelpPage) should reflect final state. Backend needs one small addition (player_h2h skip in settlement). No database migrations required.

**Tech Stack:** React 18, React Router v6, inline styles (no CSS modules), FastAPI backend (Python). All files are `.jsx`. No TypeScript. Import paths use `../` relative. Style objects use camelCase properties.

---

## Scope: what changes, what doesn't

**IN scope:**
- Remove BetPanel (match betting) from MatchDetailPage
- Home screen: smart macro banners + two-column next-match/leaderboard layout
- Move AI tab earlier in BottomNav
- Add Handicap dare type to ChallengePanel (backend already supports it)
- Rewrite HelpPage: remove match bets section, add dares section, fix wildcard confusion

**OUT of scope (deferred):**
- Player vs Player H2H dare (needs manual settlement infrastructure — separate plan)
- Google OAuth
- Any backend API changes other than player_h2h skip

---

## File map

| File | Change |
|------|--------|
| `frontend/src/pages/MatchDetailPage.jsx` | Remove BetPanel, myBet, wildcardsUsed; simplify load(); keep ChallengePanel |
| `frontend/src/pages/HomePage.jsx` | Full rewrite: smart banners + two-column layout; remove bets API call |
| `frontend/src/components/BottomNav.jsx` | Reorder: move AI from position 7 to position 4 |
| `frontend/src/components/ChallengePanel.jsx` | Add `handicap` type with HandicapPicker sub-component |
| `frontend/src/pages/HelpPage.jsx` | Remove match bets section; replace challenges with dares; fix ⚡ vs 🃏 confusion |
| `backend/app/poller.py` | Skip (don't auto-settle) `player_h2h` challenges — returns `None`, skipped |

---

## Task 1: Remove match bets from MatchDetailPage

**Files:**
- Modify: `frontend/src/pages/MatchDetailPage.jsx` (full file, ~176 lines)

The page currently imports BetPanel, fetches `/api/bets`, tracks `myBet` and `wildcardsUsed`. All of that goes away. The result is a focused page: match header + dare panel (+ kickoff status message when not upcoming).

- [ ] **Step 1: Replace the file content**

```jsx
// frontend/src/pages/MatchDetailPage.jsx
import { useState, useEffect } from "react"
import { useParams, useNavigate, useLocation, useOutletContext } from "react-router-dom"
import { api } from "../api.js"
import ChallengePanel from "../components/ChallengePanel.jsx"
import PageBackground from "../components/PageBackground.jsx"
import { getMomentForMatch } from "../data/moments.js"
import { flagUrl } from "../data/teams.js"

function TeamFlag({ name, size = 48 }) {
  const url = flagUrl(name, 64)
  if (!url) return <span style={{ fontSize: size }}>🏳️</span>
  return (
    <img src={url} alt={name} width={size} height={size * 0.67}
      style={{ objectFit: "cover", borderRadius: 4, display: "block" }}
      onError={(e) => { e.target.style.display = "none" }} />
  )
}

export default function MatchDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { onBalanceChange } = useOutletContext() ?? {}
  const prefill = location.state?.prefill ?? null

  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [playerStreak, setPlayerStreak] = useState(0)
  const [totalChallenges, setTotalChallenges] = useState(0)

  async function load() {
    setError(null)
    try {
      const [data, me] = await Promise.all([
        api.get(`/api/matches/${id}`),
        api.get("/api/me").catch(() => null),
      ])
      setMatch(data)
      if (me) {
        setPlayerStreak(me.challenge_streak)
        setTotalChallenges(me.total_challenges_issued)
      }
    } catch (err) {
      setError(err.message || "Match not found")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  // Auto-scroll to dare panel when ?tab=challenges
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get("tab") === "challenges") {
      setTimeout(() => {
        document.getElementById("dare-panel")?.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 400)
    }
  }, [location.search, loading])

  if (loading) return <div style={{ padding: 24, color: "#6b7280", textAlign: "center" }}>Loading...</div>
  if (error) return (
    <div style={{ padding: 24, textAlign: "center" }}>
      <p style={{ color: "#f87171", marginBottom: 16 }}>⚠ {error}</p>
      <button onClick={() => navigate(-1)} style={{ color: "#a78bfa", background: "none", border: "none", cursor: "pointer" }}>← Back</button>
    </div>
  )
  if (!match) return null

  const isUpcoming = match.status === "upcoming"
  const momentKey = getMomentForMatch(match.home_team, match.away_team).key

  return (
    <div>
      <PageBackground momentKey={momentKey} />
      <div style={{ padding: 16, paddingBottom: 80 }}>
        <button onClick={() => navigate(-1)}
          style={{ color: "#a78bfa", background: "none", border: "none", fontSize: 13, cursor: "pointer", marginBottom: 16 }}>
          ← Back
        </button>

        {/* Match header */}
        <div style={{ background: "#13131f", border: "1px solid #2d2b55", borderRadius: 12,
          padding: 20, marginBottom: 16, textAlign: "center" }}>
          <div style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: 1, marginBottom: 12 }}>
            {match.round}
          </div>
          <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
              <TeamFlag name={match.home_team} />
              <div style={{ fontWeight: 700, fontSize: 13, color: "#e2e8f0", marginTop: 6,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 100 }}>
                {match.home_team}
              </div>
              {match.home_score !== null && (
                <div className="gradient-text" style={{ fontSize: 32, fontWeight: 800, marginTop: 6 }}>{match.home_score}</div>
              )}
            </div>
            <div style={{ color: "#4b5563", fontWeight: 800, fontSize: 20, padding: "0 8px" }}>
              {match.home_score !== null ? "–" : "vs"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
              <TeamFlag name={match.away_team} />
              <div style={{ fontWeight: 700, fontSize: 13, color: "#e2e8f0", marginTop: 6,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 100 }}>
                {match.away_team}
              </div>
              {match.away_score !== null && (
                <div className="gradient-text" style={{ fontSize: 32, fontWeight: 800, marginTop: 6 }}>{match.away_score}</div>
              )}
            </div>
          </div>
          {match.status !== "upcoming" && (
            <div style={{ marginTop: 10, color: "#6b7280", fontSize: 11, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: 1 }}>
              {match.status === "locked" && match.home_score !== null ? "🔴 LIVE" : match.status}
            </div>
          )}
        </div>

        {/* Quick action links */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          <button onClick={() => navigate("/predict")} style={{
            background: "#13131f", border: "1px solid #2d2b55", borderRadius: 10,
            padding: "10px 8px", cursor: "pointer", textAlign: "center",
          }}>
            <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 700 }}>🎯 Predict</div>
            <div style={{ color: "#6b7280", fontSize: 10, marginTop: 2 }}>Guess the exact score</div>
          </button>
          <button onClick={() => navigate("/deep-cuts")} style={{
            background: "#13131f", border: "1px solid #2d2b55", borderRadius: 10,
            padding: "10px 8px", cursor: "pointer", textAlign: "center",
          }}>
            <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 700 }}>🔪 Deep Cuts</div>
            <div style={{ color: "#6b7280", fontSize: 10, marginTop: 2 }}>Prop bets for this stage</div>
          </button>
        </div>

        {/* Dare panel */}
        {isUpcoming ? (
          <div id="dare-panel">
            <ChallengePanel
              match={match}
              challenges={match.open_challenges}
              onUpdate={load}
              onBalanceChange={onBalanceChange}
              prefill={prefill}
              playerStreak={playerStreak}
              totalChallenges={totalChallenges}
            />
          </div>
        ) : (
          <div style={{ background: "#13131f", border: "1px solid #2d2b55", borderRadius: 12,
            padding: 20, textAlign: "center" }}>
            <div style={{ color: "#6b7280", fontSize: 13 }}>
              {match.status === "finished"
                ? "This match has finished. Dares have been settled."
                : "Dares lock at kick-off. Check back for the next match!"}
            </div>
            <button onClick={() => navigate("/matches")} style={{
              marginTop: 12, background: "linear-gradient(135deg,#a855f7,#3b82f6)", color: "#fff",
              border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>
              All matches →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the app compiles (no import errors)**

```bash
cd /Users/hernanrosenblum/Documents/worldcup-betting-v2/frontend
npm run build 2>&1 | tail -20
```

Expected: Build succeeds with no errors about `BetPanel` or `wildcardsUsed`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/MatchDetailPage.jsx
git commit -m "feat: remove match bets from MatchDetailPage — dare-only flow

- Remove BetPanel import and all bet-related state (myBet, wildcardsUsed)
- Remove /api/bets fetch from load()
- Add quick-action grid (Predict + Deep Cuts shortcuts)
- Cleaner 'not upcoming' message for finished/locked matches
- Rename scroll target from #challenges-panel to #dare-panel

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Home screen macro-flow redesign

**Files:**
- Modify: `frontend/src/pages/HomePage.jsx` (full rewrite, ~364 lines → ~320 lines)

**Design spec:**

The page shows one of four banner states at the top, then a two-column row (next match mini-card left, top-3 leaderboard right), then pending dares, then open dares I sent.

```
┌──────────────────────────────────────┐
│  SMART BANNER (state-dependent)      │
└──────────────────────────────────────┘
┌────────────────────┬─────────────────┐
│  NEXT MATCH        │  TOP 3          │
│  mini card         │  compact list   │
│  [⚔️ Dare]         │  [See all →]    │
└────────────────────┴─────────────────┘
┌──────────────────────────────────────┐
│  ⚔️ DARES FOR YOU  (if any)          │
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│  🕐 MY OPEN DARES  (if any)          │
└──────────────────────────────────────┘
```

**Banner states:**

| State | Trigger | Banner |
|-------|---------|--------|
| `PRE_TOURNAMENT` | All matches upcoming AND first kickoff > 72h away | Gold "Lock in your tournament picks" |
| `NEEDS_PICKS` | Missing winner OR golden_boot bet (mid-tournament) | Amber "Tournament picks still open" |
| `IMMINENT` | Next match < 6h away | Red urgent dare CTA with countdown |
| `NORMAL` | Everything else (most of the tournament) | No top banner — two-column row is primary |

**Two-column grid:** `gridTemplateColumns: "3fr 2fr"` (60/40). Left = NextMatchMini, Right = TopThreeMini.

- [ ] **Step 1: Write the new HomePage**

```jsx
// frontend/src/pages/HomePage.jsx
import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../api.js"
import { getPlayer } from "../auth.js"
import PageBackground from "../components/PageBackground.jsx"
import { flagUrl } from "../data/teams.js"

/* ── helpers ────────────────────────────────────────────── */
function flagImg(name, size = 28) {
  const url = flagUrl(name, size)
  if (!url) return null
  return (
    <img src={url} alt={name} width={size} height={Math.round(size * 0.67)}
      style={{ objectFit: "cover", borderRadius: 2, display: "inline-block", verticalAlign: "middle" }}
      onError={e => { e.target.style.display = "none" }}
    />
  )
}

function useCountdown(kickoffIso) {
  const [label, setLabel] = useState("")
  useEffect(() => {
    if (!kickoffIso) return
    function tick() {
      const diff = new Date(kickoffIso) - Date.now()
      if (diff <= 0) { setLabel("Starting now"); return }
      const h = Math.floor(diff / 3_600_000)
      const m = Math.floor((diff % 3_600_000) / 60_000)
      const s = Math.floor((diff % 60_000) / 1_000)
      if (h > 48) { setLabel(`in ${Math.ceil(diff / 86_400_000)} days`) }
      else if (h > 0) { setLabel(`in ${h}h ${m}m`) }
      else { setLabel(`in ${m}m ${s}s`) }
    }
    tick()
    const id = setInterval(tick, 1_000)
    return () => clearInterval(id)
  }, [kickoffIso])
  return label
}

/* ── Banner state resolver ──────────────────────────────── */
function getBannerState(matches, nextMatch, tournamentBets) {
  const hasWinnerBet = tournamentBets.some(b => b.bet_type === "winner")
  const hasGBBet    = tournamentBets.some(b => b.bet_type === "golden_boot")
  const allUpcoming = matches.length > 0 && matches.every(m => m.status === "upcoming")

  if (!nextMatch) return "TOURNAMENT_OVER"

  const msToKickoff    = new Date(nextMatch.kickoff_time) - Date.now()
  const hoursToKickoff = msToKickoff / 3_600_000

  if (allUpcoming && hoursToKickoff > 72) return "PRE_TOURNAMENT"
  if (!hasWinnerBet || !hasGBBet)         return "NEEDS_PICKS"
  if (hoursToKickoff < 6)                  return "IMMINENT"
  return "NORMAL"
}

/* ── Smart banner ───────────────────────────────────────── */
function SmartBanner({ state, nextMatch, navigate }) {
  const countdown = useCountdown(nextMatch?.kickoff_time)

  if (state === "PRE_TOURNAMENT") return (
    <div style={{
      background: "linear-gradient(135deg, rgba(251,191,36,0.15), rgba(245,158,11,0.08))",
      border: "1px solid rgba(251,191,36,0.5)", borderRadius: 16,
      padding: "18px 16px", marginBottom: 14, textAlign: "center",
    }}>
      <div style={{ fontSize: 32, marginBottom: 6 }}>🏆</div>
      <div style={{ color: "#fbbf24", fontWeight: 800, fontSize: 17, marginBottom: 4 }}>
        World Cup hasn't started yet
      </div>
      <div style={{ color: "#9ca3af", fontSize: 12, lineHeight: 1.5, marginBottom: 14 }}>
        First match {countdown}. Lock in who lifts the trophy and who wins the Golden Boot — these bets close the moment the whistle blows.
      </div>
      <button onClick={() => navigate("/tournament")} style={{
        background: "linear-gradient(135deg,#f59e0b,#fbbf24)", color: "#1a1a00",
        border: "none", borderRadius: 10, padding: "10px 24px", fontSize: 13, fontWeight: 800, cursor: "pointer",
      }}>
        🏅 Pick Winner + Golden Boot →
      </button>
    </div>
  )

  if (state === "NEEDS_PICKS") return (
    <div style={{
      background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)",
      borderRadius: 12, padding: "12px 14px", marginBottom: 14,
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <span style={{ fontSize: 22 }}>⚠️</span>
      <span style={{ color: "#e2e8f0", fontSize: 13, flex: 1 }}>
        Tournament picks still open — lock in your winner & Golden Boot
      </span>
      <button onClick={() => navigate("/tournament")} style={{
        background: "none", border: "1px solid #fbbf24", borderRadius: 8,
        color: "#fbbf24", fontSize: 11, fontWeight: 700, padding: "5px 10px", cursor: "pointer", flexShrink: 0,
      }}>
        Pick now →
      </button>
    </div>
  )

  if (state === "IMMINENT" && nextMatch) return (
    <div style={{
      background: "linear-gradient(135deg, rgba(239,68,68,0.12), rgba(168,85,247,0.12))",
      border: "1px solid rgba(239,68,68,0.4)", borderRadius: 16,
      padding: "18px 16px", marginBottom: 14, textAlign: "center",
    }}>
      <div style={{ color: "#f87171", fontSize: 11, fontWeight: 700,
        textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
        🔥 Kicks off {countdown}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 14 }}>
        {flagImg(nextMatch.home_team, 32)}
        <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 15 }}>
          {nextMatch.home_team}
        </span>
        <span style={{ color: "#4b5563", fontWeight: 800 }}>vs</span>
        <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 15 }}>
          {nextMatch.away_team}
        </span>
        {flagImg(nextMatch.away_team, 32)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button onClick={() => navigate(`/matches/${nextMatch.id}?tab=challenges`)} style={{
          background: "linear-gradient(135deg,#a855f7,#3b82f6)", color: "#fff",
          border: "none", borderRadius: 10, padding: "10px 8px", fontSize: 12, fontWeight: 700, cursor: "pointer",
        }}>
          ⚔️ Send a Dare
        </button>
        <button onClick={() => navigate("/predict")} style={{
          background: "#13131f", border: "1px solid #2d2b55",
          borderRadius: 10, padding: "10px 8px", fontSize: 12, fontWeight: 700,
          color: "#e2e8f0", cursor: "pointer",
        }}>
          🎯 Predict Score
        </button>
      </div>
    </div>
  )

  // NORMAL and TOURNAMENT_OVER don't show a top banner — the two-column row serves instead
  return null
}

/* ── Next match mini card (left column) ─────────────────── */
function NextMatchMini({ match, navigate }) {
  const countdown = useCountdown(match?.kickoff_time)
  if (!match) return (
    <div style={{ background: "#13131f", border: "1px solid #2d2b55", borderRadius: 12, padding: 14 }}>
      <div style={{ color: "#6b7280", fontSize: 12, textAlign: "center" }}>No upcoming matches</div>
    </div>
  )
  return (
    <div style={{ background: "#13131f", border: "1px solid #2d2b55", borderRadius: 12, padding: 14 }}>
      <div style={{ color: "#a78bfa", fontSize: 9, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: 0.8, marginBottom: 8 }}>
        ⏱ Next match
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ textAlign: "center", flex: 1 }}>
          {flagImg(match.home_team, 24)}
          <div style={{ color: "#e2e8f0", fontSize: 10, fontWeight: 700, marginTop: 4,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {match.home_team}
          </div>
        </div>
        <div style={{ color: "#4b5563", fontSize: 12, fontWeight: 700, padding: "0 4px" }}>vs</div>
        <div style={{ textAlign: "center", flex: 1 }}>
          {flagImg(match.away_team, 24)}
          <div style={{ color: "#e2e8f0", fontSize: 10, fontWeight: 700, marginTop: 4,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {match.away_team}
          </div>
        </div>
      </div>
      <div style={{ color: "#6b7280", fontSize: 10, textAlign: "center", marginBottom: 8 }}>
        {countdown}
      </div>
      <button onClick={() => navigate(`/matches/${match.id}?tab=challenges`)} style={{
        width: "100%", background: "linear-gradient(135deg,#a855f7,#3b82f6)",
        border: "none", borderRadius: 8, padding: "7px 0",
        color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer",
      }}>
        ⚔️ Dare friends
      </button>
    </div>
  )
}

/* ── Top-3 mini leaderboard (right column) ──────────────── */
function TopThreeMini({ leaderboard, myEntry, navigate }) {
  const top3 = leaderboard.slice(0, 3)
  const MEDALS = ["🥇", "🥈", "🥉"]
  return (
    <div style={{ background: "#13131f", border: "1px solid #2d2b55", borderRadius: 12, padding: 14 }}>
      <div style={{ color: "#a78bfa", fontSize: 9, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: 0.8, marginBottom: 8 }}>
        📊 Rankings
      </div>
      {top3.map((p, i) => (
        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 14, flexShrink: 0 }}>{MEDALS[i]}</span>
          <span style={{ color: "#e2e8f0", fontSize: 10, flex: 1, fontWeight: 600,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {p.name}
          </span>
          <span style={{ color: "#fbbf24", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
            {p.token_balance.toLocaleString()}
          </span>
        </div>
      ))}
      {myEntry && !top3.some(p => p.id === myEntry.id) && (
        <div style={{ borderTop: "1px solid #2d2b55", paddingTop: 6, marginTop: 2,
          display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "#6b7280", fontSize: 10, flexShrink: 0 }}>#{myEntry.rank}</span>
          <span style={{ color: "#a78bfa", fontSize: 10, flex: 1, fontWeight: 700,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            You
          </span>
          <span style={{ color: "#fbbf24", fontSize: 10, fontWeight: 700 }}>
            {myEntry.token_balance.toLocaleString()}
          </span>
        </div>
      )}
      <button onClick={() => navigate("/rankings")} style={{
        width: "100%", background: "none", border: "1px solid #2d2b55",
        borderRadius: 8, padding: "5px 0", marginTop: 6,
        color: "#a78bfa", fontSize: 10, fontWeight: 700, cursor: "pointer",
      }}>
        See all →
      </button>
    </div>
  )
}

/* ── Pending dares for me ───────────────────────────────── */
function DaresForMe({ dares, navigate }) {
  if (!dares?.length) return null
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ color: "#f87171", fontSize: 11, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: 0.8, marginBottom: 8 }}>
        ⚔️ {dares.length} dare{dares.length > 1 ? "s" : ""} waiting for you
      </div>
      {dares.slice(0, 2).map(c => (
        <button key={c.id} onClick={() => navigate(`/matches/${c.match_id}?tab=challenges`)} style={{
          width: "100%", textAlign: "left",
          background: "linear-gradient(135deg, rgba(168,85,247,0.08), rgba(59,130,246,0.08))",
          border: "1px solid rgba(168,85,247,0.3)",
          borderRadius: 10, padding: "10px 12px", marginBottom: 6,
          display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#a78bfa", fontSize: 10, fontWeight: 700, marginBottom: 2 }}>
              {c.issuer_name || "Someone"} dares you
            </div>
            <div style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {c.match_home_team} vs {c.match_away_team} · {c.bet_type?.replace(/_/g, " ")}
            </div>
          </div>
          <span style={{ color: "#a78bfa", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>Accept →</span>
        </button>
      ))}
    </div>
  )
}

/* ── My open dares ──────────────────────────────────────── */
function MyOpenDares({ dares, onCancel }) {
  if (!dares?.length) return null
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: 0.8, marginBottom: 8 }}>
        🕐 Dares I sent — waiting for response
      </div>
      {dares.slice(0, 2).map(c => (
        <div key={c.id} style={{
          background: "#13131f", border: "1px solid #2d2b55",
          borderRadius: 10, padding: "10px 12px", marginBottom: 6,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#6b7280", fontSize: 10 }}>
              {c.match_home_team} vs {c.match_away_team}
            </div>
            <div style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
              {c.selection} · <span style={{ color: "#fbbf24" }}>{c.issuer_stake} tokens</span>
            </div>
          </div>
          <button onClick={() => onCancel(c.id)} style={{
            flexShrink: 0, background: "none", border: "1px solid #ef4444",
            borderRadius: 6, color: "#ef4444", fontSize: 11,
            padding: "4px 10px", cursor: "pointer", fontWeight: 600,
          }}>
            Cancel
          </button>
        </div>
      ))}
    </div>
  )
}

/* ── Main page ──────────────────────────────────────────── */
export default function HomePage() {
  const navigate = useNavigate()
  const player = getPlayer()

  const [matches, setMatches] = useState([])
  const [nextMatch, setNextMatch] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [openChallenges, setOpenChallenges] = useState({ my_open: [], for_me: [] })
  const [tournamentBets, setTournamentBets] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [allMatches, tournamentData, lb, challengeData] = await Promise.all([
        api.get("/api/matches"),
        api.get("/api/tournament/bets").catch(() => ({ my_bets: [] })),
        api.get("/api/leaderboard"),
        api.get("/api/challenges").catch(() => ({ my_open: [], for_me: [] })),
      ])
      const upcoming = allMatches.filter(m => m.status === "upcoming")
      setMatches(allMatches)
      setNextMatch(upcoming[0] ?? null)
      setTournamentBets(tournamentData.my_bets || [])
      setOpenChallenges(challengeData)
      setLeaderboard(lb)
    } finally {
      setLoading(false)
    }
  }, [player?.id])

  useEffect(() => { load() }, [load])

  const bannerState = loading ? "NORMAL"
    : getBannerState(matches, nextMatch, tournamentBets)

  const myEntry = leaderboard.find(p => p.id === player?.id)

  async function cancelDare(id) {
    try {
      await api.delete(`/api/challenges/${id}`)
      setOpenChallenges(prev => ({ ...prev, my_open: prev.my_open.filter(x => x.id !== id) }))
    } catch (e) { alert(e.message || "Cancel failed") }
  }

  return (
    <div>
      <PageBackground momentKey="rotating" />
      <div style={{ padding: "16px 16px 80px" }}>

        {/* ── Smart banner ─────────────────────────────── */}
        {!loading && (
          <SmartBanner state={bannerState} nextMatch={nextMatch} navigate={navigate} />
        )}

        {/* ── Two-column: Next match + Rankings ────────── */}
        {!loading && (
          <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 10, marginBottom: 14 }}>
            <NextMatchMini match={nextMatch} navigate={navigate} />
            <TopThreeMini leaderboard={leaderboard} myEntry={myEntry} navigate={navigate} />
          </div>
        )}

        {/* ── Loading skeleton ─────────────────────────── */}
        {loading && (
          <div style={{ height: 180, background: "#13131f", borderRadius: 16, marginBottom: 14,
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#6b7280", fontSize: 13 }}>Loading…</span>
          </div>
        )}

        {/* ── Dares for me ─────────────────────────────── */}
        {!loading && (
          <DaresForMe dares={openChallenges.for_me} navigate={navigate} />
        )}

        {/* ── My open dares ────────────────────────────── */}
        {!loading && (
          <MyOpenDares dares={openChallenges.my_open} onCancel={cancelDare} />
        )}

      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/hernanrosenblum/Documents/worldcup-betting-v2/frontend
npm run build 2>&1 | tail -20
```

Expected: Build success. No errors about `ActiveBetsStrip` or `ActionItems`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/HomePage.jsx
git commit -m "feat: home screen macro-flow redesign

- Smart banner: PRE_TOURNAMENT (gold, pick your winners), NEEDS_PICKS (amber warning),
  IMMINENT (<6h, red dare CTA), NORMAL (no banner — two-column row)
- Two-column layout: 3fr next-match mini-card vs 2fr top-3 leaderboard
- Remove ActiveBetsStrip, ActionItems (bets gone; logic folded into SmartBanner)
- Remove /api/bets API call
- DaresForMe: urgent red header; navigates directly to match dare panel
- MyOpenDares: compact cancel flow

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Move AI tab earlier in BottomNav

**Files:**
- Modify: `frontend/src/components/BottomNav.jsx` (small change, lines 4-12)

Current order: Home, Matches, Predict, Tournament, Deep Cuts, Rankings, AI, Help
New order: **Home, Matches, Predict, AI, Tournament, Deep Cuts, Rankings, Help**

- [ ] **Step 1: Reorder BASE_TABS**

Replace the `BASE_TABS` array:

```jsx
const BASE_TABS = [
  { to: "/",           icon: "🏠", label: "Home" },
  { to: "/matches",    icon: "⚽", label: "Matches" },
  { to: "/predict",    icon: "🎯", label: "Predict" },
  { to: "/ai",         icon: "🤖", label: "AI",       requiresAI: true },
  { to: "/tournament", icon: "🏆", label: "Tournmt" },
  { to: "/deep-cuts",  icon: "🔪", label: "Cuts" },
  { to: "/rankings",   icon: "📊", label: "Rankings" },
  { to: "/help",       icon: "❓", label: "Help" },
]
```

Note: "Deep Cuts" shortened to "Cuts" (10 chars → 4 chars) to keep 8 tabs from crowding the bar. The 9-char "Deep Cuts" was already tight.

- [ ] **Step 2: Verify build**

```bash
cd /Users/hernanrosenblum/Documents/worldcup-betting-v2/frontend
npm run build 2>&1 | tail -5
```

Expected: Build success.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/BottomNav.jsx
git commit -m "feat: move AI tab to position 4 in bottom nav (after Predict)

- Promote AI from last-before-help to immediately after Predict
- Shorten 'Deep Cuts' → 'Cuts' to avoid crowding 8-tab bar

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Add Handicap dare type to ChallengePanel

**Files:**
- Modify: `frontend/src/components/ChallengePanel.jsx`

The backend (`poller.py:_evaluate_bet`) already handles `bet_type == "handicap"` with the format `"{team} {+/-N}"` e.g. `"Argentina +1.5"`. No backend changes needed.

**New UI for handicap type:**
1. Two buttons: home_team / away_team (pick which team you're backing)
2. Handicap line chips: `+0.5`, `+1`, `+1.5`, `+2`, `+2.5`
3. On selection: `selection = "{pickedTeam} +{line}"`, `acceptorSelection = "{otherTeam} -{line}"`
4. Meaning: "{pickedTeam} needs to not lose by more than {line} goals"

**What "Argentina +1.5" means to settle:** If Argentina scores + 1.5 > Brazil's score, issuer wins. So Argentina can draw or even lose 1-0 and the issuer still wins.

- [ ] **Step 1: Add HandicapPicker sub-component and new dare type entry**

In `ChallengePanel.jsx`, add after the `PresetChips` component definition:

```jsx
/* ── Handicap picker ───────────────────────────────────────── */
function HandicapPicker({ match, selection, onPick }) {
  const LINES = ["+0.5", "+1", "+1.5", "+2", "+2.5"]
  // Parse current selection if any: "Argentina +1.5" → team="Argentina", line="+1.5"
  const parts = selection ? selection.split(" ") : []
  const currentLine = parts.length >= 2 ? parts[parts.length - 1] : null
  const currentTeam = parts.length >= 2 ? parts.slice(0, -1).join(" ") : null

  function pick(team, line) {
    const otherTeam = team === match.home_team ? match.away_team : match.home_team
    const neg = line.replace("+", "-")
    // issuerSel used for settlement; acceptorSel is display-only
    onPick(`${team} ${line}`, `${otherTeam} ${neg}`)
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 6 }}>
        Which team gets the head-start?
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
        {[match.home_team, match.away_team].map(team => (
          <button key={team} onClick={() => pick(team, currentLine || "+1")} style={{
            padding: "8px 4px", borderRadius: 8, fontSize: 11, fontWeight: 700,
            cursor: "pointer", border: "1px solid",
            background: currentTeam === team ? "rgba(168,85,247,0.2)" : "transparent",
            borderColor: currentTeam === team ? "rgba(168,85,247,0.6)" : "#2d2b55",
            color: currentTeam === team ? "#c4b5fd" : "#6b7280",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {team}
          </button>
        ))}
      </div>
      <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 4 }}>
        Head-start (goals)
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {LINES.map(line => (
          <button key={line} onClick={() => pick(currentTeam || match.home_team, line)} style={{
            padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
            cursor: "pointer", border: "1px solid",
            background: currentLine === line ? "rgba(168,85,247,0.2)" : "transparent",
            borderColor: currentLine === line ? "rgba(168,85,247,0.6)" : "#2d2b55",
            color: currentLine === line ? "#c4b5fd" : "#6b7280",
          }}>
            {line}
          </button>
        ))}
      </div>
      {selection && (
        <div style={{ marginTop: 8, padding: "6px 10px", background: "rgba(168,85,247,0.08)",
          borderRadius: 8, border: "1px solid rgba(168,85,247,0.2)" }}>
          <span style={{ color: "#c4b5fd", fontSize: 11 }}>
            You back: <strong>{selection}</strong>
            {" "}(they still "win" even if they lose by less than {currentLine?.replace("+", "")} {currentLine === "+1" ? "goal" : "goals"})
          </span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add `handicap` to DARE_TYPES array**

Add at the end of the `DARE_TYPES` array (after the offsides entry):

```jsx
  { key: "handicap", label: "🎲 Handicap", short: "Handicap", yesNo: false, handicap: true,
    hint: "Give a team a head start: 'Argentina +1.5' wins even if they draw or lose by 1 goal" },
```

- [ ] **Step 3: Add handicap rendering branch in the pick section**

In the main render, the pick section is currently:
```jsx
{/* Pick section */}
{currentType.yesNo ? (
  ...YesNoPicker...
) : (
  ...PresetChips + inputs...
)}
```

Change it to a three-way branch:

```jsx
{/* Pick section */}
{currentType.yesNo ? (
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
    <YesNoPicker label="Your call" value={selection} onChange={handleMyPick} />
    <YesNoPicker label="Their call (auto)" value={acceptorSelection}
      onChange={v => { setAcceptorSelection(v); setSelection(oppositeOf(currentType, v)) }} />
  </div>
) : currentType.handicap ? (
  <HandicapPicker
    match={match}
    selection={selection}
    onPick={(sel, acceptSel) => { setSelection(sel); setAcceptorSelection(acceptSel) }}
  />
) : (
  <div style={{ marginBottom: 10 }}>
    {currentType.presets && (
      <>
        <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 4 }}>Your pick (tap to select)</div>
        <PresetChips presets={currentType.presets} value={selection} onChange={handleMyPick} />
      </>
    )}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      <div>
        <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 3 }}>Your pick</div>
        <input value={selection} onChange={e => handleMyPick(e.target.value)} placeholder="e.g. Over 2.5"
          style={{ width: "100%", boxSizing: "border-box", background: "#13131f", border: "1px solid #2d2b55",
            borderRadius: 6, padding: "6px 10px", color: "#e2e8f0", fontSize: 12 }} />
      </div>
      <div>
        <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 3 }}>Their pick (auto)</div>
        <input value={acceptorSelection} onChange={e => { setAcceptorSelection(e.target.value); setSelection(oppositeOf(currentType, e.target.value)) }}
          placeholder="e.g. Under 2.5"
          style={{ width: "100%", boxSizing: "border-box", background: "#13131f", border: "1px solid #2d2b55",
            borderRadius: 6, padding: "6px 10px", color: "#e2e8f0", fontSize: 12 }} />
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 4: Update the `oppositeOf` function to handle handicap gracefully**

The `oppositeOf` function is used for auto-fill. For handicap, the auto-fill is handled inside `HandicapPicker.onPick`, so we just need `oppositeOf` to return "" for unknown formats (it already does). No change needed to `oppositeOf`.

- [ ] **Step 5: Verify build**

```bash
cd /Users/hernanrosenblum/Documents/worldcup-betting-v2/frontend
npm run build 2>&1 | tail -10
```

Expected: Build success. No prop errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ChallengePanel.jsx
git commit -m "feat: add Handicap dare type to ChallengePanel

- New HandicapPicker sub-component: team selector + handicap line chips (+0.5 to +2.5)
- Auto-derives acceptor_selection (opposite team, negative handicap)
- Inline explanation: 'Argentina +1.5 wins even if they draw or lose by 1'
- Backend already supports 'handicap' bet_type in _evaluate_bet — no backend change

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Rewrite HelpPage

**Files:**
- Modify: `frontend/src/pages/HelpPage.jsx` (replace SECTIONS array, keep layout component untouched)

**Changes:**
- Remove entire "Match bets" (💰) section — it's gone
- Rename "Challenges" (⚔️) → "Dares" with updated content covering all dare types including Handicap
- In "Score predictions" section: clarify ⚡ = Double Points (not wildcard)
- Keep: Getting started, Score predictions, Dares, Tournament bets, Deep Cuts, AI

The `SECTIONS` data array is the only thing that changes. The accordion layout JSX below it is untouched.

- [ ] **Step 1: Replace the `SECTIONS` constant**

```jsx
const SECTIONS = [
  {
    id: "basics",
    emoji: "🏁",
    title: "Getting started",
    items: [
      {
        q: "What is WC Bets 2026?",
        a: "A private game for your friend group during the 2026 World Cup. You start with 1,000 tokens. Dare friends on matches, predict exact scores, pick the tournament winner, and try to end with the most tokens.",
      },
      {
        q: "How do I join?",
        a: "Ask your group admin for the invite code. Enter your name and the code on the login screen — you're in instantly with 1,000 tokens.",
      },
      {
        q: "What are tokens?",
        a: "Tokens are in-game currency — not real money. Win dares and tournament bets to earn more; lose them and they're gone. Your token balance is your score on the leaderboard.",
      },
      {
        q: "How do I switch groups?",
        a: "Tap the ⇄ Switch button in the top bar to return to the login screen and enter a different group's invite code.",
      },
    ],
  },
  {
    id: "predictions",
    emoji: "🎯",
    title: "Score predictions",
    items: [
      {
        q: "How do predictions work?",
        a: "Predictions are free — they cost no tokens. You guess the exact final score of each match before it kicks off. Correct score = 3 pts, correct result (win/draw/loss) = 1 pt. Prediction points appear on a separate leaderboard tab.",
      },
      {
        q: "What are ⚡ Double Points predictions?",
        a: "You can mark up to 3 predictions as Double Points for the whole tournament. A correct Double Points prediction earns 6 pts (exact score) or 2 pts (correct outcome) instead of the usual 3 or 1. Choose your most confident picks — you only get 3.",
      },
      {
        q: "When do predictions lock?",
        a: "Predictions lock at kick-off. You can update them any time before the match starts.",
      },
    ],
  },
  {
    id: "dares",
    emoji: "⚔️",
    title: "Dares",
    items: [
      {
        q: "What is a dare?",
        a: "A head-to-head wager between you and a friend. You pick a spicy outcome, they take the opposite side, you both put up tokens. The match result settles it automatically.",
      },
      {
        q: "What can I dare on?",
        a: "8 dare types: Both Teams Score? (Yes/No) · Red Card? (Yes/No) · Extra Time? (Yes/No) · Penalties? (Yes/No) · Goals Over/Under · Cards Over/Under · Corners Over/Under · Handicap (+0.5 to +2.5 goals for a team). These are outcomes you can't cover with a simple prediction.",
      },
      {
        q: "How does the Handicap dare work? 🎲",
        a: "Pick a team and give them a goal head-start. 'Argentina +1.5' means your dare wins even if Argentina draws or loses by just 1 goal. The friend taking the other side needs Argentina to lose by 2+. Lines available: +0.5, +1, +1.5, +2, +2.5.",
      },
      {
        q: "How do I send a dare?",
        a: "Open a match → tap 'Dare friends'. Choose the dare type, pick your side (the other side auto-fills), set your stake and odds, tap 'Send Dare'. Share the link so your opponent can accept.",
      },
      {
        q: "What is the dare streak? 🔥",
        a: "Win dares back-to-back and earn a payout bonus: 3 wins in a row = +10%, 4 = +20%, 5+ = +35%. The bonus applies on top of your normal winnings.",
      },
      {
        q: "What are the dare milestones? 🎯",
        a: "Send enough dares for one-time bonuses: 5 dares sent → +50 tokens, 10 → +150 tokens, 20 → +400 tokens.",
      },
      {
        q: "Can I cancel a dare I sent?",
        a: "Yes, as long as it hasn't been accepted yet. Go to the Home screen, find your open dare under 'Dares I sent', and hit Cancel to recover your staked tokens.",
      },
      {
        q: "When do dares settle?",
        a: "Automatically within minutes of the final whistle. No action needed — tokens move on their own.",
      },
    ],
  },
  {
    id: "tournament",
    emoji: "🏆",
    title: "Tournament bets",
    items: [
      {
        q: "What are tournament bets?",
        a: "Long-range bets on the whole tournament: who wins it, who scores the most goals (Golden Boot), and total goals across all 64 matches. These lock at the first whistle (June 11) and settle when the tournament ends.",
      },
      {
        q: "What is an insurance pick?",
        a: "After placing a Winner or Golden Boot bet, you can add a free insurance pick — a second choice at no cost. If your main bet loses but your insurance is correct, you get back 50% of what the main bet would have paid.",
      },
      {
        q: "Why are some Golden Boot players not in the list?",
        a: "The list covers main contenders. Type any name in the search box to bet on unlisted players — you'll get 101× odds on them.",
      },
    ],
  },
  {
    id: "deepcuts",
    emoji: "🔪",
    title: "Deep Cuts",
    items: [
      {
        q: "What are Deep Cuts?",
        a: "Stage-specific prop bets that unlock round by round: Group Stage, Round of 32, Quarter-Finals, etc. Each round has unique markets — things like 'Will any group game end 0–0?' or 'Which team advances from Group A?'",
      },
      {
        q: "When do Deep Cuts lock?",
        a: "Each stage's markets lock when that stage begins. Check the badge — Open (green) means you can still bet, Locked (red) means that stage has started.",
      },
    ],
  },
  {
    id: "ai",
    emoji: "🤖",
    title: "AI suggestions",
    items: [
      {
        q: "What does the AI do?",
        a: "It analyses the match, your friend group's recent dares, and the available dare types — then suggests a specific dare you might not have thought of. It's a conversation starter, not financial advice.",
      },
      {
        q: "Is AI available for every group?",
        a: "Only if your group admin enabled it. If you don't see the AI tab, ask your admin to turn it on.",
      },
    ],
  },
]
```

- [ ] **Step 2: Verify the SECTIONS array doesn't break the accordion**

The layout below `SECTIONS` in HelpPage.jsx uses `section.id`, `section.emoji`, `section.title`, `section.items`, `item.q`, and `item.a` — all of which are present in every entry above.

```bash
cd /Users/hernanrosenblum/Documents/worldcup-betting-v2/frontend
npm run build 2>&1 | tail -5
```

Expected: Build success.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/HelpPage.jsx
git commit -m "feat: update HelpPage — remove match bets, rewrite dares section

- Remove 'Match bets' section (bets are gone from app)
- New 'Dares' section covers all 8 dare types including Handicap
- Explains dare streak, milestones, cancel flow
- Predictions section: clarify ⚡ = 'Double Points' (not wildcard)
- AI section: updated description to reflect dare suggestions

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Push to deploy

**Files:** none (git push)

- [ ] **Step 1: Push both branches**

```bash
git push origin main && git push origin main:feat/worldcup-betting-v2
```

- [ ] **Step 2: Verify Railway picks it up**

Open Railway dashboard and confirm a new deployment appears within 60 seconds.

---

## Self-Review

**Spec coverage check:**

| Requirement | Covered by |
|-------------|-----------|
| Home macro flow — pre-tournament banner | Task 2: `PRE_TOURNAMENT` state in `SmartBanner` |
| Home macro flow — before stage start banner | Task 2: `NEEDS_PICKS` state (closest proxy without stage-start API data) |
| Home macro flow — before next match dare CTA | Task 2: `IMMINENT` state + always-visible `NextMatchMini` |
| Next match + leaderboard side by side | Task 2: `gridTemplateColumns: "3fr 2fr"` |
| Remove match bets | Task 1: `MatchDetailPage` no longer imports or uses `BetPanel` |
| Handicap dare (+1 for a team) | Task 4: `HandicapPicker` + `handicap` DARE_TYPE |
| Player H2H dare | ❌ Deferred — requires manual settlement infrastructure |
| Wildcard text unclear | Task 5: "Match bets" section (with wildcard bet entry) removed; ⚡ clarified as "Double Points" |
| AI buried at end | Task 3: AI moved from position 7 to position 4 in nav |
| Home Win/Draw/Away Win generic | Task 1: `BetPanel` removed from `MatchDetailPage`; doesn't appear elsewhere |

**Placeholder scan:** No TBD, no "add appropriate X", all code blocks contain working JSX.

**Type consistency:** `getBannerState()` returns string literals; `SmartBanner` `state` prop accepts those same strings. `HandicapPicker.onPick` signature `(sel: string, acceptSel: string) => void` matches the call site in the three-way branch.

**Out-of-scope note on Player H2H:** The user asked for "player v player head to head (score, assists g/a, minutes)". Auto-settlement requires per-match player stats which are not tracked. This needs: (a) a new Challenge status `"manual"`, (b) an admin UI to declare the winner, (c) manual settlement endpoint. Estimated 1-2 days. Keep as a follow-up plan.
