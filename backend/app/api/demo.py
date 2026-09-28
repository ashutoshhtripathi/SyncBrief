from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import json
from backend.app.database import get_db
from backend.app.models import User, Channel, Message, Checkin, Blocker, Digest, AuditLog
from backend.app.ai import get_ai_provider, CitationValidator
from backend.app.integrations.teams_cards import TeamsCardGenerator

router = APIRouter(prefix="/demo", tags=["Judges Demo Scenario Runner"])

@router.post("/run-scenario")
async def run_judge_demo_scenario(db: Session = Depends(get_db)):
    """
    Executes the complete end-to-end golden path demo for hackathon judges:
    1. Ensures evidence thread #492 in #backend is present
    2. Submits Priya's async check-in with PR #184 blocker
    3. Runs AI extraction & strict citation validation against msg_492
    4. Synthesizes Daily Standup Digest
    5. Returns navigation anchors for instant UI jump and highlighting!
    """
    now = datetime.utcnow()

    # 1. Resolve Priya and Backend channel
    priya = db.query(User).filter(User.full_name.ilike("%Priya%")).first()
    vikram = db.query(User).filter(User.full_name.ilike("%Vikram%")).first()
    channel = db.query(Channel).filter(Channel.name == "#backend").first()

    if not priya or not channel:
        # Fallback to defaults
        priya = db.query(User).first()
        channel = db.query(Channel).first()

    # 2. Ensure evidence message msg_492 exists
    evidence_msg = db.query(Message).filter(Message.id == "msg_492").first()
    if not evidence_msg:
        evidence_msg = Message(
            id="msg_492",
            channel_id=channel.id,
            channel_name=channel.name,
            author_id=vikram.id if vikram else None,
            author_name=vikram.full_name if vikram else "Vikram Joshi",
            author_avatar=vikram.avatar_url if vikram else None,
            content="The v2.4 Auth schema migration script 0042_oauth_tenants.sql is currently blocked on the security audit review. ETA is tomorrow 4 PM. Do not merge PR #184 until this runs.",
            thread_id="thread_492",
            timestamp=now - timedelta(hours=4, minutes=45)
        )
        db.add(evidence_msg)
        db.flush()

    # 3. Submit/refresh Priya's check-in
    checkin = Checkin(
        user_id=priya.id,
        user_name=priya.full_name,
        yesterday="Completed OAuth frontend flow and token refresh handler. Validated JWT storage in session.",
        today="Testing tenant login endpoints and writing Cypress integration test cases.",
        blockers_text="PR #184 Auth API is blocked waiting for database migration script from the backend team.",
        mood=2,
        pr_link="https://github.com/microsoft/SyncBrief/pull/184",
        work_item_id="ADO-4820",
        status="submitted",
        streak_count=(priya.streak_count or 9) + 1,
        ai_processed=True,
        created_at=now
    )
    priya.streak_count = checkin.streak_count
    db.add(checkin)
    db.flush()

    # 4. Extract Blocker with Verified Citation
    ai_provider = get_ai_provider()
    raw_blockers = await ai_provider.extract_blockers(
        {
            "user_name": priya.full_name,
            "yesterday": checkin.yesterday,
            "today": checkin.today,
            "blockers_text": checkin.blockers_text,
            "pr_link": checkin.pr_link,
            "work_item_id": checkin.work_item_id
        },
        [
            {
                "id": evidence_msg.id,
                "channel_name": evidence_msg.channel_name,
                "author_name": evidence_msg.author_name,
                "content": evidence_msg.content,
                "thread_id": evidence_msg.thread_id,
                "timestamp": evidence_msg.timestamp.isoformat()
            }
        ]
    )

    created_blockers = []
    for b_data in raw_blockers:
        validated_citations = CitationValidator.validate_citations(b_data.get("citations", []), db)
        blocker = Blocker(
            checkin_id=checkin.id,
            summary=b_data.get("blocker_summary", checkin.blockers_text),
            severity=b_data.get("severity", "high"),
            status="open",
            owner_name=priya.full_name,
            blocked_by=b_data.get("blocked_by", "Backend Team (Vikram Joshi)"),
            related_work_item="PR #184",
            confidence=0.98,
            citations_json=json.dumps(validated_citations),
            devops_work_item_id="ADO-4820"
        )
        db.add(blocker)
        db.flush()
        created_blockers.append(blocker)

    # 5. Re-generate Digest
    today_str = now.strftime("%Y-%m-%d")
    digest_res = await ai_provider.generate_digest(
        checkins=[{"user_name": priya.full_name, "yesterday": checkin.yesterday, "today": checkin.today, "mood": checkin.mood}],
        blockers=[{"summary": b.summary, "severity": b.severity, "owner_name": b.owner_name, "blocked_by": b.blocked_by, "citations": b.citations} for b in created_blockers],
        team_members=[{"id": priya.id, "full_name": priya.full_name, "role": priya.role, "timezone": priya.timezone}],
        digest_date=today_str
    )

    teams_card = TeamsCardGenerator.generate_digest_card(digest_res)

    digest = Digest(
        date=today_str,
        progress_by_person_json=json.dumps(digest_res.get("progress_by_person", [])),
        blockers_summary_json=json.dumps(digest_res.get("blockers_summary", [])),
        risks_json=json.dumps(digest_res.get("risks", [])),
        missing_checkins_json=json.dumps(digest_res.get("missing_checkins", [])),
        suggested_actions_json=json.dumps(digest_res.get("suggested_actions", [])),
        markdown_content=digest_res.get("markdown_content", ""),
        teams_card_json=json.dumps(teams_card)
    )
    db.add(digest)

    db.add(AuditLog(
        action="judge_demo_scenario",
        model_used=ai_provider.name,
        prompt_version="blocker_v1",
        input_summary="Triggered 1-click Judge Golden Path Demo",
        output_summary=f"Created checkin #{checkin.id}, blocker with citation {evidence_msg.id}, and synthesized digest #{digest.id}"
    ))

    db.commit()

    hero_blocker_id = created_blockers[0].id if created_blockers else None

    return {
        "status": "success",
        "scenario_name": "PR #184 Auth API Database Migration Blocker",
        "checkin_id": checkin.id,
        "blocker_id": hero_blocker_id,
        "evidence_message_id": "msg_492",
        "channel_name": "#backend",
        "digest_id": digest.id,
        "message": "Demo scenario ran successfully! Blocker detected and verified against Teams thread #492."
    }
