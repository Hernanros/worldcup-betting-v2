// Custom SVG nav icons — flat stroke, no defs/gradients (safe for React)
// Active color applied via the parent NavLink wrapper in BottomNav

export function HomeIcon({ size = 24, active = false }) {
  const c = active ? "#a855f7" : "#6b7280"
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Stadium arch */}
      <path d="M3 21 L3 10.5 Q3 4 12 4 Q21 4 21 10.5 L21 21" stroke={c} strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      {/* Centre line */}
      <line x1="3" y1="15" x2="21" y2="15" stroke={c} strokeWidth="1.3"/>
      {/* Centre circle */}
      <ellipse cx="12" cy="18.5" rx="3.5" ry="2" stroke={c} strokeWidth="1.3" fill="none"/>
      {/* Left goal */}
      <rect x="5" y="18.5" width="3" height="2.5" rx="0.5" stroke={c} strokeWidth="1.2" fill="none"/>
      {/* Right goal */}
      <rect x="16" y="18.5" width="3" height="2.5" rx="0.5" stroke={c} strokeWidth="1.2" fill="none"/>
    </svg>
  )
}

export function PredictIcon({ size = 24, active = false }) {
  const c = active ? "#a855f7" : "#6b7280"
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Outer circle */}
      <circle cx="12" cy="11.5" r="7.5" stroke={c} strokeWidth="1.8"/>
      {/* Inner ring */}
      <circle cx="12" cy="11.5" r="3.5" stroke={c} strokeWidth="1.2"/>
      {/* Centre dot */}
      <circle cx="12" cy="11.5" r="1" fill={c}/>
      {/* Crosshairs */}
      <line x1="12" y1="4" x2="12" y2="8" stroke={c} strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="12" y1="15" x2="12" y2="19" stroke={c} strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="4.5" y1="11.5" x2="8.5" y2="11.5" stroke={c} strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="15.5" y1="11.5" x2="19.5" y2="11.5" stroke={c} strokeWidth="1.2" strokeLinecap="round"/>
      {/* Stand */}
      <line x1="9" y1="21.5" x2="15" y2="21.5" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="12" y1="19" x2="12" y2="21.5" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export function CutsIcon({ size = 24, active = false }) {
  const c = active ? "#a855f7" : "#6b7280"
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Back card */}
      <rect x="4" y="3" width="12" height="16" rx="2" stroke={c} strokeWidth="1.6"/>
      {/* Front card (offset) */}
      <rect x="8" y="5" width="12" height="16" rx="2" stroke={c} strokeWidth="1.6" fill="#0d0d1a"/>
      {/* Diamond pip */}
      <path d="M14 9 L16.5 13 L14 17 L11.5 13 Z" stroke={c} strokeWidth="1.3" fill="none"/>
    </svg>
  )
}

export function ChallengeIcon({ size = 24, active = false }) {
  const c = active ? "#a855f7" : "#6b7280"
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Sword left */}
      <line x1="5" y1="5" x2="19" y2="19" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
      {/* Sword right */}
      <line x1="19" y1="5" x2="5" y2="19" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
      {/* Guard left sword */}
      <line x1="3" y1="9" x2="9" y2="3" stroke={c} strokeWidth="1.3" strokeLinecap="round"/>
      {/* Guard right sword */}
      <line x1="21" y1="9" x2="15" y2="3" stroke={c} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
}

export function RankIcon({ size = 24, active = false }) {
  const c = active ? "#a855f7" : "#6b7280"
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Cup */}
      <path d="M7 3 L17 3 L17 11 Q17 16 12 17 Q7 16 7 11 Z" stroke={c} strokeWidth="1.8" fill="none" strokeLinejoin="round"/>
      {/* Left handle */}
      <path d="M7 5 Q4 5 4 8 Q4 11 7 11" stroke={c} strokeWidth="1.4" fill="none" strokeLinecap="round"/>
      {/* Right handle */}
      <path d="M17 5 Q20 5 20 8 Q20 11 17 11" stroke={c} strokeWidth="1.4" fill="none" strokeLinecap="round"/>
      {/* Stem */}
      <line x1="12" y1="17" x2="12" y2="20.5" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
      {/* Base */}
      <line x1="8" y1="20.5" x2="16" y2="20.5" stroke={c} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}
