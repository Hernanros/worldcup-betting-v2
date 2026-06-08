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
  // Use local state so intermediate picks (1 team) don't reset button highlights.
  // Parent only receives a value when 2 teams are chosen (a valid selection).
  const [localPicked, setLocalPicked] = useState(
    selected ? selected.split(",").map(s => s.trim()) : []
  )
  const teams = market.teams || []

  function toggle(team) {
    let next
    if (localPicked.includes(team)) next = localPicked.filter(t => t !== team)
    else if (localPicked.length < 2) next = [...localPicked, team]
    else next = [localPicked[1], team]
    setLocalPicked(next)
    if (next.length === 2) onSelect([...next].sort().join(","), market.default_odds)
    else onSelect("", market.default_odds) // clears parent lock-in button until 2 picked
  }

  return (
    <div>
      <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>
        Pick 2 teams to advance from Group {market.group}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {teams.map(team => {
          const isSelected = localPicked.includes(team)
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
      {localPicked.length === 1 && (
        <div style={{ marginTop: 8, fontSize: 11, color: "#f59e0b" }}>
          Pick one more team to advance ↑
        </div>
      )}
      {localPicked.length === 2 && (
        <div style={{ marginTop: 8, fontSize: 11, color: "#1abc9c" }}>
          ✓ Advancing: {localPicked.join(" + ")}
        </div>
      )}
    </div>
  )
}
