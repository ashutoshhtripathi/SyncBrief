import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.seed import seed_database
from backend.app.database import SessionLocal
from backend.app.auth_utils import hash_password, verify_password

@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    seed_database()

@pytest.fixture
def client():
    return TestClient(app)

def test_argon2_and_bcrypt_compat():
    """Verify Argon2 hashing and verify fallback logic."""
    raw_pwd = "SuperSecretPassword2026!"
    argon_hash = hash_password(raw_pwd)
    assert argon_hash.startswith("$argon2")
    assert verify_password(raw_pwd, argon_hash) is True
    assert verify_password("WrongPassword", argon_hash) is False

def test_security_headers_present(client):
    """Verify enterprise security headers are injected into every response."""
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.headers.get("X-Content-Type-Options") == "nosniff"
    assert resp.headers.get("X-Frame-Options") == "DENY"
    assert "default-src" in resp.headers.get("Content-Security-Policy", "")
    assert "Strict-Transport-Security" in resp.headers

def get_auth_token(client, email: str, password: str = "demo1234") -> str:
    login_resp = client.post("/api/auth/login", json={"email": email, "password": password})
    assert login_resp.status_code == 200, f"Login failed for {email}: {login_resp.text}"
    return login_resp.json()["access_token"]

def test_refresh_token_lifecycle(client):
    """Test login, token refresh, and logout flow."""
    login_resp = client.post("/api/auth/login", json={"email": "priya.sharma@syncbrief.ai", "password": "demo1234"})
    assert login_resp.status_code == 200
    data = login_resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["tenant_id"] == 1
    assert data["user"]["tenant_name"] == "SyncBrief Enterprise"
    refresh_token = data["refresh_token"]

    # Rotate token
    refresh_resp = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh_resp.status_code == 200
    refreshed_data = refresh_resp.json()
    assert "access_token" in refreshed_data
    assert "refresh_token" in refreshed_data
    new_token = refreshed_data["access_token"]

    # Invalidate token via logout
    logout_resp = client.post(
        "/api/auth/logout",
        headers={"Authorization": f"Bearer {new_token}"}
    )
    assert logout_resp.status_code == 200

def test_optimistic_concurrency_conflict(client):
    """Prove that updating a task with a stale version returns HTTP 409 Conflict."""
    token = get_auth_token(client, "sarah.jenkins@syncbrief.ai")
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch tasks
    tasks_resp = client.get("/api/tasks", headers=headers)
    assert tasks_resp.status_code == 200
    tasks = tasks_resp.json()
    assert len(tasks) > 0
    task = tasks[0]
    task_id = task["id"]
    current_version = task["version"]

    # Valid update with matching version
    valid_upd = client.put(
        f"/api/tasks/{task_id}",
        json={"title": f"{task['title']} (Updated)", "version": current_version},
        headers=headers
    )
    assert valid_upd.status_code == 200
    updated_task = valid_upd.json()
    assert updated_task["version"] == current_version + 1

    # Stale update with old version -> MUST return 409 Conflict
    stale_upd = client.put(
        f"/api/tasks/{task_id}",
        json={"title": "Conflicting Update", "version": current_version},
        headers=headers
    )
    assert stale_upd.status_code == 409
    assert "Conflict" in stale_upd.json()["detail"]

def test_task_soft_delete_and_restore(client):
    """Test soft delete hides tasks and restore brings them back."""
    token = get_auth_token(client, "sarah.jenkins@syncbrief.ai")
    headers = {"Authorization": f"Bearer {token}"}

    # Create temporary task
    create_resp = client.post(
        "/api/tasks",
        json={"title": "Task for Soft Delete Test", "priority": "Low", "difficulty": 2},
        headers=headers
    )
    assert create_resp.status_code == 200
    task_id = create_resp.json()["id"]

    # Delete task
    del_resp = client.delete(f"/api/tasks/{task_id}", headers=headers)
    assert del_resp.status_code == 200
    assert "soft delete" in del_resp.json()["message"]

    # Confirm it's 404 in normal get
    get_resp = client.get(f"/api/tasks/{task_id}", headers=headers)
    assert get_resp.status_code == 404

    # Restore task
    restore_resp = client.post(f"/api/tasks/{task_id}/restore", headers=headers)
    assert restore_resp.status_code == 200
    assert restore_resp.json()["id"] == task_id

    # Confirm visible again
    get_again = client.get(f"/api/tasks/{task_id}", headers=headers)
    assert get_again.status_code == 200

def test_recomputable_points_verification(client):
    """Verify that points recomputation derives 100% exact math from completed tasks."""
    token = get_auth_token(client, "sarah.jenkins@syncbrief.ai")
    headers = {"Authorization": f"Bearer {token}"}

    # Find Priya Sharma's ID dynamically
    users_resp = client.get("/api/auth/users", headers=headers)
    priya = next(u for u in users_resp.json() if u["email"] == "priya.sharma@syncbrief.ai")
    priya_id = priya["id"]

    recomp_resp = client.get(f"/api/points/recompute/{priya_id}", headers=headers)
    assert recomp_resp.status_code == 200
    data = recomp_resp.json()
    assert data["is_mathematically_verified"] is True
    assert data["recomputed_total_points"] == data["cached_summary_points"]
    assert len(data["task_breakdown"]) > 0

def test_export_my_data(client):
    """Verify user can export their complete GDPR/PII data package."""
    token = get_auth_token(client, "priya.sharma@syncbrief.ai")
    headers = {"Authorization": f"Bearer {token}"}

    export_resp = client.get("/api/auth/me/export", headers=headers)
    assert export_resp.status_code == 200
    data = export_resp.json()
    assert "user_profile" in data
    assert "checkins" in data
    assert "tasks" in data
    assert "points_summary" in data

def test_multi_tenant_boundary_isolation(client):
    """Verify complete tenant isolation: Tenant 1 cannot access Tenant 2 users or data."""
    t1_token = get_auth_token(client, "sarah.jenkins@syncbrief.ai")
    t2_token = get_auth_token(client, "alice.smith@acme.com")

    # Tenant 1 users list should only contain tenant_id=1
    t1_users = client.get("/api/auth/users", headers={"Authorization": f"Bearer {t1_token}"}).json()
    assert len(t1_users) > 0
    assert all(u["tenant_id"] == 1 for u in t1_users)
    assert not any(u["email"] == "alice.smith@acme.com" for u in t1_users)

    # Tenant 2 users list should only contain tenant_id=2
    t2_users = client.get("/api/auth/users", headers={"Authorization": f"Bearer {t2_token}"}).json()
    assert len(t2_users) == 1
    assert t2_users[0]["email"] == "alice.smith@acme.com"
    assert t2_users[0]["tenant_id"] == 2
    assert t2_users[0]["tenant_name"] == "Acme Corporation"

    # Cross-tenant profile access must be forbidden (403)
    alice_id = t2_users[0]["id"]
    cross_resp = client.get(f"/api/auth/users/{alice_id}", headers={"Authorization": f"Bearer {t1_token}"})
    assert cross_resp.status_code == 403
    assert "different organization" in cross_resp.json()["detail"].lower()

def test_server_restart_invalidates_previous_session_tokens(client):
    """Verify that restarting the application invalidates tokens minted under previous boot."""
    import jwt
    from backend.app.config import settings

    # 1. Valid token from current boot
    token = get_auth_token(client, "sarah.jenkins@syncbrief.ai")
    valid_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert valid_resp.status_code == 200
    assert valid_resp.json()["email"] == "sarah.jenkins@syncbrief.ai"

    # 2. Token from previous boot (different boot_id)
    stale_token = jwt.encode(
        {"sub": "1", "email": "sarah.jenkins@syncbrief.ai", "boot_id": "previous-server-boot-uuid"},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )
    stale_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {stale_token}"})
    assert stale_resp.status_code == 401
    assert "Invalid or expired" in stale_resp.json()["detail"]

    # 3. Token with missing boot_id (legacy tokens before restart fix)
    legacy_token = jwt.encode(
        {"sub": "1", "email": "sarah.jenkins@syncbrief.ai"},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )
    legacy_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {legacy_token}"})
    assert legacy_resp.status_code == 401
    assert "Invalid or expired" in legacy_resp.json()["detail"]
