import { useState } from "react"

export default function TeamPickMarket({ market, teams = [], onSelect, selected }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const filtered = teams.filter(t => t.toLowerCase().includes(query.toLowerCase()))

  function pick(team) {
    onSelect(team, market.default_odds)
    setOpen(false)
    setQuery("")
  }

  return (
    <div>
      {/* Trigger button — shows selected or "Pick a team" */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "9px 12px", borderRadius: open ? "8px 8px 0 0" : 8,
          border: selected ? "2px solid #1abc9c" : "1px solid #2d2b55",
          background: selected ? "rgba(26,188,156,0.1)" : "#0d1117",
          color: selected ? "#1abc9c" : "#9ca3af",
          fontSize: 13, fontWeight: selected ? 700 : 400, cursor: "pointer",
        }}
      >
        <span>{selected ?? "Pick a team…"}</span>
        <span style={{ color: "#4b5563", fontSize: 11,
          transform: open ? "rotate(180deg)" : "none", transition: "transform 0.12s" }}>▾</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          border: "1px solid #2d2b55", borderTop: "none", borderRadius: "0 0 8px 8px",
          background: "#0d1117", padding: 8,
        }}>
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search…"
            style={{
              width: "100%", padding: "6px 10px", borderRadius: 6,
              border: "1px solid #2d2b55", background: "#13131f",
              color: "#fff", fontSize: 12, marginBottom: 6, boxSizing: "border-box",
            }}
          />
          <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
            {filtered.length === 0 && (
              <div style={{ color: "#4b5563", fontSize: 11, padding: "6px 0", textAlign: "center" }}>No teams match</div>
            )}
            {filtered.map(team => (
              <button key={team} onClick={() => pick(team)} style={{
                padding: "8px 12px", borderRadius: 6, cursor: "pointer", textAlign: "left",
                border: selected === team ? "2px solid #1abc9c" : "1px solid #2d2b55",
                background: selected === team ? "rgba(26,188,156,0.15)" : "#1a1a2e",
                color: "#fff", fontSize: 13, display: "flex", justifyContent: "space-between",
              }}>
                {team}
                {selected === team && <span style={{ color: "#1abc9c" }}>✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
