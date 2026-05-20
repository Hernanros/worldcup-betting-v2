import requests


def fetch_live_scores(api_key: str) -> list[dict]:
    resp = requests.get(
        "https://v3.football.api-sports.io/fixtures",
        params={"league": "1", "season": "2026", "status": "FT"},
        headers={"x-apisports-key": api_key},
        timeout=10,
    )
    resp.raise_for_status()
    fixtures = resp.json().get("response", [])
    results = []
    for f in fixtures:
        results.append({
            "home_team": f["teams"]["home"]["name"],
            "away_team": f["teams"]["away"]["name"],
            "home_score": f["goals"]["home"],
            "away_score": f["goals"]["away"],
            "home_red_cards": sum(
                1 for e in f.get("events", [])
                if e.get("type") == "Card" and e.get("detail") == "Red Card"
                and e["team"]["id"] == f["teams"]["home"]["id"]
            ),
            "away_red_cards": sum(
                1 for e in f.get("events", [])
                if e.get("type") == "Card" and e.get("detail") == "Red Card"
                and e["team"]["id"] == f["teams"]["away"]["id"]
            ),
            "corners": 0,
        })
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
