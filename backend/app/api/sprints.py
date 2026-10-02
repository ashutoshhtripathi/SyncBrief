from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Optional
from backend.app.database import get_db
from backend.app.models import Sprint, Task, User
from backend.app.schemas import SprintCreate, SprintUpdate, SprintCloseRequest, SprintResponse
from backend.app.auth_deps import get_current_user

router = APIRouter(prefix="/sprints", tags=["Sprints"])

def sprint_to_response(s: Sprint, db: Session) -> dict:
    total_tasks = db.query(Task).filter(Task.sprint_id == s.id, Task.deleted_at.is_(None)).count()
    completed = db.query(Task).filter(Task.sprint_id == s.id, Task.status == "Done", Task.deleted_at.is_(None)).count()
    return {
        "id": s.id,
        "name": s.name,
        "start_date": s.start_date,
        "end_date": s.end_date,
        "status": s.status,
        "goal": s.goal,
        "created_at": s.created_at,
        "task_count": total_tasks,
        "completed_task_count": completed
    }

@router.get("", response_model=List[SprintResponse])
def get_all_sprints(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all active/planned sprints sorted by status and date, scoped to user's tenant."""
    query = db.query(Sprint).filter(Sprint.deleted_at.is_(None))
    if current_user.tenant_id is not None:
        query = query.filter(Sprint.tenant_id == current_user.tenant_id)
    sprints = query.order_by(
        Sprint.status.desc(),
        Sprint.end_date.desc()
    ).all()
    return [sprint_to_response(s, db) for s in sprints]

@router.get("/active", response_model=Optional[SprintResponse])
def get_active_sprint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the currently active sprint in the tenant organization."""
    query = db.query(Sprint).filter(Sprint.deleted_at.is_(None))
    if current_user.tenant_id is not None:
        query = query.filter(Sprint.tenant_id == current_user.tenant_id)
    
    sprint = query.filter(Sprint.status == "active").first()
    if not sprint:
        sprint = query.order_by(Sprint.id.desc()).first()
    if not sprint:
        return None
    return sprint_to_response(sprint, db)

@router.get("/{sprint_id}", response_model=SprintResponse)
def get_sprint_by_id(
    sprint_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id, Sprint.deleted_at.is_(None)).first()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")

    if current_user.tenant_id is not None and sprint.tenant_id is not None and current_user.tenant_id != sprint.tenant_id:
        raise HTTPException(status_code=403, detail="Forbidden: Sprint belongs to a different organization")

    return sprint_to_response(sprint, db)

@router.post("", response_model=SprintResponse)
def create_sprint(
    req: SprintCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new sprint scoped to the current user's tenant."""
    new_sprint = Sprint(
        tenant_id=current_user.tenant_id,
        name=req.name,
        start_date=req.start_date,
        end_date=req.end_date,
        status=req.status,
        goal=req.goal
    )
    db.add(new_sprint)
    db.commit()
    db.refresh(new_sprint)
    return sprint_to_response(new_sprint, db)

@router.put("/{sprint_id}", response_model=SprintResponse)
def update_sprint(
    sprint_id: int,
    req: SprintUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")

    if current_user.tenant_id is not None and sprint.tenant_id is not None and current_user.tenant_id != sprint.tenant_id:
        raise HTTPException(status_code=403, detail="Forbidden: Sprint belongs to a different organization")

    if req.name is not None: sprint.name = req.name
    if req.start_date is not None: sprint.start_date = req.start_date
    if req.end_date is not None: sprint.end_date = req.end_date
    if req.status is not None: sprint.status = req.status
    if req.goal is not None: sprint.goal = req.goal

    db.commit()
    db.refresh(sprint)
    return sprint_to_response(sprint, db)

@router.post("/{sprint_id}/close")
def close_sprint(
    sprint_id: int,
    req: SprintCloseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Sprint Close Flow:
    1. Unfinished tasks (status != 'Done') are carried over to target_sprint_id.
    2. Each carried-over task has carried_over_count incremented (+1).
    3. Sprint is marked 'closed'.
    """
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")

    if current_user.tenant_id is not None and sprint.tenant_id is not None and current_user.tenant_id != sprint.tenant_id:
        raise HTTPException(status_code=403, detail="Forbidden: Sprint belongs to a different organization")

    target_sprint_id = req.target_sprint_id

    # Create next sprint automatically if requested
    if req.create_next_sprint or not target_sprint_id:
        next_name = req.next_sprint_name or f"Sprint {sprint.id + 1}"
        new_start = sprint.end_date
        new_end = new_start + timedelta(days=14)
        next_sprint = Sprint(
            tenant_id=current_user.tenant_id,
            name=next_name,
            start_date=new_start,
            end_date=new_end,
            status="active",
            goal=f"Continuation of {sprint.name}"
        )
        db.add(next_sprint)
        db.flush()
        target_sprint_id = next_sprint.id

    # Find unfinished tasks
    unfinished_tasks = db.query(Task).filter(
        Task.sprint_id == sprint_id,
        Task.status != "Done"
    ).all()

    carried_over_tasks = []
    for task in unfinished_tasks:
        task.sprint_id = target_sprint_id
        task.carried_over_count = (task.carried_over_count or 0) + 1
        task.updated_at = datetime.utcnow()
        carried_over_tasks.append(task.id)

    sprint.status = "closed"
    db.commit()

    return {
        "status": "success",
        "message": f"Sprint '{sprint.name}' successfully closed. {len(carried_over_tasks)} unfinished tasks carried over.",
        "closed_sprint_id": sprint.id,
        "target_sprint_id": target_sprint_id,
        "carried_over_task_ids": carried_over_tasks
    }

