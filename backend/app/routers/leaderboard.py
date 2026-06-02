from fastapi import APIRouter, Depends
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.deps import get_current_player
from app.models import Player, Match, Prediction

router = APIRouter()


async def _prediction_pts_by_player(db: AsyncSession, league_id) -> dict:
    """Return mapping of player_id → total prediction points, scoped to league."""
    stmt = (
        select(Prediction.player_id, func.coalesce(func.sum(Prediction.points_awarded), 0).label("pts"))
        .join(Player, Player.id == Prediction.player_id)
        .group_by(Prediction.player_id)
    )
    if league_id is not None:
        stmt = stmt.where(Player.league_id == league_id)
    rows = (await db.execute(stmt)).all()
    return {row.player_id: int(row.pts) for row in rows}


@router.get("/api/leaderboard")
async def leaderboard(auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    player, _ = auth
    query = select(Player).order_by(desc(Player.token_balance))
    if player.league_id is not None:
        query = query.where(Player.league_id == player.league_id)
    players = (await db.execute(query)).scalars().all()

    pts_map = await _prediction_pts_by_player(db, player.league_id)

    result = []
    for i, p in enumerate(players):
        rank = result[i - 1]["rank"] if i > 0 and players[i - 1].token_balance == p.token_balance else i + 1
        result.append({
            "id": p.id,
            "name": p.name,
            "token_balance": p.token_balance,
            "challenge_streak": p.challenge_streak,
            "rank": rank,
            "prediction_pts": pts_map.get(p.id, 0),
        })
    return result


@router.get("/api/leaderboard/predictions")
async def predictions_leaderboard(auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    """Players ranked by total prediction points (correct score = 3, correct outcome = 1)."""
    player, _ = auth
    stmt = (
        select(
            Player,
            func.coalesce(func.sum(Prediction.points_awarded), 0).label("pts")
        )
        .outerjoin(Prediction, Prediction.player_id == Player.id)
        .group_by(Player.id)
        .order_by(desc("pts"))
    )
    if league_id := player.league_id:
        stmt = stmt.where(Player.league_id == league_id)
    rows = (await db.execute(stmt)).all()

    result = []
    for i, (p, pts) in enumerate(rows):
        prev_pts = rows[i - 1][1] if i > 0 else None
        rank = result[i - 1]["rank"] if i > 0 and prev_pts == pts else i + 1
        result.append({
            "id": p.id,
            "name": p.name,
            "token_balance": p.token_balance,
            "challenge_streak": p.challenge_streak,
            "rank": rank,
            "prediction_pts": int(pts),
        })
    return result


@router.get("/api/leaderboard/red-cards")
async def red_cards_leaderboard(auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    matches = (await db.execute(select(Match).where(Match.status == "finished"))).scalars().all()
    tally: dict[str, int] = {}
    for m in matches:
        tally[m.home_team] = tally.get(m.home_team, 0) + (m.home_red_cards or 0)
        tally[m.away_team] = tally.get(m.away_team, 0) + (m.away_red_cards or 0)
    ranked = sorted(tally.items(), key=lambda x: x[1], reverse=True)
    return [{"team": team, "red_cards": count, "rank": i + 1}
            for i, (team, count) in enumerate(ranked)]
