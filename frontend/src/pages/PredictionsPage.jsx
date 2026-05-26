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
