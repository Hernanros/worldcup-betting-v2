from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.deps import get_current_player
from app.models import SpicyBet, SpicyDismissal, Player
from app.deep_cuts_config import (
    DEEP_CUTS_MARKETS, STAGE_ROUNDS, markets_for_stage,
    get_stage_lock_time,
)
from app.deep_cuts_settlement import get_stage_lock_time_from_db

router = APIRouter()

STAGE_ORDER = ["tournament", "group_stage", "r32", "r16", "qf", "sf", "final"]


async def _get_lock_time(stage: str, db: AsyncSession) -> Optional[datetime]:
    t = get_stage_lock_time(stage, db=None)
    if t:
        return t
    return await get_stage_lock_time_from_db(stage, db)


def _stage_status(lock_time: Optional[datetime]) -> str:
    if lock_time is None:
        return "open"
    now = datetime.now(timezone.utc)
    return "locked" if now >= lock_time else "open"


@router.get("/api/deep-cuts/stages")
async def get_stages(auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    result = []
    for stage in STAGE_ORDER:
        lock_time = await _get_lock_time(stage, db)
        market_count = len(markets_for_stage(stage))
        result.append({
            "stage":        stage,
            "status":       _stage_status(lock_time),
            "lock_time":    lock_time.isoformat() if lock_time else None,
            "market_count": market_count,
        })
    return {"stages": result}


@router.get("/api/deep-cuts/markets/{stage}")
async def get_markets(
    stage: str,
    auth=Depends(get_current_player),
    db: AsyncSession = Depends(get_db),
):
    if stage not in STAGE_ROUNDS:
        raise HTTPException(400, f"Unknown stage '{stage}'")
    lock_time = await _get_lock_time(stage, db)
    locked = _stage_status(lock_time) == "locked"
    markets = []
    for key, m in markets_for_stage(stage).items():
        entry = {
            "key":         key,
            "label":       m["label"],
            "description": m.get("description", ""),
            "type":        m["type"],
            "locked":      locked,
        }
        if m["type"] == "over_under":
            entry["lines"] = m["lines"]
        elif m["type"] == "exact_count":
            entry["options"] = [
                {"value": str(v), "odds": m["odds"][i]}
                for i, v in enumerate(m["options"])
            ]
        elif m["type"] == "yes_no":
            entry["options"] = [
                {"value": "yes", "odds": m["odds"]["yes"]},
                {"value": "no",  "odds": m["odds"]["no"]},
            ]
        elif m["type"] in ("team_pick", "text_pick"):
            entry["default_odds"] = m.get("default_odds", 10.0)
            if m.get("teams"):
                entry["teams"] = m["teams"]
        elif m["type"] == "group_advance":
            entry["teams"]        = m["teams"]
            entry["group"]        = m["group"]
            entry["default_odds"] = m.get("default_odds", 1.5)
        markets.append(entry)
    return {
        "stage":     stage,
        "locked":    locked,
        "lock_time": lock_time.isoformat() if lock_time else None,
        "markets":   markets,
    }


@router.post("/api/deep-cuts/bets")
async def place_spicy_bet(
    data: dict,
    auth=Depends(get_current_player),
    db: AsyncSession = Depends(get_db),
):
    player, _ = auth
    market_key = data.get("market_key")
    stage      = data.get("stage")
    selection  = data.get("selection")

    if not all([market_key, stage, selection]):
        raise HTTPException(400, "market_key, stage, and selection are required")
    if market_key not in DEEP_CUTS_MARKETS:
        raise HTTPException(400, f"Unknown market '{market_key}'")
    if stage not in STAGE_ROUNDS:
        raise HTTPException(400, f"Unknown stage '{stage}'")
    if DEEP_CUTS_MARKETS[market_key]["stage"] != stage:
        raise HTTPException(400, f"market '{market_key}' does not belong to stage '{stage}'")

    lock_time = await _get_lock_time(stage, db)
    if lock_time and datetime.now(timezone.utc) >= lock_time:
        raise HTTPException(400, f"Stage '{stage}' is locked — bets are closed")

    try:
        stake = int(data.get("stake", 0))
        odds  = float(data.get("odds", 2.0))
    except (TypeError, ValueError):
        raise HTTPException(400, "invalid stake or odds")

    if stake < 1:
        raise HTTPException(400, "minimum stake is 1")

    fresh_player = await db.get(Player, player.id)
    if fresh_player.token_balance < stake:
        raise HTTPException(400, "insufficient balance")

    bet = SpicyBet(
        player_id         = fresh_player.id,
        league_id         = fresh_player.league_id,
        market_key        = market_key,
        stage             = stage,
        selection         = selection,
        stake             = stake,
        odds_at_placement = odds,
    )
    fresh_player.token_balance -= stake
    db.add(bet)
    await db.commit()
    await db.refresh(bet)
    return {"id": bet.id, "new_balance": player.token_balance}


@router.get("/api/deep-cuts/bets")
async def get_my_bets(auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    player, _ = auth
    bets = (await db.execute(
        select(SpicyBet).where(SpicyBet.player_id == player.id)
    )).scalars().all()
    return {"bets": [
        {
            "id":         b.id,
            "market_key": b.market_key,
            "stage":      b.stage,
            "selection":  b.selection,
            "stake":      b.stake,
            "odds":       b.odds_at_placement,
            "status":     b.status,
        }
        for b in bets
    ]}


@router.post("/api/deep-cuts/dismiss/{stage}")
async def dismiss_banner(
    stage: str,
    auth=Depends(get_current_player),
    db: AsyncSession = Depends(get_db),
):
    player, _ = auth
    existing = (await db.execute(
        select(SpicyDismissal).where(
            SpicyDismissal.player_id == player.id,
            SpicyDismissal.stage == stage,
        )
    )).scalar_one_or_none()
    if not existing:
        db.add(SpicyDismissal(player_id=player.id, stage=stage))
        await db.commit()
    return {"ok": True}


@router.get("/api/deep-cuts/banner")
async def get_banner(auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    """Returns stages that are currently open AND the player hasn't dismissed."""
    player, _ = auth
    dismissed = {
        d.stage for d in (await db.execute(
            select(SpicyDismissal).where(SpicyDismissal.player_id == player.id)
        )).scalars().all()
    }
    open_stages = []
    for stage in STAGE_ORDER:
        if stage in dismissed:
            continue
        lock_time = await _get_lock_time(stage, db)
        if _stage_status(lock_time) == "open":
            open_stages.append({
                "stage":        stage,
                "lock_time":    lock_time.isoformat() if lock_time else None,
                "market_count": len(markets_for_stage(stage)),
            })
    return {"open_stages": open_stages}
