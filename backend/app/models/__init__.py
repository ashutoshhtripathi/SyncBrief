from datetime import datetime
import json
from sqlalchemy import Column, Integer, String, Text, Boolean, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), default="member")  # "manager", "member"
    title = Column(String(255), default="Software Engineer")
    avatar_url = Column(String(500), nullable=True)
    timezone = Column(String(100), default="Asia/Kolkata")
    reminder_time = Column(String(20), default="09:30")
    streak_count = Column(Integer, default=3)
    created_at = Column(DateTime, default=datetime.utcnow)

    checkins = relationship("Checkin", back_populates="user")

class Channel(Base):
    __tablename__ = "channels"

    id = Column(Integer, primary_key=True, index=True)
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

class Checkin(Base):
    __tablename__ = "checkins"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user_name = Column(String(255), nullable=False)
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
    blockers = relationship("Blocker", back_populates="checkin", cascade="all, delete-orphan")

class Blocker(Base):
    __tablename__ = "blockers"

    id = Column(Integer, primary_key=True, index=True)
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
    action = Column(String(100), nullable=False) # e.g. "blocker_extraction", "digest_generation"
    model_used = Column(String(100), nullable=False)
    prompt_version = Column(String(50), nullable=False)
    input_message_ids_json = Column(Text, default="[]")
    input_summary = Column(Text, default="")
    output_summary = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

class SystemSetting(Base):
    __tablename__ = "settings"

    key = Column(String(100), primary_key=True)
    value_json = Column(Text, nullable=False)
