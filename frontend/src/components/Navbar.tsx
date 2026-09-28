import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Sparkles, 
  CalendarCheck, 
  FileText, 
  Kanban, 
  BarChart3, 
  MessageSquare, 
  Settings, 
  Sun, 
  Moon, 
  HelpCircle, 
  ShieldCheck, 
  Cpu, 
  ArrowRightLeft,
  Bot
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { fetchSystemStatus } from '../api';
import { SystemStatus } from '../types';

interface NavbarProps {
  onStartTour: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onStartTour }) => {
  const { user, switchRole } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [status, setStatus] = useState<SystemStatus | null>(null);

  useEffect(() => {
    fetchSystemStatus().then(setStatus).catch(() => {});
  }, []);

  const navItems = [
    { label: 'Today', path: '/', icon: CalendarCheck, desc: "Team's daily standup hub" },
    { label: 'Check-in', path: '/checkin', icon: Sparkles, desc: '60s async update with voice-to-text' },
    { label: 'Daily Digest', path: '/digest', icon: FileText, desc: 'AI summary & verifiable citations' },
    { label: 'Blocker Board', path: '/blockers', icon: Kanban, desc: 'Kanban & Azure DevOps work items' },
    { label: 'Insights', path: '/insights', icon: BarChart3, desc: 'Velocity metrics & meeting time saved' },
    { label: 'Teams Simulator', path: '/channels', icon: MessageSquare, desc: 'Opted-in channel evidence source' },
    { label: 'Privacy & Settings', path: '/settings', icon: Settings, desc: 'Channel opt-in & audit trail' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md transition-colors">
      {/* Top Microsoft Innovate Bar */}
      <div className="bg-gradient-to-r from-blue-700 via-sky-600 to-indigo-700 text-white text-xs px-4 py-1.5 flex items-center justify-between font-medium">
        <div className="flex items-center gap-2">
          <span className="bg-white/20 px-2 py-0.5 rounded text-[11px] font-semibold tracking-wider uppercase">Microsoft Innovate 2026</span>
          <span className="hidden md:inline text-white/90">Official Hackathon Submission &bull; Async Updates. Verifiable Evidence. Zero Status Meetings.</span>
        </div>
        <div className="flex items-center gap-3">
          {status && (
            <div className="flex items-center gap-1.5 bg-black/20 px-2.5 py-0.5 rounded-full text-[11px]">
              <Cpu className="w-3 h-3 text-sky-200" />
              <span>{status.badge_label}</span>
              {status.is_mock ? (
                <span className="w-2 h-2 rounded-full bg-amber-400" title="Offline Demo AI active" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-emerald-400" title="Azure OpenAI live" />
              )}
            </div>
          )}
          <button
            onClick={onStartTour}
            className="hover:underline flex items-center gap-1 text-[11px] text-white/90 hover:text-white"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Tour</span>
          </button>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-lg bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg text-slate-900 dark:text-white tracking-tight">SyncBrief</span>
              <span className="text-xs font-semibold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">AI</span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 -mt-1 hidden sm:block">Microsoft Teams & Azure DevOps Native</p>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title={item.desc}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'opacity-70'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User, Role Switcher & Theme */}
        <div className="flex items-center gap-2.5">
          {/* 1-Click Role Switcher */}
          {user && (
            <button
              onClick={switchRole}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-xs"
              title={`Currently logged in as ${user.full_name} (${user.role.toUpperCase()}). Click to switch to ${user.role === 'manager' ? 'Member (Priya)' : 'Manager (Sarah)'}`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-blue-500" />
              <span className="hidden sm:inline">Demo Switch:</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {user.role === 'manager' ? 'Sarah (Manager)' : 'Priya (Member)'}
              </span>
            </button>
          )}

          {/* User Avatar */}
          {user && (
            <div className="flex items-center gap-2 pl-1">
              <img
                src={user.avatar_url || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150'}
                alt={user.full_name}
                className="w-8 h-8 rounded-full object-cover ring-2 ring-blue-500/30"
              />
            </div>
          )}

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Nav strip */}
      <div className="lg:hidden flex items-center overflow-x-auto px-4 py-2 gap-1 border-t border-slate-100 dark:border-slate-800 text-xs">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-1 px-2.5 py-1 rounded whitespace-nowrap ${
                isActive
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </header>
  );
};
