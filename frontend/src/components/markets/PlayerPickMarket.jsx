import { useState } from "react"

/**
 * Searchable player dropdown for markets that supply a `players` array.
 * Falls back to free-text if the player isn't in the list (101× odds).
 */
export default function PlayerPickMarket({ market, onSelect, selected }) {
  const [search, setSearch]         = useState("")
  const [localSelected, setLocal]   = useState(selected || "")

  const players = market.players || []

  const filtered = search.length >= 1
    ? players.filter(p => p.toLowerCase().includes(search.toLowerCase()))
    : players.slice(0, 10)

  function pick(name) {
    setLocal(name)
    setSearch("")
    onSelect(name, market.default_odds)
  }

  function clear() {
    setLocal("")
    onSelect("", market.default_odds)
  }

  return (
    <div>
      {localSelected ? (
        <div style={{ padding: "8px 10px", background: "rgba(26,188,156,0.1)",
          border: "1px solid #1abc9c", borderRadius: 6, fontSize: 12,
          color: "#1abc9c", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>✓ {localSelected}</span>
          <button onClick={clear} style={{ background: "none", border: "none",
            color: "#6b7280", cursor: "pointer", fontSize: 11, padding: 0 }}>
            ✕ change
          </button>
        </div>
      ) : (
        <input
          placeholder="Search player…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: "100%", padding: "8px 10px", borderRadius: 8,
            border: "1px solid #2d2b55", background: "#0d1117", color: "#fff",
            fontSize: 13, boxSizing: "border-box", marginBottom: 6 }}
        />
      )}

      {!localSelected && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3,
          maxHeight: 200, overflowY: "auto" }}>
          {filtered.map(p => (
            <button key={p} onClick={() => pick(p)} style={{
              padding: "7px 10px", borderRadius: 6, cursor: "pointer",
              textAlign: "left", border: "1px solid #2d2b55",
              background: "#1a1a2e", color: "#ccc", fontSize: 12,
            }}>
              {p}
            </button>
          ))}
          {search.length >= 2 && filtered.length === 0 && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
              <span style={{ color: "#888", fontSize: 11, flex: 1 }}>
                Not in list — adds at 101× odds
              </span>
              <button onClick={() => pick(search.trim())} style={{
                padding: "6px 12px", borderRadius: 6, cursor: "pointer",
                border: "1px solid #2d2b55", background: "#1a1a2e",
                color: "#a78bfa", fontSize: 12, fontWeight: 700,
              }}>
                Pick "{search.trim()}"
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
