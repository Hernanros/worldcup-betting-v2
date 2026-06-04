import { useState, useRef } from "react"
import { api } from "../api.js"
import { flagUrl } from "../data/teams.js"
import HelpTip from "./HelpTip.jsx"

function Flag({ name }) {
  const url = flagUrl(name, 40)
  if (!url) return null
  return (
    <img src={url} alt={name} width={20} height={14}
      style={{ objectFit: "cover", borderRadius: 2, verticalAlign: "middle", marginRight: 5 }}
      onError={(e) => { e.target.style.display = "none" }} />
  )
}

export default function PredictionRow({ entry, onSaved, doublesUsed = 0 }) {
  const [home, setHome] = useState(entry.my_prediction?.home_score_pred ?? "")
  const [away, setAway] = useState(entry.my_prediction?.away_score_pred ?? "")
  const [isDouble, setIsDouble] = useState(entry.my_prediction?.is_double ?? false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState("")
  const awayRef = useRef(null)

  function handleHomeChange(e) {
    const v = e.target.value
    setHome(v)
    if (v !== "") { awayRef.current?.focus(); awayRef.current?.select() }
  }

  const locked = entry.status === "finished" || entry.status === "locked"
  const pred = entry.my_prediction
  const doublesLeft = 3 - doublesUsed
  const canDouble = isDouble || doublesLeft > 0

  async function save() {
    if (home === "" || away === "") return setMsg("Enter both scores")
    const homeNum = Number(home)
    const awayNum = Number(away)
    if (!Number.isInteger(homeNum) || !Number.isInteger(awayNum) || homeNum < 0 || awayNum < 0)
      return setMsg("Scores must be non-negative integers")
    setSaving(true); setMsg("")
    try {
      const result = await api.post("/api/predictions", {
        match_id: entry.match_id,
        home_score_pred: homeNum,
        away_score_pred: awayNum,
        is_double: isDouble,
      })
      setMsg("✓ Saved")
      onSaved?.(result.doubles_used)
    } catch (err) { setMsg(`✗ ${err.message}`) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ background: "#13131f", border: "1px solid #2d2b55", borderRadius: 10, padding: 12, marginBottom: 8 }}>
      {entry.group && (
        <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>
          Group {entry.group}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "nowrap", minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: "#e2e8f0", whiteSpace: "nowrap" }}>
            <Flag name={entry.home_team} />{entry.home_team}
          </span>
          <span style={{ color: "#6b7280", fontSize: 12, flexShrink: 0 }}>vs</span>
          <span style={{ fontWeight: 600, fontSize: 13, color: "#e2e8f0", whiteSpace: "nowrap" }}>
            <Flag name={entry.away_team} />{entry.away_team}
          </span>
        </div>
        {pred && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
            background: pred.status === "correct_score" ? "#16a34a" : pred.status === "correct_outcome" ? "#2563eb" : "#374151",
            color: "#fff", display: "inline-flex", alignItems: "center", gap: 3,
          }}>
            {pred.status === "correct_score" ? (pred.is_double ? "+6 pts ✓✓" : "+3 pts ✓") :
             pred.status === "correct_outcome" ? (pred.is_double ? "+2 pts ~" : "+1 pt ~") :
             pred.status === "wrong" ? "Wrong" : "Pending"}
            <HelpTip text="Exact score earns 3 pts (6 if double). Correct outcome earns 1 pt (2 if double). Pending = match not finished." />
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
        <input type="number" min={0} step={1} value={home} onChange={handleHomeChange} disabled={locked}
          style={{ width: 52, background: "#0c0c14", border: "1px solid #2d2b55", borderRadius: 6,
            padding: "5px 8px", color: "#e2e8f0", fontSize: 14, textAlign: "center",
            cursor: locked ? "not-allowed" : "auto", opacity: locked ? 0.5 : 1 }} />
        <span style={{ color: "#6b7280", fontSize: 12 }}>—</span>
        <input ref={awayRef} type="number" min={0} step={1} value={away} onChange={(e) => setAway(e.target.value)} disabled={locked}
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

      {!locked && (
        <div style={{
          background: "#0c0c14", border: `1px solid ${isDouble ? "#f59e0b" : "#2d2b55"}`,
          borderRadius: 8, padding: "8px 10px", marginTop: 8,
          display: "flex", alignItems: "center", gap: 10,
          opacity: canDouble ? 1 : 0.5,
        }}>
          <button
            onClick={() => canDouble && setIsDouble(v => !v)}
            disabled={!canDouble && !isDouble}
            style={{
              width: 32, height: 18, borderRadius: 999, border: "none",
              cursor: canDouble ? "pointer" : "not-allowed",
              background: isDouble ? "#f59e0b" : "#2d2b55", padding: 0,
              position: "relative", flexShrink: 0, transition: "background 0.2s",
            }}>
            <span style={{
              position: "absolute", top: 2, left: isDouble ? 16 : 2,
              width: 14, height: 14, borderRadius: "50%", background: "#fff",
              transition: "left 0.2s", display: "block",
            }} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ color: isDouble ? "#f59e0b" : "#e2e8f0", fontSize: 11, fontWeight: 700 }}>⚡ Double Points</div>
            <div style={{ color: "#6b7280", fontSize: 10, marginTop: 1 }}>
              {canDouble ? `${doublesLeft} double${doublesLeft === 1 ? "" : "s"} remaining` : "All 3 doubles used"}
            </div>
          </div>
          <HelpTip text="Mark up to 3 predictions as double points. Correct = 6 pts (exact) or 2 pts (outcome). Toggle on then hit Save." />
        </div>
      )}
      {locked && pred?.is_double && (
        <div style={{ fontSize: 10, color: "#f59e0b", marginTop: 4 }}>⚡ Double pick</div>
      )}
    </div>
  )
}
