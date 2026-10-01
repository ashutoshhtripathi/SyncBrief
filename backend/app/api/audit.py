from typing import List, Optional
import json
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime

from backend.app.database import get_db
from backend.app.models import AuditLog, User
from backend.app.auth_deps import get_current_user
from backend.app.hierarchy import get_subordinate_ids

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])

class AuditLogResponse(BaseModel):
    id: int
    actor_id: Optional[int] = None
    actor_name: Optional[str] = None
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    old_values: Optional[dict] = None
    new_values: Optional[dict] = None
    model_used: Optional[str] = None
    prompt_version: Optional[str] = None
    input_message_ids: List[str] = []
    input_summary: Optional[str] = ""
    output_summary: Optional[str] = ""
    created_at: datetime

    class Config:
        from_attributes = True

@router.get("", response_model=List[AuditLogResponse])
def get_audit_logs(
    entity_type: Optional[str] = None,
    action: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns immutable audit logs scoped strictly by organizational reporting hierarchy.
    - Directors see all audit logs.
    - Managers see their scope and their reports.
    - Employees see only audit logs where they were actor or subject.
    """
    query = db.query(AuditLog)

    if current_user.role_level > 1 and current_user.role not in ["director", "admin"]:
        subordinate_ids = get_subordinate_ids(current_user, db)
        allowed_user_ids = {current_user.id, *subordinate_ids}
        query = query.filter(
            (AuditLog.actor_id.in_(allowed_user_ids)) |
            ((AuditLog.entity_type == "user") & (AuditLog.entity_id.in_(allowed_user_ids)))
        )

    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if action:
        query = query.filter(AuditLog.action == action)

    logs = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()

    results = []
    for log in logs:
        old_val = None
        new_val = None
        msg_ids = []
        try:
            if log.old_values_json:
                old_val = json.loads(log.old_values_json)
        except Exception:
            pass
        try:
            if log.new_values_json:
                new_val = json.loads(log.new_values_json)
        except Exception:
            pass
        try:
            if log.input_message_ids_json:
                msg_ids = json.loads(log.input_message_ids_json)
        except Exception:
            pass

        results.append(AuditLogResponse(
            id=log.id,
            actor_id=log.actor_id,
            actor_name=log.actor_name,
            action=log.action,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            old_values=old_val,
            new_values=new_val,
            model_used=log.model_used,
            prompt_version=log.prompt_version,
            input_message_ids=msg_ids,
            input_summary=log.input_summary,
            output_summary=log.output_summary,
            created_at=log.created_at,
        ))

    return results
