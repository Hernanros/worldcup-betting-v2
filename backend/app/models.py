from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Boolean,
    ForeignKey, Text, UniqueConstraint,
)
from sqlalchemy.orm import relationship
from app.database import Base


class League(Base):
    __tablename__ = "leagues"
    id          = Column(Integer, primary_key=True)
    name        = Column(String(100), nullable=False)
    invite_code = Column(String(50), unique=True, nullable=False)
    created_at  = Column(DateTime, nullable=False, default=datetime.utcnow)
    ai_enabled  = Column(Boolean, nullable=False, default=True)

    players = relationship("Player", back_populates="league")


class Player(Base):
    __tablename__ = "players"
    __table_args__ = (UniqueConstraint("name", "league_id", name="uq_player_name_league"),)
    id = Column(Integer, primary_key=True)
    name = Column(String(50), nullable=False)
    session_token = Column(String(200), unique=True)
    token_balance = Column(Integer, nullable=False, default=1000)
    challenge_streak = Column(Integer, nullable=False, default=0)
    total_challenges_issued = Column(Integer, nullable=False, default=0)
    volume_milestone_reached = Column(Integer, nullable=False, default=0)
    is_admin = Column(Boolean, nullable=False, default=False)
    google_sub = Column(String(200), unique=True, nullable=True, index=True)
    email = Column(String(200), nullable=True)
    favorite_team = Column(String(50), nullable=True)
    league_id = Column(Integer, ForeignKey("leagues.id"), nullable=True)
    league    = relationship("League", back_populates="players")

    bets = relationship("Bet", back_populates="player")
    tournament_bets = relationship("TournamentBet", back_populates="player")
    issued_challenges = relationship("Challenge", foreign_keys="Challenge.issuer_id", back_populates="issuer")
    accepted_challenges = relationship("Challenge", foreign_keys="Challenge.acceptor_id", back_populates="acceptor")


class Match(Base):
    __tablename__ = "matches"
    id = Column(Integer, primary_key=True)
    home_team = Column(String(50), nullable=False)
    away_team = Column(String(50), nullable=False)
    kickoff_time = Column(DateTime, nullable=False)
    status = Column(String(20), nullable=False, default="upcoming")  # upcoming/locked/finished
    odds_cache = Column(Text)
    odds_fetched_at = Column(DateTime)
    home_score = Column(Integer)
    away_score = Column(Integer)
    home_red_cards = Column(Integer, default=0)
    away_red_cards = Column(Integer, default=0)
    corners = Column(Integer, default=0)  # legacy aggregate; use home_corners+away_corners
    round = Column(String(20), nullable=False, default="group")
    home_team_confirmed = Column(Boolean, nullable=False, default=True)
    away_team_confirmed = Column(Boolean, nullable=False, default=True)
    next_match_id = Column(Integer, ForeignKey("matches.id"), nullable=True)
    next_slot = Column(String(4), nullable=True)  # 'home' or 'away'
    espn_event_id      = Column(String(20))
    api_fixture_id     = Column(Integer)
    home_yellow_cards  = Column(Integer, nullable=False, default=0)
    away_yellow_cards  = Column(Integer, nullable=False, default=0)
    home_own_goals     = Column(Integer, nullable=False, default=0)
    away_own_goals     = Column(Integer, nullable=False, default=0)
    home_corners       = Column(Integer, nullable=False, default=0)
    away_corners       = Column(Integer, nullable=False, default=0)
    home_offsides      = Column(Integer, nullable=False, default=0)
    away_offsides      = Column(Integer, nullable=False, default=0)
    sub_goals          = Column(Integer, nullable=False, default=0)
    went_to_et         = Column(Boolean, nullable=False, default=False)
    went_to_pens       = Column(Boolean, nullable=False, default=False)
    player_stats_cache = Column(Text, nullable=True)

    bets = relationship("Bet", back_populates="match")
    challenges = relationship("Challenge", back_populates="match")
    predictions = relationship("Prediction", back_populates="match")


class Bet(Base):
    __tablename__ = "bets"
    id = Column(Integer, primary_key=True)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)
    bet_type = Column(String(30), nullable=False)
    selection = Column(String(100), nullable=False)
    stake = Column(Integer, nullable=False)
    odds_at_placement = Column(Float, nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    is_wildcard = Column(Boolean, nullable=False, default=False)

    player = relationship("Player", back_populates="bets")
    match = relationship("Match", back_populates="bets")


class Challenge(Base):
    __tablename__ = "challenges"
    id = Column(Integer, primary_key=True)
    issuer_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    acceptor_id = Column(Integer, ForeignKey("players.id"), nullable=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)
    bet_type = Column(String(30), nullable=False)
    selection = Column(String(100), nullable=False)
    acceptor_selection = Column(String(100), nullable=False)
    issuer_stake = Column(Integer, nullable=False)
    acceptor_stake = Column(Integer, nullable=False)
    issuer_odds = Column(Float, nullable=False)
    acceptor_odds = Column(Float, nullable=False)
    status = Column(String(20), nullable=False, default="open")  # open/accepted/cancelled/resolved
    bravery_streak_bonus_pct = Column(Float, nullable=False, default=0.0)

    issuer = relationship("Player", foreign_keys=[issuer_id], back_populates="issued_challenges")
    acceptor = relationship("Player", foreign_keys=[acceptor_id], back_populates="accepted_challenges")
    match = relationship("Match", back_populates="challenges")


class Prediction(Base):
    __tablename__ = "predictions"
    id = Column(Integer, primary_key=True)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)
    home_score_pred = Column(Integer, nullable=False)
    away_score_pred = Column(Integer, nullable=False)
    status = Column(String(30), nullable=False, default="pending")
    points_awarded = Column(Integer, nullable=False, default=0)
    is_double = Column(Boolean, nullable=False, default=False)

    __table_args__ = (UniqueConstraint("player_id", "match_id", name="uq_pred_player_match"),)

    player = relationship("Player", backref="predictions")
    match = relationship("Match", back_populates="predictions")


class TournamentBet(Base):
    __tablename__ = "tournament_bets"
    id = Column(Integer, primary_key=True)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    bet_type = Column(String(30), nullable=False)  # winner/golden_boot/total_goals
    selection = Column(String(100), nullable=False)
    stake = Column(Integer, nullable=False)
    odds_at_placement = Column(Float, nullable=False)
    status = Column(String(20), nullable=False, default="pending")

    player = relationship("Player", back_populates="tournament_bets")


class SpicyBet(Base):
    __tablename__ = "spicy_bets"
    id                = Column(Integer, primary_key=True)
    player_id         = Column(Integer, ForeignKey("players.id"), nullable=False)
    league_id         = Column(Integer, ForeignKey("leagues.id"), nullable=True)
    market_key        = Column(String(80), nullable=False)
    # tournament/group_stage/r32/r16/qf/sf/final
    # stage-level bet (not tied to a specific match)
    stage             = Column(String(20), nullable=False)
    selection         = Column(String(200), nullable=False)
    stake             = Column(Integer, nullable=False)
    odds_at_placement = Column(Float, nullable=False)
    status            = Column(String(20), nullable=False, default="pending")

    player = relationship("Player", backref="spicy_bets")
    league = relationship("League")


class SpicyDismissal(Base):
    __tablename__ = "spicy_dismissals"
    id           = Column(Integer, primary_key=True)
    player_id    = Column(Integer, ForeignKey("players.id"), nullable=False)
    # tournament/group_stage/r32/r16/qf/sf/final
    stage        = Column(String(20), nullable=False)
    dismissed_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    __table_args__ = (UniqueConstraint("player_id", "stage", name="uq_dismiss_player_stage"),)

    player = relationship("Player", backref="spicy_dismissals")


class InsurancePick(Base):
    """Free second pick on winner/golden_boot tournament markets.
    Pays int(primary.stake * primary.odds_at_placement * 0.5) tokens if
    primary bet lost AND this pick is correct.
    """
    __tablename__ = "insurance_picks"
    id                = Column(Integer, primary_key=True)
    player_id         = Column(Integer, ForeignKey("players.id"), nullable=False)
    tournament_bet_id = Column(Integer, ForeignKey("tournament_bets.id"), nullable=False)
    bet_type          = Column(String(30), nullable=False)   # "winner" or "golden_boot"
    selection         = Column(String(100), nullable=False)
    status            = Column(String(20), nullable=False, default="pending")  # pending/correct/wrong

    player          = relationship("Player", backref="insurance_picks")
    tournament_bet  = relationship("TournamentBet", backref="insurance_pick", uselist=False)
