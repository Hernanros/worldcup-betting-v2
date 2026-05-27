from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.deps import get_current_player
from app.models import Match, Bet, Player

router = APIRouter()


@router.post("/api/matches/{match_id}/bets")
async def place_bet(match_id: int, data: dict, auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    player, _ = auth
    match = await db.get(Match, match_id)
    if not match:
        raise HTTPException(404, "match not found")
    if match.status != "upcoming":
        raise HTTPException(400, "betting is closed for this match")

    bet_type = data.get("bet_type")
    selection = data.get("selection")
    if not bet_type or not selection or "odds" not in data:
        raise HTTPException(400, "bet_type, selection, and odds are required")

    try:
        stake = int(data.get("stake", 0))
        odds = float(data["odds"])
    except (TypeError, ValueError):
        raise HTTPException(400, "invalid stake or odds")

    if stake < 1:
        raise HTTPException(400, "minimum stake is 1")
    if odds <= 0:
        raise HTTPException(400, "odds must be positive")

    player = await db.get(Player, player.id)
    if player.token_balance < stake:
        raise HTTPException(400, "insufficient balance")

    bet = Bet(
        player_id=player.id,
        match_id=match_id,
        bet_type=bet_type,
        selection=selection,
        stake=stake,
        odds_at_placement=odds,
    )
    player.token_balance -= stake
    db.add(bet)
    await db.commit()
    await db.refresh(bet)

    return {"id": bet.id, "new_balance": player.token_balance}


@router.get("/api/bets")
async def get_my_bets(auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    player, _ = auth
    rows = (await db.execute(
        select(Bet, Match)
        .join(Match, Bet.match_id == Match.id)
        .where(Bet.player_id == player.id)
        .order_by(Match.kickoff_time.desc())
    )).all()
    return [
        {
            "id": b.id,
            "match_id": b.match_id,
            "home_team": m.home_team,
            "away_team": m.away_team,
            "kickoff_time": m.kickoff_time.isoformat(),
            "match_status": m.status,
            "home_score": m.home_score,
            "away_score": m.away_score,
            "bet_type": b.bet_type,
            "selection": b.selection,
            "stake": b.stake,
            "odds": b.odds_at_placement,
            "status": b.status,
        }
        for b, m in rows
    ]
