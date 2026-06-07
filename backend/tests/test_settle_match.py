"""
Integration tests for the match-resolution pipeline (poller.settle_match).

Each test calls settle_match() directly on an in-memory SQLite DB and
asserts the exact DB state afterwards. No HTTP layer is involved.

Coverage map
────────────
Match state       : status → finished, scores stored
Bets              : 1x2 (home/away/draw), btts, totals, correct_score,
                    corners, yellow_cards, red_cards, handicap
Challenges        : issuer wins, acceptor wins, streak bonus, streak reset,
                    open (unaccepted) challenges skipped
Predictions       : correct_score (+3), correct_outcome (+1), wrong (0)
Bracket           : winner propagated to next match (home + away slots)
"""
from sqlalchemy import select
from app.models import Player, Match, Bet, Challenge, Prediction
from app.poller import settle_match
from tests.conftest import make_match, make_player


# ─────────────────────────────────────────────────────────────────────────────
# Shared helpers
# ─────────────────────────────────────────────────────────────────────────────

def _result(home, away, *, reds_h=0, reds_a=0, corners=5, yellows=3):
    return dict(home_score=home, away_score=away,
                home_red_cards=reds_h, away_red_cards=reds_a,
                corners=corners, yellow_cards=yellows)


async def _bet(db, player, match, bet_type, selection, stake=100, odds=2.0):
    player.token_balance -= stake
    b = Bet(player_id=player.id, match_id=match.id,
            bet_type=bet_type, selection=selection,
            stake=stake, odds_at_placement=odds, status="pending")
    db.add(b)
    await db.commit()
    await db.refresh(b)
    return b


async def _challenge(db, issuer, acceptor, match, bet_type, isel, asel,
                     istake=100, iodds=2.0, aodds=2.0, streak_pct=0.0):
    astake = max(1, round(istake * (iodds / aodds)))
    issuer.token_balance  -= istake
    acceptor.token_balance -= astake
    ch = Challenge(
        issuer_id=issuer.id, acceptor_id=acceptor.id, match_id=match.id,
        bet_type=bet_type, selection=isel, acceptor_selection=asel,
        issuer_stake=istake, acceptor_stake=astake,
        issuer_odds=iodds, acceptor_odds=aodds,
        status="accepted", bravery_streak_bonus_pct=streak_pct,
    )
    db.add(ch)
    await db.commit()
    await db.refresh(ch)
    return ch


async def _prediction(db, player, match, home_pred, away_pred):
    pred = Prediction(player_id=player.id, match_id=match.id,
                      home_score_pred=home_pred, away_score_pred=away_pred)
    db.add(pred)
    await db.commit()
    await db.refresh(pred)
    return pred


# ─────────────────────────────────────────────────────────────────────────────
# Match state
# ─────────────────────────────────────────────────────────────────────────────

async def test_settle_sets_status_to_finished(db):
    m = await make_match(db)
    await settle_match(db, m, _result(2, 1))
    await db.refresh(m)
    assert m.status == "finished"


async def test_settle_stores_scores(db):
    m = await make_match(db)
    await settle_match(db, m, _result(3, 0, reds_h=0, reds_a=1, corners=7, yellows=4))
    await db.refresh(m)
    assert m.home_score == 3
    assert m.away_score == 0
    assert m.away_red_cards == 1
    assert m.corners == 7


# ─────────────────────────────────────────────────────────────────────────────
# Bets — 1x2
# ─────────────────────────────────────────────────────────────────────────────

async def test_1x2_home_win_pays_out(db):
    """Home team wins → correct 1x2 bet credited."""
    m = await make_match(db, home="Argentina", away="Brazil")
    alice = await make_player(db, "Alice")
    await _bet(db, alice, m, "1x2", "Argentina", stake=100, odds=2.5)
    start = alice.token_balance
    await settle_match(db, m, _result(2, 0))
    await db.refresh(alice)
    assert alice.token_balance == start + 250   # 100 × 2.5


async def test_1x2_away_win_pays_out(db):
    """Away team wins — selection must be the away team name, not the literal 'Away'."""
    m = await make_match(db, home="Argentina", away="Brazil")
    alice = await make_player(db, "Alice")
    await _bet(db, alice, m, "1x2", "Brazil", stake=100, odds=4.0)
    start = alice.token_balance
    await settle_match(db, m, _result(0, 1))
    await db.refresh(alice)
    assert alice.token_balance == start + 400


async def test_1x2_draw_pays_out(db):
    m = await make_match(db, home="Argentina", away="Brazil")
    alice = await make_player(db, "Alice")
    await _bet(db, alice, m, "1x2", "Draw", stake=100, odds=3.2)
    start = alice.token_balance
    await settle_match(db, m, _result(1, 1))
    await db.refresh(alice)
    assert alice.token_balance == start + 320


async def test_1x2_losing_bet_returns_nothing(db):
    m = await make_match(db, home="Argentina", away="Brazil")
    alice = await make_player(db, "Alice")
    await _bet(db, alice, m, "1x2", "Argentina", stake=100, odds=2.5)
    start = alice.token_balance
    await settle_match(db, m, _result(0, 1))  # Brazil wins
    await db.refresh(alice)
    assert alice.token_balance == start        # no credit


async def test_1x2_bet_status_updated(db):
    m = await make_match(db, home="Argentina", away="Brazil")
    alice = await make_player(db, "Alice")
    bet = await _bet(db, alice, m, "1x2", "Argentina", stake=100, odds=2.0)
    await settle_match(db, m, _result(2, 0))
    await db.refresh(bet)
    assert bet.status == "won"


async def test_1x2_losing_bet_status_updated(db):
    m = await make_match(db, home="Argentina", away="Brazil")
    alice = await make_player(db, "Alice")
    bet = await _bet(db, alice, m, "1x2", "Argentina", stake=100, odds=2.0)
    await settle_match(db, m, _result(0, 2))
    await db.refresh(bet)
    assert bet.status == "lost"


# ─────────────────────────────────────────────────────────────────────────────
# Bets — other types
# ─────────────────────────────────────────────────────────────────────────────

async def test_btts_yes_wins_when_both_score(db):
    m = await make_match(db)
    alice = await make_player(db, "Alice")
    await _bet(db, alice, m, "btts", "Yes", stake=100, odds=1.8)
    start = alice.token_balance
    await settle_match(db, m, _result(2, 1))  # both scored
    await db.refresh(alice)
    assert alice.token_balance == start + 180


async def test_btts_yes_loses_when_clean_sheet(db):
    m = await make_match(db)
    alice = await make_player(db, "Alice")
    await _bet(db, alice, m, "btts", "Yes", stake=100, odds=1.8)
    start = alice.token_balance
    await settle_match(db, m, _result(3, 0))  # only one side scored
    await db.refresh(alice)
    assert alice.token_balance == start


async def test_btts_no_wins_when_clean_sheet(db):
    m = await make_match(db)
    alice = await make_player(db, "Alice")
    await _bet(db, alice, m, "btts", "No", stake=100, odds=3.5)
    start = alice.token_balance
    await settle_match(db, m, _result(1, 0))
    await db.refresh(alice)
    assert alice.token_balance == start + 350


async def test_totals_over_wins(db):
    m = await make_match(db)
    alice = await make_player(db, "Alice")
    await _bet(db, alice, m, "totals", "Over 2.5", stake=100, odds=1.9)
    start = alice.token_balance
    await settle_match(db, m, _result(2, 1))  # 3 goals > 2.5
    await db.refresh(alice)
    assert alice.token_balance == start + 190


async def test_totals_under_wins(db):
    m = await make_match(db)
    alice = await make_player(db, "Alice")
    await _bet(db, alice, m, "totals", "Under 2.5", stake=100, odds=1.9)
    start = alice.token_balance
    await settle_match(db, m, _result(1, 1))  # 2 goals < 2.5
    await db.refresh(alice)
    assert alice.token_balance == start + 190


async def test_totals_over_loses_on_exact_line(db):
    """2.5-line: exactly 2 goals → Under wins."""
    m = await make_match(db)
    alice = await make_player(db, "Alice")
    await _bet(db, alice, m, "totals", "Over 2.5", stake=100, odds=1.9)
    start = alice.token_balance
    await settle_match(db, m, _result(1, 1))  # exactly 2 — under the line
    await db.refresh(alice)
    assert alice.token_balance == start       # no payout


async def test_correct_score_exact_match_wins(db):
    m = await make_match(db)
    alice = await make_player(db, "Alice")
    await _bet(db, alice, m, "correct_score", "3-1", stake=50, odds=15.0)
    start = alice.token_balance
    await settle_match(db, m, _result(3, 1))
    await db.refresh(alice)
    assert alice.token_balance == start + 750


async def test_correct_score_wrong_score_loses(db):
    m = await make_match(db)
    alice = await make_player(db, "Alice")
    await _bet(db, alice, m, "correct_score", "2-1", stake=50, odds=15.0)
    start = alice.token_balance
    await settle_match(db, m, _result(3, 1))
    await db.refresh(alice)
    assert alice.token_balance == start


async def test_corners_over_wins(db):
    m = await make_match(db)
    alice = await make_player(db, "Alice")
    await _bet(db, alice, m, "corners", "Over 7.5", stake=100, odds=1.9)
    start = alice.token_balance
    await settle_match(db, m, _result(1, 0, corners=8))  # 8 > 7.5
    await db.refresh(alice)
    assert alice.token_balance == start + 190


async def test_corners_under_loses_when_over(db):
    m = await make_match(db)
    alice = await make_player(db, "Alice")
    await _bet(db, alice, m, "corners", "Under 7.5", stake=100, odds=1.9)
    start = alice.token_balance
    await settle_match(db, m, _result(1, 0, corners=8))
    await db.refresh(alice)
    assert alice.token_balance == start


async def test_yellow_cards_over_wins(db):
    m = await make_match(db)
    alice = await make_player(db, "Alice")
    await _bet(db, alice, m, "yellow_cards", "Over 4.5", stake=100, odds=1.85)
    start = alice.token_balance
    await settle_match(db, m, _result(1, 0, yellows=5))  # 5 > 4.5
    await db.refresh(alice)
    assert alice.token_balance == start + 185


async def test_yellow_cards_under_loses_when_over(db):
    m = await make_match(db)
    alice = await make_player(db, "Alice")
    await _bet(db, alice, m, "yellow_cards", "Under 4.5", stake=100, odds=1.95)
    start = alice.token_balance
    await settle_match(db, m, _result(1, 0, yellows=5))
    await db.refresh(alice)
    assert alice.token_balance == start


async def test_red_cards_over_wins(db):
    """Total red cards = home_red_cards + away_red_cards."""
    m = await make_match(db)
    alice = await make_player(db, "Alice")
    await _bet(db, alice, m, "red_cards", "Over 0.5", stake=100, odds=2.4)
    start = alice.token_balance
    await settle_match(db, m, _result(1, 0, reds_a=1))  # 1 red total
    await db.refresh(alice)
    assert alice.token_balance == start + 240


async def test_red_cards_under_wins_on_no_reds(db):
    m = await make_match(db)
    alice = await make_player(db, "Alice")
    await _bet(db, alice, m, "red_cards", "Under 0.5", stake=100, odds=1.55)
    start = alice.token_balance
    await settle_match(db, m, _result(1, 0, reds_h=0, reds_a=0))
    await db.refresh(alice)
    assert alice.token_balance == start + 155


async def test_handicap_home_negative_wins(db):
    """England -2.5: home score 6 − 2.5 = 3.5 > 2 → wins."""
    m = await make_match(db, home="England", away="Iran")
    alice = await make_player(db, "Alice")
    await _bet(db, alice, m, "handicap", "England -2.5", stake=100, odds=1.75)
    start = alice.token_balance
    await settle_match(db, m, _result(6, 2))
    await db.refresh(alice)
    assert alice.token_balance == start + 175


async def test_handicap_home_negative_loses_when_margin_too_small(db):
    """England -2.5: 2 − 2.5 = −0.5 < 1 → loses."""
    m = await make_match(db, home="England", away="Iran")
    alice = await make_player(db, "Alice")
    await _bet(db, alice, m, "handicap", "England -2.5", stake=100, odds=1.75)
    start = alice.token_balance
    await settle_match(db, m, _result(2, 1))  # only 1-goal margin
    await db.refresh(alice)
    assert alice.token_balance == start


async def test_handicap_away_positive_wins(db):
    """Saudi Arabia +1.5 (away): 2 + 1.5 = 3.5 > 1 → wins."""
    m = await make_match(db, home="Argentina", away="Saudi Arabia")
    alice = await make_player(db, "Alice")
    await _bet(db, alice, m, "handicap", "Saudi Arabia +1.5", stake=100, odds=1.70)
    start = alice.token_balance
    await settle_match(db, m, _result(1, 2))  # Saudi won outright
    await db.refresh(alice)
    assert alice.token_balance == start + 170


async def test_handicap_away_positive_loses(db):
    """Japan +0.5 (away): even a draw would win, but Japan lost 2-0 (0+0.5=0.5 < 2)."""
    m = await make_match(db, home="Germany", away="Japan")
    alice = await make_player(db, "Alice")
    await _bet(db, alice, m, "handicap", "Japan +0.5", stake=100, odds=2.0)
    start = alice.token_balance
    await settle_match(db, m, _result(2, 0))  # Japan got shutout
    await db.refresh(alice)
    assert alice.token_balance == start


# ─────────────────────────────────────────────────────────────────────────────
# Challenges
# ─────────────────────────────────────────────────────────────────────────────

async def test_challenge_issuer_wins_credited(db):
    """Issuer picks the correct side and receives full payout."""
    m = await make_match(db, home="Argentina", away="Brazil")
    alice = await make_player(db, "Alice", balance=1000)
    bob   = await make_player(db, "Bob",   balance=1000)
    # Alice issues: Argentina wins; Bob accepts: Brazil wins
    ch = await _challenge(db, alice, bob, m, "1x2",
                          "Argentina", "Away",
                          istake=100, iodds=2.0, aodds=2.0)
    i_start, a_start = alice.token_balance, bob.token_balance
    await settle_match(db, m, _result(2, 0))  # Argentina wins
    await db.refresh(alice); await db.refresh(bob); await db.refresh(ch)
    assert ch.status == "resolved"
    assert alice.token_balance == i_start + 200   # 100 × 2.0
    assert bob.token_balance   == a_start         # Bob gets nothing


async def test_challenge_acceptor_wins_credited(db):
    """Issuer picks the wrong side; acceptor receives payout."""
    m = await make_match(db, home="Argentina", away="Brazil")
    alice = await make_player(db, "Alice", balance=1000)
    bob   = await make_player(db, "Bob",   balance=1000)
    ch = await _challenge(db, alice, bob, m, "1x2",
                          "Argentina", "Away",
                          istake=100, iodds=2.0, aodds=2.0)
    a_start = bob.token_balance
    await settle_match(db, m, _result(0, 1))  # Brazil (Away) wins
    await db.refresh(bob); await db.refresh(ch)
    assert ch.status == "resolved"
    # acceptor_stake = round(100 * (2.0/2.0)) = 100; payout = 100 × 2.0 = 200
    assert bob.token_balance == a_start + 200


async def test_challenge_streak_bonus_applied_on_issuer_win(db):
    """Settlement uses issuer.challenge_streak at resolution time.
    Streak 5 → 35% bonus on top of the base payout."""
    m = await make_match(db, home="Argentina", away="Brazil")
    alice = await make_player(db, "Alice", balance=1000)
    bob   = await make_player(db, "Bob",   balance=1000)
    alice.challenge_streak = 5   # streak is on the player, evaluated at settlement
    await db.commit()
    await _challenge(db, alice, bob, m, "1x2",
                     "Argentina", "Away",
                     istake=100, iodds=2.0, aodds=2.0)
    i_start = alice.token_balance
    await settle_match(db, m, _result(2, 0))  # Alice wins
    await db.refresh(alice)
    # payout = int(100 × 2.0) = 200; bonus = int(200 × 0.35) = 70
    assert alice.token_balance == i_start + 200 + 70


async def test_challenge_streak_resets_on_issuer_loss(db):
    """If issuer loses the challenge, their streak is reset to 0."""
    m = await make_match(db, home="Argentina", away="Brazil")
    alice = await make_player(db, "Alice", balance=1000)
    bob   = await make_player(db, "Bob",   balance=1000)
    alice.challenge_streak = 4          # had a streak going
    await db.commit()
    await _challenge(db, alice, bob, m, "1x2",
                     "Argentina", "Away",
                     istake=100, iodds=2.0, aodds=2.0)
    await settle_match(db, m, _result(0, 1))  # Alice's pick loses
    await db.refresh(alice)
    assert alice.challenge_streak == 0


async def test_open_challenge_expires_and_refunds(db):
    """An unaccepted (open) challenge expires at settlement and refunds the issuer."""
    m = await make_match(db, home="Argentina", away="Brazil")
    alice = await make_player(db, "Alice", balance=1000)
    # Create an OPEN challenge (no acceptor)
    alice.token_balance -= 100
    ch = Challenge(
        issuer_id=alice.id, acceptor_id=None, match_id=m.id,
        bet_type="1x2", selection="Argentina", acceptor_selection="Brazil",
        issuer_stake=100, acceptor_stake=100,
        issuer_odds=2.0, acceptor_odds=2.0,
        status="open", bravery_streak_bonus_pct=0.0,
    )
    db.add(ch)
    await db.commit()
    await db.refresh(ch)

    start = alice.token_balance
    await settle_match(db, m, _result(2, 0))
    await db.refresh(ch); await db.refresh(alice)
    assert ch.status == "expired"              # expired, not left open
    assert alice.token_balance == start + 100  # stake refunded


# ─────────────────────────────────────────────────────────────────────────────
# Predictions
# ─────────────────────────────────────────────────────────────────────────────

async def test_prediction_correct_score_gives_3_pts(db):
    m = await make_match(db)
    alice = await make_player(db, "Alice")
    pred = await _prediction(db, alice, m, 2, 1)
    await settle_match(db, m, _result(2, 1))
    await db.refresh(pred)
    assert pred.points_awarded == 3
    assert pred.status == "correct_score"


async def test_prediction_correct_outcome_gives_1_pt(db):
    m = await make_match(db)
    alice = await make_player(db, "Alice")
    pred = await _prediction(db, alice, m, 3, 1)  # predicts home win
    await settle_match(db, m, _result(2, 0))       # home wins but different score
    await db.refresh(pred)
    assert pred.points_awarded == 1
    assert pred.status == "correct_outcome"


async def test_prediction_wrong_gives_0_pts(db):
    m = await make_match(db)
    alice = await make_player(db, "Alice")
    pred = await _prediction(db, alice, m, 2, 0)  # predicts home win
    await settle_match(db, m, _result(0, 1))       # away wins
    await db.refresh(pred)
    assert pred.points_awarded == 0
    assert pred.status == "wrong"


async def test_prediction_draw_correct_score(db):
    m = await make_match(db)
    alice = await make_player(db, "Alice")
    pred = await _prediction(db, alice, m, 1, 1)
    await settle_match(db, m, _result(1, 1))
    await db.refresh(pred)
    assert pred.points_awarded == 3


async def test_prediction_draw_correct_outcome(db):
    """Predicted 0-0, actual 2-2 — same outcome (draw), different score."""
    m = await make_match(db)
    alice = await make_player(db, "Alice")
    pred = await _prediction(db, alice, m, 0, 0)
    await settle_match(db, m, _result(2, 2))
    await db.refresh(pred)
    assert pred.points_awarded == 1
    assert pred.status == "correct_outcome"


# ─────────────────────────────────────────────────────────────────────────────
# Multiple bets settle independently in one call
# ─────────────────────────────────────────────────────────────────────────────

async def test_multiple_bets_on_same_match_all_settled(db):
    """Three players, three different bets — each resolved correctly."""
    m = await make_match(db, home="Argentina", away="Brazil")
    alice  = await make_player(db, "Alice")
    bob    = await make_player(db, "Bob")
    carlos = await make_player(db, "Carlos")
    await _bet(db, alice,  m, "1x2",    "Argentina", stake=100, odds=2.0)  # wins
    await _bet(db, bob,    m, "1x2",    "Brazil",    stake=100, odds=4.0)  # loses
    await _bet(db, carlos, m, "totals", "Over 1.5",  stake=100, odds=1.7)  # wins (2-0)
    a_start = alice.token_balance
    b_start = bob.token_balance
    c_start = carlos.token_balance

    await settle_match(db, m, _result(2, 0))
    await db.refresh(alice); await db.refresh(bob); await db.refresh(carlos)
    assert alice.token_balance  == a_start + 200   # won
    assert bob.token_balance    == b_start         # lost, nothing back
    assert carlos.token_balance == c_start + 170   # won


# ─────────────────────────────────────────────────────────────────────────────
# Tournament bracket propagation
# ─────────────────────────────────────────────────────────────────────────────

async def test_winner_propagated_to_next_match_home_slot(db):
    """Home-team winner fills the 'home' slot of the next match."""
    from datetime import datetime, timezone
    next_m = Match(
        home_team="TBD", away_team="France",
        kickoff_time=datetime(2026, 7, 1, tzinfo=timezone.utc),
        status="upcoming", round="quarter",
    )
    db.add(next_m)
    await db.commit()
    await db.refresh(next_m)

    m = await make_match(db, home="Argentina", away="Brazil")
    m.next_match_id = next_m.id
    m.next_slot = "home"
    await db.commit()

    await settle_match(db, m, _result(2, 0))   # Argentina wins
    await db.refresh(next_m)
    assert next_m.home_team == "Argentina"
    assert next_m.home_team_confirmed is True


async def test_winner_propagated_to_next_match_away_slot(db):
    """Away-team winner fills the 'away' slot of the next match."""
    from datetime import datetime, timezone
    next_m = Match(
        home_team="France", away_team="TBD",
        kickoff_time=datetime(2026, 7, 1, tzinfo=timezone.utc),
        status="upcoming", round="quarter",
    )
    db.add(next_m)
    await db.commit()
    await db.refresh(next_m)

    m = await make_match(db, home="Germany", away="Japan")
    m.next_match_id = next_m.id
    m.next_slot = "away"
    await db.commit()

    await settle_match(db, m, _result(1, 2))   # Japan (Away) wins
    await db.refresh(next_m)
    assert next_m.away_team == "Japan"
    assert next_m.away_team_confirmed is True


async def test_match_has_player_stats_cache_column(db):
    """Match model exposes the player_stats_cache column with correct round-trip."""
    m = await make_match(db)
    assert m.player_stats_cache is None
    # write→read round-trip
    m.player_stats_cache = '{"messi": {"goals": 2}}'
    await db.commit()
    await db.refresh(m)
    assert m.player_stats_cache == '{"messi": {"goals": 2}}'
