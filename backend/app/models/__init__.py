from datetime import datetime
import json
from sqlalchemy import Column, Integer, String, Text, Boolean, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.database import Base

class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    domain = Column(String(255), unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    users = relationship("User", back_populates="tenant")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), default="member")  # "manager", "member", "admin"
    title = Column(String(255), default="Software Engineer")
    avatar_url = Column(String(500), nullable=True)
    timezone = Column(String(100), default="Asia/Kolkata")
    reminder_time = Column(String(20), default="09:30")
    streak_count = Column(Integer, default=3)
    
    # Multi-tenancy
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, default=1, index=True)

    # Hierarchy & RBAC
    role_level = Column(Integer, default=5)  # 1 = Top (Director), 2 = Manager, 3 = Employee
    reports_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    org_type = Column(String(50), default="engineering")
    
    # Security & Soft Delete
    refresh_token = Column(String(500), nullable=True)
    auth_provider = Column(String(50), default="local")  # "local", "google", "microsoft"
    auth_provider_id = Column(String(255), nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    tenant = relationship("Tenant", back_populates="users")
    checkins = relationship("Checkin", back_populates="user", cascade="all, delete-orphan")
    manager = relationship("User", remote_side=[id], backref="direct_reports")

class Channel(Base):
    __tablename__ = "channels"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, default=1, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False) # e.g. #backend
    description = Column(String(255), nullable=True)
    is_syncbrief_enabled = Column(Boolean, default=True) # Privacy flag: only read if enabled
    member_count = Column(Integer, default=6)
    created_at = Column(DateTime, default=datetime.utcnow)

    messages = relationship("Message", back_populates="channel", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"

    id = Column(String(100), primary_key=True, index=True) # e.g. msg_492
    channel_id = Column(Integer, ForeignKey("channels.id"), nullable=False)
    channel_name = Column(String(100), nullable=False) # e.g. #backend
    author_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    author_name = Column(String(255), nullable=False)
    author_avatar = Column(String(500), nullable=True)
    content = Column(Text, nullable=False)
    thread_id = Column(String(100), nullable=True) # e.g. thread_492
    timestamp = Column(DateTime, default=datetime.utcnow)

    channel = relationship("Channel", back_populates="messages")

class Sprint(Base):
    __tablename__ = "sprints"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, default=1, index=True)
    name = Column(String(100), nullable=False)  # e.g. "Sprint 42"
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    status = Column(String(50), default="active")  # "planned", "active", "closed"
    goal = Column(Text, nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    tasks = relationship("Task", back_populates="sprint")

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, default=1, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, default="")
    assignee_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    assignee_name = Column(String(255), default="")
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    priority = Column(String(20), default="Medium")  # "High", "Medium", "Low"
    difficulty = Column(Integer, default=3)  # 1, 2, 3, 5, 8 (Fibonacci difficulty points)
    status = Column(String(50), default="To do")  # "To do", "In progress", "Blocked", "Done"
    progress_pct = Column(Integer, default=0)  # 0 to 100
    sprint_id = Column(Integer, ForeignKey("sprints.id"), nullable=True)
    carried_over_count = Column(Integer, default=0)
    version = Column(Integer, default=1, nullable=False)  # Optimistic concurrency locking
    deleted_at = Column(DateTime, nullable=True)  # Soft delete
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sprint = relationship("Sprint", back_populates="tasks")
    assignee = relationship("User", foreign_keys=[assignee_id])

class Checkin(Base):
    __tablename__ = "checkins"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, default=1, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user_name = Column(String(255), nullable=False)
    
    # Task-based fields
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    task_title = Column(String(255), nullable=True)
    progress_pct = Column(Integer, default=0)
    progress_note = Column(Text, default="")
    next_steps = Column(Text, default="")
    sync_needed_with_json = Column(Text, default="[]")
    other_task_ids_json = Column(Text, default="[]")

    # Original fields for backward compatibility & rich standup summary
    yesterday = Column(Text, nullable=False)
    today = Column(Text, nullable=False)
    blockers_text = Column(Text, default="")
    mood = Column(Integer, default=4) # 1 to 5
    pr_link = Column(String(500), nullable=True)
    work_item_id = Column(String(100), nullable=True)
    status = Column(String(50), default="submitted") # "draft", "submitted"
    streak_count = Column(Integer, default=1)
    ai_processed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="checkins")
    task = relationship("Task")
    blockers = relationship("Blocker", back_populates="checkin", cascade="all, delete-orphan")

    @property
    def sync_needed_with(self):
        try:
            return json.loads(self.sync_needed_with_json or "[]")
        except Exception:
            return []

    @sync_needed_with.setter
    def sync_needed_with(self, val):
        self.sync_needed_with_json = json.dumps(val or [])

    @property
    def other_task_ids(self):
        try:
            return json.loads(self.other_task_ids_json or "[]")
        except Exception:
            return []

    @other_task_ids.setter
    def other_task_ids(self, val):
        self.other_task_ids_json = json.dumps(val or [])

class Blocker(Base):
    __tablename__ = "blockers"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, default=1, index=True)
    checkin_id = Column(Integer, ForeignKey("checkins.id"), nullable=True)
    summary = Column(Text, nullable=False)
    severity = Column(String(50), default="medium") # "low", "medium", "high"
    status = Column(String(50), default="open")     # "open", "in_progress", "resolved"
    owner_name = Column(String(255), nullable=False)
    blocked_by = Column(String(255), default="Unassigned")
    related_work_item = Column(String(100), nullable=True)
    confidence = Column(Float, default=0.92)
    citations_json = Column(Text, default="[]")     # JSON array of citations
    devops_work_item_id = Column(String(100), nullable=True) # e.g. ADO-4821
    devops_payload = Column(Text, nullable=True)    # JSON string of payload
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    checkin = relationship("Checkin", back_populates="blockers")

    @property
    def citations(self):
        try:
            return json.loads(self.citations_json)
        except Exception:
            return []

    @citations.setter
    def citations(self, val):
        self.citations_json = json.dumps(val)

class Digest(Base):
    __tablename__ = "digests"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, default=1, index=True)
    date = Column(String(50), index=True, nullable=False) # e.g. "2026-09-29"
    progress_by_person_json = Column(Text, default="[]")
    blockers_summary_json = Column(Text, default="[]")
    risks_json = Column(Text, default="[]")
    missing_checkins_json = Column(Text, default="[]")
    suggested_actions_json = Column(Text, default="[]")
    markdown_content = Column(Text, default="")
    teams_card_json = Column(Text, default="{}")
    created_at = Column(DateTime, default=datetime.utcnow)

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, default=1, index=True)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    actor_name = Column(String(255), nullable=True)
    action = Column(String(100), nullable=False) # e.g. "CREATE_TASK", "UPDATE_TASK", "STATUS_CHANGE", "CLOSE_SPRINT", "ROLE_CHANGE", "DIGEST_GENERATED"
    entity_type = Column(String(50), nullable=True) # e.g. "task", "sprint", "user", "point", "ai"
    entity_id = Column(Integer, nullable=True)
    old_values_json = Column(Text, nullable=True)
    new_values_json = Column(Text, nullable=True)
    model_used = Column(String(100), nullable=True)
    prompt_version = Column(String(50), nullable=True)
    input_message_ids_json = Column(Text, default="[]")
    input_summary = Column(Text, default="")
    output_summary = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    actor = relationship("User", foreign_keys=[actor_id])

class SystemSetting(Base):
    __tablename__ = "settings"

    key = Column(String(100), primary_key=True)
    value_json = Column(Text, nullable=False)

class PerformanceCycle(Base):
    __tablename__ = "performance_cycles"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, default=1, index=True)
    name = Column(String(100), nullable=False)          # e.g., "2026-Q1", "2026-Q2"
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    status = Column(String(50), default="active")       # "draft", "active", "closed"
    description = Column(Text, nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    goals = relationship("PerformanceGoal", back_populates="cycle", cascade="all, delete-orphan")

class PerformanceGoal(Base):
    __tablename__ = "performance_goals"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, default=1, index=True)
    cycle_id = Column(Integer, ForeignKey("performance_cycles.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)      # Employee
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)               # Manager/Director
    
    title = Column(String(255), nullable=False)
    description = Column(Text, default="")
    category = Column(String(50), default="delivery")
    
    # Points & Delivery
    assigned_points = Column(Float, nullable=False)             # Total lifetime goal points (e.g. 10.0)
    target_percentage = Column(Float, default=100.0)            # 100%
    current_progress_percentage = Column(Float, default=0.0)    # Progress reached (e.g. 70.0%)
    
    # Non-duplicating points breakdown
    previously_earned_points = Column(Float, default=0.0)       # Locked points from prior cycle (e.g. 7.0)
    earned_points = Column(Float, default=0.0)                  # Earned strictly in this cycle (e.g. 3.0)
    remaining_points = Column(Float, default=0.0)               # Remaining available to earn
    
    status = Column(String(50), default="in_progress")          # "in_progress", "completed", "carried_forward", "cancelled"
    deadline = Column(DateTime, nullable=True)
    
    # Linkages
    source_task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    carried_from_goal_id = Column(Integer, ForeignKey("performance_goals.id"), nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    cycle = relationship("PerformanceCycle", back_populates="goals")
    employee = relationship("User", foreign_keys=[user_id])
    manager = relationship("User", foreign_keys=[created_by])
    source_task = relationship("Task", foreign_keys=[source_task_id])
    carried_from = relationship("PerformanceGoal", remote_side=[id], backref="carried_to_goals")
