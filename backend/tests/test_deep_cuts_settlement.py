import pytest
from app.deep_cuts_config import DEEP_CUTS_MARKETS, STAGE_ROUNDS, get_stage_lock_time
from datetime import timezone

def test_all_markets_have_required_fields():
    required = {"stage", "label", "type", "settle"}
    for key, market in DEEP_CUTS_MARKETS.items():
        missing = required - set(market.keys())
        assert not missing, f"Market '{key}' missing: {missing}"

def test_known_markets_present():
    keys = set(DEEP_CUTS_MARKETS.keys())
    assert "most_exhausted" in keys
    assert "total_corners" in keys
    assert "group_advance_A" in keys
    assert "r16_pen_shootouts" in keys
    assert "final_to_pens" in keys

def test_stage_rounds_covers_all_stages():
    assert set(STAGE_ROUNDS.keys()) == {"tournament", "group_stage", "r32", "r16", "qf", "sf", "final"}

def test_group_stage_lock_time_is_set():
    t = get_stage_lock_time("group_stage", db=None)
    assert t is not None
    assert t.tzinfo == timezone.utc

from unittest.mock import patch, MagicMock
from app.results_client import (
    fetch_espn_match_stats, fetch_api_football_events,
    compute_sub_goals,
)

def test_fetch_espn_match_stats_full_time():
    """Parses yellow cards, corners, offsides, ET=False, pens=False from STATUS_FULL_TIME."""
    mock_data = {
        "header": {"competitions": [{"status": {"type": {"name": "STATUS_FULL_TIME"}}}]},
        "boxscore": {"teams": [
            {"homeAway": "home", "team": {"displayName": "Spain"}, "statistics": [
                {"name": "yellowCards", "displayValue": "2"},
                {"name": "redCards",    "displayValue": "0"},
                {"name": "wonCorners",  "displayValue": "7"},
                {"name": "offsides",    "displayValue": "3"},
            ]},
            {"homeAway": "away", "team": {"displayName": "England"}, "statistics": [
                {"name": "yellowCards", "displayValue": "1"},
                {"name": "redCards",    "displayValue": "1"},
                {"name": "wonCorners",  "displayValue": "2"},
                {"name": "offsides",    "displayValue": "1"},
            ]},
        ]},
    }
    with patch("app.results_client.requests.get") as mock_get:
        mock_get.return_value.json.return_value = mock_data
        mock_get.return_value.raise_for_status = MagicMock()
        stats = fetch_espn_match_stats("703945")

    assert stats["home_yellow_cards"] == 2
    assert stats["away_yellow_cards"] == 1
    assert stats["home_corners"] == 7
    assert stats["away_corners"] == 2
    assert stats["home_offsides"] == 3
    assert stats["away_offsides"] == 1
    assert stats["went_to_et"] is False
    assert stats["went_to_pens"] is False

def test_fetch_espn_match_stats_pens():
    """Detects STATUS_FINAL_PEN → went_to_et=True, went_to_pens=True."""
    mock_data = {
        "header": {"competitions": [{"status": {"type": {"name": "STATUS_FINAL_PEN"}}}]},
        "boxscore": {"teams": []},
    }
    with patch("app.results_client.requests.get") as mock_get:
        mock_get.return_value.json.return_value = mock_data
        mock_get.return_value.raise_for_status = MagicMock()
        stats = fetch_espn_match_stats("703940")
    assert stats["went_to_et"] is True
    assert stats["went_to_pens"] is True

def test_fetch_espn_match_stats_aet():
    """Detects STATUS_FINAL_AET → went_to_et=True, went_to_pens=False."""
    mock_data = {
        "header": {"competitions": [{"status": {"type": {"name": "STATUS_FINAL_AET"}}}]},
        "boxscore": {"teams": []},
    }
    with patch("app.results_client.requests.get") as mock_get:
        mock_get.return_value.json.return_value = mock_data
        mock_get.return_value.raise_for_status = MagicMock()
        stats = fetch_espn_match_stats("703939")
    assert stats["went_to_et"] is True
    assert stats["went_to_pens"] is False

def test_compute_sub_goals():
    """Goal at 75' by a player who was subbed on at 60' counts as a sub goal."""
    events = [
        {"type": "subst", "time": {"elapsed": 60}, "player": {"name": "Cole Palmer"}, "team": {"name": "England"}},
        {"type": "Goal",  "time": {"elapsed": 75}, "player": {"name": "Cole Palmer"}, "team": {"name": "England"}, "detail": "Normal Goal"},
        {"type": "Goal",  "time": {"elapsed": 30}, "player": {"name": "Bellingham"},  "team": {"name": "England"}, "detail": "Normal Goal"},
    ]
    assert compute_sub_goals(events) == 1

def test_compute_sub_goals_own_goal_not_counted():
    """Own goals are not counted as sub goals even if scorer was a sub."""
    events = [
        {"type": "subst", "time": {"elapsed": 55}, "player": {"name": "Own Goal"}, "team": {"name": "Spain"}},
        {"type": "Goal",  "time": {"elapsed": 80}, "player": {"name": "Own Goal"}, "team": {"name": "Spain"}, "detail": "Own Goal"},
    ]
    assert compute_sub_goals(events) == 0

def test_fetch_api_football_events_returns_sub_goals():
    """sub_goals counts goals scored by players who were subbed on."""
    mock_data = {
        "response": [
            {"type": "subst", "time": {"elapsed": 60}, "player": {"name": "Olmo"}, "team": {"name": "Spain"}},
            {"type": "Goal",  "time": {"elapsed": 75}, "player": {"name": "Olmo"}, "team": {"name": "Spain"}, "detail": "Normal Goal"},
            {"type": "Goal",  "time": {"elapsed": 20}, "player": {"name": "Torres"}, "team": {"name": "Spain"}, "detail": "Normal Goal"},
        ]
    }
    with patch("app.results_client.requests.get") as mock_get:
        mock_get.return_value.json.return_value = mock_data
        mock_get.return_value.raise_for_status = MagicMock()
        result = fetch_api_football_events(12345, "test_key")
    assert result["sub_goals"] == 1
    assert result["home_own_goals"] == 0
    assert result["away_own_goals"] == 0

def test_fetch_api_football_events_no_key_returns_zeros():
    """Returns zero dict immediately when api_key is falsy — no network call."""
    from app.results_client import fetch_api_football_events
    with patch("app.results_client.requests.get") as mock_get:
        result = fetch_api_football_events(12345, "")
    mock_get.assert_not_called()
    assert result == {"home_own_goals": 0, "away_own_goals": 0, "sub_goals": 0}


import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.models import Base, Match, Player, League, SpicyBet
from app.deep_cuts_settlement import settle_stage
from datetime import datetime, timezone
import sqlalchemy

TEST_DB = "sqlite+aiosqlite:///:memory:"

@pytest_asyncio.fixture
async def settle_db():
    engine = create_async_engine(TEST_DB)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        league = League(name="Test", invite_code="test")
        session.add(league)
        await session.commit()
        await session.refresh(league)
    yield engine, factory
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


async def _make_match(factory, home, away, round_, **kwargs):
    async with factory() as db:
        m = Match(
            home_team=home, away_team=away,
            kickoff_time=datetime(2026, 6, 20, tzinfo=timezone.utc),
            status="finished", round=round_, **kwargs
        )
        db.add(m)
        await db.commit()
        await db.refresh(m)
        return m.id


async def _make_spicy_bet(factory, market_key, stage, selection, stake=100, odds=2.0):
    async with factory() as db:
        league = (await db.execute(
            sqlalchemy.select(League).where(League.invite_code == "test")
        )).scalar_one()
        player = Player(name=f"P_{market_key[:8]}", token_balance=1000, league_id=league.id)
        db.add(player)
        await db.commit()
        await db.refresh(player)
        # Deduct stake at bet placement (as the API endpoint does)
        player.token_balance -= stake
        bet = SpicyBet(
            player_id=player.id, league_id=league.id,
            market_key=market_key, stage=stage,
            selection=selection, stake=stake, odds_at_placement=odds,
        )
        db.add(bet)
        await db.commit()
        await db.refresh(bet)
        return player.id, bet.id


@pytest.mark.asyncio
async def test_settle_sum_field_over_wins(settle_db):
    """Over/under: player picks 'Over 2.5' own goals, actual=4 → wins."""
    engine, factory = settle_db
    await _make_match(factory, "Spain", "England", "group",
                      home_own_goals=2, away_own_goals=2)
    player_id, bet_id = await _make_spicy_bet(
        factory, "own_goals", "group_stage", "Over 2.5", stake=100, odds=1.85
    )
    async with factory() as db:
        await settle_stage("group_stage", db)
        await db.commit()

    async with factory() as db:
        bet = await db.get(SpicyBet, bet_id)
        player = await db.get(Player, player_id)
        assert bet.status == "won"
        assert player.token_balance == 1000 - 100 + int(100 * 1.85)


@pytest.mark.asyncio
async def test_settle_sum_field_under_wins(settle_db):
    """Over/under: player picks 'Under 2.5' own goals, actual=1 → wins."""
    engine, factory = settle_db
    await _make_match(factory, "France", "Brazil", "group",
                      home_own_goals=0, away_own_goals=1)
    player_id, bet_id = await _make_spicy_bet(
        factory, "own_goals", "group_stage", "Under 2.5", stake=100, odds=1.95
    )
    async with factory() as db:
        await settle_stage("group_stage", db)
        await db.commit()

    async with factory() as db:
        bet = await db.get(SpicyBet, bet_id)
        assert bet.status == "won"


@pytest.mark.asyncio
async def test_settle_team_pick_top_goals(settle_db):
    """Team pick: player picks France (3 goals) beats Spain (1 goal) → wins."""
    engine, factory = settle_db
    await _make_match(factory, "France", "Germany", "r32", home_score=3, away_score=0)
    await _make_match(factory, "Spain",  "Italy",   "r32", home_score=1, away_score=0)
    player_id, bet_id = await _make_spicy_bet(
        factory, "r32_top_scorer", "r32", "France", stake=100, odds=32.0
    )
    async with factory() as db:
        await settle_stage("r32", db)
        await db.commit()

    async with factory() as db:
        bet = await db.get(SpicyBet, bet_id)
        assert bet.status == "won"


@pytest.mark.asyncio
async def test_settle_exact_count_pens(settle_db):
    """Exact count: player picks 1 shootout, 1 match has went_to_pens=True → wins."""
    engine, factory = settle_db
    await _make_match(factory, "Portugal", "Morocco", "r16", went_to_pens=True)
    await _make_match(factory, "England",  "USA",     "r16", went_to_pens=False)
    player_id, bet_id = await _make_spicy_bet(
        factory, "r16_pen_shootouts", "r16", "1", stake=100, odds=2.5
    )
    async with factory() as db:
        await settle_stage("r16", db)
        await db.commit()

    async with factory() as db:
        bet = await db.get(SpicyBet, bet_id)
        assert bet.status == "won"


@pytest.mark.asyncio
async def test_settle_yes_no_et(settle_db):
    """Yes/no: player picks 'yes' for any SF going to ET, one does → wins."""
    engine, factory = settle_db
    await _make_match(factory, "Spain", "France", "sf", went_to_et=True)
    await _make_match(factory, "Brazil", "England", "sf", went_to_et=False)
    player_id, bet_id = await _make_spicy_bet(
        factory, "sf_any_et", "sf", "yes", stake=100, odds=2.20
    )
    async with factory() as db:
        await settle_stage("sf", db)
        await db.commit()

    async with factory() as db:
        bet = await db.get(SpicyBet, bet_id)
        assert bet.status == "won"
