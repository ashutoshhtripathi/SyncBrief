import { User, Checkin, Blocker, Digest, Channel, Message, InsightsData, SystemStatus, AuditLogItem } from '../types';

const API_BASE = '/api';

function getAuthHeaders(): HeadersInit {
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

export async function demoLogin(role: 'manager' | 'member' = 'manager', userId?: number): Promise<{ access_token: string; user: User }> {
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

export async function getCurrentUser(): Promise<User> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to get user');
  return res.json();
}

export async function fetchCheckins(): Promise<Checkin[]> {
  const res = await fetch(`${API_BASE}/checkins`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch checkins');
  return res.json();
}

export async function submitCheckin(payload: {
  yesterday: string;
  today: string;
  blockers_text?: string;
  mood: number;
  pr_link?: string;
  work_item_id?: string;
  status?: string;
}): Promise<Checkin> {
  const res = await fetch(`${API_BASE}/checkins`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to submit checkin');
  return res.json();
}

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
