import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../api.js"
import { getLeague } from "../auth.js"
import PageBackground from "../components/PageBackground.jsx"
import HelpTip from "../components/HelpTip.jsx"

export default function AIPage() {
  const navigate = useNavigate()
  const league = getLeague()
  if (league != null && league.ai_enabled === false) {
    return (
      <div>
        <PageBackground momentKey="iniesta_2010" />
        <div style={{ padding: "16px 16px 8px" }}>
          <div style={{ fontSize: 24 }}>🤖</div>
          <div style={{ color: "#e2e8f0", fontWeight: 800, fontSize: 20, marginTop: 4 }}>AI Assistant</div>
        </div>
        <div style={{ padding: 32, maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
          <p style={{ color: "#6b7280", fontSize: 15, lineHeight: 1.6 }}>
            AI suggestions are not enabled for your group.<br />
            Contact your group admin to turn them on.
          </p>
        </div>
      </div>
    )
  }
  const [matches, setMatches] = useState([])
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get("/api/matches")
      .then((data) => setMatches(data.filter((m) => m.status === "upcoming")))
      .catch(() => [])
  }, [])

  async function generate() {
    if (!selectedMatch || loading) return
    setSuggestions([])
    setError(null)
    setLoading(true)
    try {
      const data = await api.post("/api/ai/suggest-challenge", { match_id: selectedMatch.id })
      setSuggestions(data.suggestions || [])
      if ((data.suggestions || []).length === 0) setError("No suggestions returned — try another match.")
    } catch (err) {
      setError(err.message || "Failed to generate suggestions")
    } finally {
      setLoading(false)
    }
  }

  function useThis(suggestion) {
    navigate(`/matches/${selectedMatch.id}`, {
      state: {
        prefill: {
          bet_type: suggestion.bet_type || "1x2",
          my_pick: suggestion.my_pick,
          their_pick: suggestion.their_pick,
          my_odds: suggestion.my_odds,
          their_odds: suggestion.their_odds,
          stake: suggestion.stake,
        },
      },
    })
  }

  return (
    <div>
      <PageBackground momentKey="iniesta_2010" />
      <div style={{ padding: "16px 16px 8px" }}>
        <div style={{ fontSize: 24 }}>🤖</div>
        <div style={{ color: "#e2e8f0", fontWeight: 800, fontSize: 20, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
          AI Assistant
          <HelpTip text="Claude analyses the current odds for a match and suggests 3 challenge ideas — each with picks, odds, and a reason. Hit 'Use This' to pre-fill the challenge form." />
        </div>
      </div>
      <div style={{ padding: 16, maxWidth: 480, margin: "0 auto" }}>
        <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 20 }}>
          Pick a match and Claude will suggest challenge ideas based on the current odds.
        </p>

        {/* Match picker */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
            Select a match
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {matches.length === 0 && (
              <p style={{ color: "#6b7280", fontSize: 13 }}>No upcoming matches.</p>
            )}
            {matches.map((m) => (
              <button key={m.id} onClick={() => { setSelectedMatch(m); setSuggestions([]) }}
                style={{
                  background: selectedMatch?.id === m.id
                    ? "linear-gradient(135deg, rgba(168,85,247,0.2), rgba(59,130,246,0.2))"
                    : "#13131f",
                  border: `1px solid ${selectedMatch?.id === m.id ? "#a855f7" : "#2d2b55"}`,
                  borderRadius: 10, padding: "10px 14px",
                  color: "#e2e8f0", fontSize: 13, fontWeight: 600,
                  textAlign: "left", cursor: "pointer",
                }}>
                {m.home_team} vs {m.away_team}
                <span style={{ color: "#6b7280", fontSize: 11, marginLeft: 8 }}>{m.round}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Generate button */}
        <button
          onClick={generate}
          disabled={!selectedMatch || loading}
          style={{
            width: "100%",
            background: !selectedMatch || loading ? "#1e1b3a" : "linear-gradient(135deg, #a855f7, #3b82f6)",
            color: !selectedMatch || loading ? "#6b7280" : "#fff",
            border: "none", borderRadius: 10, padding: "13px",
            fontSize: 15, fontWeight: 700,
            cursor: !selectedMatch || loading ? "not-allowed" : "pointer",
            marginBottom: 20,
          }}
        >
          {loading ? "✨ Thinking..." : "✨ Generate Challenge Ideas"}
        </button>

        {error && <p style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>⚠ {error}</p>}

        {/* Suggestion cards */}
        {suggestions.map((s, i) => (
          <div key={i} style={{
            background: "#13131f", border: "1px solid #2d2b55",
            borderRadius: 12, padding: 16, marginBottom: 12,
          }}>
            <div style={{ color: "#a78bfa", fontSize: 11, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
              {s.title}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ textAlign: "center", flex: 1 }}>
                <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
                  Your pick
                  <HelpTip text="The side of the bet you'd take. If you win, you receive stake × your odds in tokens." />
                </div>
                <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 14 }}>{s.my_pick}</div>
                <div style={{ color: "#4ade80", fontSize: 11 }}>{s.my_odds}x</div>
              </div>
              <div style={{ color: "#2d2b55", fontSize: 16, alignSelf: "center" }}>vs</div>
              <div style={{ textAlign: "center", flex: 1 }}>
                <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 2 }}>Their pick</div>
                <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 14 }}>{s.their_pick}</div>
                <div style={{ color: "#f87171", fontSize: 11 }}>{s.their_odds}x</div>
              </div>
              <div style={{ textAlign: "center", flex: 1 }}>
                <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 2 }}>Stake</div>
                <div style={{ color: "#fbbf24", fontWeight: 700, fontSize: 14 }}>{s.stake}</div>
                <div style={{ color: "#6b7280", fontSize: 11 }}>tokens</div>
              </div>
            </div>
            <p style={{ color: "#6b7280", fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>{s.reason}</p>
            <button onClick={() => useThis(s)} style={{
              width: "100%",
              background: "linear-gradient(135deg, #a855f7, #3b82f6)",
              color: "#fff", border: "none", borderRadius: 8,
              padding: "9px", fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}>
              Issue This Challenge →
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
