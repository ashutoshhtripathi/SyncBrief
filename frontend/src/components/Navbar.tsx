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
  Cpu, 
  LogOut,
  Building2,
  Menu,
  X,
  Award,
  Users,
  Network,
  ChevronDown,
  Search,
  Plus
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { fetchSystemStatus } from '../api';
import { SystemStatus } from '../types';

interface NavbarProps {
  onStartTour?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenQuickAdd?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  onOpenCommandPalette,
  onOpenQuickAdd,
}) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

  useEffect(() => {
    fetchSystemStatus().then(setStatus).catch(() => {});
  }, []);

  // Close mobile menu on page change
  useEffect(() => {
    setMobileMenuOpen(false);
    setIsProfileDropdownOpen(false);
  }, [location.pathname]);

  const isDirector =
    user?.role === 'director' ||
    user?.role === 'admin' ||
    (user?.role_level !== undefined && user.role_level <= 1);

  const isManager =
    !isDirector &&
    (user?.role === 'manager' ||
      (user?.role_level !== undefined && user.role_level === 2));

  const navItems = [
    { label: 'Today', path: '/', icon: CalendarCheck, desc: "Team's daily standup hub" },
    ...(!isDirector ? [{ label: 'Check-in', path: '/checkin', icon: Sparkles, desc: '60s async update with task link', badge: '60s' }] : []),
    { label: 'Sprints', path: '/sprints', icon: Kanban, desc: 'Sprint Kanban board & story points' },
    { label: 'Blockers', path: '/blockers', icon: Kanban, desc: 'AI blocker board & Azure DevOps' },
    { label: 'Digest', path: '/digest', icon: FileText, desc: 'AI summary & verifiable citations' },
    ...(!isDirector ? [{ label: 'My Points', path: '/points', icon: Award, desc: 'Points earned & delivery velocity' }] : []),
    ...(isDirector || isManager ? [
      { label: 'Appraisal', path: '/appraisal', icon: Users, desc: 'Subordinate team performance review' },
      { label: 'Org & Team', path: '/hierarchy', icon: Network, desc: 'Reporting structure & team directory' },
    ] : []),
    { label: 'Insights', path: '/insights', icon: BarChart3, desc: 'Velocity metrics & meeting time saved' },
    ...(isDirector ? [{ label: 'Teams Source', path: '/channels', icon: MessageSquare, desc: 'Opted-in channel evidence source' }] : []),
    { label: 'Why SyncBrief', path: '/why-syncbrief', icon: Sparkles, desc: 'SyncBrief vs Jira & CSV import' },
    { label: 'Settings', path: '/settings', icon: Settings, desc: 'Channel opt-in & audit trail' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl transition-colors shadow-xs">
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
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Brand with New Modern SVG Logo */}
        <Link to="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg shadow-sky-500/20 group-hover:scale-105 group-hover:shadow-sky-500/35 transition-all duration-200 overflow-hidden ring-1 ring-white/10">
              <img src="/favicon.svg" alt="SyncBrief AI Logo" className="w-full h-full object-contain" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full shadow-xs" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xl text-slate-900 dark:text-white tracking-tight">SyncBrief</span>
              <span className="text-[11px] font-bold px-1.5 py-0.2 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                AI
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 -mt-0.5 hidden sm:block font-medium">
              Teams &bull; DevOps &bull; Async Standup
            </p>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden 2xl:flex items-center gap-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 shadow-xs ring-1 ring-blue-500/20'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
                }`}
                title={item.desc}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="text-[9px] font-bold px-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Medium-screen compact primary links */}
        <nav className="hidden md:flex 2xl:hidden items-center gap-1">
          {navItems.slice(0, 6).map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title={item.desc}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Section: Command Palette, Quick Add, User Profile Menu, Theme */}
        <div className="flex items-center gap-2">
          {/* Quick Command Palette Button */}
          {onOpenCommandPalette && (
            <button
              onClick={onOpenCommandPalette}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:border-blue-400 transition"
              title="Open Command Palette (Cmd+K)"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden xl:inline text-[11px]">Search...</span>
              <kbd className="hidden lg:inline-block px-1 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-[10px] font-mono text-slate-500">
                ⌘K
              </kbd>
            </button>
          )}

          {/* Quick Add Task Button */}
          {onOpenQuickAdd && (
            <button
              onClick={onOpenQuickAdd}
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition"
              title="Quick Add Task (Press C)"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Task</span>
              <kbd className="hidden md:inline-block px-1 py-0.2 rounded bg-blue-700 text-[9px] font-mono opacity-80">
                C
              </kbd>
            </button>
          )}

          {/* Authenticated User Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
              className="flex items-center gap-2 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 hover:border-blue-400 transition"
              title="Account & Organization Profile"
            >
              <div className="relative shrink-0">
                <img
                  src={user?.avatar_url || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150'}
                  alt={user?.full_name || 'User'}
                  className="w-7 h-7 rounded-full object-cover ring-2 ring-blue-500/40"
                />
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white dark:ring-slate-900" />
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
                  {user?.full_name || 'User'}
                </span>
                <span className="text-[10px] text-slate-400 leading-tight truncate max-w-[120px]">
                  {user?.tenant_name || 'SyncBrief Enterprise'}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isProfileDropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-3 z-50 animate-in fade-in space-y-3">
                {/* User info summary */}
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <img
                    src={user?.avatar_url || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150'}
                    alt={user?.full_name || 'User'}
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-blue-500/40"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                      {user?.full_name}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {user?.email}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold uppercase">
                        {user?.role}
                      </span>
                      {user?.role_level && (
                        <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                          Level {user.role_level}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Organization / Tenant info */}
                <div className="px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center gap-2.5 text-xs">
                  <Building2 className="w-4 h-4 text-blue-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Organization</div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {user?.tenant_name || 'SyncBrief Enterprise'}
                    </div>
                  </div>
                </div>

                {/* Sign Out Button */}
                <button
                  onClick={() => {
                    setIsProfileDropdownOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center justify-center gap-2 p-2 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900/60 transition"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="2xl:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer / Dropdown */}
      {mobileMenuOpen && (
        <div className="2xl:hidden border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl px-4 py-4 space-y-2 animate-in slide-in-from-top-2 duration-150 shadow-lg">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
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
            <div className="pt-2 flex flex-col gap-2 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <img
                  src={user.avatar_url || ''}
                  alt={user.full_name}
                  className="w-8 h-8 rounded-full object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-800 dark:text-slate-200 truncate">{user.full_name}</div>
                  <div className="text-[10px] text-slate-400 truncate">{user.email}</div>
                  <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold truncate">
                    {user.title} ({user.tenant_name || 'Organization'})
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                className="w-full flex items-center justify-center gap-2 p-2 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900/60 transition"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
