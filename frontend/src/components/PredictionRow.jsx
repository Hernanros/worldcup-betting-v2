import { useState, useRef, useCallback } from "react"
import { api } from "../api.js"
import TeamFlag from "./TeamFlag.jsx"
import { ilTime } from "../utils/time.js"

const NUM_PICKER = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

function scoreInputStyle(active, filled, locked) {
  return {
    width: 38, height: 36,
    border: `1.5px solid ${active ? "#a855f7" : filled ? "#22d3ee" : "#2d2b55"}`,
    borderRadius: 7,
    background: active ? "rgba(168,85,247,0.12)" : filled ? "rgba(34,211,238,0.06)" : "#0c0c14",
    fontSize: 17, fontWeight: 800, textAlign: "center",
    color: active ? "#e2e8f0" : filled ? "#22d3ee" : "#4b5563",
    cursor: locked ? "not-allowed" : "text",
    transition: "border-color 0.15s, background 0.15s",
    flexShrink: 0, outline: "none",
    MozAppearance: "textfield", padding: 0, boxSizing: "border-box",
  }
}

/* ── Finished result card (ripped from Domino's Challenge UI) ── */
function FinishedCard({ entry }) {
  const pred = entry.my_prediction
  const pts = pred?.points_awarded ?? null
  const hasPred = pred !== null

  const ptsBg = !hasPred
    ? "#374151"
    : pts > 0
      ? (pts >= 3 ? "#16a34a" : "#2563eb")
      : "#d97706"

  return (
    <div style={{
      background: "#161624",
      border: "1px solid #2d2b55",
      borderRadius: 12,
      padding: "8px 10px 10px",
      marginBottom: 5,
    }}>
      {/* Group label */}
      {entry.group && (
        <div style={{
          textAlign: "center", fontSize: 9, fontWeight: 700,
          color: "#6b7280", letterSpacing: 0.5,
          textTransform: "uppercase", marginBottom: 6,
        }}>
          Group {entry.group}
        </div>
      )}

      {/* Main row */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>

        {/* Home side */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <TeamFlag name={entry.home_team} size={26} />
            <span style={{
              fontSize: 11, fontWeight: 600, color: "#e2e8f0",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {entry.home_team}
            </span>
          </div>
          {hasPred && (
            <span style={{ fontSize: 10, color: "#6b7280", paddingLeft: 31 }}>
              ({pred.home_score_pred})
            </span>
          )}
        </div>

        {/* Center: score + points bubble */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 26, fontWeight: 900, color: "#f1f5f9", lineHeight: 1 }}>
            {entry.home_score ?? "–"}
          </span>
          <div style={{
            width: 30, height: 30, borderRadius: "50%",
            background: ptsBg,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 800, color: "#fff",
            flexShrink: 0,
          }}>
            {hasPred ? (pts ?? 0) : "–"}
          </div>
          <span style={{ fontSize: 26, fontWeight: 900, color: "#f1f5f9", lineHeight: 1 }}>
            {entry.away_score ?? "–"}
          </span>
        </div>

        {/* Away side */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{
              fontSize: 11, fontWeight: 600, color: "#e2e8f0",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {entry.away_team}
            </span>
            <TeamFlag name={entry.away_team} size={26} />
          </div>
          {hasPred && (
            <span style={{ fontSize: 10, color: "#6b7280", paddingRight: 31 }}>
              ({pred.away_score_pred})
            </span>
          )}
        </div>
      </div>

      {/* Points label */}
      {hasPred && pts !== null && (
        <div style={{ textAlign: "center", marginTop: 5 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, color: ptsBg,
            textTransform: "uppercase", letterSpacing: 0.5,
          }}>
            {pts === 0 ? "No points" : pts >= 3 ? `+${pts} — Exact score!` : `+${pts} — Correct outcome`}
          </span>
        </div>
      )}
      {!hasPred && (
        <div style={{ textAlign: "center", marginTop: 5 }}>
          <span style={{ fontSize: 9, color: "#4b5563" }}>No prediction submitted</span>
        </div>
      )}
    </div>
  )
}

/* ── Input card (upcoming / locked) ── */
export default function PredictionRow({ entry, onSaved, doublesUsed = 0 }) {
  if (entry.status === "finished") return <FinishedCard entry={entry} />

  const pred = entry.my_prediction
  const [home, setHome] = useState(pred?.home_score_pred ?? null)
  const [away, setAway] = useState(pred?.away_score_pred ?? null)
  const [isDouble, setIsDouble] = useState(pred?.is_double ?? false)
  const [activePicker, setActivePicker] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState("")
  const saveTimer = useRef(null)
  const homeRef = useRef(null)
  const awayRef = useRef(null)

  const locked = entry.status === "locked"
  const hasPred = home !== null && away !== null
  const doublesLeft = 3 - doublesUsed
  const canDouble = isDouble || doublesLeft > 0

  const minsUntil = entry.kickoff_time
    ? Math.floor((new Date(entry.kickoff_time) - Date.now()) / 60000)
    : null
  const isUrgent = !locked && minsUntil !== null && minsUntil >= 0 && minsUntil <= 60

  const doSave = useCallback(async (h, a, dbl) => {
    if (h === null || a === null) return
    setSaving(true); setMsg("")
    try {
      const result = await api.post("/api/predictions", {
        match_id: entry.match_id,
        home_score_pred: h,
        away_score_pred: a,
        is_double: dbl,
      })
      setMsg("✓")
      onSaved?.(result.doubles_used)
      setTimeout(() => setMsg(""), 2000)
    } catch {
      setMsg("✗")
    } finally { setSaving(false) }
  }, [entry.match_id, onSaved])

  function scheduleSave(h, a, dbl) {
    clearTimeout(saveTimer.current)
    if (h !== null && a !== null)
      saveTimer.current = setTimeout(() => doSave(h, a, dbl), 600)
  }

  async function clear() {
    clearTimeout(saveTimer.current)
    setSaving(true); setMsg("")
    try {
      await api.delete(`/api/predictions/${entry.match_id}`)
      setHome(null); setAway(null); setIsDouble(false); setActivePicker(null)
      setMsg("✓")
      onSaved?.()
      setTimeout(() => setMsg(""), 1500)
    } catch { setMsg("✗") }
    finally { setSaving(false) }
  }

  function handleTyped(side, raw) {
    if (raw === "") {
      if (side === "home") { setHome(null); clearTimeout(saveTimer.current) }
      else { setAway(null); clearTimeout(saveTimer.current) }
      return
    }
    const n = parseInt(raw, 10)
    if (isNaN(n) || n < 0) return
    if (side === "home") {
      setHome(n)
      if (away === null) setTimeout(() => { awayRef.current?.focus(); awayRef.current?.select() }, 0)
      else scheduleSave(n, away, isDouble)
    } else {
      setAway(n)
      if (home === null) setTimeout(() => { homeRef.current?.focus(); homeRef.current?.select() }, 0)
      else scheduleSave(home, n, isDouble)
    }
  }

  async function handlePickNumber(n) {
    clearTimeout(saveTimer.current)
    if (activePicker === "home") {
      setHome(n)
      if (away !== null) { setActivePicker(null); await doSave(n, away, isDouble) }
      else { setActivePicker("away"); setTimeout(() => { awayRef.current?.focus(); awayRef.current?.select() }, 0) }
    } else {
      setAway(n)
      if (home !== null) { setActivePicker(null); await doSave(home, n, isDouble) }
      else { setActivePicker("home"); setTimeout(() => { homeRef.current?.focus(); homeRef.current?.select() }, 0) }
    }
  }

  async function toggleDouble() {
    if (!hasPred || (!canDouble && !isDouble)) return
    const next = !isDouble
    setIsDouble(next)
    await doSave(home, away, next)
  }

  return (
    <div style={{
      background: isUrgent ? "#16110a" : "#13131f",
      border: `1px solid ${isUrgent ? "rgba(245,158,11,0.35)" : "#2d2b55"}`,
      borderRadius: 10,
      padding: "8px 10px",
      marginBottom: 5,
      opacity: locked && !hasPred ? 0.55 : 1,
    }}>
      {/* Group label */}
      {entry.group && (
        <div style={{
          textAlign: "center", fontSize: 9, fontWeight: 700,
          color: "#6b7280", letterSpacing: 0.5,
          textTransform: "uppercase", marginBottom: 5,
        }}>
          Group {entry.group}
        </div>
      )}

      {/* Teams + score row */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {/* Home */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, flex: 1, minWidth: 0 }}>
          <TeamFlag name={entry.home_team} size={24} />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {entry.home_team}
          </span>
        </div>

        {/* Center */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <input
              ref={homeRef} type="number" min={0} max={99} inputMode="numeric"
              value={home ?? ""} placeholder="–" readOnly={locked}
              onFocus={() => { if (!locked) setActivePicker("home") }}
              onBlur={() => setTimeout(() => {
                if (document.activeElement !== awayRef.current) setActivePicker(null)
              }, 150)}
              onChange={e => handleTyped("home", e.target.value)}
              style={scoreInputStyle(activePicker === "home", home !== null, locked)}
            />
            <span style={{ color: "#4b5563", fontSize: 14, fontWeight: 800 }}>–</span>
            <input
              ref={awayRef} type="number" min={0} max={99} inputMode="numeric"
              value={away ?? ""} placeholder="–" readOnly={locked}
              onFocus={() => { if (!locked) setActivePicker("away") }}
              onBlur={() => setTimeout(() => {
                if (document.activeElement !== homeRef.current) setActivePicker(null)
              }, 150)}
              onChange={e => handleTyped("away", e.target.value)}
              style={scoreInputStyle(activePicker === "away", away !== null, locked)}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {entry.kickoff_time && (
              <span style={{ fontSize: 9, color: "#6b7280" }}>{ilTime(entry.kickoff_time)}</span>
            )}
            {locked && <span style={{ fontSize: 9, color: "#4b5563" }}>🔒</span>}
            {isUrgent && <span style={{ fontSize: 8, color: "#f59e0b", fontWeight: 700 }}>⚠ {minsUntil}m</span>}
          </div>
        </div>

        {/* Away */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, flex: 1, minWidth: 0, justifyContent: "flex-end" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>
            {entry.away_team}
          </span>
          <TeamFlag name={entry.away_team} size={24} />
        </div>
      </div>

      {/* Actions row */}
      {(hasPred || pred?.status) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          {!locked && hasPred && (
            <button onClick={toggleDouble} disabled={saving || (!canDouble && !isDouble)}
              title={isDouble ? "Double ON" : doublesLeft > 0 ? `${doublesLeft} doubles left` : "All 3 used"}
              style={{
                background: isDouble ? "rgba(245,158,11,0.15)" : "none",
                border: `1px solid ${isDouble ? "#f59e0b" : "#2d2b55"}`,
                borderRadius: 6, padding: "2px 8px", cursor: "pointer",
                color: isDouble ? "#f59e0b" : "#6b7280",
                fontSize: 10, fontWeight: 700,
                opacity: (!canDouble && !isDouble) ? 0.4 : 1,
              }}>
              ⚡ {isDouble ? "2×" : "Double"}
            </button>
          )}
          {!locked && hasPred && (
            <button onClick={clear} disabled={saving}
              style={{ marginLeft: "auto", background: "none", border: "none",
                color: "#4b5563", fontSize: 10, cursor: "pointer", padding: "2px 4px" }}>
              ×
            </button>
          )}
          {msg && (
            <span style={{ fontSize: 10, color: msg === "✓" ? "#4ade80" : "#f87171" }}>
              {msg === "✓" ? "✓ Saved" : "✗ Error"}
            </span>
          )}
          {saving && <span style={{ fontSize: 9, color: "#6b7280" }}>saving…</span>}
        </div>
      )}

      {/* Number picker */}
      {activePicker && !locked && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", paddingTop: 10 }}>
          {NUM_PICKER.map(n => (
            <button key={n}
              onMouseDown={e => e.preventDefault()}
              onClick={() => handlePickNumber(n)}
              style={{
                width: 36, height: 34, border: "1px solid #2d2b55", borderRadius: 7,
                background: "#1a1a2e", fontSize: 15, fontWeight: 700,
                color: "#e2e8f0", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
              {n}
            </button>
          ))}
        </div>
      )}

      <style>{`
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>
    </div>
  )
}
