import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useOutletContext } from "react-router-dom"
import { api } from "../api.js"
import HelpTip            from "../components/HelpTip.jsx"
import OverUnderMarket    from "../components/markets/OverUnderMarket.jsx"
import ExactCountMarket   from "../components/markets/ExactCountMarket.jsx"
import YesNoMarket        from "../components/markets/YesNoMarket.jsx"
import TeamPickMarket     from "../components/markets/TeamPickMarket.jsx"
import TextPickMarket     from "../components/markets/TextPickMarket.jsx"
import GroupAdvanceMarket from "../components/markets/GroupAdvanceMarket.jsx"
import PlayerPickMarket   from "../components/markets/PlayerPickMarket.jsx"

const STAGE_LABELS = {
  tournament: "🏆 Tournament", group_stage: "🗓️ Group Stage", r32: "⚔️ Round of 32",
  r16: "🏟️ Round of 16", qf: "🥊 Quarter-Finals", sf: "🌟 Semi-Finals", final: "🏆 Final",
}
const STAGE_HEADLINE = {
  tournament:  "How will this tournament play out?",
  group_stage: "Who will dominate the group stage?",
  r32:         "Will there be blood?",
  r16:         "Where is the leak?",
  qf:          "Supersubs to the rescue?",
  sf:          "Will we finish on time?",
  final:       "Goalfest?",
}
const STATUS_BADGE = {
  open:     { label: "Open",     color: "#1abc9c" },
  locked:   { label: "Locked",   color: "#e74c3c" },
  settled:  { label: "Settled",  color: "#888" },
  upcoming: { label: "Soon",     color: "#f59e0b" },
}

function MarketCard({ market, myBets, selections, stakes, isLocked, isUpcoming, loading, handleSelect, handlePlaceBet, setStakes }) {
  const existingBet = myBets.find(b => b.market_key === market.key)
  const sel = selections[market.key]
  const stake = stakes[market.key] ?? (market.type === "group_advance" ? 5 : 20)
  return (
    <div style={{ background: "#111827", borderRadius: 10, padding: 14, marginBottom: 8, border: "1px solid #1f2937" }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 4 }}>{market.label}</div>
      <div style={{ fontSize: 11, color: "#888", marginBottom: 10 }}>{market.description}</div>
      {existingBet ? (
        <div style={{ padding: "8px 10px", background: "#0d1117", borderRadius: 6, fontSize: 12, color: "#1abc9c" }}>
          ✓ Your pick: <strong>{existingBet.selection}</strong> · {existingBet.stake} tokens @ {existingBet.odds}
          <span style={{ marginLeft: 6, color: existingBet.status === "won" ? "#1abc9c" : existingBet.status === "lost" ? "#e74c3c" : "#888" }}>[{existingBet.status}]</span>
        </div>
      ) : isUpcoming ? (
        <div style={{ fontSize: 11, color: "#f59e0b" }}>⏳ Opens when bracket is drawn</div>
      ) : (
        <>
          {market.type === "over_under" && <OverUnderMarket market={market} selected={sel?.selection} onSelect={(s, o) => handleSelect(market.key, s, o)} />}
          {market.type === "exact_count" && <ExactCountMarket market={market} selected={sel?.selection} onSelect={(s, o) => handleSelect(market.key, s, o)} />}
          {market.type === "yes_no" && <YesNoMarket market={market} selected={sel?.selection} onSelect={(s, o) => handleSelect(market.key, s, o)} />}
          {market.type === "team_pick" && <TeamPickMarket market={market} teams={market.teams || []} selected={sel?.selection} onSelect={(s, o) => handleSelect(market.key, s, o)} />}
          {market.type === "text_pick" && market.players && <PlayerPickMarket market={market} selected={sel?.selection} onSelect={(s, o) => handleSelect(market.key, s, o)} />}
          {market.type === "text_pick" && !market.players && <TextPickMarket market={market} selected={sel?.selection} onSelect={(s, o) => handleSelect(market.key, s, o)} />}
          {market.type === "group_advance" && <GroupAdvanceMarket market={market} selected={sel?.selection} onSelect={(s, o) => handleSelect(market.key, s, o)} />}
          {sel?.selection && !isLocked && (
            <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
              <input type="number" min={1} value={stake} onChange={e => setStakes(prev => ({...prev, [market.key]: parseInt(e.target.value) || 1}))} style={{ width: 80, padding: "6px 8px", borderRadius: 6, border: "1px solid #2d2b55", background: "#0d1117", color: "#fff", fontSize: 13 }} />
              <span style={{ fontSize: 11, color: "#888" }}>tokens</span>
              <span style={{ fontSize: 11, color: "#1abc9c" }}>→ win {Math.round(stake * sel.odds)} if correct</span>
              <button onClick={() => handlePlaceBet(market)} disabled={loading} style={{ marginLeft: "auto", padding: "6px 14px", borderRadius: 6, background: "#1abc9c", border: "none", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: loading ? 0.6 : 1 }}>Lock In</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function DeepCutsPage() {
  const [searchParams] = useSearchParams()
  const { onBalanceChange } = useOutletContext() ?? {}
  const [stages, setStages] = useState([])
  const [activeStage, setActive] = useState(searchParams.get("stage") || "group_stage")
  const [markets, setMarkets] = useState([])
  const [myBets, setMyBets] = useState([])
  const [selections, setSelections] = useState({})
  const [stakes, setStakes] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [groupsExpanded, setGroupsExpanded] = useState(false)
  const [cancelling, setCancelling] = useState(null)

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
    const stake = stakes[market.key] ?? (market.type === "group_advance" ? 5 : 20)
    setLoading(true); setError(null)
    try {
      const result = await api.post("/api/deep-cuts/bets", { market_key: market.key, stage: activeStage, selection: sel.selection, stake, odds: sel.odds })
      onBalanceChange?.(result.new_balance)
      const updated = await api.get("/api/deep-cuts/bets")
      setMyBets(updated.bets || [])
      setSelections(prev => { const n = {...prev}; delete n[market.key]; return n })
    } catch (e) {
      setError(e.message || "Prediction failed")
    } finally { setLoading(false) }
  }

  async function cancelBet(betId) {
    setCancelling(betId)
    try {
      const result = await api.delete(`/api/deep-cuts/bets/${betId}`)
      onBalanceChange?.(result.new_balance)
      setMyBets(prev => prev.filter(b => b.id !== betId))
    } catch (e) {
      setError(e.message || "Cancel failed")
    } finally { setCancelling(null) }
  }

  const activeStageInfo = stages.find(s => s.stage === activeStage)
  const isLocked = activeStageInfo?.status === "locked"
  const isUpcoming = activeStageInfo?.status === "upcoming"

  // Separate group-advance markets from the rest
  const groupMarkets = markets.filter(m => m.type === "group_advance")
  const otherMarkets = markets.filter(m => m.type !== "group_advance")
  const pickedGroups = groupMarkets.filter(m => myBets.find(b => b.market_key === m.key)).length
  const totalGroups = groupMarkets.length

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px 12px 80px" }}>
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#1abc9c" }}>
            {STAGE_HEADLINE[activeStage] ?? "Deep Cuts"}
          </h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#6b7280" }}>Bet beyond the score</p>
        </div>
        <HelpTip text="Prop predictions scoped to each tournament stage — from group stage all the way to the final. Each round has unique markets. Picks lock when that stage starts and settle when it ends." />
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

      {isLocked && <div style={{ padding: "10px 14px", background: "#1a1a2e", borderRadius: 8, border: "1px solid #e74c3c", color: "#e74c3c", fontSize: 12, marginBottom: 12 }}>🔒 This stage is locked — the matches have started, so no new picks are accepted. Your existing picks will settle when the stage ends.</div>}
      {isUpcoming && <div style={{ padding: "10px 14px", background: "#1a1a2e", borderRadius: 8, border: "1px solid #f59e0b", color: "#f59e0b", fontSize: 12, marginBottom: 12 }}>⏳ Bracket not drawn yet — picks for this stage open once the matches are scheduled.</div>}
      {error && <div style={{ padding: "10px 14px", background: "#2d0a0a", borderRadius: 8, color: "#e74c3c", fontSize: 12, marginBottom: 12 }}>{error}</div>}

      {/* ── Non-group-advance markets ── */}
      {otherMarkets.map(market => <MarketCard key={market.key} market={market} myBets={myBets} selections={selections} stakes={stakes} isLocked={isLocked} isUpcoming={isUpcoming} loading={loading} handleSelect={handleSelect} handlePlaceBet={handlePlaceBet} setStakes={setStakes} />)}

      {/* ── Group advancement accordion ── */}
      {groupMarkets.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <button
            onClick={() => setGroupsExpanded(v => !v)}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "#111827", border: "1px solid #1f2937", borderRadius: groupsExpanded ? "10px 10px 0 0" : 10,
              padding: "12px 14px", cursor: "pointer",
            }}
          >
            <div>
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>📋 Group Advancement</span>
              <span style={{ color: "#888", fontSize: 11, marginLeft: 8 }}>
                {pickedGroups}/{totalGroups} groups picked
              </span>
            </div>
            <span style={{ color: "#4b5563", fontSize: 14,
              transform: groupsExpanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▾</span>
          </button>
          {groupsExpanded && (
            <div style={{ border: "1px solid #1f2937", borderTop: "none", borderRadius: "0 0 10px 10px", background: "#0d1117", padding: 12 }}>
              {groupMarkets.map(market => <MarketCard key={market.key} market={market} myBets={myBets} selections={selections} stakes={stakes} isLocked={isLocked} isUpcoming={isUpcoming} loading={loading} handleSelect={handleSelect} handlePlaceBet={handlePlaceBet} setStakes={setStakes} />)}
            </div>
          )}
        </div>
      )}

      {/* ── Stage bet summary ── */}
      {(() => {
        const stageBets = myBets.filter(b => b.stage === activeStage && b.status !== "cancelled")
        if (!stageBets.length) return null
        const totalStaked = stageBets.reduce((s, b) => s + b.stake, 0)
        const totalToWin  = stageBets.reduce((s, b) => s + Math.floor(b.stake * b.odds), 0)
        return (
          <div style={{ marginTop: 24, background: "#13131f", border: "1px solid #2d2b55", borderRadius: 10, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ color: "#a78bfa", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.8 }}>
                My picks this stage
              </span>
              <span style={{ fontSize: 10, color: "#6b7280" }}>
                {stageBets.length} bet{stageBets.length > 1 ? "s" : ""} · {totalStaked} staked · <span style={{ color: "#4ade80" }}>win up to {totalToWin}</span>
              </span>
            </div>
            {stageBets.map(b => {
              const statusColor = b.status === "won" ? "#4ade80" : b.status === "lost" ? "#f87171" : "#6b7280"
              const canCancel = b.status === "pending" && !isLocked
              return (
                <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "#0c0c14", borderRadius: 7, marginBottom: 6, fontSize: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ color: "#9ca3af" }}>{b.market_key.replace(/_/g, " ")}</span>
                    <span style={{ color: "#4b5563", margin: "0 5px" }}>·</span>
                    <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{b.selection}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                    <span style={{ color: "#fbbf24", fontSize: 11 }}>{b.stake}🪙 @ {b.odds}×</span>
                    <span style={{ color: statusColor, fontSize: 10, fontWeight: 700 }}>{b.status.toUpperCase()}</span>
                    {canCancel && (
                      <button
                        onClick={() => cancelBet(b.id)}
                        disabled={cancelling === b.id}
                        style={{ background: "none", border: "1px solid #ef4444", borderRadius: 5, color: "#ef4444", fontSize: 10, padding: "2px 8px", cursor: "pointer", opacity: cancelling === b.id ? 0.5 : 1 }}
                      >
                        {cancelling === b.id ? "…" : "Cancel"}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}
    </div>
  )
}
