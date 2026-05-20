# World Cup Betting App v2 — Design Spec

**Date:** 2026-05-20  
**Status:** Approved  

---

## Overview

A full reimagining of the 2026 World Cup betting app for a private friend group. Friends access via invite code from their phones. The new version keeps all core betting features, adds an AI-powered challenge generator, adds long-term tournament bets, cuts the admin panel entirely in favour of automation, and delivers a premium Electric Purple/Blue visual identity with live score updates via WebSockets.

---

## Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI (async) |
| Data validation | Pydantic v2 |
| ORM | SQLAlchemy 2.0 async |
| Migrations | Alembic |
| Database | PostgreSQL (Railway managed) |
| Auth | JWT (python-jose) + invite codes |
| AI | Anthropic Python SDK (streaming) |
| Background tasks | asyncio + APScheduler |
| Real-time | WebSockets (FastAPI native) |
| Frontend | React + Vite |
| Styling | Tailwind CSS + shadcn/ui |
| Animation | Framer Motion |
| Deployment | Railway (backend + DB) + Vite static or Railway (frontend) |
| Testing (BE) | pytest + httpx AsyncClient |
| Testing (FE) | Vitest + React Testing Library |

---

## Visual Identity

**Theme:** Electric Purple/Blue  
**Background:** Near-black `#0c0c14`  
**Surface:** `#13131f`  
**Border:** `#2d2b55`  
**Accent gradient:** `linear-gradient(135deg, #a855f7, #3b82f6)`  
**Live indicator:** `#ef4444` pulse dot  
**Text primary:** `#e2e8f0`  
**Text muted:** `#6b7280`  
**Glow:** `box-shadow: 0 0 30px rgba(168,85,247,0.15)`  

Navigation: **bottom tab bar** with 5 tabs — Matches / Bets / Predict / Rankings / AI.

---

## Features In Scope

### Match Betting
Players bet tokens on individual matches before kickoff. Supported markets:
- 1X2 (home win / draw / away win)
- Correct score
- Over/Under totals (goals, corners)
- Both Teams to Score (BTTS)
- Handicap

Odds are fetched from the Odds API and cached per match. Bets lock automatically when the match kicks off (status transitions `upcoming → locked`).

### P2P Challenges
A player issues a challenge on a market (taking the underdog side). The system calculates the fair counter-stake based on the odds ratio. Another player accepts. Stakes are held from both balances. Settled automatically when the match finishes.

### Bravery System
Rewards players for sustained challenge activity.

**Streak bonuses** (on winning challenge payouts):
- 3 consecutive challenges: +10%
- 4 consecutive: +20%
- 5+: +35%

**Volume milestones** (one-time token grants on crossing thresholds):
- 5 total challenges issued: +50 tokens
- 10 total: +150 tokens
- 20 total: +400 tokens

### Score Predictions
Separate from bets. Players predict exact scorelines for any upcoming match. Points awarded on settlement:
- Exact score: 3 points
- Correct outcome (right winner/draw, wrong score): 1 point

Displayed in their own tab. Does not consume tokens.

### Leaderboard
Two boards:
1. **Token ranking** — players sorted by current balance, updates live via WebSocket push after each settlement
2. **Red-card table** — teams ranked by cumulative red cards across finished matches

### AI Challenge Generator
Accessed from the AI tab (bottom nav). Player selects a match. Frontend calls `POST /api/ai/suggest-challenge` with the match ID. Backend:
1. Fetches match odds (from cache)
2. Fetches player's current balance + challenge streak
3. Fetches open challenges already on that match
4. Constructs a prompt for Claude with this context
5. Streams the response back via Server-Sent Events

Claude returns 2–3 challenge suggestions, each with: market, proposed stake, reasoning (why this pick is interesting given the odds), and a one-click "Issue this challenge" pre-filled form. Frontend renders with a typewriter animation.

### Long-Term Tournament Bets
Three markets, locked at tournament kickoff (2026-06-11 18:00 UTC). Auto-settled when the tournament ends.

| Market | Settlement trigger |
|---|---|
| Tournament winner | Final match result → winning team name |
| Golden boot | Poller fetches top scorer from Football API after Final |
| Total tournament goals | Sum of all `home_score + away_score` across finished matches |

Players pick a team / player name / Over-Under line and place a stake. Payout = `stake × odds_at_placement`.

---

## Features Cut (vs v1)

| Feature | Reason |
|---|---|
| Admin panel UI | Replaced by CLI seed script + automatic poller |
| Custom bets (admin-created) | Required admin panel; removed with it |
| Manual match resolve | Poller handles all settlement; CLI fallback for emergencies |
| Admin manual resolve for tournament bets | Auto-settled by poller; tournament bet markets themselves are kept |

---

## Data Models (6 tables)

### `players`
`id, name, token_balance, challenge_streak, total_challenges_issued, volume_milestone_reached`

### `matches`
`id, home_team, away_team, kickoff_time, status (upcoming/locked/finished), odds_cache (JSON), odds_fetched_at, home_score, away_score, home_red_cards, away_red_cards, corners, round (group/r32/r16/qf/sf/final), home_team_confirmed, away_team_confirmed, next_match_id (FK), next_slot (home/away)`

### `bets`
`id, player_id (FK), match_id (FK), bet_type, selection, stake, odds_at_placement, status (pending/won/lost)`

### `challenges`
`id, issuer_id (FK), acceptor_id (FK nullable), match_id (FK), bet_type, selection, acceptor_selection, issuer_stake, acceptor_stake, issuer_odds, acceptor_odds, status (open/accepted/cancelled/resolved), bravery_streak_bonus_pct`

### `predictions`
`id, player_id (FK), match_id (FK), home_score_pred, away_score_pred, status (pending/correct_score/correct_outcome/wrong), points_awarded`  
Unique constraint: `(player_id, match_id)`

### `tournament_bets`
`id, player_id (FK), bet_type (winner/golden_boot/total_goals), selection, stake, odds_at_placement, status (pending/won/lost)`

---

## Architecture

```
[Odds API]  [Football API]  [Claude API]
     ↕            ↕               ↕
┌─────────────────────────────────────────┐
│           FastAPI Backend (Railway)      │
│  auth · matches · bets · challenges     │
│  predictions · leaderboard              │
│  ai/suggest (streaming SSE)             │
│  ws/ (WebSocket hub)                    │
│  poller (APScheduler background task)   │
│  Alembic migrations                     │
└──────────────┬──────────────────────────┘
               ↕                    ↕ WebSocket
       [PostgreSQL]          [React Frontend]
       (Railway)              Matches / Bets / Predict
                              Rankings / AI tabs
                              Tailwind + shadcn/ui
                              Framer Motion
```

### WebSocket behaviour
- Single `/ws/{player_id}` endpoint
- Server broadcasts `match_settled`, `leaderboard_updated`, `score_update` events
- Frontend reconnects automatically with exponential backoff on disconnect

### Background poller
- APScheduler job runs every 60 seconds during tournament window
- Fetches live scores from Football API for all `locked` matches
- On match finish: settles bets, settles challenges (with bravery bonuses), settles predictions, propagates winner to next KO slot
- Settles tournament bets when Final match is resolved
- Broadcasts `match_settled` + `leaderboard_updated` over WebSocket to all connected clients

### CLI seed script
Replaces the admin UI for one-time setup:
```
python scripts/seed.py          # import matches from Odds API + seed KO bracket
python scripts/seed.py --reset  # wipe and re-seed (dev only)
```

---

## API Surface (key routes)

```
POST /api/auth/join                          join with invite code
GET  /api/players/me                         current player

GET  /api/matches                            all matches (with auto-lock)
GET  /api/matches/{id}                       match detail + odds + open challenges

POST /api/matches/{id}/bets                  place match bet
POST /api/matches/{id}/challenges            issue challenge
POST /api/challenges/{id}/accept             accept challenge

GET  /api/predictions                        all matches + my predictions
POST /api/predictions                        save/update prediction

GET  /api/leaderboard                        token ranking
GET  /api/leaderboard/red-cards              red card table

GET  /api/tournament/bets                    my tournament bets + lock status
POST /api/tournament/bets                    place tournament bet

POST /api/ai/suggest-challenge               stream AI challenge suggestions (SSE)

WS   /ws/{player_id}                         live updates
```

---

## Frontend Pages

| Tab | Page | Key components |
|---|---|---|
| ⚽ Matches | Match list | MatchCard (live score, flags), filter by round/status |
| ⚽ Matches | Match detail | BetPanel, ChallengePanel, odds display |
| 🏆 Bets | My bets | ActiveBetCard, tournament bet section |
| 🎯 Predict | Predictions | PredictionRow per match, score input, points display |
| 📊 Rankings | Leaderboard | Token table, red-card table, live via WebSocket |
| 🤖 AI | AI Generator | Match selector, streaming suggestion display, one-click issue |
| — | Join | Name input, invite code, join button |

---

## Error Handling

- FastAPI raises `HTTPException` with typed Pydantic error bodies
- Frontend uses shadcn/ui `toast` for error feedback (bet rejected, match locked, insufficient balance)
- WebSocket: auto-reconnect with exponential backoff (1s → 2s → 4s → max 30s)
- Poller: catches all exceptions per cycle, logs, continues — never crashes the server
- AI endpoint: if Claude API fails, returns a graceful fallback message (not a 500)

---

## Testing

**Backend:** `pytest` + `httpx.AsyncClient` + SQLite in-memory test DB  
- One test file per router mirroring the existing structure
- Anthropic client mocked in `conftest.py` for AI endpoint tests
- Poller tested with synthetic match + score data

**Frontend:** Vitest + React Testing Library  
- Component tests for MatchCard, BetPanel, ChallengePanel, PredictionRow
- WebSocket interactions mocked

---

## Deployment

1. Push to GitHub → Railway auto-deploys backend + provisions PostgreSQL
2. Run `python scripts/seed.py` once to import matches and seed the KO bracket
3. Frontend deployed as static build (Railway static site or separate Vite deploy)
4. Set env vars: `JWT_SECRET`, `INVITE_CODE`, `ODDS_API_KEY`, `FOOTBALL_API_KEY`, `ANTHROPIC_API_KEY`, `DATABASE_URL`
