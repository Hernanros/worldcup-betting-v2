import { BrowserRouter, Routes, Route, Navigate, Outlet, useOutletContext } from "react-router-dom"
export { useOutletContext }
import { useEffect, useState } from "react"
import { isLoggedIn, getPlayer } from "./auth.js"
import { connectWS, disconnectWS } from "./ws.js"
import JoinPage from "./pages/JoinPage.jsx"
import HomePage from "./pages/HomePage.jsx"
import MatchesPage from "./pages/MatchesPage.jsx"
import MatchDetailPage from "./pages/MatchDetailPage.jsx"
import PredictionsPage from "./pages/PredictionsPage.jsx"
import TournamentPage from "./pages/TournamentPage.jsx"
import LeaderboardPage from "./pages/LeaderboardPage.jsx"
import SandboxPage from "./pages/SandboxPage.jsx"
import AdminPage from "./pages/AdminPage.jsx"
import DeepCutsPage from "./pages/DeepCutsPage.jsx"
import HelpPage from "./pages/HelpPage.jsx"
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
        <Outlet context={{ onBalanceChange: setBalance }} />
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
          <Route path="/" element={<HomePage />} />
          <Route path="/matches" element={<MatchesPage />} />
          <Route path="/matches/:id" element={<MatchDetailPage />} />
          <Route path="/predict" element={<PredictionsPage />} />
          <Route path="/tournament" element={<TournamentPage />} />
          <Route path="/rankings" element={<LeaderboardPage />} />
          <Route path="/sandbox" element={<SandboxPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/deep-cuts" element={<DeepCutsPage />} />
          <Route path="/help" element={<HelpPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
