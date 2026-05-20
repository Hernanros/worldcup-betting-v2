import { useState, useEffect } from "react"
import { api } from "../api.js"

const STATUS_COLOR = { pending: "#fbbf24", won: "#4ade80", lost: "#f87171" }

export default function BetsPage() {
  const [tournament, setTournament] = useState(null)
  const [tab, setTab] = useState("match")
  const [error, setError] = useState(null)

  async function load() {
    setError(null)
    try {
      const t = await api.get("/api/tournament/bets")
      setTournament(t)
    } catch (err) {
      setError(err.message || "Failed to load bets")
    }
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

      {error && <p style={{ color: "#f87171", textAlign: "center", fontSize: 13 }}>⚠ {error}</p>}

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
                <span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 13 }}>{b.bet_type.replaceAll("_", " ")}</span>
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
