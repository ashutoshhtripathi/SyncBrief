from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import json
import httpx
from typing import Dict, Any
from backend.app.database import get_db
from backend.app.models import Digest, Checkin, Blocker, User, AuditLog
from backend.app.schemas import DigestResponse
from backend.app.ai import get_ai_provider
from backend.app.integrations.teams_cards import TeamsCardGenerator
from backend.app.config import settings
from backend.app.auth_deps import get_current_user

router = APIRouter(prefix="/digest", tags=["Daily Digest"])

@router.get("/today", response_model=DigestResponse)
async def get_today_digest(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Fetch today's executive standup digest scoped to tenant, or synthesize if not present."""
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    query = db.query(Digest).filter(Digest.date == today_str)
    if current_user.tenant_id is not None:
        query = query.filter(Digest.tenant_id == current_user.tenant_id)
    digest = query.order_by(Digest.id.desc()).first()

    if not digest:
        return await regenerate_digest(current_user=current_user, db=db)

    return {
        "id": digest.id,
        "date": digest.date,
        "progress_by_person": json.loads(digest.progress_by_person_json),
        "blockers_summary": json.loads(digest.blockers_summary_json),
        "risks": json.loads(digest.risks_json),
        "missing_checkins": json.loads(digest.missing_checkins_json),
        "suggested_actions": json.loads(digest.suggested_actions_json),
        "markdown_content": digest.markdown_content,
        "teams_card_json": json.loads(digest.teams_card_json) if digest.teams_card_json else {},
        "created_at": digest.created_at
    }

@router.post("/regenerate", response_model=DigestResponse)
async def regenerate_digest(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Re-synthesize the daily standup digest with the latest tenant team updates and verified citations."""
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    since = datetime.utcnow() - timedelta(hours=24)

    # Gather data strictly filtered by tenant organization
    checkin_query = db.query(Checkin).filter(Checkin.created_at >= since)
    blocker_query = db.query(Blocker).filter(Blocker.status.in_(["open", "in_progress"]))
    user_query = db.query(User).filter(User.deleted_at.is_(None))

    if current_user.tenant_id is not None:
        checkin_query = checkin_query.filter(Checkin.tenant_id == current_user.tenant_id)
        blocker_query = blocker_query.filter(Blocker.tenant_id == current_user.tenant_id)
        user_query = user_query.filter(User.tenant_id == current_user.tenant_id)

    checkins = checkin_query.all()
    blockers = blocker_query.all()
    users = user_query.all()

    checkins_payload = [
        {
            "user_name": c.user_name,
            "yesterday": c.yesterday,
            "today": c.today,
            "blockers_text": c.blockers_text,
            "mood": c.mood,
            "created_at": c.created_at.isoformat() if c.created_at else None
        }
        for c in checkins
    ]

    blockers_payload = [
        {
            "summary": b.summary,
            "severity": b.severity,
            "owner_name": b.owner_name,
            "blocked_by": b.blocked_by,
            "citations": b.citations
        }
        for b in blockers
    ]

    users_payload = [
        {"id": u.id, "full_name": u.full_name, "role": u.role, "timezone": u.timezone}
        for u in users
    ]

    ai_provider = get_ai_provider()
    digest_res = await ai_provider.generate_digest(
        checkins=checkins_payload,
        blockers=blockers_payload,
        team_members=users_payload,
        digest_date=today_str
    )

    # Generate Microsoft Teams Adaptive Card
    teams_card = TeamsCardGenerator.generate_digest_card(digest_res)

    digest = Digest(
        tenant_id=current_user.tenant_id,
        date=today_str,
        progress_by_person_json=json.dumps(digest_res.get("progress_by_person", [])),
        blockers_summary_json=json.dumps(digest_res.get("blockers_summary", [])),
        risks_json=json.dumps(digest_res.get("risks", [])),
        missing_checkins_json=json.dumps(digest_res.get("missing_checkins", [])),
        suggested_actions_json=json.dumps(digest_res.get("suggested_actions", [])),
        markdown_content=digest_res.get("markdown_content", ""),
        teams_card_json=json.dumps(teams_card)
    )
    db.add(digest)

    # Audit log
    audit = AuditLog(
        tenant_id=current_user.tenant_id,
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        action="digest_generation",
        model_used=ai_provider.name,
        prompt_version="digest_v1",
        input_summary=f"Synthesized {len(checkins_payload)} check-ins and {len(blockers_payload)} blockers",
        output_summary=f"Digest generated for {today_str} with {len(digest_res.get('risks', []))} risks and {len(digest_res.get('suggested_actions', []))} actions"
    )
    db.add(audit)
    db.commit()
    db.refresh(digest)

    return {
        "id": digest.id,
        "date": digest.date,
        "progress_by_person": json.loads(digest.progress_by_person_json),
        "blockers_summary": json.loads(digest.blockers_summary_json),
        "risks": json.loads(digest.risks_json),
        "missing_checkins": json.loads(digest.missing_checkins_json),
        "suggested_actions": json.loads(digest.suggested_actions_json),
        "markdown_content": digest.markdown_content,
        "teams_card_json": teams_card,
        "created_at": digest.created_at
    }

@router.post("/post-to-teams")
async def post_digest_to_teams(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Post Adaptive Card standup digest to Microsoft Teams webhook or mock connector for current tenant."""
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    query = db.query(Digest).filter(Digest.date == today_str)
    if current_user.tenant_id is not None:
        query = query.filter(Digest.tenant_id == current_user.tenant_id)
    digest = query.order_by(Digest.id.desc()).first()
    if not digest:
        raise HTTPException(status_code=404, detail="Digest not generated yet for current organization")

    card_json = json.loads(digest.teams_card_json) if digest.teams_card_json else {}

    webhook_url = settings.TEAMS_WEBHOOK_URL
    if webhook_url:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(webhook_url, json={"type": "message", "attachments": [{"contentType": "application/vnd.microsoft.card.adaptive", "content": card_json}]}, timeout=8.0)
                resp.raise_for_status()
                return {"status": "success", "mode": "live_teams", "message": "Successfully posted digest to Microsoft Teams channel!"}
        except Exception as e:
            return {"status": "mock_fallback", "mode": "mock", "message": f"Teams webhook failed ({e}); simulated successful broadcast in mock mode.", "card": card_json}

    return {
        "status": "success",
        "mode": "mock_preview",
        "message": "Teams Broadcast Simulated! In production, this posts directly into Microsoft Teams #standup channel.",
        "card": card_json
    }

