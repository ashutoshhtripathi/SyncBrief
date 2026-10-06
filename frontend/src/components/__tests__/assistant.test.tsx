import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AskSyncBriefDrawer } from '../AskSyncBriefDrawer';
import { Navbar } from '../Navbar';
import { AuthProvider } from '../../context/AuthContext';
import { ThemeProvider } from '../../context/ThemeContext';
import { ToastProvider } from '../../context/ToastContext';
import { BrowserRouter } from 'react-router-dom';
import * as api from '../../api';
import { AssistantChatResponse, EvidenceCitation } from '../../types';

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
  role: 'member' as const,
  role_level: 3,
  title: 'Senior Software Engineer',
  reports_to_id: 2,
  timezone: 'Asia/Kolkata',
  reminder_time: '09:30',
  streak_count: 8
};

const mockCitation: EvidenceCitation = {
  source_type: 'blocker',
  source_id: '1',
  title: 'Database Migration Script v2.4 Pending',
  author_or_owner: 'Priya Sharma',
  timestamp: '2026-10-06T10:00:00Z',
  excerpt: 'PR #184 schema dependency stalled on security audit review',
  verified: true
};

const mockChatResponse: AssistantChatResponse = {
  answer: 'You have 1 active blocker in your authorized scope. The highest priority issue is PR #184 Auth API migration.',
  citations: [mockCitation],
  conversation_id: 'conv-test-uuid-1234',
  insufficient_data: false
};

const renderWithProviders = (ui: React.ReactElement, userObj: any = mockManagerUser) => {
  vi.spyOn(api, 'fetchSystemStatus').mockResolvedValue({
    status: 'online',
    app_name: 'SyncBrief AI',
    version: '2.0.0',
    boot_id: 'boot-123',
    ai_provider: 'Azure OpenAI (gpt-4o)',
    is_mock: false,
    badge_label: 'Azure OpenAI (gpt-4o)',
    azure_openai_configured: true,
    teams_configured: false,
    devops_configured: false
  });

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

describe('Ask SyncBrief Assistant Frontend Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. renders AskSyncBriefDrawer when open', () => {
    renderWithProviders(<AskSyncBriefDrawer isOpen={true} onClose={() => {}} />);
    expect(screen.getByRole('dialog', { name: /Ask SyncBrief Assistant/i })).toBeDefined();
    expect(screen.getByText(/Ask your authorized work intelligence/i)).toBeDefined();
    expect(screen.getByText(/Grounded strictly in your authorized work intelligence/i)).toBeDefined();
  });

  it('2. does not render drawer when isOpen is false', () => {
    renderWithProviders(<AskSyncBriefDrawer isOpen={false} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('3. renders role-aware quick prompts for managers', async () => {
    renderWithProviders(<AskSyncBriefDrawer isOpen={true} onClose={() => {}} />, mockManagerUser);
    await waitFor(() => {
      expect(screen.getByText('What changed yesterday?')).toBeDefined();
      expect(screen.getByText('What is blocking my team?')).toBeDefined();
      expect(screen.getByText('Critical dependencies')).toBeDefined();
    });
  });

  it('4. renders role-aware quick prompts for employees', async () => {
    renderWithProviders(<AskSyncBriefDrawer isOpen={true} onClose={() => {}} />, mockEmployeeUser);
    await waitFor(() => {
      expect(screen.getByText('What changed in my work?')).toBeDefined();
      expect(screen.getByText('What blockers do I currently have?')).toBeDefined();
      expect(screen.getByText('My performance this quarter')).toBeDefined();
    });
  });

  it('5. submits user question and displays assistant answer with citations', async () => {
    const sendSpy = vi.spyOn(api, 'sendAssistantMessage').mockResolvedValue(mockChatResponse);

    renderWithProviders(<AskSyncBriefDrawer isOpen={true} onClose={() => {}} />);

    const input = screen.getByTestId('assistant-input');
    fireEvent.change(input, { target: { value: 'What is blocking my team?' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(sendSpy).toHaveBeenCalledWith({
      message: 'What is blocking my team?',
      conversation_id: undefined
    });

    await waitFor(() => {
      expect(screen.getByText(/You have 1 active blocker in your authorized scope/i)).toBeDefined();
    });

    expect(screen.getByText(/Verified Citations \(1\)/i)).toBeDefined();
    expect(screen.getByText(/Blocker #1/i)).toBeDefined();
  });

  it('6. clicking quick prompt chip sends message immediately', async () => {
    const sendSpy = vi.spyOn(api, 'sendAssistantMessage').mockResolvedValue(mockChatResponse);

    renderWithProviders(<AskSyncBriefDrawer isOpen={true} onClose={() => {}} />, mockManagerUser);

    const promptBtn = await screen.findByText('What is blocking my team?');
    fireEvent.click(promptBtn);

    expect(sendSpy).toHaveBeenCalledWith({
      message: 'What is blocking my team?',
      conversation_id: undefined
    });

    await waitFor(() => {
      expect(screen.getByText(/You have 1 active blocker/i)).toBeDefined();
    });
  });

  it('7. displays insufficient data guardrail alert when insufficient_data is true', async () => {
    vi.spyOn(api, 'sendAssistantMessage').mockResolvedValue({
      answer: "I don't have enough verified SyncBrief data to answer that.",
      citations: [],
      conversation_id: 'conv-insufficient',
      insufficient_data: true
    });

    renderWithProviders(<AskSyncBriefDrawer isOpen={true} onClose={() => {}} />);

    const input = screen.getByTestId('assistant-input');
    fireEvent.change(input, { target: { value: 'What is the weather in Paris?' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText(/I don't have enough verified SyncBrief data to answer that/i)).toBeDefined();
      expect(screen.getByText(/Guardrail Notice:/i)).toBeDefined();
    });
  });

  it('8. displays error alert when API request fails', async () => {
    vi.spyOn(api, 'sendAssistantMessage').mockRejectedValue(new Error('Network error or gateway timeout'));

    renderWithProviders(<AskSyncBriefDrawer isOpen={true} onClose={() => {}} />);

    const input = screen.getByTestId('assistant-input');
    fireEvent.change(input, { target: { value: 'What is blocking my team?' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText(/Assistant Request Failed/i)).toBeDefined();
      expect(screen.getByText(/Network error or gateway timeout/i)).toBeDefined();
    });
  });

  it('9. follow-up message includes conversation_id from previous response', async () => {
    const sendSpy = vi.spyOn(api, 'sendAssistantMessage')
      .mockResolvedValueOnce(mockChatResponse)
      .mockResolvedValueOnce({
        answer: 'The oldest blocker is PR #184 schema dependency, open for 3 days.',
        citations: [mockCitation],
        conversation_id: 'conv-test-uuid-1234',
        insufficient_data: false
      });

    renderWithProviders(<AskSyncBriefDrawer isOpen={true} onClose={() => {}} />);

    const input = screen.getByTestId('assistant-input');
    fireEvent.change(input, { target: { value: 'What is blocking my team?' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText(/You have 1 active blocker/i)).toBeDefined();
    });

    // Send second question
    fireEvent.change(input, { target: { value: 'Which one is oldest?' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(sendSpy).toHaveBeenLastCalledWith({
      message: 'Which one is oldest?',
      conversation_id: 'conv-test-uuid-1234'
    });

    await waitFor(() => {
      expect(screen.getByText(/The oldest blocker is PR #184/i)).toBeDefined();
    });
  });

  it('10. reset conversation button clears message history', async () => {
    vi.spyOn(api, 'sendAssistantMessage').mockResolvedValue(mockChatResponse);

    renderWithProviders(<AskSyncBriefDrawer isOpen={true} onClose={() => {}} />);

    const input = screen.getByTestId('assistant-input');
    fireEvent.change(input, { target: { value: 'What is blocking my team?' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText(/You have 1 active blocker/i)).toBeDefined();
    });

    const resetBtn = screen.getByLabelText(/Reset Conversation/i);
    fireEvent.click(resetBtn);

    expect(screen.queryByText(/You have 1 active blocker/i)).toBeNull();
    expect(screen.getByText(/Ask your authorized work intelligence/i)).toBeDefined();
  });

  it('11. renders Ask SyncBrief button in Navbar and calls onOpenAssistant', () => {
    const onOpenAssistant = vi.fn();
    renderWithProviders(<Navbar onOpenAssistant={onOpenAssistant} />);

    const assistantBtn = screen.getByTitle(/Ask SyncBrief AI/i);
    expect(assistantBtn).toBeDefined();
    fireEvent.click(assistantBtn);
    expect(onOpenAssistant).toHaveBeenCalledTimes(1);
  });
});
