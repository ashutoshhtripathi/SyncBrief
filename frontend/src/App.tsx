import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/Navbar';
import { TourGuide } from './components/TourGuide';
import { DemoScenarioButton } from './components/DemoScenarioButton';

// Pages
import { LandingPage } from './pages/LandingPage';
import { CheckinPage } from './pages/CheckinPage';
import { DigestPage } from './pages/DigestPage';
import { BlockerBoardPage } from './pages/BlockerBoardPage';
import { ChannelSimulatorPage } from './pages/ChannelSimulatorPage';
import { InsightsPage } from './pages/InsightsPage';
import { SettingsPrivacyPage } from './pages/SettingsPrivacyPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 30,
    },
  },
});

export const App: React.FC = () => {
  const [isTourOpen, setIsTourOpen] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Router>
            <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
              {/* Top Navigation */}
              <Navbar onStartTour={() => setIsTourOpen(true)} />

              {/* Main Content Area */}
              <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/checkin" element={<CheckinPage />} />
                  <Route path="/digest" element={<DigestPage />} />
                  <Route path="/blockers" element={<BlockerBoardPage />} />
                  <Route path="/channels" element={<ChannelSimulatorPage />} />
                  <Route path="/insights" element={<InsightsPage />} />
                  <Route path="/settings" element={<SettingsPrivacyPage />} />
                </Routes>
              </main>

              {/* Floating Demo Scenario Action Button for Judges */}
              <DemoScenarioButton />

              {/* 3-Step Guided Product Tour */}
              <TourGuide isOpen={isTourOpen} onClose={() => setIsTourOpen(false)} />

              {/* Footer */}
              <footer className="border-t border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-700 dark:text-slate-300">SyncBrief AI</span>
                    <span>&bull;</span>
                    <span>Microsoft Innovate 2026 Hackathon Demo</span>
                  </div>
                  <div>
                    <span>Async updates. Verifiable evidence. Zero status meetings.</span>
                  </div>
                </div>
              </footer>
            </div>
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
