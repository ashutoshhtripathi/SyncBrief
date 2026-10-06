import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.seed import seed_database
from backend.app.database import SessionLocal
from backend.app.models import User, Task, Blocker, Sprint, TaskDependency, Tenant
from backend.app.ai.validator import EvidenceValidator

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
# PHASE 7 CROSS-TEAM DEPENDENCY INTELLIGENCE BACKEND TESTS
# =========================================================================

def test_01_dependency_creation_and_detection():
    """1. Explicit task dependency can be created and is subsequently detected."""
    headers = get_headers("vikram.joshi@syncbrief.ai")
    db = SessionLocal()
    priya_task = db.query(Task).filter(Task.assignee_id == 4, Task.deleted_at.is_(None)).first()
    vikram_task = db.query(Task).filter(Task.assignee_id == 2, Task.deleted_at.is_(None)).first()
    db.close()

    assert priya_task is not None
    assert vikram_task is not None

    payload = {
        "task_id": priya_task.id,
        "depends_on_task_id": vikram_task.id,
        "dependency_type": "blocks",
        "notes": "Priya API integration blocked on Vikram DB migration"
    }

    create_resp = client.post("/api/dependencies", json=payload, headers=headers)
    assert create_resp.status_code == 201
    created_data = create_resp.json()
    assert created_data["source_task_id"] == priya_task.id
    assert created_data["dependent_task_id"] == vikram_task.id
    assert created_data["source_type"] == "explicit"

    # Verify detected in list
    list_resp = client.get("/api/dependencies", headers=headers)
    assert list_resp.status_code == 200
    dep_list = list_resp.json()["dependencies"]
    found = [d for d in dep_list if d["dependency_id"] == created_data["dependency_id"]]
    assert len(found) == 1
    assert found[0]["source_task_title"] == priya_task.title

def test_02_explicit_dependency():
    """2. Explicit task dependency includes correct source, target, owner, and teams."""
    headers = get_headers("sarah.jenkins@syncbrief.ai")
    resp = client.get("/api/dependencies", headers=headers)
    assert resp.status_code == 200
    explicit_deps = [d for d in resp.json()["dependencies"] if d["source_type"] == "explicit"]
    assert len(explicit_deps) >= 1
    dep = explicit_deps[0]
    assert dep["source_owner"] != ""
    assert dep["dependency_owner"] != ""
    assert dep["source_team"] != ""
    assert dep["dependency_team"] != ""
    assert "dep-task-" in dep["dependency_id"]

def test_03_blocker_dependency():
    """3. Blocker-based dependencies are deterministically surfaced from existing blockers."""
    headers = get_headers("sarah.jenkins@syncbrief.ai")
    resp = client.get("/api/dependencies", headers=headers)
    assert resp.status_code == 200
    blocker_deps = [d for d in resp.json()["dependencies"] if d["source_type"] == "blocker"]
    assert len(blocker_deps) >= 3

    # Check Priya's hero blocker
    hero_deps = [d for d in blocker_deps if "Priya Sharma" in d["source_owner"]]
    assert len(hero_deps) >= 1
    hero = hero_deps[0]
    assert "PR #184" in hero["summary"] or "database migration" in hero["summary"]
    assert "Backend" in hero["dependency_team"] or "Vikram" in hero["dependency_owner"]

def test_04_cross_team_dependency():
    """4. Dependencies between different teams are flagged as cross-team and filterable."""
    headers = get_headers("sarah.jenkins@syncbrief.ai")
    resp_all = client.get("/api/dependencies", headers=headers)
    all_deps = resp_all.json()["dependencies"]

    cross_team_items = [d for d in all_deps if d["is_cross_team"]]
    assert len(cross_team_items) >= 1

    # Filter with cross_team_only=true
    resp_filtered = client.get("/api/dependencies?cross_team_only=true", headers=headers)
    assert resp_filtered.status_code == 200
    filtered_deps = resp_filtered.json()["dependencies"]
    assert len(filtered_deps) == len(cross_team_items)
    for d in filtered_deps:
        assert d["is_cross_team"] is True
        assert d["source_team"].lower() != d["dependency_team"].lower()

def test_05_aging_dependency():
    """5. Aging dependencies (>= 2 days old) are correctly calculated and filterable."""
    headers = get_headers("sarah.jenkins@syncbrief.ai")
    resp = client.get("/api/dependencies?aging=true", headers=headers)
    assert resp.status_code == 200
    aging_deps = resp.json()["dependencies"]
    for d in aging_deps:
        assert d["is_aging"] is True
        assert d["age_days"] >= 2
        assert d["status"] != "resolved"

def test_06_sprint_impact():
    """6. Dependencies blocking active sprint tasks report sprint impact and risk."""
    headers = get_headers("sarah.jenkins@syncbrief.ai")
    resp = client.get("/api/dependencies", headers=headers)
    assert resp.status_code == 200
    deps = resp.json()["dependencies"]

    sprint_impacted = [d for d in deps if d["affected_sprint_id"] is not None and d["is_sprint_at_risk"]]
    assert len(sprint_impacted) >= 1
    impacted = sprint_impacted[0]
    assert impacted["affected_sprint_name"] is not None
    assert "Sprint" in impacted["affected_sprint_name"]
    assert impacted["is_sprint_at_risk"] is True

def test_07_dependency_summary():
    """7. GET /api/dependencies/summary returns comprehensive KPI counters."""
    headers = get_headers("sarah.jenkins@syncbrief.ai")
    resp = client.get("/api/dependencies/summary", headers=headers)
    assert resp.status_code == 200
    summary = resp.json()
    assert summary["total_dependencies"] >= 3
    assert summary["active_dependencies"] >= 1
    assert summary["high_count"] >= 1
    assert summary["cross_team_count"] >= 1
    assert len(summary["teams_involved"]) >= 2

def test_08_tenant_isolation():
    """8. Cross-tenant dependency queries and creation are strictly blocked."""
    # Authenticate as Acme Corporation user (Tenant 2)
    acme_headers = get_headers("alice.smith@acme.com")
    syncbrief_headers = get_headers("sarah.jenkins@syncbrief.ai")

    # Acme user cannot see SyncBrief dependencies
    acme_resp = client.get("/api/dependencies", headers=acme_headers)
    assert acme_resp.status_code == 200
    acme_deps = acme_resp.json()["dependencies"]
    # Acme should have 0 or only Acme dependencies
    for d in acme_deps:
        assert "SyncBrief" not in d["source_team"]
        assert "Priya Sharma" != d["source_owner"]

    # Attempt cross-tenant dependency creation
    db = SessionLocal()
    tenant1_task = db.query(Task).filter(Task.tenant_id == 1, Task.deleted_at.is_(None)).first()
    db.close()
    assert tenant1_task is not None

    cross_resp = client.post("/api/dependencies", json={
        "task_id": tenant1_task.id,
        "depends_on_task_id": tenant1_task.id,
        "dependency_type": "blocks"
    }, headers=acme_headers)
    # Blocked by either cross-tenant 403 or task not found for tenant
    assert cross_resp.status_code in [400, 403, 404]

def test_09_hierarchy_isolation():
    """9. Employee sees only authorized work, Manager sees subordinates, Director sees tenant."""
    emp_headers = get_headers("priya.sharma@syncbrief.ai")
    mgr_headers = get_headers("vikram.joshi@syncbrief.ai")
    dir_headers = get_headers("sarah.jenkins@syncbrief.ai")

    emp_resp = client.get("/api/dependencies", headers=emp_headers)
    assert emp_resp.status_code == 200
    emp_deps = emp_resp.json()["dependencies"]

    # Employee must only see dependencies involving themselves
    for d in emp_deps:
        is_involved = (
            d["source_owner"] == "Priya Sharma" or
            d["dependency_owner"] == "Priya Sharma"
        )
        assert is_involved, f"Employee saw unauthorized dependency: {d}"

    mgr_resp = client.get("/api/dependencies", headers=mgr_headers)
    assert mgr_resp.status_code == 200
    mgr_deps = mgr_resp.json()["dependencies"]

    dir_resp = client.get("/api/dependencies", headers=dir_headers)
    assert dir_resp.status_code == 200
    dir_deps = dir_resp.json()["dependencies"]

    # Director sees equal or more dependencies than Manager, who sees more than Employee
    assert len(dir_deps) >= len(mgr_deps) >= len(emp_deps)

def test_10_evidence_validation():
    """10. Verified evidence citations are returned with dependencies."""
    headers = get_headers("sarah.jenkins@syncbrief.ai")
    resp = client.get("/api/dependencies", headers=headers)
    assert resp.status_code == 200
    deps = resp.json()["dependencies"]

    for d in deps:
        assert isinstance(d["evidence"], list)
        for ev in d["evidence"]:
            assert ev["source_type"] in ["task", "blocker", "checkin", "sprint", "dependency"]
            assert ev["verified"] is True
            assert ev["rejection_reason"] is None

def test_11_no_fabricated_dependencies():
    """11. Every dependency traces directly to authentic database entities."""
    headers = get_headers("sarah.jenkins@syncbrief.ai")
    resp = client.get("/api/dependencies", headers=headers)
    assert resp.status_code == 200
    deps = resp.json()["dependencies"]

    db = SessionLocal()
    for d in deps:
        if d["source_type"] == "explicit":
            assert d["source_task_id"] is not None
            task = db.query(Task).filter(Task.id == d["source_task_id"]).first()
            assert task is not None
        elif d["source_type"] == "blocker":
            blocker_id = int(d["dependency_id"].replace("dep-blocker-", ""))
            blocker = db.query(Blocker).filter(Blocker.id == blocker_id).first()
            assert blocker is not None
    db.close()

def test_12_unauthenticated_request_returns_401():
    """12. Unauthenticated requests are rejected with HTTP 401."""
    resp = client.get("/api/dependencies")
    assert resp.status_code == 401

    resp_summary = client.get("/api/dependencies/summary")
    assert resp_summary.status_code == 401

    resp_create = client.post("/api/dependencies", json={"task_id": 1, "depends_on_task_id": 2})
    assert resp_create.status_code == 401

def test_13_circular_dependency_rejected():
    """13. Circular dependency (A depends on B and B depends on A) is rejected with 400."""
    headers = get_headers("sarah.jenkins@syncbrief.ai")
    db = SessionLocal()
    tasks = db.query(Task).filter(Task.tenant_id == 1, Task.deleted_at.is_(None)).offset(7).limit(2).all()
    db.close()
    assert len(tasks) == 2

    # Create forward dependency
    resp1 = client.post("/api/dependencies", json={
        "task_id": tasks[0].id,
        "depends_on_task_id": tasks[1].id,
        "dependency_type": "blocks"
    }, headers=headers)
    assert resp1.status_code in [201, 200]

    # Attempt reverse dependency
    resp2 = client.post("/api/dependencies", json={
        "task_id": tasks[1].id,
        "depends_on_task_id": tasks[0].id,
        "dependency_type": "blocks"
    }, headers=headers)
    assert resp2.status_code == 400
    assert "circular" in resp2.json()["detail"].lower()

def test_14_self_dependency_rejected():
    """14. Task depending on itself is rejected with HTTP 400."""
    headers = get_headers("sarah.jenkins@syncbrief.ai")
    resp = client.post("/api/dependencies", json={
        "task_id": 1,
        "depends_on_task_id": 1,
        "dependency_type": "blocks"
    }, headers=headers)
    assert resp.status_code == 400
    assert "itself" in resp.json()["detail"].lower()

def test_15_update_dependency_status():
    """15. Status of dependency can be updated to resolved."""
    headers = get_headers("sarah.jenkins@syncbrief.ai")
    resp = client.get("/api/dependencies?status=active", headers=headers)
    deps = resp.json()["dependencies"]
    assert len(deps) >= 1
    target_dep = deps[0]

    update_resp = client.patch(
        f"/api/dependencies/{target_dep['dependency_id']}/status",
        json={"status": "resolved"},
        headers=headers
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["status"] == "resolved"

def test_16_delete_explicit_dependency():
    """16. Explicit task dependency can be deleted."""
    headers = get_headers("sarah.jenkins@syncbrief.ai")
    db = SessionLocal()
    t3 = db.query(Task).filter(Task.assignee_id == 5, Task.deleted_at.is_(None)).first()
    t4 = db.query(Task).filter(Task.assignee_id == 6, Task.deleted_at.is_(None)).first()
    db.close()

    create_resp = client.post("/api/dependencies", json={
        "task_id": t3.id,
        "depends_on_task_id": t4.id,
        "dependency_type": "blocks",
        "notes": "Temporary dependency to be deleted"
    }, headers=headers)
    assert create_resp.status_code == 201
    dep_id = create_resp.json()["dependency_id"]

    del_resp = client.delete(f"/api/dependencies/{dep_id}", headers=headers)
    assert del_resp.status_code == 200
    assert del_resp.json()["ok"] is True

    # Verify not in list
    list_resp = client.get("/api/dependencies", headers=headers)
    ids = [d["dependency_id"] for d in list_resp.json()["dependencies"]]
    assert dep_id not in ids
