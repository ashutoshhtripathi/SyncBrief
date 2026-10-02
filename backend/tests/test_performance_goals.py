import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.seed import seed_database
from backend.app.database import SessionLocal
from backend.app.models import User, PerformanceCycle, PerformanceGoal

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
# 1. PERFORMANCE CYCLES ACCESS & AUTHORIZATION
# =========================================================================

def test_list_performance_cycles():
    """All authenticated tenant members can list their tenant's performance cycles."""
    headers = get_headers("priya.sharma@syncbrief.ai")
    resp = client.get("/api/performance/cycles", headers=headers)
    assert resp.status_code == 200
    cycles = resp.json()
    assert len(cycles) >= 2
    cycle_names = [c["name"] for c in cycles]
    assert "2026-Q1" in cycle_names
    assert "2026-Q2" in cycle_names

def test_create_performance_cycle_role_authorization():
    """Directors and Managers can create cycles; Employees receive 403 Forbidden."""
    elena_headers = get_headers("elena.rostova@syncbrief.ai") # Employee L3
    sarah_headers = get_headers("sarah.jenkins@syncbrief.ai") # Director L1

    now = datetime.utcnow()
    payload = {
        "name": "2026-Q3",
        "start_date": (now + timedelta(days=90)).isoformat(),
        "end_date": (now + timedelta(days=180)).isoformat(),
        "status": "draft",
        "description": "Q3 2026 Planning Cycle"
    }

    # Employee attempt -> 403
    resp_denied = client.post("/api/performance/cycles", json=payload, headers=elena_headers)
    assert resp_denied.status_code == 403
    assert "Forbidden" in resp_denied.json()["detail"]

    # Director attempt -> 200 OK
    resp_created = client.post("/api/performance/cycles", json=payload, headers=sarah_headers)
    assert resp_created.status_code == 200
    assert resp_created.json()["name"] == "2026-Q3"

# =========================================================================
# 2. PERFORMANCE GOALS HIERARCHY AUTHORIZATION
# =========================================================================

def test_manager_can_create_goal_for_own_subordinate():
    """L2 Manager (Vikram) can assign a performance goal to subordinate Employee (Priya)."""
    db = SessionLocal()
    try:
        priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
        cycle = db.query(PerformanceCycle).filter(PerformanceCycle.name == "2026-Q2").first()
        priya_id = priya.id
        cycle_id = cycle.id
    finally:
        db.close()

    vikram_headers = get_headers("vikram.joshi@syncbrief.ai")
    payload = {
        "cycle_id": cycle_id,
        "user_id": priya_id,
        "title": "Zero-Downtime Migration Architecture",
        "description": "Execute database failover tests without dropping active tenant sessions.",
        "assigned_points": 10.0,
        "target_percentage": 100.0
    }

    resp = client.post("/api/performance/goals", json=payload, headers=vikram_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Zero-Downtime Migration Architecture"
    assert data["assigned_points"] == 10.0
    assert data["current_progress_percentage"] == 0.0
    assert data["earned_points"] == 0.0
    assert data["remaining_points"] == 10.0
    assert data["status"] == "in_progress"

def test_manager_cannot_create_goal_for_director_or_peer():
    """L2 Manager cannot assign goals to Director (L1), peer Manager (L2), or Self."""
    db = SessionLocal()
    try:
        sarah = db.query(User).filter(User.email == "sarah.jenkins@syncbrief.ai").first()
        james = db.query(User).filter(User.email == "james.wilson@syncbrief.ai").first()
        vikram = db.query(User).filter(User.email == "vikram.joshi@syncbrief.ai").first()
        cycle = db.query(PerformanceCycle).filter(PerformanceCycle.name == "2026-Q2").first()
        sarah_id = sarah.id
        james_id = james.id
        vikram_id = vikram.id
        cycle_id = cycle.id
    finally:
        db.close()

    vikram_headers = get_headers("vikram.joshi@syncbrief.ai")

    # Vikram -> Sarah (Director) -> 403
    resp_director = client.post("/api/performance/goals", json={
        "cycle_id": cycle_id,
        "user_id": sarah_id,
        "title": "Director Goal from Manager",
        "assigned_points": 5.0
    }, headers=vikram_headers)
    assert resp_director.status_code == 403

    # Vikram -> James (peer Manager) -> 403
    resp_peer = client.post("/api/performance/goals", json={
        "cycle_id": cycle_id,
        "user_id": james_id,
        "title": "Peer Goal",
        "assigned_points": 5.0
    }, headers=vikram_headers)
    assert resp_peer.status_code == 403

    # Vikram -> Vikram (Self-assign) -> 403
    resp_self = client.post("/api/performance/goals", json={
        "cycle_id": cycle_id,
        "user_id": vikram_id,
        "title": "Self Assigned Points",
        "assigned_points": 5.0
    }, headers=vikram_headers)
    assert resp_self.status_code == 403

def test_employee_cannot_create_or_assign_goals():
    """Employee (L3) cannot create performance goals or assign points."""
    db = SessionLocal()
    try:
        elena = db.query(User).filter(User.email == "elena.rostova@syncbrief.ai").first()
        cycle = db.query(PerformanceCycle).filter(PerformanceCycle.name == "2026-Q2").first()
        elena_id = elena.id
        cycle_id = cycle.id
    finally:
        db.close()

    elena_headers = get_headers("elena.rostova@syncbrief.ai")
    resp = client.post("/api/performance/goals", json={
        "cycle_id": cycle_id,
        "user_id": elena_id,
        "title": "Self Goal Creation Attempt",
        "assigned_points": 10.0
    }, headers=elena_headers)
    assert resp.status_code == 403

# =========================================================================
# 3. MATHEMATICAL ACHIEVEMENT & PROGRESS ENGINE
# =========================================================================

def test_employee_can_report_progress_and_points_calculate_accurately():
    """
    Employee reports progress on their goal:
    - 10 assigned points.
    - Employee updates to 70% progress.
    - Earned = 7.0, Remaining = 3.0.
    - Employee cannot directly update assigned_points via PUT.
    """
    db = SessionLocal()
    try:
        priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
        goal = db.query(PerformanceGoal).filter(
            PerformanceGoal.user_id == priya.id,
            PerformanceGoal.title == "Zero-Downtime Migration Architecture"
        ).first()
        assert goal is not None
        goal_id = goal.id
    finally:
        db.close()

    priya_headers = get_headers("priya.sharma@syncbrief.ai")

    # Progress patch: 70%
    resp_progress = client.patch(
        f"/api/performance/goals/{goal_id}/progress",
        json={"current_progress_percentage": 70.0},
        headers=priya_headers
    )
    assert resp_progress.status_code == 200
    data = resp_progress.json()
    assert data["current_progress_percentage"] == 70.0
    assert data["earned_points"] == 7.0
    assert data["remaining_points"] == 3.0
    assert data["status"] == "in_progress"

    # Employee attempt to directly alter assigned_points via PUT -> 403
    resp_put = client.put(
        f"/api/performance/goals/{goal_id}",
        json={"assigned_points": 50.0},
        headers=priya_headers
    )
    assert resp_put.status_code == 403

def test_employee_cannot_update_progress_on_peer_goal():
    """Elena (Employee) cannot update progress on Priya's (peer Employee) goal."""
    db = SessionLocal()
    try:
        priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
        goal = db.query(PerformanceGoal).filter(
            PerformanceGoal.user_id == priya.id,
            PerformanceGoal.title == "Zero-Downtime Migration Architecture"
        ).first()
        goal_id = goal.id
    finally:
        db.close()

    elena_headers = get_headers("elena.rostova@syncbrief.ai")
    resp = client.patch(
        f"/api/performance/goals/{goal_id}/progress",
        json={"current_progress_percentage": 90.0},
        headers=elena_headers
    )
    assert resp.status_code == 403

# =========================================================================
# 4. CARRY-FORWARD & ZERO DUPLICATE POINTS LIFECYCLE
# =========================================================================

def test_carry_forward_preserves_achievement_and_prevents_duplicate_points():
    """
    Exhaustive verification of the carry-forward lifecycle:
    Cycle 1 (Q_TEST1):
      Original Goal: 10 Assigned Points.
      Employee finishes 70% -> Earned = 7.0, Remaining = 3.0.
    Cycle Close:
      Q_TEST1 is closed, target cycle = Q_TEST2.
      Original goal status = 'carried_forward', locked at 7.0 earned.
    Cycle 2 (Q_TEST2):
      Carried Goal created:
        assigned_points = 10.0
        previously_earned_points = 7.0
        current_progress_percentage = 70.0
        earned_points = 0.0 (in Q_TEST2)
        remaining_points = 3.0
    Remaining Work Delivered in Cycle 2:
      Employee advances progress from 70% to 100%:
        additional cycle earned = 3.0
        remaining_points = 0.0
        final lifetime achievement = 7.0 + 3.0 = 10.0!
      NO duplicate points awarded.
    """
    sarah_headers = get_headers("sarah.jenkins@syncbrief.ai")
    vikram_headers = get_headers("vikram.joshi@syncbrief.ai")
    priya_headers = get_headers("priya.sharma@syncbrief.ai")

    now = datetime.utcnow()

    # 1. Create Test Cycle 1 & Cycle 2
    c1 = client.post("/api/performance/cycles", json={
        "name": "TEST-CYCLE-1",
        "start_date": (now - timedelta(days=60)).isoformat(),
        "end_date": (now - timedelta(days=1)).isoformat(),
        "status": "active"
    }, headers=sarah_headers).json()
    c1_id = c1["id"]

    c2 = client.post("/api/performance/cycles", json={
        "name": "TEST-CYCLE-2",
        "start_date": now.isoformat(),
        "end_date": (now + timedelta(days=60)).isoformat(),
        "status": "active"
    }, headers=sarah_headers).json()
    c2_id = c2["id"]

    db = SessionLocal()
    try:
        priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
        priya_id = priya.id
    finally:
        db.close()

    # 2. Assign Goal in Cycle 1: 10 points
    g1 = client.post("/api/performance/goals", json={
        "cycle_id": c1_id,
        "user_id": priya_id,
        "title": "Quantum Resilient Key Exchange",
        "assigned_points": 10.0,
        "target_percentage": 100.0
    }, headers=vikram_headers).json()
    g1_id = g1["id"]

    # 3. Deliver 70% in Cycle 1
    resp_p70 = client.patch(
        f"/api/performance/goals/{g1_id}/progress",
        json={"current_progress_percentage": 70.0},
        headers=priya_headers
    )
    assert resp_p70.status_code == 200
    assert resp_p70.json()["earned_points"] == 7.0
    assert resp_p70.json()["remaining_points"] == 3.0

    # 4. Close Cycle 1 with carry-forward to Cycle 2
    resp_close = client.post(
        f"/api/performance/cycles/{c1_id}/close",
        json={"target_cycle_id": c2_id, "auto_carry_forward": True},
        headers=sarah_headers
    )
    assert resp_close.status_code == 200
    assert resp_close.json()["carried_forward_count"] >= 1

    # 5. Inspect Original Goal in Cycle 1: Locked
    g1_closed = client.get(f"/api/performance/goals/{g1_id}", headers=priya_headers).json()
    assert g1_closed["status"] == "carried_forward"
    assert g1_closed["earned_points"] == 7.0
    assert g1_closed["remaining_points"] == 3.0

    # 6. Locate Carried Goal in Cycle 2
    c2_goals = client.get(f"/api/performance/goals?cycle_id={c2_id}&user_id={priya_id}", headers=priya_headers).json()
    g2_carried = next(g for g in c2_goals if g["carried_from_goal_id"] == g1_id)
    assert g2_carried["assigned_points"] == 10.0
    assert g2_carried["previously_earned_points"] == 7.0
    assert g2_carried["current_progress_percentage"] == 70.0
    assert g2_carried["earned_points"] == 0.0 # 0 new points in Cycle 2 yet
    assert g2_carried["remaining_points"] == 3.0 # Exactly 3 points remain available
    g2_id = g2_carried["id"]

    # 7. Deliver Remaining 30% in Cycle 2 (Total progress = 100%)
    resp_p100 = client.patch(
        f"/api/performance/goals/{g2_id}/progress",
        json={"current_progress_percentage": 100.0},
        headers=priya_headers
    )
    assert resp_p100.status_code == 200
    data_final = resp_p100.json()
    assert data_final["earned_points"] == 3.0 # Only the 3 remaining points were earned in Cycle 2
    assert data_final["remaining_points"] == 0.0
    assert data_final["status"] == "completed"

    # Lifetime achievement across both cycles:
    # Cycle 1 earned = 7.0
    # Cycle 2 earned = 3.0
    # Total = 10.0. Exactly equal to assigned_points. Zero duplicates!

# =========================================================================
# 5. MULTI-TENANT ISOLATION
# =========================================================================

def test_cross_tenant_performance_isolation():
    """Alice (Tenant 2) cannot view, update, or create goals in Tenant 1."""
    alice_headers = get_headers("alice.smith@acme.com") # Tenant 2
    vikram_headers = get_headers("vikram.joshi@syncbrief.ai") # Tenant 1

    db = SessionLocal()
    try:
        t1_goal = db.query(PerformanceGoal).filter(PerformanceGoal.tenant_id == 1).first()
        t1_cycle = db.query(PerformanceCycle).filter(PerformanceCycle.tenant_id == 1).first()
        assert t1_goal and t1_cycle
        goal_id = t1_goal.id
        cycle_id = t1_cycle.id
    finally:
        db.close()

    # Alice views Tenant 1 goal -> 403 Forbidden
    resp_get = client.get(f"/api/performance/goals/{goal_id}", headers=alice_headers)
    assert resp_get.status_code == 403

    # Alice updates progress on Tenant 1 goal -> 403 Forbidden
    resp_patch = client.patch(
        f"/api/performance/goals/{goal_id}/progress",
        json={"current_progress_percentage": 99.0},
        headers=alice_headers
    )
    assert resp_patch.status_code == 403

    # Alice attempts to close Tenant 1 cycle -> 403 Forbidden
    resp_close = client.post(
        f"/api/performance/cycles/{cycle_id}/close",
        json={},
        headers=alice_headers
    )
    assert resp_close.status_code == 403

# =========================================================================
# 6. APPRAISAL PERFORMANCE EVIDENCE AGGREGATION
# =========================================================================

def test_appraisal_performance_evidence_hierarchy_and_note():
    """
    Manager/Director can access appraisal evidence with clear human-review disclaimer.
    Employee cannot access appraisal evidence endpoint.
    """
    elena_headers = get_headers("elena.rostova@syncbrief.ai")
    vikram_headers = get_headers("vikram.joshi@syncbrief.ai")

    # Employee attempt -> 403 Forbidden
    resp_denied = client.get("/api/performance/evidence/appraisal", headers=elena_headers)
    assert resp_denied.status_code == 403

    # Manager attempt -> 200 OK
    resp_mgr = client.get("/api/performance/evidence/appraisal", headers=vikram_headers)
    assert resp_mgr.status_code == 200
    data = resp_mgr.json()
    assert "evidence_note" in data
    assert "human manager review" in data["evidence_note"].lower()
    assert "not automated" in data["evidence_note"].lower()
    assert len(data["employees"]) >= 1
    # Check that Priya is listed with assigned, earned, and completion %
    priya_evidence = next((e for e in data["employees"] if e["full_name"] == "Priya Sharma"), None)
    assert priya_evidence is not None
    assert priya_evidence["total_assigned_points"] > 0
