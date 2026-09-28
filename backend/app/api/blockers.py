from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import json
from typing import List, Optional
from datetime import datetime
from backend.app.database import get_db
from backend.app.models import Blocker, AuditLog
from backend.app.schemas import BlockerResponse, BlockerStatusUpdate, CreateDevOpsWorkItemRequest
from backend.app.integrations.azure_devops import devops_client
from backend.app.ai.validator import CitationValidator

router = APIRouter(prefix="/blockers", tags=["Blockers"])

@router.get("", response_model=List[BlockerResponse])
def get_all_blockers(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Retrieve all blockers for the Kanban Blocker Board and Digest."""
    query = db.query(Blocker).order_by(Blocker.created_at.desc())
    if status:
        query = query.filter(Blocker.status == status)
    if severity:
        query = query.filter(Blocker.severity == severity)
    
    blockers = query.all()
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
    db: Session = Depends(get_db)
):
    """Update blocker status (open -> in_progress -> resolved) via Kanban drag and drop."""
    blocker = db.query(Blocker).filter(Blocker.id == blocker_id).first()
    if not blocker:
        raise HTTPException(status_code=404, detail="Blocker not found")

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
    db: Session = Depends(get_db)
):
    """
    Export blocker to Azure DevOps Work Item with Blocked=Yes flag
    and citation evidence payload.
    """
    blocker = db.query(Blocker).filter(Blocker.id == blocker_id).first()
    if not blocker:
        raise HTTPException(status_code=404, detail="Blocker not found")

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
def test_hallucination_detection(db: Session = Depends(get_db)):
    """
    Judge & demo tool: Injects a deliberate hallucinated citation test case
    and runs the strict CitationValidator to demonstrate rejection.
    """
    demo_data = CitationValidator.create_hallucination_demo_blocker()
    
    # Run through validator to prove rejection logic
    validated_citations = CitationValidator.validate_citations(demo_data["citations"], db)
    
    blocker = Blocker(
        summary=demo_data["summary"],
        severity=demo_data["severity"],
        status="open",
        owner_name=demo_data["owner"],
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
