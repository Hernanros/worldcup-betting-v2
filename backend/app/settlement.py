from app.bravery import apply_streak_bonus


def settle_bet(stake: int, odds: float, won: bool) -> int:
    return int(stake * odds) if won else 0


def settle_challenge_issuer(stake: int, odds: float, streak: int, won: bool) -> tuple[int, int]:
    if not won:
        return 0, 0
    payout = int(stake * odds)
    bonus = apply_streak_bonus(payout, streak)
    return payout, bonus


def settle_challenge_acceptor(stake: int, odds: float, won: bool) -> int:
    return int(stake * odds) if won else 0


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
