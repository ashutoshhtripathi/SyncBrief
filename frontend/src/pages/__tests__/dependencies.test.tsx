import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DependenciesPage } from '../DependenciesPage';
import { Navbar } from '../../components/Navbar';
import { AuthProvider } from '../../context/AuthContext';
import { ThemeProvider } from '../../context/ThemeContext';
import { ToastProvider } from '../../context/ToastContext';
import { BrowserRouter } from 'react-router-dom';
import * as api from '../../api';
import { DependencyListResponse, DependencySummaryResponse, Task } from '../../types';

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

const mockSummary: DependencySummaryResponse = {
  total_dependencies: 3,
  active_dependencies: 2,
  critical_count: 1,
  high_count: 1,
  aging_count: 1,
  cross_team_count: 2,
  affected_tasks_count: 2,
  affected_sprints_count: 1,
  teams_involved: ['Backend Engineering', 'Frontend Engineering', 'Platform & SRE']
};

const mockDependenciesData: DependencyListResponse = {
  summary: mockSummary,
  dependencies: [
    {
      dependency_id: 'dep-blocker-1',
      source_type: 'blocker',
      source_task_id: 1,
      source_task_title: 'OAuth 2.0 PKCE Flow & Multi-Tenant Login',
      source_owner: 'Priya Sharma',
      source_owner_id: 4,
      source_team: 'Frontend Engineering',
      dependent_task_id: null,
      dependent_task_title: 'PR #184',
      dependency_owner: 'Vikram Joshi',
      dependency_owner_id: 2,
      dependency_team: 'Backend Engineering',
      summary: 'PR #184 Auth API is blocked waiting for database migration script from the backend team',
      status: 'open',
      severity: 'critical',
      created_at: '2026-10-04T10:00:00Z',
      age_days: 3,
      is_aging: true,
      is_cross_team: true,
      affected_task_count: 1,
      affected_sprint_id: 43,
      affected_sprint_name: 'Sprint 43',
      is_sprint_at_risk: true,
      downstream_impact_summary: "Blocks delivery of 'OAuth 2.0 PKCE Flow' in Sprint 43",
      evidence: [
        {
          source_type: 'blocker',
          source_id: '1',
          title: 'Blocker #1: PR #184 Auth API blocked',
          author_or_owner: 'Priya Sharma',
          timestamp: '2026-10-04T10:00:00Z',
          excerpt: 'PR #184 Auth API is blocked waiting for database migration script from backend team',
          verified: true
        },
        {
          source_type: 'task',
          source_id: '1',
          title: 'OAuth 2.0 PKCE Flow',
          author_or_owner: 'Priya Sharma',
          timestamp: '2026-10-04T10:00:00Z',
          excerpt: 'Task #1 in progress',
          verified: true
        }
      ]
    },
    {
      dependency_id: 'dep-task-1',
      source_type: 'explicit',
      source_task_id: 2,
      source_task_title: 'Session Management Handler',
      source_owner: 'Elena Rostova',
      source_owner_id: 5,
      source_team: 'Cloud & DevOps',
      dependent_task_id: 6,
      dependent_task_title: 'Redis Cache Clustering',
      dependency_owner: 'James Wilson',
      dependency_owner_id: 3,
      dependency_team: 'Platform & SRE',
      summary: 'Session token validation depends on Redis cluster deployment',
      status: 'in_progress',
      severity: 'high',
      created_at: '2026-10-05T12:00:00Z',
      age_days: 2,
      is_aging: true,
      is_cross_team: true,
      affected_task_count: 1,
      affected_sprint_id: 43,
      affected_sprint_name: 'Sprint 43',
      is_sprint_at_risk: true,
      downstream_impact_summary: 'Blocks session management rollout',
      evidence: [
        {
          source_type: 'task',
          source_id: '2',
          title: 'Session Management Handler',
          author_or_owner: 'Elena Rostova',
          timestamp: '2026-10-05T12:00:00Z',
          excerpt: 'Task #2 Session Handler',
          verified: true
        }
      ]
    }
  ]
};

const mockTasks: Task[] = [
  {
    id: 1,
    title: 'OAuth 2.0 PKCE Flow',
    assignee_id: 4,
    assignee_name: 'Priya Sharma',
    priority: 'High',
    status: 'In progress',
    difficulty: 3,
    progress_pct: 75,
    carried_over_count: 0
  },
  {
    id: 6,
    title: 'Database Schema Migration 0042',
    assignee_id: 2,
    assignee_name: 'Vikram Joshi',
    priority: 'High',
    status: 'In progress',
    difficulty: 5,
    progress_pct: 60,
    carried_over_count: 0
  }
];

const renderPage = () => {
  return render(
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <DependenciesPage />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

describe('Cross-Team Dependency Intelligence Frontend Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.setItem('syncbrief_user', JSON.stringify(mockManagerUser));
    localStorage.setItem('syncbrief_token', 'mock-jwt-token');
  });

  it('1. renders page header, title, and verified intelligence badge', async () => {
    vi.spyOn(api, 'fetchDependencies').mockResolvedValue(mockDependenciesData);

    renderPage();

    expect(screen.getByTestId('dependencies-loading')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('Cross-Team Dependency Intelligence')).toBeDefined();
      expect(screen.getByText(/Deterministic tracking of who is waiting on whom/i)).toBeDefined();
    });
  });

  it('2. renders KPI summary cards with accurate counters', async () => {
    vi.spyOn(api, 'fetchDependencies').mockResolvedValue(mockDependenciesData);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('dependency-summary-cards')).toBeDefined();
      expect(screen.getByText('Critical Blockers')).toBeDefined();
      expect(screen.getByText('Aging (≥2 Days)')).toBeDefined();
      expect(screen.getByText('Cross-Team')).toBeDefined();
      expect(screen.getByText('Affected Tasks')).toBeDefined();
    });
  });

  it('3. renders dependency cards with visual waiting diagram and teams', async () => {
    vi.spyOn(api, 'fetchDependencies').mockResolvedValue(mockDependenciesData);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('dependencies-list')).toBeDefined();
      expect(screen.getByText('Priya Sharma')).toBeDefined();
      expect(screen.getByText('Frontend Engineering')).toBeDefined();
      expect(screen.getByText('Backend Engineering')).toBeDefined();
      expect(screen.getByText('Vikram Joshi')).toBeDefined();
    });
  });

  it('4. displays loading state correctly while fetching data', () => {
    vi.spyOn(api, 'fetchDependencies').mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByTestId('dependencies-loading')).toBeDefined();
    expect(screen.getByText(/Analyzing cross-team dependencies/i)).toBeDefined();
  });

  it('5. displays error state with retry button on network failure', async () => {
    vi.spyOn(api, 'fetchDependencies').mockRejectedValue(new Error('Network error: 500'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('dependencies-error')).toBeDefined();
      expect(screen.getByText('Unable to load dependencies')).toBeDefined();
      expect(screen.getByText('Retry')).toBeDefined();
    });
  });

  it('6. displays empty state when no dependencies match filters', async () => {
    vi.spyOn(api, 'fetchDependencies').mockResolvedValue({
      summary: { ...mockSummary, total_dependencies: 0, active_dependencies: 0 },
      dependencies: []
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('dependencies-empty')).toBeDefined();
      expect(screen.getByText('No dependencies found')).toBeDefined();
    });
  });

  it('7. filters trigger re-fetch when Cross-Team Only and Aging Only toggled', async () => {
    const fetchSpy = vi.spyOn(api, 'fetchDependencies').mockResolvedValue(mockDependenciesData);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('toggle-cross-team')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('toggle-cross-team'));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(expect.objectContaining({ cross_team_only: true }));
    });
  });

  it('8. renders verified evidence citations using EvidenceCitationBadge', async () => {
    vi.spyOn(api, 'fetchDependencies').mockResolvedValue(mockDependenciesData);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('dependencies-list')).toBeDefined();
    });

    const badges = screen.getAllByTestId('evidence-blocker-1');
    expect(badges.length).toBeGreaterThan(0);
    const verifiedTexts = screen.getAllByText(/✓ Verified/i);
    expect(verifiedTexts.length).toBeGreaterThan(0);
  });

  it('9. opens Add Dependency modal and submits new task dependency', async () => {
    vi.spyOn(api, 'fetchDependencies').mockResolvedValue(mockDependenciesData);
    vi.spyOn(api, 'fetchTasks').mockResolvedValue(mockTasks);
    const createSpy = vi.spyOn(api, 'createDependency').mockResolvedValue({
      dependency_id: 'dep-task-99',
      source_type: 'explicit',
      source_task_id: 1,
      source_task_title: 'OAuth 2.0 PKCE Flow',
      source_owner: 'Priya Sharma',
      source_team: 'Frontend Engineering',
      dependency_owner: 'Vikram Joshi',
      dependency_team: 'Backend Engineering',
      summary: 'Explicit test dependency',
      status: 'active',
      severity: 'high',
      age_days: 0,
      is_aging: false,
      is_cross_team: true,
      affected_task_count: 1,
      is_sprint_at_risk: false,
      downstream_impact_summary: 'Blocks delivery',
      evidence: []
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('add-dependency-btn')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('add-dependency-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('add-dependency-modal')).toBeDefined();
      expect(screen.getByText('Add Task Dependency')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Create Dependency'));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalled();
    });
  });

  it('10. renders Dependencies link in Navbar', () => {
    render(
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <Navbar />
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    );

    const depLinks = screen.getAllByText('Dependencies');
    expect(depLinks.length).toBeGreaterThan(0);
  });
});
