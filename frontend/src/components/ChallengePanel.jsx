import { useState } from "react"
import { api } from "../api.js"
import HelpTip from "./HelpTip.jsx"

/* ── Dare types ────────────────────────────────────────────── */
const DARE_TYPES = [
  { key: "btts",         label: "🎯 Both Score?",  short: "Both Score",   yesNo: true,  hint: "Will both teams score at least one goal?" },
  { key: "any_red_card", label: "🟥 Red Card?",    short: "Red Card",     yesNo: true,  hint: "Will there be at least one red card shown?" },
  { key: "went_to_et",   label: "⏱ Extra Time?",   short: "Extra Time",   yesNo: true,  hint: "Will the match go to extra time? (knockout rounds only)" },
  { key: "went_to_pens", label: "🥅 Penalties?",   short: "Penalties",    yesNo: true,  hint: "Will it go all the way to a penalty shootout?" },
  { key: "totals",       label: "⚽ Goals Line",   short: "Goals",        yesNo: false, hint: "Over/Under total goals in the match",       presets: ["Over 1.5", "Over 2.5", "Over 3.5", "Under 2.5", "Under 3.5"] },
  { key: "total_cards",  label: "🟨 Cards Line",   short: "Cards",        yesNo: false, hint: "Over/Under total cards (yellow + red)",     presets: ["Over 2.5", "Over 3.5", "Under 3.5", "Under 4.5"] },
  { key: "corners",      label: "🔺 Corners Line", short: "Corners",      yesNo: false, hint: "Over/Under total corner kicks",             presets: ["Over 8.5", "Over 9.5", "Over 10.5", "Under 9.5"] },
  { key: "offsides",     label: "🚩 Offsides Line",short: "Offsides",     yesNo: false, hint: "Over/Under total offside calls in the match", presets: ["Over 2.5", "Over 3.5", "Under 3.5"] },
  { key: "handicap", label: "🎲 Handicap", short: "Handicap", yesNo: false, handicap: true,
    hint: "Give a team a head start: 'Argentina +1.5' wins even if they draw or lose by 1 goal" },
  { key: "player_h2h", label: "⚽ Player H2H", short: "Player H2H", yesNo: false, playerH2H: true,
    hint: "Dare on which player wins a stat duel — e.g. Messi vs Mbappé, who scores more goals?" },
]

/* ── Star players by WC 2026 team ──────────────────────────────── */
const STAR_PLAYERS = {
  "Argentina":    ["Messi", "Di María", "Álvarez", "Mac Allister"],
  "France":       ["Mbappé", "Griezmann", "Dembélé", "Camavinga"],
  "Brazil":       ["Vini Jr", "Rodrygo", "Raphinha", "Paquetá"],
  "England":      ["Bellingham", "Saka", "Foden", "Kane"],
  "Portugal":     ["Ronaldo", "B. Silva", "Félix", "R. Leão"],
  "Spain":        ["Pedri", "Yamal", "Morata", "Olmo"],
  "Germany":      ["Müller", "Wirtz", "Gnabry", "Havertz"],
  "Netherlands":  ["Van Dijk", "Gakpo", "Depay", "Simons"],
  "Uruguay":      ["Núñez", "Valverde", "Araújo"],
  "Colombia":     ["James", "Díaz", "Arias"],
  "USA":          ["Pulisic", "Reyna", "Adams"],
  "Mexico":       ["Lozano", "Guardado", "Raúl"],
  "Morocco":      ["En-Nesyri", "Hakimi", "Ziyech"],
  "Senegal":      ["Mané", "Dia", "Sarr"],
  "Japan":        ["Mitoma", "Kubo", "Kamada"],
  "South Korea":  ["Son", "Lee Kang-In", "Hwang"],
  "Croatia":      ["Modrić", "Kovačić", "Gvardiol"],
  "Belgium":      ["De Bruyne", "Lukaku", "Tielemans"],
  "Italy":        ["Barella", "Tonali", "Scamacca"],
  "Poland":       ["Lewandowski", "Zieliński", "Szymański"],
  "Switzerland":  ["Xhaka", "Shaqiri", "Embolo"],
  "Australia":    ["Hrustic", "Irvine", "Boyle"],
  "Canada":       ["Davies", "David", "Buchanan"],
  "Ecuador":      ["Caicedo", "Plata", "Enner Valencia"],
  "Iran":         ["Taremi", "Jahanbakhsh", "Azmoun"],
  "Saudi Arabia": ["Al-Dawsari", "Al-Shahrani", "Al-Malki"],
  "Cameroon":     ["Onana", "Aboubakar", "Choupo-Moting"],
  "Ghana":        ["Kudus", "Partey", "Ayew"],
  "Nigeria":      ["Lookman", "Osimhen", "Iheanacho"],
  "South Africa": ["Tau", "Dolly", "Zwane"],
  "Qatar":        ["Al-Haydos", "Afif", "Al-Rawi"],
}

function _teamPool(match) {
  const home = STAR_PLAYERS[match.home_team] || []
  const away = STAR_PLAYERS[match.away_team] || []
  return [...home, ...away]
}

function oppositeOf(type, sel) {
  if (type.yesNo) return sel === "Yes" ? "No" : sel === "No" ? "Yes" : ""
  if (sel?.startsWith("Over "))  return sel.replace("Over ", "Under ")
  if (sel?.startsWith("Under ")) return sel.replace("Under ", "Over ")
  return ""
}

/* ── YesNo picker ──────────────────────────────────────────── */
function YesNoPicker({ value, onChange, label }) {
  return (
    <div>
      <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", gap: 6 }}>
        {["Yes", "No"].map(opt => (
          <button key={opt} onClick={() => onChange(opt)} style={{
            flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 700,
            cursor: "pointer", border: "1px solid",
            background: value === opt ? (opt === "Yes" ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)") : "transparent",
            borderColor: value === opt ? (opt === "Yes" ? "rgba(74,222,128,0.5)" : "rgba(248,113,113,0.5)") : "#2d2b55",
            color: value === opt ? (opt === "Yes" ? "#4ade80" : "#f87171") : "#6b7280",
          }}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── Preset chips ──────────────────────────────────────────── */
function PresetChips({ presets, value, onChange }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
      {presets.map(p => (
        <button key={p} onClick={() => onChange(p)} style={{
          padding: "3px 10px", borderRadius: 999, fontSize: 10, fontWeight: 700, cursor: "pointer", border: "1px solid",
          background: value === p ? "rgba(168,85,247,0.2)" : "transparent",
          borderColor: value === p ? "rgba(168,85,247,0.6)" : "#2d2b55",
          color: value === p ? "#c4b5fd" : "#6b7280",
        }}>
          {p}
        </button>
      ))}
    </div>
  )
}

/* ── Handicap picker ───────────────────────────────────────── */
function HandicapPicker({ match, selection, onPick }) {
  const LINES = ["+0.5", "+1", "+1.5", "+2", "+2.5"]
  // Parse current selection if any: "Argentina +1.5" → team="Argentina", line="+1.5"
  const parts = selection ? selection.split(" ") : []
  const currentLine = parts.length >= 2 ? parts[parts.length - 1] : null
  const currentTeam = parts.length >= 2 ? parts.slice(0, -1).join(" ") : null

  function pick(team, line) {
    const otherTeam = team === match.home_team ? match.away_team : match.home_team
    const neg = line.replace("+", "-")
    // issuerSel used for settlement; acceptorSel is display-only
    onPick(`${team} ${line}`, `${otherTeam} ${neg}`)
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 3 }}>
        Which team are <strong style={{ color: "#a78bfa" }}>you</strong> backing with a head-start?
      </div>
      <div style={{ color: "#4b5563", fontSize: 9, marginBottom: 8 }}>
        Your team gets extra virtual goals — they can lose and you still win.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
        {[match.home_team, match.away_team].map(team => (
          <button key={team} onClick={() => pick(team, currentLine || "+1")} style={{
            padding: "8px 4px", borderRadius: 8, fontSize: 11, fontWeight: 700,
            cursor: "pointer", border: "1px solid",
            background: currentTeam === team ? "rgba(168,85,247,0.2)" : "transparent",
            borderColor: currentTeam === team ? "rgba(168,85,247,0.6)" : "#2d2b55",
            color: currentTeam === team ? "#c4b5fd" : "#6b7280",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {currentTeam === team ? `✓ ${team}` : team}
          </button>
        ))}
      </div>
      <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 4 }}>
        Head-start size (goals)
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {LINES.map(line => (
          <button key={line} onClick={() => pick(currentTeam || match.home_team, line)} style={{
            padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
            cursor: "pointer", border: "1px solid",
            background: currentLine === line ? "rgba(168,85,247,0.2)" : "transparent",
            borderColor: currentLine === line ? "rgba(168,85,247,0.6)" : "#2d2b55",
            color: currentLine === line ? "#c4b5fd" : "#6b7280",
          }}>
            {line}
          </button>
        ))}
      </div>
      {selection && (
        <div style={{ marginTop: 8, padding: "8px 10px", background: "rgba(168,85,247,0.08)",
          borderRadius: 8, border: "1px solid rgba(168,85,247,0.2)" }}>
          <div style={{ color: "#c4b5fd", fontSize: 11, fontWeight: 700, marginBottom: 2 }}>
            ✓ You back: {selection}
          </div>
          <div style={{ color: "#6b7280", fontSize: 10 }}>
            You win if {currentTeam} loses by fewer than {currentLine?.replace("+", "")} {currentLine === "+1" ? "goal" : "goals"}, draws, or wins outright.
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Player H2H picker ─────────────────────────────────────────── */
function PlayerH2HPicker({ match, selection, acceptorSelection, onPick }) {
  const pool = _teamPool(match)
  // Selection format: "{player name} {stat}" — stat is always the last token.
  // Multi-word names (e.g. "Enner Valencia goals") work correctly because
  // "goals"/"assists" are the only valid last tokens.
  function parse(sel) {
    if (!sel) return { player: "", stat: "goals" }
    const parts = sel.split(" ")
    const stat = parts[parts.length - 1].toLowerCase()
    const player = parts.slice(0, -1).join(" ")
    return { player, stat: (stat === "goals" || stat === "assists") ? stat : "goals" }
  }
  const myParsed    = parse(selection)
  const theirParsed = parse(acceptorSelection)
  const currentStat = myParsed.stat || "goals"

  function pickMy(player) {
    onPick(`${player} ${currentStat}`, theirParsed.player ? `${theirParsed.player} ${currentStat}` : "")
  }
  function pickTheir(player) {
    onPick(myParsed.player ? `${myParsed.player} ${currentStat}` : "", `${player} ${currentStat}`)
  }
  function pickStat(stat) {
    onPick(
      myParsed.player    ? `${myParsed.player} ${stat}`    : "",
      theirParsed.player ? `${theirParsed.player} ${stat}` : "",
    )
  }

  const chipStyle = (active) => ({
    padding: "3px 10px", borderRadius: 999, fontSize: 10, fontWeight: 700,
    cursor: "pointer", border: "1px solid",
    background: active ? "rgba(168,85,247,0.2)" : "transparent",
    borderColor: active ? "rgba(168,85,247,0.6)" : "#2d2b55",
    color: active ? "#c4b5fd" : "#6b7280",
  })

  return (
    <div style={{ marginBottom: 10 }}>
      {pool.length === 0 && (
        <div style={{ color: "#6b7280", fontSize: 11, marginBottom: 8 }}>
          No featured players for this match.
        </div>
      )}
      {/* Your player */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 4 }}>Your player</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {pool.map(p => (
            <button key={p} onClick={() => pickMy(p)} disabled={p === theirParsed.player}
              title={p === theirParsed.player ? `${p} already picked by opponent` : p}
              style={{ ...chipStyle(p === myParsed.player), opacity: p === theirParsed.player ? 0.3 : 1 }}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Their player */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 4 }}>Their player</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {pool.map(p => (
            <button key={p} onClick={() => pickTheir(p)} disabled={p === myParsed.player}
              title={p === myParsed.player ? `${p} already picked by you` : p}
              style={{ ...chipStyle(p === theirParsed.player), opacity: p === myParsed.player ? 0.3 : 1 }}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Stat */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 4 }}>Stat</div>
        <div style={{ display: "flex", gap: 6 }}>
          {["goals", "assists"].map(s => (
            <button key={s} onClick={() => pickStat(s)} style={{
              ...chipStyle(currentStat === s),
              padding: "5px 16px", fontSize: 11,
            }}>
              {s === "goals" ? "⚽ Goals" : "🅰️ Assists"}
            </button>
          ))}
        </div>
      </div>

      {/* Summary pill */}
      {myParsed.player && theirParsed.player && (
        <div style={{ marginTop: 8, padding: "8px 10px",
          background: "rgba(168,85,247,0.08)",
          borderRadius: 8, border: "1px solid rgba(168,85,247,0.2)" }}>
          <div style={{ color: "#c4b5fd", fontSize: 11, fontWeight: 700 }}>
            ⚔️ {myParsed.player} ({currentStat}) vs {theirParsed.player} ({currentStat})
          </div>
          <div style={{ color: "#6b7280", fontSize: 10, marginTop: 2 }}>
            You back {myParsed.player} · they back {theirParsed.player}. Tie = void (full refund).
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Main ──────────────────────────────────────────────────── */
export default function ChallengePanel({ match, challenges, onUpdate, onBalanceChange, prefill, playerStreak = 0, totalChallenges = 0 }) {
  const [issuerStake, setIssuerStake] = useState(prefill?.stake ?? 100)
  const [issuerOdds, setIssuerOdds] = useState(prefill?.my_odds ?? 2.0)
  const [acceptorOdds, setAcceptorOdds] = useState(prefill?.their_odds ?? 2.0)
  const [selection, setSelection] = useState(prefill?.my_pick ?? "")
  const [acceptorSelection, setAcceptorSelection] = useState(prefill?.their_pick ?? "")
  const [betType, setBetType] = useState(prefill?.bet_type ?? "btts")
  const [loading, setLoading] = useState(false)
  const [acceptingId, setAcceptingId] = useState(null)
  const [msg, setMsg] = useState("")
  const [shareUrl, setShareUrl] = useState("")

  const currentType = DARE_TYPES.find(t => t.key === betType) || DARE_TYPES[0]

  const acceptorStake = acceptorOdds > 0
    ? Math.max(1, Math.round(issuerStake * (issuerOdds / acceptorOdds)))
    : 0

  function handleMyPick(sel) {
    setSelection(sel)
    setAcceptorSelection(oppositeOf(currentType, sel))
  }

  function switchType(key) {
    setBetType(key)
    setSelection("")
    setAcceptorSelection("")
    setMsg("")
  }

  async function issueDare() {
    if (!selection || !acceptorSelection) return setMsg("Pick your side first")
    if (!issuerStake || issuerStake <= 0) return setMsg("Stake must be positive")
    setLoading(true); setMsg("")
    try {
      const r = await api.post(`/api/matches/${match.id}/challenges`, {
        bet_type: betType, selection, acceptor_selection: acceptorSelection,
        issuer_stake: issuerStake, issuer_odds: issuerOdds, acceptor_odds: acceptorOdds,
      })
      setMsg(`✓ Dare issued! Balance: ${r.new_balance}`)
      setShareUrl(`${window.location.origin}/matches/${match.id}`)
      setSelection(""); setAcceptorSelection("")
      onBalanceChange?.(r.new_balance)
      onUpdate?.()
    } catch (err) { setMsg(`✗ ${err.message}`) }
    finally { setLoading(false) }
  }

  async function acceptDare(challengeId) {
    setAcceptingId(challengeId)
    try {
      const r = await api.post(`/api/challenges/${challengeId}/accept`, {})
      setMsg(`✓ Dare accepted! Balance: ${r.new_balance}`)
      onBalanceChange?.(r.new_balance)
      onUpdate?.()
    } catch (err) { setMsg(`✗ ${err.message}`) }
    finally { setAcceptingId(null) }
  }

  const streakBonus = playerStreak >= 5 ? "+35%" : playerStreak === 4 ? "+20%" : playerStreak === 3 ? "+10%" : null
  const MILESTONES = [[5, 50], [10, 150], [20, 400]]
  const nextMilestone = MILESTONES.find(([t]) => totalChallenges < t)
  const milestoneText = nextMilestone
    ? `${nextMilestone[0] - totalChallenges} more dare${nextMilestone[0] - totalChallenges === 1 ? "" : "s"} → ${nextMilestone[1]} token bonus`
    : null

  return (
    <div style={{ background: "#13131f", border: "1px solid #2d2b55", borderRadius: 12, padding: 16, marginBottom: 12 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <h3 style={{ color: "#a78bfa", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
          ⚔️ Dare a Friend
          <HelpTip text="Pick a spicy outcome, set your stake, and dare a friend to take the other side. Covers things you can't predict in the main section — red cards, extra time, corners, offsides." />
        </h3>
        {playerStreak >= 3 && (
          <div style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.4)",
            borderRadius: 999, padding: "3px 10px", fontSize: 10, color: "#c4b5fd", fontWeight: 700 }}>
            🔥 {playerStreak} streak{streakBonus ? ` — ${streakBonus} bonus` : ""}
          </div>
        )}
      </div>

      {milestoneText && (
        <div style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)",
          borderRadius: 8, padding: "6px 10px", fontSize: 10, color: "#4ade80", fontWeight: 600, marginBottom: 10 }}>
          🎯 {milestoneText}
        </div>
      )}

      {/* Issue form */}
      <div style={{ background: "#0c0c14", border: "1px solid #2d2b55", borderRadius: 10, padding: 12, marginBottom: 12 }}>

        {/* Dare type pills */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: 0.8, marginBottom: 6 }}>
            What are you daring?
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {DARE_TYPES.map(({ key, label, hint }) => (
              <button
                key={key}
                title={hint}
                onClick={() => switchType(key)}
                style={{
                  padding: "4px 10px", borderRadius: 999, fontSize: 10, fontWeight: 700,
                  cursor: "pointer", border: "1px solid",
                  background: betType === key ? "rgba(168,85,247,0.2)" : "transparent",
                  borderColor: betType === key ? "rgba(168,85,247,0.6)" : "#2d2b55",
                  color: betType === key ? "#c4b5fd" : "#6b7280",
                  transition: "all 0.1s",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Hint */}
        <p style={{ color: "#4b5563", fontSize: 10, marginBottom: 10, lineHeight: 1.4 }}>
          {currentType.hint}
        </p>

        {/* Pick section */}
        {currentType.yesNo ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <YesNoPicker label="Your call" value={selection} onChange={handleMyPick} />
            <YesNoPicker label="Their call (auto)" value={acceptorSelection}
              onChange={v => { setAcceptorSelection(v); setSelection(oppositeOf(currentType, v)) }} />
          </div>
        ) : currentType.playerH2H ? (
          <PlayerH2HPicker
            match={match}
            selection={selection}
            acceptorSelection={acceptorSelection}
            onPick={(sel, acceptSel) => { setSelection(sel); setAcceptorSelection(acceptSel) }}
          />
        ) : currentType.handicap ? (
          <HandicapPicker
            match={match}
            selection={selection}
            onPick={(sel, acceptSel) => { setSelection(sel); setAcceptorSelection(acceptSel) }}
          />
        ) : (
          <div style={{ marginBottom: 10 }}>
            {currentType.presets && (
              <>
                <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 4 }}>Your pick (tap to select)</div>
                <PresetChips presets={currentType.presets} value={selection} onChange={handleMyPick} />
              </>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 3 }}>Your pick</div>
                <input value={selection} onChange={e => handleMyPick(e.target.value)} placeholder="e.g. Over 2.5"
                  style={{ width: "100%", boxSizing: "border-box", background: "#13131f", border: "1px solid #2d2b55",
                    borderRadius: 6, padding: "6px 10px", color: "#e2e8f0", fontSize: 12 }} />
              </div>
              <div>
                <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 3 }}>Their pick (auto)</div>
                <input value={acceptorSelection} onChange={e => { setAcceptorSelection(e.target.value); setSelection(oppositeOf(currentType, e.target.value)) }}
                  placeholder="e.g. Under 2.5"
                  style={{ width: "100%", boxSizing: "border-box", background: "#13131f", border: "1px solid #2d2b55",
                    borderRadius: 6, padding: "6px 10px", color: "#e2e8f0", fontSize: 12 }} />
              </div>
            </div>
          </div>
        )}

        {/* Stakes & odds */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
          <div>
            <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 3 }}>Your stake</div>
            <input type="number" value={issuerStake} onChange={e => setIssuerStake(Number(e.target.value))}
              style={{ width: "100%", boxSizing: "border-box", background: "#13131f", border: "1px solid #2d2b55",
                borderRadius: 6, padding: "6px 8px", color: "#e2e8f0", fontSize: 12 }} />
          </div>
          <div>
            <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 3 }}>Your odds</div>
            <input type="number" step="0.1" value={issuerOdds} onChange={e => setIssuerOdds(Number(e.target.value))}
              style={{ width: "100%", boxSizing: "border-box", background: "#13131f", border: "1px solid #2d2b55",
                borderRadius: 6, padding: "6px 8px", color: "#e2e8f0", fontSize: 12 }} />
          </div>
          <div>
            <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 3 }}>Their odds</div>
            <input type="number" step="0.1" value={acceptorOdds} onChange={e => setAcceptorOdds(Number(e.target.value))}
              style={{ width: "100%", boxSizing: "border-box", background: "#13131f", border: "1px solid #2d2b55",
                borderRadius: 6, padding: "6px 8px", color: "#e2e8f0", fontSize: 12 }} />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ color: "#a78bfa", fontSize: 11, margin: 0 }}>
            Their stake: <strong>{acceptorStake}</strong> tokens
            <HelpTip text="Their stake = your stake × (your odds ÷ their odds). Equal odds = equal stakes." />
          </p>
          <button onClick={issueDare} disabled={loading} style={{
            background: "linear-gradient(135deg,#a855f7,#3b82f6)", color: "#fff",
            border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 12, fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
          }}>
            {loading ? "..." : "💥 Send Dare"}
          </button>
        </div>
      </div>

      {/* Incoming dares to accept */}
      {challenges?.length > 0 && (
        <div>
          <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: 0.8, marginBottom: 8 }}>
            ⚔️ Dares waiting for you
          </p>
          {challenges.map((c) => {
            const typeInfo = DARE_TYPES.find(t => t.key === c.bet_type)
            return (
              <div key={c.id} style={{
                background: "linear-gradient(135deg, rgba(168,85,247,0.06), rgba(59,130,246,0.06))",
                border: "1px solid rgba(168,85,247,0.25)",
                borderRadius: 10, padding: "10px 12px", marginBottom: 6,
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {c.issuer_name && (
                    <div style={{ color: "#a78bfa", fontSize: 10, fontWeight: 700, marginBottom: 3 }}>
                      {c.issuer_name} dares you ⚔️
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 700 }}>
                      {typeInfo?.short ?? c.bet_type}:
                    </span>
                    <span style={{ color: "#4ade80", fontSize: 12, fontWeight: 600,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 80 }}>
                      {c.selection}
                    </span>
                    <span style={{ color: "#6b7280", fontSize: 11 }}>vs</span>
                    <span style={{ color: "#f97316", fontSize: 12, fontWeight: 600,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 80 }}>
                      {c.acceptor_selection}
                    </span>
                    <span style={{ color: "#fbbf24", fontSize: 10, whiteSpace: "nowrap" }}>
                      · {c.issuer_stake} vs {c.acceptor_stake} 🪙
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => acceptDare(c.id)}
                  disabled={acceptingId === c.id}
                  style={{
                    flexShrink: 0,
                    background: "linear-gradient(135deg,#a855f7,#3b82f6)", color: "#fff",
                    border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 11, fontWeight: 700,
                    cursor: acceptingId === c.id ? "not-allowed" : "pointer",
                    opacity: acceptingId === c.id ? 0.6 : 1,
                  }}>
                  {acceptingId === c.id ? "..." : "Accept ✓"}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {msg && (
        <p style={{ color: msg.startsWith("✓") ? "#4ade80" : "#f87171", fontSize: 12, marginTop: 8 }}>{msg}</p>
      )}

      {shareUrl && (
        <button
          onClick={() => {
            const type = DARE_TYPES.find(t => t.key === betType)
            const text = `⚔️ I dared you on ${match.home_team} vs ${match.away_team} (${type?.short ?? betType})! Accept here: ${shareUrl}?tab=challenges`
            if (navigator.share) {
              navigator.share({ title: "WC 2026 Dare", text, url: shareUrl }).catch(() => {})
            } else {
              navigator.clipboard.writeText(text)
              setMsg("✓ Link copied — send it to your friend!")
            }
          }}
          style={{
            width: "100%", background: "#1e1b3a", border: "1px solid #a855f7",
            borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 700,
            color: "#a78bfa", cursor: "pointer", marginTop: 6,
          }}
        >
          📤 Share dare link
        </button>
      )}
    </div>
  )
}
