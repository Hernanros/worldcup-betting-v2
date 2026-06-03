import { useState } from "react"
export default function TeamPickMarket({ market, teams = [], onSelect, selected }) {
  const [query, setQuery] = useState("")
  const filtered = teams.filter(t => t.toLowerCase().includes(query.toLowerCase()))
  return (
    <div>
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search team…" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #2d2b55", background: "#0d1117", color: "#fff", fontSize: 13, marginBottom: 8, boxSizing: "border-box" }} />
      <div style={{ maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
        {filtered.map(team => (
          <button key={team} onClick={() => onSelect(team, market.default_odds)} style={{
            padding: "8px 12px", borderRadius: 6, cursor: "pointer", textAlign: "left",
            border: selected === team ? "2px solid #1abc9c" : "1px solid #2d2b55",
            background: selected === team ? "rgba(26,188,156,0.15)" : "#1a1a2e",
            color: "#fff", fontSize: 13,
          }}>
            {team}{selected === team && <span style={{ float: "right", color: "#1abc9c" }}>✓</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
