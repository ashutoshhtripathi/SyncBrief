import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { MyPointsPage } from '../MyPointsPage';
import { AppraisalPage } from '../AppraisalPage';
import { AuthProvider } from '../../context/AuthContext';
import { ThemeProvider } from '../../context/ThemeContext';
import { ToastProvider } from '../../context/ToastContext';

const mockCycles = [
  {
    id: 1,
    tenant_id: 1,
    name: '2026-Q1',
    start_date: '2026-01-01',
    end_date: '2026-03-31',
    is_active: false,
    created_at: '2026-01-01T00:00:00',
    goal_count: 3,
    active_goal_count: 0
  },
  {
    id: 2,
    tenant_id: 1,
    name: '2026-Q2',
    start_date: '2026-04-01',
    end_date: '2026-06-30',
    is_active: true,
    created_at: '2026-04-01T00:00:00',
    goal_count: 3,
    active_goal_count: 3
  }
];

const mockPerfSummary = {
  employee_id: 4,
  employee_name: 'Priya Sharma',
  employee_title: 'Full Stack Engineer',
  cycle_id: 2,
  cycle_name: '2026-Q2',
  cycle_is_active: true,
  total_assigned_points: 10.0,
  total_earned_points: 1.5,
  total_remaining_points: 1.5,
  average_progress_pct: 85.0,
  completed_goals_count: 0,
  in_progress_goals_count: 1,
  carried_forward_goals_count: 1,
  total_goals_count: 1,
  goals: [
    {
      id: 102,
      tenant_id: 1,
      cycle_id: 2,
      cycle_name: '2026-Q2',
      cycle_is_active: true,
      employee_id: 4,
      employee_name: 'Priya Sharma',
      manager_id: 2,
      manager_name: 'Vikram Joshi',
      title: 'Complete Distributed Real-Time Notification Pipeline',
      description: 'Zero duplicate points invariant test',
      category: 'delivery',
      status: 'in_progress',
      assigned_points: 10.0,
      current_progress_pct: 85.0,
      target_pct: 100.0,
      previously_earned_points: 7.0,
      earned_points: 1.5,
      remaining_points: 1.5,
      carried_from_goal_id: 101,
      progress_note: 'WebSocket handlers ready',
      created_at: '2026-04-01T00:00:00',
      updated_at: '2026-04-02T00:00:00'
    }
  ]
};

const mockStoryPoints = {
  user_id: 4,
  user_name: 'Priya Sharma',
  title: 'Full Stack Engineer',
  quarter: 'Q3 2026',
  total_points: 21.0,
  tasks_completed_on_time: 4,
  tasks_carried_over: 1,
  on_time_rate_pct: 80.0,
  checkin_streak: 12,
  checkin_consistency_pct: 95.0,
  blockers_resolved: 3,
  carry_over_penalty_pct: 25.0,
  formula_text: 'difficulty * (1.0 - 0.25 * carry_overs)',
  tasks: [
    {
      task_id: 1,
      title: 'Setup Redis Cluster',
      difficulty: 5,
      carried_over_count: 1,
      penalty_pct_applied: 25.0,
      earned_points: 3.75,
      status: 'Done'
    }
  ],
  points_per_sprint: [
    { sprint_id: 42, sprint_name: 'Sprint 42', points: 10.5 },
    { sprint_id: 43, sprint_name: 'Sprint 43', points: 10.5 }
  ]
};

const mockAppraisalEvidence = {
  cycle_id: 2,
  cycle_name: '2026-Q2',
  manager_id: 2,
  manager_name: 'Vikram Joshi',
  disclaimer: 'SyncBrief Performance Points provide objective evidence for human manager review.',
  items: [
    {
      employee_id: 4,
      employee_name: 'Priya Sharma',
      employee_title: 'Full Stack Engineer',
      role_level: 3,
      manager_name: 'Vikram Joshi',
      cycle_id: 2,
      cycle_name: '2026-Q2',
      total_assigned_points: 10.0,
      total_earned_points: 1.5,
      total_remaining_points: 1.5,
      achievement_rate_pct: 85.0,
      goals_completed: 0,
      goals_total: 1,
      carried_goals_count: 1,
      goals: mockPerfSummary.goals
    }
  ]
};

beforeEach(() => {
  (globalThis as any).fetch = vi.fn().mockImplementation((url: string) => {
    if (url.includes('/performance/cycles')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockCycles) });
    }
    if (url.includes('/performance/my-summary')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockPerfSummary) });
    }
    if (url.includes('/points/my-points')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockStoryPoints) });
    }
    if (url.includes('/performance/appraisal-evidence')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAppraisalEvidence) });
    }
    if (url.includes('/points/me')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockStoryPoints) });
    }
    if (url.includes('/points/appraisal')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          manager_id: 2,
          manager_name: 'Vikram Joshi',
          quarter: 'Q3 2026',
          carry_over_penalty_pct: 25.0,
          formula_text: 'difficulty * (1 - 0.25 * carry_overs)',
          employees: []
        })
      });
    }
    if (url.includes('/auth/me')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          id: 4,
          full_name: 'Priya Sharma',
          email: 'priya@syncbrief.internal',
          role: 'employee',
          role_level: 3,
          tenant_id: 1,
          tenant_name: 'SyncBrief Enterprise'
        })
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });
});

describe('Performance Points System & Appraisal Evidence UI', () => {
  it('renders MyPointsPage with dual tabs separating Performance Points from Story Points', async () => {
    render(
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <MyPointsPage />
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    );

    // Verify dual-tab navigation exists
    expect(screen.getByRole('button', { name: /Performance Points/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Task Story Points/i })).toBeDefined();

    // Verify Performance Points tab content loads
    await waitFor(() => {
      expect(screen.getByText(/Performance Points Carry-Forward Architecture/i)).toBeDefined();
      expect(screen.getByText(/Zero Duplication/i)).toBeDefined();
      expect(screen.getByText(/Complete Distributed Real-Time Notification Pipeline/i)).toBeDefined();
      expect(screen.getByText(/Carried Over Goal/i)).toBeDefined();
    });
  });

  it('switches to Task Story Points tab and shows rollover penalty calculator', async () => {
    render(
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <MyPointsPage />
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    );

    // Switch to Story Points tab
    const storyTab = screen.getByRole('button', { name: /Task Story Points/i });
    fireEvent.click(storyTab);

    await waitFor(() => {
      expect(screen.getByText(/Transparent Sprint Points Calculation Formula/i)).toBeDefined();
      expect(screen.getByText(/Points = Difficulty × \(1.0 - 0.25 × CarryOvers\)/i)).toBeDefined();
      expect(screen.getByText(/Sprint Velocity Trend/i)).toBeDefined();
    });
  });

  it('renders AppraisalPage with Human Evaluation disclaimer banner and Performance Evidence', async () => {
    render(
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <AppraisalPage />
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    );

    // Check human appraisal standard disclaimer banner
    expect(screen.getByText(/Human Appraisal & Review Standard/i)).toBeDefined();
    expect(
      screen.getByText(/objective evidence for human manager evaluation/i)
    ).toBeDefined();

    // Wait for Performance Evidence table to load
    await waitFor(() => {
      expect(screen.getByText(/Performance Goals Achievement Evidence/i)).toBeDefined();
      expect(screen.getByText(/Priya Sharma/i)).toBeDefined();
      expect(screen.getByText(/85%/i)).toBeDefined();
    });
  });
});
