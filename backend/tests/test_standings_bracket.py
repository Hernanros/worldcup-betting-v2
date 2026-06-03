"""
Tests for GET /api/tournament/standings and GET /api/tournament/bracket.
"""
import pytest
from datetime import datetime, timezone
from app.models import Match
from tests.conftest import join_player


# ── Standings helpers ────────────────────────────────────────────────────────

def _finished(db, home, away, hs, as_, home_rc=0, away_rc=0, home_yc=0, away_yc=0):
    """Return an unsaved Match object for a finished group-stage game."""
    m = Match(
        home_team=home, away_team=away,
        kickoff_time=datetime(2026, 6, 15, 18, 0, tzinfo=timezone.utc),
        status="finished",
        round="group",
        home_score=hs, away_score=as_,
        home_red_cards=home_rc, away_red_cards=away_rc,
        home_yellow_cards=home_yc, away_yellow_cards=away_yc,
    )
    db.add(m)
    return m


async def _seed_group_f(db):
    """Seed a partially-played Group F (Spain, Portugal, Egypt, Algeria)."""
    # Spain 3-1 Egypt
    _finished(db, "Spain", "Egypt", 3, 1)
    # Algeria 0-2 Portugal
    _finished(db, "Algeria", "Portugal", 0, 2)
    # Spain 1-1 Portugal
    _finished(db, "Spain", "Portugal", 1, 1)
    await db.commit()


# ── Standings tests ──────────────────────────────────────────────────────────

async def test_standings_returns_all_groups(client):
    """Response has keys for every group A-L."""
    alice = await join_player(client)
    headers = {"Authorization": f"Bearer {alice['token']}"}
    resp = await client.get("/api/tournament/standings", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert set(body["groups"].keys()) == set("ABCDEFGHIJKL")


async def test_standings_each_group_has_four_teams(client):
    alice = await join_player(client)
    headers = {"Authorization": f"Bearer {alice['token']}"}
    resp = await client.get("/api/tournament/standings", headers=headers)
    body = resp.json()
    for letter, rows in body["groups"].items():
        assert len(rows) == 4, f"Group {letter} has {len(rows)} rows"


async def test_standings_correct_points_after_results(client, db):
    """After seeding Group F, Spain leads on 4 pts."""
    await _seed_group_f(db)
    alice = await join_player(client)
    headers = {"Authorization": f"Bearer {alice['token']}"}
    resp = await client.get("/api/tournament/standings", headers=headers)
    assert resp.status_code == 200
    group_f = resp.json()["groups"]["F"]

    by_team = {row["team"]: row for row in group_f}
    assert by_team["Spain"]["pts"] == 4     # 3-1 W + 1-1 D
    assert by_team["Portugal"]["pts"] == 4   # 2-0 W + 1-1 D
    assert by_team["Egypt"]["pts"] == 0
    assert by_team["Algeria"]["pts"] == 0


async def test_standings_goals_for_goals_against(client, db):
    """GF/GA/GD computed correctly."""
    await _seed_group_f(db)
    alice = await join_player(client)
    headers = {"Authorization": f"Bearer {alice['token']}"}
    resp = await client.get("/api/tournament/standings", headers=headers)
    body = resp.json()
    by_team = {row["team"]: row for row in body["groups"]["F"]}

    # Spain: scored 3+1=4, conceded 1+1=2
    assert by_team["Spain"]["gf"] == 4
    assert by_team["Spain"]["ga"] == 2
    assert by_team["Spain"]["gd"] == 2


async def test_standings_played_counts(client, db):
    """Played counts reflect actual finished matches only."""
    await _seed_group_f(db)
    alice = await join_player(client)
    headers = {"Authorization": f"Bearer {alice['token']}"}
    resp = await client.get("/api/tournament/standings", headers=headers)
    body = resp.json()
    by_team = {row["team"]: row for row in body["groups"]["F"]}

    assert by_team["Spain"]["played"] == 2
    assert by_team["Portugal"]["played"] == 2
    assert by_team["Egypt"]["played"] == 1
    assert by_team["Algeria"]["played"] == 1


async def test_standings_wildcards_present(client):
    """Wildcards list has 12 entries (one per group, even with no matches played)."""
    alice = await join_player(client)
    headers = {"Authorization": f"Bearer {alice['token']}"}
    resp = await client.get("/api/tournament/standings", headers=headers)
    body = resp.json()
    assert "wildcards" in body
    assert len(body["wildcards"]) == 12


async def test_standings_wildcards_top8_advance(client):
    """First 8 wildcards have advances=true; last 4 have advances=false."""
    alice = await join_player(client)
    headers = {"Authorization": f"Bearer {alice['token']}"}
    resp = await client.get("/api/tournament/standings", headers=headers)
    wildcards = resp.json()["wildcards"]
    for row in wildcards[:8]:
        assert row["advances"] is True
    for row in wildcards[8:]:
        assert row["advances"] is False


async def test_standings_wildcard_ranks_sequential(client):
    """wildcard_rank runs 1–12 with no gaps."""
    alice = await join_player(client)
    headers = {"Authorization": f"Bearer {alice['token']}"}
    resp = await client.get("/api/tournament/standings", headers=headers)
    wildcards = resp.json()["wildcards"]
    ranks = [row["wildcard_rank"] for row in wildcards]
    assert ranks == list(range(1, 13))


async def test_standings_wildcard_leader_has_most_pts(client, db):
    """3rd-place team with most pts ranks #1 in wildcards."""
    # Seed a complete Group A: Mexico 1st, Ecuador 2nd, Jamaica 3rd (3 pts), Venezuela 4th
    _finished(db, "Mexico",   "Jamaica",   2, 0)   # Mex win
    _finished(db, "Venezuela", "Ecuador",  0, 3)   # Ecu win
    _finished(db, "Mexico",   "Ecuador",   2, 1)   # Mex win
    _finished(db, "Jamaica",  "Venezuela", 1, 0)   # Jam win
    _finished(db, "Mexico",   "Venezuela", 0, 0)   # draw
    _finished(db, "Jamaica",  "Ecuador",   0, 2)   # Ecu win
    await db.commit()
    # Standings: Mexico 7 pts, Ecuador 6 pts, Jamaica 3 pts, Venezuela 1 pt
    # All other groups unplayed → their 3rd-place have 0 pts
    # So Jamaica (3 pts) should be wildcard #1

    alice = await join_player(client)
    headers = {"Authorization": f"Bearer {alice['token']}"}
    resp = await client.get("/api/tournament/standings", headers=headers)
    body = resp.json()

    # Verify Group A standings first
    grp_a = {row["team"]: row for row in body["groups"]["A"]}
    assert grp_a["Mexico"]["pts"] == 7
    assert grp_a["Ecuador"]["pts"] == 6
    assert grp_a["Jamaica"]["pts"] == 3
    assert grp_a["Venezuela"]["pts"] == 1

    # Jamaica (3rd in A) should be wildcard rank #1 since all other 3rd-place teams have 0 pts
    wildcards = body["wildcards"]
    assert wildcards[0]["team"] == "Jamaica"
    assert wildcards[0]["wildcard_rank"] == 1
    assert wildcards[0]["advances"] is True


# ── Bracket tests ────────────────────────────────────────────────────────────

async def _seed_ko_matches(db):
    """Seed a handful of knockout matches across stages."""
    # R32 match
    db.add(Match(
        home_team="Spain", away_team="TBD",
        home_team_confirmed=True, away_team_confirmed=False,
        kickoff_time=datetime(2026, 6, 29, 18, 0, tzinfo=timezone.utc),
        status="upcoming", round="r32",
    ))
    # Finished R16 match
    m = Match(
        home_team="France", away_team="Brazil",
        home_team_confirmed=True, away_team_confirmed=True,
        kickoff_time=datetime(2026, 7, 5, 18, 0, tzinfo=timezone.utc),
        status="finished", round="r16",
        home_score=2, away_score=1,
    )
    db.add(m)
    await db.commit()


async def test_bracket_returns_all_rounds(client):
    """Response includes all 5 KO rounds even if empty."""
    alice = await join_player(client)
    headers = {"Authorization": f"Bearer {alice['token']}"}
    resp = await client.get("/api/tournament/bracket", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert set(body["rounds"].keys()) == {"r32", "r16", "qf", "sf", "final"}


async def test_bracket_match_fields(client, db):
    """Each match entry has the expected fields."""
    await _seed_ko_matches(db)
    alice = await join_player(client)
    headers = {"Authorization": f"Bearer {alice['token']}"}
    resp = await client.get("/api/tournament/bracket", headers=headers)
    body = resp.json()

    r32 = body["rounds"]["r32"]
    assert len(r32) == 1
    m = r32[0]
    assert m["home_team"] == "Spain"
    assert m["away_team"] == "TBD"
    assert m["home_confirmed"] is True
    assert m["away_confirmed"] is False
    assert m["status"] == "upcoming"


async def test_bracket_finished_match_has_scores(client, db):
    """Finished R16 match includes scores."""
    await _seed_ko_matches(db)
    alice = await join_player(client)
    headers = {"Authorization": f"Bearer {alice['token']}"}
    resp = await client.get("/api/tournament/bracket", headers=headers)
    r16 = resp.json()["rounds"]["r16"]
    assert len(r16) == 1
    m = r16[0]
    assert m["home_score"] == 2
    assert m["away_score"] == 1


async def test_bracket_empty_rounds_are_lists(client):
    """Rounds with no matches return empty lists, not null."""
    alice = await join_player(client)
    headers = {"Authorization": f"Bearer {alice['token']}"}
    resp = await client.get("/api/tournament/bracket", headers=headers)
    body = resp.json()
    for rnd, matches in body["rounds"].items():
        assert isinstance(matches, list), f"Round {rnd} is not a list"


async def test_standings_requires_auth(client):
    # Missing Authorization header → FastAPI returns 422 (required header absent)
    resp = await client.get("/api/tournament/standings")
    assert resp.status_code in (401, 422)


async def test_bracket_requires_auth(client):
    resp = await client.get("/api/tournament/bracket")
    assert resp.status_code in (401, 422)
