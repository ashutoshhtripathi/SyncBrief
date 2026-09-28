from datetime import datetime, timedelta
import json
import logging
from backend.app.auth_utils import hash_password
from backend.app.database import SessionLocal, Base, engine
from backend.app.models import User, Channel, Message, Checkin, Blocker, Digest, AuditLog, SystemSetting
from backend.app.integrations.teams_cards import TeamsCardGenerator
from backend.app.integrations.azure_devops import devops_client

logger = logging.getLogger(__name__)

def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Check if already seeded
        if db.query(User).count() > 0:
            print("Database already contains records. Clearing existing to ensure fresh demo state...")
            Base.metadata.drop_all(bind=engine)
            Base.metadata.create_all(bind=engine)

        print("Seeding Users (6-person distributed team across IN/UK/US)...")
        users_data = [
            {
                "email": "sarah.jenkins@syncbrief.ai",
                "full_name": "Sarah Jenkins",
                "role": "manager",
                "title": "Director of Engineering",
                "avatar_url": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
                "timezone": "America/Los_Angeles",
                "reminder_time": "09:00",
                "streak_count": 14
            },
            {
                "email": "priya.sharma@syncbrief.ai",
                "full_name": "Priya Sharma",
                "role": "member",
                "title": "Senior Frontend & API Engineer",
                "avatar_url": "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80",
                "timezone": "Asia/Kolkata",
                "reminder_time": "09:30",
                "streak_count": 9
            },
            {
                "email": "vikram.joshi@syncbrief.ai",
                "full_name": "Vikram Joshi",
                "role": "member",
                "title": "Lead Backend & Distributed Systems",
                "avatar_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
                "timezone": "Asia/Kolkata",
                "reminder_time": "09:30",
                "streak_count": 12
            },
            {
                "email": "james.wilson@syncbrief.ai",
                "full_name": "James Wilson",
                "role": "member",
                "title": "Principal SRE & DevOps",
                "avatar_url": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
                "timezone": "Europe/London",
                "reminder_time": "09:00",
                "streak_count": 8
            },
            {
                "email": "elena.rostova@syncbrief.ai",
                "full_name": "Elena Rostova",
                "role": "member",
                "title": "Fullstack Cloud Engineer",
                "avatar_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
                "timezone": "America/New_York",
                "reminder_time": "09:15",
                "streak_count": 5
            },
            {
                "email": "rohan.patel@syncbrief.ai",
                "full_name": "Rohan Patel",
                "role": "member",
                "title": "Software Engineer (Backend)",
                "avatar_url": "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80",
                "timezone": "Asia/Kolkata",
                "reminder_time": "10:00",
                "streak_count": 3
            }
        ]

        created_users = {}
        for u in users_data:
            pw = hash_password("demo1234")
            user_obj = User(
                email=u["email"],
                hashed_password=pw,
                full_name=u["full_name"],
                role=u["role"],
                title=u["title"],
                avatar_url=u["avatar_url"],
                timezone=u["timezone"],
                reminder_time=u["reminder_time"],
                streak_count=u["streak_count"]
            )
            db.add(user_obj)
            db.flush()
            created_users[u["full_name"]] = user_obj

        print("Seeding Channels (#backend, #frontend, #devops)...")
        backend_channel = Channel(name="#backend", description="Backend APIs, DB schemas, microservices", is_syncbrief_enabled=True, member_count=6)
        frontend_channel = Channel(name="#frontend", description="React, Vite, UI components, client state", is_syncbrief_enabled=True, member_count=6)
        devops_channel = Channel(name="#devops", description="CI/CD, Azure Kubernetes, Docker, infra alerts", is_syncbrief_enabled=True, member_count=6)
        
        db.add_all([backend_channel, frontend_channel, devops_channel])
        db.flush()

        print("Seeding realistic Messages (~60 messages across channels)...")
        now = datetime.utcnow()
        messages_to_create = []

        # 1. #backend messages
        backend_msgs = [
            ("Vikram Joshi", "Morning team. Reviewing the auth tenant isolation architecture today.", now - timedelta(days=5, hours=2)),
            ("Rohan Patel", "Started work on user profile CRUD endpoints.", now - timedelta(days=5, hours=1)),
            ("Vikram Joshi", "Make sure all DB queries use parameterized statements. Check the SQLAlchemy models.", now - timedelta(days=4, hours=3)),
            ("Elena Rostova", "Does the auth token contain tenant_id in JWT claims?", now - timedelta(days=3, hours=5)),
            ("Vikram Joshi", "Yes, `tenant_id` and `roles` are embedded in the access token payload.", now - timedelta(days=3, hours=4)),
            ("Priya Sharma", "Great, frontend will decode that to handle multi-tenant routing.", now - timedelta(days=2, hours=6)),
            ("Vikram Joshi", "Drafting migration 0042 for multi-tenant schema isolation.", now - timedelta(days=1, hours=8)),
            # HERO SCENARIO EVIDENCE THREAD
            ("Priya Sharma", "@Vikram Joshi any update on the DB migration for PR #184? Frontend Auth flow is waiting on it.", now - timedelta(hours=5), "thread_492"),
            ("Vikram Joshi", "The v2.4 Auth schema migration script 0042_oauth_tenants.sql is currently blocked on the security audit review. ETA is tomorrow 4 PM. Do not merge PR #184 until this runs.", now - timedelta(hours=4, minutes=45), "thread_492", "msg_492"),
            ("Priya Sharma", "Got it. I'll flag it as blocked in today's check-in so Sarah knows we need expedited security signoff.", now - timedelta(hours=4, minutes=30), "thread_492"),
            ("Rohan Patel", "I can help write the automated unit tests for 0042 if needed once approved.", now - timedelta(hours=3), "thread_492"),
            ("Vikram Joshi", "Thanks Rohan. Let's wait for SecOps feedback first.", now - timedelta(hours=2), "thread_492"),
            ("Vikram Joshi", "Redis cache eviction spike causing intermittent 504 gateway timeouts on test tenants during load test.", now - timedelta(days=1, hours=2), None, "msg_backend_redis_01"),
            ("Sarah Jenkins", "Please file an Azure DevOps task for the Redis memory headroom.", now - timedelta(days=1, hours=1)),
            ("Vikram Joshi", "Will do, provisioning a P2V3 cache tier.", now - timedelta(hours=18)),
            ("Elena Rostova", "Merged PR #182 for logging middleware.", now - timedelta(hours=14)),
            ("Vikram Joshi", "LGTM, looks solid.", now - timedelta(hours=13)),
            ("Rohan Patel", "Pushed branch for tenant billing webhook handler.", now - timedelta(hours=10)),
            ("Vikram Joshi", "Reviewing now.", now - timedelta(hours=9)),
            ("Sarah Jenkins", "Great pace everyone. Let's keep PR sizes under 400 lines.", now - timedelta(hours=6))
        ]

        for idx, item in enumerate(backend_msgs):
            author_name = item[0]
            content = item[1]
            t = item[2]
            thread = item[3] if len(item) > 3 else None
            custom_id = item[4] if len(item) > 4 and item[4] else f"msg_bk_seq_{idx+1:03d}"
            user_ref = created_users.get(author_name)
            messages_to_create.append(Message(
                id=custom_id,
                channel_id=backend_channel.id,
                channel_name="#backend",
                author_id=user_ref.id if user_ref else None,
                author_name=author_name,
                author_avatar=user_ref.avatar_url if user_ref else None,
                content=content,
                thread_id=thread,
                timestamp=t
            ))

        # 2. #frontend messages
        frontend_msgs = [
            ("Priya Sharma", "Upgraded Vite to v6.2 and React to 18.3. Build time dropped from 4.2s to 1.1s!", now - timedelta(days=4)),
            ("Elena Rostova", "Awesome! Are we using Tailwind v3.4 tokens across the board?", now - timedelta(days=4, hours=-1)),
            ("Priya Sharma", "Yes, all design tokens mapped to Microsoft Fluent color palette.", now - timedelta(days=3)),
            ("Elena Rostova", "Design system dark mode contrast tokens failing accessibility audit on table components in high-contrast mode.", now - timedelta(days=2), None, "msg_frontend_08"),
            ("Priya Sharma", "Fixed in commit 8a93bf with WCAG AAA compliant border outlines.", now - timedelta(days=1, hours=20)),
            ("Elena Rostova", "Verified and closed.", now - timedelta(days=1, hours=19)),
            ("Priya Sharma", "Adding voice-to-text Web Speech API integration to the check-in modal today.", now - timedelta(hours=8)),
            ("Sarah Jenkins", "That will make the 60-second check-in even faster for mobile users.", now - timedelta(hours=7)),
            ("Priya Sharma", "Works smoothly on Chrome, Edge, and Safari.", now - timedelta(hours=6)),
            ("Elena Rostova", "Working on the Recharts trend visualization for team mood and blocker age.", now - timedelta(hours=5)),
            ("Priya Sharma", "Check the InsightsPage wireframe in Figma.", now - timedelta(hours=4)),
            ("Elena Rostova", "Added animated tooltips and responsive SVG containers.", now - timedelta(hours=2))
        ]

        for idx, item in enumerate(frontend_msgs):
            author_name = item[0]
            content = item[1]
            t = item[2]
            thread = item[3] if len(item) > 3 else None
            custom_id = item[4] if len(item) > 4 and item[4] else f"msg_fe_seq_{idx+1:03d}"
            user_ref = created_users.get(author_name)
            messages_to_create.append(Message(
                id=custom_id,
                channel_id=frontend_channel.id,
                channel_name="#frontend",
                author_id=user_ref.id if user_ref else None,
                author_name=author_name,
                author_avatar=user_ref.avatar_url if user_ref else None,
                content=content,
                thread_id=thread,
                timestamp=t
            ))

        # 3. #devops messages
        devops_msgs = [
            ("James Wilson", "AKS production cluster upgraded to Kubernetes 1.30.2.", now - timedelta(days=4)),
            ("James Wilson", "Automated deployment pipeline running via GitHub Actions with OIDC federated Azure credential.", now - timedelta(days=3)),
            ("James Wilson", "Staging ingress SSL renewal failed due to Let's Encrypt rate limit on staging domain.", now - timedelta(days=2), None, "msg_devops_12"),
            ("James Wilson", "Switching staging cert-manager to ZeroSSL ACME provider to bypass rate limit.", now - timedelta(days=1, hours=10)),
            ("Vikram Joshi", "Can we check the Redis container memory limit on staging?", now - timedelta(days=1, hours=5)),
            ("James Wilson", "Bumped Redis limits to 4Gi with LRU eviction enabled.", now - timedelta(days=1, hours=4), None, "msg_devops_05"),
            ("Sarah Jenkins", "Has the Terraform state lock been released?", now - timedelta(hours=8)),
            ("James Wilson", "Yes, clean apply completed in westus2.", now - timedelta(hours=7)),
            ("James Wilson", "Monitoring cluster health. CPU utilization steady at 28%.", now - timedelta(hours=3))
        ]

        for idx, item in enumerate(devops_msgs):
            author_name = item[0]
            content = item[1]
            t = item[2]
            thread = item[3] if len(item) > 3 else None
            custom_id = item[4] if len(item) > 4 and item[4] else f"msg_do_seq_{idx+1:03d}"
            user_ref = created_users.get(author_name)
            messages_to_create.append(Message(
                id=custom_id,
                channel_id=devops_channel.id,
                channel_name="#devops",
                author_id=user_ref.id if user_ref else None,
                author_name=author_name,
                author_avatar=user_ref.avatar_url if user_ref else None,
                content=content,
                thread_id=thread,
                timestamp=t
            ))

        db.add_all(messages_to_create)
        db.flush()

        print("Seeding Check-ins spanning past 2 weeks...")
        checkins_to_create = []

        # Priya check-in (TODAY'S HERO CHECK-IN)
        priya_user = created_users["Priya Sharma"]
        priya_today_checkin = Checkin(
            user_id=priya_user.id,
            user_name=priya_user.full_name,
            yesterday="Completed OAuth frontend flow and token refresh handler. Validated JWT storage in session.",
            today="Testing tenant login endpoints and writing Cypress integration test cases.",
            blockers_text="PR #184 Auth API is blocked waiting for database migration script from the backend team.",
            mood=2,
            pr_link="https://github.com/microsoft/SyncBrief/pull/184",
            work_item_id="ADO-4820",
            status="submitted",
            streak_count=9,
            ai_processed=True,
            created_at=now - timedelta(hours=3)
        )
        checkins_to_create.append(priya_today_checkin)

        # Vikram check-in
        vikram_user = created_users["Vikram Joshi"]
        vikram_checkin = Checkin(
            user_id=vikram_user.id,
            user_name=vikram_user.full_name,
            yesterday="Drafted migration script 0042_oauth_tenants.sql and submitted to SecOps.",
            today="Resolving Redis cache eviction spikes and pairing with Rohan on billing webhooks.",
            blockers_text="None",
            mood=4,
            pr_link="https://github.com/microsoft/SyncBrief/pull/183",
            work_item_id="ADO-4819",
            status="submitted",
            streak_count=12,
            ai_processed=True,
            created_at=now - timedelta(hours=3, minutes=15)
        )
        checkins_to_create.append(vikram_checkin)

        # James check-in
        james_user = created_users["James Wilson"]
        james_checkin = Checkin(
            user_id=james_user.id,
            user_name=james_user.full_name,
            yesterday="Resolved staging ingress SSL certs and bumped Redis memory limits.",
            today="Hardening AKS network security policies and setting up Azure Monitor alerts.",
            blockers_text="None",
            mood=5,
            pr_link="https://github.com/microsoft/SyncBrief/pull/181",
            work_item_id="ADO-4815",
            status="submitted",
            streak_count=8,
            ai_processed=True,
            created_at=now - timedelta(hours=4)
        )
        checkins_to_create.append(james_checkin)

        # Elena check-in
        elena_user = created_users["Elena Rostova"]
        elena_checkin = Checkin(
            user_id=elena_user.id,
            user_name=elena_user.full_name,
            yesterday="Fixed high-contrast theme table borders and added Recharts mood analytics.",
            today="Integrating Azure DevOps mock work item payload viewer on the Blocker Board.",
            blockers_text="None",
            mood=4,
            pr_link="https://github.com/microsoft/SyncBrief/pull/185",
            work_item_id="ADO-4822",
            status="submitted",
            streak_count=5,
            ai_processed=True,
            created_at=now - timedelta(hours=2)
        )
        checkins_to_create.append(elena_checkin)

        # Sarah check-in (Manager)
        sarah_user = created_users["Sarah Jenkins"]
        sarah_checkin = Checkin(
            user_id=sarah_user.id,
            user_name=sarah_user.full_name,
            yesterday="Met with product stakeholders on Sprint 43 roadmap and Innovate 2026 hackathon demo prep.",
            today="Reviewing Daily Standup Digest, unblocking Priya on PR #184 with SecOps lead, and team 1:1s.",
            blockers_text="None",
            mood=5,
            pr_link=None,
            work_item_id=None,
            status="submitted",
            streak_count=14,
            ai_processed=True,
            created_at=now - timedelta(hours=1)
        )
        checkins_to_create.append(sarah_checkin)

        # Note: Rohan Patel has NOT checked in yet today -> triggers "Missing Check-in" alert in Digest!

        # Add historical check-ins across the past 10 days for rich trend charts
        for day_offset in range(1, 10):
            past_date = now - timedelta(days=day_offset)
            checkins_to_create.append(Checkin(
                user_id=priya_user.id,
                user_name=priya_user.full_name,
                yesterday=f"Iterated on sprint user stories (day -{day_offset}).",
                today=f"Continued frontend test coverage (day -{day_offset}).",
                blockers_text="None",
                mood=4 if day_offset % 2 == 0 else 3,
                status="submitted",
                streak_count=max(1, 9 - day_offset),
                ai_processed=True,
                created_at=past_date
            ))
            checkins_to_create.append(Checkin(
                user_id=vikram_user.id,
                user_name=vikram_user.full_name,
                yesterday=f"Engineered microservices backend logic (day -{day_offset}).",
                today=f"Database indexing and query tuning (day -{day_offset}).",
                blockers_text="None",
                mood=5 if day_offset % 3 == 0 else 4,
                status="submitted",
                streak_count=max(1, 12 - day_offset),
                ai_processed=True,
                created_at=past_date
            ))

        db.add_all(checkins_to_create)
        db.flush()

        print("Seeding 5 realistic Blockers (including Hero Citation and Hallucination Test Case)...")
        # 1. Hero Blocker: PR #184 Auth API (VERIFIED CITATION)
        hero_blocker = Blocker(
            checkin_id=priya_today_checkin.id,
            summary="PR #184 Auth API is blocked waiting for database migration script from the backend team",
            severity="high",
            status="open",
            owner_name="Priya Sharma",
            blocked_by="Backend Team (Vikram Joshi)",
            related_work_item="PR #184",
            confidence=0.98,
            citations_json=json.dumps([
                {
                    "message_id": "msg_492",
                    "channel": "#backend",
                    "author": "Vikram Joshi",
                    "timestamp": (now - timedelta(hours=4, minutes=45)).isoformat(),
                    "quote": "The v2.4 Auth schema migration script 0042_oauth_tenants.sql is currently blocked on the security audit review. ETA is tomorrow 4 PM. Do not merge PR #184 until this runs.",
                    "status": "VERIFIED"
                }
            ]),
            devops_work_item_id="ADO-4820",
            devops_payload=json.dumps({
                "op": "add",
                "path": "/fields/Microsoft.VSTS.CMMI.Blocked",
                "value": "Yes"
            })
        )

        # 2. Redis Eviction Blocker
        redis_blocker = Blocker(
            checkin_id=vikram_checkin.id,
            summary="Redis cache eviction spike causing intermittent 504 gateway timeouts on test tenants",
            severity="high",
            status="in_progress",
            owner_name="Vikram Joshi",
            blocked_by="Infrastructure / Memory Limit",
            related_work_item="ADO-4819",
            confidence=0.94,
            citations_json=json.dumps([
                {
                    "message_id": "msg_backend_redis_01",
                    "channel": "#backend",
                    "author": "Vikram Joshi",
                    "timestamp": (now - timedelta(days=1, hours=2)).isoformat(),
                    "quote": "Redis cache eviction spike causing intermittent 504 gateway timeouts on test tenants during load test.",
                    "status": "VERIFIED"
                }
            ]),
            devops_work_item_id="ADO-4819"
        )

        # 3. SSL Staging Blocker
        ssl_blocker = Blocker(
            checkin_id=james_checkin.id,
            summary="Staging ingress SSL renewal failed due to Let's Encrypt rate limit",
            severity="medium",
            status="in_progress",
            owner_name="James Wilson",
            blocked_by="External CA / Rate Limits",
            related_work_item="ADO-4815",
            confidence=0.92,
            citations_json=json.dumps([
                {
                    "message_id": "msg_devops_12",
                    "channel": "#devops",
                    "author": "James Wilson",
                    "timestamp": (now - timedelta(days=2)).isoformat(),
                    "quote": "Staging ingress SSL renewal failed due to Let's Encrypt rate limit on staging domain.",
                    "status": "VERIFIED"
                }
            ]),
            devops_work_item_id="ADO-4815"
        )

        # 4. Resolved Blocker: Theme contrast
        theme_blocker = Blocker(
            checkin_id=elena_checkin.id,
            summary="Design system dark mode contrast tokens failing accessibility audit on table components",
            severity="low",
            status="resolved",
            owner_name="Elena Rostova",
            blocked_by="Design Tokens WCAG Compliance",
            related_work_item="ADO-4811",
            confidence=0.89,
            citations_json=json.dumps([
                {
                    "message_id": "msg_frontend_08",
                    "channel": "#frontend",
                    "author": "Elena Rostova",
                    "timestamp": (now - timedelta(days=2)).isoformat(),
                    "quote": "Design system dark mode contrast tokens failing accessibility audit on table components in high-contrast mode.",
                    "status": "VERIFIED"
                }
            ]),
            devops_work_item_id="ADO-4811"
        )

        # 5. DELIBERATE HALLUCINATION TEST CASE (Validator Rejection Demonstration)
        hallucination_blocker = Blocker(
            checkin_id=None,
            summary="Kubernetes staging deployment delayed due to fake DNS outage (Validator Rejection Demo)",
            severity="high",
            status="open",
            owner_name="Rohan Patel",
            blocked_by="Platform Engineering",
            related_work_item="ADO-9999",
            confidence=0.42,
            citations_json=json.dumps([
                {
                    "message_id": "msg_hallucinated_999",
                    "channel": "#devops",
                    "author": "NonExistentBot",
                    "timestamp": now.isoformat(),
                    "quote": "CoreDNS pods have experienced a total catastrophic failure across staging us-west.",
                    "status": "UNVERIFIED",
                    "rejection_reason": "Citation message ID 'msg_hallucinated_999' not found in database (hallucinated reference rejected)"
                },
                {
                    "message_id": "msg_492",
                    "channel": "#backend",
                    "author": "Vikram Joshi",
                    "timestamp": now.isoformat(),
                    "quote": "We have decided to shut down all cloud databases permanently.",
                    "status": "UNVERIFIED",
                    "rejection_reason": "Quoted text does not appear in source message content (hallucination rejected)"
                }
            ]),
            devops_work_item_id=None
        )

        db.add_all([hero_blocker, redis_blocker, ssl_blocker, theme_blocker, hallucination_blocker])
        db.flush()

        print("Seeding Initial Daily Standup Digest...")
        today_date_str = now.strftime("%Y-%m-%d")
        
        initial_digest = Digest(
            date=today_date_str,
            progress_by_person_json=json.dumps([
                {
                    "name": "Priya Sharma",
                    "yesterday": "Completed OAuth frontend flow and token refresh handler.",
                    "today": "Testing tenant login endpoints and writing Cypress integration test cases.",
                    "mood": 2,
                    "has_blockers": True
                },
                {
                    "name": "Vikram Joshi",
                    "yesterday": "Drafted migration script 0042_oauth_tenants.sql and submitted to SecOps.",
                    "today": "Resolving Redis cache eviction spikes and pairing with Rohan on billing webhooks.",
                    "mood": 4,
                    "has_blockers": True
                },
                {
                    "name": "James Wilson",
                    "yesterday": "Resolved staging ingress SSL certs and bumped Redis memory limits.",
                    "today": "Hardening AKS network security policies and setting up Azure Monitor alerts.",
                    "mood": 5,
                    "has_blockers": False
                },
                {
                    "name": "Elena Rostova",
                    "yesterday": "Fixed high-contrast theme table borders and added Recharts mood analytics.",
                    "today": "Integrating Azure DevOps mock work item payload viewer on the Blocker Board.",
                    "mood": 4,
                    "has_blockers": False
                },
                {
                    "name": "Sarah Jenkins",
                    "yesterday": "Met with product stakeholders on Sprint 43 roadmap.",
                    "today": "Reviewing Daily Standup Digest, unblocking Priya on PR #184 with SecOps lead.",
                    "mood": 5,
                    "has_blockers": False
                }
            ]),
            blockers_summary_json=json.dumps([
                {
                    "summary": "PR #184 Auth API is blocked waiting for database migration script from the backend team",
                    "severity": "high",
                    "owner": "Priya Sharma",
                    "blocked_by": "Backend Team (Vikram Joshi)",
                    "citation_count": 1
                },
                {
                    "summary": "Redis cache eviction spike causing intermittent 504 gateway timeouts on test tenants",
                    "severity": "high",
                    "owner": "Vikram Joshi",
                    "blocked_by": "Infrastructure / Memory Limit",
                    "citation_count": 1
                },
                {
                    "summary": "Staging ingress SSL renewal failed due to Let's Encrypt rate limit",
                    "severity": "medium",
                    "owner": "James Wilson",
                    "blocked_by": "External CA / Rate Limits",
                    "citation_count": 1
                }
            ]),
            risks_json=json.dumps([
                "PR #184 Auth schema dependency may delay Sprint 42 frontend delivery if SecOps approval is not obtained by 4 PM today.",
                "Redis memory headroom needs verification under 2x simulated tenant load."
            ]),
            missing_checkins_json=json.dumps([
                "Rohan Patel"
            ]),
            suggested_actions_json=json.dumps([
                "Sarah (Manager) contact SecOps Lead to expedite audit on migration 0042_oauth_tenants.sql (cited in #backend msg_492).",
                "Ensure James Wilson confirms AKS cluster memory alerts on the newly provisioned Redis P2V3 tier.",
                "Send proactive Microsoft Teams notification reminder to Rohan Patel before 10:30 AM IST."
            ]),
            markdown_content=f"""# 🚀 SyncBrief Daily Standup Digest — {today_date_str}
*Generated automatically by SyncBrief AI at 09:30 UTC*

---

### 📊 Executive Summary
- **Total Check-ins**: 5 / 6 (83% compliance)
- **Active Blockers**: 2 High Severity, 1 Medium
- **Engineering Time Saved Today**: 3.0 hours (~$225 in status meeting recovery)

---

### 🛑 Critical Blockers (with Verifiable Citations)
- **🔴 HIGH**: PR #184 Auth API is blocked waiting for database migration script from the backend team
  - *Owner*: Priya Sharma | *Blocked By*: Backend Team (Vikram Joshi)
  - [✅ Verified Link]: #backend by Vikram Joshi: *"The v2.4 Auth schema migration script 0042_oauth_tenants.sql is currently blocked on the security audit review."* (ID: `msg_492`)
- **🔴 HIGH**: Redis cache eviction spike causing intermittent 504 gateway timeouts on test tenants
  - *Owner*: Vikram Joshi | *Blocked By*: Infrastructure / Memory Limit
  - [✅ Verified Link]: #backend by Vikram Joshi: *"Redis cache eviction spike causing intermittent 504 gateway timeouts on test tenants during load test."* (ID: `msg_backend_redis_01`)

---

### 👥 Team Updates
- **Priya Sharma** (⚠️ Blocked | Mood: ⭐⭐)
  - Completed OAuth flow and token refresh handler. Working on Cypress integration tests.
- **Vikram Joshi** (⚠️ Blocked | Mood: ⭐⭐⭐⭐)
  - Submitted migration 0042 to SecOps. Optimizing Redis memory limits.
- **James Wilson** (✅ On Track | Mood: ⭐⭐⭐⭐⭐)
  - Hardening AKS network policies and Prometheus telemetry.
- **Elena Rostova** (✅ On Track | Mood: ⭐⭐⭐⭐)
  - Finalized Azure DevOps mock work item inspector.
- **Sarah Jenkins** (✅ On Track | Mood: ⭐⭐⭐⭐⭐)
  - Coordinating SecOps unblock request and engineering sprint allocation.

---

### ⏳ Missing Check-in
- ⚠️ **Rohan Patel** (Reminder scheduled for Teams DM)

---

### ⚡ Recommended Manager Actions
1. Contact SecOps Lead to fast-track `0042_oauth_tenants.sql` review (Proof in #backend thread msg_492).
2. Confirm AKS Redis memory headroom with James Wilson.
3. Automated reminder dispatched to Rohan Patel.
"""
        )
        initial_digest.teams_card_json = json.dumps(
            TeamsCardGenerator.generate_digest_card({
                "date": today_date_str,
                "progress_by_person": json.loads(initial_digest.progress_by_person_json),
                "blockers_summary": json.loads(initial_digest.blockers_summary_json),
                "risks": json.loads(initial_digest.risks_json)
            })
        )
        db.add(initial_digest)

        # Audit log
        db.add(AuditLog(
            action="seed_initialization",
            model_used="Deterministic Demo AI (Offline)",
            prompt_version="v1.0",
            input_summary="Initial 2-week team seed dataset",
            output_summary="6 users, 3 channels, 60 messages, 5 blockers created"
        ))

        db.commit()
        print("Database seeding completed successfully! All hero scenarios and evidence links active.")

    except Exception as e:
        db.rollback()
        print(f"Error during seeding: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
