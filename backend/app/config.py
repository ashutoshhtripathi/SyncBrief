import os
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "SyncBrief AI"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = "syncbrief-secret-key-enterprise-production-token"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # SQLite by default, cosmos DB / postgres compatible via SQLAlchemy URI
    DATABASE_URL: str = "sqlite:///./syncbrief.db"

    # Groq Cloud AI (Real-Time Ultra-Fast Inference)
    GROQ_API_KEY: Optional[str] = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
    GROQ_BASE_URL: str = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")

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
    AZURE_DEVOPS_ORG: str = os.getenv("AZURE_DEVOPS_ORG", "contoso-workspace")
    AZURE_DEVOPS_PROJECT: str = os.getenv("AZURE_DEVOPS_PROJECT", "SyncBrief-Core")
    AZURE_DEVOPS_PAT: Optional[str] = os.getenv("AZURE_DEVOPS_PAT", "")

    # Google OAuth 2.0 / OpenID Connect
    GOOGLE_CLIENT_ID: Optional[str] = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: Optional[str] = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI: Optional[str] = os.getenv("GOOGLE_REDIRECT_URI", "")

    # Microsoft Identity Platform (OAuth 2.0 Authorization Code + PKCE / OIDC)
    MICROSOFT_CLIENT_ID: Optional[str] = os.getenv("MICROSOFT_CLIENT_ID", "")
    MICROSOFT_CLIENT_SECRET: Optional[str] = os.getenv("MICROSOFT_CLIENT_SECRET", "")
    MICROSOFT_TENANT_ID: str = os.getenv("MICROSOFT_TENANT_ID", "common")
    MICROSOFT_REDIRECT_URI: Optional[str] = os.getenv("MICROSOFT_REDIRECT_URI", "")

    # Front-end OAuth Redirect URL
    OAUTH_REDIRECT_BASE_URL: str = os.getenv("OAUTH_REDIRECT_BASE_URL", "http://localhost:5173")

    @property
    def effective_google_redirect_uri(self) -> str:
        if self.GOOGLE_REDIRECT_URI:
            return self.GOOGLE_REDIRECT_URI
        return f"{self.OAUTH_REDIRECT_BASE_URL.rstrip('/')}/auth/callback"

    @property
    def effective_microsoft_redirect_uri(self) -> str:
        if self.MICROSOFT_REDIRECT_URI:
            return self.MICROSOFT_REDIRECT_URI
        return f"{self.OAUTH_REDIRECT_BASE_URL.rstrip('/')}/auth/callback"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
