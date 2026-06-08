import { useState, useEffect } from "react"
import { api } from "../api.js"
import { subscribe } from "../ws.js"
import { getPlayer } from "../auth.js"
import LeaderboardRow from "../components/LeaderboardRow.jsx"
import PageBackground from "../components/PageBackground.jsx"
import HelpTip from "../components/HelpTip.jsx"

export default function LeaderboardPage() {
  const currentPlayer = getPlayer()
  const isAdmin = currentPlayer?.is_admin ?? false

  const [players, setPlayers] = useState([])
  const [predictions, setPredictions] = useState([])
  const [redCards, setRedCards] = useState([])
  const [tab, setTab] = useState("tokens")
  const [error, setError] = useState(null)
  // Admin: league selector
  const [leagues, setLeagues] = useState([])
  const [selectedLeague, setSelectedLeague] = useState(null) // null = all

  useEffect(() => {
    if (isAdmin) {
      api.get("/api/leagues").then(setLeagues).catch(() => {})
    }
  }, [isAdmin])

  async function load() {
    setError(null)
    const qs = isAdmin && selectedLeague ? `?league_id=${selectedLeague}` : ""
    try {
      const [p, pred, r] = await Promise.all([
        api.get(`/api/leaderboard${qs}`),
        api.get(`/api/leaderboard/predictions${qs}`),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeague])

  useEffect(() => {
    const unsub = subscribe((e) => { if (e.type === "leaderboard_updated") load() })
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeague])

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

        {/* Admin league selector */}
        {isAdmin && leagues.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
              👁 Viewing group
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                onClick={() => setSelectedLeague(null)}
                style={{
                  padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                  cursor: "pointer", border: "1px solid",
                  background: selectedLeague === null ? "rgba(168,85,247,0.2)" : "transparent",
                  borderColor: selectedLeague === null ? "rgba(168,85,247,0.6)" : "#2d2b55",
                  color: selectedLeague === null ? "#c4b5fd" : "#6b7280",
                }}
              >
                All groups
              </button>
              {leagues.map((lg) => (
                <button
                  key={lg.id}
                  onClick={() => setSelectedLeague(lg.id)}
                  style={{
                    padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                    cursor: "pointer", border: "1px solid",
                    background: selectedLeague === lg.id ? "rgba(168,85,247,0.2)" : "transparent",
                    borderColor: selectedLeague === lg.id ? "rgba(168,85,247,0.6)" : "#2d2b55",
                    color: selectedLeague === lg.id ? "#c4b5fd" : "#6b7280",
                  }}
                >
                  {lg.name}
                  <span style={{ color: "#4b5563", marginLeft: 4 }}>({lg.player_count})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto" }}>
          {TABS.map((t) => (
            <div key={t.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              <button onClick={() => setTab(t.id)}
                style={{
                  background: tab === t.id ? "linear-gradient(135deg,#a855f7,#3b82f6)" : "#1e1b3a",
                  color: tab === t.id ? "#fff" : "#6b7280", border: "none",
                  borderRadius: 999, padding: "5px 16px", fontSize: 12, fontWeight: 600,
                  cursor: "pointer", whiteSpace: "nowrap",
                }}>
                {t.label}
              </button>
              <HelpTip text={t.tip} />
            </div>
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

        {tab === "red-cards" && (
          <>
            {redCards.length === 0 ? (
              <p style={{ color: "#6b7280", textAlign: "center", fontSize: 13 }}>
                No red cards yet — check back after matches start 🟥
              </p>
            ) : (
              redCards.map((r) => (
                <div key={r.team} style={{ background: "#13131f", border: "1px solid #2d2b55",
                  borderRadius: 10, padding: "10px 16px", marginBottom: 8,
                  display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#e2e8f0", fontWeight: 600 }}>#{r.rank} {r.team}</span>
                  <span style={{ color: "#ef4444", fontWeight: 700 }}>{r.red_cards} 🟥</span>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  )
}
