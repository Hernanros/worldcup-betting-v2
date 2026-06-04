import { useState } from "react"

/**
 * Tap-to-reveal help tooltip. Shows a `?` badge inline; clicking it
 * opens a floating card above the icon. Clicking anywhere else dismisses it.
 */
export default function HelpTip({ text }) {
  const [show, setShow] = useState(false)

  return (
    <span style={{ position: "relative", display: "inline-block", marginLeft: 4, verticalAlign: "middle" }}>
      <button
        onClick={(e) => { e.stopPropagation(); setShow(v => !v) }}
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
          {/* invisible full-screen backdrop to catch outside clicks */}
          <div
            onClick={() => setShow(false)}
            style={{ position: "fixed", inset: 0, zIndex: 200 }}
          />
          <div style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            minWidth: 210,
            maxWidth: 270,
            background: "#1a1a2e",
            border: "1px solid #3d3b6e",
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 12,
            color: "#e2e8f0",
            zIndex: 201,
            boxShadow: "0 6px 24px rgba(0,0,0,0.7)",
            lineHeight: 1.6,
            whiteSpace: "normal",
            textAlign: "left",
          }}>
            {text}
          </div>
        </>
      )}
    </span>
  )
}
