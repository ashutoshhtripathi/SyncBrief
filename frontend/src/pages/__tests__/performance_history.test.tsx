import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { PerformanceHistoryPage } from '../PerformanceHistoryPage';
import { AuthProvider } from '../../context/AuthContext';
import { ThemeProvider } from '../../context/ThemeContext';
import { ToastProvider } from '../../context/ToastContext';
import { PerformanceHistoryResponse, TeamPerformanceHistoryResponse } from '../../types';

const mockEmployeeUser = {
  id: 4,
  tenant_id: 1,
  email: 'priya.sharma@syncbrief.ai',
  full_name: 'Priya Sharma',
  role: 'employee',
  role_level: 3,
  title: 'Senior Backend Engineer',
  reports_to_id: 2,
};

const mockManagerUser = {
  id: 2,
  tenant_id: 1,
  email: 'vikram.joshi@syncbrief.ai',
  full_name: 'Vikram Joshi',
  role: 'manager',
  role_level: 2,
  title: 'Engineering Manager',
  reports_to_id: 1,
};

const mockPriyaHistory: PerformanceHistoryResponse = {
  user_id: 4,
  full_name: 'Priya Sharma',
  email: 'priya.sharma@syncbrief.ai',
  title: 'Senior Backend Engineer',
  role: 'employee',
  role_level: 3,
  manager_name: 'Vikram Joshi',
  has_history: true,
  current_cycle: {
    cycle_id: 2,
    cycle_name: '2026-Q2',
    year: 2026,
    quarter: 'Q2',
    status: 'active',
    assigned_points: 18.0,
    earned_points: 4.0,
    previously_earned_points: 7.0,
    lifetime_earned_points: 11.0,
    remaining_points: 7.0,
    completion_rate_pct: 61.1,
    active_goals_count: 2,
    carried_goals_count: 1,
    completed_goals_count: 0,
    total_goals_count: 2,
    goals: [
      {
        id: 201,
        tenant_id: 1,
        cycle_id: 2,
        cycle_name: '2026-Q2',
        user_id: 4,
        employee_name: 'Priya Sharma',
        created_by: 2,
        title: 'Core OAuth 2.1 & Tenant Data Isolation Engine',
        description: 'Carried from Q1',
        assigned_points: 10.0,
        target_percentage: 100.0,
        current_progress_percentage: 70.0,
        previously_earned_points: 7.0,
        earned_points: 0.0,
        remaining_points: 3.0,
        status: 'in_progress',
        carried_from_goal_id: 101,
        created_at: '2026-04-01T00:00:00',
        updated_at: '2026-04-01T00:00:00'
      },
      {
        id: 202,
        tenant_id: 1,
        cycle_id: 2,
        cycle_name: '2026-Q2',
        user_id: 4,
        employee_name: 'Priya Sharma',
        created_by: 2,
        title: 'Real-Time Standup Chat Synthesis Pipeline',
        description: 'New Q2 Goal',
        assigned_points: 8.0,
        target_percentage: 100.0,
        current_progress_percentage: 50.0,
        previously_earned_points: 0.0,
        earned_points: 4.0,
        remaining_points: 4.0,
        status: 'in_progress',
        created_at: '2026-04-01T00:00:00',
        updated_at: '2026-04-01T00:00:00'
      }
    ]
  },
  historical_quarters: [
    {
      cycle_id: 1,
      cycle_name: '2026-Q1',
      year: 2026,
      quarter: 'Q1',
      status: 'closed',
      assigned_points: 10.0,
      previously_earned_points: 0.0,
      cycle_earned_points: 7.0,
      lifetime_earned_points: 7.0,
      remaining_points: 3.0,
      completion_rate_pct: 70.0,
      goals_count: 1,
      active_goals_count: 0,
      completed_goals_count: 0,
      carried_forward_goals_count: 1,
      goals: [
        {
          id: 101,
          tenant_id: 1,
          cycle_id: 1,
          cycle_name: '2026-Q1',
          user_id: 4,
          employee_name: 'Priya Sharma',
          created_by: 2,
          title: 'Core OAuth 2.1 & Tenant Data Isolation Engine',
          description: 'Initial Q1 goal',
          assigned_points: 10.0,
          target_percentage: 100.0,
          current_progress_percentage: 70.0,
          previously_earned_points: 0.0,
          earned_points: 7.0,
          remaining_points: 3.0,
          status: 'carried_forward',
          created_at: '2026-01-01T00:00:00',
          updated_at: '2026-03-31T00:00:00'
        }
      ]
    },
    {
      cycle_id: 2,
      cycle_name: '2026-Q2',
      year: 2026,
      quarter: 'Q2',
      status: 'active',
      assigned_points: 18.0,
      previously_earned_points: 7.0,
      cycle_earned_points: 4.0,
      lifetime_earned_points: 11.0,
      remaining_points: 7.0,
      completion_rate_pct: 61.1,
      goals_count: 2,
      active_goals_count: 2,
      completed_goals_count: 0,
      carried_forward_goals_count: 1,
      goals: []
    }
  ],
  yearly_summaries: [
    {
      year: 2026,
      assigned_points: 28.0,
      earned_points: 11.0,
      lifetime_earned_points: 18.0,
      completion_rate_pct: 39.3,
      quarters_count: 2,
      quarters: []
    }
  ],
  trend: {
    direction: 'declining',
    delta_pct: -8.9,
    summary: 'Current cycle completion is 8.9 percentage points below the previous cycle (61.1% in 2026-Q2 vs 70.0% in 2026-Q1).',
    data_points_count: 2
  }
};

const mockTeamData: TeamPerformanceHistoryResponse = {
  manager_id: 2,
  manager_name: 'Vikram Joshi',
  is_director: false,
  members: [
    {
      user_id: 4,
      full_name: 'Priya Sharma',
      email: 'priya.sharma@syncbrief.ai',
      title: 'Senior Backend Engineer',
      role: 'employee',
      role_level: 3,
      manager_name: 'Vikram Joshi',
      current_cycle_name: '2026-Q2',
      current_completion_pct: 61.1,
      yearly_summaries: [
        {
          year: 2026,
          assigned_points: 28.0,
          earned_points: 11.0,
          lifetime_earned_points: 18.0,
          completion_rate_pct: 39.3,
          quarters_count: 2,
          quarters: []
        }
      ],
      latest_trend: 'Current cycle completion is 8.9 percentage points below the previous cycle.',
      has_history: true
    },
    {
      user_id: 5,
      full_name: 'Elena Rostova',
      email: 'elena.rostova@syncbrief.ai',
      title: 'Staff Platform Engineer',
      role: 'employee',
      role_level: 3,
      manager_name: 'Vikram Joshi',
      current_cycle_name: '2026-Q2',
      current_completion_pct: 100.0,
      yearly_summaries: [
        {
          year: 2026,
          assigned_points: 12.0,
          earned_points: 12.0,
          lifetime_earned_points: 12.0,
          completion_rate_pct: 100.0,
          quarters_count: 1,
          quarters: []
        }
      ],
      latest_trend: 'Single cycle recorded: 2026-Q2 at 100.0% completion.',
      has_history: true
    }
  ]
};

const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            {ui}
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

describe('Performance History & Intelligence Test Suite (Phase 5)', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  it('1. Employee My Performance page renders title and AI badge', async () => {
    mockLocalStorage.setItem('syncbrief_token', 'valid-token');
    mockLocalStorage.setItem('syncbrief_user', JSON.stringify(mockEmployeeUser));

    (globalThis as any).fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockEmployeeUser) });
      if (url.includes('/performance/history')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockPriyaHistory) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    renderWithProviders(<PerformanceHistoryPage />);

    await waitFor(() => {
      expect(screen.getByText(/Performance History & Intelligence/i)).toBeDefined();
    });
    expect(screen.getByText(/Long-Term Deltas/i)).toBeDefined();
  });

  it('2. Current cycle metrics render assigned, earned, and completion rate', async () => {
    mockLocalStorage.setItem('syncbrief_token', 'valid-token');
    mockLocalStorage.setItem('syncbrief_user', JSON.stringify(mockEmployeeUser));

    (globalThis as any).fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockEmployeeUser) });
      if (url.includes('/performance/history')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockPriyaHistory) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    renderWithProviders(<PerformanceHistoryPage />);

    await waitFor(() => {
      expect(screen.getByText(/Current Cycle: 2026-Q2/i)).toBeDefined();
    });
    expect(screen.getAllByText(/18 pts/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/61.1%/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Cycle Completion Rate/i)).toBeDefined();
  });

  it('3. Historical quarters render quarter badges and completion percentages', async () => {
    mockLocalStorage.setItem('syncbrief_token', 'valid-token');
    mockLocalStorage.setItem('syncbrief_user', JSON.stringify(mockEmployeeUser));

    (globalThis as any).fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockEmployeeUser) });
      if (url.includes('/performance/history')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockPriyaHistory) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    renderWithProviders(<PerformanceHistoryPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/2026-Q1/i).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/70%/i).length).toBeGreaterThan(0);
  });

  it('4. Yearly summary renders annual aggregations without fabricated numbers', async () => {
    mockLocalStorage.setItem('syncbrief_token', 'valid-token');
    mockLocalStorage.setItem('syncbrief_user', JSON.stringify(mockEmployeeUser));

    (globalThis as any).fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockEmployeeUser) });
      if (url.includes('/performance/history')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockPriyaHistory) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    renderWithProviders(<PerformanceHistoryPage />);

    await waitFor(() => {
      expect(screen.getByText(/YEARLY SUMMARY/i)).toBeDefined();
    });
    expect(screen.getByText(/2 Quarters/i)).toBeDefined();
    expect(screen.getByText(/28 pts/i)).toBeDefined();
  });

  it('5. Trend visualization renders deterministic summary note', async () => {
    mockLocalStorage.setItem('syncbrief_token', 'valid-token');
    mockLocalStorage.setItem('syncbrief_user', JSON.stringify(mockEmployeeUser));

    (globalThis as any).fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockEmployeeUser) });
      if (url.includes('/performance/history')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockPriyaHistory) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    renderWithProviders(<PerformanceHistoryPage />);

    await waitFor(() => {
      expect(screen.getByText(/PERFORMANCE TREND OVER TIME/i)).toBeDefined();
    });
    expect(screen.getByText(/Current cycle completion is 8.9 percentage points below the previous cycle/i)).toBeDefined();
  });

  it('6. Quarter detail renders goal titles, assigned points, and carry-forward accountability', async () => {
    mockLocalStorage.setItem('syncbrief_token', 'valid-token');
    mockLocalStorage.setItem('syncbrief_user', JSON.stringify(mockEmployeeUser));

    (globalThis as any).fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockEmployeeUser) });
      if (url.includes('/performance/history')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockPriyaHistory) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    renderWithProviders(<PerformanceHistoryPage />);

    await waitFor(() => {
      expect(screen.getByText(/QUARTER DETAIL INSPECTOR/i)).toBeDefined();
    });
    expect(screen.getByText(/Carry-Forward Point Accountability/i)).toBeDefined();
    expect(screen.getByText(/Prior achievements are locked and never double-counted/i)).toBeDefined();
  });

  it('7. Empty history state renders clean empty state message', async () => {
    mockLocalStorage.setItem('syncbrief_token', 'valid-token');
    mockLocalStorage.setItem('syncbrief_user', JSON.stringify(mockEmployeeUser));

    const emptyHistoryPayload: PerformanceHistoryResponse = {
      ...mockPriyaHistory,
      has_history: false,
      current_cycle: null,
      historical_quarters: [],
      yearly_summaries: [],
      trend: {
        direction: 'insufficient_data',
        delta_pct: null,
        summary: 'No historical performance data available.',
        data_points_count: 0
      }
    };

    (globalThis as any).fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockEmployeeUser) });
      if (url.includes('/performance/history')) return Promise.resolve({ ok: true, json: () => Promise.resolve(emptyHistoryPayload) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    renderWithProviders(<PerformanceHistoryPage />);

    await waitFor(() => {
      expect(screen.getByText(/No historical performance data available\./i)).toBeDefined();
    });
    expect(screen.getByText(/No performance goals or completed performance cycles recorded/i)).toBeDefined();
  });

  it('8. Manager team history tab displays authorized subordinates', async () => {
    mockLocalStorage.setItem('syncbrief_token', 'valid-token');
    mockLocalStorage.setItem('syncbrief_user', JSON.stringify(mockManagerUser));

    (globalThis as any).fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockManagerUser) });
      if (url.includes('/performance/history/team')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockTeamData) });
      if (url.includes('/performance/history')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockPriyaHistory) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    renderWithProviders(<PerformanceHistoryPage />);

    // Click "Team Performance" tab
    await waitFor(() => {
      expect(screen.getByText(/Team Performance/i)).toBeDefined();
    });
    fireEvent.click(screen.getByText(/Team Performance/i));

    await waitFor(() => {
      expect(screen.getByText(/Elena Rostova/i)).toBeDefined();
    });
    expect(screen.getAllByText(/Priya Sharma/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Staff Platform Engineer/i)).toBeDefined();
  });
});
