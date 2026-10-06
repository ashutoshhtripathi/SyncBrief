from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import json
import logging
from typing import Optional, List, Dict, Any, Tuple

from backend.app.database import get_db
from backend.app.models import User, Task, Checkin, Blocker, Sprint, TaskDependency
from backend.app.schemas import (
    CreateTaskDependencyRequest,
    DependencyStatusUpdate,
    DependencyItem,
    DependencySummaryResponse,
    DependencyListResponse,
    EvidenceCitation
)
from backend.app.auth_deps import get_current_user
from backend.app.hierarchy import get_accessible_user_ids, enforce_tenant_access
from backend.app.ai.validator import EvidenceValidator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dependencies", tags=["Cross-Team Dependencies"])

def infer_user_team(user: Optional[User]) -> str:
    """Infer functional team/department from user profile and title."""
    if not user:
        return "Unassigned"
    title = (user.title or "").lower()
    if "backend" in title:
        return "Backend Engineering"
    if "frontend" in title:
        return "Frontend Engineering"
    if "platform" in title or "sre" in title or "reliability" in title:
        return "Platform & SRE"
    if "cloud" in title or "microservice" in title or "devops" in title:
        return "Cloud & DevOps"
    if "design" in title:
        return "Product Design"
    if "director" in title or (user.role_level and user.role_level <= 1):
        return "Engineering Leadership"
    if user.org_type:
        return user.org_type.capitalize()
    return "Engineering"

def parse_blocked_by_team_and_owner(blocked_by_str: str, tenant_users: List[User]) -> Tuple[str, str]:
    """Deterministically parse blocked_by field into (team, owner) without AI guessing."""
    if not blocked_by_str:
        return ("External / Unassigned", "Unassigned")
    
    # 1. Match full name of tenant users
    for u in tenant_users:
        if u.full_name and u.full_name.lower() in blocked_by_str.lower():
            return (infer_user_team(u), u.full_name)

    raw = blocked_by_str.strip()
    # 2. Pattern: "Backend Team (Vikram Joshi)"
    if "(" in raw and ")" in raw:
        team_part = raw[:raw.index("(")].strip()
        owner_part = raw[raw.index("(") + 1:raw.index(")")].strip()
        # Check if owner_part matches a user
        for u in tenant_users:
            if u.full_name and u.full_name.lower() in owner_part.lower():
                return (team_part or infer_user_team(u), u.full_name)
        return (team_part or "External Team", owner_part or team_part)

    # 3. Pattern: "Infrastructure / Memory Limit"
    if "/" in raw:
        parts = [p.strip() for p in raw.split("/")]
        return (parts[0], parts[1] if len(parts) > 1 else parts[0])

    if any(k in raw.lower() for k in ["team", "engineering", "platform", "infrastructure", "devops", "design", "security"]):
        return (raw, raw)

    return ("External Dependency", raw)

def collect_dependencies(
    current_user: User,
    db: Session,
    status_filter: Optional[str] = None,
    severity_filter: Optional[str] = None,
    team_filter: Optional[str] = None,
    owner_filter: Optional[str] = None,
    sprint_id_filter: Optional[int] = None,
    aging_filter: Optional[bool] = None,
    cross_team_only_filter: Optional[bool] = None
) -> Tuple[DependencySummaryResponse, List[DependencyItem]]:
    """
    Deterministic cross-team dependency detection engine.
    Consolidates explicit task dependencies, blocker-based dependencies,
    calculates aging, sprint impact, severity, and validates evidence.
    """
    is_director_or_admin = (
        current_user.role in ["admin", "director"] or
        (current_user.role_level is not None and current_user.role_level <= 1)
    )
    is_manager = (
        current_user.role in ["manager"] or
        (current_user.role_level is not None and current_user.role_level == 2)
    )

    accessible_ids = get_accessible_user_ids(current_user, db) if not is_director_or_admin else set()
    accessible_names = set()
    if not is_director_or_admin:
        users_in_scope = db.query(User.full_name).filter(User.id.in_(accessible_ids)).all()
        accessible_names = {u[0] for u in users_in_scope}

    # Fetch tenant entities
    tenant_users = db.query(User).filter(
        User.tenant_id == current_user.tenant_id,
        User.deleted_at.is_(None)
    ).all()
    user_map = {u.id: u for u in tenant_users}
    user_name_map = {u.full_name.lower(): u for u in tenant_users}

    active_sprints = db.query(Sprint).filter(
        Sprint.tenant_id == current_user.tenant_id,
        Sprint.deleted_at.is_(None)
    ).all()
    sprint_map = {s.id: s for s in active_sprints}

    tasks = db.query(Task).filter(
        Task.tenant_id == current_user.tenant_id,
        Task.deleted_at.is_(None)
    ).all()
    task_map = {t.id: t for t in tasks}

    checkins = db.query(Checkin).filter(
        Checkin.tenant_id == current_user.tenant_id
    ).all()
    checkin_map = {c.id: c for c in checkins}

    now = datetime.utcnow()
    all_items: List[DependencyItem] = []

    # =========================================================================
    # A. Explicit Task Dependencies
    # =========================================================================
    task_deps = db.query(TaskDependency).filter(
        TaskDependency.tenant_id == current_user.tenant_id
    ).all()

    for td in task_deps:
        source_task = task_map.get(td.task_id)
        prereq_task = task_map.get(td.depends_on_task_id)
        if not source_task or not prereq_task:
            continue

        # RBAC Check
        if not is_director_or_admin:
            if is_manager:
                allowed = (
                    source_task.assignee_id in accessible_ids or
                    prereq_task.assignee_id in accessible_ids or
                    td.created_by_id in accessible_ids
                )
            else:
                allowed = (
                    source_task.assignee_id == current_user.id or
                    prereq_task.assignee_id == current_user.id or
                    td.created_by_id == current_user.id
                )
            if not allowed:
                continue

        # Status
        if td.status == "resolved" or prereq_task.status == "Done":
            dep_status = "resolved"
        elif prereq_task.status == "In progress":
            dep_status = "in_progress"
        else:
            dep_status = "open"

        # Owners and Teams
        source_user = user_map.get(source_task.assignee_id)
        source_owner = source_user.full_name if source_user else (source_task.assignee_name or "Unassigned")
        source_team = infer_user_team(source_user)

        prereq_user = user_map.get(prereq_task.assignee_id)
        dep_owner = prereq_user.full_name if prereq_user else (prereq_task.assignee_name or "Unassigned")
        dep_team = infer_user_team(prereq_user)

        is_cross_team = (source_team.lower() != dep_team.lower())

        # Age
        age_days = max(0, (now.date() - td.created_at.date()).days) if td.created_at else 0
        is_aging = (age_days >= 2 and dep_status != "resolved")

        # Sprint Impact
        affected_sprint = sprint_map.get(source_task.sprint_id) if source_task.sprint_id else None
        is_sprint_at_risk = (
            affected_sprint is not None and
            affected_sprint.status == "active" and
            dep_status != "resolved"
        )

        # Severity
        task_pri = (source_task.priority or "Medium").lower()
        if task_pri in ["critical", "high"]:
            severity = task_pri
        elif is_sprint_at_risk or is_aging:
            severity = "high"
        else:
            severity = "medium" if task_pri == "medium" else "low"

        summary = td.notes if td.notes else f"'{source_task.title}' is blocked waiting for prerequisite: '{prereq_task.title}'"
        downstream_impact = f"Blocks '{source_task.title}' ({source_task.status}) in {affected_sprint.name if affected_sprint else 'backlog'}"

        evidence_list: List[EvidenceCitation] = [
            EvidenceCitation(
                source_type="task",
                source_id=str(source_task.id),
                title=source_task.title,
                author_or_owner=source_owner,
                timestamp=source_task.updated_at.isoformat() if source_task.updated_at else None,
                excerpt=f"Dependent Task #{source_task.id}: {source_task.title} (Status: {source_task.status})",
                verified=True
            ),
            EvidenceCitation(
                source_type="task",
                source_id=str(prereq_task.id),
                title=prereq_task.title,
                author_or_owner=dep_owner,
                timestamp=prereq_task.updated_at.isoformat() if prereq_task.updated_at else None,
                excerpt=f"Prerequisite Task #{prereq_task.id}: {prereq_task.title} (Status: {prereq_task.status})",
                verified=True
            )
        ]
        if affected_sprint:
            evidence_list.append(EvidenceCitation(
                source_type="sprint",
                source_id=str(affected_sprint.id),
                title=affected_sprint.name,
                author_or_owner="Engineering",
                timestamp=affected_sprint.start_date.isoformat() if affected_sprint.start_date else None,
                excerpt=f"Active iteration {affected_sprint.name} delivery goal impacted",
                verified=True
            ))

        validated_ev = [
            EvidenceValidator.validate_evidence_item(ev.model_dump(), current_user, db)
            for ev in evidence_list
        ]

        all_items.append(DependencyItem(
            dependency_id=f"dep-task-{td.id}",
            source_type="explicit",
            source_task_id=source_task.id,
            source_task_title=source_task.title,
            source_owner=source_owner,
            source_owner_id=source_task.assignee_id,
            source_team=source_team,
            dependent_task_id=prereq_task.id,
            dependent_task_title=prereq_task.title,
            dependency_owner=dep_owner,
            dependency_owner_id=prereq_task.assignee_id,
            dependency_team=dep_team,
            summary=summary,
            status=dep_status,
            severity=severity,
            created_at=td.created_at.isoformat() if td.created_at else now.isoformat(),
            age_days=age_days,
            is_aging=is_aging,
            is_cross_team=is_cross_team,
            affected_task_count=1,
            affected_sprint_id=affected_sprint.id if affected_sprint else None,
            affected_sprint_name=affected_sprint.name if affected_sprint else None,
            is_sprint_at_risk=is_sprint_at_risk,
            downstream_impact_summary=downstream_impact,
            evidence=[EvidenceCitation(**e) for e in validated_ev]
        ))

    # =========================================================================
    # B. Blocker-Derived Dependencies
    # =========================================================================
    blockers = db.query(Blocker).filter(
        Blocker.tenant_id == current_user.tenant_id
    ).all()

    for b in blockers:
        # RBAC Check
        if not is_director_or_admin:
            owner_u = user_name_map.get(b.owner_name.lower()) if b.owner_name else None
            chk = checkin_map.get(b.checkin_id) if b.checkin_id else None
            is_owner_ok = (
                (owner_u and owner_u.id in accessible_ids) or
                (chk and chk.user_id in accessible_ids) or
                (b.owner_name in accessible_names)
            )
            blocked_by_u = user_name_map.get(b.blocked_by.lower()) if b.blocked_by else None
            is_blocked_by_ok = (blocked_by_u and blocked_by_u.id in accessible_ids)

            if is_manager:
                if not (is_owner_ok or is_blocked_by_ok):
                    continue
            else:
                is_self = (
                    (b.owner_name and b.owner_name.lower() == current_user.full_name.lower()) or
                    (chk and chk.user_id == current_user.id) or
                    (blocked_by_u and blocked_by_u.id == current_user.id)
                )
                if not is_self:
                    continue

        # Status
        status_val = b.status or "open"

        # Source owner & team
        source_owner = b.owner_name
        source_u = user_name_map.get(b.owner_name.lower()) if b.owner_name else None
        source_team = infer_user_team(source_u)

        # Dependency owner & team
        dep_team, dep_owner = parse_blocked_by_team_and_owner(b.blocked_by or "", tenant_users)
        dep_u = user_name_map.get(dep_owner.lower()) if dep_owner else None

        is_cross_team = (source_team.lower() != dep_team.lower())

        # Age
        age_days = max(0, (now.date() - b.created_at.date()).days) if b.created_at else 0
        is_aging = (age_days >= 2 and status_val != "resolved")

        # Linked task & sprint
        chk = checkin_map.get(b.checkin_id) if b.checkin_id else None
        source_task = task_map.get(chk.task_id) if chk and chk.task_id else None
        if not source_task and b.related_work_item:
            for t in tasks:
                if b.related_work_item.lower() in t.title.lower() or (t.description and b.related_work_item.lower() in t.description.lower()):
                    source_task = t
                    break

        affected_sprint = sprint_map.get(source_task.sprint_id) if source_task and source_task.sprint_id else None
        is_sprint_at_risk = (
            affected_sprint is not None and
            affected_sprint.status == "active" and
            status_val != "resolved"
        )

        # Severity
        sev_raw = (b.severity or "medium").lower()
        if sev_raw in ["critical", "high"]:
            severity = sev_raw
        elif is_sprint_at_risk:
            severity = "high"
        elif is_aging:
            severity = "high"
        else:
            severity = "medium" if sev_raw == "medium" else "low"

        # Impact Summary
        if source_task:
            downstream_impact = f"Blocks delivery of '{source_task.title}' in {affected_sprint.name if affected_sprint else 'Sprint'}"
        else:
            downstream_impact = f"Blocks {b.related_work_item or 'work item'} for {source_owner}; waiting on {dep_team}"

        # Evidence
        evidence_list: List[EvidenceCitation] = [
            EvidenceCitation(
                source_type="blocker",
                source_id=str(b.id),
                title=f"Blocker #{b.id}: {b.summary[:40]}",
                author_or_owner=source_owner,
                timestamp=b.created_at.isoformat() if b.created_at else None,
                excerpt=b.summary,
                verified=True
            )
        ]
        if source_task:
            evidence_list.append(EvidenceCitation(
                source_type="task",
                source_id=str(source_task.id),
                title=source_task.title,
                author_or_owner=source_owner,
                timestamp=source_task.updated_at.isoformat() if source_task.updated_at else None,
                excerpt=f"Task #{source_task.id}: {source_task.title} (Status: {source_task.status})",
                verified=True
            ))
        if chk:
            evidence_list.append(EvidenceCitation(
                source_type="checkin",
                source_id=str(chk.id),
                title=f"Check-in #{chk.id} by {chk.user_name}",
                author_or_owner=chk.user_name,
                timestamp=chk.created_at.isoformat() if chk.created_at else None,
                excerpt=chk.blockers_text or chk.today or "Check-in reported blocker",
                verified=True
            ))
        if affected_sprint:
            evidence_list.append(EvidenceCitation(
                source_type="sprint",
                source_id=str(affected_sprint.id),
                title=affected_sprint.name,
                author_or_owner="Engineering",
                timestamp=affected_sprint.start_date.isoformat() if affected_sprint.start_date else None,
                excerpt=f"Active iteration {affected_sprint.name} goal at risk",
                verified=True
            ))

        validated_ev = [
            EvidenceValidator.validate_evidence_item(ev.model_dump(), current_user, db)
            for ev in evidence_list
        ]

        all_items.append(DependencyItem(
            dependency_id=f"dep-blocker-{b.id}",
            source_type="blocker",
            source_task_id=source_task.id if source_task else None,
            source_task_title=source_task.title if source_task else None,
            source_owner=source_owner,
            source_owner_id=source_u.id if source_u else None,
            source_team=source_team,
            dependent_task_id=None,
            dependent_task_title=b.related_work_item or None,
            dependency_owner=dep_owner,
            dependency_owner_id=dep_u.id if dep_u else None,
            dependency_team=dep_team,
            summary=b.summary,
            status=status_val,
            severity=severity,
            created_at=b.created_at.isoformat() if b.created_at else now.isoformat(),
            age_days=age_days,
            is_aging=is_aging,
            is_cross_team=is_cross_team,
            affected_task_count=1,
            affected_sprint_id=affected_sprint.id if affected_sprint else None,
            affected_sprint_name=affected_sprint.name if affected_sprint else None,
            is_sprint_at_risk=is_sprint_at_risk,
            downstream_impact_summary=downstream_impact,
            evidence=[EvidenceCitation(**e) for e in validated_ev]
        ))

    # =========================================================================
    # C. Compute Summary KPIs Across All In-Scope Dependencies
    # =========================================================================
    total_deps = len(all_items)
    active_deps = len([d for d in all_items if d.status != "resolved"])
    crit_count = len([d for d in all_items if d.severity == "critical" and d.status != "resolved"])
    high_count = len([d for d in all_items if d.severity == "high" and d.status != "resolved"])
    aging_count = len([d for d in all_items if d.is_aging and d.status != "resolved"])
    cross_team_count = len([d for d in all_items if d.is_cross_team and d.status != "resolved"])
    affected_tasks_cnt = len({d.source_task_id for d in all_items if d.source_task_id and d.status != "resolved"})
    affected_sprints_cnt = len({d.affected_sprint_id for d in all_items if d.affected_sprint_id and d.status != "resolved"})
    teams_involved = sorted(list({d.source_team for d in all_items} | {d.dependency_team for d in all_items}))

    summary_obj = DependencySummaryResponse(
        total_dependencies=total_deps,
        active_dependencies=active_deps,
        critical_count=crit_count,
        high_count=high_count,
        aging_count=aging_count,
        cross_team_count=cross_team_count,
        affected_tasks_count=affected_tasks_cnt,
        affected_sprints_count=affected_sprints_cnt,
        teams_involved=teams_involved
    )

    # =========================================================================
    # D. Apply Query Filters
    # =========================================================================
    filtered = all_items

    if status_filter:
        sf = status_filter.strip().lower()
        if sf == "active":
            filtered = [d for d in filtered if d.status != "resolved"]
        elif sf in ["open", "in_progress", "resolved"]:
            filtered = [d for d in filtered if d.status == sf]

    if severity_filter:
        sev_f = severity_filter.strip().lower()
        if sev_f in ["critical", "high", "medium", "low"]:
            filtered = [d for d in filtered if d.severity.lower() == sev_f]

    if team_filter:
        tf = team_filter.strip().lower()
        filtered = [
            d for d in filtered
            if tf in d.source_team.lower() or tf in d.dependency_team.lower()
        ]

    if owner_filter:
        of = owner_filter.strip().lower()
        filtered = [
            d for d in filtered
            if of in d.source_owner.lower() or of in d.dependency_owner.lower()
        ]

    if sprint_id_filter:
        filtered = [d for d in filtered if d.affected_sprint_id == sprint_id_filter]

    if aging_filter is True:
        filtered = [d for d in filtered if d.is_aging]

    if cross_team_only_filter is True:
        filtered = [d for d in filtered if d.is_cross_team]

    return summary_obj, filtered

# =============================================================================
# Router Endpoints
# =============================================================================

@router.get("", response_model=DependencyListResponse)
def get_dependencies(
    status: Optional[str] = Query(None, description="Filter by status: 'active', 'open', 'in_progress', 'resolved', 'all'"),
    severity: Optional[str] = Query(None, description="Filter by severity: 'critical', 'high', 'medium', 'low'"),
    team: Optional[str] = Query(None, description="Filter by team name"),
    owner: Optional[str] = Query(None, description="Filter by owner name"),
    sprint_id: Optional[int] = Query(None, description="Filter by sprint ID"),
    aging: Optional[bool] = Query(None, description="Filter for aging dependencies only"),
    cross_team_only: Optional[bool] = Query(None, description="Filter for cross-team dependencies only"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve consolidated cross-team and task dependencies.
    Enforces strict tenant isolation and reporting hierarchy access control.
    """
    summary, deps = collect_dependencies(
        current_user=current_user,
        db=db,
        status_filter=status,
        severity_filter=severity,
        team_filter=team,
        owner_filter=owner,
        sprint_id_filter=sprint_id,
        aging_filter=aging,
        cross_team_only_filter=cross_team_only
    )
    return DependencyListResponse(summary=summary, dependencies=deps)

@router.get("/summary", response_model=DependencySummaryResponse)
def get_dependency_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve high-level summary KPIs for cross-team dependencies.
    """
    summary, _ = collect_dependencies(current_user=current_user, db=db)
    return summary

@router.post("", response_model=DependencyItem, status_code=status.HTTP_201_CREATED)
def create_dependency(
    req: CreateTaskDependencyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create an explicit dependency between two tasks (Task A depends on Task B).
    Enforces tenant isolation, hierarchy access, and checks for circular dependencies.
    """
    if req.task_id == req.depends_on_task_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A task cannot depend on itself."
        )

    # 1. Look up tasks
    task = db.query(Task).filter(Task.id == req.task_id, Task.deleted_at.is_(None)).first()
    prereq_task = db.query(Task).filter(Task.id == req.depends_on_task_id, Task.deleted_at.is_(None)).first()

    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Task #{req.task_id} not found")
    if not prereq_task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Prerequisite Task #{req.depends_on_task_id} not found")

    # 2. Multi-tenant isolation
    if task.tenant_id != current_user.tenant_id or prereq_task.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Cannot create cross-tenant dependencies."
        )

    # 3. Hierarchy authorization
    is_director_or_admin = (
        current_user.role in ["admin", "director"] or
        (current_user.role_level is not None and current_user.role_level <= 1)
    )
    if not is_director_or_admin:
        accessible_ids = get_accessible_user_ids(current_user, db)
        is_owner_or_assignee = (
            task.assignee_id in accessible_ids or
            task.creator_id in accessible_ids or
            task.assignee_id == current_user.id or
            task.creator_id == current_user.id
        )
        if not is_owner_or_assignee:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Cannot create dependency for a task outside your permitted hierarchy."
            )

    # 4. Check circular dependency
    reverse_dep = db.query(TaskDependency).filter(
        TaskDependency.task_id == req.depends_on_task_id,
        TaskDependency.depends_on_task_id == req.task_id,
        TaskDependency.tenant_id == current_user.tenant_id
    ).first()
    if reverse_dep:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Circular dependency detected: Task #{req.depends_on_task_id} already depends on Task #{req.task_id}."
        )

    # 5. Check if dependency already exists
    existing = db.query(TaskDependency).filter(
        TaskDependency.task_id == req.task_id,
        TaskDependency.depends_on_task_id == req.depends_on_task_id,
        TaskDependency.tenant_id == current_user.tenant_id
    ).first()
    if existing:
        td = existing
    else:
        td = TaskDependency(
            tenant_id=current_user.tenant_id,
            task_id=req.task_id,
            depends_on_task_id=req.depends_on_task_id,
            dependency_type=req.dependency_type or "blocks",
            status="active",
            notes=req.notes or "",
            created_by_id=current_user.id,
            created_at=datetime.utcnow()
        )
        db.add(td)
        db.commit()
        db.refresh(td)

    # Return formatted DependencyItem
    _, deps = collect_dependencies(current_user=current_user, db=db)
    for d in deps:
        if d.dependency_id == f"dep-task-{td.id}":
            return d

    # Fallback response
    return DependencyItem(
        dependency_id=f"dep-task-{td.id}",
        source_type="explicit",
        source_task_id=task.id,
        source_task_title=task.title,
        source_owner=task.assignee_name or "Unassigned",
        source_team=infer_user_team(task.assignee),
        dependent_task_id=prereq_task.id,
        dependent_task_title=prereq_task.title,
        dependency_owner=prereq_task.assignee_name or "Unassigned",
        dependency_team=infer_user_team(prereq_task.assignee),
        summary=td.notes or f"'{task.title}' depends on '{prereq_task.title}'",
        status=td.status,
        severity="medium",
        created_at=td.created_at.isoformat() if td.created_at else datetime.utcnow().isoformat(),
        age_days=0,
        is_aging=False,
        is_cross_team=False,
        affected_task_count=1,
        is_sprint_at_risk=False,
        downstream_impact_summary=f"Blocks '{task.title}'",
        evidence=[]
    )

@router.patch("/{dependency_id}/status", response_model=DependencyItem)
def update_dependency_status(
    dependency_id: str,
    req: DependencyStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update status of a dependency ('open', 'in_progress', 'resolved').
    """
    if dependency_id.startswith("dep-task-"):
        try:
            dep_id = int(dependency_id.replace("dep-task-", ""))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid dependency ID format")

        td = db.query(TaskDependency).filter(
            TaskDependency.id == dep_id,
            TaskDependency.tenant_id == current_user.tenant_id
        ).first()
        if not td:
            raise HTTPException(status_code=404, detail="Dependency not found")

        td.status = "resolved" if req.status == "resolved" else "active"
        db.commit()
        db.refresh(td)

    elif dependency_id.startswith("dep-blocker-"):
        try:
            blocker_id = int(dependency_id.replace("dep-blocker-", ""))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid dependency ID format")

        b = db.query(Blocker).filter(
            Blocker.id == blocker_id,
            Blocker.tenant_id == current_user.tenant_id
        ).first()
        if not b:
            raise HTTPException(status_code=404, detail="Blocker not found")

        b.status = req.status
        b.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(b)
    else:
        raise HTTPException(status_code=400, detail="Unknown dependency type")

    _, deps = collect_dependencies(current_user=current_user, db=db)
    for d in deps:
        if d.dependency_id == dependency_id:
            return d

    raise HTTPException(status_code=404, detail="Dependency not found after update")

@router.delete("/{dependency_id}")
def delete_dependency(
    dependency_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete an explicit task dependency.
    """
    if not dependency_id.startswith("dep-task-"):
        raise HTTPException(status_code=400, detail="Only explicit task dependencies can be deleted via this endpoint.")

    try:
        dep_id = int(dependency_id.replace("dep-task-", ""))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid dependency ID format")

    td = db.query(TaskDependency).filter(
        TaskDependency.id == dep_id,
        TaskDependency.tenant_id == current_user.tenant_id
    ).first()
    if not td:
        raise HTTPException(status_code=404, detail="Dependency not found")

    # Hierarchy authorization check
    is_director_or_admin = (
        current_user.role in ["admin", "director"] or
        (current_user.role_level is not None and current_user.role_level <= 1)
    )
    if not is_director_or_admin:
        accessible_ids = get_accessible_user_ids(current_user, db)
        task = db.query(Task).filter(Task.id == td.task_id).first()
        if not (td.created_by_id == current_user.id or (task and task.assignee_id in accessible_ids)):
            raise HTTPException(status_code=403, detail="Forbidden: Cannot delete dependency outside your hierarchy")

    db.delete(td)
    db.commit()
    return {"ok": True, "message": "Dependency successfully deleted"}
