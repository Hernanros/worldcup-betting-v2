// Reusable inline score prediction — used on Home hero + Match detail page
import { useState, useRef } from "react"
import { api } from "../api.js"

const NUM_PICKER = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

function scoreInputStyle(active, filled) {
  return {
    width: 40, height: 38,
    border: `1.5px solid ${active ? "#a855f7" : filled ? "#22d3ee" : "#2d2b55"}`,
    borderRadius: 7,
    background: active ? "rgba(168,85,247,0.12)" : filled ? "rgba(34,211,238,0.06)" : "#0c0c14",
    fontSize: 18, fontWeight: 800, textAlign: "center",
    color: active ? "#e2e8f0" : filled ? "#22d3ee" : "#4b5563",
    cursor: "text", outline: "none",
    MozAppearance: "textfield",
    padding: 0, boxSizing: "border-box", flexShrink: 0,
  }
}

/* ── Collapsed trigger button ───────────────────────────────── */
export function PredictButton({ matchId, prediction, onExpand }) {
  const hasPred = prediction != null
  return (
    <button onClick={onExpand} style={{
      width: "100%", padding: "9px 10px", borderRadius: 8, fontSize: 13, fontWeight: 700,
      cursor: "pointer", border: "1px solid",
      background: hasPred ? "rgba(34,211,238,0.08)" : "rgba(168,85,247,0.08)",
      borderColor: hasPred ? "rgba(34,211,238,0.3)" : "rgba(168,85,247,0.3)",
      color: hasPred ? "#22d3ee" : "#c4b5fd",
      textAlign: "center",
    }}>
      {hasPred
        ? `🎯 ${prediction.home_score_pred}–${prediction.away_score_pred} · change`
        : "🎯 Predict score"}
    </button>
  )
}

/* ── Expanded score picker ──────────────────────────────────── */
export function ScorePicker({ matchId, prediction, onSaved, onCollapse }) {
  const [home, setHome] = useState(prediction?.home_score_pred ?? null)
  const [away, setAway] = useState(prediction?.away_score_pred ?? null)
  const [activePicker, setActivePicker] = useState("home")
  const [saving, setSaving] = useState(false)
  const homeRef = useRef(null)
  const awayRef = useRef(null)

  async function doSave(h, a) {
    if (h === null || a === null) return
    setSaving(true)
    try {
      const result = await api.post("/api/predictions", {
        match_id: matchId,
        home_score_pred: h,
        away_score_pred: a,
        is_double: false,
      })
      onSaved?.(result.doubles_used, h, a)
      onCollapse?.()
    } catch {
      // fail silently — user can retry
    } finally {
      setSaving(false)
    }
  }

  async function handlePickNumber(n) {
    if (activePicker === "home") {
      setHome(n)
      if (away !== null) { setActivePicker(null); await doSave(n, away) }
      else { setActivePicker("away"); setTimeout(() => awayRef.current?.focus(), 0) }
    } else {
      setAway(n)
      if (home !== null) { setActivePicker(null); await doSave(home, n) }
      else { setActivePicker("home"); setTimeout(() => homeRef.current?.focus(), 0) }
    }
  }

  return (
    <div>
      <div style={{ color: "#a78bfa", fontSize: 10, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: 0.8, marginBottom: 10 }}>🎯 Your score prediction</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 10 }}>
        <input
          ref={homeRef}
          type="number" min={0} max={99} inputMode="numeric"
          value={home ?? ""}
          placeholder="–"
          onFocus={() => setActivePicker("home")}
          onBlur={() => setTimeout(() => {
            if (document.activeElement !== awayRef.current) setActivePicker(null)
          }, 150)}
          onChange={e => {
            const n = parseInt(e.target.value, 10)
            if (!isNaN(n) && n >= 0) setHome(n)
            else if (e.target.value === "") setHome(null)
          }}
          style={scoreInputStyle(activePicker === "home", home !== null)}
        />
        <span style={{ color: "#4b5563", fontSize: 20, fontWeight: 800 }}>–</span>
        <input
          ref={awayRef}
          type="number" min={0} max={99} inputMode="numeric"
          value={away ?? ""}
          placeholder="–"
          onFocus={() => setActivePicker("away")}
          onBlur={() => setTimeout(() => {
            if (document.activeElement !== homeRef.current) setActivePicker(null)
          }, 150)}
          onChange={e => {
            const n = parseInt(e.target.value, 10)
            if (!isNaN(n) && n >= 0) setAway(n)
            else if (e.target.value === "") setAway(null)
          }}
          style={scoreInputStyle(activePicker === "away", away !== null)}
        />
      </div>
      {activePicker && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
          {NUM_PICKER.map(n => (
            <button
              key={n}
              onMouseDown={e => e.preventDefault()}
              onClick={() => handlePickNumber(n)}
              style={{
                width: 36, height: 34, border: "1px solid #2d2b55", borderRadius: 7,
                background: "#1a1a2e", fontSize: 15, fontWeight: 700,
                color: "#e2e8f0", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}
            >{n}</button>
          ))}
        </div>
      )}
      {saving && <div style={{ color: "#6b7280", fontSize: 10, textAlign: "center" }}>saving…</div>}
      <style>{`
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>
    </div>
  )
}
