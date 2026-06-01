import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../api.js"
import { getPlayer } from "../auth.js"

export default function AdminPage() {
  const navigate = useNavigate()
  const player = getPlayer()
  const [leagues, setLeagues] = useState([])
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [aiEnabled, setAiEnabled] = useState(true)
  const [msg, setMsg] = useState("")
  const [err, setErr] = useState("")
  const [loading, setLoading] = useState(false)
  // Settle
  const [unsettled, setUnsettled] = useState([])
  const [scores, setScores] = useState({})   // { matchId: { home: "", away: "" } }
  const [settleMsg, setSettleMsg] = useState("")

  useEffect(() => { if (!player?.is_admin) navigate("/", { replace: true }) }, [])

  async function load() {
    try { setLeagues(await api.get("/api/leagues")) }
    catch (e) { setErr("Failed to load: " + e.message) }
  }
  async function loadMatches() {
    try {
      const all = await api.get("/api/matches")
      setUnsettled(all.filter(m => m.status === "locked" || m.status === "upcoming"))
    } catch (_) {}
  }
  useEffect(() => { load(); loadMatches() }, [])

  async function handleSettle(match) {
    const s = scores[match.id] || {}
    const home = parseInt(s.home ?? "")
    const away = parseInt(s.away ?? "")
    if (isNaN(home) || isNaN(away)) return setSettleMsg("✗ Enter both scores")
    setSettleMsg("")
    try {
      await api.post("/api/admin/settle-match", { match_id: match.id, home_score: home, away_score: away })
      setSettleMsg(`✓ Settled: ${match.home_team} ${home}–${away} ${match.away_team}`)
      await loadMatches()
    } catch (e) { setSettleMsg("✗ " + e.message) }
  }

  async function handleCreate(e) {
    e.preventDefault(); setMsg(""); setErr(""); setLoading(true)
    try {
      await api.post("/api/leagues", { name: name.trim(), invite_code: code.trim(), ai_enabled: aiEnabled })
      setMsg(`✓ Created "${name.trim()}" — code: ${code.trim()}`)
      setName(""); setCode(""); setAiEnabled(true)
      await load()
    } catch (e) { setErr("✗ " + e.message) }
    finally { setLoading(false) }
  }

  async function handleDelete(lg) {
    const force = lg.player_count > 0
    const msg = force
      ? `Delete "${lg.name}" AND all its players? This cannot be undone.`
      : `Delete empty group "${lg.name}"?`
    if (!confirm(msg)) return
    try {
      await api.delete(force ? `/api/leagues/${lg.id}/force` : `/api/leagues/${lg.id}`)
      await load()
    } catch (e) { setErr("✗ " + e.message) }
  }

  const inputStyle = {
    background: "#0c0c14", border: "1px solid #2d2b55", borderRadius: 8,
    padding: "9px 12px", color: "#e2e8f0", fontSize: 14, width: "100%", outline: "none",
  }
  const card = { background: "#13131f", border: "1px solid #2d2b55", borderRadius: 12, padding: 20, marginBottom: 16 }

  return (
    <div style={{ padding: 16, maxWidth: 480, margin: "0 auto" }}>
      <button onClick={() => navigate(-1)}
        style={{ color: "#a78bfa", background: "none", border: "none", fontSize: 13, cursor: "pointer", marginBottom: 16 }}>
        ← Back
      </button>
      <h2 className="gradient-text" style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>⚙️ Admin — Groups</h2>
      <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 20 }}>Create a group and share its invite code.</p>

      <div style={card}>
        <h3 style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Create new group</h3>
        <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="Group name  (e.g. Office 2026)" required maxLength={80} style={inputStyle} />
          <input value={code} onChange={e => setCode(e.target.value.toLowerCase().replace(/\s+/g, ""))}
            placeholder="Invite code  (e.g. office26)" required maxLength={30} style={inputStyle} />

          {/* AI toggle */}
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <div onClick={() => setAiEnabled(v => !v)} style={{
              width: 40, height: 22, borderRadius: 11, position: "relative", flexShrink: 0,
              background: aiEnabled ? "linear-gradient(135deg,#a855f7,#3b82f6)" : "#374151",
              transition: "background 0.2s",
            }}>
              <div style={{
                position: "absolute", top: 3, left: aiEnabled ? 21 : 3,
                width: 16, height: 16, borderRadius: "50%", background: "#fff",
                transition: "left 0.2s",
              }} />
            </div>
            <span style={{ fontSize: 13, color: "#e2e8f0" }}>
              🤖 AI suggestions {aiEnabled ? <span style={{ color: "#4ade80" }}>enabled</span> : <span style={{ color: "#6b7280" }}>disabled</span>}
            </span>
          </label>
          <p style={{ color: "#6b7280", fontSize: 11, margin: 0 }}>
            Disable to hide the AI tab for all players in this group.
          </p>

          {err && <p style={{ color: "#f87171", fontSize: 13, margin: 0 }}>{err}</p>}
          {msg && <p style={{ color: "#4ade80", fontSize: 13, margin: 0 }}>{msg}</p>}
          <button type="submit" disabled={loading} style={{
            background: "linear-gradient(135deg,#a855f7,#3b82f6)", color: "#fff", border: "none",
            borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
          }}>
            {loading ? "Creating..." : "Create group"}
          </button>
        </form>
      </div>

      {/* Manual settle */}
      <div style={card}>
        <h3 style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 700, marginBottom: 4 }}>⚽ Settle a match</h3>
        <p style={{ color: "#6b7280", fontSize: 11, marginBottom: 12 }}>
          Use only if auto-settlement missed a result. Locked = match started, Upcoming = force-settle.
        </p>
        {settleMsg && (
          <p style={{ color: settleMsg.startsWith("✓") ? "#4ade80" : "#f87171", fontSize: 12, marginBottom: 8 }}>
            {settleMsg}
          </p>
        )}
        {unsettled.length === 0 && <p style={{ color: "#6b7280", fontSize: 13 }}>No unsettled matches.</p>}
        {unsettled.map(m => (
          <div key={m.id} style={{ borderBottom: "1px solid #1e1e2e", padding: "10px 0", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ color: "#e2e8f0", fontSize: 12, flex: "1 1 140px", fontWeight: 600 }}>
              {m.home_team} vs {m.away_team}
            </span>
            <span style={{ fontSize: 10, color: m.status === "locked" ? "#fbbf24" : "#6b7280", fontWeight: 700 }}>
              {m.status.toUpperCase()}
            </span>
            <input
              type="number" min={0} max={20} placeholder="H"
              value={scores[m.id]?.home ?? ""}
              onChange={e => setScores(s => ({ ...s, [m.id]: { ...s[m.id], home: e.target.value } }))}
              style={{ width: 44, ...inputStyle, padding: "5px 8px", fontSize: 13 }}
            />
            <span style={{ color: "#6b7280" }}>–</span>
            <input
              type="number" min={0} max={20} placeholder="A"
              value={scores[m.id]?.away ?? ""}
              onChange={e => setScores(s => ({ ...s, [m.id]: { ...s[m.id], away: e.target.value } }))}
              style={{ width: 44, ...inputStyle, padding: "5px 8px", fontSize: 13 }}
            />
            <button onClick={() => handleSettle(m)} style={{
              background: "linear-gradient(135deg,#a855f7,#3b82f6)", color: "#fff", border: "none",
              borderRadius: 6, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer",
            }}>Settle</button>
          </div>
        ))}
      </div>

      <div style={card}>
        <h3 style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 700, marginBottom: 14 }}>
          Existing groups ({leagues.length})
        </h3>
        {leagues.length === 0 && <p style={{ color: "#6b7280", fontSize: 13 }}>No groups yet.</p>}
        {leagues.map(lg => (
          <div key={lg.id} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "12px 0", borderBottom: "1px solid #1e1e2e",
          }}>
            <div>
              <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 14 }}>{lg.name}</div>
              <div style={{ color: "#6b7280", fontSize: 11, marginTop: 2 }}>
                code: <span style={{ color: "#a78bfa", fontWeight: 700 }}>{lg.invite_code}</span>
                {" · "}
                {lg.ai_enabled
                  ? <span style={{ color: "#4ade80" }}>🤖 AI on</span>
                  : <span style={{ color: "#6b7280" }}>🤖 AI off</span>}
              </div>
            </div>
            <button onClick={() => handleDelete(lg)} style={{
              background: "none", border: "1px solid #7f1d1d", borderRadius: 6,
              color: "#f87171", fontSize: 11, padding: "4px 10px", cursor: "pointer", fontWeight: 600,
            }}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
