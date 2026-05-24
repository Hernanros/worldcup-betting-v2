import { useState, useEffect } from "react"
import { api } from "../api.js"
import TournamentBetPanel from "../components/TournamentBetPanel.jsx"

const STATUS_COLOR = { pending: "#fbbf24", won: "#4ade80", lost: "#f87171" }

export default function BetsPage() {
  const [tournament, setTournament] = useState(null)
  const [tab, setTab] = useState("tournament")

  async function load() {
    const t = await api.get("/api/tournament/bets").catch(() => null)
    setTournament(t)
  }

  useEffect(() => { load() }, [])

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["tournament", "match"].map((t) => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              background: tab === t ? "linear-gradient(135deg,#a855f7,#3b82f6)" : "#1e1b3a",
              color: tab === t ? "#fff" : "#6b7280", border: "none",
              borderRadius: 999, padding: "5px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>
            {t === "tournament" ? "🏆 Tournament" : "⚽ Match Bets"}
          </button>
        ))}
      </div>

      {/* ── TOURNAMENT TAB ─────────────────────────────────── */}
      {tab === "tournament" && (
        <div>
          {/* Bet placement panel */}
          <div style={{
            background: "#13131f", border: "1px solid #2d2b55",
            borderRadius: 12, padding: 16, marginBottom: 16,
          }}>
            <h3 style={{ color: "#a78bfa", fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
              Place a Long-Term Bet
            </h3>
            <TournamentBetPanel onBetPlaced={() => load()} />
          </div>

          {/* My existing tournament bets */}
          {tournament && tournament.my_bets.length > 0 && (
            <div>
              <h3 style={{ color: "#6b7280", fontSize: 12, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                Your Tournament Bets
              </h3>
              {tournament.my_bets.map((b) => (
                <div key={b.id} style={{
                  background: "#13131f", border: "1px solid #2d2b55",
                  borderRadius: 10, padding: 12, marginBottom: 8,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ color: "#6b7280", fontSize: 10, fontWeight: 700,
                        textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>
                        {b.bet_type.replaceAll("_", " ")}
                      </div>
                      <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 14 }}>
                        {b.selection}
                      </div>
                      <div style={{ color: "#6b7280", fontSize: 11, marginTop: 4 }}>
                        {b.stake} tokens @ {b.odds}x →{" "}
                        <span style={{ color: "#4ade80" }}>
                          win {Math.floor(b.stake * b.odds).toLocaleString()}
                        </span>
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

      {/* ── MATCH BETS TAB ─────────────────────────────────── */}
      {tab === "match" && (
        <div style={{
          background: "#13131f", border: "1px solid #2d2b55",
          borderRadius: 10, padding: 20, textAlign: "center",
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚽</div>
          <p style={{ color: "#6b7280", fontSize: 13 }}>
            Place match bets from the <strong style={{ color: "#a78bfa" }}>Matches</strong> tab → tap a match → Bet Panel.
          </p>
        </div>
      )}
    </div>
  )
}
