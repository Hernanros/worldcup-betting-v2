import { useState } from "react"
import { api } from "../api.js"

export default function PredictionRow({ entry, onSaved }) {
  const [home, setHome] = useState(entry.my_prediction?.home_score_pred ?? "")
  const [away, setAway] = useState(entry.my_prediction?.away_score_pred ?? "")
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState("")

  const locked = entry.status === "finished" || entry.status === "locked"
  const pred = entry.my_prediction

  async function save() {
    if (home === "" || away === "") return setMsg("Enter both scores")
    const homeNum = Number(home)
    const awayNum = Number(away)
    if (!Number.isInteger(homeNum) || !Number.isInteger(awayNum) || homeNum < 0 || awayNum < 0) {
      return setMsg("Scores must be non-negative integers")
    }
    setSaving(true)
    setMsg("")
    try {
      await api.post("/api/predictions", {
        match_id: entry.match_id,
        home_score_pred: homeNum,
        away_score_pred: awayNum,
      })
      setMsg("✓ Saved")
      onSaved?.()
    } catch (err) { setMsg(`✗ ${err.message}`) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ background: "#13131f", border: "1px solid #2d2b55", borderRadius: 10, padding: 12, marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: "#e2e8f0" }}>
          {entry.home_team} vs {entry.away_team}
        </span>
        {pred && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
            background: pred.status === "correct_score" ? "#16a34a" :
                        pred.status === "correct_outcome" ? "#2563eb" : "#374151",
            color: "#fff",
          }}>
            {pred.status === "correct_score" ? "+3 pts ✓" :
             pred.status === "correct_outcome" ? "+1 pt ~" :
             pred.status === "wrong" ? "Wrong" : "Pending"}
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
        <input type="number" min={0} step={1} value={home} onChange={(e) => setHome(e.target.value)}
          disabled={locked}
          style={{ width: 52, background: "#0c0c14", border: "1px solid #2d2b55", borderRadius: 6,
            padding: "5px 8px", color: "#e2e8f0", fontSize: 14, textAlign: "center",
            cursor: locked ? "not-allowed" : "auto", opacity: locked ? 0.5 : 1 }} />
        <span style={{ color: "#6b7280", fontSize: 12 }}>—</span>
        <input type="number" min={0} step={1} value={away} onChange={(e) => setAway(e.target.value)}
          disabled={locked}
          style={{ width: 52, background: "#0c0c14", border: "1px solid #2d2b55", borderRadius: 6,
            padding: "5px 8px", color: "#e2e8f0", fontSize: 14, textAlign: "center",
            cursor: locked ? "not-allowed" : "auto", opacity: locked ? 0.5 : 1 }} />
        {!locked && (
          <button onClick={save} disabled={saving}
            style={{ background: "linear-gradient(135deg,#a855f7,#3b82f6)", color: "#fff",
              border: "none", borderRadius: 6, padding: "5px 14px", fontSize: 12, fontWeight: 700,
              cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? "..." : "Save"}
          </button>
        )}
        {msg && <span style={{ fontSize: 11, color: msg.startsWith("✓") ? "#4ade80" : "#f87171" }}>{msg}</span>}
      </div>
    </div>
  )
}
