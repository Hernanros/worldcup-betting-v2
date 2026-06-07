import json
import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Match, Bet, Challenge, Prediction, Player, TournamentBet
from app.settlement import (
    settle_bet, settle_challenge_issuer, settle_challenge_acceptor,
    determine_h2h_winner, determine_correct_score_winner,
    determine_totals_winner, determine_btts_winner, determine_handicap_winner,
)
from app.results_client import (
    fetch_espn_match_stats, fetch_api_football_events,
    fetch_espn_event_id_from_scoreboard,
)
from app.deep_cuts_settlement import settle_stage

logger = logging.getLogger(__name__)


async def settle_match(db: AsyncSession, match: Match, result: dict) -> None:
    match.home_score = result["home_score"]
    match.away_score = result["away_score"]
    match.home_red_cards = result["home_red_cards"]
    match.away_red_cards = result["away_red_cards"]
    match.corners = result["corners"]
    match.status = "finished"

    # Store ESPN event ID if provided in result
    if result.get("espn_event_id") and not match.espn_event_id:
        match.espn_event_id = result["espn_event_id"]

    # Enrich first so yellow cards / corners / offsides are on the match object
    # before challenges are evaluated (non-blocking — settlement proceeds even on failure)
    await _enrich_match_stats(db, match)

    await _settle_bets(db, match, result)
    await _expire_open_challenges(db, match)   # refund unaccepted challenges before settling
    await _settle_challenges(db, match, result)
    await _settle_predictions(db, match, result)
    await _propagate_winner(db, match, result)
    await db.commit()


async def _enrich_match_stats(db: AsyncSession, match: Match) -> None:
    """Fetch detailed stats from ESPN summary + API-Football events and store on Match."""
    try:
        if match.espn_event_id:
            espn_stats = fetch_espn_match_stats(match.espn_event_id)
            for key, val in espn_stats.items():
                setattr(match, key, val)

        if match.api_fixture_id:
            from app.config import settings
            af_stats = fetch_api_football_events(
                match.api_fixture_id,
                settings.football_api_key,
            )
            for key, val in af_stats.items():
                if key == "player_stats":
                    match.player_stats_cache = json.dumps(val)
                else:
                    setattr(match, key, val)

        await db.commit()
    except Exception as e:
        await db.rollback()
        logger.warning("Match %d enrichment failed: %s", match.id, e)


async def _settle_bets(db, match, result):
    bets = (await db.execute(select(Bet).where(Bet.match_id == match.id, Bet.status == "pending"))).scalars().all()
    for bet in bets:
        won = _evaluate_bet(bet.bet_type, bet.selection, match, result)
        payout = settle_bet(bet.stake, bet.odds_at_placement, won)
        if payout and bet.is_wildcard:
            payout *= 2  # wildcard bets pay double on a win
        bet.status = "won" if won else "lost"
        if payout:
            player = await db.get(Player, bet.player_id)
            player.token_balance += payout


def _evaluate_bet(bet_type, selection, match, result):
    hs, as_ = result["home_score"], result["away_score"]
    if bet_type == "1x2":
        return selection == determine_h2h_winner(match.home_team, match.away_team, hs, as_)
    if bet_type == "correct_score":
        return determine_correct_score_winner(selection, hs, as_)
    if bet_type == "totals":
        return determine_totals_winner(selection, hs + as_)
    if bet_type == "btts":
        return determine_btts_winner(selection, hs, as_)
    if bet_type == "corners":
        # Use enriched per-team corners when available; fall back to legacy total
        enriched = (match.home_corners or 0) + (match.away_corners or 0)
        total = enriched or result.get("corners", 0)
        return determine_totals_winner(selection, total)
    if bet_type == "yellow_cards":
        enriched = (match.home_yellow_cards or 0) + (match.away_yellow_cards or 0)
        total = enriched or result.get("yellow_cards", 0)
        return determine_totals_winner(selection, total)
    if bet_type == "red_cards":
        enriched = (match.home_red_cards or 0) + (match.away_red_cards or 0)
        total = enriched or result.get("home_red_cards", 0) + result.get("away_red_cards", 0)
        return determine_totals_winner(selection, total)
    if bet_type == "offsides":
        total = (match.home_offsides or 0) + (match.away_offsides or 0)
        return determine_totals_winner(selection, total)
    if bet_type == "total_cards":
        total = ((match.home_yellow_cards or 0) + (match.away_yellow_cards or 0) +
                 (match.home_red_cards or 0) + (match.away_red_cards or 0))
        return determine_totals_winner(selection, total)
    if bet_type == "handicap":
        return determine_handicap_winner(selection, match.home_team, hs, as_)
    # ── Dare-only types ──────────────────────────────────────────────
    if bet_type == "any_red_card":
        total = (match.home_red_cards or 0) + (match.away_red_cards or 0)
        return (total > 0) == (selection.strip().lower() == "yes")
    if bet_type == "went_to_et":
        return (match.went_to_et or False) == (selection.strip().lower() == "yes")
    if bet_type == "went_to_pens":
        return (match.went_to_pens or False) == (selection.strip().lower() == "yes")
    return False


async def _expire_open_challenges(db, match):
    """Refund issuers for challenges that were never accepted before the match settled."""
    open_chs = (await db.execute(
        select(Challenge).where(Challenge.match_id == match.id, Challenge.status == "open")
    )).scalars().all()
    for ch in open_chs:
        issuer = await db.get(Player, ch.issuer_id)
        if issuer:
            issuer.token_balance += ch.issuer_stake
        ch.status = "expired"


async def _settle_challenges(db, match, result):
    challenges = (await db.execute(
        select(Challenge).where(Challenge.match_id == match.id, Challenge.status == "accepted")
    )).scalars().all()
    for ch in challenges:
        issuer_won = _evaluate_bet(ch.bet_type, ch.selection, match, result)
        issuer   = await db.get(Player, ch.issuer_id)
        acceptor = await db.get(Player, ch.acceptor_id)

        # Issuer settlement + streak
        payout, bonus = settle_challenge_issuer(
            ch.issuer_stake, ch.issuer_odds, issuer.challenge_streak, issuer_won
        )
        if payout:
            issuer.token_balance += payout + bonus
        else:
            issuer.challenge_streak = 0

        # Acceptor settlement + streak (P1 fix: was missing entirely)
        acceptor_won = not issuer_won
        acceptor_payout, acceptor_bonus = settle_challenge_acceptor(
            ch.acceptor_stake, ch.acceptor_odds, acceptor.challenge_streak, acceptor_won
        )
        if acceptor_payout:
            acceptor.token_balance += acceptor_payout + acceptor_bonus
        else:
            acceptor.challenge_streak = 0

        ch.status = "resolved"


async def _settle_predictions(db, match, result):
    preds = (await db.execute(
        select(Prediction).where(Prediction.match_id == match.id, Prediction.status == "pending")
    )).scalars().all()
    hs, as_ = result["home_score"], result["away_score"]
    for pred in preds:
        multiplier = 2 if pred.is_double else 1
        if pred.home_score_pred == hs and pred.away_score_pred == as_:
            pred.status = "correct_score"
            pred.points_awarded = 3 * multiplier
        elif _same_outcome(pred.home_score_pred, pred.away_score_pred, hs, as_):
            pred.status = "correct_outcome"
            pred.points_awarded = 1 * multiplier
        else:
            pred.status = "wrong"
            pred.points_awarded = 0


def _same_outcome(ph, pa, ah, aa):
    return (ph > pa and ah > aa) or (ph < pa and ah < aa) or (ph == pa and ah == aa)


async def _propagate_winner(db, match, result):
    if not match.next_match_id:
        return
    winner = determine_h2h_winner(match.home_team, match.away_team, result["home_score"], result["away_score"])
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
            results = fetch_live_scores(settings.football_api_key, settings.odds_api_key)
        except Exception as e:
            logger.warning(f"Poll failed: {e}")
            return
        async with AsyncSessionLocal() as db:
            locked = (await db.execute(select(Match).where(Match.status == "locked"))).scalars().all()
            settled_rounds: set = set()
            for result in results:
                match = next((m for m in locked if m.home_team == result["home_team"] and m.away_team == result["away_team"]), None)
                if match:
                    await settle_match(db, match, result)
                    await manager.broadcast({"type": "match_settled", "match_id": match.id})
                    await manager.broadcast({"type": "leaderboard_updated"})
                    settled_rounds.add(match.round)

            # After all matches settled, check if any stage is now complete → trigger Deep Cuts settlement
            from app.deep_cuts_config import STAGE_ROUNDS
            from sqlalchemy import select as _select
            for stage_round in settled_rounds:
                stage = next(
                    (s for s, r in STAGE_ROUNDS.items() if r == stage_round),
                    None,
                )
                if not stage:
                    continue
                remaining = (await db.execute(
                    _select(Match).where(
                        Match.round == stage_round,
                        Match.status != "finished",
                    )
                )).scalars().all()
                if not remaining:
                    logger.info("Stage %s complete — running Deep Cuts settlement", stage)
                    await settle_stage(stage, db)
                    await db.commit()

    scheduler.add_job(_poll, "interval", seconds=60)
    scheduler.start()
