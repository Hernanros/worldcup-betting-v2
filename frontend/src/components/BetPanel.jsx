import { useState } from "react"
import { motion } from "framer-motion"
import { api } from "../api.js"

const MARKETS = {
  "1x2": ["Home Win", "Draw", "Away Win"],
  "btts": ["Yes", "No"],
  "totals": ["Over 2.5", "Under 2.5", "Over 3.5", "Under 3.5"],
  "correct_score": [],
}

export default function BetPanel({ match, odds, onBetPlaced }) {
  const [betType, setBetType] = useState("1x2")
  const [selection, setSelection] = useState("")
  const [customScore, setCustomScore] = useState("")
  const [stake, setStake] = useState(100)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState("")

  const oddsForSelection = odds?.[betType]?.find(
    (o) => o.name === (betType === "correct_score" ? customScore : selection)
  )?.price

  async function submit() {
    const sel = betType === "correct_score" ? customScore : selection
    if (!sel) return setMsg("Pick a selection first")
    if (!stake || stake <= 0) return setMsg("Stake must be positive")
    setLoading(true)
    setMsg("")
    try {
      const result = await api.post(`/api/matches/${match.id}/bets`, {
        bet_type: betType, selection: sel, stake, odds: oddsForSelection || 2.0,
      })
      setMsg(`✓ Bet placed! New balance: ${result.new_balance} tokens`)
      onBetPlaced?.(result.new_balance)
    } catch (err) {
      setMsg(`✗ ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: "#13131f", border: "1px solid #2d2b55", borderRadius: 12, padding: 16, marginBottom: 12 }}>
      <h3 style={{ color: "#a78bfa", fontWeight: 700, marginBottom: 12, fontSize: 14 }}>Place a Bet</h3>

      {/* Market selector */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {Object.keys(MARKETS).map((m) => (
          <button key={m} onClick={() => { setBetType(m); setSelection("") }}
            style={{
              background: betType === m ? "linear-gradient(135deg,#a855f7,#3b82f6)" : "#1e1b3a",
              color: betType === m ? "#fff" : "#6b7280",
              border: "none", borderRadius: 999, padding: "4px 12px",
              fontSize: 11, fontWeight: 600, cursor: "pointer",
            }}>
            {m}
          </button>
        ))}
      </div>

      {/* Selections */}
      {betType === "correct_score" ? (
        <input
          placeholder="e.g. 2-1"
          value={customScore}
          onChange={(e) => setCustomScore(e.target.value)}
          style={{ background: "#0c0c14", border: "1px solid #2d2b55", borderRadius: 8,
            padding: "8px 12px", color: "#e2e8f0", fontSize: 14, width: "100%", marginBottom: 10 }}
        />
      ) : (
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {MARKETS[betType].map((sel) => {
            const price = odds?.[betType]?.find((o) => o.name === sel)?.price
            return (
              <button key={sel} onClick={() => setSelection(sel)}
                style={{
                  background: selection === sel ? "linear-gradient(135deg,#a855f7,#3b82f6)" : "#0c0c14",
                  color: selection === sel ? "#fff" : "#e2e8f0",
                  border: "1px solid #2d2b55", borderRadius: 8, padding: "8px 14px",
                  fontSize: 12, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center",
                }}>
                <span>{sel}</span>
                {price && <span style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>{price}</span>}
              </button>
            )
          })}
        </div>
      )}

      {/* Stake */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ color: "#6b7280", fontSize: 12 }}>Stake:</span>
        <input type="number" min={1} value={stake} onChange={(e) => setStake(Number(e.target.value))}
          style={{ background: "#0c0c14", border: "1px solid #2d2b55", borderRadius: 8,
            padding: "6px 10px", color: "#e2e8f0", fontSize: 14, width: 100 }} />
        <span style={{ color: "#6b7280", fontSize: 12 }}>tokens</span>
        {oddsForSelection && (
          <span style={{ color: "#4ade80", fontSize: 12, marginLeft: "auto" }}>
            Win: {Math.floor(stake * oddsForSelection)}
          </span>
        )}
      </div>

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={submit}
        disabled={loading}
        style={{
          width: "100%", background: "linear-gradient(135deg,#a855f7,#3b82f6)",
          color: "#fff", border: "none", borderRadius: 8, padding: "11px",
          fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}>
        {loading ? "Placing..." : "Place Bet"}
      </motion.button>

      {msg && <p style={{ color: msg.startsWith("✓") ? "#4ade80" : "#f87171", fontSize: 12, marginTop: 8 }}>{msg}</p>}
    </div>
  )
}
