import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AppLayout } from './components/layout/AppLayout';
import { CommandPalette } from './components/CommandPalette';
import { QuickAddTaskModal } from './components/QuickAddTaskModal';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { AskSyncBriefDrawer } from './components/AskSyncBriefDrawer';

// Pages
import { LoginPage } from './pages/LoginPage';
import { OAuthCallbackPage } from './pages/OAuthCallbackPage';
import { LandingPage } from './pages/LandingPage';
import { CheckinPage } from './pages/CheckinPage';
import { DigestPage } from './pages/DigestPage';
import { BlockerBoardPage } from './pages/BlockerBoardPage';
import { ChannelSimulatorPage } from './pages/ChannelSimulatorPage';
import { InsightsPage } from './pages/InsightsPage';
import { SettingsPrivacyPage } from './pages/SettingsPrivacyPage';
import { SprintBoardPage } from './pages/SprintBoardPage';
import { MyPointsPage } from './pages/MyPointsPage';
import { AppraisalPage } from './pages/AppraisalPage';
import { WhySyncBriefPage } from './pages/WhySyncBriefPage';
import { OrgHierarchyPage } from './pages/OrgHierarchyPage';
import { WhatChangedPage } from './pages/WhatChangedPage';
import { PerformanceHistoryPage } from './pages/PerformanceHistoryPage';
import { DependenciesPage } from './pages/DependenciesPage';
import { ErrorBoundary } from './components/ErrorBoundary';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 30,
    },
  },
});

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  const lastKeyRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  // Global keyboard shortcuts (Cmd+K, Cmd+J, C, ?, /, and G-chords)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl?.tagName || '') ||
        (activeEl as HTMLElement)?.isContentEditable;

      // Cmd+K or Ctrl+K -> Command Palette (works even in inputs)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Cmd+J or Ctrl+J -> Ask SyncBrief Assistant (works even in inputs)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setIsAssistantOpen((prev) => !prev);
        return;
      }

      if (isInput) return;

      const now = Date.now();
      const lastKey = lastKeyRef.current;
      const lastKeyTime = lastKeyTimeRef.current;

      // Single key: C -> Quick Add Task
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setIsQuickAddOpen(true);
        return;
      }

      // Single key: ? -> Keyboard shortcuts cheat-sheet
      if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsOpen(true);
        return;
      }

      // Single key: / -> Open Command Palette search
      if (e.key === '/') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
        return;
      }

      // Two-key chord: G then X
      if (lastKey === 'g' && now - lastKeyTime < 1000) {
        if (e.key === 'b' || e.key === 'B') {
          e.preventDefault();
          navigate('/sprints');
        } else if (e.key === 't' || e.key === 'T') {
          e.preventDefault();
          navigate('/');
        } else if (e.key === 'c' || e.key === 'C') {
          e.preventDefault();
          navigate('/checkin');
        } else if (e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          navigate('/digest');
        } else if (e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          navigate('/points');
        } else if (e.key === 'a' || e.key === 'A') {
          e.preventDefault();
          navigate('/appraisal');
        } else if (e.key === 'w' || e.key === 'W') {
          e.preventDefault();
          navigate('/what-changed');
        } else if (e.key === 'x' || e.key === 'X') {
          e.preventDefault();
          navigate('/dependencies');
        } else if (e.key === 'h' || e.key === 'H') {
          e.preventDefault();
          navigate('/performance-history');
        }
        lastKeyRef.current = '';
        return;
      }

      if (e.key.toLowerCase() === 'g') {
        lastKeyRef.current = 'g';
        lastKeyTimeRef.current = now;
      } else {
        lastKeyRef.current = '';
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  if (location.pathname === '/auth/callback') {
    return <OAuthCallbackPage />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400">
        <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3.5" />
        <div className="text-xs font-semibold tracking-wide">Connecting to secure workspace...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <AppLayout
      onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
      onOpenQuickAdd={() => setIsQuickAddOpen(true)}
      onOpenShortcuts={() => setIsShortcutsOpen(true)}
      onOpenAssistant={() => setIsAssistantOpen(true)}
    >
      <Routes>
        <Route path="/" element={<LandingPage onOpenQuickAdd={() => setIsQuickAddOpen(true)} />} />
        <Route path="/checkin" element={<CheckinPage />} />
        <Route path="/sprints" element={<SprintBoardPage />} />
        <Route path="/dependencies" element={<ErrorBoundary fallbackTitle="Dependency Intelligence"><DependenciesPage /></ErrorBoundary>} />
        <Route path="/points" element={<ErrorBoundary fallbackTitle="Points & Goals Service"><MyPointsPage /></ErrorBoundary>} />
        <Route path="/performance-history" element={<ErrorBoundary fallbackTitle="Performance History & Intelligence"><PerformanceHistoryPage /></ErrorBoundary>} />
        <Route path="/what-changed" element={<ErrorBoundary fallbackTitle="What Changed Intelligence"><WhatChangedPage /></ErrorBoundary>} />
        <Route path="/appraisal" element={<AppraisalPage />} />
        <Route path="/why-syncbrief" element={<WhySyncBriefPage />} />
        <Route path="/hierarchy" element={<OrgHierarchyPage />} />
        <Route path="/digest" element={<DigestPage />} />
        <Route path="/blockers" element={<BlockerBoardPage />} />
        <Route path="/channels" element={<ChannelSimulatorPage />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/settings" element={<SettingsPrivacyPage />} />
      </Routes>

      {/* Modals & Overlays */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onOpenQuickAdd={() => setIsQuickAddOpen(true)}
        onOpenAssistant={() => setIsAssistantOpen(true)}
      />

      <QuickAddTaskModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
      />

      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      <AskSyncBriefDrawer
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
      />
    </AppLayout>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <Router>
              <AppContent />
            </Router>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
