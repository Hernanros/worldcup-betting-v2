import { useState, useEffect } from "react"
import { api } from "../api.js"
import { flagUrl } from "../data/teams.js"
import TournamentBetPanel from "../components/TournamentBetPanel.jsx"
import PageBackground from "../components/PageBackground.jsx"
import HelpTip from "../components/HelpTip.jsx"

const STATUS_COLOR = { pending: "#fbbf24", won: "#4ade80", lost: "#f87171" }

const TABS = [
  { key: "bets",     label: "🏆 Bets" },
  { key: "groups",   label: "📊 Groups" },
  { key: "bracket",  label: "🗺 Bracket" },
]

// ── shared style helpers ──────────────────────────────────────────────────────
const CARD = {
  background: "#13131f", border: "1px solid #2d2b55",
  borderRadius: 12, padding: 16, marginBottom: 16,
}

// ── BetsTab (existing tournament bets UX) ────────────────────────────────────
const STATUS_LABEL = { pending: "OPEN", won: "WON", lost: "LOST" }
const STATUS_COLOR_PRE = { pending: "#4ade80", won: "#4ade80", lost: "#f87171" }

function BetsTab() {
  const [tournament, setTournament] = useState(null)
  const [error, setError] = useState(null)

  async function load() {
    setError(null)
    try {
      const t = await api.get("/api/tournament/bets")
      setTournament(t)
    } catch (err) {
      setError(err.message || "Failed to load tournament bets")
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div>
      {error && <p style={{ color: "#f87171", textAlign: "center", fontSize: 13 }}>⚠ {error}</p>}

      <div style={CARD}>
        <h3 style={{ color: "#a78bfa", fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
          Place a Long-Term Bet
        </h3>
        <TournamentBetPanel onBetPlaced={load} />
      </div>

      {tournament && tournament.my_bets.length > 0 && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ color: "#6b7280", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, margin: 0 }}>
              Your Tournament Bets
            </h3>
            {!tournament.locked && (
              <span style={{ color: "#6b7280", fontSize: 10 }}>Place again to change your pick ↑</span>
            )}
          </div>
          {tournament.my_bets.map((b) => {
            const isPreLock = !tournament.locked && b.status === "pending"
            const statusColor = isPreLock ? "#4ade80" : (STATUS_COLOR[b.status] || "#fbbf24")
            const statusLabel = isPreLock ? "OPEN" : b.status.toUpperCase()
            return (
              <div key={b.id} style={{ ...CARD, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>
                      {b.bet_type.replaceAll("_", " ")}
                    </div>
                    <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 14,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.selection}</div>
                    <div style={{ color: "#6b7280", fontSize: 11, marginTop: 4 }}>
                      {b.stake} tokens @ {b.odds}x →{" "}
                      <span style={{ color: "#4ade80" }}>win {Math.floor(b.stake * b.odds).toLocaleString()}</span>
                    </div>
                  </div>
                  <span style={{ color: statusColor, fontSize: 10, fontWeight: 700, background: "#0c0c14", padding: "3px 8px", borderRadius: 999, border: "1px solid #2d2b55" }}>
                    {statusLabel}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tournament && tournament.my_bets.length === 0 && (
        <p style={{ color: "#6b7280", textAlign: "center", fontSize: 13, marginTop: 8 }}>
          No tournament bets yet — pick one above! 👆
        </p>
      )}
    </div>
  )
}

// ── GroupsTab ────────────────────────────────────────────────────────────────

function TeamFlag({ name, size = 20 }) {
  const [err, setErr] = useState(false)
  const url = flagUrl(name, size)
  if (err || !url) return <span style={{ fontSize: 14 }}>🏳</span>
  return (
    <img
      src={url}
      onError={() => setErr(true)}
      alt={name}
      width={size}
      height={size * 0.67}
      style={{ borderRadius: 2, objectFit: "cover", flexShrink: 0 }}
    />
  )
}

function GroupTable({ letter, rows }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#a78bfa", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
        Group {letter}
      </div>
      <div style={{ ...CARD, padding: "8px 0", marginBottom: 0 }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 28px 28px 28px 28px 42px", alignItems: "center", padding: "0 12px 6px", borderBottom: "1px solid #2d2b55", marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, textTransform: "uppercase" }}>Team</span>
          {["P", "W", "D", "L"].map(h => (
            <span key={h} style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, textAlign: "center" }}>{h}</span>
          ))}
          <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, textAlign: "center", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
            Pts<HelpTip text="P=Played W=Wins D=Draws L=Losses Pts=Points (3 for a win, 1 for a draw). Top 2 in each group advance automatically; 3rd enters the wildcard race." />
          </span>
        </div>
        {/* Rows */}
        {rows.map((row, idx) => {
          const isAdvance = idx < 2
          const isWildcard = idx === 2
          const rowBg = isAdvance ? "#0c1a0f" : isWildcard ? "#1a1500" : "transparent"
          return (
            <div key={row.team} style={{ display: "grid", gridTemplateColumns: "1fr 28px 28px 28px 28px 42px", alignItems: "center", padding: "6px 12px", background: rowBg, borderLeft: isAdvance ? "3px solid #4ade80" : isWildcard ? "3px solid #fbbf24" : "3px solid transparent" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 10, color: "#4b5563", fontWeight: 700, minWidth: 12 }}>{idx + 1}</span>
                <TeamFlag name={row.team} size={20} />
                <span style={{ fontSize: 12, color: "#e2e8f0", fontWeight: idx === 0 ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.team}</span>
              </div>
              {["played", "won", "drawn", "lost"].map(k => (
                <span key={k} style={{ fontSize: 12, color: "#9ca3af", textAlign: "center" }}>{row[k]}</span>
              ))}
              <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", textAlign: "center" }}>{row.pts}</span>
            </div>
          )
        })}
        {/* Legend */}
        <div style={{ display: "flex", gap: 14, padding: "6px 12px 2px", borderTop: "1px solid #2d2b55", marginTop: 4 }}>
          <span style={{ fontSize: 9, color: "#4ade80" }}>■ Advance</span>
          <span style={{ fontSize: 9, color: "#fbbf24" }}>■ Wildcard zone</span>
        </div>
      </div>
    </div>
  )
}

function WildcardsTable({ wildcards }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#fbbf24", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
        🃏 Wildcard Race — Best 3rd-Place (Top 8 Advance)
        <HelpTip text="In WC 2026, all 12 groups produce one 3rd-place team. The 8 best 3rd-place teams advance to the Round of 32 as wildcards. Ranked by: points → goal difference → goals scored." />
      </div>
      <div style={{ ...CARD, padding: "8px 0", marginBottom: 0 }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 34px 28px 36px 36px", alignItems: "center", padding: "0 12px 6px", borderBottom: "1px solid #2d2b55", marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, textAlign: "center" }}>#</span>
          <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, textTransform: "uppercase" }}>Team</span>
          <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, textAlign: "center" }}>Grp</span>
          <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, textAlign: "center" }}>Pts</span>
          <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, textAlign: "center", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
            GD<HelpTip text="Goal Difference = goals scored minus goals conceded. Used as tiebreaker when points are equal." />
          </span>
          <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, textAlign: "center" }}>GF</span>
        </div>
        {wildcards.map((row) => {
          const inZone = row.advances
          const isEdge = row.wildcard_rank === 8  // last slot in = critical bubble
          return (
            <div key={row.team} style={{
              display: "grid", gridTemplateColumns: "28px 1fr 34px 28px 36px 36px",
              alignItems: "center", padding: "6px 12px",
              background: inZone ? "#1a1500" : "transparent",
              borderLeft: inZone ? "3px solid #fbbf24" : "3px solid transparent",
              borderBottom: isEdge ? "2px dashed #fbbf2455" : undefined,
            }}>
              <span style={{ fontSize: 11, color: inZone ? "#fbbf24" : "#4b5563", fontWeight: 700, textAlign: "center" }}>{row.wildcard_rank}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                <TeamFlag name={row.team} size={18} />
                <span style={{ fontSize: 12, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.team}</span>
              </div>
              <span style={{ fontSize: 11, color: "#a78bfa", fontWeight: 700, textAlign: "center" }}>{row.group}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", textAlign: "center" }}>{row.pts}</span>
              <span style={{ fontSize: 12, color: row.gd >= 0 ? "#4ade80" : "#f87171", textAlign: "center" }}>
                {row.gd >= 0 ? `+${row.gd}` : row.gd}
              </span>
              <span style={{ fontSize: 12, color: "#9ca3af", textAlign: "center" }}>{row.gf}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function GroupsTab() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get("/api/tournament/standings")
      .then(setData)
      .catch(e => setError(e.message || "Failed to load standings"))
  }, [])

  if (error) return <p style={{ color: "#f87171", textAlign: "center", fontSize: 13 }}>⚠ {error}</p>
  if (!data) return <p style={{ color: "#6b7280", textAlign: "center", fontSize: 13 }}>Loading standings…</p>

  return (
    <div>
      {Object.entries(data.groups).map(([letter, rows]) => (
        <GroupTable key={letter} letter={letter} rows={rows} />
      ))}
      <WildcardsTable wildcards={data.wildcards} />
    </div>
  )
}

// ── BracketTab ───────────────────────────────────────────────────────────────

const ROUND_LABELS = {
  r32: "⚔️ Round of 32",
  r16: "🏟 Round of 16",
  qf:  "🥊 Quarter-Finals",
  sf:  "🌟 Semi-Finals",
  final: "🏆 Final",
}

function BracketMatch({ m }) {
  const isFinished = m.status === "finished"
  const homeWon = isFinished && m.home_score > m.away_score
  const awayWon = isFinished && m.away_score > m.home_score
  const ko = m.kickoff_time ? new Date(m.kickoff_time) : null

  const teamRow = (name, confirmed, won) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", background: won ? "#0c1a0f" : "transparent" }}>
      {confirmed
        ? <TeamFlag name={name} size={18} />
        : <span style={{ fontSize: 14, width: 20 }}>❓</span>}
      <span style={{ flex: 1, fontSize: 12, color: confirmed ? "#e2e8f0" : "#6b7280", fontWeight: won ? 700 : 400, fontStyle: confirmed ? "normal" : "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {confirmed ? name : <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>TBD<HelpTip text="To Be Determined — this slot fills in once the previous round match is settled." /></span>}
      </span>
      {isFinished && (
        <span style={{ fontSize: 13, fontWeight: 700, color: won ? "#4ade80" : "#9ca3af", minWidth: 14, textAlign: "right" }}>
          {name === m.home_team ? m.home_score : m.away_score}
        </span>
      )}
    </div>
  )

  return (
    <div style={{ border: "1px solid #2d2b55", borderRadius: 8, overflow: "hidden", marginBottom: 8, background: "#13131f" }}>
      {ko && (
        <div style={{ fontSize: 9, color: "#6b7280", padding: "3px 10px", background: "#0c0c14", borderBottom: "1px solid #2d2b55", textTransform: "uppercase", letterSpacing: 0.5 }}>
          {ko.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {ko.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
          {m.status === "finished" && <span style={{ marginLeft: 6, color: "#888" }}>FT</span>}
          {m.status === "upcoming" && <span style={{ marginLeft: 6, color: "#fbbf24" }}>Upcoming</span>}
        </div>
      )}
      {teamRow(m.home_team, m.home_confirmed, homeWon)}
      <div style={{ height: 1, background: "#2d2b55" }} />
      {teamRow(m.away_team, m.away_confirmed, awayWon)}
    </div>
  )
}

function BracketTab() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get("/api/tournament/bracket")
      .then(setData)
      .catch(e => setError(e.message || "Failed to load bracket"))
  }, [])

  if (error) return <p style={{ color: "#f87171", textAlign: "center", fontSize: 13 }}>⚠ {error}</p>
  if (!data) return <p style={{ color: "#6b7280", textAlign: "center", fontSize: 13 }}>Loading bracket…</p>

  const ORDER = ["r32", "r16", "qf", "sf", "final"]

  return (
    <div>
      {ORDER.map(rnd => {
        const matches = data.rounds[rnd] || []
        return (
          <div key={rnd} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: matches.length > 0 ? "#60a5fa" : "#4b5563", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
              {ROUND_LABELS[rnd]}
              {matches.length === 0 && <span style={{ marginLeft: 8, color: "#f59e0b", fontSize: 10, background: "#f59e0b22", borderRadius: 4, padding: "1px 6px" }}>Soon</span>}
              {matches.length > 0 && <span style={{ marginLeft: 8, fontSize: 10, color: "#6b7280" }}>{matches.length} match{matches.length > 1 ? "es" : ""}</span>}
            </div>
            {matches.length === 0 ? (
              <div style={{ ...CARD, padding: 12, textAlign: "center" }}>
                <p style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>Bracket not yet drawn — unlocks when this round is seeded.</p>
              </div>
            ) : (
              matches.map(m => <BracketMatch key={m.id} m={m} />)
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── TournamentPage (orchestrator) ────────────────────────────────────────────

export default function TournamentPage() {
  const [tab, setTab] = useState("bets")

  return (
    <div>
      <PageBackground momentKey="messi_2022" />
      <div style={{ padding: "16px 16px 8px" }}>
        <div style={{ fontSize: 24 }}>🏆</div>
        <div style={{ color: "#e2e8f0", fontWeight: 800, fontSize: 20, marginTop: 4 }}>Tournament</div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "1px solid #2d2b55", margin: "0 16px 16px", gap: 2 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "8px 14px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
            background: "transparent",
            color: tab === t.key ? "#a78bfa" : "#6b7280",
            borderBottom: tab === t.key ? "2px solid #a78bfa" : "2px solid transparent",
            marginBottom: -1,
            transition: "color 0.15s",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "0 16px 80px" }}>
        {tab === "bets"    && <BetsTab />}
        {tab === "groups"  && <GroupsTab />}
        {tab === "bracket" && <BracketTab />}
      </div>
    </div>
  )
}
