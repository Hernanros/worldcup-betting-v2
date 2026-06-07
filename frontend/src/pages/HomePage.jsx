// frontend/src/pages/HomePage.jsx
import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../api.js"
import { getPlayer } from "../auth.js"
import PageBackground from "../components/PageBackground.jsx"
import { flagUrl, WC2026_GROUPS, TEAM_GROUP } from "../data/teams.js"
import DeepCutsBanner from "../components/DeepCutsBanner.jsx"

/* ── helpers ────────────────────────────────────────────── */
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
      const h = Math.floor(diff / 3_600_000)
      const m = Math.floor((diff % 3_600_000) / 60_000)
      const s = Math.floor((diff % 60_000) / 1_000)
      if (h > 48) { setLabel(`in ${Math.ceil(diff / 86_400_000)} days`) }
      else if (h > 0) { setLabel(`in ${h}h ${m}m`) }
      else { setLabel(`in ${m}m ${s}s`) }
    }
    tick()
    const id = setInterval(tick, 1_000)
    return () => clearInterval(id)
  }, [kickoffIso])
  return label
}

/* ── Banner state resolver ──────────────────────────────── */
function getBannerState(matches, nextMatch, tournamentBets) {
  const hasWinnerBet = tournamentBets.some(b => b.bet_type === "winner")
  const hasGBBet    = tournamentBets.some(b => b.bet_type === "golden_boot")
  const allUpcoming = matches.length > 0 && matches.every(m => m.status === "upcoming")

  if (!nextMatch) return "TOURNAMENT_OVER"

  const msToKickoff    = new Date(nextMatch.kickoff_time) - Date.now()
  const hoursToKickoff = msToKickoff / 3_600_000

  if (allUpcoming && hoursToKickoff > 72) return "PRE_TOURNAMENT"
  if (!hasWinnerBet || !hasGBBet)         return "NEEDS_PICKS"
  if (hoursToKickoff < 6)                  return "IMMINENT"
  return "NORMAL"
}

/* ── Smart banner ───────────────────────────────────────── */
function SmartBanner({ state, nextMatch, navigate }) {
  const countdown = useCountdown(nextMatch?.kickoff_time)

  if (state === "PRE_TOURNAMENT") return (
    <div style={{
      background: "linear-gradient(135deg, rgba(251,191,36,0.15), rgba(245,158,11,0.08))",
      border: "1px solid rgba(251,191,36,0.5)", borderRadius: 16,
      padding: "18px 16px", marginBottom: 14, textAlign: "center",
    }}>
      <div style={{ fontSize: 32, marginBottom: 6 }}>🏆</div>
      <div style={{ color: "#fbbf24", fontWeight: 800, fontSize: 17, marginBottom: 4 }}>
        World Cup hasn't started yet
      </div>
      <div style={{ color: "#9ca3af", fontSize: 12, lineHeight: 1.5, marginBottom: 14 }}>
        First match {countdown}. Lock in who lifts the trophy and who wins the Golden Boot — these bets close the moment the whistle blows.
      </div>
      <button onClick={() => navigate("/tournament")} style={{
        background: "linear-gradient(135deg,#f59e0b,#fbbf24)", color: "#1a1a00",
        border: "none", borderRadius: 10, padding: "10px 24px", fontSize: 13, fontWeight: 800, cursor: "pointer",
      }}>
        🏅 Pick Winner + Golden Boot →
      </button>
    </div>
  )

  if (state === "NEEDS_PICKS") return (
    <div style={{
      background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)",
      borderRadius: 12, padding: "12px 14px", marginBottom: 14,
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <span style={{ fontSize: 22 }}>⚠️</span>
      <span style={{ color: "#e2e8f0", fontSize: 13, flex: 1 }}>
        Tournament picks still open — lock in your winner & Golden Boot
      </span>
      <button onClick={() => navigate("/tournament")} style={{
        background: "none", border: "1px solid #fbbf24", borderRadius: 8,
        color: "#fbbf24", fontSize: 11, fontWeight: 700, padding: "5px 10px", cursor: "pointer", flexShrink: 0,
      }}>
        Pick now →
      </button>
    </div>
  )

  if (state === "IMMINENT" && nextMatch) return (
    <div style={{
      background: "linear-gradient(135deg, rgba(239,68,68,0.12), rgba(168,85,247,0.12))",
      border: "1px solid rgba(239,68,68,0.4)", borderRadius: 16,
      padding: "18px 16px", marginBottom: 14, textAlign: "center",
    }}>
      <div style={{ color: "#f87171", fontSize: 11, fontWeight: 700,
        textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
        🔥 Kicks off {countdown}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 14 }}>
        {flagImg(nextMatch.home_team, 32)}
        <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 15 }}>
          {nextMatch.home_team}
        </span>
        <span style={{ color: "#4b5563", fontWeight: 800 }}>vs</span>
        <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 15 }}>
          {nextMatch.away_team}
        </span>
        {flagImg(nextMatch.away_team, 32)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button onClick={() => navigate(`/matches/${nextMatch.id}?tab=challenges`)} style={{
          background: "linear-gradient(135deg,#a855f7,#3b82f6)", color: "#fff",
          border: "none", borderRadius: 10, padding: "10px 8px", fontSize: 12, fontWeight: 700, cursor: "pointer",
        }}>
          ⚔️ Send a Dare
        </button>
        <button onClick={() => navigate("/predict")} style={{
          background: "#13131f", border: "1px solid #2d2b55",
          borderRadius: 10, padding: "10px 8px", fontSize: 12, fontWeight: 700,
          color: "#e2e8f0", cursor: "pointer",
        }}>
          🎯 Predict Score
        </button>
      </div>
    </div>
  )

  // NORMAL and TOURNAMENT_OVER don't show a top banner — the two-column row serves instead
  return null
}

/* ── Top-3 mini leaderboard (right column) ──────────────── */
function TopThreeMini({ leaderboard, myEntry, navigate }) {
  const top3 = leaderboard.slice(0, 3)
  const MEDALS = ["🥇", "🥈", "🥉"]
  return (
    <div style={{ background: "#13131f", border: "1px solid #2d2b55", borderRadius: 12, padding: 14 }}>
      <div style={{ color: "#a78bfa", fontSize: 9, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: 0.8, marginBottom: 8 }}>
        📊 Rankings
      </div>
      {top3.map((p, i) => (
        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 14, flexShrink: 0 }}>{MEDALS[i]}</span>
          <span style={{ color: "#e2e8f0", fontSize: 10, flex: 1, fontWeight: 600,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {p.name}
          </span>
          <span style={{ color: "#fbbf24", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
            {p.token_balance.toLocaleString()}
          </span>
        </div>
      ))}
      {myEntry && !top3.some(p => p.id === myEntry.id) && (
        <div style={{ borderTop: "1px solid #2d2b55", paddingTop: 6, marginTop: 2,
          display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "#6b7280", fontSize: 10, flexShrink: 0 }}>#{myEntry.rank}</span>
          <span style={{ color: "#a78bfa", fontSize: 10, flex: 1, fontWeight: 700,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            You
          </span>
          <span style={{ color: "#fbbf24", fontSize: 10, fontWeight: 700 }}>
            {myEntry.token_balance.toLocaleString()}
          </span>
        </div>
      )}
      <button onClick={() => navigate("/rankings")} style={{
        width: "100%", background: "none", border: "1px solid #2d2b55",
        borderRadius: 8, padding: "5px 0", marginTop: 6,
        color: "#a78bfa", fontSize: 10, fontWeight: 700, cursor: "pointer",
      }}>
        See all →
      </button>
    </div>
  )
}

/* ── Pending dares for me ───────────────────────────────── */
function DaresForMe({ dares, navigate }) {
  if (!dares?.length) return null
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ color: "#f87171", fontSize: 11, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: 0.8, marginBottom: 8 }}>
        ⚔️ {dares.length} dare{dares.length > 1 ? "s" : ""} waiting for you
      </div>
      {dares.slice(0, 2).map(c => (
        <button key={c.id} onClick={() => navigate(`/matches/${c.match_id}?tab=challenges`)} style={{
          width: "100%", textAlign: "left",
          background: "linear-gradient(135deg, rgba(168,85,247,0.08), rgba(59,130,246,0.08))",
          border: "1px solid rgba(168,85,247,0.3)",
          borderRadius: 10, padding: "10px 12px", marginBottom: 6,
          display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#a78bfa", fontSize: 10, fontWeight: 700, marginBottom: 2 }}>
              {c.issuer_name || "Someone"} dares you
            </div>
            <div style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {c.match_home_team} vs {c.match_away_team} · {c.bet_type?.replace(/_/g, " ")}
            </div>
          </div>
          <span style={{ color: "#a78bfa", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>Accept →</span>
        </button>
      ))}
    </div>
  )
}

/* ── My open dares ──────────────────────────────────────── */
function MyOpenDares({ dares, onCancel }) {
  if (!dares?.length) return null
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: 0.8, marginBottom: 8 }}>
        🕐 Dares I sent — waiting for response
      </div>
      {dares.slice(0, 2).map(c => (
        <div key={c.id} style={{
          background: "#13131f", border: "1px solid #2d2b55",
          borderRadius: 10, padding: "10px 12px", marginBottom: 6,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#6b7280", fontSize: 10 }}>
              {c.match_home_team} vs {c.match_away_team}
            </div>
            <div style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
              {c.selection} · <span style={{ color: "#fbbf24" }}>{c.issuer_stake} tokens</span>
            </div>
          </div>
          <button onClick={() => onCancel(c.id)} style={{
            flexShrink: 0, background: "none", border: "1px solid #ef4444",
            borderRadius: 6, color: "#ef4444", fontSize: 11,
            padding: "4px 10px", cursor: "pointer", fontWeight: 600,
          }}>
            Cancel
          </button>
        </div>
      ))}
    </div>
  )
}

/* ── Group standings helper ─────────────────────────────── */
function computeGroupStandings(groupTeams, allMatches) {
  const stats = {}
  groupTeams.forEach(t => { stats[t] = { pts: 0, gd: 0, gf: 0 } })
  allMatches.forEach(m => {
    if (!groupTeams.includes(m.home_team) || !groupTeams.includes(m.away_team)) return
    if (m.home_score === null || m.away_score === null) return
    const h = m.home_score, a = m.away_score
    stats[m.home_team].gf += h
    stats[m.home_team].gd += (h - a)
    stats[m.away_team].gf += a
    stats[m.away_team].gd += (a - h)
    if (h > a) { stats[m.home_team].pts += 3 }
    else if (h === a) { stats[m.home_team].pts += 1; stats[m.away_team].pts += 1 }
    else { stats[m.away_team].pts += 3 }
  })
  return groupTeams
    .map(t => ({ team: t, ...stats[t] }))
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
}

function ordinal(n) {
  return ["1st","2nd","3rd","4th"][n - 1] ?? `${n}th`
}

/* ── Next match hero (full-width) ───────────────────────── */
function NextMatchHero({ match, navigate }) {
  const countdown = useCountdown(match?.kickoff_time)
  if (!match) return (
    <div style={{ background: "#13131f", border: "1px solid #2d2b55", borderRadius: 14,
      padding: 20, marginBottom: 14, textAlign: "center" }}>
      <div style={{ color: "#6b7280", fontSize: 13 }}>No upcoming matches</div>
    </div>
  )
  return (
    <div style={{ background: "#13131f", border: "1px solid #2d2b55", borderRadius: 14,
      padding: "16px 16px 14px", marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ color: "#a78bfa", fontSize: 10, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: 0.8 }}>⏱ Next match</div>
        <div style={{ color: "#6b7280", fontSize: 11 }}>{countdown}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", marginBottom: 16 }}>
        <div style={{ textAlign: "center", flex: 1 }}>
          {flagImg(match.home_team, 48)}
          <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 700, marginTop: 6,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {match.home_team}
          </div>
        </div>
        <div style={{ color: "#4b5563", fontWeight: 800, fontSize: 18, padding: "0 8px" }}>vs</div>
        <div style={{ textAlign: "center", flex: 1 }}>
          {flagImg(match.away_team, 48)}
          <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 700, marginTop: 6,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {match.away_team}
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button onClick={() => navigate(`/matches/${match.id}?tab=challenges`)} style={{
          background: "linear-gradient(135deg,#a855f7,#3b82f6)", color: "#fff",
          border: "none", borderRadius: 10, padding: "10px 0",
          fontSize: 12, fontWeight: 700, cursor: "pointer",
        }}>⚔️ Dare friends</button>
        <button onClick={() => navigate("/predict")} style={{
          background: "none", border: "1px solid #2d2b55", borderRadius: 10,
          padding: "10px 0", fontSize: 12, fontWeight: 700,
          color: "#e2e8f0", cursor: "pointer",
        }}>🎯 Predict</button>
      </div>
    </div>
  )
}

/* ── Team picker modal ──────────────────────────────────── */
function TeamPickerModal({ onPick, onClose, saving }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    function onKey(e) { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener("keydown", onKey)
    }
  }, [onClose])

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Pick your team"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
        zIndex: 1000, overflowY: "auto",
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{ padding: "16px 16px 80px", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ color: "#e2e8f0", fontSize: 16, fontWeight: 800 }}>Pick your team</div>
          <button onClick={onClose} style={{
            background: "none", border: "1px solid #4b5563", borderRadius: 8,
            color: "#9ca3af", fontSize: 13, padding: "4px 12px", cursor: "pointer",
          }}>✕ Close</button>
        </div>
        {Object.entries(WC2026_GROUPS).map(([group, teams]) => (
          <div key={group} style={{ marginBottom: 16 }}>
            <div style={{ color: "#6b7280", fontSize: 10, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
              Group {group}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {teams.map(team => (
                <button key={team} onClick={() => !saving && onPick(team)} disabled={saving} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: "#13131f", border: "1px solid #2d2b55", borderRadius: 10,
                  padding: "8px 10px", cursor: saving ? "default" : "pointer",
                  opacity: saving ? 0.6 : 1,
                }}>
                  {flagImg(team, 22)}
                  <span style={{ color: "#e2e8f0", fontSize: 11, fontWeight: 600,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {team}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── My team card ───────────────────────────────────────── */
function MyTeamCard({ favoriteTeam, matches, onPickTeam }) {
  if (!favoriteTeam) return (
    <div style={{ background: "#13131f", border: "1px solid #2d2b55", borderRadius: 12,
      padding: 14, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", minHeight: 120 }}>
      <div style={{ color: "#6b7280", fontSize: 11, marginBottom: 10 }}>Support a team</div>
      <button onClick={onPickTeam} style={{
        background: "none", border: "1px solid #4b5563", borderRadius: 10,
        color: "#e2e8f0", fontSize: 12, fontWeight: 700, padding: "8px 16px",
        cursor: "pointer",
      }}>🏳️ Pick your team</button>
    </div>
  )

  const group = TEAM_GROUP[favoriteTeam]
  const groupTeams = group ? WC2026_GROUPS[group] : []
  const standings = computeGroupStandings(groupTeams, matches)
  const pos = standings.findIndex(s => s.team === favoriteTeam) + 1
  const teamNext = matches.find(m =>
    m.status === "upcoming" &&
    (m.home_team === favoriteTeam || m.away_team === favoriteTeam)
  )
  const opponent = teamNext
    ? (teamNext.home_team === favoriteTeam ? teamNext.away_team : teamNext.home_team)
    : null

  return (
    <div style={{ background: "#13131f", border: "1px solid #2d2b55", borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ color: "#a78bfa", fontSize: 9, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: 0.8 }}>🏳️ My team</div>
        <button onClick={onPickTeam} style={{
          background: "none", border: "none", color: "#6b7280",
          fontSize: 10, cursor: "pointer", padding: 0,
        }}>Change →</button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        {flagImg(favoriteTeam, 32)}
        <div>
          <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 700,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 100 }}>
            {favoriteTeam}
          </div>
          {group && (
            <div style={{ color: "#6b7280", fontSize: 10, marginTop: 2 }}>
              Group {group}{pos > 0 ? ` · ${ordinal(pos)}` : ""}
            </div>
          )}
        </div>
      </div>
      {opponent && (
        <div style={{ borderTop: "1px solid #1e1e3a", paddingTop: 8 }}>
          <div style={{ color: "#6b7280", fontSize: 9, textTransform: "uppercase",
            letterSpacing: 0.8, marginBottom: 4 }}>Next up</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {flagImg(opponent, 16)}
            <span style={{ color: "#9ca3af", fontSize: 10 }}>vs {opponent}</span>
          </div>
        </div>
      )}
      {!opponent && (
        <div style={{ borderTop: "1px solid #1e1e3a", paddingTop: 8 }}>
          <div style={{ color: "#6b7280", fontSize: 10 }}>No upcoming match</div>
        </div>
      )}
    </div>
  )
}

/* ── Main page ──────────────────────────────────────────── */
export default function HomePage() {
  const navigate = useNavigate()
  const player = getPlayer()

  const [matches, setMatches] = useState([])
  const [nextMatch, setNextMatch] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [openChallenges, setOpenChallenges] = useState({ my_open: [], for_me: [] })
  const [tournamentBets, setTournamentBets] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [favoriteTeam, setFavoriteTeam] = useState(null)
  const [showTeamPicker, setShowTeamPicker] = useState(false)
  const [savingTeam, setSavingTeam] = useState(false)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const [allMatches, tournamentData, lb, challengeData, me] = await Promise.all([
        api.get("/api/matches"),
        api.get("/api/tournament/bets").catch(() => ({ my_bets: [] })),
        api.get("/api/leaderboard"),
        api.get("/api/challenges").catch(() => ({ my_open: [], for_me: [] })),
        api.get("/api/me").catch(() => null),
      ])
      const upcoming = allMatches.filter(m => m.status === "upcoming")
      setMatches(allMatches)
      setNextMatch(upcoming[0] ?? null)
      setTournamentBets(tournamentData.my_bets || [])
      setOpenChallenges(challengeData)
      setLeaderboard(lb)
      setFavoriteTeam(me?.favorite_team ?? null)
    } catch {
      setLoadError("Failed to load — tap to retry")
    } finally {
      setLoading(false)
    }
  }, [player?.id])

  useEffect(() => { load() }, [load])

  const bannerState = loading ? "NORMAL"
    : getBannerState(matches, nextMatch, tournamentBets)

  const myEntry = leaderboard.find(p => p.id === player?.id)

  async function cancelDare(id) {
    try {
      await api.delete(`/api/challenges/${id}`)
      setOpenChallenges(prev => ({ ...prev, my_open: prev.my_open.filter(x => x.id !== id) }))
    } catch (e) { alert(e.message || "Cancel failed") }
  }

  async function saveTeam(teamName) {
    setSavingTeam(true)
    try {
      await api.patch("/api/me", { favorite_team: teamName })
      setFavoriteTeam(teamName)
      setShowTeamPicker(false)
    } catch (e) { alert(e.message || "Failed to save team") }
    finally { setSavingTeam(false) }
  }

  return (
    <div>
      <PageBackground momentKey="rotating" />
      <div style={{ padding: "16px 16px 80px" }}>

        {/* Error retry card */}
        {loadError && !loading && (
          <div style={{ padding: 24, textAlign: "center" }}>
            <div style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>{loadError}</div>
            <button onClick={load} style={{
              background: "linear-gradient(135deg,#a855f7,#3b82f6)", color: "#fff",
              border: "none", borderRadius: 10, padding: "10px 24px",
              fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}>Retry</button>
          </div>
        )}

        {!loadError && (
          <>
            {/* Smart banner */}
            {!loading && (
              <SmartBanner state={bannerState} nextMatch={nextMatch} navigate={navigate} />
            )}

            {/* Deep Cuts teaser */}
            {!loading && <DeepCutsBanner />}

            {/* Next match hero */}
            {!loading && <NextMatchHero match={nextMatch} navigate={navigate} />}

            {/* Two-column: My team + Rankings */}
            {!loading && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <MyTeamCard
                  favoriteTeam={favoriteTeam}
                  matches={matches}
                  onPickTeam={() => setShowTeamPicker(true)}
                />
                <TopThreeMini leaderboard={leaderboard} myEntry={myEntry} navigate={navigate} />
              </div>
            )}

            {/* Loading skeleton */}
            {loading && (
              <div style={{ height: 180, background: "#13131f", borderRadius: 16, marginBottom: 14,
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#6b7280", fontSize: 13 }}>Loading…</span>
              </div>
            )}

            {/* Dares for me */}
            {!loading && <DaresForMe dares={openChallenges.for_me} navigate={navigate} />}

            {/* My open dares */}
            {!loading && <MyOpenDares dares={openChallenges.my_open} onCancel={cancelDare} />}
          </>
        )}

      </div>

      {/* Team picker modal — rendered outside padding div so it covers full screen */}
      {showTeamPicker && (
        <TeamPickerModal
          onPick={saveTeam}
          onClose={() => setShowTeamPicker(false)}
          saving={savingTeam}
        />
      )}
    </div>
  )
}
