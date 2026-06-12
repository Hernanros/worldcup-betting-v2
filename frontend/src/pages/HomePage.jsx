// frontend/src/pages/HomePage.jsx
import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useOutletContext } from "react-router-dom"
import { api } from "../api.js"
import { getPlayer } from "../auth.js"
import PageBackground from "../components/PageBackground.jsx"
import { flagUrl, WC2026_GROUPS, TEAM_GROUP } from "../data/teams.js"
import DeepCutsBanner from "../components/DeepCutsBanner.jsx"
import DailyFeed from "../components/DailyFeed.jsx"
import { ilDateTimeFull, ilDateTime } from "../utils/time.js"
import { ScorePicker } from "../components/InlinePrediction.jsx"

/* ── helpers ────────────────────────────────────────────── */
function flagImg(name, size = 28) {
  const url = flagUrl(name, size * 2) // 2× for retina
  if (!url) return null
  return (
    <div style={{
      width: size, height: size,
      borderRadius: "50%", overflow: "hidden", flexShrink: 0,
      border: "1.5px solid rgba(255,255,255,0.12)",
      display: "inline-block", verticalAlign: "middle",
    }}>
      <img src={url} alt={name}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        onError={e => { e.target.parentElement.style.display = "none" }}
      />
    </div>
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
      background: "linear-gradient(145deg, rgba(251,191,36,0.18), rgba(245,158,11,0.1))",
      border: "1.5px solid rgba(251,191,36,0.6)", borderRadius: 20,
      padding: "28px 20px", marginBottom: 14, textAlign: "center",
      boxShadow: "0 8px 32px rgba(251,191,36,0.12)",
    }}>
      <div style={{ fontSize: 52, marginBottom: 8, lineHeight: 1 }}>🏆</div>
      <div style={{ color: "#fbbf24", fontWeight: 900, fontSize: 22, marginBottom: 8, letterSpacing: -0.5 }}>
        World Cup starts {countdown}
      </div>
      <div style={{ color: "#d1a040", fontSize: 14, lineHeight: 1.6, marginBottom: 18 }}>
        Lock in who lifts the trophy and who tops the Golden Boot — these picks close at kickoff.
      </div>
      <button onClick={() => navigate("/tournament")} style={{
        background: "linear-gradient(135deg,#f59e0b,#fbbf24)", color: "#1a0f00",
        border: "none", borderRadius: 12, padding: "13px 32px", fontSize: 15, fontWeight: 900, cursor: "pointer",
        boxShadow: "0 4px 16px rgba(251,191,36,0.35)",
      }}>
        🏅 Pick Winner + Golden Boot →
      </button>
    </div>
  )

  if (state === "NEEDS_PICKS") return (
    <button onClick={() => navigate("/tournament")} style={{
      width: "100%", textAlign: "left", cursor: "pointer",
      background: "linear-gradient(145deg, rgba(251,191,36,0.14), rgba(245,158,11,0.07))",
      border: "1.5px solid rgba(251,191,36,0.5)",
      borderRadius: 16, padding: "18px 18px", marginBottom: 14,
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      boxShadow: "0 4px 20px rgba(251,191,36,0.08)",
    }}>
      <div>
        <div style={{ color: "#fbbf24", fontWeight: 900, fontSize: 17, marginBottom: 3 }}>
          🏆 Who wins WC 2026?
        </div>
        <div style={{ color: "#d1a040", fontSize: 13, lineHeight: 1.4 }}>
          Pick your winners
        </div>
      </div>
      <span style={{ color: "#fbbf24", fontSize: 22, flexShrink: 0 }}>→</span>
    </button>
  )

  if (state === "IMMINENT" && nextMatch) return (
    <button onClick={() => navigate(`/matches/${nextMatch.id}`)} style={{
      width: "100%", textAlign: "left", cursor: "pointer",
      background: "linear-gradient(145deg, rgba(239,68,68,0.14), rgba(168,85,247,0.14))",
      border: "1.5px solid rgba(239,68,68,0.45)", borderRadius: 20,
      padding: "22px 18px", marginBottom: 14,
      boxShadow: "0 6px 24px rgba(239,68,68,0.12)",
    }}>
      <div style={{ color: "#f87171", fontSize: 11, fontWeight: 700,
        textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
        🔥 Kicks off {countdown}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
        {flagImg(nextMatch.home_team, 44)}
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ color: "#e2e8f0", fontWeight: 800, fontSize: 16 }}>{nextMatch.home_team}</div>
        </div>
        <div style={{ color: "#4b5563", fontWeight: 800, fontSize: 14 }}>vs</div>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ color: "#e2e8f0", fontWeight: 800, fontSize: 16 }}>{nextMatch.away_team}</div>
        </div>
        {flagImg(nextMatch.away_team, 44)}
      </div>
      <div style={{ color: "#6b7280", fontSize: 11, textAlign: "center", marginTop: 10 }}>Tap to bet, predict &amp; dare →</div>
    </button>
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
            <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {c.match_home_team} vs {c.match_away_team} · {c.bet_type?.replace(/_/g, " ")}
            </div>
            {c.acceptor_selection && (
              <div style={{ color: "#4ade80", fontSize: 11, marginTop: 2, fontWeight: 600 }}>
                Your side: {c.acceptor_selection} · {c.acceptor_stake} 🪙
              </div>
            )}
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
      {dares.map(c => (
        <div key={c.id} style={{
          background: "#13131f", border: "1px solid #2d2b55",
          borderRadius: 10, padding: "10px 12px", marginBottom: 6,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#6b7280", fontSize: 10 }}>
              {c.match_home_team} vs {c.match_away_team}
              {c.addressee_name && <span style={{ color: "#4ade80", marginLeft: 5 }}>→ {c.addressee_name}</span>}
            </div>
            <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
              {c.selection} · <span style={{ color: "#fbbf24" }}>{c.issuer_stake} tokens</span>
            </div>
          </div>
          <button onClick={() => onCancel(c.id)} style={{
            flexShrink: 0, background: "none", border: "1px solid #ef4444",
            borderRadius: 6, color: "#ef4444", fontSize: 11,
            padding: "4px 10px", cursor: "pointer", fontWeight: 600,
          }}>
            Withdraw
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

/* ── Hero score picker ──────────────────────────────────── */
const HERO_NUM_PICKER = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

function heroScoreInputStyle(active, filled) {
  return {
    width: 40, height: 38,
    border: `1.5px solid ${active ? "#a855f7" : filled ? "#22d3ee" : "#2d2b55"}`,
    borderRadius: 7,
    background: active ? "rgba(168,85,247,0.12)" : filled ? "rgba(34,211,238,0.06)" : "#0c0c14",
    fontSize: 18, fontWeight: 800, textAlign: "center",
    color: active ? "#e2e8f0" : filled ? "#22d3ee" : "#4b5563",
    cursor: "text", outline: "none",
    MozAppearance: "textfield",
    padding: 0, boxSizing: "border-box", flexShrink: 0,
  }
}

function HeroScorePicker({ entry, onSaved, onCollapse }) {
  const [home, setHome] = useState(entry?.my_prediction?.home_score_pred ?? null)
  const [away, setAway] = useState(entry?.my_prediction?.away_score_pred ?? null)
  const [activePicker, setActivePicker] = useState("home")
  const [saving, setSaving] = useState(false)
  const homeRef = useRef(null)
  const awayRef = useRef(null)

  async function doSave(h, a) {
    if (h === null || a === null) return
    setSaving(true)
    try {
      const result = await api.post("/api/predictions", {
        match_id: entry.match_id,
        home_score_pred: h,
        away_score_pred: a,
        is_double: false,
      })
      onSaved(result.doubles_used)
      onCollapse()
    } catch {
      // fail silently — user can retry by tapping expand again
    } finally {
      setSaving(false)
    }
  }

  async function handlePickNumber(n) {
    if (activePicker === "home") {
      setHome(n)
      if (away !== null) { setActivePicker(null); await doSave(n, away) }
      else { setActivePicker("away"); setTimeout(() => awayRef.current?.focus(), 0) }
    } else {
      setAway(n)
      if (home !== null) { setActivePicker(null); await doSave(home, n) }
      else { setActivePicker("home"); setTimeout(() => homeRef.current?.focus(), 0) }
    }
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ color: "#a78bfa", fontSize: 10, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: 0.8, marginBottom: 10 }}>🎯 Your score prediction</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 10 }}>
        <input
          ref={homeRef}
          type="number" min={0} max={99} inputMode="numeric"
          value={home ?? ""}
          placeholder="–"
          onFocus={() => setActivePicker("home")}
          onBlur={() => setTimeout(() => {
            if (document.activeElement !== awayRef.current) setActivePicker(null)
          }, 150)}
          onChange={e => {
            const n = parseInt(e.target.value, 10)
            if (!isNaN(n) && n >= 0) setHome(n)
            else if (e.target.value === "") setHome(null)
          }}
          style={heroScoreInputStyle(activePicker === "home", home !== null)}
        />
        <span style={{ color: "#4b5563", fontSize: 20, fontWeight: 800 }}>–</span>
        <input
          ref={awayRef}
          type="number" min={0} max={99} inputMode="numeric"
          value={away ?? ""}
          placeholder="–"
          onFocus={() => setActivePicker("away")}
          onBlur={() => setTimeout(() => {
            if (document.activeElement !== homeRef.current) setActivePicker(null)
          }, 150)}
          onChange={e => {
            const n = parseInt(e.target.value, 10)
            if (!isNaN(n) && n >= 0) setAway(n)
            else if (e.target.value === "") setAway(null)
          }}
          style={heroScoreInputStyle(activePicker === "away", away !== null)}
        />
      </div>
      {activePicker && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
          {HERO_NUM_PICKER.map(n => (
            <button
              key={n}
              onMouseDown={e => e.preventDefault()}
              onClick={() => handlePickNumber(n)}
              style={{
                width: 36, height: 34, border: "1px solid #2d2b55", borderRadius: 7,
                background: "#1a1a2e", fontSize: 15, fontWeight: 700,
                color: "#e2e8f0", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}
            >{n}</button>
          ))}
        </div>
      )}
      {saving && <div style={{ color: "#6b7280", fontSize: 10, textAlign: "center" }}>saving…</div>}
      <style>{`
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>
    </div>
  )
}

/* ── Next match hero — inline predict + Challenge ─────────── */
function NextMatchHero({ match, navigate, myPrediction, onPredictionSaved }) {
  const countdown = useCountdown(match?.kickoff_time)
  const kickoffStr = match?.kickoff_time ? ilDateTimeFull(match.kickoff_time) : null
  const [showPicker, setShowPicker] = useState(false)

  if (!match) return (
    <div style={{ background: "#13131f", border: "1px solid #2d2b55", borderRadius: 14,
      padding: 20, marginBottom: 14, textAlign: "center" }}>
      <div style={{ color: "#6b7280", fontSize: 13 }}>No upcoming matches</div>
    </div>
  )

  const hasPred = myPrediction != null

  return (
    <div style={{
      background: "#13131f", border: "1px solid #2d2b55", borderRadius: 14,
      padding: "18px 16px 14px", marginBottom: 14,
      cursor: showPicker ? "default" : "pointer",
    }}
      onClick={() => { if (!showPicker) setShowPicker(true) }}
    >
      {/* Match header — tapping opens picker */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ color: "#a78bfa", fontSize: 10, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: 0.8 }}>⏱ Next match</div>
        <div style={{ color: "#6b7280", fontSize: 11 }}>{countdown}</div>
      </div>
      {kickoffStr && (
        <div style={{ color: "#6b7280", fontSize: 11, marginBottom: 14 }}>{kickoffStr}</div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", marginBottom: 8 }}>
        <div style={{ textAlign: "center", flex: 1 }}>
          {flagImg(match.home_team, 52)}
          <div style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 700, marginTop: 8,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {match.home_team}
          </div>
        </div>
        <div style={{ color: "#4b5563", fontWeight: 800, fontSize: 20, padding: "0 8px" }}>vs</div>
        <div style={{ textAlign: "center", flex: 1 }}>
          {flagImg(match.away_team, 52)}
          <div style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 700, marginTop: 8,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {match.away_team}
          </div>
        </div>
      </div>

      {/* Prediction hint when collapsed */}
      {!showPicker && hasPred && (
        <div style={{ textAlign: "center", fontSize: 11, color: "#22d3ee", fontWeight: 600, marginBottom: 8 }}>
          🎯 Your pick: {myPrediction.home_score_pred}–{myPrediction.away_score_pred} · tap to change
        </div>
      )}
      {!showPicker && !hasPred && (
        <div style={{ textAlign: "center", fontSize: 11, color: "#6b7280", marginBottom: 8 }}>
          Tap to predict the score
        </div>
      )}

      {/* Inline picker (expands on tap) */}
      {showPicker && (
        <div style={{ borderTop: "1px solid #1e1e3a", paddingTop: 12, marginTop: 4 }}
          onClick={e => e.stopPropagation()}
        >
          <ScorePicker
            matchId={match.id}
            prediction={myPrediction}
            onSaved={(doublesUsed, h, a) => { onPredictionSaved?.(match.id, h, a) }}
            onCollapse={() => setShowPicker(false)}
          />
          <button onClick={e => { e.stopPropagation(); setShowPicker(false) }} style={{
            width: "100%", background: "none", border: "1px solid #2d2b55",
            borderRadius: 8, padding: "6px", fontSize: 11, color: "#6b7280",
            cursor: "pointer", marginTop: 4,
          }}>Cancel</button>
        </div>
      )}

      {/* Challenge button — always visible, stops propagation so it doesn't open picker */}
      <button
        onClick={e => { e.stopPropagation(); navigate(`/matches/${match.id}?tab=challenges`) }}
        style={{
          width: "100%", marginTop: 10, padding: "9px 6px", borderRadius: 8,
          fontSize: 12, fontWeight: 700, cursor: "pointer",
          border: "1px solid rgba(168,85,247,0.3)",
          background: "rgba(168,85,247,0.08)", color: "#c4b5fd",
        }}
      >
        ⚔️ Challenge a friend
      </button>
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
                  <span style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600,
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
function MyTeamCard({ favoriteTeam, matches, onPickTeam, predictionsMap = {}, onPredictionSaved }) {
  if (!favoriteTeam) return (
    <div style={{ background: "#13131f", border: "1px solid #2d2b55", borderRadius: 12,
      padding: 14, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", minHeight: 120 }}>
      <div style={{ color: "#6b7280", fontSize: 11, marginBottom: 10 }}>Support a team</div>
      <button onClick={onPickTeam} style={{
        background: "none", border: "1px solid #4b5563", borderRadius: 10,
        color: "#e2e8f0", fontSize: 13, fontWeight: 700, padding: "8px 16px",
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
  const teamPred = teamNext ? (predictionsMap[teamNext.id] ?? null) : null
  const [showPredict, setShowPredict] = useState(false)

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
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
            {flagImg(opponent, 16)}
            <span style={{ color: "#9ca3af", fontSize: 10 }}>vs {opponent}</span>
          </div>
          {teamNext?.kickoff_time && (
            <div style={{ color: "#6b7280", fontSize: 9, marginBottom: 6 }}>
              {ilDateTimeFull(teamNext.kickoff_time)}
            </div>
          )}
          {/* Tap to expand inline predict */}
          <div
            onClick={() => { if (!showPredict) setShowPredict(true) }}
            style={{
              borderRadius: 8, padding: "6px 8px", cursor: showPredict ? "default" : "pointer",
              border: `1px solid ${teamPred ? "rgba(34,211,238,0.25)" : "rgba(168,85,247,0.2)"}`,
              background: teamPred ? "rgba(34,211,238,0.05)" : "rgba(168,85,247,0.04)",
            }}
          >
            {!showPredict && (
              <div style={{ textAlign: "center", fontSize: 10, fontWeight: 700,
                color: teamPred ? "#22d3ee" : "#a78bfa" }}>
                {teamPred ? `🎯 ${teamPred.home_score_pred}–${teamPred.away_score_pred}` : "tap to predict"}
              </div>
            )}
            {showPredict && (
              <div onClick={e => e.stopPropagation()}>
                <ScorePicker
                  matchId={teamNext.id}
                  prediction={teamPred}
                  onSaved={(doublesUsed, h, a) => { onPredictionSaved?.(teamNext.id, h, a); setShowPredict(false) }}
                  onCollapse={() => setShowPredict(false)}
                />
                <button
                  onClick={() => navigate(`/matches/${teamNext.id}?tab=challenges`)}
                  style={{
                    width: "100%", marginTop: 6, padding: "7px 4px", borderRadius: 7,
                    fontSize: 11, fontWeight: 700, cursor: "pointer",
                    border: "1px solid rgba(168,85,247,0.3)",
                    background: "rgba(168,85,247,0.08)", color: "#c4b5fd",
                  }}
                >⚔️ Challenge a friend</button>
                <button onClick={() => setShowPredict(false)} style={{
                  width: "100%", background: "none", border: "none",
                  padding: "3px", fontSize: 9, color: "#4b5563", cursor: "pointer",
                }}>✕ close</button>
              </div>
            )}
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
  const [myNextPrediction, setMyNextPrediction] = useState(null)
  const [predictionsMap, setPredictionsMap] = useState({})
  const { onBalanceChange } = useOutletContext() ?? {}

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const [allMatches, tournamentData, lb, challengeData, me, predictions] = await Promise.all([
        api.get("/api/matches"),
        api.get("/api/tournament/bets").catch(() => ({ my_bets: [] })),
        api.get("/api/leaderboard"),
        api.get("/api/challenges").catch(() => ({ my_open: [], for_me: [] })),
        api.get("/api/me").catch(() => null),
        api.get("/api/predictions").catch(() => []),
      ])
      const upcoming = allMatches.filter(m => m.status === "upcoming")
      setMatches(allMatches)
      setNextMatch(upcoming[0] ?? null)
      const predMap = {}
      if (Array.isArray(predictions)) {
        predictions.forEach(p => { if (p.my_prediction) predMap[p.match_id] = p.my_prediction })
      }
      setPredictionsMap(predMap)
      setMyNextPrediction(upcoming[0] ? (predMap[upcoming[0].id] ?? null) : null)
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
      const r = await api.delete(`/api/challenges/${id}`)
      if (r?.new_balance != null) onBalanceChange?.(r.new_balance)
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

  function handlePredictionSaved(matchId, h, a) {
    if (matchId != null && h != null && a != null) {
      // Optimistic update — no round-trip needed
      setPredictionsMap(prev => ({
        ...prev,
        [matchId]: { ...(prev[matchId] || {}), home_score_pred: h, away_score_pred: a },
      }))
      if (nextMatch && matchId === nextMatch.id) {
        setMyNextPrediction(prev => ({ ...(prev || {}), home_score_pred: h, away_score_pred: a }))
      }
    } else {
      // Full reload (called without args from legacy callers)
      api.get("/api/predictions").then(preds => {
        const predMap = {}
        if (Array.isArray(preds)) preds.forEach(p => { if (p.my_prediction) predMap[p.match_id] = p.my_prediction })
        setPredictionsMap(predMap)
        const upcoming = matches.filter(m => m.status === "upcoming")
        setMyNextPrediction(upcoming[0] ? (predMap[upcoming[0].id] ?? null) : null)
      }).catch(() => {})
    }
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
            {!loading && (
              <NextMatchHero
                match={nextMatch}
                navigate={navigate}
                myPrediction={myNextPrediction}
                onPredictionSaved={handlePredictionSaved}
              />
            )}

            {/* Daily group feed */}
            {!loading && (
              <DailyFeed
                predictions={predictionsMap}
                onPredictionSaved={handlePredictionSaved}
              />
            )}

            {/* Two-column: My team + Rankings */}
            {!loading && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <MyTeamCard
                  favoriteTeam={favoriteTeam}
                  matches={matches}
                  onPickTeam={() => setShowTeamPicker(true)}
                  predictionsMap={predictionsMap}
                  onPredictionSaved={handlePredictionSaved}
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
