import { useState, useEffect } from "react"
import { MOMENTS, ALL_MOMENT_KEYS } from "../data/moments.js"

/**
 * Compact page header: left = icon + title, right = 72×96px portrait image card.
 * Portrait ratio crops WC images far better than the wide strip PageHero.
 */
export default function PageHeader({ momentKey, title, icon, subtitle }) {
  const isRotating = momentKey === "rotating"
  const [currentKey, setCurrentKey] = useState(() =>
    isRotating
      ? ALL_MOMENT_KEYS[Math.floor(Math.random() * ALL_MOMENT_KEYS.length)]
      : momentKey
  )

  useEffect(() => {
    if (!isRotating) return
    let i = ALL_MOMENT_KEYS.indexOf(currentKey)
    if (i === -1) i = 0
    const id = setInterval(() => {
      i = (i + 1) % ALL_MOMENT_KEYS.length
      setCurrentKey(ALL_MOMENT_KEYS[i])
    }, 5000)
    return () => clearInterval(id)
  }, [isRotating]) // eslint-disable-line react-hooks/exhaustive-deps

  const moment = MOMENTS[currentKey] ?? MOMENTS.maradona_1986

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "14px 16px 10px",
      maxWidth: 480,
      margin: "0 auto",
      width: "100%",
    }}>
      {/* Left: icon + title */}
      <div>
        <div style={{ fontSize: 28, lineHeight: 1 }}>{icon}</div>
        <div style={{
          color: "#e2e8f0", fontWeight: 800, fontSize: 20, marginTop: 4, lineHeight: 1.1,
        }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ color: "#6b7280", fontSize: 11, marginTop: 3 }}>{subtitle}</div>
        )}
      </div>

      {/* Right: portrait image card */}
      <div style={{
        width: 72,
        height: 96,
        borderRadius: 10,
        overflow: "hidden",
        border: "1px solid #2d2b55",
        flexShrink: 0,
        position: "relative",
      }}>
        <img
          src={moment.imageUrl}
          alt={`${moment.title} — ${moment.subtitle}`}
          referrerPolicy="no-referrer"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: moment.position ?? "center 30%",
          }}
        />
        {/* year label at bottom */}
        <div style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "6px 5px 4px",
          background: "linear-gradient(0deg, rgba(12,12,20,0.92) 0%, transparent 100%)",
        }}>
          <div style={{
            color: "#c4b5fd", fontSize: 9, fontWeight: 700, lineHeight: 1,
          }}>
            {moment.year}
          </div>
        </div>
      </div>
    </div>
  )
}
