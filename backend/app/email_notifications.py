"""
Email reminders for unsubmitted match predictions.
Uses Resend (https://resend.com) — set RESEND_API_KEY in Railway env vars.
Silently skips if the key is not configured.
"""
import logging
from datetime import datetime, timezone, timedelta

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Match, Player, Prediction

logger = logging.getLogger(__name__)

_FROM = "WC Betting <notifications@worldcupbetting.app>"


def _match_time_local(kickoff_utc: datetime) -> str:
    """Format kickoff as readable local time string (UTC shown)."""
    return kickoff_utc.strftime("%A %b %-d, %H:%M UTC")


def _build_email_html(player_name: str, matches: list[dict], app_url: str) -> str:
    rows = ""
    for m in matches:
        rows += f"""
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #2d2b55;color:#e2e8f0;font-size:14px;">
            {m['home_team']} <span style="color:#6b7280">vs</span> {m['away_team']}
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #2d2b55;color:#9ca3af;font-size:13px;text-align:right;">
            {m['time']}
          </td>
        </tr>"""

    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background:#0d0d1a;font-family:system-ui,sans-serif;margin:0;padding:0;">
  <div style="max-width:480px;margin:0 auto;padding:32px 20px;">
    <h1 style="color:#a78bfa;font-size:22px;margin:0 0 6px;">⚽ Score Reminder</h1>
    <p style="color:#9ca3af;font-size:14px;margin:0 0 24px;">
      Hey {player_name}, these matches kick off in less than 24 hours and you haven't predicted the score yet:
    </p>
    <table style="width:100%;border-collapse:collapse;">
      {rows}
    </table>
    <div style="margin-top:28px;text-align:center;">
      <a href="{app_url}/predictions"
         style="background:linear-gradient(135deg,#a855f7,#3b82f6);color:#fff;
                text-decoration:none;padding:12px 32px;border-radius:10px;
                font-weight:700;font-size:14px;display:inline-block;">
        Predict Now →
      </a>
    </div>
    <p style="color:#4b5563;font-size:11px;text-align:center;margin-top:24px;">
      You're receiving this because you're part of a WC Betting group.
    </p>
  </div>
</body>
</html>"""


async def send_prediction_reminders(db: AsyncSession) -> None:
    """
    Find players who have not predicted upcoming matches starting in the next 24 hours.
    Send each affected player a single consolidated reminder email.
    Skips silently if RESEND_API_KEY is not set or player has no email.
    """
    if not settings.resend_api_key:
        return

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    window_end = now + timedelta(hours=24)

    upcoming = (await db.execute(
        select(Match).where(
            Match.status == "upcoming",
            Match.kickoff_time >= now,
            Match.kickoff_time <= window_end,
        )
    )).scalars().all()

    if not upcoming:
        return

    players = (await db.execute(
        select(Player).where(
            Player.email.isnot(None),
            Player.email != "",
            Player.is_bot == False,
            Player.is_admin == False,
        )
    )).scalars().all()

    existing_preds = (await db.execute(
        select(Prediction).where(
            Prediction.match_id.in_([m.id for m in upcoming])
        )
    )).scalars().all()
    predicted_set = {(p.player_id, p.match_id) for p in existing_preds}

    async with httpx.AsyncClient(timeout=10) as client:
        for player in players:
            missing = [
                m for m in upcoming
                if (player.id, m.id) not in predicted_set
            ]
            if not missing:
                continue

            match_list = [
                {
                    "home_team": m.home_team,
                    "away_team": m.away_team,
                    "time": _match_time_local(m.kickoff_time),
                }
                for m in missing
            ]
            html = _build_email_html(player.name, match_list, settings.app_url)

            try:
                resp = await client.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {settings.resend_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "from": _FROM,
                        "to": [player.email],
                        "subject": f"⚽ {len(missing)} match{'es' if len(missing) > 1 else ''} need your prediction!",
                        "html": html,
                    },
                )
                if resp.status_code == 200:
                    logger.info("Reminder sent to %s (%s)", player.name, player.email)
                else:
                    logger.warning("Resend error %d for %s: %s", resp.status_code, player.email, resp.text[:200])
            except Exception as e:
                logger.warning("Email send failed for %s: %s", player.email, e)
