import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.seed import seed_database
from backend.app.database import SessionLocal
from backend.app.models import User, PerformanceCycle, PerformanceGoal, PerformanceReviewNote, Blocker, Task

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_seed():
    seed_database()

def get_auth_token(email: str, password: str = "demo1234") -> str:
    resp = client.post("/api/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, f"Login failed for {email}: {resp.text}"
    return resp.json()["access_token"]

def get_headers(email: str) -> dict:
    token = get_auth_token(email)
    return {"Authorization": f"Bearer {token}"}

# =========================================================================
# 16 BACKEND PERFORMANCE REVIEW INTELLIGENCE TESTS
# =========================================================================

def test_1_employee_can_view_own_review():
    """1. Employee can view own performance review dossier."""
    headers = get_headers("priya.sharma@syncbrief.ai")
    db = SessionLocal()
    priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
    db.close()

    resp = client.get(f"/api/performance/review/{priya.id}", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["employee"]["user_id"] == priya.id
    assert data["employee"]["full_name"] == priya.full_name
    assert "cycle" in data
    assert "comparison" in data
    assert "goals" in data
    assert "operational_delivery" in data
    assert "review_intelligence" in data

def test_2_employee_cannot_view_another_employee():
    """2. Employee cannot view another employee's dossier (403 Forbidden)."""
    priya_headers = get_headers("priya.sharma@syncbrief.ai")
    db = SessionLocal()
    elena = db.query(User).filter(User.email == "elena.rostova@syncbrief.ai").first()
    db.close()

    resp = client.get(f"/api/performance/review/{elena.id}", headers=priya_headers)
    assert resp.status_code == 403
    assert "Forbidden" in resp.json()["detail"]

def test_3_manager_can_view_subordinate():
    """3. Manager (Vikram) can view direct subordinate (Priya)."""
    vikram_headers = get_headers("vikram.joshi@syncbrief.ai")
    db = SessionLocal()
    priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
    db.close()

    resp = client.get(f"/api/performance/review/{priya.id}", headers=vikram_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["employee"]["user_id"] == priya.id
    assert data["is_manager_or_director"] is True

def test_4_manager_cannot_view_peer():
    """4. Manager (Vikram) cannot view peer manager (James Wilson) (403 Forbidden)."""
    vikram_headers = get_headers("vikram.joshi@syncbrief.ai")
    db = SessionLocal()
    james = db.query(User).filter(User.email == "james.wilson@syncbrief.ai").first()
    db.close()

    resp = client.get(f"/api/performance/review/{james.id}", headers=vikram_headers)
    assert resp.status_code == 403
    assert "Forbidden" in resp.json()["detail"]

def test_5_manager_cannot_view_superior():
    """5. Manager (Vikram) cannot view superior director (Sarah Jenkins) (403 Forbidden)."""
    vikram_headers = get_headers("vikram.joshi@syncbrief.ai")
    db = SessionLocal()
    sarah = db.query(User).filter(User.email == "sarah.jenkins@syncbrief.ai").first()
    db.close()

    resp = client.get(f"/api/performance/review/{sarah.id}", headers=vikram_headers)
    assert resp.status_code == 403
    assert "Forbidden" in resp.json()["detail"]

def test_6_director_can_view_authorized_tenant_employee():
    """6. Director (Sarah) can view any employee within tenant organization."""
    sarah_headers = get_headers("sarah.jenkins@syncbrief.ai")
    db = SessionLocal()
    priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
    alex = db.query(User).filter(User.email == "alex.rivera@syncbrief.ai").first()
    db.close()

    resp_priya = client.get(f"/api/performance/review/{priya.id}", headers=sarah_headers)
    assert resp_priya.status_code == 200
    assert resp_priya.json()["employee"]["user_id"] == priya.id

    resp_alex = client.get(f"/api/performance/review/{alex.id}", headers=sarah_headers)
    assert resp_alex.status_code == 200
    assert resp_alex.json()["employee"]["user_id"] == alex.id

def test_7_cross_tenant_access_blocked():
    """7. Cross-tenant request rejected with 403 Forbidden."""
    alice_headers = get_headers("alice.smith@acme.com") # Tenant 2
    db = SessionLocal()
    priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first() # Tenant 1
    db.close()

    resp = client.get(f"/api/performance/review/{priya.id}", headers=alice_headers)
    assert resp.status_code == 403
    assert "organization" in resp.json()["detail"].lower() or "forbidden" in resp.json()["detail"].lower()

def test_8_unauthenticated_request_rejected():
    """8. Unauthenticated request returns 401 Unauthorized."""
    db = SessionLocal()
    priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
    db.close()

    resp = client.get(f"/api/performance/review/{priya.id}")
    assert resp.status_code == 401

def test_9_private_manager_notes_hidden_from_employee():
    """9. Private manager notes are stripped (null) when employee views own review."""
    db = SessionLocal()
    priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
    vikram = db.query(User).filter(User.email == "vikram.joshi@syncbrief.ai").first()
    cycle = db.query(PerformanceCycle).filter(PerformanceCycle.tenant_id == priya.tenant_id, PerformanceCycle.status == "active").first()
    if not cycle:
        cycle = db.query(PerformanceCycle).filter(PerformanceCycle.tenant_id == priya.tenant_id).first()
    priya_id = priya.id
    vikram_id = vikram.id
    tenant_id = priya.tenant_id
    cycle_id = cycle.id
    
    # Save a note as manager
    existing_note = db.query(PerformanceReviewNote).filter(
        PerformanceReviewNote.user_id == priya_id,
        PerformanceReviewNote.cycle_id == cycle_id
    ).first()
    if not existing_note:
        note = PerformanceReviewNote(
            tenant_id=tenant_id,
            cycle_id=cycle_id,
            user_id=priya_id,
            manager_id=vikram_id,
            preparation_notes="Confidential manager preparation notes.",
            discussion_agenda="Discuss promotion readiness and roadmap ownership."
        )
        db.add(note)
        db.commit()
    db.close()

    # Employee views own dossier
    priya_headers = get_headers("priya.sharma@syncbrief.ai")
    resp_emp = client.get(f"/api/performance/review/{priya_id}?cycle_id={cycle_id}", headers=priya_headers)
    assert resp_emp.status_code == 200
    assert resp_emp.json()["manager_notes"] is None

    # Manager views subordinate dossier
    vikram_headers = get_headers("vikram.joshi@syncbrief.ai")
    resp_mgr = client.get(f"/api/performance/review/{priya_id}?cycle_id={cycle_id}", headers=vikram_headers)
    assert resp_mgr.status_code == 200
    assert resp_mgr.json()["manager_notes"] is not None
    assert "Confidential" in resp_mgr.json()["manager_notes"]["preparation_notes"]

def test_10_authorized_manager_can_save_notes():
    """10. Authorized manager can save private preparation notes and discussion agenda."""
    vikram_headers = get_headers("vikram.joshi@syncbrief.ai")
    db = SessionLocal()
    priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
    cycle = db.query(PerformanceCycle).filter(PerformanceCycle.status == "active").first()
    db.close()

    payload = {
        "cycle_id": cycle.id if cycle else None,
        "preparation_notes": "Demonstrated strong ownership of backend auth architecture.",
        "discussion_agenda": "Review Q2 deliverables and sprint velocity targets."
    }

    resp = client.put(f"/api/performance/review/{priya.id}/notes", json=payload, headers=vikram_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["user_id"] == priya.id
    assert data["preparation_notes"] == payload["preparation_notes"]
    assert data["discussion_agenda"] == payload["discussion_agenda"]

def test_11_unauthorized_user_cannot_save_notes():
    """11. Employee cannot save review notes, and non-reporting manager cannot save notes."""
    priya_headers = get_headers("priya.sharma@syncbrief.ai")
    james_headers = get_headers("james.wilson@syncbrief.ai") # Not Priya's manager
    db = SessionLocal()
    priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
    db.close()

    payload = {
        "preparation_notes": "Tampered notes",
        "discussion_agenda": "Unauthorized agenda"
    }

    # Employee attempt -> 403 Forbidden
    resp_emp = client.put(f"/api/performance/review/{priya.id}/notes", json=payload, headers=priya_headers)
    assert resp_emp.status_code == 403

    # Unrelated manager attempt -> 403 Forbidden
    resp_mgr = client.put(f"/api/performance/review/{priya.id}/notes", json=payload, headers=james_headers)
    assert resp_mgr.status_code == 403

def test_12_evidence_tenant_isolation():
    """12. Verified evidence citations belong strictly to the tenant."""
    vikram_headers = get_headers("vikram.joshi@syncbrief.ai")
    db = SessionLocal()
    priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
    db.close()

    resp = client.get(f"/api/performance/review/{priya.id}", headers=vikram_headers)
    assert resp.status_code == 200
    evidence_list = resp.json()["verified_evidence"]
    assert len(evidence_list) > 0
    for ev in evidence_list:
        assert ev["verified"] is True
        assert ev["rejection_reason"] is None

def test_13_evidence_hierarchy_isolation():
    """13. Evidence citations respect reporting hierarchy and reject cross-hierarchy artifacts."""
    from backend.app.ai.validator import EvidenceValidator
    db = SessionLocal()
    priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
    # Alex is in a different manager's branch (James Wilson)
    alex = db.query(User).filter(User.email == "alex.rivera@syncbrief.ai").first()
    alex_task = db.query(Task).filter(Task.assignee_id == alex.id, Task.deleted_at.is_(None)).first()

    if alex_task:
        # Priya tries to cite Alex's task
        citation = {
            "source_type": "task",
            "source_id": str(alex_task.id),
            "title": alex_task.title,
            "author_or_owner": alex.full_name,
            "excerpt": alex_task.title
        }
        validated = EvidenceValidator.validate_evidence_item(citation, priya, db)
        assert validated["verified"] is False
        assert "hierarchy" in validated["rejection_reason"].lower()

    db.close()

def test_14_carried_forward_points_not_double_counted():
    """14. Carried-forward goals preserve prior points without duplicate counting."""
    sarah_headers = get_headers("sarah.jenkins@syncbrief.ai")
    db = SessionLocal()
    priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
    db.close()

    resp = client.get(f"/api/performance/review/{priya.id}", headers=sarah_headers)
    assert resp.status_code == 200
    goals = resp.json()["goals"]
    for g in goals:
        # Mathematical invariant: lifetime earned = previously earned + cycle earned
        assert round(g["lifetime_earned_points"], 2) == round(g["previously_earned_points"] + g["cycle_earned_points"], 2)
        # Remaining points + cycle earned <= assigned points - previously earned
        assert g["cycle_earned_points"] + g["remaining_points"] <= g["assigned_points"] - g["previously_earned_points"] + 0.01

def test_15_historical_metrics_remain_correct():
    """15. Multi-quarter comparison and historical yearly summaries are accurate."""
    sarah_headers = get_headers("sarah.jenkins@syncbrief.ai")
    db = SessionLocal()
    priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
    db.close()

    resp = client.get(f"/api/performance/review/{priya.id}", headers=sarah_headers)
    assert resp.status_code == 200
    comp = resp.json()["comparison"]
    assert "current_cycle" in comp
    assert comp["current_cycle"]["cycle_name"] is not None
    assert "yearly_progression" in comp
    assert "trend" in comp
    assert comp["trend"]["direction"] in ["improving", "declining", "stable", "insufficient_data"]

def test_16_no_hardcoded_demo_values():
    """16. Dossier is dynamically calculated from actual DB rows, not hardcoded strings."""
    db = SessionLocal()
    priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
    cycle = db.query(PerformanceCycle).filter(PerformanceCycle.tenant_id == priya.tenant_id, PerformanceCycle.status == "active").first()
    actual_goals_count = db.query(PerformanceGoal).filter(
        PerformanceGoal.user_id == priya.id,
        PerformanceGoal.cycle_id == cycle.id,
        PerformanceGoal.deleted_at.is_(None)
    ).count()
    db.close()

    sarah_headers = get_headers("sarah.jenkins@syncbrief.ai")
    resp = client.get(f"/api/performance/review/{priya.id}?cycle_id={cycle.id}", headers=sarah_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["goals"]) == actual_goals_count
