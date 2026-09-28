from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import json
from typing import List, Optional
from backend.app.database import get_db
from backend.app.models import Checkin, Blocker, Message, Channel, User, AuditLog
from backend.app.schemas import CheckinCreate, CheckinResponse, BlockerResponse
from backend.app.auth_deps import get_current_user
from backend.app.ai import get_ai_provider, CitationValidator

router = APIRouter(prefix="/checkins", tags=["Check-ins"])

@router.post("", response_model=CheckinResponse)
async def submit_checkin(
    req: CheckinCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submit a 60-second standup check-in.
    Automatically triggers AI blocker extraction and strict citation validation against opted-in channels.
    """
    # 1. Update streak
    current_user.streak_count = (current_user.streak_count or 0) + 1
    db.add(current_user)

    # 2. Create Checkin record
    checkin = Checkin(
        user_id=current_user.id,
        user_name=current_user.full_name,
        yesterday=req.yesterday,
        today=req.today,
        blockers_text=req.blockers_text or "",
        mood=req.mood,
        pr_link=req.pr_link,
        work_item_id=req.work_item_id,
        status=req.status,
        streak_count=current_user.streak_count,
        ai_processed=False
    )
    db.add(checkin)
    db.flush()

    extracted_blocker_responses = []

    # 3. If blockers are mentioned and status is submitted, run AI Blocker Extraction
    if req.status == "submitted" and req.blockers_text and req.blockers_text.lower() not in ["none", "no blockers", "n/a", "nil", "nothing"]:
        # Fetch messages ONLY from opted-in channels (Privacy First!)
        opted_in_channels = db.query(Channel).filter(Channel.is_syncbrief_enabled == True).all()
        channel_ids = [c.id for c in opted_in_channels]
        
        recent_messages = db.query(Message).filter(Message.channel_id.in_(channel_ids)).order_by(Message.timestamp.desc()).limit(80).all()
        messages_payload = [
            {
                "id": m.id,
                "channel_name": m.channel_name,
                "author_name": m.author_name,
                "content": m.content,
                "thread_id": m.thread_id,
                "timestamp": m.timestamp.isoformat() if m.timestamp else None
            }
            for m in recent_messages
        ]

        checkin_payload = {
            "user_name": current_user.full_name,
            "yesterday": req.yesterday,
            "today": req.today,
            "blockers_text": req.blockers_text,
            "pr_link": req.pr_link,
            "work_item_id": req.work_item_id
        }

        ai_provider = get_ai_provider()
        raw_blockers = await ai_provider.extract_blockers(checkin_payload, messages_payload)

        # 4. Strict Citation Validation step
        for b_data in raw_blockers:
            raw_citations = b_data.get("citations", [])
            validated_citations = CitationValidator.validate_citations(raw_citations, db)

            blocker_model = Blocker(
                checkin_id=checkin.id,
                summary=b_data.get("blocker_summary", req.blockers_text),
                severity=b_data.get("severity", "medium"),
                status="open",
                owner_name=b_data.get("owner", current_user.full_name),
                blocked_by=b_data.get("blocked_by", "Pending Investigation"),
                related_work_item=b_data.get("related_work_item") or req.work_item_id or (req.pr_link if "PR" in (req.pr_link or "") else None),
                confidence=b_data.get("confidence", 0.95),
                citations_json=json.dumps(validated_citations),
                devops_work_item_id=None
            )
            db.add(blocker_model)
            db.flush()

            extracted_blocker_responses.append({
                "id": blocker_model.id,
                "summary": blocker_model.summary,
                "severity": blocker_model.severity,
                "status": blocker_model.status,
                "owner_name": blocker_model.owner_name,
                "blocked_by": blocker_model.blocked_by,
                "related_work_item": blocker_model.related_work_item,
                "confidence": blocker_model.confidence,
                "citations": validated_citations,
                "created_at": blocker_model.created_at
            })

        # 5. Audit Log Entry
        audit = AuditLog(
            action="blocker_extraction",
            model_used=ai_provider.name,
            prompt_version="blocker_v1",
            input_message_ids_json=json.dumps([m["id"] for m in messages_payload[:20]]),
            input_summary=f"Checkin from {current_user.full_name}: {req.blockers_text[:100]}",
            output_summary=f"Extracted {len(raw_blockers)} blockers with {sum(len(b.get('citations', [])) for b in raw_blockers)} citations"
        )
        db.add(audit)
        checkin.ai_processed = True

    db.commit()
    db.refresh(checkin)

    return {
        "id": checkin.id,
        "user_id": checkin.user_id,
        "user_name": checkin.user_name,
        "yesterday": checkin.yesterday,
        "today": checkin.today,
        "blockers_text": checkin.blockers_text,
        "mood": checkin.mood,
        "pr_link": checkin.pr_link,
        "work_item_id": checkin.work_item_id,
        "status": checkin.status,
        "streak_count": checkin.streak_count,
        "ai_processed": checkin.ai_processed,
        "created_at": checkin.created_at,
        "blockers": extracted_blocker_responses
    }

@router.get("", response_model=List[CheckinResponse])
def get_checkins(
    user_id: Optional[int] = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Retrieve team check-in history."""
    query = db.query(Checkin).order_by(Checkin.created_at.desc())
    if user_id:
        query = query.filter(Checkin.user_id == user_id)
    checkins = query.limit(limit).all()

    result = []
    for c in checkins:
        blockers_list = []
        for b in c.blockers:
            blockers_list.append({
                "id": b.id,
                "summary": b.summary,
                "severity": b.severity,
                "status": b.status,
                "owner_name": b.owner_name,
                "blocked_by": b.blocked_by,
                "related_work_item": b.related_work_item,
                "confidence": b.confidence,
                "citations": b.citations,
                "devops_work_item_id": b.devops_work_item_id,
                "created_at": b.created_at
            })
        result.append({
            "id": c.id,
            "user_id": c.user_id,
            "user_name": c.user_name,
            "yesterday": c.yesterday,
            "today": c.today,
            "blockers_text": c.blockers_text,
            "mood": c.mood,
            "pr_link": c.pr_link,
            "work_item_id": c.work_item_id,
            "status": c.status,
            "streak_count": c.streak_count,
            "ai_processed": c.ai_processed,
            "created_at": c.created_at,
            "blockers": blockers_list
        })
    return result

@router.get("/today", response_model=List[CheckinResponse])
def get_today_checkins(db: Session = Depends(get_db)):
    """Fetch all check-ins submitted in the last 24 hours."""
    since = datetime.utcnow() - timedelta(hours=24)
    checkins = db.query(Checkin).filter(Checkin.created_at >= since).order_by(Checkin.created_at.desc()).all()
    result = []
    for c in checkins:
        result.append({
            "id": c.id,
            "user_id": c.user_id,
            "user_name": c.user_name,
            "yesterday": c.yesterday,
            "today": c.today,
            "blockers_text": c.blockers_text,
            "mood": c.mood,
            "pr_link": c.pr_link,
            "work_item_id": c.work_item_id,
            "status": c.status,
            "streak_count": c.streak_count,
            "ai_processed": c.ai_processed,
            "created_at": c.created_at,
            "blockers": [
                {
                    "id": b.id,
                    "summary": b.summary,
                    "severity": b.severity,
                    "status": b.status,
                    "owner_name": b.owner_name,
                    "blocked_by": b.blocked_by,
                    "related_work_item": b.related_work_item,
                    "confidence": b.confidence,
                    "citations": b.citations,
                    "devops_work_item_id": b.devops_work_item_id,
                    "created_at": b.created_at
                }
                for b in c.blockers
            ]
        })
    return result
