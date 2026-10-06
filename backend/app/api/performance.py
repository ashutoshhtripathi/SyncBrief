from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional, Dict, Any
import re
from backend.app.database import get_db
from backend.app.models import User, Task, PerformanceCycle, PerformanceGoal, PerformanceReviewNote, Checkin, Blocker, Sprint
from backend.app.schemas import (
    PerformanceCycleCreate,
    PerformanceCycleUpdate,
    PerformanceCycleCloseRequest,
    PerformanceCycleResponse,
    PerformanceGoalCreate,
    PerformanceGoalUpdate,
    PerformanceGoalProgressUpdate,
    PerformanceGoalResponse,
    PerformanceSummaryEmployee,
    PerformanceAppraisalEvidenceItem,
    PerformanceAppraisalEvidenceResponse,
    QuarterPerformanceDetail,
    YearlyPerformanceSummary,
    PerformanceTrendInfo,
    CurrentCycleMetrics,
    PerformanceHistoryResponse,
    TeamPerformanceMemberSummary,
    TeamPerformanceHistoryResponse,
    ReviewEmployeeInfo,
    ReviewCycleInfo,
    ReviewCycleComparisonMetrics,
    ReviewPerformanceComparison,
    ReviewGoalItem,
    ReviewOperationalDelivery,
    ReviewDiscussionTopic,
    ReviewIntelligence,
    PerformanceReviewNoteResponse,
    PerformanceReviewNotesUpdate,
    PerformanceReviewDossierResponse,
    EvidenceCitation
)
from backend.app.auth_deps import get_current_user
from backend.app.hierarchy import (
    enforce_tenant_access,
    get_subordinate_ids,
    can_view_user,
    enforce_hierarchy_access,
    enforce_can_manage_user
)
from backend.app.audit import log_audit_event
from backend.app.api.points import build_user_points_summary
from backend.app.ai.validator import EvidenceValidator

router = APIRouter(prefix="/performance", tags=["Performance Points & Goal Management"])

def calculate_goal_points(
    assigned_points: float,
    target_percentage: float,
    current_progress_percentage: float,
    previously_earned_points: float
) -> Dict[str, float]:
    """
    Performance Points Formula:
    Points are strictly based on delivered achievement percentage without carry-over penalties.
    Lifetime progress points = assigned_points * min(1.0, current_progress_percentage / max(1.0, target_percentage))
    Cycle earned points = max(0.0, lifetime_progress_points - previously_earned_points)
    Remaining points = max(0.0, assigned_points - previously_earned_points - cycle_earned_points)
    Guarantees that previously earned points from prior cycles are NEVER awarded twice.
    """
    target = max(1.0, target_percentage)
    progress_ratio = min(1.0, max(0.0, current_progress_percentage) / target)
    lifetime_points = round(assigned_points * progress_ratio, 2)
    cycle_earned = max(0.0, round(lifetime_points - previously_earned_points, 2))
    remaining = max(0.0, round(assigned_points - previously_earned_points - cycle_earned, 2))
    
    return {
        "lifetime_earned": round(previously_earned_points + cycle_earned, 2),
        "cycle_earned": cycle_earned,
        "remaining": remaining
    }

def goal_to_response(g: PerformanceGoal) -> Dict[str, Any]:
    return {
        "id": g.id,
        "cycle_id": g.cycle_id,
        "cycle_name": g.cycle.name if g.cycle else None,
        "user_id": g.user_id,
        "employee_name": g.employee.full_name if g.employee else None,
        "employee_email": g.employee.email if g.employee else None,
        "created_by": g.created_by,
        "manager_name": g.manager.full_name if g.manager else None,
        "title": g.title,
        "description": g.description or "",
        "assigned_points": g.assigned_points,
        "target_percentage": g.target_percentage,
        "current_progress_percentage": g.current_progress_percentage,
        "previously_earned_points": g.previously_earned_points,
        "earned_points": g.earned_points,
        "remaining_points": g.remaining_points,
        "status": g.status,
        "category": getattr(g, "category", "delivery") or "delivery",
        "current_progress_pct": g.current_progress_percentage,
        "target_pct": g.target_percentage,
        "task_id": g.source_task_id,
        "task_title": g.source_task.title if g.source_task else None,
        "deadline": g.deadline,
        "source_task_id": g.source_task_id,
        "source_task_title": g.source_task.title if g.source_task else None,
        "carried_from_goal_id": g.carried_from_goal_id,
        "tenant_id": g.tenant_id,
        "created_at": g.created_at,
        "updated_at": g.updated_at
    }

# =========================================================================
# PERFORMANCE CYCLES ENDPOINTS
# =========================================================================

@router.get("/cycles", response_model=List[PerformanceCycleResponse])
def list_performance_cycles(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all performance cycles within the authenticated user's organization."""
    cycles = db.query(PerformanceCycle).filter(
        PerformanceCycle.tenant_id == current_user.tenant_id,
        PerformanceCycle.deleted_at.is_(None)
    ).order_by(PerformanceCycle.start_date.desc()).all()

    resp = []
    for c in cycles:
        goals = [g for g in c.goals if g.deleted_at is None]
        resp.append({
            "id": c.id,
            "name": c.name,
            "start_date": c.start_date,
            "end_date": c.end_date,
            "status": c.status,
            "description": c.description,
            "tenant_id": c.tenant_id,
            "created_at": c.created_at,
            "goals_count": len(goals),
            "completed_goals_count": len([g for g in goals if g.status == "completed"]),
            "is_active": c.status == "active"
        })
    return resp

@router.post("/cycles", response_model=PerformanceCycleResponse)
def create_performance_cycle(
    req: PerformanceCycleCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new performance cycle (Director or Manager only)."""
    is_director = current_user.role in ["admin", "director"] or (current_user.role_level is not None and current_user.role_level <= 1)
    is_manager = current_user.role == "manager" or (current_user.role_level is not None and current_user.role_level == 2)
    if not is_director and not is_manager:
        raise HTTPException(status_code=403, detail="Forbidden: Employees cannot create performance cycles")

    existing = db.query(PerformanceCycle).filter(
        PerformanceCycle.tenant_id == current_user.tenant_id,
        PerformanceCycle.name == req.name.strip(),
        PerformanceCycle.deleted_at.is_(None)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="A performance cycle with this name already exists in your organization")

    cycle = PerformanceCycle(
        tenant_id=current_user.tenant_id,
        name=req.name.strip(),
        start_date=req.start_date,
        end_date=req.end_date,
        status=req.status,
        description=req.description
    )
    db.add(cycle)
    db.commit()
    db.refresh(cycle)

    log_audit_event(
        db,
        action="CREATE_PERFORMANCE_CYCLE",
        entity_type="performance_cycle",
        entity_id=cycle.id,
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        tenant_id=current_user.tenant_id,
        new_values={"name": cycle.name, "start_date": cycle.start_date.isoformat(), "end_date": cycle.end_date.isoformat()}
    )
    db.commit()

    return {
        "id": cycle.id,
        "name": cycle.name,
        "start_date": cycle.start_date,
        "end_date": cycle.end_date,
        "status": cycle.status,
        "description": cycle.description,
        "tenant_id": cycle.tenant_id,
        "created_at": cycle.created_at,
        "goals_count": 0,
        "completed_goals_count": 0,
        "is_active": cycle.status == "active"
    }

@router.get("/cycles/{cycle_id}", response_model=PerformanceCycleResponse)
def get_performance_cycle(
    cycle_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    cycle = db.query(PerformanceCycle).filter(
        PerformanceCycle.id == cycle_id,
        PerformanceCycle.deleted_at.is_(None)
    ).first()
    if not cycle:
        raise HTTPException(status_code=404, detail="Performance cycle not found")

    enforce_tenant_access(current_user, cycle.tenant_id)

    goals = [g for g in cycle.goals if g.deleted_at is None]
    return {
        "id": cycle.id,
        "name": cycle.name,
        "start_date": cycle.start_date,
        "end_date": cycle.end_date,
        "status": cycle.status,
        "description": cycle.description,
        "tenant_id": cycle.tenant_id,
        "created_at": cycle.created_at,
        "goals_count": len(goals),
        "completed_goals_count": len([g for g in goals if g.status == "completed"]),
        "is_active": cycle.status == "active"
    }

@router.post("/cycles/{cycle_id}/close")
def close_performance_cycle(
    cycle_id: int,
    req: PerformanceCycleCloseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Closes a performance cycle and carries forward incomplete goals to the target cycle.
    - Freezes earned points in the closing cycle.
    - Creates linked carried-forward goals with unearned remaining points in the next cycle.
    - Zero duplicate points awarded.
    """
    is_director_or_admin = current_user.role in ["admin", "director"] or (current_user.role_level is not None and current_user.role_level <= 1)
    if not is_director_or_admin:
        raise HTTPException(status_code=403, detail="Forbidden: Only Directors can close performance cycles")

    cycle = db.query(PerformanceCycle).filter(
        PerformanceCycle.id == cycle_id,
        PerformanceCycle.deleted_at.is_(None)
    ).first()
    if not cycle:
        raise HTTPException(status_code=404, detail="Performance cycle not found")

    enforce_tenant_access(current_user, cycle.tenant_id)

    target_cycle = None
    if req.target_cycle_id:
        target_cycle = db.query(PerformanceCycle).filter(
            PerformanceCycle.id == req.target_cycle_id,
            PerformanceCycle.deleted_at.is_(None)
        ).first()
        if not target_cycle:
            raise HTTPException(status_code=400, detail="Target performance cycle not found")
        enforce_tenant_access(current_user, target_cycle.tenant_id)

    # Incomplete goals
    incomplete_goals = db.query(PerformanceGoal).filter(
        PerformanceGoal.cycle_id == cycle_id,
        PerformanceGoal.status != "completed",
        PerformanceGoal.current_progress_percentage < 100.0,
        PerformanceGoal.deleted_at.is_(None)
    ).all()

    if req.goal_ids_to_carry is not None:
        incomplete_goals = [g for g in incomplete_goals if g.id in req.goal_ids_to_carry]

    carried_count = 0
    if req.auto_carry_forward and target_cycle:
        for g in incomplete_goals:
            # Freeze original goal
            g.status = "carried_forward"

            # Points locked from previous achievement
            total_earned_so_far = round(g.previously_earned_points + g.earned_points, 2)
            remaining_to_earn = max(0.0, round(g.assigned_points - total_earned_so_far, 2))

            carried_goal = PerformanceGoal(
                tenant_id=current_user.tenant_id,
                cycle_id=target_cycle.id,
                user_id=g.user_id,
                created_by=current_user.id,
                title=g.title,
                description=g.description,
                assigned_points=g.assigned_points,
                target_percentage=g.target_percentage,
                current_progress_percentage=g.current_progress_percentage,
                previously_earned_points=total_earned_so_far,
                earned_points=0.0,
                remaining_points=remaining_to_earn,
                status="in_progress",
                deadline=g.deadline,
                source_task_id=g.source_task_id,
                carried_from_goal_id=g.id
            )
            db.add(carried_goal)
            carried_count += 1

    cycle.status = "closed"
    db.commit()

    log_audit_event(
        db,
        action="CLOSE_PERFORMANCE_CYCLE",
        entity_type="performance_cycle",
        entity_id=cycle.id,
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        tenant_id=current_user.tenant_id,
        new_values={"status": "closed", "carried_goals_count": carried_count, "target_cycle_id": req.target_cycle_id}
    )
    db.commit()

    return {
        "status": "success",
        "message": f"Cycle {cycle.name} closed successfully.",
        "carried_forward_count": carried_count
    }

# =========================================================================
# PERFORMANCE GOALS CRUD & AUTHORIZATION
# =========================================================================

@router.get("/goals", response_model=List[PerformanceGoalResponse])
def list_performance_goals(
    cycle_id: Optional[int] = None,
    user_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List performance goals with strict hierarchy access enforcement:
    - Employee: can ONLY view their own goals.
    - Manager: can view own goals and goals of direct/indirect subordinates.
    - Director: can view all goals within the tenant organization.
    """
    query = db.query(PerformanceGoal).filter(
        PerformanceGoal.tenant_id == current_user.tenant_id,
        PerformanceGoal.deleted_at.is_(None)
    )

    if cycle_id is not None:
        query = query.filter(PerformanceGoal.cycle_id == cycle_id)

    is_director = current_user.role in ["admin", "director"] or (current_user.role_level is not None and current_user.role_level <= 1)
    is_manager = current_user.role == "manager" or (current_user.role_level is not None and current_user.role_level == 2)

    if user_id is not None:
        # Validate hierarchy access to specific user_id
        if user_id != current_user.id:
            if not is_director:
                sub_ids = get_subordinate_ids(current_user, db)
                if user_id not in sub_ids:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Forbidden: You cannot view performance goals of users outside your reporting hierarchy."
                    )
        query = query.filter(PerformanceGoal.user_id == user_id)
    else:
        # Default scoping
        if not is_director:
            if is_manager:
                sub_ids = get_subordinate_ids(current_user, db)
                allowed_ids = list(sub_ids) + [current_user.id]
                query = query.filter(PerformanceGoal.user_id.in_(allowed_ids))
            else:
                # Employee: only self
                query = query.filter(PerformanceGoal.user_id == current_user.id)

    goals = query.order_by(PerformanceGoal.created_at.desc()).all()
    return [goal_to_response(g) for g in goals]

@router.post("/goals", response_model=PerformanceGoalResponse)
def create_performance_goal(
    req: PerformanceGoalCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Assign a new performance goal to an employee.
    - Employee cannot assign goals -> 403 Forbidden.
    - Manager (L2) can ONLY assign goals to employees in their subordinate tree.
      Cannot assign to Director (L1), peer Manager (L2), or self.
    - Director (L1) can assign to any subordinate in tenant.
    """
    is_director = current_user.role in ["admin", "director"] or (current_user.role_level is not None and current_user.role_level <= 1)
    is_manager = current_user.role == "manager" or (current_user.role_level is not None and current_user.role_level == 2)

    if not is_director and not is_manager:
        raise HTTPException(status_code=403, detail="Forbidden: Employees cannot create or assign performance goals.")

    if req.assigned_points <= 0:
        raise HTTPException(status_code=400, detail="Assigned performance points must be greater than zero.")

    # Validate target employee
    target_user = db.query(User).filter(
        User.id == req.user_id,
        User.deleted_at.is_(None)
    ).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Employee not found")

    enforce_tenant_access(current_user, target_user.tenant_id)

    # Manager restriction checks
    if not is_director:
        if req.user_id == current_user.id:
            raise HTTPException(status_code=403, detail="Forbidden: Managers cannot self-assign performance points.")
        enforce_can_manage_user(current_user, target_user, db)

    # Validate cycle
    cycle = db.query(PerformanceCycle).filter(
        PerformanceCycle.id == req.cycle_id,
        PerformanceCycle.deleted_at.is_(None)
    ).first()
    if not cycle:
        raise HTTPException(status_code=404, detail="Performance cycle not found")
    enforce_tenant_access(current_user, cycle.tenant_id)

    if cycle.status == "closed":
        raise HTTPException(status_code=400, detail="Cannot assign goals to a closed performance cycle.")

    # Optional source task validation
    if req.source_task_id:
        task = db.query(Task).filter(
            Task.id == req.source_task_id,
            Task.deleted_at.is_(None)
        ).first()
        if not task:
            raise HTTPException(status_code=400, detail="Linked source task not found")
        enforce_tenant_access(current_user, task.tenant_id)

    goal = PerformanceGoal(
        tenant_id=current_user.tenant_id,
        cycle_id=req.cycle_id,
        user_id=req.user_id,
        created_by=current_user.id,
        title=req.title.strip(),
        description=req.description or "",
        category=req.category or "delivery",
        assigned_points=req.assigned_points,
        target_percentage=req.target_percentage,
        current_progress_percentage=0.0,
        previously_earned_points=0.0,
        earned_points=0.0,
        remaining_points=req.assigned_points,
        status="in_progress",
        deadline=req.deadline,
        source_task_id=req.source_task_id
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)

    log_audit_event(
        db,
        action="CREATE_PERFORMANCE_GOAL",
        entity_type="performance_goal",
        entity_id=goal.id,
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        tenant_id=current_user.tenant_id,
        new_values={
            "title": goal.title,
            "assigned_points": goal.assigned_points,
            "employee_id": goal.user_id,
            "cycle_id": goal.cycle_id
        }
    )
    db.commit()

    return goal_to_response(goal)

@router.get("/goals/{goal_id}", response_model=PerformanceGoalResponse)
def get_performance_goal(
    goal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    goal = db.query(PerformanceGoal).filter(
        PerformanceGoal.id == goal_id,
        PerformanceGoal.deleted_at.is_(None)
    ).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Performance goal not found")

    enforce_tenant_access(current_user, goal.tenant_id)

    # Hierarchy view access check
    if goal.user_id != current_user.id:
        is_director = current_user.role in ["admin", "director"] or (current_user.role_level is not None and current_user.role_level <= 1)
        if not is_director:
            sub_ids = get_subordinate_ids(current_user, db)
            if goal.user_id not in sub_ids:
                raise HTTPException(status_code=403, detail="Forbidden: You cannot view this performance goal.")

    return goal_to_response(goal)

@router.put("/goals/{goal_id}", response_model=PerformanceGoalResponse)
def update_performance_goal(
    goal_id: int,
    req: PerformanceGoalUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Manager/Director updates goal definitions (points, title, deadline, target).
    - Employees CANNOT edit goal configuration -> 403 Forbidden.
    """
    goal = db.query(PerformanceGoal).filter(
        PerformanceGoal.id == goal_id,
        PerformanceGoal.deleted_at.is_(None)
    ).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Performance goal not found")

    enforce_tenant_access(current_user, goal.tenant_id)

    is_director = current_user.role in ["admin", "director"] or (current_user.role_level is not None and current_user.role_level <= 1)
    is_manager = current_user.role == "manager" or (current_user.role_level is not None and current_user.role_level == 2)

    if not is_director and not is_manager:
        raise HTTPException(status_code=403, detail="Forbidden: Employees cannot modify goal definitions or assigned points.")

    if not is_director:
        target_user = goal.employee
        enforce_can_manage_user(current_user, target_user, db)

    if req.assigned_points is not None:
        if req.assigned_points <= 0:
            raise HTTPException(status_code=400, detail="Assigned performance points must be greater than zero.")
        goal.assigned_points = req.assigned_points

    if req.target_percentage is not None:
        if req.target_percentage <= 0:
            raise HTTPException(status_code=400, detail="Target percentage must be greater than zero.")
        goal.target_percentage = req.target_percentage

    if req.title is not None: goal.title = req.title.strip()
    if req.description is not None: goal.description = req.description
    if req.category is not None: goal.category = req.category
    if req.deadline is not None: goal.deadline = req.deadline
    if req.source_task_id is not None: goal.source_task_id = req.source_task_id
    if req.status is not None: goal.status = req.status

    # Recompute earned and remaining points with new parameters
    calc = calculate_goal_points(
        assigned_points=goal.assigned_points,
        target_percentage=goal.target_percentage,
        current_progress_percentage=goal.current_progress_percentage,
        previously_earned_points=goal.previously_earned_points
    )
    goal.earned_points = calc["cycle_earned"]
    goal.remaining_points = calc["remaining"]

    db.commit()
    db.refresh(goal)

    log_audit_event(
        db,
        action="UPDATE_PERFORMANCE_GOAL",
        entity_type="performance_goal",
        entity_id=goal.id,
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        tenant_id=current_user.tenant_id,
        new_values={"title": goal.title, "assigned_points": goal.assigned_points, "status": goal.status}
    )
    db.commit()

    return goal_to_response(goal)

@router.patch("/goals/{goal_id}/progress", response_model=PerformanceGoalResponse)
def update_goal_progress(
    goal_id: int,
    req: PerformanceGoalProgressUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update progress percentage on a performance goal.
    - Assigned employee can report progress on their own goal.
    - Authorized manager or director can report or adjust progress.
    - Unrelated employees or managers receive 403 Forbidden.
    - Earned and remaining points are calculated mathematically by the backend.
    - Employees CANNOT manipulate points directly.
    """
    goal = db.query(PerformanceGoal).filter(
        PerformanceGoal.id == goal_id,
        PerformanceGoal.deleted_at.is_(None)
    ).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Performance goal not found")

    enforce_tenant_access(current_user, goal.tenant_id)

    # Permission check: must be assigned employee OR authorized manager/director
    is_self = current_user.id == goal.user_id
    is_director = current_user.role in ["admin", "director"] or (current_user.role_level is not None and current_user.role_level <= 1)

    if not is_self and not is_director:
        sub_ids = get_subordinate_ids(current_user, db)
        if goal.user_id not in sub_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: You do not have permission to update progress on this goal."
            )

    progress = max(0.0, min(100.0, req.current_progress_percentage))

    # Optional synchronization with linked Task status
    if req.sync_with_task and goal.source_task_id:
        task = db.query(Task).filter(Task.id == goal.source_task_id).first()
        if task and task.status == "Done":
            progress = 100.0
        elif task and task.progress_pct:
            progress = float(task.progress_pct)

    calc = calculate_goal_points(
        assigned_points=goal.assigned_points,
        target_percentage=goal.target_percentage,
        current_progress_percentage=progress,
        previously_earned_points=goal.previously_earned_points
    )

    goal.current_progress_percentage = progress
    goal.earned_points = calc["cycle_earned"]
    goal.remaining_points = calc["remaining"]

    if progress >= goal.target_percentage:
        goal.status = "completed"
    elif goal.status == "completed" and progress < goal.target_percentage:
        goal.status = "in_progress"

    db.commit()
    db.refresh(goal)

    log_audit_event(
        db,
        action="UPDATE_GOAL_PROGRESS",
        entity_type="performance_goal",
        entity_id=goal.id,
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        tenant_id=current_user.tenant_id,
        new_values={
            "progress_percentage": progress,
            "cycle_earned_points": goal.earned_points,
            "remaining_points": goal.remaining_points,
            "status": goal.status
        }
    )
    db.commit()

    return goal_to_response(goal)

@router.delete("/goals/{goal_id}")
def delete_performance_goal(
    goal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Soft delete/cancel a performance goal (Authorized Manager or Director only)."""
    goal = db.query(PerformanceGoal).filter(
        PerformanceGoal.id == goal_id,
        PerformanceGoal.deleted_at.is_(None)
    ).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Performance goal not found")

    enforce_tenant_access(current_user, goal.tenant_id)

    is_director = current_user.role in ["admin", "director"] or (current_user.role_level is not None and current_user.role_level <= 1)
    is_manager = current_user.role == "manager" or (current_user.role_level is not None and current_user.role_level == 2)

    if not is_director and not is_manager:
        raise HTTPException(status_code=403, detail="Forbidden: Employees cannot delete performance goals.")

    if not is_director:
        target_user = goal.employee
        enforce_can_manage_user(current_user, target_user, db)

    goal.deleted_at = datetime.utcnow()
    db.commit()

    log_audit_event(
        db,
        action="DELETE_PERFORMANCE_GOAL",
        entity_type="performance_goal",
        entity_id=goal.id,
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        tenant_id=current_user.tenant_id,
        new_values={"deleted_at": goal.deleted_at.isoformat()}
    )
    db.commit()

    return {"status": "success", "message": f"Performance goal '{goal.title}' deleted successfully."}

# =========================================================================
# PERFORMANCE SUMMARY & APPRAISAL EVIDENCE
# =========================================================================

def build_employee_performance_summary(user: User, cycle_id: Optional[int], db: Session) -> Dict[str, Any]:
    query = db.query(PerformanceGoal).filter(
        PerformanceGoal.user_id == user.id,
        PerformanceGoal.tenant_id == user.tenant_id,
        PerformanceGoal.deleted_at.is_(None)
    )

    cycle_name = "All Cycles"
    if cycle_id is not None:
        query = query.filter(PerformanceGoal.cycle_id == cycle_id)
        cycle = db.query(PerformanceCycle).filter(PerformanceCycle.id == cycle_id).first()
        if cycle:
            cycle_name = cycle.name
    else:
        # Default to latest active cycle
        active_cycle = db.query(PerformanceCycle).filter(
            PerformanceCycle.tenant_id == user.tenant_id,
            PerformanceCycle.status == "active",
            PerformanceCycle.deleted_at.is_(None)
        ).order_by(PerformanceCycle.start_date.desc()).first()
        if active_cycle:
            query = query.filter(PerformanceGoal.cycle_id == active_cycle.id)
            cycle_name = active_cycle.name

    goals = query.all()

    total_assigned = sum(g.assigned_points for g in goals)
    total_prev_earned = sum(g.previously_earned_points for g in goals)
    total_cycle_earned = sum(g.earned_points for g in goals)
    total_remaining = sum(g.remaining_points for g in goals)
    total_lifetime = round(total_prev_earned + total_cycle_earned, 2)

    completed_count = len([g for g in goals if g.status == "completed"])
    in_progress_count = len([g for g in goals if g.status == "in_progress"])
    carried_count = len([g for g in goals if g.carried_from_goal_id is not None or g.status == "carried_forward"])

    completion_rate = 0.0
    if total_assigned > 0:
        completion_rate = round((total_lifetime / total_assigned) * 100.0, 1)

    cycle_is_active = True
    if cycle_id is not None:
        c = db.query(PerformanceCycle).filter(PerformanceCycle.id == cycle_id).first()
        if c:
            cycle_is_active = (c.status == "active")

    return {
        "user_id": user.id,
        "full_name": user.full_name,
        "title": user.title,
        "role_level": user.role_level or 5,
        "manager_name": user.manager.full_name if user.manager else "Director",
        "cycle_name": cycle_name,
        "total_assigned_points": round(total_assigned, 1),
        "total_previously_earned_points": round(total_prev_earned, 1),
        "total_cycle_earned_points": round(total_cycle_earned, 1),
        "total_remaining_points": round(total_remaining, 1),
        "total_lifetime_earned_points": total_lifetime,
        "completion_rate_pct": completion_rate,
        "goals_count": len(goals),
        "completed_goals_count": completed_count,
        "carried_forward_goals_count": carried_count,
        "total_earned_points": round(total_cycle_earned, 1),
        "total_goals_count": len(goals),
        "in_progress_goals_count": in_progress_count,
        "cycle_is_active": cycle_is_active,
        "goals": [goal_to_response(g) for g in goals]
    }

@router.get("/summary/me", response_model=PerformanceSummaryEmployee)
@router.get("/my-summary", response_model=PerformanceSummaryEmployee)
def get_my_performance_summary(
    cycle_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Personal performance points and goals summary for the logged-in employee."""
    return build_employee_performance_summary(current_user, cycle_id, db)

@router.get("/summary/user/{user_id}", response_model=PerformanceSummaryEmployee)
@router.get("/employee/{user_id}/summary", response_model=PerformanceSummaryEmployee)
def get_user_performance_summary(
    user_id: int,
    cycle_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get performance summary of an employee with hierarchy RBAC."""
    enforce_hierarchy_access(current_user, user_id, db)
    target_user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    enforce_tenant_access(current_user, target_user.tenant_id)

    return build_employee_performance_summary(target_user, cycle_id, db)

@router.get("/evidence/appraisal", response_model=PerformanceAppraisalEvidenceResponse)
@router.get("/appraisal-evidence", response_model=PerformanceAppraisalEvidenceResponse)
def get_performance_appraisal_evidence(
    cycle_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Aggregates performance points and goal achievement evidence for Team Appraisal.
    - Managers see only their subordinate employees.
    - Directors see all employees in their tenant organization.
    - Evidence note explicitly clarifies that points are evidence for human review, not automated promotion algorithms.
    """
    is_director_or_admin = current_user.role in ["admin", "director"] or (current_user.role_level is not None and current_user.role_level <= 1)
    sub_ids = get_subordinate_ids(current_user, db)

    if not is_director_or_admin and not sub_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only managers and directors can view appraisal performance evidence."
        )

    # Scoped employees within tenant
    user_query = db.query(User).filter(
        User.deleted_at.is_(None),
        User.tenant_id == current_user.tenant_id
    )

    if is_director_or_admin:
        employees = user_query.filter(User.id != current_user.id).order_by(User.role_level.asc()).all()
    else:
        employees = user_query.filter(User.id.in_(sub_ids)).order_by(User.role_level.asc()).all()

    # Identify cycle name
    cycle_name = "Active Cycle"
    if cycle_id is not None:
        c = db.query(PerformanceCycle).filter(PerformanceCycle.id == cycle_id, PerformanceCycle.tenant_id == current_user.tenant_id).first()
        if c: cycle_name = c.name
    else:
        active_c = db.query(PerformanceCycle).filter(
            PerformanceCycle.tenant_id == current_user.tenant_id,
            PerformanceCycle.status == "active",
            PerformanceCycle.deleted_at.is_(None)
        ).first()
        if active_c:
            cycle_id = active_c.id
            cycle_name = active_c.name

    evidence_items = []
    for emp in employees:
        summary = build_employee_performance_summary(emp, cycle_id, db)
        evidence_items.append({
            "user_id": emp.id,
            "full_name": emp.full_name,
            "role": emp.role,
            "title": emp.title,
            "avatar_url": emp.avatar_url,
            "role_level": emp.role_level or 5,
            "manager_name": emp.manager.full_name if emp.manager else "Director",
            "cycle_name": summary["cycle_name"],
            "total_assigned_points": summary["total_assigned_points"],
            "total_earned_points": summary["total_cycle_earned_points"],
            "total_remaining_points": summary["total_remaining_points"],
            "completion_rate_pct": summary["completion_rate_pct"],
            "goals_count": summary["goals_count"],
            "completed_goals_count": summary["completed_goals_count"],
            "carried_forward_goals_count": summary["carried_forward_goals_count"],
            "goals": summary["goals"]
        })

    return {
        "cycle_id": cycle_id,
        "cycle_name": cycle_name,
        "manager_id": current_user.id,
        "manager_name": current_user.full_name,
        "evidence_note": "Performance points represent objective goal delivery evidence for human manager review; promotion and rating decisions are not automated.",
        "employees": evidence_items,
        "items": evidence_items
    }

# =========================================================================
# PHASE 5: PERFORMANCE HISTORY & INTELLIGENCE
# =========================================================================

def parse_cycle_year_quarter(c: PerformanceCycle) -> tuple[int, str]:
    """Deterministically extracts (Year, Quarter) from cycle name or start date."""
    m = re.search(r"(\d{4})[-_ ]?[Qq]([1-4])", c.name)
    if m:
        return int(m.group(1)), f"Q{m.group(2)}"
    start = c.start_date or datetime.utcnow()
    q_num = (start.month - 1) // 3 + 1
    return start.year, f"Q{q_num}"

def build_user_performance_history(user: User, db: Session) -> Dict[str, Any]:
    """
    Builds permanent multi-quarter and multi-year historical performance records for a user.
    - Groups records chronologically by Year -> Q1, Q2, Q3, Q4.
    - Correctly calculates cycle earned points vs locked previously earned points (no double-counting).
    - Preserves historical cycles without overwriting when new quarters start.
    - Generates deterministic performance trends strictly from verified database facts.
    """
    cycles = db.query(PerformanceCycle).filter(
        PerformanceCycle.tenant_id == user.tenant_id,
        PerformanceCycle.deleted_at.is_(None)
    ).order_by(PerformanceCycle.start_date.asc()).all()

    goals = db.query(PerformanceGoal).filter(
        PerformanceGoal.user_id == user.id,
        PerformanceGoal.tenant_id == user.tenant_id,
        PerformanceGoal.deleted_at.is_(None)
    ).all()

    if not goals and not cycles:
        return {
            "user_id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "title": user.title,
            "role": user.role,
            "role_level": user.role_level or 5,
            "manager_name": user.manager.full_name if user.manager else None,
            "current_cycle": None,
            "historical_quarters": [],
            "yearly_summaries": [],
            "trend": {
                "direction": "insufficient_data",
                "delta_pct": None,
                "summary": "No historical performance data available.",
                "data_points_count": 0
            },
            "has_history": False
        }

    goals_by_cycle: Dict[int, List[PerformanceGoal]] = {}
    for g in goals:
        goals_by_cycle.setdefault(g.cycle_id, []).append(g)

    historical_quarters: List[Dict[str, Any]] = []
    for c in cycles:
        cycle_goals = goals_by_cycle.get(c.id, [])
        # Include cycles with goals or active cycle for tenant
        if not cycle_goals and c.status != "active":
            continue

        year, quarter = parse_cycle_year_quarter(c)

        assigned_points = round(sum(g.assigned_points for g in cycle_goals), 1)
        prev_earned = round(sum(g.previously_earned_points for g in cycle_goals), 1)
        cycle_earned = round(sum(g.earned_points for g in cycle_goals), 1)
        lifetime_earned = round(prev_earned + cycle_earned, 1)
        remaining = round(sum(g.remaining_points for g in cycle_goals), 1)

        completion_rate = 0.0
        if assigned_points > 0:
            completion_rate = round((lifetime_earned / assigned_points) * 100.0, 1)

        completed_count = len([g for g in cycle_goals if g.status == "completed"])
        active_count = len([g for g in cycle_goals if g.status == "in_progress"])
        carried_count = len([g for g in cycle_goals if g.carried_from_goal_id is not None or g.status == "carried_forward"])

        q_detail = {
            "cycle_id": c.id,
            "cycle_name": c.name,
            "year": year,
            "quarter": quarter,
            "status": c.status,
            "start_date": c.start_date,
            "end_date": c.end_date,
            "assigned_points": assigned_points,
            "previously_earned_points": prev_earned,
            "cycle_earned_points": cycle_earned,
            "lifetime_earned_points": lifetime_earned,
            "remaining_points": remaining,
            "completion_rate_pct": completion_rate,
            "goals_count": len(cycle_goals),
            "active_goals_count": active_count,
            "completed_goals_count": completed_count,
            "carried_forward_goals_count": carried_count,
            "goals": [goal_to_response(g) for g in cycle_goals]
        }
        historical_quarters.append(q_detail)

    quarter_order = {"Q1": 1, "Q2": 2, "Q3": 3, "Q4": 4}
    historical_quarters.sort(key=lambda q: (q["year"], quarter_order.get(q["quarter"], 5), q["start_date"] or datetime.min))

    # Current cycle: active cycle preferred, or latest cycle
    current_cycle_dict = None
    active_q = next((q for q in reversed(historical_quarters) if q["status"] == "active"), None)
    if not active_q and historical_quarters:
        active_q = historical_quarters[-1]

    if active_q:
        current_cycle_dict = {
            "cycle_id": active_q["cycle_id"],
            "cycle_name": active_q["cycle_name"],
            "year": active_q["year"],
            "quarter": active_q["quarter"],
            "status": active_q["status"],
            "assigned_points": active_q["assigned_points"],
            "earned_points": active_q["cycle_earned_points"],
            "previously_earned_points": active_q["previously_earned_points"],
            "lifetime_earned_points": active_q["lifetime_earned_points"],
            "remaining_points": active_q["remaining_points"],
            "completion_rate_pct": active_q["completion_rate_pct"],
            "active_goals_count": active_q["active_goals_count"],
            "carried_goals_count": active_q["carried_forward_goals_count"],
            "completed_goals_count": active_q["completed_goals_count"],
            "total_goals_count": active_q["goals_count"],
            "goals": active_q["goals"]
        }

    # Group quarters into Yearly Summaries
    years_dict: Dict[int, List[Dict[str, Any]]] = {}
    for q in historical_quarters:
        years_dict.setdefault(q["year"], []).append(q)

    yearly_summaries: List[Dict[str, Any]] = []
    for yr in sorted(years_dict.keys()):
        quarters_in_yr = years_dict[yr]
        total_yr_assigned = round(sum(q["assigned_points"] for q in quarters_in_yr), 1)
        total_yr_earned = round(sum(q["cycle_earned_points"] for q in quarters_in_yr), 1)
        total_yr_lifetime = round(sum(q["lifetime_earned_points"] for q in quarters_in_yr), 1)

        yr_completion = 0.0
        if total_yr_assigned > 0:
            yr_completion = round((total_yr_earned / total_yr_assigned) * 100.0, 1)

        yearly_summaries.append({
            "year": yr,
            "assigned_points": total_yr_assigned,
            "earned_points": total_yr_earned,
            "lifetime_earned_points": total_yr_lifetime,
            "completion_rate_pct": yr_completion,
            "quarters_count": len(quarters_in_yr),
            "quarters": quarters_in_yr
        })

    # Trend calculation
    has_history = len(historical_quarters) > 0 and any(q["goals_count"] > 0 for q in historical_quarters)
    if not has_history:
        trend = {
            "direction": "insufficient_data",
            "delta_pct": None,
            "summary": "No historical performance data available.",
            "data_points_count": 0
        }
    elif len(historical_quarters) >= 2:
        curr_q = historical_quarters[-1]
        prev_q = historical_quarters[-2]
        delta = round(curr_q["completion_rate_pct"] - prev_q["completion_rate_pct"], 1)
        if delta > 0:
            direction = "improving"
            summary = f"Performance completion increased from {prev_q['completion_rate_pct']}% ({prev_q['cycle_name']}) to {curr_q['completion_rate_pct']}% ({curr_q['cycle_name']}) (+{delta}%)."
        elif delta < 0:
            direction = "declining"
            summary = f"Current cycle completion is {abs(delta)} percentage points below the previous cycle ({curr_q['completion_rate_pct']}% in {curr_q['cycle_name']} vs {prev_q['completion_rate_pct']}% in {prev_q['cycle_name']})."
        else:
            direction = "stable"
            summary = f"Performance completion remained stable at {curr_q['completion_rate_pct']}% between {prev_q['cycle_name']} and {curr_q['cycle_name']}."
        trend = {
            "direction": direction,
            "delta_pct": delta,
            "summary": summary,
            "data_points_count": len(historical_quarters)
        }
    else:
        trend = {
            "direction": "stable",
            "delta_pct": None,
            "summary": f"Single cycle recorded: {historical_quarters[0]['cycle_name']} at {historical_quarters[0]['completion_rate_pct']}% completion.",
            "data_points_count": 1
        }

    return {
        "user_id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "title": user.title,
        "role": user.role,
        "role_level": user.role_level or 5,
        "manager_name": user.manager.full_name if user.manager else None,
        "current_cycle": current_cycle_dict,
        "historical_quarters": historical_quarters,
        "yearly_summaries": yearly_summaries,
        "trend": trend,
        "has_history": has_history
    }

@router.get("/history", response_model=PerformanceHistoryResponse)
def get_my_performance_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Personal multi-quarter and multi-year performance history for logged-in employee."""
    return build_user_performance_history(current_user, db)

@router.get("/history/team", response_model=TeamPerformanceHistoryResponse)
def get_team_performance_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Team performance overview across years and quarters with strict hierarchy RBAC:
    - Director: Authorized across tenant organization.
    - Manager: Self + direct and indirect subordinate reports.
    - Employee without subordinates: 403 Forbidden.
    """
    is_director_or_admin = current_user.role in ["admin", "director"] or (current_user.role_level is not None and current_user.role_level <= 1)
    sub_ids = get_subordinate_ids(current_user, db)

    if not is_director_or_admin and not sub_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Team performance history is reserved for managers and directors."
        )

    user_query = db.query(User).filter(
        User.deleted_at.is_(None),
        User.tenant_id == current_user.tenant_id
    )

    if is_director_or_admin:
        users = user_query.order_by(User.role_level.asc(), User.full_name.asc()).all()
    else:
        allowed_ids = list(sub_ids) + [current_user.id]
        users = user_query.filter(User.id.in_(allowed_ids)).order_by(User.role_level.asc(), User.full_name.asc()).all()

    members = []
    for u in users:
        u_history = build_user_performance_history(u, db)
        curr_cycle = u_history.get("current_cycle")
        members.append({
            "user_id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "title": u.title,
            "role": u.role,
            "role_level": u.role_level or 5,
            "manager_name": u.manager.full_name if u.manager else "Director",
            "current_cycle_name": curr_cycle["cycle_name"] if curr_cycle else None,
            "current_completion_pct": curr_cycle["completion_rate_pct"] if curr_cycle else None,
            "yearly_summaries": u_history.get("yearly_summaries", []),
            "latest_trend": u_history.get("trend", {}).get("summary"),
            "has_history": u_history.get("has_history", False)
        })

    return {
        "manager_id": current_user.id,
        "manager_name": current_user.full_name,
        "is_director": is_director_or_admin,
        "members": members
    }

@router.get("/history/user/{user_id}", response_model=PerformanceHistoryResponse)
@router.get("/history/{user_id}", response_model=PerformanceHistoryResponse)
def get_user_performance_history(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Performance history of a user with strict hierarchy and multi-tenant RBAC:
    - Employee viewing another employee -> 403 Forbidden
    - Manager viewing peer/superior/unrelated employee -> 403 Forbidden
    - Cross-tenant access -> 403 Forbidden
    """
    enforce_hierarchy_access(current_user, user_id, db)
    target_user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")
    enforce_tenant_access(current_user, target_user.tenant_id)

    return build_user_performance_history(target_user, db)

# =========================================================================
# PHASE 6: PERFORMANCE REVIEW INTELLIGENCE (DOSSIER)
# =========================================================================

def build_performance_review_dossier(
    target_user: User,
    cycle_id: Optional[int],
    current_user: User,
    db: Session
) -> Dict[str, Any]:
    # 1. Resolve Evaluation Cycle (Default to active cycle, fallback to latest)
    if cycle_id is not None:
        cycle = db.query(PerformanceCycle).filter(
            PerformanceCycle.id == cycle_id,
            PerformanceCycle.tenant_id == target_user.tenant_id,
            PerformanceCycle.deleted_at.is_(None)
        ).first()
    else:
        cycle = db.query(PerformanceCycle).filter(
            PerformanceCycle.tenant_id == target_user.tenant_id,
            PerformanceCycle.status == "active",
            PerformanceCycle.deleted_at.is_(None)
        ).order_by(PerformanceCycle.start_date.desc()).first()
        if not cycle:
            cycle = db.query(PerformanceCycle).filter(
                PerformanceCycle.tenant_id == target_user.tenant_id,
                PerformanceCycle.deleted_at.is_(None)
            ).order_by(PerformanceCycle.start_date.desc()).first()

    if not cycle:
        raise HTTPException(status_code=404, detail="No performance cycle found for organization")

    # 2. Employee Info
    employee_info = {
        "user_id": target_user.id,
        "full_name": target_user.full_name,
        "email": target_user.email,
        "role": target_user.role,
        "role_level": target_user.role_level or 5,
        "manager_name": target_user.manager.full_name if target_user.manager else ("Director" if (target_user.role_level or 5) <= 2 else None)
    }

    # 3. Cycle Info
    cycle_info = {
        "cycle_id": cycle.id,
        "name": cycle.name,
        "status": cycle.status,
        "start_date": cycle.start_date,
        "end_date": cycle.end_date
    }

    # 4. Performance Comparison (Reuse build_user_performance_history)
    history = build_user_performance_history(target_user, db)
    historical_quarters = history.get("historical_quarters", [])
    yearly_summaries = history.get("yearly_summaries", [])
    trend = history.get("trend", {
        "direction": "insufficient_data",
        "delta_pct": None,
        "summary": "No historical performance data available.",
        "data_points_count": 0
    })

    curr_q = next((q for q in historical_quarters if q["cycle_id"] == cycle.id), None)
    if not curr_q:
        curr_q = {
            "cycle_id": cycle.id,
            "cycle_name": cycle.name,
            "assigned_points": 0.0,
            "cycle_earned_points": 0.0,
            "previously_earned_points": 0.0,
            "lifetime_earned_points": 0.0,
            "remaining_points": 0.0,
            "completion_rate_pct": 0.0,
            "completed_goals_count": 0,
            "goals_count": 0
        }

    prev_q = None
    for idx, q in enumerate(historical_quarters):
        if q["cycle_id"] == cycle.id and idx > 0:
            prev_q = historical_quarters[idx - 1]
            break

    delta_pct = None
    if prev_q and prev_q.get("completion_rate_pct") is not None and curr_q.get("completion_rate_pct") is not None:
        delta_pct = round(curr_q["completion_rate_pct"] - prev_q["completion_rate_pct"], 1)

    cycle_year = cycle.start_date.year if cycle.start_date else datetime.utcnow().year
    ytd_assigned = 0.0
    ytd_earned = 0.0
    for q in historical_quarters:
        if q.get("year") == cycle_year:
            ytd_assigned += q.get("assigned_points", 0.0)
            ytd_earned += q.get("cycle_earned_points", 0.0)
            if q["cycle_id"] == cycle.id:
                break

    ytd_completion = round((ytd_earned / ytd_assigned * 100.0), 1) if ytd_assigned > 0 else 0.0

    current_metrics = {
        "cycle_id": curr_q.get("cycle_id"),
        "cycle_name": curr_q.get("cycle_name", cycle.name),
        "assigned_points": curr_q.get("assigned_points", 0.0),
        "earned_points": curr_q.get("cycle_earned_points", 0.0),
        "previously_earned_points": curr_q.get("previously_earned_points", 0.0),
        "lifetime_earned_points": curr_q.get("lifetime_earned_points", 0.0),
        "remaining_points": curr_q.get("remaining_points", 0.0),
        "completion_rate_pct": curr_q.get("completion_rate_pct", 0.0),
        "completed_goals_count": curr_q.get("completed_goals_count", 0),
        "total_goals_count": curr_q.get("goals_count", 0)
    }

    previous_metrics = None
    if prev_q:
        previous_metrics = {
            "cycle_id": prev_q.get("cycle_id"),
            "cycle_name": prev_q.get("cycle_name", ""),
            "assigned_points": prev_q.get("assigned_points", 0.0),
            "earned_points": prev_q.get("cycle_earned_points", 0.0),
            "previously_earned_points": prev_q.get("previously_earned_points", 0.0),
            "lifetime_earned_points": prev_q.get("lifetime_earned_points", 0.0),
            "remaining_points": prev_q.get("remaining_points", 0.0),
            "completion_rate_pct": prev_q.get("completion_rate_pct", 0.0),
            "completed_goals_count": prev_q.get("completed_goals_count", 0),
            "total_goals_count": prev_q.get("goals_count", 0)
        }

    comparison = {
        "current_cycle": current_metrics,
        "previous_cycle": previous_metrics,
        "cycle_over_cycle_delta_pct": delta_pct,
        "year_to_date_assigned_points": round(ytd_assigned, 1),
        "year_to_date_earned_points": round(ytd_earned, 1),
        "year_to_date_completion_pct": ytd_completion,
        "yearly_progression": yearly_summaries,
        "trend": trend
    }

    # 5. Goals
    goals_query = db.query(PerformanceGoal).filter(
        PerformanceGoal.user_id == target_user.id,
        PerformanceGoal.cycle_id == cycle.id,
        PerformanceGoal.tenant_id == target_user.tenant_id,
        PerformanceGoal.deleted_at.is_(None)
    ).order_by(PerformanceGoal.created_at.asc()).all()

    review_goals = []
    raw_evidence = []
    for g in goals_query:
        review_goals.append({
            "goal_id": g.id,
            "title": g.title,
            "category": getattr(g, "category", "delivery") or "delivery",
            "assigned_points": g.assigned_points,
            "previously_earned_points": g.previously_earned_points,
            "cycle_earned_points": g.earned_points,
            "lifetime_earned_points": round(g.previously_earned_points + g.earned_points, 2),
            "remaining_points": g.remaining_points,
            "progress": g.current_progress_percentage,
            "status": g.status,
            "carried_forward": bool(g.carried_from_goal_id is not None or g.status == "carried_forward"),
            "carried_from_goal_id": g.carried_from_goal_id,
            "source_task_id": g.source_task_id,
            "source_task_title": g.source_task.title if g.source_task else None,
            "deadline": g.deadline
        })

        raw_evidence.append({
            "source_type": "goal",
            "source_id": str(g.id),
            "title": g.title,
            "author_or_owner": target_user.full_name,
            "timestamp": g.created_at.isoformat() if g.created_at else None,
            "excerpt": f"Goal '{g.title}': progress {g.current_progress_percentage}%, status {g.status}, cycle earned {g.earned_points} pts"
        })

    # 6. Operational Delivery (Reuse build_user_points_summary)
    points_summary = build_user_points_summary(target_user, db)

    active_blockers_list = db.query(Blocker).filter(
        Blocker.owner_name == target_user.full_name,
        Blocker.status.in_(["open", "in_progress"])
    )
    if target_user.tenant_id is not None:
        active_blockers_list = active_blockers_list.filter(Blocker.tenant_id == target_user.tenant_id)
    active_blockers_rows = active_blockers_list.all()

    total_blockers_raised = db.query(Blocker).filter(
        Blocker.owner_name == target_user.full_name
    )
    if target_user.tenant_id is not None:
        total_blockers_raised = total_blockers_raised.filter(Blocker.tenant_id == target_user.tenant_id)
    blockers_raised_count = total_blockers_raised.count()

    operational_delivery = {
        "completed_tasks": points_summary.get("tasks_completed_on_time", 0) + points_summary.get("tasks_carried_over", 0),
        "tasks_on_time": points_summary.get("tasks_completed_on_time", 0),
        "tasks_carried_over": points_summary.get("tasks_carried_over", 0),
        "on_time_delivery_rate_pct": points_summary.get("on_time_rate_pct", 0.0),
        "checkin_consistency_pct": points_summary.get("checkin_consistency_pct", 0.0),
        "checkin_streak": points_summary.get("checkin_streak", 0),
        "blockers_raised": blockers_raised_count,
        "blockers_resolved": points_summary.get("blockers_resolved", 0),
        "active_blockers": len(active_blockers_rows),
        "story_points_total": points_summary.get("total_points", 0.0),
        "points_per_sprint": points_summary.get("points_per_sprint", [])
    }

    # Add task evidence citations
    for t in points_summary.get("tasks", [])[:6]:
        raw_evidence.append({
            "source_type": "task",
            "source_id": str(t["task_id"]),
            "title": t["title"],
            "author_or_owner": target_user.full_name,
            "timestamp": t["completed_at"].isoformat() if t.get("completed_at") else None,
            "excerpt": f"Task '{t['title']}' ({t['status']}): difficulty {t['difficulty']}, earned {t['earned_points']} story pts"
        })

    # Add active blocker evidence citations
    for b in active_blockers_rows[:3]:
        raw_evidence.append({
            "source_type": "blocker",
            "source_id": str(b.id),
            "title": b.summary[:50],
            "author_or_owner": b.owner_name,
            "timestamp": b.created_at.isoformat() if b.created_at else None,
            "excerpt": f"Active blocker: '{b.summary}' (blocked by {b.blocked_by or 'Unknown'}, status {b.status})"
        })

    # Add recent checkin evidence
    recent_checkins = db.query(Checkin).filter(
        Checkin.user_id == target_user.id
    )
    if target_user.tenant_id is not None:
        recent_checkins = recent_checkins.filter(Checkin.tenant_id == target_user.tenant_id)
    recent_checkins_rows = recent_checkins.order_by(Checkin.created_at.desc()).limit(2).all()
    for chk in recent_checkins_rows:
        raw_evidence.append({
            "source_type": "checkin",
            "source_id": str(chk.id),
            "title": f"Check-in #{chk.id}",
            "author_or_owner": chk.user_name,
            "timestamp": chk.created_at.isoformat() if chk.created_at else None,
            "excerpt": (chk.progress_note or chk.today or "Daily standup submission")[:120]
        })

    # Validate evidence citations with EvidenceValidator (strictly tenant and hierarchy scoped)
    verified_evidence = [
        EvidenceValidator.validate_evidence_item(ev, current_user, db)
        for ev in raw_evidence
    ]

    # 7. Factual Review Intelligence & Discussion Topics (Strictly deterministic, no subjective rating / salary / promo)
    accomplishments = []
    completed_goals = [g for g in review_goals if g["status"] == "completed"]
    for g in completed_goals:
        accomplishments.append(f"Completed goal '{g['title']}' earning {g['cycle_earned_points']} performance points (lifetime: {g['lifetime_earned_points']} pts).")

    if operational_delivery["tasks_on_time"] > 0:
        accomplishments.append(f"Delivered {operational_delivery['tasks_on_time']} tasks on-time with an on-time rate of {operational_delivery['on_time_delivery_rate_pct']}%.")

    if operational_delivery["blockers_resolved"] > 0:
        accomplishments.append(f"Resolved {operational_delivery['blockers_resolved']} technical blockers during the evaluation cycle.")

    outstanding_goals = []
    in_prog_goals = [g for g in review_goals if g["status"] == "in_progress"]
    for g in in_prog_goals:
        outstanding_goals.append(f"Goal '{g['title']}': currently at {g['progress']}% progress with {g['remaining_points']} points remaining to complete.")

    carried_forward_goals = []
    cf_goals = [g for g in review_goals if g["carried_forward"]]
    for g in cf_goals:
        carried_forward_goals.append(f"Carried-forward goal '{g['title']}': {g['previously_earned_points']} locked prior points, {g['cycle_earned_points']} points earned in current cycle.")

    active_blockers_text = []
    for b in active_blockers_rows:
        active_blockers_text.append(f"Unresolved blocker #{b.id}: '{b.summary}' (Severity: {b.severity}, Blocked by: {b.blocked_by}).")

    discussion_topics = []
    if completed_goals:
        goal_ev = [ev for ev in verified_evidence if ev.get("source_type") in ["goal", "performance_goal"] and any(str(g["goal_id"]) == ev.get("source_id") for g in completed_goals)]
        discussion_topics.append({
            "topic": "Delivered Goal Milestones & Value Impact",
            "category": "accomplishment",
            "summary": f"Review {len(completed_goals)} completed performance goals and their business impact during {cycle.name}.",
            "evidence": goal_ev
        })

    if in_prog_goals:
        in_prog_ev = [ev for ev in verified_evidence if ev.get("source_type") in ["goal", "performance_goal"] and any(str(g["goal_id"]) == ev.get("source_id") for g in in_prog_goals)]
        discussion_topics.append({
            "topic": "Outstanding Goals & Milestone Timeline",
            "category": "outstanding_goal",
            "summary": f"Align on remaining steps for {len(in_prog_goals)} active goals, addressing remaining points and target deadlines.",
            "evidence": in_prog_ev
        })

    if cf_goals:
        cf_ev = [ev for ev in verified_evidence if ev.get("source_type") in ["goal", "performance_goal"] and any(str(g["goal_id"]) == ev.get("source_id") for g in cf_goals)]
        discussion_topics.append({
            "topic": "Carried-Forward Scope & Continuity",
            "category": "outstanding_goal",
            "summary": f"Review scope continuity for {len(cf_goals)} carried-forward goals ensuring clear milestone targets without duplicate points.",
            "evidence": cf_ev
        })

    if active_blockers_rows:
        blocker_ev = [ev for ev in verified_evidence if ev.get("source_type") == "blocker"]
        discussion_topics.append({
            "topic": "Active Impediments & Team Support",
            "category": "blocker",
            "summary": f"Examine {len(active_blockers_rows)} active technical blockers and identify management intervention or unblocking assistance needed.",
            "evidence": blocker_ev
        })

    task_ev = [ev for ev in verified_evidence if ev.get("source_type") == "task"]
    discussion_topics.append({
        "topic": "Delivery Cadence & Standup Consistency",
        "category": "delivery",
        "summary": f"Operational delivery metrics: {operational_delivery['completed_tasks']} tasks completed, {operational_delivery['on_time_delivery_rate_pct']}% on-time rate, {operational_delivery['checkin_consistency_pct']}% standup consistency, and {operational_delivery['story_points_total']} story points delivered.",
        "evidence": task_ev
    })

    if trend.get("direction") != "insufficient_data":
        discussion_topics.append({
            "topic": "Multi-Quarter Performance Progression",
            "category": "trend",
            "summary": trend.get("summary", "Historical trend analysis across recorded performance cycles."),
            "evidence": []
        })

    review_intelligence = {
        "summary": f"Performance review dossier for {target_user.full_name} ({target_user.role}) in {cycle.name}. Consolidates {len(review_goals)} goals, {operational_delivery['completed_tasks']} tasks, and {operational_delivery['story_points_total']} story points with factual audit citations.",
        "accomplishments": accomplishments,
        "outstanding_goals": outstanding_goals,
        "carried_forward_goals": carried_forward_goals,
        "active_blockers": active_blockers_text,
        "discussion_topics": discussion_topics
    }

    # 8. Manager Review Notes (Private to Manager/Director; hidden from employee)
    is_director_or_admin = current_user.role in ["admin", "director"] or (current_user.role_level is not None and current_user.role_level <= 1)
    is_manager = current_user.role == "manager" or (current_user.role_level is not None and current_user.role_level == 2)
    is_self = (current_user.id == target_user.id)

    # Note visibility check:
    # Employees MUST NOT see private manager notes.
    # When employee views own review -> manager_notes is None.
    # When manager/director views authorized subordinate -> manager_notes is loaded.
    manager_notes_resp = None
    is_manager_or_director = (is_director_or_admin or is_manager) and not is_self

    if is_manager_or_director or (is_director_or_admin and is_self):
        note = db.query(PerformanceReviewNote).filter(
            PerformanceReviewNote.tenant_id == target_user.tenant_id,
            PerformanceReviewNote.cycle_id == cycle.id,
            PerformanceReviewNote.user_id == target_user.id
        ).first()

        if note:
            manager_notes_resp = {
                "id": note.id,
                "tenant_id": note.tenant_id,
                "cycle_id": note.cycle_id,
                "user_id": note.user_id,
                "manager_id": note.manager_id,
                "manager_name": note.manager.full_name if note.manager else None,
                "preparation_notes": note.preparation_notes or "",
                "discussion_agenda": note.discussion_agenda or "",
                "created_at": note.created_at,
                "updated_at": note.updated_at
            }

    return {
        "employee": employee_info,
        "cycle": cycle_info,
        "comparison": comparison,
        "goals": review_goals,
        "operational_delivery": operational_delivery,
        "verified_evidence": verified_evidence,
        "review_intelligence": review_intelligence,
        "manager_notes": manager_notes_resp,
        "is_manager_or_director": is_manager_or_director,
        "evidence_note": "Consolidated dossier derived strictly from verified SyncBrief database records. Ratings and personnel actions remain the sole responsibility of the human manager."
    }

@router.get("/review/{user_id}", response_model=PerformanceReviewDossierResponse)
def get_performance_review_dossier_endpoint(
    user_id: int,
    cycle_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Consolidated Performance Review Dossier for review preparation:
    - Employee: can view own review only. Manager notes are stripped.
    - Manager: can view self and authorized direct/indirect subordinates.
    - Director: can view authorized users within tenant.
    - Rejects peer access (403), superior access (403), cross-tenant access (403).
    """
    enforce_hierarchy_access(current_user, user_id, db)
    target_user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")
    enforce_tenant_access(current_user, target_user.tenant_id)

    return build_performance_review_dossier(target_user, cycle_id, current_user, db)

@router.put("/review/{user_id}/notes", response_model=PerformanceReviewNoteResponse)
def update_performance_review_notes_endpoint(
    user_id: int,
    req: PerformanceReviewNotesUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Save or update private manager review notes:
    - Employee cannot save manager review notes (403).
    - Cannot create manager notes for self (403).
    - Manager can only save notes for authorized direct/indirect subordinates.
    - Director can save notes for tenant users.
    - Cross-tenant access blocked (403).
    """
    is_director_or_admin = current_user.role in ["admin", "director"] or (current_user.role_level is not None and current_user.role_level <= 1)
    is_manager = current_user.role == "manager" or (current_user.role_level is not None and current_user.role_level == 2)

    if not is_director_or_admin and not is_manager:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only managers and directors can create or update review notes."
        )

    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Managers cannot create preparation notes for their own evaluation."
        )

    target_user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")

    enforce_tenant_access(current_user, target_user.tenant_id)

    if not is_director_or_admin:
        sub_ids = get_subordinate_ids(current_user, db)
        if target_user.id not in sub_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: You are not authorized to write review notes for this employee."
            )

    # Resolve Cycle
    if req.cycle_id is not None:
        cycle = db.query(PerformanceCycle).filter(
            PerformanceCycle.id == req.cycle_id,
            PerformanceCycle.tenant_id == current_user.tenant_id,
            PerformanceCycle.deleted_at.is_(None)
        ).first()
    else:
        cycle = db.query(PerformanceCycle).filter(
            PerformanceCycle.tenant_id == current_user.tenant_id,
            PerformanceCycle.status == "active",
            PerformanceCycle.deleted_at.is_(None)
        ).first()
        if not cycle:
            cycle = db.query(PerformanceCycle).filter(
                PerformanceCycle.tenant_id == current_user.tenant_id,
                PerformanceCycle.deleted_at.is_(None)
            ).order_by(PerformanceCycle.start_date.desc()).first()

    if not cycle:
        raise HTTPException(status_code=404, detail="No performance cycle found")

    # Find existing note or create new
    note = db.query(PerformanceReviewNote).filter(
        PerformanceReviewNote.tenant_id == current_user.tenant_id,
        PerformanceReviewNote.cycle_id == cycle.id,
        PerformanceReviewNote.user_id == target_user.id
    ).first()

    if note:
        note.preparation_notes = req.preparation_notes
        note.discussion_agenda = req.discussion_agenda
        note.manager_id = current_user.id
        note.updated_at = datetime.utcnow()
    else:
        note = PerformanceReviewNote(
            tenant_id=current_user.tenant_id,
            cycle_id=cycle.id,
            user_id=target_user.id,
            manager_id=current_user.id,
            preparation_notes=req.preparation_notes,
            discussion_agenda=req.discussion_agenda
        )
        db.add(note)

    db.commit()
    db.refresh(note)

    log_audit_event(
        db,
        action="UPDATE_PERFORMANCE_REVIEW_NOTES",
        entity_type="performance_review_note",
        entity_id=note.id,
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        tenant_id=current_user.tenant_id,
        new_values={"user_id": target_user.id, "cycle_id": cycle.id}
    )
    db.commit()

    return {
        "id": note.id,
        "tenant_id": note.tenant_id,
        "cycle_id": note.cycle_id,
        "user_id": note.user_id,
        "manager_id": note.manager_id,
        "manager_name": current_user.full_name,
        "preparation_notes": note.preparation_notes or "",
        "discussion_agenda": note.discussion_agenda or "",
        "created_at": note.created_at,
        "updated_at": note.updated_at
    }

