import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { api } from "../api.js"
import HelpTip from "./HelpTip.jsx"

const MARKET_ICONS = {
  winner:      "🏆",
  golden_boot: "👟",
  total_goals: "⚽",
}

const INSURANCE_MARKETS = new Set(["winner", "golden_boot"])

export default function TournamentBetPanel({ onBetPlaced }) {
  const [markets, setMarkets]             = useState(null)
  const [locked, setLocked]               = useState(false)
  const [activeMarket, setActiveMarket]   = useState("winner")
  const [selection, setSelection]         = useState("")
  const [selectionOdds, setSelectionOdds] = useState(null)
  const [freeText, setFreeText]           = useState("")
  const [search, setSearch]               = useState("")
  const [stake, setStake]                 = useState(100)
  const [loading, setLoading]             = useState(false)
  const [msg, setMsg]                     = useState("")

  // Insurance state
  const [insurancePicks, setInsurancePicks]         = useState([])
  const [justPlacedBetType, setJustPlacedBetType]   = useState(null)
  const [justPlacedOdds, setJustPlacedOdds]         = useState(null)
  const [justPlacedStake, setJustPlacedStake]       = useState(null)
  const [insuranceSelection, setInsuranceSelection] = useState("")
  const [insuranceFreeText, setInsuranceFreeText]   = useState("")
  const [insuranceSearch, setInsuranceSearch]       = useState("")
  const [insuranceLoading, setInsuranceLoading]     = useState(false)
  const [insuranceMsg, setInsuranceMsg]             = useState("")

  useEffect(() => {
    api.get("/api/tournament/markets")
      .then((data) => { setMarkets(data.markets); setLocked(data.locked) })
      .catch(() => {})
    api.get("/api/tournament/insurance")
      .then(setInsurancePicks)
      .catch(() => {})
  }, [])

  if (!markets) return null

  const market     = markets[activeMarket]
  const isTextPick = market.type === "text_pick"
  const hasOptions = Array.isArray(market.options) && market.options.length > 0

  const effectiveSelection = isTextPick && freeText.trim() ? freeText.trim() : selection
  const effectiveOdds      = isTextPick && freeText.trim() ? (market.unknown_odds ?? 101.0) : selectionOdds

  const filteredOptions = hasOptions
    ? market.options.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()))
    : []

  const hasInsuranceForMarket = insurancePicks.some(p => p.bet_type === activeMarket)
  const insurancePotentialWin = justPlacedOdds && justPlacedStake
    ? Math.floor(justPlacedStake * justPlacedOdds * 0.5)
    : null

  function selectFromList(name, odds) {
    setSelection(name); setSelectionOdds(odds); setFreeText(""); setMsg("")
  }
  function handleFreeTextChange(val) {
    setFreeText(val); setSelection(""); setSelectionOdds(null); setMsg("")
  }
  function handleMarketSwitch(key) {
    setActiveMarket(key); setSelection(""); setSelectionOdds(null)
    setFreeText(""); setSearch(""); setMsg("")
    setJustPlacedBetType(null); setInsuranceSelection("")
    setInsuranceFreeText(""); setInsuranceSearch(""); setInsuranceMsg("")
  }

  const potentialWin = effectiveOdds && stake ? Math.floor(stake * effectiveOdds) : null

  async function submit() {
    if (!effectiveSelection) return setMsg(isTextPick ? "Pick a player or type a name" : "Pick a selection first")
    if (!stake || stake < 1) return setMsg("Minimum stake is 1 token")
    setLoading(true); setMsg("")
    try {
      const result = await api.post("/api/tournament/bets", {
        bet_type: activeMarket, selection: effectiveSelection, stake,
      })
      const confirmedOdds = result.odds ?? effectiveOdds
      setMsg(`✓ Bet placed @ ${confirmedOdds}x! New balance: ${result.new_balance} tokens`)
      setSelection(""); setSelectionOdds(null); setFreeText("")
      if (INSURANCE_MARKETS.has(activeMarket)) {
        setJustPlacedBetType(activeMarket)
        setJustPlacedOdds(confirmedOdds)
        setJustPlacedStake(stake)
        setInsuranceMsg("")
      }
      onBetPlaced?.(result.new_balance)
    } catch (err) {
      setMsg(`✗ ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function submitInsurance() {
    const sel = insuranceFreeText.trim() || insuranceSelection
    if (!sel) return setInsuranceMsg("Pick an insurance selection first")
    setInsuranceLoading(true); setInsuranceMsg("")
    try {
      const result = await api.post("/api/tournament/insurance", {
        bet_type: justPlacedBetType, selection: sel,
      })
      setInsurancePicks(prev => [...prev, result])
      setInsuranceMsg(`✓ Insurance placed on ${sel}! No tokens charged.`)
      setJustPlacedBetType(null)
      setInsuranceSelection(""); setInsuranceFreeText("")
    } catch (err) {
      setInsuranceMsg(`✗ ${err.message}`)
    } finally {
      setInsuranceLoading(false)
    }
  }

  const isInsuranceTextPick = justPlacedBetType === "golden_boot"
  const insuranceOptions = justPlacedBetType && markets[justPlacedBetType]?.options
    ? markets[justPlacedBetType].options.filter(o =>
        o.name.toLowerCase().includes(insuranceSearch.toLowerCase())
      )
    : []

  return (
    <div style={{ marginBottom: 16 }}>
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

      {/* Market description + contextual tip */}
      <p style={{ color: "#6b7280", fontSize: 12, marginBottom: 12, display: "flex", alignItems: "center", gap: 4 }}>
        {market.description}
        {activeMarket === "winner"      && <HelpTip text="Pick the team that lifts the trophy. Odds reflect probability — favourites pay less. Lock date: June 11, 18:00 UTC." />}
        {activeMarket === "golden_boot" && <HelpTip text="Top scorer of the entire tournament. Pick from the list or type any player name — unlisted players get 101x odds. Lock date: June 11, 18:00 UTC." />}
        {activeMarket === "total_goals" && <HelpTip text="Pick Over or Under 160 total goals for the whole tournament. 'Over 159.5' wins if final goal count is 160+. Locks June 11." />}
      </p>

      {/* Picklist */}
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
          <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
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
                <span style={{ color: "#a78bfa", fontSize: 12, fontWeight: 700, background: "#1e1b3a", padding: "2px 8px", borderRadius: 999 }}>
                  {o.odds}x
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Golden Boot free-text fallback */}
      {isTextPick && !locked && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: "#6b7280", fontSize: 11, marginBottom: 5 }}>Not on the list? Type any player name:</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              placeholder="e.g. Erling Haaland…"
              value={freeText}
              onChange={(e) => handleFreeTextChange(e.target.value)}
              style={{ flex: 1, background: "#0c0c14", border: `1px solid ${freeText ? "#a855f7" : "#2d2b55"}`, borderRadius: 8, padding: "7px 12px", color: "#e2e8f0", fontSize: 13, boxSizing: "border-box" }}
            />
            {freeText && <span style={{ color: "#f59e0b", fontSize: 11, whiteSpace: "nowrap" }}>{market.unknown_odds ?? 101}x</span>}
          </div>
          {freeText && <p style={{ fontSize: 10, color: "#6b7280", margin: "4px 0 0" }}>Unlisted player — odds {market.unknown_odds ?? 101}x applied at placement</p>}
        </div>
      )}

      {/* Stake + submit */}
      {!locked && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ color: "#6b7280", fontSize: 12 }}>Stake:</span>
            <input type="number" min={1} value={stake} onChange={(e) => setStake(Number(e.target.value))}
              style={{ background: "#0c0c14", border: "1px solid #2d2b55", borderRadius: 8, padding: "6px 10px", color: "#e2e8f0", fontSize: 14, width: 100 }} />
            <span style={{ color: "#6b7280", fontSize: 12 }}>tokens</span>
            {potentialWin && (
              <span style={{ color: "#4ade80", fontSize: 12, marginLeft: "auto", display: "flex", alignItems: "center", gap: 3 }}>
                Win: {potentialWin.toLocaleString()}
                <HelpTip text="Potential payout = stake × odds. Odds are locked at placement — they won't change if the market moves." />
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
            {loading ? "Locking in…" : `Lock In ${MARKET_ICONS[activeMarket]} Pick`}
          </motion.button>
        </>
      )}

      {/* Insurance pick prompt — shown after placing a winner/golden_boot bet */}
      {justPlacedBetType && (
        <div style={{ marginTop: 16, background: "#0c1a0c", border: "1px solid #16a34a", borderRadius: 10, padding: 14 }}>
          <div style={{ color: "#4ade80", fontWeight: 700, fontSize: 13, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
            🛡️ Add a free insurance pick
            <HelpTip text={`Insurance is free — no tokens charged. If your primary ${justPlacedBetType} pick loses but your insurance pick is correct, you win ${insurancePotentialWin ?? "half the primary payout"} tokens. If your primary pick wins, insurance is ignored.`} />
          </div>
          <p style={{ color: "#6b7280", fontSize: 11, marginBottom: 10 }}>
            Pick a different {justPlacedBetType === "winner" ? "team" : "player"} as your backup.
            {insurancePotentialWin && <span style={{ color: "#4ade80" }}> Pays {insurancePotentialWin} tokens if primary loses.</span>}
          </p>

          <input
            placeholder={isInsuranceTextPick ? "Search player…" : "Search team…"}
            value={insuranceSearch}
            onChange={(e) => setInsuranceSearch(e.target.value)}
            style={{ width: "100%", background: "#0c0c14", border: "1px solid #2d2b55", borderRadius: 8, padding: "6px 10px", color: "#e2e8f0", fontSize: 12, marginBottom: 6, boxSizing: "border-box" }}
          />
          <div style={{ maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3, marginBottom: 8 }}>
            {insuranceOptions.map((o) => (
              <button key={o.name} onClick={() => { setInsuranceSelection(o.name); setInsuranceFreeText("") }} style={{
                background: insuranceSelection === o.name ? "rgba(74,222,128,0.15)" : "#13131f",
                border: `1px solid ${insuranceSelection === o.name ? "#16a34a" : "#2d2b55"}`,
                borderRadius: 6, padding: "6px 10px",
                display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer",
              }}>
                <span style={{ color: "#e2e8f0", fontSize: 12 }}>{o.name}</span>
                <span style={{ color: "#4ade80", fontSize: 11 }}>{o.odds}x</span>
              </button>
            ))}
          </div>

          {isInsuranceTextPick && (
            <input
              placeholder="Or type any player name…"
              value={insuranceFreeText}
              onChange={(e) => { setInsuranceFreeText(e.target.value); setInsuranceSelection("") }}
              style={{ width: "100%", background: "#0c0c14", border: `1px solid ${insuranceFreeText ? "#16a34a" : "#2d2b55"}`, borderRadius: 8, padding: "6px 10px", color: "#e2e8f0", fontSize: 12, marginBottom: 8, boxSizing: "border-box" }}
            />
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={submitInsurance}
              disabled={insuranceLoading || (!insuranceSelection && !insuranceFreeText.trim())}
              style={{
                flex: 1,
                background: insuranceLoading || (!insuranceSelection && !insuranceFreeText.trim()) ? "#1e1b3a" : "linear-gradient(135deg, #16a34a, #4ade80)",
                color: insuranceLoading || (!insuranceSelection && !insuranceFreeText.trim()) ? "#6b7280" : "#fff",
                border: "none", borderRadius: 8, padding: "10px",
                fontSize: 13, fontWeight: 700, cursor: insuranceLoading ? "not-allowed" : "pointer",
              }}
            >
              {insuranceLoading ? "Adding…" : "🛡️ Add Insurance (free)"}
            </motion.button>
            <button
              onClick={() => setJustPlacedBetType(null)}
              style={{ background: "none", border: "1px solid #2d2b55", borderRadius: 8, padding: "10px 14px", color: "#6b7280", fontSize: 12, cursor: "pointer" }}
            >
              Skip
            </button>
          </div>

          {insuranceMsg && (
            <p style={{ color: insuranceMsg.startsWith("✓") ? "#4ade80" : "#f87171", fontSize: 12, marginTop: 8 }}>{insuranceMsg}</p>
          )}
        </div>
      )}

      {/* Show already-placed insurance for this market */}
      {hasInsuranceForMarket && !justPlacedBetType && (
        <div style={{ marginTop: 12, background: "#0c1a0c", border: "1px solid #16a34a", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
          {insurancePicks
            .filter(p => p.bet_type === activeMarket)
            .map(p => (
              <div key={p.id} style={{ color: "#4ade80", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>🛡️ Insurance: <strong>{p.selection}</strong></span>
                <span style={{ color: "#6b7280", fontSize: 10 }}>{p.status.toUpperCase()}</span>
              </div>
            ))}
        </div>
      )}

      <AnimatePresence>
        {msg && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{ color: msg.startsWith("✓") ? "#4ade80" : "#f87171", fontSize: 12, marginTop: 8, textAlign: "center" }}
          >
            {msg}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
