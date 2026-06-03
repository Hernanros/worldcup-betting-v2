import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { api } from "../api.js"
import OverUnderMarket    from "../components/markets/OverUnderMarket.jsx"
import ExactCountMarket   from "../components/markets/ExactCountMarket.jsx"
import YesNoMarket        from "../components/markets/YesNoMarket.jsx"
import TeamPickMarket     from "../components/markets/TeamPickMarket.jsx"
import TextPickMarket     from "../components/markets/TextPickMarket.jsx"
import GroupAdvanceMarket from "../components/markets/GroupAdvanceMarket.jsx"

const STAGE_LABELS = {
  tournament: "🏆 Tournament", group_stage: "🗓️ Group Stage", r32: "⚔️ Round of 32",
  r16: "🏟️ Round of 16", qf: "🥊 Quarter-Finals", sf: "🌟 Semi-Finals", final: "🏆 Final",
}
const STATUS_BADGE = {
  open:     { label: "Open",     color: "#1abc9c" },
  locked:   { label: "Locked",   color: "#e74c3c" },
  settled:  { label: "Settled",  color: "#888" },
  upcoming: { label: "Soon",     color: "#f59e0b" },
}

export default function DeepCutsPage() {
  const [searchParams] = useSearchParams()
  const [stages, setStages] = useState([])
  const [activeStage, setActive] = useState(searchParams.get("stage") || "group_stage")
  const [markets, setMarkets] = useState([])
  const [myBets, setMyBets] = useState([])
  const [selections, setSelections] = useState({})
  const [stakes, setStakes] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get("/api/deep-cuts/stages").then(d => setStages(d.stages || []))
    api.get("/api/deep-cuts/bets").then(d => setMyBets(d.bets || []))
  }, [])

  useEffect(() => {
    if (!activeStage) return
    setMarkets([])
    api.get(`/api/deep-cuts/markets/${activeStage}`).then(d => setMarkets(d.markets || [])).catch(() => {})
  }, [activeStage])

  function handleSelect(marketKey, selection, odds) {
    setSelections(prev => ({ ...prev, [marketKey]: { selection, odds } }))
    setStakes(prev => ({ ...prev, [marketKey]: prev[marketKey] || 100 }))
  }

  async function handlePlaceBet(market) {
    const sel = selections[market.key]
    if (!sel?.selection) { setError("Pick a selection first"); return }
    const stake = stakes[market.key] || 100
    setLoading(true); setError(null)
    try {
      await api.post("/api/deep-cuts/bets", { market_key: market.key, stage: activeStage, selection: sel.selection, stake, odds: sel.odds })
      const updated = await api.get("/api/deep-cuts/bets")
      setMyBets(updated.bets || [])
      setSelections(prev => { const n = {...prev}; delete n[market.key]; return n })
    } catch (e) {
      setError(e.message || "Bet failed")
    } finally { setLoading(false) }
  }

  const activeStageInfo = stages.find(s => s.stage === activeStage)
  const isLocked = activeStageInfo?.status === "locked"

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px 12px 80px" }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#1abc9c" }}>🔪 Deep Cuts</h2>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#888" }}>Stage-specific proposition bets · unique markets each round</p>
      </div>

      <div style={{ display: "flex", gap: 4, overflowX: "auto", marginBottom: 16, paddingBottom: 4 }}>
        {stages.map(s => {
          const badge = STATUS_BADGE[s.status] || STATUS_BADGE.open
          return (
            <button key={s.stage} onClick={() => setActive(s.stage)} style={{
              padding: "6px 10px", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap",
              border: activeStage === s.stage ? `2px solid ${badge.color}` : "1px solid #2d2b55",
              background: activeStage === s.stage ? `${badge.color}22` : "#1a1a2e",
              color: activeStage === s.stage ? badge.color : "#aaa", fontSize: 12, fontWeight: 600,
            }}>
              {STAGE_LABELS[s.stage] || s.stage}
              <span style={{ marginLeft: 4, fontSize: 10, color: badge.color, background: `${badge.color}22`, borderRadius: 4, padding: "1px 4px" }}>{badge.label}</span>
            </button>
          )
        })}
      </div>

      {isLocked && <div style={{ padding: "10px 14px", background: "#1a1a2e", borderRadius: 8, border: "1px solid #e74c3c", color: "#e74c3c", fontSize: 12, marginBottom: 12 }}>🔒 This stage is locked — no new bets accepted.</div>}
      {error && <div style={{ padding: "10px 14px", background: "#2d0a0a", borderRadius: 8, color: "#e74c3c", fontSize: 12, marginBottom: 12 }}>{error}</div>}

      {markets.map(market => {
        const existingBet = myBets.find(b => b.market_key === market.key)
        const sel = selections[market.key]
        const stake = stakes[market.key] || 100
        return (
          <div key={market.key} style={{ background: "#111827", borderRadius: 10, padding: 14, marginBottom: 12, border: "1px solid #1f2937" }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 4 }}>{market.label}</div>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 10 }}>{market.description}</div>
            {existingBet ? (
              <div style={{ padding: "8px 10px", background: "#0d1117", borderRadius: 6, fontSize: 12, color: "#1abc9c" }}>
                ✓ Your bet: <strong>{existingBet.selection}</strong> · {existingBet.stake} tokens @ {existingBet.odds}
                <span style={{ marginLeft: 6, color: existingBet.status === "won" ? "#1abc9c" : existingBet.status === "lost" ? "#e74c3c" : "#888" }}>[{existingBet.status}]</span>
              </div>
            ) : (
              <>
                {market.type === "over_under" && <OverUnderMarket market={market} selected={sel?.selection} onSelect={(s, o) => handleSelect(market.key, s, o)} />}
                {market.type === "exact_count" && <ExactCountMarket market={market} selected={sel?.selection} onSelect={(s, o) => handleSelect(market.key, s, o)} />}
                {market.type === "yes_no" && <YesNoMarket market={market} selected={sel?.selection} onSelect={(s, o) => handleSelect(market.key, s, o)} />}
                {market.type === "team_pick" && <TeamPickMarket market={market} teams={market.teams || []} selected={sel?.selection} onSelect={(s, o) => handleSelect(market.key, s, o)} />}
                {market.type === "text_pick" && <TextPickMarket market={market} selected={sel?.selection} onSelect={(s, o) => handleSelect(market.key, s, o)} />}
                {market.type === "group_advance" && <GroupAdvanceMarket market={market} selected={sel?.selection} onSelect={(s, o) => handleSelect(market.key, s, o)} />}
                {sel?.selection && !isLocked && (
                  <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="number" min={1} value={stake} onChange={e => setStakes(prev => ({...prev, [market.key]: parseInt(e.target.value) || 1}))} style={{ width: 80, padding: "6px 8px", borderRadius: 6, border: "1px solid #2d2b55", background: "#0d1117", color: "#fff", fontSize: 13 }} />
                    <span style={{ fontSize: 11, color: "#888" }}>tokens</span>
                    <span style={{ fontSize: 11, color: "#1abc9c" }}>→ win {Math.round(stake * sel.odds)} if correct</span>
                    <button onClick={() => handlePlaceBet(market)} disabled={loading} style={{ marginLeft: "auto", padding: "6px 14px", borderRadius: 6, background: "#1abc9c", border: "none", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: loading ? 0.6 : 1 }}>Place Bet</button>
                  </div>
                )}
              </>
            )}
          </div>
        )
      })}

      {myBets.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 14, color: "#888", marginBottom: 10 }}>My Deep Cuts</h3>
          {myBets.map(b => (
            <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#1a1a2e", borderRadius: 6, marginBottom: 6, fontSize: 12 }}>
              <div>
                <span style={{ color: "#ccc" }}>{b.market_key.replace(/_/g, " ")}</span>
                <span style={{ color: "#888", margin: "0 6px" }}>·</span>
                <span style={{ color: "#fff", fontWeight: 600 }}>{b.selection}</span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ color: "#888" }}>{b.stake}t</span>
                <span style={{ color: b.status === "won" ? "#1abc9c" : b.status === "lost" ? "#e74c3c" : "#888", fontWeight: 600 }}>{b.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
