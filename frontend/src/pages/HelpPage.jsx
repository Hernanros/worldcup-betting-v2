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
        a: "A private betting game for your friend group during the 2026 World Cup. You start with 1,000 tokens (fake money). Bet on matches, make score predictions, challenge friends head-to-head, and try to finish the tournament with the highest token balance.",
      },
      {
        q: "How do I join?",
        a: "Ask your group admin for the invite code. Go to the login page, enter your name and the code, and you're in. You start with 1,000 tokens automatically.",
      },
      {
        q: "What are tokens?",
        a: "Tokens are your in-game currency — they're not real money. Win bets to earn more, lose bets and they're gone. Your token balance on the leaderboard is your score. Tokens never expire.",
      },
      {
        q: "How do I switch groups?",
        a: "Tap the ⇄ Switch button in the top bar. This takes you back to the login screen where you can enter a different group's invite code.",
      },
    ],
  },
  {
    id: "bets",
    emoji: "💰",
    title: "Match bets",
    items: [
      {
        q: "How do match bets work?",
        a: "Pick a market (1×2, Both Score, Goals, or Exact Score), choose your outcome, set your stake, and hit Place Bet. Tokens are deducted immediately. If you win, your stake × odds is credited when the match settles.",
      },
      {
        q: "What does 1×2 mean?",
        a: "It's the match result market: 1 = Home Win, × = Draw, 2 = Away Win. The most common bet type in football.",
      },
      {
        q: "What are odds?",
        a: "Odds tell you how much you win relative to your stake. Odds of 2.5 means a 100-token bet pays 250 tokens if correct. Higher odds = less likely outcome = bigger reward.",
      },
      {
        q: "What is a Wildcard bet? 🃏",
        a: "You get 3 wildcards for the entire tournament. Mark a bet as wildcard and if it wins, the payout doubles. Use them on your most confident picks — once gone, they're gone.",
      },
      {
        q: "When do bets settle?",
        a: "Automatically within a few minutes of the final whistle. You don't need to do anything — the app fetches the result and credits winnings.",
      },
      {
        q: "Can I cancel a bet?",
        a: "No — once placed, match bets are final. Double-check your selection before confirming.",
      },
    ],
  },
  {
    id: "predictions",
    emoji: "🎯",
    title: "Score predictions",
    items: [
      {
        q: "What's the difference between a prediction and a bet?",
        a: "Predictions are free — they don't cost tokens. You guess the exact final score of a match. Correct score = 3 pts, correct result (win/draw/loss) = 1 pt. Prediction points appear on a separate leaderboard tab.",
      },
      {
        q: "What is a double-points prediction? ⚡",
        a: "You can mark up to 3 predictions per tournament as double-points. If that prediction is correct, you earn 6 pts (exact score) or 2 pts (correct outcome) instead of the usual 3 or 1. Pick your most confident calls.",
      },
      {
        q: "When does prediction scoring lock?",
        a: "Predictions lock when the match kicks off. You can update your prediction any time before kick-off.",
      },
    ],
  },
  {
    id: "challenges",
    emoji: "⚔️",
    title: "Challenges",
    items: [
      {
        q: "What is a challenge?",
        a: "A head-to-head bet between you and a specific friend. You pick your side, they pick theirs, you both put up tokens, and the match result decides who wins.",
      },
      {
        q: "How do I issue a challenge?",
        a: "Open a match, go to Challenges, pick your bet type and selections, set the odds and your stake. Their counter-stake is calculated automatically. Tap Issue Challenge, then share the link with your opponent.",
      },
      {
        q: "What is a challenge streak? 🔥",
        a: "Win challenges back-to-back to build a streak. 3 wins in a row = +10% payout bonus. 4 in a row = +20%. 5+ = +35%. The bonus applies to your winnings on that challenge.",
      },
      {
        q: "What are the challenge milestones? 🎯",
        a: "Issue enough challenges and earn one-time token bonuses: 5 challenges issued → +50 tokens, 10 → +150, 20 → +400. These stack with your normal winnings.",
      },
      {
        q: "Can I cancel a challenge I issued?",
        a: "Yes — as long as it hasn't been accepted yet. Go to the Home screen, find your open challenge, and hit Cancel to recover your staked tokens.",
      },
    ],
  },
  {
    id: "tournament",
    emoji: "🏆",
    title: "Tournament bets",
    items: [
      {
        q: "What are tournament bets?",
        a: "Long-range bets on the whole tournament: who wins it, who scores the most goals (Golden Boot), and the total goals across all 64 matches. These lock at kick-off of the first match (June 11, 18:00 UTC) and settle when the tournament ends.",
      },
      {
        q: "What is an insurance pick?",
        a: "For Winner and Golden Boot bets, after placing your primary bet you can add a free insurance pick — a second choice at no cost. If your primary bet loses but your insurance pick is correct, you get back 50% of what your primary would have paid. If your primary wins, insurance is ignored.",
      },
      {
        q: "Why are some Golden Boot players not in the list?",
        a: "The list covers the main contenders. If you want to bet on someone not listed, just type their name in the search box — you'll get 101x odds on unlisted players.",
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
        a: "Stage-specific prop bets that unlock as the tournament progresses. Each round (Group Stage, Round of 16, Quarter-Finals, etc.) has unique markets — things like 'Will any group stage match end 0–0?' or 'Which team advances from Group A?'",
      },
      {
        q: "When do Deep Cuts lock?",
        a: "Each stage's markets lock when that stage begins. Check the stage badge — Open (green) means you can still bet, Locked (red) means that stage has started.",
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
        a: "It analyses the match, your existing bets and predictions, your recent form, and the available odds — then suggests a bet or challenge you might not have considered. It's a conversation starter, not financial advice.",
      },
      {
        q: "Is AI available for every group?",
        a: "Only if your group admin enabled it when creating the group. If you don't see the AI tab, your group has it turned off.",
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
            Check the upcoming matches and place your first bet.
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
