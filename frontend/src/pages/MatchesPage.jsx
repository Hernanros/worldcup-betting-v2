import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../api.js"
import { subscribe } from "../ws.js"
import MatchCard from "../components/MatchCard.jsx"
import PageBackground from "../components/PageBackground.jsx"
import { ilDayLabel } from "../utils/time.js"

/* Group matches by Israel-timezone date label */
function groupByDate(matches) {
  const map = new Map()
  for (const m of matches) {
    const label = ilDayLabel(m.kickoff_time)
    if (!map.has(label)) map.set(label, [])
    map.get(label).push(m)
  }
  return [...map.entries()]
}

/* Find the key of the earliest upcoming/live date group */
function nearestOpenKey(groups) {
  for (const [label, matches] of groups) {
    if (matches.some(m => m.status === "upcoming" || (m.status === "locked" && m.home_score !== null)))
      return label
  }
  return groups[0]?.[0] ?? null
}

function DateGroup({ label, matches, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)
  const live = matches.some(m => m.status === "locked" && m.home_score !== null)
  const today = label === "Today"

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
          {live && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ef4444", display: "inline-block", flexShrink: 0 }} />}
          <span style={{ fontSize: 10, fontWeight: 800, color: today ? "#60a5fa" : "#a78bfa", textTransform: "uppercase", letterSpacing: 1 }}>
            {label}
          </span>
          <span style={{ fontSize: 9, color: "#4b5563" }}>{matches.length} match{matches.length > 1 ? "es" : ""}</span>
        </div>
        <span style={{ color: "#4b5563", fontSize: 12, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s", display: "block" }}>▾</span>
      </button>
      {open && (
        <div style={{ border: "1px solid #2d2b55", borderTop: "none", borderRadius: "0 0 8px 8px", padding: "6px 6px 2px", background: "#13131f" }}>
          {matches.map(m => <MatchCard key={m.id} match={m} />)}
        </div>
      )}
    </div>
  )
}

export default function MatchesPage() {
  const navigate = useNavigate()
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load() {
    setError(null)
    try {
      const data = await api.get("/api/matches")
      setMatches(data)
    } catch (err) {
      setError(err.message || "Failed to load matches")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const unsub = subscribe(e => {
      if (e.type === "match_settled" || e.type === "score_update") load()
    })
    return unsub
  }, [])

  const groups = groupByDate(matches.filter(m => m.kickoff_time))
  const openKey = nearestOpenKey(groups)

  return (
    <div>
      <PageBackground momentKey="maradona_1986" />
      <div style={{ padding: "16px 16px 80px" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ color: "#e2e8f0", fontWeight: 800, fontSize: 20 }}>⚔️ Challenge</div>
          {/* Tournament shortcuts */}
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => navigate("/tournament?tab=groups")} style={{
              background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.3)",
              borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700,
              color: "#c4b5fd", cursor: "pointer",
            }}>📊 Groups</button>
            <button onClick={() => navigate("/tournament?tab=bracket")} style={{
              background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.3)",
              borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700,
              color: "#93c5fd", cursor: "pointer",
            }}>🗺 Bracket</button>
          </div>
        </div>

        {loading && <p style={{ color: "#6b7280", textAlign: "center" }}>Loading…</p>}
        {error   && <p style={{ color: "#f87171", textAlign: "center", fontSize: 13 }}>⚠ {error}</p>}

        {!loading && !error && (
          groups.length === 0
            ? <p style={{ color: "#6b7280", textAlign: "center" }}>No matches found.</p>
            : groups.map(([label, dayMatches]) => (
                <DateGroup
                  key={label}
                  label={label}
                  matches={dayMatches}
                  defaultOpen={label === openKey}
                />
              ))
        )}
      </div>
    </div>
  )
}
