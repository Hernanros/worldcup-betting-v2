import { useState, useEffect } from "react"
import { MOMENTS, ALL_MOMENT_KEYS } from "../data/moments.js"

// height accepts a number (px) or a CSS string (e.g. "max(220px, 30vw)")
// Default scales with viewport: ~220px on mobile, ~384px on 1280px desktop (≈3:1 ratio)
export default function PageHero({ momentKey, height = "max(220px, 30vw)", overlayOpacity = 0.93 }) {
  const isRotating = momentKey === "rotating"
  const [currentKey, setCurrentKey] = useState(() =>
    isRotating
      ? ALL_MOMENT_KEYS[Math.floor(Math.random() * ALL_MOMENT_KEYS.length)]
      : momentKey
  )

  useEffect(() => {
    if (!isRotating) return
    let i = 0
    const id = setInterval(() => {
      i = (i + 1) % ALL_MOMENT_KEYS.length
      setCurrentKey(ALL_MOMENT_KEYS[i])
    }, 5000)
    return () => clearInterval(id)
  }, [isRotating])

  const moment = MOMENTS[currentKey] ?? MOMENTS.maradona_1986

  return (
    <div style={{ height, position: "relative", overflow: "hidden", flexShrink: 0, maxWidth: 480, margin: "0 auto", width: "100%" }}>
      <img
        src={moment.imageUrl}
        alt={`${moment.title} — ${moment.subtitle}`}
        referrerPolicy="no-referrer"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: moment.position ?? "center 30%",
        }}
      />
      {/* gradient overlay */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: `linear-gradient(180deg,
          rgba(12,12,20,${(overlayOpacity * 0.4).toFixed(2)}) 0%,
          rgba(12,12,20,${overlayOpacity.toFixed(2)}) 100%)`,
      }} />
      {/* text */}
      <div style={{ position: "absolute", bottom: 12, left: 14, right: 14 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          background: "rgba(168,85,247,0.2)",
          border: "1px solid rgba(168,85,247,0.4)",
          borderRadius: 6, padding: "2px 8px",
          fontSize: 9, color: "#c4b5fd", fontWeight: 700, marginBottom: 4,
        }}>
          ⭐ Iconic Moment · {moment.year}
        </div>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>
          {moment.title}
        </div>
        <div style={{ fontSize: 10, color: "#a78bfa", marginTop: 2 }}>
          {moment.subtitle}
        </div>
      </div>
    </div>
  )
}
