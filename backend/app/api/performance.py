from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional, Dict, Any
import re
from backend.app.database import get_db
from backend.app.models import User, Task, PerformanceCycle, PerformanceGoal
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
    TeamPerformanceHistoryResponse
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
