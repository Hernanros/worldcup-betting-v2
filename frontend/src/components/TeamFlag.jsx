/**
 * Shared circular team flag badge used across the app.
 * Swap to custom crests by populating TEAM_LOGOS in data/teams.js.
 */
import { teamLogoUrl } from "../data/teams.js"

export default function TeamFlag({ name, size = 32 }) {
  const url = teamLogoUrl(name, size * 2)
  if (!url) return null
  return (
    <div style={{
      width: size, height: size,
      borderRadius: "50%", overflow: "hidden", flexShrink: 0,
      border: "1.5px solid rgba(255,255,255,0.12)",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      verticalAlign: "middle",
    }}>
      <img
        src={url} alt={name}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        onError={e => { e.target.parentElement.style.display = "none" }}
      />
    </div>
  )
}
