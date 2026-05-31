import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { api } from "../api.js"
import { setAuth } from "../auth.js"

export default function JoinPage() {
  const [mode, setMode] = useState("login") // "login" | "register"
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [msg, setMsg] = useState("")
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const data = await api.post("/api/auth/join", {
        name: name.trim(),
        code: code.trim(),
        mode,
      })
      setAuth(data.token, data.player, data.league ?? null)
      const greeting = mode === "register"
        ? `✓ Welcome to ${data.league?.name ?? "the game"}!`
        : `✓ Welcome back, ${data.player.name}!`
      setMsg(greeting)
      setTimeout(() => navigate("/"), 1200)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    background: "#0c0c14",
    border: "1px solid #2d2b55",
    borderRadius: 8,
    padding: "10px 14px",
    color: "#e2e8f0",
    fontSize: 15,
    outline: "none",
    width: "100%",
  }

  return (
    <div style={{
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
    }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(12,12,20,0.82)" }} />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          position: "relative",
          background: "#13131f",
          border: "1px solid #2d2b55",
          borderRadius: 16,
          padding: 32,
          width: "100%",
          maxWidth: 360,
          boxShadow: "0 0 40px rgba(168,85,247,0.15)",
        }}
      >
        <h1 className="gradient-text" style={{ fontSize: 28, fontWeight: 800, textAlign: "center", marginBottom: 24 }}>
          ⚡ WC Bets 2026
        </h1>

        {/* Mode toggle */}
        <div style={{
          display: "flex",
          background: "#0c0c14",
          borderRadius: 10,
          padding: 3,
          marginBottom: 20,
          border: "1px solid #2d2b55",
        }}>
          {[["login", "Sign In"], ["register", "New Player"]].map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError("") }}
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: 8,
                border: "none",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                background: mode === m
                  ? "linear-gradient(135deg,#a855f7,#3b82f6)"
                  : "transparent",
                color: mode === m ? "#fff" : "#6b7280",
                transition: "all 0.15s",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <p style={{ color: "#6b7280", textAlign: "center", marginBottom: 20, fontSize: 13 }}>
          {mode === "login"
            ? "Enter your name and group invite code to continue."
            : "Pick a name and enter your group's invite code to join."}
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={mode === "login" ? "Your name" : "Choose a name"}
            required
            maxLength={50}
            autoComplete="name"
            style={inputStyle}
          />
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Group invite code"
            type="password"
            required
            maxLength={30}
            autoComplete="off"
            style={inputStyle}
          />
          {error && <p style={{ color: "#f87171", fontSize: 13, margin: 0 }}>{error}</p>}
          {msg && <p style={{ color: "#4ade80", fontSize: 13, margin: 0 }}>{msg}</p>}
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
            {loading
              ? (mode === "login" ? "Signing in..." : "Joining...")
              : (mode === "login" ? "Sign In" : "Join the game")}
          </button>
        </form>
      </motion.div>
    </div>
  )
}
