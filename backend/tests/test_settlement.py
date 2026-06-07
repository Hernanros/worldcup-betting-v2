from app.settlement import (
    settle_bet,
    determine_h2h_winner,
    determine_correct_score_winner,
    determine_totals_winner,
    determine_btts_winner,
    determine_handicap_winner,
    settle_challenge_issuer,
    settle_challenge_acceptor,
)


def test_settle_bet_win():
    assert settle_bet(stake=100, odds=2.5, won=True) == 250


def test_settle_bet_loss():
    assert settle_bet(stake=100, odds=2.5, won=False) == 0


def test_h2h_home_win():
    assert determine_h2h_winner("Argentina", "Brazil", 2, 1) == "Argentina"


def test_h2h_away_win():
    assert determine_h2h_winner("Argentina", "Brazil", 0, 1) == "Brazil"


def test_h2h_draw():
    assert determine_h2h_winner("Argentina", "Brazil", 1, 1) == "Draw"


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


def test_settle_challenge_acceptor_win_no_streak():
    payout, bonus = settle_challenge_acceptor(stake=150, odds=1.5, streak=0, won=True)
    assert payout == 225
    assert bonus == 0


def test_settle_challenge_acceptor_win_with_streak():
    payout, bonus = settle_challenge_acceptor(stake=150, odds=1.5, streak=3, won=True)
    assert payout == 225
    assert bonus == 22   # 10% of 225 = 22 (int truncation)


def test_settle_challenge_acceptor_loss():
    payout, bonus = settle_challenge_acceptor(stake=150, odds=1.5, streak=5, won=False)
    assert payout == 0
    assert bonus == 0


# ── handicap ──────────────────────────────────────────────────────────────────

def test_handicap_home_negative_wins():
    # England -2.5: 6 - 2.5 = 3.5 > 2 → True
    assert determine_handicap_winner("England -2.5", "England", 6, 2) is True


def test_handicap_home_negative_loses():
    # England -2.5: 2 - 2.5 = -0.5 < 1 → False
    assert determine_handicap_winner("England -2.5", "England", 2, 1) is False


def test_handicap_away_positive_wins():
    # Saudi Arabia +1.5 (away): 2 + 1.5 = 3.5 > 1 → True
    assert determine_handicap_winner("Saudi Arabia +1.5", "Argentina", 1, 2) is True


def test_handicap_away_positive_loses():
    # Japan +0.5 (away): 0 + 0.5 = 0.5, not > 2 → False
    assert determine_handicap_winner("Japan +0.5", "Germany", 2, 0) is False


def test_handicap_bad_format_returns_false():
    assert determine_handicap_winner("NoHandicap", "Argentina", 1, 0) is False
    assert determine_handicap_winner("", "Argentina", 1, 0) is False


from app.settlement import _normalize_name, _find_player_in_cache, determine_player_h2h_winner


def test_normalize_strips_accents_and_lowercases():
    assert _normalize_name("Mbappé") == "mbappe"
    assert _normalize_name("L. Messi") == "l. messi"
    assert _normalize_name("Di María") == "di maria"
    assert _normalize_name("  KANE  ") == "kane"


def test_find_player_exact_match():
    cache = {"messi": {"goals": 2, "assists": 0}}
    assert _find_player_in_cache("Messi", cache) == {"goals": 2, "assists": 0}


def test_find_player_abbreviated_api_name():
    # API-Football returns "L. Messi"; chip stores "Messi"
    cache = {"l. messi": {"goals": 2, "assists": 0}}
    assert _find_player_in_cache("Messi", cache) == {"goals": 2, "assists": 0}


def test_find_player_not_found_returns_none():
    cache = {"neymar": {"goals": 1, "assists": 0}}
    assert _find_player_in_cache("Messi", cache) is None


def test_determine_h2h_issuer_wins_on_goals():
    cache_json = '{"messi": {"goals": 2, "assists": 0}, "mbappe": {"goals": 0, "assists": 1}}'
    assert determine_player_h2h_winner("Messi goals", "Mbappé goals", cache_json) == "issuer"


def test_determine_h2h_acceptor_wins_on_goals():
    cache_json = '{"messi": {"goals": 0, "assists": 0}, "mbappe": {"goals": 1, "assists": 0}}'
    assert determine_player_h2h_winner("Messi goals", "Mbappé goals", cache_json) == "acceptor"


def test_determine_h2h_tie_returns_void():
    cache_json = '{"messi": {"goals": 1, "assists": 0}, "mbappe": {"goals": 1, "assists": 0}}'
    assert determine_player_h2h_winner("Messi goals", "Mbappé goals", cache_json) == "void"


def test_determine_h2h_null_cache_returns_void():
    assert determine_player_h2h_winner("Messi goals", "Mbappé goals", None) == "void"


def test_determine_h2h_missing_player_returns_void():
    cache_json = '{"messi": {"goals": 1, "assists": 0}}'  # mbappe missing
    assert determine_player_h2h_winner("Messi goals", "Mbappé goals", cache_json) == "void"


def test_determine_h2h_assists_stat():
    cache_json = '{"messi": {"goals": 0, "assists": 2}, "mbappe": {"goals": 1, "assists": 0}}'
    assert determine_player_h2h_winner("Messi assists", "Mbappé assists", cache_json) == "issuer"


def test_determine_h2h_abbreviated_api_name_in_cache():
    # API-Football gave us "l. messi" as the key; chip stored "Messi"
    cache_json = '{"l. messi": {"goals": 3, "assists": 0}, "k. mbappe": {"goals": 1, "assists": 0}}'
    assert determine_player_h2h_winner("Messi goals", "Mbappé goals", cache_json) == "issuer"
