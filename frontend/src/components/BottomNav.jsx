import { NavLink } from "react-router-dom"

const tabs = [
  { to: "/", icon: "⚽", label: "Matches" },
  { to: "/bets", icon: "🏆", label: "Bets" },
  { to: "/predict", icon: "🎯", label: "Predict" },
  { to: "/rankings", icon: "📊", label: "Rankings" },
  { to: "/ai", icon: "🤖", label: "AI" },
]

export default function BottomNav() {
  return (
    <nav style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      background: "#13131f",
      borderTop: "1px solid #2d2b55",
      display: "flex",
      justifyContent: "space-around",
      padding: "8px 0",
      zIndex: 50,
    }}>
      {tabs.map(({ to, icon, label }) => (
        <NavLink key={to} to={to} end={to === "/"} style={{ textDecoration: "none" }}>
          {({ isActive }) => (
            <div style={{ textAlign: "center", minWidth: 56 }}>
              <div style={{ fontSize: 20 }}>{icon}</div>
              <div style={{
                fontSize: 10,
                fontWeight: isActive ? 700 : 400,
                background: isActive ? "linear-gradient(90deg, #a855f7, #3b82f6)" : undefined,
                backgroundClip: isActive ? "text" : undefined,
                WebkitBackgroundClip: isActive ? "text" : undefined,
                WebkitTextFillColor: isActive ? "transparent" : "#6b7280",
              }}>{label}</div>
            </div>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
