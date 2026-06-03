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
