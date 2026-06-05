from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.deps import get_current_player
from app.models import Match, Prediction
from app.deep_cuts_config import WC2026_GROUPS
from fastapi.responses import Response

router = APIRouter()

_TEAM_TO_GROUP: dict[str, str] = {
    team: letter
    for letter, teams in WC2026_GROUPS.items()
    for team in teams
}


@router.get("/api/predictions")
async def get_predictions(auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    player, _ = auth
    matches = (await db.execute(select(Match).order_by(Match.kickoff_time))).scalars().all()
    my_preds = {
        p.match_id: p
        for p in (await db.execute(select(Prediction).where(Prediction.player_id == player.id))).scalars().all()
    }
    result = []
    for m in matches:
        pred = my_preds.get(m.id)
        result.append({
            "match_id": m.id, "home_team": m.home_team, "away_team": m.away_team,
            "kickoff_time": m.kickoff_time.isoformat(), "status": m.status,
            "round": m.round,
            "group": _TEAM_TO_GROUP.get(m.home_team) if m.round == "group" else None,
            "home_team_confirmed": m.home_team_confirmed,
            "away_team_confirmed": m.away_team_confirmed,
            "home_score": m.home_score, "away_score": m.away_score,
            "my_prediction": {
                "home_score_pred": pred.home_score_pred,
                "away_score_pred": pred.away_score_pred,
                "status": pred.status,
                "points_awarded": pred.points_awarded,
                "is_double": pred.is_double,
            } if pred else None,
        })
    return result


@router.post("/api/predictions")
async def save_prediction(data: dict, auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    player, _ = auth
    match = await db.get(Match, data["match_id"])
    if not match:
        raise HTTPException(404, "match not found")
    if match.status == "finished":
        raise HTTPException(400, "match already finished")
    if not match.home_team_confirmed or not match.away_team_confirmed:
        raise HTTPException(400, "teams not yet confirmed")

    is_double = bool(data.get("is_double", False))

    existing = (await db.execute(
        select(Prediction).where(
            Prediction.player_id == player.id,
            Prediction.match_id == data["match_id"],
        )
    )).scalar_one_or_none()

    # Only check limit when newly activating is_double (not when updating existing double)
    currently_double = existing.is_double if existing else False
    if is_double and not currently_double:
        doubles_used = (await db.execute(
            select(func.count(Prediction.id)).where(
                Prediction.player_id == player.id,
                Prediction.is_double == True,  # noqa: E712
            )
        )).scalar() or 0
        if doubles_used >= 3:
            raise HTTPException(400, "You have already used all 3 double-point picks")

    if existing:
        existing.home_score_pred = int(data["home_score_pred"])
        existing.away_score_pred = int(data["away_score_pred"])
        existing.is_double = is_double
        pred = existing
    else:
        pred = Prediction(
            player_id=player.id,
            match_id=data["match_id"],
            home_score_pred=int(data["home_score_pred"]),
            away_score_pred=int(data["away_score_pred"]),
            is_double=is_double,
        )
        db.add(pred)

    await db.commit()
    await db.refresh(pred)

    doubles_used_after = (await db.execute(
        select(func.count(Prediction.id)).where(
            Prediction.player_id == player.id,
            Prediction.is_double == True,  # noqa: E712
        )
    )).scalar() or 0

    return {
        "id": pred.id,
        "home_score_pred": pred.home_score_pred,
        "away_score_pred": pred.away_score_pred,
        "status": pred.status,
        "points_awarded": pred.points_awarded,
        "is_double": pred.is_double,
        "doubles_used": doubles_used_after,
    }


@router.delete("/api/predictions/{match_id}")
async def delete_prediction(match_id: int, auth=Depends(get_current_player), db: AsyncSession = Depends(get_db)):
    player, _ = auth
    match = await db.get(Match, match_id)
    if not match:
        raise HTTPException(404, "match not found")
    if match.status in ("finished", "locked"):
        raise HTTPException(400, "cannot delete a prediction after the match has kicked off")

    pred = (await db.execute(
        select(Prediction).where(
            Prediction.player_id == player.id,
            Prediction.match_id  == match_id,
        )
    )).scalar_one_or_none()
    if not pred:
        raise HTTPException(404, "no prediction found for this match")

    await db.delete(pred)
    await db.commit()
    return Response(status_code=204)
