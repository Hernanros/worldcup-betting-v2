import { useState } from "react"

/**
 * Searchable player dropdown for markets that supply a `players` array.
 *
 * UX split:
 *  - No search typed   → show POPULAR_PLAYERS as a quick-pick grid
 *  - Search typed       → filter from the FULL player list (popular + everyone else)
 *  - Not in list        → free-text fallback at 101× odds
 */

// The ~30 household names shown in the quick-pick grid.
// Everyone else is search-only (no clutter, still fully accessible).
const POPULAR_PLAYERS = [
  "Lionel Messi",
  "Cristiano Ronaldo",
  "Kylian Mbappé",
  "Erling Haaland",
  "Vinicius Jr",
  "Neymar Jr",
  "Harry Kane",
  "Mohamed Salah",
  "Son Heung-min",
  "Jude Bellingham",
  "Phil Foden",
  "Bukayo Saka",
  "Pedri",
  "Luka Modrić",
  "Kevin De Bruyne",
  "Virgil van Dijk",
  "Julián Álvarez",
  "Federico Valverde",
  "Darwin Núñez",
  "Robert Lewandowski",
  "Alphonso Davies",
  "Victor Osimhen",
  "Christian Pulisic",
  "Bruno Fernandes",
  "Bernardo Silva",
  "Antoine Griezmann",
  "Florian Wirtz",
  "Sadio Mané",
  "Achraf Hakimi",
  "Rodri",
]

export default function PlayerPickMarket({ market, onSelect, selected }) {
  const [search, setSearch]       = useState("")
  const [localSelected, setLocal] = useState(selected || "")

  const allPlayers = market.players || []

  // Searching: filter all 264 players. Idle: show popular shortlist.
  const showingSearch = search.length >= 1
  const filtered = showingSearch
    ? allPlayers.filter(p => p.toLowerCase().includes(search.toLowerCase()))
    : []

  function pick(name) {
    setLocal(name)
    setSearch("")
    onSelect(name, market.default_odds)
  }

  function clear() {
    setLocal("")
    onSelect("", market.default_odds)
  }

  if (localSelected) {
    return (
      <div style={{
        padding: "8px 10px", background: "rgba(26,188,156,0.1)",
        border: "1px solid #1abc9c", borderRadius: 6, fontSize: 12,
        color: "#1abc9c", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span>✓ {localSelected}</span>
        <button onClick={clear} style={{
          background: "none", border: "none",
          color: "#6b7280", cursor: "pointer", fontSize: 11, padding: 0,
        }}>
          ✕ change
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Search input */}
      <input
        placeholder="Search any player…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width: "100%", padding: "8px 10px", borderRadius: 8,
          border: "1px solid #2d2b55", background: "#0d1117", color: "#fff",
          fontSize: 13, boxSizing: "border-box", marginBottom: 8,
        }}
      />

      {/* Search results */}
      {showingSearch && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 200, overflowY: "auto" }}>
          {filtered.map(p => (
            <button key={p} onClick={() => pick(p)} style={{
              padding: "7px 10px", borderRadius: 6, cursor: "pointer",
              textAlign: "left", border: "1px solid #2d2b55",
              background: "#1a1a2e", color: "#ccc", fontSize: 12,
            }}>
              {p}
            </button>
          ))}
          {filtered.length === 0 && search.length >= 2 && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
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

      {/* Popular quick-pick grid (shown only when not searching) */}
      {!showingSearch && (
        <>
          <div style={{ color: "#4b5563", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>
            ⭐ Popular picks
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {POPULAR_PLAYERS.filter(p => allPlayers.includes(p)).map(p => (
              <button key={p} onClick={() => pick(p)} style={{
                padding: "5px 10px", borderRadius: 6, cursor: "pointer",
                border: "1px solid #2d2b55", background: "#1a1a2e",
                color: "#c4b5fd", fontSize: 11, fontWeight: 600,
                whiteSpace: "nowrap",
              }}>
                {p}
              </button>
            ))}
          </div>
          <div style={{ color: "#4b5563", fontSize: 10, marginTop: 8, textAlign: "center" }}>
            All other players available via search ↑
          </div>
        </>
      )}
    </div>
  )
}
