# WC Betting: Tooltips, Double Predictions & Insurance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add help tooltips across all pages for casual users; add double-points toggle to score predictions (max 3 per tournament, follows wildcard pattern); add free insurance picks on Tournament winner/golden_boot markets that pay half if the primary bet loses.

**Architecture:** Three independent subsystems — frontend-only tooltip audit; backend model + migration + router + settlement + frontend toggle for double predictions; backend InsurancePick model + two endpoints + settlement hook + frontend insurance UI in TournamentBetPanel.

**Tech Stack:** FastAPI + SQLAlchemy async, React + Vite, pytest-asyncio, httpx AsyncClient

**Working directory:** `/Users/hernanrosenblum/Documents/worldcup-betting-v2`
**Run backend tests:** `cd backend && pytest tests/ -v`
**Run frontend dev server:** `cd frontend && npm run dev`

---

> ⚠️ **Note:** These are 3 independent subsystems. They can be implemented in any order without blocking each other. The plan groups them in dependency order: tooltips (frontend only), then double predictions (backend + frontend), then insurance (backend + frontend).

---

## PART A — Help Tooltips Audit

### Task A1: HomePage.jsx — stats grid + active bets

**Files:**
- Modify: `frontend/src/pages/HomePage.jsx`

- [ ] **Step 1: Read the current stats array render and update it**

The stats array at line 76–79 renders objects `{ label, value }`. Change to `{ label, value, tip }` and render a `<HelpTip>` next to the label:

```jsx
// At the top, add import if not already present:
import HelpTip from "../components/HelpTip.jsx"

// Replace the stats array (lines ~76-89) with:
{[
  {
    label: "💰 Tokens",
    value: (player?.token_balance ?? 0).toLocaleString(),
    tip: "Your in-game currency. Win bets, challenges, and predictions to earn more. Tokens don't expire — they persist until the final is settled.",
  },
  {
    label: "🎯 Pred. pts",
    value: loading ? "…" : `${predictionPts}`,
    tip: "Points earned from score predictions: exact scoreline = 3 pts, correct match outcome = 1 pt. Displayed separately from token winnings.",
  },
  {
    label: "📊 Rank",
    value: loading ? "…" : (myRank ? `#${myRank}` : "—"),
    tip: "Your position in the token leaderboard — highest token balance wins. Tie-broken alphabetically. Check Rankings for all tabs.",
  },
].map(({ label, value, tip }) => (
  <div key={label} style={{
    background: "#13131f", border: "1px solid #2d2b55",
    borderRadius: 10, padding: "10px 8px", textAlign: "center",
  }}>
    <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
      {label} <HelpTip text={tip} />
    </div>
    <div className="gradient-text" style={{ fontWeight: 800, fontSize: 16 }}>{value}</div>
  </div>
))}
```

- [ ] **Step 2: Add HelpTip to the Active Bets wildcard badge**

Find the active bets render section (~line 141–145). The `🃏 2×` badge has no explanation. Add a HelpTip after the badge:

```jsx
// Replace the wildcard badge span (currently around line 143-145):
{b.is_wildcard && (
  <span style={{ color: "#fbbf24", fontSize: 9, fontWeight: 700,
    background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.4)",
    borderRadius: 4, padding: "1px 5px", display: "inline-flex", alignItems: "center", gap: 2 }}>
    🃏 2×
    <HelpTip text="Wildcard bet — if you win, payout is doubled. You had 3 wildcards for the whole tournament." />
  </span>
)}
```

- [ ] **Step 3: Verify HomePage renders correctly in the browser**

```bash
cd frontend && npm run dev
```

Open http://localhost:5173 — confirm the 3 stat cards each have a `?` button, clicking opens a tooltip card. Confirm the `🃏 2×` badge has a `?`.

- [ ] **Step 4: Commit**

```bash
cd /Users/hernanrosenblum/Documents/worldcup-betting-v2
git add frontend/src/pages/HomePage.jsx
git commit -m "feat: add help tooltips to HomePage stats grid and wildcard badge"
```

---

### Task A2: LeaderboardPage.jsx — tabs and red cards

**Files:**
- Modify: `frontend/src/pages/LeaderboardPage.jsx`

- [ ] **Step 1: Add HelpTip import and tab tooltips**

The `TABS` array at line 36-40 defines 3 tabs. Add a `tip` property and render it:

```jsx
import HelpTip from "../components/HelpTip.jsx"

// Replace TABS array:
const TABS = [
  { id: "tokens", label: "🏆 Tokens", tip: "Ranked by total token balance. Earn tokens by winning bets, challenges, and Deep Cuts markets." },
  { id: "predictions", label: "🎯 Predictions", tip: "Ranked by prediction points. Exact final score = 3 pts, correct match outcome = 1 pt. You can make one prediction per match." },
  { id: "red-cards", label: "🟥 Red Cards", tip: "Teams ranked by total red cards received across all matches. A fun side-stat — not tied to scoring." },
]

// Update the tab render (replace lines ~51-59):
{TABS.map((t) => (
  <button key={t.id} onClick={() => setTab(t.id)}
    style={{
      background: tab === t.id ? "linear-gradient(135deg,#a855f7,#3b82f6)" : "#1e1b3a",
      color: tab === t.id ? "#fff" : "#6b7280", border: "none",
      borderRadius: 999, padding: "5px 16px", fontSize: 12, fontWeight: 600,
      cursor: "pointer", whiteSpace: "nowrap",
      display: "inline-flex", alignItems: "center", gap: 4,
    }}>
    {t.label}
    <HelpTip text={t.tip} />
  </button>
))}
```

- [ ] **Step 2: Verify leaderboard tabs show tooltips**

Open http://localhost:5173/rankings — each tab pill has a `?` that opens a tooltip. The red cards tab tooltip explains it's a team stat.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/LeaderboardPage.jsx
git commit -m "feat: add help tooltips to LeaderboardPage tabs"
```

---

### Task A3: PredictionsPage.jsx + PredictionRow.jsx — scoring tips

**Files:**
- Modify: `frontend/src/pages/PredictionsPage.jsx`
- Modify: `frontend/src/components/PredictionRow.jsx`

- [ ] **Step 1: Add HelpTip to PredictionsPage header and points card**

```jsx
// Add import at top of PredictionsPage.jsx:
import HelpTip from "../components/HelpTip.jsx"

// Update the "Your total points" card (lines ~37-42):
<div style={{
  background: "#13131f", border: "1px solid #2d2b55", borderRadius: 10,
  padding: "10px 16px", marginBottom: 16,
  display: "flex", justifyContent: "space-between", alignItems: "center",
}}>
  <span style={{ color: "#6b7280", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
    Your total points
    <HelpTip text="Prediction points are separate from tokens. Exact score = 3 pts, correct outcome (win/draw/loss) = 1 pt. Points appear on the Predictions leaderboard tab." />
  </span>
  <span className="gradient-text" style={{ fontWeight: 800, fontSize: 18 }}>{totalPoints} pts</span>
</div>
```

- [ ] **Step 2: Add HelpTip to PredictionRow status badge**

In `PredictionRow.jsx`, add HelpTip import and update the status badge:

```jsx
import HelpTip from "./HelpTip.jsx"

// Replace the status badge span (lines ~73-83):
{pred && (
  <span style={{
    fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
    background: pred.status === "correct_score" ? "#16a34a" :
                pred.status === "correct_outcome" ? "#2563eb" : "#374151",
    color: "#fff",
    display: "inline-flex", alignItems: "center", gap: 3,
  }}>
    {pred.status === "correct_score" ? "+3 pts ✓" :
     pred.status === "correct_outcome" ? "+1 pt ~" :
     pred.status === "wrong" ? "Wrong" : "Pending"}
    <HelpTip text="Exact score (e.g. 2-1 = 2-1) earns 3 pts. Correct outcome (right winner or draw, wrong score) earns 1 pt. Pending means the match hasn't finished yet." />
  </span>
)}
```

- [ ] **Step 3: Verify prediction page tooltips render**

Open http://localhost:5173/predictions — "Your total points" label has `?`, status badges have `?`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/PredictionsPage.jsx frontend/src/components/PredictionRow.jsx
git commit -m "feat: add help tooltips to PredictionsPage and PredictionRow status badge"
```

---

### Task A4: TournamentPage.jsx — groups, wildcard race, bracket

**Files:**
- Modify: `frontend/src/pages/TournamentPage.jsx`

- [ ] **Step 1: Add HelpTip import and group table column tip**

```jsx
import HelpTip from "../components/HelpTip.jsx"
```

In `GroupTable` component, update the header to add a HelpTip after the abbreviations:

```jsx
// Replace the GroupTable header div (lines ~111-115):
<div style={{ display: "grid", gridTemplateColumns: "1fr 28px 28px 28px 28px 42px", alignItems: "center", padding: "0 12px 6px", borderBottom: "1px solid #2d2b55", marginBottom: 4 }}>
  <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, textTransform: "uppercase" }}>Team</span>
  {["P", "W", "D", "L"].map(h => (
    <span key={h} style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, textAlign: "center" }}>{h}</span>
  ))}
  <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
    Pts
    <HelpTip text="P=Played, W=Wins, D=Draws, L=Losses, Pts=Points (3 for a win, 1 for a draw). Top 2 advance automatically; 3rd place enters the wildcard race." />
  </span>
</div>
```

- [ ] **Step 2: Add HelpTip to the Wildcards table title**

In `WildcardsTable` component, update the title div:

```jsx
// Replace the WildcardsTable title div (lines ~149-152):
<div style={{ fontSize: 11, fontWeight: 800, color: "#fbbf24", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
  🃏 Wildcard Race — Best 3rd-Place (Top 8 Advance)
  <HelpTip text="In WC 2026, all 12 groups produce one 3rd-place team. The 8 best 3rd-place teams advance to the Round of 32 as wildcards. Ranked by: points → goal difference → goals scored." />
</div>
```

Also add GD column tip in the WildcardsTable header:

```jsx
// In the WildcardsTable header, update GD span:
<span style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
  GD
  <HelpTip text="Goal Difference = goals scored minus goals conceded. Used as a tiebreaker when points are equal." />
</span>
```

- [ ] **Step 3: Add HelpTip to BracketTab TBD explanation**

In `BracketMatch` component, update the "TBD" team row span so its label has a tip:

```jsx
// In teamRow function inside BracketMatch, update the TBD name span:
<span style={{ flex: 1, fontSize: 12, color: confirmed ? "#e2e8f0" : "#6b7280", fontWeight: won ? 700 : 400, fontStyle: confirmed ? "normal" : "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
  {confirmed ? name : (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
      TBD
      <HelpTip text="To Be Determined — this team slot fills in once the previous round match is settled." />
    </span>
  )}
</span>
```

- [ ] **Step 4: Verify tournament page tooltips**

Open http://localhost:5173/tournament → Groups tab: "Pts" column header has `?`. Wildcard Race title has `?`. Bracket tab: TBD slots have `?`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/TournamentPage.jsx
git commit -m "feat: add help tooltips to TournamentPage groups, wildcard race, and bracket"
```

---

### Task A5: TournamentBetPanel.jsx — market and odds tips

**Files:**
- Modify: `frontend/src/components/TournamentBetPanel.jsx`

- [ ] **Step 1: Add HelpTip import and panel-level tip**

```jsx
import HelpTip from "./HelpTip.jsx"
```

Add a HelpTip to the market description paragraph (currently `{market.description}` at line 138):

```jsx
// Replace the market description paragraph (line ~138):
<p style={{ color: "#6b7280", fontSize: 12, marginBottom: 12, display: "flex", alignItems: "center", gap: 4 }}>
  {market.description}
  {activeMarket === "winner" && (
    <HelpTip text="Pick the team that lifts the trophy. Odds reflect each team's probability — heavy favourites pay less. Lock date: June 11, 18:00 UTC." />
  )}
  {activeMarket === "golden_boot" && (
    <HelpTip text="Top scorer of the entire tournament. Pick from the list or type any player name — unlisted players get 101x odds. Lock date: June 11, 18:00 UTC." />
  )}
  {activeMarket === "total_goals" && (
    <HelpTip text="Over/Under on the total number of goals scored across all 64 matches. WC 2026 averages ~2.5 goals per match. Lock date: June 11, 18:00 UTC." />
  )}
</p>
```

- [ ] **Step 2: Add HelpTip to the Win calculation display**

The `potentialWin` display at line ~227:

```jsx
// Replace the win amount span (lines ~227-229):
{potentialWin && (
  <span style={{ color: "#4ade80", fontSize: 12, marginLeft: "auto", display: "flex", alignItems: "center", gap: 3 }}>
    Win: {potentialWin.toLocaleString()}
    <HelpTip text="Potential payout = stake × odds. These are long-term tournament bets — odds are locked at placement time even if the market moves." />
  </span>
)}
```

- [ ] **Step 3: Verify TournamentBetPanel tooltips**

Open http://localhost:5173/tournament → Bets tab. Each market tab shows a description with a `?`. The Win amount has a `?`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/TournamentBetPanel.jsx
git commit -m "feat: add help tooltips to TournamentBetPanel market descriptions and win display"
```

---

### Task A6: AIPage.jsx — assistant tips

**Files:**
- Modify: `frontend/src/pages/AIPage.jsx`

- [ ] **Step 1: Add HelpTip import and page tip**

```jsx
import HelpTip from "../components/PageBackground.jsx"  // wrong — import from:
import HelpTip from "../components/HelpTip.jsx"
```

Add a HelpTip to the page header:

```jsx
// Update the "AI Assistant" header div (around line 76-77):
<div style={{ color: "#e2e8f0", fontWeight: 800, fontSize: 20, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
  AI Assistant
  <HelpTip text="Claude analyses the current odds for a match and suggests 3 challenge ideas — each with picks, odds, and a reason. Hit 'Use This' to pre-fill the challenge form on the match page." />
</div>
```

- [ ] **Step 2: Add HelpTip near the suggestion cards' odds display**

In the suggestion cards (line ~140-142), the `{s.my_odds}x` and `{s.their_odds}x` values are decimal odds. Add a tip to the odds section:

```jsx
// In the suggestion card, update the odds section (around lines 140-152):
<div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "flex-start" }}>
  <div style={{ textAlign: "center", flex: 1 }}>
    <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
      Your pick
      <HelpTip text="The side of the bet you'd take. If you win, you receive stake × your odds tokens." />
    </div>
    <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 14 }}>{s.my_pick}</div>
    <div style={{ color: "#4ade80", fontSize: 11 }}>{s.my_odds}x</div>
  </div>
  <div style={{ color: "#2d2b55", fontSize: 16, alignSelf: "center" }}>vs</div>
  <div style={{ textAlign: "center", flex: 1 }}>
    <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 2 }}>Their pick</div>
    <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 14 }}>{s.their_pick}</div>
    <div style={{ color: "#f87171", fontSize: 11 }}>{s.their_odds}x</div>
  </div>
  <div style={{ textAlign: "center", flex: 1 }}>
    <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 2 }}>Stake</div>
    <div style={{ color: "#fbbf24", fontWeight: 700, fontSize: 14 }}>{s.stake}</div>
    <div style={{ color: "#6b7280", fontSize: 11 }}>tokens</div>
  </div>
</div>
```

- [ ] **Step 3: Verify AI page tooltips**

Open http://localhost:5173/ai → Page title has `?`. Suggestion cards show `?` on "Your pick".

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/AIPage.jsx
git commit -m "feat: add help tooltips to AIPage header and suggestion card odds"
```

---

## PART B — Double-Points Predictions (Wildcard)

### Task B1: Backend model + migration

**Files:**
- Modify: `backend/app/models.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Write the failing test for the model column**

```bash
# Create test file first
cat >> /Users/hernanrosenblum/Documents/worldcup-betting-v2/backend/tests/test_double_predictions.py << 'EOF'
from tests.conftest import join_player, make_match


async def test_prediction_has_is_double_field(client, db):
    """Prediction model has is_double boolean field."""
    from app.models import Prediction
    m = await make_match(db)
    pred = Prediction(
        player_id=1, match_id=m.id,
        home_score_pred=2, away_score_pred=1,
        is_double=True,
    )
    db.add(pred)
    await db.commit()
    await db.refresh(pred)
    assert pred.is_double is True
EOF
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/hernanrosenblum/Documents/worldcup-betting-v2/backend
pytest tests/test_double_predictions.py::test_prediction_has_is_double_field -v
```

Expected: FAIL with `TypeError: __init__() got an unexpected keyword argument 'is_double'` or similar.

- [ ] **Step 3: Add is_double to Prediction model**

In `backend/app/models.py`, update the Prediction class (after `points_awarded` line ~123):

```python
class Prediction(Base):
    __tablename__ = "predictions"
    id = Column(Integer, primary_key=True)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)
    home_score_pred = Column(Integer, nullable=False)
    away_score_pred = Column(Integer, nullable=False)
    status = Column(String(30), nullable=False, default="pending")
    points_awarded = Column(Integer, nullable=False, default=0)
    is_double = Column(Boolean, nullable=False, default=False)  # NEW: marks up to 3 predictions as double-points

    __table_args__ = (UniqueConstraint("player_id", "match_id", name="uq_pred_player_match"),)

    player = relationship("Player", backref="predictions")
    match = relationship("Match", back_populates="predictions")
```

- [ ] **Step 4: Add migration to main.py**

In `backend/app/main.py`, inside `_run_migrations()`, after the wildcard bets migration block (~line 99):

```python
        # Double-points predictions
        await db.execute(text(
            "ALTER TABLE predictions ADD COLUMN IF NOT EXISTS is_double BOOLEAN NOT NULL DEFAULT FALSE"
        ))
        await db.commit()
```

- [ ] **Step 5: Run the test — expect it to pass**

```bash
cd /Users/hernanrosenblum/Documents/worldcup-betting-v2/backend
pytest tests/test_double_predictions.py::test_prediction_has_is_double_field -v
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/hernanrosenblum/Documents/worldcup-betting-v2
git add backend/app/models.py backend/app/main.py backend/tests/test_double_predictions.py
git commit -m "feat: add is_double column to Prediction model with migration"
```

---

### Task B2: Backend router — accept + enforce max 3

**Files:**
- Modify: `backend/app/routers/predictions.py`

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_double_predictions.py`:

```python
async def test_double_prediction_accepted(client, db):
    """POST /api/predictions accepts is_double=True and returns it."""
    m = await make_match(db)
    data = await join_player(client)
    headers = {"Authorization": f"Bearer {data['token']}"}
    resp = await client.post("/api/predictions", json={
        "match_id": m.id, "home_score_pred": 2, "away_score_pred": 1, "is_double": True,
    }, headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["is_double"] is True
    assert body["doubles_used"] == 1


async def test_max_3_double_predictions(client, db):
    """Player cannot mark more than 3 predictions as double."""
    from tests.conftest import make_match as mk
    headers = {"Authorization": f"Bearer {(await join_player(client))['token']}"}
    for i in range(3):
        m = await mk(db, home=f"Team{i}A", away=f"Team{i}B")
        resp = await client.post("/api/predictions", json={
            "match_id": m.id, "home_score_pred": 1, "away_score_pred": 0, "is_double": True,
        }, headers=headers)
        assert resp.status_code == 200
    # 4th double should fail
    m4 = await mk(db, home="Extra1", away="Extra2")
    resp = await client.post("/api/predictions", json={
        "match_id": m4.id, "home_score_pred": 2, "away_score_pred": 2, "is_double": True,
    }, headers=headers)
    assert resp.status_code == 400
    assert "3 double" in resp.json()["detail"]


async def test_updating_existing_double_does_not_double_count(client, db):
    """Updating a prediction that's already marked is_double doesn't count as a new double."""
    m = await make_match(db)
    headers = {"Authorization": f"Bearer {(await join_player(client))['token']}"}
    await client.post("/api/predictions", json={
        "match_id": m.id, "home_score_pred": 1, "away_score_pred": 0, "is_double": True,
    }, headers=headers)
    # Update same match — still is_double=True, should not double-count
    resp = await client.post("/api/predictions", json={
        "match_id": m.id, "home_score_pred": 2, "away_score_pred": 0, "is_double": True,
    }, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["doubles_used"] == 1


async def test_get_predictions_includes_is_double(client, db):
    """GET /api/predictions includes is_double in my_prediction."""
    m = await make_match(db)
    data = await join_player(client)
    headers = {"Authorization": f"Bearer {data['token']}"}
    await client.post("/api/predictions", json={
        "match_id": m.id, "home_score_pred": 1, "away_score_pred": 0, "is_double": True,
    }, headers=headers)
    resp = await client.get("/api/predictions", headers=headers)
    assert resp.status_code == 200
    preds = resp.json()
    my_pred = next(p for p in preds if p["my_prediction"] is not None)
    assert my_pred["my_prediction"]["is_double"] is True
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/hernanrosenblum/Documents/worldcup-betting-v2/backend
pytest tests/test_double_predictions.py -v -k "not test_prediction_has_is_double"
```

Expected: Multiple FAILs — `is_double` not accepted in POST body, not returned in response.

- [ ] **Step 3: Update predictions.py**

Replace the full content of `backend/app/routers/predictions.py`:

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.deps import get_current_player
from app.models import Match, Prediction
from app.deep_cuts_config import WC2026_GROUPS

router = APIRouter()

# Reverse lookup: team name → group letter (A–L), built once at import time
_TEAM_TO_GROUP: dict[str, str] = {
    team: letter
    for letter, teams in WC2026_GROUPS.items()
    for team in teams
}


@router.get("/api/predictions")
async def get_predictions(auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    player, _ = auth
    matches = (await db.execute(select(Match).order_by(Match.kickoff_time))).scalars().all()
    my_preds = {
        p.match_id: p
        for p in (await db.execute(select(Prediction).where(Prediction.player_id == player.id))).scalars().all()
    }
    result = []
    for m in matches:
        pred = my_preds.get(m.id)
        result.append({
            "match_id": m.id, "home_team": m.home_team, "away_team": m.away_team,
            "kickoff_time": m.kickoff_time.isoformat(), "status": m.status,
            "round": m.round,
            "group": _TEAM_TO_GROUP.get(m.home_team) if m.round == "group" else None,
            "home_team_confirmed": m.home_team_confirmed,
            "away_team_confirmed": m.away_team_confirmed,
            "home_score": m.home_score, "away_score": m.away_score,
            "my_prediction": {
                "home_score_pred": pred.home_score_pred,
                "away_score_pred": pred.away_score_pred,
                "status": pred.status,
                "points_awarded": pred.points_awarded,
                "is_double": pred.is_double,  # NEW
            } if pred else None,
        })
    return result


@router.post("/api/predictions")
async def save_prediction(data: dict, auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    player, _ = auth
    match = await db.get(Match, data["match_id"])
    if not match:
        raise HTTPException(404, "match not found")
    if match.status == "finished":
        raise HTTPException(400, "match already finished")
    if not match.home_team_confirmed or not match.away_team_confirmed:
        raise HTTPException(400, "teams not yet confirmed")

    is_double = bool(data.get("is_double", False))

    existing = (await db.execute(
        select(Prediction).where(
            Prediction.player_id == player.id,
            Prediction.match_id == data["match_id"],
        )
    )).scalar_one_or_none()

    # Enforce max 3 double picks per player — only check when newly activating is_double
    currently_double = existing.is_double if existing else False
    if is_double and not currently_double:
        doubles_used = (await db.execute(
            select(func.count(Prediction.id)).where(
                Prediction.player_id == player.id,
                Prediction.is_double == True,  # noqa: E712
            )
        )).scalar() or 0
        if doubles_used >= 3:
            raise HTTPException(400, "You have already used all 3 double-point picks")

    if existing:
        existing.home_score_pred = int(data["home_score_pred"])
        existing.away_score_pred = int(data["away_score_pred"])
        existing.is_double = is_double
        pred = existing
    else:
        pred = Prediction(
            player_id=player.id,
            match_id=data["match_id"],
            home_score_pred=int(data["home_score_pred"]),
            away_score_pred=int(data["away_score_pred"]),
            is_double=is_double,
        )
        db.add(pred)

    await db.commit()
    await db.refresh(pred)

    # Return updated double count so UI can refresh immediately
    doubles_used_after = (await db.execute(
        select(func.count(Prediction.id)).where(
            Prediction.player_id == player.id,
            Prediction.is_double == True,  # noqa: E712
        )
    )).scalar() or 0

    return {
        "id": pred.id,
        "home_score_pred": pred.home_score_pred,
        "away_score_pred": pred.away_score_pred,
        "status": pred.status,
        "points_awarded": pred.points_awarded,
        "is_double": pred.is_double,
        "doubles_used": doubles_used_after,
    }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/hernanrosenblum/Documents/worldcup-betting-v2/backend
pytest tests/test_double_predictions.py -v
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Run full test suite to catch regressions**

```bash
pytest tests/ -v --tb=short
```

Expected: All existing tests still pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/hernanrosenblum/Documents/worldcup-betting-v2
git add backend/app/routers/predictions.py backend/tests/test_double_predictions.py
git commit -m "feat: add is_double support to predictions router with max-3 enforcement"
```

---

### Task B3: Backend settlement — double points in poller

**Files:**
- Modify: `backend/app/poller.py`

- [ ] **Step 1: Write the failing settlement test**

Append to `backend/tests/test_double_predictions.py`:

```python
async def test_double_prediction_settles_at_6pts(client, db):
    """A correct_score prediction marked is_double=True awards 6 pts instead of 3."""
    from tests.conftest import make_match
    from sqlalchemy import select as sa_select
    from app.models import Prediction
    from app.poller import settle_match

    m = await make_match(db, status="locked", home="Spain", away="France")
    data = await join_player(client)
    headers = {"Authorization": f"Bearer {data['token']}"}
    resp = await client.post("/api/predictions", json={
        "match_id": m.id, "home_score_pred": 2, "away_score_pred": 1, "is_double": True,
    }, headers=headers)
    assert resp.status_code == 200

    await settle_match(db, m, {
        "home_score": 2, "away_score": 1,
        "home_red_cards": 0, "away_red_cards": 0, "corners": 0,
    })

    pred = (await db.execute(
        sa_select(Prediction).where(Prediction.match_id == m.id)
    )).scalar_one()
    assert pred.status == "correct_score"
    assert pred.points_awarded == 6  # 3 × 2 for double


async def test_double_prediction_correct_outcome_awards_2pts(client, db):
    """A correct_outcome prediction marked is_double=True awards 2 pts instead of 1."""
    from tests.conftest import make_match
    from sqlalchemy import select as sa_select
    from app.models import Prediction
    from app.poller import settle_match

    m = await make_match(db, status="locked", home="Brazil", away="Argentina")
    data = await join_player(client)
    headers = {"Authorization": f"Bearer {data['token']}"}
    # Predict Brazil wins 1-0; actual result Brazil wins 2-0 → correct outcome, wrong score
    await client.post("/api/predictions", json={
        "match_id": m.id, "home_score_pred": 1, "away_score_pred": 0, "is_double": True,
    }, headers={"Authorization": f"Bearer {data['token']}"})

    await settle_match(db, m, {
        "home_score": 2, "away_score": 0,
        "home_red_cards": 0, "away_red_cards": 0, "corners": 0,
    })

    pred = (await db.execute(
        sa_select(Prediction).where(Prediction.match_id == m.id)
    )).scalar_one()
    assert pred.status == "correct_outcome"
    assert pred.points_awarded == 2  # 1 × 2 for double


async def test_non_double_prediction_unaffected(client, db):
    """Regular (non-double) predictions still award 3pts / 1pt."""
    from tests.conftest import make_match
    from sqlalchemy import select as sa_select
    from app.models import Prediction
    from app.poller import settle_match

    m = await make_match(db, status="locked", home="Germany", away="England")
    data = await join_player(client)
    await client.post("/api/predictions", json={
        "match_id": m.id, "home_score_pred": 3, "away_score_pred": 1, "is_double": False,
    }, headers={"Authorization": f"Bearer {data['token']}"})

    await settle_match(db, m, {
        "home_score": 3, "away_score": 1,
        "home_red_cards": 0, "away_red_cards": 0, "corners": 0,
    })

    pred = (await db.execute(
        sa_select(Prediction).where(Prediction.match_id == m.id)
    )).scalar_one()
    assert pred.status == "correct_score"
    assert pred.points_awarded == 3  # unchanged
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/hernanrosenblum/Documents/worldcup-betting-v2/backend
pytest tests/test_double_predictions.py::test_double_prediction_settles_at_6pts tests/test_double_predictions.py::test_double_prediction_correct_outcome_awards_2pts tests/test_double_predictions.py::test_non_double_prediction_unaffected -v
```

Expected: FAIL — `assert 3 == 6` (settlement doesn't apply multiplier yet).

- [ ] **Step 3: Update _settle_predictions in poller.py**

In `backend/app/poller.py`, replace the `_settle_predictions` function:

```python
async def _settle_predictions(db, match, result):
    preds = (await db.execute(
        select(Prediction).where(Prediction.match_id == match.id, Prediction.status == "pending")
    )).scalars().all()
    hs, as_ = result["home_score"], result["away_score"]
    for pred in preds:
        multiplier = 2 if pred.is_double else 1
        if pred.home_score_pred == hs and pred.away_score_pred == as_:
            pred.status = "correct_score"
            pred.points_awarded = 3 * multiplier
        elif _same_outcome(pred.home_score_pred, pred.away_score_pred, hs, as_):
            pred.status = "correct_outcome"
            pred.points_awarded = 1 * multiplier
        else:
            pred.status = "wrong"
            pred.points_awarded = 0
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/hernanrosenblum/Documents/worldcup-betting-v2/backend
pytest tests/test_double_predictions.py -v
```

Expected: All 8 tests PASS.

- [ ] **Step 5: Full suite regression check**

```bash
pytest tests/ -v --tb=short
```

Expected: All pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/hernanrosenblum/Documents/worldcup-betting-v2
git add backend/app/poller.py backend/tests/test_double_predictions.py
git commit -m "feat: double-points predictions settle at 6pts/2pts when is_double=True"
```

---

### Task B4: Frontend — PredictionRow double toggle + PredictionsPage count

**Files:**
- Modify: `frontend/src/components/PredictionRow.jsx`
- Modify: `frontend/src/pages/PredictionsPage.jsx`

- [ ] **Step 1: Update PredictionRow.jsx to add the double toggle**

Replace the full content of `frontend/src/components/PredictionRow.jsx`:

```jsx
import { useState, useRef } from "react"
import { api } from "../api.js"
import { flagUrl } from "../data/teams.js"
import HelpTip from "./HelpTip.jsx"

function Flag({ name }) {
  const url = flagUrl(name, 40)
  if (!url) return null
  return (
    <img src={url} alt={name} width={20} height={14}
      style={{ objectFit: "cover", borderRadius: 2, verticalAlign: "middle", marginRight: 5 }}
      onError={(e) => { e.target.style.display = "none" }} />
  )
}

export default function PredictionRow({ entry, onSaved, doublesUsed = 0 }) {
  const [home, setHome] = useState(entry.my_prediction?.home_score_pred ?? "")
  const [away, setAway] = useState(entry.my_prediction?.away_score_pred ?? "")
  const [isDouble, setIsDouble] = useState(entry.my_prediction?.is_double ?? false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState("")
  const awayRef = useRef(null)

  function handleHomeChange(e) {
    const v = e.target.value
    setHome(v)
    if (v !== "") {
      awayRef.current?.focus()
      awayRef.current?.select()
    }
  }

  const locked = entry.status === "finished" || entry.status === "locked"
  const pred = entry.my_prediction

  // Can toggle double if: already double (can always un-double), or doubles remaining
  const doublesLeft = 3 - doublesUsed
  const canDouble = isDouble || doublesLeft > 0

  async function save() {
    if (home === "" || away === "") return setMsg("Enter both scores")
    const homeNum = Number(home)
    const awayNum = Number(away)
    if (!Number.isInteger(homeNum) || !Number.isInteger(awayNum) || homeNum < 0 || awayNum < 0) {
      return setMsg("Scores must be non-negative integers")
    }
    setSaving(true)
    setMsg("")
    try {
      const result = await api.post("/api/predictions", {
        match_id: entry.match_id,
        home_score_pred: homeNum,
        away_score_pred: awayNum,
        is_double: isDouble,
      })
      setMsg("✓ Saved")
      onSaved?.(result.doubles_used)
    } catch (err) { setMsg(`✗ ${err.message}`) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ background: "#13131f", border: "1px solid #2d2b55", borderRadius: 10, padding: 12, marginBottom: 8 }}>
      {/* Group label */}
      {entry.group && (
        <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>
          Group {entry.group}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "nowrap", minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: "#e2e8f0", whiteSpace: "nowrap" }}>
            <Flag name={entry.home_team} />{entry.home_team}
          </span>
          <span style={{ color: "#6b7280", fontSize: 12, flexShrink: 0 }}>vs</span>
          <span style={{ fontWeight: 600, fontSize: 13, color: "#e2e8f0", whiteSpace: "nowrap" }}>
            <Flag name={entry.away_team} />{entry.away_team}
          </span>
        </div>
        {pred && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
            background: pred.status === "correct_score" ? "#16a34a" :
                        pred.status === "correct_outcome" ? "#2563eb" : "#374151",
            color: "#fff",
            display: "inline-flex", alignItems: "center", gap: 3,
          }}>
            {pred.status === "correct_score" ? (pred.is_double ? "+6 pts ✓✓" : "+3 pts ✓") :
             pred.status === "correct_outcome" ? (pred.is_double ? "+2 pt ~" : "+1 pt ~") :
             pred.status === "wrong" ? "Wrong" : "Pending"}
            <HelpTip text="Exact score earns 3 pts (6 if double). Correct outcome earns 1 pt (2 if double). Pending means the match hasn't finished yet." />
          </span>
        )}
      </div>

      {/* Score inputs */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
        <input type="number" min={0} step={1} value={home} onChange={handleHomeChange}
          disabled={locked}
          style={{ width: 52, background: "#0c0c14", border: "1px solid #2d2b55", borderRadius: 6,
            padding: "5px 8px", color: "#e2e8f0", fontSize: 14, textAlign: "center",
            cursor: locked ? "not-allowed" : "auto", opacity: locked ? 0.5 : 1 }} />
        <span style={{ color: "#6b7280", fontSize: 12 }}>—</span>
        <input ref={awayRef} type="number" min={0} step={1} value={away} onChange={(e) => setAway(e.target.value)}
          disabled={locked}
          style={{ width: 52, background: "#0c0c14", border: "1px solid #2d2b55", borderRadius: 6,
            padding: "5px 8px", color: "#e2e8f0", fontSize: 14, textAlign: "center",
            cursor: locked ? "not-allowed" : "auto", opacity: locked ? 0.5 : 1 }} />
        {!locked && (
          <button onClick={save} disabled={saving}
            style={{ background: "linear-gradient(135deg,#a855f7,#3b82f6)", color: "#fff",
              border: "none", borderRadius: 6, padding: "5px 14px", fontSize: 12, fontWeight: 700,
              cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? "..." : "Save"}
          </button>
        )}
        {msg && <span style={{ fontSize: 11, color: msg.startsWith("✓") ? "#4ade80" : "#f87171" }}>{msg}</span>}
      </div>

      {/* Double-points toggle — only show for editable predictions */}
      {!locked && (
        <div style={{
          background: "#0c0c14",
          border: `1px solid ${isDouble ? "#f59e0b" : "#2d2b55"}`,
          borderRadius: 8, padding: "8px 10px", marginTop: 8,
          display: "flex", alignItems: "center", gap: 10,
          opacity: canDouble ? 1 : 0.5,
        }}>
          <button
            onClick={() => canDouble && setIsDouble(v => !v)}
            disabled={!canDouble && !isDouble}
            style={{
              width: 32, height: 18, borderRadius: 999, border: "none",
              cursor: canDouble ? "pointer" : "not-allowed",
              background: isDouble ? "#f59e0b" : "#2d2b55", padding: 0,
              position: "relative", flexShrink: 0, transition: "background 0.2s",
            }}
          >
            <span style={{
              position: "absolute", top: 2, left: isDouble ? 16 : 2,
              width: 14, height: 14, borderRadius: "50%", background: "#fff",
              transition: "left 0.2s", display: "block",
            }} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ color: isDouble ? "#f59e0b" : "#e2e8f0", fontSize: 11, fontWeight: 700 }}>
              ⚡ Double Points
            </div>
            <div style={{ color: "#6b7280", fontSize: 10, marginTop: 1 }}>
              {canDouble
                ? `${doublesLeft} double${doublesLeft === 1 ? "" : "s"} remaining`
                : "All 3 doubles used"}
            </div>
          </div>
          <HelpTip text="Mark up to 3 predictions as double points. If correct, score 6 pts (exact) or 2 pts (outcome) instead of the usual 3/1. Toggle on then hit Save." />
        </div>
      )}
      {/* Show settled double badge */}
      {locked && pred?.is_double && (
        <div style={{ fontSize: 10, color: "#f59e0b", marginTop: 4, display: "flex", alignItems: "center", gap: 3 }}>
          ⚡ Double pick
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update PredictionsPage.jsx to track and pass doubles count**

Replace the full content of `frontend/src/pages/PredictionsPage.jsx`:

```jsx
import { useState, useEffect } from "react"
import { api } from "../api.js"
import PredictionRow from "../components/PredictionRow.jsx"
import HelpTip from "../components/HelpTip.jsx"
import PageBackground from "../components/PageBackground.jsx"

export default function PredictionsPage() {
  const [entries, setEntries] = useState([])
  const [doublesUsed, setDoublesUsed] = useState(0)
  const [error, setError] = useState(null)

  const totalPoints = entries.reduce((acc, e) => acc + (e.my_prediction?.points_awarded || 0), 0)

  async function load() {
    setError(null)
    try {
      const data = await api.get("/api/predictions")
      setEntries(data)
      // Count how many predictions are marked as double
      const count = data.filter(e => e.my_prediction?.is_double).length
      setDoublesUsed(count)
    } catch (err) {
      setError(err.message || "Failed to load predictions")
    }
  }

  function handleRowSaved(newDoublesCount) {
    if (newDoublesCount !== undefined) {
      setDoublesUsed(newDoublesCount)
    }
    load()
  }

  useEffect(() => { load() }, [])

  return (
    <div>
      <PageBackground momentKey="italy_2006" />
      <div style={{ padding: "16px 16px 8px" }}>
        <div style={{ fontSize: 24 }}>🎯</div>
        <div style={{ color: "#e2e8f0", fontWeight: 800, fontSize: 20, marginTop: 4 }}>Predictions</div>
      </div>
      <div style={{ padding: 16 }}>
        {error && <p style={{ color: "#f87171", textAlign: "center", fontSize: 13 }}>⚠ {error}</p>}

        {/* Points summary card */}
        <div style={{
          background: "#13131f", border: "1px solid #2d2b55", borderRadius: 10,
          padding: "10px 16px", marginBottom: 10,
          display: "flex", justifyContent: "space-between",
        }}>
          <span style={{ color: "#6b7280", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
            Your total points
            <HelpTip text="Prediction points are separate from tokens. Exact score = 3 pts, correct outcome = 1 pt. Doubles double these values. Points appear on the Predictions leaderboard tab." />
          </span>
          <span className="gradient-text" style={{ fontWeight: 800, fontSize: 18 }}>{totalPoints} pts</span>
        </div>

        {/* Double picks summary */}
        <div style={{
          background: "#0c0c14", border: "1px solid #2d2b55", borderRadius: 8,
          padding: "7px 12px", marginBottom: 16,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ color: "#6b7280", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
            ⚡ Double picks used
            <HelpTip text="Mark up to 3 predictions as Double Points before the match starts. A correct double earns 6 pts (exact score) or 2 pts (correct outcome) instead of the usual 3/1." />
          </span>
          <span style={{ color: doublesUsed >= 3 ? "#f59e0b" : "#4ade80", fontWeight: 700, fontSize: 13 }}>
            {doublesUsed} / 3
          </span>
        </div>

        {entries.map((e) => (
          <PredictionRow
            key={e.match_id}
            entry={e}
            onSaved={handleRowSaved}
            doublesUsed={doublesUsed}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify double toggle works in the browser**

```bash
cd frontend && npm run dev
```

Open http://localhost:5173/predictions. Each pending match shows an "⚡ Double Points" toggle. The header shows "0 / 3" doubles used. Toggling and saving a prediction updates the count.

- [ ] **Step 4: Commit**

```bash
cd /Users/hernanrosenblum/Documents/worldcup-betting-v2
git add frontend/src/components/PredictionRow.jsx frontend/src/pages/PredictionsPage.jsx
git commit -m "feat: add double-points toggle to PredictionRow and doubles-used count to PredictionsPage"
```

---

## PART C — Insurance Pick on Tournament Bets

### Task C1: InsurancePick model + migration

**Files:**
- Modify: `backend/app/models.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Write the failing test for InsurancePick model**

Create `backend/tests/test_insurance_picks.py`:

```python
from tests.conftest import join_player, make_match


async def _place_tournament_bet(client, bet_type="winner", selection="Spain", stake=100):
    """Helper: join as Alice and place a tournament bet."""
    data = await join_player(client)
    headers = {"Authorization": f"Bearer {data['token']}"}
    resp = await client.post("/api/tournament/bets", json={
        "bet_type": bet_type, "selection": selection, "stake": stake,
    }, headers=headers)
    assert resp.status_code == 200
    return data, headers


async def test_insurance_pick_model_exists(db):
    """InsurancePick model is importable and has correct columns."""
    from app.models import InsurancePick
    assert hasattr(InsurancePick, "player_id")
    assert hasattr(InsurancePick, "tournament_bet_id")
    assert hasattr(InsurancePick, "bet_type")
    assert hasattr(InsurancePick, "selection")
    assert hasattr(InsurancePick, "status")
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/hernanrosenblum/Documents/worldcup-betting-v2/backend
pytest tests/test_insurance_picks.py::test_insurance_pick_model_exists -v
```

Expected: FAIL with `ImportError: cannot import name 'InsurancePick'`.

- [ ] **Step 3: Add InsurancePick to models.py**

In `backend/app/models.py`, add after the `SpicyDismissal` class:

```python
class InsurancePick(Base):
    """Free second pick on winner/golden_boot tournament markets.

    Placed after the primary TournamentBet. If the primary bet loses but the
    insurance pick is correct, the player earns int(stake * odds * 0.5) tokens.
    """
    __tablename__ = "insurance_picks"
    id = Column(Integer, primary_key=True)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    tournament_bet_id = Column(Integer, ForeignKey("tournament_bets.id"), nullable=False)
    bet_type = Column(String(30), nullable=False)   # "winner" or "golden_boot"
    selection = Column(String(100), nullable=False)
    status = Column(String(20), nullable=False, default="pending")  # pending/correct/wrong

    player = relationship("Player", backref="insurance_picks")
    tournament_bet = relationship("TournamentBet", backref="insurance_pick", uselist=False)
```

- [ ] **Step 4: Add migration to main.py**

In `backend/app/main.py`, inside `_run_migrations()`, after the `is_double` migration block, add:

```python
        # Insurance picks table (tournament)
        await db.execute(text("""
            CREATE TABLE IF NOT EXISTS insurance_picks (
                id SERIAL PRIMARY KEY,
                player_id INTEGER NOT NULL REFERENCES players(id),
                tournament_bet_id INTEGER NOT NULL REFERENCES tournament_bets(id),
                bet_type VARCHAR(30) NOT NULL,
                selection VARCHAR(100) NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'pending'
            )
        """))
        await db.commit()
```

- [ ] **Step 5: Run the model test**

```bash
cd /Users/hernanrosenblum/Documents/worldcup-betting-v2/backend
pytest tests/test_insurance_picks.py::test_insurance_pick_model_exists -v
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/hernanrosenblum/Documents/worldcup-betting-v2
git add backend/app/models.py backend/app/main.py backend/tests/test_insurance_picks.py
git commit -m "feat: add InsurancePick model with migration for tournament insurance picks"
```

---

### Task C2: Backend — insurance endpoints in tournament router

**Files:**
- Modify: `backend/app/routers/tournament.py`
- Modify: `backend/app/main.py` (register InsurancePick import)

- [ ] **Step 1: Write the failing endpoint tests**

Append to `backend/tests/test_insurance_picks.py`:

```python
async def test_place_insurance_pick_succeeds(client):
    """Player with a pending winner bet can place a free insurance pick."""
    data, headers = await _place_tournament_bet(client, "winner", "Spain")
    resp = await client.post("/api/tournament/insurance", json={
        "bet_type": "winner", "selection": "France",
    }, headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["bet_type"] == "winner"
    assert body["selection"] == "France"
    assert body["status"] == "pending"


async def test_insurance_requires_primary_bet(client):
    """Cannot place insurance without a matching primary bet."""
    data = await join_player(client)
    headers = {"Authorization": f"Bearer {data['token']}"}
    resp = await client.post("/api/tournament/insurance", json={
        "bet_type": "winner", "selection": "France",
    }, headers=headers)
    assert resp.status_code == 400
    assert "pending" in resp.json()["detail"]


async def test_insurance_only_winner_golden_boot(client):
    """Insurance is only available for winner and golden_boot markets."""
    data, headers = await _place_tournament_bet(client, "winner", "Spain")
    resp = await client.post("/api/tournament/insurance", json={
        "bet_type": "total_goals", "selection": "Over 149.5",
    }, headers=headers)
    assert resp.status_code == 400
    assert "winner" in resp.json()["detail"]


async def test_insurance_cannot_duplicate_primary_selection(client):
    """Insurance selection must differ from the primary bet selection."""
    data, headers = await _place_tournament_bet(client, "winner", "Spain")
    resp = await client.post("/api/tournament/insurance", json={
        "bet_type": "winner", "selection": "Spain",  # same as primary
    }, headers=headers)
    assert resp.status_code == 400
    assert "differ" in resp.json()["detail"]


async def test_one_insurance_per_market(client):
    """Cannot place two insurance picks for the same market."""
    data, headers = await _place_tournament_bet(client, "winner", "Spain")
    await client.post("/api/tournament/insurance", json={"bet_type": "winner", "selection": "France"}, headers=headers)
    resp = await client.post("/api/tournament/insurance", json={"bet_type": "winner", "selection": "Brazil"}, headers=headers)
    assert resp.status_code == 400
    assert "already" in resp.json()["detail"]


async def test_get_insurance_picks(client):
    """GET /api/tournament/insurance returns placed insurance picks."""
    data, headers = await _place_tournament_bet(client, "winner", "Spain")
    await client.post("/api/tournament/insurance", json={"bet_type": "winner", "selection": "France"}, headers=headers)
    resp = await client.get("/api/tournament/insurance", headers=headers)
    assert resp.status_code == 200
    picks = resp.json()
    assert len(picks) == 1
    assert picks[0]["selection"] == "France"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/hernanrosenblum/Documents/worldcup-betting-v2/backend
pytest tests/test_insurance_picks.py -v -k "not test_insurance_pick_model"
```

Expected: All FAIL with 404 (routes don't exist yet).

- [ ] **Step 3: Add insurance endpoints to tournament.py**

In `backend/app/routers/tournament.py`, add these imports at the top (after existing imports):

```python
from app.models import TournamentBet, Player, Match, InsurancePick
```

(Replace the existing `from app.models import TournamentBet, Player, Match` line.)

Then append these two endpoints at the bottom of the file:

```python
@router.post("/api/tournament/insurance")
async def place_insurance_pick(
    data: dict,
    auth=Depends(get_current_player),
    db: AsyncSession = Depends(get_db),
):
    """Place a free insurance pick on the winner or golden_boot market.

    Requirements:
    - Tournament must not be locked yet.
    - Player must have a pending primary TournamentBet for the same bet_type.
    - Only one insurance pick per market per player.
    - Insurance selection must differ from the primary bet selection.

    If insurance pick is correct AND the primary bet is lost, awards
    int(primary.stake * primary.odds_at_placement * 0.5) tokens at settlement.
    """
    if datetime.now(timezone.utc) >= TOURNAMENT_LOCK_TIME:
        raise HTTPException(400, "Tournament bets are locked — insurance picks are closed")

    player, _ = auth
    bet_type = data.get("bet_type")
    selection = (data.get("selection") or "").strip()

    if not bet_type or not selection:
        raise HTTPException(400, "bet_type and selection are required")
    if bet_type not in ("winner", "golden_boot"):
        raise HTTPException(400, "Insurance is only available for the winner and golden_boot markets")

    # Player must have a pending primary bet for this market
    primary_bet = (await db.execute(
        select(TournamentBet).where(
            TournamentBet.player_id == player.id,
            TournamentBet.bet_type == bet_type,
            TournamentBet.status == "pending",
        )
    )).scalar_one_or_none()
    if not primary_bet:
        raise HTTPException(400, f"You must have a pending {bet_type} bet to add insurance")

    # Only one insurance per market
    existing_insurance = (await db.execute(
        select(InsurancePick).where(
            InsurancePick.player_id == player.id,
            InsurancePick.bet_type == bet_type,
        )
    )).scalar_one_or_none()
    if existing_insurance:
        raise HTTPException(400, f"You have already placed an insurance pick for {bet_type}")

    # Insurance must differ from primary (no point duplicating)
    if selection.lower() == primary_bet.selection.lower():
        raise HTTPException(400, "Insurance selection must differ from your primary bet")

    pick = InsurancePick(
        player_id=player.id,
        tournament_bet_id=primary_bet.id,
        bet_type=bet_type,
        selection=selection,
    )
    db.add(pick)
    await db.commit()
    await db.refresh(pick)
    return {
        "id": pick.id,
        "bet_type": pick.bet_type,
        "selection": pick.selection,
        "status": pick.status,
    }


@router.get("/api/tournament/insurance")
async def get_insurance_picks(auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    """Return all insurance picks for the current player."""
    player, _ = auth
    picks = (await db.execute(
        select(InsurancePick).where(InsurancePick.player_id == player.id)
    )).scalars().all()
    return [
        {
            "id": p.id,
            "bet_type": p.bet_type,
            "selection": p.selection,
            "status": p.status,
        }
        for p in picks
    ]
```

- [ ] **Step 4: Run the endpoint tests**

```bash
cd /Users/hernanrosenblum/Documents/worldcup-betting-v2/backend
pytest tests/test_insurance_picks.py -v
```

Expected: All 8 tests PASS.

- [ ] **Step 5: Full suite regression check**

```bash
pytest tests/ -v --tb=short
```

Expected: All pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/hernanrosenblum/Documents/worldcup-betting-v2
git add backend/app/routers/tournament.py backend/tests/test_insurance_picks.py
git commit -m "feat: add POST/GET /api/tournament/insurance endpoints with full validation"
```

---

### Task C3: Insurance settlement in admin endpoint

**Files:**
- Modify: `backend/app/routers/leagues.py`

- [ ] **Step 1: Write the failing settlement test**

Append to `backend/tests/test_insurance_picks.py`:

```python
async def _admin_headers(client) -> dict:
    resp = await client.post("/api/auth/join", json={"name": "Admin", "code": "admin"})
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['token']}"}


async def test_insurance_correct_and_primary_lost_awards_half(client, db):
    """Insurance picks that are correct + primary lost pay int(stake * odds * 0.5) tokens."""
    from sqlalchemy import select as sa_select
    from app.models import Player as PlayerModel

    data = await join_player(client)
    headers = {"Authorization": f"Bearer {data['token']}"}

    # Primary bet: Spain wins at 5.5x, stake 100 → potential win 550
    await client.post("/api/tournament/bets", json={"bet_type": "winner", "selection": "Spain", "stake": 100}, headers=headers)
    # Insurance pick: France wins
    await client.post("/api/tournament/insurance", json={"bet_type": "winner", "selection": "France"}, headers=headers)

    # Settle: France wins (primary Spain → lost; insurance France → correct)
    admin = await _admin_headers(client)
    resp = await client.post("/api/admin/tournament/settle", json={"winner": "France", "golden_boot": "Mbappé"}, headers=admin)
    assert resp.status_code == 200

    p = (await db.execute(sa_select(PlayerModel).where(PlayerModel.name == "Alice"))).scalar_one()
    # Started at 1000, spent 100 on Spain bet (lost) = 900
    # Insurance France correct + primary lost → award int(100 * 5.5 * 0.5) = 275
    # Final: 900 + 275 = 1175
    assert p.token_balance == 1175


async def test_insurance_ignored_when_primary_wins(client, db):
    """Insurance pick is ignored when the primary bet wins."""
    from sqlalchemy import select as sa_select
    from app.models import Player as PlayerModel

    data = await join_player(client)
    headers = {"Authorization": f"Bearer {data['token']}"}

    # Primary: Spain wins at 5.5x, stake 100
    await client.post("/api/tournament/bets", json={"bet_type": "winner", "selection": "Spain", "stake": 100}, headers=headers)
    # Insurance: France (doesn't matter — primary wins so insurance is ignored)
    await client.post("/api/tournament/insurance", json={"bet_type": "winner", "selection": "France"}, headers=headers)

    admin = await _admin_headers(client)
    await client.post("/api/admin/tournament/settle", json={"winner": "Spain", "golden_boot": "Mbappé"}, headers=admin)

    p = (await db.execute(sa_select(PlayerModel).where(PlayerModel.name == "Alice"))).scalar_one()
    # 1000 - 100 stake + 550 primary win = 1450; no insurance payout
    assert p.token_balance == 1450


async def test_insurance_correct_but_primary_also_wins_ignored(client, db):
    """Same as above: when primary wins, insurance payout is skipped even if insurance selection matches winner."""
    from sqlalchemy import select as sa_select
    from app.models import Player as PlayerModel

    data = await join_player(client)
    headers = {"Authorization": f"Bearer {data['token']}"}

    # This edge case can't happen (insurance must differ from primary) but test primary-wins-insurance-ignored logic.
    await client.post("/api/tournament/bets", json={"bet_type": "winner", "selection": "Spain", "stake": 100}, headers=headers)
    # Insurance: France
    await client.post("/api/tournament/insurance", json={"bet_type": "winner", "selection": "France"}, headers=headers)

    # Spain wins — primary won, France insurance irrelevant
    admin = await _admin_headers(client)
    await client.post("/api/admin/tournament/settle", json={"winner": "Spain", "golden_boot": "Mbappé"}, headers=admin)

    p = (await db.execute(sa_select(PlayerModel).where(PlayerModel.name == "Alice"))).scalar_one()
    assert p.token_balance == 1450  # only primary payout, no insurance


async def test_insurance_wrong_not_paid(client, db):
    """Insurance pick that is wrong pays nothing."""
    from sqlalchemy import select as sa_select
    from app.models import Player as PlayerModel

    data = await join_player(client)
    headers = {"Authorization": f"Bearer {data['token']}"}

    await client.post("/api/tournament/bets", json={"bet_type": "winner", "selection": "Spain", "stake": 100}, headers=headers)
    # Insurance: France — but Argentina wins
    await client.post("/api/tournament/insurance", json={"bet_type": "winner", "selection": "France"}, headers=headers)

    admin = await _admin_headers(client)
    await client.post("/api/admin/tournament/settle", json={"winner": "Argentina", "golden_boot": "Mbappé"}, headers=admin)

    p = (await db.execute(sa_select(PlayerModel).where(PlayerModel.name == "Alice"))).scalar_one()
    # 1000 - 100 stake, Spain lost, France insurance wrong = 900
    assert p.token_balance == 900
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/hernanrosenblum/Documents/worldcup-betting-v2/backend
pytest tests/test_insurance_picks.py::test_insurance_correct_and_primary_lost_awards_half tests/test_insurance_picks.py::test_insurance_ignored_when_primary_wins tests/test_insurance_picks.py::test_insurance_wrong_not_paid -v
```

Expected: FAIL — no insurance settlement logic exists yet.

- [ ] **Step 3: Add insurance settlement to leagues.py**

In `backend/app/routers/leagues.py`, find the `settle_tournament_bets` function (~line 205). First ensure the import includes `InsurancePick`:

```python
# At the top of leagues.py, update the models import to include InsurancePick:
from app.models import Player, League, Match, TournamentBet, InsurancePick
```

Then, inside `settle_tournament_bets`, after the main `await db.commit()` call (before `from app.ws import manager`) and after the `settled_count += 1` loop, add:

```python
    # ── Settle insurance picks ─────────────────────────────────────────────
    insurance_picks = (await db.execute(
        select(InsurancePick).where(InsurancePick.status == "pending")
    )).scalars().all()

    for pick in insurance_picks:
        # Determine if the insurance pick is correct
        if pick.bet_type == "winner":
            pick_correct = pick.selection.lower() == winner_team.lower()
        elif pick.bet_type == "golden_boot":
            pick_correct = pick.selection.lower() == golden_boot_player.lower()
        else:
            pick_correct = False

        primary = await db.get(TournamentBet, pick.tournament_bet_id)

        # Insurance pays only if: pick is correct AND primary bet lost
        if pick_correct and primary and primary.status == "lost":
            pick.status = "correct"
            payout = int(primary.stake * primary.odds_at_placement * 0.5)
            insurance_player = await db.get(Player, pick.player_id)
            if insurance_player:
                insurance_player.token_balance += payout
        else:
            pick.status = "wrong"

    await db.commit()
```

The full updated `settle_tournament_bets` should look like (key section — insert insurance block after the main for loop but before the ws broadcast):

```python
    # ... existing primary bet settlement loop ...
    for bet in pending:
        ...
        settled_count += 1

    await db.commit()

    # ── Settle insurance picks ─────────────────────────────────────────────
    insurance_picks = (await db.execute(
        select(InsurancePick).where(InsurancePick.status == "pending")
    )).scalars().all()

    for pick in insurance_picks:
        if pick.bet_type == "winner":
            pick_correct = pick.selection.lower() == winner_team.lower()
        elif pick.bet_type == "golden_boot":
            pick_correct = pick.selection.lower() == golden_boot_player.lower()
        else:
            pick_correct = False

        primary = await db.get(TournamentBet, pick.tournament_bet_id)

        if pick_correct and primary and primary.status == "lost":
            pick.status = "correct"
            payout = int(primary.stake * primary.odds_at_placement * 0.5)
            insurance_player = await db.get(Player, pick.player_id)
            if insurance_player:
                insurance_player.token_balance += payout
        else:
            pick.status = "wrong"

    await db.commit()

    from app.ws import manager
    await manager.broadcast({"type": "leaderboard_updated"})
    ...
```

- [ ] **Step 4: Run the settlement tests**

```bash
cd /Users/hernanrosenblum/Documents/worldcup-betting-v2/backend
pytest tests/test_insurance_picks.py -v
```

Expected: All 12 tests PASS.

- [ ] **Step 5: Full suite regression**

```bash
pytest tests/ -v --tb=short
```

Expected: All pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/hernanrosenblum/Documents/worldcup-betting-v2
git add backend/app/routers/leagues.py backend/tests/test_insurance_picks.py
git commit -m "feat: settle insurance picks in tournament settlement — pays half when primary lost"
```

---

### Task C4: Frontend — insurance pick UI in TournamentBetPanel

**Files:**
- Modify: `frontend/src/components/TournamentBetPanel.jsx`

- [ ] **Step 1: Add insurance state and loading**

Replace the full content of `frontend/src/components/TournamentBetPanel.jsx`:

```jsx
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { api } from "../api.js"
import HelpTip from "./HelpTip.jsx"

const MARKET_ICONS = {
  winner:      "🏆",
  golden_boot: "👟",
  total_goals: "⚽",
}

const INSURANCE_MARKETS = new Set(["winner", "golden_boot"])

export default function TournamentBetPanel({ onBetPlaced }) {
  const [markets, setMarkets]             = useState(null)
  const [locked, setLocked]               = useState(false)
  const [activeMarket, setActiveMarket]   = useState("winner")
  const [selection, setSelection]         = useState("")
  const [selectionOdds, setSelectionOdds] = useState(null)
  const [freeText, setFreeText]           = useState("")
  const [search, setSearch]               = useState("")
  const [stake, setStake]                 = useState(100)
  const [loading, setLoading]             = useState(false)
  const [msg, setMsg]                     = useState("")

  // Insurance state
  const [insurancePicks, setInsurancePicks]             = useState([])   // already-placed picks
  const [justPlacedBetType, setJustPlacedBetType]       = useState(null) // offer insurance after placing
  const [justPlacedOdds, setJustPlacedOdds]             = useState(null)
  const [justPlacedStake, setJustPlacedStake]           = useState(null)
  const [insuranceSelection, setInsuranceSelection]     = useState("")
  const [insuranceFreeText, setInsuranceFreeText]       = useState("")
  const [insuranceSearch, setInsuranceSearch]           = useState("")
  const [insuranceLoading, setInsuranceLoading]         = useState(false)
  const [insuranceMsg, setInsuranceMsg]                 = useState("")

  useEffect(() => {
    api.get("/api/tournament/markets")
      .then((data) => { setMarkets(data.markets); setLocked(data.locked) })
      .catch(() => {})
    api.get("/api/tournament/insurance")
      .then(setInsurancePicks)
      .catch(() => {})
  }, [])

  if (!markets) return null

  const market     = markets[activeMarket]
  const isTextPick = market.type === "text_pick"
  const hasOptions = Array.isArray(market.options) && market.options.length > 0

  const effectiveSelection = isTextPick && freeText.trim() ? freeText.trim() : selection
  const effectiveOdds = isTextPick && freeText.trim()
    ? (market.unknown_odds ?? 101.0)
    : selectionOdds

  const filteredOptions = hasOptions
    ? market.options.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()))
    : []

  // For insurance pick display
  const insurancePickForActiveMarket = insurancePicks.find(p => p.bet_type === justPlacedBetType)
  const hasInsuranceForMarket = insurancePicks.some(p => p.bet_type === activeMarket)

  function selectFromList(name, odds) {
    setSelection(name); setSelectionOdds(odds); setFreeText(""); setMsg("")
  }
  function handleFreeTextChange(val) {
    setFreeText(val); setSelection(""); setSelectionOdds(null); setMsg("")
  }
  function handleMarketSwitch(key) {
    setActiveMarket(key); setSelection(""); setSelectionOdds(null)
    setFreeText(""); setSearch(""); setMsg("")
    setJustPlacedBetType(null); setInsuranceSelection("")
    setInsuranceFreeText(""); setInsuranceSearch(""); setInsuranceMsg("")
  }

  const potentialWin = effectiveOdds && stake ? Math.floor(stake * effectiveOdds) : null
  const insurancePotentialWin = justPlacedOdds && justPlacedStake
    ? Math.floor(justPlacedStake * justPlacedOdds * 0.5)
    : null

  async function submit() {
    if (!effectiveSelection) return setMsg(isTextPick ? "Pick a player or type a name" : "Pick a selection first")
    if (!stake || stake < 1) return setMsg("Minimum stake is 1 token")
    setLoading(true); setMsg("")
    try {
      const result = await api.post("/api/tournament/bets", {
        bet_type: activeMarket, selection: effectiveSelection, stake,
      })
      const confirmedOdds = result.odds ?? effectiveOdds
      setMsg(`✓ Bet placed @ ${confirmedOdds}x! New balance: ${result.new_balance} tokens`)
      setSelection(""); setSelectionOdds(null); setFreeText("")
      // Offer insurance if this is a winner or golden_boot bet
      if (INSURANCE_MARKETS.has(activeMarket)) {
        setJustPlacedBetType(activeMarket)
        setJustPlacedOdds(confirmedOdds)
        setJustPlacedStake(stake)
        setInsuranceMsg("")
      }
      onBetPlaced?.(result.new_balance)
    } catch (err) {
      setMsg(`✗ ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function submitInsurance() {
    const sel = insuranceFreeText.trim() || insuranceSelection
    if (!sel) return setInsuranceMsg("Pick an insurance selection first")
    setInsuranceLoading(true); setInsuranceMsg("")
    try {
      const result = await api.post("/api/tournament/insurance", {
        bet_type: justPlacedBetType, selection: sel,
      })
      setInsurancePicks(prev => [...prev, result])
      setInsuranceMsg(`✓ Insurance placed on ${sel}! No tokens charged.`)
      setJustPlacedBetType(null)  // dismiss the form
      setInsuranceSelection(""); setInsuranceFreeText("")
    } catch (err) {
      setInsuranceMsg(`✗ ${err.message}`)
    } finally {
      setInsuranceLoading(false)
    }
  }

  // Insurance pick options: same market options, exclude the primary selection (tracked by msg after submit)
  const insuranceOptions = justPlacedBetType && markets[justPlacedBetType]?.options
    ? markets[justPlacedBetType].options.filter(o =>
        o.name.toLowerCase().includes(insuranceSearch.toLowerCase())
      )
    : []
  const isInsuranceTextPick = justPlacedBetType === "golden_boot"

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Lock banner */}
      {!locked && (
        <div style={{
          background: "linear-gradient(135deg, rgba(168,85,247,0.1), rgba(59,130,246,0.1))",
          border: "1px solid #a855f7", borderRadius: 10, padding: "8px 14px", marginBottom: 14,
          display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#a78bfa",
        }}>
          <span>🔓</span>
          <span>Tournament bets lock at kickoff — <strong>June 11, 2026 at 18:00 UTC</strong></span>
        </div>
      )}
      {locked && (
        <div style={{
          background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444",
          borderRadius: 10, padding: "8px 14px", marginBottom: 14,
          fontSize: 12, color: "#f87171", textAlign: "center",
        }}>
          🔒 Tournament bets are locked — the tournament has started
        </div>
      )}

      {/* Market tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {Object.entries(markets).map(([key, m]) => (
          <button key={key} onClick={() => handleMarketSwitch(key)} style={{
            flex: 1,
            background: activeMarket === key ? "linear-gradient(135deg,#a855f7,#3b82f6)" : "#1e1b3a",
            color: activeMarket === key ? "#fff" : "#6b7280",
            border: "none", borderRadius: 8, padding: "8px 4px",
            fontSize: 11, fontWeight: 600, cursor: "pointer", textAlign: "center", lineHeight: 1.3,
          }}>
            <div style={{ fontSize: 16 }}>{MARKET_ICONS[key]}</div>
            <div>{m.label.replace(/^[^ ]+ /, "")}</div>
          </button>
        ))}
      </div>

      {/* Market description + tip */}
      <p style={{ color: "#6b7280", fontSize: 12, marginBottom: 12, display: "flex", alignItems: "center", gap: 4 }}>
        {market.description}
        {activeMarket === "winner" && (
          <HelpTip text="Pick the team that lifts the trophy. Odds reflect probability — favourites pay less. Lock date: June 11, 18:00 UTC." />
        )}
        {activeMarket === "golden_boot" && (
          <HelpTip text="Top scorer of the entire tournament. Pick from the list or type any player name — unlisted players get 101x odds. Lock date: June 11, 18:00 UTC." />
        )}
        {activeMarket === "total_goals" && (
          <HelpTip text="Over/Under on total goals across all 64 matches. WC 2026 averages ~2.5 goals per match. Lock date: June 11, 18:00 UTC." />
        )}
      </p>

      {/* Picklist */}
      {!locked && hasOptions && (
        <>
          <input
            placeholder={isTextPick ? "Search player…" : "Search team…"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%", background: "#0c0c14", border: "1px solid #2d2b55",
              borderRadius: 8, padding: "7px 12px", color: "#e2e8f0",
              fontSize: 13, marginBottom: 8, boxSizing: "border-box",
            }}
          />
          <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
            {filteredOptions.map((o) => (
              <button key={o.name} onClick={() => selectFromList(o.name, o.odds)} style={{
                background: selection === o.name
                  ? "linear-gradient(135deg, rgba(168,85,247,0.2), rgba(59,130,246,0.2))"
                  : "#13131f",
                border: `1px solid ${selection === o.name ? "#a855f7" : "#2d2b55"}`,
                borderRadius: 8, padding: "8px 12px",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                cursor: "pointer",
              }}>
                <span style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 500 }}>{o.name}</span>
                <span style={{
                  color: "#a78bfa", fontSize: 12, fontWeight: 700,
                  background: "#1e1b3a", padding: "2px 8px", borderRadius: 999,
                }}>
                  {o.odds}x
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Golden Boot free-text fallback */}
      {isTextPick && !locked && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: "#6b7280", fontSize: 11, marginBottom: 5 }}>Not on the list? Type any player name:</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              placeholder="e.g. Erling Haaland…"
              value={freeText}
              onChange={(e) => handleFreeTextChange(e.target.value)}
              style={{
                flex: 1, background: "#0c0c14", border: `1px solid ${freeText ? "#a855f7" : "#2d2b55"}`,
                borderRadius: 8, padding: "7px 12px", color: "#e2e8f0",
                fontSize: 13, boxSizing: "border-box",
              }}
            />
            {freeText && <span style={{ color: "#f59e0b", fontSize: 11, whiteSpace: "nowrap" }}>{market.unknown_odds ?? 101}x</span>}
          </div>
          {freeText && (
            <p style={{ fontSize: 10, color: "#6b7280", margin: "4px 0 0" }}>
              Unlisted player — odds {market.unknown_odds ?? 101}x applied at placement
            </p>
          )}
        </div>
      )}

      {/* Stake + submit */}
      {!locked && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ color: "#6b7280", fontSize: 12 }}>Stake:</span>
            <input
              type="number" min={1} value={stake}
              onChange={(e) => setStake(Number(e.target.value))}
              style={{ background: "#0c0c14", border: "1px solid #2d2b55", borderRadius: 8, padding: "6px 10px", color: "#e2e8f0", fontSize: 14, width: 100 }}
            />
            <span style={{ color: "#6b7280", fontSize: 12 }}>tokens</span>
            {potentialWin && (
              <span style={{ color: "#4ade80", fontSize: 12, marginLeft: "auto", display: "flex", alignItems: "center", gap: 3 }}>
                Win: {potentialWin.toLocaleString()}
                <HelpTip text="Potential payout = stake × odds. Odds are locked at placement — they won't change if the market moves." />
              </span>
            )}
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={submit}
            disabled={loading || !effectiveSelection}
            style={{
              width: "100%",
              background: loading || !effectiveSelection ? "#1e1b3a" : "linear-gradient(135deg,#a855f7,#3b82f6)",
              color: loading || !effectiveSelection ? "#6b7280" : "#fff",
              border: "none", borderRadius: 8, padding: "12px",
              fontSize: 14, fontWeight: 700,
              cursor: loading || !effectiveSelection ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Placing…" : `Place ${MARKET_ICONS[activeMarket]} Bet`}
          </motion.button>
        </>
      )}

      {/* ── Insurance Pick Section ─────────────────────────────────────── */}
      {justPlacedBetType && !insurancePickForActiveMarket && (
        <div style={{
          marginTop: 16,
          background: "#0c1a0c", border: "1px solid #16a34a",
          borderRadius: 10, padding: 14,
        }}>
          <div style={{ color: "#4ade80", fontWeight: 700, fontSize: 13, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
            🛡️ Add a free insurance pick
            <HelpTip text={`Insurance is free — no tokens charged. If your primary ${justPlacedBetType} bet loses but your insurance pick is correct, you win ${insurancePotentialWin ?? "half the primary payout"} tokens (half the primary payout). If your primary bet wins, insurance is ignored.`} />
          </div>
          <p style={{ color: "#6b7280", fontSize: 11, marginBottom: 10 }}>
            Pick a different {justPlacedBetType === "winner" ? "team" : "player"} as your backup.
            {insurancePotentialWin && (
              <span style={{ color: "#4ade80" }}> Pays {insurancePotentialWin} tokens if primary loses.</span>
            )}
          </p>

          {/* Insurance search + list */}
          <input
            placeholder={isInsuranceTextPick ? "Search player…" : "Search team…"}
            value={insuranceSearch}
            onChange={(e) => setInsuranceSearch(e.target.value)}
            style={{
              width: "100%", background: "#0c0c14", border: "1px solid #2d2b55",
              borderRadius: 8, padding: "6px 10px", color: "#e2e8f0",
              fontSize: 12, marginBottom: 6, boxSizing: "border-box",
            }}
          />
          <div style={{ maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3, marginBottom: 8 }}>
            {insuranceOptions.map((o) => (
              <button key={o.name} onClick={() => { setInsuranceSelection(o.name); setInsuranceFreeText("") }} style={{
                background: insuranceSelection === o.name ? "rgba(74,222,128,0.15)" : "#13131f",
                border: `1px solid ${insuranceSelection === o.name ? "#16a34a" : "#2d2b55"}`,
                borderRadius: 6, padding: "6px 10px",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                cursor: "pointer",
              }}>
                <span style={{ color: "#e2e8f0", fontSize: 12 }}>{o.name}</span>
                <span style={{ color: "#4ade80", fontSize: 11 }}>{o.odds}x</span>
              </button>
            ))}
          </div>

          {/* Golden boot insurance free text */}
          {isInsuranceTextPick && (
            <input
              placeholder="Or type any player name…"
              value={insuranceFreeText}
              onChange={(e) => { setInsuranceFreeText(e.target.value); setInsuranceSelection("") }}
              style={{
                width: "100%", background: "#0c0c14",
                border: `1px solid ${insuranceFreeText ? "#16a34a" : "#2d2b55"}`,
                borderRadius: 8, padding: "6px 10px", color: "#e2e8f0",
                fontSize: 12, marginBottom: 8, boxSizing: "border-box",
              }}
            />
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={submitInsurance}
              disabled={insuranceLoading || (!insuranceSelection && !insuranceFreeText.trim())}
              style={{
                flex: 1,
                background: insuranceLoading || (!insuranceSelection && !insuranceFreeText.trim())
                  ? "#1e1b3a"
                  : "linear-gradient(135deg, #16a34a, #4ade80)",
                color: insuranceLoading || (!insuranceSelection && !insuranceFreeText.trim()) ? "#6b7280" : "#fff",
                border: "none", borderRadius: 8, padding: "10px",
                fontSize: 13, fontWeight: 700,
                cursor: insuranceLoading ? "not-allowed" : "pointer",
              }}
            >
              {insuranceLoading ? "Adding…" : "🛡️ Add Insurance (free)"}
            </motion.button>
            <button
              onClick={() => setJustPlacedBetType(null)}
              style={{
                background: "none", border: "1px solid #2d2b55", borderRadius: 8,
                padding: "10px 14px", color: "#6b7280", fontSize: 12, cursor: "pointer",
              }}
            >
              Skip
            </button>
          </div>

          {insuranceMsg && (
            <p style={{ color: insuranceMsg.startsWith("✓") ? "#4ade80" : "#f87171", fontSize: 12, marginTop: 8 }}>
              {insuranceMsg}
            </p>
          )}
        </div>
      )}

      {/* Show already-placed insurance for this market */}
      {hasInsuranceForMarket && !justPlacedBetType && (
        <div style={{
          marginTop: 12, background: "#0c1a0c", border: "1px solid #16a34a",
          borderRadius: 8, padding: "8px 12px", fontSize: 12,
        }}>
          {insurancePicks
            .filter(p => p.bet_type === activeMarket)
            .map(p => (
              <div key={p.id} style={{ color: "#4ade80", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>🛡️ Insurance: <strong>{p.selection}</strong></span>
                <span style={{ color: "#6b7280", fontSize: 10 }}>{p.status.toUpperCase()}</span>
              </div>
            ))}
        </div>
      )}

      <AnimatePresence>
        {msg && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              color: msg.startsWith("✓") ? "#4ade80" : "#f87171",
              fontSize: 12, marginTop: 8, textAlign: "center",
            }}
          >
            {msg}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
```

- [ ] **Step 2: Verify insurance UI in the browser**

```bash
cd frontend && npm run dev
```

Open http://localhost:5173/tournament → Bets tab → pick a winner bet → place it. After placing, a green "🛡️ Add a free insurance pick" section appears. Pick a different team → "Add Insurance (free)" → section disappears and shows "🛡️ Insurance: France" badge.

Switching to the golden_boot market and placing a bet shows insurance prompt with player search + free text.

- [ ] **Step 3: Commit**

```bash
cd /Users/hernanrosenblum/Documents/worldcup-betting-v2
git add frontend/src/components/TournamentBetPanel.jsx
git commit -m "feat: add insurance pick UI to TournamentBetPanel — free pick shown after winner/golden_boot bet"
```

---

## Self-Review Against Spec

### Spec coverage check

| Requirement | Task | Status |
|---|---|---|
| HelpTip on BetPanel | Already implemented in codebase | ✅ existing |
| HelpTip on ChallengePanel | Already implemented in codebase | ✅ existing |
| HelpTip on DeepCutsPage header | Already implemented in codebase | ✅ existing |
| HelpTip on HomePage stats | Task A1 | ✅ planned |
| HelpTip on LeaderboardPage tabs | Task A2 | ✅ planned |
| HelpTip on PredictionsPage/PredictionRow | Task A3 | ✅ planned |
| HelpTip on TournamentPage standings/bracket | Task A4 | ✅ planned |
| HelpTip on TournamentBetPanel | Task A5 | ✅ planned |
| HelpTip on AIPage | Task A6 | ✅ planned |
| `is_double` boolean on Prediction model | Task B1 | ✅ planned |
| Migration for `is_double` in `_run_migrations()` | Task B1 | ✅ planned |
| POST /api/predictions accepts `is_double` | Task B2 | ✅ planned |
| Max 3 double picks per player enforced | Task B2 | ✅ planned |
| Settlement awards 6pts/2pts for doubles | Task B3 | ✅ planned |
| PredictionRow shows double toggle (same style as BetPanel wildcard) | Task B4 | ✅ planned |
| InsurancePick model with player_id, bet_type, selection, status | Task C1 | ✅ planned |
| DB migration for insurance_picks table | Task C1 | ✅ planned |
| POST /api/tournament/insurance — free pick, winner/golden_boot only | Task C2 | ✅ planned |
| GET /api/tournament/insurance | Task C2 | ✅ planned |
| Settlement in POST /api/admin/tournament/settle — check insurance | Task C3 | ✅ planned |
| Insurance pays int(stake * odds * 0.5) when primary lost | Task C3 | ✅ planned |
| If primary wins, insurance is ignored | Task C3 | ✅ planned |
| TournamentBetPanel shows insurance input after bet placed | Task C4 | ✅ planned |

### Type/name consistency check

- `is_double` — used consistently in model, migration, router, poller, and frontend
- `insurance_picks` table name — consistent between model `__tablename__` and migration SQL
- `InsurancePick` class name — used in models.py, imported in tournament.py and leagues.py
- `tournament_bet_id` FK column — consistent in model definition and relationship
- `doubles_used` response key — returned by POST /api/predictions, consumed in PredictionRow `onSaved(result.doubles_used)`
- `justPlacedBetType` / `justPlacedOdds` / `justPlacedStake` — internal state, consistent within TournamentBetPanel

### Placeholder scan

No TBD, TODO, or hand-waving — all code blocks are complete and runnable.
