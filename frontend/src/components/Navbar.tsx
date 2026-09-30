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
  Cpu, 
  ArrowRightLeft,
  Bot,
  Menu,
  X,
  CheckCircle2,
  ChevronRight,
  ShieldCheck
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetchSystemStatus().then(setStatus).catch(() => {});
  }, []);

  // Close mobile menu on page change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const navItems = [
    { label: 'Today', path: '/', icon: CalendarCheck, desc: "Team's daily standup hub" },
    { label: 'Check-in', path: '/checkin', icon: Sparkles, desc: '60s async update with voice-to-text', badge: '60s' },
    { label: 'Daily Digest', path: '/digest', icon: FileText, desc: 'AI summary & verifiable citations' },
    { label: 'Blocker Board', path: '/blockers', icon: Kanban, desc: 'Kanban & Azure DevOps work items' },
    { label: 'Insights', path: '/insights', icon: BarChart3, desc: 'Velocity metrics & meeting time saved' },
    { label: 'Teams Simulator', path: '/channels', icon: MessageSquare, desc: 'Opted-in channel evidence source' },
    { label: 'Privacy & Settings', path: '/settings', icon: Settings, desc: 'Channel opt-in & audit trail' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl transition-colors shadow-xs">
      {/* Top Microsoft Innovate Ribbon */}
      <div className="bg-gradient-to-r from-blue-700 via-sky-600 to-indigo-700 text-white text-xs px-4 py-1.5 flex items-center justify-between font-medium">
        <div className="flex items-center gap-2">
          <span className="bg-white/20 px-2 py-0.5 rounded text-[11px] font-semibold tracking-wider uppercase border border-white/20">
            Microsoft Innovate 2026
          </span>
          <span className="hidden md:inline text-white/95 font-normal">
            Official Hackathon Entry &bull; Async Updates &bull; Verifiable Evidence &bull; Zero Status Meetings
          </span>
        </div>

        <div className="flex items-center gap-3">
          {status && (
            <div className="flex items-center gap-1.5 bg-black/25 px-2.5 py-0.5 rounded-full text-[11px] border border-white/10 shadow-xs">
              <Cpu className="w-3 h-3 text-sky-200" />
              <span className="hidden sm:inline text-sky-100">{status.badge_label}</span>
              <span className="sm:hidden text-sky-100">AI</span>
              {status.is_mock ? (
                <span className="w-2 h-2 rounded-full bg-amber-400 ring-2 ring-amber-400/40 animate-pulse" title="Offline Demo AI active" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-400/40 animate-pulse" title="Azure OpenAI live" />
              )}
            </div>
          )}
          <button
            onClick={onStartTour}
            className="flex items-center gap-1 text-[11px] bg-white/15 hover:bg-white/25 px-2.5 py-0.5 rounded-full text-white transition-colors"
            title="Start Interactive Tour"
          >
            <HelpCircle className="w-3.5 h-3.5 text-sky-200" />
            <span className="font-semibold">Take Tour</span>
          </button>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-sky-500 text-white flex items-center justify-center shadow-md shadow-blue-500/25 group-hover:scale-105 transition-all duration-200">
              <Bot className="w-5 h-5" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xl text-slate-900 dark:text-white tracking-tight">SyncBrief</span>
              <span className="text-[11px] font-bold px-1.5 py-0.2 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                AI
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 -mt-0.5 hidden sm:block font-medium">
              Microsoft Teams & ADO Native
            </p>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden xl:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 shadow-xs ring-1 ring-blue-500/20'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
                }`}
                title={item.desc}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="text-[9px] font-bold px-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                    {item.badge}
                  </span>
                )}
                {isActive && (
                  <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right Section: Role Switcher, Profile & Theme */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* 1-Click Role Switcher */}
          {user && (
            <button
              onClick={switchRole}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shadow-xs hover:border-blue-400 dark:hover:border-blue-500"
              title={`Currently logged in as ${user.full_name} (${user.role.toUpperCase()}). Click to switch to ${user.role === 'manager' ? 'Priya (Member)' : 'Sarah (Manager)'}`}
            >
              <div className="p-1 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                <ArrowRightLeft className="w-3 h-3" />
              </div>
              <div className="text-left hidden sm:block">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider leading-none">Persona</div>
                <div className="text-xs font-bold text-blue-600 dark:text-blue-400 leading-tight">
                  {user.role === 'manager' ? 'Sarah (Manager)' : 'Priya (Member)'}
                </div>
              </div>
              <span className="sm:hidden text-xs font-bold text-blue-600 dark:text-blue-400">
                {user.role === 'manager' ? 'Sarah' : 'Priya'}
              </span>
            </button>
          )}

          {/* User Avatar */}
          {user && (
            <div className="relative shrink-0">
              <img
                src={user.avatar_url || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150'}
                alt={user.full_name}
                className="w-9 h-9 rounded-full object-cover ring-2 ring-blue-500/40 shadow-xs"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
            </div>
          )}

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="xl:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer / Dropdown */}
      {mobileMenuOpen && (
        <div className="xl:hidden border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl px-4 py-4 space-y-2 animate-in slide-in-from-top-2 duration-150 shadow-lg">
          <div className="grid grid-cols-2 gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-semibold transition ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-blue-500'}`} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>

          {user && (
            <div className="pt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <img
                  src={user.avatar_url || ''}
                  alt={user.full_name}
                  className="w-7 h-7 rounded-full object-cover"
                />
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">{user.full_name}</div>
                  <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold uppercase">{user.role}</div>
                </div>
              </div>

              <button
                onClick={switchRole}
                className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold text-[11px] border border-blue-200 dark:border-blue-800"
              >
                Switch Role
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
