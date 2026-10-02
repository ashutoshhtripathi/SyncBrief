import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.seed import seed_database

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_seed():
    seed_database()

def test_health_and_status():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"

    resp = client.get("/api/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["app_name"] == "SyncBrief AI"
    assert "ai_provider" in data

def test_demo_login_is_disabled():
    """Verify that demo-login is permanently disabled and returns 403 Forbidden."""
    resp = client.post("/api/auth/demo-login", json={"role": "manager"})
    assert resp.status_code == 403
    assert "disabled" in resp.json()["detail"].lower()

def test_real_authentication_and_tenant():
    """Verify real email/password authentication and tenant isolation."""
    # Invalid password -> 401
    bad_resp = client.post("/api/auth/login", json={"email": "sarah.jenkins@syncbrief.ai", "password": "wrong"})
    assert bad_resp.status_code == 401

    # Valid login -> 200 with tokens and tenant info
    login_resp = client.post("/api/auth/login", json={"email": "sarah.jenkins@syncbrief.ai", "password": "demo1234"})
    assert login_resp.status_code == 200
    data = login_resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["role"] == "director"
    assert data["user"]["tenant_id"] == 1
    assert data["user"]["tenant_name"] == "SyncBrief Enterprise"

    # Protected endpoint requires token
    token = data["access_token"]
    unauth_resp = client.get("/api/auth/users")
    assert unauth_resp.status_code == 401

    auth_resp = client.get("/api/auth/users", headers={"Authorization": f"Bearer {token}"})
    assert auth_resp.status_code == 200
    users = auth_resp.json()
    assert len(users) > 0
    assert all(u["tenant_id"] == 1 for u in users)

def get_auth_headers(email: str = "sarah.jenkins@syncbrief.ai") -> dict:
    login_resp = client.post("/api/auth/login", json={"email": email, "password": "demo1234"})
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_get_checkins_and_blockers():
    headers = get_auth_headers()
    # Unauthenticated should fail with 401
    assert client.get("/api/checkins").status_code == 401

    resp = client.get("/api/checkins", headers=headers)
    assert resp.status_code == 200
    checkins = resp.json()
    assert len(checkins) > 0

    resp = client.get("/api/blockers", headers=headers)
    assert resp.status_code == 200
    blockers = resp.json()
    assert len(blockers) > 0
    # Check for hero blocker
    hero = next((b for b in blockers if "184" in b["summary"]), None)
    assert hero is not None
    assert hero["severity"] == "high"
    assert len(hero["citations"]) > 0
    assert hero["citations"][0]["status"] == "VERIFIED"

def test_update_blocker_status():
    headers = get_auth_headers()
    resp = client.get("/api/blockers", headers=headers)
    blockers = resp.json()
    target_id = blockers[0]["id"]

    patch_resp = client.patch(f"/api/blockers/{target_id}/status", json={"status": "in_progress"}, headers=headers)
    assert patch_resp.status_code == 200
    assert patch_resp.json()["status"] == "in_progress"

def test_azure_devops_work_item_creation():
    headers = get_auth_headers()
    resp = client.get("/api/blockers", headers=headers)
    blockers = resp.json()
    target_id = blockers[0]["id"]

    ado_resp = client.post(f"/api/blockers/{target_id}/devops", json={"title": "Test Blocker Task"}, headers=headers)
    assert ado_resp.status_code == 200
    data = ado_resp.json()
    assert "ADO-" in data["id"]
    assert "request_payload" in data
    assert len(data["request_payload"]) >= 3

def test_run_demo_scenario():
    resp = client.post("/api/demo/run-scenario")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["evidence_message_id"] == "msg_492"
    assert data["channel_name"] == "#backend"
