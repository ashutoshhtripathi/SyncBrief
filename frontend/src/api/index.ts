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
  JiraImportResult
} from '../types';

const API_BASE = '/api';

export function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('syncbrief_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
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
  localStorage.setItem('syncbrief_token', data.access_token);
  localStorage.setItem('syncbrief_user', JSON.stringify(data.user));
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
  localStorage.setItem('syncbrief_token', data.access_token);
  localStorage.setItem('syncbrief_user', JSON.stringify(data.user));
  return data;
}

export async function getCurrentUser(): Promise<User> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to get user');
  return res.json();
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
  const token = localStorage.getItem('syncbrief_token') || '';
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
