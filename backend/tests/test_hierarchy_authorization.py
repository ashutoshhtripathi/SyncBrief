import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.seed import seed_database
from backend.app.database import SessionLocal
from backend.app.models import User, Task, Checkin, Sprint, Channel, Blocker, AuditLog

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
# 1. EMPLOYEE -> ANOTHER EMPLOYEE'S DATA = 403 FORBIDDEN
# =========================================================================

def test_employee_cannot_access_peer_checkins():
    """Elena and Priya are peers under Vikram. Elena accessing Priya's check-ins must return 403."""
    db = SessionLocal()
    try:
        priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
        assert priya is not None
        priya_id = priya.id
    finally:
        db.close()

    headers = get_headers("elena.rostova@syncbrief.ai")
    resp = client.get(f"/api/checkins?user_id={priya_id}", headers=headers)
    assert resp.status_code == 403
    assert "Forbidden" in resp.json()["detail"]

def test_employee_cannot_access_peer_tasks():
    """Elena accessing Priya's tasks by assignee_id or task_id must return 403."""
    db = SessionLocal()
    try:
        priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
        priya_task = db.query(Task).filter(Task.assignee_id == priya.id).first()
        assert priya and priya_task
        priya_id = priya.id
        task_id = priya_task.id
    finally:
        db.close()

    headers = get_headers("elena.rostova@syncbrief.ai")

    # By assignee_id query param
    resp_filter = client.get(f"/api/tasks?assignee_id={priya_id}", headers=headers)
    assert resp_filter.status_code == 403

    # By direct task_id URL
    resp_direct = client.get(f"/api/tasks/{task_id}", headers=headers)
    assert resp_direct.status_code == 403

def test_employee_cannot_access_peer_points():
    """Elena accessing Priya's points or recompute must return 403."""
    db = SessionLocal()
    try:
        priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
        priya_id = priya.id
    finally:
        db.close()

    headers = get_headers("elena.rostova@syncbrief.ai")

    resp_points = client.get(f"/api/points/user/{priya_id}", headers=headers)
    assert resp_points.status_code == 403
    assert "Forbidden" in resp_points.json()["detail"]

    resp_recompute = client.get(f"/api/points/recompute/{priya_id}", headers=headers)
    assert resp_recompute.status_code == 403

def test_employee_cannot_access_appraisal():
    """Employees without reports cannot access manager appraisal dashboard."""
    headers = get_headers("priya.sharma@syncbrief.ai")
    resp = client.get("/api/points/appraisal", headers=headers)
    assert resp.status_code == 403
    assert "Forbidden" in resp.json()["detail"]

def test_employee_cannot_modify_peer_blocker():
    """Elena cannot update status of Priya's blocker."""
    db = SessionLocal()
    try:
        priya_blocker = db.query(Blocker).filter(Blocker.owner_name == "Priya Sharma").first()
        assert priya_blocker is not None
        blocker_id = priya_blocker.id
    finally:
        db.close()

    headers = get_headers("elena.rostova@syncbrief.ai")
    resp = client.patch(f"/api/blockers/{blocker_id}/status", json={"status": "resolved"}, headers=headers)
    assert resp.status_code == 403

# =========================================================================
# 2. EMPLOYEE -> OWN DATA = ALLOWED
# =========================================================================

def test_employee_can_access_own_checkins():
    """Priya can access her own check-ins explicitly and via default scoped list."""
    db = SessionLocal()
    try:
        priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
        priya_id = priya.id
    finally:
        db.close()

    headers = get_headers("priya.sharma@syncbrief.ai")

    # Explicit user_id
    resp_explicit = client.get(f"/api/checkins?user_id={priya_id}", headers=headers)
    assert resp_explicit.status_code == 200
    checkins = resp_explicit.json()
    assert len(checkins) > 0
    assert all(c["user_id"] == priya_id for c in checkins)

    # Default list without user_id only returns employee's own check-ins
    resp_default = client.get("/api/checkins", headers=headers)
    assert resp_default.status_code == 200
    default_checkins = resp_default.json()
    assert len(default_checkins) > 0
    assert all(c["user_id"] == priya_id for c in default_checkins)

def test_employee_can_access_own_tasks():
    """Priya can access her own assigned tasks via /tasks/my-tasks and /tasks."""
    db = SessionLocal()
    try:
        priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
        priya_id = priya.id
    finally:
        db.close()

    headers = get_headers("priya.sharma@syncbrief.ai")

    resp_my = client.get("/api/tasks/my-tasks", headers=headers)
    assert resp_my.status_code == 200
    tasks = resp_my.json()
    assert len(tasks) > 0
    assert all(t["assignee_id"] == priya_id for t in tasks)

    resp_filtered = client.get(f"/api/tasks?assignee_id={priya_id}", headers=headers)
    assert resp_filtered.status_code == 200
    filtered_tasks = resp_filtered.json()
    assert len(filtered_tasks) > 0
    assert all(t["assignee_id"] == priya_id for t in filtered_tasks)

def test_employee_can_access_own_points():
    """Priya can access /points/me and /points/user/{her_id}."""
    db = SessionLocal()
    try:
        priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
        priya_id = priya.id
    finally:
        db.close()

    headers = get_headers("priya.sharma@syncbrief.ai")

    resp_me = client.get("/api/points/me", headers=headers)
    assert resp_me.status_code == 200
    assert resp_me.json()["user_id"] == priya_id

    resp_user = client.get(f"/api/points/user/{priya_id}", headers=headers)
    assert resp_user.status_code == 200
    assert resp_user.json()["user_id"] == priya_id

# =========================================================================
# 3. MANAGER -> SUBORDINATE DATA = ALLOWED
# =========================================================================

def test_manager_can_access_subordinate_data():
    """Vikram (Manager) can view Priya's check-ins, tasks, points, and appraisal."""
    db = SessionLocal()
    try:
        priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
        priya_task = db.query(Task).filter(Task.assignee_id == priya.id).first()
        assert priya and priya_task
        priya_id = priya.id
        task_id = priya_task.id
    finally:
        db.close()

    headers = get_headers("vikram.joshi@syncbrief.ai")

    # Checkins of subordinate
    resp_checkin = client.get(f"/api/checkins?user_id={priya_id}", headers=headers)
    assert resp_checkin.status_code == 200

    # Tasks of subordinate
    resp_tasks = client.get(f"/api/tasks?assignee_id={priya_id}", headers=headers)
    assert resp_tasks.status_code == 200

    resp_task_direct = client.get(f"/api/tasks/{task_id}", headers=headers)
    assert resp_task_direct.status_code == 200

    # Points of subordinate
    resp_points = client.get(f"/api/points/user/{priya_id}", headers=headers)
    assert resp_points.status_code == 200

    # Appraisal including subordinate
    resp_appraisal = client.get("/api/points/appraisal", headers=headers)
    assert resp_appraisal.status_code == 200
    emp_ids = [e["user_id"] for e in resp_appraisal.json()["employees"]]
    assert priya_id in emp_ids

# =========================================================================
# 4. MANAGER -> UNRELATED EMPLOYEE = 403 FORBIDDEN
# =========================================================================

def test_manager_cannot_access_unrelated_employee():
    """
    Vikram manages Priya, Elena, Rohan.
    James manages Alex, Maya.
    Vikram attempting to access Alex Rivera must return 403 Forbidden.
    """
    db = SessionLocal()
    try:
        alex = db.query(User).filter(User.email == "alex.rivera@syncbrief.ai").first()
        alex_task = db.query(Task).filter(Task.assignee_id == alex.id).first()
        assert alex and alex_task
        alex_id = alex.id
        task_id = alex_task.id
    finally:
        db.close()

    headers = get_headers("vikram.joshi@syncbrief.ai")

    # Vikram accessing Alex's checkins -> 403
    resp_checkins = client.get(f"/api/checkins?user_id={alex_id}", headers=headers)
    assert resp_checkins.status_code == 403
    assert "Forbidden" in resp_checkins.json()["detail"]

    # Vikram accessing Alex's tasks -> 403
    resp_tasks = client.get(f"/api/tasks?assignee_id={alex_id}", headers=headers)
    assert resp_tasks.status_code == 403

    resp_task_direct = client.get(f"/api/tasks/{task_id}", headers=headers)
    assert resp_task_direct.status_code == 403

    # Vikram accessing Alex's points -> 403
    resp_points = client.get(f"/api/points/user/{alex_id}", headers=headers)
    assert resp_points.status_code == 403

    # IDOR Prevention: Vikram cannot assign task to Alex
    resp_create = client.post(
        "/api/tasks",
        json={"title": "Unauthorized Assignment", "assignee_id": alex_id, "priority": "Medium", "difficulty": 3},
        headers=headers
    )
    assert resp_create.status_code == 403

def test_james_cannot_access_vikrams_subordinate():
    """James (Platform Manager) cannot view Priya Sharma (Backend Employee)."""
    db = SessionLocal()
    try:
        priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
        priya_id = priya.id
    finally:
        db.close()

    headers = get_headers("james.wilson@syncbrief.ai")

    resp = client.get(f"/api/checkins?user_id={priya_id}", headers=headers)
    assert resp.status_code == 403

    resp_points = client.get(f"/api/points/user/{priya_id}", headers=headers)
    assert resp_points.status_code == 403

# =========================================================================
# 5. DIRECTOR -> AUTHORIZED HIERARCHY = ALLOWED
# =========================================================================

def test_director_can_access_entire_reporting_hierarchy():
    """
    Sarah (Director, L1) has reporting hierarchy over Vikram (L2), Priya (L3),
    James (L2), Alex (L3). She can view all of them.
    """
    db = SessionLocal()
    try:
        vikram = db.query(User).filter(User.email == "vikram.joshi@syncbrief.ai").first()
        priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
        alex = db.query(User).filter(User.email == "alex.rivera@syncbrief.ai").first()
        assert vikram and priya and alex
        vikram_id = vikram.id
        priya_id = priya.id
        alex_id = alex.id
    finally:
        db.close()

    headers = get_headers("sarah.jenkins@syncbrief.ai")

    # Sarah accesses manager (Vikram)
    resp_vikram = client.get(f"/api/checkins?user_id={vikram_id}", headers=headers)
    assert resp_vikram.status_code == 200

    # Sarah accesses subordinate in Branch A (Priya under Vikram)
    resp_priya = client.get(f"/api/checkins?user_id={priya_id}", headers=headers)
    assert resp_priya.status_code == 200

    resp_priya_points = client.get(f"/api/points/user/{priya_id}", headers=headers)
    assert resp_priya_points.status_code == 200

    # Sarah accesses subordinate in Branch B (Alex under James)
    resp_alex = client.get(f"/api/checkins?user_id={alex_id}", headers=headers)
    assert resp_alex.status_code == 200

    resp_alex_points = client.get(f"/api/points/user/{alex_id}", headers=headers)
    assert resp_alex_points.status_code == 200

    # Director team appraisal contains all subordinate employees
    resp_appraisal = client.get("/api/points/appraisal", headers=headers)
    assert resp_appraisal.status_code == 200
    emp_names = [e["full_name"] for e in resp_appraisal.json()["employees"]]
    assert "Priya Sharma" in emp_names
    assert "Alex Rivera" in emp_names

# =========================================================================
# 6. TENANT A -> TENANT B = FORBIDDEN (CROSS-TENANT ISOLATION)
# =========================================================================

def test_cross_tenant_access_is_forbidden():
    """
    Tenant 1 = SyncBrief Enterprise (Sarah, Vikram, Priya)
    Tenant 2 = Acme Corporation (Alice)
    Users from Tenant 1 cannot access Tenant 2 resources, and vice versa.
    """
    db = SessionLocal()
    try:
        priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
        alice = db.query(User).filter(User.email == "alice.smith@acme.com").first()
        t1_task = db.query(Task).filter(Task.tenant_id == 1).first()
        t1_sprint = db.query(Sprint).filter(Sprint.tenant_id == 1).first()
        t1_channel = db.query(Channel).filter(Channel.tenant_id == 1).first()

        assert priya and alice and t1_task and t1_sprint and t1_channel
        priya_id = priya.id
        alice_id = alice.id
        task_id = t1_task.id
        sprint_id = t1_sprint.id
        channel_id = t1_channel.id
    finally:
        db.close()

    alice_headers = get_headers("alice.smith@acme.com")
    sarah_headers = get_headers("sarah.jenkins@syncbrief.ai")

    # Alice (Tenant 2) -> Priya's checkins (Tenant 1) => 403 Forbidden
    resp_checkin = client.get(f"/api/checkins?user_id={priya_id}", headers=alice_headers)
    assert resp_checkin.status_code == 403
    assert "organization" in resp_checkin.json()["detail"].lower() or "forbidden" in resp_checkin.json()["detail"].lower()

    # Alice (Tenant 2) -> Priya's points (Tenant 1) => 403 Forbidden
    resp_pts = client.get(f"/api/points/user/{priya_id}", headers=alice_headers)
    assert resp_pts.status_code == 403

    # Alice (Tenant 2) -> Tenant 1 task => 403 Forbidden
    resp_task = client.get(f"/api/tasks/{task_id}", headers=alice_headers)
    assert resp_task.status_code == 403

    # Alice (Tenant 2) -> Tenant 1 sprint => 403 Forbidden
    resp_sprint = client.get(f"/api/sprints/{sprint_id}", headers=alice_headers)
    assert resp_sprint.status_code == 403

    # Alice (Tenant 2) -> Toggle Tenant 1 channel => 403 Forbidden
    resp_chan = client.patch(f"/api/channels/{channel_id}/toggle", json={"is_syncbrief_enabled": False}, headers=alice_headers)
    assert resp_chan.status_code == 403

    # Sarah (Tenant 1) -> Alice's points (Tenant 2) => 403 Forbidden
    resp_sarah_alice = client.get(f"/api/points/user/{alice_id}", headers=sarah_headers)
    assert resp_sarah_alice.status_code == 403

def test_tenant_isolation_on_listing_endpoints():
    """
    When Alice (Tenant 2) lists items, she should NEVER receive Tenant 1 data.
    """
    alice_headers = get_headers("alice.smith@acme.com")

    # Users list: only Tenant 2 users
    resp_users = client.get("/api/auth/users", headers=alice_headers)
    assert resp_users.status_code == 200
    users = resp_users.json()
    assert all(u["tenant_id"] == 2 for u in users)
    assert not any(u["email"] == "sarah.jenkins@syncbrief.ai" for u in users)

    # Checkins list: 0 checkins from Tenant 1
    resp_checkins = client.get("/api/checkins", headers=alice_headers)
    assert resp_checkins.status_code == 200
    checkins = resp_checkins.json()
    assert len(checkins) == 0

    # Sprints list: 0 sprints from Tenant 1
    resp_sprints = client.get("/api/sprints", headers=alice_headers)
    assert resp_sprints.status_code == 200
    sprints = resp_sprints.json()
    assert len(sprints) == 0

# =========================================================================
# 7. PHASE 5: EXHAUSTIVE 401 UNAUTHENTICATED & TOKEN VALIDATION
# =========================================================================

def test_unauthenticated_protected_endpoints_return_401():
    """Verify that all protected API endpoints return 401 when accessed without a valid token."""
    protected_urls = [
        ("GET", "/api/auth/me"),
        ("GET", "/api/auth/tenant"),
        ("GET", "/api/auth/users"),
        ("GET", "/api/checkins"),
        ("POST", "/api/checkins"),
        ("GET", "/api/tasks"),
        ("POST", "/api/tasks"),
        ("GET", "/api/tasks/my-tasks"),
        ("GET", "/api/points/me"),
        ("GET", "/api/points/appraisal"),
        ("GET", "/api/blockers"),
        ("GET", "/api/sprints"),
        ("GET", "/api/channels"),
        ("GET", "/api/insights"),
        ("GET", "/api/audit-logs"),
    ]
    for method, url in protected_urls:
        if method == "GET":
            resp = client.get(url)
        else:
            resp = client.post(url, json={})
        assert resp.status_code == 401, f"Expected 401 for unauthenticated {method} {url}, got {resp.status_code}"
        assert "not authenticated" in resp.json()["detail"].lower() or "authenticated" in resp.json()["detail"].lower()

def test_invalid_and_malformed_tokens_return_401():
    """Verify that malformed or invalid JWT tokens return 401 Unauthorized."""
    bad_headers = [
        {"Authorization": "Bearer not-a-valid-jwt-token"},
        {"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature"},
        {"Authorization": "Basic dXNlcjpwYXNz"},
        {"Authorization": "Token 12345"},
    ]
    for h in bad_headers:
        resp = client.get("/api/auth/me", headers=h)
        assert resp.status_code == 401, f"Expected 401 for header {h}, got {resp.status_code}"

# =========================================================================
# 8. PHASE 5: REFINED HIERARCHY & ROLE BOUNDARIES
# =========================================================================

def test_employee_audit_logs_scoped_to_self():
    """Employees only see audit logs where they were the actor or subject."""
    db = SessionLocal()
    try:
        elena = db.query(User).filter(User.email == "elena.rostova@syncbrief.ai").first()
        priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
        assert elena and priya
        elena_id = elena.id
        priya_id = priya.id
    finally:
        db.close()

    elena_headers = get_headers("elena.rostova@syncbrief.ai")

    # Elena can only see audit logs concerning herself
    resp = client.get("/api/audit-logs", headers=elena_headers)
    assert resp.status_code == 200
    logs = resp.json()
    for log in logs:
        is_self = (log["actor_id"] == elena_id) or (log["entity_type"] == "user" and log["entity_id"] == elena_id)
        assert is_self, f"Employee Elena accessed audit log not belonging to self: {log}"

def test_employee_cannot_delete_peer_task():
    """Elena cannot soft-delete Priya's task."""
    db = SessionLocal()
    try:
        priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
        priya_task = db.query(Task).filter(Task.assignee_id == priya.id).first()
        assert priya and priya_task
        task_id = priya_task.id
    finally:
        db.close()

    elena_headers = get_headers("elena.rostova@syncbrief.ai")
    resp = client.delete(f"/api/tasks/{task_id}", headers=elena_headers)
    assert resp.status_code == 403

def test_manager_cannot_access_director_private_records():
    """Vikram (L2 Manager) cannot access Sarah's (L1 Director) checkins or points."""
    db = SessionLocal()
    try:
        sarah = db.query(User).filter(User.email == "sarah.jenkins@syncbrief.ai").first()
        assert sarah
        sarah_id = sarah.id
    finally:
        db.close()

    vikram_headers = get_headers("vikram.joshi@syncbrief.ai")

    # Manager requesting Director's check-ins -> 403
    resp_checkins = client.get(f"/api/checkins?user_id={sarah_id}", headers=vikram_headers)
    assert resp_checkins.status_code == 403

    # Manager requesting Director's points -> 403
    resp_points = client.get(f"/api/points/user/{sarah_id}", headers=vikram_headers)
    assert resp_points.status_code == 403

# =========================================================================
# 9. PHASE 5: CROSS-TENANT MUTATION & LEAK PREVENTION
# =========================================================================

def test_cross_tenant_task_mutation_forbidden():
    """Alice (Tenant 2) cannot update or delete Tenant 1 tasks."""
    db = SessionLocal()
    try:
        t1_task = db.query(Task).filter(Task.tenant_id == 1).first()
        assert t1_task
        task_id = t1_task.id
        version = t1_task.version
    finally:
        db.close()

    alice_headers = get_headers("alice.smith@acme.com")

    # Alice attempts update on Tenant 1 task -> 403 Forbidden
    resp_update = client.put(
        f"/api/tasks/{task_id}",
        json={"title": "Hacked Title", "version": version},
        headers=alice_headers
    )
    assert resp_update.status_code == 403

    # Alice attempts delete on Tenant 1 task -> 403 Forbidden
    resp_delete = client.delete(f"/api/tasks/{task_id}", headers=alice_headers)
    assert resp_delete.status_code == 403

def test_cross_tenant_audit_and_blockers_isolated():
    """Alice (Tenant 2) listing blockers and audit logs sees zero Tenant 1 items."""
    alice_headers = get_headers("alice.smith@acme.com")

    resp_blockers = client.get("/api/blockers", headers=alice_headers)
    assert resp_blockers.status_code == 200
    assert len(resp_blockers.json()) == 0

    resp_audit = client.get("/api/audit-logs", headers=alice_headers)
    assert resp_audit.status_code == 200
    # Tenant 2 has no audit logs from Tenant 1
    assert len(resp_audit.json()) == 0

# =========================================================================
# 10. PHASE 5: LOGOUT & REFRESH TOKEN REVOCATION LIFECYCLE
# =========================================================================

def test_logout_revokes_refresh_token():
    """Verify that logging out invalidates the stored refresh token."""
    login_resp = client.post("/api/auth/login", json={"email": "rohan.patel@syncbrief.ai", "password": "demo1234"})
    assert login_resp.status_code == 200
    data = login_resp.json()
    access_token = data["access_token"]
    refresh_token = data["refresh_token"]

    # Verify refresh token works initially
    valid_refresh = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert valid_refresh.status_code == 200
    new_refresh_token = valid_refresh.json()["refresh_token"]
    new_access_token = valid_refresh.json()["access_token"]

    # Call logout
    logout_resp = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {new_access_token}"})
    assert logout_resp.status_code == 200
    assert logout_resp.json()["status"] == "success"

    # Attempting to refresh with revoked refresh token must return 401
    revoked_refresh = client.post("/api/auth/refresh", json={"refresh_token": new_refresh_token})
    assert revoked_refresh.status_code == 401
    assert "revoked" in revoked_refresh.json()["detail"].lower() or "invalid" in revoked_refresh.json()["detail"].lower()


# =========================================================================
# 11. HIERARCHY SECURITY AUTHORIZATION SUITE (SCENARIOS A - J)
# =========================================================================

def test_scenario_a_l2_manager_can_modify_own_l3_employee():
    """
    Scenario A: L2 Manager -> own L3 employee
    Expected: ALLOWED (HTTP 200)
    Vikram (L2) can update Priya's profile (L3 reporting to Vikram).
    """
    db = SessionLocal()
    try:
        priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
        assert priya is not None
        priya_id = priya.id
    finally:
        db.close()

    vikram_headers = get_headers("vikram.joshi@syncbrief.ai")
    resp = client.put(
        f"/api/auth/users/{priya_id}",
        json={"title": "Principal Frontend Engineer"},
        headers=vikram_headers
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Principal Frontend Engineer"


def test_scenario_b_l2_manager_cannot_modify_or_delete_director():
    """
    Scenario B: L2 Manager -> own Director/L1
    Expected: HTTP 403 Forbidden
    Vikram (L2) cannot update or delete Sarah Jenkins (Director L1).
    """
    db = SessionLocal()
    try:
        sarah = db.query(User).filter(User.email == "sarah.jenkins@syncbrief.ai").first()
        assert sarah is not None
        sarah_id = sarah.id
    finally:
        db.close()

    vikram_headers = get_headers("vikram.joshi@syncbrief.ai")

    # Attempt to update Director -> 403
    resp_update = client.put(
        f"/api/auth/users/{sarah_id}",
        json={"title": "Demoted Director"},
        headers=vikram_headers
    )
    assert resp_update.status_code == 403
    assert "Director" in resp_update.json()["detail"] or "Forbidden" in resp_update.json()["detail"]

    # Attempt to delete Director -> 403
    resp_delete = client.delete(
        f"/api/auth/users/{sarah_id}",
        headers=vikram_headers
    )
    assert resp_delete.status_code == 403
    assert "Director" in resp_delete.json()["detail"] or "Forbidden" in resp_delete.json()["detail"]


def test_scenario_c_l2_manager_cannot_modify_peer_manager():
    """
    Scenario C: L2 Manager -> another L2 Manager
    Expected: HTTP 403 Forbidden
    Vikram (L2) cannot update or delete James Wilson (L2 peer manager).
    """
    db = SessionLocal()
    try:
        james = db.query(User).filter(User.email == "james.wilson@syncbrief.ai").first()
        assert james is not None
        james_id = james.id
    finally:
        db.close()

    vikram_headers = get_headers("vikram.joshi@syncbrief.ai")

    # Attempt to update peer Manager -> 403
    resp_update = client.put(
        f"/api/auth/users/{james_id}",
        json={"title": "Hacked Manager Title"},
        headers=vikram_headers
    )
    assert resp_update.status_code == 403
    assert "Manager" in resp_update.json()["detail"] or "Forbidden" in resp_update.json()["detail"]

    # Attempt to delete peer Manager -> 403
    resp_delete = client.delete(
        f"/api/auth/users/{james_id}",
        headers=vikram_headers
    )
    assert resp_delete.status_code == 403
    assert "Manager" in resp_delete.json()["detail"] or "Forbidden" in resp_delete.json()["detail"]


def test_scenario_d_l3_employee_cannot_modify_manager():
    """
    Scenario D: L3 Employee -> Manager/L2
    Expected: HTTP 403 Forbidden
    Elena (L3) cannot update or delete Vikram (L2).
    """
    db = SessionLocal()
    try:
        vikram = db.query(User).filter(User.email == "vikram.joshi@syncbrief.ai").first()
        assert vikram is not None
        vikram_id = vikram.id
    finally:
        db.close()

    elena_headers = get_headers("elena.rostova@syncbrief.ai")

    resp_update = client.put(
        f"/api/auth/users/{vikram_id}",
        json={"title": "Modified by Employee"},
        headers=elena_headers
    )
    assert resp_update.status_code == 403

    resp_delete = client.delete(
        f"/api/auth/users/{vikram_id}",
        headers=elena_headers
    )
    assert resp_delete.status_code == 403


def test_scenario_e_l3_employee_cannot_modify_director():
    """
    Scenario E: L3 Employee -> Director/L1
    Expected: HTTP 403 Forbidden
    Elena (L3) cannot update or delete Sarah Jenkins (Director L1).
    """
    db = SessionLocal()
    try:
        sarah = db.query(User).filter(User.email == "sarah.jenkins@syncbrief.ai").first()
        assert sarah is not None
        sarah_id = sarah.id
    finally:
        db.close()

    elena_headers = get_headers("elena.rostova@syncbrief.ai")

    resp_update = client.put(
        f"/api/auth/users/{sarah_id}",
        json={"title": "Modified by Employee"},
        headers=elena_headers
    )
    assert resp_update.status_code == 403

    resp_delete = client.delete(
        f"/api/auth/users/{sarah_id}",
        headers=elena_headers
    )
    assert resp_delete.status_code == 403


def test_scenario_f_l2_manager_cannot_promote_l3_to_l1():
    """
    Scenario F: L2 Manager attempts to promote an L3 user to L1
    Expected: HTTP 403 Forbidden
    Vikram (L2) attempts to set role='director' or role_level=1 on Priya (L3).
    """
    db = SessionLocal()
    try:
        priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
        assert priya is not None
        priya_id = priya.id
    finally:
        db.close()

    vikram_headers = get_headers("vikram.joshi@syncbrief.ai")

    # Attempt promotion by role='director'
    resp_role = client.put(
        f"/api/auth/users/{priya_id}",
        json={"role": "director"},
        headers=vikram_headers
    )
    assert resp_role.status_code == 403
    assert "Forbidden" in resp_role.json()["detail"]

    # Attempt promotion by role_level=1
    resp_level = client.put(
        f"/api/auth/users/{priya_id}",
        json={"role_level": 1},
        headers=vikram_headers
    )
    assert resp_level.status_code == 403
    assert "Forbidden" in resp_level.json()["detail"]

    # Attempt promotion by role_level=2 (manager)
    resp_l2 = client.put(
        f"/api/auth/users/{priya_id}",
        json={"role_level": 2},
        headers=vikram_headers
    )
    assert resp_l2.status_code == 403
    assert "Forbidden" in resp_l2.json()["detail"]


def test_scenario_g_l2_manager_cannot_change_reports_to_unauthorized():
    """
    Scenario G: L2 Manager attempts to change reports_to_id to an unauthorized manager
    Expected: HTTP 403 Forbidden
    Vikram (L2) attempts to reassign Priya (L3) to report to Sarah (L1), James (L2 peer), or None.
    """
    db = SessionLocal()
    try:
        priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
        sarah = db.query(User).filter(User.email == "sarah.jenkins@syncbrief.ai").first()
        james = db.query(User).filter(User.email == "james.wilson@syncbrief.ai").first()
        priya_id = priya.id
        sarah_id = sarah.id
        james_id = james.id
    finally:
        db.close()

    vikram_headers = get_headers("vikram.joshi@syncbrief.ai")

    # Reassigning to Director -> 403
    resp_director = client.put(
        f"/api/auth/users/{priya_id}",
        json={"reports_to_id": sarah_id},
        headers=vikram_headers
    )
    assert resp_director.status_code == 403
    assert "Forbidden" in resp_director.json()["detail"]

    # Reassigning to peer Manager -> 403
    resp_peer = client.put(
        f"/api/auth/users/{priya_id}",
        json={"reports_to_id": james_id},
        headers=vikram_headers
    )
    assert resp_peer.status_code == 403
    assert "Forbidden" in resp_peer.json()["detail"]

    # Reassigning to None (detaching) -> 403
    resp_none = client.put(
        f"/api/auth/users/{priya_id}",
        json={"reports_to_id": None},
        headers=vikram_headers
    )
    assert resp_none.status_code == 403
    assert "Forbidden" in resp_none.json()["detail"]


def test_scenario_h_l2_manager_cannot_create_privileged_user():
    """
    Scenario H: L2 Manager attempts to create an L1/L2 privileged user
    Expected: HTTP 403 Forbidden
    Vikram (L2) attempts to create a user with role='director', role='manager', role_level=1, or role_level=2.
    """
    vikram_headers = get_headers("vikram.joshi@syncbrief.ai")

    # Creating Director (L1) -> 403
    resp_create_l1 = client.post(
        "/api/auth/users",
        json={
            "full_name": "Rogue Director",
            "email": "rogue.director@syncbrief.ai",
            "password": "Password123!",
            "role": "director",
            "role_level": 1,
            "title": "Director of Backdoors"
        },
        headers=vikram_headers
    )
    assert resp_create_l1.status_code == 403
    assert "Forbidden" in resp_create_l1.json()["detail"]

    # Creating Manager (L2) -> 403
    resp_create_l2 = client.post(
        "/api/auth/users",
        json={
            "full_name": "Rogue Manager",
            "email": "rogue.manager@syncbrief.ai",
            "password": "Password123!",
            "role": "manager",
            "role_level": 2,
            "title": "Manager of Backdoors"
        },
        headers=vikram_headers
    )
    assert resp_create_l2.status_code == 403
    assert "Forbidden" in resp_create_l2.json()["detail"]


def test_scenario_i_cross_tenant_user_modification_forbidden():
    """
    Scenario I: Cross-tenant user modification
    Expected: HTTP 403/404 according to existing API behavior
    Vikram/Sarah (Tenant 1) modifying Alice (Tenant 2) -> 403 Forbidden.
    Modifying non-existent user -> 404 Not Found.
    """
    db = SessionLocal()
    try:
        alice = db.query(User).filter(User.email == "alice.smith@acme.com").first()
        assert alice is not None
        alice_id = alice.id
    finally:
        db.close()

    vikram_headers = get_headers("vikram.joshi@syncbrief.ai")
    sarah_headers = get_headers("sarah.jenkins@syncbrief.ai")

    # Vikram (Tenant 1) attempts PUT on Alice (Tenant 2) -> 403
    resp_vikram = client.put(
        f"/api/auth/users/{alice_id}",
        json={"title": "Cross Tenant Exploit"},
        headers=vikram_headers
    )
    assert resp_vikram.status_code == 403
    assert "Forbidden" in resp_vikram.json()["detail"]

    # Sarah (Director Tenant 1) attempts PUT on Alice (Tenant 2) -> 403
    resp_sarah = client.put(
        f"/api/auth/users/{alice_id}",
        json={"title": "Cross Tenant Exploit by Director"},
        headers=sarah_headers
    )
    assert resp_sarah.status_code == 403
    assert "Forbidden" in resp_sarah.json()["detail"]

    # Non-existent user -> 404
    resp_404 = client.put(
        "/api/auth/users/999999",
        json={"title": "Ghost"},
        headers=sarah_headers
    )
    assert resp_404.status_code == 404


def test_scenario_j_director_can_manage_authorized_subordinates():
    """
    Scenario J: L1 Director -> authorized subordinate management
    Expected: ALLOWED (HTTP 200)
    Sarah (L1 Director) can manage subordinate Managers (L2) and Employees (L3).
    """
    db = SessionLocal()
    try:
        vikram = db.query(User).filter(User.email == "vikram.joshi@syncbrief.ai").first()
        rohan = db.query(User).filter(User.email == "rohan.patel@syncbrief.ai").first()
        vikram_id = vikram.id
        rohan_id = rohan.id
    finally:
        db.close()

    sarah_headers = get_headers("sarah.jenkins@syncbrief.ai")

    # Sarah updates Vikram (L2 Manager) -> 200 OK
    resp_vikram = client.put(
        f"/api/auth/users/{vikram_id}",
        json={"title": "VP of Engineering & Architecture"},
        headers=sarah_headers
    )
    assert resp_vikram.status_code == 200
    assert resp_vikram.json()["title"] == "VP of Engineering & Architecture"

    # Sarah updates Rohan (L3 Employee) -> 200 OK
    resp_rohan = client.put(
        f"/api/auth/users/{rohan_id}",
        json={"title": "Lead Backend Architect"},
        headers=sarah_headers
    )
    assert resp_rohan.status_code == 200
    assert resp_rohan.json()["title"] == "Lead Backend Architect"

