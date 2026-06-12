import { useState, useEffect } from "react"
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
  // Group A
  "Mexico":              ["Lozano", "Jiménez", "Álvarez E.", "Rodríguez"],
  "South Africa":        ["Tau", "Dolly", "Zwane", "Williams"],
  "South Korea":         ["Son", "Lee Kang-In", "Hwang", "Kim Min-jae"],
  "Czechia":             ["Schick", "Souček", "Coufal", "Barák"],
  // Group B
  "Canada":              ["Davies", "David", "Buchanan", "Larin"],
  "Switzerland":         ["Xhaka", "Shaqiri", "Embolo", "Akanji"],
  "Bosnia-Herzegovina":  ["Džeko", "Demirović", "Pjanić", "Kolašinac"],
  "Qatar":               ["Al-Haydos", "Afif", "Almoez Ali", "Al-Rawi"],
  // Group C
  "USA":                 ["Pulisic", "Reyna", "Adams", "Weah"],
  "Turkey":              ["Çalhanoğlu", "Güler", "Yıldız", "Aktürkoğlu"],
  "Paraguay":            ["Almirón", "Sanabria", "Gómez", "Romero"],
  "Australia":           ["Leckie", "Hrustic", "Irvine", "Boyle"],
  // Group D
  "Brazil":              ["Vini Jr", "Rodrygo", "Raphinha", "Paquetá"],
  "Morocco":             ["En-Nesyri", "Hakimi", "Ziyech", "Amrabat"],
  "Haiti":               ["Nazon", "Pierrot", "Saba", "Dalcé"],
  "Scotland":            ["McTominay", "McGinn", "Robertson", "Adams C."],
  // Group E
  "Germany":             ["Müller", "Wirtz", "Gnabry", "Havertz"],
  "Curaçao":             ["Timber", "Bacuna", "Martina", "Menig"],
  "Ivory Coast":         ["Haller", "Kessié", "Pépé", "Zaha"],
  "Ecuador":             ["Caicedo", "Plata", "Enner Valencia", "Hincapié"],
  // Group F
  "Netherlands":         ["Van Dijk", "Gakpo", "Depay", "Simons"],
  "Japan":               ["Mitoma", "Kubo", "Kamada", "Doan"],
  "Sweden":              ["Isak", "Forsberg", "Kulusevski", "Ekdal"],
  "Tunisia":             ["Msakni", "Khazri", "Skhiri", "En-Nésiri"],
  // Group G
  "Spain":               ["Pedri", "Yamal", "Morata", "Olmo"],
  "Cape Verde":          ["G. Rodrigues", "R. Mendes", "Nuno Tavares", "Fortes"],
  "Saudi Arabia":        ["Al-Dawsari", "Al-Shahrani", "Al-Malki", "Kanno"],
  "Uruguay":             ["Núñez", "Valverde", "Araújo", "De Arrascaeta"],
  // Group H
  "Belgium":             ["De Bruyne", "Lukaku", "Tielemans", "Courtois"],
  "Egypt":               ["Salah", "Elneny", "Mostafa Mohamed", "Trezeguet"],
  "Iran":                ["Taremi", "Jahanbakhsh", "Azmoun", "Gholizadeh"],
  "New Zealand":         ["Wood", "Cacace", "Lewis", "T. Smith"],
  // Group I
  "France":              ["Mbappé", "Griezmann", "Dembélé", "Camavinga"],
  "Senegal":             ["Mané", "Dia", "Sarr", "Gueye"],
  "Iraq":                ["Mohanad Ali", "Ali Adnan", "Bashar Resan", "Afif"],
  "Norway":              ["Haaland", "Ødegaard", "Sørloth", "Berge"],
  // Group J
  "Argentina":           ["Messi", "Di María", "Álvarez J.", "Mac Allister"],
  "Algeria":             ["Mahrez", "Bennacer", "Brahimi", "Slimani"],
  "Austria":             ["Alaba", "Sabitzer", "Arnautovic", "Laimer"],
  "Jordan":              ["Musa Al-Taamari", "Yazan Al-Naimat", "Ahmad Harman"],
  // Group K
  "Portugal":            ["Ronaldo", "B. Silva", "Félix", "R. Leão"],
  "DR Congo":            ["Bakambu", "Mbemba", "Bolasie", "Bongonda"],
  "Uzbekistan":          ["Shomurodov", "Masharipov", "Fayzullayev", "Tursunov"],
  "Colombia":            ["James", "Díaz", "Arias", "Borré"],
  // Group L
  "England":             ["Bellingham", "Saka", "Foden", "Kane"],
  "Croatia":             ["Modrić", "Kovačić", "Gvardiol", "Kramarić"],
  "Ghana":               ["Kudus", "Partey", "Ayew", "Semenyo"],
  "Panama":              ["Blackburn", "Fajardo", "Carrasquilla", "Waterman"],
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
            flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 13, fontWeight: 700,
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
  const NEG = ["-2", "-1.5", "-1", "-0.5"]
  const POS = ["+0.5", "+1", "+1.5", "+2"]
  const parts = selection ? selection.split(" ") : []
  const currentLine = parts.length >= 2 ? parts[parts.length - 1] : null
  const currentTeam = parts.length >= 2 ? parts.slice(0, -1).join(" ") : null

  function pick(team, line) {
    const otherTeam = team === match.home_team ? match.away_team : match.home_team
    const mirror = line.startsWith("-") ? "+" + line.slice(1) : "-" + line.slice(1)
    onPick(`${team} ${line}`, `${otherTeam} ${mirror}`)
  }

  function explain(team, line) {
    const n = Math.abs(parseFloat(line))
    if (line.startsWith("-")) return `${team} must win by more than ${n} ${n === 1 ? "goal" : "goals"}`
    if (line === "+0.5") return `${team} must win outright`
    return `${team} wins, draws, or loses by fewer than ${n} goals`
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "#4b5563", marginBottom: 4 }}>
        <span>← must win by margin</span>
        <span>head-start →</span>
      </div>
      {[match.home_team, match.away_team].map(team => {
        const isSel = currentTeam === team
        return (
          <div key={team} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9, fontWeight: 700, marginBottom: 3, textTransform: "uppercase",
              letterSpacing: 0.8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              color: isSel ? "#a78bfa" : "#4b5563" }}>
              {team}
            </div>
            <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
              {NEG.map(line => {
                const on = isSel && currentLine === line
                return <button key={line} onClick={() => pick(team, line)} style={{
                  padding: "4px 7px", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer",
                  border: `1px solid ${on ? "#ef4444" : "#2d2b55"}`,
                  background: on ? "rgba(239,68,68,0.18)" : "transparent",
                  color: on ? "#fca5a5" : "#6b7280",
                }}>{line}</button>
              })}
              <div style={{ width: 1, height: 22, background: "#2d2b55", margin: "0 2px", flexShrink: 0 }} />
              {POS.map(line => {
                const on = isSel && currentLine === line
                return <button key={line} onClick={() => pick(team, line)} style={{
                  padding: "4px 7px", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer",
                  border: `1px solid ${on ? "#a78bfa" : "#2d2b55"}`,
                  background: on ? "rgba(168,85,247,0.2)" : "transparent",
                  color: on ? "#c4b5fd" : "#6b7280",
                }}>{line}</button>
              })}
            </div>
          </div>
        )
      })}
      {selection && (
        <div style={{ marginTop: 6, padding: "8px 10px", borderRadius: 8,
          background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)" }}>
          <div style={{ color: "#c4b5fd", fontSize: 11, fontWeight: 700, marginBottom: 2 }}>
            ✓ {currentTeam} {currentLine}
          </div>
          <div style={{ color: "#9ca3af", fontSize: 10, lineHeight: 1.4 }}>
            {explain(currentTeam, currentLine)}
          </div>
          <div style={{ color: "#4b5563", fontSize: 9, marginTop: 2 }}>
            Their side: {currentTeam === match.home_team ? match.away_team : match.home_team}{" "}
            {currentLine?.startsWith("-") ? "+" + currentLine.slice(1) : "-" + currentLine.slice(1)}
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
export default function ChallengePanel({ match, challenges, onUpdate, onBalanceChange, prefill, playerStreak = 0, totalChallenges = 0, currentPlayerId = null }) {
  const [issuerStake, setIssuerStake] = useState(prefill?.stake ?? 100)
  const [issuerOdds, setIssuerOdds] = useState(prefill?.my_odds ?? 2.0)
  const [acceptorOdds, setAcceptorOdds] = useState(prefill?.their_odds ?? 2.0)
  const [selection, setSelection] = useState(prefill?.my_pick ?? "")
  const [acceptorSelection, setAcceptorSelection] = useState(prefill?.their_pick ?? "")
  const [betType, setBetType] = useState(prefill?.bet_type ?? "btts")
  const [addresseeId, setAddresseeId] = useState(null)
  const [friends, setFriends] = useState([])
  const [loading, setLoading] = useState(false)
  const [acceptingId, setAcceptingId] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)
  const [msg, setMsg] = useState("")
  const [shareUrl, setShareUrl] = useState("")
  const [aiOpen, setAiOpen] = useState(false)

  useEffect(() => {
    api.get("/api/friends").then(data => setFriends(data)).catch(() => {})
  }, [])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState([])
  const [aiError, setAiError] = useState(null)
  const [oddsLoading, setOddsLoading] = useState(false)
  const [oddsReason, setOddsReason] = useState("")

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
      const payload = {
        bet_type: betType, selection, acceptor_selection: acceptorSelection,
        issuer_stake: issuerStake, issuer_odds: issuerOdds, acceptor_odds: acceptorOdds,
      }
      if (addresseeId) payload.addressee_id = addresseeId
      const r = await api.post(`/api/matches/${match.id}/challenges`, payload)
      const addresseeName = friends.find(f => f.id === addresseeId)?.name
      setMsg(`✓ Dare ${addresseeName ? `sent to ${addresseeName}` : "issued"}! Balance: ${r.new_balance}`)
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

  async function cancelDare(challengeId) {
    setCancellingId(challengeId)
    try {
      const r = await api.delete(`/api/challenges/${challengeId}`)
      setMsg(`✓ Dare withdrawn. Refunded ${r.refunded} tokens.`)
      onBalanceChange?.(r.new_balance)
      onUpdate?.()
    } catch (err) { setMsg(`✗ ${err.message}`) }
    finally { setCancellingId(null) }
  }

  async function generateAI() {
    setAiSuggestions([])
    setAiError(null)
    setAiLoading(true)
    try {
      const data = await api.post("/api/ai/suggest-challenge", { match_id: match.id })
      const items = data.suggestions || []
      setAiSuggestions(items)
      if (items.length === 0) setAiError("No suggestions returned — try again.")
    } catch (err) {
      setAiError(err.message || "Failed to generate suggestions")
    } finally {
      setAiLoading(false)
    }
  }

  async function suggestOdds() {
    if (!selection) return
    setOddsLoading(true); setOddsReason("")
    try {
      const data = await api.post("/api/ai/suggest-odds", {
        match_id: match.id, bet_type: betType, selection, acceptor_selection: acceptorSelection,
      })
      if (data.issuer_odds) setIssuerOdds(data.issuer_odds)
      if (data.acceptor_odds) setAcceptorOdds(data.acceptor_odds)
      if (data.reasoning) setOddsReason(data.reasoning)
    } catch { setOddsReason("Could not get suggestion — set manually") }
    finally { setOddsLoading(false) }
  }

  function useThisAI(suggestion) {
    setBetType(suggestion.bet_type ?? betType)
    setSelection(suggestion.my_pick ?? "")
    setAcceptorSelection(suggestion.their_pick ?? "")
    setIssuerOdds(suggestion.my_odds ?? issuerOdds)
    setAcceptorOdds(suggestion.their_odds ?? acceptorOdds)
    setIssuerStake(suggestion.stake ?? issuerStake)
    setMsg("")
    setAiOpen(false)
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

      {/* AI Ideas section */}
      <div style={{ marginBottom: 12 }}>
        <button
          onClick={() => setAiOpen(v => !v)}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "#0d0d1a", border: "1px solid #2d2b55",
            borderRadius: aiOpen ? "8px 8px 0 0" : 8,
            padding: "8px 12px", cursor: "pointer",
          }}
        >
          <span style={{ color: "#a78bfa", fontSize: 12, fontWeight: 700 }}>✨ AI Dare Ideas</span>
          <span style={{ color: "#4b5563", fontSize: 12,
            transform: aiOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s",
            display: "block" }}>▾</span>
        </button>

        {aiOpen && (
          <div style={{
            border: "1px solid #2d2b55", borderTop: "none",
            borderRadius: "0 0 8px 8px", padding: 12,
            background: "#0c0c14",
          }}>
            <button
              onClick={generateAI}
              disabled={aiLoading}
              style={{
                width: "100%",
                background: aiLoading ? "#1e1b3a" : "linear-gradient(135deg, #a855f7, #3b82f6)",
                color: aiLoading ? "#6b7280" : "#fff",
                border: "none", borderRadius: 8, padding: "10px",
                fontSize: 13, fontWeight: 700,
                cursor: aiLoading ? "not-allowed" : "pointer",
                marginBottom: 10,
              }}
            >
              {aiLoading ? "✨ Thinking…" : "✨ Generate Dare Ideas"}
            </button>

            {aiError && (
              <p style={{ color: "#f87171", fontSize: 12, marginBottom: 8 }}>⚠ {aiError}</p>
            )}

            {aiSuggestions.map((s, i) => (
              <div key={i} style={{
                background: "#13131f", border: "1px solid #2d2b55",
                borderRadius: 8, padding: 10, marginBottom: 8,
              }}>
                <div style={{ color: "#a78bfa", fontSize: 11, fontWeight: 700, marginBottom: 3 }}>
                  {s.title}
                </div>
                <div style={{ color: "#9ca3af", fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{s.my_pick}</span>
                  <span style={{ color: "#4b5563", margin: "0 5px" }}>vs</span>
                  <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{s.their_pick}</span>
                  <span style={{ color: "#6b7280", marginLeft: 6 }}>· stake {s.stake} · {s.my_odds}×/{s.their_odds}×</span>
                </div>
                <p style={{ color: "#6b7280", fontSize: 11, lineHeight: 1.4, marginBottom: 8 }}>
                  {s.reason}
                </p>
                <button onClick={() => useThisAI(s)} style={{
                  width: "100%",
                  background: "linear-gradient(135deg, #a855f7, #3b82f6)",
                  color: "#fff", border: "none", borderRadius: 6,
                  padding: "8px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}>
                  💥 Use This →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

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
          <div style={{ marginBottom: 10 }}>
            <YesNoPicker label="Your call" value={selection} onChange={handleMyPick} />
            {selection && (
              <div style={{ marginTop: 6, color: "#6b7280", fontSize: 10 }}>
                Their call (auto): <strong style={{ color: "#e2e8f0" }}>{acceptorSelection}</strong>
              </div>
            )}
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
                    borderRadius: 6, padding: "6px 10px", color: "#e2e8f0", fontSize: 13 }} />
              </div>
              <div>
                <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 3 }}>Their pick (auto)</div>
                <input value={acceptorSelection} onChange={e => { setAcceptorSelection(e.target.value); setSelection(oppositeOf(currentType, e.target.value)) }}
                  placeholder="e.g. Under 2.5"
                  style={{ width: "100%", boxSizing: "border-box", background: "#13131f", border: "1px solid #2d2b55",
                    borderRadius: 6, padding: "6px 10px", color: "#e2e8f0", fontSize: 13 }} />
              </div>
            </div>
          </div>
        )}

        {/* AI odds suggestion */}
        <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={suggestOdds} disabled={!selection || oddsLoading} style={{
            background: selection && !oddsLoading ? "rgba(168,85,247,0.12)" : "transparent",
            border: "1px solid rgba(168,85,247,0.3)", borderRadius: 7,
            color: selection ? "#a78bfa" : "#4b5563", fontSize: 11, fontWeight: 700,
            padding: "5px 12px", cursor: selection ? "pointer" : "not-allowed",
          }}>
            {oddsLoading ? "✨ Thinking…" : "✨ Suggest odds"}
          </button>
          {oddsReason && (
            <span style={{ color: "#6b7280", fontSize: 10, flex: 1 }}>{oddsReason}</span>
          )}
        </div>

        {/* Stakes & odds */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
          <div>
            <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 3 }}>Your stake</div>
            <input type="number" value={issuerStake} onChange={e => setIssuerStake(Number(e.target.value))}
              style={{ width: "100%", boxSizing: "border-box", background: "#13131f", border: "1px solid #2d2b55",
                borderRadius: 6, padding: "6px 8px", color: "#e2e8f0", fontSize: 13 }} />
          </div>
          <div>
            <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 3 }}>Your odds</div>
            <input type="number" step="0.1" value={issuerOdds} onChange={e => setIssuerOdds(Number(e.target.value))}
              style={{ width: "100%", boxSizing: "border-box", background: "#13131f", border: "1px solid #2d2b55",
                borderRadius: 6, padding: "6px 8px", color: "#e2e8f0", fontSize: 13 }} />
          </div>
          <div>
            <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 3 }}>Their odds</div>
            <input type="number" step="0.1" value={acceptorOdds} onChange={e => setAcceptorOdds(Number(e.target.value))}
              style={{ width: "100%", boxSizing: "border-box", background: "#13131f", border: "1px solid #2d2b55",
                borderRadius: 6, padding: "6px 8px", color: "#e2e8f0", fontSize: 13 }} />
          </div>
        </div>

        {/* Friend picker — always visible */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: 0.8, marginBottom: 6 }}>
            Challenge who?
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            <button onClick={() => setAddresseeId(null)} style={{
              padding: "5px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: "pointer",
              border: "1px solid", transition: "all 0.1s",
              background: addresseeId === null ? "rgba(168,85,247,0.2)" : "transparent",
              borderColor: addresseeId === null ? "rgba(168,85,247,0.6)" : "#2d2b55",
              color: addresseeId === null ? "#c4b5fd" : "#6b7280",
            }}>
              Anyone
            </button>
            {friends.map(f => (
              <button key={f.id} onClick={() => setAddresseeId(f.id)} style={{
                padding: "5px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: "pointer",
                border: "1px solid", transition: "all 0.1s",
                background: addresseeId === f.id ? "rgba(74,222,128,0.15)" : "transparent",
                borderColor: addresseeId === f.id ? "rgba(74,222,128,0.5)" : "#2d2b55",
                color: addresseeId === f.id ? "#4ade80" : "#9ca3af",
              }}>
                {f.name}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ color: "#a78bfa", fontSize: 11, margin: 0 }}>
            Their stake: <strong>{acceptorStake}</strong> tokens
            <HelpTip text="Their stake = your stake × (your odds ÷ their odds). Equal odds = equal stakes." />
          </p>
          <button onClick={issueDare} disabled={loading} style={{
            background: "linear-gradient(135deg,#a855f7,#3b82f6)", color: "#fff",
            border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
          }}>
            {loading ? "..." : addresseeId ? `💥 Dare ${friends.find(f => f.id === addresseeId)?.name}` : "💥 Send Dare"}
          </button>
        </div>
      </div>

      {/* My pending dares — with cancel */}
      {challenges?.filter(c => c.issuer_id === currentPlayerId).length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: 0.8, marginBottom: 8 }}>
            🕐 My pending dares
          </p>
          {challenges.filter(c => c.issuer_id === currentPlayerId).map((c) => {
            const typeInfo = DARE_TYPES.find(t => t.key === c.bet_type)
            return (
              <div key={c.id} style={{
                background: "#0c0c14", border: "1px solid #2d2b55",
                borderRadius: 12, padding: "10px 12px", marginBottom: 8,
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 2 }}>
                    {typeInfo?.short ?? c.bet_type}
                    {c.addressee_name && <span style={{ color: "#4ade80", marginLeft: 6 }}>→ {c.addressee_name}</span>}
                  </div>
                  <div style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.selection} · <span style={{ color: "#fbbf24" }}>{c.issuer_stake} 🪙</span>
                  </div>
                </div>
                <button
                  onClick={() => cancelDare(c.id)}
                  disabled={cancellingId === c.id}
                  style={{
                    flexShrink: 0, background: "none", border: "1px solid #ef4444",
                    borderRadius: 6, color: "#ef4444", fontSize: 11,
                    padding: "4px 10px", cursor: cancellingId === c.id ? "not-allowed" : "pointer",
                    fontWeight: 600, opacity: cancellingId === c.id ? 0.5 : 1,
                  }}>
                  {cancellingId === c.id ? "…" : "Withdraw"}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Incoming dares to accept */}
      {challenges?.filter(c => c.issuer_id !== currentPlayerId).length > 0 && (
        <div>
          <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: 0.8, marginBottom: 8 }}>
            ⚔️ Dares waiting for you
          </p>
          {challenges.filter(c => c.issuer_id !== currentPlayerId).map((c) => {
            const typeInfo = DARE_TYPES.find(t => t.key === c.bet_type)
            return (
              <div key={c.id} style={{
                background: "linear-gradient(135deg, rgba(168,85,247,0.06), rgba(59,130,246,0.06))",
                border: "1px solid rgba(168,85,247,0.3)",
                borderRadius: 12, padding: "12px", marginBottom: 8,
              }}>
                {/* Header */}
                <div style={{ color: "#a78bfa", fontSize: 10, fontWeight: 700, marginBottom: 10 }}>
                  ⚔️ {c.issuer_name || "Someone"} dares you
                  {c.addressee_name && <span style={{ color: "#4ade80", fontWeight: 700 }}> — you specifically</span>}
                  {typeInfo && <span style={{ color: "#4b5563", fontWeight: 400 }}> · {typeInfo.short}</span>}
                </div>

                {/* Two sides */}
                <div style={{ display: "flex", gap: 8, alignItems: "stretch", marginBottom: 10 }}>
                  {/* Their pick */}
                  <div style={{ flex: 1, background: "rgba(107,114,128,0.1)", border: "1px solid #2d2b55", borderRadius: 8, padding: "8px 10px" }}>
                    <div style={{ color: "#6b7280", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                      Their pick
                    </div>
                    <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 700,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.selection}
                    </div>
                    <div style={{ color: "#fbbf24", fontSize: 11, marginTop: 3 }}>
                      {c.issuer_stake} 🪙 · {c.issuer_odds}×
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", color: "#4b5563", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                    vs
                  </div>

                  {/* Your side */}
                  <div style={{ flex: 1, background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.35)", borderRadius: 8, padding: "8px 10px" }}>
                    <div style={{ color: "#4ade80", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                      Your side ✓
                    </div>
                    <div style={{ color: "#4ade80", fontSize: 13, fontWeight: 700,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.acceptor_selection}
                    </div>
                    <div style={{ color: "#fbbf24", fontSize: 11, marginTop: 3 }}>
                      {c.acceptor_stake} 🪙 · {c.acceptor_odds}×
                    </div>
                  </div>
                </div>

                {/* Accept button */}
                <button
                  onClick={() => acceptDare(c.id)}
                  disabled={acceptingId === c.id}
                  style={{
                    width: "100%",
                    background: acceptingId === c.id ? "#1e1b3a" : "linear-gradient(135deg,#a855f7,#3b82f6)",
                    color: acceptingId === c.id ? "#6b7280" : "#fff",
                    border: "none", borderRadius: 8, padding: "8px",
                    fontSize: 13, fontWeight: 700,
                    cursor: acceptingId === c.id ? "not-allowed" : "pointer",
                  }}>
                  {acceptingId === c.id ? "Accepting…" : "Accept dare ✓"}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {msg && (
        <p style={{ color: msg.startsWith("✓") ? "#4ade80" : "#f87171", fontSize: 13, marginTop: 8 }}>{msg}</p>
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
