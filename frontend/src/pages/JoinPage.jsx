import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { GoogleLogin } from "@react-oauth/google"
import { api } from "../api.js"
import { setAuth } from "../auth.js"

const CARD_STYLE = {
  position: "relative",
  background: "#13131f",
  border: "1px solid #2d2b55",
  borderRadius: 16,
  padding: 32,
  width: "100%",
  maxWidth: 360,
  boxShadow: "0 0 40px rgba(168,85,247,0.15)",
}

const INPUT_STYLE = {
  background: "#0c0c14",
  border: "1px solid #2d2b55",
  borderRadius: 8,
  padding: "10px 14px",
  color: "#e2e8f0",
  fontSize: 15,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
}

export default function JoinPage() {
  const navigate = useNavigate()

  // "idle" | "needs_invite"
  const [screen, setScreen] = useState("idle")
  const [idToken, setIdToken] = useState(null)
  const [displayName, setDisplayName] = useState("")
  const [inviteCode, setInviteCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showAdminForm, setShowAdminForm] = useState(false)

  // Admin form state
  const [adminName, setAdminName] = useState("")
  const [adminCode, setAdminCode] = useState("")
  const [adminError, setAdminError] = useState("")
  const [adminLoading, setAdminLoading] = useState(false)

  async function handleGoogleSuccess({ credential }) {
    setError("")
    setLoading(true)
    try {
      const data = await api.post("/api/auth/google", { id_token: credential })
      if (data.status === "ok") {
        setAuth(data.token, data.player, data.league ?? null)
        navigate("/")
      } else if (data.status === "new_player") {
        setIdToken(credential)
        setDisplayName(data.google_name || "")
        setScreen("needs_invite")
      } else {
        setError("Unexpected response. Please try again.")
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleInviteSubmit(e) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const data = await api.post("/api/auth/google", {
        id_token: idToken,
        invite_code: inviteCode.trim(),
        display_name: displayName.trim(),
      })
      if (data.status !== "ok") {
        setError("Unexpected response. Please try again.")
        return
      }
      setAuth(data.token, data.player, data.league ?? null)
      navigate("/")
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleAdminSubmit(e) {
    e.preventDefault()
    setAdminError("")
    setAdminLoading(true)
    try {
      const data = await api.post("/api/auth/join", {
        name: adminName.trim(),
        code: adminCode.trim(),
        mode: "join",
      })
      setAuth(data.token, data.player, data.league ?? null)
      navigate("/")
    } catch (err) {
      setAdminError(err.message)
    } finally {
      setAdminLoading(false)
    }
  }

  const pageStyle = {
    minHeight: "100dvh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    background: "#0c0c14",
    backgroundImage: "url(https://upload.wikimedia.org/wikipedia/commons/2/2e/Argentina_3-3_Francia_-_Copa_Mundial_2022_-_Celebraci%C3%B3n_de_victoria.jpg)",
    backgroundSize: "cover",
    backgroundPosition: "center 30%",
    position: "relative",
  }

  return (
    <div style={pageStyle}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(12,12,20,0.82)" }} />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={CARD_STYLE}
      >
        <h1 className="gradient-text" style={{ fontSize: 28, fontWeight: 800, textAlign: "center", marginBottom: 24 }}>
          ⚡ WC Bets 2026
        </h1>

        {screen === "idle" && (
          <>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              {loading ? (
                <p style={{ color: "#6b7280", fontSize: 14 }}>Signing in…</p>
              ) : (
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError("Google sign-in failed. Please try again.")}
                  theme="filled_black"
                  size="large"
                  width="280"
                />
              )}
              {error && <p style={{ color: "#f87171", fontSize: 13, margin: 0, textAlign: "center" }}>{error}</p>}
              <p style={{ color: "#4b5563", fontSize: 12, textAlign: "center", marginTop: 4 }}>
                Returning? You'll go straight in.<br />
                New player? You'll enter your invite code next.
              </p>
            </div>

            <div style={{ marginTop: 24, borderTop: "1px solid #1e1e2e", paddingTop: 16, textAlign: "center" }}>
              <button
                type="button"
                onClick={() => setShowAdminForm(v => !v)}
                style={{ background: "none", border: "none", color: "#4b5563", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}
              >
                Admin login →
              </button>
            </div>

            {showAdminForm && (
              <form onSubmit={handleAdminSubmit} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
                <input
                  value={adminName}
                  onChange={e => setAdminName(e.target.value)}
                  placeholder="Your name"
                  required
                  maxLength={50}
                  style={INPUT_STYLE}
                />
                <input
                  value={adminCode}
                  onChange={e => setAdminCode(e.target.value)}
                  placeholder="Admin code"
                  type="password"
                  required
                  maxLength={30}
                  style={INPUT_STYLE}
                />
                {adminError && <p style={{ color: "#f87171", fontSize: 13, margin: 0 }}>{adminError}</p>}
                <button
                  type="submit"
                  disabled={adminLoading}
                  style={{
                    background: "linear-gradient(135deg, #a855f7, #3b82f6)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: adminLoading ? "not-allowed" : "pointer",
                    opacity: adminLoading ? 0.7 : 1,
                  }}
                >
                  {adminLoading ? "Signing in…" : "Sign in as admin"}
                </button>
              </form>
            )}
          </>
        )}

        {screen === "needs_invite" && (
          <form onSubmit={handleInviteSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#1a1a2e", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "linear-gradient(135deg,#a855f7,#3b82f6)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0,
              }}>
                {displayName.charAt(0).toUpperCase() || "?"}
              </div>
              <div>
                <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600 }}>{displayName}</div>
                <div style={{ color: "#6b7280", fontSize: 11 }}>via Google ✓</div>
              </div>
            </div>

            <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>Almost there! Enter your group's invite code to join.</p>

            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Display name"
              required
              maxLength={50}
              style={INPUT_STYLE}
            />
            <input
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value)}
              placeholder="Group invite code"
              type="password"
              required
              maxLength={30}
              style={INPUT_STYLE}
            />

            {error && <p style={{ color: "#f87171", fontSize: 13, margin: 0 }}>{error}</p>}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: "linear-gradient(135deg, #a855f7, #3b82f6)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "12px",
                fontSize: 15,
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Joining…" : "Join the game →"}
            </button>

            <button
              type="button"
              onClick={() => { setScreen("idle"); setIdToken(null); setError(""); setInviteCode(""); setDisplayName("") }}
              style={{ background: "none", border: "none", color: "#6b7280", fontSize: 12, cursor: "pointer" }}
            >
              ← Use a different Google account
            </button>
          </form>
        )}
      </motion.div>
    </div>
  )
}
