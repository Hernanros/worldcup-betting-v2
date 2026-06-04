import { useState } from "react"
import { flagUrl } from "../../data/teams.js"

function TeamFlag({ name }) {
  const [err, setErr] = useState(false)
  const url = flagUrl(name, 32)
  if (err || !url) return null
  return (
    <img
      src={url}
      alt={name}
      onError={() => setErr(true)}
      width={22}
      height={15}
      style={{ borderRadius: 2, objectFit: "cover", flexShrink: 0 }}
    />
  )
}

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
      <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>
        Pick 2 teams to advance from Group {market.group}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {teams.map(team => {
          const isSelected = picked.includes(team)
          return (
            <button key={team} onClick={() => toggle(team)} style={{
              padding: "8px 12px", borderRadius: 6, cursor: "pointer",
              border: isSelected ? "2px solid #1abc9c" : "1px solid #2d2b55",
              background: isSelected ? "rgba(26,188,156,0.15)" : "#1a1a2e",
              color: "#fff", fontSize: 13,
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <TeamFlag name={team} />
              <span style={{ flex: 1, textAlign: "left" }}>{team}</span>
              {isSelected && <span style={{ color: "#1abc9c", fontSize: 12 }}>✓</span>}
            </button>
          )
        })}
      </div>
      {picked.length === 2 && (
        <div style={{ marginTop: 8, fontSize: 11, color: "#1abc9c" }}>
          ✓ Advancing: {picked.join(" + ")}
        </div>
      )}
    </div>
  )
}
