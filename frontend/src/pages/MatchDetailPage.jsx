// frontend/src/pages/MatchDetailPage.jsx
import { useState, useEffect } from "react"
import { useParams, useNavigate, useLocation, useOutletContext } from "react-router-dom"
import { api } from "../api.js"
import { getPlayer } from "../auth.js"
import ChallengePanel from "../components/ChallengePanel.jsx"
import PageBackground from "../components/PageBackground.jsx"
import { getMomentForMatch } from "../data/moments.js"
import TeamFlag from "../components/TeamFlag.jsx"
import { ScorePicker } from "../components/InlinePrediction.jsx"

export default function MatchDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { onBalanceChange } = useOutletContext() ?? {}
  const prefill = location.state?.prefill ?? null
  const currentPlayer = getPlayer()

  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [playerStreak, setPlayerStreak] = useState(0)
  const [totalChallenges, setTotalChallenges] = useState(0)
  const [myPrediction, setMyPrediction] = useState(null)
  const [showPicker, setShowPicker] = useState(false)

  async function load() {
    setError(null)
    try {
      const [data, me, predictions] = await Promise.all([
        api.get(`/api/matches/${id}`),
        api.get("/api/me").catch(() => null),
        api.get("/api/predictions").catch(() => []),
      ])
      setMatch(data)
      if (me) {
        setPlayerStreak(me.challenge_streak)
        setTotalChallenges(me.total_challenges_issued)
      }
      const pred = predictions.find(p => p.match_id === Number(id))?.my_prediction ?? null
      setMyPrediction(pred)
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

        {/* Match header — tappable to predict (upcoming only) */}
        <div
          onClick={() => { if (isUpcoming && !showPicker) setShowPicker(true) }}
          style={{
            background: "#13131f", border: "1px solid #2d2b55", borderRadius: 12,
            padding: 20, marginBottom: 16, textAlign: "center",
            cursor: isUpcoming && !showPicker ? "pointer" : "default",
          }}
        >
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

          {/* Prediction hint / inline picker */}
          {isUpcoming && !showPicker && (
            <div style={{ marginTop: 12, fontSize: 11, fontWeight: 600,
              color: myPrediction ? "#22d3ee" : "#6b7280" }}>
              {myPrediction
                ? `🎯 Your pick: ${myPrediction.home_score_pred}–${myPrediction.away_score_pred} · tap to change`
                : "Tap to predict the score"}
            </div>
          )}
          {isUpcoming && showPicker && (
            <div style={{ marginTop: 14, textAlign: "left" }}
              onClick={e => e.stopPropagation()}
            >
              <ScorePicker
                matchId={Number(id)}
                prediction={myPrediction}
                onSaved={(_, h, a) => { setMyPrediction({ home_score_pred: h, away_score_pred: a }); setShowPicker(false) }}
                onCollapse={() => setShowPicker(false)}
              />
              <button onClick={e => { e.stopPropagation(); setShowPicker(false) }} style={{
                width: "100%", background: "none", border: "1px solid #2d2b55",
                borderRadius: 8, padding: "6px", fontSize: 11, color: "#6b7280",
                cursor: "pointer", marginTop: 6,
              }}>Cancel</button>
            </div>
          )}
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
              currentPlayerId={currentPlayer?.id ?? null}
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
