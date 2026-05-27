from fastapi import APIRouter, Depends
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.deps import get_current_player
from app.models import Player, Match

router = APIRouter()


@router.get("/api/leaderboard")
async def leaderboard(auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    player, _ = auth
    query = select(Player).order_by(desc(Player.token_balance))
    if player.league_id is not None:
        query = query.where(Player.league_id == player.league_id)
    players = (await db.execute(query)).scalars().all()
    result = []
    for i, p in enumerate(players):
        rank = result[i - 1]["rank"] if i > 0 and players[i - 1].token_balance == p.token_balance else i + 1
        result.append({"id": p.id, "name": p.name, "token_balance": p.token_balance,
                        "challenge_streak": p.challenge_streak, "rank": rank})
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
