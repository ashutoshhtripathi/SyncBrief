import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../context/AuthContext';
import { ThemeProvider } from '../../context/ThemeContext';
import { ToastProvider } from '../../context/ToastContext';
import { LoginPage } from '../LoginPage';
import { OAuthCallbackPage } from '../OAuthCallbackPage';
import { AppLayout } from '../../components/layout/AppLayout';
import { OrgHierarchyPage } from '../OrgHierarchyPage';
import { CommandPalette } from '../../components/CommandPalette';

// Mock storage
const storageStore: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => storageStore[key] || null,
  setItem: (key: string, value: string) => { storageStore[key] = value; },
  removeItem: (key: string) => { delete storageStore[key]; },
  clear: () => { Object.keys(storageStore).forEach(k => delete storageStore[k]); }
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

const sessionStore: Record<string, string> = {};
const mockSessionStorage = {
  getItem: (key: string) => sessionStore[key] || null,
  setItem: (key: string, value: string) => { sessionStore[key] = value; },
  removeItem: (key: string) => { delete sessionStore[key]; },
  clear: () => { Object.keys(sessionStore).forEach(k => delete sessionStore[k]); }
};
Object.defineProperty(window, 'sessionStorage', { value: mockSessionStorage });

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

describe('Authentication & User Profile Flow', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  it('renders Login screen with corporate email, password, and enterprise SSO buttons without test account selector', () => {
    render(
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    );

    expect(screen.getByText(/Sign in to your organization/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/name@syncbrief.ai/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/••••••••/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Continue with Google/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Continue with Microsoft/i })).toBeDefined();

    // Verify test accounts UI is removed
    expect(screen.queryByText(/Select Account to Test/i)).toBeNull();
    expect(screen.queryByText(/Sarah Jenkins/i)).toBeNull();
    expect(screen.queryByText(/Alice Smith/i)).toBeNull();
  });

  it('allows manual input of corporate credentials into login fields', () => {
    render(
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    );

    const emailInput = screen.getByPlaceholderText(/name@syncbrief.ai/i) as HTMLInputElement;
    const passwordInput = screen.getByPlaceholderText(/••••••••/i) as HTMLInputElement;

    fireEvent.change(emailInput, { target: { value: 'priya.sharma@syncbrief.ai' } });
    fireEvent.change(passwordInput, { target: { value: 'securepassword123' } });

    expect(emailInput.value).toBe('priya.sharma@syncbrief.ai');
    expect(passwordInput.value).toBe('securepassword123');
  });

  it('renders user profile dropdown in header without persona switcher, and executes Sign Out', async () => {
    const mockUser = {
      id: 1,
      email: 'sarah.jenkins@syncbrief.ai',
      full_name: 'Sarah Jenkins',
      role: 'director' as const,
      title: 'Director of Engineering',
      role_level: 1,
      tenant_id: 1,
      tenant_name: 'SyncBrief Enterprise',
      avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
      timezone: 'America/Los_Angeles',
      reminder_time: '09:00',
      streak_count: 14,
    };

    mockLocalStorage.setItem('syncbrief_token', 'valid-test-token');
    mockLocalStorage.setItem('syncbrief_user', JSON.stringify(mockUser));

    // Mock fetch for GET /api/auth/me
    (globalThis as any).fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/auth/me')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockUser),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ app_name: 'SyncBrief AI', badge_label: 'Online', is_mock: false }),
      });
    });

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ThemeProvider>
            <AuthProvider>
              <ToastProvider>
                <AppLayout
                  onOpenCommandPalette={() => {}}
                  onOpenQuickAdd={() => {}}
                  onOpenShortcuts={() => {}}
                  onStartTour={() => {}}
                >
                  <div>Dashboard Content</div>
                </AppLayout>
              </ToastProvider>
            </AuthProvider>
          </ThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    );

    // Profile menu button in header shows user name & organization
    await waitFor(() => {
      expect(screen.getByText('Sarah Jenkins')).toBeDefined();
      expect(screen.getByText('SyncBrief Enterprise')).toBeDefined();
    });

    // Verify "Switch Test Persona" does NOT exist
    expect(screen.queryByText(/Switch Test Persona/i)).toBeNull();

    // Click profile button to open menu
    const profileButton = screen.getByTitle(/Account & Organization Profile/i);
    fireEvent.click(profileButton);

    // Profile menu shows details and Sign Out button
    expect(screen.getByText('sarah.jenkins@syncbrief.ai')).toBeDefined();
    expect(screen.getByText('Level 1')).toBeDefined();
    const signOutBtn = screen.getByRole('button', { name: /Sign Out/i });
    expect(signOutBtn).toBeDefined();

    // Click Sign Out
    fireEvent.click(signOutBtn);

    // Storage is cleared
    expect(mockLocalStorage.getItem('syncbrief_token')).toBeNull();
    expect(mockLocalStorage.getItem('syncbrief_user')).toBeNull();
  });

  it('enforces role-aware navigation: employee sees contributor sections but not Team Appraisal', async () => {
    const employeeUser = {
      id: 4,
      email: 'priya.sharma@syncbrief.ai',
      full_name: 'Priya Sharma',
      role: 'employee' as const,
      title: 'Senior Frontend Engineer',
      role_level: 3,
      tenant_id: 1,
      tenant_name: 'SyncBrief Enterprise',
      avatar_url: '',
      timezone: 'America/Los_Angeles',
      reminder_time: '09:00',
      streak_count: 5,
    };

    mockLocalStorage.setItem('syncbrief_token', 'valid-employee-token');
    mockLocalStorage.setItem('syncbrief_user', JSON.stringify(employeeUser));

    (globalThis as any).fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/auth/me')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(employeeUser),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ app_name: 'SyncBrief AI', badge_label: 'Online', is_mock: false }),
      });
    });

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ThemeProvider>
            <AuthProvider>
              <ToastProvider>
                <AppLayout
                  onOpenCommandPalette={() => {}}
                  onOpenQuickAdd={() => {}}
                  onOpenShortcuts={() => {}}
                  onStartTour={() => {}}
                >
                  <div>Employee Dashboard Content</div>
                </AppLayout>
              </ToastProvider>
            </AuthProvider>
          </ThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Priya Sharma')).toBeDefined();
    });

    // Employee must see: Today, Check-in, Sprints, Blockers, Daily Digest, My Points
    expect(screen.getAllByText('Today').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Check-in').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sprints').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Blockers').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Daily Digest').length).toBeGreaterThan(0);
    expect(screen.getAllByText('My Points').length).toBeGreaterThan(0);

    // Employee must NOT see Team Appraisal
    expect(screen.queryByText('Team Appraisal')).toBeNull();
  });

  it('enforces role-aware navigation: manager sees Team Appraisal and Team & Org', async () => {
    const managerUser = {
      id: 2,
      email: 'vikram.joshi@syncbrief.ai',
      full_name: 'Vikram Joshi',
      role: 'manager' as const,
      title: 'Engineering Manager',
      role_level: 2,
      tenant_id: 1,
      tenant_name: 'SyncBrief Enterprise',
      avatar_url: '',
      timezone: 'America/Los_Angeles',
      reminder_time: '09:00',
      streak_count: 10,
    };

    mockLocalStorage.setItem('syncbrief_token', 'valid-manager-token');
    mockLocalStorage.setItem('syncbrief_user', JSON.stringify(managerUser));

    (globalThis as any).fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/auth/me')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(managerUser),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ app_name: 'SyncBrief AI', badge_label: 'Online', is_mock: false }),
      });
    });

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ThemeProvider>
            <AuthProvider>
              <ToastProvider>
                <AppLayout
                  onOpenCommandPalette={() => {}}
                  onOpenQuickAdd={() => {}}
                  onOpenShortcuts={() => {}}
                  onStartTour={() => {}}
                >
                  <div>Manager Dashboard Content</div>
                </AppLayout>
              </ToastProvider>
            </AuthProvider>
          </ThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Vikram Joshi')).toBeDefined();
    });

    // Manager sees: Team Appraisal and Team & Org
    expect(screen.getAllByText('Team Appraisal').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Team & Org').length).toBeGreaterThan(0);
  });

  it('renders OrgHierarchyPage without developer Test Visibility controls or banners', async () => {
    const managerUser = {
      id: 2,
      email: 'vikram.joshi@syncbrief.ai',
      full_name: 'Vikram Joshi',
      role: 'manager' as const,
      title: 'Engineering Manager',
      role_level: 2,
      tenant_id: 1,
      tenant_name: 'SyncBrief Enterprise',
    };

    mockLocalStorage.setItem('syncbrief_token', 'valid-manager-token');
    mockLocalStorage.setItem('syncbrief_user', JSON.stringify(managerUser));

    (globalThis as any).fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/hierarchy')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            {
              id: 1,
              full_name: 'Sarah Jenkins',
              role: 'director',
              title: 'Director',
              role_level: 1,
              email: 'sarah.jenkins@syncbrief.ai',
              children: [],
            }
          ]),
        });
      }
      if (url.includes('/auth/users')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 1, full_name: 'Sarah Jenkins', role: 'director', title: 'Director', role_level: 1, email: 'sarah.jenkins@syncbrief.ai' },
            { id: 2, full_name: 'Vikram Joshi', role: 'manager', title: 'Manager', role_level: 2, email: 'vikram.joshi@syncbrief.ai' },
          ]),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ThemeProvider>
            <AuthProvider>
              <ToastProvider>
                <OrgHierarchyPage />
              </ToastProvider>
            </AuthProvider>
          </ThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    );

    // Verify page title is production clean
    await waitFor(() => {
      expect(screen.getByText(/Organization Hierarchy & Directory/i)).toBeDefined();
    });

    // Verify developer "Test Visibility" controls are REMOVED
    expect(screen.queryByText(/Test Visibility/i)).toBeNull();
    expect(screen.queryByText(/Backend Controller Response/i)).toBeNull();
    expect(screen.queryByText(/verify backend 403 rule/i)).toBeNull();
  });

  it('enforces role-aware navigation: director sees executive suite including Team Appraisal and Team & Org', async () => {
    const directorUser = {
      id: 1,
      email: 'sarah.jenkins@syncbrief.ai',
      full_name: 'Sarah Jenkins',
      role: 'director' as const,
      title: 'Director of Engineering',
      role_level: 1,
      tenant_id: 1,
      tenant_name: 'SyncBrief Enterprise',
      avatar_url: '',
      timezone: 'America/Los_Angeles',
      reminder_time: '09:00',
      streak_count: 14,
    };

    mockLocalStorage.setItem('syncbrief_token', 'valid-director-token');
    mockLocalStorage.setItem('syncbrief_user', JSON.stringify(directorUser));

    (globalThis as any).fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/auth/me')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(directorUser),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ app_name: 'SyncBrief AI', badge_label: 'Online', is_mock: false }),
      });
    });

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ThemeProvider>
            <AuthProvider>
              <ToastProvider>
                <AppLayout
                  onOpenCommandPalette={() => {}}
                  onOpenQuickAdd={() => {}}
                  onOpenShortcuts={() => {}}
                  onStartTour={() => {}}
                >
                  <div>Director Dashboard Content</div>
                </AppLayout>
              </ToastProvider>
            </AuthProvider>
          </ThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Sarah Jenkins')).toBeDefined();
    });

    // Director sees: Today, Sprints, Blockers, Daily Digest, Team Appraisal, Team & Org
    expect(screen.getAllByText('Today').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sprints').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Blockers').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Daily Digest').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Team Appraisal').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Team & Org').length).toBeGreaterThan(0);
  });

  it('filters CommandPalette commands by role: employee cannot invoke Team Appraisal', () => {
    const employeeUser = {
      id: 4,
      email: 'priya.sharma@syncbrief.ai',
      full_name: 'Priya Sharma',
      role: 'employee' as const,
      role_level: 3,
      tenant_id: 1,
      tenant_name: 'SyncBrief Enterprise',
    };

    mockLocalStorage.setItem('syncbrief_token', 'valid-employee-token');
    mockLocalStorage.setItem('syncbrief_user', JSON.stringify(employeeUser));

    render(
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <CommandPalette
                isOpen={true}
                onClose={() => {}}
                onOpenQuickAdd={() => {}}
                onStartTour={() => {}}
              />
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    );

    // Contributor commands present
    expect(screen.getByText('Today Dashboard')).toBeDefined();
    expect(screen.getByText('Sprint Kanban Board')).toBeDefined();
    expect(screen.getByText('Submit 60s Check-in')).toBeDefined();

    // Manager/Director appraisal command hidden from employee
    expect(screen.queryByText('Team Performance Appraisal')).toBeNull();
  });

  it('displays error message on LoginPage when authentication fails', async () => {
    (globalThis as any).fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/auth/login')) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ detail: 'Invalid credentials or tenant mismatch.' }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    );

    const emailInput = screen.getByPlaceholderText(/name@syncbrief.ai/i);
    const passwordInput = screen.getByPlaceholderText(/••••••••/i);
    fireEvent.change(emailInput, { target: { value: 'sarah.jenkins@syncbrief.ai' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });

    const submitBtn = screen.getByRole('button', { name: /Sign In/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Invalid credentials or tenant mismatch/i)).toBeDefined();
    });
  });

  it('clears stale session and opens Login page when server rejects token after restart (401)', async () => {
    mockLocalStorage.setItem('syncbrief_token', 'stale-token-from-previous-run');
    mockLocalStorage.setItem('syncbrief_user', JSON.stringify({ full_name: 'Priya Sharma' }));

    (globalThis as any).fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/auth/me')) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ detail: 'Invalid or expired authentication token.' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ app_name: 'SyncBrief AI' }),
      });
    });

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ThemeProvider>
            <AuthProvider>
              <LoginPage />
            </AuthProvider>
          </ThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(mockLocalStorage.getItem('syncbrief_token')).toBeNull();
      expect(mockLocalStorage.getItem('syncbrief_user')).toBeNull();
      expect(screen.getByRole('button', { name: /Sign In/i })).toBeDefined();
    });
  });

  it('renders Continue with Google and Continue with Microsoft buttons on LoginPage', () => {
    render(
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    );

    expect(screen.getByRole('button', { name: /Continue with Google/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Continue with Microsoft/i })).toBeDefined();
    expect(screen.getByText(/or continue with/i)).toBeDefined();
  });

  it('displays configuration alert when Continue with Google is clicked without backend client ID configured', async () => {
    (globalThis as any).fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/auth/oauth/start/google')) {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: () => Promise.resolve({
            detail: 'Google OAuth is not configured on this server. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend environment.',
          }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    );

    const googleBtn = screen.getByRole('button', { name: /Continue with Google/i });
    fireEvent.click(googleBtn);

    await waitFor(() => {
      expect(screen.getByText(/Google OAuth is not configured on this server/i)).toBeDefined();
    });
  });

  it('OAuthCallbackPage successfully handles code exchange and sets up user session', async () => {
    mockSessionStorage.setItem('syncbrief_oauth_state', 'expected-state-xyz');
    mockSessionStorage.setItem('syncbrief_oauth_provider', 'google');

    const mockOAuthUser = {
      id: 99,
      email: 'oauth.developer@syncbrief.ai',
      full_name: 'OAuth Developer',
      role: 'member' as const,
      title: 'Software Engineer',
      role_level: 3,
      tenant_id: 1,
      tenant_name: 'SyncBrief Enterprise',
    };

    (globalThis as any).fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/auth/oauth/callback')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            access_token: 'valid-oauth-session-token',
            refresh_token: 'valid-refresh-token',
            token_type: 'bearer',
            user: mockOAuthUser,
          }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(
      <MemoryRouter initialEntries={['/auth/callback?code=mock-auth-code&state=expected-state-xyz']}>
        <ThemeProvider>
          <AuthProvider>
            <OAuthCallbackPage />
          </AuthProvider>
        </ThemeProvider>
      </MemoryRouter>
    );

    // Verifies loading state is rendered during processing
    expect(screen.getByText(/Completing Google Identity Sign-In/i)).toBeDefined();

    // Verifies storage updated with received token and user
    await waitFor(() => {
      expect(mockLocalStorage.getItem('syncbrief_token')).toBe('valid-oauth-session-token');
      const savedUser = JSON.parse(mockLocalStorage.getItem('syncbrief_user') || '{}');
      expect(savedUser.email).toBe('oauth.developer@syncbrief.ai');
      // Verifies transient oauth state cleaned up
      expect(mockSessionStorage.getItem('syncbrief_oauth_state')).toBeNull();
    });
  });
});



