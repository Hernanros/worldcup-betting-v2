import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { flagUrl } from "../data/teams.js"
import { ilDateTime } from "../utils/time.js"

function TeamFlag({ name, size = 36 }) {
  const url = flagUrl(name, 40)
  if (!url) return <span style={{ fontSize: size }}>🏳️</span>
  return (
    <img
      src={url}
      alt={name}
      width={size}
      height={size * 0.67}
      style={{ objectFit: "cover", borderRadius: 3, display: "block" }}
      onError={(e) => { e.target.style.display = "none" }}
    />
  )
}

function formatKickoff(iso) {
  return ilDateTime(iso)
}

export default function MatchCard({ match }) {
  const isLive = match.status === "locked" && match.home_score !== null
  const isFinished = match.status === "finished"
  const hasScore = match.home_score !== null && match.away_score !== null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.98 }}
    >
      <Link to={`/matches/${match.id}`} style={{ textDecoration: "none" }}>
        <div style={{
          background: "#13131f",
          border: "1px solid #2d2b55",
          borderRadius: 12,
          padding: "14px 16px",
          marginBottom: 10,
          boxShadow: isLive ? "0 0 20px rgba(168,85,247,0.12)" : "none",
        }}>
          {/* Status row */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
            {isLive && (
              <span style={{ color: "#ef4444", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ animation: "pulse 1.5s infinite" }}>●</span> LIVE
              </span>
            )}
            {isFinished && <span style={{ color: "#6b7280", fontSize: 10, fontWeight: 700 }}>FINISHED</span>}
            {!isLive && !isFinished && (
              <span style={{ color: "#6b7280", fontSize: 10 }}>{formatKickoff(match.kickoff_time)}</span>
            )}
          </div>

          {/* Teams + score row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ textAlign: "center", flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <TeamFlag name={match.home_team} size={36} />
              <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", marginTop: 4 }}>{match.home_team}</div>
              {hasScore && (
                <div className="gradient-text" style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>
                  {match.home_score}
                </div>
              )}
            </div>

            <div style={{ textAlign: "center", padding: "0 12px", color: "#6b7280", fontSize: 12 }}>
              {hasScore ? "—" : "vs"}
            </div>

            <div style={{ textAlign: "center", flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <TeamFlag name={match.away_team} size={36} />
              <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", marginTop: 4 }}>{match.away_team}</div>
              {hasScore && (
                <div className="gradient-text" style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>
                  {match.away_score}
                </div>
              )}
            </div>
          </div>

          {/* Round badge + challenge count */}
          <div style={{ textAlign: "center", marginTop: 10, display: "flex", gap: 6, justifyContent: "center" }}>
            <span style={{
              background: "#1e1b3a", border: "1px solid #2d2b55",
              color: "#a78bfa", fontSize: 9, fontWeight: 700,
              padding: "2px 8px", borderRadius: 999, textTransform: "uppercase", letterSpacing: 1,
            }}>
              {match.round}
            </span>
            {match.challenge_count > 0 && (
              <span style={{
                background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.4)",
                color: "#c4b5fd", fontSize: 9, fontWeight: 700,
                padding: "2px 8px", borderRadius: 999,
              }}>
                ⚔️ {match.challenge_count} open
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
