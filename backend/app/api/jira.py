from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
import csv
import io
from typing import List, Optional
from datetime import datetime
from backend.app.database import get_db
from backend.app.models import Task, Sprint, User
from backend.app.schemas import JiraImportRequest, JiraImportResponse, TaskResponse
from backend.app.auth_deps import get_current_user
from backend.app.api.tasks import task_to_response

router = APIRouter(prefix="/jira", tags=["Jira Integration & Comparison"])

@router.post("/import-csv", response_model=JiraImportResponse)
def import_jira_csv(
    req: JiraImportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Parse and import a Jira export CSV into SyncBrief tasks for the active sprint.
    Supports standard Jira CSV column headers:
    'Summary', 'Issue key', 'Status', 'Priority', 'Custom field (Story Points)' / 'Story Points', 'Description'
    """
    sprint_id = req.target_sprint_id
    if not sprint_id:
        active_sprint = db.query(Sprint).filter(Sprint.status == "active").first()
        if active_sprint:
            sprint_id = active_sprint.id

    lines = req.csv_content.strip().splitlines()
    if not lines:
        raise HTTPException(status_code=400, detail="Empty CSV content")

    reader = csv.DictReader(lines)
    imported_tasks = []
    errors = []

    # Map headers in case of slight casing differences
    for row_idx, row in enumerate(reader):
        clean_row = {k.strip().lower(): (v or "").strip() for k, v in row.items() if k}
        
        # Summary / Title
        title = clean_row.get("summary") or clean_row.get("issue summary") or clean_row.get("title")
        if not title:
            errors.append(f"Row {row_idx + 1}: Missing 'Summary' column")
            continue

        # Description
        description = clean_row.get("description") or clean_row.get("issue description") or ""
        issue_key = clean_row.get("issue key") or clean_row.get("key") or ""
        if issue_key:
            description = f"[{issue_key}] {description}"

        # Priority
        raw_pri = clean_row.get("priority", "Medium").capitalize()
        priority = "High" if "high" in raw_pri.lower() or "critical" in raw_pri.lower() else ("Low" if "low" in raw_pri.lower() else "Medium")

        # Story Points / Difficulty (1, 2, 3, 5, 8)
        raw_pts = clean_row.get("custom field (story points)") or clean_row.get("story points") or clean_row.get("points") or "3"
        try:
            pts_val = int(float(raw_pts))
            difficulty = 8 if pts_val >= 8 else (5 if pts_val >= 5 else (3 if pts_val >= 3 else (2 if pts_val == 2 else 1)))
        except Exception:
            difficulty = 3

        # Status
        raw_status = clean_row.get("status", "To do").lower()
        if "done" in raw_status or "closed" in raw_status or "resolved" in raw_status:
            status = "Done"
        elif "progress" in raw_status or "review" in raw_status:
            status = "In progress"
        elif "block" in raw_status:
            status = "Blocked"
        else:
            status = "To do"

        new_task = Task(
            title=title,
            description=description,
            assignee_id=current_user.id,
            assignee_name=current_user.full_name,
            creator_id=current_user.id,
            priority=priority,
            difficulty=difficulty,
            status=status,
            progress_pct=100 if status == "Done" else (50 if status == "In progress" else 0),
            sprint_id=sprint_id,
            carried_over_count=0
        )
        if status == "Done":
            new_task.completed_at = datetime.utcnow()

        db.add(new_task)
        db.flush()
        imported_tasks.append(new_task)

    db.commit()

    return {
        "imported_count": len(imported_tasks),
        "sprint_id": sprint_id,
        "tasks": [task_to_response(t) for t in imported_tasks],
        "errors": errors
    }
