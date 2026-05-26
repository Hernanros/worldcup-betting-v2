import { useState, useEffect } from "react"
import { MOMENTS, ALL_MOMENT_KEYS } from "../data/moments.js"

/**
 * Full-viewport fixed background image — renders behind all page content.
 * Use momentKey="rotating" for 5-second cycling.
 */
export default function PageBackground({ momentKey }) {
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
    <>
      <img
        src={moment.imageUrl}
        alt=""
        aria-hidden="true"
        referrerPolicy="no-referrer"
        style={{
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: moment.position ?? "center 30%",
          zIndex: -1,
        }}
      />
      <div style={{
        position: "fixed",
        inset: 0,
        background: "rgba(12,12,20,0.88)",
        zIndex: -1,
      }} />
    </>
  )
}
