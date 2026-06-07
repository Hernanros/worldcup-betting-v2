import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.deps import get_admin
from app.models import League, Player, Match, TournamentBet, InsurancePick, Challenge
from app.settlement import (
    determine_totals_winner,
    determine_player_h2h_winner,
    _normalize_name,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _league_dict(league: League, player_count: int = 0) -> dict:
    return {
        "id": league.id,
        "name": league.name,
        "invite_code": league.invite_code,
        "ai_enabled": league.ai_enabled,
        "player_count": player_count,
    }


@router.post("/api/leagues", status_code=201)
async def create_league(data: dict, _=Depends(get_admin), db: AsyncSession = Depends(get_db)):
    name = (data.get("name") or "").strip()
    code = (data.get("invite_code") or "").strip()
    if not name or not code:
        raise HTTPException(400, "name and invite_code are required")
    existing = (await db.execute(
        select(League).where(League.invite_code == code)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(400, "invite_code already in use")
    ai_enabled = bool(data.get("ai_enabled", True))
    league = League(name=name, invite_code=code, ai_enabled=ai_enabled)
    db.add(league)
    await db.commit()
    await db.refresh(league)
    return _league_dict(league)


@router.get("/api/leagues")
async def list_leagues(_=Depends(get_admin), db: AsyncSession = Depends(get_db)):
    leagues = (await db.execute(select(League))).scalars().all()
    # Count players per league in one query
    counts_rows = (await db.execute(
        select(Player.league_id, func.count(Player.id).label("cnt"))
        .where(Player.league_id.isnot(None))
        .group_by(Player.league_id)
    )).all()
    counts = {row.league_id: row.cnt for row in counts_rows}
    return [_league_dict(lg, counts.get(lg.id, 0)) for lg in leagues]


@router.delete("/api/leagues/{league_id}", status_code=200)
async def delete_league(league_id: int, _=Depends(get_admin), db: AsyncSession = Depends(get_db)):
    league = await db.get(League, league_id)
    if not league:
        raise HTTPException(404, "league not found")
    # Safety: refuse if the league has players
    players = (await db.execute(
        select(Player).where(Player.league_id == league_id).limit(1)
    )).scalar_one_or_none()
    if players:
        raise HTTPException(400, "cannot delete a league that still has players — remove players first or use force=true")
    await db.delete(league)
    await db.commit()
    return {"deleted": league_id}


@router.delete("/api/leagues/{league_id}/force", status_code=200)
async def force_delete_league(league_id: int, _=Depends(get_admin), db: AsyncSession = Depends(get_db)):
    """Delete league AND all its players (use for test/mock groups)."""
    league = await db.get(League, league_id)
    if not league:
        raise HTTPException(404, "league not found")
    players = (await db.execute(
        select(Player).where(Player.league_id == league_id)
    )).scalars().all()
    player_count = len(players)
    for p in players:
        await db.delete(p)
    await db.delete(league)
    await db.commit()
    return {"deleted": league_id, "players_removed": player_count}


@router.post("/api/admin/seed-matches", status_code=200)
async def seed_matches(_=Depends(get_admin), db: AsyncSession = Depends(get_db)):
    """One-shot: seed WC 2026 group-stage matches. Safe to call multiple times."""
    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../.."))
    from scripts.seed_wc2026 import MATCHES
    from app.models import Match
    from datetime import datetime

    added = 0
    for home, away, kickoff_str, round_label in MATCHES:
        kickoff = datetime.fromisoformat(kickoff_str.replace("Z", "+00:00"))
        exists = (await db.execute(
            select(Match).where(Match.home_team == home, Match.away_team == away)
        )).scalar_one_or_none()
        if not exists:
            db.add(Match(home_team=home, away_team=away,
                         kickoff_time=kickoff, status="upcoming", round=round_label))
            added += 1
    await db.commit()
    return {"seeded": added, "message": f"Added {added} matches (skipped duplicates)"}


@router.post("/api/admin/settle-match", status_code=200)
async def settle_match_manual(data: dict, _=Depends(get_admin), db: AsyncSession = Depends(get_db)):
    """Manually settle a match with scores. Triggers full payout logic."""
    from app.poller import settle_match
    from app.ws import manager

    match_id = data.get("match_id")
    home_score = data.get("home_score")
    away_score = data.get("away_score")
    if match_id is None or home_score is None or away_score is None:
        raise HTTPException(400, "match_id, home_score, and away_score required")

    match = await db.get(Match, match_id)
    if not match:
        raise HTTPException(404, "match not found")
    if match.status == "finished":
        raise HTTPException(400, f"already settled: {match.home_score}-{match.away_score}")
    if match.status == "upcoming":
        # Force-lock it first so settlement logic works
        match.status = "locked"
        await db.commit()

    result = {
        "home_score": int(home_score),
        "away_score": int(away_score),
        "home_red_cards": int(data.get("home_red_cards", 0)),
        "away_red_cards": int(data.get("away_red_cards", 0)),
        "corners": int(data.get("corners", 0)),
    }
    await settle_match(db, match, result)
    await manager.broadcast({"type": "match_settled", "match_id": match.id})
    await manager.broadcast({"type": "leaderboard_updated"})
    return {"settled": match_id, "home_score": int(home_score), "away_score": int(away_score)}


@router.post("/api/admin/sync-fixture-ids")
async def sync_fixture_ids(
    auth=Depends(get_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    One-time setup: fetch WC 2026 fixture list from API-Football,
    match by home_team + away_team, store api_fixture_id on Match.
    Run once before the tournament starts.
    """
    import requests as _req
    from sqlalchemy import select as _select
    from app.models import Match as _Match

    try:
        from app.config import settings
        api_key = settings.football_api_key
    except Exception:
        import os
        api_key = os.getenv("FOOTBALL_API_KEY", "")

    try:
        resp = _req.get(
            "https://v3.football.api-sports.io/fixtures",
            params={"league": "1", "season": "2026"},
            headers={"x-apisports-key": api_key},
            timeout=15,
        )
        resp.raise_for_status()
        fixtures = resp.json().get("response", [])
    except Exception as e:
        raise HTTPException(502, f"API-Football fetch failed: {e}")

    matches = (await db.execute(_select(_Match))).scalars().all()
    match_lookup = {
        (m.home_team.lower(), m.away_team.lower()): m
        for m in matches
    }

    updated = 0
    for f in fixtures:
        teams = f.get("teams", {})
        home = teams.get("home", {}).get("name", "").lower()
        away = teams.get("away", {}).get("name", "").lower()
        fid = f.get("fixture", {}).get("id")
        if not fid:
            continue
        match = match_lookup.get((home, away))
        if match and not match.api_fixture_id:
            match.api_fixture_id = fid
            updated += 1

    await db.commit()
    return {"updated": updated, "total_fixtures": len(fixtures)}


@router.post("/api/admin/tournament/settle", status_code=200)
async def settle_tournament_bets(
    data: dict,
    _=Depends(get_admin),
    db: AsyncSession = Depends(get_db),
):
    """Settle all pending tournament bets. Call once the tournament ends.

    Body:
      winner       – team name that won (case-insensitive)
      golden_boot  – top scorer name (case-insensitive)

    total_goals bets are auto-settled from sum of all finished match scores.
    """
    winner_team = (data.get("winner") or "").strip()
    golden_boot_player = (data.get("golden_boot") or "").strip()
    if not winner_team or not golden_boot_player:
        raise HTTPException(400, "winner and golden_boot are required")

    # Sum all goals from finished matches
    total_goals_row = await db.execute(
        select(
            func.coalesce(func.sum(Match.home_score), 0) +
            func.coalesce(func.sum(Match.away_score), 0)
        ).where(Match.status == "finished")
    )
    total_goals = int(total_goals_row.scalar() or 0)

    # Settle every pending tournament bet
    pending = (await db.execute(
        select(TournamentBet).where(TournamentBet.status == "pending")
    )).scalars().all()

    settled_count = 0
    for bet in pending:
        if bet.bet_type == "winner":
            won = bet.selection.lower() == winner_team.lower()
        elif bet.bet_type == "golden_boot":
            won = bet.selection.lower() == golden_boot_player.lower()
        elif bet.bet_type == "total_goals":
            won = determine_totals_winner(bet.selection, total_goals)
        else:
            won = False
            logger.warning(
                "Unknown tournament bet_type %r for bet id=%d — marking lost",
                bet.bet_type,
                bet.id,
            )

        bet.status = "won" if won else "lost"
        if won:
            player = await db.get(Player, bet.player_id)
            if player:
                player.token_balance += int(bet.stake * bet.odds_at_placement)
        settled_count += 1

    await db.commit()

    # ── Settle insurance picks ─────────────────────────────────────────────
    insurance_picks = (await db.execute(
        select(InsurancePick).where(InsurancePick.status == "pending")
    )).scalars().all()

    for pick in insurance_picks:
        if pick.bet_type == "winner":
            pick_correct = pick.selection.lower() == winner_team.lower()
        elif pick.bet_type == "golden_boot":
            pick_correct = pick.selection.lower() == golden_boot_player.lower()
        else:
            pick_correct = False

        primary = await db.get(TournamentBet, pick.tournament_bet_id)

        if pick_correct and primary and primary.status == "lost":
            pick.status = "correct"
            payout = int(primary.stake * primary.odds_at_placement * 0.5)
            ins_player = await db.get(Player, pick.player_id)
            if ins_player:
                ins_player.token_balance += payout
        else:
            pick.status = "wrong"

    await db.commit()

    from app.ws import manager
    await manager.broadcast({"type": "leaderboard_updated"})

    return {
        "settled": settled_count,
        "winner": winner_team,
        "golden_boot": golden_boot_player,
        "total_goals": total_goals,
    }


@router.post("/api/admin/matches/{match_id}/player-stats", status_code=200)
async def set_player_stats(
    match_id: int,
    data: dict,
    _=Depends(get_admin),
    db: AsyncSession = Depends(get_db),
):
    """Override player stats cache for a match and re-settle voided player_h2h challenges."""
    # 1. Load match → 404 if not found
    match = await db.get(Match, match_id)
    if not match:
        raise HTTPException(404, "match not found")

    # 2. Validate player_stats is a non-empty dict
    player_stats = data.get("player_stats")
    if not player_stats or not isinstance(player_stats, dict):
        raise HTTPException(400, "player_stats must be a non-empty dict")

    # 3. Normalize all keys
    normalised = {_normalize_name(k): v for k, v in player_stats.items()}

    # 4. Write to match.player_stats_cache
    match.player_stats_cache = json.dumps(normalised)

    # 5. Commit
    await db.commit()

    # 6. Re-settle voided player_h2h challenges if match is finished
    resettled = 0
    if match.status == "finished":
        voided_challenges = (await db.execute(
            select(Challenge).where(
                Challenge.match_id == match_id,
                Challenge.bet_type == "player_h2h",
                Challenge.status == "voided",
            )
        )).scalars().all()

        # 7. Re-settlement logic
        for ch in voided_challenges:
            result = determine_player_h2h_winner(
                ch.selection, ch.acceptor_selection, match.player_stats_cache
            )

            if result == "void":
                # Still void — leave as voided
                continue

            if result == "issuer":
                net_gain = int(ch.issuer_stake * ch.issuer_odds) - ch.issuer_stake
                if net_gain > 0:
                    issuer = await db.get(Player, ch.issuer_id)
                    if issuer:
                        issuer.token_balance += net_gain
                if ch.acceptor_id:
                    acceptor = await db.get(Player, ch.acceptor_id)
                    if acceptor:
                        acceptor.challenge_streak = 0

            elif result == "acceptor":
                net_gain = int(ch.acceptor_stake * ch.acceptor_odds) - ch.acceptor_stake
                if net_gain > 0:
                    acceptor = await db.get(Player, ch.acceptor_id)
                    if acceptor:
                        acceptor.token_balance += net_gain
                issuer = await db.get(Player, ch.issuer_id)
                if issuer:
                    issuer.challenge_streak = 0

            ch.status = "resolved"
            resettled += 1

        # 8. Commit re-settlements
        await db.commit()

    # 9. Return result
    return {"updated": True, "resettled": resettled}
