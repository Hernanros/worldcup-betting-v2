import { useState, useEffect } from "react"
import { api } from "../api.js"
import { subscribe } from "../ws.js"
import LeaderboardRow from "../components/LeaderboardRow.jsx"
import PageBackground from "../components/PageBackground.jsx"

export default function LeaderboardPage() {
  const [players, setPlayers] = useState([])
  const [redCards, setRedCards] = useState([])
  const [tab, setTab] = useState("tokens")
  const [error, setError] = useState(null)

  async function load() {
    setError(null)
    try {
      const [p, r] = await Promise.all([
        api.get("/api/leaderboard"),
        api.get("/api/leaderboard/red-cards"),
      ])
      setPlayers(p)
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

  return (
    <div>
      <PageBackground momentKey="zidane_2006" />
      <div style={{ padding: "16px 16px 8px" }}>
        <div style={{ fontSize: 24 }}>📊</div>
        <div style={{ color: "#e2e8f0", fontWeight: 800, fontSize: 20, marginTop: 4 }}>Rankings</div>
      </div>
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

        {error && <p style={{ color: "#f87171", textAlign: "center", fontSize: 13 }}>⚠ {error}</p>}

        {tab === "tokens" && players.map((p, i) => (
          <LeaderboardRow key={p.id} player={p} rank={p.rank ?? i + 1} />
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
    </div>
  )
}
