import { useState } from "react"
import { api } from "../api.js"
import { flagUrl } from "../data/teams.js"

function Flag({ name, size = 20 }) {
  const url = flagUrl(name, 40)
  if (!url) return null
  return (
    <img src={url} alt={name} width={size} height={Math.round(size * 0.67)}
      style={{ objectFit: "cover", borderRadius: 2, verticalAlign: "middle", flexShrink: 0 }}
      onError={(e) => { e.target.style.display = "none" }} />
  )
}

function ScoreBox({ value, active, locked, onClick }) {
  const filled = value !== null && value !== undefined
  return (
    <div
      onClick={locked ? undefined : onClick}
      style={{
        width: 34, height: 34,
        border: `1.5px solid ${active ? "#a855f7" : filled ? "#22d3ee" : "#2d2b55"}`,
        borderRadius: 7,
        background: active ? "rgba(168,85,247,0.12)" : filled ? "rgba(34,211,238,0.06)" : "#0c0c14",
        fontSize: 16, fontWeight: 800,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: active ? "#e2e8f0" : filled ? "#22d3ee" : "#4b5563",
        cursor: locked ? "default" : "pointer",
        transition: "border-color 0.15s, background 0.15s",
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {filled ? value : "–"}
    </div>
  )
}

const NUM_PICKER = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

export default function PredictionRow({ entry, onSaved, doublesUsed = 0 }) {
  const pred = entry.my_prediction
  const [home, setHome] = useState(pred?.home_score_pred ?? null)
  const [away, setAway] = useState(pred?.away_score_pred ?? null)
  const [isDouble, setIsDouble] = useState(pred?.is_double ?? false)
  const [activePicker, setActivePicker] = useState(null) // "home" | "away" | null
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState("")

  const locked = entry.status === "finished" || entry.status === "locked"
  const hasPred = home !== null && away !== null
  const doublesLeft = 3 - doublesUsed
  const canDouble = isDouble || doublesLeft > 0

  // Minutes until kickoff
  const minsUntil = entry.kickoff_time
    ? Math.floor((new Date(entry.kickoff_time) - Date.now()) / 60000)
    : null
  const isUrgent = !locked && minsUntil !== null && minsUntil >= 0 && minsUntil <= 60

  async function doSave(h, a, dbl) {
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
    } catch (err) {
      setMsg(`✗`)
    } finally {
      setSaving(false)
    }
  }

  async function clear() {
    setSaving(true); setMsg("")
    try {
      await api.delete(`/api/predictions/${entry.match_id}`)
      setHome(null); setAway(null); setIsDouble(false); setActivePicker(null)
      setMsg("✓")
      onSaved?.()
      setTimeout(() => setMsg(""), 1500)
    } catch (err) { setMsg("✗") }
    finally { setSaving(false) }
  }

  function handleBoxClick(side) {
    if (locked) return
    setActivePicker(prev => prev === side ? null : side)
  }

  async function handlePickNumber(n) {
    if (activePicker === "home") {
      setHome(n)
      if (away !== null) {
        setActivePicker(null)
        await doSave(n, away, isDouble)
      } else {
        setActivePicker("away")
      }
    } else if (activePicker === "away") {
      setAway(n)
      if (home !== null) {
        setActivePicker(null)
        await doSave(home, n, isDouble)
      } else {
        setActivePicker("home")
      }
    }
  }

  async function toggleDouble() {
    if (!hasPred || !canDouble && !isDouble) return
    const next = !isDouble
    setIsDouble(next)
    await doSave(home, away, next)
  }

  const statusPill = pred?.status && pred.status !== "pending"
    ? {
        correct_score: { bg: "#16a34a", label: pred.is_double ? `+${pred.points_awarded} ✓✓` : "+3 ✓" },
        correct_outcome: { bg: "#2563eb", label: pred.is_double ? `+${pred.points_awarded} ~` : "+1 ~" },
        wrong: { bg: "#374151", label: "✗" },
      }[pred.status]
    : null

  return (
    <div style={{
      background: isUrgent ? "#16110a" : "#13131f",
      border: `1px solid ${isUrgent ? "rgba(245,158,11,0.35)" : "#2d2b55"}`,
      borderRadius: 10,
      padding: "10px 10px 8px",
      marginBottom: 5,
      opacity: locked && !hasPred ? 0.55 : 1,
    }}>
      {/* Teams row */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {/* Home team */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, flex: 1, minWidth: 0 }}>
          <Flag name={entry.home_team} />
          <span style={{
            fontSize: 11, fontWeight: 600, color: "#e2e8f0",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{entry.home_team}</span>
        </div>

        {/* Center: score boxes */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <ScoreBox value={home} active={activePicker === "home"} locked={locked} onClick={() => handleBoxClick("home")} />
            <span style={{ color: "#4b5563", fontSize: 14, fontWeight: 800, lineHeight: 1 }}>–</span>
            <ScoreBox value={away} active={activePicker === "away"} locked={locked} onClick={() => handleBoxClick("away")} />
          </div>
          {/* Meta: time + group + urgency */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {entry.kickoff_time && (
              <span style={{ fontSize: 9, color: "#6b7280" }}>
                {new Date(entry.kickoff_time).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            {entry.group && (
              <span style={{ fontSize: 8, color: "#6b7280", background: "#1a1a2e", borderRadius: 3, padding: "1px 4px" }}>
                Grp {entry.group}
              </span>
            )}
            {locked && (
              <span style={{ fontSize: 9, color: "#4b5563" }}>🔒</span>
            )}
            {isUrgent && (
              <span style={{ fontSize: 8, color: "#f59e0b", fontWeight: 700 }}>⚠ {minsUntil}m</span>
            )}
          </div>
        </div>

        {/* Away team */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, flex: 1, minWidth: 0, justifyContent: "flex-end" }}>
          <span style={{
            fontSize: 11, fontWeight: 600, color: "#e2e8f0",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            textAlign: "right",
          }}>{entry.away_team}</span>
          <Flag name={entry.away_team} />
        </div>
      </div>

      {/* Action row: double toggle + status/msg */}
      {(hasPred || statusPill) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          {/* Double toggle — only if not locked */}
          {!locked && hasPred && (
            <button
              onClick={toggleDouble}
              disabled={saving || (!canDouble && !isDouble)}
              title={isDouble ? "Double pick ON — tap to remove" : doublesLeft > 0 ? `${doublesLeft} doubles left — tap to activate` : "All 3 doubles used"}
              style={{
                background: isDouble ? "rgba(245,158,11,0.15)" : "none",
                border: `1px solid ${isDouble ? "#f59e0b" : "#2d2b55"}`,
                borderRadius: 6, padding: "2px 8px", cursor: "pointer",
                color: isDouble ? "#f59e0b" : "#6b7280",
                fontSize: 10, fontWeight: 700,
                opacity: (!canDouble && !isDouble) ? 0.4 : 1,
                transition: "all 0.15s",
              }}
            >
              ⚡ {isDouble ? "2×" : "Double"}
            </button>
          )}

          {/* Status pill for settled predictions */}
          {statusPill && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
              background: statusPill.bg, color: "#fff",
            }}>
              {statusPill.label}
            </span>
          )}

          {/* Clear button */}
          {!locked && hasPred && (
            <button onClick={clear} disabled={saving}
              style={{
                marginLeft: "auto", background: "none", border: "none",
                color: "#4b5563", fontSize: 10, cursor: "pointer", padding: "2px 4px",
              }}
            >
              ×
            </button>
          )}

          {/* Save feedback */}
          {msg && (
            <span style={{ fontSize: 10, color: msg === "✓" ? "#4ade80" : "#f87171", marginLeft: msg && !hasPred ? "auto" : 0 }}>
              {msg === "✓" ? "✓ Saved" : "✗ Error"}
            </span>
          )}
        </div>
      )}

      {/* Number picker */}
      {activePicker && !locked && (
        <div style={{
          display: "flex", gap: 5, flexWrap: "wrap",
          paddingTop: 10,
          animation: "predPickerPop 0.1s ease",
        }}>
          {NUM_PICKER.map(n => (
            <button key={n} onClick={() => handlePickNumber(n)}
              style={{
                width: 34, height: 34,
                border: "1px solid #2d2b55", borderRadius: 7,
                background: "#1a1a2e", fontSize: 15, fontWeight: 700,
                color: "#e2e8f0", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {n}
            </button>
          ))}
        </div>
      )}

      <style>{`
        @keyframes predPickerPop {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
