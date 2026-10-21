from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from datetime import datetime, date, timedelta, time
import json
import logging
from typing import Optional, List, Dict, Any, Tuple

from backend.app.database import get_db
from backend.app.models import User, Task, Checkin, Blocker, Sprint, AuditLog
from backend.app.schemas import WhatChangedResponse
from backend.app.auth_deps import get_current_user
from backend.app.hierarchy import get_accessible_user_ids, get_subordinate_ids, calculate_task_points
from backend.app.ai import get_ai_provider, EvidenceValidator
from backend.app.audit import log_audit_event

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/what-changed", tags=["What Changed Since Yesterday"])

def calculate_working_day_window(
    target_date_str: Optional[str] = None,
    compare_date_str: Optional[str] = None
) -> Tuple[datetime, datetime, str, str, bool]:
    """
    Computes the business day comparison window:
    - Tuesday - Friday: compare with previous calendar day (1 day prior)
    - Monday: compare with Friday (3 days prior)
    - Saturday / Sunday: compare with Friday
    Returns: (window_start, window_end, target_date_formatted, compare_date_formatted, is_weekend_lookback)
    """
    # 1. Parse target_date
    if target_date_str:
        try:
            target_date_val = datetime.strptime(target_date_str, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid target_date '{target_date_str}'. Expected format YYYY-MM-DD."
            )
    else:
        target_date_val = datetime.utcnow().date()

    # 2. Parse or calculate compare_date
    is_weekend_lookback = False
    if compare_date_str:
        try:
            compare_date_val = datetime.strptime(compare_date_str, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid compare_date '{compare_date_str}'. Expected format YYYY-MM-DD."
            )
        if compare_date_val >= target_date_val:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"compare_date ({compare_date_str}) must be strictly earlier than target_date ({target_date_val.strftime('%Y-%m-%d')})."
            )
        if (target_date_val - compare_date_val).days >= 3 and target_date_val.weekday() == 0:
            is_weekend_lookback = True
    else:
        weekday = target_date_val.weekday()  # 0 = Monday, 6 = Sunday
        if weekday == 0:  # Monday -> Friday (3 days)
            compare_date_val = target_date_val - timedelta(days=3)
            is_weekend_lookback = True
        elif weekday == 6:  # Sunday -> Friday (2 days)
            compare_date_val = target_date_val - timedelta(days=2)
            is_weekend_lookback = True
        elif weekday == 5:  # Saturday -> Friday (1 day)
            compare_date_val = target_date_val - timedelta(days=1)
            is_weekend_lookback = True
        else:  # Tuesday (1), Wednesday (2), Thursday (3), Friday (4) -> Previous calendar day
            compare_date_val = target_date_val - timedelta(days=1)
            is_weekend_lookback = False

    window_start = datetime.combine(compare_date_val, time(0, 0, 0))
    window_end = datetime.combine(target_date_val, time(23, 59, 59))

    return (
        window_start,
        window_end,
        target_date_val.strftime("%Y-%m-%d"),
        compare_date_val.strftime("%Y-%m-%d"),
        is_weekend_lookback
    )

@router.get("", response_model=WhatChangedResponse)
async def get_what_changed(
    target_date: Optional[str] = Query(None, description="Target evaluation date (YYYY-MM-DD)"),
    compare_date: Optional[str] = Query(None, description="Previous working date to compare against (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns AI-synthesized team delta intelligence:
    'What meaningfully changed in my team since the previous working day?'
    Enforces tenant isolation, hierarchy RBAC, anti-hallucination validation,
    and returns verified evidence citations.
    """
    # 1. RBAC & Hierarchy Gate
    is_director = (
        current_user.role in ["admin", "director"] or
        (current_user.role_level is not None and current_user.role_level <= 1)
    )
    is_manager = (
        current_user.role in ["manager"] or
        (current_user.role_level is not None and current_user.role_level == 2)
    )
    subordinates = get_subordinate_ids(current_user, db) if not is_director else set()
    if not is_director and not is_manager and len(subordinates) == 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Team delta intelligence is reserved for engineering managers and directors."
        )

    # 2. Compute working-day comparison window
    window_start, window_end, target_date_str, compare_date_str, is_weekend_lookback = calculate_working_day_window(
        target_date_str=target_date,
        compare_date_str=compare_date
    )

    # 3. Permitted user scope strictly isolated to current user's tenant
    accessible_ids = get_accessible_user_ids(current_user, db)
    permitted_users = db.query(User).filter(
        User.id.in_(accessible_ids),
        User.tenant_id == current_user.tenant_id,
        User.deleted_at.is_(None)
    ).all()
    user_map = {u.id: u for u in permitted_users}
    member_names = {u.full_name for u in permitted_users}

    # Expected users to submit check-in (subordinates or all non-self members in scope)
    if is_director:
        expected_checkin_users = [u for u in permitted_users if u.id != current_user.id]
    else:
        expected_checkin_users = [u for u in permitted_users if u.id in subordinates]
    if not expected_checkin_users:
        expected_checkin_users = [u for u in permitted_users if u.id != current_user.id]

    # 4. Collect Check-ins in window
    checkin_query = db.query(Checkin).filter(
        Checkin.tenant_id == current_user.tenant_id,
        Checkin.created_at >= window_start,
        Checkin.created_at <= window_end,
        Checkin.user_id.in_(accessible_ids)
    ).order_by(Checkin.created_at.desc())
    window_checkins = checkin_query.all()
    checked_in_user_ids = {c.user_id for c in window_checkins}

    missing_checkin_names = [
        u.full_name for u in expected_checkin_users
        if u.id not in checked_in_user_ids
    ]

    checkins_payload = [
        {
            "id": c.id,
            "user_id": c.user_id,
            "user_name": c.user_name,
            "task_id": c.task_id,
            "task_title": c.task_title,
            "progress_pct": c.progress_pct or 0,
            "progress_note": c.progress_note or "",
            "yesterday": c.yesterday or "",
            "today": c.today or "",
            "blockers_text": c.blockers_text or "",
            "mood": c.mood or 4,
            "created_at": c.created_at.isoformat() if c.created_at else None
        }
        for c in window_checkins
    ]

    # 5. Collect Tasks & Compute Deltas
    task_query = db.query(Task).filter(
        Task.tenant_id == current_user.tenant_id,
        Task.deleted_at.is_(None)
    )
    if not is_director:
        task_query = task_query.filter(
            (Task.assignee_id.in_(accessible_ids)) |
            (Task.creator_id == current_user.id) |
            (Task.assignee_id.is_(None))
        )
    tasks_in_scope = task_query.all()

    # Pre-fetch audit logs in window for task modifications
    task_ids_in_scope = [t.id for t in tasks_in_scope]
    audit_logs_in_window = db.query(AuditLog).filter(
        AuditLog.tenant_id == current_user.tenant_id,
        AuditLog.entity_type == "task",
        AuditLog.entity_id.in_(task_ids_in_scope) if task_ids_in_scope else False,
        AuditLog.created_at >= window_start,
        AuditLog.created_at <= window_end
    ).order_by(AuditLog.created_at.asc()).all()

    task_audits_map: Dict[int, List[AuditLog]] = {}
    for a in audit_logs_in_window:
        if a.entity_id is not None:
            task_audits_map.setdefault(a.entity_id, []).append(a)

    completed_tasks_payload = []
    progressed_tasks_payload = []

    for task in tasks_in_scope:
        audits = task_audits_map.get(task.id, [])
        assignee_name = (
            user_map[task.assignee_id].full_name if task.assignee_id in user_map
            else (task.assignee_name or "Unassigned")
        )

        # A. Check completion
        is_completed_in_window = False
        if task.status == "Done":
            if task.completed_at and window_start <= task.completed_at <= window_end:
                is_completed_in_window = True
            elif not task.completed_at and task.updated_at and window_start <= task.updated_at <= window_end:
                is_completed_in_window = True
            elif any(
                a.new_values_json and '"Done"' in a.new_values_json
                for a in audits
            ):
                is_completed_in_window = True

        if is_completed_in_window:
            pts = calculate_task_points(task.difficulty, task.carried_over_count)
            completed_tasks_payload.append({
                "id": task.id,
                "title": task.title,
                "assignee_name": assignee_name,
                "completed_at": task.completed_at.isoformat() if task.completed_at else (task.updated_at.isoformat() if task.updated_at else window_end.isoformat()),
                "difficulty": task.difficulty or 3,
                "points_earned": pts,
                "sprint_id": task.sprint_id
            })
            continue

        # B. Check meaningful progress
        delta_pct = 0
        current_pct = task.progress_pct or 0
        note = ""
        pr_link = None

        if audits:
            first_audit = audits[0]
            last_audit = audits[-1]
            try:
                old_val = json.loads(first_audit.old_values_json or "{}")
                new_val = json.loads(last_audit.new_values_json or "{}")
                old_pct = old_val.get("progress_pct")
                new_pct = new_val.get("progress_pct")
                if old_pct is not None and new_pct is not None and new_pct > old_pct:
                    delta_pct = new_pct - old_pct
                    current_pct = new_pct
            except Exception:
                pass

        # Check if a check-in submitted in window updated this task
        task_checkins = [c for c in window_checkins if c.task_id == task.id]
        if task_checkins:
            latest_chk = task_checkins[0]
            note = latest_chk.progress_note or latest_chk.today or ""
            pr_link = latest_chk.pr_link
            chk_pct = latest_chk.progress_pct or 0
            if delta_pct == 0:
                prior_chk = db.query(Checkin).filter(
                    Checkin.task_id == task.id,
                    Checkin.created_at < window_start
                ).order_by(Checkin.created_at.desc()).first()
                prior_pct = prior_chk.progress_pct or 0 if prior_chk else 0
                if chk_pct > prior_pct:
                    delta_pct = chk_pct - prior_pct
                    current_pct = chk_pct
                elif chk_pct > 0 and not prior_chk:
                    delta_pct = chk_pct
                    current_pct = chk_pct

        if delta_pct == 0 and task.updated_at and window_start <= task.updated_at <= window_end:
            if task.status == "In progress" and current_pct > 0:
                delta_pct = current_pct

        # Only report tasks with actual progress (no unchanged tasks)
        if delta_pct > 0:
            progressed_tasks_payload.append({
                "id": task.id,
                "title": task.title,
                "assignee_name": assignee_name,
                "progress_delta_pct": delta_pct,
                "current_progress_pct": current_pct,
                "note": note,
                "pr_link": pr_link,
                "updated_at": task.updated_at.isoformat() if task.updated_at else window_end.isoformat()
            })

    # 6. Collect Blockers (New vs Existing Unresolved)
    blocker_query = db.query(Blocker).filter(
        Blocker.tenant_id == current_user.tenant_id
    )
    if not is_director:
        accessible_checkin_ids = [c.id for c in db.query(Checkin.id).filter(Checkin.user_id.in_(accessible_ids)).all()]
        blocker_query = blocker_query.filter(
            (Blocker.owner_name.in_(member_names)) |
            (Blocker.checkin_id.in_(accessible_checkin_ids))
        )
    all_blockers = blocker_query.all()

    new_blockers_payload = []
    existing_blockers_payload = []

    for b in all_blockers:
        if b.created_at and window_start <= b.created_at <= window_end:
            new_blockers_payload.append({
                "id": b.id,
                "summary": b.summary,
                "severity": b.severity or "medium",
                "owner_name": b.owner_name,
                "blocked_by": b.blocked_by or "Pending",
                "created_at": b.created_at.isoformat()
            })
        elif b.created_at and b.created_at < window_start and b.status in ["open", "in_progress"]:
            age_days = max(1, (window_end.date() - b.created_at.date()).days)
            existing_blockers_payload.append({
                "id": b.id,
                "summary": b.summary,
                "severity": b.severity or "medium",
                "owner_name": b.owner_name,
                "blocked_by": b.blocked_by or "Pending",
                "age_days": age_days,
                "status": b.status,
                "created_at": b.created_at.isoformat()
            })

    # 7. Collect Active Sprint Stats
    active_sprint = db.query(Sprint).filter(
        Sprint.tenant_id == current_user.tenant_id,
        Sprint.status == "active",
        Sprint.deleted_at.is_(None)
    ).first()
    if not active_sprint:
        active_sprint = db.query(Sprint).filter(
            Sprint.tenant_id == current_user.tenant_id,
            Sprint.deleted_at.is_(None)
        ).order_by(Sprint.id.desc()).first()

    sprint_info_payload = None
    if active_sprint:
        sprint_tasks = [t for t in tasks_in_scope if t.sprint_id == active_sprint.id]
        total_pts = sum(t.difficulty or 3 for t in sprint_tasks)
        completed_sprint_tasks = [t for t in sprint_tasks if t.status == "Done"]
        completed_pts_today = sum(t.difficulty or 3 for t in completed_sprint_tasks)
        delta_pts = sum(
            t["difficulty"] for t in completed_tasks_payload
            if t.get("sprint_id") == active_sprint.id
        )
        completed_pts_yesterday = max(0, completed_pts_today - delta_pts)

        sprint_info_payload = {
            "id": active_sprint.id,
            "name": active_sprint.name,
            "total_points": total_pts,
            "completed_points_yesterday": completed_pts_yesterday,
            "completed_points_today": completed_pts_today,
            "delta_points": delta_pts
        }

    # 8. Assemble Delta Context for AI Engine
    delta_context = {
        "target_date": target_date_str,
        "previous_working_day": compare_date_str,
        "window_start": window_start.isoformat(),
        "window_end": window_end.isoformat(),
        "is_weekend_lookback": is_weekend_lookback,
        "team_scope": {
            "manager_id": current_user.id,
            "manager_name": current_user.full_name,
            "member_count": len(permitted_users),
            "checked_in_count": len(checked_in_user_ids)
        },
        "completed_tasks": completed_tasks_payload,
        "progressed_tasks": progressed_tasks_payload,
        "sprint_info": sprint_info_payload,
        "checkins": checkins_payload,
        "new_blockers": new_blockers_payload,
        "existing_blockers": existing_blockers_payload,
        "missing_checkins": missing_checkin_names
    }

    # 9. Execute AI Synthesis (Azure OpenAI or deterministic MockProvider)
    ai_provider = get_ai_provider()
    raw_delta_result = await ai_provider.analyze_what_changed(delta_context)

    # 10. Multi-Entity Evidence Verification Layer
    verified_result = EvidenceValidator.validate_delta_report(
        raw_delta_result,
        current_user=current_user,
        db=db
    )

    if isinstance(verified_result, dict):
        verified_result.setdefault("blockers", {"new_blockers": [], "existing_unresolved_blockers": []})
        verified_result.setdefault("insufficient_data", {
            "is_insufficient": False,
            "missing_checkins": missing_checkin_names,
            "notes": []
        })

    validated_response = WhatChangedResponse.model_validate(verified_result)

    # 11. Immutable Audit Logging
    log_audit_event(
        db=db,
        action="what_changed_analysis",
        entity_type="team_delta",
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        tenant_id=current_user.tenant_id,
        model_used=ai_provider.name,
        prompt_version="what_changed_v1",
        input_summary=f"Aggregated team delta across {compare_date_str} to {target_date_str} for {len(permitted_users)} members",
        output_summary=f"Generated report with {len(validated_response.progress.completed_work)} completions, {len(validated_response.blockers.new_blockers)} new blockers, {len(validated_response.risks)} risks, {len(validated_response.needs_manager_attention)} actions"
    )
    db.commit()

    return validated_response
