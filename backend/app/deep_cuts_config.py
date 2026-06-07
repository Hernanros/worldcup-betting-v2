"""
Deep Cuts market configuration.
All 22 markets across 7 stages. Adding a new market = add one dict entry here.
"""
from datetime import datetime, timezone
from typing import Optional

# ── Stage → DB round value mapping ──────────────────────────────────────────
STAGE_ROUNDS = {
    "tournament":  None,        # all rounds (for Most Exhausted Player)
    "group_stage": "group",
    "r32":         "r32",
    "r16":         "r16",
    "qf":          "qf",
    "sf":          "sf",
    "final":       "final",
}

# ⚠️ Estimated group compositions — verify against official FIFA draw before Jun 11, 2026
# ── WC 2026 group compositions (A–L, 48 group stage teams) ─────────────────
WC2026_GROUPS = {
    "A": ["Mexico", "Jamaica", "Venezuela", "Ecuador"],
    "B": ["USA", "Panama", "Costa Rica", "New Zealand"],
    "C": ["Morocco", "Belgium", "Canada", "Honduras"],
    "D": ["Brazil", "Croatia", "Japan", "Paraguay"],
    "E": ["Argentina", "Chile", "Australia", "Poland"],
    "F": ["Spain", "Portugal", "Egypt", "Algeria"],
    "G": ["France", "Nigeria", "DR Congo", "Slovenia"],
    "H": ["Germany", "Netherlands", "South Korea", "Iran"],
    "I": ["England", "Senegal", "Tunisia", "South Africa"],
    "J": ["Colombia", "Uruguay", "El Salvador", "Bolivia"],
    "K": ["Turkey", "Ukraine", "Saudi Arabia", "Ghana"],
    "L": ["Ivory Coast", "Norway", "Switzerland", "Czechia"],
}

ALL_GROUP_TEAMS = [t for teams in WC2026_GROUPS.values() for t in teams]

def get_stage_lock_time(stage: str, db) -> Optional[datetime]:
    """
    Returns the lock time for a stage.
    Group stage: hardcoded to first WC kickoff.
    All other stages: MIN(kickoff_time) for matches in that round.
    db may be None for group_stage (hardcoded).
    """
    if stage == "group_stage":
        return datetime(2026, 6, 11, 18, 0, 0, tzinfo=timezone.utc)
    # For all other stages, caller must provide db and query MIN kickoff.
    # See deep_cuts_settlement.get_stage_lock_time_from_db()
    return None

# ── Market definitions ───────────────────────────────────────────────────────
# Fields:
#   stage:   which stage this market belongs to (key in STAGE_ROUNDS)
#   label:   display label (emoji + name)
#   type:    "team_pick" | "over_under" | "exact_count" | "yes_no" |
#            "group_advance" | "text_pick"
#   settle:  settlement strategy key (used by deep_cuts_settlement.py)
#   pool:    (team_pick only) "all_group_teams" | "r32_teams" | "r16_teams" | "qf_teams" | "sf_teams"
#   lines:   (over_under only) list of {name, odds}
#   options: (exact_count only) list of int
#   default_odds: (team_pick / text_pick) fallback odds
#   field:   (sum_field settle) e.g. "home_corners+away_corners"
#   group:   (group_advance only) group letter A–L

DEEP_CUTS_MARKETS: dict[str, dict] = {

    # ── TOURNAMENT (lock Jun 11, settle after Final) ─────────────────────────
    "most_exhausted": {
        "stage":        "tournament",
        "label":        "😴 Most Exhausted Player",
        "description":  "Player with the most total minutes played across the entire tournament.",
        "type":         "text_pick",
        "settle":       "most_exhausted",
        "default_odds": 50.0,
    },

    # ── GROUP STAGE ──────────────────────────────────────────────────────────
    **{
        f"group_advance_{g}": {
            "stage":       "group_stage",
            "label":       f"📋 Group {g} Advancement",
            "description": f"Pick 2 teams from Group {g} that advance to the Round of 32.",
            "type":        "group_advance",
            "settle":      "group_advance",
            "group":       g,
            "teams":       WC2026_GROUPS[g],
            "default_odds": 32.0,
        }
        for g in "ABCDEFGHIJKL"
    },
    "best_group_team": {
        "stage":        "group_stage",
        "label":        "🏅 Best Group Stage Team",
        "description":  "Pick the team with the best group stage record (points → GD → GS → −RC → −YC).",
        "type":         "team_pick",
        "settle":       "best_group_team",
        "pool":         "all_group_teams",
        "default_odds": 48.0,
    },
    "total_corners": {
        "stage":       "group_stage",
        "label":       "🔺 Total Corners (Group Stage)",
        "description": "Total corner kicks across all 48 group stage matches.",
        "type":        "over_under",
        "settle":      "sum_field",
        "field":       "home_corners+away_corners",
        "lines": [
            {"name": "Over 474.5",  "odds": 1.90},
            {"name": "Under 474.5", "odds": 1.90},
        ],
    },
    "total_offsides": {
        "stage":       "group_stage",
        "label":       "🎯 Total Offsides (Group Stage)",
        "description": "Total offside calls across all 48 group stage matches.",
        "type":        "over_under",
        "settle":      "sum_field",
        "field":       "home_offsides+away_offsides",
        "lines": [
            {"name": "Over 139.5",  "odds": 1.90},
            {"name": "Under 139.5", "odds": 1.90},
        ],
    },
    "own_goals": {
        "stage":       "group_stage",
        "label":       "🤦 Own Goals (Group Stage)",
        "description": "Total own goals across all 48 group stage matches.",
        "type":        "over_under",
        "settle":      "sum_field",
        "field":       "home_own_goals+away_own_goals",
        "lines": [
            {"name": "Over 2.5",  "odds": 1.85},
            {"name": "Under 2.5", "odds": 1.95},
        ],
    },

    # ── ROUND OF 32 ──────────────────────────────────────────────────────────
    "r32_top_scorer": {
        "stage":        "r32",
        "label":        "⚽ Top Scorer Team (R32)",
        "description":  "Pick the team that scores the most goals across all Round of 32 matches.",
        "type":         "team_pick",
        "settle":       "top_goals_team",
        "pool":         "r32_teams",
        "default_odds": 32.0,
    },
    "r32_most_violent": {
        "stage":        "r32",
        "label":        "🟥 Most Violent Team (R32)",
        "description":  "Pick the team with the most red cards in the Round of 32.",
        "type":         "team_pick",
        "settle":       "top_red_cards_team",
        "pool":         "r32_teams",
        "default_odds": 32.0,
    },
    "r32_extra_time": {
        "stage":   "r32",
        "label":   "⏱️ Extra Time Matches (R32)",
        "description": "How many Round of 32 matches go to extra time?",
        "type":    "exact_count",
        "settle":  "count_went_to_et",
        "options": [0, 1, 2, 3, 4, 5],
        # Calibrated to ~108% overround (Binomial n=16, p=0.25 ET rate).
        # Old odds [8,3.5,2.5,3,5,10] had 144% overround — corrected.
        "odds":    [75.0, 15.0, 5.5, 3.5, 3.3, 4.3],
    },
    "r32_yellow_cards": {
        "stage":       "r32",
        "label":       "🟡 Yellow Card Fest (R32)",
        "description": "Total yellow cards across all 16 Round of 32 matches.",
        "type":        "over_under",
        "settle":      "sum_field",
        "field":       "home_yellow_cards+away_yellow_cards",
        "lines": [
            {"name": "Over 49.5",  "odds": 1.90},
            {"name": "Under 49.5", "odds": 1.90},
        ],
    },
    "r32_clean_sheet": {
        "stage":        "r32",
        "label":        "💀 Clean Sheet Race (R32)",
        "description":  "Pick the team that concedes the fewest goals in the Round of 32 (min 1 match played).",
        "type":         "team_pick",
        "settle":       "min_conceded_team",
        "pool":         "r32_teams",
        "default_odds": 32.0,
    },

    # ── ROUND OF 16 ──────────────────────────────────────────────────────────
    "r16_pen_shootouts": {
        "stage":       "r16",
        "label":       "🥅 Penalty Shootouts (R16)",
        "description": "How many Round of 16 matches are decided by a penalty shootout?",
        "type":        "exact_count",
        "settle":      "count_went_to_pens",
        "options":     [0, 1, 2, 3, 4],
        # Calibrated to ~107% overround (Binomial n=8, p=0.25 pen rate).
        # Old odds [3,2.5,3,5,10] had 137% overround — corrected.
        "odds":        [9.0, 3.4, 2.9, 4.4, 10.5],
    },
    "r16_total_goals": {
        "stage":       "r16",
        "label":       "🌙 Total R16 Goals",
        "description": "Total goals scored across all 8 Round of 16 matches.",
        "type":        "over_under",
        "settle":      "sum_field",
        "field":       "home_score+away_score",
        "lines": [
            {"name": "Over 19.5",  "odds": 1.90},
            {"name": "Under 19.5", "odds": 1.90},
        ],
    },
    "r16_most_leaky": {
        "stage":        "r16",
        "label":        "🛡️ Most Leaky Defense (R16)",
        "description":  "Pick the team that concedes the most goals in the Round of 16.",
        "type":         "team_pick",
        "settle":       "max_conceded_team",
        "pool":         "r16_teams",
        "default_odds": 16.0,
    },
    "r16_corner_machine": {
        "stage":        "r16",
        "label":        "🔺 Corner Machine (R16)",
        "description":  "Pick the team that wins the most corner kicks across their R16 match(es).",
        "type":         "team_pick",
        "settle":       "top_corners_team",
        "pool":         "r16_teams",
        "default_odds": 16.0,
    },
    "r16_high_scoring": {
        "stage":       "r16",
        "label":       "💥 High-Scoring Games (R16)",
        "description": "How many Round of 16 matches have 3 or more total goals?",
        "type":        "over_under",
        "settle":      "count_high_scoring",
        "threshold":   3,
        "lines": [
            {"name": "Over 2.5",  "odds": 1.90},
            {"name": "Under 2.5", "odds": 1.90},
        ],
    },

    # ── QUARTER-FINALS ───────────────────────────────────────────────────────
    "qf_pen_shootouts": {
        "stage":       "qf",
        "label":       "🥅 QF Penalty Shootouts",
        "description": "How many Quarter-Final matches are decided by a penalty shootout?",
        "type":        "exact_count",
        "settle":      "count_went_to_pens",
        "options":     [0, 1, 2],
        "odds":        [2.5, 2.5, 4.0],
    },
    "qf_sub_goals": {
        "stage":       "qf",
        "label":       "🎭 Goals by Substitutes (QF)",
        "description": "Total goals scored by substitute players across all 4 Quarter-Final matches.",
        "type":        "over_under",
        "settle":      "sum_field",
        "field":       "sub_goals",
        "lines": [
            {"name": "Over 2.5",  "odds": 1.90},
            {"name": "Under 2.5", "odds": 1.90},
        ],
    },
    "qf_total_goals": {
        "stage":       "qf",
        "label":       "🌟 Total QF Goals",
        "description": "Total goals scored across all 4 Quarter-Final matches.",
        "type":        "over_under",
        "settle":      "sum_field",
        "field":       "home_score+away_score",
        "lines": [
            {"name": "Over 8.5",  "odds": 1.90},
            {"name": "Under 8.5", "odds": 1.90},
        ],
    },

    # ── SEMI-FINALS ──────────────────────────────────────────────────────────
    "sf_any_et": {
        "stage":       "sf",
        "label":       "⏱️ Any SF to Extra Time",
        "description": "Will either Semi-Final go to extra time?",
        "type":        "yes_no",
        "settle":      "any_went_to_et",
        "odds":        {"yes": 2.20, "no": 1.65},
    },
    "sf_red_card_drama": {
        "stage":       "sf",
        "label":       "🟥 SF Red Card Drama",
        "description": "Total red cards across both Semi-Final matches.",
        "type":        "exact_count",
        "settle":      "count_field",
        "field":       "home_red_cards+away_red_cards",
        "options":     [0, 1, 2],
        "odds":        [2.0, 2.5, 5.0],
    },

    # ── FINAL ────────────────────────────────────────────────────────────────
    "final_to_pens": {
        "stage":  "final",
        "label":  "🥅 Final Goes to Penalties",
        "description": "Will the Final be decided by a penalty shootout?",
        "type":   "yes_no",
        "settle": "any_went_to_pens",
        "odds":   {"yes": 3.50, "no": 1.30},
    },
    "final_total_goals": {
        "stage":       "final",
        "label":       "🔥 Total Final Goals",
        "description": "Total goals scored in the Final (90 min + ET, not counting penalty shootout).",
        "type":        "over_under",
        "settle":      "sum_field",
        "field":       "home_score+away_score",
        "lines": [
            {"name": "Over 1.5",  "odds": 1.65},
            {"name": "Under 1.5", "odds": 2.20},
        ],
    },
}

# ── Convenience: markets grouped by stage ───────────────────────────────────
def markets_for_stage(stage: str) -> dict[str, dict]:
    return {k: v for k, v in DEEP_CUTS_MARKETS.items() if v["stage"] == stage}
