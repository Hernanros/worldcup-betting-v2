import requests


def fetch_match_odds(api_key: str) -> dict:
    resp = requests.get(
        "https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds",
        params={"apiKey": api_key, "regions": "eu", "markets": "h2h,totals,btts", "oddsFormat": "decimal"},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    return {
        "data": data,
        "quota_remaining": int(resp.headers.get("x-requests-remaining", 0)),
    }


def extract_all_markets(event: dict) -> dict:
    markets: dict[str, list] = {}
    for bm in event.get("bookmakers", []):
        for market in bm.get("markets", []):
            key = market["key"]
            if key not in markets:
                markets[key] = market["outcomes"]
    return markets
