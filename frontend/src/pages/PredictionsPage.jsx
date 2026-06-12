import { useState, useEffect } from "react"
import { api } from "../api.js"
import PredictionRow from "../components/PredictionRow.jsx"
import PageBackground from "../components/PageBackground.jsx"
import { ilDayLabel } from "../utils/time.js"

/* Group entries by date */
function groupByDay(entries) {
  const map = new Map()
  for (const e of entries) {
    const label = ilDayLabel(e.kickoff_time)
    if (!map.has(label)) map.set(label, [])
    map.get(label).push(e)
  }
  return [...map.entries()] // [[label, entries], ...]
}

/* Group entries by group letter (group-stage only), others go into "Knockout" */
function groupByGroup(entries) {
  const map = new Map()
  for (const e of entries) {
    const key = e.group ? `Group ${e.group}` : (e.round ? e.round.charAt(0).toUpperCase() + e.round.slice(1) : "Other")
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(e)
  }
  // Sort: Group A, B, C... then Knockout
  return [...map.entries()].sort(([a], [b]) => {
    const aIsGroup = a.startsWith("Group ")
    const bIsGroup = b.startsWith("Group ")
    if (aIsGroup && bIsGroup) return a < b ? -1 : 1
    if (aIsGroup) return -1
    if (bIsGroup) return 1
    return a < b ? -1 : 1
  })
}

/* ── Day section header ──────────────────────────────────────── */
function DayHeader({ label }) {
  const isToday = label === "Today"
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", margin: "14px 0 6px" }}>
      <span style={{
        background: isToday ? "rgba(96,165,250,0.18)" : "#1e2030",
        border: `1px solid ${isToday ? "rgba(96,165,250,0.4)" : "#2d2b55"}`,
        borderRadius: 999,
        padding: "4px 14px",
        fontSize: 11, fontWeight: 700,
        color: isToday ? "#60a5fa" : "#9ca3af",
        letterSpacing: 0.3,
      }}>
        {label}
      </span>
    </div>
  )
}

/* ── Group section (collapsible) ─────────────────────────────── */
function GroupSection({ label, entries, doublesUsed, onSaved }) {
  const [open, setOpen] = useState(true)
  const predicted = entries.filter(e => e.my_prediction).length
  const total = entries.length

  return (
    <div style={{ marginBottom: 8 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
          background: "#1a1a2e", border: "none",
          borderRadius: open ? "8px 8px 0 0" : 8,
          padding: "8px 12px", cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: "#a78bfa", textTransform: "uppercase", letterSpacing: 1 }}>
            {label}
          </span>
          <span style={{ fontSize: 9, color: "#4b5563" }}>
            {predicted}/{total} predicted
          </span>
        </div>
        <span style={{
          color: "#4b5563", fontSize: 12,
          transform: open ? "rotate(180deg)" : "none",
          transition: "transform 0.15s",
          display: "block",
        }}>▾</span>
      </button>
      {open && (
        <div style={{
          border: "1px solid #2d2b55", borderTop: "none",
          borderRadius: "0 0 8px 8px", padding: 6,
          background: "#13131f",
        }}>
          {entries.map(e => (
            <PredictionRow key={e.match_id} entry={e} doublesUsed={doublesUsed} onSaved={onSaved} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Main page ───────────────────────────────────────────────── */
export default function PredictionsPage() {
  const [entries, setEntries] = useState([])
  const [doublesUsed, setDoublesUsed] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [view, setView] = useState("chrono") // "chrono" | "group"

  const totalPoints = entries.reduce((acc, e) => acc + (e.my_prediction?.points_awarded || 0), 0)

  async function load() {
    setError(null)
    setLoading(true)
    try {
      const data = await api.get("/api/predictions")
      const safe = Array.isArray(data) ? data : []
      setEntries(safe)
      setDoublesUsed(safe.filter(e => e.my_prediction?.is_double).length)
    } catch (err) { setError(err.message || "Failed to load predictions") }
    finally { setLoading(false) }
  }

  function handleRowSaved(newDoublesCount) {
    if (newDoublesCount !== undefined) setDoublesUsed(newDoublesCount)
    load()
  }

  useEffect(() => { load() }, [])

  const chronoGroups = groupByDay(entries)
  const groupGroups  = groupByGroup(entries)

  return (
    <div>
      <PageBackground momentKey="italy_2006" />
      <div style={{ padding: "16px 16px 80px" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>🎯</span>
            <span style={{ color: "#e2e8f0", fontWeight: 800, fontSize: 19 }}>Predictions</span>
          </div>
          {totalPoints > 0 && (
            <span style={{
              background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.4)",
              borderRadius: 999, padding: "3px 11px",
              fontSize: 11, color: "#a78bfa", fontWeight: 700,
            }}>
              {totalPoints} pts
            </span>
          )}
        </div>

        {/* View toggle */}
        <div style={{
          display: "flex", background: "#1a1a2e", borderRadius: 8, padding: 3, gap: 2, marginBottom: 12,
        }}>
          {[
            { id: "chrono", label: "📅 By Date" },
            { id: "group",  label: "🗂 By Group" },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setView(id)} style={{
              flex: 1, padding: "6px 0", borderRadius: 6, border: "none",
              background: view === id ? "#2d2b55" : "transparent",
              color: view === id ? "#e2e8f0" : "#6b7280",
              fontSize: 11, fontWeight: 700, cursor: "pointer",
              transition: "all 0.15s",
            }}>
              {label}
            </button>
          ))}
        </div>

        {/* Doubles pill */}
        <div style={{
          display: "flex", justifyContent: "flex-end", marginBottom: 6,
        }}>
          <span style={{ fontSize: 10, color: doublesUsed >= 3 ? "#f59e0b" : "#4b5563" }}>
            ⚡ {doublesUsed}/3 doubles used
          </span>
        </div>

        {/* ── Loading skeleton ── */}
        {loading && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ color: "#6b7280", fontSize: 13 }}>Loading predictions…</div>
          </div>
        )}

        {/* ── Error state ── */}
        {!loading && error && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
            <div style={{ color: "#f87171", fontSize: 14, marginBottom: 16 }}>{error}</div>
            <button onClick={load} style={{
              background: "linear-gradient(135deg,#a855f7,#3b82f6)", color: "#fff",
              border: "none", borderRadius: 10, padding: "10px 24px",
              fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}>Retry</button>
          </div>
        )}

        {/* ── Chrono view ── */}
        {!loading && !error && view === "chrono" && (
          <>
            {chronoGroups.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🎯</div>
                <div style={{ color: "#6b7280", fontSize: 13 }}>No matches to predict yet — check back soon.</div>
              </div>
            )}
            {chronoGroups.map(([label, dayEntries]) => (
              <div key={label}>
                <DayHeader label={label} />
                {dayEntries.map(e => (
                  <PredictionRow key={e.match_id} entry={e} doublesUsed={doublesUsed} onSaved={handleRowSaved} />
                ))}
              </div>
            ))}
          </>
        )}

        {/* ── Group view ── */}
        {!loading && !error && view === "group" && (
          <>
            {groupGroups.map(([label, groupEntries]) => (
              <GroupSection
                key={label}
                label={label}
                entries={groupEntries}
                doublesUsed={doublesUsed}
                onSaved={handleRowSaved}
              />
            ))}
          </>
        )}

      </div>
    </div>
  )
}
