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

def test_demo_login():
    resp = client.post("/api/auth/demo-login", json={"role": "manager"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["user"]["role"] == "manager"

    resp = client.post("/api/auth/demo-login", json={"role": "member"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["user"]["role"] in ["employee", "member"]

    resp = client.post("/api/auth/demo-login", json={"role": "director"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["user"]["role"] in ["director", "admin"]

def test_get_checkins_and_blockers():
    resp = client.get("/api/checkins")
    assert resp.status_code == 200
    checkins = resp.json()
    assert len(checkins) > 0

    resp = client.get("/api/blockers")
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
    resp = client.get("/api/blockers")
    blockers = resp.json()
    target_id = blockers[0]["id"]

    patch_resp = client.patch(f"/api/blockers/{target_id}/status", json={"status": "in_progress"})
    assert patch_resp.status_code == 200
    assert patch_resp.json()["status"] == "in_progress"

def test_azure_devops_work_item_creation():
    resp = client.get("/api/blockers")
    blockers = resp.json()
    target_id = blockers[0]["id"]

    ado_resp = client.post(f"/api/blockers/{target_id}/devops", json={"title": "Test Blocker Task"})
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
