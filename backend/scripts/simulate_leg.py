#!/usr/bin/env python
"""
simulate_leg.py — Simulate a World Cup group-stage leg with 3 players.

Uses a completely ISOLATED in-memory SQLite database.
Never touches worldcup.db or any real data.

Uses real WC 2022 group-stage results (day 1–3, 6 matches):
  Argentina 1–2 Saudi Arabia  (shock result)
  France    4–1 Australia
  Germany   1–2 Japan          (shock result)
  Spain     7–0 Costa Rica
  England   6–2 Iran
  Belgium   1–0 Canada

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
from app.poller import settle_match
from app.bravery import check_volume_milestone, streak_bonus_pct

# ─────────────────────────────────────────────────────────────────────────────
# ANSI helpers
# ─────────────────────────────────────────────────────────────────────────────
G = "\033[92m"   # green
R = "\033[91m"   # red
Y = "\033[93m"   # yellow
B = "\033[94m"   # blue
M = "\033[95m"   # magenta
C = "\033[96m"   # cyan
W = "\033[97m"   # white bold
D = "\033[2m"    # dim
Z = "\033[0m"    # reset

def header(text):
    print(f"\n{B}{'─'*62}{Z}")
    print(f"{W}  {text}{Z}")
    print(f"{B}{'─'*62}{Z}")

def subheader(text):
    print(f"\n{C}  ▸ {text}{Z}")

def ok(text):    print(f"    {G}✓{Z}  {text}")
def fail(text):  print(f"    {R}✗{Z}  {text}")
def info(text):  print(f"    {D}{text}{Z}")

# ─────────────────────────────────────────────────────────────────────────────
# FIXTURES
# ─────────────────────────────────────────────────────────────────────────────

STARTING_BALANCE = 1000

# (name, starting_balance)
PLAYERS_SEED = [
    ("Alice",  STARTING_BALANCE),
    ("Bob",    STARTING_BALANCE),
    ("Carlos", STARTING_BALANCE),
]

# Kickoff an hour ago so they'd be "locked" in real life
_BASE_KO = datetime(2022, 11, 21, 10, 0, tzinfo=timezone.utc)

# (home, away, home_score, away_score, home_red, away_red, corners, round_label)
MATCHES_SEED = [
    ("Argentina", "Saudi Arabia", 1, 2, 0, 0, 7,  "Group A"),
    ("France",    "Australia",    4, 1, 0, 0, 8,  "Group D"),
    ("Germany",   "Japan",        1, 2, 0, 0, 9,  "Group E"),
    ("Spain",     "Costa Rica",   7, 0, 0, 0, 6,  "Group E"),
    ("England",   "Iran",         6, 2, 0, 0, 8,  "Group B"),
    ("Belgium",   "Canada",       1, 0, 0, 0, 5,  "Group F"),
]

# Real match results as result-dicts for settle_match
RESULTS = [
    dict(home_score=1, away_score=2, home_red_cards=0, away_red_cards=0, corners=7),
    dict(home_score=4, away_score=1, home_red_cards=0, away_red_cards=0, corners=8),
    dict(home_score=1, away_score=2, home_red_cards=0, away_red_cards=0, corners=9),
    dict(home_score=7, away_score=0, home_red_cards=0, away_red_cards=0, corners=6),
    dict(home_score=6, away_score=2, home_red_cards=0, away_red_cards=0, corners=8),
    dict(home_score=1, away_score=0, home_red_cards=0, away_red_cards=0, corners=5),
]

# ─────────────────────────────────────────────────────────────────────────────
# BET FIXTURES
# Each tuple: (player_name, match_idx, bet_type, selection, stake, odds)
# ─────────────────────────────────────────────────────────────────────────────
BETS_SEED = [
    # Alice — aggressive, backs favourites (mostly wrong on day 1!)
    ("Alice",  0, "1x2",          "Argentina",   200, 1.40),  # LOST (Saudi won)
    ("Alice",  1, "1x2",          "France",      150, 1.30),  # WON
    ("Alice",  2, "1x2",          "Germany",     200, 1.50),  # LOST (Japan won)
    ("Alice",  3, "totals",       "Over 4.5",    100, 1.80),  # WON  (7 goals)
    ("Alice",  4, "btts",         "Yes",         100, 1.60),  # WON  (6-2)
    ("Alice",  5, "1x2",          "Belgium",     100, 1.55),  # WON

    # Bob — contrarian value-hunter
    # NOTE: for 1x2, away-team wins use "Away" (the system's canonical value)
    ("Bob",    0, "1x2",          "Away",          80, 7.00),  # WON! (Saudi = away)
    ("Bob",    1, "btts",         "Yes",          100, 1.80),  # WON  (4-1 both scored)
    ("Bob",    2, "1x2",          "Away",          80, 5.50),  # WON! (Japan = away)
    ("Bob",    3, "btts",         "No",           100, 3.50),  # WON  (7-0, Costa Rica didn't score)
    ("Bob",    4, "totals",       "Over 5.5",      80, 2.00),  # WON  (8 goals)
    ("Bob",    5, "1x2",          "Draw",          60, 3.80),  # LOST

    # Carlos — gut feelings + one lucky correct-score
    ("Carlos", 0, "1x2",          "Draw",         100, 3.50),  # LOST
    ("Carlos", 1, "1x2",          "Australia",    100, 6.00),  # LOST
    ("Carlos", 2, "1x2",          "Draw",         100, 3.20),  # LOST
    ("Carlos", 3, "correct_score","7-0",           50, 90.0),  # WON! (exactly right)
    ("Carlos", 4, "1x2",          "England",      150, 1.35),  # WON
    ("Carlos", 5, "1x2",          "Belgium",      150, 1.55),  # WON
]

# ─────────────────────────────────────────────────────────────────────────────
# CHALLENGE FIXTURES
# (issuer, acceptor, match_idx, bet_type, issuer_sel, acceptor_sel, issuer_stake, issuer_odds, acceptor_odds)
# ─────────────────────────────────────────────────────────────────────────────
CHALLENGES_SEED = [
    # M1: Alice says Argentina wins, Bob says Saudi Arabia — Bob wins
    ("Alice",  "Bob",    0, "1x2", "Argentina",   "Saudi Arabia", 150, 1.40, 6.50),

    # M2: Bob says BTTS Yes, Carlos says No — Bob wins (4-1)
    ("Bob",    "Carlos", 1, "btts","Yes",          "No",           100, 1.80, 2.00),

    # M3: Alice says Germany, Carlos says Japan — Carlos wins
    ("Alice",  "Carlos", 2, "1x2", "Germany",     "Japan",        120, 1.50, 5.00),

    # M4: Bob says Over 3.5 goals, Alice says Under — Bob wins (7 goals)
    ("Bob",    "Alice",  3, "totals","Over 3.5",   "Under 3.5",    100, 1.60, 2.30),

    # M5: Alice says England, Bob says Iran — Alice wins
    ("Alice",  "Bob",    4, "1x2", "England",     "Iran",         100, 1.30, 9.00),

    # M6: Carlos says Draw, Bob says Belgium — Bob wins
    ("Carlos", "Bob",    5, "1x2", "Draw",        "Belgium",       80, 3.80, 1.55),
]

# ─────────────────────────────────────────────────────────────────────────────
# PREDICTION FIXTURES
# (player_name, match_idx, home_pred, away_pred)
# ─────────────────────────────────────────────────────────────────────────────
PREDICTIONS_SEED = [
    # Alice
    ("Alice",  0, 2, 0),   # 2-0 Argentina — wrong outcome (0 pts)
    ("Alice",  1, 3, 0),   # 3-0 France — correct outcome (1 pt)
    ("Alice",  4, 4, 1),   # 4-1 England — correct outcome (1 pt)

    # Bob
    ("Bob",    0, 1, 2),   # 1-2 Saudi — CORRECT SCORE! (3 pts)
    ("Bob",    2, 1, 2),   # 1-2 Japan — CORRECT SCORE! (3 pts)
    ("Bob",    5, 1, 0),   # 1-0 Belgium — CORRECT SCORE! (3 pts)

    # Carlos
    ("Carlos", 3, 7, 0),   # 7-0 Spain — CORRECT SCORE! (3 pts)
    ("Carlos", 4, 5, 1),   # 5-1 England — correct outcome (1 pt)
    ("Carlos", 1, 2, 0),   # 2-0 France — correct outcome (1 pt)
]


# ─────────────────────────────────────────────────────────────────────────────
# MAIN SIMULATION
# ─────────────────────────────────────────────────────────────────────────────

async def run():
    # ── 1. Create isolated in-memory SQLite engine ────────────────────────
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as db:
        # ── 2. Seed players ───────────────────────────────────────────────
        players = {}
        for name, balance in PLAYERS_SEED:
            p = Player(name=name, token_balance=balance, session_token=f"tok-{name.lower()}")
            db.add(p)
        await db.commit()

        result = await db.execute(select(Player))
        for p in result.scalars().all():
            players[p.name] = p

        initial_balances = {name: p.token_balance for name, p in players.items()}

        # ── 3. Seed matches ───────────────────────────────────────────────
        matches = []
        for i, (home, away, *_, round_lbl) in enumerate(MATCHES_SEED):
            ko = _BASE_KO + timedelta(hours=i * 3)
            m = Match(
                home_team=home, away_team=away,
                kickoff_time=ko, status="upcoming",
                round=round_lbl,
            )
            db.add(m)
        await db.commit()

        result = await db.execute(select(Match).order_by(Match.kickoff_time))
        matches = result.scalars().all()
        assert len(matches) == len(MATCHES_SEED)

        # ── 4. Place bets ─────────────────────────────────────────────────
        bets_placed = []
        for (pname, midx, btype, sel, stake, odds) in BETS_SEED:
            p = players[pname]
            m = matches[midx]
            p.token_balance -= stake
            bet = Bet(
                player_id=p.id, match_id=m.id,
                bet_type=btype, selection=sel,
                stake=stake, odds_at_placement=odds,
                status="pending",
            )
            db.add(bet)
            bets_placed.append((bet, pname, midx))
        await db.commit()

        # re-fetch bets with IDs
        result = await db.execute(select(Bet))
        bets_by_id = {b.id: b for b in result.scalars().all()}

        # ── 5. Issue + accept challenges ──────────────────────────────────
        challenges_placed = []
        for (iname, aname, midx, btype, isel, asel, istake, iodds, aodds) in CHALLENGES_SEED:
            issuer   = players[iname]
            acceptor = players[aname]
            m = matches[midx]

            acceptor_stake = max(1, round(istake * (iodds / aodds)))

            # Apply streak / volume mechanics on issuer (mirror of the router)
            issuer.total_challenges_issued += 1
            issuer.challenge_streak += 1
            bonus, new_level = check_volume_milestone(
                issuer.total_challenges_issued, issuer.volume_milestone_reached
            )
            if bonus:
                issuer.token_balance += bonus
                issuer.volume_milestone_reached = new_level

            issuer.token_balance   -= istake
            acceptor.token_balance -= acceptor_stake

            ch = Challenge(
                issuer_id=issuer.id, acceptor_id=acceptor.id, match_id=m.id,
                bet_type=btype, selection=isel, acceptor_selection=asel,
                issuer_stake=istake, acceptor_stake=acceptor_stake,
                issuer_odds=iodds, acceptor_odds=aodds,
                status="accepted",
                bravery_streak_bonus_pct=streak_bonus_pct(issuer.challenge_streak),
            )
            db.add(ch)
            challenges_placed.append((ch, iname, aname, midx, acceptor_stake))

        await db.commit()

        # ── 6. Place predictions ──────────────────────────────────────────
        for (pname, midx, hp, ap) in PREDICTIONS_SEED:
            p = players[pname]
            m = matches[midx]
            pred = Prediction(
                player_id=p.id, match_id=m.id,
                home_score_pred=hp, away_score_pred=ap,
            )
            db.add(pred)
        await db.commit()

        # Snapshot balances just before settlement
        await db.refresh(players["Alice"])
        await db.refresh(players["Bob"])
        await db.refresh(players["Carlos"])
        pre_settlement = {n: players[n].token_balance for n in players}

        # ── 7. Settle all matches ─────────────────────────────────────────
        for match, result_dict in zip(matches, RESULTS):
            await settle_match(db, match, result_dict)

        # ── 8. Re-fetch everything for reporting ──────────────────────────
        await db.refresh(players["Alice"])
        await db.refresh(players["Bob"])
        await db.refresh(players["Carlos"])

        result = await db.execute(select(Bet))
        final_bets = {b.id: b for b in result.scalars().all()}

        result = await db.execute(select(Challenge))
        final_challenges = {c.id: c for c in result.scalars().all()}

        result = await db.execute(select(Prediction))
        final_preds_list = result.scalars().all()
        final_preds = {(p.player_id, p.match_id): p for p in final_preds_list}

        result = await db.execute(select(Match))
        final_matches = {m.id: m for m in result.scalars().all()}

        # ─────────────────────────────────────────────────────────────────
        # REPORT
        # ─────────────────────────────────────────────────────────────────

        header("🏆  WC 2022 GROUP-STAGE SIMULATION — MATCH RESULTS")
        for i, m in enumerate(matches):
            ms = MATCHES_SEED[i]
            icon = "🟡" if ms[2] == ms[3] else ("🏠" if ms[2] > ms[3] else "✈️")
            print(f"  {icon}  {m.home_team} {ms[2]}–{ms[3]} {m.away_team}  {D}({m.round}){Z}")

        header("💰  BETS  (per player)")
        for pname, _, _ in [("Alice",None,None),("Bob",None,None),("Carlos",None,None)]:
            p = players[pname]
            subheader(pname)
            player_bets = [(b, bname, midx) for (b, bname, midx) in bets_placed if bname == pname]

            # re-fetch bet rows from final state
            result2 = await db.execute(select(Bet).where(Bet.player_id == p.id))
            rows = {b.id: b for b in result2.scalars().all()}

            total_staked = 0
            total_returned = 0
            for _, bname, midx in player_bets:
                # find this bet by matching player + match + iteration
                pass

            # simpler: iterate BETS_SEED order for this player
            player_bet_defs = [(btype, sel, stake, odds, midx) for (bn, midx, btype, sel, stake, odds) in BETS_SEED if bn == pname]
            result2 = await db.execute(select(Bet).where(Bet.player_id == p.id).order_by(Bet.id))
            pbet_rows = result2.scalars().all()

            for row, (btype, sel, stake, odds, midx) in zip(pbet_rows, player_bet_defs):
                ms = MATCHES_SEED[midx]
                match_label = f"{ms[0]} vs {ms[1]}"
                won = row.status == "won"
                payout = int(stake * odds) if won else 0
                net = payout - stake
                status_str = f"{G}WON  +{net:>4}{Z}" if won else f"{R}LOST −{stake:>4}{Z}"
                # "Away" → show the actual away team name for readability
                display_sel = ms[1] if sel == "Away" else sel
                print(f"    {match_label:<28} {btype:<14} {display_sel:<20} {stake:>3}t @ {odds}x  →  {status_str}")

        header("⚔️   CHALLENGES  (P2P)")
        result3 = await db.execute(select(Challenge).order_by(Challenge.id))
        ch_rows = result3.scalars().all()

        for ch_row, (iname, aname, midx, btype, isel, asel, istake, iodds, aodds) in zip(ch_rows, CHALLENGES_SEED):
            ms = MATCHES_SEED[midx]
            match_label = f"{ms[0]} vs {ms[1]}"
            astake = ch_row.acceptor_stake

            result_for_match = RESULTS[midx]
            match_obj = matches[midx]

            # re-evaluate who won
            from app.poller import _evaluate_bet
            issuer_won = _evaluate_bet(btype, isel, match_obj, result_for_match)

            i_payout = int(istake * iodds) if issuer_won else 0
            a_payout = int(astake * aodds) if not issuer_won else 0

            # bravery bonus (streak at time of issue — approximated from order)
            bonus = int(i_payout * ch_row.bravery_streak_bonus_pct) if issuer_won and ch_row.bravery_streak_bonus_pct else 0

            winner = iname if issuer_won else aname
            loser  = aname if issuer_won else iname
            w_payout = i_payout + bonus if issuer_won else a_payout
            net_w = w_payout - (istake if issuer_won else astake)
            net_l = -(astake if issuer_won else istake)

            print(f"\n  {match_label}  {D}({btype}){Z}")
            print(f"    {iname:<8}  {isel:<18} {istake:>3}t @ {iodds}x")
            print(f"    {aname:<8}  {asel:<18} {astake:>3}t @ {aodds}x")
            if bonus:
                print(f"    {M}🔥 Bravery streak bonus on {iname}: +{bonus}t  ({int(ch_row.bravery_streak_bonus_pct*100)}%){Z}")
            print(f"    → {G}{winner} wins  +{net_w}t{Z}   {R}{loser} loses −abs({net_l})t{Z}")

        header("🎯  PREDICTIONS")
        print(f"  {'Player':<10} {'Match':<30} {'Prediction':<10} {'Actual':<10} {'Points'}")
        print(f"  {'─'*8}  {'─'*28}  {'─'*8}  {'─'*8}  {'─'*6}")
        for (pname, midx, hp, ap) in PREDICTIONS_SEED:
            p = players[pname]
            ms = MATCHES_SEED[midx]
            actual = f"{ms[2]}–{ms[3]}"
            pred_str = f"{hp}–{ap}"
            m = matches[midx]
            pred_row = final_preds.get((p.id, m.id))
            pts = pred_row.points_awarded if pred_row else 0
            pts_str = f"{G}+{pts}{Z}" if pts > 0 else f"{R} 0{Z}"
            status = pred_row.status if pred_row else "?"
            print(f"  {pname:<10} {ms[0]+' vs '+ms[1]:<30} {pred_str:<10} {actual:<10} {pts_str}  ({status})")

        header("🏅  FINAL STANDINGS")
        print(f"\n  {'Player':<10} {'Start':>7} {'Pre-settle':>10} {'Final':>7} {'Change':>8}  {'Pred Pts':>8}")
        print(f"  {'─'*8}  {'─'*7}  {'─'*9}  {'─'*7}  {'─'*8}  {'─'*8}")

        # Compute prediction points per player
        pred_pts = {}
        for pname, _, _ in [("Alice",None,None),("Bob",None,None),("Carlos",None,None)]:
            p = players[pname]
            result4 = await db.execute(select(Prediction).where(Prediction.player_id == p.id))
            pred_pts[pname] = sum(r.points_awarded for r in result4.scalars().all())

        standings = []
        for pname in ["Alice", "Bob", "Carlos"]:
            p = players[pname]
            await db.refresh(p)
            start = initial_balances[pname]
            pre   = pre_settlement[pname]
            final = p.token_balance
            change = final - start
            standings.append((pname, start, pre, final, change, pred_pts[pname]))

        standings.sort(key=lambda x: x[3], reverse=True)
        medals = ["🥇", "🥈", "🥉"]
        for idx, (pname, start, pre, final, change, ppts) in enumerate(standings):
            sign = "+" if change >= 0 else ""
            change_str = f"{G}{sign}{change}{Z}" if change >= 0 else f"{R}{change}{Z}"
            print(f"  {medals[idx]} {pname:<8}  {start:>7}  {pre:>10}  {final:>7}  {change_str:>14}  {ppts:>8}")

        print(f"\n{B}{'─'*62}{Z}\n")
        print(f"  {D}Simulation complete. DB was in-memory — nothing was written to disk.{Z}\n")


if __name__ == "__main__":
    asyncio.run(run())
