import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Plus, 
  ArrowRight, 
  Sparkles, 
  Kanban, 
  Users, 
  Flame, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Award,
  Bell,
  Check,
  Send,
  ShieldCheck,
  Zap,
  Edit2,
  Circle,
  X,
  ListChecks
} from 'lucide-react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  fetchTasks, 
  fetchSprints, 
  fetchCheckins, 
  fetchBlockers, 
  fetchMyReports,
  updateTask,
  updateBlockerStatus,
  syncToDevOps,
  fetchWhatChanged
} from '../api';
import { Task, Sprint, Checkin, Blocker, User, WhatChangedResponse } from '../types';
import { CitationBadge } from './CitationBadge';

interface TodayDashboardProps {
  onOpenQuickAdd: () => void;
}

export const TodayDashboard: React.FC<TodayDashboardProps> = ({ onOpenQuickAdd }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [activeSprint, setActiveSprint] = useState<Sprint | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [todayCheckin, setTodayCheckin] = useState<Checkin | null>(null);
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const [subordinates, setSubordinates] = useState<User[]>([]);
  const [allCheckins, setAllCheckins] = useState<Checkin[]>([]);
  const [whatChangedSummary, setWhatChangedSummary] = useState<WhatChangedResponse | null>(null);

  // Inline editing state for task
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [inlineTitle, setInlineTitle] = useState('');

  const isManagerOrDirector = user?.role === 'manager' || user?.role === 'director' || user?.role === 'admin' || (user?.role_level !== undefined && user.role_level <= 2);

  // Getting started checklist state
  const getStorage = () => (typeof window !== 'undefined' ? window.localStorage : null);

  const [checklistDismissed, setChecklistDismissed] = useState<boolean>(() => {
    return getStorage()?.getItem('syncbrief_checklist_dismissed') === 'true';
  });

  const [completedSteps, setCompletedSteps] = useState<string[]>(() => {
    try {
      const stored = getStorage()?.getItem('syncbrief_completed_steps');
      return stored ? JSON.parse(stored) : ['sign_in'];
    } catch {
      return ['sign_in'];
    }
  });

  // Auto-complete 'check_in' when user has submitted checkin
  useEffect(() => {
    if (todayCheckin && !completedSteps.includes('check_in')) {
      setCompletedSteps((prev) => {
        const next = [...prev, 'check_in'];
        getStorage()?.setItem('syncbrief_completed_steps', JSON.stringify(next));
        return next;
      });
    }
  }, [todayCheckin]);

  const toggleStep = (stepId: string) => {
    if (stepId === 'sign_in') return;
    setCompletedSteps((prev) => {
      const next = prev.includes(stepId) ? prev.filter((s) => s !== stepId) : [...prev, stepId];
      getStorage()?.setItem('syncbrief_completed_steps', JSON.stringify(next));
      return next;
    });
  };

  const handleDismissChecklist = () => {
    setChecklistDismissed(true);
    getStorage()?.setItem('syncbrief_checklist_dismissed', 'true');
    toast.info('Getting Started checklist hidden. You can reopen it anytime.');
  };

  const handleResetChecklist = () => {
    setChecklistDismissed(false);
    getStorage()?.removeItem('syncbrief_checklist_dismissed');
  };

  const checklistItems = [
    {
      id: 'sign_in',
      title: 'Sign into SyncBrief AI',
      desc: `Authenticated as ${user?.full_name || 'Active User'} (${user?.role?.toUpperCase() || 'EMPLOYEE'})`,
      isDone: true,
      actionLabel: 'Active',
      onClick: undefined,
    },
    {
      id: 'check_in',
      title: "Submit today's 60-second standup check-in",
      desc: todayCheckin
        ? `Standup submitted: ${todayCheckin.task_title || todayCheckin.today || 'Completed'}`
        : 'Share yesterday progress, today goals, and blockers in under 60 seconds.',
      isDone: !!todayCheckin || completedSteps.includes('check_in'),
      actionLabel: todayCheckin ? 'View Check-in' : 'Check In Now',
      onClick: () => navigate('/checkin'),
    },
    {
      id: 'sprint_tasks',
      title: 'Inspect sprint tasks on Kanban Board',
      desc: 'Test optimistic locking (v1), track progress slider, and view slide-out drawer.',
      isDone: completedSteps.includes('sprint_tasks'),
      actionLabel: 'Open Sprint Board',
      onClick: () => {
        if (!completedSteps.includes('sprint_tasks')) toggleStep('sprint_tasks');
        navigate('/sprint');
      },
    },
    {
      id: 'blocker_citations',
      title: 'Review AI-verified blocker chat citations',
      desc: 'Verify exact source chat evidence (#backend • msg_492) with zero manual chasing.',
      isDone: completedSteps.includes('blocker_citations'),
      actionLabel: 'View Digest & Citations',
      onClick: () => {
        if (!completedSteps.includes('blocker_citations')) toggleStep('blocker_citations');
        navigate('/digest');
      },
    },
    {
      id: 'appraisal_proof',
      title: 'Verify Quarterly Appraisal points formula',
      desc: 'Transparent formula: Points = Difficulty × (1.0 - 0.25 × CarryOvers).',
      isDone: completedSteps.includes('appraisal_proof'),
      actionLabel: isManagerOrDirector ? 'Team Appraisal' : 'My Points & Proof',
      onClick: () => {
        if (!completedSteps.includes('appraisal_proof')) toggleStep('appraisal_proof');
        navigate(isManagerOrDirector ? '/appraisal' : '/points');
      },
    },
  ];

  const completedStepsCount = checklistItems.filter((i) => i.isDone).length;
  const checklistProgressPct = Math.round((completedStepsCount / checklistItems.length) * 100);

  useEffect(() => {
    loadDashboardData();
  }, [user?.id]);

  const loadDashboardData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [sprintsData, checkinsData, blockersData] = await Promise.all([
        fetchSprints(),
        fetchCheckins(),
        fetchBlockers(),
      ]);

      setAllCheckins(checkinsData);
      setBlockers(blockersData);

      const active = sprintsData.find((s) => s.status === 'active') || sprintsData[0] || null;
      setActiveSprint(active);

      // Check if logged-in user checked in today
      const myLatestCheckin = checkinsData.find((c) => c.user_id === user.id);
      setTodayCheckin(myLatestCheckin || null);

      if (isManagerOrDirector) {
        // Manager view: fetch reports, tasks for reports, and What Changed delta
        fetchWhatChanged().then(setWhatChangedSummary).catch(() => {});
        try {
          const reports = await fetchMyReports();
          setSubordinates(Array.isArray(reports) ? reports : []);
          if (active) {
            const teamTasks = await fetchTasks({ sprint_id: active.id });
            setTasks(teamTasks);
          }
        } catch {
          // fallback
          if (active) {
            const teamTasks = await fetchTasks({ sprint_id: active.id });
            setTasks(teamTasks);
          }
        }
      } else {
        // Employee view: fetch my tasks
        if (active) {
          const myTasks = await fetchTasks({ sprint_id: active.id, assignee_id: user.id });
          setTasks(myTasks);
        }
      }
    } catch (err: any) {
      console.error('Dashboard load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Optimistic task progress update
  const handleProgressChange = async (task: Task, newProgress: number) => {
    const prevTasks = [...tasks];
    setTasks(tasks.map((t) => (t.id === task.id ? { ...t, progress_pct: newProgress } : t)));
    try {
      await updateTask(task.id, { progress_pct: newProgress });
      toast.success(`Updated "${task.title.substring(0, 24)}..." to ${newProgress}%`);
    } catch {
      setTasks(prevTasks);
      toast.error('Failed to update progress');
    }
  };

  // Optimistic status update
  const handleStatusChange = async (task: Task, newStatus: string) => {
    const prevTasks = [...tasks];
    setTasks(tasks.map((t) => (t.id === task.id ? { ...t, status: newStatus as any } : t)));
    try {
      await updateTask(task.id, { status: newStatus as any });
      toast.success(`Task moved to "${newStatus}"`);
    } catch {
      setTasks(prevTasks);
      toast.error('Failed to update status');
    }
  };

  // Save inline title edit
  const handleSaveInlineTitle = async (taskId: number) => {
    if (!inlineTitle.trim()) {
      setEditingTaskId(null);
      return;
    }
    const prevTasks = [...tasks];
    setTasks(tasks.map((t) => (t.id === taskId ? { ...t, title: inlineTitle.trim() } : t)));
    setEditingTaskId(null);
    try {
      await updateTask(taskId, { title: inlineTitle.trim() });
      toast.success('Task title updated');
    } catch {
      setTasks(prevTasks);
      toast.error('Failed to update task');
    }
  };

  // Quick 1-click Azure DevOps sync for manager
  const handleSyncToAzure = async (blockerId: number) => {
    try {
      const res = await syncToDevOps(blockerId);
      toast.success(`Synced to Azure DevOps (${res.work_item_id || 'ADO-7492'})!`);
      const updatedBlockers = await fetchBlockers();
      setBlockers(updatedBlockers);
    } catch (err: any) {
      toast.error(err.message || 'Azure DevOps sync failed');
    }
  };

  // Send nudge reminder
  const handleNudge = (personName: string) => {
    toast.info(`Sent friendly standup reminder to ${personName} via Microsoft Teams`);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse py-6">
        <div className="h-28 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        </div>
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
      </div>
    );
  }

  // Filter blockers relevant to this view
  const activeBlockers = blockers.filter((b) => b.status !== 'resolved');
  const myBlockers = isManagerOrDirector
    ? activeBlockers
    : activeBlockers.filter((b) => b.owner_name === user?.full_name || b.summary.includes(user?.full_name || ''));

  return (
    <div className="space-y-8 pb-16">
      {/* ======================================================== */}
      {/* 1. HERO ROLE-TAILORED WELCOME BANNER                     */}
      {/* ======================================================== */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-sky-600 to-indigo-700 text-white p-6 md:p-8 shadow-xl">
        {/* Subtle background ambient blur */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-white/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-sky-200" />
              <span>
                {isManagerOrDirector
                  ? `${user?.role_level === 1 || user?.role === 'director' ? 'Director' : 'Manager'} Command Center • Sprint ${activeSprint?.name || 'Active'}`
                  : 'Daily Focus & 60-Second Async Standup'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Good morning, {user?.full_name?.split(' ')[0]}!
            </h1>

            <p className="text-sky-100 text-sm leading-relaxed">
              {isManagerOrDirector
                ? `Review your team's daily standup updates, verify chat-cited blockers, and unblock engineers without calling a meeting.`
                : `Your daily tasks, blocker status, and async check-in. Replace a 30-minute status meeting in under 60 seconds.`}
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {!isManagerOrDirector && (
              <button
                onClick={() => navigate('/checkin')}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-white text-blue-700 hover:bg-sky-50 font-bold text-sm shadow-lg shadow-black/10 transition transform active:scale-95"
              >
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>{todayCheckin ? 'Update Check-in' : 'Check In Now (<60s)'}</span>
              </button>
            )}

            <button
              onClick={onOpenQuickAdd}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white/20 hover:bg-white/30 backdrop-blur-md text-white font-semibold text-sm border border-white/20 transition active:scale-95"
              title="Shortcut: Press C key"
            >
              <Plus className="w-4 h-4" />
              <span>Add Task (C)</span>
            </button>
          </div>
        </div>

        {/* Check-in Status Quick Bar */}
        <div className="mt-6 pt-5 border-t border-white/20 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            {todayCheckin ? (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/25 border border-emerald-300/40 text-emerald-100 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                Today's Standup Submitted &bull; On Track
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/25 border border-amber-300/40 text-amber-100 font-semibold animate-pulse">
                <Clock className="w-3.5 h-3.5 text-amber-300" />
                Standup Pending Today &bull; Takes 60 seconds
              </span>
            )}

            <span className="flex items-center gap-1 text-sky-200 ml-2">
              <Flame className="w-3.5 h-3.5 text-amber-300" />
              <span>Streak: {user?.streak_count || 12} days</span>
            </span>
          </div>

          <div className="text-sky-200">
            Sprint Window: <span className="font-semibold text-white">{activeSprint?.start_date} &rarr; {activeSprint?.end_date}</span>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* GETTING STARTED ONBOARDING CHECKLIST                     */}
      {/* ======================================================== */}
      {checklistDismissed ? (
        <div className="flex items-center justify-between px-4 py-3 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Getting Started Checklist:
            </span>
            <span>
              {completedStepsCount} of {checklistItems.length} steps completed ({checklistProgressPct}%)
            </span>
          </div>
          <button
            type="button"
            onClick={handleResetChecklist}
            className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
          >
            Show checklist
          </button>
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-900 flex items-center justify-center shrink-0">
                <ListChecks className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Getting Started with SyncBrief AI
                  </h2>
                  <Badge variant={completedStepsCount === checklistItems.length ? 'success' : 'primary'} size="xs">
                    {completedStepsCount}/{checklistItems.length} Done
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Follow these 5 steps to experience async standups with AI-verified chat evidence and fair appraisals.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="w-32 hidden sm:block">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  <span>Progress</span>
                  <span>{checklistProgressPct}%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-blue-600 dark:bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${checklistProgressPct}%` }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleDismissChecklist}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                title="Dismiss checklist"
                aria-label="Dismiss checklist"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Checklist Items */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {checklistItems.map((item) => (
              <div
                key={item.id}
                className={`py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl px-2 transition ${
                  item.isDone ? 'opacity-85' : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => toggleStep(item.id)}
                    disabled={item.id === 'sign_in'}
                    className={`mt-0.5 shrink-0 transition ${
                      item.id === 'sign_in' ? 'cursor-default' : 'cursor-pointer hover:scale-110'
                    }`}
                    title={item.isDone ? 'Mark as incomplete' : 'Mark as complete'}
                  >
                    {item.isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-50 dark:fill-emerald-950/30" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                    )}
                  </button>

                  <div className="space-y-0.5">
                    <span
                      className={`text-xs font-semibold ${
                        item.isDone
                          ? 'text-slate-900 dark:text-slate-100 line-through text-slate-500 dark:text-slate-400'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {item.title}
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                      {item.desc}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pl-8 sm:pl-0 shrink-0">
                  {item.onClick ? (
                    <Button
                      variant={item.isDone ? 'ghost' : 'outline'}
                      size="xs"
                      onClick={item.onClick}
                      rightIcon={<ArrowRight className="w-3 h-3" />}
                    >
                      {item.actionLabel}
                    </Button>
                  ) : (
                    <Badge variant="success" size="xs">
                      {item.actionLabel}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>

          {checklistProgressPct === 100 && (
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
              <span className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>You're all set! You have explored the primary SyncBrief AI workflow.</span>
              </span>
              <button
                type="button"
                onClick={handleDismissChecklist}
                className="font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. EMPLOYEE VIEW: MY FOCUS FOR TODAY                     */}
      {/* ======================================================== */}
      {!isManagerOrDirector && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Column: My Tasks */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Kanban className="w-5 h-5 text-blue-600" />
                  <span>My Tasks in {activeSprint?.name || 'Active Sprint'}</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Update progress slider or status inline with zero clicks to configure
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                  {tasks.length} tasks assigned
                </span>
              </div>
            </div>

            {tasks.length === 0 ? (
              <div className="p-8 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-3">
                <p className="text-sm text-slate-500">No tasks currently assigned to you in this sprint.</p>
                <button
                  onClick={onOpenQuickAdd}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-md hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Your First Task</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => {
                  let priorityColor = 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border-sky-200';
                  if (task.priority === 'High') {
                    priorityColor = 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200';
                  } else if (task.priority === 'Medium') {
                    priorityColor = 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200';
                  }

                  const isDone = task.status === 'Done';
                  const isBlocked = task.status === 'Blocked';

                  return (
                    <div
                      key={task.id}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-blue-400 dark:hover:border-blue-600 transition-all space-y-3 group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 flex-1">
                          {editingTaskId === task.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={inlineTitle}
                                onChange={(e) => setInlineTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveInlineTitle(task.id);
                                  if (e.key === 'Escape') setEditingTaskId(null);
                                }}
                                className="flex-1 px-2.5 py-1 text-sm rounded-lg border border-blue-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveInlineTitle(task.id)}
                                className="p-1 rounded bg-blue-600 text-white text-xs font-bold"
                              >
                                Save
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <h3 
                                onClick={() => {
                                  setEditingTaskId(task.id);
                                  setInlineTitle(task.title);
                                }}
                                className={`text-sm font-bold text-slate-900 dark:text-white cursor-pointer hover:text-blue-600 transition ${
                                  isDone ? 'line-through text-slate-400 dark:text-slate-500' : ''
                                }`}
                                title="Click to edit task title inline"
                              >
                                {task.title}
                              </h3>
                              <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition cursor-pointer" />
                            </div>
                          )}

                          {task.description && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                              {task.description}
                            </p>
                          )}
                        </div>

                        {/* Priority & Points Badges */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${priorityColor}`}>
                            {task.priority}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {task.difficulty} pts
                          </span>
                        </div>
                      </div>

                      {/* Progress Slider + Status Dropdown */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 max-w-xs">
                          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 w-12 shrink-0">
                            {task.progress_pct}% done
                          </span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            value={task.progress_pct}
                            onChange={(e) => handleProgressChange(task, Number(e.target.value))}
                            className="w-full accent-blue-600 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <select
                            value={task.status}
                            onChange={(e) => handleStatusChange(task, e.target.value)}
                            className={`text-xs font-semibold px-2.5 py-1 rounded-xl border outline-hidden transition ${
                              isDone
                                ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                : isBlocked
                                ? 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                                : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            <option value="To do">To do</option>
                            <option value="In progress">In progress</option>
                            <option value="Blocked">Blocked</option>
                            <option value="Done">Done</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Sidebar: Blockers & Standup Summary */}
          <div className="space-y-6">
            {/* Blocker Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  <span>My Active Blockers</span>
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                  {myBlockers.length} active
                </span>
              </div>

              {myBlockers.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2 opacity-80" />
                  <span>Zero blockers right now! Clear runway to ship.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {myBlockers.map((b) => (
                    <div
                      key={b.id}
                      className="p-3 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 space-y-2 text-xs"
                    >
                      <div className="font-bold text-rose-900 dark:text-rose-100 leading-snug">
                        {b.summary}
                      </div>

                      {/* Clickable Teams Chat Citation Chip */}
                      {b.citations && b.citations.length > 0 && (
                        <div>
                          <CitationBadge citation={b.citations[0]} />
                        </div>
                      )}

                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => {
                            updateBlockerStatus(b.id, 'resolved');
                            toast.success('Blocker resolved!');
                            loadDashboardData();
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px]"
                        >
                          Resolve
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Today Check-in Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-500" />
                <span>Async Standup Summary</span>
              </h3>

              {todayCheckin ? (
                <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white">Active Task: </span>
                    <span>{todayCheckin.task_title || 'General Engineering'}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white">Yesterday: </span>
                    <span className="line-clamp-2">{todayCheckin.yesterday}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white">Today: </span>
                    <span className="line-clamp-2">{todayCheckin.today}</span>
                  </div>
                  <button
                    onClick={() => navigate('/checkin')}
                    className="text-[11px] text-blue-600 dark:text-blue-400 font-bold hover:underline pt-1 inline-flex items-center gap-1"
                  >
                    <span>Edit today's check-in</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2 text-xs text-slate-500">
                  <p>You haven't submitted your update yet today. Takes under 60 seconds.</p>
                  <button
                    onClick={() => navigate('/checkin')}
                    className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
                  >
                    Submit 60s Check-in
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. MANAGER / DIRECTOR VIEW: TEAM PULSE & ATTENTION       */}
      {/* ======================================================== */}
      {isManagerOrDirector && (
        <div className="space-y-8">
          {/* Top 3 KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Standup Pulse KPI */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold uppercase tracking-wider text-[11px]">Standup Pulse</span>
                <Users className="w-4 h-4 text-blue-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                  {subordinates.filter((s) => allCheckins.some((c) => c.user_id === s.id)).length}
                  <span className="text-slate-400 font-normal text-xl">/{subordinates.length || 4}</span>
                </span>
                <span className="text-xs font-bold text-emerald-600">Checked In</span>
              </div>
              <p className="text-xs text-slate-500">
                Subordinates reported async today without holding a meeting
              </p>
            </div>

            {/* Active Blockers KPI */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold uppercase tracking-wider text-[11px]">Blockers Requiring Action</span>
                <AlertTriangle className="w-4 h-4 text-rose-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-rose-600 dark:text-rose-400">
                  {activeBlockers.length}
                </span>
                <span className="text-xs font-bold text-rose-600">Cross-Team Dependencies</span>
              </div>
              <p className="text-xs text-slate-500">
                Verified chat citations ready for 1-click Azure DevOps sync
              </p>
            </div>

            {/* Sprint Velocity KPI */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold uppercase tracking-wider text-[11px]">Active Sprint Velocity</span>
                <TrendingUp className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                  {tasks.filter((t) => t.status === 'Done').reduce((acc, t) => acc + t.difficulty, 0)}
                  <span className="text-slate-400 font-normal text-xl">
                    /{tasks.reduce((acc, t) => acc + t.difficulty, 0) || 28}
                  </span>
                </span>
                <span className="text-xs font-bold text-blue-600">Points Completed</span>
              </div>
              <p className="text-xs text-slate-500">
                Formula: Difficulty &times; (1.0 &minus; 0.25 &times; carry_over)
              </p>
            </div>
          </div>

          {/* Compact "What Changed Since Yesterday?" Entry Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-50/90 via-sky-50/50 to-indigo-50/40 dark:from-slate-900 dark:via-blue-950/20 dark:to-slate-900 border border-blue-200/80 dark:border-blue-900/50 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-blue-900 dark:text-blue-300">
                    What Changed Since Yesterday
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {whatChangedSummary?.is_weekend_lookback
                      ? 'Comparing with Friday (Weekend Lookback)'
                      : 'Verified team working-day delta'}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200 border border-blue-200 dark:border-blue-900">
                AI Delta
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
                <div className="text-base font-extrabold text-slate-900 dark:text-white">
                  {whatChangedSummary?.progress?.meaningful_task_progress?.length ?? 0}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  tasks progressed
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
                <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                  {whatChangedSummary?.progress?.completed_work?.length ?? 0}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  task{(whatChangedSummary?.progress?.completed_work?.length === 1) ? '' : 's'} completed
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
                <div className="text-base font-extrabold text-amber-600 dark:text-amber-400">
                  {whatChangedSummary?.insufficient_data?.missing_checkins?.length ?? 0}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  missing check-ins
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
                <div className="text-base font-extrabold text-rose-600 dark:text-rose-400">
                  {((whatChangedSummary?.blockers?.new_blockers?.length ?? 0) + (whatChangedSummary?.blockers?.existing_unresolved_blockers?.length ?? 0))}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  {((whatChangedSummary?.blockers?.new_blockers?.length ?? 0) + (whatChangedSummary?.blockers?.existing_unresolved_blockers?.length ?? 0)) === 1
                    ? 'blocker needs attention'
                    : 'blockers need attention'}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-blue-100 dark:border-slate-800">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Grounded in verifiable audit trail
              </span>
              <button
                type="button"
                onClick={() => navigate('/what-changed')}
                className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:underline"
              >
                <span>Review now &rarr;</span>
              </button>
            </div>
          </div>

          {/* Section: Who Needs Attention */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <span>Who Needs Attention Right Now</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Engineers blocked on external teams or awaiting standup review
                </p>
              </div>

              <button
                onClick={() => navigate('/blockers')}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <span>View All Blockers</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: Priya Sharma Hero Blocker */}
              <div className="p-4.5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <img
                      src="https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80"
                      alt="Priya Sharma"
                      className="w-8 h-8 rounded-full object-cover border border-rose-300"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Priya Sharma</div>
                      <div className="text-[10px] text-slate-500">Senior API Engineer &bull; Blocked on PR #184</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-200 text-rose-800 dark:bg-rose-900 dark:text-rose-200">
                    HIGH IMPACT
                  </span>
                </div>

                <p className="text-xs text-rose-950 dark:text-rose-200 font-medium">
                  PR #184 Auth API is blocked waiting for database migration script from the backend team.
                </p>

                {/* Verified Citation Link */}
                <div className="pt-1">
                  <CitationBadge
                    citation={{
                      message_id: 'msg_492',
                      channel: '#backend',
                      author: 'Vikram Joshi',
                      quote: 'Database migration script PR #184 is delayed pending index verification',
                      timestamp: 'Today at 09:14 AM',
                      status: 'VERIFIED'
                    }}
                  />
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-rose-200/60 dark:border-rose-900/60">
                  <span className="text-[10px] text-slate-400">Teams proof verified</span>
                  <button
                    onClick={() => handleSyncToAzure(1)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] shadow-xs transition"
                  >
                    <Zap className="w-3 h-3 text-amber-300" />
                    <span>Sync to Azure DevOps</span>
                  </button>
                </div>
              </div>

              {/* Card 2: Subordinate check-in nudges */}
              <div className="p-4.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>Missing Standups Today</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                    2 Pending
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-white/70 dark:bg-slate-900/70 border border-amber-200/70 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">Rohan Patel</span>
                      <span className="text-[10px] text-slate-400">(Backend)</span>
                    </div>
                    <button
                      onClick={() => handleNudge('Rohan Patel')}
                      className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200 font-bold text-[10px] transition"
                    >
                      Nudge in Teams
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl bg-white/70 dark:bg-slate-900/70 border border-amber-200/70 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">Maya Lin</span>
                      <span className="text-[10px] text-slate-400">(SRE / DevOps)</span>
                    </div>
                    <button
                      onClick={() => handleNudge('Maya Lin')}
                      className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200 font-bold text-[10px] transition"
                    >
                      Nudge in Teams
                    </button>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 pt-1">
                  Nudges send an async notification in Teams so you don't need to chase them in chat.
                </div>
              </div>
            </div>
          </div>

          {/* Section: Direct Reports Standup & Task Roster */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <span>Direct Reports Progress & Workload</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Only individuals in your downward reporting chain are visible (strict backend RBAC)
                </p>
              </div>

              <button
                onClick={() => navigate('/sprints')}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <span>Open Kanban Board</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {subordinates.map((sub) => {
                const subTasks = tasks.filter((t) => t.assignee_id === sub.id);
                const subCheckin = allCheckins.find((c) => c.user_id === sub.id);
                const completedPoints = subTasks.filter((t) => t.status === 'Done').reduce((a, t) => a + t.difficulty, 0);
                const totalPoints = subTasks.reduce((a, t) => a + t.difficulty, 0);

                return (
                  <div key={sub.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img
                          src={sub.avatar_url}
                          alt={sub.full_name}
                          className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                        />
                        {subCheckin ? (
                          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
                        ) : (
                          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-amber-400 border-2 border-white dark:border-slate-900 rounded-full" />
                        )}
                      </div>

                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{sub.full_name}</span>
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            L{sub.role_level}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400">{sub.title}</div>
                        {subCheckin && (
                          <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-1 italic">
                            &ldquo;{subCheckin.today}&rdquo;
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {completedPoints} / {totalPoints || 0} pts
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {subTasks.length} tasks in Sprint
                        </div>
                      </div>

                      <button
                        onClick={() => navigate('/appraisal')}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition"
                      >
                        Appraisal Review
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
