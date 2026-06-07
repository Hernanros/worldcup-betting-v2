# Player H2H Dare Type — Design Spec

**Date:** 2026-06-07  
**Status:** Approved  
**Project:** worldcup-betting-v2

---

## Overview

Add a new dare type — **Player H2H** — where two users dare each other on which named player wins a stat duel (goals or assists) within a specific match. Example: "Messi vs Mbappé — who scores more goals?"

The issuer picks two players and a stat. The acceptor automatically takes the other side. Settlement is driven by per-player stats extracted from API-Football fixture events (already integrated). A tie voids the dare and both players are refunded.

---

## Decisions

| Concern | Decision |
|---|---|
| Stats supported | Goals + Assists |
| Player picker UX | Curated star chips keyed by team (`STAR_PLAYERS` map) |
| Selection format | `"Messi goals"` / `"Mbappé goals"` in existing `selection` column |
| Tie / equal count | Void — both refunded, `ch.status = "voided"` |
| Acceptor side | Auto-flip: issuer picks both players, acceptor auto-takes the other |
| Settlement source | API-Football `/fixtures/events` (already used for `sub_goals`) |
| Stats caching | New `player_stats_cache TEXT` column on `matches` table |
| Player name matching | Lowercase + accent-strip + substring match |
| Admin override path | `POST /api/admin/matches/{id}/player-stats` + re-settle voided challenges |
| DB migrations required | `matches.player_stats_cache TEXT NULL` only |

---

## Architecture

```
ChallengePanel.jsx
  └── PlayerH2HPicker component
        ├── STAR_PLAYERS[match.home_team] chips  →  "your player"
        ├── STAR_PLAYERS[match.away_team] chips  →  "their player"
        └── Goals | Assists buttons              →  stat

selection = "Messi goals"
acceptor_selection = "Mbappé goals"

On match finish:
  poller._enrich_match_stats()
    └── fetch_api_football_events()  [extended]
          ├── sub_goals (existing)
          ├── player goals per name
          └── player assists per name
    └── match.player_stats_cache = JSON blob

  poller._settle_challenges()
    └── if bet_type == "player_h2h":
          └── determine_player_h2h_winner()
                ├── "issuer"   → issuer wins, streak + payout
                ├── "acceptor" → acceptor wins, streak + payout
                └── "void"     → full refund both, ch.status = "voided"

AdminPage (override path):
  POST /api/admin/matches/{id}/player-stats
    └── writes player_stats_cache
    └── re-settles any voided player_h2h challenges on that match
```

---

## Section 1 — UI / ChallengePanel.jsx

### DARE_TYPES entry
```js
{
  key: "player_h2h",
  label: "⚽ Player H2H",
  short: "Player H2H",
  yesNo: false,
  playerH2H: true,
  hint: "Dare on which player wins a stat duel — e.g. Messi vs Mbappé, who scores more?"
}
```

### STAR_PLAYERS map
Static lookup keyed by team name. ~30 WC 2026 teams, 3–5 stars each. Used to populate chips in the picker. Must cover all teams seeded in the WC fixture list. Example entries:

```js
const STAR_PLAYERS = {
  "Argentina":  ["Messi", "Di María", "Álvarez", "Mac Allister"],
  "France":     ["Mbappé", "Griezmann", "Dembélé", "Camavinga"],
  "Brazil":     ["Vini Jr", "Rodrygo", "Raphinha", "Paquetá"],
  "England":    ["Bellingham", "Saka", "Foden", "Kane"],
  "Portugal":   ["Ronaldo", "B. Silva", "Félix", "R. Leão"],
  "Spain":      ["Pedri", "Yamal", "Morata", "Olmo"],
  "Germany":    ["Müller", "Wirtz", "Gnabry", "Havertz"],
  "Netherlands":["Van Dijk", "Gakpo", "Depay", "Simons"],
  "Uruguay":    ["Núñez", "Valverde", "Araújo"],
  "Colombia":   ["James", "Díaz", "Arias"],
  "USA":        ["Pulisic", "Reyna", "Adams"],
  "Mexico":     ["Guardado", "Lozano", "Raúl"],
  "Morocco":    ["En-Nesyri", "Hakimi", "Ziyech"],
  "Senegal":    ["Mané", "Dia", "Sarr"],
  "Japan":      ["Mitoma", "Kubo", "Kamada"],
  "South Korea":["Son", "Lee Kang-In", "Hwang"],
  // Implementation note: extend to all 48 WC 2026 teams before go-live.
  // Full team list is seeded in the matches table. Use Wikipedia's WC 2026 squad
  // pages as source for names; prefer the surname or widely known short form
  // that API-Football uses (check one real fixture event to confirm).
}
```

Names in this list must loosely match what API-Football returns (see name matching section below). Use common surname or widely recognised short-form (e.g. "Messi" not "Lionel Messi").

### PlayerH2HPicker component
```
┌─────────────────────────────────────┐
│ Your player                         │
│ [Messi✓] [Di María] [Álvarez] ...   │  ← home team stars
│ [Mbappé] [Griezmann] [Dembélé] ...  │  ← away team stars
│                                     │
│ Their player                        │
│ [Messi] [Di María] [Álvarez] ...    │  ← same pool, "your" pick disabled
│ [Mbappé✓] [Griezmann] [Dembélé] ... │
│                                     │
│ Stat    [Goals✓]  [Assists]         │
│                                     │
│ ⚔️ Messi (Goals) vs Mbappé (Goals)  │  ← summary pill (shown when both picked)
└─────────────────────────────────────┘
```

- "Your player" chips: full pool of both teams' stars
- "Their player" chips: same pool, but the chip matching the current "your player" is disabled
- Stat buttons: `Goals` | `Assists` (default: Goals)
- Summary pill renders once both players and stat are chosen
- On pick: `selection = "${yourPlayer} ${stat}"`, `acceptorSelection = "${theirPlayer} ${stat}"`

### State wiring in ChallengePanel
`PlayerH2HPicker` is added as a new branch in the pick section alongside `currentType.yesNo`, `currentType.handicap`:
```jsx
} : currentType.playerH2H ? (
  <PlayerH2HPicker
    match={match}
    selection={selection}
    acceptorSelection={acceptorSelection}
    onPick={(sel, acceptSel) => { setSelection(sel); setAcceptorSelection(acceptSel) }}
  />
```

`oppositeOf()` does not apply to `player_h2h` — no auto-flip from a single selection. The issuer controls both sides.

### Incoming dare display
No changes needed. The existing incoming-dare card already renders `c.selection` and `c.acceptor_selection` as strings. A `player_h2h` dare will display as:

> **Player H2H:** Messi goals **vs** Mbappé goals · 100 vs 100 🪙

---

## Section 2 — Backend: Player Stats Cache

### DB migration
```sql
ALTER TABLE matches ADD COLUMN player_stats_cache TEXT DEFAULT NULL;
```

Add to `models.py`:
```python
player_stats_cache = Column(Text, nullable=True)
```

`player_stats_cache` stores a JSON blob with lowercased, accent-stripped player name keys:
```json
{
  "messi":   {"goals": 2, "assists": 0},
  "mbappe":  {"goals": 1, "assists": 1},
  "alvarez": {"goals": 0, "assists": 1}
}
```

Keys are normalised at write time, not at read time, so lookups are O(1).

### results_client.py — extend fetch_api_football_events()

The function already iterates all fixture events. Extend to collect goals and assists per player.

API-Football goal event shape:
```json
{
  "type": "Goal",
  "detail": "Normal Goal",
  "player": {"name": "L. Messi"},
  "assist": {"name": "Di Maria"},   // null if unassisted
  "team": {"name": "Argentina"}
}
```

Extended return shape:
```python
{
  "home_own_goals": int,
  "away_own_goals": int,
  "sub_goals": int,
  "player_stats": {
    "l. messi": {"goals": 2, "assists": 0},
    "di maria":  {"goals": 0, "assists": 1},
    ...
  }
}
```

Logic:
- For each event where `type == "Goal"` and `detail != "Own Goal"`:
  - Increment `player_stats[normalize(player.name)]["goals"]`
  - If `assist.name` is non-null: increment `player_stats[normalize(assist.name)]["assists"]`
- `normalize(name)`: lowercase, strip accents (unicodedata.normalize NFKD + ascii encode/decode)

### poller.py — _enrich_match_stats()

After calling `fetch_api_football_events()`, store the player stats:
```python
af_stats = fetch_api_football_events(match.api_fixture_id, settings.football_api_key)
for key, val in af_stats.items():
    if key == "player_stats":
        match.player_stats_cache = json.dumps(val)
    else:
        setattr(match, key, val)
```

If `api_fixture_id` is absent, `player_stats_cache` remains `None` → admin override path activates.

### settlement.py — determine_player_h2h_winner()

```python
def determine_player_h2h_winner(
    issuer_sel: str,
    acceptor_sel: str,
    player_stats_cache: str | None,
) -> str:  # "issuer" | "acceptor" | "void"
```

Steps:
1. Parse `issuer_sel` → `issuer_player, stat` (last word = stat, rest = player name)
2. Parse `acceptor_sel` → `acceptor_player, stat` (stat must match; if not, void)
3. If `player_stats_cache` is None → return `"void"`
4. Load cache JSON
5. Look up each player using `_find_player_in_cache(name, cache)`:
   - Normalise `name`
   - Try exact key match first
   - Fall back to: any cache key that contains the normalised name, or that the normalised name contains
6. If either player not found → return `"void"`
7. Compare stat counts:
   - issuer_count > acceptor_count → `"issuer"`
   - acceptor_count > issuer_count → `"acceptor"`
   - equal → `"void"`

### poller.py — _settle_challenges() void branch

```python
if ch.bet_type == "player_h2h":
    winner = determine_player_h2h_winner(
        ch.selection, ch.acceptor_selection, match.player_stats_cache
    )
    if winner == "void":
        issuer  = await db.get(Player, ch.issuer_id)
        acceptor = await db.get(Player, ch.acceptor_id)
        issuer.token_balance  += ch.issuer_stake
        acceptor.token_balance += ch.acceptor_stake
        ch.status = "voided"
        continue   # skip normal payout path
    issuer_won = (winner == "issuer")
    # falls through to existing streak + payout logic unchanged
```

`"voided"` is a new valid string for `Challenge.status`. The column has no DB-level enum constraint, so no migration needed.

---

## Section 3 — Admin Override

### New endpoint
```
POST /api/admin/matches/{match_id}/player-stats
```

Request body:
```json
{
  "player_stats": {
    "messi":  {"goals": 2, "assists": 0},
    "mbappe": {"goals": 1, "assists": 1}
  }
}
```

Behaviour:
1. Verify caller `is_admin`
2. Load match; any status is valid (admin may correct pre-settlement too)
3. Normalise all keys (lowercase + accent-strip)
4. Write to `match.player_stats_cache`
5. If match is `"finished"`: query all `player_h2h` challenges on this match with `status == "voided"`, re-run `determine_player_h2h_winner()` + settle each one
6. Return `{"updated": true, "resettled": N}`

### AdminPage UI

New collapsible section **"Player Stats Override"** below "Settle Match":

```
Player Stats Override
─────────────────────────────
Match: [dropdown — finished matches with player_h2h challenges]

Current cache:
┌─────────────────────────────┐
│ {                           │
│   "messi": {"goals": 0, ... }│
│ }                           │
└─────────────────────────────┘
[textarea — editable JSON]

[Save & Settle]   → ✓ Settled 2 challenge(s)
```

The dropdown is populated from all finished matches (same source as the existing "Settle Match" section — `GET /api/matches` filtered to `status == "finished"`). Admin selects the relevant match. The textarea pre-fills with current `player_stats_cache` JSON or an empty template `{"player_name": {"goals": 0, "assists": 0}}`.

---

## Name Matching Notes

API-Football returns abbreviated first names (e.g. `"L. Messi"`, `"K. Mbappé"`). The `STAR_PLAYERS` chips use the widely recognised short-form (`"Messi"`, `"Mbappé"`). The substring match in `_find_player_in_cache` handles this:

- `"messi"` is contained in `"l. messi"` ✓
- `"mbappe"` (accent-stripped) is contained in `"k. mbappe"` ✓
- `"vini jr"` needs explicit handling — consider adding a name alias table in `settlement.py` if edge cases emerge

Known risk: two players with the same surname on the same team (rare in practice). If hit, admin override resolves it.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| `api_fixture_id` absent on match | `player_stats_cache` stays NULL → all player_h2h challenges voided → admin override |
| API-Football call fails | `_enrich_match_stats` catches exception; logs warning; cache stays NULL → same void path |
| Player not found in cache | `determine_player_h2h_winner` returns `"void"` |
| Cache JSON malformed | `determine_player_h2h_winner` catches `json.JSONDecodeError`, returns `"void"` |
| Admin overrides on already-resolved challenge | Endpoint skips `status == "resolved"` challenges; only re-settles `"voided"` ones |

---

## Files Changed

| File | Change |
|---|---|
| `frontend/src/components/ChallengePanel.jsx` | Add `player_h2h` to `DARE_TYPES`, add `STAR_PLAYERS` map, add `PlayerH2HPicker` component |
| `backend/app/models.py` | Add `player_stats_cache = Column(Text, nullable=True)` to `Match` |
| `backend/app/results_client.py` | Extend `fetch_api_football_events()` to collect per-player goals + assists |
| `backend/app/poller.py` | Store `player_stats_cache` in `_enrich_match_stats()`; add void branch in `_settle_challenges()` |
| `backend/app/settlement.py` | Add `determine_player_h2h_winner()` + `_find_player_in_cache()` + `_normalize_name()` |
| `backend/app/routers/leagues.py` | Add `POST /api/admin/matches/{id}/player-stats` endpoint (all admin endpoints live here) |
| `frontend/src/pages/AdminPage.jsx` | Add Player Stats Override section |
| `alembic/versions/` or migration script | `ALTER TABLE matches ADD COLUMN player_stats_cache TEXT` |

---

## Out of Scope

- Live/in-progress stat tracking (settlement runs once at match finish, same as all other dare types)
- Shots on target, dribbles, or other stats (can be added later by extending `STAR_PLAYERS` stat options and the cache schema)
- Per-player stats visible to users before settlement (no live stats feed)
