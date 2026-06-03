"""
Deep Cuts settlement engine.
settle_stage(stage, db) is called once all matches in a stage are finished.
"""
import logging
import unicodedata
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Match, Player, SpicyBet
from app.deep_cuts_config import DEEP_CUTS_MARKETS, STAGE_ROUNDS, WC2026_GROUPS

logger = logging.getLogger(__name__)


async def get_stage_lock_time_from_db(stage: str, db: AsyncSession):
    """Returns MIN(kickoff_time) for the given stage's round."""
    from app.deep_cuts_config import get_stage_lock_time
    hardcoded = get_stage_lock_time(stage, db=None)
    if hardcoded:
        return hardcoded
    round_ = STAGE_ROUNDS.get(stage)
    if not round_:
        return None
    result = await db.execute(
        select(func.min(Match.kickoff_time)).where(Match.round == round_)
    )
    return result.scalar_one_or_none()


async def _get_stage_matches(stage: str, db: AsyncSession):
    round_ = STAGE_ROUNDS.get(stage)
    if round_ is None:
        # "tournament" -> all matches
        result = await db.execute(select(Match).where(Match.status == "finished"))
    else:
        result = await db.execute(
            select(Match).where(Match.round == round_, Match.status == "finished")
        )
    return result.scalars().all()


def _sum_fields(matches, field_expr: str) -> float:
    """Sum one or two Match fields across all matches. e.g. 'home_score+away_score'"""
    total = 0
    for m in matches:
        for fname in field_expr.split("+"):
            total += getattr(m, fname.strip(), 0) or 0
    return total


def _normalize_name(name: str) -> str:
    """Lowercase + strip accents for fuzzy player name matching."""
    nfkd = unicodedata.normalize("NFKD", name.lower())
    return "".join(c for c in nfkd if not unicodedata.combining(c)).strip()


def _evaluate_bet(market: dict, selection: str, matches) -> bool:
    """Returns True if this selection wins given the match data."""
    settle = market["settle"]

    # -- sum_field: over/under -----------------------------------------------
    if settle == "sum_field":
        total = _sum_fields(matches, market["field"])
        # selection is like "Over 2.5" or "Under 139.5"
        parts = selection.split()
        direction, line = parts[0].lower(), float(parts[1])
        return total > line if direction == "over" else total < line

    # -- count_went_to_et / count_went_to_pens: exact count ------------------
    if settle == "count_went_to_et":
        count = sum(1 for m in matches if m.went_to_et)
        return int(selection) == count

    if settle == "count_went_to_pens":
        count = sum(1 for m in matches if m.went_to_pens)
        return int(selection) == count

    # -- count_field: sum then exact count -----------------------------------
    if settle == "count_field":
        total = int(_sum_fields(matches, market["field"]))
        # "2+" means 2 or more
        if selection.endswith("+"):
            return total >= int(selection[:-1])
        try:
            return int(selection) == total
        except ValueError:
            return False

    # -- any_went_to_et / any_went_to_pens: yes/no ---------------------------
    if settle == "any_went_to_et":
        result = any(m.went_to_et for m in matches)
        return selection.lower() == ("yes" if result else "no")

    if settle == "any_went_to_pens":
        result = any(m.went_to_pens for m in matches)
        return selection.lower() == ("yes" if result else "no")

    # -- top_goals_team -------------------------------------------------------
    if settle == "top_goals_team":
        scores = {}
        for m in matches:
            scores[m.home_team] = scores.get(m.home_team, 0) + (m.home_score or 0)
            scores[m.away_team] = scores.get(m.away_team, 0) + (m.away_score or 0)
        if not scores:
            return False
        max_val = max(scores.values())
        winners = {t for t, s in scores.items() if s == max_val}
        return selection in winners

    # -- top_red_cards_team ---------------------------------------------------
    if settle == "top_red_cards_team":
        reds = {}
        for m in matches:
            reds[m.home_team] = reds.get(m.home_team, 0) + (m.home_red_cards or 0)
            reds[m.away_team] = reds.get(m.away_team, 0) + (m.away_red_cards or 0)
        if not reds:
            return False
        max_val = max(reds.values())
        return selection in {t for t, v in reds.items() if v == max_val}

    # -- min_conceded_team (clean sheet race) ---------------------------------
    if settle == "min_conceded_team":
        conceded = {}
        for m in matches:
            conceded[m.home_team] = conceded.get(m.home_team, 0) + (m.away_score or 0)
            conceded[m.away_team] = conceded.get(m.away_team, 0) + (m.home_score or 0)
        if not conceded:
            return False
        min_val = min(conceded.values())
        return selection in {t for t, v in conceded.items() if v == min_val}

    # -- max_conceded_team ----------------------------------------------------
    if settle == "max_conceded_team":
        conceded = {}
        for m in matches:
            conceded[m.home_team] = conceded.get(m.home_team, 0) + (m.away_score or 0)
            conceded[m.away_team] = conceded.get(m.away_team, 0) + (m.home_score or 0)
        if not conceded:
            return False
        max_val = max(conceded.values())
        return selection in {t for t, v in conceded.items() if v == max_val}

    # -- top_corners_team -----------------------------------------------------
    if settle == "top_corners_team":
        corners = {}
        for m in matches:
            corners[m.home_team] = corners.get(m.home_team, 0) + (m.home_corners or 0)
            corners[m.away_team] = corners.get(m.away_team, 0) + (m.away_corners or 0)
        if not corners:
            return False
        max_val = max(corners.values())
        return selection in {t for t, v in corners.items() if v == max_val}

    # -- count_high_scoring ---------------------------------------------------
    if settle == "count_high_scoring":
        threshold = market.get("threshold", 3)
        count = sum(1 for m in matches if (m.home_score or 0) + (m.away_score or 0) >= threshold)
        parts = selection.split()
        direction, line = parts[0].lower(), float(parts[1])
        return count > line if direction == "over" else count < line

    # -- best_group_team ------------------------------------------------------
    if settle == "best_group_team":
        return _is_best_group_team(selection, matches, best=True)

    # -- group_advance --------------------------------------------------------
    if settle == "group_advance":
        group = market.get("group", "A")
        return _check_group_advance(selection, group, matches)

    # -- most_exhausted -------------------------------------------------------
    # Settled separately via settle_most_exhausted() - not called from here
    return False


def _compute_group_standings(group: str, matches) -> list:
    """
    Compute group standings for one group using WC tiebreaker:
    points -> GD -> GS -> -RC -> -YC -> alphabetical (stable proxy for coinflip).
    Returns list of dicts sorted best->worst.
    """
    teams = WC2026_GROUPS[group]
    stats = {t: {"pts": 0, "gd": 0, "gs": 0, "rc": 0, "yc": 0} for t in teams}
    for m in matches:
        if m.home_team not in stats or m.away_team not in stats:
            continue
        hs, as_ = m.home_score or 0, m.away_score or 0
        stats[m.home_team]["gs"] += hs
        stats[m.away_team]["gs"] += as_
        stats[m.home_team]["gd"] += hs - as_
        stats[m.away_team]["gd"] += as_ - hs
        stats[m.home_team]["rc"] += m.home_red_cards or 0
        stats[m.away_team]["rc"] += m.away_red_cards or 0
        stats[m.home_team]["yc"] += m.home_yellow_cards or 0
        stats[m.away_team]["yc"] += m.away_yellow_cards or 0
        if hs > as_:
            stats[m.home_team]["pts"] += 3
        elif hs == as_:
            stats[m.home_team]["pts"] += 1
            stats[m.away_team]["pts"] += 1
        else:
            stats[m.away_team]["pts"] += 3

    return sorted(
        [{"team": t, **s} for t, s in stats.items()],
        key=lambda x: (-x["pts"], -x["gd"], -x["gs"], x["rc"], x["yc"], x["team"]),
    )


def _check_group_advance(selection: str, group: str, all_matches) -> bool:
    """
    selection = "Spain,Morocco" (comma-separated, any order)
    A bet wins if both selected teams finish in the top 2 of their group.
    """
    selected = {s.strip() for s in selection.split(",")}
    group_matches = [
        m for m in all_matches
        if m.home_team in WC2026_GROUPS[group] and m.away_team in WC2026_GROUPS[group]
    ]
    standings = _compute_group_standings(group, group_matches)
    top2 = {standings[0]["team"], standings[1]["team"]}
    return selected == top2


def _is_best_group_team(selection: str, all_group_matches, best: bool = True) -> bool:
    """Rank all group stage teams; check if selection is the best."""
    all_teams = set()
    for teams in WC2026_GROUPS.values():
        all_teams.update(teams)

    agg = {t: {"pts": 0, "gd": 0, "gs": 0, "rc": 0, "yc": 0} for t in all_teams}
    for m in all_group_matches:
        if m.home_team not in agg or m.away_team not in agg:
            continue
        hs, as_ = m.home_score or 0, m.away_score or 0
        agg[m.home_team]["gs"] += hs
        agg[m.away_team]["gs"] += as_
        agg[m.home_team]["gd"] += hs - as_
        agg[m.away_team]["gd"] += as_ - hs
        agg[m.home_team]["rc"] += m.home_red_cards or 0
        agg[m.away_team]["rc"] += m.away_red_cards or 0
        agg[m.home_team]["yc"] += m.home_yellow_cards or 0
        agg[m.away_team]["yc"] += m.away_yellow_cards or 0
        if hs > as_:
            agg[m.home_team]["pts"] += 3
        elif hs == as_:
            agg[m.home_team]["pts"] += 1
            agg[m.away_team]["pts"] += 1
        else:
            agg[m.away_team]["pts"] += 3

    ranked = sorted(
        all_teams,
        key=lambda t: (-agg[t]["pts"], -agg[t]["gd"], -agg[t]["gs"],
                       agg[t]["rc"], agg[t]["yc"], t),
    )
    target = ranked[0] if best else ranked[-1]
    return selection == target


async def settle_stage(stage: str, db: AsyncSession) -> int:
    """
    Settle all pending SpicyBets for this stage.
    Returns number of bets settled.
    Caller must commit after this returns.
    """
    if stage == "most_exhausted":
        # Settled separately via settle_most_exhausted()
        return 0

    matches = await _get_stage_matches(stage, db)
    pending_bets = (await db.execute(
        select(SpicyBet).where(SpicyBet.stage == stage, SpicyBet.status == "pending")
    )).scalars().all()

    settled = 0
    for bet in pending_bets:
        market = DEEP_CUTS_MARKETS.get(bet.market_key)
        if not market:
            logger.warning("Unknown market_key %s on bet %d - skipping", bet.market_key, bet.id)
            continue

        won = _evaluate_bet(market, bet.selection, matches)
        bet.status = "won" if won else "lost"
        if won:
            player = await db.get(Player, bet.player_id)
            if player:
                # Stake was already deducted at bet placement; only add winnings here
                player.token_balance += int(bet.stake * bet.odds_at_placement)
        settled += 1

    logger.info("settle_stage(%s): settled %d bets, %d matches", stage, settled, len(matches))
    return settled


async def settle_most_exhausted(db: AsyncSession, api_key: str) -> int:
    """
    Called once after the Final. Fetches player minutes from API-Football.
    Returns number of bets settled.
    Caller must commit.
    """
    import requests as _requests

    max_minutes, winner_name = 0, ""
    page = 1
    while True:
        try:
            resp = _requests.get(
                "https://v3.football.api-sports.io/players",
                params={"league": "1", "season": "2026", "page": page},
                headers={"x-apisports-key": api_key},
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            players = data.get("response", [])
            if not players:
                break
            for p in players:
                mins = (p.get("statistics") or [{}])[0].get("games", {}).get("minutes") or 0
                if mins > max_minutes:
                    max_minutes = mins
                    name = p.get("player", {})
                    winner_name = "{} {}".format(
                        name.get("firstname", ""), name.get("lastname", "")
                    ).strip()
            paging = data.get("paging", {})
            if page >= paging.get("total", 1):
                break
            page += 1
        except Exception as e:
            logger.warning("API-Football players page %d failed: %s", page, e)
            break

    if not winner_name:
        logger.warning("settle_most_exhausted: could not determine winner")
        return 0

    pending = (await db.execute(
        select(SpicyBet).where(
            SpicyBet.market_key == "most_exhausted",
            SpicyBet.status == "pending",
        )
    )).scalars().all()

    settled = 0
    norm_winner = _normalize_name(winner_name)
    for bet in pending:
        won = _normalize_name(bet.selection) == norm_winner
        bet.status = "won" if won else "lost"
        if won:
            player = await db.get(Player, bet.player_id)
            if player:
                # Stake was already deducted at bet placement; only add winnings here
                player.token_balance += int(bet.stake * bet.odds_at_placement)
        settled += 1

    logger.info("settle_most_exhausted: winner=%s (%d min), settled %d bets",
                winner_name, max_minutes, settled)
    return settled
