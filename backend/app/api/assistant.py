import re
import uuid
from datetime import datetime, timedelta
import logging
import json
from typing import Optional, List, Dict, Any, Tuple

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import (
    User, Task, Checkin, Blocker, Sprint, PerformanceCycle,
    PerformanceGoal, TaskDependency, Channel, Message
)
from backend.app.schemas import (
    AssistantChatRequest,
    AssistantChatResponse,
    EvidenceCitation
)
from backend.app.auth_deps import get_current_user
from backend.app.hierarchy import get_accessible_user_ids
from backend.app.ai import get_ai_provider, EvidenceValidator
from backend.app.api.dependencies import collect_dependencies
from backend.app.api.performance import build_performance_review_dossier
from backend.app.api.what_changed import calculate_working_day_window
from backend.app.audit import log_audit_event
from backend.app.ai.groq_provider import is_conversational_or_greeting, filter_relevant_citations

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/assistant", tags=["Ask SyncBrief Assistant"])

# Lightweight in-memory session conversation storage
_CONVERSATIONS: Dict[str, List[Dict[str, str]]] = {}
MAX_CONVERSATION_TURNS = 10

def detect_mentioned_user(message: str, tenant_users: List[User]) -> Optional[User]:
    """Detect if the message mentions a specific tenant user by full name or first name."""
    lower_msg = message.lower()
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

def is_out_of_scope_query(lower_msg: str) -> bool:
    """Detect non-work trivia questions."""
    trivia_keywords = [
        "capital of", "weather in", "recipe for", "how to bake", "poem about",
        "who won the world cup", "distance to moon", "president of france", "president of the",
        "population of", "tell me a joke", "who wrote", "lyrics to"
    ]
    return any(tk in lower_msg for tk in trivia_keywords)

def is_prompt_injection(lower_msg: str) -> bool:
    """Detect prompt injection or jailbreak attempts."""
    injection_keywords = [
        "ignore previous instructions", "developer mode", "jailbreak",
        "show me all employee salaries", "system prompt", "bypass security",
        "override safety"
    ]
    return any(ik in lower_msg for ik in injection_keywords)

def is_asking_private_notes(lower_msg: str) -> bool:
    """Detect attempts to read confidential manager review notes."""
    return "private manager note" in lower_msg or "notes written about me" in lower_msg

def build_workspace_context(
    current_user: User,
    db: Session,
    user_msg: str,
    conv_history: List[Dict[str, str]]
) -> Tuple[Dict[str, Any], Optional[str], Optional[User]]:
    """
    Build a comprehensive, strictly authorized data context from live database records.
    Guarantees tenant isolation and reporting-hierarchy role constraints.
    """
    lower_msg = user_msg.lower()

    # 1. Scope & RBAC
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

    mentioned_user = detect_mentioned_user(user_msg, tenant_users)

    # Security Check: Guardrail for peer queries outside scope
    if mentioned_user and mentioned_user.id != current_user.id and not is_director_or_admin:
        if mentioned_user.id not in accessible_ids:
            return {
                "insufficient_data": True,
                "insufficient_reason": (
                    f"You are only authorized to view your own records in SyncBrief. "
                    f"Records for {mentioned_user.full_name} are restricted to their reporting hierarchy."
                ),
                "citations": []
            }, "peer_restricted", mentioned_user

    # Security Check: Private manager notes guardrail
    if is_asking_private_notes(lower_msg) and not is_director_or_admin and not is_manager:
        return {
            "insufficient_data": True,
            "insufficient_reason": (
                "I don't have enough verified SyncBrief data to answer that. "
                "Private manager notes are restricted and cannot be viewed by employees."
            ),
            "citations": []
        }, "private_notes_restricted", mentioned_user

    # Security Check: Out-of-scope trivia guardrail
    if is_out_of_scope_query(lower_msg):
        return {
            "insufficient_data": True,
            "insufficient_reason": (
                "I don't have enough verified SyncBrief data to answer that. "
                "You can ask about what changed yesterday, active blockers, cross-team dependencies, "
                "sprint tasks, or authorized performance records."
            ),
            "citations": []
        }, "out_of_scope", mentioned_user

    # Security Check: Prompt injection guardrail
    if is_prompt_injection(lower_msg):
        return {
            "insufficient_data": True,
            "insufficient_reason": (
                "I don't have enough verified SyncBrief data to answer that. "
                "Requests attempting to bypass security boundaries or disclose unauthorized records are refused."
            ),
            "citations": []
        }, "injection_refused", mentioned_user

    # Intent Detection for priority context and backward compatibility
    is_followup = any(kw in lower_msg for kw in ["oldest", "longest", "who owns", "which one", "tell me more", "details", "why"])
    last_assistant_turn = next((t["content"] for t in reversed(conv_history) if t.get("role") == "assistant"), "")

    intent = "comprehensive"
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

    raw_citations: List[Dict[str, Any]] = []

    # 1. Team Members in Scope
    team_members_list = []
    for u in tenant_users:
        if is_director_or_admin or u.id in accessible_ids:
            mgr = user_map.get(u.reports_to_id)
            team_members_list.append({
                "id": u.id,
                "name": u.full_name,
                "role": u.role,
                "title": u.title,
                "email": u.email,
                "manager": mgr.full_name if mgr else "None",
                "streak": u.streak_count
            })

    # 2. Blockers in Scope
    now = datetime.utcnow()
    blocker_query = db.query(Blocker).filter(
        Blocker.tenant_id == current_user.tenant_id,
        Blocker.status.in_(["open", "in_progress", "active"])
    )
    if not is_director_or_admin:
        blocker_query = blocker_query.filter(Blocker.owner_name.in_(accessible_names))
    active_blockers = blocker_query.order_by(Blocker.created_at.asc()).all()

    blocker_list = []
    for b in active_blockers:
        age = (now - b.created_at).days if b.created_at else 0
        blocker_list.append({
            "id": b.id,
            "summary": b.summary,
            "owner_name": b.owner_name,
            "blocked_by": b.blocked_by or "External",
            "severity": b.severity or "medium",
            "status": b.status,
            "age_days": max(1, age),
            "related_work_item": b.related_work_item or b.devops_work_item_id or "N/A"
        })
        raw_citations.append(build_citation(
            source_type="blocker",
            source_id=b.id,
            title=b.summary,
            author_or_owner=b.owner_name or "Team Member",
            excerpt=f"Blocker: {b.summary} (Blocked by {b.blocked_by or 'External'})",
            timestamp=b.created_at
        ))

    # 3. Tasks & Active Sprint in Scope
    sprint = db.query(Sprint).filter(
        Sprint.tenant_id == current_user.tenant_id,
        Sprint.status == "active",
        Sprint.deleted_at.is_(None)
    ).first()

    t_query = db.query(Task).filter(
        Task.tenant_id == current_user.tenant_id,
        Task.deleted_at.is_(None)
    )
    if sprint and intent == "tasks_sprint":
        t_query = t_query.filter(Task.sprint_id == sprint.id)
    if not is_director_or_admin:
        t_query = t_query.filter(
            (Task.assignee_id.in_(accessible_ids)) |
            (Task.creator_id == current_user.id)
        )
    tasks = t_query.order_by(Task.updated_at.desc()).limit(30).all()

    task_list = []
    for t in tasks:
        due_d = getattr(t, "due_date", None)
        is_overdue = due_d is not None and due_d < now and t.status != "completed"
        owner_name = user_map.get(t.assignee_id).full_name if t.assignee_id in user_map else (t.assignee_name or "Unassigned")
        task_list.append({
            "id": t.id,
            "title": t.title,
            "status": t.status,
            "priority": t.priority,
            "difficulty_points": t.difficulty,
            "progress_pct": t.progress_pct,
            "is_overdue": is_overdue,
            "owner": owner_name
        })
        raw_citations.append(build_citation(
            source_type="task",
            source_id=t.id,
            title=t.title,
            author_or_owner=owner_name,
            excerpt=f"Task: {t.title} (Status: {t.status})",
            timestamp=t.updated_at
        ))

    # 4. Recent Check-ins (Daily Standups) in Scope
    c_query = db.query(Checkin).filter(
        Checkin.tenant_id == current_user.tenant_id
    )
    if not is_director_or_admin:
        c_query = c_query.filter(Checkin.user_id.in_(accessible_ids))
    recent_checkins = c_query.order_by(Checkin.created_at.desc()).limit(15).all()

    checkin_list = []
    for c in recent_checkins:
        checkin_list.append({
            "id": c.id,
            "user_name": c.user_name,
            "today": c.today,
            "yesterday": c.yesterday,
            "blockers_text": c.blockers_text,
            "progress_note": c.progress_note,
            "progress_pct": c.progress_pct,
            "mood": c.mood,
            "created_at": c.created_at.isoformat() if c.created_at else None
        })
        raw_citations.append(build_citation(
            source_type="checkin",
            source_id=c.id,
            title=f"Check-in by {c.user_name}",
            author_or_owner=c.user_name or "Team Member",
            excerpt=c.today or c.yesterday or "Daily check-in update",
            timestamp=c.created_at
        ))

    # 5. Cross-Team Dependencies
    summary, dep_items = collect_dependencies(current_user, db)
    dep_list = []
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

    # 6. Performance & Review Prep (if queried or accessible)
    perf_dossier = None
    if intent in ["performance", "review_prep"]:
        target_u = mentioned_user if mentioned_user else current_user
        if target_u.id not in accessible_ids and not is_director_or_admin:
            return {
                "insufficient_data": True,
                "insufficient_reason": "You do not have authorization to view performance records for this user.",
                "citations": []
            }, intent, mentioned_user

        dossier = build_performance_review_dossier(target_u, None, current_user, db)
        perf_dossier = {
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
        for g in dossier.get("goals", []):
            raw_citations.append(build_citation(
                source_type="goal",
                source_id=g.get("goal_id", g.get("id")),
                title=g["title"],
                author_or_owner=target_u.full_name,
                excerpt=f"Goal: {g['title']} ({g.get('progress', g.get('current_progress_percentage', 0))}% progress)",
                timestamp=None
            ))

    # 7. What Changed Window Calculations (for what_changed intent)
    window_start, window_end, target_str, prev_str, is_weekend = calculate_working_day_window()
    completed_tasks_window = [t for t in tasks if t.status == "completed"]
    window_checkins = [c for c in recent_checkins if c.created_at and c.created_at >= window_start]

    # 8. Channel simulator messages (opted-in channels)
    recent_msgs = db.query(Message).join(Channel, Message.channel_id == Channel.id).filter(
        Channel.tenant_id == current_user.tenant_id,
        Channel.is_syncbrief_enabled == True
    ).order_by(Message.timestamp.desc()).limit(15).all()

    discussion_list = [
        {
            "id": m.id,
            "channel": m.channel_name,
            "author": m.author_name,
            "content": m.content,
            "timestamp": m.timestamp.isoformat() if m.timestamp else None
        }
        for m in recent_msgs
    ]

    # Assembled Context Payload
    context_data: Dict[str, Any] = {
        "intent": intent,
        "user_name": current_user.full_name,
        "user_role": current_user.role,
        "target_user_name": mentioned_user.full_name if mentioned_user else current_user.full_name,
        "team_members": team_members_list,
        "sprint": {
            "name": sprint.name if sprint else "Current Sprint",
            "goal": sprint.goal if sprint else "Deliver planned sprint objectives",
            "status": sprint.status if sprint else "active"
        },
        "tasks": task_list,
        "blockers": blocker_list,
        "checkins": checkin_list,
        "dependencies": dep_list,
        "summary": summary.model_dump() if summary else {},
        "channel_discussions": discussion_list,
        "citations": raw_citations,
        "insufficient_data": False,
        # What changed specific fields for backward compatibility
        "previous_working_day": prev_str,
        "completed_work": [
            {"id": t.id, "title": t.title, "owner": user_map.get(t.assignee_id).full_name if t.assignee_id in user_map else "Unassigned"}
            for t in completed_tasks_window
        ],
        "meaningful_progress": [
            {"id": c.id, "owner": c.user_name, "progress": c.today}
            for c in window_checkins if c.today
        ],
        "new_blockers": [
            {"id": b["id"], "summary": b["summary"], "owner": b["owner_name"]}
            for b in blocker_list
        ]
    }

    if perf_dossier:
        context_data["performance_dossier"] = perf_dossier

    return context_data, intent, mentioned_user

def validate_and_filter_citations(
    candidate_citations: List[Dict[str, Any]],
    db: Session,
    current_user: User
) -> List[EvidenceCitation]:
    """Validate citations against live DB records using EvidenceValidator."""
    validated: List[EvidenceCitation] = []
    seen = set()
    for cit in candidate_citations:
        if not isinstance(cit, dict):
            continue
        v_res = EvidenceValidator.validate_citation(cit, db, current_user)
        if v_res.get("verified"):
            key = f"{v_res.get('source_type')}_{v_res.get('source_id')}"
            if key not in seen:
                seen.add(key)
                validated.append(EvidenceCitation(
                    source_type=v_res.get("source_type", "task"),
                    source_id=str(v_res.get("source_id", "")),
                    title=v_res.get("title", ""),
                    author_or_owner=v_res.get("author_or_owner") or v_res.get("owner") or "Verified Source",
                    timestamp=v_res.get("timestamp"),
                    excerpt=v_res.get("excerpt", ""),
                    verified=True
                ))
    return validated

@router.post("/chat", response_model=AssistantChatResponse)
async def chat_with_assistant(
    req: AssistantChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    POST /api/assistant/chat
    Synchronous response grounded in verified database records.
    """
    user_msg = (req.message or "").strip()
    if not user_msg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message cannot be empty."
        )

    conv_id = req.conversation_id or str(uuid.uuid4())
    conv_history = _CONVERSATIONS.get(conv_id, [])

    context_data, intent, mentioned_user = build_workspace_context(
        current_user, db, user_msg, conv_history
    )

    if context_data.get("insufficient_data"):
        answer_text = context_data.get("insufficient_reason", "I don't have enough verified SyncBrief data to answer that.")
        return AssistantChatResponse(
            answer=answer_text,
            citations=[],
            conversation_id=conv_id,
            insufficient_data=True
        )

    ai_provider = get_ai_provider()
    ai_response = await ai_provider.ask_syncbrief(
        context_data=context_data,
        user_message=user_msg,
        conversation_history=conv_history,
        user_role=current_user.role,
        user_name=current_user.full_name
    )

    answer_text = ai_response.get("answer", "I don't have enough verified SyncBrief data to answer that.")
    is_insufficient = ai_response.get("insufficient_data", context_data.get("insufficient_data", False))

    validated_citations = []
    if not is_insufficient:
        if is_conversational_or_greeting(user_msg):
            candidate_citations = []
        elif ai_response.get("citations") is not None:
            candidate_citations = filter_relevant_citations(ai_response.get("citations"), user_msg, answer_text)
        else:
            candidate_citations = filter_relevant_citations(context_data.get("citations", []), user_msg, answer_text)
        validated_citations = validate_and_filter_citations(candidate_citations, db, current_user)

    conv_history.append({"role": "user", "content": user_msg})
    conv_history.append({"role": "assistant", "content": answer_text})
    if len(conv_history) > MAX_CONVERSATION_TURNS * 2:
        conv_history = conv_history[-(MAX_CONVERSATION_TURNS * 2):]
    _CONVERSATIONS[conv_id] = conv_history

    try:
        log_audit_event(
            db=db,
            user=current_user,
            action="assistant_chat",
            target_type="assistant",
            target_id=conv_id,
            details=f"Provider: {ai_provider.name} | Intent: {intent} | Query: {user_msg[:80]}"
        )
    except Exception as audit_err:
        logger.warning(f"Failed to log assistant audit event: {audit_err}")

    return AssistantChatResponse(
        answer=answer_text,
        citations=validated_citations,
        conversation_id=conv_id,
        insufficient_data=is_insufficient
    )

@router.post("/chat/stream")
async def chat_with_assistant_stream(
    req: AssistantChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    POST /api/assistant/chat/stream
    Real-time Server-Sent Events (SSE) streaming endpoint powered by Groq LPUs.
    Streams tokens chunk-by-chunk to the frontend in real-time.
    """
    user_msg = (req.message or "").strip()
    if not user_msg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message cannot be empty."
        )

    conv_id = req.conversation_id or str(uuid.uuid4())
    conv_history = _CONVERSATIONS.get(conv_id, [])

    context_data, intent, mentioned_user = build_workspace_context(
        current_user, db, user_msg, conv_history
    )

    ai_provider = get_ai_provider()

    async def sse_generator():
        if context_data.get("insufficient_data"):
            reason = context_data.get("insufficient_reason", "I don't have enough verified SyncBrief data to answer that.")
            yield f"data: {json.dumps({'type': 'token', 'content': reason})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'conversation_id': conv_id, 'citations': [], 'insufficient_data': True, 'answer': reason})}\n\n"
            return

        accumulated_text = []

        # Check if provider has streaming capability (GroqProvider)
        if hasattr(ai_provider, "stream_ask_syncbrief"):
            async for chunk in ai_provider.stream_ask_syncbrief(
                context_data=context_data,
                user_message=user_msg,
                conversation_history=conv_history,
                user_role=current_user.role,
                user_name=current_user.full_name
            ):
                if chunk.get("type") == "token":
                    content = chunk.get("content", "")
                    accumulated_text.append(content)
                    yield f"data: {json.dumps({'type': 'token', 'content': content})}\n\n"
                elif chunk.get("type") == "done":
                    full_answer = "".join(accumulated_text) or chunk.get("answer", "")
                    # Filter citations appropriately
                    if is_conversational_or_greeting(user_msg):
                        final_citations = []
                    else:
                        raw_cits = chunk.get("citations") if chunk.get("citations") is not None else context_data.get("citations", [])
                        relevant_cits = filter_relevant_citations(raw_cits, user_msg, full_answer)
                        final_citations = validate_and_filter_citations(
                            relevant_cits,
                            db,
                            current_user
                        )
                    # Update memory
                    conv_history.append({"role": "user", "content": user_msg})
                    conv_history.append({"role": "assistant", "content": full_answer})
                    _CONVERSATIONS[conv_id] = conv_history[- (MAX_CONVERSATION_TURNS * 2):]

                    citations_payload = [c.model_dump() for c in final_citations]
                    yield f"data: {json.dumps({'type': 'done', 'conversation_id': conv_id, 'citations': citations_payload, 'insufficient_data': chunk.get('insufficient_data', False), 'answer': full_answer})}\n\n"
        else:
            # Fallback non-streaming provider wrapped in SSE
            ai_response = await ai_provider.ask_syncbrief(
                context_data=context_data,
                user_message=user_msg,
                conversation_history=conv_history,
                user_role=current_user.role,
                user_name=current_user.full_name
            )
            answer_text = ai_response.get("answer", "I don't have enough verified SyncBrief data to answer that.")
            candidate_citations = ai_response.get("citations") or context_data.get("citations") or []
            validated = validate_and_filter_citations(candidate_citations, db, current_user)

            conv_history.append({"role": "user", "content": user_msg})
            conv_history.append({"role": "assistant", "content": answer_text})
            _CONVERSATIONS[conv_id] = conv_history[- (MAX_CONVERSATION_TURNS * 2):]

            yield f"data: {json.dumps({'type': 'token', 'content': answer_text})}\n\n"
            citations_payload = [c.model_dump() for c in validated]
            yield f"data: {json.dumps({'type': 'done', 'conversation_id': conv_id, 'citations': citations_payload, 'insufficient_data': ai_response.get('insufficient_data', False), 'answer': answer_text})}\n\n"

    return StreamingResponse(sse_generator(), media_type="text/event-stream")
