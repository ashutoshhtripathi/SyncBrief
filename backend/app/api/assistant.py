import re
import uuid
from datetime import datetime, timedelta, time
import logging
from typing import Optional, List, Dict, Any, Tuple

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import User, Task, Checkin, Blocker, Sprint, PerformanceCycle, PerformanceGoal, TaskDependency
from backend.app.schemas import (
    AssistantChatRequest,
    AssistantChatResponse,
    EvidenceCitation
)
from backend.app.auth_deps import get_current_user
from backend.app.hierarchy import get_accessible_user_ids, get_subordinate_ids
from backend.app.ai import get_ai_provider, EvidenceValidator
from backend.app.api.dependencies import collect_dependencies
from backend.app.api.performance import build_performance_review_dossier
from backend.app.api.what_changed import calculate_working_day_window
from backend.app.audit import log_audit_event

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/assistant", tags=["Ask SyncBrief Assistant"])

# Lightweight in-memory session conversation storage
_CONVERSATIONS: Dict[str, List[Dict[str, str]]] = {}
MAX_CONVERSATION_TURNS = 10

def detect_mentioned_user(message: str, tenant_users: List[User]) -> Optional[User]:
    """Detect if the message mentions a specific tenant user by full name or first name."""
    lower_msg = message.lower()
    # Sort users by full_name length descending to match full names first
    sorted_users = sorted(tenant_users, key=lambda u: len(u.full_name or ""), reverse=True)
    for u in sorted_users:
        if not u.full_name:
            continue
        full_lower = u.full_name.lower()
        first_lower = full_lower.split()[0] if full_lower.split() else ""
        if full_lower in lower_msg or (first_lower and len(first_lower) > 2 and re.search(r"\b" + re.escape(first_lower) + r"\b", lower_msg)):
            return u
    return None

def build_citation(source_type: str, source_id: Any, title: str, author_or_owner: str, excerpt: str, timestamp: Optional[Any] = None) -> Dict[str, Any]:
    """Construct standard citation dictionary for validation."""
    ts_str = None
    if isinstance(timestamp, datetime):
        ts_str = timestamp.isoformat()
    elif timestamp:
        ts_str = str(timestamp)
    return {
        "source_type": source_type,
        "source_id": str(source_id),
        "title": title,
        "author_or_owner": author_or_owner,
        "excerpt": excerpt,
        "timestamp": ts_str,
        "verified": False
    }

@router.post("/chat", response_model=AssistantChatResponse)
async def chat_with_assistant(
    req: AssistantChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    POST /api/assistant/chat
    Evidence-grounded conversational interface for SyncBrief.
    Enforces strict tenant isolation, hierarchy-based RBAC, and citation validation.
    """
    user_msg = (req.message or "").strip()
    if not user_msg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message cannot be empty."
        )

    # 1. Manage Conversation Session
    conv_id = req.conversation_id or str(uuid.uuid4())
    conv_history = _CONVERSATIONS.get(conv_id, [])

    # 2. Scope & RBAC Resolution
    is_director_or_admin = (
        current_user.role in ["admin", "director"] or
        (current_user.role_level is not None and current_user.role_level <= 1)
    )
    is_manager = (
        current_user.role in ["manager"] or
        (current_user.role_level is not None and current_user.role_level == 2)
    )
    accessible_ids = get_accessible_user_ids(current_user, db)

    tenant_users = db.query(User).filter(
        User.tenant_id == current_user.tenant_id,
        User.deleted_at.is_(None)
    ).all()
    user_map = {u.id: u for u in tenant_users}
    accessible_names = {user_map[uid].full_name for uid in accessible_ids if uid in user_map}

    # 3. Detect Intent & Mentioned Users
    lower_msg = user_msg.lower()
    mentioned_user = detect_mentioned_user(user_msg, tenant_users)

    # Security Check: If an employee queries a peer who is outside their scope
    if mentioned_user and mentioned_user.id != current_user.id and not is_director_or_admin:
        if mentioned_user.id not in accessible_ids:
            return AssistantChatResponse(
                answer=(
                    f"You are only authorized to view your own records in SyncBrief. "
                    f"Records for {mentioned_user.full_name} are restricted to their reporting hierarchy."
                ),
                citations=[],
                conversation_id=conv_id,
                insufficient_data=True
            )

    # Infer follow-up intent from conversation history if message is short/ambiguous
    is_followup = any(kw in lower_msg for kw in ["oldest", "longest", "who owns", "which one", "tell me more", "details", "why"])
    last_assistant_turn = next((t["content"] for t in reversed(conv_history) if t.get("role") == "assistant"), "")

    intent = "unknown"
    if any(k in lower_msg for k in ["what changed", "yesterday", "since yesterday", "daily update", "progress since", "what happened"]):
        intent = "what_changed"
    elif any(k in lower_msg for k in ["blocker", "blocking", "blocked", "stalled"]) or (is_followup and "blocker" in last_assistant_turn.lower()):
        intent = "blockers"
    elif any(k in lower_msg for k in ["dependency", "dependencies", "cross-team", "waiting on", "bottleneck"]) or (is_followup and "dependenc" in last_assistant_turn.lower()):
        intent = "dependencies"
    elif any(k in lower_msg for k in ["review", "discuss", "preparation", "1-on-1", "appraisal agenda"]):
        intent = "review_prep"
    elif any(k in lower_msg for k in ["performance", "performing", "goal", "goals", "quarter", "points"]) or (is_followup and "performance" in last_assistant_turn.lower()):
        intent = "performance"
    elif any(k in lower_msg for k in ["task", "tasks", "sprint", "overdue", "at risk", "deliverable"]):
        intent = "tasks_sprint"

    # Context Data Payload to be passed to AI Provider
    context_data: Dict[str, Any] = {
        "intent": intent,
        "user_name": current_user.full_name,
        "user_role": current_user.role,
        "target_user_name": mentioned_user.full_name if mentioned_user else current_user.full_name,
        "citations": [],
        "insufficient_data": False
    }

    # 4. Context Retrieval by Intent (Strictly Authorized)
    if intent == "blockers":
        blocker_query = db.query(Blocker).filter(
            Blocker.tenant_id == current_user.tenant_id,
            Blocker.status.in_(["open", "in_progress", "active"])
        )
        if not is_director_or_admin:
            blocker_query = blocker_query.filter(Blocker.owner_name.in_(accessible_names))
        active_blockers = blocker_query.order_by(Blocker.created_at.asc()).all()

        now = datetime.utcnow()
        blocker_list = []
        raw_citations = []
        for b in active_blockers:
            age = (now - b.created_at).days if b.created_at else 0
            blocker_list.append({
                "id": b.id,
                "summary": b.summary,
                "owner_name": b.owner_name,
                "blocked_by": b.blocked_by or "External",
                "severity": b.severity or "medium",
                "status": b.status,
                "age_days": max(1, age)
            })
            raw_citations.append(build_citation(
                source_type="blocker",
                source_id=b.id,
                title=b.summary,
                author_or_owner=b.owner_name or "Team Member",
                excerpt=f"Blocker: {b.summary} (Blocked by {b.blocked_by or 'External'})",
                timestamp=b.created_at
            ))

        context_data["blockers"] = blocker_list
        context_data["citations"] = raw_citations
        if not blocker_list:
            context_data["insufficient_data"] = False  # valid 0 blockers

    elif intent == "dependencies":
        summary, dep_items = collect_dependencies(current_user, db)
        context_data["summary"] = summary.model_dump()
        dep_list = []
        raw_citations = []
        for d in dep_items:
            dep_dict = d.model_dump()
            dep_list.append(dep_dict)
            raw_citations.append(build_citation(
                source_type="dependency",
                source_id=d.dependency_id,
                title=d.summary,
                author_or_owner=d.source_owner,
                excerpt=f"Dependency on {d.dependency_team} ({d.dependency_owner}): {d.summary}",
                timestamp=d.created_at
            ))
        context_data["dependencies"] = dep_list
        context_data["citations"] = raw_citations

    elif intent == "what_changed":
        window_start, window_end, target_str, prev_str, is_weekend = calculate_working_day_window()
        # Completed tasks in window
        t_query = db.query(Task).filter(
            Task.tenant_id == current_user.tenant_id,
            Task.deleted_at.is_(None),
            Task.status == "completed",
            Task.updated_at >= window_start,
            Task.updated_at <= window_end
        )
        if not is_director_or_admin:
            t_query = t_query.filter(Task.assignee_id.in_(accessible_ids))
        completed_tasks = t_query.all()

        # Check-in updates in window
        c_query = db.query(Checkin).filter(
            Checkin.tenant_id == current_user.tenant_id,
            Checkin.created_at >= window_start,
            Checkin.created_at <= window_end
        )
        if not is_director_or_admin:
            c_query = c_query.filter(Checkin.user_id.in_(accessible_ids))
        window_checkins = c_query.all()

        # New blockers in window
        b_query = db.query(Blocker).filter(
            Blocker.tenant_id == current_user.tenant_id,
            Blocker.created_at >= window_start,
            Blocker.created_at <= window_end
        )
        if not is_director_or_admin:
            b_query = b_query.filter(Blocker.owner_name.in_(accessible_names))
        new_blockers = b_query.all()

        context_data["previous_working_day"] = prev_str
        context_data["completed_work"] = [
            {"id": t.id, "title": t.title, "owner": user_map.get(t.assignee_id).full_name if t.assignee_id in user_map else "Unassigned"}
            for t in completed_tasks
        ]
        context_data["meaningful_progress"] = [
            {"id": c.id, "owner": c.user_name, "progress": c.today}
            for c in window_checkins if c.today
        ]
        context_data["new_blockers"] = [
            {"id": b.id, "summary": b.summary, "owner": b.owner_name}
            for b in new_blockers
        ]

        raw_citations = []
        for t in completed_tasks:
            raw_citations.append(build_citation(
                source_type="task",
                source_id=t.id,
                title=t.title,
                author_or_owner=user_map.get(t.assignee_id).full_name if t.assignee_id in user_map else "Unassigned",
                excerpt=f"Task completed: {t.title}",
                timestamp=t.updated_at
            ))
        for c in window_checkins:
            raw_citations.append(build_citation(
                source_type="checkin",
                source_id=c.id,
                title=f"Check-in by {c.user_name}",
                author_or_owner=c.user_name or "Team Member",
                excerpt=c.today or c.yesterday or "Daily check-in update",
                timestamp=c.created_at
            ))
        for b in new_blockers:
            raw_citations.append(build_citation(
                source_type="blocker",
                source_id=b.id,
                title=b.summary,
                author_or_owner=b.owner_name or "Team Member",
                excerpt=b.summary,
                timestamp=b.created_at
            ))
        context_data["citations"] = raw_citations

    elif intent in ["performance", "review_prep"]:
        target_u = mentioned_user if mentioned_user else current_user
        if target_u.id not in accessible_ids and not is_director_or_admin:
            context_data["insufficient_data"] = True
            context_data["insufficient_reason"] = "You do not have authorization to view performance records for this user."
        else:
            dossier = build_performance_review_dossier(target_u, None, current_user, db)
            context_data["performance_dossier"] = {
                "employee_name": dossier["employee"]["full_name"],
                "current_cycle_metrics": {
                    "cycle_name": dossier["cycle"]["name"],
                    "earned_points": (dossier.get("comparison", {}).get("current_cycle") or {}).get("earned_points", 0.0),
                    "assigned_points": (dossier.get("comparison", {}).get("current_cycle") or {}).get("assigned_points", 0.0),
                    "completion_rate_pct": (dossier.get("comparison", {}).get("current_cycle") or {}).get("completion_rate_pct", 0.0)
                },
                "goals": [
                    {
                        "id": g.get("goal_id", g.get("id")),
                        "title": g["title"],
                        "status": g["status"],
                        "current_progress_percentage": g.get("progress", g.get("current_progress_percentage", 0))
                    }
                    for g in dossier.get("goals", [])
                ],
                "operational_delivery": dossier.get("operational_delivery", {}),
                "review_intelligence": dossier.get("review_intelligence", {})
            }
            raw_citations = []
            for g in dossier.get("goals", []):
                raw_citations.append(build_citation(
                    source_type="goal",
                    source_id=g.get("goal_id", g.get("id")),
                    title=g["title"],
                    author_or_owner=target_u.full_name,
                    excerpt=f"Goal: {g['title']} ({g.get('progress', g.get('current_progress_percentage', 0))}% progress)",
                    timestamp=None
                ))
            context_data["citations"] = raw_citations

    elif intent == "tasks_sprint":
        # Sprint & Tasks
        sprint = db.query(Sprint).filter(
            Sprint.tenant_id == current_user.tenant_id,
            Sprint.status == "active",
            Sprint.deleted_at.is_(None)
        ).first()

        t_query = db.query(Task).filter(
            Task.tenant_id == current_user.tenant_id,
            Task.deleted_at.is_(None)
        )
        if sprint:
            t_query = t_query.filter(Task.sprint_id == sprint.id)
        if not is_director_or_admin:
            t_query = t_query.filter(
                (Task.assignee_id.in_(accessible_ids)) |
                (Task.creator_id == current_user.id)
            )
        tasks = t_query.all()
        now = datetime.utcnow()

        task_list = []
        raw_citations = []
        for t in tasks:
            is_overdue = t.due_date is not None and t.due_date < now and t.status != "completed"
            task_list.append({
                "id": t.id,
                "title": t.title,
                "status": t.status,
                "is_overdue": is_overdue,
                "owner": user_map.get(t.assignee_id).full_name if t.assignee_id in user_map else "Unassigned"
            })
            raw_citations.append(build_citation(
                source_type="task",
                source_id=t.id,
                title=t.title,
                author_or_owner=user_map.get(t.assignee_id).full_name if t.assignee_id in user_map else "Unassigned",
                excerpt=f"Task: {t.title} (Status: {t.status})",
                timestamp=t.updated_at
            ))

        context_data["sprint"] = {"name": sprint.name if sprint else "Current Sprint"}
        context_data["tasks"] = task_list
        context_data["citations"] = raw_citations

    else:
        # Unknown or completely out-of-scope question
        context_data["insufficient_data"] = True
        context_data["insufficient_reason"] = (
            "I don't have enough verified SyncBrief data to answer that. "
            "You can ask about what changed yesterday, active blockers, cross-team dependencies, "
            "sprint tasks, or authorized performance records."
        )

    # 5. Call AI Provider (Azure OpenAI or Mock fallback)
    ai_provider = get_ai_provider()
    ai_response = await ai_provider.ask_syncbrief(
        context_data=context_data,
        user_message=user_msg,
        conversation_history=conv_history,
        user_role=current_user.role,
        user_name=current_user.full_name
    )

    answer_text = ai_response.get("answer", "I don't have enough verified SyncBrief data to answer that.")
    candidate_citations = ai_response.get("citations") or context_data.get("citations") or []
    is_insufficient = ai_response.get("insufficient_data", context_data.get("insufficient_data", False))

    # 6. Strict Evidence Validation via EvidenceValidator
    validated_citations: List[EvidenceCitation] = []
    if not is_insufficient and candidate_citations:
        for cit in candidate_citations:
            v_res = EvidenceValidator.validate_citation(cit, db, current_user)
            if v_res.get("verified"):
                validated_citations.append(EvidenceCitation(
                    source_type=v_res.get("source_type", "task"),
                    source_id=str(v_res.get("source_id", "")),
                    title=v_res.get("title", ""),
                    author_or_owner=v_res.get("author_or_owner") or v_res.get("owner") or "Verified Source",
                    timestamp=v_res.get("timestamp"),
                    excerpt=v_res.get("excerpt", ""),
                    verified=True
                ))

    # 7. Update Conversation Memory
    conv_history.append({"role": "user", "content": user_msg})
    conv_history.append({"role": "assistant", "content": answer_text})
    if len(conv_history) > MAX_CONVERSATION_TURNS * 2:
        conv_history = conv_history[-(MAX_CONVERSATION_TURNS * 2):]
    _CONVERSATIONS[conv_id] = conv_history

    # 8. Audit Logging
    try:
        log_audit_event(
            db=db,
            user=current_user,
            action="assistant_chat",
            target_type="assistant",
            target_id=conv_id,
            details=f"Intent: {intent} | Query: {user_msg[:80]}"
        )
    except Exception as audit_err:
        logger.warning(f"Failed to log assistant audit event: {audit_err}")

    return AssistantChatResponse(
        answer=answer_text,
        citations=validated_citations,
        conversation_id=conv_id,
        insufficient_data=is_insufficient
    )
