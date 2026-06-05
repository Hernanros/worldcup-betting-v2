// frontend/src/pages/MatchDetailPage.jsx
import { useState, useEffect } from "react"
import { useParams, useNavigate, useLocation, useOutletContext } from "react-router-dom"
import { api } from "../api.js"
import ChallengePanel from "../components/ChallengePanel.jsx"
import PageBackground from "../components/PageBackground.jsx"
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
  const { onBalanceChange } = useOutletContext() ?? {}
  const prefill = location.state?.prefill ?? null

  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [playerStreak, setPlayerStreak] = useState(0)
  const [totalChallenges, setTotalChallenges] = useState(0)

  async function load() {
    setError(null)
    try {
      const [data, me] = await Promise.all([
        api.get(`/api/matches/${id}`),
        api.get("/api/me").catch(() => null),
      ])
      setMatch(data)
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

  // Auto-scroll to dare panel when ?tab=challenges
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get("tab") === "challenges") {
      setTimeout(() => {
        document.getElementById("dare-panel")?.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 400)
    }
  }, [location.search, loading])

  if (loading) return <div style={{ padding: 24, color: "#6b7280", textAlign: "center" }}>Loading...</div>
  if (error) return (
    <div style={{ padding: 24, textAlign: "center" }}>
      <p style={{ color: "#f87171", marginBottom: 16 }}>⚠ {error}</p>
      <button onClick={() => navigate(-1)} style={{ color: "#a78bfa", background: "none", border: "none", cursor: "pointer" }}>← Back</button>
    </div>
  )
  if (!match) return null

  const isUpcoming = match.status === "upcoming"
  const momentKey = getMomentForMatch(match.home_team, match.away_team).key

  return (
    <div>
      <PageBackground momentKey={momentKey} />
      <div style={{ padding: 16, paddingBottom: 80 }}>
        <button onClick={() => navigate(-1)}
          style={{ color: "#a78bfa", background: "none", border: "none", fontSize: 13, cursor: "pointer", marginBottom: 16 }}>
          ← Back
        </button>

        {/* Match header */}
        <div style={{ background: "#13131f", border: "1px solid #2d2b55", borderRadius: 12,
          padding: 20, marginBottom: 16, textAlign: "center" }}>
          <div style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: 1, marginBottom: 12 }}>
            {match.round}
          </div>
          <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
              <TeamFlag name={match.home_team} />
              <div style={{ fontWeight: 700, fontSize: 13, color: "#e2e8f0", marginTop: 6,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 100 }}>
                {match.home_team}
              </div>
              {match.home_score !== null && (
                <div className="gradient-text" style={{ fontSize: 32, fontWeight: 800, marginTop: 6 }}>{match.home_score}</div>
              )}
            </div>
            <div style={{ color: "#4b5563", fontWeight: 800, fontSize: 20, padding: "0 8px" }}>
              {match.home_score !== null ? "–" : "vs"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
              <TeamFlag name={match.away_team} />
              <div style={{ fontWeight: 700, fontSize: 13, color: "#e2e8f0", marginTop: 6,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 100 }}>
                {match.away_team}
              </div>
              {match.away_score !== null && (
                <div className="gradient-text" style={{ fontSize: 32, fontWeight: 800, marginTop: 6 }}>{match.away_score}</div>
              )}
            </div>
          </div>
          {match.status !== "upcoming" && (
            <div style={{ marginTop: 10, color: "#6b7280", fontSize: 11, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: 1 }}>
              {match.status === "locked" && match.home_score !== null ? "🔴 LIVE" : match.status}
            </div>
          )}
        </div>

        {/* Quick action links */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          <button onClick={() => navigate("/predict")} style={{
            background: "#13131f", border: "1px solid #2d2b55", borderRadius: 10,
            padding: "10px 8px", cursor: "pointer", textAlign: "center",
          }}>
            <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 700 }}>🎯 Predict</div>
            <div style={{ color: "#6b7280", fontSize: 10, marginTop: 2 }}>Guess the exact score</div>
          </button>
          <button onClick={() => navigate("/deep-cuts")} style={{
            background: "#13131f", border: "1px solid #2d2b55", borderRadius: 10,
            padding: "10px 8px", cursor: "pointer", textAlign: "center",
          }}>
            <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 700 }}>🔪 Deep Cuts</div>
            <div style={{ color: "#6b7280", fontSize: 10, marginTop: 2 }}>Prop bets for this stage</div>
          </button>
        </div>

        {/* Dare panel */}
        {isUpcoming ? (
          <div id="dare-panel">
            <ChallengePanel
              match={match}
              challenges={match.open_challenges}
              onUpdate={load}
              onBalanceChange={onBalanceChange}
              prefill={prefill}
              playerStreak={playerStreak}
              totalChallenges={totalChallenges}
            />
          </div>
        ) : (
          <div style={{ background: "#13131f", border: "1px solid #2d2b55", borderRadius: 12,
            padding: 20, textAlign: "center" }}>
            <div style={{ color: "#6b7280", fontSize: 13 }}>
              {match.status === "finished"
                ? "This match has finished. Dares have been settled."
                : "Dares lock at kick-off. Check back for the next match!"}
            </div>
            <button onClick={() => navigate("/matches")} style={{
              marginTop: 12, background: "linear-gradient(135deg,#a855f7,#3b82f6)", color: "#fff",
              border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>
              All matches →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
