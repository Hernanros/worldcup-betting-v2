import { useState, useRef } from "react"

/**
 * Tap-to-reveal help tooltip.
 *
 * Uses position:fixed so it is never clipped by overflow:auto/hidden ancestors
 * (e.g. horizontally-scrollable tab bars). Coordinates come from
 * getBoundingClientRect(), clamped to viewport edges.
 */
export default function HelpTip({ text }) {
  const [show, setShow]     = useState(false)
  const [pos,  setPos]      = useState({ left: 0, bottom: 0, width: 240 })
  const btnRef              = useRef(null)

  function toggle(e) {
    e.stopPropagation()
    if (!show && btnRef.current) {
      const rect    = btnRef.current.getBoundingClientRect()
      const tipW    = Math.min(270, window.innerWidth - 16)
      // Center the tooltip over the button, clamped to 8px viewport margins
      const rawLeft = rect.left + rect.width / 2 - tipW / 2
      const left    = Math.max(8, Math.min(rawLeft, window.innerWidth - tipW - 8))
      // bottom = distance from viewport bottom to tooltip bottom (= above the button top)
      const bottom  = window.innerHeight - rect.top + 8
      setPos({ left, bottom, width: tipW })
    }
    setShow(v => !v)
  }

  return (
    <span style={{ position: "relative", display: "inline-block", marginLeft: 4, verticalAlign: "middle" }}>
      <button
        ref={btnRef}
        onClick={toggle}
        style={{
          cursor: "pointer",
          color: show ? "#a78bfa" : "#6b7280",
          fontSize: 9,
          fontWeight: 700,
          background: show ? "rgba(167,139,250,0.15)" : "#1e1b3a",
          borderRadius: "50%",
          width: 15,
          height: 15,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          border: `1px solid ${show ? "rgba(167,139,250,0.5)" : "#2d2b55"}`,
          padding: 0,
          lineHeight: 1,
          transition: "all 0.1s",
          flexShrink: 0,
        }}
      >
        ?
      </button>

      {show && (
        <>
          {/* full-screen backdrop */}
          <div
            onClick={(e) => { e.stopPropagation(); setShow(false) }}
            style={{ position: "fixed", inset: 0, zIndex: 9998 }}
          />
          <div style={{
            position: "fixed",
            left:   pos.left,
            bottom: pos.bottom,
            width:  pos.width,
            zIndex: 9999,
            background:   "#1a1a2e",
            border:       "1px solid #3d3b6e",
            borderRadius: 8,
            padding:      "10px 12px",
            fontSize:     12,
            color:        "#e2e8f0",
            boxShadow:    "0 6px 24px rgba(0,0,0,0.7)",
            lineHeight:   1.6,
            whiteSpace:   "normal",
            textAlign:    "left",
            pointerEvents: "none",  // backdrop handles dismissal
          }}>
            {text}
          </div>
        </>
      )}
    </span>
  )
}
