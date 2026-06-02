# Deep Cuts — Stats Bets (Build 1 of 2)

**Date:** 2026-06-02  
**Status:** Design approved  
**App:** WC Betting v2 — `worldcup-betting-v2`

---

## Overview

Deep Cuts is a new betting category alongside the existing Tournament Bets. It surfaces tournament-wide and stage-specific proposition markets ("props") that are more creative than match bets: corner counts, offside tallies, own goals, penalty shootouts, group advancement picks, etc.

Each stage of the tournament unlocks its own set of 2–5 unique markets. When a stage opens, players see an in-app dismissable banner on the home page. Markets auto-lock when the first match of that stage kicks off, and auto-settle once all matches in the stage are finished.

Deep Cuts lives in a dedicated **🔪 Deep Cuts** tab in the navigation.

---

## Markets by Stage

Markets are unique per stage — no market repeats across stages.

### Tournament (1 market) — Lock: Jun 11, 18:00 UTC · Settles: after the Final
| Market | Type | Settlement |
|---|---|---|
| 😴 Most Exhausted Player | Text pick (player name) | API-Football `GET /players?league=1&season=2026` → player with highest `games.minutes` across all matches. Paginated; run once after the Final. |

Input is free-text, same pattern as Golden Boot. Default odds ~50.0 (800+ players; favorites are starting GKs and deep-run midfielders).

### Group Stage (5 markets) — Lock: Jun 11, 18:00 UTC
| Market | Type | Settlement |
|---|---|---|
| 📋 Group Advancement (×12 groups) | Pick 2 teams per group to advance | From group standings computed via match scores |
| 🏅 Best Group Stage Team | Pick a team | Points → GD → GS → −RC → −YC → coinflip |
| 🔺 Total Corners | Over / Under | Sum of `home_corners + away_corners`; existing `corners` column kept for backward compat |
| 🎯 Total Offsides | Over / Under | Sum of `home_offsides + away_offsides` (new field) |
| 🤦 Own Goals | Over / Under | Sum of `home_own_goals + away_own_goals` (new field) |

### Round of 32 (5 markets) — Lock: first R32 kick-off
| Market | Type | Settlement |
|---|---|---|
| ⚽ Top Scorer Team | Pick a team | Team with most goals scored across R32 |
| 🟥 Most Violent Team | Pick a team | Team with most red cards in R32 |
| ⏱️ Extra Time Matches | Exact count (0–5) | Count of matches with `went_to_et = True` |
| 🟡 Yellow Card Fest | Over / Under | Sum of `home_yellow_cards + away_yellow_cards` |
| 💀 Clean Sheet Race | Pick a team | Team conceding 0 in the most R32 matches |

### Round of 16 (5 markets) — Lock: first R16 kick-off
| Market | Type | Settlement |
|---|---|---|
| 🥅 Penalty Shootouts | Exact count (0–4) | Count of matches with `went_to_pens = True` |
| 🌙 Total R16 Goals | Over / Under | Sum of `home_score + away_score` across R16 |
| 🛡️ Most Leaky Defense | Pick a team | Team conceding the most goals in R16 |
| 🔺 Corner Machine | Pick a team | Team with highest `home_corners` or `away_corners` sum in R16 |
| 💥 High-Scoring Games (3+) | Over / Under | Count of R16 matches where total goals ≥ 3 |

### Quarter-Finals (3 markets) — Lock: first QF kick-off
| Market | Type | Settlement |
|---|---|---|
| 🥅 QF Penalty Shootouts | Exact count (0–2) | Count of QF matches with `went_to_pens = True` |
| 🎭 Goals by Substitutes | Over / Under | Sum of `sub_goals` across all QF matches (goal scorer ∈ substitution events for that match) |
| 🌟 Total QF Goals | Over / Under | Sum of `home_score + away_score` across QF |

### Semi-Finals (2 markets) — Lock: first SF kick-off
| Market | Type | Settlement |
|---|---|---|
| ⏱️ Any SF to Extra Time | Yes / No | Any SF match with `went_to_et = True` |
| 🟥 SF Red Card Drama | Exact count (0 / 1 / 2+) | Sum of red cards across both SF matches |

### The Final (2 markets) — Lock: Final kick-off
| Market | Type | Settlement |
|---|---|---|
| 🥅 Final Goes to Penalties | Yes / No | Final match `went_to_pens = True` |
| 🔥 Total Final Goals | Over / Under | `home_score + away_score` of the Final |

---

## Data Model

### New Match columns (Alembic migration)
```python
# IDs for external APIs — populated lazily, poller stores ESPN ID on first tick
espn_event_id      = Column(String(20))          # from ESPN scoreboard response
api_fixture_id     = Column(Integer)             # from API-Football; set via sync-fixture-ids admin endpoint

# All default 0 / False — backward compatible, poller fills them in
home_yellow_cards  = Column(Integer, default=0)
away_yellow_cards  = Column(Integer, default=0)
home_own_goals     = Column(Integer, default=0)
away_own_goals     = Column(Integer, default=0)
home_corners       = Column(Integer, default=0)   # replaces current total `corners`
away_corners       = Column(Integer, default=0)   # current `corners` col kept for compat
home_offsides      = Column(Integer, default=0)
away_offsides      = Column(Integer, default=0)
sub_goals          = Column(Integer, default=0)   # total goals by subs, both teams
went_to_et         = Column(Boolean, default=False)
went_to_pens       = Column(Boolean, default=False)
```

### New: `SpicyBet` table
```python
class SpicyBet(Base):
    __tablename__ = "spicy_bets"
    id                = Column(Integer, primary_key=True)
    player_id         = Column(Integer, ForeignKey("players.id"), nullable=False)
    league_id         = Column(Integer, ForeignKey("leagues.id"), nullable=True)
    market_key        = Column(String(80), nullable=False)   # e.g. "group_advance_A", "total_corners"
    stage             = Column(String(20), nullable=False)   # "group_stage","r32","r16","qf","sf","final"
    selection         = Column(String(200), nullable=False)  # team name | "yes"/"no" | "over"/"under" | int as str
    # Group Advancement: one SpicyBet row per group (12 rows per player).
    # market_key = "group_advance_A" … "group_advance_L"
    # selection = "Spain,Morocco" (comma-separated, exactly 2 teams, alphabetically sorted before storage)
    stake             = Column(Integer, nullable=False)
    odds_at_placement = Column(Float, nullable=False)
    status            = Column(String(20), nullable=False, default="pending")  # pending/won/lost

    player = relationship("Player", backref="spicy_bets")
    league = relationship("League")
```

### New: `SpicyDismissal` table
Tracks which players have seen (and dismissed) each stage's banner. Prevents re-showing.
```python
class SpicyDismissal(Base):
    __tablename__ = "spicy_dismissals"
    id           = Column(Integer, primary_key=True)
    player_id    = Column(Integer, ForeignKey("players.id"), nullable=False)
    stage        = Column(String(20), nullable=False)
    dismissed_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    __table_args__ = (UniqueConstraint("player_id", "stage", name="uq_dismiss_player_stage"),)
```

---

## Market Config (`backend/app/deep_cuts_config.py`)

A Python dict drives all markets — adding or tweaking a market never requires a migration.

```python
from datetime import datetime, timezone

STAGE_LOCK_TIMES = {
    "group_stage": datetime(2026, 6, 11, 18, 0, 0, tzinfo=timezone.utc),
    # r32, r16, qf, sf, final: derived from first match kick-off in that round
    # (computed at runtime from Match table — same pattern as existing TOURNAMENT_LOCK_TIME)
}

DEEP_CUTS_MARKETS = {
    # --- GROUP STAGE ---
    "group_advance": {
        "stage": "group_stage",
        "label": "📋 Group Advancement",
        "description": "Pick 2 teams that advance from each group (×12 groups).",
        "type": "group_advance",     # special multi-pick type
        "settle": "group_advance",
    },
    "best_group_team": {
        "stage": "group_stage",
        "label": "🏅 Best Group Stage Team",
        "description": "Pick the team with the best group stage record.",
        "type": "team_pick",
        "pool": "all_group_teams",
        "settle": "best_group_team",
        "default_odds": 48.0,
    },
    "total_corners": {
        "stage": "group_stage",
        "label": "🔺 Total Corners (Group Stage)",
        "type": "over_under",
        "lines": [
            {"name": "Over 474.5", "odds": 1.90},
            {"name": "Under 474.5", "odds": 1.90},
        ],
        "settle": "sum_field",
        "field": "home_corners+away_corners",
    },
    "total_offsides": {
        "stage": "group_stage",
        "label": "🎯 Total Offsides (Group Stage)",
        "type": "over_under",
        "lines": [
            {"name": "Over 139.5", "odds": 1.90},
            {"name": "Under 139.5", "odds": 1.90},
        ],
        "settle": "sum_field",
        "field": "home_offsides+away_offsides",
    },
    "own_goals": {
        "stage": "group_stage",
        "label": "🤦 Own Goals (Group Stage)",
        "type": "over_under",
        "lines": [
            {"name": "Over 2.5", "odds": 1.85},
            {"name": "Under 2.5", "odds": 1.95},
        ],
        "settle": "sum_field",
        "field": "home_own_goals+away_own_goals",
    },
    # --- ROUND OF 32 ---
    "r32_top_scorer": {
        "stage": "r32",
        "label": "⚽ Top Scorer Team (R32)",
        "type": "team_pick",
        "pool": "r32_teams",
        "settle": "top_goals_team",
        "default_odds": 32.0,
    },
    # ... (full config in implementation)
}
```

Over/under lines for each market are set before tournament start and hardcoded in the config. They can be adjusted by changing the config file (no migration needed).

---

## API Endpoints (`backend/app/routers/deep_cuts.py`)

```
GET  /api/deep-cuts/stages
     → list of stages with open/locked/settled status + market count

GET  /api/deep-cuts/markets/{stage}
     → market definitions for that stage (options, odds, lock time, locked bool)

POST /api/deep-cuts/bets
     body: { market_key, stage, selection, stake, odds }
     → { id, new_balance }
     Validates: stage not locked, player has balance, one bet per market per player

GET  /api/deep-cuts/bets
     → all SpicyBets for the current player (all stages)

POST /api/deep-cuts/dismiss/{stage}
     → upserts SpicyDismissal for current player + stage

GET  /api/deep-cuts/banner
     → list of stages that are open + player hasn't dismissed
     (used by frontend on home page load to decide whether to show banner)
```

---

## Settlement Engine (`backend/app/deep_cuts_settlement.py`)

`settle_stage(stage: str, db: AsyncSession)` — called from `poller.py` once all matches in a stage have `status = "finished"`.

For each `SpicyBet` with matching `stage` and `status = "pending"`:

| `settle` type | Logic |
|---|---|
| `sum_field` | Sum the field(s) across all stage matches; compare to over/under selection |
| `team_pick` | Aggregate goals/red cards/etc per team across stage; find winner; compare to selection |
| `group_advance` | Compute group standings from scores; check if selected 2 teams are in top 2 |
| `best_group_team` | Rank all group stage teams by points→GD→GS→-RC→-YC; compare to selection |
| `exact_count` | Count matches meeting condition; compare to player's number selection |
| `yes_no` | Evaluate boolean condition across stage matches; compare to "yes"/"no" selection |

Winning bets: `status = "won"`, `player.token_balance += stake * odds`.  
Losing bets: `status = "lost"`.  
**Ties in team-pick markets** (two teams equal on the deciding metric): all players who picked any of the tied teams win. No proportional split — if you picked a winner you win at full odds.

The poller checks after each `settle_match()` call whether a stage is now fully complete:
```python
# in poller.py, after settle_match():
if all matches in that round are finished:
    await settle_stage(round_name, db)
```

---

## Data Sources

Tested against real API responses (Euro 2024, WC 2022, Jun 2026 fixtures). Both sources confirmed working.

### ESPN Summary (`site.api.espn.com`) — free, no key
Already the primary score source. The summary endpoint (`/summary?event={espn_event_id}`) returns full team stats for completed matches:
- `yellowCards`, `redCards`, `wonCorners`, `offsides` — per team ✅
- ET detection: `status.type.name = "STATUS_FINAL_AET"` ✅
- Pens detection: `status.type.name = "STATUS_FINAL_PEN"` ✅
- Goal events with `ownGoal` / `penaltyKick` flags — available but `details[]` is empty for some matches ⚠️
- Substitution data — **not available** ❌

The ESPN event ID is present in the scoreboard response (already fetched each tick). Store it as `espn_event_id` on Match.

### API-Football (`v3.football.api-sports.io`) — keyed, 100 req/day free
Already configured (`FOOTBALL_API_KEY`). Only used for top-scorer lookup today; extend to:
- `GET /fixtures/statistics?fixture={id}` → corners, yellow/red cards, offsides per team ✅
- `GET /fixtures/events?fixture={id}` → goals (`Normal Goal` / `Own Goal` / `Penalty`), cards, subs (`type=subst`) with player names and minutes ✅
- `GET /players?league=1&season=2026&page={n}` → cumulative `games.minutes` per player ✅

**Rate limit:** 100 req/day free. ~4 group stage matches/day × 3 calls = 12/day. Well within limits across the full tournament.

Requires `api_fixture_id` on Match. Populated at tournament start via a one-time admin endpoint: `POST /api/admin/sync-fixture-ids` → `GET /fixtures?league=1&season=2026` → match by team names + date → store IDs.

### Settlement enrichment flow (per match)
1. ESPN scoreboard tick detects match finished → run existing score settlement (unchanged)
2. Fetch ESPN summary for `espn_event_id` → store yellow/red cards, corners, offsides, ET/pens flags
3. Fetch API-Football events for `api_fixture_id` → store own goals, sub goals (goal scorer ∈ substitution events for that match)
4. Trigger `settle_stage()` if all matches in the stage are now finished

### Most Exhausted Player settlement
Called once after the Final:
```python
# Paginate through all players, find max minutes
page = 1
max_minutes, winner_name = 0, ""
while True:
    resp = GET /players?league=1&season=2026&page={page}
    if not resp: break
    for player in resp:
        mins = player["statistics"][0]["games"]["minutes"]
        if mins > max_minutes:
            max_minutes, winner_name = mins, player["player"]["name"]
    page += 1
# Settle all SpicyBets with market_key="most_exhausted" where selection fuzzy-matches winner_name
```

Fuzzy matching (same approach as golden boot): lowercase + strip accents before comparing.

---

## Poller Extension

`poller.py`'s `_fetch_match_stats()` (or equivalent) already pulls corners and red cards from the football API. Extend it to also pull and store:
- `home_yellow_cards`, `away_yellow_cards`
- `home_corners`, `away_corners` (split from current total)
- `home_offsides`, `away_offsides`
- `went_to_et`, `went_to_pens` (from match status/score flags in API response)
- `home_own_goals`, `away_own_goals` (from goal event types if available)
- `sub_goals` (count of goals by substitutes — cross-reference goal scorer names against substitution events in the same match; both are already in the events payload the poller fetches for red cards)

The football API key (`FOOTBALL_API_KEY = c1b9cf857ce043c55933e305c1f483e6`) is already configured. These fields are available in the match statistics endpoint.

---

## In-App Banner (Frontend)

On every page load (React Router `useEffect` on auth), the frontend calls `GET /api/deep-cuts/banner`. If one or more stages are returned:

1. Show a dismissable banner at the top of the Home page:
   > 🔪 **[Stage Name] Deep Cuts are open!** N markets · Locks [date]  `[Bet now →]`
2. Tapping the banner navigates to `/deep-cuts?stage=<stage>`.
3. Tapping the × calls `POST /api/deep-cuts/dismiss/{stage}` — banner won't show again for that player and stage.
4. Multiple open stages: show one banner (the earliest unlocked stage), cycle or stack if needed.

---

## Navigation

Add **🔪 Deep Cuts** as a tab in `TopBar.jsx` alongside the existing navigation. Route: `/deep-cuts`.

`DeepCutsPage.jsx` structure:
- Stage tabs (**Tournament** / Group Stage / R32 / R16 / QF / SF / Final) with open/locked/settled badges
- Tournament tab: text-input markets (Most Exhausted Player), same UX as golden boot
- Per-stage market list — each market renders as a card with its type-specific input:
  - `TeamPickMarket` — searchable team dropdown
  - `OverUnderMarket` — two-option selector with line label
  - `ExactCountMarket` — number selector (0–N)
  - `YesNoMarket` — binary toggle
  - `GroupAdvanceMarket` — 12 group sub-pickers, each with 4 team checkboxes (pick exactly 2)
- "My Deep Cuts" section at the bottom — list of placed bets with status badges

---

## Future Development: Banker Match

> Not in scope for this build. Design separately before implementing.

**Concept:** Once per stage (group stage through QF, not SF or Final), each player designates one match as their "banker match." Up to 3 bets placed on that match pay double winnings if they win.

**Key design questions to resolve:**
- Does "double" apply to token payout only, or also prediction points?
- Can the banker match be changed after placing it, or is it locked on first designation?
- Is it per-match betting only, or does it interact with Deep Cuts bets on that stage too?
- UI: how does the player designate the banker (a star/pin on the match card)?
- Settlement: `BankerMatch` table (player_id, stage, match_id) or a flag on the Bet row?

This mechanic is intentionally kept out of the current build to avoid scope creep. Design it as a standalone phase once Deep Cuts is live.

---

## Out of Scope (Build 2)

**Consolation Pick** — if a player's winner/golden boot pick is eliminated mid-tournament, they get one mulligan at half the original payout odds. This is a separate spec (see `2026-06-02-consolation-pick-design.md` — to be written).

---

## Testing

- **Unit:** `settle_stage()` for each `settle` type — mock match data, assert correct win/loss outcomes including ties/edge cases (e.g., two teams level on all tiebreakers).
- **Integration:** Full flow — place bet → match data in → poller triggers settle → balance updated.
- **Group advancement:** Test standings computation against known WC tiebreaker scenarios.
- **Banner:** Test `GET /api/deep-cuts/banner` respects dismissals; test multiple open stages.
- **Lock enforcement:** Bets rejected after stage lock time.
