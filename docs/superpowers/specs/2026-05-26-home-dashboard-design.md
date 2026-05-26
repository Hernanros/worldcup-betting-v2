# Home Dashboard & App Restructure — Design Spec
**Date:** 2026-05-26  
**Branch:** feat/worldcup-betting-v2

---

## Scope

Four changes in one pass:

1. **Bug fix** — Maradona image repeating across pages
2. **PageHero** — shrink from 220px cinematic banner to 60px compact background strip
3. **Predictions restructure** — split Tournament and Match predictions into separate tabs on PredictionsPage; remove tournament content from BetsPage
4. **Home dashboard** — new `/` route with 🏠 tab; Matches moves to `/matches`

---

## 1. Bug Fix — Maradona Repeat

`PredictionsPage` references `momentKey="baggio_1994"` which no longer exists (renamed to `italy_2006`). PageHero falls back to `maradona_1986`, same key used by MatchesPage — so both pages show Maradona.

**Fix:** Change `PredictionsPage` to `momentKey="italy_2006"`.

---

## 2. PageHero — Compact Background Strip

**Before:** `height = "max(220px, 30vw)"` — a dominant cinematic banner that competes with page content.

**After:** `height = 60` (px) with `overlayOpacity = 0.96`. The image becomes a barely-visible textured backdrop; title + year text remains as flavor. No change to interface — callers just get a smaller strip.

**Exception:** `SandboxPage` keeps `height="max(220px, 30vw)"` and `overlayOpacity={0.82}` passed explicitly — it is the showcase for the rotating hero.

**File:** `src/components/PageHero.jsx` — change default `height` prop only.

---

## 3. Predictions Restructure

### PredictionsPage (`/predict`)
Add two pill tabs: **Match** and **Tournament**.

- **Match tab** (default): existing `PredictionRow` list — per-game score predictions, total points summary card. No change to logic.
- **Tournament tab**: move `TournamentBetPanel` + existing tournament bets list here from BetsPage. Shows "Place a Long-Term Bet" panel + "Your Tournament Bets" list. Data: same `/api/tournament/bets` endpoint.

### BetsPage (`/bets`)
Remove tournament tab entirely. BetsPage becomes match-bets-only: shows a message directing users to tap a match → Bet Panel for match bets (this already exists as the "match" tab content). Since the page is now single-purpose, remove the tab pills and render the match-bets content directly.

**Moment key:** BetsPage hero changes from `germany_brazil_2014` to `maradona_1986` (freed up since PredictionsPage now uses `italy_2006`). Actually keep `germany_brazil_2014` on BetsPage and use `maradona_1986` on MatchesPage — no change needed here.

---

## 4. Home Dashboard

### Route & Nav
- `/` → new `HomePage`
- `/matches` → `MatchesPage` (was `/`)
- Remove `/bets` route (BetsPage content merges into `/predict` tournament tab)
- BottomNav tabs (5 tabs): 🏠 Home · ⚽ Matches · 🎯 Predict · 📊 Rankings · 🤖 AI
- Remove: 🏆 Bets tab, 🧪 Sandbox tab (Sandbox accessible via direct URL for dev)

### `HomePage` layout (`src/pages/HomePage.jsx`)

```
┌─────────────────────────────┐
│  PageHero (compact, rotating)│
├─────────────────────────────┤
│  My Stats row               │
│  [💰 balance] [🎯 pts] [📊 rank] │
├─────────────────────────────┤
│  Next Matches               │
│  MatchCard × 2-3 (upcoming) │
├─────────────────────────────┤
│  Active Bets                │
│  Compact bet rows (pending) │
├─────────────────────────────┤
│  Leaderboard Preview        │
│  Top 3 + Your row           │
└─────────────────────────────┘
```

### Data sources (all existing endpoints)
| Section | Endpoint |
|---|---|
| My Stats — balance | `getPlayer()` from `auth.js` |
| My Stats — prediction pts | `GET /api/predictions` → sum `points_awarded` |
| My Stats — rank | `GET /api/leaderboard` → find my entry |
| Next Matches | `GET /api/matches` → filter `status=upcoming`, sort by date, take 3 |
| Active Bets | `GET /api/tournament/bets` → `my_bets` where `status=pending` |
| Leaderboard Preview | `GET /api/leaderboard` → top 3 + my entry |

### Component structure
- `HomePage` owns all data fetching (parallel `Promise.all`)
- No new sub-components needed; reuse `MatchCard` and existing card styles
- Stats row: 3 inline chips using existing card/border styling
- Leaderboard preview: inline rows (not a new component — 4 rows max)

### App.jsx changes
- Add `import HomePage`
- Change `<Route path="/" element={<MatchesPage />} />` → `<Route path="/" element={<HomePage />} />`
- Add `<Route path="/matches" element={<MatchesPage />} />`
- Add `<Route path="/matches/:id" element={<MatchDetailPage />} />` (keep existing)
- Remove `/bets` route

### BottomNav changes
Replace 6-tab array with 5 tabs:
```js
{ to: "/",        icon: "🏠", label: "Home" },
{ to: "/matches", icon: "⚽", label: "Matches" },
{ to: "/predict", icon: "🎯", label: "Predict" },
{ to: "/rankings",icon: "📊", label: "Rankings" },
{ to: "/ai",      icon: "🤖", label: "AI" },
```

---

## Implementation Order

1. Bug fix — PredictionsPage momentKey (1 line, commit alone)
2. PageHero default height → 60px
3. Restructure BetsPage → match-only; move tournament content to PredictionsPage
4. Create HomePage, update App.jsx routes, update BottomNav

Each step gets its own atomic commit.

---

## Out of Scope
- No new API endpoints needed
- No backend changes
- Sandbox page kept but removed from nav (dev-only)
- No pagination on leaderboard preview (top 3 + me is sufficient)
