from app.settlement import (
    settle_bet,
    determine_h2h_winner,
    determine_correct_score_winner,
    determine_totals_winner,
    determine_btts_winner,
    settle_challenge_issuer,
    settle_challenge_acceptor,
)


def test_settle_bet_win():
    assert settle_bet(stake=100, odds=2.5, won=True) == 250


def test_settle_bet_loss():
    assert settle_bet(stake=100, odds=2.5, won=False) == 0


def test_h2h_home_win():
    assert determine_h2h_winner("Argentina", 2, 1) == "Argentina"


def test_h2h_away_win():
    assert determine_h2h_winner("Argentina", 0, 1) == "Away"


def test_h2h_draw():
    assert determine_h2h_winner("Argentina", 1, 1) == "Draw"


def test_correct_score_match():
    assert determine_correct_score_winner("2-1", 2, 1) is True


def test_correct_score_no_match():
    assert determine_correct_score_winner("2-1", 1, 0) is False


def test_totals_over():
    assert determine_totals_winner("Over 2.5", 3) is True
    assert determine_totals_winner("Over 2.5", 2) is False


def test_totals_under():
    assert determine_totals_winner("Under 2.5", 2) is True
    assert determine_totals_winner("Under 2.5", 3) is False


def test_btts_yes():
    assert determine_btts_winner("Yes", 1, 1) is True
    assert determine_btts_winner("Yes", 1, 0) is False


def test_btts_no():
    assert determine_btts_winner("No", 1, 0) is True
    assert determine_btts_winner("No", 1, 1) is False


def test_settle_challenge_issuer_win_with_streak():
    payout, bonus = settle_challenge_issuer(stake=100, odds=2.0, streak=3, won=True)
    assert payout == 200
    assert bonus == 20  # 10% of 200


def test_settle_challenge_issuer_loss():
    payout, bonus = settle_challenge_issuer(stake=100, odds=2.0, streak=5, won=False)
    assert payout == 0
    assert bonus == 0


def test_settle_challenge_acceptor_win():
    assert settle_challenge_acceptor(stake=150, odds=1.5, won=True) == 225


def test_settle_challenge_acceptor_loss():
    assert settle_challenge_acceptor(stake=150, odds=1.5, won=False) == 0
