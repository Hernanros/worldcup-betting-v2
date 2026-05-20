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


def determine_h2h_winner(home_team: str, home_score: int, away_score: int) -> str:
    if home_score > away_score:
        return home_team
    if away_score > home_score:
        return "Away"
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
