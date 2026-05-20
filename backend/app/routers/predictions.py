from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.deps import get_current_player
from app.models import Match, Prediction

router = APIRouter()


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
            "round": m.round, "home_team_confirmed": m.home_team_confirmed,
            "away_team_confirmed": m.away_team_confirmed,
            "home_score": m.home_score, "away_score": m.away_score,
            "my_prediction": {
                "home_score_pred": pred.home_score_pred, "away_score_pred": pred.away_score_pred,
                "status": pred.status, "points_awarded": pred.points_awarded,
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

    existing = (await db.execute(
        select(Prediction).where(Prediction.player_id == player.id, Prediction.match_id == data["match_id"])
    )).scalar_one_or_none()

    if existing:
        existing.home_score_pred = int(data["home_score_pred"])
        existing.away_score_pred = int(data["away_score_pred"])
        pred = existing
    else:
        pred = Prediction(
            player_id=player.id, match_id=data["match_id"],
            home_score_pred=int(data["home_score_pred"]),
            away_score_pred=int(data["away_score_pred"]),
        )
        db.add(pred)

    await db.commit()
    await db.refresh(pred)
    return {"id": pred.id, "home_score_pred": pred.home_score_pred,
            "away_score_pred": pred.away_score_pred, "status": pred.status,
            "points_awarded": pred.points_awarded}
