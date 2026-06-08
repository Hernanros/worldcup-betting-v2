import { getPlayer } from "../auth.js"

export default function LeaderboardRow({ player, rank }) {
  const me = getPlayer()
  const isMe = me?.id === player.id
  const isBot = player.is_bot

  // Bot gets its own neutral styling — clearly different, not competing
  if (isBot) {
    return (
      <div style={{
        background: "#0f0f1a",
        border: "1px dashed #2d2b55",
        borderRadius: 10,
        padding: "10px 16px",
        marginBottom: 8,
        display: "flex",
        alignItems: "center",
        gap: 14,
        opacity: 0.75,
      }}>
        <span style={{ fontSize: 14, minWidth: 28, color: "#4b5563", fontWeight: 800 }}>
          #{rank}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: "#6b7280",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            display: "flex", alignItems: "center", gap: 5 }}>
            {player.name}
            <span style={{
              fontSize: 8, fontWeight: 700, color: "#4b5563",
              background: "#1a1a2e", border: "1px solid #2d2b55",
              borderRadius: 3, padding: "1px 5px", textTransform: "uppercase",
              letterSpacing: 0.5,
            }}>
              benchmark
            </span>
          </div>
          <div style={{ fontSize: 10, color: "#4b5563", marginTop: 2 }}>
            random guesser · {player.prediction_pts > 0 ? `🎯 ${player.prediction_pts} pts` : "no points yet"}
          </div>
        </div>
        <div style={{ fontWeight: 700, fontSize: 15, color: "#4b5563" }}>
          {player.token_balance.toLocaleString()}
        </div>
      </div>
    )
  }

  return (
    <div style={{
      background: isMe ? "linear-gradient(135deg, rgba(168,85,247,0.1), rgba(59,130,246,0.1))" : "#13131f",
      border: `1px solid ${isMe ? "#a855f7" : "#2d2b55"}`,
      borderRadius: 10,
      padding: "12px 16px",
      marginBottom: 8,
      display: "flex",
      alignItems: "center",
      gap: 14,
    }}>
      <span style={{
        fontSize: rank <= 3 ? 20 : 14,
        fontWeight: 800,
        color: rank === 1 ? "#fbbf24" : rank === 2 ? "#9ca3af" : rank === 3 ? "#cd7c2f" : "#6b7280",
        minWidth: 28,
      }}>
        {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: "#e2e8f0",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {player.name}{isMe && " (you)"}
        </div>
        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2, display: "flex", gap: 8 }}>
          <span>🔥 {player.challenge_streak} streak</span>
          {player.prediction_pts > 0 && (
            <span style={{ color: "#a78bfa" }}>🎯 {player.prediction_pts} pts</span>
          )}
        </div>
      </div>
      <div className="gradient-text" style={{ fontWeight: 800, fontSize: 16 }}>
        {player.token_balance.toLocaleString()}
      </div>
    </div>
  )
}
