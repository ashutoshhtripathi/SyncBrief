import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.seed import seed_database
from backend.app.database import SessionLocal
from backend.app.models import User, Sprint, Task
from backend.app.hierarchy import calculate_task_points

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_seed():
    seed_database()

def get_auth_token(email: str, password: str = "demo1234") -> str:
    resp = client.post("/api/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, f"Login failed for {email}: {resp.text}"
    return resp.json()["access_token"]

def test_points_calculation_formula():
    """Verify points formula: difficulty * (1 - 0.25 * carried_over), min 0."""
    # 0 carry-overs -> 100% of difficulty
    assert calculate_task_points(8, 0) == 8.0
    assert calculate_task_points(5, 0) == 5.0
    assert calculate_task_points(3, 0) == 3.0

    # 1 carry-over -> 75% of difficulty
    assert calculate_task_points(8, 1) == 6.0
    assert calculate_task_points(4, 1) == 3.0

    # 2 carry-overs -> 50% of difficulty
    assert calculate_task_points(8, 2) == 4.0
    assert calculate_task_points(5, 2) == 2.5

    # 3 carry-overs -> 25% of difficulty
    assert calculate_task_points(8, 3) == 2.0

    # 4 or more carry-overs -> 0 points (min 0)
    assert calculate_task_points(8, 4) == 0.0
    assert calculate_task_points(8, 5) == 0.0

def test_peer_visibility_forbidden_checkins():
    """Elena and Priya are peers under Vikram. Elena must get 403 when requesting Priya or Vikram's check-ins."""
    db = SessionLocal()
    try:
        elena = db.query(User).filter(User.email == "elena.rostova@syncbrief.ai").first()
        priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
        vikram = db.query(User).filter(User.email == "vikram.joshi@syncbrief.ai").first()
        assert elena and priya and vikram
        elena_id = elena.id
        priya_id = priya.id
        vikram_id = vikram.id
    finally:
        db.close()

    # Elena logs in
    elena_token = get_auth_token("elena.rostova@syncbrief.ai")
    elena_headers = {"Authorization": f"Bearer {elena_token}"}

    # Elena viewing her own checkins -> 200 OK
    resp_own = client.get(f"/api/checkins?user_id={elena_id}", headers=elena_headers)
    assert resp_own.status_code == 200

    # Elena viewing Priya's checkins (peer) -> 403 Forbidden!
    resp_peer = client.get(f"/api/checkins?user_id={priya_id}", headers=elena_headers)
    assert resp_peer.status_code == 403
    assert "Forbidden" in resp_peer.json()["detail"]

    # Elena viewing Vikram's checkins (manager above her) -> 403 Forbidden!
    resp_manager = client.get(f"/api/checkins?user_id={vikram_id}", headers=elena_headers)
    assert resp_manager.status_code == 403
    assert "Forbidden" in resp_manager.json()["detail"]

def test_peer_visibility_forbidden_points():
    """Elena must get 403 when requesting Priya's points or appraisal."""
    db = SessionLocal()
    try:
        priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
        assert priya
        priya_id = priya.id
    finally:
        db.close()

    elena_token = get_auth_token("elena.rostova@syncbrief.ai")
    elena_headers = {"Authorization": f"Bearer {elena_token}"}

    # Elena requests Priya's points
    resp = client.get(f"/api/points/user/{priya_id}", headers=elena_headers)
    assert resp.status_code == 403
    assert "Forbidden" in resp.json()["detail"]

def test_manager_can_access_subordinates():
    """Vikram (Lead) can view Priya and Rohan's check-ins, tasks, and points."""
    db = SessionLocal()
    try:
        priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
        rohan = db.query(User).filter(User.email == "rohan.patel@syncbrief.ai").first()
        assert priya and rohan
        priya_id = priya.id
        rohan_id = rohan.id
    finally:
        db.close()

    vikram_token = get_auth_token("vikram.joshi@syncbrief.ai")
    vikram_headers = {"Authorization": f"Bearer {vikram_token}"}

    # Checkins of subordinate
    resp_checkin = client.get(f"/api/checkins?user_id={priya_id}", headers=vikram_headers)
    assert resp_checkin.status_code == 200

    # Points of subordinate
    resp_points = client.get(f"/api/points/user/{priya_id}", headers=vikram_headers)
    assert resp_points.status_code == 200
    points_data = resp_points.json()
    assert points_data["user_id"] == priya_id
    assert "total_points" in points_data
    assert "formula_text" in points_data

    # Team appraisal for manager
    resp_appraisal = client.get("/api/points/appraisal", headers=vikram_headers)
    assert resp_appraisal.status_code == 200
    appraisal = resp_appraisal.json()
    subordinate_names = [item["full_name"] for item in appraisal["employees"]]
    assert "Priya Sharma" in subordinate_names
    assert "Rohan Patel" in subordinate_names
    assert "Elena Rostova" in subordinate_names

def test_sprint_lifecycle_and_carryover():
    """Test sprint listing, task status updating, and sprint close carryover flow."""
    admin_token = get_auth_token("sarah.jenkins@syncbrief.ai")
    headers = {"Authorization": f"Bearer {admin_token}"}

    # List sprints
    resp_sprints = client.get("/api/sprints", headers=headers)
    assert resp_sprints.status_code == 200
    sprints = resp_sprints.json()
    assert len(sprints) >= 2

    # Find active sprint
    active_sprint = next((s for s in sprints if s["status"] == "active"), None)
    assert active_sprint is not None

    # Get tasks in active sprint
    resp_tasks = client.get(f"/api/tasks?sprint_id={active_sprint['id']}", headers=headers)
    assert resp_tasks.status_code == 200
    tasks = resp_tasks.json()
    assert len(tasks) > 0

    # Pick an incomplete task
    incomplete_task = next((t for t in tasks if t["status"] != "Done"), None)
    assert incomplete_task is not None
    orig_carried = incomplete_task["carried_over_count"]

    # Close active sprint and carry over
    resp_close = client.post(
        f"/api/sprints/{active_sprint['id']}/close",
        json={"create_next_sprint": True, "next_sprint_name": "Sprint 44 (Follow-up)"},
        headers=headers
    )
    assert resp_close.status_code == 200
    close_data = resp_close.json()
    assert close_data["status"] == "success"
    assert "carried_over_task_ids" in close_data
    target_sprint_id = close_data["target_sprint_id"]

    # Verify task was updated to new sprint with carried_over_count + 1
    db = SessionLocal()
    try:
        updated_task = db.query(Task).filter(Task.id == incomplete_task["id"]).first()
        assert updated_task.sprint_id == target_sprint_id
        assert updated_task.carried_over_count == orig_carried + 1
    finally:
        db.close()

def test_admin_user_crud_and_hierarchy():
    """Admin can create a user, assign reports_to, and non-admin is blocked."""
    admin_token = get_auth_token("sarah.jenkins@syncbrief.ai")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Admin creates new user
    new_user_payload = {
        "full_name": "Alex Mercer",
        "email": "alex.mercer@syncbrief.ai",
        "password": "Password123!",
        "role": "member",
        "role_level": 4,
        "title": "Frontend Engineer",
        "org_type": "engineering"
    }
    resp_create = client.post("/api/auth/users", json=new_user_payload, headers=admin_headers)
    assert resp_create.status_code == 200
    created_user = resp_create.json()
    assert created_user["email"] == "alex.mercer@syncbrief.ai"

    # Update user's reports_to to Vikram
    db = SessionLocal()
    try:
        vikram = db.query(User).filter(User.email == "vikram.joshi@syncbrief.ai").first()
        vikram_id = vikram.id
    finally:
        db.close()

    resp_update = client.put(
        f"/api/auth/users/{created_user['id']}",
        json={"reports_to_id": vikram_id, "title": "Senior Frontend Engineer"},
        headers=admin_headers
    )
    assert resp_update.status_code == 200
    assert resp_update.json()["reports_to_id"] == vikram_id
    assert resp_update.json()["title"] == "Senior Frontend Engineer"

    # Non-admin (Elena) trying to create a user -> 403 Forbidden
    elena_token = get_auth_token("elena.rostova@syncbrief.ai")
    elena_headers = {"Authorization": f"Bearer {elena_token}"}
    resp_denied = client.post("/api/auth/users", json=new_user_payload, headers=elena_headers)
    assert resp_denied.status_code == 403

def test_kanban_status_patch():
    """Test drag-and-drop PATCH /api/tasks/{id}/status."""
    token = get_auth_token("vikram.joshi@syncbrief.ai")
    headers = {"Authorization": f"Bearer {token}"}

    db = SessionLocal()
    try:
        task = db.query(Task).first()
        task_id = task.id
    finally:
        db.close()

    resp = client.patch(
        f"/api/tasks/{task_id}/status",
        json={"status": "In progress", "progress_pct": 50},
        headers=headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "In progress"
    assert data["progress_pct"] == 50
