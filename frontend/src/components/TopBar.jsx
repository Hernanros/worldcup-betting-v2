import { useEffect } from "react"
import { subscribe } from "../ws.js"
import { api } from "../api.js"

export default function TopBar({ balance, onBalanceChange }) {
  useEffect(() => {
    const unsub = subscribe(async (event) => {
      if (event.type === "leaderboard_updated" || event.type === "match_settled") {
        const me = await api.get("/api/players/me").catch(() => null)
        if (me) onBalanceChange(me.token_balance)
      }
    })
    return unsub
  }, [onBalanceChange])

  return (
    <header style={{
      background: "#13131f",
      borderBottom: "1px solid #2d2b55",
      padding: "10px 16px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      position: "sticky",
      top: 0,
      zIndex: 50,
    }}>
      <span className="gradient-text" style={{ fontWeight: 800, fontSize: 16 }}>
        ⚡ WC Bets 2026
      </span>
      <span style={{
        background: "linear-gradient(135deg, #a855f7, #3b82f6)",
        color: "#fff",
        fontSize: 12,
        padding: "3px 10px",
        borderRadius: 999,
        fontWeight: 700,
      }}>
        {balance.toLocaleString()} tokens
      </span>
    </header>
  )
}
