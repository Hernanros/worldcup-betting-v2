"""Tests for results_client — per-player stats extraction."""
from unittest.mock import patch, MagicMock
from app.results_client import fetch_api_football_events


def _make_response(events: list) -> MagicMock:
    mock = MagicMock()
    mock.raise_for_status.return_value = None
    mock.json.return_value = {"response": events}
    return mock


def _goal(player_name: str, assist_name: str | None = None, detail: str = "Normal Goal") -> dict:
    return {
        "type": "Goal",
        "detail": detail,
        "player": {"name": player_name},
        "assist": {"name": assist_name} if assist_name else None,
        "team": {"name": "Argentina"},
        "time": {"elapsed": 10},
    }


def _sub(player_name: str, team: str, minute: int) -> dict:
    return {
        "type": "subst",
        "player": {"name": player_name},
        "team": {"name": team},
        "time": {"elapsed": minute},
    }


def test_player_stats_goals_counted():
    events = [_goal("L. Messi"), _goal("L. Messi"), _goal("K. Mbappe")]
    with patch("app.results_client.requests.get", return_value=_make_response(events)):
        result = fetch_api_football_events(fixture_id=99, api_key="test-key")
    assert result["player_stats"]["l. messi"]["goals"] == 2
    assert result["player_stats"]["k. mbappe"]["goals"] == 1


def test_player_stats_assists_counted():
    events = [_goal("L. Messi", assist_name="Di Maria")]
    with patch("app.results_client.requests.get", return_value=_make_response(events)):
        result = fetch_api_football_events(fixture_id=99, api_key="test-key")
    assert result["player_stats"]["l. messi"]["goals"] == 1
    assert result["player_stats"]["di maria"]["assists"] == 1
    assert result["player_stats"]["di maria"]["goals"] == 0


def test_own_goals_excluded_from_player_stats():
    events = [_goal("L. Messi", detail="Own Goal")]
    with patch("app.results_client.requests.get", return_value=_make_response(events)):
        result = fetch_api_football_events(fixture_id=99, api_key="test-key")
    assert result["player_stats"] == {}
    assert result["home_own_goals"] == 1


def test_unassisted_goal_no_assist_entry():
    events = [_goal("L. Messi", assist_name=None)]
    with patch("app.results_client.requests.get", return_value=_make_response(events)):
        result = fetch_api_football_events(fixture_id=99, api_key="test-key")
    assert result["player_stats"]["l. messi"]["assists"] == 0


def test_player_stats_empty_when_no_fixture_id():
    result = fetch_api_football_events(fixture_id=None, api_key="test-key")
    assert result["player_stats"] == {}


def test_existing_sub_goals_still_computed():
    events = [
        _sub("L. Messi", "Argentina", 60),
        _goal("L. Messi"),
    ]
    with patch("app.results_client.requests.get", return_value=_make_response(events)):
        result = fetch_api_football_events(fixture_id=99, api_key="test-key")
    assert "sub_goals" in result
    assert "player_stats" in result
