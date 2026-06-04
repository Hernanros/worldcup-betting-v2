import { useState, useEffect } from "react"
import { api } from "../api.js"
import { subscribe } from "../ws.js"
import LeaderboardRow from "../components/LeaderboardRow.jsx"
import PageBackground from "../components/PageBackground.jsx"
import HelpTip from "../components/HelpTip.jsx"

export default function LeaderboardPage() {
  const [players, setPlayers] = useState([])
  const [predictions, setPredictions] = useState([])
  const [redCards, setRedCards] = useState([])
  const [tab, setTab] = useState("tokens")
  const [error, setError] = useState(null)

  async function load() {
    setError(null)
    try {
      const [p, pred, r] = await Promise.all([
        api.get("/api/leaderboard"),
        api.get("/api/leaderboard/predictions"),
        api.get("/api/leaderboard/red-cards"),
      ])
      setPlayers(p)
      setPredictions(pred)
      setRedCards(r)
    } catch (err) {
      setError(err.message || "Failed to load leaderboard")
    }
  }

  useEffect(() => {
    load()
    const unsub = subscribe((e) => { if (e.type === "leaderboard_updated") load() })
    return unsub
  }, [])

  const TABS = [
    { id: "tokens", label: "🏆 Tokens", tip: "Ranked by total token balance. Earn tokens by winning bets, challenges, and Deep Cuts markets." },
    { id: "predictions", label: "🎯 Predictions", tip: "Ranked by prediction points. Exact final score = 3 pts, correct match outcome (win/draw/loss) = 1 pt. You can make one prediction per match." },
    { id: "red-cards", label: "🟥 Red Cards", tip: "Teams ranked by total red cards received across all their matches. A fun side-stat — not tied to your scoring." },
  ]

  return (
    <div>
      <PageBackground momentKey="zidane_2006" />
      <div style={{ padding: "16px 16px 8px" }}>
        <div style={{ fontSize: 24 }}>📊</div>
        <div style={{ color: "#e2e8f0", fontWeight: 800, fontSize: 20, marginTop: 4 }}>Rankings</div>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto" }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                background: tab === t.id ? "linear-gradient(135deg,#a855f7,#3b82f6)" : "#1e1b3a",
                color: tab === t.id ? "#fff" : "#6b7280", border: "none",
                borderRadius: 999, padding: "5px 16px", fontSize: 12, fontWeight: 600,
                cursor: "pointer", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4,
              }}>
              {t.label} <HelpTip text={t.tip} />
            </button>
          ))}
        </div>

        {error && <p style={{ color: "#f87171", textAlign: "center", fontSize: 13 }}>⚠ {error}</p>}

        {tab === "tokens" && players.map((p, i) => (
          <LeaderboardRow key={p.id} player={p} rank={p.rank ?? i + 1} />
        ))}

        {tab === "predictions" && (
          <>
            <p style={{ color: "#6b7280", fontSize: 11, marginBottom: 12 }}>
              Exact score = 3 pts · Correct outcome = 1 pt
            </p>
            {predictions.map((p, i) => (
              <LeaderboardRow key={p.id} player={p} rank={p.rank ?? i + 1} />
            ))}
            {predictions.length === 0 && (
              <p style={{ color: "#6b7280", textAlign: "center", fontSize: 13 }}>
                No predictions yet — be first to call a score!
              </p>
            )}
          </>
        )}

        {tab === "red-cards" && redCards.map((r) => (
          <div key={r.team} style={{ background: "#13131f", border: "1px solid #2d2b55",
            borderRadius: 10, padding: "10px 16px", marginBottom: 8,
            display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#e2e8f0", fontWeight: 600 }}>#{r.rank} {r.team}</span>
            <span style={{ color: "#ef4444", fontWeight: 700 }}>{r.red_cards} 🟥</span>
          </div>
        ))}
      </div>
    </div>
  )
}
