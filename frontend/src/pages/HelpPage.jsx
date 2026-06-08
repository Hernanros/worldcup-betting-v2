import { useState } from "react"
import { useNavigate } from "react-router-dom"
import PageBackground from "../components/PageBackground.jsx"

const SECTIONS = [
  {
    id: "basics",
    emoji: "🏁",
    title: "Getting started",
    items: [
      {
        q: "What is WC Bets 2026?",
        a: "A private game for your friend group during the 2026 World Cup. You start with 1,000 tokens. Dare friends on matches, predict exact scores, pick the tournament winner, and try to end with the most tokens.",
      },
      {
        q: "How do I join?",
        a: "Ask your group admin for the invite code. Enter your name and the code on the login screen — you're in instantly with 1,000 tokens.",
      },
      {
        q: "What are tokens?",
        a: "Tokens are in-game currency — not real money. Win dares and tournament picks to earn more; lose them and they're gone. Your token balance is your score on the leaderboard.",
      },
      {
        q: "How do I switch groups?",
        a: "Tap the ⇄ Switch button in the top bar to return to the login screen and enter a different group's invite code.",
      },
    ],
  },
  {
    id: "predictions",
    emoji: "🎯",
    title: "Score predictions",
    items: [
      {
        q: "How do predictions work?",
        a: "Predictions are free — they cost no tokens. You guess the exact final score of each match before it kicks off. Correct score = 3 pts, correct result (win/draw/loss) = 1 pt. Prediction points appear on a separate leaderboard tab.",
      },
      {
        q: "What are ⚡ Double Points predictions?",
        a: "You can mark up to 3 predictions as Double Points for the whole tournament. A correct Double Points prediction earns 6 pts (exact score) or 2 pts (correct outcome) instead of the usual 3 or 1. Choose your most confident picks — you only get 3.",
      },
      {
        q: "When do predictions lock?",
        a: "Predictions lock at kick-off. You can update them any time before the match starts.",
      },
    ],
  },
  {
    id: "dares",
    emoji: "⚔️",
    title: "Dares",
    items: [
      {
        q: "What is a dare?",
        a: "A head-to-head wager between you and a friend. You pick a spicy outcome, they take the opposite side, you both put up tokens. The match result settles it automatically.",
      },
      {
        q: "What can I dare on?",
        a: "8 dare types: Both Teams Score? (Yes/No) · Red Card? (Yes/No) · Extra Time? (Yes/No) · Penalties? (Yes/No) · Goals Over/Under · Cards Over/Under · Corners Over/Under · Handicap (+0.5 to +2.5 goals for a team). These are outcomes you can't cover with a simple prediction.",
      },
      {
        q: "How does the Handicap dare work? 🎲",
        a: "Pick a team and give them a goal head-start. 'Argentina +1.5' means your dare wins even if Argentina draws or loses by just 1 goal. The friend taking the other side needs Argentina to lose by 2+. Lines available: +0.5, +1, +1.5, +2, +2.5.",
      },
      {
        q: "How do I send a dare?",
        a: "Open a match → tap 'Dare friends'. Choose the dare type, pick your side (the other side auto-fills), set your stake and odds, tap 'Send Dare'. Share the link so your opponent can accept.",
      },
      {
        q: "What is the dare streak? 🔥",
        a: "Win dares back-to-back and earn a payout bonus: 3 wins in a row = +10%, 4 = +20%, 5+ = +35%. The bonus applies on top of your normal winnings.",
      },
      {
        q: "What are the dare milestones? 🎯",
        a: "Send enough dares for one-time bonuses: 5 dares sent → +50 tokens, 10 → +150 tokens, 20 → +400 tokens.",
      },
      {
        q: "Can I cancel a dare I sent?",
        a: "Yes, as long as it hasn't been accepted yet. Go to the Home screen, find your open dare under 'Dares I sent', and hit Cancel to recover your staked tokens.",
      },
      {
        q: "When do dares settle?",
        a: "Automatically within minutes of the final whistle. No action needed — tokens move on their own.",
      },
    ],
  },
  {
    id: "tournament",
    emoji: "🏆",
    title: "Tournament picks",
    items: [
      {
        q: "What are tournament picks?",
        a: "Long-range predictions on the whole tournament: who wins it, who scores the most goals (Golden Boot), and total goals across all 64 matches. These lock at the first whistle (June 11) and settle when the tournament ends.",
      },
      {
        q: "What is an insurance pick?",
        a: "After locking in a Winner or Golden Boot pick, you can add a free insurance pick — a second choice at no cost. If your main pick loses but your insurance is correct, you get back 50% of what the main pick would have paid.",
      },
      {
        q: "Why are some Golden Boot players not in the list?",
        a: "The list covers main contenders. Type any name in the search box to predict unlisted players — you'll get 101× odds on them.",
      },
    ],
  },
  {
    id: "deepcuts",
    emoji: "🔪",
    title: "Deep Cuts",
    items: [
      {
        q: "What are Deep Cuts?",
        a: "Stage-specific props that unlock round by round: Group Stage, Round of 32, Quarter-Finals, etc. Each round has unique markets — things like 'Will any group game end 0–0?' or 'Which team advances from Group A?'",
      },
      {
        q: "When do Deep Cuts lock?",
        a: "Each stage's markets lock when that stage begins. Check the badge — Open (green) means you can still predict, Locked (red) means that stage has started.",
      },
    ],
  },
  {
    id: "ai",
    emoji: "🤖",
    title: "AI suggestions",
    items: [
      {
        q: "What does the AI do?",
        a: "It analyses the match, your friend group's recent dares, and the available dare types — then suggests a specific dare you might not have thought of. It's a conversation starter, not financial advice.",
      },
      {
        q: "Is AI available for every group?",
        a: "Only if your group admin enabled it. If you don't see the AI tab, ask your admin to turn it on.",
      },
    ],
  },
]

export default function HelpPage() {
  const navigate = useNavigate()
  const [open, setOpen] = useState({})

  function toggle(id) {
    setOpen(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div>
      <PageBackground momentKey="rotating" />
      <div style={{ padding: "16px 16px 80px", maxWidth: 600, margin: "0 auto" }}>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 28, marginBottom: 4 }}>❓</div>
          <div style={{ color: "#e2e8f0", fontWeight: 800, fontSize: 20 }}>How to play</div>
          <div style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>
            Everything you need to know about WC Bets 2026
          </div>
        </div>

        {SECTIONS.map(section => (
          <div key={section.id} style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 12, fontWeight: 800, color: "#a78bfa",
              textTransform: "uppercase", letterSpacing: 1.5,
              marginBottom: 8, display: "flex", alignItems: "center", gap: 6,
            }}>
              {section.emoji} {section.title}
            </div>

            <div style={{ background: "#13131f", border: "1px solid #2d2b55", borderRadius: 12, overflow: "hidden" }}>
              {section.items.map((item, i) => {
                const id = `${section.id}-${i}`
                const isOpen = open[id]
                return (
                  <div key={id} style={{ borderBottom: i < section.items.length - 1 ? "1px solid #1e1b3a" : "none" }}>
                    <button
                      onClick={() => toggle(id)}
                      style={{
                        width: "100%", textAlign: "left", background: "none", border: "none",
                        padding: "13px 16px", cursor: "pointer",
                        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                      }}
                    >
                      <span style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600, flex: 1 }}>
                        {item.q}
                      </span>
                      <span style={{
                        color: "#6b7280", fontSize: 16, flexShrink: 0,
                        transform: isOpen ? "rotate(45deg)" : "none",
                        transition: "transform 0.15s",
                        display: "inline-block",
                      }}>+</span>
                    </button>
                    {isOpen && (
                      <div style={{
                        padding: "0 16px 14px", color: "#9ca3af", fontSize: 13, lineHeight: 1.6,
                        borderTop: "1px solid #1e1b3a",
                        paddingTop: 12,
                      }}>
                        {item.a}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        <div style={{
          background: "linear-gradient(135deg, rgba(168,85,247,0.1), rgba(59,130,246,0.1))",
          border: "1px solid #2d2b55", borderRadius: 12, padding: 16, textAlign: "center",
        }}>
          <div style={{ fontSize: 20, marginBottom: 6 }}>⚡</div>
          <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
            Ready to play?
          </div>
          <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 12 }}>
            Check the upcoming matches and make your first prediction.
          </div>
          <button
            onClick={() => navigate("/")}
            style={{
              background: "linear-gradient(135deg,#a855f7,#3b82f6)", color: "#fff",
              border: "none", borderRadius: 8, padding: "9px 24px",
              fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}
          >
            Go to Home
          </button>
        </div>
      </div>
    </div>
  )
}
