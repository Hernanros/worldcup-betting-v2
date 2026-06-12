import { NavLink } from "react-router-dom"
import { HomeIcon, PredictIcon, CutsIcon, ChallengeIcon, RankIcon } from "./NavIcons.jsx"

const TABS = [
  { to: "/",           Icon: HomeIcon,       label: "Home"      },
  { to: "/predict",    Icon: PredictIcon,    label: "Predict"   },
  { to: "/deep-cuts",  Icon: CutsIcon,       label: "Cuts"      },
  { to: "/matches",    Icon: ChallengeIcon,  label: "Challenge" },
  { to: "/rankings",   Icon: RankIcon,       label: "Rank"      },
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
      {TABS.map(({ to, Icon, label }) => (
        <NavLink key={to} to={to} end={to === "/"} style={{ textDecoration: "none" }}>
          {({ isActive }) => (
            <div style={{ textAlign: "center", minWidth: 52, padding: "2px 0" }}>
              <Icon size={24} active={isActive} />
              <div style={{
                fontSize: 10,
                marginTop: 3,
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
