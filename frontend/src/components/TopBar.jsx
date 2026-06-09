import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { subscribe } from "../ws.js"
import { api } from "../api.js"
import { getPlayer, getLeague } from "../auth.js"
import GroupSwitcher from "./GroupSwitcher.jsx"

export default function TopBar({ balance, onBalanceChange }) {
  const navigate = useNavigate()
  const onBalanceChangeRef = useRef(onBalanceChange)
  useEffect(() => { onBalanceChangeRef.current = onBalanceChange })

  const [showSwitcher, setShowSwitcher] = useState(false)
  const closeSwitcher = () => setShowSwitcher(false)

  useEffect(() => {
    const unsub = subscribe(async (event) => {
      if (event.type === "leaderboard_updated" || event.type === "match_settled") {
        const me = await api.get("/api/players/me").catch(() => null)
        if (me) onBalanceChangeRef.current(me.token_balance)
      }
    })
    return unsub
  }, [])

  const player = getPlayer()
  const league = getLeague()

  return (
    <>
      <header style={{
        background: "#13131f",
        borderBottom: "1px solid #2d2b55",
        padding: "8px 16px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        position: "sticky",
        top: 0,
        zIndex: 50,
        gap: 8,
      }}>
        {/* Left: app name + league */}
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <span className="gradient-text" style={{ fontWeight: 800, fontSize: 15, lineHeight: 1.2 }}>
            ⚡ WC Bets 2026
          </span>
          {league && (
            <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 600, letterSpacing: 0.3, marginTop: 1 }}>
              🏆 {league.name}
            </span>
          )}
        </div>

        {/* Right: balance + player name + buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
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

          {player && (
            <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, maxWidth: 72,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {player.name}
            </span>
          )}

          <button
            onClick={() => navigate("/help")}
            title="Help"
            style={{ background: "none", border: "1px solid #374151", borderRadius: 6, padding: "4px 8px", color: "#6b7280", fontSize: 13, cursor: "pointer" }}
          >
            ❓
          </button>

          {player?.is_admin && (
            <button onClick={() => navigate("/admin")} title="Admin — manage groups"
              style={{ background: "none", border: "1px solid #374151", borderRadius: 6,
                color: "#a78bfa", fontSize: 13, padding: "3px 7px", cursor: "pointer" }}>
              ⚙️
            </button>
          )}

          <button
            onClick={() => setShowSwitcher(true)}
            title="Switch group"
            style={{
              background: "none",
              border: "1px solid #374151",
              borderRadius: 6,
              color: "#6b7280",
              fontSize: 11,
              padding: "3px 8px",
              cursor: "pointer",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            ⇄
          </button>
        </div>
      </header>

      <GroupSwitcher
        open={showSwitcher}
        onClose={closeSwitcher}
      />
    </>
  )
}
