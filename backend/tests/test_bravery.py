from app.bravery import streak_bonus_pct, check_volume_milestone, apply_streak_bonus


def test_streak_bonus_zero_for_one_two():
    assert streak_bonus_pct(0) == 0.0
    assert streak_bonus_pct(1) == 0.0
    assert streak_bonus_pct(2) == 0.0


def test_streak_bonus_three():
    assert streak_bonus_pct(3) == 0.10


def test_streak_bonus_four():
    assert streak_bonus_pct(4) == 0.20


def test_streak_bonus_five_plus():
    assert streak_bonus_pct(5) == 0.35
    assert streak_bonus_pct(10) == 0.35


def test_volume_milestone_no_crossing():
    bonus, level = check_volume_milestone(3, 0)
    assert bonus == 0
    assert level == 0


def test_volume_milestone_crosses_5():
    bonus, level = check_volume_milestone(5, 0)
    assert bonus == 50
    assert level == 1


def test_volume_milestone_crosses_10():
    bonus, level = check_volume_milestone(10, 1)
    assert bonus == 150
    assert level == 2


def test_volume_milestone_crosses_20():
    bonus, level = check_volume_milestone(20, 2)
    assert bonus == 400
    assert level == 3


def test_volume_milestone_already_reached():
    bonus, level = check_volume_milestone(20, 3)
    assert bonus == 0
    assert level == 3


def test_apply_streak_bonus():
    assert apply_streak_bonus(1000, 3) == 100
    assert apply_streak_bonus(1000, 4) == 200
    assert apply_streak_bonus(1000, 5) == 350
    assert apply_streak_bonus(1000, 0) == 0
