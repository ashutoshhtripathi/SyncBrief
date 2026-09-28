from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.config import settings
from backend.app.database import engine, Base
from backend.app.ai import get_ai_provider
from backend.app.api.auth import router as auth_router
from backend.app.api.checkins import router as checkins_router
from backend.app.api.blockers import router as blockers_router
from backend.app.api.digest import router as digest_router
from backend.app.api.channels import router as channels_router
from backend.app.api.teams import router as teams_router
from backend.app.api.insights import router as insights_router
from backend.app.api.settings_router import router as settings_router
from backend.app.api.demo import router as demo_router

# Ensure tables exist
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="SyncBrief AI Backend API",
    description="Async standup updates with verifiable chat evidence citations for distributed teams. Microsoft Innovate 2026 Hackathon.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS for local development and containerized environments
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(checkins_router, prefix=settings.API_V1_STR)
app.include_router(blockers_router, prefix=settings.API_V1_STR)
app.include_router(digest_router, prefix=settings.API_V1_STR)
app.include_router(channels_router, prefix=settings.API_V1_STR)
app.include_router(teams_router, prefix=settings.API_V1_STR)
app.include_router(insights_router, prefix=settings.API_V1_STR)
app.include_router(settings_router, prefix=settings.API_V1_STR)
app.include_router(demo_router, prefix=settings.API_V1_STR)

@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "SyncBrief AI"}

@app.get("/api/status", tags=["System Status"])
def system_status():
    ai = get_ai_provider()
    return {
        "status": "online",
        "app_name": "SyncBrief AI",
        "version": "1.0.0",
        "ai_provider": ai.name,
        "is_mock": ai.is_mock,
        "badge_label": "Demo AI (Offline)" if ai.is_mock else f"Azure OpenAI ({settings.AZURE_OPENAI_DEPLOYMENT})",
        "azure_openai_configured": bool(settings.AZURE_OPENAI_ENDPOINT and settings.AZURE_OPENAI_KEY),
        "teams_configured": bool(settings.TEAMS_WEBHOOK_URL),
        "devops_configured": bool(settings.AZURE_DEVOPS_PAT)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
