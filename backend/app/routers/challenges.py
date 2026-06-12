from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
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

    # Prevent duplicate: same player, same match, same bet_type + selection already open
    duplicate = (await db.execute(
        select(Challenge).where(
            Challenge.issuer_id == player.id,
            Challenge.match_id == match_id,
            Challenge.bet_type == bet_type,
            Challenge.selection == selection,
            Challenge.status == "open",
        )
    )).scalar_one_or_none()
    if duplicate:
        raise HTTPException(400, "You already have this exact bet open for this match — cancel it first if you want to change it")

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

    addressee_id = data.get("addressee_id")
    if addressee_id is not None:
        try:
            addressee_id = int(addressee_id)
        except (TypeError, ValueError):
            addressee_id = None

    challenge = Challenge(
        issuer_id=player.id,
        addressee_id=addressee_id,
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

    # P0 fix: block post-kickoff acceptance
    match = await db.get(Match, challenge.match_id)
    if not match or match.status != "upcoming":
        raise HTTPException(400, "match has already kicked off — challenge is closed")

    # Enforce same-league rule
    issuer = await db.get(Player, challenge.issuer_id)
    if issuer.league_id != player.league_id:
        raise HTTPException(403, "challenge belongs to a different league")

    player = await db.get(Player, player.id)
    if player.token_balance < challenge.acceptor_stake:
        raise HTTPException(400, "insufficient balance")

    player.token_balance -= challenge.acceptor_stake
    player.challenge_streak += 1   # P1: acceptor earns streak credit for accepting
    challenge.acceptor_id = player.id
    challenge.status = "accepted"
    await db.commit()

    return {"id": challenge.id, "new_balance": player.token_balance}


@router.delete("/api/challenges/{challenge_id}")
async def cancel_challenge(challenge_id: int, auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    """Cancel an open challenge and refund the issuer's stake."""
    player, _ = auth
    challenge = await db.get(Challenge, challenge_id)
    if not challenge:
        raise HTTPException(404, "challenge not found")
    if challenge.issuer_id != player.id:
        raise HTTPException(403, "only the issuer can cancel a challenge")
    if challenge.status != "open":
        raise HTTPException(400, f"cannot cancel a '{challenge.status}' challenge")

    fresh_player = await db.get(Player, player.id)
    fresh_player.token_balance += challenge.issuer_stake
    challenge.status = "cancelled"
    await db.commit()

    return {"refunded": challenge.issuer_stake, "new_balance": fresh_player.token_balance}


@router.get("/api/challenges")
async def list_my_challenges(auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    """Return open challenges: issued by me (my_open) and available to accept (for_me)."""
    player, _ = auth

    if player.league_id is not None:
        league_player_ids = (await db.execute(
            select(Player.id).where(Player.league_id == player.league_id)
        )).scalars().all()
        open_q = select(Challenge).where(
            Challenge.status == "open",
            Challenge.issuer_id.in_(league_player_ids),
        )
    else:
        open_q = select(Challenge).where(Challenge.status == "open")

    # Only include challenges addressed to me (or open to anyone)
    open_q = open_q.where(
        (Challenge.addressee_id == None) | (Challenge.addressee_id == player.id)  # noqa: E711
    )

    open_challenges = (await db.execute(open_q)).scalars().all()

    match_ids  = list({c.match_id  for c in open_challenges})
    issuer_ids = list({c.issuer_id for c in open_challenges})

    matches: dict[int, Match] = {}
    if match_ids:
        match_rows = (await db.execute(select(Match).where(Match.id.in_(match_ids)))).scalars().all()
        matches = {m.id: m for m in match_rows}

    player_names: dict[int, str] = {}
    if issuer_ids:
        name_rows = (await db.execute(select(Player.id, Player.name).where(Player.id.in_(issuer_ids)))).all()
        player_names = {row.id: row.name for row in name_rows}

    addressee_ids = list({c.addressee_id for c in open_challenges if c.addressee_id})
    addressee_names: dict[int, str] = {}
    if addressee_ids:
        addr_rows = (await db.execute(select(Player.id, Player.name).where(Player.id.in_(addressee_ids)))).all()
        addressee_names = {row.id: row.name for row in addr_rows}

    my_open = []
    for_me = []
    for c in open_challenges:
        m = matches.get(c.match_id)
        entry = {
            "id": c.id,
            "match_id": c.match_id,
            "match_home_team": m.home_team if m else "",
            "match_away_team": m.away_team if m else "",
            "kickoff_time": m.kickoff_time.isoformat() if m else None,
            "bet_type": c.bet_type,
            "selection": c.selection,
            "acceptor_selection": c.acceptor_selection,
            "issuer_stake": c.issuer_stake,
            "acceptor_stake": c.acceptor_stake,
            "issuer_odds": c.issuer_odds,
            "acceptor_odds": c.acceptor_odds,
            "issuer_name": player_names.get(c.issuer_id, ""),
            "addressee_name": addressee_names.get(c.addressee_id) if c.addressee_id else None,
        }
        if c.issuer_id == player.id:
            my_open.append(entry)
        else:
            for_me.append(entry)

    return {"my_open": my_open, "for_me": for_me}


@router.get("/api/friends")
async def list_friends(auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    """Return all other players in the same league — used to populate the friend picker."""
    player, _ = auth
    if player.league_id is None:
        return []
    rows = (await db.execute(
        select(Player.id, Player.name)
        .where(Player.league_id == player.league_id, Player.id != player.id)
        .order_by(Player.name)
    )).all()
    return [{"id": row.id, "name": row.name} for row in rows]
