import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../api.js"

export default function DeepCutsBanner() {
  const navigate = useNavigate()
  const [stage, setStage] = useState(null)

  useEffect(() => {
    api.get("/api/deep-cuts/banner")
      .then(data => {
        if (data.open_stages?.length > 0) setStage(data.open_stages[0])
      })
      .catch(() => {})
  }, [])

  if (!stage) return null

  const STAGE_LABELS = {
    tournament: "Tournament", group_stage: "Group Stage", r32: "Round of 32",
    r16: "Round of 16", qf: "Quarter-Finals", sf: "Semi-Finals", final: "The Final",
  }

  function handleDismiss(e) {
    e.stopPropagation()
    api.post(`/api/deep-cuts/dismiss/${stage.stage}`).catch(() => {})
    setStage(null)
  }

  const lockStr = stage.lock_time
    ? new Date(stage.lock_time).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : null

  return (
    <div onClick={() => navigate(`/deep-cuts?stage=${stage.stage}`)} style={{
      background: "linear-gradient(135deg, #1abc9c 0%, #0e8a6e 100%)",
      borderRadius: 10, padding: "12px 14px", margin: "0 0 16px",
      display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
      boxShadow: "0 4px 15px rgba(26,188,156,0.3)", position: "relative",
    }}>
      <span style={{ fontSize: 28 }}>🔪</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>
          {STAGE_LABELS[stage.stage]} Deep Cuts are open!
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 2 }}>
          {stage.market_count} markets{lockStr ? ` · Locks ${lockStr}` : ""}
        </div>
      </div>
      <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 6, padding: "5px 10px", fontSize: 12, fontWeight: 700, color: "#fff", whiteSpace: "nowrap" }}>
        Pick now →
      </div>
      <button onClick={handleDismiss} style={{ position: "absolute", top: 6, right: 6, background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 16, cursor: "pointer", lineHeight: 1, padding: "2px 4px" }} aria-label="Dismiss">×</button>
    </div>
  )
}
