import { useState } from "react"
import { motion } from "framer-motion"
import { api } from "../api.js"
import HelpTip from "./HelpTip.jsx"

const MARKETS = {
  "1x2":           { label: "1×2",         options: ["Home Win", "Draw", "Away Win"] },
  "both_score":    { label: "Both Score",   options: ["Yes", "No"] },
  "totals":        { label: "Goals",        options: ["Over 2.5", "Under 2.5", "Over 3.5", "Under 3.5"] },
  "correct_score": { label: "Score",        options: [] },
}

// Map display key → API bet_type
const BET_TYPE_MAP = {
  "1x2":           "1x2",
  "both_score":    "btts",
  "totals":        "totals",
  "correct_score": "correct_score",
}

export default function BetPanel({ match, odds, onBetPlaced, wildcardsUsed = 0 }) {
  const [marketKey, setMarketKey] = useState("1x2")
  const [selection, setSelection] = useState("")
  const [customScore, setCustomScore] = useState("")
  const [stake, setStake] = useState(100)
  const [isWildcard, setIsWildcard] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState("")

  const betType = BET_TYPE_MAP[marketKey]
  const market = MARKETS[marketKey]

  // Map 1x2 display names back to team names for odds lookup
  const oddsKey = marketKey === "1x2" ? "h2h" : marketKey === "both_score" ? "btts" : betType

  // For 1x2, the API submission and odds lookup both use team names / "Draw"
  const apiSelection = marketKey === "1x2"
    ? (selection === "Home Win" ? match.home_team : selection === "Away Win" ? match.away_team : "Draw")
    : marketKey === "correct_score" ? customScore
    : selection

  // Odds lookup uses team names for 1x2 (h2h cache is keyed by team name, not "Home Win")
  const oddsLookupName = marketKey === "1x2" ? apiSelection
    : marketKey === "correct_score" ? customScore
    : selection

  const oddsForSelection = odds?.[oddsKey]?.find((o) => o.name === oddsLookupName)?.price

  const wildcardsLeft = 3 - wildcardsUsed
  const canWildcard = wildcardsLeft > 0

  async function submit() {
    const sel = marketKey === "correct_score" ? customScore : apiSelection
    if (!sel) return setMsg("Pick a selection first")
    if (!stake || stake <= 0) return setMsg("Stake must be positive")
    setLoading(true)
    setMsg("")
    try {
      const result = await api.post(`/api/matches/${match.id}/bets`, {
        bet_type: betType,
        selection: sel,
        stake,
        odds: oddsForSelection || 2.0,
        is_wildcard: isWildcard,
      })
      const bonus = isWildcard ? " 🃏 Wildcard — win pays 2×!" : ""
      setMsg(`✓ Bet placed! Balance: ${result.new_balance} tokens.${bonus}`)
      setIsWildcard(false)
      onBetPlaced?.(result.new_balance, result.wildcards_used)
    } catch (err) {
      setMsg(`✗ ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: "#13131f", border: "1px solid #2d2b55", borderRadius: 12, padding: 16, marginBottom: 12 }}>
      <h3 style={{ color: "#a78bfa", fontWeight: 700, marginBottom: 12, fontSize: 14, display: "flex", alignItems: "center" }}>
        Place a Bet
        <HelpTip text="Pick a market, choose your outcome, and set your stake. Bets settle automatically when the match finishes — no admin needed." />
      </h3>

      {/* Market selector */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {Object.entries(MARKETS).map(([key, { label }]) => (
          <button key={key} onClick={() => { setMarketKey(key); setSelection("") }}
            style={{
              background: marketKey === key ? "linear-gradient(135deg,#a855f7,#3b82f6)" : "#1e1b3a",
              color: marketKey === key ? "#fff" : "#6b7280",
              border: "none", borderRadius: 999, padding: "4px 12px",
              fontSize: 11, fontWeight: 600, cursor: "pointer",
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Selections */}
      {marketKey === "correct_score" ? (
        <input
          placeholder="e.g. 2-1 (home-away)"
          value={customScore}
          onChange={(e) => setCustomScore(e.target.value)}
          style={{ background: "#0c0c14", border: "1px solid #2d2b55", borderRadius: 8,
            padding: "8px 12px", color: "#e2e8f0", fontSize: 14, width: "100%", marginBottom: 10,
            boxSizing: "border-box" }}
        />
      ) : (
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {market.options.map((opt) => {
            // For 1x2 the h2h odds are keyed by team name, not "Home Win"
            const lookupName = marketKey === "1x2"
              ? (opt === "Home Win" ? match.home_team : opt === "Away Win" ? match.away_team : "Draw")
              : opt
            const price = odds?.[oddsKey]?.find((o) => o.name === lookupName)?.price
            return (
              <button key={opt} onClick={() => setSelection(opt)}
                style={{
                  background: selection === opt ? "linear-gradient(135deg,#a855f7,#3b82f6)" : "#0c0c14",
                  color: selection === opt ? "#fff" : "#e2e8f0",
                  border: "1px solid #2d2b55", borderRadius: 8, padding: "8px 14px",
                  fontSize: 12, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center",
                }}>
                <span>{opt}</span>
                {price && <span style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>{price}×</span>}
              </button>
            )
          })}
        </div>
      )}

      {/* Stake row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ color: "#6b7280", fontSize: 12 }}>Stake:</span>
        <input type="number" min={1} value={stake} onChange={(e) => setStake(Number(e.target.value))}
          style={{ background: "#0c0c14", border: "1px solid #2d2b55", borderRadius: 8,
            padding: "6px 10px", color: "#e2e8f0", fontSize: 14, width: 100 }} />
        <span style={{ color: "#6b7280", fontSize: 12 }}>tokens</span>
        {oddsForSelection && (
          <span style={{ color: "#4ade80", fontSize: 12, marginLeft: "auto" }}>
            Win: {isWildcard
              ? <><s style={{ opacity: 0.5 }}>{Math.floor(stake * oddsForSelection)}</s> <strong>{Math.floor(stake * oddsForSelection * 2)}</strong></>
              : Math.floor(stake * oddsForSelection)}
            <HelpTip text="Odds × your stake = payout if you win. Higher odds mean a bigger reward but a less likely outcome." />
          </span>
        )}
      </div>

      {/* Wildcard toggle */}
      <div style={{
        background: "#0c0c14", border: `1px solid ${isWildcard ? "#fbbf24" : "#2d2b55"}`,
        borderRadius: 8, padding: "10px 12px", marginBottom: 12,
        display: "flex", alignItems: "center", gap: 10,
        opacity: canWildcard || isWildcard ? 1 : 0.5,
      }}>
        <button
          onClick={() => canWildcard && setIsWildcard(v => !v)}
          disabled={!canWildcard && !isWildcard}
          style={{
            width: 32, height: 18, borderRadius: 999, border: "none", cursor: canWildcard ? "pointer" : "not-allowed",
            background: isWildcard ? "#fbbf24" : "#2d2b55", padding: 0, position: "relative", flexShrink: 0,
            transition: "background 0.2s",
          }}
        >
          <span style={{
            position: "absolute", top: 2, left: isWildcard ? 16 : 2,
            width: 14, height: 14, borderRadius: "50%", background: "#fff",
            transition: "left 0.2s", display: "block",
          }} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ color: isWildcard ? "#fbbf24" : "#e2e8f0", fontSize: 12, fontWeight: 700 }}>
            🃏 Wildcard — win pays 2×
          </div>
          <div style={{ color: "#6b7280", fontSize: 10, marginTop: 1 }}>
            {canWildcard
              ? `${wildcardsLeft} wildcard${wildcardsLeft === 1 ? "" : "s"} remaining this tournament`
              : "All 3 wildcards used"}
          </div>
        </div>
        <HelpTip text="Mark up to 3 bets as wildcards. If you win, the payout doubles. Choose wisely — you only get 3 all tournament." />
      </div>

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={submit}
        disabled={loading}
        style={{
          width: "100%",
          background: isWildcard
            ? "linear-gradient(135deg, #f59e0b, #ef4444)"
            : "linear-gradient(135deg,#a855f7,#3b82f6)",
          color: "#fff", border: "none", borderRadius: 8, padding: "11px",
          fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}>
        {loading ? "Placing..." : isWildcard ? "🃏 Place Wildcard Bet" : "Place Bet"}
      </motion.button>

      {msg && <p style={{ color: msg.startsWith("✓") ? "#4ade80" : "#f87171", fontSize: 12, marginTop: 8 }}>{msg}</p>}
    </div>
  )
}
