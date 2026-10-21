import pytest
import asyncio
from datetime import datetime
from backend.app.database import SessionLocal, Base, engine
from backend.app.models import User, Task, Checkin, Blocker, Sprint, Digest, Tenant
from backend.app.ai.validator import EvidenceValidator
from backend.app.ai.mock_provider import MockProvider
from backend.app.schemas import WhatChangedResponse

@pytest.fixture(scope="module")
def db():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    yield session
    session.close()

def test_valid_evidence_citations_across_all_source_types(db):
    """
    Validates that authentic records from all 5 entity types
    (task, checkin, blocker, sprint, digest) are verified as true.
    """
    vikram = db.query(User).filter(User.email == "vikram.joshi@syncbrief.ai").first()
    assert vikram is not None

    priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
    assert priya is not None

    # 1. Valid Task
    task = db.query(Task).filter(Task.assignee_id == priya.id, Task.deleted_at.is_(None)).first()
    assert task is not None
    task_ev = {
        "source_type": "task",
        "source_id": str(task.id),
        "title": task.title,
        "author_or_owner": priya.full_name,
        "excerpt": f"Task '{task.title}' updated with progress",
        "verified": False
    }
    validated_task = EvidenceValidator.validate_evidence_item(task_ev, vikram, db)
    assert validated_task["verified"] is True
    assert validated_task["rejection_reason"] is None

    # 2. Valid Checkin
    checkin = db.query(Checkin).filter(Checkin.user_id == priya.id).first()
    assert checkin is not None
    checkin_ev = {
        "source_type": "checkin",
        "source_id": str(checkin.id),
        "title": f"Checkin #{checkin.id}",
        "author_or_owner": priya.full_name,
        "excerpt": checkin.yesterday[:50] if checkin.yesterday else "Completed sprint task",
        "verified": False
    }
    validated_chk = EvidenceValidator.validate_evidence_item(checkin_ev, vikram, db)
    assert validated_chk["verified"] is True
    assert validated_chk["rejection_reason"] is None

    # 3. Valid Blocker
    blocker = db.query(Blocker).filter(Blocker.owner_name == priya.full_name).first()
    assert blocker is not None
    blocker_ev = {
        "source_type": "blocker",
        "source_id": str(blocker.id),
        "title": f"Blocker #{blocker.id}",
        "author_or_owner": priya.full_name,
        "excerpt": blocker.summary,
        "verified": False
    }
    validated_blk = EvidenceValidator.validate_evidence_item(blocker_ev, vikram, db)
    assert validated_blk["verified"] is True
    assert validated_blk["rejection_reason"] is None

    # 4. Valid Sprint
    sprint = db.query(Sprint).filter(Sprint.deleted_at.is_(None)).first()
    assert sprint is not None
    sprint_ev = {
        "source_type": "sprint",
        "source_id": str(sprint.id),
        "title": sprint.name,
        "author_or_owner": "Sprint Automation",
        "excerpt": f"Sprint points delta for {sprint.name}",
        "verified": False
    }
    validated_spr = EvidenceValidator.validate_evidence_item(sprint_ev, vikram, db)
    assert validated_spr["verified"] is True
    assert validated_spr["rejection_reason"] is None

    # 5. Valid Digest
    digest = db.query(Digest).first()
    if digest:
        digest_ev = {
            "source_type": "digest",
            "source_id": digest.date,
            "title": f"Digest {digest.date}",
            "author_or_owner": "SyncBrief AI",
            "excerpt": f"Digest synthesized for {digest.date}",
            "verified": False
        }
        validated_dig = EvidenceValidator.validate_evidence_item(digest_ev, vikram, db)
        assert validated_dig["verified"] is True
        assert validated_dig["rejection_reason"] is None

def test_invalid_source_id_rejected(db):
    """
    Validates that hallucinated/non-existent IDs across all source types are rejected.
    """
    vikram = db.query(User).filter(User.email == "vikram.joshi@syncbrief.ai").first()

    fake_task = {
        "source_type": "task",
        "source_id": "999999",
        "title": "Hallucinated Task",
        "author_or_owner": "Nobody",
        "excerpt": "This task does not exist",
        "verified": False
    }
    res_task = EvidenceValidator.validate_evidence_item(fake_task, vikram, db)
    assert res_task["verified"] is False
    assert "not found in database" in res_task["rejection_reason"]

    fake_chk = {
        "source_type": "checkin",
        "source_id": "999999",
        "title": "Fake Checkin",
        "author_or_owner": "Nobody",
        "excerpt": "Fake standup update",
        "verified": False
    }
    res_chk = EvidenceValidator.validate_evidence_item(fake_chk, vikram, db)
    assert res_chk["verified"] is False
    assert "not found in database" in res_chk["rejection_reason"]

    fake_blk = {
        "source_type": "blocker",
        "source_id": "999999",
        "title": "Fake Blocker",
        "author_or_owner": "Nobody",
        "excerpt": "Fake blocker item",
        "verified": False
    }
    res_blk = EvidenceValidator.validate_evidence_item(fake_blk, vikram, db)
    assert res_blk["verified"] is False
    assert "not found in database" in res_blk["rejection_reason"]

    fake_spr = {
        "source_type": "sprint",
        "source_id": "999999",
        "title": "Nonexistent Sprint",
        "author_or_owner": "System",
        "excerpt": "Sprint velocity",
        "verified": False
    }
    res_spr = EvidenceValidator.validate_evidence_item(fake_spr, vikram, db)
    assert res_spr["verified"] is False
    assert "not found in database" in res_spr["rejection_reason"]

    fake_dig = {
        "source_type": "digest",
        "source_id": "1999-01-01",
        "title": "Digest 1999",
        "author_or_owner": "System",
        "excerpt": "Old digest",
        "verified": False
    }
    res_dig = EvidenceValidator.validate_evidence_item(fake_dig, vikram, db)
    assert res_dig["verified"] is False
    assert "not found in database" in res_dig["rejection_reason"]

def test_cross_tenant_evidence_rejected(db):
    """
    Validates that evidence belonging to Tenant 1 is rejected when evaluated
    by a user in Tenant 2 (Acme Corporation).
    """
    alice_acme = db.query(User).filter(User.email == "alice.smith@acme.com").first()
    assert alice_acme is not None
    assert alice_acme.tenant_id == 2

    # Query a Tenant 1 task
    priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
    syncbrief_task = db.query(Task).filter(Task.assignee_id == priya.id).first()
    assert syncbrief_task is not None
    assert syncbrief_task.tenant_id == 1

    ev = {
        "source_type": "task",
        "source_id": str(syncbrief_task.id),
        "title": syncbrief_task.title,
        "author_or_owner": priya.full_name,
        "excerpt": syncbrief_task.title,
        "verified": False
    }
    validated = EvidenceValidator.validate_evidence_item(ev, alice_acme, db)
    assert validated["verified"] is False
    assert "Cross-tenant access violation" in validated["rejection_reason"]

def test_out_of_hierarchy_evidence_rejected(db):
    """
    Vikram Joshi (Backend Lead) cannot view Alex Rivera's tasks/check-ins (Platform Team under James Wilson).
    Sarah Jenkins (Director L1) can view both.
    """
    vikram = db.query(User).filter(User.email == "vikram.joshi@syncbrief.ai").first()
    sarah = db.query(User).filter(User.email == "sarah.jenkins@syncbrief.ai").first()
    alex = db.query(User).filter(User.email == "alex.rivera@syncbrief.ai").first()
    assert vikram and sarah and alex

    alex_task = db.query(Task).filter(Task.assignee_id == alex.id).first()
    assert alex_task is not None

    alex_ev = {
        "source_type": "task",
        "source_id": str(alex_task.id),
        "title": alex_task.title,
        "author_or_owner": alex.full_name,
        "excerpt": f"Task '{alex_task.title}' progress",
        "verified": False
    }

    # 1. Vikram (Manager of peer branch) -> Out of hierarchy
    validated_vikram = EvidenceValidator.validate_evidence_item(alex_ev, vikram, db)
    assert validated_vikram["verified"] is False
    assert "Out-of-hierarchy access violation" in validated_vikram["rejection_reason"]

    # 2. Sarah (Director L1) -> Permitted
    validated_sarah = EvidenceValidator.validate_evidence_item(alex_ev, sarah, db)
    assert validated_sarah["verified"] is True
    assert validated_sarah["rejection_reason"] is None

def test_evidence_quote_mismatch_rejected(db):
    """
    Real check-in ID, but the cited quote text is fabricated and does not exist in the check-in.
    """
    vikram = db.query(User).filter(User.email == "vikram.joshi@syncbrief.ai").first()
    priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
    priya_checkin = db.query(Checkin).filter(Checkin.user_id == priya.id).first()
    assert priya_checkin is not None

    fake_excerpt_ev = {
        "source_type": "checkin",
        "source_id": str(priya_checkin.id),
        "title": f"Checkin #{priya_checkin.id}",
        "author_or_owner": priya.full_name,
        "excerpt": "We have decided to shut down all cloud databases permanently and delete production backups.",
        "verified": False
    }
    validated = EvidenceValidator.validate_evidence_item(fake_excerpt_ev, vikram, db)
    assert validated["verified"] is False
    assert "does not match" in validated["rejection_reason"]

def test_mock_provider_analyze_what_changed_output(db):
    """
    Verifies that MockProvider.analyze_what_changed generates a schema-compliant
    WhatChangedResponse using actual database context, with zero hallucinations.
    """
    vikram = db.query(User).filter(User.email == "vikram.joshi@syncbrief.ai").first()
    priya = db.query(User).filter(User.email == "priya.sharma@syncbrief.ai").first()
    priya_task = db.query(Task).filter(Task.assignee_id == priya.id).first()
    priya_checkin = db.query(Checkin).filter(Checkin.user_id == priya.id).first()
    priya_blocker = db.query(Blocker).filter(Blocker.owner_name == priya.full_name).first()
    sprint = db.query(Sprint).filter(Sprint.deleted_at.is_(None)).first()

    delta_context = {
        "target_date": "2026-09-29",
        "previous_working_day": "2026-09-26",
        "window_start": "2026-09-26T00:00:00Z",
        "window_end": "2026-09-29T23:59:59Z",
        "is_weekend_lookback": True,
        "team_scope": {
            "manager_id": vikram.id,
            "manager_name": vikram.full_name,
            "member_count": 4,
            "checked_in_count": 3
        },
        "completed_tasks": [
            {
                "id": priya_task.id,
                "title": priya_task.title,
                "assignee_name": priya.full_name,
                "completed_at": "2026-09-28T16:00:00Z",
                "difficulty": 3,
                "points_earned": 3.0
            }
        ],
        "progressed_tasks": [
            {
                "id": priya_task.id,
                "title": priya_task.title,
                "assignee_name": priya.full_name,
                "progress_delta_pct": 25,
                "current_progress_pct": 75,
                "note": "Cypress test suites ready",
                "pr_link": "https://github.com/ashutoshhtripathi/SyncBrief/pull/184"
            }
        ],
        "sprint_info": {
            "id": sprint.id,
            "name": sprint.name,
            "total_points": 40,
            "completed_points_yesterday": 10,
            "completed_points_today": 15,
            "delta_points": 5
        },
        "checkins": [
            {
                "id": priya_checkin.id,
                "user_id": priya.id,
                "user_name": priya.full_name,
                "yesterday": priya_checkin.yesterday,
                "today": priya_checkin.today,
                "mood": priya_checkin.mood,
                "created_at": "2026-09-29T06:30:00Z"
            }
        ],
        "new_blockers": [
            {
                "id": priya_blocker.id,
                "summary": priya_blocker.summary,
                "severity": priya_blocker.severity,
                "owner_name": priya.full_name,
                "blocked_by": priya_blocker.blocked_by,
                "created_at": "2026-09-29T06:30:00Z"
            }
        ],
        "existing_blockers": [],
        "missing_checkins": ["Rohan Patel"]
    }

    provider = MockProvider()
    result = asyncio.run(provider.analyze_what_changed(delta_context))

    # Verify Pydantic validation passes without schema error
    validated_response = WhatChangedResponse.model_validate(result)
    assert validated_response.target_date == "2026-09-29"
    assert validated_response.previous_working_day == "2026-09-26"
    assert len(validated_response.progress.completed_work) == 1
    assert len(validated_response.progress.meaningful_task_progress) == 1
    assert len(validated_response.blockers.new_blockers) == 1
    assert len(validated_response.risks) >= 1
    assert len(validated_response.needs_manager_attention) >= 1

    # Run the report through EvidenceValidator
    verified_report = EvidenceValidator.validate_delta_report(result, vikram, db)
    for cw in verified_report["progress"]["completed_work"]:
        for ev in cw["evidence"]:
            assert ev["verified"] is True
    for mt in verified_report["progress"]["meaningful_task_progress"]:
        for ev in mt["evidence"]:
            assert ev["verified"] is True
    for nb in verified_report["blockers"]["new_blockers"]:
        for ev in nb["evidence"]:
            assert ev["verified"] is True

def test_mock_provider_empty_insufficient_data():
    """
    Verifies that when no activity occurred in the window, MockProvider
    returns clean, accurate insufficient_data structure without crashing.
    """
    empty_context = {
        "target_date": "2026-09-29",
        "previous_working_day": "2026-09-26",
        "window_start": "2026-09-26T00:00:00Z",
        "window_end": "2026-09-29T23:59:59Z",
        "is_weekend_lookback": True,
        "team_scope": {
            "manager_id": 2,
            "manager_name": "Vikram Joshi",
            "member_count": 4,
            "checked_in_count": 0
        },
        "completed_tasks": [],
        "progressed_tasks": [],
        "sprint_info": None,
        "checkins": [],
        "new_blockers": [],
        "existing_blockers": [],
        "missing_checkins": ["Priya Sharma", "Elena Rostova", "Rohan Patel"]
    }

    provider = MockProvider()
    result = asyncio.run(provider.analyze_what_changed(empty_context))

    validated_response = WhatChangedResponse.model_validate(result)
    assert validated_response.insufficient_data.is_insufficient is True
    assert len(validated_response.insufficient_data.missing_checkins) == 3
    assert len(validated_response.progress.completed_work) == 0
    assert len(validated_response.blockers.new_blockers) == 0
    assert len(validated_response.needs_manager_attention) == 3  # Nudge items for missing checkins

def test_malformed_evidence_resilience(db):
    """
    Verifies that malformed or incomplete evidence items are handled gracefully
    without unhandled exceptions.
    """
    vikram = db.query(User).filter(User.email == "vikram.joshi@syncbrief.ai").first()

    # Missing source_type
    res1 = EvidenceValidator.validate_evidence_item({"source_id": "1"}, vikram, db)
    assert res1["verified"] is False
    assert "Missing source_type" in res1["rejection_reason"]

    # Missing source_id
    res2 = EvidenceValidator.validate_evidence_item({"source_type": "task"}, vikram, db)
    assert res2["verified"] is False
    assert "Missing source_id" in res2["rejection_reason"]

    # Unsupported source_type
    res3 = EvidenceValidator.validate_evidence_item({"source_type": "git_commit", "source_id": "commit_123"}, vikram, db)
    assert res3["verified"] is False
    assert "Unsupported source_type" in res3["rejection_reason"]


# =========================================================================
# PHASE 2: ROUTER, DATA AGGREGATOR, HIERARCHY RBAC & WORKING-DAY TESTS
# =========================================================================

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.api.what_changed import calculate_working_day_window
from backend.app.models import AuditLog

client = TestClient(app)

def get_auth_token(email: str, password: str = "demo1234") -> str:
    resp = client.post("/api/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, f"Login failed for {email}: {resp.text}"
    return resp.json()["access_token"]

def get_headers(email: str) -> dict:
    token = get_auth_token(email)
    return {"Authorization": f"Bearer {token}"}

def test_working_day_window_logic_monday():
    """
    On Monday (e.g. 2026-10-05), the previous working day must be Friday (2026-10-02).
    is_weekend_lookback must be True.
    """
    w_start, w_end, t_date, c_date, is_weekend = calculate_working_day_window("2026-10-05")
    assert t_date == "2026-10-05"
    assert c_date == "2026-10-02"
    assert is_weekend is True
    assert w_start.strftime("%Y-%m-%d") == "2026-10-02"
    assert w_end.strftime("%Y-%m-%d") == "2026-10-05"

def test_working_day_window_logic_normal_weekday():
    """
    On a midweek day (e.g. Wednesday 2026-10-07), the previous working day
    must be Tuesday (2026-10-06). is_weekend_lookback must be False.
    """
    w_start, w_end, t_date, c_date, is_weekend = calculate_working_day_window("2026-10-07")
    assert t_date == "2026-10-07"
    assert c_date == "2026-10-06"
    assert is_weekend is False
    assert w_start.strftime("%Y-%m-%d") == "2026-10-06"
    assert w_end.strftime("%Y-%m-%d") == "2026-10-07"

def test_working_day_window_invalid_date_formats():
    """
    Invalid date strings or compare_date >= target_date must raise HTTP 400.
    """
    # Invalid target format
    headers = get_headers("vikram.joshi@syncbrief.ai")
    resp1 = client.get("/api/what-changed?target_date=invalid-date", headers=headers)
    assert resp1.status_code == 400
    assert "Invalid target_date" in resp1.json()["detail"]

    # Invalid compare format
    resp2 = client.get("/api/what-changed?target_date=2026-10-07&compare_date=bad-date", headers=headers)
    assert resp2.status_code == 400
    assert "Invalid compare_date" in resp2.json()["detail"]

    # compare_date >= target_date
    resp3 = client.get("/api/what-changed?target_date=2026-10-07&compare_date=2026-10-07", headers=headers)
    assert resp3.status_code == 400
    assert "strictly earlier" in resp3.json()["detail"]

def test_employee_receives_403_forbidden():
    """
    Regular employee (role_level 3, e.g. Priya Sharma) must be denied access with HTTP 403.
    """
    headers = get_headers("priya.sharma@syncbrief.ai")
    resp = client.get("/api/what-changed", headers=headers)
    assert resp.status_code == 403
    assert "Forbidden" in resp.json()["detail"]

def test_manager_sees_self_and_subordinates_only():
    """
    Vikram Joshi (Backend Manager) can view delta intelligence for his team
    (Priya, Elena, Rohan, Vikram).
    Peers under James Wilson (Alex Rivera, Maya Lin) must NOT appear in Vikram's scope.
    """
    headers = get_headers("vikram.joshi@syncbrief.ai")
    resp = client.get("/api/what-changed?target_date=2026-09-29&compare_date=2026-09-26", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["target_date"] == "2026-09-29"
    assert data["previous_working_day"] == "2026-09-26"
    assert data["team_scope"]["manager_name"] == "Vikram Joshi"

    # Confirm members from other branches are not present in checkin updates
    checkin_authors = [cu["user_name"] for cu in data["progress"]["checkin_updates"]]
    assert "Alex Rivera" not in checkin_authors
    assert "Maya Lin" not in checkin_authors

def test_director_can_see_tenant_wide_changes():
    """
    Sarah Jenkins (Director L1) can view delta intelligence across all sub-teams
    in the organization (Backend and Platform/SRE).
    """
    headers = get_headers("sarah.jenkins@syncbrief.ai")
    resp = client.get("/api/what-changed?target_date=2026-09-29&compare_date=2026-09-26", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["team_scope"]["manager_name"] == "Sarah Jenkins"
    # Director scope contains all tenant members
    assert data["team_scope"]["member_count"] >= 7

def test_cross_tenant_data_cannot_appear():
    """
    Alice Smith (Acme Corporation, Tenant 2) querying delta intelligence
    must never see any tasks, check-ins, or blockers from SyncBrief (Tenant 1).
    """
    headers = get_headers("alice.smith@acme.com")
    resp = client.get("/api/what-changed", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    # Verify no SyncBrief members or items leak across tenant boundaries
    for cu in data["progress"]["checkin_updates"]:
        assert cu["user_name"] not in ["Priya Sharma", "Vikram Joshi", "James Wilson"]
    for cw in data["progress"]["completed_work"]:
        assert cw["owner"] not in ["Priya Sharma", "Vikram Joshi"]
    for nb in data["blockers"]["new_blockers"]:
        assert "PR #184" not in nb["summary"]

def test_delta_detection_completed_tasks_and_progress():
    """
    Verifies that completed tasks appear in completed_work and meaningful
    progress changes have positive delta points without reporting unchanged tasks.
    """
    headers = get_headers("sarah.jenkins@syncbrief.ai")
    resp = client.get("/api/what-changed?target_date=2026-09-29&compare_date=2026-09-26", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    # Progress deltas should only include tasks with actual progress
    for mt in data["progress"]["meaningful_task_progress"]:
        assert mt["progress_delta_pct"] > 0
        assert mt["current_progress_pct"] > 0
        for ev in mt["evidence"]:
            assert ev["verified"] is True

def test_blocker_classification_new_vs_existing_unresolved():
    """
    Verifies that blockers are classified as either new (created within window)
    or existing unresolved (created before window, with age_days >= 1).
    """
    headers = get_headers("sarah.jenkins@syncbrief.ai")
    resp = client.get("/api/what-changed?target_date=2026-09-29&compare_date=2026-09-26", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    # Verify new blockers have valid evidence
    for nb in data["blockers"]["new_blockers"]:
        assert nb["severity"] in ["low", "medium", "high"]
        for ev in nb["evidence"]:
            assert ev["verified"] is True

    # Verify existing unresolved blockers have age_days >= 1
    for ub in data["blockers"]["existing_unresolved_blockers"]:
        assert ub["age_days"] >= 1
        for ev in ub["evidence"]:
            assert ev["verified"] is True

def test_missing_checkins_and_attention_items():
    """
    Verifies that direct reports who have not submitted standups appear
    in missing_checkins and have corresponding nudge attention items.
    """
    headers = get_headers("vikram.joshi@syncbrief.ai")
    resp = client.get("/api/what-changed?target_date=2026-09-29&compare_date=2026-09-26", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    # Rohan Patel has not checked in
    missing = data["insufficient_data"]["missing_checkins"]
    if "Rohan Patel" in missing:
        # Should have a manager attention nudge item for Rohan
        nudge_actions = [
            a["action"] for a in data["needs_manager_attention"]
            if "Rohan" in a.get("target_person", "") or "Rohan" in a.get("action", "")
        ]
        assert len(nudge_actions) >= 1

def test_audit_logging_recorded(db):
    """
    Verifies that invoking GET /api/what-changed records an immutable AuditLog entry.
    """
    headers = get_headers("vikram.joshi@syncbrief.ai")
    resp = client.get("/api/what-changed?target_date=2026-09-29&compare_date=2026-09-26", headers=headers)
    assert resp.status_code == 200

    vikram = db.query(User).filter(User.email == "vikram.joshi@syncbrief.ai").first()
    log = db.query(AuditLog).filter(
        AuditLog.actor_id == vikram.id,
        AuditLog.action == "what_changed_analysis"
    ).order_by(AuditLog.id.desc()).first()

    assert log is not None
    assert log.entity_type == "team_delta"
    assert "what_changed_v1" in log.prompt_version

