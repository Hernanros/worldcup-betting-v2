import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
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
import BottomNav from "./components/BottomNav.jsx"
import TopBar from "./components/TopBar.jsx"

function ProtectedLayout({ children }) {
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
        {children}
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
        <Route path="/" element={<ProtectedLayout><MatchesPage /></ProtectedLayout>} />
        <Route path="/matches/:id" element={<ProtectedLayout><MatchDetailPage /></ProtectedLayout>} />
        <Route path="/bets" element={<ProtectedLayout><BetsPage /></ProtectedLayout>} />
        <Route path="/predict" element={<ProtectedLayout><PredictionsPage /></ProtectedLayout>} />
        <Route path="/rankings" element={<ProtectedLayout><LeaderboardPage /></ProtectedLayout>} />
        <Route path="/ai" element={<ProtectedLayout><AIPage /></ProtectedLayout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
