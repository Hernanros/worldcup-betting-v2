import { useState } from "react"
export default function GroupAdvanceMarket({ market, onSelect, selected }) {
  const picked = selected ? selected.split(",").map(s => s.trim()) : []
  const teams = market.teams || []
  function toggle(team) {
    let next
    if (picked.includes(team)) next = picked.filter(t => t !== team)
    else if (picked.length < 2) next = [...picked, team]
    else next = [picked[1], team]
    if (next.length === 2) onSelect([...next].sort().join(","), market.default_odds)
    else onSelect("", market.default_odds)
  }
  return (
    <div>
      <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>Pick 2 teams to advance from Group {market.group}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {teams.map(team => {
          const isSelected = picked.includes(team)
          return (
            <button key={team} onClick={() => toggle(team)} style={{
              padding: "8px 12px", borderRadius: 6, cursor: "pointer", textAlign: "left",
              border: isSelected ? "2px solid #1abc9c" : "1px solid #2d2b55",
              background: isSelected ? "rgba(26,188,156,0.15)" : "#1a1a2e",
              color: "#fff", fontSize: 13,
            }}>
              {team}{isSelected && <span style={{ float: "right", color: "#1abc9c" }}>✓</span>}
            </button>
          )
        })}
      </div>
      {picked.length === 2 && <div style={{ marginTop: 8, fontSize: 11, color: "#1abc9c" }}>✓ Advancing: {picked.join(" + ")}</div>}
    </div>
  )
}
