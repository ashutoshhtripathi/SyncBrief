from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Any, Dict
from datetime import datetime

# --- Auth & User Schemas ---
class LoginRequest(BaseModel):
    email: str
    password: str

class DemoLoginRequest(BaseModel):
    role: str = "manager" # "manager", "member", "admin"
    user_id: Optional[int] = None

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    user: Dict[str, Any]

class OAuthCallbackRequest(BaseModel):
    provider: str  # "google" | "microsoft"
    code: str
    redirect_uri: str
    code_verifier: Optional[str] = None
    state: Optional[str] = None

class OAuthPendingResponse(BaseModel):
    requires_password_verification: bool = True
    pending_token: str
    email: str
    provider: str
    user_name: Optional[str] = None

class OAuthPasswordVerifyRequest(BaseModel):
    pending_token: str
    password: str


class OAuthProviderConfig(BaseModel):
    enabled: bool
    client_id: Optional[str] = None
    redirect_uri: str
    auth_endpoint: str
    tenant_id: Optional[str] = None

class OAuthConfigResponse(BaseModel):
    google: OAuthProviderConfig
    microsoft: OAuthProviderConfig

class OAuthStartResponse(BaseModel):
    provider: str
    authorization_url: str
    state: str
    code_verifier: Optional[str] = None

class TenantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    domain: str
    created_at: Optional[datetime] = None

class UserProfile(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    role: str
    title: str
    avatar_url: Optional[str] = None
    timezone: str = "Asia/Kolkata"
    reminder_time: str = "09:30"
    streak_count: int = 0
    role_level: int = 5
    reports_to_id: Optional[int] = None
    org_type: str = "engineering"
    manager_name: Optional[str] = None
    tenant_id: Optional[int] = 1
    tenant_name: Optional[str] = "SyncBrief Enterprise"

class UserCreate(BaseModel):
    email: str
    password: str = Field(..., min_length=6, description="Initial password for the user account")
    confirm_password: Optional[str] = Field(None, description="Confirmation of initial password")
    full_name: str
    role: str = "member"
    title: str = "Software Engineer"
    avatar_url: Optional[str] = None
    timezone: str = "Asia/Kolkata"
    reminder_time: str = "09:30"
    role_level: int = 5
    reports_to_id: Optional[int] = None
    org_type: str = "engineering"
    tenant_id: Optional[int] = 1

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    title: Optional[str] = None
    role: Optional[str] = None
    avatar_url: Optional[str] = None
    timezone: Optional[str] = None
    reminder_time: Optional[str] = None
    role_level: Optional[int] = None
    reports_to_id: Optional[int] = None
    org_type: Optional[str] = None

# --- Organization Invitation Schemas ---
class InvitationCreate(BaseModel):
    email: str
    full_name: Optional[str] = None
    role: str = "member"
    role_level: int = 3
    title: str = "Software Engineer"
    reports_to_id: Optional[int] = None
    org_type: str = "engineering"

class InvitationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tenant_id: int
    email: str
    full_name: Optional[str] = None
    role: str
    role_level: int
    title: str
    reports_to_id: Optional[int] = None
    org_type: str
    invited_by_id: int
    status: str
    created_at: datetime
    accepted_at: Optional[datetime] = None

# --- Sprint Schemas ---
class SprintCreate(BaseModel):
    name: str
    start_date: datetime
    end_date: datetime
    status: str = "planned" # "planned", "active", "closed"
    goal: Optional[str] = None

class SprintUpdate(BaseModel):
    name: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: Optional[str] = None
    goal: Optional[str] = None

class SprintCloseRequest(BaseModel):
    target_sprint_id: Optional[int] = None # Next sprint to move unfinished tasks to
    create_next_sprint: bool = False
    next_sprint_name: Optional[str] = None

class SprintResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    start_date: datetime
    end_date: datetime
    status: str
    goal: Optional[str] = None
    created_at: datetime
    task_count: int = 0
    completed_task_count: int = 0

# --- Task Schemas ---
class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    assignee_id: Optional[int] = None
    priority: str = "Medium" # "High", "Medium", "Low"
    difficulty: int = Field(default=3, ge=1, le=8) # 1, 2, 3, 5, 8
    status: str = "To do" # "To do", "In progress", "Blocked", "Done"
    progress_pct: int = Field(default=0, ge=0, le=100)
    sprint_id: Optional[int] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assignee_id: Optional[int] = None
    priority: Optional[str] = None
    difficulty: Optional[int] = None
    status: Optional[str] = None
    progress_pct: Optional[int] = None
    sprint_id: Optional[int] = None
    version: Optional[int] = None

class TaskStatusUpdate(BaseModel):
    status: str # "To do", "In progress", "Blocked", "Done"
    progress_pct: Optional[int] = None
    version: Optional[int] = None

class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: Optional[str] = ""
    assignee_id: Optional[int] = None
    assignee_name: Optional[str] = ""
    assignee_avatar: Optional[str] = None
    creator_id: Optional[int] = None
    priority: str = "Medium"
    difficulty: int = 3
    status: str = "To do"
    progress_pct: int = 0
    sprint_id: Optional[int] = None
    sprint_name: Optional[str] = None
    carried_over_count: int = 0
    earned_points: float = 0.0
    version: int = 1
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

# --- Task-Based Check-in Schemas ---
class CheckinCreate(BaseModel):
    # Task-based fields
    task_id: Optional[int] = None
    task_title: Optional[str] = None
    progress_pct: Optional[int] = 0
    progress_note: Optional[str] = ""
    next_steps: Optional[str] = ""
    sync_needed_with: Optional[List[str]] = []
    other_task_ids: Optional[List[int]] = []

    # Original / summary fields
    yesterday: Optional[str] = ""
    today: Optional[str] = ""
    blockers_text: Optional[str] = ""
    mood: int = Field(default=4, ge=1, le=5)
    pr_link: Optional[str] = None
    work_item_id: Optional[str] = None
    status: str = "submitted" # "submitted" or "draft"

class CheckinResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    user_name: str
    task_id: Optional[int] = None
    task_title: Optional[str] = None
    progress_pct: Optional[int] = 0
    progress_note: Optional[str] = ""
    next_steps: Optional[str] = ""
    sync_needed_with: Optional[List[str]] = []
    other_task_ids: Optional[List[int]] = []
    yesterday: str
    today: str
    blockers_text: Optional[str] = None
    mood: int
    pr_link: Optional[str] = None
    work_item_id: Optional[str] = None
    status: str
    streak_count: int
    ai_processed: bool
    created_at: datetime
    blockers: List[Any] = []

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
    severity: str = "medium"
    owner: str
    blocked_by: str
    related_work_item: Optional[str] = None
    confidence: float = 0.90
    citations: List[CitationItem] = []

class BlockerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    checkin_id: Optional[int] = None
    summary: str
    severity: str
    status: str
    owner_name: str
    blocked_by: str
    related_work_item: Optional[str] = None
    confidence: float
    citations: List[CitationItem] = []
    devops_work_item_id: Optional[str] = None
    devops_payload: Optional[str] = None
    created_at: datetime
    updated_at: datetime

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
    model_config = ConfigDict(from_attributes=True)

    id: str
    channel_id: int
    channel_name: str
    author_name: str
    author_avatar: Optional[str] = None
    content: str
    thread_id: Optional[str] = None
    timestamp: datetime

class ChannelResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    is_syncbrief_enabled: bool
    member_count: int

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
    model_config = ConfigDict(from_attributes=True)

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
    assumptions: SavingsAssumption

# --- Points & Appraisal Schemas ---
class TaskPointDetail(BaseModel):
    task_id: int
    title: str
    difficulty: int
    carried_over_count: int
    penalty_pct_applied: float
    earned_points: float
    status: str
    completed_at: Optional[datetime] = None

class PointsSummaryResponse(BaseModel):
    user_id: int
    user_name: str
    title: str
    quarter: str
    total_points: float
    tasks_completed_on_time: int
    tasks_carried_over: int
    on_time_rate_pct: float
    checkin_streak: int
    checkin_consistency_pct: float
    blockers_resolved: int
    carry_over_penalty_pct: float
    formula_text: str
    tasks: List[TaskPointDetail] = []
    points_per_sprint: List[Dict[str, Any]] = []

class AppraisalEmployeeItem(BaseModel):
    user_id: int
    full_name: str
    role: str
    title: str
    avatar_url: Optional[str] = None
    role_level: int
    manager_name: Optional[str] = None
    quarter: str
    total_points: float
    tasks_completed: int
    on_time_rate_pct: float
    carry_over_count: int
    blockers_raised: int
    blockers_resolved: int
    checkin_consistency_pct: float
    appraisal_score: float # e.g. 4.6 / 5.0
    rating_category: str # "Exceeds Expectations", "Meets Expectations", etc.

class AppraisalReportResponse(BaseModel):
    manager_id: int
    manager_name: str
    quarter: str
    carry_over_penalty_pct: float
    formula_text: str
    employees: List[AppraisalEmployeeItem] = []

# --- Jira Import Schemas ---
class JiraImportRequest(BaseModel):
    csv_content: str
    target_sprint_id: Optional[int] = None

class JiraImportResponse(BaseModel):
    imported_count: int
    sprint_id: Optional[int]
    tasks: List[TaskResponse] = []
    errors: List[str] = []

# --- Performance Points & Goals Schemas ---
class PerformanceCycleCreate(BaseModel):
    name: str
    start_date: datetime
    end_date: datetime
    status: str = "active" # "draft", "active", "closed"
    description: Optional[str] = None

class PerformanceCycleUpdate(BaseModel):
    name: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: Optional[str] = None
    description: Optional[str] = None

class PerformanceCycleCloseRequest(BaseModel):
    target_cycle_id: Optional[int] = None # Next cycle to carry forward incomplete goals to
    auto_carry_forward: bool = True
    goal_ids_to_carry: Optional[List[int]] = None # If specified, carries specific goals; otherwise carries all incomplete

class PerformanceCycleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    start_date: datetime
    end_date: datetime
    status: str
    description: Optional[str] = None
    tenant_id: int
    created_at: datetime
    goals_count: int = 0
    completed_goals_count: int = 0
    is_active: Optional[bool] = None

class PerformanceGoalCreate(BaseModel):
    cycle_id: int
    user_id: int # employee
    title: str
    description: Optional[str] = ""
    assigned_points: float # must be > 0
    target_percentage: float = 100.0
    category: Optional[str] = "delivery"
    deadline: Optional[datetime] = None
    source_task_id: Optional[int] = None

class PerformanceGoalUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assigned_points: Optional[float] = None
    target_percentage: Optional[float] = None
    category: Optional[str] = None
    deadline: Optional[datetime] = None
    source_task_id: Optional[int] = None
    status: Optional[str] = None

class PerformanceGoalProgressUpdate(BaseModel):
    current_progress_percentage: float # 0.0 to 100.0
    sync_with_task: Optional[bool] = False

class PerformanceGoalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    cycle_id: int
    cycle_name: Optional[str] = None
    user_id: int
    employee_name: Optional[str] = None
    employee_email: Optional[str] = None
    created_by: int
    manager_name: Optional[str] = None
    title: str
    description: str
    assigned_points: float
    target_percentage: float
    current_progress_percentage: float
    previously_earned_points: float
    earned_points: float
    remaining_points: float
    status: str
    category: Optional[str] = "delivery"
    current_progress_pct: Optional[float] = None
    target_pct: Optional[float] = None
    task_id: Optional[int] = None
    task_title: Optional[str] = None
    deadline: Optional[datetime] = None
    source_task_id: Optional[int] = None
    source_task_title: Optional[str] = None
    carried_from_goal_id: Optional[int] = None
    tenant_id: int
    created_at: datetime
    updated_at: datetime

class PerformanceSummaryEmployee(BaseModel):
    user_id: int
    full_name: str
    title: str
    role_level: int
    manager_name: Optional[str] = None
    cycle_name: str
    total_assigned_points: float
    total_previously_earned_points: float
    total_cycle_earned_points: float
    total_remaining_points: float
    total_lifetime_earned_points: float
    completion_rate_pct: float
    goals_count: int
    completed_goals_count: int
    carried_forward_goals_count: int
    total_earned_points: Optional[float] = None
    total_goals_count: Optional[int] = None
    in_progress_goals_count: Optional[int] = None
    cycle_is_active: Optional[bool] = None
    goals: List[PerformanceGoalResponse] = []

class PerformanceAppraisalEvidenceItem(BaseModel):
    user_id: int
    full_name: str
    role: str
    title: str
    avatar_url: Optional[str] = None
    role_level: int
    manager_name: Optional[str] = None
    cycle_name: str
    total_assigned_points: float
    total_earned_points: float
    total_remaining_points: float
    completion_rate_pct: float
    goals_count: int
    completed_goals_count: int
    carried_forward_goals_count: int
    goals: List[PerformanceGoalResponse] = []

class PerformanceAppraisalEvidenceResponse(BaseModel):
    cycle_id: Optional[int] = None
    cycle_name: str
    manager_id: int
    manager_name: str
    evidence_note: str = "Performance points represent objective goal delivery evidence for human manager review; promotion and rating decisions are not automated."
    employees: List[PerformanceAppraisalEvidenceItem] = []
    items: Optional[List[PerformanceAppraisalEvidenceItem]] = []

# --- "What Changed Since Yesterday?" Schemas ---
class EvidenceCitation(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    source_type: str  # "task" | "checkin" | "blocker" | "sprint" | "digest"
    source_id: str
    title: str
    author_or_owner: str
    timestamp: Optional[str] = None
    excerpt: str
    verified: bool = False
    rejection_reason: Optional[str] = None

class CompletedWorkItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    task_id: int
    title: str
    owner: str
    completed_at: Optional[str] = None
    difficulty: int = 3
    points_earned: float = 0.0
    evidence: List[EvidenceCitation] = []

class MeaningfulTaskProgressItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    task_id: int
    title: str
    owner: str
    progress_delta_pct: int = 0
    current_progress_pct: int = 0
    note: str = ""
    pr_link: Optional[str] = None
    evidence: List[EvidenceCitation] = []

class SprintProgressDelta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sprint_id: Optional[int] = None
    sprint_name: Optional[str] = None
    total_points: int = 0
    completed_points_yesterday: int = 0
    completed_points_today: int = 0
    delta_points: int = 0
    evidence: List[EvidenceCitation] = []

class CheckinDeltaItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    user_name: str
    yesterday_achievement: str = ""
    today_plan: str = ""
    mood: int = 4
    evidence: List[EvidenceCitation] = []

class ProgressDeltaSection(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    completed_work: List[CompletedWorkItem] = []
    meaningful_task_progress: List[MeaningfulTaskProgressItem] = []
    sprint_progress: Optional[SprintProgressDelta] = None
    checkin_updates: List[CheckinDeltaItem] = []

class NewBlockerItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    blocker_id: int
    summary: str
    severity: str = "medium"
    owner: str
    blocked_by: str = "Unassigned"
    created_at: Optional[str] = None
    evidence: List[EvidenceCitation] = []

class ExistingUnresolvedBlockerItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    blocker_id: int
    summary: str
    severity: str = "medium"
    owner: str
    blocked_by: str = "Unassigned"
    age_days: int = 0
    evidence: List[EvidenceCitation] = []

class BlockersDeltaSection(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    new_blockers: List[NewBlockerItem] = []
    existing_unresolved_blockers: List[ExistingUnresolvedBlockerItem] = []

class RiskItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    risk_id: str
    severity: str = "medium"
    summary: str
    rationale: str
    evidence: List[EvidenceCitation] = []

class AttentionItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    item_id: str
    priority: str = "medium"  # "low", "medium", "urgent"
    action: str
    target_person: str
    suggested_channel: str = "Teams"
    evidence: List[EvidenceCitation] = []

class InsufficientDataInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    is_insufficient: bool = False
    missing_checkins: List[str] = []
    notes: List[str] = []

class TeamScopeInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    manager_id: int
    manager_name: str
    member_count: int = 0
    checked_in_count: int = 0

class WhatChangedResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    target_date: str
    previous_working_day: str
    window_start: str
    window_end: str
    is_weekend_lookback: bool = False
    team_scope: TeamScopeInfo
    progress: ProgressDeltaSection
    blockers: BlockersDeltaSection
    risks: List[RiskItem] = []
    needs_manager_attention: List[AttentionItem] = []
    insufficient_data: InsufficientDataInfo

# --- Performance History & Intelligence Schemas (Phase 5) ---
class QuarterPerformanceDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    cycle_id: int
    cycle_name: str
    year: int
    quarter: str
    status: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    assigned_points: float
    previously_earned_points: float
    cycle_earned_points: float
    lifetime_earned_points: float
    remaining_points: float
    completion_rate_pct: float
    goals_count: int
    active_goals_count: int
    completed_goals_count: int
    carried_forward_goals_count: int
    goals: List[PerformanceGoalResponse] = []

class YearlyPerformanceSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    year: int
    assigned_points: float
    earned_points: float
    lifetime_earned_points: float
    completion_rate_pct: float
    quarters_count: int
    quarters: List[QuarterPerformanceDetail] = []

class PerformanceTrendInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    direction: str  # "improving" | "declining" | "stable" | "insufficient_data"
    delta_pct: Optional[float] = None
    summary: str
    data_points_count: int = 0

class CurrentCycleMetrics(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    cycle_id: int
    cycle_name: str
    year: int
    quarter: str
    status: str
    assigned_points: float
    earned_points: float
    previously_earned_points: float
    lifetime_earned_points: float
    remaining_points: float
    completion_rate_pct: float
    active_goals_count: int
    carried_goals_count: int
    completed_goals_count: int
    total_goals_count: int
    goals: List[PerformanceGoalResponse] = []

class PerformanceHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    full_name: str
    email: Optional[str] = None
    title: str
    role: str
    role_level: int
    manager_name: Optional[str] = None
    current_cycle: Optional[CurrentCycleMetrics] = None
    historical_quarters: List[QuarterPerformanceDetail] = []
    yearly_summaries: List[YearlyPerformanceSummary] = []
    trend: PerformanceTrendInfo
    has_history: bool = True

class TeamPerformanceMemberSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    full_name: str
    email: str
    title: str
    role: str
    role_level: int
    manager_name: Optional[str] = None
    current_cycle_name: Optional[str] = None
    current_completion_pct: Optional[float] = None
    yearly_summaries: List[YearlyPerformanceSummary] = []
    latest_trend: Optional[str] = None
    has_history: bool = True

class TeamPerformanceHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    manager_id: int
    manager_name: str
    is_director: bool
    members: List[TeamPerformanceMemberSummary] = []

