import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  CalendarCheck, 
  Sparkles, 
  Kanban, 
  FileText, 
  Award, 
  Users, 
  Network, 
  BarChart3, 
  MessageSquare, 
  Settings, 
  Plus, 
  Sun, 
  Moon, 
  ArrowRight,
  LogOut,
  Zap,
  CornerDownLeft,
  X,
  History,
  TrendingUp,
  GitFork
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenQuickAdd: () => void;
  onStartTour?: () => void;
}

interface CommandItem {
  id: string;
  category: 'Navigation' | 'Actions';
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  shortcut?: string;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onOpenQuickAdd,
}) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const isManagerOrDirector =
    user?.role === 'manager' ||
    user?.role === 'director' ||
    user?.role === 'admin' ||
    (user?.role_level !== undefined && user.role_level <= 2);

  const isDirector =
    user?.role === 'director' ||
    user?.role === 'admin' ||
    (user?.role_level !== undefined && user.role_level <= 1);

  const navigationCommands: CommandItem[] = [
    {
      id: 'nav-today',
      category: 'Navigation',
      title: 'Today Dashboard',
      subtitle: 'Personal tasks, team standup pulse & blockers',
      icon: CalendarCheck,
      action: () => { navigate('/'); onClose(); },
      shortcut: 'G T',
    },
    {
      id: 'nav-checkin',
      category: 'Navigation',
      title: 'Submit 60s Check-in',
      subtitle: 'Task-linked daily update with AI citation detection',
      icon: Sparkles,
      action: () => { navigate('/checkin'); onClose(); },
      shortcut: 'G C',
    },
    {
      id: 'nav-sprints',
      category: 'Navigation',
      title: 'Sprint Kanban Board',
      subtitle: 'Drag-and-drop tasks, story points & sprint close flow',
      icon: Kanban,
      action: () => { navigate('/sprints'); onClose(); },
      shortcut: 'G S',
    },
    {
      id: 'nav-blockers',
      category: 'Navigation',
      title: 'AI Blocker Board & DevOps Sync',
      subtitle: 'Verified blocker citations & Azure DevOps sync',
      icon: Zap,
      action: () => { navigate('/blockers'); onClose(); },
      shortcut: 'G B',
    },
    {
      id: 'nav-digest',
      category: 'Navigation',
      title: 'Standup AI Digest',
      subtitle: 'Daily executive summary & source citations',
      icon: FileText,
      action: () => { navigate('/digest'); onClose(); },
      shortcut: 'G D',
    },
    {
      id: 'nav-points',
      category: 'Navigation',
      title: 'My Points & Velocity',
      subtitle: 'Transparent points ledger & quarterly velocity chart',
      icon: Award,
      action: () => { navigate('/points'); onClose(); },
      shortcut: 'G P',
    },
    {
      id: 'nav-dependencies',
      category: 'Navigation',
      title: 'Cross-Team Dependencies',
      subtitle: 'Deterministic tracking of who is waiting on whom & delivery risk',
      icon: GitFork,
      action: () => { navigate('/dependencies'); onClose(); },
      shortcut: 'G D',
    },
    {
      id: 'nav-performance-history',
      category: 'Navigation',
      title: 'My Performance History',
      subtitle: 'Long-term quarterly performance cycles & yearly trend',
      icon: TrendingUp,
      action: () => { navigate('/performance-history'); onClose(); },
      shortcut: 'G H',
    },
    ...(isManagerOrDirector ? [
      {
        id: 'nav-what-changed',
        category: 'Navigation' as const,
        title: 'What Changed Since Yesterday',
        subtitle: 'Verified working-day progress, blockers & manager attention',
        icon: History,
        action: () => { navigate('/what-changed'); onClose(); },
        shortcut: 'G W',
      },
      {
        id: 'nav-appraisal',
        category: 'Navigation' as const,
        title: 'Team Performance Appraisal',
        subtitle: 'Subordinate review matrix with PDF & CSV export',
        icon: Users,
        action: () => { navigate('/appraisal'); onClose(); },
        shortcut: 'G A',
      }
    ] : []),
    {
      id: 'nav-why',
      category: 'Navigation' as const,
      title: 'Why SyncBrief (vs Jira)',
      subtitle: 'Honest comparison, 60s standups & Jira CSV import',
      icon: Sparkles,
      action: () => { navigate('/why-syncbrief'); onClose(); },
    },
    {
      id: 'nav-org',
      category: 'Navigation' as const,
      title: 'Org Hierarchy & Directory',
      subtitle: 'Reporting structure & team directory',
      icon: Network,
      action: () => { navigate('/hierarchy'); onClose(); },
    },
    {
      id: 'nav-insights',
      category: 'Navigation' as const,
      title: 'Insights & Time Saved',
      subtitle: 'Engineering meeting time reclaimed calculation',
      icon: BarChart3,
      action: () => { navigate('/insights'); onClose(); },
    },
    ...(isDirector ? [{
      id: 'nav-channels',
      category: 'Navigation' as const,
      title: 'Teams Channel Simulator',
      subtitle: 'Opted-in raw chat messages and evidence source',
      icon: MessageSquare,
      action: () => { navigate('/channels'); onClose(); },
    }] : []),
    {
      id: 'nav-settings',
      category: 'Navigation' as const,
      title: 'Settings & Channel Opt-in',
      subtitle: 'Privacy boundary controls and audit log',
      icon: Settings,
      action: () => { navigate('/settings'); onClose(); },
    },
  ];

  const actionCommands: CommandItem[] = [
    {
      id: 'action-quick-add',
      category: 'Actions',
      title: 'Quick Add Task',
      subtitle: 'Create a new task with points and assignee',
      icon: Plus,
      action: () => {
        onClose();
        onOpenQuickAdd();
      },
      shortcut: 'C',
    },
    {
      id: 'action-toggle-theme',
      category: 'Actions',
      title: `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`,
      subtitle: 'Toggle interface color palette',
      icon: theme === 'dark' ? Sun : Moon,
      action: () => {
        toggleTheme();
        toast.info(`Switched to ${theme === 'dark' ? 'Light' : 'Dark'} mode`);
        onClose();
      },
    },
    {
      id: 'action-signout',
      category: 'Actions',
      title: 'Sign Out',
      subtitle: `Sign out of ${user?.tenant_name || 'organization'} (${user?.email})`,
      icon: LogOut,
      action: () => {
        onClose();
        logout();
        toast.info('Signed out successfully');
      },
    },
  ];

  const allCommands = [...actionCommands, ...navigationCommands];

  const filteredCommands = allCommands.filter((cmd) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      cmd.title.toLowerCase().includes(q) ||
      (cmd.subtitle && cmd.subtitle.toLowerCase().includes(q)) ||
      cmd.category.toLowerCase().includes(q)
    );
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filteredCommands.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % (filteredCommands.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform animate-in zoom-in-95 duration-150 flex flex-col max-h-[70vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or jump to page... (or type person name)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="flex-1 bg-transparent border-none text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="hidden sm:inline-flex items-center text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No matching commands or pages found.
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={cmd.id}
                  onClick={cmd.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-semibold flex items-center gap-2">
                        <span>{cmd.title}</span>
                        <span className="text-[10px] font-normal text-slate-400 font-mono">
                          {cmd.category}
                        </span>
                      </div>
                      {cmd.subtitle && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {cmd.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {cmd.shortcut && (
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-mono text-slate-500">
                        {cmd.shortcut}
                      </kbd>
                    )}
                    {isSelected && (
                      <CornerDownLeft className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer Shortcut Bar */}
        <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-[11px] text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[9px] font-mono">↑↓</kbd> Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[9px] font-mono">↵</kbd> Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[9px] font-mono">ESC</kbd> Close
            </span>
          </div>
          <div>
            <span className="font-semibold text-blue-600 dark:text-blue-400">SyncBrief AI</span> &bull; 0 status meetings
          </div>
        </div>
      </div>
    </div>
  );
};
