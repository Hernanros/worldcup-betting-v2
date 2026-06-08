import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { getPlayer, getSessions, switchSession, removeSession, clearAuth, setAuth } from "../auth.js"
import { api } from "../api.js"

const INPUT_STYLE = {
  width: "100%",
  boxSizing: "border-box",
  background: "#0c0c14",
  border: "1px solid #2d2b55",
  borderRadius: 8,
  padding: "10px 12px",
  color: "#e2e8f0",
  fontSize: 14,
  outline: "none",
}

export default function GroupSwitcher({ open, onClose }) {
  const currentPlayer = getPlayer()
  const [sessions, setSessions] = useState(getSessions)

  // "list" | "join"
  const [view, setView]           = useState("list")
  const [name, setName]           = useState("")
  const [inviteCode, setInviteCode] = useState("")
  const [error, setError]         = useState("")
  const [loading, setLoading]     = useState(false)

  function handleClose() {
    setView("list")
    setName(""); setInviteCode(""); setError("")
    onClose()
  }

  function handleSwitch(playerId) {
    if (playerId === currentPlayer?.id) { handleClose(); return }
    switchSession(playerId)
    window.location.href = "/"
  }

  function handleRemove(e, playerId) {
    e.stopPropagation()
    removeSession(playerId)
    setSessions(getSessions())
    if (playerId === currentPlayer?.id) {
      clearAuth()
      window.location.href = "/join"
    }
  }

  async function handleJoinSubmit(e) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const data = await api.post("/api/auth/join", {
        name: name.trim(),
        code: inviteCode.trim(),
        mode: "join",
      })
      setAuth(data.token, data.player, data.league ?? null)
      window.location.href = "/"
    } catch (err) {
      setError(err.message || "Invalid invite code or name")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300 }}
          />

          {/* Sheet */}
          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            style={{
              position: "fixed", bottom: 0, left: 0, right: 0,
              background: "#13131f",
              borderTop: "1px solid #2d2b55",
              borderRadius: "18px 18px 0 0",
              padding: "0 0 32px",
              zIndex: 301,
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            {/* Handle */}
            <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 8px" }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "#2d2b55" }} />
            </div>

            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "4px 20px 16px",
              borderBottom: "1px solid #1e1b3a",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {view === "join" && (
                  <button
                    onClick={() => { setView("list"); setError("") }}
                    style={{ background: "none", border: "none", color: "#6b7280", fontSize: 18, cursor: "pointer", padding: "2px 4px", lineHeight: 1 }}
                  >
                    ←
                  </button>
                )}
                <span style={{ color: "#e2e8f0", fontWeight: 800, fontSize: 15 }}>
                  {view === "join" ? "Join a Group" : "⇄ Switch Group"}
                </span>
              </div>
              <button
                onClick={handleClose}
                style={{ background: "none", border: "none", color: "#6b7280", fontSize: 18, cursor: "pointer", lineHeight: 1, padding: "2px 4px" }}
              >
                ✕
              </button>
            </div>

            {/* ── Sessions list ── */}
            {view === "list" && (
              <div style={{ padding: "8px 16px 0" }}>
                {sessions.length === 0 && (
                  <p style={{ color: "#6b7280", fontSize: 13, textAlign: "center", padding: "16px 0" }}>
                    No saved groups yet.
                  </p>
                )}

                {sessions.map((s) => {
                  const isActive = s.player.id === currentPlayer?.id
                  return (
                    <button
                      key={s.player.id}
                      onClick={() => handleSwitch(s.player.id)}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 12,
                        padding: "12px 14px", marginBottom: 8,
                        background: isActive ? "rgba(168,85,247,0.1)" : "#0c0c14",
                        border: `1px solid ${isActive ? "rgba(168,85,247,0.4)" : "#2d2b55"}`,
                        borderRadius: 12, cursor: isActive ? "default" : "pointer", textAlign: "left",
                      }}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                        background: isActive ? "linear-gradient(135deg,#a855f7,#3b82f6)" : "linear-gradient(135deg,#374151,#1f2937)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 15, fontWeight: 800, color: "#fff",
                      }}>
                        {s.player.name?.charAt(0).toUpperCase() ?? "?"}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          color: isActive ? "#c4b5fd" : "#e2e8f0", fontWeight: 700, fontSize: 13,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {s.league?.name ?? "Admin"}
                        </div>
                        <div style={{
                          color: "#6b7280", fontSize: 11, marginTop: 1,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {s.player.name}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        {isActive && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, color: "#a855f7",
                            background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)",
                            borderRadius: 4, padding: "2px 6px", letterSpacing: 0.5,
                          }}>
                            ACTIVE
                          </span>
                        )}
                        <button
                          onClick={(e) => handleRemove(e, s.player.id)}
                          title="Remove session"
                          style={{ background: "none", border: "none", color: "#4b5563", fontSize: 14, cursor: "pointer", padding: 4, borderRadius: 4, lineHeight: 1 }}
                        >
                          ✕
                        </button>
                      </div>
                    </button>
                  )
                })}

                <button
                  onClick={() => { setView("join"); setName(currentPlayer?.name ?? ""); setError("") }}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    padding: "12px", marginTop: 4,
                    background: "none", border: "1px dashed #2d2b55", borderRadius: 12,
                    color: "#6b7280", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  + Join another group
                </button>
              </div>
            )}

            {/* ── Join form ── */}
            {view === "join" && (
              <form onSubmit={handleJoinSubmit} style={{ padding: "16px 16px 0", display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>
                  Enter your name and the group's invite code.
                </p>

                <div>
                  <div style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                    Display name
                  </div>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your name in this group"
                    required
                    maxLength={50}
                    style={INPUT_STYLE}
                  />
                </div>

                <div>
                  <div style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                    Invite code
                  </div>
                  <input
                    value={inviteCode}
                    onChange={e => setInviteCode(e.target.value)}
                    placeholder="Group invite code"
                    type="password"
                    required
                    maxLength={30}
                    style={INPUT_STYLE}
                  />
                </div>

                {error && (
                  <p style={{ color: "#f87171", fontSize: 13, margin: 0 }}>⚠ {error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    background: loading ? "#1e1b3a" : "linear-gradient(135deg,#a855f7,#3b82f6)",
                    color: loading ? "#6b7280" : "#fff",
                    border: "none", borderRadius: 10, padding: "12px",
                    fontSize: 14, fontWeight: 700,
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  {loading ? "Joining…" : "Join group →"}
                </button>
              </form>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
