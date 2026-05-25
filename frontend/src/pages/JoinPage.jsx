import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { api } from "../api.js"
import { setAuth } from "../auth.js"

export default function JoinPage() {
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleJoin(e) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const data = await api.post("/api/auth/join", { name: name.trim(), code: code.trim() })
      setAuth(data.token, data.player)
      navigate("/")
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      background: "#0c0c14",
      backgroundImage: "url(https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/2022_FIFA_World_Cup_Final_-_trophy_ceremony_%28cropped%29.jpg/1280px-2022_FIFA_World_Cup_Final_-_trophy_ceremony_%28cropped%29.jpg)",
      backgroundSize: "cover",
      backgroundPosition: "center 30%",
      position: "relative",
    }}>
    {/* dark overlay */}
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
        <h1 className="gradient-text" style={{ fontSize: 28, fontWeight: 800, textAlign: "center", marginBottom: 8 }}>
          ⚡ WC Bets 2026
        </h1>
        <p style={{ color: "#6b7280", textAlign: "center", marginBottom: 28, fontSize: 14 }}>
          Enter your name and invite code to join
        </p>

        <form onSubmit={handleJoin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            required
            maxLength={50}
            autoComplete="name"
            style={{
              background: "#0c0c14",
              border: "1px solid #2d2b55",
              borderRadius: 8,
              padding: "10px 14px",
              color: "#e2e8f0",
              fontSize: 15,
              outline: "none",
              width: "100%",
            }}
          />
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Invite code"
            type="password"
            required
            maxLength={30}
            autoComplete="off"
            style={{
              background: "#0c0c14",
              border: "1px solid #2d2b55",
              borderRadius: 8,
              padding: "10px 14px",
              color: "#e2e8f0",
              fontSize: 15,
              outline: "none",
              width: "100%",
            }}
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
            {loading ? "Joining..." : "Join the game"}
          </button>
        </form>
      </motion.div>
    </div>
  )
}
