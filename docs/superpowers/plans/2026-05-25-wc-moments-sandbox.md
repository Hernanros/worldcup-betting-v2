# WC Moments Visual Overhaul + Sandbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cinematic WC moment hero images to every page and build a Sandbox tab where players can simulate live match scenarios and preview their payout/leaderboard position.

**Architecture:** Pure frontend change. `moments.js` holds all image data + team→moment lookup. `PageHero` is a shared presentational component rendered at the top of each page. `SandboxPage` reads existing API endpoints (matches + leaderboard) read-only and computes everything locally. No backend changes.

**Tech Stack:** React 18, Vite 5, Framer Motion, Vitest, React Testing Library. All existing patterns — inline styles, no new dependencies.

**Working directory:** `/Users/hernanrosenblum/Documents/worldcup-betting-v2/frontend`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/data/moments.js` | Create | `MOMENTS` data, `TEAM_MOMENT_MAP`, `ALL_MOMENT_KEYS`, `getMomentForMatch()` |
| `src/data/moments.test.js` | Create | Tests for `getMomentForMatch` lookup logic |
| `src/components/PageHero.jsx` | Create | Shared hero: full-bleed photo + gradient overlay + moment badge |
| `src/components/PageHero.test.jsx` | Create | Render tests for PageHero |
| `src/pages/SandboxPage.jsx` | Create | Scenario builder, payout preview, minute simulation |
| `src/pages/SandboxPage.test.jsx` | Create | Tests for exported `computePreview` |
| `src/pages/JoinPage.jsx` | Modify | Swap bg image URL to Messi bisht |
| `src/pages/MatchesPage.jsx` | Modify | Add `<PageHero momentKey="maradona_1986" />` |
| `src/pages/MatchDetailPage.jsx` | Modify | Add `<PageHero>` driven by `getMomentForMatch(home, away)` |
| `src/pages/BetsPage.jsx` | Modify | Add `<PageHero momentKey="germany_brazil_2014" />` |
| `src/pages/PredictionsPage.jsx` | Modify | Add `<PageHero momentKey="baggio_1994" />` |
| `src/pages/LeaderboardPage.jsx` | Modify | Add `<PageHero momentKey="zidane_2006" />` |
| `src/pages/AIPage.jsx` | Modify | Add `<PageHero momentKey="iniesta_2010" />` |
| `src/components/BottomNav.jsx` | Modify | Add 6th tab: `🧪 Sandbox → /sandbox` |
| `src/App.jsx` | Modify | Add `/sandbox` route |

---

## Task 1: `moments.js` — data + lookup

**Files:**
- Create: `src/data/moments.js`
- Create: `src/data/moments.test.js`

- [ ] **Step 1: Create `src/data/moments.js`**

```js
// All image URLs are Wikimedia Commons (public domain / CC).
// Before deploying: open each imageUrl in a browser tab to verify it loads.
// To find an alternative: https://commons.wikimedia.org/w/index.php?search=<term>

export const MOMENTS = {
  messi_2022: {
    key: "messi_2022",
    title: "Messi Lifts the Trophy",
    subtitle: "Argentina vs France · Lusail, Qatar",
    year: 2022,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/2022_FIFA_World_Cup_Final_-_trophy_ceremony_%28cropped%29.jpg/1280px-2022_FIFA_World_Cup_Final_-_trophy_ceremony_%28cropped%29.jpg",
  },
  maradona_1986: {
    key: "maradona_1986",
    title: "Goal of the Century",
    subtitle: "Argentina vs England · Azteca, México",
    year: 1986,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Maradona_Diego_gol_inglese_1986.jpg/1280px-Maradona_Diego_gol_inglese_1986.jpg",
  },
  hand_of_god: {
    key: "hand_of_god",
    title: "The Hand of God",
    subtitle: "Argentina vs England · Azteca, México",
    year: 1986,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Maradona_Diego_gol_inglese_1986.jpg/1280px-Maradona_Diego_gol_inglese_1986.jpg",
  },
  germany_brazil_2014: {
    key: "germany_brazil_2014",
    title: "The Mineirazzo — 7–1",
    subtitle: "Germany vs Brazil · Estádio Mineirão",
    year: 2014,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/FIFA_World_Cup_2014_-_Germany_vs_Brazil_08.jpg/1280px-FIFA_World_Cup_2014_-_Germany_vs_Brazil_08.jpg",
  },
  baggio_1994: {
    key: "baggio_1994",
    title: "Baggio's Miss",
    subtitle: "Italy vs Brazil · Rose Bowl, Los Angeles",
    year: 1994,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Roberto_Baggio_1994_FIFA_World_Cup_Final.jpg/1280px-Roberto_Baggio_1994_FIFA_World_Cup_Final.jpg",
  },
  zidane_2006: {
    key: "zidane_2006",
    title: "Zidane's Headbutt",
    subtitle: "France vs Italy · Olympiastadion, Berlin",
    year: 2006,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Zinedine_Zidane_head_butt.jpg/1280px-Zinedine_Zidane_head_butt.jpg",
  },
  iniesta_2010: {
    key: "iniesta_2010",
    title: "Iniesta's Extra-Time Winner",
    subtitle: "Spain vs Netherlands · Soccer City",
    year: 2010,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Andres_Iniesta_goal_2010_FIFA_World_Cup_Final.jpg/1280px-Andres_Iniesta_goal_2010_FIFA_World_Cup_Final.jpg",
  },
  ronaldo_2002: {
    key: "ronaldo_2002",
    title: "Ronaldo Lifts the Cup",
    subtitle: "Brazil vs Germany · Yokohama",
    year: 2002,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/2002_FIFA_World_Cup_Final.jpg/1280px-2002_FIFA_World_Cup_Final.jpg",
  },
  klose_2014: {
    key: "klose_2014",
    title: "Klose Breaks the Record",
    subtitle: "Germany's all-time top scorer · Brazil 2014",
    year: 2014,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/FIFA_World_Cup_2014_-_Germany_vs_Brazil_08.jpg/1280px-FIFA_World_Cup_2014_-_Germany_vs_Brazil_08.jpg",
  },
  thuram_1998: {
    key: "thuram_1998",
    title: "Thuram's Brace",
    subtitle: "France vs Croatia · Semi-Final, Saint-Denis",
    year: 1998,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/1998_FIFA_World_Cup_Final.jpg/1280px-1998_FIFA_World_Cup_Final.jpg",
  },
}

// Pair map — key is both team names sorted alphabetically and joined with "+"
const PAIR_MAP = {
  "Argentina+England": "maradona_1986",
  "Brazil+Germany": "germany_brazil_2014",
  "France+Italy": "zidane_2006",
  "Argentina+France": "messi_2022",
  "Germany+Brazil": "germany_brazil_2014",
}

// Single-team fallback map
const TEAM_MAP = {
  Brazil: "ronaldo_2002",
  Germany: "klose_2014",
  France: "thuram_1998",
  Argentina: "maradona_1986",
  Italy: "baggio_1994",
  Spain: "iniesta_2010",
}

/**
 * Returns the best MOMENT entry for a given matchup.
 * Priority: exact pair → home team fallback → away team fallback → maradona (default)
 */
export function getMomentForMatch(homeTeam, awayTeam) {
  const pair = [homeTeam, awayTeam].sort().join("+")
  if (PAIR_MAP[pair]) return MOMENTS[PAIR_MAP[pair]]
  if (TEAM_MAP[homeTeam]) return MOMENTS[TEAM_MAP[homeTeam]]
  if (TEAM_MAP[awayTeam]) return MOMENTS[TEAM_MAP[awayTeam]]
  return MOMENTS.maradona_1986
}

// Ordered list of moment keys used for the rotating Sandbox hero
export const ALL_MOMENT_KEYS = [
  "messi_2022", "maradona_1986", "germany_brazil_2014",
  "baggio_1994", "zidane_2006", "iniesta_2010",
]
```

- [ ] **Step 2: Create `src/data/moments.test.js`**

```js
import { describe, it, expect } from "vitest"
import { getMomentForMatch, MOMENTS, ALL_MOMENT_KEYS } from "./moments.js"

describe("getMomentForMatch", () => {
  it("returns maradona_1986 for Argentina vs England", () => {
    expect(getMomentForMatch("Argentina", "England").key).toBe("maradona_1986")
  })

  it("is symmetric — home/away order doesn't matter", () => {
    const a = getMomentForMatch("Germany", "Brazil")
    const b = getMomentForMatch("Brazil", "Germany")
    expect(a.key).toBe(b.key)
  })

  it("uses home team fallback when no pair match", () => {
    expect(getMomentForMatch("Brazil", "Morocco").key).toBe("ronaldo_2002")
  })

  it("uses away team fallback when home team has no entry", () => {
    expect(getMomentForMatch("Morocco", "Germany").key).toBe("klose_2014")
  })

  it("falls back to maradona_1986 for unknown teams", () => {
    expect(getMomentForMatch("Iceland", "Ecuador").key).toBe("maradona_1986")
  })

  it("every moment has required fields", () => {
    Object.values(MOMENTS).forEach((m) => {
      expect(m.key).toBeTruthy()
      expect(m.title).toBeTruthy()
      expect(m.subtitle).toBeTruthy()
      expect(m.year).toBeGreaterThan(1960)
      expect(m.imageUrl).toMatch(/^https:\/\//)
    })
  })

  it("ALL_MOMENT_KEYS entries all exist in MOMENTS", () => {
    ALL_MOMENT_KEYS.forEach((k) => expect(MOMENTS[k]).toBeDefined())
  })
})
```

- [ ] **Step 3: Run tests — expect pass**

```bash
cd /Users/hernanrosenblum/Documents/worldcup-betting-v2/frontend
npm test -- --run src/data/moments.test.js
```

Expected: 7 tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/data/moments.js src/data/moments.test.js
git commit -m "feat: moments.js — WC moment data + getMomentForMatch lookup"
```

---

## Task 2: `PageHero` component

**Files:**
- Create: `src/components/PageHero.jsx`
- Create: `src/components/PageHero.test.jsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/PageHero.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, act } from "@testing-library/react"
import PageHero from "./PageHero.jsx"

describe("PageHero", () => {
  it("renders the moment title for a known key", () => {
    render(<PageHero momentKey="maradona_1986" />)
    expect(screen.getByText("Goal of the Century")).toBeInTheDocument()
  })

  it("renders the year badge", () => {
    render(<PageHero momentKey="maradona_1986" />)
    expect(screen.getByText(/1986/)).toBeInTheDocument()
  })

  it("falls back to maradona for an unknown momentKey", () => {
    render(<PageHero momentKey="does_not_exist" />)
    expect(screen.getByText("Goal of the Century")).toBeInTheDocument()
  })

  it("applies custom height", () => {
    const { container } = render(<PageHero momentKey="maradona_1986" height={240} />)
    expect(container.firstChild.style.height).toBe("240px")
  })

  it("renders an img with the moment imageUrl as src", () => {
    render(<PageHero momentKey="zidane_2006" />)
    const img = screen.getByRole("img")
    expect(img.src).toContain("Zinedine_Zidane")
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test -- --run src/components/PageHero.test.jsx
```

Expected: FAIL — "Cannot find module './PageHero.jsx'"

- [ ] **Step 3: Create `src/components/PageHero.jsx`**

```jsx
import { useState, useEffect } from "react"
import { MOMENTS, ALL_MOMENT_KEYS } from "../data/moments.js"

export default function PageHero({ momentKey, height = 180, overlayOpacity = 0.82 }) {
  const isRotating = momentKey === "rotating"
  const [currentKey, setCurrentKey] = useState(
    isRotating ? ALL_MOMENT_KEYS[0] : momentKey
  )

  useEffect(() => {
    if (!isRotating) return
    let i = 0
    const id = setInterval(() => {
      i = (i + 1) % ALL_MOMENT_KEYS.length
      setCurrentKey(ALL_MOMENT_KEYS[i])
    }, 5000)
    return () => clearInterval(id)
  }, [isRotating])

  const moment = MOMENTS[currentKey] ?? MOMENTS.maradona_1986

  return (
    <div style={{ height, position: "relative", overflow: "hidden", flexShrink: 0 }}>
      <img
        src={moment.imageUrl}
        alt={moment.title}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center 30%",
        }}
      />
      {/* gradient overlay */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: `linear-gradient(180deg,
          rgba(12,12,20,${(overlayOpacity * 0.4).toFixed(2)}) 0%,
          rgba(12,12,20,${overlayOpacity.toFixed(2)}) 100%)`,
      }} />
      {/* text */}
      <div style={{ position: "absolute", bottom: 12, left: 14, right: 14 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          background: "rgba(168,85,247,0.2)",
          border: "1px solid rgba(168,85,247,0.4)",
          borderRadius: 6, padding: "2px 8px",
          fontSize: 9, color: "#c4b5fd", fontWeight: 700, marginBottom: 4,
        }}>
          ⭐ Iconic Moment · {moment.year}
        </div>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>
          {moment.title}
        </div>
        <div style={{ fontSize: 10, color: "#a78bfa", marginTop: 2 }}>
          {moment.subtitle}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- --run src/components/PageHero.test.jsx
```

Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/PageHero.jsx src/components/PageHero.test.jsx
git commit -m "feat: PageHero component — cinematic hero with WC moment overlay"
```

---

## Task 3: Update JoinPage (Messi bisht)

**Files:**
- Modify: `src/pages/JoinPage.jsx`

- [ ] **Step 1: Replace the background image URL**

In `src/pages/JoinPage.jsx`, find the `backgroundImage` line (currently the 2018 Luzhniki stadium photo) and replace it:

```jsx
// FIND:
backgroundImage: "url(https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/FWC_2018_-_Final_-_CRO_v_FRA_-_Photo_096.jpg/1280px-FWC_2018_-_Final_-_CRO_v_FRA_-_Photo_096.jpg)",

// REPLACE WITH:
backgroundImage: "url(https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/2022_FIFA_World_Cup_Final_-_trophy_ceremony_%28cropped%29.jpg/1280px-2022_FIFA_World_Cup_Final_-_trophy_ceremony_%28cropped%29.jpg)",
```

- [ ] **Step 2: Verify in browser**

Start the dev server (`npm run dev`) and open `http://localhost:5173/join`. You should see Messi in the bisht. If the image 404s, go to `https://commons.wikimedia.org/w/index.php?search=messi+2022+world+cup+trophy+bisht`, find the correct file, copy the 1280px thumbnail URL, and update `MOMENTS.messi_2022.imageUrl` in `moments.js` to match.

- [ ] **Step 3: Commit**

```bash
git add src/pages/JoinPage.jsx
git commit -m "feat: JoinPage hero — Messi bisht 2022"
```

---

## Task 4: Static hero on Matches, Bets, Predictions, Leaderboard, AI

**Files:**
- Modify: `src/pages/MatchesPage.jsx`
- Modify: `src/pages/BetsPage.jsx`
- Modify: `src/pages/PredictionsPage.jsx`
- Modify: `src/pages/LeaderboardPage.jsx`
- Modify: `src/pages/AIPage.jsx`

Each page gets the same change: import `PageHero` and render it as the **first child** of its outermost `<div style={{ padding: 16 }}>`, removing the `padding-top` from that div (the hero provides the visual top; content starts below it).

- [ ] **Step 1: Update `src/pages/MatchesPage.jsx`**

Add import after existing imports:
```jsx
import PageHero from "../components/PageHero.jsx"
```

Change the return's outer div and add the hero as first element:
```jsx
// FIND the return opening:
return (
  <div style={{ padding: 16 }}>

// REPLACE WITH:
return (
  <div>
    <PageHero momentKey="maradona_1986" />
    <div style={{ padding: 16 }}>
```

And close the extra div before the final `</div>` of the return.

Full updated return structure:
```jsx
return (
  <div>
    <PageHero momentKey="maradona_1986" />
    <div style={{ padding: 16 }}>
      {/* Filter pills */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto" }}>
        {/* ...existing filter pills unchanged... */}
      </div>
      {loading && <p style={{ color: "#6b7280", textAlign: "center" }}>Loading matches...</p>}
      {error && <p style={{ color: "#f87171", textAlign: "center" }}>{error}</p>}
      {!loading && !error && filtered.length === 0 && (
        <p style={{ color: "#6b7280", textAlign: "center" }}>No matches found.</p>
      )}
      {filtered.map((m) => <MatchCard key={m.id} match={m} />)}
    </div>
  </div>
)
```

- [ ] **Step 2: Update `src/pages/BetsPage.jsx`**

Add import:
```jsx
import PageHero from "../components/PageHero.jsx"
```

Wrap return with hero:
```jsx
return (
  <div>
    <PageHero momentKey="germany_brazil_2014" />
    <div style={{ padding: 16 }}>
      {/* ...existing content unchanged... */}
    </div>
  </div>
)
```

- [ ] **Step 3: Update `src/pages/PredictionsPage.jsx`**

Add import:
```jsx
import PageHero from "../components/PageHero.jsx"
```

Wrap return with hero:
```jsx
return (
  <div>
    <PageHero momentKey="baggio_1994" />
    <div style={{ padding: 16 }}>
      {/* ...existing content unchanged... */}
    </div>
  </div>
)
```

- [ ] **Step 4: Update `src/pages/LeaderboardPage.jsx`**

Add import:
```jsx
import PageHero from "../components/PageHero.jsx"
```

Wrap return with hero:
```jsx
return (
  <div>
    <PageHero momentKey="zidane_2006" />
    <div style={{ padding: 16 }}>
      {/* ...existing content unchanged... */}
    </div>
  </div>
)
```

- [ ] **Step 5: Update `src/pages/AIPage.jsx`**

Add import:
```jsx
import PageHero from "../components/PageHero.jsx"
```

Change the outer div (currently `style={{ padding: 16, maxWidth: 480, margin: "0 auto" }}`):
```jsx
return (
  <div>
    <PageHero momentKey="iniesta_2010" />
    <div style={{ padding: 16, maxWidth: 480, margin: "0 auto" }}>
      {/* ...existing content unchanged... */}
    </div>
  </div>
)
```

- [ ] **Step 6: Verify visually**

With `npm run dev` running, visit each route and confirm the hero appears:
- `http://localhost:5173/` → Maradona
- `http://localhost:5173/bets` → Mineirazzo
- `http://localhost:5173/predict` → Baggio
- `http://localhost:5173/rankings` → Zidane
- `http://localhost:5173/ai` → Iniesta

If any image 404s, find the correct Wikimedia thumbnail URL and update `moments.js`.

- [ ] **Step 7: Commit**

```bash
git add src/pages/MatchesPage.jsx src/pages/BetsPage.jsx src/pages/PredictionsPage.jsx src/pages/LeaderboardPage.jsx src/pages/AIPage.jsx
git commit -m "feat: WC moment heroes on Matches, Bets, Predictions, Leaderboard, AI pages"
```

---

## Task 5: Dynamic hero on MatchDetailPage

**Files:**
- Modify: `src/pages/MatchDetailPage.jsx`

- [ ] **Step 1: Add imports**

```jsx
import PageHero from "../components/PageHero.jsx"
import { getMomentForMatch } from "../data/moments.js"
```

- [ ] **Step 2: Add hero to the page return**

Find the existing return in `MatchDetailPage`. The `match` object is available at render time (it's `null` while loading, guarded by the loading check). Add the hero as the first element after the loading/error guards:

```jsx
// FIND the section that starts with:
return (
  <div style={{ padding: 16 }}>
    <button onClick={() => navigate(-1)} ...>

// REPLACE WITH:
return (
  <div>
    <PageHero
      momentKey={getMomentForMatch(match.home_team, match.away_team).key}
      height={160}
    />
    <div style={{ padding: 16 }}>
      <button onClick={() => navigate(-1)} style={{ color: "#a78bfa", background: "none", border: "none", fontSize: 13, cursor: "pointer", marginBottom: 16 }}>
        ← Back
      </button>
      {/* ...rest of existing content unchanged... */}
    </div>
  </div>
)
```

- [ ] **Step 3: Verify in browser**

Navigate to a match detail page. The hero should show a moment relevant to those teams (e.g. Argentina match → Maradona, Brazil match → Ronaldo 2002, unknown teams → Maradona fallback).

- [ ] **Step 4: Commit**

```bash
git add src/pages/MatchDetailPage.jsx
git commit -m "feat: MatchDetailPage — dynamic WC hero based on teams playing"
```

---

## Task 6: SandboxPage

**Files:**
- Create: `src/pages/SandboxPage.jsx`
- Create: `src/pages/SandboxPage.test.jsx`

- [ ] **Step 1: Write failing tests**

Create `src/pages/SandboxPage.test.jsx`:

```jsx
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { computePreview } from "./SandboxPage.jsx"

const MATCH_WITH_ODDS = {
  id: 1, home_team: "Argentina", away_team: "Brazil",
  status: "upcoming", kickoff_time: "2026-06-20T18:00:00Z",
  odds: { "1x2": [
    { name: "Home Win", price: 2.5 },
    { name: "Draw", price: 3.2 },
    { name: "Away Win", price: 2.8 },
  ]},
}

const MATCH_NO_ODDS = { ...MATCH_WITH_ODDS, odds: null }

describe("computePreview", () => {
  it("returns winning payout when home leads and outcome is home_win", () => {
    const r = computePreview(2, 1, 67, 300, "home_win", MATCH_WITH_ODDS)
    expect(r.isCurrentlyWinning).toBe(true)
    expect(r.payout).toBe(750)      // 300 * 2.5
    expect(r.netChange).toBe(450)   // 750 - 300
  })

  it("returns zero payout when losing", () => {
    const r = computePreview(0, 1, 67, 300, "home_win", MATCH_WITH_ODDS)
    expect(r.isCurrentlyWinning).toBe(false)
    expect(r.payout).toBe(0)
    expect(r.netChange).toBe(-300)
  })

  it("recognises draw correctly", () => {
    const r = computePreview(1, 1, 45, 100, "draw", MATCH_WITH_ODDS)
    expect(r.isCurrentlyWinning).toBe(true)
    expect(r.payout).toBe(320)      // 100 * 3.2
  })

  it("recognises away win", () => {
    const r = computePreview(0, 2, 80, 200, "away_win", MATCH_WITH_ODDS)
    expect(r.isCurrentlyWinning).toBe(true)
    expect(r.payout).toBe(560)      // 200 * 2.8
  })

  it("falls back to default odds when match has no odds", () => {
    const r = computePreview(2, 1, 60, 200, "home_win", MATCH_NO_ODDS)
    expect(r.oddsValue).toBe(2.5)
    expect(r.payout).toBe(500)      // 200 * 2.5
  })

  it("floors payout to integer", () => {
    const r = computePreview(0, 1, 50, 100, "away_win", MATCH_WITH_ODDS)
    expect(Number.isInteger(r.payout)).toBe(true)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test -- --run src/pages/SandboxPage.test.jsx
```

Expected: FAIL — "Cannot find module './SandboxPage.jsx'"

- [ ] **Step 3: Create `src/pages/SandboxPage.jsx`**

```jsx
import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { api } from "../api.js"
import { getPlayer } from "../auth.js"
import PageHero from "../components/PageHero.jsx"

// Default odds used when match.odds is null
const DEFAULT_ODDS = { home_win: 2.5, draw: 3.2, away_win: 2.8 }

/**
 * Pure payout calculator — exported for testing.
 * outcome: "home_win" | "draw" | "away_win"
 */
export function computePreview(homeGoals, awayGoals, minute, stake, outcome, match) {
  const oddsArr = match?.odds?.["1x2"] ?? null
  const nameMap = { home_win: "Home Win", draw: "Draw", away_win: "Away Win" }
  const oddsValue = oddsArr
    ? (oddsArr.find((o) => o.name === nameMap[outcome])?.price ?? DEFAULT_ODDS[outcome])
    : DEFAULT_ODDS[outcome]

  const isCurrentlyWinning =
    (outcome === "home_win" && homeGoals > awayGoals) ||
    (outcome === "draw" && homeGoals === awayGoals) ||
    (outcome === "away_win" && awayGoals > homeGoals)

  const payout = isCurrentlyWinning ? Math.floor(stake * oddsValue) : 0
  const netChange = isCurrentlyWinning ? payout - stake : -stake

  return { payout, netChange, isCurrentlyWinning, oddsValue }
}

const STEPPER_STYLE = {
  background: "#0c0c14", border: "1px solid #2d2b55", borderRadius: 8,
  padding: "7px 11px", color: "#e2e8f0", fontSize: 15, fontWeight: 700,
  textAlign: "center", minWidth: 48,
}

function Stepper({ label, value, onChange, min = 0, max = 99 }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      <span style={{ color: "#6b7280", fontSize: 12 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          style={{ background: "#1e1b3a", border: "1px solid #2d2b55", color: "#a78bfa", borderRadius: 6, width: 28, height: 28, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}
        >−</button>
        <span style={STEPPER_STYLE}>{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          style={{ background: "#1e1b3a", border: "1px solid #2d2b55", color: "#a78bfa", borderRadius: 6, width: 28, height: 28, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}
        >+</button>
      </div>
    </div>
  )
}

export default function SandboxPage() {
  const [matches, setMatches] = useState([])
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [homeGoals, setHomeGoals] = useState(1)
  const [awayGoals, setAwayGoals] = useState(0)
  const [minute, setMinute] = useState(45)
  const [stake, setStake] = useState(200)
  const [outcome, setOutcome] = useState("home_win")
  const [simMinute, setSimMinute] = useState(null)
  const [simRunning, setSimRunning] = useState(false)
  const [leaderboard, setLeaderboard] = useState([])
  const simRef = useRef(null)

  useEffect(() => {
    api.get("/api/matches").then((data) => {
      const upcoming = (data || []).filter((m) => m.status === "upcoming")
      setMatches(upcoming)
      if (upcoming.length > 0) setSelectedMatch(upcoming[0])
    }).catch(() => {})
    api.get("/api/leaderboard").then(setLeaderboard).catch(() => {})
  }, [])

  const preview = computePreview(homeGoals, awayGoals, minute, stake, outcome, selectedMatch)
  const player = getPlayer()
  const currentBalance = player?.token_balance ?? 0
  const newBalance = currentBalance + preview.netChange
  const currentRank = leaderboard.findIndex((p) => p.id === player?.id) + 1
  const newRank = leaderboard.filter((p) => p.token_balance > newBalance).length + 1

  function runSimulation() {
    if (simRunning) {
      clearInterval(simRef.current)
      setSimRunning(false)
      setSimMinute(null)
      return
    }
    setSimRunning(true)
    let m = minute
    setSimMinute(m)
    simRef.current = setInterval(() => {
      m += 1
      setSimMinute(m)
      if (m >= 90) {
        clearInterval(simRef.current)
        setSimRunning(false)
      }
    }, 200)
  }

  useEffect(() => () => clearInterval(simRef.current), [])

  const displayMinute = simRunning ? simMinute : minute

  const OUTCOME_OPTS = [
    { value: "home_win", label: selectedMatch ? `${selectedMatch.home_team} Win` : "Home Win" },
    { value: "draw", label: "Draw" },
    { value: "away_win", label: selectedMatch ? `${selectedMatch.away_team} Win` : "Away Win" },
  ]

  return (
    <div>
      <PageHero momentKey="rotating" />
      <div style={{ padding: 16, maxWidth: 480, margin: "0 auto" }}>

        <h2 className="gradient-text" style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>
          🧪 Sandbox
        </h2>
        <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 20 }}>
          Set up any scenario and see exactly what happens to your balance and rank.
        </p>

        {/* Match picker */}
        <p style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
          Pick a match
        </p>
        {matches.length === 0 && (
          <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>No upcoming matches.</p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
          {matches.map((m) => (
            <button key={m.id} onClick={() => setSelectedMatch(m)}
              style={{
                background: selectedMatch?.id === m.id ? "rgba(168,85,247,0.12)" : "#13131f",
                border: `1px solid ${selectedMatch?.id === m.id ? "#a855f7" : "#2d2b55"}`,
                borderRadius: 10, padding: "10px 14px",
                color: "#e2e8f0", fontSize: 13, fontWeight: 600, textAlign: "left", cursor: "pointer",
              }}>
              {m.home_team} vs {m.away_team}
            </button>
          ))}
        </div>

        {/* Scenario builder */}
        {selectedMatch && (
          <>
            <p style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
              Scenario
            </p>
            <div style={{ background: "#13131f", border: "1px solid #2d2b55", borderRadius: 12, padding: 16, marginBottom: 12 }}>
              <Stepper label={`${selectedMatch.home_team} goals`} value={homeGoals} onChange={setHomeGoals} max={9} />
              <Stepper label={`${selectedMatch.away_team} goals`} value={awayGoals} onChange={setAwayGoals} max={9} />
              <Stepper label="Minute" value={minute} onChange={setMinute} min={1} max={90} />
              <Stepper label="My stake (tokens)" value={stake} onChange={setStake} min={50} max={2000} />
              {/* Quick stake picks */}
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {[100, 200, 500].map((s) => (
                  <button key={s} onClick={() => setStake(s)}
                    style={{ background: stake === s ? "linear-gradient(135deg,#a855f7,#3b82f6)" : "#1e1b3a",
                      color: stake === s ? "#fff" : "#6b7280", border: "none",
                      borderRadius: 999, padding: "3px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                    {s}
                  </button>
                ))}
              </div>
              {/* Outcome toggle */}
              <p style={{ color: "#6b7280", fontSize: 11, marginBottom: 6 }}>My bet on</p>
              <div style={{ display: "flex", gap: 6 }}>
                {OUTCOME_OPTS.map((o) => (
                  <button key={o.value} onClick={() => setOutcome(o.value)}
                    style={{ flex: 1, background: outcome === o.value ? "linear-gradient(135deg,#a855f7,#3b82f6)" : "#0c0c14",
                      color: outcome === o.value ? "#fff" : "#6b7280",
                      border: "1px solid #2d2b55", borderRadius: 8, padding: "7px 4px",
                      fontSize: 10, fontWeight: 700, cursor: "pointer", textAlign: "center" }}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Live preview */}
            <div style={{ background: "linear-gradient(135deg,rgba(168,85,247,0.08),rgba(59,130,246,0.08))",
              border: "1px solid rgba(168,85,247,0.25)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontWeight: 800, fontSize: 13 }}>
                  {selectedMatch.home_team} {homeGoals}–{awayGoals} {selectedMatch.away_team}
                </span>
                <span style={{ color: simRunning ? "#ef4444" : "#6b7280", fontWeight: 700, fontSize: 13 }}>
                  {displayMinute ?? minute}'
                  {simMinute >= 90 && " · FT"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                <span style={{ color: "#6b7280" }}>Bet odds</span>
                <span style={{ color: "#a78bfa", fontWeight: 700 }}>{preview.oddsValue}x</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                <span style={{ color: "#6b7280" }}>Payout if result holds</span>
                <span style={{ color: preview.isCurrentlyWinning ? "#4ade80" : "#f87171", fontWeight: 700 }}>
                  {preview.isCurrentlyWinning ? `+${preview.payout}` : "0"} tokens
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                <span style={{ color: "#6b7280" }}>Net balance change</span>
                <span style={{ color: preview.netChange >= 0 ? "#4ade80" : "#f87171", fontWeight: 700 }}>
                  {preview.netChange >= 0 ? "+" : ""}{preview.netChange}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                <span style={{ color: "#6b7280" }}>New balance</span>
                <span className="gradient-text" style={{ fontWeight: 800 }}>{newBalance.toLocaleString()}</span>
              </div>
              {currentRank > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "#6b7280" }}>Leaderboard position</span>
                  <span style={{ color: "#fbbf24", fontWeight: 700 }}>
                    #{currentRank} → #{newRank}
                    {newRank < currentRank ? " ↑" : newRank > currentRank ? " ↓" : ""}
                  </span>
                </div>
              )}
            </div>

            {/* Simulation button */}
            <motion.button whileTap={{ scale: 0.97 }} onClick={runSimulation}
              style={{
                width: "100%",
                background: simRunning ? "#1e1b3a" : "linear-gradient(135deg,#a855f7,#3b82f6)",
                color: simRunning ? "#6b7280" : "#fff",
                border: "none", borderRadius: 10, padding: 13,
                fontSize: 14, fontWeight: 800, cursor: "pointer",
              }}>
              {simRunning ? `⏱ ${simMinute}' — Stop` : "▶ Run Live Simulation"}
            </motion.button>

            {!selectedMatch.odds && (
              <p style={{ color: "#6b7280", fontSize: 10, textAlign: "center", marginTop: 8 }}>
                No live odds for this match — using neutral defaults (H: 2.5, D: 3.2, A: 2.8)
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- --run src/pages/SandboxPage.test.jsx
```

Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/SandboxPage.jsx src/pages/SandboxPage.test.jsx
git commit -m "feat: SandboxPage — scenario builder, payout preview, minute simulation"
```

---

## Task 7: Wire up navigation and routing

**Files:**
- Modify: `src/components/BottomNav.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Add Sandbox tab to `BottomNav.jsx`**

```jsx
// FIND:
const tabs = [
  { to: "/", icon: "⚽", label: "Matches" },
  { to: "/bets", icon: "🏆", label: "Bets" },
  { to: "/predict", icon: "🎯", label: "Predict" },
  { to: "/rankings", icon: "📊", label: "Rankings" },
  { to: "/ai", icon: "🤖", label: "AI" },
]

// REPLACE WITH:
const tabs = [
  { to: "/", icon: "⚽", label: "Matches" },
  { to: "/bets", icon: "🏆", label: "Bets" },
  { to: "/predict", icon: "🎯", label: "Predict" },
  { to: "/rankings", icon: "📊", label: "Rankings" },
  { to: "/ai", icon: "🤖", label: "AI" },
  { to: "/sandbox", icon: "🧪", label: "Sandbox" },
]
```

Also reduce `minWidth` from 56 to 44 on the nav item div so 6 tabs fit comfortably:

```jsx
// FIND:
<div style={{ textAlign: "center", minWidth: 56 }}>

// REPLACE WITH:
<div style={{ textAlign: "center", minWidth: 44 }}>
```

- [ ] **Step 2: Add `/sandbox` route to `src/App.jsx`**

Add the import after the existing page imports:
```jsx
import SandboxPage from "./pages/SandboxPage.jsx"
```

Add the route inside `<Routes>`, after the `/ai` route:
```jsx
<Route path="/sandbox" element={<ProtectedLayout />}>
  <Route index element={<SandboxPage />} />
</Route>
```

(The existing routes use `<ProtectedLayout />` as a layout route with `<Outlet />` — match that pattern.)

- [ ] **Step 3: Verify navigation in browser**

Open `http://localhost:5173`. The bottom nav should show 6 tabs. Tap Sandbox — should route to `/sandbox` with the rotating hero and scenario builder.

- [ ] **Step 4: Commit**

```bash
git add src/components/BottomNav.jsx src/App.jsx
git commit -m "feat: add Sandbox tab to nav + /sandbox route"
```

---

## Task 8: Full test run + production build

- [ ] **Step 1: Run all tests**

```bash
cd /Users/hernanrosenblum/Documents/worldcup-betting-v2/frontend
npm test -- --run
```

Expected output:
```
Test Files  5 passed (5)
     Tests  XX passed (XX)
```

If any test fails, fix it before proceeding.

- [ ] **Step 2: Production build**

```bash
npm run build
```

Expected: Clean build, no errors, `dist/` created.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: WC moments + sandbox — all tests green, production build verified"
```

- [ ] **Step 4: Push**

```bash
git push origin feat/worldcup-betting-v2
```

---

*Spec: `docs/superpowers/specs/2026-05-25-wc-moments-sandbox-design.md`*
