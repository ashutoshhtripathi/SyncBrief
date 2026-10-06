import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PerformanceReviewDossier } from '../../components/PerformanceReviewDossier';
import { AppraisalPage } from '../AppraisalPage';
import { AuthProvider } from '../../context/AuthContext';
import { ThemeProvider } from '../../context/ThemeContext';
import { ToastProvider } from '../../context/ToastContext';
import { BrowserRouter } from 'react-router-dom';
import * as api from '../../api';
import { PerformanceReviewDossier as DossierType, PerformanceReviewNote } from '../../types';

const mockManagerUser = {
  id: 2,
  tenant_id: 1,
  email: 'vikram.joshi@syncbrief.ai',
  full_name: 'Vikram Joshi',
  role: 'manager' as const,
  role_level: 2,
  title: 'Engineering Manager',
  reports_to_id: 1,
  timezone: 'Asia/Kolkata',
  reminder_time: '09:30',
  streak_count: 12
};

const mockEmployeeUser = {
  id: 4,
  tenant_id: 1,
  email: 'priya.sharma@syncbrief.ai',
  full_name: 'Priya Sharma',
  role: 'employee' as const,
  role_level: 3,
  title: 'Senior Backend Engineer',
  reports_to_id: 2,
  timezone: 'Asia/Kolkata',
  reminder_time: '09:30',
  streak_count: 5
};

const mockDossierData: DossierType = {
  employee: {
    user_id: 4,
    full_name: 'Priya Sharma',
    email: 'priya.sharma@syncbrief.ai',
    role: 'employee',
    role_level: 3,
    manager_name: 'Vikram Joshi'
  },
  cycle: {
    cycle_id: 2,
    name: '2026-Q2',
    status: 'active',
    start_date: '2026-04-01T00:00:00Z',
    end_date: '2026-06-30T23:59:59Z'
  },
  comparison: {
    current_cycle: {
      cycle_id: 2,
      cycle_name: '2026-Q2',
      assigned_points: 18.0,
      earned_points: 11.0,
      previously_earned_points: 7.0,
      lifetime_earned_points: 18.0,
      remaining_points: 0.0,
      completion_rate_pct: 100.0,
      completed_goals_count: 1,
      total_goals_count: 1
    },
    previous_cycle: {
      cycle_id: 1,
      cycle_name: '2026-Q1',
      assigned_points: 10.0,
      earned_points: 7.0,
      previously_earned_points: 0.0,
      lifetime_earned_points: 7.0,
      remaining_points: 3.0,
      completion_rate_pct: 70.0,
      completed_goals_count: 0,
      total_goals_count: 1
    },
    cycle_over_cycle_delta_pct: 30.0,
    year_to_date_assigned_points: 28.0,
    year_to_date_earned_points: 18.0,
    year_to_date_completion_pct: 64.3,
    yearly_progression: [
      {
        year: 2026,
        assigned_points: 28.0,
        earned_points: 18.0,
        lifetime_earned_points: 25.0,
        completion_rate_pct: 64.3,
        quarters_count: 2,
        quarters: []
      }
    ],
    trend: {
      direction: 'improving',
      delta_pct: 30.0,
      summary: 'Performance completion increased by 30.0 percentage points compared to prior cycle.',
      data_points_count: 2
    }
  },
  goals: [
    {
      goal_id: 101,
      title: 'OAuth 2.1 Multi-Tenant Engine',
      category: 'delivery',
      assigned_points: 10.0,
      previously_earned_points: 7.0,
      cycle_earned_points: 3.0,
      lifetime_earned_points: 10.0,
      remaining_points: 0.0,
      progress: 100.0,
      status: 'completed',
      carried_forward: true,
      carried_from_goal_id: 50,
      source_task_id: 10,
      source_task_title: 'Auth Pipeline Implementation'
    }
  ],
  operational_delivery: {
    completed_tasks: 8,
    tasks_on_time: 7,
    tasks_carried_over: 1,
    on_time_delivery_rate_pct: 87.5,
    checkin_consistency_pct: 92.0,
    checkin_streak: 14,
    blockers_raised: 2,
    blockers_resolved: 2,
    active_blockers: 0,
    story_points_total: 24.5,
    points_per_sprint: [{ sprint: 'Sprint 43', points: 24.5 }]
  },
  verified_evidence: [
    {
      source_type: 'goal',
      source_id: '101',
      title: 'OAuth 2.1 Multi-Tenant Engine',
      author_or_owner: 'Priya Sharma',
      timestamp: '2026-04-15T09:00:00Z',
      excerpt: 'Completed 100% of goal scope.',
      verified: true
    },
    {
      source_type: 'task',
      source_id: '10',
      title: 'Auth Pipeline Implementation',
      author_or_owner: 'Priya Sharma',
      timestamp: '2026-04-14T17:00:00Z',
      excerpt: 'Delivered authentication middleware.',
      verified: true
    }
  ],
  review_intelligence: {
    summary: 'Consolidated review briefing for Priya Sharma.',
    accomplishments: ['Delivered 100% of goal OAuth 2.1 Multi-Tenant Engine.'],
    outstanding_goals: [],
    carried_forward_goals: ['OAuth 2.1 Multi-Tenant Engine: 7.0 locked points from Q1, 3.0 earned in Q2.'],
    active_blockers: [],
    discussion_topics: [
      {
        topic: 'Delivered Goal Milestones & Value Impact',
        category: 'accomplishment',
        summary: 'Review completed performance goals and their business impact.',
        evidence: [
          {
            source_type: 'goal',
            source_id: '101',
            title: 'OAuth 2.1 Multi-Tenant Engine',
            author_or_owner: 'Priya Sharma',
            timestamp: '2026-04-15T09:00:00Z',
            excerpt: 'Completed 100% of goal scope.',
            verified: true
          }
        ]
      }
    ]
  },
  manager_notes: {
    id: 1,
    tenant_id: 1,
    cycle_id: 2,
    user_id: 4,
    manager_id: 2,
    manager_name: 'Vikram Joshi',
    preparation_notes: 'Strong delivery ownership on auth system.',
    discussion_agenda: 'Discuss leading upcoming security review.',
    created_at: '2026-04-20T10:00:00Z',
    updated_at: '2026-04-20T10:00:00Z'
  },
  is_manager_or_director: true,
  evidence_note: 'Consolidated dossier derived strictly from verified SyncBrief database records.'
};

describe('Performance Review Dossier Component & Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. opens and displays employee header and cycle information', async () => {
    vi.spyOn(api, 'fetchPerformanceReviewDossier').mockResolvedValue(mockDossierData);

    render(
      <PerformanceReviewDossier
        userId={4}
        cycleId={2}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId('dossier-loading')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('Priya Sharma')).toBeDefined();
      expect(screen.getByText('2026-Q2')).toBeDefined();
      expect(screen.getByText('employee')).toBeDefined();
      expect(screen.getByText('Vikram Joshi')).toBeDefined();
    });
  });

  it('2. handles loading state properly', () => {
    vi.spyOn(api, 'fetchPerformanceReviewDossier').mockReturnValue(new Promise(() => {}));

    render(
      <PerformanceReviewDossier
        userId={4}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId('dossier-loading')).toBeDefined();
    expect(screen.getByText(/Consolidating verified review records/i)).toBeDefined();
  });

  it('3. displays error state when API fails', async () => {
    vi.spyOn(api, 'fetchPerformanceReviewDossier').mockRejectedValue(new Error('Network error: 403 Forbidden'));

    render(
      <PerformanceReviewDossier
        userId={4}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('dossier-error')).toBeDefined();
      expect(screen.getByText(/Network error: 403 Forbidden/i)).toBeDefined();
    });
  });

  it('4. renders separate performance snapshot dimensions without fake overall score', async () => {
    vi.spyOn(api, 'fetchPerformanceReviewDossier').mockResolvedValue(mockDossierData);

    render(
      <PerformanceReviewDossier
        userId={4}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('performance-snapshot-section')).toBeDefined();
      // Verifies distinct dimensions
      expect(screen.getByText('Performance Goals')).toBeDefined();
      expect(screen.getByText('Cycle Earned Points')).toBeDefined();
      expect(screen.getByText('Task On-Time Rate')).toBeDefined();
      expect(screen.getByText('Check-In Consistency')).toBeDefined();
      expect(screen.getByText('Story Points Delivered')).toBeDefined();
    });
  });

  it('5. renders goals with no-double-counting breakdown and carried-forward badge', async () => {
    vi.spyOn(api, 'fetchPerformanceReviewDossier').mockResolvedValue(mockDossierData);

    render(
      <PerformanceReviewDossier
        userId={4}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('goals-section')).toBeDefined();
      expect(screen.getByText('OAuth 2.1 Multi-Tenant Engine')).toBeDefined();
      expect(screen.getByText('Carried')).toBeDefined();
      // Locked points vs cycle earned
      expect(screen.getByText('7.0')).toBeDefined();
      expect(screen.getByText('3.0')).toBeDefined();
    });
  });

  it('6. renders verified evidence badges using EvidenceCitationBadge', async () => {
    vi.spyOn(api, 'fetchPerformanceReviewDossier').mockResolvedValue(mockDossierData);

    render(
      <PerformanceReviewDossier
        userId={4}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('verified-evidence-section')).toBeDefined();
      expect(screen.getAllByTestId('evidence-goal-101').length).toBeGreaterThan(0);
      expect(screen.getAllByTestId('evidence-task-10').length).toBeGreaterThan(0);
    });
  });

  it('7. renders discussion topics accurately', async () => {
    vi.spyOn(api, 'fetchPerformanceReviewDossier').mockResolvedValue(mockDossierData);

    render(
      <PerformanceReviewDossier
        userId={4}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('discussion-topics-section')).toBeDefined();
      expect(screen.getByText('Delivered Goal Milestones & Value Impact')).toBeDefined();
    });
  });

  it('8. displays and saves private manager notes when viewed by manager/director', async () => {
    vi.spyOn(api, 'fetchPerformanceReviewDossier').mockResolvedValue(mockDossierData);
    const updateSpy = vi.spyOn(api, 'updatePerformanceReviewNotes').mockResolvedValue({
      id: 1,
      tenant_id: 1,
      cycle_id: 2,
      user_id: 4,
      manager_id: 2,
      manager_name: 'Vikram Joshi',
      preparation_notes: 'Updated preparation notes.',
      discussion_agenda: 'Updated discussion agenda.',
      created_at: '2026-04-20T10:00:00Z',
      updated_at: '2026-04-21T12:00:00Z'
    });

    render(
      <PerformanceReviewDossier
        userId={4}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('private-manager-notes-section')).toBeDefined();
    });

    const prepTextarea = screen.getByDisplayValue('Strong delivery ownership on auth system.');
    fireEvent.change(prepTextarea, { target: { value: 'Updated preparation notes.' } });

    const saveBtn = screen.getByText('Save Review Notes');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(4, {
        cycle_id: 2,
        preparation_notes: 'Updated preparation notes.',
        discussion_agenda: 'Discuss leading upcoming security review.'
      });
      expect(screen.getByText('Notes successfully saved')).toBeDefined();
    });
  });

  it('9. strictly hides private manager notes section when viewing employee self-dossier', async () => {
    const employeeDossier: DossierType = {
      ...mockDossierData,
      is_manager_or_director: false,
      manager_notes: null
    };
    vi.spyOn(api, 'fetchPerformanceReviewDossier').mockResolvedValue(employeeDossier);

    render(
      <PerformanceReviewDossier
        userId={4}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Priya Sharma')).toBeDefined();
      expect(screen.queryByTestId('private-manager-notes-section')).toBeNull();
    });
  });

  it('10. integrates into AppraisalPage with Prepare Review button', async () => {
    vi.spyOn(api, 'fetchPerformanceCycles').mockResolvedValue([
      { id: 2, name: '2026-Q2', start_date: '2026-04-01', end_date: '2026-06-30', status: 'active', tenant_id: 1, created_at: '', goals_count: 5, completed_goals_count: 3, is_active: true }
    ]);
    vi.spyOn(api, 'fetchPerformanceAppraisalEvidence').mockResolvedValue({
      cycle_id: 2,
      cycle_name: '2026-Q2',
      manager_id: 2,
      manager_name: 'Vikram Joshi',
      evidence_note: 'Points evidence',
      items: [
        {
          user_id: 4,
          full_name: 'Priya Sharma',
          role: 'employee',
          title: 'Senior Backend Engineer',
          role_level: 3,
          manager_name: 'Vikram Joshi',
          cycle_name: '2026-Q2',
          total_assigned_points: 10.0,
          total_earned_points: 7.0,
          total_remaining_points: 3.0,
          completion_rate_pct: 70.0,
          goals_count: 1,
          completed_goals_count: 0,
          carried_forward_goals_count: 1,
          goals: []
        }
      ],
      employees: []
    });
    vi.spyOn(api, 'fetchAppraisalReport').mockResolvedValue({
      manager_id: 2,
      manager_name: 'Vikram Joshi',
      quarter: 'Q3 2026',
      carry_over_penalty_pct: 25.0,
      formula_text: 'Points formula',
      employees: []
    });
    vi.spyOn(api, 'fetchPerformanceReviewDossier').mockResolvedValue(mockDossierData);

    render(
      <BrowserRouter>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <AppraisalPage />
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </BrowserRouter>
    );

    await waitFor(() => {
      const prepReviewButtons = screen.getAllByText('Prepare Review');
      expect(prepReviewButtons.length).toBeGreaterThan(0);
      fireEvent.click(prepReviewButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByTestId('performance-review-dossier-modal')).toBeDefined();
    });
  });
});
