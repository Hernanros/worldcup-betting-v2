import { useState, useEffect } from "react"
import { useParams, useNavigate, useLocation } from "react-router-dom"
import { api } from "../api.js"
import BetPanel from "../components/BetPanel.jsx"
import ChallengePanel from "../components/ChallengePanel.jsx"
import PageHero from "../components/PageHero.jsx"
import { getMomentForMatch } from "../data/moments.js"
import { flagUrl } from "../data/teams.js"

function TeamFlag({ name, size = 48 }) {
  const url = flagUrl(name, 64)
  if (!url) return <span style={{ fontSize: size }}>🏳️</span>
  return (
    <img src={url} alt={name} width={size} height={size * 0.67}
      style={{ objectFit: "cover", borderRadius: 4, display: "block" }}
      onError={(e) => { e.target.style.display = "none" }} />
  )
}

export default function MatchDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const prefill = location.state?.prefill ?? null

  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [myBet, setMyBet] = useState(null)
  const [playerStreak, setPlayerStreak] = useState(0)
  const [totalChallenges, setTotalChallenges] = useState(0)

  async function load() {
    setError(null)
    try {
      const [data, bets, me] = await Promise.all([
        api.get(`/api/matches/${id}`),
        api.get("/api/bets").catch(() => []),
        api.get("/api/me").catch(() => null),
      ])
      setMatch(data)
      const existing = (bets || []).find((b) => b.match_id === Number(id))
      setMyBet(existing ?? null)
      if (me) {
        setPlayerStreak(me.challenge_streak)
        setTotalChallenges(me.total_challenges_issued)
      }
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
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <TeamFlag name={match.home_team} />
              <div style={{ fontWeight: 700, fontSize: 14, color: "#e2e8f0", marginTop: 6 }}>{match.home_team}</div>
              {match.home_score !== null && (
                <div className="gradient-text" style={{ fontSize: 32, fontWeight: 800, marginTop: 6 }}>{match.home_score}</div>
              )}
            </div>
            <div style={{ color: "#6b7280" }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                {match.status === "locked" && match.home_score !== null ? "LIVE" : match.status}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <TeamFlag name={match.away_team} />
              <div style={{ fontWeight: 700, fontSize: 14, color: "#e2e8f0", marginTop: 6 }}>{match.away_team}</div>
              {match.away_score !== null && (
                <div className="gradient-text" style={{ fontSize: 32, fontWeight: 800, marginTop: 6 }}>{match.away_score}</div>
              )}
            </div>
          </div>
        </div>

        {isUpcoming && (
          <>
            {myBet && (
              <div style={{
                background: "#13131f", border: "1px solid #2d2b55",
                borderRadius: 10, padding: "12px 16px", marginBottom: 12,
              }}>
                <div style={{ color: "#6b7280", fontSize: 10, fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                  Your Bet
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 14 }}>{myBet.selection}</div>
                    <div style={{ color: "#6b7280", fontSize: 11 }}>
                      {myBet.stake} tokens @ {myBet.odds}x →{" "}
                      <span style={{ color: "#4ade80" }}>win {Math.floor(myBet.stake * myBet.odds).toLocaleString()}</span>
                    </div>
                  </div>
                  <span style={{
                    color: "#fbbf24", fontSize: 10, fontWeight: 700,
                    background: "#0c0c14", padding: "3px 8px", borderRadius: 999, border: "1px solid #2d2b55",
                  }}>PENDING</span>
                </div>
              </div>
            )}
            <BetPanel match={match} odds={match.odds} onBetPlaced={() => {}} />
            <ChallengePanel
              match={match}
              challenges={match.open_challenges}
              onUpdate={load}
              prefill={prefill}
              playerStreak={playerStreak}
              totalChallenges={totalChallenges}
            />
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
