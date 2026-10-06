import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WhatChangedPage, deriveManagerActions } from '../WhatChangedPage';
import { EvidenceCitationBadge } from '../../components/EvidenceCitationBadge';
import { TodayDashboard } from '../../components/TodayDashboard';
import { AuthProvider } from '../../context/AuthContext';
import { ThemeProvider } from '../../context/ThemeContext';
import { ToastProvider } from '../../context/ToastContext';
import { WhatChangedResponse, EvidenceCitation } from '../../types';

// Mock storage
const storageStore: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => storageStore[key] || null,
  setItem: (key: string, value: string) => { storageStore[key] = value; },
  removeItem: (key: string) => { delete storageStore[key]; },
  clear: () => { Object.keys(storageStore).forEach(k => delete storageStore[k]); }
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const mockManagerUser = {
  id: 2,
  email: 'vikram.joshi@syncbrief.ai',
  full_name: 'Vikram Joshi',
  role: 'manager' as const,
  title: 'Engineering Manager',
  role_level: 2,
  tenant_id: 1,
  tenant_name: 'SyncBrief Enterprise',
  timezone: 'America/Los_Angeles',
  reminder_time: '09:00',
  streak_count: 10,
};

const mockDirectorUser = {
  id: 1,
  email: 'sarah.jenkins@syncbrief.ai',
  full_name: 'Sarah Jenkins',
  role: 'director' as const,
  title: 'Director of Engineering',
  role_level: 1,
  tenant_id: 1,
  tenant_name: 'SyncBrief Enterprise',
  timezone: 'America/Los_Angeles',
  reminder_time: '09:00',
  streak_count: 14,
};

const mockEmployeeUser = {
  id: 4,
  email: 'priya.sharma@syncbrief.ai',
  full_name: 'Priya Sharma',
  role: 'employee' as const,
  title: 'Senior API Engineer',
  role_level: 3,
  tenant_id: 1,
  tenant_name: 'SyncBrief Enterprise',
  timezone: 'America/Los_Angeles',
  reminder_time: '09:00',
  streak_count: 7,
};

const mockWhatChangedData: WhatChangedResponse = {
  target_date: '2026-10-06',
  previous_working_day: '2026-10-05',
  window_start: '2026-10-05T00:00:00',
  window_end: '2026-10-06T23:59:59',
  is_weekend_lookback: false,
  team_scope: {
    manager_id: 2,
    manager_name: 'Vikram Joshi',
    member_count: 5,
    checked_in_count: 3,
  },
  progress: {
    completed_work: [
      {
        task_id: 11,
        title: 'Azure DevOps Work Item Inspector Modal',
        owner: 'Elena Rostova',
        completed_at: '2026-10-06T14:30:00',
        difficulty: 3,
        points_earned: 3.0,
        evidence: [
          {
            source_type: 'task',
            source_id: '11',
            title: 'Azure DevOps Work Item Inspector Modal',
            author_or_owner: 'Elena Rostova',
            timestamp: '2026-10-06T14:30:00',
            excerpt: "Task 'Azure DevOps Work Item Inspector Modal' completed with status Done (3 difficulty points)",
            verified: true,
            rejection_reason: null,
          },
        ],
      },
    ],
    meaningful_task_progress: [
      {
        task_id: 10,
        title: 'Jira Bi-Directional OAuth 2.0 Webhook Sync',
        owner: 'Elena Rostova',
        progress_delta_pct: 30,
        current_progress_pct: 80,
        note: 'Completed OAuth token refresh endpoints and integration tests',
        pr_link: 'https://github.com/syncbrief/pull/42',
        evidence: [
          {
            source_type: 'task',
            source_id: '10',
            title: 'Jira Bi-Directional OAuth 2.0 Webhook Sync',
            author_or_owner: 'Elena Rostova',
            timestamp: '2026-10-06T11:00:00',
            excerpt: 'Task progress increased by 30 percentage points (50% -> 80%)',
            verified: true,
            rejection_reason: null,
          },
        ],
      },
    ],
    sprint_progress: {
      sprint_id: 1,
      sprint_name: 'Sprint 24 - Core Intelligence',
      total_points: 40,
      completed_points_yesterday: 16,
      completed_points_today: 21,
      delta_points: 5,
      evidence: [
        {
          source_type: 'sprint',
          source_id: '1',
          title: 'Sprint 24 - Core Intelligence',
          author_or_owner: 'Sprint 24',
          timestamp: '2026-10-06T15:00:00',
          excerpt: 'Sprint completion delta: 5.0 points completed in window. Sprint at 52.5%',
          verified: true,
          rejection_reason: null,
        },
      ],
    },
    checkin_updates: [],
  },
  blockers: {
    new_blockers: [
      {
        blocker_id: 101,
        summary: 'PR #184 Auth API is blocked on database migration schema',
        severity: 'high',
        owner: 'Priya Sharma',
        blocked_by: 'Vikram Joshi',
        created_at: '2026-10-06T09:15:00',
        evidence: [
          {
            source_type: 'blocker',
            source_id: '101',
            title: 'PR #184 Auth API is blocked on database migration schema',
            author_or_owner: 'Priya Sharma',
            timestamp: '2026-10-06T09:15:00',
            excerpt: 'New blocker recorded in window: PR #184 Auth API is blocked on database migration schema (High)',
            verified: true,
            rejection_reason: null,
          },
        ],
      },
    ],
    existing_unresolved_blockers: [
      {
        blocker_id: 99,
        summary: 'PostgreSQL read replica latency spike during batch ingestion',
        severity: 'medium',
        owner: 'Elena Rostova',
        blocked_by: 'Infrastructure Team',
        age_days: 3,
        evidence: [
          {
            source_type: 'blocker',
            source_id: '99',
            title: 'PostgreSQL read replica latency spike during batch ingestion',
            author_or_owner: 'Elena Rostova',
            timestamp: '2026-10-03T10:00:00',
            excerpt: 'Existing unresolved blocker: PostgreSQL read replica latency spike (Age: 3 days)',
            verified: true,
            rejection_reason: null,
          },
        ],
      },
    ],
  },
  risks: [
    {
      risk_id: 'risk_1',
      severity: 'medium',
      summary: 'Backend migration schema delay may impact sprint close',
      rationale: '2 tasks dependent on migration script are at risk',
      evidence: [],
    },
  ],
  needs_manager_attention: [
    {
      item_id: 'attn_blocker_101',
      priority: 'urgent',
      action: "Payment API is blocking Priya Sharma's task. Review the dependency and assign/confirm an owner.",
      target_person: 'Priya Sharma',
      suggested_channel: '#backend',
      evidence: [
        {
          source_type: 'blocker',
          source_id: '101',
          title: 'PR #184 Auth API is blocked on database migration schema',
          author_or_owner: 'Priya Sharma',
          timestamp: '2026-10-06T09:15:00',
          excerpt: 'New blocker recorded in window: PR #184 Auth API is blocked on database migration schema (High)',
          verified: true,
          rejection_reason: null,
        },
      ],
    },
    {
      item_id: 'attn_nudge_rohan_patel',
      priority: 'medium',
      action: '2 team members have not submitted check-ins: Rohan Patel, Maya Lin.',
      target_person: 'Rohan Patel, Maya Lin',
      suggested_channel: 'Teams',
      evidence: [],
    },
  ],
  insufficient_data: {
    is_insufficient: false,
    missing_checkins: ['Rohan Patel', 'Maya Lin'],
    notes: [],
  },
};

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              {ui}
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('What Changed Since Yesterday - Action Center Test Suite', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  it('1. Manager can render What Changed page', async () => {
    mockLocalStorage.setItem('syncbrief_token', 'valid-manager-token');
    mockLocalStorage.setItem('syncbrief_user', JSON.stringify(mockManagerUser));

    (globalThis as any).fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockManagerUser) });
      if (url.includes('/what-changed')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockWhatChangedData) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    renderWithProviders(<WhatChangedPage />);

    await waitFor(() => {
      expect(screen.getByText(/What Changed Since Yesterday\?/i)).toBeDefined();
    });
    expect(screen.getByText(/AI Verified Delta/i)).toBeDefined();
  });

  it('2. Director can render What Changed page with tenant-wide scope', async () => {
    mockLocalStorage.setItem('syncbrief_token', 'valid-director-token');
    mockLocalStorage.setItem('syncbrief_user', JSON.stringify(mockDirectorUser));

    const directorData = {
      ...mockWhatChangedData,
      team_scope: { manager_id: 1, manager_name: 'Sarah Jenkins', member_count: 8, checked_in_count: 6 }
    };

    (globalThis as any).fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockDirectorUser) });
      if (url.includes('/what-changed')) return Promise.resolve({ ok: true, json: () => Promise.resolve(directorData) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    renderWithProviders(<WhatChangedPage />);

    await waitFor(() => {
      expect(screen.getByText(/Sarah Jenkins/i)).toBeDefined();
    });
    expect(screen.getByText(/8 members/i)).toBeDefined();
  });

  it('3. Employee receives 403 Forbidden and cannot access What Changed page', async () => {
    mockLocalStorage.setItem('syncbrief_token', 'valid-employee-token');
    mockLocalStorage.setItem('syncbrief_user', JSON.stringify(mockEmployeeUser));

    (globalThis as any).fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockEmployeeUser) });
      if (url.includes('/what-changed')) {
        return Promise.resolve({
          ok: false,
          status: 403,
          json: () => Promise.resolve({ detail: 'Forbidden: Team delta intelligence is reserved for engineering managers and directors.' })
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    renderWithProviders(<WhatChangedPage />);

    await waitFor(() => {
      expect(screen.getByText(/Access Restricted \(403 Forbidden\)/i)).toBeDefined();
    });
    expect(screen.getByText(/reserved for engineering managers and directors/i)).toBeDefined();
  });

  it('4. API response renders completed work with owner, points, and title', async () => {
    mockLocalStorage.setItem('syncbrief_token', 'valid-manager-token');
    mockLocalStorage.setItem('syncbrief_user', JSON.stringify(mockManagerUser));

    (globalThis as any).fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockManagerUser) });
      if (url.includes('/what-changed')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockWhatChangedData) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    renderWithProviders(<WhatChangedPage />);

    await waitFor(() => {
      expect(screen.getByText(/Azure DevOps Work Item Inspector Modal/i)).toBeDefined();
    });
    expect(screen.getByText(/3 pts/i)).toBeDefined();
    expect(screen.getAllByText(/Elena Rostova/i).length).toBeGreaterThan(0);
  });

  it('5. Progress delta renders visually prominent delta percentage and previous->current slider', async () => {
    mockLocalStorage.setItem('syncbrief_token', 'valid-manager-token');
    mockLocalStorage.setItem('syncbrief_user', JSON.stringify(mockManagerUser));

    (globalThis as any).fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockManagerUser) });
      if (url.includes('/what-changed')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockWhatChangedData) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    renderWithProviders(<WhatChangedPage />);

    await waitFor(() => {
      expect(screen.getByText(/\+30%/i)).toBeDefined();
    });
    expect(screen.getByText(/50% → 80%/i)).toBeDefined();
    expect(screen.getByText(/Jira Bi-Directional OAuth 2.0 Webhook Sync/i)).toBeDefined();
  });

  it('6. Blocker action renders in Action Center with recommended action and View Blocker button', async () => {
    mockLocalStorage.setItem('syncbrief_token', 'valid-manager-token');
    mockLocalStorage.setItem('syncbrief_user', JSON.stringify(mockManagerUser));

    (globalThis as any).fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockManagerUser) });
      if (url.includes('/what-changed')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockWhatChangedData) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    renderWithProviders(<WhatChangedPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/NEEDS YOUR ATTENTION/i).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/Payment API is blocking Priya Sharma's task/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/View Blocker/i).length).toBeGreaterThan(0);
  });

  it('7. Missing check-in action renders with suggested action and View Check-in button', async () => {
    mockLocalStorage.setItem('syncbrief_token', 'valid-manager-token');
    mockLocalStorage.setItem('syncbrief_user', JSON.stringify(mockManagerUser));

    (globalThis as any).fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockManagerUser) });
      if (url.includes('/what-changed')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockWhatChangedData) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    renderWithProviders(<WhatChangedPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/2 team members have not submitted check-ins/i).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/View Check-in/i).length).toBeGreaterThan(0);
  });

  it('8. Risk action renders in Action Center with rationale and View Sprint button', async () => {
    mockLocalStorage.setItem('syncbrief_token', 'valid-manager-token');
    mockLocalStorage.setItem('syncbrief_user', JSON.stringify(mockManagerUser));

    (globalThis as any).fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockManagerUser) });
      if (url.includes('/what-changed')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockWhatChangedData) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    renderWithProviders(<WhatChangedPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/Backend migration schema delay may impact sprint close/i).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/View Sprint/i).length).toBeGreaterThan(0);
  });

  it('9. Multiple actions are ordered by severity (critical/urgent first)', async () => {
    const actions = deriveManagerActions(mockWhatChangedData);
    expect(actions.length).toBeGreaterThan(1);
    expect(actions[0].severity).toBe('critical'); // urgent normalized to critical
  });

  it('10. Evidence / citation badge renders verified indicator and expands details on click', async () => {
    const verifiedCitation: EvidenceCitation = {
      source_type: 'task',
      source_id: '10',
      title: 'Jira Bi-Directional OAuth 2.0 Webhook Sync',
      author_or_owner: 'Elena Rostova',
      timestamp: '2026-10-06T11:00:00',
      excerpt: 'Task progress increased by 30 percentage points (50% -> 80%)',
      verified: true,
      rejection_reason: null,
    };

    render(
      <EvidenceCitationBadge citation={verifiedCitation} />
    );

    expect(screen.getByText(/✓ Verified/i)).toBeDefined();
    expect(screen.getByText(/Task #10/i)).toBeDefined();

    // Click to expand
    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByText(/Verified Source Evidence/i)).toBeDefined();
    expect(screen.getByText(/Task progress increased by 30 percentage points/i)).toBeDefined();
    expect(screen.getByText(/Grounded in SyncBrief audit records/i)).toBeDefined();
  });

  it('11. No-action state renders clean on-track banner when zero actions exist', async () => {
    mockLocalStorage.setItem('syncbrief_token', 'valid-manager-token');
    mockLocalStorage.setItem('syncbrief_user', JSON.stringify(mockManagerUser));

    const zeroActionsData: WhatChangedResponse = {
      ...mockWhatChangedData,
      blockers: { new_blockers: [], existing_unresolved_blockers: [] },
      risks: [],
      needs_manager_attention: [],
      insufficient_data: { is_insufficient: false, missing_checkins: [], notes: [] },
    };

    (globalThis as any).fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockManagerUser) });
      if (url.includes('/what-changed')) return Promise.resolve({ ok: true, json: () => Promise.resolve(zeroActionsData) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    renderWithProviders(<WhatChangedPage />);

    await waitFor(() => {
      expect(screen.getByText(/✓ Everything looks on track/i)).toBeDefined();
    });
    expect(screen.getByText(/✓ No manager action required/i)).toBeDefined();
  });

  it('12. Dashboard card displays action count and Review now button', async () => {
    mockLocalStorage.setItem('syncbrief_token', 'valid-manager-token');
    mockLocalStorage.setItem('syncbrief_user', JSON.stringify(mockManagerUser));

    (globalThis as any).fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockManagerUser) });
      if (url.includes('/what-changed')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockWhatChangedData) });
      if (url.includes('/sprints')) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      if (url.includes('/checkins')) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      if (url.includes('/blockers')) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      if (url.includes('/auth/users/my-reports') || url.includes('/auth/users')) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      if (url.includes('/tasks')) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    renderWithProviders(<TodayDashboard onOpenQuickAdd={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/What Changed Since Yesterday/i)).toBeDefined();
    });
    expect(screen.getByText(/Review now/i)).toBeDefined();
    expect(screen.getByText(/blockers need attention/i)).toBeDefined();
  });

  it('13. Unsupported/fake action categories are never generated', () => {
    const actions = deriveManagerActions(mockWhatChangedData);
    const validCategories = new Set(['BLOCKER', 'MISSING_CHECKIN', 'RISK', 'PROGRESS_REVIEW']);
    for (const a of actions) {
      expect(validCategories.has(a.category)).toBe(true);
    }
  });

  it('14. Empty state renders when zero delta changes are detected in comparison window', async () => {
    mockLocalStorage.setItem('syncbrief_token', 'valid-manager-token');
    mockLocalStorage.setItem('syncbrief_user', JSON.stringify(mockManagerUser));

    const emptyDataPayload: WhatChangedResponse = {
      ...mockWhatChangedData,
      progress: {
        completed_work: [],
        meaningful_task_progress: [],
        sprint_progress: null,
        checkin_updates: [],
      },
      blockers: {
        new_blockers: [],
        existing_unresolved_blockers: [],
      },
      risks: [],
      needs_manager_attention: [],
      insufficient_data: {
        is_insufficient: false,
        missing_checkins: [],
        notes: [],
      },
    };

    (globalThis as any).fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockManagerUser) });
      if (url.includes('/what-changed')) return Promise.resolve({ ok: true, json: () => Promise.resolve(emptyDataPayload) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    renderWithProviders(<WhatChangedPage />);

    await waitFor(() => {
      expect(screen.getByText(/No meaningful changes were detected for this comparison window/i)).toBeDefined();
    });
    expect(screen.getByText(/No tasks completed in this window\./i)).toBeDefined();
    expect(screen.getByText(/No new blockers reported\./i)).toBeDefined();
  });
});
