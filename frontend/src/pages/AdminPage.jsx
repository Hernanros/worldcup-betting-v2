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
  const [msg, setMsg] = useState("")
  const [err, setErr] = useState("")
  const [loading, setLoading] = useState(false)

  // Guard: non-admin gets bounced
  useEffect(() => {
    if (!player?.is_admin) navigate("/", { replace: true })
  }, [])

  async function load() {
    try {
      const data = await api.get("/api/leagues")
      setLeagues(data)
    } catch (e) {
      setErr("Failed to load leagues: " + e.message)
    }
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e) {
    e.preventDefault()
    setMsg(""); setErr("")
    setLoading(true)
    try {
      await api.post("/api/leagues", { name: name.trim(), invite_code: code.trim() })
      setMsg(`✓ League "${name.trim()}" created with code "${code.trim()}"`)
      setName(""); setCode("")
      await load()
    } catch (e) {
      setErr("✗ " + e.message)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    background: "#0c0c14", border: "1px solid #2d2b55", borderRadius: 8,
    padding: "9px 12px", color: "#e2e8f0", fontSize: 14, width: "100%", outline: "none",
  }
  const card = {
    background: "#13131f", border: "1px solid #2d2b55", borderRadius: 12, padding: 20, marginBottom: 16,
  }

  return (
    <div style={{ padding: 16, maxWidth: 480, margin: "0 auto" }}>
      <button onClick={() => navigate(-1)}
        style={{ color: "#a78bfa", background: "none", border: "none", fontSize: 13, cursor: "pointer", marginBottom: 16 }}>
        ← Back
      </button>

      <h2 className="gradient-text" style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>
        ⚙️ Admin — Groups
      </h2>
      <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 20 }}>
        Create a group and share its invite code with the players.
      </p>

      {/* Create form */}
      <div style={card}>
        <h3 style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 700, marginBottom: 14 }}>
          Create new group
        </h3>
        <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Group name  (e.g. Office 2026)"
            required maxLength={80}
            style={inputStyle}
          />
          <input
            value={code}
            onChange={e => setCode(e.target.value.toLowerCase().replace(/\s+/g, ""))}
            placeholder="Invite code  (e.g. office26)"
            required maxLength={30}
            style={inputStyle}
          />
          <p style={{ color: "#6b7280", fontSize: 11, margin: 0 }}>
            Code is case-insensitive and players type it exactly when joining.
          </p>
          {err && <p style={{ color: "#f87171", fontSize: 13, margin: 0 }}>{err}</p>}
          {msg && <p style={{ color: "#4ade80", fontSize: 13, margin: 0 }}>{msg}</p>}
          <button type="submit" disabled={loading} style={{
            background: "linear-gradient(135deg,#a855f7,#3b82f6)", color: "#fff",
            border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
          }}>
            {loading ? "Creating..." : "Create group"}
          </button>
        </form>
      </div>

      {/* Existing leagues */}
      <div style={card}>
        <h3 style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 700, marginBottom: 14 }}>
          Existing groups ({leagues.length})
        </h3>
        {leagues.length === 0 && (
          <p style={{ color: "#6b7280", fontSize: 13 }}>No groups yet.</p>
        )}
        {leagues.map(lg => (
          <div key={lg.id} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "10px 0", borderBottom: "1px solid #1e1e2e",
          }}>
            <div>
              <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 14 }}>{lg.name}</div>
              <div style={{ color: "#6b7280", fontSize: 11, marginTop: 2 }}>
                Invite code: <span style={{ color: "#a78bfa", fontWeight: 700 }}>{lg.invite_code}</span>
              </div>
            </div>
            <span style={{
              background: "#1e1e2e", border: "1px solid #2d2b55",
              borderRadius: 6, padding: "3px 10px", fontSize: 11, color: "#9ca3af",
            }}>
              #{lg.id}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
