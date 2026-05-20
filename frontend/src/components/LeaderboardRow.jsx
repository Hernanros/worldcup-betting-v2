import { getPlayer } from "../auth.js"

export default function LeaderboardRow({ player, rank }) {
  const me = getPlayer()
  const isMe = me?.id === player.id

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
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: "#e2e8f0" }}>
          {player.name}{isMe && " (you)"}
        </div>
        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
          Streak: {player.challenge_streak} 🔥
        </div>
      </div>
      <div className="gradient-text" style={{ fontWeight: 800, fontSize: 16 }}>
        {player.token_balance.toLocaleString()}
      </div>
    </div>
  )
}
