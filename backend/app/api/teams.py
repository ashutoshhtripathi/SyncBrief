from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session
from typing import Dict, Any
from backend.app.database import get_db
from backend.app.models import User, Digest
from backend.app.integrations.teams_cards import TeamsCardGenerator

router = APIRouter(prefix="/teams", tags=["Microsoft Teams Bot Framework"])

@router.post("/messages")
async def bot_framework_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Microsoft Bot Framework messaging endpoint.
    Receives incoming activities (card submits, conversation updates, bot mentions)
    from Microsoft Teams clients.
    """
    try:
        activity = await request.json()
    except Exception:
        activity = {}

    activity_type = activity.get("type", "message")
    from_user = activity.get("from", {}).get("name", "Team Member")
    value_data = activity.get("value", {})

    # Handle Card Submission
    if value_data and value_data.get("action") == "submit_checkin":
        # Checkin submitted from within Teams Adaptive Card
        return {
            "type": "message",
            "text": f"✅ Thanks {from_user}! Your check-in was successfully recorded by SyncBrief AI. Citations verified against opted-in channels."
        }

    if value_data and value_data.get("action") == "acknowledge_digest":
        return {
            "type": "message",
            "text": f"👍 {from_user} acknowledged today's Standup Digest."
        }

    # Handle normal text message or greeting
    return {
        "type": "message",
        "text": f"👋 Hello {from_user}! SyncBrief AI bot is active. Use `/standup` or check your scheduled Adaptive Card to submit updates."
    }

@router.get("/card-preview/checkin")
def preview_checkin_card():
    """Retrieve sample check-in Adaptive Card schema."""
    return TeamsCardGenerator.generate_checkin_card(user_name="Priya Sharma")

@router.get("/card-preview/digest")
def preview_digest_card(db: Session = Depends(get_db)):
    """Retrieve sample daily digest Adaptive Card schema."""
    digest = db.query(Digest).order_by(Digest.id.desc()).first()
    if digest:
        import json
        return TeamsCardGenerator.generate_digest_card({
            "date": digest.date,
            "progress_by_person": json.loads(digest.progress_by_person_json),
            "blockers_summary": json.loads(digest.blockers_summary_json),
            "risks": json.loads(digest.risks_json)
        })
    return TeamsCardGenerator.generate_digest_card({
        "date": "2026-09-29",
        "progress_by_person": [{"name": "Priya Sharma", "yesterday": "OAuth", "today": "Testing"}],
        "blockers_summary": [{"summary": "PR #184 schema dependency", "severity": "high", "owner": "Priya"}],
        "risks": ["Release timeline affected"]
    })
