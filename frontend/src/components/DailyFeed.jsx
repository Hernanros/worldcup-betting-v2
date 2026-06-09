import { useState, useEffect } from "react"
import { api } from "../api.js"
import { flagUrl } from "../data/teams.js"
import { ilTime } from "../utils/time.js"

function Flag({ name, size = 16 }) {
  const url = flagUrl(name, 32)
  if (!url) return null
  return (
    <img src={url} alt={name} width={size} height={Math.round(size * 0.67)}
      style={{ objectFit: "cover", borderRadius: 2, flexShrink: 0, verticalAlign: "middle" }}
      onError={e => { e.target.style.display = "none" }} />
  )
}

function MatchResult({ match }) {
  const live = match.status === "locked" && match.home_score !== null
  const finished = match.status === "finished"
  const hasScore = match.home_score !== null && match.away_score !== null

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "6px 0",
      borderBottom: "1px solid #1f2937",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, minWidth: 0 }}>
        <Flag name={match.home} />
        <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {match.home}
        </span>
      </div>

      <div style={{ textAlign: "center", flexShrink: 0, minWidth: 52 }}>
        {hasScore ? (
          <span style={{
            fontSize: 13, fontWeight: 800,
            color: finished ? "#e2e8f0" : "#4ade80",
          }}>
            {match.home_score} – {match.away_score}
          </span>
        ) : (
          <span style={{ fontSize: 10, color: "#6b7280" }}>
            {match.kickoff_time
              ? ilTime(match.kickoff_time)
              : "—"}
          </span>
        )}
        {live && (
          <div style={{ fontSize: 8, color: "#4ade80", fontWeight: 700, letterSpacing: 0.5, marginTop: 1 }}>
            LIVE
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, minWidth: 0, justifyContent: "flex-end" }}>
        <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>
          {match.away}
        </span>
        <Flag name={match.away} />
      </div>
    </div>
  )
}

function MomentCard({ moment }) {
  if (moment.type === "correct_score") {
    return (
      <div style={{
        background: "rgba(22,163,74,0.1)", border: "1px solid rgba(22,163,74,0.3)",
        borderRadius: 8, padding: "8px 10px", marginBottom: 5,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 18 }}>🎯</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#4ade80", fontSize: 13, fontWeight: 700 }}>
              {moment.is_me ? "You" : moment.player} nailed the exact score!
            </div>
            <div style={{ color: "#6b7280", fontSize: 10, marginTop: 1 }}>
              {moment.match} · {moment.score} · <span style={{ color: "#4ade80" }}>+{moment.pts} pts</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (moment.type === "dare") {
    const highlight = moment.is_me_winner
    return (
      <div style={{
        background: highlight ? "rgba(168,85,247,0.1)" : "#13131f",
        border: `1px solid ${highlight ? "rgba(168,85,247,0.3)" : "#2d2b55"}`,
        borderRadius: 8, padding: "8px 10px", marginBottom: 5,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 16 }}>⚔️</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: highlight ? "#a78bfa" : "#e2e8f0", fontSize: 13, fontWeight: 700 }}>
              {moment.is_me_winner ? "You beat" : `${moment.winner} beat`}{" "}
              {moment.is_me_winner ? moment.loser : (moment.loser === "You" ? "you" : moment.loser)}
            </div>
            <div style={{ color: "#6b7280", fontSize: 10, marginTop: 1 }}>
              {moment.match} · <span style={{ color: "#fbbf24" }}>
                {moment.is_me_winner ? "+" : ""}{moment.tokens} tokens
              </span>
              {moment.streak_bonus > 0 && (
                <span style={{ color: "#fb923c", marginLeft: 4 }}>
                  🔥 +{moment.streak_bonus} streak bonus
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (moment.type === "bet_win") {
    const highlight = moment.is_me
    return (
      <div style={{
        background: highlight ? "rgba(251,191,36,0.08)" : "#13131f",
        border: `1px solid ${highlight ? "rgba(251,191,36,0.25)" : "#2d2b55"}`,
        borderRadius: 8, padding: "8px 10px", marginBottom: 5,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 16 }}>💰</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: highlight ? "#fbbf24" : "#e2e8f0", fontSize: 13, fontWeight: 700 }}>
              {moment.is_me ? "You" : moment.player} won a {moment.bet_type} bet
            </div>
            <div style={{ color: "#6b7280", fontSize: 10, marginTop: 1 }}>
              {moment.match} · {moment.selection} · <span style={{ color: "#4ade80" }}>+{moment.tokens} tokens</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (moment.type === "wildcard_win") {
    const highlight = moment.is_me
    return (
      <div style={{
        background: highlight ? "rgba(234,179,8,0.12)" : "rgba(234,179,8,0.05)",
        border: `1px solid ${highlight ? "rgba(234,179,8,0.4)" : "rgba(234,179,8,0.2)"}`,
        borderRadius: 8, padding: "8px 10px", marginBottom: 5,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 16 }}>🃏</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#fde047", fontSize: 13, fontWeight: 700 }}>
              {moment.is_me ? "Your" : `${moment.player}'s`} wildcard paid off!
            </div>
            <div style={{ color: "#6b7280", fontSize: 10, marginTop: 1 }}>
              {moment.match} · {moment.bet_type} · <span style={{ color: "#fde047" }}>+{moment.tokens} tokens (2×)</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (moment.type === "deep_cuts_hit") {
    const highlight = moment.is_me
    return (
      <div style={{
        background: highlight ? "rgba(99,102,241,0.1)" : "#13131f",
        border: `1px solid ${highlight ? "rgba(99,102,241,0.3)" : "#2d2b55"}`,
        borderRadius: 8, padding: "8px 10px", marginBottom: 5,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 16 }}>🔬</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: highlight ? "#818cf8" : "#e2e8f0", fontSize: 13, fontWeight: 700 }}>
              {moment.is_me ? "You" : moment.player} nailed a Deep Cut!
            </div>
            <div style={{ color: "#6b7280", fontSize: 10, marginTop: 1 }}>
              {moment.market} · {moment.selection} · <span style={{ color: "#4ade80" }}>+{moment.tokens} tokens</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (moment.type === "prediction_win") {
    const highlight = moment.is_me
    return (
      <div style={{
        background: highlight ? "rgba(34,197,94,0.07)" : "#13131f",
        border: `1px solid ${highlight ? "rgba(34,197,94,0.2)" : "#2d2b55"}`,
        borderRadius: 8, padding: "8px 10px", marginBottom: 5,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 16 }}>✅</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: highlight ? "#86efac" : "#d1d5db", fontSize: 13, fontWeight: 600 }}>
              {moment.is_me ? "You" : moment.player} called the result
            </div>
            <div style={{ color: "#6b7280", fontSize: 10, marginTop: 1 }}>
              {moment.match} · <span style={{ color: "#4ade80" }}>+{moment.pts} pts</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (moment.type === "bet_loss") {
    if (!moment.is_me) return null  // only show losses for the current player
    return (
      <div style={{
        background: "#13131f",
        border: "1px solid #2d2b55",
        borderRadius: 8, padding: "8px 10px", marginBottom: 5, opacity: 0.7,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 16 }}>😬</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>
              Your {moment.bet_type} bet didn't land
            </div>
            <div style={{ color: "#6b7280", fontSize: 10, marginTop: 1 }}>
              {moment.match} · {moment.selection}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}

export default function DailyFeed() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("results") // "results" | "moments" | "scores"
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    // Shared helper: build a "Coming Up" payload from /api/matches upcoming list
    async function fallbackToUpcoming(base = {}) {
      const all = await api.get("/api/matches")
      const upcoming = all.filter(m => m.status === "upcoming")
      if (!upcoming.length) return null
      const firstKey = new Date(upcoming[0].kickoff_time)
        .toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" })
      const nextDayMatches = upcoming
        .filter(m => new Date(m.kickoff_time)
          .toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" }) === firstKey)
        .map(m => ({ id: m.id, home: m.home_team, away: m.away_team,
          kickoff_time: m.kickoff_time, status: m.status,
          home_score: m.home_score, away_score: m.away_score }))
      // base fields (moments, top_scorers, etc.) are preserved; matches + _isFuture always come from fallback
      return { moments: [], top_scorers: [], has_activity: false, ...base, matches: nextDayMatches, _isFuture: true }
    }

    // Try today's feed; if no matches today fall back to showing next match day
    api.get("/api/feed/today")
      .then(async d => {
        if (!d.matches?.length) {
          // No matches today — show next upcoming match day from /api/matches
          try {
            const fb = await fallbackToUpcoming(d)
            if (fb) d = fb
          } catch (_) {}
        }
        setData(d); setLoading(false)
      })
      .catch(async (err) => {
        // Feed endpoint failed (e.g. 500 on cold start) — fall back gracefully
        console.error("[DailyFeed] /api/feed/today error:", err?.message ?? err)
        try {
          const fb = await fallbackToUpcoming()
          if (fb) setData(fb)
        } catch (_) {}
        setLoading(false)
      })
  }, [])

  if (loading || !data) return null

  // Show feed if there are any matches today (even upcoming), or if there's activity
  const hasMatches = data.matches?.length > 0
  const hasActivity = data.has_activity
  const hasMoments  = data.moments?.length > 0
  const hasScorers  = data.top_scorers?.length > 0

  if (!hasMatches) return null

  const finishedCount = data.matches.filter(m => m.status === "finished").length
  const liveCount     = data.matches.filter(m => m.status === "locked" && m.home_score !== null).length

  // Pill label
  let dayStatus
  if (liveCount > 0)     dayStatus = { label: `${liveCount} live`, color: "#4ade80" }
  else if (finishedCount > 0) dayStatus = { label: `${finishedCount} finished`, color: "#60a5fa" }
  else                        dayStatus = { label: `${data.matches.length} today`, color: "#6b7280" }

  const TABS = [
    { id: "results", label: "Results" },
    ...(hasMoments ? [{ id: "moments", label: `Moments ${data.moments.length > 0 ? `(${data.moments.length})` : ""}` }] : []),
    ...(hasScorers ? [{ id: "scores", label: "Top Picks" }] : []),
  ]

  return (
    <div style={{
      background: "#13131f", border: "1px solid #2d2b55",
      borderRadius: 14, marginBottom: 14, overflow: "hidden",
    }}>
      {/* Header */}
      <button
        onClick={() => setCollapsed(v => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 14px", background: "none", border: "none", cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>📅</span>
          <span style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 800 }}>{data._isFuture ? "Coming Up" : "Today"}</span>
          <span style={{
            fontSize: 9, fontWeight: 700, color: dayStatus.color,
            background: `${dayStatus.color}22`, border: `1px solid ${dayStatus.color}44`,
            borderRadius: 4, padding: "1px 6px",
          }}>
            {dayStatus.label}
          </span>
        </div>
        <span style={{ color: "#4b5563", fontSize: 12, transform: collapsed ? "none" : "rotate(180deg)", transition: "transform 0.15s" }}>▾</span>
      </button>

      {!collapsed && (
        <div style={{ padding: "0 14px 12px" }}>
          {/* Tabs — only show if there are multiple sections */}
          {TABS.length > 1 && (
            <div style={{ display: "flex", gap: 2, background: "#0d0d1a", borderRadius: 7, padding: 3, marginBottom: 10 }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  flex: 1, padding: "5px 4px", borderRadius: 5, border: "none",
                  background: tab === t.id ? "#2d2b55" : "transparent",
                  color: tab === t.id ? "#e2e8f0" : "#6b7280",
                  fontSize: 10, fontWeight: 700, cursor: "pointer",
                  whiteSpace: "nowrap",
                }}>
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {/* Results tab */}
          {(tab === "results" || TABS.length === 1) && (
            <div>
              {data.matches.map(m => (
                <MatchResult key={m.id} match={m} />
              ))}
            </div>
          )}

          {/* Moments tab */}
          {tab === "moments" && (
            <div>
              {data.moments.length === 0 ? (
                <p style={{ color: "#4b5563", fontSize: 12, textAlign: "center", padding: "8px 0" }}>
                  No moments yet — check back after matches finish
                </p>
              ) : (
                data.moments.map((m, i) => <MomentCard key={i} moment={m} />)
              )}
            </div>
          )}

          {/* Top scores tab */}
          {tab === "scores" && (
            <div>
              {data.top_scorers.map((s, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "5px 0", borderBottom: "1px solid #1f2937",
                }}>
                  <span style={{ color: "#6b7280", fontSize: 10, width: 16, textAlign: "center" }}>
                    {["🥇","🥈","🥉"][i] || `${i+1}.`}
                  </span>
                  <span style={{
                    flex: 1, fontSize: 12, fontWeight: 600,
                    color: s.is_me ? "#a78bfa" : "#e2e8f0",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {s.is_me ? "You" : s.name}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#4ade80" }}>
                    +{s.pts} pts
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
