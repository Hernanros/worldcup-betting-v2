# WC Moments Visual Overhaul + Sandbox — Design Spec

**Date:** 2026-05-25  
**Project:** World Cup Betting App v2  
**Scope:** Two features — (1) cinematic WC moment hero images woven into every screen, (2) a new Sandbox tab for simulating live match scenarios

---

## Overview

The app currently has a full-bleed stadium photo on the Join page. This spec extends that pattern to all 7 existing screens and adds a new Sandbox tab — giving the app a magazine-quality visual identity anchored in iconic World Cup history, and a way for friends to preview exactly how the app will feel during live matches.

---

## Feature 1: WC Moments Hero Images

### Approach

Each page gets a **cinematic full-bleed hero image** at the top — a different legendary WC moment per screen. The image sits behind a dark gradient overlay so text remains legible. A small labelled badge ("⭐ Iconic Moment · Year") floats over the image for context.

The Join page already has this pattern (2018 WC Final stadium photo). This feature replaces that image with the Messi bisht photo and applies the same treatment to all other pages.

### Image Sources

All images are sourced from **Unsplash** (free editorial use, no attribution required for personal/friend apps) or Wikimedia Commons (public domain). No licensed Getty images.

### Screen → Moment Map

| Screen | Moment | Year | Notes |
|---|---|---|---|
| **Join** | Messi lifting the trophy in the bisht (gold Qatar robe) | 2022 | Most iconic image of the modern era. Replaces current 2018 stadium photo. |
| **Matches** | Maradona's Goal of the Century | 1986 | Azteca Stadium. The run from his own half vs England. |
| **Match Detail** | Dynamic — based on the two teams playing | varies | See dynamic moment logic below |
| **Bets** | Germany 7–1 Brazil (Mineirazzo) | 2014 | Estádio Mineirão. Brazil's worst home defeat. |
| **Predictions** | Roberto Baggio after missing the 1994 Final penalty | 1994 | Head down, hands on knees. Italy lose shootout to Brazil. |
| **Leaderboard** | Zidane's headbutt on Materazzi | 2006 | Olympiastadion Berlin. Extra time. Red card. |
| **AI Page** | Iniesta's extra-time winner | 2010 | Soccer City. 116th minute vs Netherlands. |
| **Sandbox** | Rotating collage — all moments cycle as header | all | Cycles through the same image pool. |

### Dynamic Moment Logic (Match Detail)

`frontend/src/data/moments.js` — a lookup map from team name → relevant WC moment. When `MatchDetailPage` renders, it checks if either `home_team` or `away_team` has an entry in the map. Priority: exact pair match → either team match → fallback to Maradona (universal).

**Pair examples:**
- `Argentina + England` → Hand of God (1986)
- `Germany + Brazil` → Mineirazzo (2014)  
- `France + Italy` → Zidane headbutt (2006)
- `Argentina + France` → Messi bisht / 2022 Final (either team triggers this)

**Single-team fallbacks:**
- Any match with Brazil → Ronaldo lifting 2002 trophy
- Any match with Germany → Klose breaking Ronaldo's scoring record (2014)
- Any match with France → Thuram brace 1998 semi-final

**Ultimate fallback:** Maradona Goal of the Century.

### Component: `<PageHero>`

New shared component `frontend/src/components/PageHero.jsx`.

**Props:**
- `momentKey` (string) — key into `moments.js` (e.g. `"maradona_1986"`)
- `height` (number, default 180) — hero height in px
- `overlayOpacity` (number, default 0.82) — darkness of gradient overlay

**Renders:**
```
[full-bleed photo]
[dark gradient overlay]
  ⭐ Iconic Moment · 1986   ← badge
  "The Goal of the Century"  ← moment title
  Argentina vs England · Azteca Stadium ← subtitle
```

### `frontend/src/data/moments.js`

Exports:
- `MOMENTS` — object keyed by `momentKey`, each entry: `{ title, subtitle, year, imageUrl, credit }`
- `TEAM_MOMENT_MAP` — object keyed by team name or `"team1+team2"` pair, value is a `momentKey`
- `getMomentForMatch(homeTeam, awayTeam)` — returns the best matching `MOMENT` entry

Image URLs use Unsplash Source API (`https://images.unsplash.com/photo-<id>?w=800&q=80`) or direct Wikimedia Commons links. All URLs are hardcoded constants — no API calls.

### Integration Points

Each page imports `PageHero` and `getMomentForMatch` (or a fixed `momentKey`) and renders `<PageHero>` as the first element inside its scroll container, above the existing content.

No backend changes needed.

---

## Feature 2: Sandbox Tab

### Purpose

A standalone tab where any player can set up a hypothetical live scenario (match, score, minute, stake) and instantly see what their payout, risk, and leaderboard position would look like — before placing a real bet.

### Navigation

A 6th tab added to `BottomNav`: `🧪 Sandbox` at `/sandbox`. `App.jsx` gets a new route. BottomNav updates to 6 tabs (spacing adjusts automatically via `justify-content: space-around`).

### Page: `SandboxPage.jsx`

**Hero:** `<PageHero momentKey="rotating" />` — cycles through all `MOMENTS` entries on a 5-second interval using `setInterval`.

**UI Sections (top to bottom):**

1. **Match Picker** — dropdown or tap-to-pick from upcoming matches fetched via `api.get("/api/matches")`. Filtered to status `"upcoming"`. Defaults to first match.

2. **Scenario Builder** — four `+`/`−` steppers plus one outcome selector:
   - Home goals (0–9)
   - Away goals (0–9)
   - Minute (1–90+, with `+5` shortcut)
   - My stake (50–2000, with quick picks: 100 / 200 / 500)
   - Outcome pill: Home Win / Draw / Away Win (3-button toggle)

3. **Live Preview** — updates instantly on any stepper change (no button press needed):
   - Projected payout if current score holds (stake × odds)
   - Projected loss if score flips (−stake)
   - Estimated leaderboard position change (uses current leaderboard from `api.get("/api/leaderboard")`, computes delta)
   - Token balance after payout

4. **Run Live Simulation button** — animates through the scenario minute-by-minute:
   - Minute counter ticks from current minute to 90 (every 200ms)
   - Score stays fixed (or user can toggle "add a goal at minute X" for drama)
   - Live Preview recalculates at each tick
   - "Full Time" banner at 90'

### State

All sandbox state is local to `SandboxPage` — no API writes. The sandbox never places real bets. It only reads from the existing `GET /api/matches` and `GET /api/leaderboard` endpoints.

### Odds in Sandbox

Odds are read from `match.odds` (already returned by the matches endpoint). If `match.odds` is null (no odds seeded yet), the sandbox falls back to neutral odds (Home: 2.5, Draw: 3.2, Away: 2.8) displayed with a disclaimer.

---

## Files Touched / Created

### New files
- `frontend/src/components/PageHero.jsx` — shared hero component
- `frontend/src/data/moments.js` — moment data + team→moment lookup
- `frontend/src/pages/SandboxPage.jsx` — full sandbox page

### Modified files
- `frontend/src/pages/JoinPage.jsx` — replace current bg image with Messi bisht URL
- `frontend/src/pages/MatchesPage.jsx` — add `<PageHero momentKey="maradona_1986" />`
- `frontend/src/pages/MatchDetailPage.jsx` — add `<PageHero momentKey={getMomentForMatch(...).key} />`
- `frontend/src/pages/BetsPage.jsx` — add `<PageHero momentKey="germany_brazil_2014" />`
- `frontend/src/pages/PredictionsPage.jsx` — add `<PageHero momentKey="baggio_1994" />`
- `frontend/src/pages/LeaderboardPage.jsx` — add `<PageHero momentKey="zidane_2006" />`
- `frontend/src/pages/AIPage.jsx` — add `<PageHero momentKey="iniesta_2010" />`
- `frontend/src/components/BottomNav.jsx` — add Sandbox tab (6th tab)
- `frontend/src/App.jsx` — add `/sandbox` route

### No backend changes required.

---

## Testing

- `PageHero.test.jsx` — renders with valid momentKey, renders fallback when key missing, applies correct overlay opacity
- `SandboxPage.test.jsx` — renders match picker, payout calculation correct for given stake/odds, simulation counter reaches 90 and stops
- `moments.test.js` — `getMomentForMatch` returns correct moment for known pairs, falls back correctly for unknown teams

---

## Out of Scope

- Actual real-time score updates in Sandbox (those come from the real poller, not simulated)
- Saving sandbox scenarios
- Sharing sandbox results
- Video clips / animated GIFs of the moments
- Admin controls to change which moment appears on which screen
