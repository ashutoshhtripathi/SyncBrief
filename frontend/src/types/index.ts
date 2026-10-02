export interface User {
  id: number;
  email: string;
  full_name: string;
  role: 'manager' | 'member' | 'admin' | 'director' | 'employee';
  title: string;
  avatar_url?: string;
  timezone: string;
  reminder_time: string;
  streak_count: number;
  role_level?: number;
  reports_to_id?: number | null;
  org_type?: 'engineering' | 'university';
  manager_name?: string | null;
  tenant_id?: number;
  tenant_name?: string;
}

export interface CitationItem {
  message_id: string;
  channel: string;
  author: string;
  timestamp?: string;
  quote: string;
  status: 'VERIFIED' | 'UNVERIFIED';
  rejection_reason?: string;
}

export interface Blocker {
  id: number;
  checkin_id?: number;
  summary: string;
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'resolved';
  owner_name: string;
  blocked_by: string;
  related_work_item?: string;
  confidence: number;
  citations: CitationItem[];
  devops_work_item_id?: string;
  devops_payload?: string;
  created_at: string;
  updated_at: string;
}

export interface Sprint {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  status: 'planned' | 'active' | 'closed';
  goal?: string;
  task_count?: number;
  created_at?: string;
}

export interface Task {
  id: number;
  title: string;
  description?: string;
  assignee_id?: number | null;
  assignee_name?: string | null;
  assignee_avatar?: string | null;
  priority: 'High' | 'Medium' | 'Low';
  difficulty: number; // 1, 2, 3, 5, 8
  status: 'To do' | 'In progress' | 'Blocked' | 'Done';
  progress_pct: number;
  carried_over_count: number;
  version?: number;
  sprint_id?: number | null;
  sprint_name?: string | null;
  due_date?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Checkin {
  id: number;
  user_id: number;
  user_name: string;
  task_id?: number | null;
  task_title?: string | null;
  progress_pct?: number;
  progress_note?: string;
  next_steps?: string;
  sync_needed_with?: string[];
  other_task_ids?: number[];
  yesterday: string;
  today: string;
  blockers_text?: string;
  mood: number;
  pr_link?: string;
  work_item_id?: string;
  status: string;
  streak_count: number;
  ai_processed: boolean;
  created_at: string;
  blockers?: Blocker[];
}

export interface PersonProgress {
  name: string;
  yesterday: string;
  today: string;
  mood: number;
  has_blockers: boolean;
}

export interface Digest {
  id: number;
  date: string;
  progress_by_person: PersonProgress[];
  blockers_summary: {
    summary: string;
    severity: string;
    owner: string;
    blocked_by: string;
    citation_count: number;
  }[];
  risks: string[];
  missing_checkins: string[];
  suggested_actions: string[];
  markdown_content: string;
  teams_card_json: any;
  created_at: string;
}

export interface Channel {
  id: number;
  name: string;
  description?: string;
  is_syncbrief_enabled: boolean;
  member_count: number;
}

export interface Message {
  id: string;
  channel_id: number;
  channel_name: string;
  author_name: string;
  author_avatar?: string;
  content: string;
  thread_id?: string;
  timestamp: string;
}

export interface TimezoneMember {
  user_id: number;
  full_name: string;
  role: string;
  avatar_url?: string;
  timezone: string;
  tz_abbr: string;
  local_time_str: string;
  reminder_time: string;
  is_online: boolean;
  streak_count: number;
}

export interface InsightsData {
  checkin_rate_pct: number;
  active_blockers_count: number;
  avg_resolution_hours: number;
  meeting_time_saved_hours: number;
  cost_saved_usd: number;
  mood_trend: { date: string; avg_mood: number; checkin_count: number }[];
  blockers_by_severity: {
    high: number;
    medium: number;
    low: number;
  };
  timezone_strip: TimezoneMember[];
  assumptions: {
    team_size: number;
    meeting_duration_minutes: number;
    working_days_per_month: number;
    hourly_rate_usd: number;
  };
}

export interface SystemStatus {
  status: string;
  app_name: string;
  version: string;
  boot_id?: string;
  ai_provider: string;
  is_mock: boolean;
  badge_label: string;
  azure_openai_configured: boolean;
  teams_configured: boolean;
  devops_configured: boolean;
}

export interface AuditLogItem {
  id: number;
  action: string;
  model_used: string;
  prompt_version: string;
  input_summary: string;
  output_summary: string;
  created_at: string;
}

export interface TaskPointDetail {
  task_id: number;
  title: string;
  difficulty: number;
  carried_over_count: number;
  penalty_pct_applied: number;
  earned_points: number;
  status: string;
  completed_at?: string | null;
}

export interface PointsSummary {
  user_id: number;
  user_name: string;
  title: string;
  quarter: string;
  total_points: number;
  tasks_completed_on_time: number;
  tasks_carried_over: number;
  on_time_rate_pct: number;
  checkin_streak: number;
  checkin_consistency_pct: number;
  blockers_resolved: number;
  carry_over_penalty_pct: number;
  formula_text: string;
  tasks: TaskPointDetail[];
  points_per_sprint: { sprint_id: number; sprint_name: string; points: number }[];
}

export interface AppraisalEmployee {
  user_id: number;
  full_name: string;
  role: string;
  title: string;
  avatar_url?: string;
  role_level: number;
  manager_name?: string | null;
  quarter: string;
  total_points: number;
  tasks_completed: number;
  on_time_rate_pct: number;
  carry_over_count: number;
  blockers_raised: number;
  blockers_resolved: number;
  checkin_consistency_pct: number;
  appraisal_score: number;
  rating_category: string;
}

export interface AppraisalReport {
  manager_id: number;
  manager_name: string;
  quarter: string;
  carry_over_penalty_pct: number;
  formula_text: string;
  employees: AppraisalEmployee[];
}

export interface HierarchyNode {
  id: number;
  name: string;
  title: string;
  role: string;
  role_level: number;
  email: string;
  avatar_url?: string;
  reports_to_id?: number | null;
  org_type: string;
  children: HierarchyNode[];
}

export interface JiraImportResult {
  imported_count: number;
  sprint_id?: number | null;
  tasks: Task[];
  errors: string[];
}

// ==========================================
// Performance Points & Goals Types
// ==========================================

export interface PerformanceCycle {
  id: number;
  tenant_id: number;
  name: string;
  start_date: string;
  end_date: string;
  status: 'active' | 'closed';
  description?: string | null;
  created_at: string;
  goals_count: number;
  completed_goals_count: number;
  is_active?: boolean; // helper mapped to status === 'active'
}

export interface PerformanceGoal {
  id: number;
  tenant_id: number;
  cycle_id: number;
  cycle_name?: string | null;
  user_id: number;
  employee_name?: string | null;
  employee_email?: string | null;
  created_by: number;
  manager_name?: string | null;
  title: string;
  description?: string | null;
  category?: string | null;
  assigned_points: number;
  target_percentage: number;
  target_pct?: number;
  current_progress_percentage: number;
  current_progress_pct?: number;
  previously_earned_points: number;
  earned_points: number;
  remaining_points: number;
  status: string;
  deadline?: string | null;
  source_task_id?: number | null;
  source_task_title?: string | null;
  task_id?: number | null;
  task_title?: string | null;
  carried_from_goal_id?: number | null;
  progress_note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PerformanceSummaryEmployee {
  user_id: number;
  full_name: string;
  title: string;
  role_level: number;
  manager_name?: string | null;
  cycle_name: string;
  cycle_is_active?: boolean;
  total_assigned_points: number;
  total_previously_earned_points: number;
  total_cycle_earned_points: number;
  total_earned_points?: number;
  total_remaining_points: number;
  total_lifetime_earned_points: number;
  completion_rate_pct: number;
  goals_count: number;
  total_goals_count?: number;
  completed_goals_count: number;
  in_progress_goals_count?: number;
  carried_forward_goals_count: number;
  goals: PerformanceGoal[];
}

export interface PerformanceAppraisalEvidenceItem {
  user_id: number;
  full_name: string;
  role: string;
  title: string;
  avatar_url?: string | null;
  role_level: number;
  manager_name?: string | null;
  cycle_name: string;
  total_assigned_points: number;
  total_earned_points: number;
  total_remaining_points: number;
  completion_rate_pct: number;
  achievement_rate_pct?: number;
  goals_count: number;
  goals_total?: number;
  completed_goals_count: number;
  goals_completed?: number;
  carried_forward_goals_count: number;
  carried_goals_count?: number;
  employee_id?: number;
  employee_name?: string;
  employee_title?: string;
  goals?: PerformanceGoal[];
}

export interface PerformanceAppraisalEvidenceResponse {
  cycle_id?: number | null;
  cycle_name: string;
  manager_id: number;
  manager_name: string;
  evidence_note: string;
  employees: PerformanceAppraisalEvidenceItem[];
  items?: PerformanceAppraisalEvidenceItem[];
}

export interface OAuthProviderConfig {
  enabled: boolean;
  client_id: string | null;
  redirect_uri: string;
  auth_endpoint: string;
  tenant_id?: string | null;
}

export interface OAuthConfig {
  google: OAuthProviderConfig;
  microsoft: OAuthProviderConfig;
}

export interface OAuthCallbackPayload {
  provider: 'google' | 'microsoft';
  code: string;
  redirect_uri: string;
  code_verifier?: string;
}
