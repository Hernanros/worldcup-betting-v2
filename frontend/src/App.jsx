import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom"
import { useEffect, useState } from "react"
import { isLoggedIn, getPlayer } from "./auth.js"
import { connectWS, disconnectWS } from "./ws.js"
import JoinPage from "./pages/JoinPage.jsx"
import MatchesPage from "./pages/MatchesPage.jsx"
import MatchDetailPage from "./pages/MatchDetailPage.jsx"
import BetsPage from "./pages/BetsPage.jsx"
import PredictionsPage from "./pages/PredictionsPage.jsx"
import LeaderboardPage from "./pages/LeaderboardPage.jsx"
import AIPage from "./pages/AIPage.jsx"
import SandboxPage from "./pages/SandboxPage.jsx"
import BottomNav from "./components/BottomNav.jsx"
import TopBar from "./components/TopBar.jsx"

function ProtectedLayout() {
  const [balance, setBalance] = useState(getPlayer()?.token_balance ?? 0)

  useEffect(() => {
    connectWS()
    return () => disconnectWS()
  }, [])

  if (!isLoggedIn()) return <Navigate to="/join" replace />

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      <TopBar balance={balance} onBalanceChange={setBalance} />
      <main style={{ flex: 1, overflowY: "auto", paddingBottom: "72px" }}>
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/join" element={<JoinPage />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<MatchesPage />} />
          <Route path="/matches/:id" element={<MatchDetailPage />} />
          <Route path="/bets" element={<BetsPage />} />
          <Route path="/predict" element={<PredictionsPage />} />
          <Route path="/rankings" element={<LeaderboardPage />} />
          <Route path="/ai" element={<AIPage />} />
          <Route path="/sandbox" element={<SandboxPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
