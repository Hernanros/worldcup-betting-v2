import { useState, useEffect } from "react"
import { api } from "../api.js"
import { subscribe } from "../ws.js"
import MatchCard from "../components/MatchCard.jsx"

const FILTERS = ["All", "Live", "Upcoming", "Finished"]

export default function MatchesPage() {
  const [matches, setMatches] = useState([])
  const [filter, setFilter] = useState("All")
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
    const unsub = subscribe((e) => {
      if (e.type === "match_settled" || e.type === "score_update") load()
    })
    return unsub
  }, [])

  const filtered = matches.filter((m) => {
    if (filter === "All") return true
    if (filter === "Live") return m.status === "locked" && m.home_score !== null
    if (filter === "Upcoming") return m.status === "upcoming"
    if (filter === "Finished") return m.status === "finished"
    return true
  })

  return (
    <div style={{ padding: 16 }}>
      {/* Filter pills */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto" }}>
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              background: filter === f ? "linear-gradient(135deg,#a855f7,#3b82f6)" : "#1e1b3a",
              color: filter === f ? "#fff" : "#6b7280",
              border: "none",
              borderRadius: 999,
              padding: "5px 14px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: "#6b7280", textAlign: "center" }}>Loading matches...</p>}
      {error && <p style={{ color: "#f87171", textAlign: "center", fontSize: 13 }}>⚠ {error}</p>}
      {!loading && !error && filtered.length === 0 && (
        <p style={{ color: "#6b7280", textAlign: "center" }}>No matches found.</p>
      )}
      {filtered.map((m) => <MatchCard key={m.id} match={m} />)}
    </div>
  )
}
