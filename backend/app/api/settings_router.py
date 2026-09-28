from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from datetime import datetime
from backend.app.database import get_db
from backend.app.models import AuditLog, Checkin, Blocker, User
from backend.app.auth_deps import get_current_user

router = APIRouter(prefix="/settings", tags=["Settings, Privacy & Audit"])

@router.get("/audit-trail")
def get_audit_trail(limit: int = 30, db: Session = Depends(get_db)):
    """Explainability & governance: lists recent AI model invocations with prompt versions and input IDs."""
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()
    return [
        {
            "id": log.id,
            "action": log.action,
            "model_used": log.model_used,
            "prompt_version": log.prompt_version,
            "input_summary": log.input_summary,
            "output_summary": log.output_summary,
            "created_at": log.created_at
        }
        for log in logs
    ]

@router.delete("/delete-my-data")
def delete_my_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """GDPR / Privacy compliance: removes all check-ins and personal standup history for current user."""
    checkins = db.query(Checkin).filter(Checkin.user_id == current_user.id).all()
    checkin_ids = [c.id for c in checkins]

    # Delete associated blockers
    if checkin_ids:
        db.query(Blocker).filter(Blocker.checkin_id.in_(checkin_ids)).delete(synchronize_session=False)
        db.query(Checkin).filter(Checkin.user_id == current_user.id).delete(synchronize_session=False)

    db.add(AuditLog(
        action="gdpr_data_deletion",
        model_used="System",
        prompt_version="n/a",
        input_summary=f"User {current_user.full_name} ({current_user.email}) requested full personal data purge",
        output_summary=f"Purged {len(checkin_ids)} check-ins and linked blockers"
    ))
    db.commit()

    return {
        "status": "success",
        "message": f"Successfully purged all check-in history and blocker associations for {current_user.full_name}."
    }

@router.get("/privacy-explainer")
def get_privacy_explainer():
    """Returns structured transparency documentation on data boundaries."""
    return {
        "what_syncbrief_sees": [
            "Messages in channels that have been explicitly toggled to 'SyncBrief Enabled' (#backend, #frontend, #devops).",
            "Standup updates you submit via the 60-second check-in modal or Teams Adaptive Card.",
            "Work item keys (e.g. ADO-4820) and PR URLs you choose to attach."
        ],
        "what_syncbrief_NEVER_sees": [
            "Private 1-on-1 Teams direct messages (DMs).",
            "Unopted channels or external organization chats.",
            "Personal files, OneDrive documents, or emails.",
            "Audio/video streams from Teams calls (only text check-ins are processed)."
        ],
        "data_retention_days": 90,
        "encryption_in_transit": "TLS 1.3",
        "encryption_at_rest": "AES-256",
        "llm_data_policy": "Zero data retention for training; Microsoft Azure OpenAI enterprise contract terms apply."
    }
