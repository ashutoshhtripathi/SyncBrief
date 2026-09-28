from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
from datetime import datetime

# --- Auth Schemas ---
class LoginRequest(BaseModel):
    email: str
    password: str

class DemoLoginRequest(BaseModel):
    role: str = "manager" # "manager" or "member"
    user_id: Optional[int] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

class UserProfile(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    title: str
    avatar_url: Optional[str]
    timezone: str
    reminder_time: str
    streak_count: int

    class Config:
        from_attributes = True

# --- Check-in Schemas ---
class CheckinCreate(BaseModel):
    yesterday: str
    today: str
    blockers_text: Optional[str] = ""
    mood: int = Field(default=4, ge=1, le=5)
    pr_link: Optional[str] = None
    work_item_id: Optional[str] = None
    status: str = "submitted" # "submitted" or "draft"

class CheckinResponse(BaseModel):
    id: int
    user_id: int
    user_name: str
    yesterday: str
    today: str
    blockers_text: Optional[str]
    mood: int
    pr_link: Optional[str]
    work_item_id: Optional[str]
    status: str
    streak_count: int
    ai_processed: bool
    created_at: datetime
    blockers: List[Any] = []

    class Config:
        from_attributes = True

# --- Citation & Blocker Schemas ---
class CitationItem(BaseModel):
    message_id: str
    channel: str
    author: str
    timestamp: Optional[str] = None
    quote: str
    status: str = "UNVERIFIED" # "VERIFIED" or "UNVERIFIED"
    rejection_reason: Optional[str] = None

class BlockerExtractionResult(BaseModel):
    blocker_summary: str
    severity: str = "medium" # "low", "medium", "high"
    owner: str
    blocked_by: str
    related_work_item: Optional[str] = None
    confidence: float = 0.90
    citations: List[CitationItem] = []

class BlockerResponse(BaseModel):
    id: int
    checkin_id: Optional[int]
    summary: str
    severity: str
    status: str
    owner_name: str
    blocked_by: str
    related_work_item: Optional[str]
    confidence: float
    citations: List[CitationItem]
    devops_work_item_id: Optional[str]
    devops_payload: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class BlockerStatusUpdate(BaseModel):
    status: str # "open", "in_progress", "resolved"

class CreateDevOpsWorkItemRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    area_path: Optional[str] = "SyncBrief-Core\\Backend"
    iteration_path: Optional[str] = "SyncBrief-Core\\Sprint 42"

# --- Channel & Message Schemas ---
class MessageCreate(BaseModel):
    channel_name: str
    content: str
    thread_id: Optional[str] = None

class MessageResponse(BaseModel):
    id: str
    channel_id: int
    channel_name: str
    author_name: str
    author_avatar: Optional[str]
    content: str
    thread_id: Optional[str]
    timestamp: datetime

    class Config:
        from_attributes = True

class ChannelResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    is_syncbrief_enabled: bool
    member_count: int

    class Config:
        from_attributes = True

class ChannelToggleRequest(BaseModel):
    is_syncbrief_enabled: bool

# --- Digest Schemas ---
class PersonProgress(BaseModel):
    name: str
    yesterday: str
    today: str
    mood: int
    has_blockers: bool

class DigestResponse(BaseModel):
    id: int
    date: str
    progress_by_person: List[Dict[str, Any]]
    blockers_summary: List[Dict[str, Any]]
    risks: List[str]
    missing_checkins: List[str]
    suggested_actions: List[str]
    markdown_content: str
    teams_card_json: Dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True

# --- Insights Schemas ---
class SavingsAssumption(BaseModel):
    team_size: int = 6
    meeting_duration_minutes: int = 30
    working_days_per_month: int = 22
    hourly_rate_usd: float = 75.0

class InsightsResponse(BaseModel):
    checkin_rate_pct: float
    active_blockers_count: int
    avg_resolution_hours: float
    meeting_time_saved_hours: float
    cost_saved_usd: float
    mood_trend: List[Dict[str, Any]]
    blockers_by_severity: Dict[str, int]
    blockers_resolved_trend: List[Dict[str, Any]]
    assumptions: SavingsAssumption
