import { NavLink } from "react-router-dom"
import { getLeague } from "../auth.js"

const TABS = [
  { to: "/",            icon: "🏠", label: "Home"    },
  { to: "/matches",     icon: "⚽", label: "Matches" },
  { to: "/predict",     icon: "🎯", label: "Predict" },
  { to: "/deep-cuts",   icon: "🔪", label: "Cuts"    },
  { to: "/rankings",    icon: "📊", label: "Rank"    },
]

export default function BottomNav() {
  return (
    <nav style={{
      position: "fixed",
      bottom: 0, left: 0, right: 0,
      background: "#13131f",
      borderTop: "1px solid #2d2b55",
      display: "flex",
      justifyContent: "space-around",
      padding: "6px 0 8px",
      zIndex: 50,
    }}>
      {TABS.map(({ to, icon, label }) => (
        <NavLink key={to} to={to} end={to === "/"} style={{ textDecoration: "none" }}>
          {({ isActive }) => (
            <div style={{ textAlign: "center", minWidth: 52, padding: "2px 0" }}>
              <div style={{ fontSize: 22 }}>{icon}</div>
              <div style={{
                fontSize: 11,
                marginTop: 2,
                fontWeight: isActive ? 700 : 500,
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
