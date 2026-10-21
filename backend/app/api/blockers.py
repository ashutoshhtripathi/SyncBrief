from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
import json
from typing import List, Optional
from datetime import datetime
from backend.app.database import get_db
from backend.app.models import Blocker, AuditLog, User, Checkin
from backend.app.schemas import BlockerResponse, BlockerStatusUpdate, CreateDevOpsWorkItemRequest
from backend.app.integrations.azure_devops import devops_client
from backend.app.ai.validator import CitationValidator
from backend.app.auth_deps import get_current_user
from backend.app.hierarchy import get_accessible_user_ids, enforce_tenant_access

router = APIRouter(prefix="/blockers", tags=["Blockers"])

@router.get("", response_model=List[BlockerResponse])
def get_all_blockers(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve blockers for the Kanban Blocker Board and Digest.
    Enforces tenant isolation and reporting hierarchy access control.
    """
    query = db.query(Blocker)
    if current_user.tenant_id is not None:
        query = query.filter(Blocker.tenant_id == current_user.tenant_id)

    # Scoped access based on hierarchy level
    if current_user.role in ["admin", "director"] or (current_user.role_level is not None and current_user.role_level <= 1):
        pass  # Director sees all blockers in the tenant
    else:
        accessible_ids = get_accessible_user_ids(current_user, db)
        accessible_users = db.query(User.full_name).filter(User.id.in_(accessible_ids)).all()
        accessible_names = {u[0] for u in accessible_users}

        accessible_checkin_ids = db.query(Checkin.id).filter(Checkin.user_id.in_(accessible_ids)).all()
        checkin_id_set = {c[0] for c in accessible_checkin_ids}

        query = query.filter(
            (Blocker.owner_name.in_(accessible_names)) | 
            (Blocker.checkin_id.in_(checkin_id_set))
        )

    if status:
        query = query.filter(Blocker.status == status)
    if severity:
        query = query.filter(Blocker.severity == severity)
    
    blockers = query.order_by(Blocker.created_at.desc()).all()
    return [
        {
            "id": b.id,
            "checkin_id": b.checkin_id,
            "summary": b.summary,
            "severity": b.severity,
            "status": b.status,
            "owner_name": b.owner_name,
            "blocked_by": b.blocked_by,
            "related_work_item": b.related_work_item,
            "confidence": b.confidence,
            "citations": b.citations,
            "devops_work_item_id": b.devops_work_item_id,
            "devops_payload": b.devops_payload,
            "created_at": b.created_at,
            "updated_at": b.updated_at
        }
        for b in blockers
    ]

@router.patch("/{blocker_id}/status")
def update_blocker_status(
    blocker_id: int,
    req: BlockerStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update blocker status (open -> in_progress -> resolved) via Kanban drag and drop."""
    blocker = db.query(Blocker).filter(Blocker.id == blocker_id).first()
    if not blocker:
        raise HTTPException(status_code=404, detail="Blocker not found")

    if current_user.tenant_id is not None and blocker.tenant_id is not None and current_user.tenant_id != blocker.tenant_id:
        raise HTTPException(status_code=403, detail="Forbidden: Blocker belongs to a different organization")

    # Hierarchy access check
    if current_user.role not in ["admin", "director"] and (current_user.role_level is None or current_user.role_level > 1):
        accessible_ids = get_accessible_user_ids(current_user, db)
        accessible_users = db.query(User.full_name).filter(User.id.in_(accessible_ids)).all()
        accessible_names = {u[0] for u in accessible_users}
        if blocker.owner_name not in accessible_names:
            if blocker.checkin_id:
                checkin = db.query(Checkin).filter(Checkin.id == blocker.checkin_id).first()
                if not checkin or checkin.user_id not in accessible_ids:
                    raise HTTPException(status_code=403, detail="Forbidden: Cannot modify blockers outside your reporting hierarchy")
            else:
                raise HTTPException(status_code=403, detail="Forbidden: Cannot modify blockers outside your reporting hierarchy")

    valid_statuses = ["open", "in_progress", "resolved"]
    if req.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {valid_statuses}")

    blocker.status = req.status
    blocker.updated_at = datetime.utcnow()
    db.commit()

    return {
        "id": blocker.id,
        "status": blocker.status,
        "updated_at": blocker.updated_at
    }

@router.post("/{blocker_id}/devops")
async def sync_to_azure_devops(
    blocker_id: int,
    req: CreateDevOpsWorkItemRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Export blocker to Azure DevOps Work Item with Blocked=Yes flag
    and citation evidence payload.
    """
    blocker = db.query(Blocker).filter(Blocker.id == blocker_id).first()
    if not blocker:
        raise HTTPException(status_code=404, detail="Blocker not found")

    if current_user.tenant_id is not None and blocker.tenant_id is not None and current_user.tenant_id != blocker.tenant_id:
        raise HTTPException(status_code=403, detail="Forbidden: Blocker belongs to a different organization")

    if current_user.role not in ["admin", "director"] and (current_user.role_level is None or current_user.role_level > 1):
        accessible_ids = get_accessible_user_ids(current_user, db)
        accessible_users = db.query(User.full_name).filter(User.id.in_(accessible_ids)).all()
        accessible_names = {u[0] for u in accessible_users}
        if blocker.owner_name not in accessible_names:
            raise HTTPException(status_code=403, detail="Forbidden: Cannot export blockers outside your reporting hierarchy")

    title = req.title or blocker.summary
    description = req.description or f"Blocker identified by SyncBrief AI from {blocker.owner_name}. Blocked by: {blocker.blocked_by}."

    devops_res = await devops_client.create_blocked_work_item(
        blocker_id=blocker.id,
        title=title,
        description=description,
        owner=blocker.owner_name,
        citations=blocker.citations,
        area_path=req.area_path,
        iteration_path=req.iteration_path
    )

    blocker.devops_work_item_id = devops_res.get("id")
    blocker.devops_payload = json.dumps(devops_res.get("request_payload"))
    db.commit()

    return devops_res

@router.post("/test-hallucination")
def test_hallucination_detection(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Demo & verification tool: Injects a deliberate hallucinated citation test case
    and runs the strict CitationValidator to demonstrate rejection.
    """
    demo_data = CitationValidator.create_hallucination_demo_blocker()
    
    # Run through validator to prove rejection logic
    validated_citations = CitationValidator.validate_citations(demo_data["citations"], db)
    
    blocker = Blocker(
        tenant_id=current_user.tenant_id,
        summary=demo_data["summary"],
        severity=demo_data["severity"],
        status="open",
        owner_name=current_user.full_name,
        blocked_by=demo_data["blocked_by"],
        related_work_item=demo_data["related_work_item"],
        confidence=demo_data["confidence"],
        citations_json=json.dumps(validated_citations)
    )
    db.add(blocker)
    db.commit()
    db.refresh(blocker)

    return {
        "message": "Deliberate hallucination test executed successfully. Validator flagged and rejected unverified citations.",
        "blocker_id": blocker.id,
        "citations": validated_citations
    }

