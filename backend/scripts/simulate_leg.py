#!/usr/bin/env python
"""
simulate_leg.py — Simulate a World Cup group-stage leg across 3 isolated leagues.

Uses a completely ISOLATED in-memory SQLite database.
Never touches worldcup.db or any real data.

3 leagues, 2 players each — challenges only within the same league.

WC 2022 group-stage results (6 matches, approximate card/corner data):
  Argentina 1–2 Saudi Arabia  — 6🟨 0🟥  7 corners
  France    4–1 Australia     — 2🟨 0🟥  8 corners
  Germany   1–2 Japan         — 4🟨 1🟥  9 corners
  Spain     7–0 Costa Rica    — 3🟨 1🟥  6 corners
  England   6–2 Iran          — 5🟨 0🟥  8 corners
  Belgium   1–0 Canada        — 4🟨 0🟥  5 corners

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
from app.models import League, Player, Match, Bet, Challenge, Prediction
from app.poller import settle_match, _evaluate_bet
from app.bravery import check_volume_milestone, streak_bonus_pct

# ─────────────────────────────────────────────────────────────────────────────
# ANSI helpers
# ─────────────────────────────────────────────────────────────────────────────
G = "\033[92m"; R = "\033[91m"; Y = "\033[93m"; B = "\033[94m"
M = "\033[95m"; C = "\033[96m"; W = "\033[97m"; D = "\033[2m"; Z = "\033[0m"

def header(text):
    print(f"\n{B}{'─'*72}{Z}\n{W}  {text}{Z}\n{B}{'─'*72}{Z}")

def league_header(league_name, color):
    print(f"\n{color}  ┌─────────────────────────────────────────────────┐")
    print(f"  │  🏆  {league_name:<44}│")
    print(f"  └─────────────────────────────────────────────────┘{Z}")

def subheader(text):
    print(f"\n{C}  ▸ {text}{Z}")

# ─────────────────────────────────────────────────────────────────────────────
# FIXTURES
# ─────────────────────────────────────────────────────────────────────────────

STARTING_BALANCE = 1_000
_BASE_KO = datetime(2022, 11, 21, 10, 0, tzinfo=timezone.utc)

# 3 leagues, 2 players each
LEAGUES_SEED = [
    ("Familia",  "fam26",  G),   # green
    ("Trabajo",  "work26", Y),   # yellow
    ("Amigos",   "pals26", M),   # magenta
]

# (name, league_name)
PLAYERS_SEED = [
    ("Alice",  "Familia"),
    ("Bob",    "Familia"),
    ("Carlos", "Trabajo"),
    ("Diana",  "Trabajo"),
    ("Eve",    "Amigos"),
    ("Frank",  "Amigos"),
]

# (home, away, home_score, away_score, home_red, away_red, corners, yellow_cards, round_label)
MATCHES_SEED = [
    ("Argentina", "Saudi Arabia", 1, 2, 0, 0, 7, 6, "Group A"),
    ("France",    "Australia",    4, 1, 0, 0, 8, 2, "Group D"),
    ("Germany",   "Japan",        1, 2, 0, 1, 9, 4, "Group E"),
    ("Spain",     "Costa Rica",   7, 0, 0, 1, 6, 3, "Group E"),
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
# BETS — each player bets independently on the global matches
# (player, match_idx, bet_type, selection, stake, odds)
# ─────────────────────────────────────────────────────────────────────────────
BETS_SEED = [
    # ── Familia: Alice (backs favourites) ────────────────────────────────────
    ("Alice",  0, "1x2",         "Argentina",  200, 1.40),   # LOST
    ("Alice",  1, "1x2",         "France",     150, 1.30),   # WON
    ("Alice",  4, "btts",        "Yes",         80, 1.60),   # WON  (6–2)
    ("Alice",  5, "1x2",         "Belgium",    100, 1.55),   # WON

    # ── Familia: Bob (contrarian value hunter) ────────────────────────────────
    ("Bob",    0, "1x2",         "Away",        80, 7.00),   # WON  (Saudi = away)
    ("Bob",    2, "1x2",         "Away",        80, 5.50),   # WON  (Japan = away)
    ("Bob",    3, "btts",        "No",         100, 3.50),   # WON  (7–0)
    ("Bob",    5, "1x2",         "Draw",        60, 3.80),   # LOST

    # ── Trabajo: Carlos (gut feelings) ───────────────────────────────────────
    ("Carlos", 0, "1x2",         "Draw",       100, 3.50),   # LOST
    ("Carlos", 3, "correct_score","7-0",         50, 90.0),  # WON! 🎉
    ("Carlos", 4, "1x2",         "England",    150, 1.35),   # WON
    ("Carlos", 2, "totals",      "Over 3.5",   100, 1.70),   # WON  (3 goals)

    # ── Trabajo: Diana (steady picks) ────────────────────────────────────────
    ("Diana",  1, "1x2",         "France",     150, 1.30),   # WON
    ("Diana",  2, "1x2",         "Germany",    100, 1.50),   # LOST
    ("Diana",  4, "totals",      "Over 5.5",    80, 2.00),   # WON  (8 goals)
    ("Diana",  5, "1x2",         "Belgium",    100, 1.55),   # WON

    # ── Amigos: Eve (corners & cards specialist) ──────────────────────────────
    ("Eve",    0, "corners",     "Over 6.5",    80, 1.90),   # WON  (7 corners)
    ("Eve",    2, "yellow_cards","Under 5.5",   80, 2.10),   # WON  (4 yellows)
    ("Eve",    3, "1x2",         "Spain",      150, 1.20),   # WON
    ("Eve",    4, "btts",        "Yes",         80, 1.60),   # WON

    # ── Amigos: Frank (handicap specialist) ──────────────────────────────────
    ("Frank",  0, "handicap",    "Saudi Arabia +1.5", 100, 1.70),  # WON
    ("Frank",  4, "handicap",    "England -2.5",      120, 1.75),  # WON
    ("Frank",  1, "1x2",         "Australia",          80, 6.00),  # LOST
    ("Frank",  5, "1x2",         "Belgium",           100, 1.55),  # WON
]

# ─────────────────────────────────────────────────────────────────────────────
# CHALLENGES — only WITHIN the same league (cross-league is blocked by design)
# (issuer, acceptor, match_idx, type, issuer_sel, acceptor_sel, stake, i_odds, a_odds)
# ─────────────────────────────────────────────────────────────────────────────
CHALLENGES_SEED = [
    # ── Familia: Alice vs Bob ─────────────────────────────────────────────────
    ("Alice", "Bob",   0, "1x2",
        "Argentina",     "Saudi Arabia",      150, 1.40, 6.50),   # Bob wins

    ("Alice", "Bob",   4, "1x2",
        "England",       "Iran",              100, 1.30, 9.00),   # Alice wins

    ("Bob",   "Alice", 2, "yellow_cards",
        "Under 5.5",     "Over 5.5",           80, 2.10, 1.75),   # Bob wins (4 < 5.5)

    ("Alice", "Bob",   0, "yellow_cards",
        "Over 4.5",      "Under 4.5",          80, 1.85, 1.95),   # Alice wins (6 > 4.5)

    # ── Trabajo: Carlos vs Diana ──────────────────────────────────────────────
    ("Carlos", "Diana", 3, "correct_score",
        "7-0",           "1-0",               50, 90.0, 1.80),   # Carlos wins 🎉

    ("Diana",  "Carlos", 1, "1x2",
        "France",        "Australia",         120, 1.30, 8.00),   # Diana wins

    ("Carlos", "Diana", 2, "red_cards",
        "Over 0.5",      "Under 0.5",          60, 2.40, 1.55),   # Carlos wins (1 red)

    ("Diana",  "Carlos", 4, "totals",
        "Over 5.5",      "Under 5.5",          80, 2.00, 1.80),   # Diana wins (8 goals)

    # ── Amigos: Eve vs Frank ──────────────────────────────────────────────────
    ("Eve",   "Frank", 0, "corners",
        "Over 6.5",      "Under 6.5",          80, 1.90, 1.90),   # Eve wins (7 > 6.5)

    ("Frank", "Eve",   4, "handicap",
        "England -2.5",  "Iran +2.5",         120, 1.75, 2.10),   # Frank wins

    ("Eve",   "Frank", 2, "yellow_cards",
        "Under 5.5",     "Over 5.5",           80, 2.10, 1.75),   # Eve wins (4 < 5.5)

    ("Frank", "Eve",   3, "1x2",
        "Spain",         "Costa Rica",        150, 1.20, 8.00),   # Frank wins
]

# ─────────────────────────────────────────────────────────────────────────────
# PREDICTIONS  (player, match_idx, home_pred, away_pred)
# ─────────────────────────────────────────────────────────────────────────────
PREDICTIONS_SEED = [
    # Familia
    ("Alice",  0, 2, 0),   # 2–0 Argentina — WRONG (0 pts)
    ("Alice",  1, 3, 0),   # 3–0 France — correct outcome (1 pt)
    ("Bob",    0, 1, 2),   # 1–2 Saudi — CORRECT SCORE (3 pts)
    ("Bob",    2, 1, 2),   # 1–2 Japan — CORRECT SCORE (3 pts)

    # Trabajo
    ("Carlos", 3, 7, 0),   # 7–0 Spain — CORRECT SCORE (3 pts) 🎉
    ("Carlos", 4, 5, 1),   # 5–1 England — correct outcome (1 pt)
    ("Diana",  1, 4, 1),   # 4–1 France — CORRECT SCORE (3 pts)
    ("Diana",  5, 1, 0),   # 1–0 Belgium — CORRECT SCORE (3 pts)

    # Amigos
    ("Eve",    3, 5, 0),   # 5–0 Spain — correct outcome (1 pt)
    ("Eve",    4, 4, 1),   # 4–1 England — correct outcome (1 pt)
    ("Frank",  0, 1, 2),   # 1–2 Saudi — CORRECT SCORE (3 pts)
    ("Frank",  4, 3, 0),   # 3–0 England — correct outcome (1 pt)
]

# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _actual_stat_label(btype: str, midx: int) -> str:
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
    return f"{D}score: {ms[2]}–{ms[3]}{Z}"


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

async def run():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as db:

        # ── seed leagues ──────────────────────────────────────────────────────
        for lname, lcode, _ in LEAGUES_SEED:
            db.add(League(name=lname, invite_code=lcode))
        await db.commit()
        res = await db.execute(select(League))
        leagues = {lg.name: lg for lg in res.scalars().all()}

        # ── seed players ──────────────────────────────────────────────────────
        for pname, lname in PLAYERS_SEED:
            db.add(Player(
                name=pname,
                token_balance=STARTING_BALANCE,
                session_token=f"tok-{pname.lower()}",
                league_id=leagues[lname].id,
            ))
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
        challenge_defs = []
        for (iname, aname, midx, btype, isel, asel, istake, iodds, aodds) in CHALLENGES_SEED:
            issuer   = players[iname]
            acceptor = players[aname]

            # league isolation check (simulation enforces it manually)
            assert issuer.league_id == acceptor.league_id, \
                f"Cross-league challenge blocked: {iname} ({issuer.league_id}) vs {aname} ({acceptor.league_id})"

            astake = max(1, round(istake * (iodds / aodds)))

            issuer.total_challenges_issued += 1
            issuer.challenge_streak += 1
            bonus, new_level = check_volume_milestone(
                issuer.total_challenges_issued, issuer.volume_milestone_reached)
            if bonus:
                issuer.token_balance += bonus
                issuer.volume_milestone_reached = new_level

            issuer.token_balance   -= istake
            acceptor.token_balance -= astake

            ch = Challenge(
                issuer_id=issuer.id, acceptor_id=acceptor.id,
                match_id=matches[midx].id,
                bet_type=btype, selection=isel, acceptor_selection=asel,
                issuer_stake=istake, acceptor_stake=astake,
                issuer_odds=iodds, acceptor_odds=aodds,
                status="accepted",
                bravery_streak_bonus_pct=streak_bonus_pct(issuer.challenge_streak),
            )
            db.add(ch)
            challenge_defs.append((ch, iname, aname, midx, btype, isel, asel, istake, iodds, aodds))
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

        # refresh challenge objects
        refreshed_challenges = []
        for (ch, *rest) in challenge_defs:
            await db.refresh(ch)
            refreshed_challenges.append((ch, *rest))

        res = await db.execute(select(Prediction))
        preds_map = {(p.player_id, p.match_id): p for p in res.scalars().all()}

        # ─────────────────────────────────────────────────────────────────────
        # REPORT
        # ─────────────────────────────────────────────────────────────────────

        header("⚽  WC 2022 GROUP-STAGE  —  MATCH RESULTS  (shared across all leagues)")
        for i, m in enumerate(matches):
            ms = MATCHES_SEED[i]
            r  = RESULTS[i]
            hs, as_ = ms[2], ms[3]
            icon  = "🟡" if hs == as_ else ("🏠" if hs > as_ else "✈️ ")
            reds  = r["home_red_cards"] + r["away_red_cards"]
            red_s = f"  {R}🟥×{reds}{Z}" if reds else ""
            print(f"  {icon}  {m.home_team:<13} {hs}–{as_}  {m.away_team:<13}"
                  f"  {D}({m.round})  🟨×{ms[7]}  ⚑×{ms[6]}{red_s}{Z}")

        # ── Per-league report ─────────────────────────────────────────────────
        league_members = {
            "Familia": ["Alice", "Bob"],
            "Trabajo": ["Carlos", "Diana"],
            "Amigos":  ["Eve",   "Frank"],
        }

        for (lname, lcode, lcolor) in LEAGUES_SEED:
            members = league_members[lname]

            league_header(f"{lname}  (code: {lcode})", lcolor)

            # ── Bets ──────────────────────────────────────────────────────────
            print(f"\n  {lcolor}💰  BETS{Z}")
            for pname in members:
                subheader(pname)
                res2 = await db.execute(
                    select(Bet).where(Bet.player_id == players[pname].id).order_by(Bet.id))
                pbet_rows = list(res2.scalars().all())
                defs = bet_defs_by_player[pname]
                for row, (btype, sel, stake, odds, midx) in zip(pbet_rows, defs):
                    ms  = MATCHES_SEED[midx]
                    won = row.status == "won"
                    net = int(stake * odds) - stake if won else -stake
                    status_s = f"{G}WON  +{net:>4}{Z}" if won else f"{R}LOST −{stake:>4}{Z}"
                    display_sel = ms[1] if sel == "Away" else sel
                    print(f"    {ms[0]+' vs '+ms[1]:<28} {btype:<14} "
                          f"{display_sel:<24} {stake:>3}t @ {odds}x  →  {status_s}")

            # ── Challenges ────────────────────────────────────────────────────
            print(f"\n  {lcolor}⚔️   CHALLENGES (within {lname}){Z}")
            league_chs = [
                (ch, iname, aname, midx, btype, isel, asel, istake, iodds, aodds)
                for (ch, iname, aname, midx, btype, isel, asel, istake, iodds, aodds)
                in refreshed_challenges
                if iname in members
            ]
            if not league_chs:
                print("    (none)")
            for (ch, iname, aname, midx, btype, isel, asel, istake, iodds, aodds) in league_chs:
                ms      = MATCHES_SEED[midx]
                astake  = ch.acceptor_stake
                res_d   = RESULTS[midx]
                match_obj = matches[midx]

                issuer_won = _evaluate_bet(btype, isel, match_obj, res_d)
                i_payout   = int(istake * iodds) if issuer_won else 0
                a_payout   = int(astake * aodds) if not issuer_won else 0
                bonus_tok  = int(i_payout * ch.bravery_streak_bonus_pct) \
                             if issuer_won and ch.bravery_streak_bonus_pct else 0

                winner = iname if issuer_won else aname
                loser  = aname if issuer_won else iname
                w_net  = (i_payout + bonus_tok if issuer_won else a_payout) - \
                         (istake if issuer_won else astake)
                l_net  = -(astake if issuer_won else istake)

                stat_label = _actual_stat_label(btype, midx)
                print(f"\n    {ms[0]} vs {ms[1]}  {D}[{btype}  {stat_label}{D}]{Z}")
                print(f"      {iname:<8} {isel:<28} {istake:>3}t @ {iodds}x")
                print(f"      {aname:<8} {asel:<28} {astake:>3}t @ {aodds}x")
                if bonus_tok:
                    pct = int(ch.bravery_streak_bonus_pct * 100)
                    print(f"      {M}🔥 streak bonus on {iname}: +{bonus_tok}t ({pct}%){Z}")
                print(f"      → {G}{winner} wins  +{w_net}t{Z}   {R}{loser} loses  {l_net}t{Z}")

            # ── Predictions ───────────────────────────────────────────────────
            print(f"\n  {lcolor}🎯  PREDICTIONS{Z}")
            print(f"    {'Player':<8} {'Match':<28} {'Pred':>5} {'Actual':>6} {'Pts':>5}  Status")
            print(f"    {'─'*7}  {'─'*26}  {'─'*5}  {'─'*5}  {'─'*4}  {'─'*14}")
            for (pname, midx, hp, ap) in PREDICTIONS_SEED:
                if pname not in members:
                    continue
                ms   = MATCHES_SEED[midx]
                pred = preds_map.get((players[pname].id, matches[midx].id))
                pts  = pred.points_awarded if pred else 0
                st   = pred.status if pred else "?"
                pts_s = f"{G}+{pts}{Z}" if pts > 0 else f"{R} 0{Z}"
                print(f"    {pname:<8} {ms[0]+' vs '+ms[1]:<28} "
                      f"{hp}–{ap}  {ms[2]}–{ms[3]}  {pts_s}  {D}{st}{Z}")

            # ── League leaderboard ────────────────────────────────────────────
            print(f"\n  {lcolor}🏅  {lname.upper()} LEADERBOARD{Z}")
            pred_pts = {}
            for pname in members:
                res5 = await db.execute(
                    select(Prediction).where(Prediction.player_id == players[pname].id))
                pred_pts[pname] = sum(r.points_awarded for r in res5.scalars().all())

            lb = []
            for pname in members:
                await db.refresh(players[pname])
                lb.append((
                    pname,
                    initial_balances[pname],
                    pre_settlement[pname],
                    players[pname].token_balance,
                    players[pname].token_balance - initial_balances[pname],
                    pred_pts[pname],
                ))
            lb.sort(key=lambda x: (x[3], x[5]), reverse=True)

            print(f"    {'':2} {'Player':<8} {'Start':>6} {'Pre-settle':>11} {'Final':>7} {'Net':>7}  {'Pred pts':>9}")
            print(f"    {'─'*2}  {'─'*6}  {'─'*6}  {'─'*9}  {'─'*7}  {'─'*7}  {'─'*8}")
            medals = ["🥇", "🥈"]
            for idx, (pname, start, pre, final, change, ppts) in enumerate(lb):
                sign = "+" if change >= 0 else ""
                c_s  = f"{G}{sign}{change}{Z}" if change >= 0 else f"{R}{change}{Z}"
                print(f"    {medals[idx]}  {pname:<8} {start:>6} {pre:>11} {final:>7} {c_s:>13}  {ppts:>9}")

        # ── Overall cross-league summary ──────────────────────────────────────
        header("🌍  OVERALL SUMMARY  (all leagues combined)")
        print(f"  {'League':<10} {'Player':<8} {'Final':>7} {'Net':>8}  {'Pred pts':>9}")
        print(f"  {'─'*8}  {'─'*6}  {'─'*7}  {'─'*7}  {'─'*8}")
        all_standings = []
        for lname, _, lcolor in LEAGUES_SEED:
            for pname in league_members[lname]:
                await db.refresh(players[pname])
                res5 = await db.execute(
                    select(Prediction).where(Prediction.player_id == players[pname].id))
                ppts = sum(r.points_awarded for r in res5.scalars().all())
                all_standings.append((
                    lname, lcolor, pname,
                    players[pname].token_balance,
                    players[pname].token_balance - initial_balances[pname],
                    ppts,
                ))
        all_standings.sort(key=lambda x: (x[3], x[5]), reverse=True)
        for lname, lcolor, pname, final, change, ppts in all_standings:
            sign = "+" if change >= 0 else ""
            c_s  = f"{G}{sign}{change}{Z}" if change >= 0 else f"{R}{change}{Z}"
            print(f"  {lcolor}{lname:<10}{Z}  {pname:<8} {final:>7} {c_s:>13}  {ppts:>9}")

        print(f"\n{B}{'─'*72}{Z}")
        print(f"  {D}In-memory DB — nothing written to disk.  3 leagues, {len(players)} players.{Z}\n")


if __name__ == "__main__":
    asyncio.run(run())
