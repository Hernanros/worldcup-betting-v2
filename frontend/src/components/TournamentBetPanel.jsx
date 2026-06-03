import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { api } from "../api.js"

const MARKET_ICONS = {
  winner:      "🏆",
  golden_boot: "👟",
  total_goals: "⚽",
}

export default function TournamentBetPanel({ onBetPlaced }) {
  const [markets, setMarkets]           = useState(null)
  const [locked, setLocked]             = useState(false)
  const [activeMarket, setActiveMarket] = useState("winner")
  const [selection, setSelection]       = useState("")        // picked from list
  const [selectionOdds, setSelectionOdds] = useState(null)
  const [freeText, setFreeText]         = useState("")        // golden boot custom name
  const [search, setSearch]             = useState("")
  const [stake, setStake]               = useState(100)
  const [loading, setLoading]           = useState(false)
  const [msg, setMsg]                   = useState("")

  useEffect(() => {
    api.get("/api/tournament/markets")
      .then((data) => { setMarkets(data.markets); setLocked(data.locked) })
      .catch(() => {})
  }, [])

  if (!markets) return null

  const market      = markets[activeMarket]
  const isTextPick  = market.type === "text_pick"   // golden boot: list + free-text fallback
  const hasOptions  = Array.isArray(market.options) && market.options.length > 0

  // For golden boot: if user typed a custom name that's not on the list, use unknown_odds.
  const effectiveSelection = isTextPick && freeText.trim() ? freeText.trim() : selection
  const effectiveOdds = isTextPick && freeText.trim()
    ? (market.unknown_odds ?? 101.0)
    : selectionOdds

  const filteredOptions = hasOptions
    ? market.options.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()))
    : []

  function selectFromList(name, odds) {
    setSelection(name)
    setSelectionOdds(odds)
    setFreeText("")    // clear free-text when picking from list
    setMsg("")
  }

  function handleFreeTextChange(val) {
    setFreeText(val)
    setSelection("")   // deselect list pick when typing custom
    setSelectionOdds(null)
    setMsg("")
  }

  function handleMarketSwitch(key) {
    setActiveMarket(key)
    setSelection("")
    setSelectionOdds(null)
    setFreeText("")
    setSearch("")
    setMsg("")
  }

  const potentialWin = effectiveOdds && stake
    ? Math.floor(stake * effectiveOdds)
    : null

  async function submit() {
    if (!effectiveSelection) return setMsg(isTextPick ? "Pick a player or type a name" : "Pick a selection first")
    if (!stake || stake < 1) return setMsg("Minimum stake is 1 token")

    setLoading(true)
    setMsg("")
    try {
      const result = await api.post("/api/tournament/bets", {
        bet_type:  activeMarket,
        selection: effectiveSelection,
        stake,
        // odds field ignored server-side; server resolves authoritative value
      })
      const confirmedOdds = result.odds ?? effectiveOdds
      setMsg(`✓ Bet placed @ ${confirmedOdds}x! New balance: ${result.new_balance} tokens`)
      setSelection("")
      setSelectionOdds(null)
      setFreeText("")
      onBetPlaced?.(result.new_balance)
    } catch (err) {
      setMsg(`✗ ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Lock banner */}
      {!locked && (
        <div style={{
          background: "linear-gradient(135deg, rgba(168,85,247,0.1), rgba(59,130,246,0.1))",
          border: "1px solid #a855f7", borderRadius: 10, padding: "8px 14px", marginBottom: 14,
          display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#a78bfa",
        }}>
          <span>🔓</span>
          <span>Tournament bets lock at kickoff — <strong>June 11, 2026 at 18:00 UTC</strong></span>
        </div>
      )}
      {locked && (
        <div style={{
          background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444",
          borderRadius: 10, padding: "8px 14px", marginBottom: 14,
          fontSize: 12, color: "#f87171", textAlign: "center",
        }}>
          🔒 Tournament bets are locked — the tournament has started
        </div>
      )}

      {/* Market tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {Object.entries(markets).map(([key, m]) => (
          <button key={key} onClick={() => handleMarketSwitch(key)} style={{
            flex: 1,
            background: activeMarket === key ? "linear-gradient(135deg,#a855f7,#3b82f6)" : "#1e1b3a",
            color: activeMarket === key ? "#fff" : "#6b7280",
            border: "none", borderRadius: 8, padding: "8px 4px",
            fontSize: 11, fontWeight: 600, cursor: "pointer", textAlign: "center", lineHeight: 1.3,
          }}>
            <div style={{ fontSize: 16 }}>{MARKET_ICONS[key]}</div>
            <div>{m.label.replace(/^[^ ]+ /, "")}</div>
          </button>
        ))}
      </div>

      {/* Market description */}
      <p style={{ color: "#6b7280", fontSize: 12, marginBottom: 12 }}>{market.description}</p>

      {/* Picklist (winner, total_goals, golden_boot listed players) */}
      {!locked && hasOptions && (
        <>
          <input
            placeholder={isTextPick ? "Search player…" : "Search team…"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%", background: "#0c0c14", border: "1px solid #2d2b55",
              borderRadius: 8, padding: "7px 12px", color: "#e2e8f0",
              fontSize: 13, marginBottom: 8, boxSizing: "border-box",
            }}
          />
          <div style={{
            maxHeight: 220, overflowY: "auto",
            display: "flex", flexDirection: "column", gap: 4, marginBottom: 12,
          }}>
            {filteredOptions.map((o) => (
              <button key={o.name} onClick={() => selectFromList(o.name, o.odds)} style={{
                background: selection === o.name
                  ? "linear-gradient(135deg, rgba(168,85,247,0.2), rgba(59,130,246,0.2))"
                  : "#13131f",
                border: `1px solid ${selection === o.name ? "#a855f7" : "#2d2b55"}`,
                borderRadius: 8, padding: "8px 12px",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                cursor: "pointer",
              }}>
                <span style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 500 }}>{o.name}</span>
                <span style={{
                  color: "#a78bfa", fontSize: 12, fontWeight: 700,
                  background: "#1e1b3a", padding: "2px 8px", borderRadius: 999,
                }}>
                  {o.odds}x
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Golden Boot: free-text fallback for players not on the list */}
      {isTextPick && !locked && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: "#6b7280", fontSize: 11, marginBottom: 5 }}>
            Not on the list? Type any player name:
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              placeholder="e.g. Erling Haaland…"
              value={freeText}
              onChange={(e) => handleFreeTextChange(e.target.value)}
              style={{
                flex: 1, background: "#0c0c14", border: `1px solid ${freeText ? "#a855f7" : "#2d2b55"}`,
                borderRadius: 8, padding: "7px 12px", color: "#e2e8f0",
                fontSize: 13, boxSizing: "border-box",
              }}
            />
            {freeText && (
              <span style={{ color: "#f59e0b", fontSize: 11, whiteSpace: "nowrap" }}>
                {market.unknown_odds ?? 101}x
              </span>
            )}
          </div>
          {freeText && (
            <p style={{ fontSize: 10, color: "#6b7280", margin: "4px 0 0" }}>
              Unlisted player — odds {market.unknown_odds ?? 101}x applied at placement
            </p>
          )}
        </div>
      )}

      {/* Stake + submit */}
      {!locked && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ color: "#6b7280", fontSize: 12 }}>Stake:</span>
            <input
              type="number" min={1} value={stake}
              onChange={(e) => setStake(Number(e.target.value))}
              style={{
                background: "#0c0c14", border: "1px solid #2d2b55",
                borderRadius: 8, padding: "6px 10px", color: "#e2e8f0",
                fontSize: 14, width: 100,
              }}
            />
            <span style={{ color: "#6b7280", fontSize: 12 }}>tokens</span>
            {potentialWin && (
              <span style={{ color: "#4ade80", fontSize: 12, marginLeft: "auto" }}>
                Win: {potentialWin.toLocaleString()}
              </span>
            )}
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={submit}
            disabled={loading || !effectiveSelection}
            style={{
              width: "100%",
              background: loading || !effectiveSelection ? "#1e1b3a" : "linear-gradient(135deg,#a855f7,#3b82f6)",
              color: loading || !effectiveSelection ? "#6b7280" : "#fff",
              border: "none", borderRadius: 8, padding: "12px",
              fontSize: 14, fontWeight: 700,
              cursor: loading || !effectiveSelection ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Placing…" : `Place ${MARKET_ICONS[activeMarket]} Bet`}
          </motion.button>
        </>
      )}

      <AnimatePresence>
        {msg && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              color: msg.startsWith("✓") ? "#4ade80" : "#f87171",
              fontSize: 12, marginTop: 8, textAlign: "center",
            }}
          >
            {msg}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
