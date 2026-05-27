from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.deps import get_current_player
from app.models import Match, Challenge, Player
from app.bravery import streak_bonus_pct, check_volume_milestone

router = APIRouter()


@router.post("/api/matches/{match_id}/challenges")
async def issue_challenge(match_id: int, data: dict, auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    player, _ = auth
    match = await db.get(Match, match_id)
    if not match or match.status != "upcoming":
        raise HTTPException(400, "match not open for challenges")

    try:
        issuer_stake = int(data["issuer_stake"])
        issuer_odds = float(data["issuer_odds"])
        acceptor_odds = float(data["acceptor_odds"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(400, "issuer_stake, issuer_odds, and acceptor_odds are required")

    if issuer_odds <= 0 or acceptor_odds <= 0 or issuer_stake < 1:
        raise HTTPException(400, "invalid stake or odds")

    bet_type = (data.get("bet_type") or "").strip()
    selection = (data.get("selection") or "").strip()
    acceptor_selection = (data.get("acceptor_selection") or "").strip()
    if not bet_type or not selection or not acceptor_selection:
        raise HTTPException(400, "bet_type, selection, and acceptor_selection are required")

    acceptor_stake = max(1, round(issuer_stake * (issuer_odds / acceptor_odds)))

    player = await db.get(Player, player.id)
    if player.token_balance < issuer_stake:
        raise HTTPException(400, "insufficient balance")

    player.total_challenges_issued += 1
    player.challenge_streak += 1

    bonus_tokens, new_milestone = check_volume_milestone(player.total_challenges_issued, player.volume_milestone_reached)
    if bonus_tokens:
        player.token_balance += bonus_tokens
        player.volume_milestone_reached = new_milestone

    player.token_balance -= issuer_stake

    challenge = Challenge(
        issuer_id=player.id,
        match_id=match_id,
        bet_type=bet_type,
        selection=selection,
        acceptor_selection=acceptor_selection,
        issuer_stake=issuer_stake,
        acceptor_stake=acceptor_stake,
        issuer_odds=issuer_odds,
        acceptor_odds=acceptor_odds,
        bravery_streak_bonus_pct=streak_bonus_pct(player.challenge_streak),
    )
    db.add(challenge)
    await db.commit()
    await db.refresh(challenge)

    return {"id": challenge.id, "acceptor_stake": acceptor_stake,
            "new_balance": player.token_balance, "volume_bonus_awarded": bonus_tokens}


@router.post("/api/challenges/{challenge_id}/accept")
async def accept_challenge(challenge_id: int, auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    player, _ = auth
    challenge = await db.get(Challenge, challenge_id)
    if not challenge or challenge.status != "open":
        raise HTTPException(400, "challenge not available")
    if challenge.issuer_id == player.id:
        raise HTTPException(400, "cannot accept your own challenge")

    # Enforce same-league rule
    issuer = await db.get(Player, challenge.issuer_id)
    if issuer.league_id != player.league_id:
        raise HTTPException(403, "challenge belongs to a different league")

    player = await db.get(Player, player.id)
    if player.token_balance < challenge.acceptor_stake:
        raise HTTPException(400, "insufficient balance")

    player.token_balance -= challenge.acceptor_stake
    challenge.acceptor_id = player.id
    challenge.status = "accepted"
    await db.commit()

    return {"id": challenge.id, "new_balance": player.token_balance}
