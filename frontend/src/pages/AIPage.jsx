import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { api, streamSuggestChallenge } from "../api.js"
import PageHeader from "../components/PageHeader.jsx"

export default function AIPage() {
  const [matches, setMatches] = useState([])
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [streaming, setStreaming] = useState(false)
  const [text, setText] = useState("")
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)
  const outputRef = useRef(null)

  useEffect(() => {
    api.get("/api/matches")
      .then((data) => setMatches(data.filter((m) => m.status === "upcoming")))
      .catch(() => [])
  }, [])

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [text])

  async function generate() {
    if (!selectedMatch || streaming) return
    setText("")
    setDone(false)
    setError(null)
    setStreaming(true)

    try {
      await streamSuggestChallenge(
        selectedMatch.id,
        (chunk) => setText((prev) => prev + chunk),
        () => { setDone(true); setStreaming(false) },
      )
    } catch (err) {
      setError(err.message || "Failed to generate suggestions")
      setStreaming(false)
    }
  }

  return (
    <div>
      <PageHeader momentKey="iniesta_2010" icon="🤖" title="AI Assistant" />
      <div style={{ padding: 16, maxWidth: 480, margin: "0 auto" }}>
        <h2 className="gradient-text" style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>
          🤖 AI Challenge Generator
        </h2>
        <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 20 }}>
          Pick a match and Claude will suggest spicy challenge ideas based on the current odds.
        </p>

        {/* Match picker */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: 1, marginBottom: 8 }}>Select a match</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {matches.length === 0 && (
              <p style={{ color: "#6b7280", fontSize: 13 }}>No upcoming matches.</p>
            )}
            {matches.map((m) => (
              <button key={m.id} onClick={() => setSelectedMatch(m)}
                style={{
                  background: selectedMatch?.id === m.id
                    ? "linear-gradient(135deg, rgba(168,85,247,0.2), rgba(59,130,246,0.2))"
                    : "#13131f",
                  border: `1px solid ${selectedMatch?.id === m.id ? "#a855f7" : "#2d2b55"}`,
                  borderRadius: 10, padding: "10px 14px",
                  color: "#e2e8f0", fontSize: 13, fontWeight: 600, textAlign: "left", cursor: "pointer",
                }}>
                {m.home_team} vs {m.away_team}
                <span style={{ color: "#6b7280", fontSize: 11, marginLeft: 8 }}>{m.round}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Generate button */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={generate}
          disabled={!selectedMatch || streaming}
          style={{
            width: "100%",
            background: !selectedMatch || streaming ? "#1e1b3a" : "linear-gradient(135deg, #a855f7, #3b82f6)",
            color: !selectedMatch || streaming ? "#6b7280" : "#fff",
            border: "none", borderRadius: 10, padding: "13px",
            fontSize: 15, fontWeight: 700, cursor: !selectedMatch || streaming ? "not-allowed" : "pointer",
            marginBottom: 20,
          }}
        >
          {streaming ? "✨ Generating..." : "✨ Generate Challenge Ideas"}
        </motion.button>

        {error && <p style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>⚠ {error}</p>}

        {/* Output */}
        <AnimatePresence>
          {(text || streaming) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              ref={outputRef}
              style={{
                background: "#13131f", border: "1px solid #2d2b55", borderRadius: 12, padding: 16,
                maxHeight: 400, overflowY: "auto", whiteSpace: "pre-wrap",
                color: "#e2e8f0", fontSize: 14, lineHeight: 1.7,
              }}
            >
              {text}
              {streaming && (
                <span style={{
                  display: "inline-block", width: 8, height: 14,
                  background: "linear-gradient(135deg,#a855f7,#3b82f6)", borderRadius: 2,
                  marginLeft: 2, animation: "pulse 1s infinite", verticalAlign: "middle",
                }} />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {done && text && (
          <p style={{ color: "#4ade80", fontSize: 12, textAlign: "center", marginTop: 12 }}>
            ✓ Done — go to the match page to issue one of these challenges!
          </p>
        )}
      </div>
    </div>
  )
}
