import os
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "SyncBrief AI"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = "syncbrief-secret-key-innovate2026-demo-mode-token"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # SQLite by default, cosmos DB / postgres compatible via SQLAlchemy URI
    DATABASE_URL: str = "sqlite:///./syncbrief.db"

    # Azure OpenAI
    AZURE_OPENAI_ENDPOINT: Optional[str] = os.getenv("AZURE_OPENAI_ENDPOINT", "")
    AZURE_OPENAI_KEY: Optional[str] = os.getenv("AZURE_OPENAI_KEY", "")
    AZURE_OPENAI_DEPLOYMENT: str = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o")
    AZURE_OPENAI_API_VERSION: str = os.getenv("AZURE_OPENAI_API_VERSION", "2024-08-01-preview")

    # Microsoft Teams Bot Framework / Webhooks
    TEAMS_WEBHOOK_URL: Optional[str] = os.getenv("TEAMS_WEBHOOK_URL", "")
    TEAMS_APP_ID: Optional[str] = os.getenv("TEAMS_APP_ID", "")
    TEAMS_APP_PASSWORD: Optional[str] = os.getenv("TEAMS_APP_PASSWORD", "")

    # Azure DevOps
    AZURE_DEVOPS_ORG: str = os.getenv("AZURE_DEVOPS_ORG", "contoso-innovate")
    AZURE_DEVOPS_PROJECT: str = os.getenv("AZURE_DEVOPS_PROJECT", "SyncBrief-Core")
    AZURE_DEVOPS_PAT: Optional[str] = os.getenv("AZURE_DEVOPS_PAT", "")

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
