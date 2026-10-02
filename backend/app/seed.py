from datetime import datetime, timedelta
import json
import logging
from backend.app.auth_utils import hash_password
from backend.app.database import SessionLocal, Base, engine
from backend.app.models import (
    Tenant, User, Channel, Message, Checkin, Blocker, Digest, AuditLog, SystemSetting, Sprint, Task,
    PerformanceCycle, PerformanceGoal
)
from backend.app.integrations.teams_cards import TeamsCardGenerator
from backend.app.integrations.azure_devops import devops_client

logger = logging.getLogger(__name__)

def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Clear existing tables for fresh demo state
        print("Clearing database tables for complete seed update...")
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)

        now = datetime.utcnow()

        print("0. Seeding Tenants (SyncBrief Enterprise & Acme Corporation)...")
        tenant1 = Tenant(
            id=1,
            name="SyncBrief Enterprise",
            domain="syncbrief.ai",
            created_at=now
        )
        tenant2 = Tenant(
            id=2,
            name="Acme Corporation",
            domain="acme.com",
            created_at=now
        )
        db.add_all([tenant1, tenant2])
        db.flush()

        print("1. Seeding Users (Employee > Manager > Director 8-Person Engineering Team)...")
        # Sarah Jenkins (Director, L1)
        #   ├── Vikram Joshi (Manager, L2 - Backend)
        #   │     ├── Priya Sharma (Employee, L3 - Senior API)
        #   │     ├── Elena Rostova (Employee, L3 - Cloud)
        #   │     └── Rohan Patel (Employee, L3 - Backend)
        #   └── James Wilson (Manager, L2 - Platform/SRE)
        #         ├── Alex Rivera (Employee, L3 - Staff Frontend)
        #         └── Maya Lin (Employee, L3 - Reliability)
        
        sarah = User(
            email="sarah.jenkins@syncbrief.ai",
            hashed_password=hash_password("demo1234"),
            full_name="Sarah Jenkins",
            role="director",
            title="Director of Engineering",
            avatar_url="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
            timezone="America/Los_Angeles",
            reminder_time="09:00",
            streak_count=14,
            role_level=1,
            reports_to_id=None,
            tenant_id=tenant1.id,
            org_type="engineering"
        )
        db.add(sarah)
        db.flush()

        vikram = User(
            email="vikram.joshi@syncbrief.ai",
            hashed_password=hash_password("demo1234"),
            full_name="Vikram Joshi",
            role="manager",
            title="Engineering Manager (Backend)",
            avatar_url="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
            timezone="Asia/Kolkata",
            reminder_time="09:30",
            streak_count=12,
            role_level=2,
            reports_to_id=sarah.id,
            tenant_id=tenant1.id,
            org_type="engineering"
        )
        james = User(
            email="james.wilson@syncbrief.ai",
            hashed_password=hash_password("demo1234"),
            full_name="James Wilson",
            role="manager",
            title="Engineering Manager (Platform & SRE)",
            avatar_url="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
            timezone="Europe/London",
            reminder_time="09:00",
            streak_count=8,
            role_level=2,
            reports_to_id=sarah.id,
            tenant_id=tenant1.id,
            org_type="engineering"
        )
        db.add_all([vikram, james])
        db.flush()

        priya = User(
            email="priya.sharma@syncbrief.ai",
            hashed_password=hash_password("demo1234"),
            full_name="Priya Sharma",
            role="employee",
            title="Senior Frontend & API Engineer",
            avatar_url="https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80",
            timezone="Asia/Kolkata",
            reminder_time="09:30",
            streak_count=9,
            role_level=3,
            reports_to_id=vikram.id,
            tenant_id=tenant1.id,
            org_type="engineering"
        )
        elena = User(
            email="elena.rostova@syncbrief.ai",
            hashed_password=hash_password("demo1234"),
            full_name="Elena Rostova",
            role="employee",
            title="Senior Cloud & Microservices Engineer",
            avatar_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
            timezone="America/New_York",
            reminder_time="09:15",
            streak_count=5,
            role_level=3,
            reports_to_id=vikram.id,
            tenant_id=tenant1.id,
            org_type="engineering"
        )
        rohan = User(
            email="rohan.patel@syncbrief.ai",
            hashed_password=hash_password("demo1234"),
            full_name="Rohan Patel",
            role="employee",
            title="Software Engineer (Backend)",
            avatar_url="https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80",
            timezone="Asia/Kolkata",
            reminder_time="10:00",
            streak_count=3,
            role_level=3,
            reports_to_id=vikram.id,
            tenant_id=tenant1.id,
            org_type="engineering"
        )
        alex = User(
            email="alex.rivera@syncbrief.ai",
            hashed_password=hash_password("demo1234"),
            full_name="Alex Rivera",
            role="employee",
            title="Staff Frontend & UX Engineer",
            avatar_url="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
            timezone="America/New_York",
            reminder_time="09:30",
            streak_count=11,
            role_level=3,
            reports_to_id=james.id,
            tenant_id=tenant1.id,
            org_type="engineering"
        )
        maya = User(
            email="maya.lin@syncbrief.ai",
            hashed_password=hash_password("demo1234"),
            full_name="Maya Lin",
            role="employee",
            title="Site Reliability & DevOps Engineer",
            avatar_url="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150&auto=format&fit=crop&q=80",
            timezone="Europe/London",
            reminder_time="09:15",
            streak_count=6,
            role_level=3,
            reports_to_id=james.id,
            tenant_id=tenant1.id,
            org_type="engineering"
        )
        # Acme Corporation user for multi-tenant boundary isolation validation
        alice = User(
            email="alice.smith@acme.com",
            hashed_password=hash_password("demo1234"),
            full_name="Alice Smith",
            role="director",
            title="VP of Engineering (Acme)",
            avatar_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
            timezone="America/New_York",
            reminder_time="09:00",
            streak_count=5,
            role_level=1,
            reports_to_id=None,
            tenant_id=tenant2.id,
            org_type="engineering"
        )
        db.add_all([priya, elena, rohan, alex, maya, alice])
        db.flush()

        print("2. Seeding Sprints (Sprint 42 Closed, Sprint 43 Active)...")
        sprint42 = Sprint(
            name="Sprint 42 (Q3 Auth & Security)",
            start_date=now - timedelta(days=21),
            end_date=now - timedelta(days=7),
            status="closed",
            goal="Establish OAuth2 multi-tenant foundations and security audits."
        )
        sprint43 = Sprint(
            name="Sprint 43 (Q3 Multi-Tenant & Scalability)",
            start_date=now - timedelta(days=7),
            end_date=now + timedelta(days=7),
            status="active",
            goal="Deliver tenant isolation, complete Auth PR #184, and harden cluster reliability."
        )
        db.add_all([sprint42, sprint43])
        db.flush()

        print("3. Seeding 18+ Tasks with Priorities, Fibonacci Difficulties, and Carry-overs...")
        tasks_data = [
            # Sprint 42 (Completed in Sprint 42 - on-time full points)
            {
                "title": "OAuth 2.0 Token Spec & JWT Claims Architecture",
                "desc": "Define standard tenant_id claims and RS256 signature specification.",
                "assignee": vikram,
                "priority": "High",
                "difficulty": 5,
                "status": "Done",
                "progress_pct": 100,
                "sprint": sprint42,
                "carried_over": 0,
                "completed_at": now - timedelta(days=12)
            },
            {
                "title": "Vite 6.2 Bundling & React 18.3 Optimization",
                "desc": "Reduce initial client chunk load time from 4.2s to 1.1s.",
                "assignee": priya,
                "priority": "Medium",
                "difficulty": 3,
                "status": "Done",
                "progress_pct": 100,
                "sprint": sprint42,
                "carried_over": 0,
                "completed_at": now - timedelta(days=10)
            },
            {
                "title": "AKS Cluster Upgrade to Kubernetes 1.30.2",
                "desc": "Automated node pool rolling upgrade via GitHub Actions OIDC.",
                "assignee": james,
                "priority": "High",
                "difficulty": 5,
                "status": "Done",
                "progress_pct": 100,
                "sprint": sprint42,
                "carried_over": 0,
                "completed_at": now - timedelta(days=9)
            },
            {
                "title": "Dark Mode Contrast Accessibility Audit (WCAG AAA)",
                "desc": "Address high-contrast table borders and outline visibility tokens.",
                "assignee": elena,
                "priority": "Low",
                "difficulty": 2,
                "status": "Done",
                "progress_pct": 100,
                "sprint": sprint42,
                "carried_over": 0,
                "completed_at": now - timedelta(days=8)
            },

            # Sprint 43 - HERO SCENARIO TASK (CARRIED OVER FROM SPRINT 42 -> carried_over_count=1)
            {
                "title": "PR #184 Auth API Multi-Tenant Integration & SecOps Approval",
                "desc": "Frontend auth flow waiting for backend DB migration 0042_oauth_tenants.sql.",
                "assignee": priya,
                "priority": "High",
                "difficulty": 8,
                "status": "Blocked",
                "progress_pct": 75,
                "sprint": sprint43,
                "carried_over": 1,
                "completed_at": None
            },
            {
                "title": "Database Schema Migration 0042 & SecOps Signoff",
                "desc": "Multi-tenant tenant_id isolation script awaiting security audit review.",
                "assignee": vikram,
                "priority": "High",
                "difficulty": 5,
                "status": "In progress",
                "progress_pct": 60,
                "sprint": sprint43,
                "carried_over": 1,
                "completed_at": None
            },
            {
                "title": "Redis Cache Eviction Spikes & Memory Sizing",
                "desc": "Intermittent 504 gateway timeouts under load. Provisioning P2V3 tier with LRU policy.",
                "assignee": vikram,
                "priority": "High",
                "difficulty": 5,
                "status": "In progress",
                "progress_pct": 50,
                "sprint": sprint43,
                "carried_over": 0,
                "completed_at": None
            },
            {
                "title": "Staging Ingress SSL Certificate ZeroSSL Switch",
                "desc": "Let's Encrypt rate limit encountered; switching cert-manager to ZeroSSL provider.",
                "assignee": james,
                "priority": "Medium",
                "difficulty": 3,
                "status": "In progress",
                "progress_pct": 80,
                "sprint": sprint43,
                "carried_over": 0,
                "completed_at": None
            },
            {
                "title": "Prometheus & Azure Monitor Cluster Telemetry",
                "desc": "Configure Prometheus metrics scrapers and Azure Monitor dashboards.",
                "assignee": james,
                "priority": "Low",
                "difficulty": 2,
                "status": "To do",
                "progress_pct": 0,
                "sprint": sprint43,
                "carried_over": 0,
                "completed_at": None
            },
            {
                "title": "Tenant Login Cypress Integration Test Suite",
                "desc": "End-to-end automation for tenant authentication, session storage, and route guards.",
                "assignee": priya,
                "priority": "Medium",
                "difficulty": 3,
                "status": "In progress",
                "progress_pct": 40,
                "sprint": sprint43,
                "carried_over": 0,
                "completed_at": None
            },
            {
                "title": "Azure DevOps Work Item Inspector Modal",
                "desc": "Visual JSON-Patch document viewer for Work Item integration.",
                "assignee": elena,
                "priority": "Medium",
                "difficulty": 3,
                "status": "Done",
                "progress_pct": 100,
                "sprint": sprint43,
                "carried_over": 0,
                "completed_at": now - timedelta(days=1)
            },
            {
                "title": "Recharts Team Mood & Blocker Analytics",
                "desc": "Interactive SVG charts visualizing team velocity and standup health.",
                "assignee": elena,
                "priority": "Low",
                "difficulty": 2,
                "status": "Done",
                "progress_pct": 100,
                "sprint": sprint43,
                "carried_over": 0,
                "completed_at": now - timedelta(hours=18)
            },
            {
                "title": "Tenant Billing Webhook Handler (Stripe Connect)",
                "desc": "Process invoice.payment_succeeded and update subscription claims.",
                "assignee": rohan,
                "priority": "Medium",
                "difficulty": 3,
                "status": "In progress",
                "progress_pct": 35,
                "sprint": sprint43,
                "carried_over": 0,
                "completed_at": None
            },
            {
                "title": "User Profile Settings API & Avatar Upload",
                "desc": "CRUD operations for user timezone, reminder preferences, and notification channels.",
                "assignee": rohan,
                "priority": "Low",
                "difficulty": 2,
                "status": "To do",
                "progress_pct": 0,
                "sprint": sprint43,
                "carried_over": 0,
                "completed_at": None
            },
            {
                "title": "Sprint 43 Stakeholder Alignment & Hackathon Delivery",
                "desc": "Coordinating SecOps unblock request and engineering sprint allocation.",
                "assignee": sarah,
                "priority": "High",
                "difficulty": 5,
                "status": "In progress",
                "progress_pct": 80,
                "sprint": sprint43,
                "carried_over": 0,
                "completed_at": None
            },

            # Platform & Frontend Team Tasks (Reporting to James)
            {
                "title": "Command Palette (Cmd+K) & Keyboard Navigation Shortcuts",
                "desc": "Build lightning-fast modal index for jumping across Today, Sprints, Points, and user switching.",
                "assignee": alex,
                "priority": "High",
                "difficulty": 5,
                "status": "In progress",
                "progress_pct": 75,
                "sprint": sprint43,
                "carried_over": 0,
                "completed_at": None
            },
            {
                "title": "WCAG 2.1 AA Contrast Tokens & Dark Mode Testing",
                "desc": "Verify high-contrast mode compliance on all data tables and modals.",
                "assignee": alex,
                "priority": "Low",
                "difficulty": 2,
                "status": "Done",
                "progress_pct": 100,
                "sprint": sprint42,
                "carried_over": 0,
                "completed_at": now - timedelta(days=9)
            },
            {
                "title": "Redis Cache Cluster Autoscale & Memory Eviction Alarms",
                "desc": "Configure Prometheus metrics and auto-resizing in AKS cluster to eliminate 504 timeouts.",
                "assignee": maya,
                "priority": "High",
                "difficulty": 5,
                "status": "In progress",
                "progress_pct": 80,
                "sprint": sprint43,
                "carried_over": 0,
                "completed_at": None
            },
            {
                "title": "Automated Canary Deployment Verification in Azure Pipelines",
                "desc": "Automate rollback triggers on error rate spikes exceeding 0.5% in production.",
                "assignee": maya,
                "priority": "Medium",
                "difficulty": 3,
                "status": "Done",
                "progress_pct": 100,
                "sprint": sprint43,
                "carried_over": 0,
                "completed_at": now - timedelta(days=1)
            },
            {
                "title": "Global Multi-Region Ingress Route Synchronization",
                "desc": "Automate DNS health probe routing between West US and North Europe failover nodes.",
                "assignee": james,
                "priority": "High",
                "difficulty": 8,
                "status": "In progress",
                "progress_pct": 60,
                "sprint": sprint43,
                "carried_over": 0,
                "completed_at": None
            }
        ]

        created_tasks = []
        for t_info in tasks_data:
            task_obj = Task(
                title=t_info["title"],
                description=t_info["desc"],
                assignee_id=t_info["assignee"].id,
                assignee_name=t_info["assignee"].full_name,
                creator_id=sarah.id,
                priority=t_info["priority"],
                difficulty=t_info["difficulty"],
                status=t_info["status"],
                progress_pct=t_info["progress_pct"],
                sprint_id=t_info["sprint"].id,
                carried_over_count=t_info["carried_over"],
                completed_at=t_info["completed_at"]
            )
            db.add(task_obj)
            db.flush()
            created_tasks.append(task_obj)

        hero_task = created_tasks[4] # PR #184 Auth API

        print("4. Seeding Channels (#backend, #frontend, #devops)...")
        backend_channel = Channel(name="#backend", description="Backend APIs, DB schemas, microservices", is_syncbrief_enabled=True, member_count=6)
        frontend_channel = Channel(name="#frontend", description="React, Vite, UI components, client state", is_syncbrief_enabled=True, member_count=6)
        devops_channel = Channel(name="#devops", description="CI/CD, Azure Kubernetes, Docker, infra alerts", is_syncbrief_enabled=True, member_count=6)
        db.add_all([backend_channel, frontend_channel, devops_channel])
        db.flush()

        print("5. Seeding realistic Messages (~60 messages across channels)...")
        messages_to_create = []

        # #backend messages
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
            u_match = next((u for u in [sarah, vikram, priya, james, elena, rohan, alex, maya] if u.full_name == author_name), None)
            messages_to_create.append(Message(
                id=custom_id,
                channel_id=backend_channel.id,
                channel_name="#backend",
                author_id=u_match.id if u_match else None,
                author_name=author_name,
                author_avatar=u_match.avatar_url if u_match else None,
                content=content,
                thread_id=thread,
                timestamp=t
            ))

        # #frontend messages
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
            u_match = next((u for u in [sarah, vikram, priya, james, elena, rohan, alex, maya] if u.full_name == author_name), None)
            messages_to_create.append(Message(
                id=custom_id,
                channel_id=frontend_channel.id,
                channel_name="#frontend",
                author_id=u_match.id if u_match else None,
                author_name=author_name,
                author_avatar=u_match.avatar_url if u_match else None,
                content=content,
                thread_id=thread,
                timestamp=t
            ))

        # #devops messages
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
            u_match = next((u for u in [sarah, vikram, priya, james, elena, rohan, alex, maya] if u.full_name == author_name), None)
            messages_to_create.append(Message(
                id=custom_id,
                channel_id=devops_channel.id,
                channel_name="#devops",
                author_id=u_match.id if u_match else None,
                author_name=author_name,
                author_avatar=u_match.avatar_url if u_match else None,
                content=content,
                thread_id=thread,
                timestamp=t
            ))

        db.add_all(messages_to_create)
        db.flush()

        print("6. Seeding Task-Based Check-ins...")
        checkins_to_create = []

        # Priya checkin (HERO CHECK-IN)
        priya_checkin = Checkin(
            user_id=priya.id,
            user_name=priya.full_name,
            task_id=hero_task.id,
            task_title=hero_task.title,
            progress_pct=75,
            progress_note="Finished OAuth token exchange and refresh logic. Cypress suites ready.",
            next_steps="Test tenant login endpoints once DB migration script runs.",
            sync_needed_with_json=json.dumps(["Vikram Joshi", "Sarah Jenkins"]),
            other_task_ids_json=json.dumps([created_tasks[9].id]),
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
        checkins_to_create.append(priya_checkin)

        # Vikram checkin
        vikram_checkin = Checkin(
            user_id=vikram.id,
            user_name=vikram.full_name,
            task_id=created_tasks[5].id, # DB migration task
            task_title=created_tasks[5].title,
            progress_pct=60,
            progress_note="Submitted 0042 migration to SecOps lead for expedited approval.",
            next_steps="Pair with Rohan on Stripe webhooks and assist James with Redis cache sizing.",
            sync_needed_with_json=json.dumps(["Priya Sharma", "Rohan Patel"]),
            other_task_ids_json=json.dumps([created_tasks[6].id]),
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

        # James checkin
        james_checkin = Checkin(
            user_id=james.id,
            user_name=james.full_name,
            task_id=created_tasks[7].id, # Staging ingress SSL
            task_title=created_tasks[7].title,
            progress_pct=80,
            progress_note="ZeroSSL certificate verified in staging. Cert-manager renewed successfully.",
            next_steps="Setup Azure Monitor container insight alerts for cluster memory limits.",
            sync_needed_with_json=json.dumps(["Vikram Joshi"]),
            other_task_ids_json=json.dumps([created_tasks[8].id]),
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

        # Elena checkin
        elena_checkin = Checkin(
            user_id=elena.id,
            user_name=elena.full_name,
            task_id=created_tasks[10].id,
            task_title=created_tasks[10].title,
            progress_pct=100,
            progress_note="Delivered ADO inspector modal with standard JSON Patch copy button.",
            next_steps="Work on quarterly appraisal export capabilities and CSV generators.",
            sync_needed_with_json=json.dumps([]),
            other_task_ids_json=json.dumps([created_tasks[11].id]),
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

        # Sarah checkin
        sarah_checkin = Checkin(
            user_id=sarah.id,
            user_name=sarah.full_name,
            task_id=created_tasks[14].id,
            task_title=created_tasks[14].title,
            progress_pct=80,
            progress_note="Sprint 43 velocity tracking on track. Met with SecOps to prioritize 0042 migration.",
            next_steps="Facilitate quarterly appraisal reviews and team sprint demos.",
            sync_needed_with_json=json.dumps(["Vikram Joshi", "Priya Sharma"]),
            other_task_ids_json=json.dumps([]),
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

        # Check-in for Alex Rivera (Staff Frontend, reporting to James)
        alex_checkin = Checkin(
            user_id=alex.id,
            user_name=alex.full_name,
            task_id=created_tasks[16].id,
            task_title=created_tasks[16].title,
            progress_pct=75,
            progress_note="Implemented Cmd+K command palette with instant search and global C key quick-add task modal.",
            next_steps="Wire up toast notifications for optimistic task status changes.",
            sync_needed_with_json=json.dumps(["Priya Sharma", "James Wilson"]),
            other_task_ids_json=json.dumps([]),
            yesterday="Scoped keyboard shortcut event handlers and accessible modal dialog.",
            today="Validating focus trapping and arrow key navigation in command palette.",
            blockers_text="None",
            mood=5,
            status="submitted",
            streak_count=11,
            ai_processed=True,
            created_at=now - timedelta(hours=2)
        )
        checkins_to_create.append(alex_checkin)

        # Add historical check-ins across the past 14 days for rich trend charts
        for day_offset in range(1, 14):
            past_date = now - timedelta(days=day_offset)
            checkins_to_create.append(Checkin(
                user_id=priya.id,
                user_name=priya.full_name,
                task_id=hero_task.id,
                task_title=hero_task.title,
                progress_pct=min(75, day_offset * 10),
                progress_note=f"Sprint iteration note (day -{day_offset}).",
                next_steps="Unit testing & frontend components.",
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
                user_id=vikram.id,
                user_name=vikram.full_name,
                task_id=created_tasks[5].id,
                task_title=created_tasks[5].title,
                progress_pct=min(60, day_offset * 12),
                progress_note=f"Backend architecture tuning (day -{day_offset}).",
                next_steps="SecOps audit & Redis tuning.",
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

        print("7. Seeding 5 Blockers with Verified Citations & Hallucination Test...")
        hero_blocker = Blocker(
            checkin_id=priya_checkin.id,
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

        print("8. Seeding Initial Daily Standup Digest...")
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
                "PR #184 Auth schema dependency may delay Sprint 43 frontend delivery if SecOps approval is not obtained by 4 PM today.",
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
            markdown_content=f"# 🚀 SyncBrief Daily Standup Digest — {today_date_str}\n*Generated automatically by SyncBrief AI at 09:30 UTC*"
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
        print("8. Seeding Performance Cycles & Goals (Independent Performance Points System)...")
        cycle_q1 = PerformanceCycle(
            tenant_id=tenant1.id,
            name="2026-Q1",
            start_date=now - timedelta(days=90),
            end_date=now - timedelta(days=1),
            status="closed",
            description="Q1 2026 Enterprise Engineering Performance & OKR Cycle"
        )
        cycle_q2 = PerformanceCycle(
            tenant_id=tenant1.id,
            name="2026-Q2",
            start_date=now,
            end_date=now + timedelta(days=90),
            status="active",
            description="Q2 2026 Active Performance & Key Results Cycle"
        )
        db.add_all([cycle_q1, cycle_q2])
        db.flush()

        # Goal 1 (Q1, incomplete 70%): Priya completed 70% of 10 points -> 7 earned, 3 remaining
        g1_priya_q1 = PerformanceGoal(
            tenant_id=tenant1.id,
            cycle_id=cycle_q1.id,
            user_id=priya.id,
            created_by=vikram.id,
            title="Core OAuth 2.1 & Tenant Data Isolation Engine",
            description="Architect and implement zero-trust OAuth 2.1 and cryptographic tenant isolation.",
            assigned_points=10.0,
            target_percentage=100.0,
            current_progress_percentage=70.0,
            previously_earned_points=0.0,
            earned_points=7.0,
            remaining_points=3.0,
            status="carried_forward",
            deadline=now - timedelta(days=5)
        )
        db.add(g1_priya_q1)
        db.flush()

        # Goal 2 (Q2, carried from Q1): Carried forward with 7 previously earned, remaining available = 3
        # Currently at 70%, 0 new earned in Q2, 3 available
        g2_priya_q2 = PerformanceGoal(
            tenant_id=tenant1.id,
            cycle_id=cycle_q2.id,
            user_id=priya.id,
            created_by=vikram.id,
            title="Core OAuth 2.1 & Tenant Data Isolation Engine",
            description="Architect and implement zero-trust OAuth 2.1 and cryptographic tenant isolation (Carried from Q1).",
            assigned_points=10.0,
            target_percentage=100.0,
            current_progress_percentage=70.0,
            previously_earned_points=7.0,
            earned_points=0.0,
            remaining_points=3.0,
            status="in_progress",
            deadline=now + timedelta(days=30),
            carried_from_goal_id=g1_priya_q1.id
        )

        # Goal 3 (Q2, new): Priya assigned 8 points, currently at 50%
        g3_priya_new = PerformanceGoal(
            tenant_id=tenant1.id,
            cycle_id=cycle_q2.id,
            user_id=priya.id,
            created_by=vikram.id,
            title="Real-Time Standup Chat Synthesis Pipeline",
            description="Deploy high-throughput async processing for Slack/Teams meeting-free summaries.",
            assigned_points=8.0,
            target_percentage=100.0,
            current_progress_percentage=50.0,
            previously_earned_points=0.0,
            earned_points=4.0,
            remaining_points=4.0,
            status="in_progress",
            deadline=now + timedelta(days=60)
        )

        # Goal 4 (Q2): Elena 12 points, 100% completed
        g4_elena = PerformanceGoal(
            tenant_id=tenant1.id,
            cycle_id=cycle_q2.id,
            user_id=elena.id,
            created_by=vikram.id,
            title="Multi-Cloud Resilience & Azure Service Bus Ingestion",
            description="High-availability fallback across regions with zero message drop guarantee.",
            assigned_points=12.0,
            target_percentage=100.0,
            current_progress_percentage=100.0,
            previously_earned_points=0.0,
            earned_points=12.0,
            remaining_points=0.0,
            status="completed",
            deadline=now + timedelta(days=45)
        )

        # Goal 5 (Q2): Rohan 6 points, 40% completed
        g5_rohan = PerformanceGoal(
            tenant_id=tenant1.id,
            cycle_id=cycle_q2.id,
            user_id=rohan.id,
            created_by=vikram.id,
            title="Redis Ingestion Layer & Memory Profile Benchmarking",
            description="Benchmark sub-50ms Redis responses under 100 concurrent distributed tenant streams.",
            assigned_points=6.0,
            target_percentage=100.0,
            current_progress_percentage=40.0,
            previously_earned_points=0.0,
            earned_points=2.4,
            remaining_points=3.6,
            status="in_progress",
            deadline=now + timedelta(days=45)
        )

        db.add_all([g2_priya_q2, g3_priya_new, g4_elena, g5_rohan])

        db.add(AuditLog(
            action="seed_phase2_initialization",
            model_used="Deterministic Demo AI (Offline)",
            prompt_version="v2.0",
            input_summary="Phase 2 Seed: Dual Hierarchies, 2 Sprints, 20 Tasks, Points, and Evidence",
            output_summary="12 users, 2 sprints, 20 tasks, 3 channels, 60 messages, 5 blockers created"
        ))

        db.commit()
        print("Database seeding completed successfully! All Phase 2 models, sprints, tasks, and hierarchies active.")

    except Exception as e:
        db.rollback()
        print(f"Error during seeding: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
