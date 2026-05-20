VOLUME_MILESTONES = [
    (5, 50, 1),
    (10, 150, 2),
    (20, 400, 3),
]


def streak_bonus_pct(streak: int) -> float:
    if streak >= 5:
        return 0.35
    if streak == 4:
        return 0.20
    if streak == 3:
        return 0.10
    return 0.0


def check_volume_milestone(current_total: int, current_milestone: int) -> tuple[int, int]:
    for threshold, bonus, level in VOLUME_MILESTONES:
        if current_total >= threshold and current_milestone < level:
            return bonus, level
    return 0, current_milestone


def apply_streak_bonus(winnings: int, streak: int) -> int:
    return int(winnings * streak_bonus_pct(streak))
