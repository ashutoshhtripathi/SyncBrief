import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { WhySyncBriefPage } from '../WhySyncBriefPage';
import { CommandPalette } from '../../components/CommandPalette';
import { AuthProvider } from '../../context/AuthContext';
import { ThemeProvider } from '../../context/ThemeContext';
import { ToastProvider } from '../../context/ToastContext';

// Mock fetch for clean test environment
(globalThis as any).fetch = vi.fn().mockImplementation((url: string) => {
  if (url.includes('/auth/users')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([
        { id: 1, full_name: 'Sarah Jenkins', role: 'director', title: 'Director', role_level: 1 },
        { id: 2, full_name: 'Vikram Joshi', role: 'manager', title: 'Manager', role_level: 2 },
        { id: 4, full_name: 'Priya Sharma', role: 'employee', title: 'Engineer', role_level: 3 },
      ]),
    });
  }
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve([]),
  });
});

describe('SyncBrief Phase 2 Extended Pages & UX', () => {
  it('renders Why SyncBrief comparison table against Jira', async () => {
    render(
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <WhySyncBriefPage />
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    );

    expect(screen.getByText(/Why SyncBrief AI vs. Jira & SharePoint/i)).toBeDefined();
    expect(screen.getByText(/Feature-by-Feature Capability Matrix/i)).toBeDefined();
    expect(screen.getByText(/Daily Standup Coordination/i)).toBeDefined();
    expect(screen.getByText(/AI Blocker Detection/i)).toBeDefined();
    expect(screen.getByText(/Migration Bridge: Import Jira CSV into Sprint/i)).toBeDefined();
  });

  it('renders Command Palette when open and shows quick navigation shortcuts', () => {
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

    expect(screen.getByPlaceholderText(/Type a command or jump to page.../i)).toBeDefined();
    expect(screen.getByText(/Today Dashboard/i)).toBeDefined();
    expect(screen.getByText(/Sprint Kanban Board/i)).toBeDefined();
    expect(screen.getByText(/Quick Add Task/i)).toBeDefined();
  });

  it('calculates points formula correctly with carry-over decay rate', () => {
    // Points = Difficulty * max(0, 1.0 - 0.25 * carry_overs)
    const calculatePoints = (difficulty: number, carryOverCount: number, decayRate: number = 0.25) => {
      const multiplier = Math.max(0, 1.0 - decayRate * carryOverCount);
      return Math.round(difficulty * multiplier * 10) / 10;
    };

    // Standard completion (0 carry-overs)
    expect(calculatePoints(5, 0)).toBe(5.0);
    expect(calculatePoints(8, 0)).toBe(8.0);

    // Carried over once (25% reduction)
    expect(calculatePoints(5, 1)).toBe(3.8); // 5 * 0.75 = 3.75 -> 3.8
    expect(calculatePoints(8, 1)).toBe(6.0); // 8 * 0.75 = 6.0

    // Carried over twice (50% reduction)
    expect(calculatePoints(8, 2)).toBe(4.0); // 8 * 0.50 = 4.0

    // Carried over 4+ times (reaches 0 points)
    expect(calculatePoints(5, 4)).toBe(0);
  });
});
