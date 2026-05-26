import { useState, useEffect } from "react"
import { api } from "../api.js"
import TournamentBetPanel from "../components/TournamentBetPanel.jsx"
import PageBackground from "../components/PageBackground.jsx"

const STATUS_COLOR = { pending: "#fbbf24", won: "#4ade80", lost: "#f87171" }

export default function TournamentPage() {
  const [tournament, setTournament] = useState(null)
  const [error, setError] = useState(null)

  async function load() {
    setError(null)
    try {
      const t = await api.get("/api/tournament/bets")
      setTournament(t)
    } catch (err) {
      setError(err.message || "Failed to load tournament bets")
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div>
      <PageBackground momentKey="messi_2022" />
      <div style={{ padding: "16px 16px 8px" }}>
        <div style={{ fontSize: 24 }}>🏆</div>
        <div style={{ color: "#e2e8f0", fontWeight: 800, fontSize: 20, marginTop: 4 }}>Tournament</div>
      </div>
      <div style={{ padding: 16 }}>

        {error && <p style={{ color: "#f87171", textAlign: "center", fontSize: 13 }}>⚠ {error}</p>}

        {/* Place a bet */}
        <div style={{
          background: "#13131f", border: "1px solid #2d2b55",
          borderRadius: 12, padding: 16, marginBottom: 16,
        }}>
          <h3 style={{ color: "#a78bfa", fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
            Place a Long-Term Bet
          </h3>
          <TournamentBetPanel onBetPlaced={load} />
        </div>

        {/* Existing bets */}
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
    </div>
  )
}
