import { useState } from "react"
import { api } from "../api.js"

export default function ChallengePanel({ match, challenges, onUpdate, onBalanceChange, prefill, playerStreak = 0, totalChallenges = 0 }) {
  const [issuerStake, setIssuerStake] = useState(prefill?.stake ?? 100)
  const [issuerOdds, setIssuerOdds] = useState(prefill?.my_odds ?? 3.0)
  const [acceptorOdds, setAcceptorOdds] = useState(prefill?.their_odds ?? 1.5)
  const [selection, setSelection] = useState(prefill?.my_pick ?? "")
  const [acceptorSelection, setAcceptorSelection] = useState(prefill?.their_pick ?? "")
  const [betType, setBetType] = useState(prefill?.bet_type ?? "1x2")
  const [loading, setLoading] = useState(false)
  const [acceptingId, setAcceptingId] = useState(null)
  const [msg, setMsg] = useState("")

  const acceptorStake = acceptorOdds > 0
    ? Math.max(1, Math.round(issuerStake * (issuerOdds / acceptorOdds)))
    : 0

  async function issue() {
    if (!selection || !acceptorSelection) return setMsg("Fill in both picks")
    if (!issuerStake || issuerStake <= 0) return setMsg("Stake must be positive")
    setLoading(true); setMsg("")
    try {
      const r = await api.post(`/api/matches/${match.id}/challenges`, {
        bet_type: betType, selection, acceptor_selection: acceptorSelection,
        issuer_stake: issuerStake, issuer_odds: issuerOdds, acceptor_odds: acceptorOdds,
      })
      setMsg(`✓ Challenge issued! Balance: ${r.new_balance}`)
      onBalanceChange?.(r.new_balance)
      onUpdate?.()
    } catch (err) { setMsg(`✗ ${err.message}`) }
    finally { setLoading(false) }
  }

  async function accept(challengeId) {
    setAcceptingId(challengeId)
    try {
      const r = await api.post(`/api/challenges/${challengeId}/accept`, {})
      setMsg(`✓ Challenge accepted! Balance: ${r.new_balance}`)
      onBalanceChange?.(r.new_balance)
      onUpdate?.()
    } catch (err) { setMsg(`✗ ${err.message}`) }
    finally { setAcceptingId(null) }
  }

  const streakBonus = playerStreak >= 5 ? "+35%" : playerStreak === 4 ? "+20%" : playerStreak === 3 ? "+10%" : null
  const MILESTONES = [[5, 50], [10, 150], [20, 400]]
  const nextMilestone = MILESTONES.find(([t]) => totalChallenges < t)
  const milestoneText = nextMilestone
    ? `${nextMilestone[0] - totalChallenges} more challenge${nextMilestone[0] - totalChallenges === 1 ? "" : "s"} → ${nextMilestone[1]} token bonus`
    : null

  return (
    <div style={{ background: "#13131f", border: "1px solid #2d2b55", borderRadius: 12, padding: 16, marginBottom: 12 }}>
      <h3 style={{ color: "#a78bfa", fontWeight: 700, marginBottom: 12, fontSize: 14 }}>Challenges</h3>

      {(playerStreak > 0 || milestoneText) && (
        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          {playerStreak > 0 && (
            <div style={{
              background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.4)",
              borderRadius: 999, padding: "3px 10px", fontSize: 10, color: "#c4b5fd", fontWeight: 700,
            }}>
              🔥 {playerStreak} streak{streakBonus ? ` — ${streakBonus} win bonus` : ""}
            </div>
          )}
          {milestoneText && (
            <div style={{
              background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)",
              borderRadius: 999, padding: "3px 10px", fontSize: 10, color: "#4ade80", fontWeight: 700,
            }}>
              🎯 {milestoneText}
            </div>
          )}
        </div>
      )}

      {/* Issue form */}
      <div style={{ background: "#0c0c14", border: "1px solid #2d2b55", borderRadius: 10, padding: 12, marginBottom: 12 }}>
        <p style={{ color: "#6b7280", fontSize: 11, marginBottom: 8 }}>Issue a new challenge</p>

        {/* Bet type selector */}
        <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
          {[
            { key: "1x2",          label: "1×2",           hint: "Win / Draw / Win" },
            { key: "correct_score", label: "Score",         hint: "Exact scoreline" },
            { key: "btts",         label: "BTTS",           hint: "Both teams score" },
            { key: "totals",       label: "Totals",         hint: "Over / Under goals" },
          ].map(({ key, label, hint }) => (
            <button
              key={key}
              title={hint}
              onClick={() => { setBetType(key); setSelection(""); setAcceptorSelection("") }}
              style={{
                padding: "3px 10px", borderRadius: 999, fontSize: 10, fontWeight: 700,
                cursor: "pointer", border: "1px solid",
                background: betType === key ? "rgba(168,85,247,0.2)" : "transparent",
                borderColor: betType === key ? "rgba(168,85,247,0.6)" : "#2d2b55",
                color: betType === key ? "#c4b5fd" : "#6b7280",
                transition: "all 0.1s",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Per-type pick hints */}
        <p style={{ color: "#4b5563", fontSize: 10, marginBottom: 8 }}>
          {betType === "1x2"           && "Your pick: team name or 'Draw'. Their pick: the opposing side."}
          {betType === "correct_score" && "Format: '2-1' (home-away). E.g. your pick '2-1', their pick '1-2'."}
          {betType === "btts"          && "Pick 'Yes' or 'No'. Their pick is the opposite."}
          {betType === "totals"        && "E.g. 'Over 2.5' vs 'Under 2.5'. Agree on the line with your opponent."}
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input placeholder="Your pick" value={selection} onChange={(e) => setSelection(e.target.value)}
            style={{ flex: 1, background: "#13131f", border: "1px solid #2d2b55", borderRadius: 6,
              padding: "6px 10px", color: "#e2e8f0", fontSize: 12 }} />
          <input placeholder="Their pick" value={acceptorSelection} onChange={(e) => setAcceptorSelection(e.target.value)}
            style={{ flex: 1, background: "#13131f", border: "1px solid #2d2b55", borderRadius: 6,
              padding: "6px 10px", color: "#e2e8f0", fontSize: 12 }} />
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8, fontSize: 11, color: "#6b7280", alignItems: "center" }}>
          <span>Your stake:</span>
          <input type="number" value={issuerStake} onChange={(e) => setIssuerStake(Number(e.target.value))}
            style={{ width: 70, background: "#13131f", border: "1px solid #2d2b55", borderRadius: 6,
              padding: "4px 8px", color: "#e2e8f0", fontSize: 12 }} />
          <span>Your odds:</span>
          <input type="number" step="0.1" value={issuerOdds} onChange={(e) => setIssuerOdds(Number(e.target.value))}
            style={{ width: 60, background: "#13131f", border: "1px solid #2d2b55", borderRadius: 6,
              padding: "4px 8px", color: "#e2e8f0", fontSize: 12 }} />
          <span>Their odds:</span>
          <input type="number" step="0.1" value={acceptorOdds} onChange={(e) => setAcceptorOdds(Number(e.target.value))}
            style={{ width: 60, background: "#13131f", border: "1px solid #2d2b55", borderRadius: 6,
              padding: "4px 8px", color: "#e2e8f0", fontSize: 12 }} />
        </div>
        <p style={{ color: "#a78bfa", fontSize: 11, marginBottom: 8 }}>
          Their counter-stake: <strong>{acceptorStake}</strong> tokens
        </p>
        <button onClick={issue} disabled={loading}
          style={{ background: "linear-gradient(135deg,#a855f7,#3b82f6)", color: "#fff",
            border: "none", borderRadius: 6, padding: "7px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          Issue Challenge
        </button>
      </div>

      {/* Open challenges */}
      {challenges?.length > 0 && (
        <div>
          <p style={{ color: "#6b7280", fontSize: 11, marginBottom: 8 }}>Open challenges</p>
          {challenges.map((c) => (
            <div key={c.id} style={{ background: "#0c0c14", border: "1px solid #2d2b55",
              borderRadius: 8, padding: 10, marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                {c.issuer_name && (
                  <div style={{ color: "#a78bfa", fontSize: 10, fontWeight: 700, marginBottom: 2 }}>
                    {c.issuer_name} challenges you
                  </div>
                )}
                <span style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600 }}>{c.selection}</span>
                <span style={{ color: "#6b7280", fontSize: 11 }}> vs </span>
                <span style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600 }}>{c.acceptor_selection}</span>
                <div style={{ color: "#6b7280", fontSize: 10, marginTop: 2 }}>
                  {c.issuer_stake} vs {c.acceptor_stake} tokens
                </div>
              </div>
              <button
                onClick={() => accept(c.id)}
                disabled={acceptingId === c.id}
                style={{
                  background: "#1e1b3a", color: "#a78bfa", border: "1px solid #2d2b55",
                  borderRadius: 6, padding: "5px 12px", fontSize: 11, fontWeight: 700,
                  cursor: acceptingId === c.id ? "not-allowed" : "pointer",
                  opacity: acceptingId === c.id ? 0.6 : 1,
                }}>
                {acceptingId === c.id ? "..." : "Accept"}
              </button>
            </div>
          ))}
        </div>
      )}

      {msg && <p style={{ color: msg.startsWith("✓") ? "#4ade80" : "#f87171", fontSize: 12, marginTop: 8 }}>{msg}</p>}
    </div>
  )
}
