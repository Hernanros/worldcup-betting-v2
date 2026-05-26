# Critical Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the three critical product gaps: invisible match bets, dead-end AI suggestions, and invisible bravery game mechanics.

**Architecture:** All backend data already exists — this is entirely a UI wiring job. We add two backend endpoints (`GET /api/bets`, `GET /api/me`) to surface existing data, restructure the AI endpoint to return actionable structured JSON instead of markdown text, and wire the frontend to consume all of it.

**Tech Stack:** FastAPI (backend), React 18 + React Router v6 (frontend), Anthropic claude-haiku-4-5-20251001 (AI structured output), Vitest (frontend tests), pytest-asyncio (backend tests)

**Working directories:**
- Backend: `/Users/hernanrosenblum/Documents/worldcup-betting-v2/backend`
- Frontend: `/Users/hernanrosenblum/Documents/worldcup-betting-v2/frontend`

**Run backend tests:** `cd backend && pytest -x -q`
**Run frontend tests:** `cd frontend && npm test -- --run`

---

## File Map

| File | Change |
|---|---|
| `backend/app/routers/bets.py` | Add `GET /api/bets` — returns player's match bets with match context |
| `backend/app/routers/auth.py` | Add `GET /api/me` — returns current player including streak + milestone fields |
| `backend/app/routers/ai.py` | Restructure to return `{"suggestions": [...]}` JSON (drop streaming) |
| `backend/tests/test_bets.py` | Add test for GET /api/bets |
| `backend/tests/test_auth.py` | Add test for GET /api/me |
| `frontend/src/pages/HomePage.jsx` | Fetch `/api/bets`, add pending match bets to Active Bets section |
| `frontend/src/pages/MatchDetailPage.jsx` | Fetch `/api/me` + filter `/api/bets` for this match; show "Your Bet" card; pass prefill from location.state to ChallengePanel |
| `frontend/src/pages/AIPage.jsx` | Replace streaming with `api.post`, render suggestion cards with "Issue This" button |
| `frontend/src/components/ChallengePanel.jsx` | Accept `prefill` prop (pre-fills form fields); accept `playerStreak` + `totalChallengesIssued` props; show streak badge and next milestone progress |

---

## Task 1 — Backend: GET /api/bets

**Files:**
- Modify: `backend/app/routers/bets.py`
- Test: `backend/tests/test_bets.py`

- [ ] **Add the GET endpoint to `backend/app/routers/bets.py`**

  Add this import at the top (after the existing imports):
  ```python
  from sqlalchemy import select
  ```

  Then add this endpoint after the existing `place_bet` function:
  ```python
  @router.get("/api/bets")
  async def get_my_bets(auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
      player, _ = auth
      rows = (await db.execute(
          select(Bet, Match)
          .join(Match, Bet.match_id == Match.id)
          .where(Bet.player_id == player.id)
          .order_by(Match.kickoff_time.desc())
      )).all()
      return [
          {
              "id": b.id,
              "match_id": b.match_id,
              "home_team": m.home_team,
              "away_team": m.away_team,
              "kickoff_time": m.kickoff_time.isoformat(),
              "match_status": m.status,
              "home_score": m.home_score,
              "away_score": m.away_score,
              "bet_type": b.bet_type,
              "selection": b.selection,
              "stake": b.stake,
              "odds": b.odds_at_placement,
              "status": b.status,
          }
          for b, m in rows
      ]
  ```

- [ ] **Write the test — add to `backend/tests/test_bets.py`:**
  ```python
  async def test_get_my_bets_returns_placed_bets(client, db):
      m = await make_match(db)
      data = await join_player(client)
      headers = {"Authorization": f"Bearer {data['token']}"}
      # Place a bet first
      await client.post(f"/api/matches/{m.id}/bets", json={
          "bet_type": "1x2", "selection": "Argentina", "stake": 100, "odds": 2.5
      }, headers=headers)
      # Fetch bets
      resp = await client.get("/api/bets", headers=headers)
      assert resp.status_code == 200
      bets = resp.json()
      assert len(bets) == 1
      assert bets[0]["selection"] == "Argentina"
      assert bets[0]["stake"] == 100
      assert bets[0]["home_team"] == "Argentina"
      assert bets[0]["away_team"] == "Brazil"
      assert bets[0]["status"] == "pending"

  async def test_get_my_bets_returns_empty_when_none(client, db):
      data = await join_player(client)
      headers = {"Authorization": f"Bearer {data['token']}"}
      resp = await client.get("/api/bets", headers=headers)
      assert resp.status_code == 200
      assert resp.json() == []
  ```

- [ ] **Run backend tests:**
  ```bash
  cd /Users/hernanrosenblum/Documents/worldcup-betting-v2/backend
  pytest tests/test_bets.py -x -q
  ```
  Expected: all pass.

- [ ] **Commit:**
  ```bash
  git add backend/app/routers/bets.py backend/tests/test_bets.py
  git commit -m "feat: GET /api/bets returns player match bet history"
  ```

---

## Task 2 — Backend: GET /api/me

**Files:**
- Modify: `backend/app/routers/auth.py`
- Test: `backend/tests/test_auth.py`

- [ ] **Read `backend/app/routers/auth.py`** to find where to add the endpoint (after the join endpoint).

- [ ] **Add the endpoint:**
  ```python
  @router.get("/api/me")
  async def get_me(auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
      player, _ = auth
      p = await db.get(Player, player.id)
      return {
          "id": p.id,
          "name": p.name,
          "token_balance": p.token_balance,
          "challenge_streak": p.challenge_streak,
          "total_challenges_issued": p.total_challenges_issued,
          "volume_milestone_reached": p.volume_milestone_reached,
      }
  ```

  Make sure `Player` is imported — it already is in auth.py (it's used by the join endpoint).

- [ ] **Write the test — add to `backend/tests/test_auth.py`:**
  ```python
  async def test_get_me_returns_player_fields(client, db):
      data = await join_player(client)
      headers = {"Authorization": f"Bearer {data['token']}"}
      resp = await client.get("/api/me", headers=headers)
      assert resp.status_code == 200
      body = resp.json()
      assert body["name"] == "Alice"
      assert body["token_balance"] == 1000
      assert body["challenge_streak"] == 0
      assert body["total_challenges_issued"] == 0
      assert body["volume_milestone_reached"] == 0

  async def test_get_me_requires_auth(client, db):
      resp = await client.get("/api/me")
      assert resp.status_code == 401
  ```

- [ ] **Run tests:**
  ```bash
  cd /Users/hernanrosenblum/Documents/worldcup-betting-v2/backend
  pytest tests/test_auth.py -x -q
  ```
  Expected: all pass.

- [ ] **Commit:**
  ```bash
  git add backend/app/routers/auth.py backend/tests/test_auth.py
  git commit -m "feat: GET /api/me returns player streak and milestone fields"
  ```

---

## Task 3 — Backend: AI structured JSON output

**Files:**
- Modify: `backend/app/routers/ai.py`

The current endpoint streams markdown text. We replace it with a synchronous call that returns structured JSON. This lets the frontend render actionable suggestion cards instead of a text blob.

- [ ] **Replace `backend/app/routers/ai.py`** entirely with:

  ```python
  import json
  from fastapi import APIRouter, Depends, HTTPException
  from sqlalchemy.ext.asyncio import AsyncSession
  import anthropic
  from app.database import get_db
  from app.deps import get_current_player
  from app.models import Match, Player
  from app.config import settings

  router = APIRouter()

  anthropic_client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

  _SYSTEM = """You are a sports betting advisor for a World Cup friend group.
  Given a match and its current odds, suggest exactly 2 interesting P2P challenge ideas.
  Respond ONLY with a valid JSON array — no markdown, no explanation, just the array.
  Each item in the array must have exactly these fields:
  {
    "title": "short label for the bet type, e.g. 'Home Win' or 'Correct Score'",
    "my_pick": "the issuer's selection, e.g. 'Argentina' or '2-1'",
    "their_pick": "the acceptor's opposing selection, e.g. 'Brazil' or '1-2'",
    "my_odds": 2.5,
    "their_odds": 1.6,
    "stake": 100,
    "reason": "one sentence explaining why this pick is interesting"
  }
  Stakes should be between 50 and 300. Odds must be positive floats."""


  def _build_prompt(match: Match, player: Player, odds: dict) -> str:
      lines = [
          f"Match: {match.home_team} vs {match.away_team}",
          f"Round: {match.round}",
          f"Player balance: {player.token_balance} tokens",
          f"Player challenge streak: {player.challenge_streak}",
          "", "Available odds:",
      ]
      for market, outcomes in odds.items():
          lines.append(f"  {market}:")
          for o in outcomes:
              lines.append(f"    {o.get('name', '?')}: {o.get('price', '?')}")
      lines.append("\nReturn a JSON array of exactly 2 challenge suggestions.")
      return "\n".join(lines)


  @router.post("/api/ai/suggest-challenge")
  async def suggest_challenge(
      data: dict,
      auth=Depends(get_current_player),
      db: AsyncSession = Depends(get_db),
  ):
      player, _ = auth
      match = await db.get(Match, data.get("match_id"))
      if not match:
          raise HTTPException(404, "match not found")
      try:
          odds = json.loads(match.odds_cache) if match.odds_cache else {}
      except (json.JSONDecodeError, ValueError):
          odds = {}
      player = await db.get(Player, player.id)

      prompt = _build_prompt(match, player, odds)
      try:
          message = anthropic_client.messages.create(
              model="claude-haiku-4-5-20251001",
              max_tokens=600,
              system=_SYSTEM,
              messages=[{"role": "user", "content": prompt}],
          )
          suggestions = json.loads(message.content[0].text)
          if not isinstance(suggestions, list):
              suggestions = []
      except Exception:
          suggestions = []

      return {"suggestions": suggestions}
  ```

- [ ] **Run backend tests to confirm nothing broke:**
  ```bash
  cd /Users/hernanrosenblum/Documents/worldcup-betting-v2/backend
  pytest -x -q
  ```
  Expected: all pass. (AI endpoint is not tested because it requires a live API key — that's fine.)

- [ ] **Commit:**
  ```bash
  git add backend/app/routers/ai.py
  git commit -m "feat: AI endpoint returns structured JSON suggestions instead of streaming markdown"
  ```

---

## Task 4 — Frontend: HomePage shows match + tournament bets

**Files:**
- Modify: `frontend/src/pages/HomePage.jsx`

The "Active Bets" section currently only fetches `/api/tournament/bets`. We add `/api/bets` and show pending match bets alongside tournament bets.

- [ ] **Read `frontend/src/pages/HomePage.jsx`** to understand the current structure.

- [ ] **Add `/api/bets` to the Promise.all** in the `load()` function.

  Change the four-way `Promise.all` to five-way:
  ```jsx
  const [matches, predictions, tournamentData, lb, matchBetsData] = await Promise.all([
    api.get("/api/matches"),
    api.get("/api/predictions"),
    api.get("/api/tournament/bets").catch(() => ({ my_bets: [] })),
    api.get("/api/leaderboard"),
    api.get("/api/bets").catch(() => []),
  ])
  ```

- [ ] **After the `setActiveBets(pending)` line**, add:
  ```jsx
  // Pending match bets
  const pendingMatchBets = (matchBetsData || []).filter((b) => b.status === "pending")
  setActiveBets([...pendingMatchBets.map(b => ({ ...b, _kind: "match" })), ...pending.map(b => ({ ...b, _kind: "tournament" }))])
  ```
  
  This tags each bet with `_kind` so the render can show context.

- [ ] **Replace the Active Bets render section** with one that handles both kinds:

  Find the `{activeBets.map((b) => (` block and replace the inner card with:
  ```jsx
  {activeBets.map((b) => (
    <div key={`${b._kind}-${b.id}`} style={{
      background: "#13131f", border: "1px solid #2d2b55",
      borderRadius: 10, padding: "10px 14px", marginBottom: 8,
      display: "flex", justifyContent: "space-between", alignItems: "center",
    }}>
      <div>
        <div style={{ color: "#6b7280", fontSize: 10, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: 1 }}>
          {b._kind === "match"
            ? `${b.home_team} vs ${b.away_team}`
            : b.bet_type.replaceAll("_", " ")}
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
  ```

- [ ] **Run frontend tests:**
  ```bash
  cd /Users/hernanrosenblum/Documents/worldcup-betting-v2/frontend
  npm test -- --run
  ```
  Expected: all pass.

- [ ] **Commit:**
  ```bash
  git add frontend/src/pages/HomePage.jsx
  git commit -m "feat: HomePage Active Bets shows match bets + tournament bets"
  ```

---

## Task 5 — Frontend: MatchDetailPage — Your Bet card + ChallengePanel prefill

**Files:**
- Modify: `frontend/src/pages/MatchDetailPage.jsx`
- Modify: `frontend/src/components/ChallengePanel.jsx`

### 5a — MatchDetailPage reads prefill state and fetches /api/me + /api/bets

- [ ] **Read `frontend/src/pages/MatchDetailPage.jsx`** to understand the existing load pattern.

- [ ] **Add `useLocation` import** to the React Router import:
  ```jsx
  import { useParams, useNavigate, useLocation } from "react-router-dom"
  ```

- [ ] **Add state and fetch** inside the component (after the existing `useState` declarations):
  ```jsx
  const location = useLocation()
  const prefill = location.state?.prefill ?? null

  const [myBet, setMyBet] = useState(null)
  const [playerStreak, setPlayerStreak] = useState(0)
  const [totalChallenges, setTotalChallenges] = useState(0)
  ```

- [ ] **Expand the `load()` function** to also fetch /api/bets and /api/me in parallel with the match:
  ```jsx
  async function load() {
    setError(null)
    try {
      const [data, bets, me] = await Promise.all([
        api.get(`/api/matches/${id}`),
        api.get("/api/bets").catch(() => []),
        api.get("/api/me").catch(() => null),
      ])
      setMatch(data)
      const existing = (bets || []).find((b) => b.match_id === Number(id))
      setMyBet(existing ?? null)
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
  ```

- [ ] **Add "Your Bet" card** inside the `isUpcoming &&` section, ABOVE `<BetPanel>`:
  ```jsx
  {myBet && (
    <div style={{
      background: "#13131f", border: "1px solid #2d2b55",
      borderRadius: 10, padding: "12px 16px", marginBottom: 12,
    }}>
      <div style={{ color: "#6b7280", fontSize: 10, fontWeight: 700,
        textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
        Your Bet
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 14 }}>{myBet.selection}</div>
          <div style={{ color: "#6b7280", fontSize: 11 }}>
            {myBet.stake} tokens @ {myBet.odds}x →{" "}
            <span style={{ color: "#4ade80" }}>win {Math.floor(myBet.stake * myBet.odds).toLocaleString()}</span>
          </div>
        </div>
        <span style={{
          color: "#fbbf24", fontSize: 10, fontWeight: 700,
          background: "#0c0c14", padding: "3px 8px", borderRadius: 999, border: "1px solid #2d2b55",
        }}>PENDING</span>
      </div>
    </div>
  )}
  ```

- [ ] **Pass `prefill`, `playerStreak`, `totalChallenges` to ChallengePanel:**
  ```jsx
  <ChallengePanel
    match={match}
    challenges={match.open_challenges}
    onUpdate={load}
    prefill={prefill}
    playerStreak={playerStreak}
    totalChallenges={totalChallenges}
  />
  ```

### 5b — ChallengePanel accepts prefill + shows streak

- [ ] **Read `frontend/src/components/ChallengePanel.jsx`** to understand current state initialization.

- [ ] **Replace the component signature and add prefill effect:**
  ```jsx
  export default function ChallengePanel({ match, challenges, onUpdate, prefill, playerStreak = 0, totalChallenges = 0 }) {
    const [issuerStake, setIssuerStake] = useState(prefill?.stake ?? 100)
    const [issuerOdds, setIssuerOdds] = useState(prefill?.my_odds ?? 3.0)
    const [acceptorOdds, setAcceptorOdds] = useState(prefill?.their_odds ?? 1.5)
    const [selection, setSelection] = useState(prefill?.my_pick ?? "")
    const [acceptorSelection, setAcceptorSelection] = useState(prefill?.their_pick ?? "")
    // ... keep rest of useState declarations unchanged
  ```

- [ ] **Add bravery streak badge** inside the component return, just above the issue form `<div style={{ background: "#0c0c14"...`:

  First compute the bonus text:
  ```jsx
  const streakBonus = playerStreak >= 5 ? "+35%" : playerStreak === 4 ? "+20%" : playerStreak === 3 ? "+10%" : null
  const MILESTONES = [[5, 50], [10, 150], [20, 400]]
  const nextMilestone = MILESTONES.find(([t]) => totalChallenges < t)
  const milestoneText = nextMilestone
    ? `${nextMilestone[0] - totalChallenges} more challenge${nextMilestone[0] - totalChallenges === 1 ? "" : "s"} → ${nextMilestone[1]} token bonus`
    : null
  ```

  Then add this block before the issue form:
  ```jsx
  {(playerStreak > 0 || milestoneText) && (
    <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
      {playerStreak > 0 && (
        <div style={{
          background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.4)",
          borderRadius: 999, padding: "3px 10px", fontSize: 10, color: "#c4b5fd", fontWeight: 700,
        }}>
          🔥 {playerStreak} streak{streakBonus ? ` — ${streakBonus} win bonus` : ""}
        </div>
      )}
      {milestoneText && (
        <div style={{
          background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)",
          borderRadius: 999, padding: "3px 10px", fontSize: 10, color: "#4ade80", fontWeight: 700,
        }}>
          🎯 {milestoneText}
        </div>
      )}
    </div>
  )}
  ```

- [ ] **Run frontend tests:**
  ```bash
  cd /Users/hernanrosenblum/Documents/worldcup-betting-v2/frontend
  npm test -- --run
  ```
  Expected: all pass.

- [ ] **Commit:**
  ```bash
  git add frontend/src/pages/MatchDetailPage.jsx frontend/src/components/ChallengePanel.jsx
  git commit -m "feat: MatchDetailPage shows existing bet + passes AI prefill to ChallengePanel; ChallengePanel shows streak/milestone badges"
  ```

---

## Task 6 — Frontend: AIPage suggestion cards with "Issue This" button

**Files:**
- Modify: `frontend/src/pages/AIPage.jsx`

The current AIPage streams text into a box. We replace it with a regular API call that returns structured suggestions, which we render as tappable cards.

- [ ] **Replace `frontend/src/pages/AIPage.jsx`** entirely with:

  ```jsx
  import { useState, useEffect } from "react"
  import { useNavigate } from "react-router-dom"
  import { api } from "../api.js"
  import PageBackground from "../components/PageBackground.jsx"

  export default function AIPage() {
    const navigate = useNavigate()
    const [matches, setMatches] = useState([])
    const [selectedMatch, setSelectedMatch] = useState(null)
    const [loading, setLoading] = useState(false)
    const [suggestions, setSuggestions] = useState([])
    const [error, setError] = useState(null)

    useEffect(() => {
      api.get("/api/matches")
        .then((data) => setMatches(data.filter((m) => m.status === "upcoming")))
        .catch(() => [])
    }, [])

    async function generate() {
      if (!selectedMatch || loading) return
      setSuggestions([])
      setError(null)
      setLoading(true)
      try {
        const data = await api.post("/api/ai/suggest-challenge", { match_id: selectedMatch.id })
        setSuggestions(data.suggestions || [])
        if ((data.suggestions || []).length === 0) setError("No suggestions returned — try another match.")
      } catch (err) {
        setError(err.message || "Failed to generate suggestions")
      } finally {
        setLoading(false)
      }
    }

    function useThis(suggestion) {
      navigate(`/matches/${selectedMatch.id}`, {
        state: {
          prefill: {
            my_pick: suggestion.my_pick,
            their_pick: suggestion.their_pick,
            my_odds: suggestion.my_odds,
            their_odds: suggestion.their_odds,
            stake: suggestion.stake,
          },
        },
      })
    }

    return (
      <div>
        <PageBackground momentKey="iniesta_2010" />
        <div style={{ padding: "16px 16px 8px" }}>
          <div style={{ fontSize: 24 }}>🤖</div>
          <div style={{ color: "#e2e8f0", fontWeight: 800, fontSize: 20, marginTop: 4 }}>AI Assistant</div>
        </div>
        <div style={{ padding: 16, maxWidth: 480, margin: "0 auto" }}>
          <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 20 }}>
            Pick a match and Claude will suggest challenge ideas based on the current odds.
          </p>

          {/* Match picker */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
              Select a match
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {matches.length === 0 && (
                <p style={{ color: "#6b7280", fontSize: 13 }}>No upcoming matches.</p>
              )}
              {matches.map((m) => (
                <button key={m.id} onClick={() => { setSelectedMatch(m); setSuggestions([]) }}
                  style={{
                    background: selectedMatch?.id === m.id
                      ? "linear-gradient(135deg, rgba(168,85,247,0.2), rgba(59,130,246,0.2))"
                      : "#13131f",
                    border: `1px solid ${selectedMatch?.id === m.id ? "#a855f7" : "#2d2b55"}`,
                    borderRadius: 10, padding: "10px 14px",
                    color: "#e2e8f0", fontSize: 13, fontWeight: 600,
                    textAlign: "left", cursor: "pointer",
                  }}>
                  {m.home_team} vs {m.away_team}
                  <span style={{ color: "#6b7280", fontSize: 11, marginLeft: 8 }}>{m.round}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={generate}
            disabled={!selectedMatch || loading}
            style={{
              width: "100%",
              background: !selectedMatch || loading ? "#1e1b3a" : "linear-gradient(135deg, #a855f7, #3b82f6)",
              color: !selectedMatch || loading ? "#6b7280" : "#fff",
              border: "none", borderRadius: 10, padding: "13px",
              fontSize: 15, fontWeight: 700,
              cursor: !selectedMatch || loading ? "not-allowed" : "pointer",
              marginBottom: 20,
            }}
          >
            {loading ? "✨ Thinking..." : "✨ Generate Challenge Ideas"}
          </button>

          {error && <p style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>⚠ {error}</p>}

          {/* Suggestion cards */}
          {suggestions.map((s, i) => (
            <div key={i} style={{
              background: "#13131f", border: "1px solid #2d2b55",
              borderRadius: 12, padding: 16, marginBottom: 12,
            }}>
              <div style={{ color: "#a78bfa", fontSize: 11, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                {s.title}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ textAlign: "center", flex: 1 }}>
                  <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 2 }}>Your pick</div>
                  <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 14 }}>{s.my_pick}</div>
                  <div style={{ color: "#4ade80", fontSize: 11 }}>{s.my_odds}x</div>
                </div>
                <div style={{ color: "#2d2b55", fontSize: 16, alignSelf: "center" }}>vs</div>
                <div style={{ textAlign: "center", flex: 1 }}>
                  <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 2 }}>Their pick</div>
                  <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 14 }}>{s.their_pick}</div>
                  <div style={{ color: "#f87171", fontSize: 11 }}>{s.their_odds}x</div>
                </div>
                <div style={{ textAlign: "center", flex: 1 }}>
                  <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 2 }}>Stake</div>
                  <div style={{ color: "#fbbf24", fontWeight: 700, fontSize: 14 }}>{s.stake}</div>
                  <div style={{ color: "#6b7280", fontSize: 11 }}>tokens</div>
                </div>
              </div>
              <p style={{ color: "#6b7280", fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>{s.reason}</p>
              <button onClick={() => useThis(s)} style={{
                width: "100%",
                background: "linear-gradient(135deg, #a855f7, #3b82f6)",
                color: "#fff", border: "none", borderRadius: 8,
                padding: "9px", fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}>
                Issue This Challenge →
              </button>
            </div>
          ))}
        </div>
      </div>
    )
  }
  ```

- [ ] **Run frontend tests:**
  ```bash
  cd /Users/hernanrosenblum/Documents/worldcup-betting-v2/frontend
  npm test -- --run
  ```
  Expected: all pass.

- [ ] **Commit:**
  ```bash
  git add frontend/src/pages/AIPage.jsx
  git commit -m "feat: AIPage shows actionable suggestion cards with one-tap Issue This Challenge"
  ```

---

## Task 7 — Final test run & push

- [ ] **Run all backend tests:**
  ```bash
  cd /Users/hernanrosenblum/Documents/worldcup-betting-v2/backend
  pytest -x -q
  ```
  Expected: all pass.

- [ ] **Run all frontend tests:**
  ```bash
  cd /Users/hernanrosenblum/Documents/worldcup-betting-v2/frontend
  npm test -- --run
  ```
  Expected: all pass.

- [ ] **Manual smoke test checklist:**
  - Home page "Active Bets" section shows both pending match bets AND pending tournament bets
  - Tapping a match card in MatchDetailPage shows "Your Bet" card if you've already bet
  - ChallengePanel shows 🔥 streak badge and 🎯 milestone progress (if applicable)
  - AI page: select a match → Generate → see 2 suggestion cards with picks, odds, stake, reason
  - Tap "Issue This Challenge →" → navigates to match detail with ChallengePanel pre-filled
  - ChallengePanel pre-fills with the suggestion's picks and odds

- [ ] **Push:**
  ```bash
  git push
  ```

---

## Self-Review

**Spec coverage check:**

| Gap from review | Task that closes it |
|---|---|
| Match bets invisible | Task 1 (backend endpoint) + Task 4 (homepage) + Task 5 (match detail) |
| AI suggestions dead end | Task 3 (structured output) + Task 6 (suggestion cards) + Task 5 (prefill) |
| Bravery mechanics invisible | Task 2 (GET /api/me) + Task 5 (ChallengePanel streak badge) |

**Placeholder scan:** None found. All code blocks are complete implementations.

**Type consistency:**
- `prefill.my_pick` set in AIPage `useThis()` and read in ChallengePanel via `prefill?.my_pick` ✓
- `prefill.my_odds` / `prefill.their_odds` / `prefill.stake` consistent across AIPage and ChallengePanel ✓
- `/api/bets` response field `odds` (= `odds_at_placement` in DB) used consistently in HomePage and MatchDetailPage ✓
