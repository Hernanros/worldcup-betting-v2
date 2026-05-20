import { useState } from "react"
import { api } from "../api.js"

export default function ChallengePanel({ match, challenges, onUpdate }) {
  const [issuerStake, setIssuerStake] = useState(100)
  const [issuerOdds, setIssuerOdds] = useState(3.0)
  const [acceptorOdds, setAcceptorOdds] = useState(1.5)
  const [selection, setSelection] = useState("")
  const [acceptorSelection, setAcceptorSelection] = useState("")
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
        bet_type: "1x2", selection, acceptor_selection: acceptorSelection,
        issuer_stake: issuerStake, issuer_odds: issuerOdds, acceptor_odds: acceptorOdds,
      })
      setMsg(`✓ Challenge issued! Balance: ${r.new_balance}`)
      onUpdate?.()
    } catch (err) { setMsg(`✗ ${err.message}`) }
    finally { setLoading(false) }
  }

  async function accept(challengeId) {
    setAcceptingId(challengeId)
    try {
      const r = await api.post(`/api/challenges/${challengeId}/accept`, {})
      setMsg(`✓ Challenge accepted! Balance: ${r.new_balance}`)
      onUpdate?.()
    } catch (err) { setMsg(`✗ ${err.message}`) }
    finally { setAcceptingId(null) }
  }

  return (
    <div style={{ background: "#13131f", border: "1px solid #2d2b55", borderRadius: 12, padding: 16, marginBottom: 12 }}>
      <h3 style={{ color: "#a78bfa", fontWeight: 700, marginBottom: 12, fontSize: 14 }}>Challenges</h3>

      {/* Issue form */}
      <div style={{ background: "#0c0c14", border: "1px solid #2d2b55", borderRadius: 10, padding: 12, marginBottom: 12 }}>
        <p style={{ color: "#6b7280", fontSize: 11, marginBottom: 8 }}>Issue a new challenge</p>
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
