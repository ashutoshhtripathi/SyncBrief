from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.config import settings
from backend.app.database import engine, Base, run_migrations
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
from backend.app.api.sprints import router as sprints_router
from backend.app.api.tasks import router as tasks_router
from backend.app.api.points import router as points_router
from backend.app.api.performance import router as performance_router
from backend.app.api.jira import router as jira_router
from backend.app.api.audit import router as audit_router
from backend.app.api.what_changed import router as what_changed_router
from backend.app.api.dependencies import router as dependencies_router
from backend.app.api.assistant import router as assistant_router
from backend.app.middleware import SecurityHeadersMiddleware, RateLimitMiddleware

# Ensure tables exist and columns are migrated
Base.metadata.create_all(bind=engine)
run_migrations()

# Auto-seed if database has 0 users so email/password authentication always succeeds
try:
    from backend.app.database import SessionLocal
    from backend.app.models import User
    with SessionLocal() as db_session:
        if db_session.query(User).count() == 0:
            from backend.app.seed import seed_database
            seed_database()
except Exception as _seed_err:
    import logging
    logging.getLogger("uvicorn.error").warning(f"Startup auto-seed check: {_seed_err}")

app = FastAPI(
    title="SyncBrief AI Backend API",
    description="Async standup updates with verifiable chat evidence citations and real-time AI for distributed engineering teams.",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Enterprise Security Headers & Rate Limiting
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware, max_requests=1000, window_seconds=60)

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
app.include_router(sprints_router, prefix=settings.API_V1_STR)
app.include_router(tasks_router, prefix=settings.API_V1_STR)
app.include_router(points_router, prefix=settings.API_V1_STR)
app.include_router(performance_router, prefix=settings.API_V1_STR)
app.include_router(jira_router, prefix=settings.API_V1_STR)
app.include_router(audit_router, prefix=settings.API_V1_STR)
app.include_router(what_changed_router, prefix=settings.API_V1_STR)
app.include_router(dependencies_router, prefix=settings.API_V1_STR)
app.include_router(assistant_router, prefix=settings.API_V1_STR)

@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "SyncBrief AI"}

from backend.app.auth_utils import SERVER_BOOT_ID

@app.get("/api/status", tags=["System Status"])
def system_status():
    ai = get_ai_provider()
    badge = "Demo AI (Offline)"
    if not ai.is_mock:
        if getattr(ai, "is_groq", False):
            badge = f"Groq ({settings.GROQ_MODEL})"
        else:
            badge = f"Azure OpenAI ({settings.AZURE_OPENAI_DEPLOYMENT})"

    return {
        "status": "online",
        "app_name": "SyncBrief AI",
        "version": "2.0.0",
        "boot_id": SERVER_BOOT_ID,
        "ai_provider": ai.name,
        "is_mock": ai.is_mock,
        "badge_label": badge,
        "groq_configured": bool(settings.GROQ_API_KEY),
        "groq_model": settings.GROQ_MODEL,
        "azure_openai_configured": bool(settings.AZURE_OPENAI_ENDPOINT and settings.AZURE_OPENAI_KEY),
        "teams_configured": bool(settings.TEAMS_WEBHOOK_URL),
        "devops_configured": bool(settings.AZURE_DEVOPS_PAT)
    }

# Mount Production Static Frontend Assets if built
import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi import HTTPException

frontend_dist = os.path.abspath("frontend/dist")
if os.path.exists(frontend_dist) and os.path.exists(os.path.join(frontend_dist, "index.html")):
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api") or full_path in ["docs", "redoc", "openapi.json", "health"]:
            raise HTTPException(status_code=404, detail="Not Found")
        target = os.path.join(frontend_dist, full_path)
        if os.path.isfile(target):
            return FileResponse(target)
        return FileResponse(os.path.join(frontend_dist, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
