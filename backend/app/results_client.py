import logging
import requests
from datetime import datetime, timezone, timedelta
from typing import Optional

from app.settlement import _normalize_name

logger = logging.getLogger(__name__)

# Normalize API team names → DB team names
TEAM_NAME_MAP = {
    # Odds API uses these; DB uses the right-hand side
    "Czech Republic": "Czechia",
    "Bosnia & Herzegovina": "Bosnia & Herzegovina",
    "IR Iran": "Iran",
    "Korea Republic": "South Korea",
    "United States": "USA",
    # ESPN variants (add as discovered during tournament)
    "Czechia": "Czechia",   # ESPN already uses this ✅
}


def _normalize(name: str) -> str:
    return TEAM_NAME_MAP.get(name, name)


def fetch_espn_results() -> list[dict]:
    """Fetch finished WC matches from ESPN scoreboard (free, unofficial).
    Checks today and yesterday to catch matches that finished while the poller
    was between ticks."""
    results = []
    now = datetime.now(timezone.utc)
    for delta in [0, 1]:
        date_str = (now - timedelta(days=delta)).strftime("%Y%m%d")
        try:
            resp = requests.get(
                "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard",
                params={"dates": date_str},
                timeout=10,
            )
            resp.raise_for_status()
            for event in resp.json().get("events", []):
                comp = event.get("competitions", [{}])[0]
                status_type = comp.get("status", {}).get("type", {})
                if not status_type.get("completed"):
                    continue
                competitors = comp.get("competitors", [])
                home = next((c for c in competitors if c["homeAway"] == "home"), None)
                away = next((c for c in competitors if c["homeAway"] == "away"), None)
                if home and away:
                    results.append({
                        "home_team": _normalize(home["team"]["displayName"]),
                        "away_team": _normalize(away["team"]["displayName"]),
                        "home_score": int(home.get("score") or 0),
                        "away_score": int(away.get("score") or 0),
                        "home_red_cards": 0,
                        "away_red_cards": 0,
                        "corners": 0,
                        "espn_event_id": event["id"],
                    })
        except Exception as e:
            logger.warning("ESPN fetch failed for date %s: %s", date_str, e)
    return results


def fetch_odds_api_results(api_key: str) -> list[dict]:
    """Fetch finished WC matches from The Odds API (3-day lookback).
    Used as a fallback and catch-up mechanism — covers matches that finished
    while the server was down."""
    if not api_key:
        return []
    resp = requests.get(
        "https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/scores/",
        params={"apiKey": api_key, "daysFrom": 3},
        timeout=10,
    )
    resp.raise_for_status()
    results = []
    for f in resp.json():
        if not f.get("completed"):
            continue
        scores = f.get("scores") or []
        score_map = {s["name"]: int(s["score"]) for s in scores}
        home_score = score_map.get(f["home_team"])
        away_score = score_map.get(f["away_team"])
        if home_score is None or away_score is None:
            continue
        results.append({
            "home_team": _normalize(f["home_team"]),
            "away_team": _normalize(f["away_team"]),
            "home_score": home_score,
            "away_score": away_score,
            "home_red_cards": 0,
            "away_red_cards": 0,
            "corners": 0,
        })
    return results


def fetch_live_scores(football_api_key: str = "", odds_api_key: str = "") -> list[dict]:
    """Layered fetch: ESPN (primary) → Odds API (fallback/catch-up).
    Returns deduplicated list of finished match results.
    football_api_key kept for signature compatibility but unused."""
    seen: set[tuple[str, str]] = set()
    results: list[dict] = []

    # Layer 1: ESPN — free, live-aware, team names match our DB well
    try:
        for r in fetch_espn_results():
            key = (r["home_team"], r["away_team"])
            if key not in seen:
                seen.add(key)
                results.append(r)
                logger.debug("ESPN settled: %s %d-%d %s", r["home_team"], r["home_score"], r["away_score"], r["away_team"])
    except Exception as e:
        logger.warning("ESPN layer failed: %s", e)

    # Layer 2: Odds API — 3-day lookback, catches restarts and missed ticks
    try:
        for r in fetch_odds_api_results(odds_api_key):
            key = (r["home_team"], r["away_team"])
            if key not in seen:
                seen.add(key)
                results.append(r)
                logger.debug("OddsAPI settled: %s %d-%d %s", r["home_team"], r["home_score"], r["away_score"], r["away_team"])
    except Exception as e:
        logger.warning("Odds API layer failed: %s", e)

    return results


def fetch_top_scorer(api_key: str) -> Optional[str]:
    resp = requests.get(
        "https://v3.football.api-sports.io/players/topscorers",
        params={"league": "1", "season": "2026"},
        headers={"x-apisports-key": api_key},
        timeout=10,
    )
    resp.raise_for_status()
    response = resp.json().get("response", [])
    if response:
        p = response[0]["player"]
        return f"{p['firstname']} {p['lastname']}"
    return None


def fetch_espn_match_stats(espn_event_id: str, league_slug: str = "fifa.world") -> dict:
    """
    Fetch per-team stats from ESPN summary endpoint for a completed match.
    Returns dict ready to update Match columns.
    Falls back to zeros on any error.
    """
    base = {
        "home_yellow_cards": 0, "away_yellow_cards": 0,
        "home_corners": 0,      "away_corners": 0,
        "home_offsides": 0,     "away_offsides": 0,
        "went_to_et": False,    "went_to_pens": False,
    }
    try:
        resp = requests.get(
            f"https://site.api.espn.com/apis/site/v2/sports/soccer/{league_slug}/summary",
            params={"event": espn_event_id},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()

        # ET / pens from status
        status_name = (
            data.get("header", {})
                .get("competitions", [{}])[0]
                .get("status", {})
                .get("type", {})
                .get("name", "")
        )
        base["went_to_et"]   = status_name in ("STATUS_FINAL_AET", "STATUS_FINAL_PEN")
        base["went_to_pens"] = status_name == "STATUS_FINAL_PEN"

        # Per-team stats
        stat_map = {"yellowCards": "yellow_cards", "wonCorners": "corners", "offsides": "offsides"}
        for team_block in data.get("boxscore", {}).get("teams", []):
            side = team_block.get("homeAway", "home")   # "home" | "away"
            stats = {s["name"]: s.get("displayValue", "0") for s in team_block.get("statistics", [])}
            for espn_key, our_key in stat_map.items():
                try:
                    base[f"{side}_{our_key}"] = int(float(stats.get(espn_key, "0")))
                except (ValueError, TypeError):
                    pass
    except Exception as e:
        logger.warning("ESPN summary fetch failed for event %s: %s", espn_event_id, e)
    return base


def fetch_api_football_events(fixture_id: int, api_key: str) -> dict:
    """
    Fetch goal + substitution events from API-Football for a completed match.
    Returns own goal counts, sub_goals count, and per-player goals/assists.
    Falls back to zeros/empty on any error.
    """
    base = {"home_own_goals": 0, "away_own_goals": 0, "sub_goals": 0, "player_stats": {}}
    if not fixture_id or not api_key:
        return base
    try:
        resp = requests.get(
            "https://v3.football.api-sports.io/fixtures/events",
            params={"fixture": fixture_id},
            headers={"x-apisports-key": api_key},
            timeout=10,
        )
        resp.raise_for_status()
        events = resp.json().get("response", [])
        base["sub_goals"] = compute_sub_goals(events)

        # Own goals — API-Football uses detail="Own Goal"
        # Settlement sums home_own_goals+away_own_goals, so storing total in one field is equivalent.
        # Per-team split would require a separate /fixtures call to identify home/away teams.
        total_og = sum(
            1 for e in events
            if e.get("type") == "Goal" and e.get("detail") == "Own Goal"
        )
        base["home_own_goals"] = total_og
        base["away_own_goals"] = 0

        # Per-player goals and assists (excludes own goals)
        player_stats: dict[str, dict] = {}
        for e in events:
            if e.get("type") != "Goal" or e.get("detail") == "Own Goal":
                continue
            scorer_name = (e.get("player") or {}).get("name", "")
            if scorer_name:
                key = _normalize_name(scorer_name)
                if key not in player_stats:
                    player_stats[key] = {"goals": 0, "assists": 0}
                player_stats[key]["goals"] += 1
            assist_name = (e.get("assist") or {}).get("name", "")
            if assist_name:
                key = _normalize_name(assist_name)
                if key not in player_stats:
                    player_stats[key] = {"goals": 0, "assists": 0}
                player_stats[key]["assists"] += 1
        base["player_stats"] = player_stats

    except Exception as e:
        logger.warning("API-Football events fetch failed for fixture %s: %s", fixture_id, e)
    return base


def compute_sub_goals(events: list) -> int:
    """
    Cross-reference goal events with substitution events.
    A goal is a 'sub goal' if the scorer was subbed on before the goal minute.
    Own goals are excluded.
    """
    # Build map of (player_name, team_name) → sub_on_minute
    sub_on = {}
    for e in events:
        if e.get("type") == "subst":
            name = (e.get("player") or {}).get("name", "")
            team = (e.get("team") or {}).get("name", "")
            minute = (e.get("time") or {}).get("elapsed", 999)
            if name:
                sub_on[(name, team)] = minute

    count = 0
    for e in events:
        if e.get("type") != "Goal":
            continue
        if e.get("detail") == "Own Goal":
            continue
        name   = (e.get("player") or {}).get("name", "")
        team   = (e.get("team") or {}).get("name", "")
        minute = (e.get("time") or {}).get("elapsed", 0)
        key    = (name, team)
        if key in sub_on and sub_on[key] < minute:
            count += 1
    return count


def fetch_espn_event_id_from_scoreboard(home_team: str, away_team: str) -> Optional[str]:
    """
    Scan the current ESPN scoreboard to find the event ID for a given match.
    Used to populate espn_event_id on Match records.
    Returns None if not found.
    """
    try:
        now = datetime.now(timezone.utc)
        for delta in [0, 1]:
            date_str = (now - timedelta(days=delta)).strftime("%Y%m%d")
            resp = requests.get(
                "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard",
                params={"dates": date_str},
                timeout=10,
            )
            resp.raise_for_status()
            for event in resp.json().get("events", []):
                comp  = event.get("competitions", [{}])[0]
                comps = comp.get("competitors", [])
                h = next((c for c in comps if c["homeAway"] == "home"), None)
                a = next((c for c in comps if c["homeAway"] == "away"), None)
                if h and a:
                    h_name = _normalize(h["team"]["displayName"])
                    a_name = _normalize(a["team"]["displayName"])
                    if h_name == home_team and a_name == away_team:
                        return event["id"]
    except Exception as e:
        logger.warning("ESPN event ID lookup failed: %s", e)
    return None
