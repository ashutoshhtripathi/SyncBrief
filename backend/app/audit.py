import json
from datetime import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from backend.app.models import AuditLog

def log_audit_event(
    db: Session,
    action: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    actor_id: Optional[int] = None,
    actor_name: Optional[str] = None,
    old_values: Optional[Dict[str, Any]] = None,
    new_values: Optional[Dict[str, Any]] = None,
    model_used: Optional[str] = None,
    prompt_version: Optional[str] = None,
    input_message_ids: Optional[List[str]] = None,
    input_summary: Optional[str] = None,
    output_summary: Optional[str] = None,
) -> AuditLog:
    """
    Appends an immutable audit log entry.
    All data writes, role changes, and AI evaluations are recorded here.
    """
    entry = AuditLog(
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        actor_id=actor_id,
        actor_name=actor_name,
        old_values_json=json.dumps(old_values, default=str) if old_values is not None else None,
        new_values_json=json.dumps(new_values, default=str) if new_values is not None else None,
        model_used=model_used,
        prompt_version=prompt_version,
        input_message_ids_json=json.dumps(input_message_ids or []),
        input_summary=input_summary or "",
        output_summary=output_summary or "",
        created_at=datetime.utcnow(),
    )
    db.add(entry)
    db.flush()
    return entry
