import { useState, useEffect } from "react"
import { api } from "../api.js"
import PredictionRow from "../components/PredictionRow.jsx"
import PageHero from "../components/PageHero.jsx"

export default function PredictionsPage() {
  const [entries, setEntries] = useState([])
  const [error, setError] = useState(null)

  const totalPoints = entries.reduce((acc, e) => acc + (e.my_prediction?.points_awarded || 0), 0)

  async function load() {
    setError(null)
    try {
      const data = await api.get("/api/predictions")
      setEntries(data)
    } catch (err) {
      setError(err.message || "Failed to load predictions")
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div>
      <PageHero momentKey="italy_2006" />
      <div style={{ padding: 16 }}>
        <div style={{ background: "#13131f", border: "1px solid #2d2b55", borderRadius: 10,
          padding: "10px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#6b7280", fontSize: 13 }}>Your total points</span>
          <span className="gradient-text" style={{ fontWeight: 800, fontSize: 18 }}>{totalPoints} pts</span>
        </div>
        {error && <p style={{ color: "#f87171", textAlign: "center", fontSize: 13 }}>⚠ {error}</p>}
        {entries.map((e) => <PredictionRow key={e.match_id} entry={e} onSaved={load} />)}
      </div>
    </div>
  )
}
