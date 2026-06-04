import { useState, useEffect } from "react"
import { api } from "../api.js"
import PredictionRow from "../components/PredictionRow.jsx"
import HelpTip from "../components/HelpTip.jsx"
import PageBackground from "../components/PageBackground.jsx"

export default function PredictionsPage() {
  const [entries, setEntries] = useState([])
  const [doublesUsed, setDoublesUsed] = useState(0)
  const [error, setError] = useState(null)

  const totalPoints = entries.reduce((acc, e) => acc + (e.my_prediction?.points_awarded || 0), 0)

  async function load() {
    setError(null)
    try {
      const data = await api.get("/api/predictions")
      setEntries(data)
      setDoublesUsed(data.filter(e => e.my_prediction?.is_double).length)
    } catch (err) { setError(err.message || "Failed to load predictions") }
  }

  function handleRowSaved(newDoublesCount) {
    if (newDoublesCount !== undefined) setDoublesUsed(newDoublesCount)
    load()
  }

  useEffect(() => { load() }, [])

  return (
    <div>
      <PageBackground momentKey="italy_2006" />
      <div style={{ padding: "16px 16px 8px" }}>
        <div style={{ fontSize: 24 }}>🎯</div>
        <div style={{ color: "#e2e8f0", fontWeight: 800, fontSize: 20, marginTop: 4 }}>Predictions</div>
      </div>
      <div style={{ padding: 16 }}>
        {error && <p style={{ color: "#f87171", textAlign: "center", fontSize: 13 }}>⚠ {error}</p>}
        <div style={{
          background: "#13131f", border: "1px solid #2d2b55", borderRadius: 10,
          padding: "10px 16px", marginBottom: 10,
          display: "flex", justifyContent: "space-between",
        }}>
          <span style={{ color: "#6b7280", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
            Your total points
            <HelpTip text="Prediction points are separate from tokens. Exact score = 3 pts, correct outcome = 1 pt. Points appear on the Predictions leaderboard tab." />
          </span>
          <span className="gradient-text" style={{ fontWeight: 800, fontSize: 18 }}>{totalPoints} pts</span>
        </div>
        <div style={{
          background: "#0c0c14", border: "1px solid #2d2b55", borderRadius: 8,
          padding: "7px 12px", marginBottom: 16,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ color: "#6b7280", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
            ⚡ Double picks used
            <HelpTip text="Mark up to 3 predictions as Double Points before the match starts. Correct double = 6 pts (exact) or 2 pts (outcome)." />
          </span>
          <span style={{ color: doublesUsed >= 3 ? "#f59e0b" : "#4ade80", fontWeight: 700, fontSize: 13 }}>
            {doublesUsed} / 3
          </span>
        </div>
        {entries.map((e) => (
          <PredictionRow key={e.match_id} entry={e} onSaved={handleRowSaved} doublesUsed={doublesUsed} />
        ))}
      </div>
    </div>
  )
}
