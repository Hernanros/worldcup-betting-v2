import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../api.js"
import { getPlayer } from "../auth.js"
import MatchCard from "../components/MatchCard.jsx"
import LeaderboardRow from "../components/LeaderboardRow.jsx"
import PageBackground from "../components/PageBackground.jsx"

export default function HomePage() {
  const navigate = useNavigate()
  const player = getPlayer()

  const [upcomingMatches, setUpcomingMatches] = useState([])
  const [activeBets, setActiveBets] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [predictionPts, setPredictionPts] = useState(0)
  const [myRank, setMyRank] = useState(null)
  const [openChallenges, setOpenChallenges] = useState({ my_open: [], for_me: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [matches, predictions, tournamentData, lb, matchBetsData, challengeData] = await Promise.all([
          api.get("/api/matches"),
          api.get("/api/predictions"),
          api.get("/api/tournament/bets").catch(() => ({ my_bets: [] })),
          api.get("/api/leaderboard"),
          api.get("/api/bets").catch(() => []),
          api.get("/api/challenges").catch(() => ({ my_open: [], for_me: [] })),
        ])

        // Upcoming matches — sort by date, take first 3
        const upcoming = matches
          .filter((m) => m.status === "upcoming")
          .slice(0, 3)
        setUpcomingMatches(upcoming)

        // Prediction points
        const pts = predictions.reduce((acc, e) => acc + (e.my_prediction?.points_awarded || 0), 0)
        setPredictionPts(pts)

        // Active (pending) bets — merge match bets + tournament bets
        const pending = (tournamentData.my_bets || []).filter((b) => b.status === "pending")
        const pendingMatchBets = (matchBetsData || []).filter((b) => b.status === "pending")
        setActiveBets([...pendingMatchBets.map(b => ({ ...b, _kind: "match" })), ...pending.map(b => ({ ...b, _kind: "tournament" }))])
        setOpenChallenges(challengeData)

        // Leaderboard — top 3 + me
        setLeaderboard(lb)
        const me = lb.find((p) => p.id === player?.id)
        setMyRank(me?.rank ?? null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const top3 = leaderboard.slice(0, 3)
  const myEntry = leaderboard.find((p) => p.id === player?.id)
  const myRankInTop3 = top3.some((p) => p.id === player?.id)

  return (
    <div>
      <PageBackground momentKey="rotating" />
      <div style={{ padding: 16 }}>

        {/* ── MY STATS ─────────────────────────────────── */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20,
        }}>
          {[
            { label: "💰 Tokens", value: (player?.token_balance ?? 0).toLocaleString() },
            { label: "🎯 Pred. pts", value: loading ? "…" : `${predictionPts}` },
            { label: "📊 Rank", value: loading ? "…" : (myRank ? `#${myRank}` : "—") },
          ].map(({ label, value }) => (
            <div key={label} style={{
              background: "#13131f", border: "1px solid #2d2b55",
              borderRadius: 10, padding: "10px 8px", textAlign: "center",
            }}>
              <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 4 }}>{label}</div>
              <div className="gradient-text" style={{ fontWeight: 800, fontSize: 16 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* ── UPCOMING MATCHES ─────────────────────────── */}
        <div style={{ marginBottom: 20 }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10,
          }}>
            <h2 style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: 1, margin: 0 }}>
              Next Matches
            </h2>
            <button onClick={() => navigate("/matches")} style={{
              background: "none", border: "none", color: "#a78bfa",
              fontSize: 12, cursor: "pointer", padding: 0,
            }}>
              See all →
            </button>
          </div>
          {loading && <p style={{ color: "#6b7280", fontSize: 13, textAlign: "center" }}>Loading…</p>}
          {!loading && upcomingMatches.length === 0 && (
            <p style={{ color: "#6b7280", fontSize: 13, textAlign: "center" }}>No upcoming matches</p>
          )}
          {upcomingMatches.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </div>

        {/* ── ACTIVE BETS ──────────────────────────────── */}
        {!loading && activeBets.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h2 style={{
              color: "#e2e8f0", fontSize: 13, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: 1, marginBottom: 10,
            }}>
              Active Bets
            </h2>
            {activeBets.map((b) => (
              <div key={`${b._kind}-${b.id}`} style={{
                background: "#13131f", border: "1px solid #2d2b55",
                borderRadius: 10, padding: "10px 14px", marginBottom: 8,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <div style={{ color: "#6b7280", fontSize: 10, fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: 1 }}>
                    {b._kind === "match"
                      ? `${b.home_team} vs ${b.away_team}`
                      : b.bet_type.replaceAll("_", " ")}
                  </div>
                  <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 13 }}>{b.selection}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "#fbbf24", fontSize: 10, fontWeight: 700 }}>PENDING</div>
                  <div style={{ color: "#4ade80", fontSize: 12, fontWeight: 600 }}>
                    +{Math.floor(b.stake * b.odds).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── OPEN CHALLENGES ─────────────────────────── */}
        {(openChallenges.for_me.length > 0 || openChallenges.my_open.length > 0) && (
          <div style={{ marginBottom: 20 }}>
            <h2 style={{
              color: "#e2e8f0", fontSize: 13, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: 1, marginBottom: 10,
            }}>
              Challenges
            </h2>

            {openChallenges.for_me.length > 0 && (
              <>
                <p style={{ color: "#6b7280", fontSize: 11, marginBottom: 6 }}>
                  ⚔️ {openChallenges.for_me.length} waiting for you
                </p>
                {openChallenges.for_me.slice(0, 3).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/matches/${c.match_id}`)}
                    style={{
                      width: "100%", textAlign: "left", background: "#13131f",
                      border: "1px solid rgba(168,85,247,0.4)",
                      borderRadius: 10, padding: "10px 14px", marginBottom: 6, cursor: "pointer",
                    }}
                  >
                    <div style={{ color: "#a78bfa", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                      {c.match_home_team} vs {c.match_away_team}
                    </div>
                    <div style={{ color: "#e2e8f0", fontSize: 13, marginTop: 2 }}>
                      {c.selection} vs {c.acceptor_selection}
                      <span style={{ color: "#4ade80", fontSize: 11, marginLeft: 6 }}>
                        stake {c.acceptor_stake} tokens
                      </span>
                    </div>
                  </button>
                ))}
                {openChallenges.for_me.length > 3 && (
                  <p style={{ color: "#6b7280", fontSize: 11, textAlign: "center" }}>
                    +{openChallenges.for_me.length - 3} more → tap a match to see all
                  </p>
                )}
              </>
            )}

            {openChallenges.my_open.length > 0 && (
              <p style={{ color: "#6b7280", fontSize: 11, marginTop: openChallenges.for_me.length > 0 ? 8 : 0 }}>
                🕐 {openChallenges.my_open.length} of your challenge{openChallenges.my_open.length !== 1 ? "s" : ""} waiting for a taker
              </p>
            )}
          </div>
        )}

        {/* ── LEADERBOARD PREVIEW ──────────────────────── */}
        <div>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10,
          }}>
            <h2 style={{
              color: "#e2e8f0", fontSize: 13, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: 1, margin: 0,
            }}>
              Rankings
            </h2>
            <button onClick={() => navigate("/rankings")} style={{
              background: "none", border: "none", color: "#a78bfa",
              fontSize: 12, cursor: "pointer", padding: 0,
            }}>
              See all →
            </button>
          </div>
          {loading && <p style={{ color: "#6b7280", fontSize: 13, textAlign: "center" }}>Loading…</p>}
          {top3.map((p) => (
            <LeaderboardRow key={p.id} player={p} rank={p.rank} />
          ))}
          {/* Show my row if I'm not already in top 3 */}
          {!myRankInTop3 && myEntry && (
            <>
              <div style={{ textAlign: "center", color: "#2d2b55", fontSize: 18, margin: "4px 0" }}>•••</div>
              <LeaderboardRow player={myEntry} rank={myEntry.rank} />
            </>
          )}
        </div>

      </div>
    </div>
  )
}
