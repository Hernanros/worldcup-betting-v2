import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../api.js"
import { ilDateTime } from "../utils/time.js"

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

  const lockStr = stage.lock_time ? ilDateTime(stage.lock_time) : null

  // Urgency-aware copy
  const hoursLeft = stage.lock_time
    ? Math.max(0, (new Date(stage.lock_time) - Date.now()) / 3_600_000)
    : null
  const isUrgent = hoursLeft !== null && hoursLeft < 24

  const STAGE_QUESTIONS = {
    tournament:  "How will this tournament play out?",
    group_stage: "Which team will dominate the group stage?",
    r32:         "How bloody will it get?",
    r16:         "Which defense will leak?",
    qf:          "Supersubs to the rescue?",
    sf:          "Red card drama?",
    final:       "Goals fest?",
  }

  const headline = isUrgent
    ? `⏰ Last call — ${STAGE_LABELS[stage.stage]} picks close in ${Math.ceil(hoursLeft)}h`
    : (STAGE_QUESTIONS[stage.stage] ?? `${stage.market_count} ${STAGE_LABELS[stage.stage]} props to pick`)
  const subline = isUrgent
    ? `Bet beyond the score · locks ${lockStr ?? "soon"}`
    : `Bet beyond the score`

  return (
    <div onClick={() => navigate(`/deep-cuts?stage=${stage.stage}`)} style={{
      background: isUrgent
        ? "linear-gradient(135deg, #e74c3c 0%, #1abc9c 100%)"
        : "linear-gradient(135deg, #1abc9c 0%, #0e8a6e 100%)",
      borderRadius: 10, padding: "12px 14px", margin: "0 0 16px",
      display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
      boxShadow: `0 4px 15px rgba(${isUrgent ? "231,76,60" : "26,188,156"},0.3)`,
      position: "relative",
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>{headline}</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.85)", marginTop: 2 }}>{subline}</div>
      </div>
      <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 6, padding: "5px 10px", fontSize: 12, fontWeight: 700, color: "#fff", whiteSpace: "nowrap" }}>
        Pick now →
      </div>
      <button onClick={handleDismiss} style={{ position: "absolute", top: 6, right: 6, background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 16, cursor: "pointer", lineHeight: 1, padding: "2px 4px" }} aria-label="Dismiss">×</button>
    </div>
  )
}
