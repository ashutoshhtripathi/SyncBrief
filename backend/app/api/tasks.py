from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional
from backend.app.database import get_db
from backend.app.models import Task, User, Sprint
from backend.app.schemas import TaskCreate, TaskUpdate, TaskStatusUpdate, TaskResponse
from backend.app.auth_deps import get_current_user
from backend.app.hierarchy import can_view_user, enforce_hierarchy_access, calculate_task_points, get_accessible_user_ids, enforce_tenant_access

router = APIRouter(prefix="/tasks", tags=["Tasks & Sprint Board"])

def task_to_response(t: Task) -> dict:
    earned = 0.0
    if t.status == "Done":
        earned = calculate_task_points(t.difficulty, t.carried_over_count)
    return {
        "id": t.id,
        "title": t.title,
        "description": t.description or "",
        "assignee_id": t.assignee_id,
        "assignee_name": t.assignee.full_name if t.assignee else t.assignee_name,
        "assignee_avatar": t.assignee.avatar_url if t.assignee else None,
        "creator_id": t.creator_id,
        "priority": t.priority,
        "difficulty": t.difficulty,
        "status": t.status,
        "progress_pct": t.progress_pct or 0,
        "sprint_id": t.sprint_id,
        "sprint_name": t.sprint.name if t.sprint else None,
        "carried_over_count": t.carried_over_count or 0,
        "earned_points": earned,
        "version": t.version or 1,
        "completed_at": t.completed_at,
        "created_at": t.created_at,
        "updated_at": t.updated_at
    }

@router.get("", response_model=List[TaskResponse])
def get_tasks(
    sprint_id: Optional[int] = None,
    assignee_id: Optional[int] = None,
    priority: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List tasks with optional filters.
    ENFORCES HIERARCHY ACCESS & TENANT ISOLATION:
    - If assignee_id is specified: verifies caller has hierarchy permission to view assignee's tasks (403 if unauthorized).
    - If assignee_id is not specified:
      * Director/Admin: accesses all tasks within the tenant organization.
      * Manager: accesses tasks belonging to their reporting team, themselves, created by them, or unassigned.
      * Employee: accesses their assigned tasks, tasks created by them, or unassigned tasks.
    - Tenant isolation: never returns tasks outside current_user.tenant_id.
    """
    query = db.query(Task).filter(Task.deleted_at.is_(None))
    if current_user.tenant_id is not None:
        query = query.filter(Task.tenant_id == current_user.tenant_id)

    if assignee_id is not None:
        enforce_hierarchy_access(current_user, assignee_id, db)
        query = query.filter(Task.assignee_id == assignee_id)
    else:
        # Scoped access based on hierarchy level
        if current_user.role in ["admin", "director"] or (current_user.role_level is not None and current_user.role_level <= 1):
            pass # Director sees all within tenant
        elif current_user.role in ["manager"] or (current_user.role_level is not None and current_user.role_level == 2):
            accessible_ids = get_accessible_user_ids(current_user, db)
            query = query.filter(
                (Task.assignee_id.in_(accessible_ids)) | 
                (Task.creator_id == current_user.id) | 
                (Task.assignee_id.is_(None))
            )
        else:
            # Employee: only assigned to them, created by them, or unassigned team tasks
            query = query.filter(
                (Task.assignee_id == current_user.id) | 
                (Task.creator_id == current_user.id) | 
                (Task.assignee_id.is_(None))
            )

    if sprint_id:
        query = query.filter(Task.sprint_id == sprint_id)
    if priority:
        query = query.filter(Task.priority == priority)
    if status:
        query = query.filter(Task.status == status)

    tasks = query.order_by(Task.updated_at.desc()).all()
    return [task_to_response(t) for t in tasks]

@router.get("/my-tasks", response_model=List[TaskResponse])
def get_my_tasks(
    sprint_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get active tasks assigned to the currently logged in user."""
    query = db.query(Task).filter(Task.assignee_id == current_user.id, Task.deleted_at.is_(None))
    if current_user.tenant_id is not None:
        query = query.filter(Task.tenant_id == current_user.tenant_id)

    if sprint_id:
        query = query.filter(Task.sprint_id == sprint_id)
    else:
        # Defaults to active sprint in the tenant if available
        sprint_query = db.query(Sprint).filter(Sprint.status == "active", Sprint.deleted_at.is_(None))
        if current_user.tenant_id is not None:
            sprint_query = sprint_query.filter(Sprint.tenant_id == current_user.tenant_id)
        active_sprint = sprint_query.first()
        if active_sprint:
            query = query.filter(Task.sprint_id == active_sprint.id)
    
    tasks = query.order_by(Task.status.asc(), Task.priority.desc()).all()
    return [task_to_response(t) for t in tasks]

@router.get("/{task_id}", response_model=TaskResponse)
def get_task_by_id(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id, Task.deleted_at.is_(None)).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if current_user.tenant_id is not None and task.tenant_id is not None and current_user.tenant_id != task.tenant_id:
        raise HTTPException(status_code=403, detail="Forbidden: Task belongs to a different organization")
    
    if task.assignee_id:
        enforce_hierarchy_access(current_user, task.assignee_id, db)

    return task_to_response(task)

@router.post("", response_model=TaskResponse)
def create_task(
    req: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a task and assign it.
    Prevents IDOR by validating that assignee_id is within caller's authorized hierarchy.
    """
    from backend.app.audit import log_audit_event

    assignee_id = req.assignee_id or current_user.id
    enforce_hierarchy_access(current_user, assignee_id, db)

    assignee = db.query(User).filter(User.id == assignee_id, User.deleted_at.is_(None)).first()
    if not assignee:
        raise HTTPException(status_code=404, detail="Assignee not found")
    if current_user.tenant_id is not None and assignee.tenant_id is not None and current_user.tenant_id != assignee.tenant_id:
        raise HTTPException(status_code=403, detail="Forbidden: Cannot assign task to a user from a different organization")
    assignee_name = assignee.full_name

    sprint_id = req.sprint_id
    if sprint_id:
        sprint = db.query(Sprint).filter(Sprint.id == sprint_id, Sprint.deleted_at.is_(None)).first()
        if not sprint:
            raise HTTPException(status_code=404, detail="Sprint not found")
        if current_user.tenant_id is not None and sprint.tenant_id is not None and current_user.tenant_id != sprint.tenant_id:
            raise HTTPException(status_code=403, detail="Forbidden: Sprint belongs to a different organization")
    else:
        sprint_query = db.query(Sprint).filter(Sprint.status == "active", Sprint.deleted_at.is_(None))
        if current_user.tenant_id is not None:
            sprint_query = sprint_query.filter(Sprint.tenant_id == current_user.tenant_id)
        active_sprint = sprint_query.first()
        if active_sprint:
            sprint_id = active_sprint.id

    new_task = Task(
        tenant_id=current_user.tenant_id,
        title=req.title,
        description=req.description or "",
        assignee_id=assignee_id,
        assignee_name=assignee_name,
        creator_id=current_user.id,
        priority=req.priority,
        difficulty=req.difficulty,
        status=req.status,
        progress_pct=req.progress_pct,
        sprint_id=sprint_id,
        carried_over_count=0,
        version=1
    )
    if req.status == "Done":
        new_task.completed_at = datetime.utcnow()
        new_task.progress_pct = 100

    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    log_audit_event(
        db,
        action="CREATE_TASK",
        entity_type="task",
        entity_id=new_task.id,
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        tenant_id=current_user.tenant_id,
        new_values={
            "title": new_task.title,
            "priority": new_task.priority,
            "difficulty": new_task.difficulty,
            "assignee_id": new_task.assignee_id,
            "status": new_task.status,
            "tenant_id": new_task.tenant_id
        }
    )
    db.commit()

    return task_to_response(new_task)

@router.put("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    req: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from backend.app.audit import log_audit_event

    task = db.query(Task).filter(Task.id == task_id, Task.deleted_at.is_(None)).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if current_user.tenant_id is not None and task.tenant_id is not None and current_user.tenant_id != task.tenant_id:
        raise HTTPException(status_code=403, detail="Forbidden: Task belongs to a different organization")

    if task.assignee_id:
        enforce_hierarchy_access(current_user, task.assignee_id, db)

    # Optimistic concurrency check
    current_version = task.version or 1
    if req.version is not None and req.version != current_version:
        raise HTTPException(
            status_code=409,
            detail=f"Conflict: Task has been modified by another user (server v{current_version}, client v{req.version}). Please reload."
        )

    old_values = {
        "title": task.title,
        "description": task.description,
        "assignee_id": task.assignee_id,
        "priority": task.priority,
        "difficulty": task.difficulty,
        "status": task.status,
        "progress_pct": task.progress_pct,
        "version": current_version
    }

    if req.assignee_id is not None:
        enforce_hierarchy_access(current_user, req.assignee_id, db)
        assignee = db.query(User).filter(User.id == req.assignee_id, User.deleted_at.is_(None)).first()
        if not assignee:
            raise HTTPException(status_code=404, detail="Assignee not found")
        if current_user.tenant_id is not None and assignee.tenant_id is not None and current_user.tenant_id != assignee.tenant_id:
            raise HTTPException(status_code=403, detail="Forbidden: Cannot reassign task to a user in another organization")
        task.assignee_id = req.assignee_id
        task.assignee_name = assignee.full_name

    if req.title is not None: task.title = req.title
    if req.description is not None: task.description = req.description
    if req.priority is not None: task.priority = req.priority
    if req.difficulty is not None: task.difficulty = req.difficulty
    if req.sprint_id is not None:
        sprint = db.query(Sprint).filter(Sprint.id == req.sprint_id, Sprint.deleted_at.is_(None)).first()
        if not sprint:
            raise HTTPException(status_code=404, detail="Sprint not found")
        if current_user.tenant_id is not None and sprint.tenant_id is not None and current_user.tenant_id != sprint.tenant_id:
            raise HTTPException(status_code=403, detail="Forbidden: Sprint belongs to a different organization")
        task.sprint_id = req.sprint_id
    if req.progress_pct is not None: task.progress_pct = req.progress_pct
    
    if req.status is not None:
        task.status = req.status
        if req.status == "Done" and not task.completed_at:
            task.completed_at = datetime.utcnow()
            task.progress_pct = 100
        elif req.status != "Done":
            task.completed_at = None

    task.version = current_version + 1
    task.updated_at = datetime.utcnow()

    new_values = {
        "title": task.title,
        "description": task.description,
        "assignee_id": task.assignee_id,
        "priority": task.priority,
        "difficulty": task.difficulty,
        "status": task.status,
        "progress_pct": task.progress_pct,
        "version": task.version
    }

    log_audit_event(
        db,
        action="UPDATE_TASK",
        entity_type="task",
        entity_id=task.id,
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        tenant_id=current_user.tenant_id,
        old_values=old_values,
        new_values=new_values
    )

    db.commit()
    db.refresh(task)
    return task_to_response(task)

@router.patch("/{task_id}/status", response_model=TaskResponse)
def update_task_status(
    task_id: int,
    req: TaskStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Quick drag and drop Kanban status update with optimistic locking."""
    from backend.app.audit import log_audit_event

    task = db.query(Task).filter(Task.id == task_id, Task.deleted_at.is_(None)).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if current_user.tenant_id is not None and task.tenant_id is not None and current_user.tenant_id != task.tenant_id:
        raise HTTPException(status_code=403, detail="Forbidden: Task belongs to a different organization")

    if task.assignee_id:
        enforce_hierarchy_access(current_user, task.assignee_id, db)

    current_version = task.version or 1
    if req.version is not None and req.version != current_version:
        raise HTTPException(
            status_code=409,
            detail=f"Conflict: Task has been modified by another user (server v{current_version}, client v{req.version}). Please reload."
        )

    old_status = task.status
    task.status = req.status
    if req.progress_pct is not None:
        task.progress_pct = req.progress_pct

    if req.status == "Done":
        task.completed_at = datetime.utcnow()
        task.progress_pct = 100
    else:
        task.completed_at = None

    task.version = current_version + 1
    task.updated_at = datetime.utcnow()

    log_audit_event(
        db,
        action="UPDATE_TASK_STATUS",
        entity_type="task",
        entity_id=task.id,
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        tenant_id=current_user.tenant_id,
        old_values={"status": old_status, "version": current_version},
        new_values={"status": task.status, "progress_pct": task.progress_pct, "version": task.version}
    )

    db.commit()
    db.refresh(task)
    return task_to_response(task)

@router.delete("/{task_id}")
def delete_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from backend.app.audit import log_audit_event

    task = db.query(Task).filter(Task.id == task_id, Task.deleted_at.is_(None)).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if current_user.tenant_id is not None and task.tenant_id is not None and current_user.tenant_id != task.tenant_id:
        raise HTTPException(status_code=403, detail="Forbidden: Task belongs to a different organization")

    if task.assignee_id:
        enforce_hierarchy_access(current_user, task.assignee_id, db)

    task.deleted_at = datetime.utcnow()
    task.version = (task.version or 1) + 1
    task.updated_at = datetime.utcnow()

    log_audit_event(
        db,
        action="DELETE_TASK",
        entity_type="task",
        entity_id=task.id,
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        tenant_id=current_user.tenant_id,
        old_values={"deleted_at": None},
        new_values={"deleted_at": task.deleted_at.isoformat()}
    )

    db.commit()
    return {"status": "success", "message": f"Task #{task_id} deleted (soft delete)"}

@router.post("/{task_id}/restore", response_model=TaskResponse)
def restore_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from backend.app.audit import log_audit_event

    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if current_user.tenant_id is not None and task.tenant_id is not None and current_user.tenant_id != task.tenant_id:
        raise HTTPException(status_code=403, detail="Forbidden: Task belongs to a different organization")

    if task.assignee_id:
        enforce_hierarchy_access(current_user, task.assignee_id, db)

    task.deleted_at = None
    task.version = (task.version or 1) + 1
    task.updated_at = datetime.utcnow()

    log_audit_event(
        db,
        action="RESTORE_TASK",
        entity_type="task",
        entity_id=task.id,
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        tenant_id=current_user.tenant_id,
        new_values={"deleted_at": None, "version": task.version}
    )

    db.commit()
    db.refresh(task)
    return task_to_response(task)

