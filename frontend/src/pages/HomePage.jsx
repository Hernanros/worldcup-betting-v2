import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../api.js"
import { getPlayer } from "../auth.js"
import PageBackground from "../components/PageBackground.jsx"
import LeaderboardRow from "../components/LeaderboardRow.jsx"
import { flagUrl } from "../data/teams.js"

/* ── helpers ─────────────────────────────────────────────── */
function flagImg(name, size = 28) {
  const url = flagUrl(name, size)
  if (!url) return null
  return (
    <img src={url} alt={name} width={size} height={Math.round(size * 0.67)}
      style={{ objectFit: "cover", borderRadius: 2, display: "inline-block", verticalAlign: "middle" }}
      onError={e => { e.target.style.display = "none" }}
    />
  )
}

function useCountdown(kickoffIso) {
  const [label, setLabel] = useState("")
  useEffect(() => {
    if (!kickoffIso) return
    function tick() {
      const diff = new Date(kickoffIso) - Date.now()
      if (diff <= 0) { setLabel("Starting now"); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      if (h > 48) {
        const days = Math.ceil(diff / 86400000)
        setLabel(`in ${days} days`)
      } else if (h > 0) {
        setLabel(`in ${h}h ${m}m`)
      } else {
        setLabel(`in ${m}m ${s}s`)
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [kickoffIso])
  return label
}

/* ── Hero: next match card ───────────────────────────────── */
function NextMatchHero({ match }) {
  const navigate = useNavigate()
  const countdown = useCountdown(match?.kickoff_time)
  if (!match) return null

  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(168,85,247,0.12), rgba(59,130,246,0.12))",
      border: "1px solid rgba(168,85,247,0.35)",
      borderRadius: 16, padding: "20px 16px 16px", marginBottom: 16,
    }}>
      {/* countdown + round */}
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <span style={{ color: "#a78bfa", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
          ⏱ {countdown} · {match.round}
        </span>
      </div>

      {/* teams */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ textAlign: "center", flex: 1 }}>
          {flagImg(match.home_team, 42)}
          <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 13, marginTop: 6,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 100, margin: "6px auto 0" }}>
            {match.home_team}
          </div>
        </div>

        <div style={{ color: "#4b5563", fontWeight: 800, fontSize: 22, flexShrink: 0, padding: "0 12px" }}>
          vs
        </div>

        <div style={{ textAlign: "center", flex: 1 }}>
          {flagImg(match.away_team, 42)}
          <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 13, marginTop: 6,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 100, margin: "6px auto 0" }}>
            {match.away_team}
          </div>
        </div>
      </div>

      {/* actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {[
          { label: "🎯 Predict", sub: "Guess the score", action: () => navigate("/predict") },
          { label: "💰 Bet", sub: "Place a wager", action: () => navigate(`/matches/${match.id}`) },
          { label: "⚔️ Dare", sub: "Challenge a friend", action: () => navigate(`/matches/${match.id}?tab=challenges`) },
        ].map(({ label, sub, action }) => (
          <button key={label} onClick={action} style={{
            background: "#13131f", border: "1px solid #2d2b55", borderRadius: 10,
            padding: "10px 6px", cursor: "pointer", textAlign: "center",
          }}>
            <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 700 }}>{label}</div>
            <div style={{ color: "#6b7280", fontSize: 10, marginTop: 2 }}>{sub}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── Action items ────────────────────────────────────────── */
function ActionItems({ challengesForMe, tournamentBets, nextMatch, navigate }) {
  const items = []

  if (challengesForMe?.length > 0) {
    items.push({
      icon: "⚔️",
      color: "#a78bfa",
      bg: "rgba(168,85,247,0.1)",
      border: "rgba(168,85,247,0.3)",
      text: challengesForMe.length === 1
        ? `${challengesForMe[0].issuer_name || "Someone"} dared you — respond!`
        : `${challengesForMe.length} friends dared you — don't leave them hanging`,
      action: () => navigate(`/matches/${challengesForMe[0].match_id}`),
      cta: "Accept →",
    })
  }

  const hasWinnerBet = tournamentBets?.some(b => b.bet_type === "winner")
  const hasGoldenBootBet = tournamentBets?.some(b => b.bet_type === "golden_boot")
  if (!hasWinnerBet || !hasGoldenBootBet) {
    items.push({
      icon: "🏆",
      color: "#fbbf24",
      bg: "rgba(251,191,36,0.1)",
      border: "rgba(251,191,36,0.3)",
      text: "Lock in your World Cup winner & Golden Boot before the tournament starts",
      action: () => navigate("/tournament"),
      cta: "Pick now →",
    })
  }

  if (items.length === 0) return null

  return (
    <div style={{ marginBottom: 16 }}>
      {items.map((item, i) => (
        <button key={i} onClick={item.action} style={{
          width: "100%", textAlign: "left",
          background: item.bg, border: `1px solid ${item.border}`,
          borderRadius: 12, padding: "12px 14px", marginBottom: 8,
          display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
        }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>{item.icon}</span>
          <span style={{ color: "#e2e8f0", fontSize: 13, flex: 1, lineHeight: 1.4 }}>{item.text}</span>
          <span style={{ color: item.color, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{item.cta}</span>
        </button>
      ))}
    </div>
  )
}

/* ── Active bets strip ───────────────────────────────────── */
function ActiveBetsStrip({ bets }) {
  if (!bets?.length) return null
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: 1, marginBottom: 8 }}>
        Your pending bets
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {bets.slice(0, 4).map((b) => (
          <div key={`${b._kind}-${b.id}`} style={{
            background: "#13131f", border: "1px solid #2d2b55",
            borderRadius: 10, padding: "10px 14px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: "#6b7280", fontSize: 10, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: 0.5,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
                {b._kind === "match" ? `${b.home_team} vs ${b.away_team}` : b.bet_type?.replaceAll("_", " ")}
              </div>
              <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 13,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
                {b.selection}
                {b.is_wildcard && <span style={{ color: "#fbbf24", marginLeft: 4, fontSize: 10 }}>🃏</span>}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ color: "#fbbf24", fontSize: 10, fontWeight: 700 }}>PENDING</div>
              <div style={{ color: "#4ade80", fontSize: 12, fontWeight: 600 }}>
                +{Math.floor(b.stake * b.odds * (b.is_wildcard ? 2 : 1)).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Main page ───────────────────────────────────────────── */
export default function HomePage() {
  const navigate = useNavigate()
  const player = getPlayer()

  const [nextMatch, setNextMatch] = useState(null)
  const [activeBets, setActiveBets] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [openChallenges, setOpenChallenges] = useState({ my_open: [], for_me: [] })
  const [tournamentBets, setTournamentBets] = useState([])
  const [myRank, setMyRank] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [matches, tournamentData, lb, matchBetsData, challengeData] = await Promise.all([
        api.get("/api/matches"),
        api.get("/api/tournament/bets").catch(() => ({ my_bets: [] })),
        api.get("/api/leaderboard"),
        api.get("/api/bets").catch(() => []),
        api.get("/api/challenges").catch(() => ({ my_open: [], for_me: [] })),
      ])

      const upcoming = matches.filter(m => m.status === "upcoming")
      setNextMatch(upcoming[0] ?? null)

      const pending = (tournamentData.my_bets || []).filter(b => b.status === "pending")
      const pendingMatch = (matchBetsData || []).filter(b => b.status === "pending")
      setActiveBets([
        ...pendingMatch.map(b => ({ ...b, _kind: "match" })),
        ...pending.map(b => ({ ...b, _kind: "tournament" })),
      ])

      setTournamentBets(tournamentData.my_bets || [])
      setOpenChallenges(challengeData)
      setLeaderboard(lb)
      const me = lb.find(p => p.id === player?.id)
      setMyRank(me?.rank ?? null)
    } finally {
      setLoading(false)
    }
  }, [player?.id])

  useEffect(() => { load() }, [load])

  const top3 = leaderboard.slice(0, 3)
  const myEntry = leaderboard.find(p => p.id === player?.id)
  const myRankInTop3 = top3.some(p => p.id === player?.id)

  return (
    <div>
      <PageBackground momentKey="rotating" />
      <div style={{ padding: "16px 16px 80px" }}>

        {/* ── Hero ──────────────────────────────────────────── */}
        {loading
          ? <div style={{ height: 200, background: "#13131f", borderRadius: 16, marginBottom: 16,
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#6b7280", fontSize: 13 }}>Loading…</span>
            </div>
          : nextMatch
            ? <NextMatchHero match={nextMatch} />
            : <div style={{ background: "#13131f", border: "1px solid #2d2b55",
                borderRadius: 16, padding: 20, marginBottom: 16, textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🏆</div>
                <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 16 }}>Tournament in progress!</div>
                <div style={{ color: "#6b7280", fontSize: 13, marginTop: 4, marginBottom: 14 }}>
                  Check your bets and challenge your friends.
                </div>
                <button onClick={() => navigate("/matches")} style={{
                  background: "linear-gradient(135deg,#a855f7,#3b82f6)", color: "#fff",
                  border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}>
                  See all matches →
                </button>
              </div>
        }

        {/* ── Action items ─────────────────────────────────── */}
        {!loading && (
          <ActionItems
            challengesForMe={openChallenges.for_me}
            tournamentBets={tournamentBets}
            nextMatch={nextMatch}
            navigate={navigate}
          />
        )}

        {/* ── Active bets ───────────────────────────────────── */}
        {!loading && <ActiveBetsStrip bets={activeBets} />}

        {/* ── My open challenges ────────────────────────────── */}
        {!loading && openChallenges.my_open.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: 1, marginBottom: 8 }}>
              🕐 Dares waiting for a response
            </div>
            {openChallenges.my_open.slice(0, 2).map(c => (
              <div key={c.id} style={{
                background: "#13131f", border: "1px solid #2d2b55",
                borderRadius: 10, padding: "10px 14px", marginBottom: 6,
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: "#6b7280", fontSize: 10, fontWeight: 700 }}>
                    {c.match_home_team} vs {c.match_away_team}
                  </div>
                  <div style={{ color: "#e2e8f0", fontSize: 12, overflow: "hidden",
                    textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
                    {c.selection} · <span style={{ color: "#fbbf24" }}>{c.issuer_stake} tokens at risk</span>
                  </div>
                </div>
                <button onClick={async () => {
                  try {
                    await api.delete(`/api/challenges/${c.id}`)
                    setOpenChallenges(prev => ({ ...prev, my_open: prev.my_open.filter(x => x.id !== c.id) }))
                  } catch (e) { alert(e.message || "Cancel failed") }
                }} style={{
                  flexShrink: 0, marginLeft: 10,
                  background: "none", border: "1px solid #ef4444",
                  borderRadius: 6, color: "#ef4444", fontSize: 11,
                  padding: "4px 10px", cursor: "pointer", fontWeight: 600,
                }}>
                  Cancel
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Leaderboard ───────────────────────────────────── */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ color: "#6b7280", fontSize: 11, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: 1 }}>
              📊 Rankings
            </div>
            <button onClick={() => navigate("/rankings")} style={{
              background: "none", border: "none", color: "#a78bfa",
              fontSize: 12, cursor: "pointer", padding: 0,
            }}>
              See all →
            </button>
          </div>
          {loading
            ? <p style={{ color: "#6b7280", fontSize: 13, textAlign: "center" }}>Loading…</p>
            : <>
                {top3.map(p => <LeaderboardRow key={p.id} player={p} rank={p.rank} />)}
                {!myRankInTop3 && myEntry && (
                  <>
                    <div style={{ textAlign: "center", color: "#2d2b55", fontSize: 18, margin: "4px 0" }}>•••</div>
                    <LeaderboardRow player={myEntry} rank={myEntry.rank} />
                  </>
                )}
              </>
          }
        </div>

      </div>
    </div>
  )
}
