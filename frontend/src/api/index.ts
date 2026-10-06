import {
  User,
  Checkin,
  Blocker,
  Digest,
  Channel,
  Message,
  InsightsData,
  SystemStatus,
  AuditLogItem,
  Sprint,
  Task,
  PointsSummary,
  AppraisalReport,
  HierarchyNode,
  JiraImportResult,
  PerformanceCycle,
  PerformanceGoal,
  PerformanceSummaryEmployee,
  PerformanceAppraisalEvidenceResponse,
  OAuthConfig,
  OAuthCallbackPayload,
  OAuthPendingResponse,
  OAuthPasswordVerifyPayload
} from '../types';

const API_BASE = '/api';

export interface AuthStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export const getStorage = (): AuthStorage | null => {
  if (typeof window === 'undefined') return null;
  return {
    getItem: (key: string): string | null => {
      try {
        const sessionVal = window.sessionStorage?.getItem(key);
        if (sessionVal !== null && sessionVal !== undefined) return sessionVal;
      } catch {}
      try {
        return window.localStorage?.getItem(key) || null;
      } catch {
        return null;
      }
    },
    setItem: (key: string, value: string): void => {
      try {
        window.sessionStorage?.setItem(key, value);
      } catch {}
      try {
        window.localStorage?.setItem(key, value);
      } catch {}
    },
    removeItem: (key: string): void => {
      try {
        window.sessionStorage?.removeItem(key);
      } catch {}
      try {
        window.localStorage?.removeItem(key);
      } catch {}
    }
  };
};

export function getAuthHeaders(): HeadersInit {
  const token = getStorage()?.getItem('syncbrief_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function logoutUser(): Promise<void> {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  } catch {
    // Non-blocking: local storage is cleared regardless
  }
}

export async function fetchSystemStatus(): Promise<SystemStatus> {
  const res = await fetch(`${API_BASE}/status`);
  if (!res.ok) throw new Error('Failed to fetch status');
  return res.json();
}

export async function demoLogin(role: 'manager' | 'member' | 'admin' = 'manager', userId?: number): Promise<{ access_token: string; user: User }> {
  const res = await fetch(`${API_BASE}/auth/demo-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, user_id: userId }),
  });
  if (!res.ok) throw new Error('Demo login failed');
  const data = await res.json();
  const storage = getStorage();
  storage?.setItem('syncbrief_token', data.access_token);
  storage?.setItem('syncbrief_user', JSON.stringify(data.user));
  return data;
}

export async function loginWithCredentials(email: string, password = 'demo1234'): Promise<{ access_token: string; user: User }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Login failed' }));
    throw new Error(err.detail || 'Login failed');
  }
  const data = await res.json();
  const storage = getStorage();
  storage?.setItem('syncbrief_token', data.access_token);
  storage?.setItem('syncbrief_user', JSON.stringify(data.user));
  return data;
}

export async function getCurrentUser(): Promise<User> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to get user');
  return res.json();
}

// --- Social / SSO Authentication ---
export async function fetchOAuthConfig(): Promise<OAuthConfig> {
  const res = await fetch(`${API_BASE}/auth/oauth/config`);
  if (!res.ok) throw new Error('Failed to load OAuth configuration');
  return res.json();
}

export async function startOAuthFlow(provider: 'google' | 'microsoft'): Promise<{
  provider: string;
  authorization_url: string;
  state: string;
  code_verifier?: string | null;
}> {
  const res = await fetch(`${API_BASE}/auth/oauth/start/${provider}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `Failed to initiate ${provider} authentication` }));
    throw new Error(err.detail || `Failed to initiate ${provider} authentication`);
  }
  return res.json();
}

export async function exchangeOAuthCode(payload: OAuthCallbackPayload): Promise<OAuthPendingResponse> {
  const res = await fetch(`${API_BASE}/auth/oauth/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'OAuth authentication failed' }));
    throw new Error(err.detail || 'OAuth authentication failed');
  }
  return res.json();
}

export async function verifyOAuthPassword(payload: OAuthPasswordVerifyPayload): Promise<{ access_token: string; refresh_token?: string; user: User }> {
  const res = await fetch(`${API_BASE}/auth/oauth/verify-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Incorrect SyncBrief password.' }));
    throw new Error(err.detail || 'Incorrect SyncBrief password.');
  }
  const data = await res.json();
  const storage = getStorage();
  storage?.setItem('syncbrief_token', data.access_token);
  storage?.setItem('syncbrief_user', JSON.stringify(data.user));
  if (data.refresh_token) {
    storage?.setItem('syncbrief_refresh_token', data.refresh_token);
  }
  return data;
}

export function generateRandomString(length = 64): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    return Array.from(array, (byte) => chars[byte % chars.length]).join('');
  }
  return Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  return verifier;
}

// --- Check-ins ---
export async function fetchCheckins(userId?: number): Promise<Checkin[]> {
  const url = userId ? `${API_BASE}/checkins?user_id=${userId}` : `${API_BASE}/checkins`;
  const res = await fetch(url, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to fetch checkins' }));
    throw new Error(err.detail || 'Failed to fetch checkins');
  }
  return res.json();
}

export async function fetchLastCheckinTask(): Promise<{
  task_id: number | null;
  task_title: string | null;
  progress_pct: number;
  active_sprint_id: number | null;
  sprint_name: string | null;
}> {
  const res = await fetch(`${API_BASE}/checkins/last-task`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch last check-in task');
  return res.json();
}

export async function submitCheckin(payload: {
  yesterday?: string;
  today?: string;
  blockers_text?: string;
  mood: number;
  pr_link?: string;
  work_item_id?: string;
  status?: string;
  task_id?: number | null;
  task_title?: string | null;
  progress_pct?: number;
  progress_note?: string;
  next_steps?: string;
  sync_needed_with?: string[];
  other_task_ids?: number[];
}): Promise<Checkin> {
  const res = await fetch(`${API_BASE}/checkins`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to submit checkin' }));
    throw new Error(err.detail || 'Failed to submit checkin');
  }
  return res.json();
}

// --- Sprints ---
export async function fetchSprints(): Promise<Sprint[]> {
  const res = await fetch(`${API_BASE}/sprints`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch sprints');
  return res.json();
}

export async function createSprint(payload: {
  name: string;
  start_date: string;
  end_date: string;
  status?: 'planned' | 'active' | 'closed';
  goal?: string;
}): Promise<Sprint> {
  const res = await fetch(`${API_BASE}/sprints`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create sprint');
  return res.json();
}

export async function updateSprint(id: number, payload: Partial<Sprint>): Promise<Sprint> {
  const res = await fetch(`${API_BASE}/sprints/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update sprint');
  return res.json();
}

export async function closeSprint(id: number, payload: {
  target_sprint_id?: number | null;
  create_next_sprint?: boolean;
  next_sprint_name?: string;
}): Promise<any> {
  const res = await fetch(`${API_BASE}/sprints/${id}/close`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to close sprint' }));
    throw new Error(err.detail || 'Failed to close sprint');
  }
  return res.json();
}

// --- Tasks ---
export async function fetchTasks(params?: {
  sprint_id?: number | null;
  assignee_id?: number | null;
  status?: string;
  priority?: string;
}): Promise<Task[]> {
  const searchParams = new URLSearchParams();
  if (params?.sprint_id) searchParams.append('sprint_id', params.sprint_id.toString());
  if (params?.assignee_id) searchParams.append('assignee_id', params.assignee_id.toString());
  if (params?.status) searchParams.append('status', params.status);
  if (params?.priority) searchParams.append('priority', params.priority);

  const res = await fetch(`${API_BASE}/tasks?${searchParams.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch tasks');
  return res.json();
}

export async function createTask(payload: {
  title: string;
  description?: string;
  assignee_id?: number | null;
  priority?: 'High' | 'Medium' | 'Low';
  difficulty?: number;
  status?: string;
  sprint_id?: number | null;
  progress_pct?: number;
}): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to create task' }));
    throw new Error(err.detail || 'Failed to create task');
  }
  return res.json();
}

export async function updateTask(id: number, payload: Partial<Task>): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to update task' }));
    const error: any = new Error(err.detail || 'Failed to update task');
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export async function updateTaskStatus(id: number, status: string, progress_pct?: number): Promise<Task> {
  const body: any = { status };
  if (progress_pct !== undefined) body.progress_pct = progress_pct;
  const res = await fetch(`${API_BASE}/tasks/${id}/status`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to update task status');
  return res.json();
}

export async function deleteTask(id: number): Promise<any> {
  const res = await fetch(`${API_BASE}/tasks/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete task');
  return res.json();
}

// --- Points & Appraisal ---
export async function fetchMyPoints(): Promise<PointsSummary> {
  const res = await fetch(`${API_BASE}/points/me`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch points');
  return res.json();
}

export async function fetchUserPoints(userId: number): Promise<PointsSummary> {
  const res = await fetch(`${API_BASE}/points/user/${userId}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Hierarchy access violation' }));
    throw new Error(err.detail || 'Hierarchy access violation: 403 Forbidden');
  }
  return res.json();
}

export async function fetchAppraisalReport(quarter = 'Q3 2026'): Promise<AppraisalReport> {
  const res = await fetch(`${API_BASE}/points/appraisal?quarter=${encodeURIComponent(quarter)}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to fetch appraisal' }));
    throw new Error(err.detail || 'Failed to fetch appraisal');
  }
  return res.json();
}

export function getAppraisalCsvDownloadUrl(quarter = 'Q3 2026'): string {
  const token = getStorage()?.getItem('syncbrief_token') || '';
  return `${API_BASE}/points/appraisal/export/csv?quarter=${encodeURIComponent(quarter)}&token=${encodeURIComponent(token)}`;
}

// --- Jira Import ---
export async function importJiraCsv(csvContent: string, sprintId?: number | null): Promise<JiraImportResult> {
  const res = await fetch(`${API_BASE}/jira/import-csv`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ csv_content: csvContent, target_sprint_id: sprintId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to import Jira CSV' }));
    throw new Error(err.detail || 'Failed to import Jira CSV');
  }
  return res.json();
}

// --- Org Hierarchy & User CRUD ---
export async function fetchHierarchy(): Promise<HierarchyNode[]> {
  const res = await fetch(`${API_BASE}/auth/hierarchy`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch hierarchy');
  return res.json();
}

export async function fetchMyReports(): Promise<User[]> {
  const res = await fetch(`${API_BASE}/auth/users/my-reports`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch subordinates');
  return res.json();
}

export async function fetchAllUsers(): Promise<User[]> {
  const res = await fetch(`${API_BASE}/auth/users`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

export async function createUser(payload: {
  email: string;
  password?: string;
  confirm_password?: string;
  full_name: string;
  role?: string;
  title?: string;
  role_level?: number;
  reports_to_id?: number | null;
  org_type?: string;
}): Promise<User> {
  const res = await fetch(`${API_BASE}/auth/users`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to create user' }));
    throw new Error(err.detail || 'Failed to create user');
  }
  return res.json();
}

export async function updateUser(id: number, payload: Partial<User>): Promise<User> {
  const res = await fetch(`${API_BASE}/auth/users/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to update user' }));
    throw new Error(err.detail || 'Failed to update user');
  }
  return res.json();
}

export async function deleteUser(id: number): Promise<any> {
  const res = await fetch(`${API_BASE}/auth/users/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to delete user' }));
    throw new Error(err.detail || 'Failed to delete user');
  }
  return res.json();
}

// --- Blockers & Citations ---
export async function fetchBlockers(status?: string, severity?: string): Promise<Blocker[]> {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  if (severity) params.append('severity', severity);
  const res = await fetch(`${API_BASE}/blockers?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch blockers');
  return res.json();
}

export async function updateBlockerStatus(blockerId: number, status: string): Promise<any> {
  const res = await fetch(`${API_BASE}/blockers/${blockerId}/status`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error('Failed to update status');
  return res.json();
}

export async function syncToDevOps(blockerId: number, payload?: { title?: string; description?: string }): Promise<any> {
  const res = await fetch(`${API_BASE}/blockers/${blockerId}/devops`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload || {}),
  });
  if (!res.ok) throw new Error('Failed to create DevOps item');
  return res.json();
}

export async function testHallucination(): Promise<any> {
  const res = await fetch(`${API_BASE}/blockers/test-hallucination`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to trigger hallucination test');
  return res.json();
}

// --- Digests ---
export async function fetchTodayDigest(): Promise<Digest> {
  const res = await fetch(`${API_BASE}/digest/today`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch digest');
  return res.json();
}

export async function regenerateDigest(): Promise<Digest> {
  const res = await fetch(`${API_BASE}/digest/regenerate`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to regenerate digest');
  return res.json();
}

export async function postDigestToTeams(): Promise<any> {
  const res = await fetch(`${API_BASE}/digest/post-to-teams`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to post to Teams');
  return res.json();
}

// --- Channels & Messages ---
export async function fetchChannels(): Promise<Channel[]> {
  const res = await fetch(`${API_BASE}/channels`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch channels');
  return res.json();
}

export async function toggleChannelOptIn(channelId: number, isEnabled: boolean): Promise<Channel> {
  const res = await fetch(`${API_BASE}/channels/${channelId}/toggle`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ is_syncbrief_enabled: isEnabled }),
  });
  if (!res.ok) throw new Error('Failed to toggle channel opt-in');
  return res.json();
}

export async function fetchChannelMessages(channelName: string): Promise<Message[]> {
  const clean = channelName.replace('#', '');
  const res = await fetch(`${API_BASE}/channels/${clean}/messages`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch messages');
  return res.json();
}

export async function postChannelMessage(channelName: string, content: string, threadId?: string): Promise<Message> {
  const clean = channelName.replace('#', '');
  const res = await fetch(`${API_BASE}/channels/${clean}/messages`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ channel_name: channelName, content, thread_id: threadId }),
  });
  if (!res.ok) throw new Error('Failed to post message');
  return res.json();
}

// --- Insights & Audit ---
export async function fetchInsights(teamSize = 6, durationMin = 30, workingDays = 22, hourlyRate = 75): Promise<InsightsData> {
  const params = new URLSearchParams({
    team_size: teamSize.toString(),
    duration_min: durationMin.toString(),
    working_days: workingDays.toString(),
    hourly_rate: hourlyRate.toString(),
  });
  const res = await fetch(`${API_BASE}/insights?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch insights');
  return res.json();
}

export async function fetchAuditTrail(): Promise<AuditLogItem[]> {
  const res = await fetch(`${API_BASE}/settings/audit-trail`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch audit trail');
  return res.json();
}

export async function deleteMyData(): Promise<any> {
  const res = await fetch(`${API_BASE}/settings/delete-my-data`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete data');
  return res.json();
}

export async function runDemoScenario(): Promise<any> {
  const res = await fetch(`${API_BASE}/demo/run-scenario`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to run demo scenario');
  return res.json();
}

// ==========================================
// Performance Points & Goals API
// ==========================================

export async function fetchPerformanceCycles(): Promise<PerformanceCycle[]> {
  const res = await fetch(`${API_BASE}/performance/cycles`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch performance cycles');
  return res.json();
}

export async function createPerformanceCycle(data: {
  name: string;
  start_date: string;
  end_date: string;
  is_active?: boolean;
}): Promise<PerformanceCycle> {
  const res = await fetch(`${API_BASE}/performance/cycles`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to create cycle' }));
    throw new Error(err.detail || 'Failed to create cycle');
  }
  return res.json();
}

export async function closePerformanceCycle(cycleId: number, autoCarryForward = true): Promise<any> {
  const res = await fetch(`${API_BASE}/performance/cycles/${cycleId}/close`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ auto_carry_forward: autoCarryForward }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to close cycle' }));
    throw new Error(err.detail || 'Failed to close cycle');
  }
  return res.json();
}

export async function fetchPerformanceGoals(cycleId?: number, employeeId?: number): Promise<PerformanceGoal[]> {
  const params = new URLSearchParams();
  if (cycleId) params.append('cycle_id', cycleId.toString());
  if (employeeId) params.append('employee_id', employeeId.toString());
  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}/performance/goals${qs}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch performance goals');
  return res.json();
}

export async function createPerformanceGoal(data: {
  cycle_id: number;
  employee_id: number;
  title: string;
  description?: string;
  category?: string;
  assigned_points: number;
  target_pct?: number;
  task_id?: number | null;
}): Promise<PerformanceGoal> {
  const payload = {
    cycle_id: data.cycle_id,
    user_id: data.employee_id,
    title: data.title,
    description: data.description || '',
    assigned_points: data.assigned_points,
    target_percentage: data.target_pct || 100.0,
    source_task_id: data.task_id || null
  };
  const res = await fetch(`${API_BASE}/performance/goals`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to create goal' }));
    throw new Error(err.detail || 'Failed to create goal');
  }
  return res.json();
}

export async function updateGoalProgress(
  goalId: number,
  data: {
    current_progress_pct?: number;
    status?: string;
    progress_note?: string;
    sync_task?: boolean;
  }
): Promise<PerformanceGoal> {
  const payload = {
    current_progress_percentage: data.current_progress_pct !== undefined ? data.current_progress_pct : 0,
    sync_with_task: data.sync_task || false
  };
  const res = await fetch(`${API_BASE}/performance/goals/${goalId}/progress`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to update goal progress' }));
    throw new Error(err.detail || 'Failed to update goal progress');
  }
  return res.json();
}

export async function carryForwardGoal(goalId: number, targetCycleId: number): Promise<PerformanceGoal> {
  const res = await fetch(`${API_BASE}/performance/goals/${goalId}/carry-forward`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ target_cycle_id: targetCycleId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to carry forward goal' }));
    throw new Error(err.detail || 'Failed to carry forward goal');
  }
  return res.json();
}

export async function fetchMyPerformanceSummary(cycleId?: number): Promise<PerformanceSummaryEmployee> {
  const qs = cycleId ? `?cycle_id=${cycleId}` : '';
  const res = await fetch(`${API_BASE}/performance/my-summary${qs}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch personal performance summary');
  return res.json();
}

export async function fetchEmployeePerformanceSummary(employeeId: number, cycleId?: number): Promise<PerformanceSummaryEmployee> {
  const qs = cycleId ? `?cycle_id=${cycleId}` : '';
  const res = await fetch(`${API_BASE}/performance/employee/${employeeId}/summary${qs}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch employee performance summary');
  return res.json();
}

export async function fetchPerformanceAppraisalEvidence(cycleId?: number): Promise<PerformanceAppraisalEvidenceResponse> {
  const qs = cycleId ? `?cycle_id=${cycleId}` : '';
  const res = await fetch(`${API_BASE}/performance/appraisal-evidence${qs}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch performance appraisal evidence');
  return res.json();
}
