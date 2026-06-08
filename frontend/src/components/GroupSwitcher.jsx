import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { getPlayer, getSessions, switchSession, removeSession, clearAuth } from "../auth.js"

export default function GroupSwitcher({ open, onClose, onJoinNew }) {
  const currentPlayer = getPlayer()
  // Keep sessions as state so removals re-render immediately
  const [sessions, setSessions] = useState(getSessions)

  function handleSwitch(playerId) {
    if (playerId === currentPlayer?.id) { onClose(); return }
    switchSession(playerId)
    window.location.href = "/"   // full reload picks up new localStorage auth
  }

  function handleRemove(e, playerId) {
    e.stopPropagation()
    removeSession(playerId)
    setSessions(getSessions())
    // If we removed the active session, clear and go to join
    if (playerId === currentPlayer?.id) {
      clearAuth()
      window.location.href = "/join"
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
            onClick={onClose}
            style={{
              position: "fixed", inset: 0,
              background: "rgba(0,0,0,0.6)",
              zIndex: 300,
            }}
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
              padding: "0 0 24px",
              zIndex: 301,
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            {/* Handle bar */}
            <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 8px" }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "#2d2b55" }} />
            </div>

            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "4px 20px 16px",
              borderBottom: "1px solid #1e1b3a",
            }}>
              <span style={{ color: "#e2e8f0", fontWeight: 800, fontSize: 15 }}>
                ⇄ Switch Group
              </span>
              <button
                onClick={onClose}
                style={{
                  background: "none", border: "none", color: "#6b7280",
                  fontSize: 18, cursor: "pointer", lineHeight: 1, padding: "2px 4px",
                }}
              >
                ✕
              </button>
            </div>

            {/* Sessions list */}
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
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 14px",
                      marginBottom: 8,
                      background: isActive ? "rgba(168,85,247,0.1)" : "#0c0c14",
                      border: `1px solid ${isActive ? "rgba(168,85,247,0.4)" : "#2d2b55"}`,
                      borderRadius: 12,
                      cursor: isActive ? "default" : "pointer",
                      textAlign: "left",
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                      background: isActive
                        ? "linear-gradient(135deg,#a855f7,#3b82f6)"
                        : "linear-gradient(135deg,#374151,#1f2937)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 15, fontWeight: 800, color: "#fff",
                    }}>
                      {s.player.name?.charAt(0).toUpperCase() ?? "?"}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        color: isActive ? "#c4b5fd" : "#e2e8f0",
                        fontWeight: 700, fontSize: 13,
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

                    {/* Right side */}
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
                        title="Remove this session"
                        style={{
                          background: "none", border: "none",
                          color: "#4b5563", fontSize: 14, cursor: "pointer",
                          padding: "4px", borderRadius: 4,
                          lineHeight: 1,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </button>
                )
              })}

              {/* Join new group */}
              <button
                onClick={onJoinNew}
                style={{
                  width: "100%",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "12px",
                  background: "none",
                  border: "1px dashed #2d2b55",
                  borderRadius: 12,
                  color: "#6b7280",
                  fontSize: 13, fontWeight: 600,
                  cursor: "pointer",
                  marginTop: 4,
                }}
              >
                + Join another group
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
