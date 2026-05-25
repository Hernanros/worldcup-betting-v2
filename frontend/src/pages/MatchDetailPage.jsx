import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { api } from "../api.js"
import BetPanel from "../components/BetPanel.jsx"
import ChallengePanel from "../components/ChallengePanel.jsx"
import PageHero from "../components/PageHero.jsx"
import { getMomentForMatch } from "../data/moments.js"

export default function MatchDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load() {
    setError(null)
    try {
      const data = await api.get(`/api/matches/${id}`)
      setMatch(data)
    } catch (err) {
      setError(err.message || "Match not found")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  if (loading) return <div style={{ padding: 24, color: "#6b7280", textAlign: "center" }}>Loading...</div>
  if (error) return (
    <div style={{ padding: 24, textAlign: "center" }}>
      <p style={{ color: "#f87171", marginBottom: 16 }}>⚠ {error}</p>
      <button onClick={() => navigate(-1)} style={{ color: "#a78bfa", background: "none", border: "none", cursor: "pointer" }}>← Back</button>
    </div>
  )
  if (!match) return null

  const isUpcoming = match.status === "upcoming"

  return (
    <div>
      <PageHero
        momentKey={getMomentForMatch(match.home_team, match.away_team).key}
        height={160}
      />
      <div style={{ padding: 16 }}>
        <button onClick={() => navigate(-1)}
          style={{ color: "#a78bfa", background: "none", border: "none", fontSize: 13, cursor: "pointer", marginBottom: 16 }}>
          ← Back
        </button>

        {/* Match header */}
        <div style={{ background: "#13131f", border: "1px solid #2d2b55", borderRadius: 12,
          padding: 20, marginBottom: 16, textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 40 }}>🏳️</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#e2e8f0", marginTop: 4 }}>{match.home_team}</div>
              {match.home_score !== null && (
                <div className="gradient-text" style={{ fontSize: 32, fontWeight: 800, marginTop: 6 }}>{match.home_score}</div>
              )}
            </div>
            <div style={{ color: "#6b7280" }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                {match.status === "locked" && match.home_score !== null ? "LIVE" : match.status}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 40 }}>🏳️</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#e2e8f0", marginTop: 4 }}>{match.away_team}</div>
              {match.away_score !== null && (
                <div className="gradient-text" style={{ fontSize: 32, fontWeight: 800, marginTop: 6 }}>{match.away_score}</div>
              )}
            </div>
          </div>
        </div>

        {isUpcoming && (
          <>
            <BetPanel match={match} odds={match.odds} onBetPlaced={() => {}} />
            <ChallengePanel match={match} challenges={match.open_challenges} onUpdate={load} />
          </>
        )}

        {!isUpcoming && (
          <p style={{ color: "#6b7280", textAlign: "center", fontSize: 14 }}>
            Betting is closed for this match.
          </p>
        )}
      </div>
    </div>
  )
}
