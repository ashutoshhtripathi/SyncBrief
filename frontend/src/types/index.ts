export interface User {
  id: number;
  email: string;
  full_name: string;
  role: 'manager' | 'member';
  title: string;
  avatar_url?: string;
  timezone: string;
  reminder_time: string;
  streak_count: number;
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

export interface Checkin {
  id: number;
  user_id: number;
  user_name: string;
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
