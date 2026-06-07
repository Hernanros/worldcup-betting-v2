import json
import unicodedata

from app.bravery import apply_streak_bonus


def settle_bet(stake: int, odds: float, won: bool) -> int:
    return int(stake * odds) if won else 0


def settle_challenge_issuer(stake: int, odds: float, streak: int, won: bool) -> tuple[int, int]:
    if not won:
        return 0, 0
    payout = int(stake * odds)
    bonus = apply_streak_bonus(payout, streak)
    return payout, bonus


def settle_challenge_acceptor(stake: int, odds: float, streak: int, won: bool) -> tuple[int, int]:
    """Mirror settle_challenge_issuer — returns (payout, streak_bonus)."""
    if not won:
        return 0, 0
    payout = int(stake * odds)
    bonus = apply_streak_bonus(payout, streak)
    return payout, bonus


def determine_h2h_winner(home_team: str, away_team: str, home_score: int, away_score: int) -> str:
    if home_score > away_score:
        return home_team
    if away_score > home_score:
        return away_team
    return "Draw"


def determine_correct_score_winner(selection: str, home_score: int, away_score: int) -> bool:
    try:
        h, a = selection.split("-")
        return int(h) == home_score and int(a) == away_score
    except (ValueError, AttributeError):
        return False


def determine_totals_winner(selection: str, actual_value: int) -> bool:
    parts = selection.split()
    if len(parts) != 2:
        return False
    direction, threshold = parts[0].lower(), float(parts[1])
    if direction == "over":
        return actual_value > threshold
    if direction == "under":
        return actual_value < threshold
    return False


def determine_btts_winner(selection: str, home_score: int, away_score: int) -> bool:
    both_scored = home_score > 0 and away_score > 0
    return (selection == "Yes") == both_scored


def determine_handicap_winner(selection: str, home_team: str, home_score: int, away_score: int) -> bool:
    """Asian handicap.  Format: "{team} {+/-N}"  e.g. 'England -2.5' or 'Japan +0.5'.
    The handicap adjusts that team's score; they win if their adjusted score
    exceeds the opponent's score (no draw possible with .5 lines)."""
    try:
        *team_parts, hdcp_str = selection.split()
        team = " ".join(team_parts)
        handicap = float(hdcp_str)
    except (ValueError, IndexError):
        return False
    if team == home_team:
        return (home_score + handicap) > away_score
    else:
        return (away_score + handicap) > home_score


# ── Player H2H helpers ────────────────────────────────────────────────────────

def _normalize_name(name: str) -> str:
    """Lowercase + strip accents: 'L. Mbappé' → 'l. mbappe'."""
    nfd = unicodedata.normalize("NFKD", name)
    return "".join(c for c in nfd if not unicodedata.combining(c)).lower().strip()


def _find_player_in_cache(name: str, cache: dict) -> dict | None:
    """Return the stat dict for `name` from `cache`, or None if not found.

    Normalises both the lookup name and all cache keys so mixed-case keys
    (e.g. from admin overrides) are handled correctly. Tries exact match first,
    then substring containment for API-Football abbreviations ('L. Messi' vs 'Messi').
    """
    norm = _normalize_name(name)
    normalized_cache = {_normalize_name(k): v for k, v in cache.items()}
    if norm in normalized_cache:
        return normalized_cache[norm]
    for key in normalized_cache:
        if norm in key or key in norm:
            return normalized_cache[key]
    return None


def determine_player_h2h_winner(
    issuer_sel: str,
    acceptor_sel: str,
    player_stats_cache: str | None,
) -> str:
    """Determine who wins a player H2H dare.

    issuer_sel / acceptor_sel format: "{player_name} {stat}"
    where stat is "goals" or "assists".

    Returns:
        "issuer"   — issuer's player has more of the stat
        "acceptor" — acceptor's player has more
        "void"     — tie, missing cache, player not found, or parse failure
    """
    try:
        issuer_parts = issuer_sel.rsplit(" ", 1)
        acceptor_parts = acceptor_sel.rsplit(" ", 1)
        if len(issuer_parts) != 2 or len(acceptor_parts) != 2:
            return "void"
        issuer_player, issuer_stat = issuer_parts
        acceptor_player, acceptor_stat = acceptor_parts
        if issuer_stat.lower() != acceptor_stat.lower():
            return "void"
        stat = issuer_stat.lower()
        if stat not in ("goals", "assists"):
            return "void"

        if player_stats_cache is None:
            return "void"

        cache = json.loads(player_stats_cache)
        issuer_entry = _find_player_in_cache(issuer_player, cache)
        acceptor_entry = _find_player_in_cache(acceptor_player, cache)

        if issuer_entry is None or acceptor_entry is None:
            return "void"

        issuer_count = issuer_entry.get(stat, 0)
        acceptor_count = acceptor_entry.get(stat, 0)

        if issuer_count > acceptor_count:
            return "issuer"
        if acceptor_count > issuer_count:
            return "acceptor"
        return "void"
    except (json.JSONDecodeError, TypeError, AttributeError):
        return "void"
