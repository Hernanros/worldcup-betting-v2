from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    jwt_secret: str = "dev-secret"
    invite_code: str = "friends2026"
    admin_code: str = "admin"
    odds_api_key: str = ""
    football_api_key: str = ""
    anthropic_api_key: str = ""
    database_url: str = "sqlite+aiosqlite:///./worldcup.db"
    cors_origins: str = "*"

    model_config = {"env_file": ".env"}


settings = Settings()
