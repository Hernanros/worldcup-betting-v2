import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { api } from "../api.js"
import { getPlayer } from "../auth.js"
import PageHero from "../components/PageHero.jsx"

// Default odds used when match.odds is null
const DEFAULT_ODDS = { home_win: 2.5, draw: 3.2, away_win: 2.8 }

/**
 * Pure payout calculator — exported for testing.
 * outcome: "home_win" | "draw" | "away_win"
 * @param {number} minute - Match minute (context only; odds are static, no in-play adjustments yet)
 */
export function computePreview(homeGoals, awayGoals, minute, stake, outcome, match) {
  const oddsArr = match?.odds?.["1x2"] ?? null
  const nameMap = { home_win: "Home Win", draw: "Draw", away_win: "Away Win" }
  const oddsValue = oddsArr
    ? (oddsArr.find((o) => o.name === nameMap[outcome])?.price ?? DEFAULT_ODDS[outcome])
    : DEFAULT_ODDS[outcome]

  const isCurrentlyWinning =
    (outcome === "home_win" && homeGoals > awayGoals) ||
    (outcome === "draw" && homeGoals === awayGoals) ||
    (outcome === "away_win" && awayGoals > homeGoals)

  const payout = isCurrentlyWinning ? Math.floor(stake * oddsValue) : 0
  const netChange = isCurrentlyWinning ? payout - stake : -stake

  return { payout, netChange, isCurrentlyWinning, oddsValue }
}

const STEPPER_STYLE = {
  background: "#0c0c14", border: "1px solid #2d2b55", borderRadius: 8,
  padding: "7px 11px", color: "#e2e8f0", fontSize: 15, fontWeight: 700,
  textAlign: "center", minWidth: 48,
}

function Stepper({ label, value, onChange, min = 0, max = 99 }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      <span style={{ color: "#6b7280", fontSize: 12 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          style={{ background: "#1e1b3a", border: "1px solid #2d2b55", color: "#a78bfa", borderRadius: 6, width: 28, height: 28, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}
        >−</button>
        <span style={STEPPER_STYLE}>{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          style={{ background: "#1e1b3a", border: "1px solid #2d2b55", color: "#a78bfa", borderRadius: 6, width: 28, height: 28, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}
        >+</button>
      </div>
    </div>
  )
}

export default function SandboxPage() {
  const [matches, setMatches] = useState([])
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [homeGoals, setHomeGoals] = useState(1)
  const [awayGoals, setAwayGoals] = useState(0)
  const [minute, setMinute] = useState(45)
  const [stake, setStake] = useState(200)
  const [outcome, setOutcome] = useState("home_win")
  const [simMinute, setSimMinute] = useState(null)
  const [simRunning, setSimRunning] = useState(false)
  const [leaderboard, setLeaderboard] = useState([])
  const simRef = useRef(null)

  useEffect(() => {
    api.get("/api/matches").then((data) => {
      const upcoming = (data || []).filter((m) => m.status === "upcoming")
      setMatches(upcoming)
      if (upcoming.length > 0) setSelectedMatch(upcoming[0])
    }).catch(() => {})
    api.get("/api/leaderboard").then((d) => setLeaderboard(d || [])).catch(() => {})
  }, [])

  const preview = computePreview(homeGoals, awayGoals, minute, stake, outcome, selectedMatch)
  const player = getPlayer()
  const currentBalance = player?.token_balance ?? 0
  const newBalance = currentBalance + preview.netChange
  const currentRank = leaderboard.findIndex((p) => p.id === player?.id) + 1
  const newRank = leaderboard.filter((p) => p.token_balance > newBalance).length + 1

  function runSimulation() {
    if (simRunning) {
      clearInterval(simRef.current)
      setSimRunning(false)
      setSimMinute(null)
      return
    }
    setSimRunning(true)
    let m = minute
    setSimMinute(m)
    simRef.current = setInterval(() => {
      m += 1
      setSimMinute(m)
      if (m >= 90) {
        clearInterval(simRef.current)
        setSimRunning(false)
      }
    }, 200)
  }

  useEffect(() => () => clearInterval(simRef.current), [])

  const displayMinute = simRunning ? simMinute : minute

  const OUTCOME_OPTS = [
    { value: "home_win", label: selectedMatch ? `${selectedMatch.home_team} Win` : "Home Win" },
    { value: "draw", label: "Draw" },
    { value: "away_win", label: selectedMatch ? `${selectedMatch.away_team} Win` : "Away Win" },
  ]

  return (
    <div>
      <PageHero momentKey="rotating" />
      <div style={{ padding: 16, maxWidth: 480, margin: "0 auto" }}>

        <h2 className="gradient-text" style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>
          🧪 Sandbox
        </h2>
        <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 20 }}>
          Set up any scenario and see exactly what happens to your balance and rank.
        </p>

        {/* Match picker */}
        <p style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
          Pick a match
        </p>
        {matches.length === 0 && (
          <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>No upcoming matches.</p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
          {matches.map((m) => (
            <button key={m.id} onClick={() => setSelectedMatch(m)}
              style={{
                background: selectedMatch?.id === m.id ? "rgba(168,85,247,0.12)" : "#13131f",
                border: `1px solid ${selectedMatch?.id === m.id ? "#a855f7" : "#2d2b55"}`,
                borderRadius: 10, padding: "10px 14px",
                color: "#e2e8f0", fontSize: 13, fontWeight: 600, textAlign: "left", cursor: "pointer",
              }}>
              {m.home_team} vs {m.away_team}
            </button>
          ))}
        </div>

        {/* Scenario builder */}
        {selectedMatch && (
          <>
            <p style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
              Scenario
            </p>
            <div style={{ background: "#13131f", border: "1px solid #2d2b55", borderRadius: 12, padding: 16, marginBottom: 12 }}>
              <Stepper label={`${selectedMatch.home_team} goals`} value={homeGoals} onChange={setHomeGoals} max={9} />
              <Stepper label={`${selectedMatch.away_team} goals`} value={awayGoals} onChange={setAwayGoals} max={9} />
              <Stepper label="Minute" value={minute} onChange={setMinute} min={1} max={90} />
              <Stepper label="My stake (tokens)" value={stake} onChange={setStake} min={50} max={2000} />
              {/* Quick stake picks */}
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {[100, 200, 500].map((s) => (
                  <button key={s} onClick={() => setStake(s)}
                    style={{ background: stake === s ? "linear-gradient(135deg,#a855f7,#3b82f6)" : "#1e1b3a",
                      color: stake === s ? "#fff" : "#6b7280", border: "none",
                      borderRadius: 999, padding: "3px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                    {s}
                  </button>
                ))}
              </div>
              {/* Outcome toggle */}
              <p style={{ color: "#6b7280", fontSize: 11, marginBottom: 6 }}>My bet on</p>
              <div style={{ display: "flex", gap: 6 }}>
                {OUTCOME_OPTS.map((o) => (
                  <button key={o.value} onClick={() => setOutcome(o.value)}
                    style={{ flex: 1, background: outcome === o.value ? "linear-gradient(135deg,#a855f7,#3b82f6)" : "#0c0c14",
                      color: outcome === o.value ? "#fff" : "#6b7280",
                      border: "1px solid #2d2b55", borderRadius: 8, padding: "7px 4px",
                      fontSize: 10, fontWeight: 700, cursor: "pointer", textAlign: "center" }}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Live preview */}
            <div style={{ background: "linear-gradient(135deg,rgba(168,85,247,0.08),rgba(59,130,246,0.08))",
              border: "1px solid rgba(168,85,247,0.25)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontWeight: 800, fontSize: 13 }}>
                  {selectedMatch.home_team} {homeGoals}–{awayGoals} {selectedMatch.away_team}
                </span>
                <span style={{ color: simRunning ? "#ef4444" : "#6b7280", fontWeight: 700, fontSize: 13 }}>
                  {displayMinute ?? minute}'
                  {simMinute >= 90 && " · FT"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                <span style={{ color: "#6b7280" }}>Bet odds</span>
                <span style={{ color: "#a78bfa", fontWeight: 700 }}>{preview.oddsValue}x</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                <span style={{ color: "#6b7280" }}>Payout if result holds</span>
                <span style={{ color: preview.isCurrentlyWinning ? "#4ade80" : "#f87171", fontWeight: 700 }}>
                  {preview.isCurrentlyWinning ? `+${preview.payout}` : "0"} tokens
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                <span style={{ color: "#6b7280" }}>Net balance change</span>
                <span style={{ color: preview.netChange >= 0 ? "#4ade80" : "#f87171", fontWeight: 700 }}>
                  {preview.netChange >= 0 ? "+" : ""}{preview.netChange}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                <span style={{ color: "#6b7280" }}>New balance</span>
                <span className="gradient-text" style={{ fontWeight: 800 }}>{newBalance.toLocaleString()}</span>
              </div>
              {currentRank > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "#6b7280" }}>Leaderboard position</span>
                  <span style={{ color: "#fbbf24", fontWeight: 700 }}>
                    #{currentRank} → #{newRank}
                    {newRank < currentRank ? " ↑" : newRank > currentRank ? " ↓" : ""}
                  </span>
                </div>
              )}
            </div>

            {/* Simulation button */}
            <motion.button whileTap={{ scale: 0.97 }} onClick={runSimulation}
              style={{
                width: "100%",
                background: simRunning ? "#1e1b3a" : "linear-gradient(135deg,#a855f7,#3b82f6)",
                color: simRunning ? "#6b7280" : "#fff",
                border: "none", borderRadius: 10, padding: 13,
                fontSize: 14, fontWeight: 800, cursor: "pointer",
              }}>
              {simRunning ? `⏱ ${simMinute}' — Stop` : "▶ Run Live Simulation"}
            </motion.button>

            {!selectedMatch.odds && (
              <p style={{ color: "#6b7280", fontSize: 10, textAlign: "center", marginTop: 8 }}>
                No live odds for this match — using neutral defaults (H: 2.5, D: 3.2, A: 2.8)
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
