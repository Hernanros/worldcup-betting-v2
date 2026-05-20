from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.deps import get_current_player
from app.models import TournamentBet, Player

router = APIRouter()

TOURNAMENT_LOCK_TIME = datetime(2026, 6, 11, 18, 0, 0, tzinfo=timezone.utc)


@router.post("/api/tournament/bets")
async def place_tournament_bet(data: dict, auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    if datetime.now(timezone.utc) >= TOURNAMENT_LOCK_TIME:
        raise HTTPException(400, "Tournament bets are locked — the tournament has started")

    player, _ = auth
    bet_type = data.get("bet_type")
    selection = data.get("selection")
    if not bet_type or not selection:
        raise HTTPException(400, "bet_type and selection are required")
    if bet_type not in ("winner", "golden_boot", "total_goals"):
        raise HTTPException(400, "bet_type must be winner, golden_boot, or total_goals")

    try:
        stake = int(data.get("stake", 0))
        odds = float(data.get("odds", 5.0))
    except (TypeError, ValueError):
        raise HTTPException(400, "invalid stake or odds")

    if stake < 1:
        raise HTTPException(400, "minimum stake is 1")

    player = await db.get(Player, player.id)
    if player.token_balance < stake:
        raise HTTPException(400, "insufficient balance")

    tbet = TournamentBet(player_id=player.id, bet_type=bet_type, selection=selection,
                         stake=stake, odds_at_placement=odds)
    player.token_balance -= stake
    db.add(tbet)
    await db.commit()
    await db.refresh(tbet)
    return {"id": tbet.id, "new_balance": player.token_balance}


@router.get("/api/tournament/bets")
async def get_tournament_bets(auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    player, _ = auth
    bets = (await db.execute(
        select(TournamentBet).where(TournamentBet.player_id == player.id)
    )).scalars().all()
    return {
        "locked": datetime.now(timezone.utc) >= TOURNAMENT_LOCK_TIME,
        "lock_time": TOURNAMENT_LOCK_TIME.isoformat(),
        "my_bets": [{"id": b.id, "bet_type": b.bet_type, "selection": b.selection,
                     "stake": b.stake, "odds": b.odds_at_placement, "status": b.status}
                    for b in bets],
    }
