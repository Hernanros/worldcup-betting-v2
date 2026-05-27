#!/usr/bin/env python
"""
simulate_leg.py — Simulate a World Cup group-stage leg with 3 players.

Uses a completely ISOLATED in-memory SQLite database.
Never touches worldcup.db or any real data.

WC 2022 group-stage results (6 matches, approximate card/corner data):
  Argentina 1–2 Saudi Arabia  — 6🟨 0🟥  7 corners
  France    4–1 Australia     — 2🟨 0🟥  8 corners
  Germany   1–2 Japan         — 4🟨 1🟥  9 corners
  Spain     7–0 Costa Rica    — 3🟨 1🟥  6 corners
  England   6–2 Iran          — 5🟨 0🟥  8 corners
  Belgium   1–0 Canada        — 4🟨 0🟥  5 corners

Challenge types covered:
  1x2 · btts · totals · correct_score · corners · yellow_cards · red_cards · handicap

Run:
    cd /Users/hernanrosenblum/Documents/worldcup-betting-v2/backend
    ./venv/bin/python scripts/simulate_leg.py
"""
import asyncio
import sys
import os
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from app.database import Base
from app.models import Player, Match, Bet, Challenge, Prediction
from app.poller import settle_match, _evaluate_bet
from app.bravery import check_volume_milestone, streak_bonus_pct

# ─────────────────────────────────────────────────────────────────────────────
# ANSI helpers
# ─────────────────────────────────────────────────────────────────────────────
G = "\033[92m"; R = "\033[91m"; Y = "\033[93m"; B = "\033[94m"
M = "\033[95m"; C = "\033[96m"; W = "\033[97m"; D = "\033[2m"; Z = "\033[0m"

def header(text):
    print(f"\n{B}{'─'*66}{Z}\n{W}  {text}{Z}\n{B}{'─'*66}{Z}")

def subheader(text):
    print(f"\n{C}  ▸ {text}{Z}")

# ─────────────────────────────────────────────────────────────────────────────
# FIXTURES
# ─────────────────────────────────────────────────────────────────────────────

STARTING_BALANCE = 1000
_BASE_KO = datetime(2022, 11, 21, 10, 0, tzinfo=timezone.utc)

PLAYERS_SEED = [
    ("Alice",  STARTING_BALANCE),
    ("Bob",    STARTING_BALANCE),
    ("Carlos", STARTING_BALANCE),
]

# (home, away, home_score, away_score, home_red, away_red, corners, yellow_cards, round_label)
MATCHES_SEED = [
    ("Argentina", "Saudi Arabia", 1, 2, 0, 0, 7, 6, "Group A"),
    ("France",    "Australia",    4, 1, 0, 0, 8, 2, "Group D"),
    ("Germany",   "Japan",        1, 2, 0, 1, 9, 4, "Group E"),  # 1 red (Japan)
    ("Spain",     "Costa Rica",   7, 0, 0, 1, 6, 3, "Group E"),  # 1 red (Costa Rica)
    ("England",   "Iran",         6, 2, 0, 0, 8, 5, "Group B"),
    ("Belgium",   "Canada",       1, 0, 0, 0, 5, 4, "Group F"),
]

RESULTS = [
    dict(home_score=1, away_score=2, home_red_cards=0, away_red_cards=0, corners=7,  yellow_cards=6),
    dict(home_score=4, away_score=1, home_red_cards=0, away_red_cards=0, corners=8,  yellow_cards=2),
    dict(home_score=1, away_score=2, home_red_cards=0, away_red_cards=1, corners=9,  yellow_cards=4),
    dict(home_score=7, away_score=0, home_red_cards=0, away_red_cards=1, corners=6,  yellow_cards=3),
    dict(home_score=6, away_score=2, home_red_cards=0, away_red_cards=0, corners=8,  yellow_cards=5),
    dict(home_score=1, away_score=0, home_red_cards=0, away_red_cards=0, corners=5,  yellow_cards=4),
]

# ─────────────────────────────────────────────────────────────────────────────
# BETS
# (player, match_idx, bet_type, selection, stake, odds)
# Note: 1x2 away wins use "Away" (system canonical), displayed as team name
# ─────────────────────────────────────────────────────────────────────────────
BETS_SEED = [
    # Alice — backs favourites, takes value on cards
    ("Alice",  0, "1x2",         "Argentina",  200, 1.40),   # LOST
    ("Alice",  1, "1x2",         "France",     150, 1.30),   # WON
    ("Alice",  2, "1x2",         "Germany",    200, 1.50),   # LOST
    ("Alice",  3, "totals",      "Over 4.5",   100, 1.80),   # WON  (7 goals)
    ("Alice",  4, "btts",        "Yes",         80, 1.60),   # WON  (6-2)
    ("Alice",  5, "1x2",         "Belgium",    100, 1.55),   # WON

    # Bob — contrarian value hunter
    ("Bob",    0, "1x2",         "Away",        80, 7.00),   # WON  (Saudi = away)
    ("Bob",    1, "btts",        "Yes",        100, 1.80),   # WON  (4-1)
    ("Bob",    2, "1x2",         "Away",        80, 5.50),   # WON  (Japan = away)
    ("Bob",    3, "btts",        "No",         100, 3.50),   # WON  (7-0)
    ("Bob",    4, "totals",      "Over 5.5",    80, 2.00),   # WON  (8 goals)
    ("Bob",    5, "1x2",         "Draw",        60, 3.80),   # LOST

    # Carlos — gut feelings + lucky correct score
    ("Carlos", 0, "1x2",         "Draw",       100, 3.50),   # LOST
    ("Carlos", 1, "1x2",         "Australia",  100, 6.00),   # LOST
    ("Carlos", 2, "1x2",         "Draw",       100, 3.20),   # LOST
    ("Carlos", 3, "correct_score","7-0",         50, 90.0),  # WON! (exactly right)
    ("Carlos", 4, "1x2",         "England",    150, 1.35),   # WON
    ("Carlos", 5, "1x2",         "Belgium",    150, 1.55),   # WON
]

# ─────────────────────────────────────────────────────────────────────────────
# CHALLENGES  (issuer, acceptor, match_idx, type, issuer_sel, acceptor_sel, stake, i_odds, a_odds)
# ─────────────────────────────────────────────────────────────────────────────
CHALLENGES_SEED = [
    # ── classic ──────────────────────────────────────────────────────────────
    ("Alice",  "Bob",    0, "1x2",
        "Argentina",      "Saudi Arabia",       150, 1.40, 6.50),  # Bob wins (upsets)

    ("Bob",    "Carlos", 1, "btts",
        "Yes",            "No",                 100, 1.80, 2.00),  # Bob wins (4-1 both scored)

    ("Alice",  "Carlos", 2, "1x2",
        "Germany",        "Japan",              120, 1.50, 5.00),  # Carlos wins (Japan upsets)

    ("Bob",    "Alice",  3, "totals",
        "Over 3.5",       "Under 3.5",          100, 1.60, 2.30),  # Bob wins (7 goals)

    ("Alice",  "Bob",    4, "1x2",
        "England",        "Iran",               100, 1.30, 9.00),  # Alice wins

    ("Carlos", "Bob",    5, "1x2",
        "Draw",           "Belgium",             80, 3.80, 1.55),  # Bob wins (Belgium wins)

    # ── yellow cards ─────────────────────────────────────────────────────────
    # M0: 6 yellows — Over 4.5 wins
    ("Alice",  "Bob",    0, "yellow_cards",
        "Over 4.5",       "Under 4.5",           80, 1.85, 1.95),  # Alice wins (6 > 4.5)

    # M2: 4 yellows — Under 5.5 wins
    ("Bob",    "Carlos", 2, "yellow_cards",
        "Under 5.5",      "Over 5.5",            80, 2.10, 1.75),  # Bob wins (4 < 5.5)

    # ── red cards ────────────────────────────────────────────────────────────
    # M2: 1 red card total — Over 0.5 wins
    ("Carlos", "Alice",  2, "red_cards",
        "Over 0.5",       "Under 0.5",           60, 2.40, 1.55),  # Carlos wins (1 > 0.5)

    # M3: 1 red card total — Over 0.5 wins
    ("Alice",  "Bob",    3, "red_cards",
        "Over 0.5",       "Under 0.5",           60, 2.40, 1.55),  # Alice wins (1 > 0.5)

    # ── corners ──────────────────────────────────────────────────────────────
    # M0: 7 corners — Over 6.5 wins
    ("Bob",    "Carlos", 0, "corners",
        "Over 6.5",       "Under 6.5",           80, 1.90, 1.90),  # Bob wins (7 > 6.5)

    # M4: 8 corners — Carlos picked Under 7.5, Alice picked Over 7.5 — Alice wins
    ("Carlos", "Alice",  4, "corners",
        "Under 7.5",      "Over 7.5",            70, 2.20, 1.70),  # Alice wins (8 > 7.5)

    # ── handicap ─────────────────────────────────────────────────────────────
    # M0: Saudi Arabia is away (score 2), +1.5 → adjusted 3.5 > 1 → Saudi handicap wins
    ("Carlos", "Bob",    0, "handicap",
        "Saudi Arabia +1.5", "Argentina -1.5",  100, 1.70, 2.20),  # Carlos wins

    # M4: England is home (score 6), -2.5 → adjusted 3.5 > 2 → England handicap wins
    ("Alice",  "Carlos", 4, "handicap",
        "England -2.5",   "Iran +2.5",          120, 1.75, 2.10),  # Alice wins
]

# ─────────────────────────────────────────────────────────────────────────────
# PREDICTIONS  (player, match_idx, home_pred, away_pred)
# ─────────────────────────────────────────────────────────────────────────────
PREDICTIONS_SEED = [
    ("Alice",  0, 2, 0),   # 2-0 Argentina — WRONG (0 pts)
    ("Alice",  1, 3, 0),   # 3-0 France — correct outcome (1 pt)
    ("Alice",  4, 4, 1),   # 4-1 England — correct outcome (1 pt)

    ("Bob",    0, 1, 2),   # 1-2 Saudi — CORRECT SCORE (3 pts)
    ("Bob",    2, 1, 2),   # 1-2 Japan — CORRECT SCORE (3 pts)
    ("Bob",    5, 1, 0),   # 1-0 Belgium — CORRECT SCORE (3 pts)

    ("Carlos", 3, 7, 0),   # 7-0 Spain — CORRECT SCORE (3 pts)
    ("Carlos", 4, 5, 1),   # 5-1 England — correct outcome (1 pt)
    ("Carlos", 1, 2, 0),   # 2-0 France — correct outcome (1 pt)
]


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _actual_stat_label(btype: str, midx: int) -> str:
    """Human-readable 'actual value' line for a challenge type."""
    r  = RESULTS[midx]
    ms = MATCHES_SEED[midx]
    if btype == "yellow_cards":
        return f"{Y}🟨 {r['yellow_cards']} yellow cards{Z}"
    if btype == "red_cards":
        total = r["home_red_cards"] + r["away_red_cards"]
        return f"{R}🟥 {total} red card{'s' if total != 1 else ''}{Z}"
    if btype == "corners":
        return f"{C}⚑  {r['corners']} corners{Z}"
    if btype == "handicap":
        return f"{D}score: {ms[2]}–{ms[3]}{Z}"
    if btype in ("1x2", "btts", "totals", "correct_score"):
        return f"{D}score: {ms[2]}–{ms[3]}{Z}"
    return ""


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

async def run():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as db:
        # ── seed players ─────────────────────────────────────────────────────
        for name, balance in PLAYERS_SEED:
            db.add(Player(name=name, token_balance=balance, session_token=f"tok-{name.lower()}"))
        await db.commit()
        res = await db.execute(select(Player))
        players = {p.name: p for p in res.scalars().all()}
        initial_balances = {n: p.token_balance for n, p in players.items()}

        # ── seed matches ──────────────────────────────────────────────────────
        for i, (home, away, *_, round_lbl) in enumerate(MATCHES_SEED):
            db.add(Match(home_team=home, away_team=away,
                         kickoff_time=_BASE_KO + timedelta(hours=i * 3),
                         status="upcoming", round=round_lbl))
        await db.commit()
        res = await db.execute(select(Match).order_by(Match.kickoff_time))
        matches = list(res.scalars().all())

        # ── place bets ────────────────────────────────────────────────────────
        bet_defs_by_player = {n: [] for n in players}
        for (pname, midx, btype, sel, stake, odds) in BETS_SEED:
            players[pname].token_balance -= stake
            db.add(Bet(player_id=players[pname].id, match_id=matches[midx].id,
                       bet_type=btype, selection=sel, stake=stake,
                       odds_at_placement=odds, status="pending"))
            bet_defs_by_player[pname].append((btype, sel, stake, odds, midx))
        await db.commit()

        # ── issue + accept challenges ─────────────────────────────────────────
        for (iname, aname, midx, btype, isel, asel, istake, iodds, aodds) in CHALLENGES_SEED:
            issuer   = players[iname]
            acceptor = players[aname]
            astake   = max(1, round(istake * (iodds / aodds)))

            issuer.total_challenges_issued += 1
            issuer.challenge_streak += 1
            bonus, new_level = check_volume_milestone(
                issuer.total_challenges_issued, issuer.volume_milestone_reached)
            if bonus:
                issuer.token_balance += bonus
                issuer.volume_milestone_reached = new_level

            issuer.token_balance   -= istake
            acceptor.token_balance -= astake

            db.add(Challenge(
                issuer_id=issuer.id, acceptor_id=acceptor.id,
                match_id=matches[midx].id,
                bet_type=btype, selection=isel, acceptor_selection=asel,
                issuer_stake=istake, acceptor_stake=astake,
                issuer_odds=iodds, acceptor_odds=aodds,
                status="accepted",
                bravery_streak_bonus_pct=streak_bonus_pct(issuer.challenge_streak),
            ))
        await db.commit()

        # ── place predictions ─────────────────────────────────────────────────
        for (pname, midx, hp, ap) in PREDICTIONS_SEED:
            db.add(Prediction(player_id=players[pname].id, match_id=matches[midx].id,
                               home_score_pred=hp, away_score_pred=ap))
        await db.commit()

        pre_settlement = {}
        for name, p in players.items():
            await db.refresh(p)
            pre_settlement[name] = p.token_balance

        # ── settle ────────────────────────────────────────────────────────────
        for match, result_dict in zip(matches, RESULTS):
            await settle_match(db, match, result_dict)

        # re-fetch
        for p in players.values():
            await db.refresh(p)
        res = await db.execute(select(Bet))
        all_bets = list(res.scalars().all())
        res = await db.execute(select(Challenge).order_by(Challenge.id))
        all_challenges = list(res.scalars().all())
        res = await db.execute(select(Prediction))
        preds_map = {(p.player_id, p.match_id): p for p in res.scalars().all()}

        # ─────────────────────────────────────────────────────────────────────
        # REPORT
        # ─────────────────────────────────────────────────────────────────────

        header("🏆  WC 2022 GROUP-STAGE  —  MATCH RESULTS")
        for i, m in enumerate(matches):
            ms = MATCHES_SEED[i]
            r  = RESULTS[i]
            hs, as_ = ms[2], ms[3]
            icon  = "🟡" if hs == as_ else ("🏠" if hs > as_ else "✈️ ")
            reds  = r["home_red_cards"] + r["away_red_cards"]
            red_s = f"  {R}🟥×{reds}{Z}" if reds else ""
            print(f"  {icon}  {m.home_team:<12} {hs}–{as_}  {m.away_team:<12}"
                  f"  {D}({m.round})  🟨×{ms[7]}  ⚑{ms[6]}{red_s}{Z}")

        header("💰  BETS  (per player)")
        for pname in ("Alice", "Bob", "Carlos"):
            subheader(pname)
            res2 = await db.execute(
                select(Bet).where(Bet.player_id == players[pname].id).order_by(Bet.id))
            pbet_rows = list(res2.scalars().all())
            defs = bet_defs_by_player[pname]
            for row, (btype, sel, stake, odds, midx) in zip(pbet_rows, defs):
                ms = MATCHES_SEED[midx]
                won = row.status == "won"
                net = int(stake * odds) - stake if won else -stake
                status_s = f"{G}WON  +{net:>4}{Z}" if won else f"{R}LOST −{stake:>4}{Z}"
                display_sel = ms[1] if sel == "Away" else sel
                print(f"    {ms[0]+' vs '+ms[1]:<28} {btype:<14} "
                      f"{display_sel:<22} {stake:>3}t @ {odds}x  →  {status_s}")

        header("⚔️   CHALLENGES  (P2P)")

        # group by type for display
        TYPE_ORDER = ["1x2", "btts", "totals", "correct_score",
                      "corners", "yellow_cards", "red_cards", "handicap"]
        TYPE_LABEL = {
            "1x2": "MATCH RESULT (1×2)",
            "btts": "BOTH TEAMS TO SCORE",
            "totals": "GOALS OVER/UNDER",
            "correct_score": "CORRECT SCORE",
            "corners": "CORNERS",
            "yellow_cards": "🟨  YELLOW CARDS",
            "red_cards": "🟥  RED CARDS",
            "handicap": "HANDICAP",
        }
        grouped = {t: [] for t in TYPE_ORDER}
        for ch_row, ch_def in zip(all_challenges, CHALLENGES_SEED):
            grouped[ch_def[3]].append((ch_row, ch_def))

        for btype in TYPE_ORDER:
            entries = grouped[btype]
            if not entries:
                continue
            print(f"\n  {Y}{TYPE_LABEL[btype]}{Z}")
            for ch_row, (iname, aname, midx, btype_, isel, asel, istake, iodds, aodds) in entries:
                ms      = MATCHES_SEED[midx]
                astake  = ch_row.acceptor_stake
                res_d   = RESULTS[midx]
                match_obj = matches[midx]

                issuer_won = _evaluate_bet(btype, isel, match_obj, res_d)
                i_payout   = int(istake * iodds) if issuer_won else 0
                a_payout   = int(astake * aodds) if not issuer_won else 0
                bonus      = int(i_payout * ch_row.bravery_streak_bonus_pct) \
                             if issuer_won and ch_row.bravery_streak_bonus_pct else 0

                winner  = iname if issuer_won else aname
                loser   = aname if issuer_won else iname
                w_net   = (i_payout + bonus if issuer_won else a_payout) - \
                          (istake if issuer_won else astake)
                l_net   = -(astake if issuer_won else istake)

                stat_label = _actual_stat_label(btype, midx)
                print(f"    {ms[0]} vs {ms[1]}  {D}[{stat_label}{D}]{Z}")
                print(f"      {iname:<8} {isel:<26} {istake:>3}t @ {iodds}x")
                print(f"      {aname:<8} {asel:<26} {astake:>3}t @ {aodds}x")
                if bonus:
                    pct = int(ch_row.bravery_streak_bonus_pct * 100)
                    print(f"      {M}🔥 streak bonus on {iname}: +{bonus}t ({pct}%){Z}")
                print(f"      → {G}{winner} wins  +{w_net}t{Z}   {R}{loser} loses  {l_net}t{Z}")

        header("🎯  PREDICTIONS")
        print(f"  {'Player':<9} {'Match':<32} {'Pred':>5} {'Actual':>7} {'Pts':>5}  Status")
        print(f"  {'─'*7}  {'─'*30}  {'─'*5}  {'─'*5}  {'─'*4}  {'─'*14}")
        for (pname, midx, hp, ap) in PREDICTIONS_SEED:
            ms   = MATCHES_SEED[midx]
            pred = preds_map.get((players[pname].id, matches[midx].id))
            pts  = pred.points_awarded if pred else 0
            st   = pred.status if pred else "?"
            pts_s = f"{G}+{pts}{Z}" if pts > 0 else f"{R} 0{Z}"
            print(f"  {pname:<9} {ms[0]+' vs '+ms[1]:<32} "
                  f"{hp}–{ap:>1}  {ms[2]}–{ms[3]:>1}  {pts_s}  {D}{st}{Z}")

        header("🏅  FINAL STANDINGS")
        pred_pts = {}
        for pname in players:
            res5 = await db.execute(
                select(Prediction).where(Prediction.player_id == players[pname].id))
            pred_pts[pname] = sum(r.points_awarded for r in res5.scalars().all())

        standings = []
        for pname in players:
            await db.refresh(players[pname])
            standings.append((
                pname,
                initial_balances[pname],
                pre_settlement[pname],
                players[pname].token_balance,
                players[pname].token_balance - initial_balances[pname],
                pred_pts[pname],
            ))
        standings.sort(key=lambda x: x[3], reverse=True)

        print(f"\n  {'':2} {'Player':<9} {'Start':>6} {'Pre-settle':>11} {'Final':>7} {'Net':>7}  {'Pred pts':>9}")
        print(f"  {'─'*2}  {'─'*7}  {'─'*6}  {'─'*9}  {'─'*7}  {'─'*7}  {'─'*8}")
        for idx, (pname, start, pre, final, change, ppts) in enumerate(standings):
            sign = "+" if change >= 0 else ""
            c_s  = f"{G}{sign}{change}{Z}" if change >= 0 else f"{R}{change}{Z}"
            print(f"  {'🥇🥈🥉'[idx*2:idx*2+2]}  {pname:<9} {start:>6} {pre:>11} {final:>7} {c_s:>13}  {ppts:>9}")

        print(f"\n{B}{'─'*66}{Z}")
        print(f"  {D}In-memory DB — nothing written to disk.{Z}\n")


if __name__ == "__main__":
    asyncio.run(run())
