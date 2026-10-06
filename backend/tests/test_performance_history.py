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
# PHASE 5: PERFORMANCE HISTORY & INTELLIGENCE TESTS
# =========================================================================

def test_1_employee_can_access_own_performance_history():
    """1. Employee can access own performance history via GET /api/performance/history."""
    headers = get_headers("priya.sharma@syncbrief.ai")
    resp = client.get("/api/performance/history", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "priya.sharma@syncbrief.ai"
    assert data["has_history"] is True
    assert len(data["historical_quarters"]) >= 2
    assert len(data["yearly_summaries"]) >= 1
    assert data["current_cycle"] is not None
    assert "2026" in str(data["current_cycle"]["year"])

def test_2_employee_cannot_access_another_employee_history():
    """2. Employee cannot access another employee's history (403 Forbidden)."""
    priya_headers = get_headers("priya.sharma@syncbrief.ai")
    db = SessionLocal()
    try:
        elena = db.query(User).filter(User.email == "elena.rostova@syncbrief.ai").first()
        elena_id = elena.id
    finally:
        db.close()

    resp = client.get(f"/api/performance/history/user/{elena_id}", headers=priya_headers)
    assert resp.status_code == 403
    assert "Forbidden" in resp.json()["detail"]

def test_3_manager_can_access_subordinate_history():
    """3. Manager (Vikram) can access subordinate (Priya) performance history."""
    vikram_headers = get_headers("vikram.joshi@syncbrief.ai")
    db = SessionLocal()
    try:
        priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
        priya_id = priya.id
    finally:
        db.close()

    resp = client.get(f"/api/performance/history/user/{priya_id}", headers=vikram_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["user_id"] == priya_id
    assert data["full_name"] == "Priya Sharma"
    assert data["has_history"] is True

def test_4_manager_cannot_access_peer_or_superior_history():
    """4. Manager cannot access Director (Sarah) or peer managers outside reporting hierarchy."""
    vikram_headers = get_headers("vikram.joshi@syncbrief.ai")
    db = SessionLocal()
    try:
        sarah = db.query(User).filter(User.email == "sarah.jenkins@syncbrief.ai").first()
        sarah_id = sarah.id
    finally:
        db.close()

    resp = client.get(f"/api/performance/history/user/{sarah_id}", headers=vikram_headers)
    assert resp.status_code == 403
    assert "Forbidden" in resp.json()["detail"]

def test_5_director_can_access_authorized_tenant_users():
    """5. Director (Sarah) can access all authorized tenant users."""
    sarah_headers = get_headers("sarah.jenkins@syncbrief.ai")
    db = SessionLocal()
    try:
        priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
        vikram = db.query(User).filter(User.email == "vikram.joshi@syncbrief.ai").first()
        priya_id = priya.id
        vikram_id = vikram.id
    finally:
        db.close()

    resp_priya = client.get(f"/api/performance/history/user/{priya_id}", headers=sarah_headers)
    assert resp_priya.status_code == 200
    assert resp_priya.json()["user_id"] == priya_id

    resp_vikram = client.get(f"/api/performance/history/user/{vikram_id}", headers=sarah_headers)
    assert resp_vikram.status_code == 200
    assert resp_vikram.json()["user_id"] == vikram_id

def test_6_cross_tenant_history_is_rejected():
    """6. Cross-tenant access is rejected with 403 Forbidden."""
    sarah_headers = get_headers("sarah.jenkins@syncbrief.ai") # Tenant 1 Director
    db = SessionLocal()
    try:
        alice = db.query(User).filter(User.email == "alice.smith@acme.com").first() # Tenant 2
        assert alice is not None
        alice_id = alice.id
    finally:
        db.close()

    resp = client.get(f"/api/performance/history/user/{alice_id}", headers=sarah_headers)
    assert resp.status_code == 403
    assert "different organization" in resp.json()["detail"].lower() or "forbidden" in resp.json()["detail"].lower()

def test_7_historical_quarters_aggregate_correctly():
    """7. Historical quarters aggregate correctly with real PerformanceGoal and PerformanceCycle records."""
    headers = get_headers("priya.sharma@syncbrief.ai")
    resp = client.get("/api/performance/history", headers=headers)
    assert resp.status_code == 200
    quarters = resp.json()["historical_quarters"]
    
    # 2026-Q1 closed cycle verification
    q1 = next((q for q in quarters if q["cycle_name"] == "2026-Q1"), None)
    assert q1 is not None
    assert q1["year"] == 2026
    assert q1["quarter"] == "Q1"
    assert q1["status"] == "closed"
    assert q1["assigned_points"] == 10.0
    assert q1["cycle_earned_points"] == 7.0
    assert q1["lifetime_earned_points"] == 7.0
    assert q1["remaining_points"] == 3.0
    assert q1["completion_rate_pct"] == 70.0
    assert q1["carried_forward_goals_count"] >= 1

def test_8_yearly_aggregation_is_correct():
    """8. Yearly values calculate correctly from real quarterly performance data."""
    headers = get_headers("priya.sharma@syncbrief.ai")
    resp = client.get("/api/performance/history", headers=headers)
    assert resp.status_code == 200
    yearly = resp.json()["yearly_summaries"]
    assert len(yearly) >= 1
    
    yr_2026 = next((y for y in yearly if y["year"] == 2026), None)
    assert yr_2026 is not None
    assert yr_2026["quarters_count"] >= 2
    # Total assigned in 2026 = Q1 assigned (10) + Q2 assigned (18) = 28
    assert yr_2026["assigned_points"] == 28.0
    # Total cycle earned in 2026 = Q1 cycle earned (7) + Q2 cycle earned (4) = 11
    assert yr_2026["earned_points"] == 11.0
    assert yr_2026["completion_rate_pct"] == round((11.0 / 28.0) * 100.0, 1)

def test_9_current_cycle_is_correct():
    """9. Current cycle metrics render active cycle data correctly."""
    headers = get_headers("priya.sharma@syncbrief.ai")
    resp = client.get("/api/performance/history", headers=headers)
    assert resp.status_code == 200
    curr = resp.json()["current_cycle"]
    assert curr is not None
    assert curr["cycle_name"] == "2026-Q2"
    assert curr["status"] == "active"
    assert curr["assigned_points"] == 18.0
    assert curr["previously_earned_points"] == 7.0
    assert curr["earned_points"] == 4.0
    assert curr["lifetime_earned_points"] == 11.0
    assert curr["remaining_points"] == 7.0
    assert curr["active_goals_count"] == 2
    assert curr["carried_goals_count"] == 1

def test_10_carry_forward_points_are_not_double_counted():
    """10. History cleanly distinguishes previously earned points from cycle earned points without double counting."""
    headers = get_headers("priya.sharma@syncbrief.ai")
    resp = client.get("/api/performance/history", headers=headers)
    assert resp.status_code == 200
    curr = resp.json()["current_cycle"]
    # Carried goal retains previously_earned = 7, lifetime = 11, cycle earned = 4
    assert curr["previously_earned_points"] == 7.0
    assert curr["earned_points"] == 4.0
    assert curr["lifetime_earned_points"] == curr["previously_earned_points"] + curr["earned_points"]

def test_11_empty_historical_data_returns_clean_empty_state():
    """11. User with no goals returns clean empty state rather than error or fabricated data."""
    # Alex Rivera is in Tenant 1 but has 0 performance goals seeded
    headers = get_headers("alex.rivera@syncbrief.ai")
    resp = client.get("/api/performance/history", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["full_name"] == "Alex Rivera"
    assert data["has_history"] is False
    assert data["trend"]["summary"] == "No historical performance data available."
    assert data["trend"]["direction"] == "insufficient_data"

def test_12_manager_team_performance_endpoint_enforces_hierarchy():
    """12. Manager can view team performance summary, but employee cannot."""
    vikram_headers = get_headers("vikram.joshi@syncbrief.ai")
    resp = client.get("/api/performance/history/team", headers=vikram_headers)
    assert resp.status_code == 200
    team_data = resp.json()
    assert team_data["manager_name"] == "Vikram Joshi"
    member_names = [m["full_name"] for m in team_data["members"]]
    assert "Priya Sharma" in member_names
    assert "Elena Rostova" in member_names
    # Peer managers or superior director Sarah should not be in Vikram's team members
    assert "Sarah Jenkins" not in member_names

    # Employee attempt should receive 403 Forbidden
    priya_headers = get_headers("priya.sharma@syncbrief.ai")
    resp_forbidden = client.get("/api/performance/history/team", headers=priya_headers)
    assert resp_forbidden.status_code == 403
    assert "Forbidden" in resp_forbidden.json()["detail"]
