import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  CalendarCheck, 
  Sparkles, 
  Kanban, 
  AlertTriangle, 
  FileText, 
  Award, 
  Users, 
  Network, 
  BarChart3, 
  Settings, 
  Layers, 
  Search, 
  Plus, 
  Sun, 
  Moon, 
  ChevronLeft, 
  ChevronRight, 
  Menu, 
  X, 
  Keyboard, 
  HelpCircle, 
  ArrowRightLeft,
  ChevronDown,
  Cpu
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { fetchSystemStatus, fetchAllUsers } from '../../api';
import { SystemStatus, User as UserType } from '../../types';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';

interface AppLayoutProps {
  children: React.ReactNode;
  onOpenCommandPalette: () => void;
  onOpenQuickAdd: () => void;
  onOpenShortcuts: () => void;
  onStartTour: () => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  onOpenCommandPalette,
  onOpenQuickAdd,
  onOpenShortcuts,
  onStartTour,
}) => {
  const { user, loginAs } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isPersonaOpen, setIsPersonaOpen] = useState(false);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [availableUsers, setAvailableUsers] = useState<UserType[]>([]);

  useEffect(() => {
    fetchSystemStatus().then(setStatus).catch(() => {});
    fetchAllUsers().then(setAvailableUsers).catch(() => {});
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setIsPersonaOpen(false);
  }, [location.pathname]);

  const isManagerOrDirector =
    user?.role === 'manager' ||
    user?.role === 'director' ||
    user?.role === 'admin' ||
    (user?.role_level !== undefined && user.role_level <= 2);

  interface NavItem {
    label: string;
    path: string;
    icon: any;
    desc: string;
    badge?: string;
  }

  // Maximum 6 primary items per role
  const employeeNavItems: NavItem[] = [
    { label: 'Today', path: '/', icon: CalendarCheck, desc: 'My daily standup focus & tasks' },
    { label: 'Check-in', path: '/checkin', icon: Sparkles, desc: '60s async update with AI citations', badge: '60s' },
    { label: 'Sprints', path: '/sprints', icon: Kanban, desc: 'Active sprint tasks & Kanban' },
    { label: 'My Points', path: '/points', icon: Award, desc: 'Delivery points & quarterly velocity' },
    { label: 'Standup Digest', path: '/digest', icon: FileText, desc: 'AI summary & citations' },
    { label: 'Why SyncBrief', path: '/why-syncbrief', icon: Layers, desc: 'SyncBrief vs Jira & CSV import' },
  ];

  const managerNavItems: NavItem[] = [
    { label: 'Today', path: '/', icon: CalendarCheck, desc: 'Team standup pulse & blockers' },
    { label: 'Sprints', path: '/sprints', icon: Kanban, desc: 'Sprint board & carry-over planning' },
    { label: 'Blockers', path: '/blockers', icon: AlertTriangle, desc: 'Verified blocker board & ADO sync' },
    { label: 'Daily Digest', path: '/digest', icon: FileText, desc: 'Executive standup synthesis' },
    { label: 'Team Appraisal', path: '/appraisal', icon: Users, desc: 'Subordinate review matrix & PDF export' },
    { label: 'Team & Org', path: '/hierarchy', icon: Network, desc: 'Reporting tree & backend RBAC' },
  ];

  const primaryNavItems = isManagerOrDirector ? managerNavItems : employeeNavItems;

  const secondaryNavItems = [
    { label: 'Insights & ROI', path: '/insights', icon: BarChart3, desc: 'Meeting time saved calculator' },
    { label: 'Settings', path: '/settings', icon: Settings, desc: 'Privacy channels & audit log' },
  ];

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* ======================================================== */}
      {/* 1. DESKTOP SLIM COLLAPSIBLE SIDEBAR                      */}
      {/* ======================================================== */}
      <aside
        className={`hidden md:flex flex-col border-r border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl transition-all duration-200 z-30 shrink-0 sticky top-0 h-screen ${
          isCollapsed ? 'w-16' : 'w-60'
        }`}
      >
        {/* Brand Header */}
        <div className="h-14 px-3.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80">
          <Link to="/" className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-sky-600 to-indigo-600 text-white flex items-center justify-center shadow-xs p-1 shrink-0">
              <img src="/favicon.svg" alt="SyncBrief AI" className="w-full h-full" />
            </div>
            {!isCollapsed && (
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-extrabold text-sm text-slate-900 dark:text-white tracking-tight">SyncBrief</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                  AI
                </span>
              </div>
            )}
          </Link>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Primary Role-Aware Navigation (Max 6 Items) */}
        <div className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          <div className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 ${isCollapsed ? 'text-center' : ''}`}>
            {isCollapsed ? '•••' : 'Main Workspace'}
          </div>

          {primaryNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                title={item.desc}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150 group ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 font-bold shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                } ${isCollapsed ? 'justify-center px-0' : ''}`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'}`} />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
                {!isCollapsed && item.badge && (
                  <span className="ml-auto text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}

          <div className="pt-4">
            <div className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 ${isCollapsed ? 'text-center' : ''}`}>
              {isCollapsed ? '•••' : 'System'}
            </div>
            {secondaryNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  title={item.desc}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150 group ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  } ${isCollapsed ? 'justify-center px-0' : ''}`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 group-hover:text-slate-600'}`} />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Sidebar Footer: Keyboard Shortcut Hint & Tour */}
        <div className="p-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1">
          <button
            onClick={onOpenShortcuts}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition ${
              isCollapsed ? 'justify-center px-0' : ''
            }`}
            title="Keyboard Shortcuts (?)"
          >
            <Keyboard className="w-4 h-4 shrink-0 text-slate-400" />
            {!isCollapsed && <span>Shortcuts</span>}
            {!isCollapsed && (
              <kbd className="ml-auto px-1.5 py-0.2 text-[9px] font-mono rounded bg-slate-100 dark:bg-slate-800 text-slate-400">
                ?
              </kbd>
            )}
          </button>

          <button
            onClick={onStartTour}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition ${
              isCollapsed ? 'justify-center px-0' : ''
            }`}
            title="Product Tour"
          >
            <HelpCircle className="w-4 h-4 shrink-0 text-slate-400" />
            {!isCollapsed && <span>Guided Tour</span>}
          </button>
        </div>
      </aside>

      {/* ======================================================== */}
      {/* 2. MAIN APP CONTENT CONTAINER + TOP BAR                  */}
      {/* ======================================================== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="h-14 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6">
          {/* Left: Mobile hamburger + search bar */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Open mobile navigation"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Quick Search Button / Command Palette Trigger */}
            <button
              onClick={onOpenCommandPalette}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-blue-400 transition"
              title="Command Palette (Cmd+K or /)"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline text-xs">Search or jump to...</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-[10px] font-mono text-slate-500">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Right: Quick Add Task, Persona Switcher, AI Status, Theme Toggle */}
          <div className="flex items-center gap-2.5">
            {/* Quick Add Task Button */}
            <button
              onClick={onOpenQuickAdd}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition"
              title="Create Task (Press C)"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Add Task</span>
              <kbd className="hidden lg:inline-block px-1 py-0.2 rounded bg-blue-700 text-[9px] font-mono opacity-80">
                C
              </kbd>
            </button>

            {/* Persona Switcher Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsPersonaOpen(!isPersonaOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 hover:border-blue-400 transition"
                title="Switch persona to test hierarchy access"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-blue-500" />
                <span className="font-bold hidden sm:inline">{user?.full_name?.split(' ')[0] || 'User'}</span>
                <span className="font-mono text-[10px] px-1 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold">
                  L{user?.role_level || 3}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {isPersonaOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-2 z-50 animate-in fade-in space-y-1">
                  <div className="px-2.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Switch Test Persona
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-0.5">
                    {availableUsers.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => {
                          loginAs(u.role as any, u.id);
                          setIsPersonaOpen(false);
                        }}
                        className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between transition ${
                          user?.id === u.id
                            ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-bold'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="truncate">
                          <div>{u.full_name}</div>
                          <div className="text-[10px] text-slate-400 font-normal">{u.title}</div>
                        </div>
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 shrink-0">
                          L{u.role_level}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* AI Status Badge */}
            {status && (
              <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                <Cpu className="w-3 h-3 text-blue-500" />
                <span>{status.badge_label}</span>
                <span className={`w-2 h-2 rounded-full ${status.is_mock ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
              </div>
            )}

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>

            {/* User Avatar */}
            {user && (
              <Avatar
                src={user.avatar_url}
                name={user.full_name}
                size="sm"
                isOnline={true}
              />
            )}
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>

        {/* Minimal Footer */}
        <footer className="border-t border-slate-200/80 dark:border-slate-800/80 py-4 px-6 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700 dark:text-slate-300">SyncBrief AI</span>
            <span>&bull;</span>
            <span>Enterprise Async Operations &bull; Microsoft Innovate 2026</span>
          </div>
          <div className="text-[11px] text-slate-400">
            Async updates. Verifiable evidence. Zero status meetings.
          </div>
        </footer>
      </div>

      {/* ======================================================== */}
      {/* 3. MOBILE SLIDE-OUT DRAWER MENU (< 768px)                */}
      {/* ======================================================== */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex animate-in fade-in"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-72 bg-white dark:bg-slate-900 h-full p-4 flex flex-col space-y-4 shadow-2xl animate-in slide-in-from-left duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <img src="/favicon.svg" alt="SyncBrief AI" className="w-6 h-6" />
                <span className="font-bold text-sm text-slate-900 dark:text-white">SyncBrief AI</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1">
              {primaryNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 p-2.5 rounded-xl text-xs font-semibold ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4 text-blue-500" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-1">
                {secondaryNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className="flex items-center gap-3 p-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Icon className="w-4 h-4 text-slate-400" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
