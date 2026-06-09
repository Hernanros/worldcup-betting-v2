"""Daily group feed — end-of-day digest of what happened in your league today."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_player
from app.models import Bet, Challenge, Match, Player, Prediction, SpicyBet
from app.settlement import (
    determine_btts_winner,
    determine_correct_score_winner,
    determine_h2h_winner,
    determine_handicap_winner,
    determine_totals_winner,
)

router = APIRouter()


def _iso(dt: datetime) -> str:
    return dt.replace(tzinfo=timezone.utc).isoformat() if dt else None


@router.get("/api/feed/today")
async def get_daily_feed(
    auth=Depends(get_current_player),
    db: AsyncSession = Depends(get_db),
):
    player, _ = auth
    today_utc = datetime.now(timezone.utc).date()

    # ── All matches with kickoff today (UTC) ──────────────────────────────
    all_matches: list[Match] = (
        await db.execute(select(Match).order_by(Match.kickoff_time))
    ).scalars().all()

    today_matches = [
        m for m in all_matches
        if m.kickoff_time.replace(tzinfo=timezone.utc).date() == today_utc
    ]
    finished_today = [m for m in today_matches if m.status == "finished"]
    today_match_ids = [m.id for m in today_matches]
    finished_ids    = [m.id for m in finished_today]

    # ── League players ─────────────────────────────────────────────────────
    if player.league_id:
        league_players: list[Player] = (
            await db.execute(
                select(Player).where(Player.league_id == player.league_id)
            )
        ).scalars().all()
    else:
        # Admin: no league — return minimal response
        league_players = []

    league_player_ids = {p.id for p in league_players}
    name_of = {p.id: p.name for p in league_players}

    # ── Predictions for finished matches today ─────────────────────────────
    preds: list[Prediction] = []
    if finished_ids and league_player_ids:
        preds = (
            await db.execute(
                select(Prediction).where(
                    Prediction.match_id.in_(finished_ids),
                    Prediction.player_id.in_(league_player_ids),
                )
            )
        ).scalars().all()

    # ── Resolved challenges for today's matches ────────────────────────────
    challenges: list[Challenge] = []
    if today_match_ids and league_player_ids:
        challenges = (
            await db.execute(
                select(Challenge).where(
                    Challenge.match_id.in_(today_match_ids),
                    Challenge.status == "resolved",
                    Challenge.issuer_id.in_(league_player_ids),
                )
            )
        ).scalars().all()

    # ── Bets settled on today's finished matches ───────────────────────────
    bets: list[Bet] = []
    if finished_ids and league_player_ids:
        bets = (
            await db.execute(
                select(Bet).where(
                    Bet.match_id.in_(finished_ids),
                    Bet.player_id.in_(league_player_ids),
                    Bet.status.in_(["won", "lost"]),
                )
            )
        ).scalars().all()

    # ── Deep Cuts (SpicyBet) wins for league players ───────────────────────
    spicy_bets: list[SpicyBet] = []
    if league_player_ids:
        spicy_bets = (
            await db.execute(
                select(SpicyBet).where(
                    SpicyBet.player_id.in_(league_player_ids),
                    SpicyBet.status == "won",
                )
            )
        ).scalars().all()

    # ── Match results ──────────────────────────────────────────────────────
    match_by_id = {m.id: m for m in today_matches}
    match_results = [
        {
            "id": m.id,
            "home": m.home_team,
            "away": m.away_team,
            "home_score": m.home_score,
            "away_score": m.away_score,
            "status": m.status,
            "kickoff_time": _iso(m.kickoff_time),
        }
        for m in today_matches
    ]

    # ── Moments ───────────────────────────────────────────────────────────
    moments = []

    # Correct-score callouts (rare → most valuable moment)
    for p in preds:
        if p.status == "correct_score":
            m = match_by_id.get(p.match_id)
            if not m:
                continue
            moments.append({
                "type": "correct_score",
                "player": name_of.get(p.player_id, "Someone"),
                "match": f"{m.home_team} vs {m.away_team}",
                "score": f"{m.home_score}–{m.away_score}",
                "pts": p.points_awarded,
                "is_me": p.player_id == player.id,
            })

    # Dare settlements
    for c in challenges:
        m = match_by_id.get(c.match_id)
        if not m or m.home_score is None or m.away_score is None:
            continue
        acceptor_name = name_of.get(c.acceptor_id) if c.acceptor_id else None
        if not acceptor_name:
            continue
        issuer_name = name_of.get(c.issuer_id, "?")

        h, a = m.home_score, m.away_score
        issuer_won: bool | None = None
        try:
            bt = c.bet_type
            if bt == "h2h":
                winner_team = determine_h2h_winner(m.home_team, m.away_team, h, a)
                issuer_won = c.selection == winner_team
            elif bt == "correct_score":
                issuer_won = determine_correct_score_winner(c.selection, h, a)
            elif bt in ("total_goals", "corners"):
                stat = h + a if bt == "total_goals" else (m.home_corners + m.away_corners)
                issuer_won = determine_totals_winner(c.selection, stat)
            elif bt == "btts":
                issuer_won = determine_btts_winner(c.selection, h, a)
            elif bt == "handicap":
                issuer_won = determine_handicap_winner(c.selection, m.home_team, h, a)
            else:
                # player_h2h / red_cards etc — skip complex ones
                continue
        except Exception:
            continue

        if issuer_won is None:
            continue

        winner_name = issuer_name if issuer_won else acceptor_name
        loser_name  = acceptor_name if issuer_won else issuer_name
        tokens_won  = int(c.issuer_stake * c.issuer_odds) if issuer_won else int(c.acceptor_stake * c.acceptor_odds)

        # Streak bonus: only issuer can earn it
        streak_bonus = 0
        if issuer_won and c.bravery_streak_bonus_pct > 0:
            streak_bonus = int(tokens_won * c.bravery_streak_bonus_pct)

        moments.append({
            "type": "dare",
            "winner": winner_name,
            "loser": loser_name,
            "match": f"{m.home_team} vs {m.away_team}",
            "tokens": tokens_won,
            "streak_bonus": streak_bonus,
            "is_me_winner": (
                (issuer_won and c.issuer_id == player.id)
                or (not issuer_won and c.acceptor_id == player.id)
            ),
        })

    # Correct-outcome predictions (right result, not exact score)
    for p in preds:
        if p.status == "correct_outcome":
            m = match_by_id.get(p.match_id)
            if not m:
                continue
            moments.append({
                "type": "prediction_win",
                "player": name_of.get(p.player_id, "Someone"),
                "match": f"{m.home_team} vs {m.away_team}",
                "pts": p.points_awarded,
                "is_me": p.player_id == player.id,
            })

    # Bet wins and losses on today's matches
    for b in bets:
        m = match_by_id.get(b.match_id)
        if not m:
            continue
        payout = int(b.stake * b.odds_at_placement) if b.status == "won" else 0
        bet_label = b.bet_type.replace("_", " ").title()
        if b.is_wildcard and b.status == "won":
            moments.append({
                "type": "wildcard_win",
                "player": name_of.get(b.player_id, "Someone"),
                "match": f"{m.home_team} vs {m.away_team}",
                "tokens": payout,
                "bet_type": bet_label,
                "selection": b.selection,
                "is_me": b.player_id == player.id,
            })
        else:
            moments.append({
                "type": "bet_win" if b.status == "won" else "bet_loss",
                "player": name_of.get(b.player_id, "Someone"),
                "match": f"{m.home_team} vs {m.away_team}",
                "tokens": payout,
                "bet_type": bet_label,
                "selection": b.selection,
                "is_me": b.player_id == player.id,
            })

    # Deep Cuts hits
    for sb in spicy_bets:
        payout = int(sb.stake * sb.odds_at_placement)
        market_label = sb.market_key.replace("_", " ").title()
        moments.append({
            "type": "deep_cuts_hit",
            "player": name_of.get(sb.player_id, "Someone"),
            "market": market_label,
            "selection": sb.selection,
            "tokens": payout,
            "is_me": sb.player_id == player.id,
        })

    # Sort moments by priority: correct_score → wildcard_win → dare → bet_win → deep_cuts_hit → prediction_win → bet_loss
    _priority = {
        "correct_score": 0,
        "wildcard_win": 1,
        "dare": 2,
        "bet_win": 3,
        "deep_cuts_hit": 4,
        "prediction_win": 5,
        "bet_loss": 6,
    }
    moments.sort(key=lambda x: (
        _priority.get(x["type"], 99),
        -(x.get("tokens") or x.get("pts") or 0),
    ))

    # ── Top prediction scorers today ───────────────────────────────────────
    pts_by_player: dict[int, int] = {}
    for p in preds:
        if p.points_awarded:
            pts_by_player[p.player_id] = pts_by_player.get(p.player_id, 0) + p.points_awarded

    top_scorers = sorted(
        [
            {"name": name_of.get(pid, "?"), "pts": pts, "is_me": pid == player.id}
            for pid, pts in pts_by_player.items()
            if pts > 0
        ],
        key=lambda x: -x["pts"],
    )[:5]

    return {
        "has_activity": bool(finished_today or challenges or bets or spicy_bets),
        "date": str(today_utc),
        "matches": match_results,
        "moments": moments[:12],
        "top_scorers": top_scorers,
    }
