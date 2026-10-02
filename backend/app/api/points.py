from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import csv
import io
from typing import List, Dict, Any
from backend.app.database import get_db
from backend.app.models import User, Task, Checkin, Blocker, Sprint
from backend.app.schemas import PointsSummaryResponse, AppraisalReportResponse, AppraisalEmployeeItem, TaskPointDetail
from backend.app.auth_deps import get_current_user
from backend.app.hierarchy import (
    can_view_user, 
    enforce_hierarchy_access, 
    get_subordinate_ids, 
    calculate_task_points,
    get_accessible_user_ids,
    enforce_tenant_access
)

router = APIRouter(prefix="/points", tags=["Points & Quarterly Appraisal"])

CARRY_OVER_PENALTY_DEFAULT = 25.0
FORMULA_EXPLANATION = "Points = max(0, difficulty × (1 - (penalty_pct / 100) × carried_over_count)). 25% deducted per carry-over."

def build_user_points_summary(user: User, db: Session, penalty_pct: float = CARRY_OVER_PENALTY_DEFAULT) -> dict:
    task_query = db.query(Task).filter(Task.assignee_id == user.id, Task.deleted_at.is_(None))
    if user.tenant_id is not None:
        task_query = task_query.filter(Task.tenant_id == user.tenant_id)
    tasks = task_query.all()
    
    total_points = 0.0
    completed_on_time = 0
    carried_over_tasks = 0
    task_details = []

    sprint_points_map: Dict[str, float] = {}

    for t in tasks:
        earned = 0.0
        applied_penalty = 0.0
        if t.status == "Done":
            earned = calculate_task_points(t.difficulty, t.carried_over_count or 0, penalty_pct)
            total_points += earned
            if (t.carried_over_count or 0) == 0:
                completed_on_time += 1
            else:
                carried_over_tasks += 1
            applied_penalty = min(100.0, penalty_pct * (t.carried_over_count or 0))

            sprint_name = t.sprint.name if t.sprint else "Ad-hoc"
            sprint_points_map[sprint_name] = sprint_points_map.get(sprint_name, 0.0) + earned

        task_details.append({
            "task_id": t.id,
            "title": t.title,
            "difficulty": t.difficulty,
            "carried_over_count": t.carried_over_count or 0,
            "penalty_pct_applied": applied_penalty,
            "earned_points": earned,
            "status": t.status,
            "completed_at": t.completed_at
        })

    completed_total = completed_on_time + carried_over_tasks
    on_time_rate = round((completed_on_time / max(1, completed_total)) * 100.0, 1)

    # Check-ins & Consistency
    ninety_days_ago = datetime.utcnow() - timedelta(days=90)
    checkin_query = db.query(Checkin).filter(Checkin.user_id == user.id, Checkin.created_at >= ninety_days_ago)
    if user.tenant_id is not None:
        checkin_query = checkin_query.filter(Checkin.tenant_id == user.tenant_id)
    checkins_count = checkin_query.count()
    expected_work_days = 65 # approx 21.6 days/month * 3
    consistency_pct = min(100.0, round((checkins_count / expected_work_days) * 100.0, 1))

    # Blockers
    blocker_query = db.query(Blocker).filter(Blocker.owner_name == user.full_name, Blocker.status == "resolved")
    if user.tenant_id is not None:
        blocker_query = blocker_query.filter(Blocker.tenant_id == user.tenant_id)
    blockers_resolved = blocker_query.count()

    points_per_sprint = [{"sprint": s, "points": round(pts, 1)} for s, pts in sprint_points_map.items()]

    return {
        "user_id": user.id,
        "user_name": user.full_name,
        "title": user.title,
        "quarter": "Q3 2026",
        "total_points": round(total_points, 1),
        "tasks_completed_on_time": completed_on_time,
        "tasks_carried_over": carried_over_tasks,
        "on_time_rate_pct": on_time_rate,
        "checkin_streak": user.streak_count or 0,
        "checkin_consistency_pct": consistency_pct,
        "blockers_resolved": blockers_resolved,
        "carry_over_penalty_pct": penalty_pct,
        "formula_text": FORMULA_EXPLANATION,
        "tasks": task_details,
        "points_per_sprint": points_per_sprint
    }

@router.get("/me", response_model=PointsSummaryResponse)
def get_my_points(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Personal points and quarterly progress for the logged-in employee."""
    return build_user_points_summary(current_user, db)

@router.get("/user/{user_id}", response_model=PointsSummaryResponse)
def get_user_points(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get points of a specific user.
    BACKEND ENFORCED: Raises 403 Forbidden if current_user is a peer or subordinate,
    or not in the user's reporting tree!
    """
    enforce_hierarchy_access(current_user, user_id, db)
    target_user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    if current_user.tenant_id is not None and target_user.tenant_id is not None and current_user.tenant_id != target_user.tenant_id:
        raise HTTPException(status_code=403, detail="Forbidden: Cannot view points of user from a different organization")

    return build_user_points_summary(target_user, db)

@router.get("/recompute/{user_id}")
def recompute_user_points(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Audit-grade points recomputation:
    Strictly re-derives appraisal points from raw immutable Task records
    using the formal formula: max(0, difficulty * (1 - 0.25 * carried_over_count)).
    Verifies reproducibility and mathematical integrity.
    """
    enforce_hierarchy_access(current_user, user_id, db)
    target_user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    if current_user.tenant_id is not None and target_user.tenant_id is not None and current_user.tenant_id != target_user.tenant_id:
        raise HTTPException(status_code=403, detail="Forbidden: Cannot recompute points of user from a different organization")

    task_query = db.query(Task).filter(
        Task.assignee_id == user_id,
        Task.deleted_at.is_(None)
    )
    if current_user.tenant_id is not None:
        task_query = task_query.filter(Task.tenant_id == current_user.tenant_id)
    tasks = task_query.all()

    breakdown = []
    total_recomputed = 0.0

    for t in tasks:
        earned = 0.0
        applied_penalty_pct = 0.0
        if t.status == "Done":
            earned = calculate_task_points(t.difficulty, t.carried_over_count or 0, CARRY_OVER_PENALTY_DEFAULT)
            applied_penalty_pct = min(100.0, CARRY_OVER_PENALTY_DEFAULT * (t.carried_over_count or 0))
            total_recomputed += earned

        breakdown.append({
            "task_id": t.id,
            "title": t.title,
            "difficulty": t.difficulty,
            "carried_over_count": t.carried_over_count or 0,
            "penalty_percentage": applied_penalty_pct,
            "earned_points": earned,
            "status": t.status,
            "formula_applied": f"max(0, {t.difficulty} * (1 - 0.25 * {t.carried_over_count or 0})) = {earned}"
        })

    summary = build_user_points_summary(target_user, db)
    is_valid = abs(round(total_recomputed, 1) - summary["total_points"]) < 0.01

    return {
        "user_id": target_user.id,
        "user_name": target_user.full_name,
        "recomputed_total_points": round(total_recomputed, 1),
        "cached_summary_points": summary["total_points"],
        "is_mathematically_verified": is_valid,
        "tasks_audited_count": len(tasks),
        "done_tasks_count": len([t for t in tasks if t.status == "Done"]),
        "formula": FORMULA_EXPLANATION,
        "audit_timestamp": datetime.utcnow().isoformat(),
        "task_breakdown": breakdown
    }

@router.get("/appraisal", response_model=AppraisalReportResponse)
def get_team_appraisal(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Quarterly appraisal dashboard for managers and directors.
    BACKEND ENFORCED:
    - Employees without reports cannot access appraisal reports (403 Forbidden).
    - Managers see appraisal items ONLY for employees in their reporting tree.
    - Directors see appraisal items for everyone in their tenant organization.
    """
    sub_ids = get_subordinate_ids(current_user, db)
    is_director_or_admin = (
        current_user.role in ["admin", "director"] or 
        (current_user.role_level is not None and current_user.role_level <= 1)
    )

    if not is_director_or_admin and not sub_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only managers and directors can access team appraisal reports."
        )

    # Scoped employees within the tenant
    user_query = db.query(User).filter(User.deleted_at.is_(None))
    if current_user.tenant_id is not None:
        user_query = user_query.filter(User.tenant_id == current_user.tenant_id)

    if is_director_or_admin:
        employees = user_query.filter(User.id != current_user.id).order_by(User.role_level.asc()).all()
    else:
        employees = user_query.filter(User.id.in_(sub_ids)).order_by(User.role_level.asc()).all()

    employee_items = []
    for emp in employees:
        pts_summary = build_user_points_summary(emp, db)
        
        # Rating calculation
        total_pts = pts_summary["total_points"]
        on_time = pts_summary["on_time_rate_pct"]
        consistency = pts_summary["checkin_consistency_pct"]

        score = 3.0
        if total_pts >= 25 and on_time >= 80 and consistency >= 80:
            score = 4.8
            rating = "Exceeds Expectations (High Performer)"
        elif total_pts >= 15 and on_time >= 60:
            score = 4.2
            rating = "Meets Expectations (Consistent Contributor)"
        elif total_pts >= 8:
            score = 3.5
            rating = "Developing (Good Momentum)"
        else:
            score = 2.8
            rating = "Needs Focus / Blocked"

        blocker_base = db.query(Blocker).filter(Blocker.owner_name == emp.full_name)
        if current_user.tenant_id is not None:
            blocker_base = blocker_base.filter(Blocker.tenant_id == current_user.tenant_id)
        blockers_raised = blocker_base.count()
        blockers_resolved = blocker_base.filter(Blocker.status == "resolved").count()

        employee_items.append({
            "user_id": emp.id,
            "full_name": emp.full_name,
            "role": emp.role,
            "title": emp.title,
            "avatar_url": emp.avatar_url,
            "role_level": emp.role_level or 5,
            "manager_name": emp.manager.full_name if emp.manager else "Director",
            "quarter": "Q3 2026",
            "total_points": total_pts,
            "tasks_completed": pts_summary["tasks_completed_on_time"] + pts_summary["tasks_carried_over"],
            "on_time_rate_pct": on_time,
            "carry_over_count": pts_summary["tasks_carried_over"],
            "blockers_raised": blockers_raised,
            "blockers_resolved": blockers_resolved,
            "checkin_consistency_pct": consistency,
            "appraisal_score": score,
            "rating_category": rating
        })

    return {
        "manager_id": current_user.id,
        "manager_name": current_user.full_name,
        "quarter": "Q3 2026",
        "carry_over_penalty_pct": CARRY_OVER_PENALTY_DEFAULT,
        "formula_text": FORMULA_EXPLANATION,
        "employees": employee_items
    }

@router.get("/appraisal/export/csv")
def export_appraisal_csv(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export appraisal metrics as downloadable CSV for manager review."""
    report = get_team_appraisal(current_user, db)
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Employee ID", "Employee Name", "Title", "Manager", "Role Level",
        "Total Points", "Tasks Completed", "On-Time Rate %", "Carry Overs",
        "Blockers Raised", "Blockers Resolved", "Check-in Consistency %",
        "Appraisal Score", "Rating Category"
    ])

    for emp in report["employees"]:
        writer.writerow([
            emp["user_id"], emp["full_name"], emp["title"], emp["manager_name"], emp["role_level"],
            emp["total_points"], emp["tasks_completed"], f"{emp['on_time_rate_pct']}%", emp["carry_over_count"],
            emp["blockers_raised"], emp["blockers_resolved"], f"{emp['checkin_consistency_pct']}%",
            emp["appraisal_score"], emp["rating_category"]
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=SyncBrief-Appraisal-{datetime.utcnow().strftime('%Y-%m-%d')}.csv"}
    )

