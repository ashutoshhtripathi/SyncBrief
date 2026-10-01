from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import json
from typing import List, Optional
from backend.app.database import get_db
from backend.app.models import Checkin, Blocker, Message, Channel, User, AuditLog, Task
from backend.app.schemas import CheckinCreate, CheckinResponse, BlockerResponse
from backend.app.auth_deps import get_current_user
from backend.app.ai import get_ai_provider, CitationValidator
from backend.app.hierarchy import enforce_hierarchy_access

router = APIRouter(prefix="/checkins", tags=["Check-ins"])

def checkin_to_response(c: Checkin) -> dict:
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
    return {
        "id": c.id,
        "user_id": c.user_id,
        "user_name": c.user_name,
        "task_id": c.task_id,
        "task_title": c.task_title,
        "progress_pct": c.progress_pct or 0,
        "progress_note": c.progress_note or "",
        "next_steps": c.next_steps or "",
        "sync_needed_with": c.sync_needed_with,
        "other_task_ids": c.other_task_ids,
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
    }

@router.post("", response_model=CheckinResponse)
async def submit_checkin(
    req: CheckinCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submit a task-based 60-second standup check-in.
    Updates task progress, triggers AI blocker detection with verifiable citations.
    """
    # 1. Update streak
    current_user.streak_count = (current_user.streak_count or 0) + 1
    db.add(current_user)

    # 2. Resolve task association
    task_title = req.task_title
    task = None
    if req.task_id:
        task = db.query(Task).filter(Task.id == req.task_id).first()
        if task:
            task_title = task.title
            if req.progress_pct is not None:
                task.progress_pct = req.progress_pct
                if req.progress_pct >= 100:
                    task.status = "Done"
                    task.completed_at = datetime.utcnow()
                elif task.status == "To do" and req.progress_pct > 0:
                    task.status = "In progress"

    # Smart textual fallbacks
    yesterday_text = req.yesterday or ""
    if not yesterday_text:
        if task_title and req.progress_note:
            yesterday_text = f"Worked on '{task_title}' ({req.progress_pct}%): {req.progress_note}"
        elif req.progress_note:
            yesterday_text = req.progress_note
        else:
            yesterday_text = "Progressed on sprint deliverables."

    today_text = req.today or ""
    if not today_text:
        if req.next_steps:
            today_text = req.next_steps
        elif task_title:
            today_text = f"Continuing focus on '{task_title}'."
        else:
            today_text = "Continuing scheduled sprint tasks."

    # 3. Create Checkin record
    checkin = Checkin(
        user_id=current_user.id,
        user_name=current_user.full_name,
        task_id=req.task_id,
        task_title=task_title,
        progress_pct=req.progress_pct or 0,
        progress_note=req.progress_note or "",
        next_steps=req.next_steps or "",
        sync_needed_with_json=json.dumps(req.sync_needed_with or []),
        other_task_ids_json=json.dumps(req.other_task_ids or []),
        yesterday=yesterday_text,
        today=today_text,
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

    # 4. If blockers are mentioned and status is submitted, run AI Blocker Extraction
    has_blockers = req.blockers_text and req.blockers_text.lower() not in ["none", "no blockers", "n/a", "nil", "nothing"]
    if req.status == "submitted" and has_blockers:
        if task and task.status != "Done":
            task.status = "Blocked"

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
            "yesterday": yesterday_text,
            "today": today_text,
            "blockers_text": req.blockers_text,
            "pr_link": req.pr_link,
            "work_item_id": req.work_item_id
        }

        ai_provider = get_ai_provider()
        raw_blockers = await ai_provider.extract_blockers(checkin_payload, messages_payload)

        # Strict Citation Validation step
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

        # Audit Log Entry
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
    return checkin_to_response(checkin)

@router.get("", response_model=List[CheckinResponse])
def get_checkins(
    user_id: Optional[int] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve team check-in history.
    ENFORCES HIERARCHY ACCESS:
    If user_id is requested and is not current_user, verifies current_user can view user_id.
    Peers cannot view another peer's check-ins (403 Forbidden).
    """
    if user_id is not None:
        enforce_hierarchy_access(current_user, user_id, db)

    query = db.query(Checkin).order_by(Checkin.created_at.desc())
    if user_id:
        query = query.filter(Checkin.user_id == user_id)
    checkins = query.limit(limit).all()

    return [checkin_to_response(c) for c in checkins]

@router.get("/today", response_model=List[CheckinResponse])
def get_today_checkins(db: Session = Depends(get_db)):
    """Fetch all check-ins submitted in the last 24 hours."""
    since = datetime.utcnow() - timedelta(hours=24)
    checkins = db.query(Checkin).filter(Checkin.created_at >= since).order_by(Checkin.created_at.desc()).all()
    return [checkin_to_response(c) for c in checkins]

@router.get("/last-task")
def get_user_last_checkin_task(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns previous task from user's last check-in for smart pre-fill (<60s check-in)."""
    last_checkin = db.query(Checkin).filter(Checkin.user_id == current_user.id).order_by(Checkin.id.desc()).first()
    if last_checkin and last_checkin.task_id:
        return {
            "task_id": last_checkin.task_id,
            "task_title": last_checkin.task_title,
            "progress_pct": last_checkin.progress_pct or 0,
            "next_steps": last_checkin.next_steps or ""
        }
    return None
