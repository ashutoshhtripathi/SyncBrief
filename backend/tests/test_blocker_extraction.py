import asyncio
import pytest
from backend.app.ai.mock_provider import MockProvider

def test_hero_blocker_extraction():
    provider = MockProvider()
    checkin_data = {
        "user_name": "Priya Sharma",
        "yesterday": "Completed OAuth frontend flow.",
        "today": "Testing tenant endpoints.",
        "blockers_text": "PR #184 Auth API is blocked waiting for database migration script from the backend team.",
        "pr_link": "https://github.com/ashutoshhtripathi/SyncBrief/pull/184",
        "work_item_id": "ADO-4820"
    }
    channel_messages = [
        {
            "id": "msg_492",
            "channel_name": "#backend",
            "author_name": "Vikram Joshi",
            "content": "The v2.4 Auth schema migration script 0042_oauth_tenants.sql is currently blocked on the security audit review. ETA is tomorrow 4 PM. Do not merge PR #184 until this runs.",
            "timestamp": "2026-09-28T14:00:00"
        }
    ]

    blockers = asyncio.run(provider.extract_blockers(checkin_data, channel_messages))
    assert len(blockers) == 1
    hero = blockers[0]
    assert hero["severity"] == "high"
    assert hero["owner"] == "Priya Sharma"
    assert "PR #184" in hero["related_work_item"]
    assert len(hero["citations"]) == 1
    assert hero["citations"][0]["message_id"] == "msg_492"
    assert "0042_oauth_tenants.sql" in hero["citations"][0]["quote"]

def test_no_blockers_returns_empty():
    provider = MockProvider()
    checkin_data = {
        "user_name": "Sarah Jenkins",
        "yesterday": "Stakeholder meetings",
        "today": "1:1s",
        "blockers_text": "None"
    }
    blockers = asyncio.run(provider.extract_blockers(checkin_data, []))
    assert blockers == []

def test_digest_synthesis():
    provider = MockProvider()
    checkins = [
        {"user_name": "Priya Sharma", "yesterday": "OAuth", "today": "Testing", "mood": 2, "blockers_text": "Waiting on migration"},
        {"user_name": "Vikram Joshi", "yesterday": "Drafted migration", "today": "Redis", "mood": 4, "blockers_text": "None"}
    ]
    blockers = [
        {"summary": "PR #184 migration blocked", "severity": "high", "owner_name": "Priya Sharma", "blocked_by": "Backend Team"}
    ]
    team_members = [
        {"full_name": "Priya Sharma"},
        {"full_name": "Vikram Joshi"},
        {"full_name": "Rohan Patel"}
    ]

    digest = asyncio.run(provider.generate_digest(checkins, blockers, team_members, "2026-09-29"))
    assert digest["date"] == "2026-09-29"
    assert len(digest["progress_by_person"]) == 2
    assert "Rohan Patel" in digest["missing_checkins"]
    assert len(digest["risks"]) > 0
    assert len(digest["suggested_actions"]) > 0
    assert "SyncBrief Daily Standup Digest" in digest["markdown_content"]
