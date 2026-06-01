import logging
import requests
from datetime import datetime, timezone, timedelta

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


def fetch_top_scorer(api_key: str) -> str | None:
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
