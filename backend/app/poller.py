import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Match, Bet, Challenge, Prediction, Player, TournamentBet
from app.settlement import (
    settle_bet, settle_challenge_issuer, settle_challenge_acceptor,
    determine_h2h_winner, determine_correct_score_winner,
    determine_totals_winner, determine_btts_winner,
)

logger = logging.getLogger(__name__)


async def settle_match(db: AsyncSession, match: Match, result: dict) -> None:
    match.home_score = result["home_score"]
    match.away_score = result["away_score"]
    match.home_red_cards = result["home_red_cards"]
    match.away_red_cards = result["away_red_cards"]
    match.corners = result["corners"]
    match.status = "finished"
    await _settle_bets(db, match, result)
    await _settle_challenges(db, match, result)
    await _settle_predictions(db, match, result)
    await _propagate_winner(db, match, result)
    await db.commit()


async def _settle_bets(db, match, result):
    bets = (await db.execute(select(Bet).where(Bet.match_id == match.id, Bet.status == "pending"))).scalars().all()
    for bet in bets:
        won = _evaluate_bet(bet.bet_type, bet.selection, match, result)
        payout = settle_bet(bet.stake, bet.odds_at_placement, won)
        bet.status = "won" if won else "lost"
        if payout:
            player = await db.get(Player, bet.player_id)
            player.token_balance += payout


def _evaluate_bet(bet_type, selection, match, result):
    hs, as_ = result["home_score"], result["away_score"]
    if bet_type == "1x2":
        return selection == determine_h2h_winner(match.home_team, hs, as_)
    if bet_type == "correct_score":
        return determine_correct_score_winner(selection, hs, as_)
    if bet_type == "totals":
        return determine_totals_winner(selection, hs + as_)
    if bet_type == "btts":
        return determine_btts_winner(selection, hs, as_)
    if bet_type == "corners":
        return determine_totals_winner(selection, result.get("corners", 0))
    return False


async def _settle_challenges(db, match, result):
    challenges = (await db.execute(
        select(Challenge).where(Challenge.match_id == match.id, Challenge.status == "accepted")
    )).scalars().all()
    for ch in challenges:
        issuer_won = _evaluate_bet(ch.bet_type, ch.selection, match, result)
        issuer = await db.get(Player, ch.issuer_id)
        acceptor = await db.get(Player, ch.acceptor_id)
        payout, bonus = settle_challenge_issuer(ch.issuer_stake, ch.issuer_odds, issuer.challenge_streak, issuer_won)
        if payout:
            issuer.token_balance += payout + bonus
        else:
            issuer.challenge_streak = 0
        acceptor_payout = settle_challenge_acceptor(ch.acceptor_stake, ch.acceptor_odds, not issuer_won)
        if acceptor_payout:
            acceptor.token_balance += acceptor_payout
        ch.status = "resolved"


async def _settle_predictions(db, match, result):
    preds = (await db.execute(
        select(Prediction).where(Prediction.match_id == match.id, Prediction.status == "pending")
    )).scalars().all()
    hs, as_ = result["home_score"], result["away_score"]
    for pred in preds:
        if pred.home_score_pred == hs and pred.away_score_pred == as_:
            pred.status, pred.points_awarded = "correct_score", 3
        elif _same_outcome(pred.home_score_pred, pred.away_score_pred, hs, as_):
            pred.status, pred.points_awarded = "correct_outcome", 1
        else:
            pred.status, pred.points_awarded = "wrong", 0


def _same_outcome(ph, pa, ah, aa):
    return (ph > pa and ah > aa) or (ph < pa and ah < aa) or (ph == pa and ah == aa)


async def _propagate_winner(db, match, result):
    if not match.next_match_id:
        return
    winner = determine_h2h_winner(match.home_team, result["home_score"], result["away_score"])
    winning_team = match.home_team if winner == match.home_team else match.away_team
    next_match = await db.get(Match, match.next_match_id)
    if not next_match:
        return
    if match.next_slot == "home":
        next_match.home_team, next_match.home_team_confirmed = winning_team, True
    else:
        next_match.away_team, next_match.away_team_confirmed = winning_team, True


def start_poller(app) -> None:
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from app.config import settings
    from app.database import AsyncSessionLocal
    from app.results_client import fetch_live_scores
    from app.ws import manager

    scheduler = AsyncIOScheduler()

    async def _poll():
        try:
            results = fetch_live_scores(settings.football_api_key)
        except Exception as e:
            logger.warning(f"Poll failed: {e}")
            return
        async with AsyncSessionLocal() as db:
            locked = (await db.execute(select(Match).where(Match.status == "locked"))).scalars().all()
            for result in results:
                match = next((m for m in locked if m.home_team == result["home_team"] and m.away_team == result["away_team"]), None)
                if match:
                    await settle_match(db, match, result)
                    await manager.broadcast({"type": "match_settled", "match_id": match.id})
                    await manager.broadcast({"type": "leaderboard_updated"})

    scheduler.add_job(_poll, "interval", seconds=60)
    scheduler.start()
