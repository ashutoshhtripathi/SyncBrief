import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FloatingChatbotWidget } from '../FloatingChatbotWidget';
import { AuthProvider } from '../../context/AuthContext';
import { ThemeProvider } from '../../context/ThemeContext';
import { ToastProvider } from '../../context/ToastContext';
import { BrowserRouter } from 'react-router-dom';
import * as api from '../../api';

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

const renderWithProviders = (ui: React.ReactElement, userObj: any = mockManagerUser) => {
  const storageMock: any = {
    getItem: vi.fn((key) => {
      if (key === 'syncbrief_token') return 'mock-jwt-token';
      if (key === 'syncbrief_user') return JSON.stringify(userObj);
      return null;
    }),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };

  vi.spyOn(api, 'getStorage').mockReturnValue(storageMock);
  vi.spyOn(api, 'getCurrentUser').mockResolvedValue(userObj as any);

  return render(
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            {ui}
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

describe('FloatingChatbotWidget Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. renders launcher button when closed', () => {
    const onToggle = vi.fn();
    renderWithProviders(<FloatingChatbotWidget isOpen={false} onToggle={onToggle} />);

    const launcherBtn = screen.getByRole('button', { name: /Open SyncBrief Real-Time AI Chatbot/i });
    expect(launcherBtn).toBeDefined();
    expect(screen.getByText('Ask SyncBrief AI')).toBeDefined();

    fireEvent.click(launcherBtn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('2. renders chatbot dialog when open with Groq 120B badge', () => {
    renderWithProviders(<FloatingChatbotWidget isOpen={true} onToggle={() => {}} />);

    const dialog = screen.getByRole('dialog', { name: /SyncBrief Real-Time AI Chatbot/i });
    expect(dialog).toBeDefined();
    expect(screen.getByText(/SyncBrief Assistant/i)).toBeDefined();
    expect(screen.getByText(/Groq 120B/i)).toBeDefined();
  });

  it('3. streams real-time response from assistant', async () => {
    vi.spyOn(api, 'streamAssistantMessage').mockImplementation(async (_data, callbacks) => {
      callbacks.onToken('Sprint 43 is active. ');
      callbacks.onToken('Priya is working on OAuth PR #184.');
      callbacks.onDone({
        conversation_id: 'conv-realtime-123',
        citations: [{
          source_type: 'task',
          source_id: '10',
          title: 'Implement Google OAuth login',
          author_or_owner: 'Priya Sharma',
          excerpt: 'Task #10 in progress',
          verified: true
        }],
        insufficient_data: false,
        answer: 'Sprint 43 is active. Priya is working on OAuth PR #184.'
      });
    });

    renderWithProviders(<FloatingChatbotWidget isOpen={true} onToggle={() => {}} />);

    const input = screen.getByTestId('floating-assistant-input');
    fireEvent.change(input, { target: { value: 'What is Priya working on?' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText(/Sprint 43 is active/i)).toBeDefined();
      expect(screen.getByText(/Priya is working on OAuth PR #184/i)).toBeDefined();
    });

    expect(screen.getByText(/Verified Sources \(1\)/i)).toBeDefined();
  });

  it('4. clicking quick prompt chip initiates chat', async () => {
    const streamSpy = vi.spyOn(api, 'streamAssistantMessage').mockImplementation(async (_data, callbacks) => {
      callbacks.onToken('There is 1 active blocker on database migration.');
      callbacks.onDone({
        conversation_id: 'conv-blockers-123',
        citations: [],
        insufficient_data: false,
        answer: 'There is 1 active blocker on database migration.'
      });
    });

    renderWithProviders(<FloatingChatbotWidget isOpen={true} onToggle={() => {}} />);

    const promptBtn = await screen.findByText('What is blocking my team?');
    fireEvent.click(promptBtn);

    expect(streamSpy).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText(/There is 1 active blocker/i)).toBeDefined();
    });
  });

  it('5. reset button clears conversation messages', async () => {
    vi.spyOn(api, 'streamAssistantMessage').mockImplementation(async (_data, callbacks) => {
      callbacks.onToken('Initial answer');
      callbacks.onDone({
        conversation_id: 'conv-reset-test',
        citations: [],
        insufficient_data: false,
        answer: 'Initial answer'
      });
    });

    renderWithProviders(<FloatingChatbotWidget isOpen={true} onToggle={() => {}} />);

    const input = screen.getByTestId('floating-assistant-input');
    fireEvent.change(input, { target: { value: 'Test' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Initial answer')).toBeDefined();
    });

    const resetBtn = screen.getByLabelText('Reset Conversation');
    fireEvent.click(resetBtn);

    expect(screen.queryByText('Initial answer')).toBeNull();
    expect(screen.getByText(/Real-Time Work Intelligence/i)).toBeDefined();
  });

  it('6. expand button triggers onOpenFullDrawer', () => {
    const onOpenFullDrawer = vi.fn();
    renderWithProviders(
      <FloatingChatbotWidget isOpen={true} onToggle={() => {}} onOpenFullDrawer={onOpenFullDrawer} />
    );

    const expandBtn = screen.getByLabelText('Expand to Drawer');
    fireEvent.click(expandBtn);
    expect(onOpenFullDrawer).toHaveBeenCalledTimes(1);
  });
});
