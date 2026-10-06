import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, 
  RotateCw, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  TrendingUp, 
  Kanban, 
  Users, 
  Clock, 
  ArrowRight, 
  AlertCircle,
  ShieldCheck,
  Layers,
  ChevronRight,
  ExternalLink,
  Info,
  CalendarDays,
  Zap,
  CheckSquare
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchWhatChanged } from '../api';
import { WhatChangedResponse, EvidenceCitation } from '../types';
import { EvidenceCitationGroup } from '../components/EvidenceCitationBadge';

export type ActionCategory = 'BLOCKER' | 'MISSING_CHECKIN' | 'RISK' | 'PROGRESS_REVIEW';
export type ActionSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface ManagerAction {
  id: string;
  category: ActionCategory;
  severity: ActionSeverity;
  title: string;
  description: string;
  suggestedAction: string;
  ownerOrPerson?: string;
  entityRoute?: string;
  actionButtonText?: string;
  evidence: EvidenceCitation[];
}

const SEVERITY_ORDER: Record<ActionSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export const normalizeSeverity = (s?: string): ActionSeverity => {
  const lower = (s || '').toLowerCase();
  if (lower === 'critical' || lower === 'urgent') return 'critical';
  if (lower === 'high') return 'high';
  if (lower === 'medium') return 'medium';
  return 'low';
};

export const deriveManagerActions = (data: WhatChangedResponse): ManagerAction[] => {
  const actions: ManagerAction[] = [];
  const handledBlockerIds = new Set<number>();
  const handledMissingNames = new Set<string>();

  // 1. Process explicit backend attention items
  const attentionItems = data.needs_manager_attention || [];
  for (const item of attentionItems) {
    const rawAction = item.action || '';
    const rawActionLower = rawAction.toLowerCase();
    const severity = normalizeSeverity(item.priority);

    if (item.item_id.startsWith('attn_blocker_') || rawActionLower.includes('unblock') || rawActionLower.includes('blocker')) {
      const match = item.item_id.match(/attn_blocker_(\d+)/);
      const bId = match ? Number(match[1]) : undefined;
      if (bId) handledBlockerIds.add(bId);

      actions.push({
        id: item.item_id,
        category: 'BLOCKER',
        severity,
        title: 'Blocker Resolution Required',
        description: rawAction,
        suggestedAction: item.suggested_channel
          ? `Review dependency and coordinate resolution via ${item.suggested_channel}.`
          : 'Review dependency and assign an unblocking owner.',
        ownerOrPerson: item.target_person,
        entityRoute: '/blockers',
        actionButtonText: 'View Blocker',
        evidence: item.evidence || [],
      });
    } else if (item.item_id.startsWith('attn_nudge_') || rawActionLower.includes('check-in') || rawActionLower.includes('standup') || rawActionLower.includes('missing')) {
      if (item.target_person) {
        item.target_person.split(',').forEach(n => handledMissingNames.add(n.trim().toLowerCase()));
      }

      actions.push({
        id: item.item_id,
        category: 'MISSING_CHECKIN',
        severity,
        title: 'Missing Standup Check-in',
        description: rawAction,
        suggestedAction: item.suggested_channel
          ? `Send async standup reminder via ${item.suggested_channel}.`
          : 'Send reminder or follow up asynchronously regarding standup.',
        ownerOrPerson: item.target_person,
        entityRoute: '/checkin',
        actionButtonText: 'View Check-in',
        evidence: item.evidence || [],
      });
    } else if (item.item_id.startsWith('attn_risk_') || rawActionLower.includes('risk') || rawActionLower.includes('delay')) {
      actions.push({
        id: item.item_id,
        category: 'RISK',
        severity,
        title: 'Sprint Delivery Risk',
        description: rawAction,
        suggestedAction: 'Review sprint deliverables and adjust milestone scope if needed.',
        ownerOrPerson: item.target_person,
        entityRoute: '/sprints',
        actionButtonText: 'View Sprint',
        evidence: item.evidence || [],
      });
    } else if (item.item_id.startsWith('attn_progress_') || item.item_id.startsWith('attn_review_') || rawActionLower.includes('review') || rawActionLower.includes('pr')) {
      actions.push({
        id: item.item_id,
        category: 'PROGRESS_REVIEW',
        severity,
        title: 'Progress Review Required',
        description: rawAction,
        suggestedAction: 'Inspect work deliverables and verify acceptance criteria.',
        ownerOrPerson: item.target_person,
        entityRoute: '/sprints',
        actionButtonText: 'View Task',
        evidence: item.evidence || [],
      });
    } else {
      actions.push({
        id: item.item_id,
        category: 'PROGRESS_REVIEW',
        severity,
        title: 'Manager Review Recommended',
        description: rawAction,
        suggestedAction: 'Review item status and confirm next steps.',
        ownerOrPerson: item.target_person,
        entityRoute: '/sprints',
        actionButtonText: 'View Task',
        evidence: item.evidence || [],
      });
    }
  }

  // 2. Add any New Blockers not already captured
  for (const b of data.blockers?.new_blockers || []) {
    if (!handledBlockerIds.has(b.blocker_id)) {
      handledBlockerIds.add(b.blocker_id);
      const sev = normalizeSeverity(b.severity);
      actions.push({
        id: `blocker_new_${b.blocker_id}`,
        category: 'BLOCKER',
        severity: sev,
        title: `New Blocker: ${b.owner}`,
        description: `${b.summary} (Affects ${b.owner}${b.blocked_by && b.blocked_by !== 'Unassigned' ? `, blocked by ${b.blocked_by}` : ''})`,
        suggestedAction: sev === 'high' || sev === 'critical'
          ? 'Review external dependency and confirm an unblocking owner.'
          : 'Coordinate with blocker owner to confirm status and next steps.',
        ownerOrPerson: b.owner,
        entityRoute: '/blockers',
        actionButtonText: 'View Blocker',
        evidence: b.evidence || [],
      });
    }
  }

  // 3. Add any Existing Unresolved Blockers not already captured
  for (const b of data.blockers?.existing_unresolved_blockers || []) {
    if (!handledBlockerIds.has(b.blocker_id)) {
      handledBlockerIds.add(b.blocker_id);
      const sev = normalizeSeverity(b.severity);
      actions.push({
        id: `blocker_unresolved_${b.blocker_id}`,
        category: 'BLOCKER',
        severity: sev,
        title: `Aging Blocker (${b.age_days}d): ${b.owner}`,
        description: `Unresolved for ${b.age_days} day${b.age_days === 1 ? '' : 's'}: ${b.summary}`,
        suggestedAction: b.age_days >= 3
          ? 'Escalate aging blocker to prevent downstream sprint delivery delay.'
          : 'Follow up on blocker progress and verify resolution runway.',
        ownerOrPerson: b.owner,
        entityRoute: '/blockers',
        actionButtonText: 'View Blocker',
        evidence: b.evidence || [],
      });
    }
  }

  // 4. Add missing check-in action if not already handled
  const missingCheckins = data.insufficient_data?.missing_checkins || [];
  const unhandledMissing = missingCheckins.filter(name => !handledMissingNames.has(name.toLowerCase()));
  if (unhandledMissing.length > 0 && handledMissingNames.size === 0) {
    actions.push({
      id: 'missing_checkins_group',
      category: 'MISSING_CHECKIN',
      severity: 'medium',
      title: 'Missing Standup Updates',
      description: `${unhandledMissing.length} team member${unhandledMissing.length === 1 ? '' : 's'} have not submitted updates: ${unhandledMissing.join(', ')}.`,
      suggestedAction: 'Send reminders or check in with team members regarding standup updates.',
      ownerOrPerson: unhandledMissing.join(', '),
      entityRoute: '/checkin',
      actionButtonText: 'View Check-in',
      evidence: [],
    });
  }

  // 5. Add any risks from data.risks
  for (const r of data.risks || []) {
    const sev = normalizeSeverity(r.severity);
    actions.push({
      id: `risk_${r.risk_id}`,
      category: 'RISK',
      severity: sev,
      title: 'Delivery Risk Flagged',
      description: r.summary,
      suggestedAction: r.rationale || 'Review sprint commitments and mitigate dependency risks.',
      ownerOrPerson: undefined,
      entityRoute: '/sprints',
      actionButtonText: 'View Sprint',
      evidence: r.evidence || [],
    });
  }

  // 6. Sort deterministically by severity: critical -> high -> medium -> low
  actions.sort((a, b) => {
    const diff = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });

  return actions;
};

export const WhatChangedPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [data, setData] = useState<WhatChangedResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);

  // Optional custom dates
  const [targetDateInput, setTargetDateInput] = useState('');
  const [compareDateInput, setCompareDateInput] = useState('');

  // Role Gate check
  const isDirector =
    user?.role === 'director' ||
    user?.role === 'admin' ||
    (user?.role_level !== undefined && user.role_level <= 1);

  const isManager =
    !isDirector &&
    (user?.role === 'manager' ||
      (user?.role_level !== undefined && user.role_level === 2));

  const hasAccess = isDirector || isManager;

  useEffect(() => {
    if (!hasAccess) {
      setIsForbidden(true);
      setIsLoading(false);
      return;
    }
    loadData();
  }, [user?.id, hasAccess]);

  const loadData = async (targetDate?: string, compareDate?: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    setIsForbidden(false);

    try {
      const response = await fetchWhatChanged(targetDate, compareDate);
      setData(response);
      if (response.target_date) setTargetDateInput(response.target_date);
      if (response.previous_working_day) setCompareDateInput(response.previous_working_day);
    } catch (err: any) {
      if (err.status === 403 || (err.message && err.message.includes('403'))) {
        setIsForbidden(true);
      } else {
        setErrorMsg(err.message || 'Failed to load team delta changes.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetchWhatChanged(targetDateInput || undefined, compareDateInput || undefined);
      setData(response);
      toast.success('Team delta intelligence refreshed successfully.');
    } catch (err: any) {
      if (err.status === 403 || (err.message && err.message.includes('403'))) {
        setIsForbidden(true);
      } else {
        toast.error(err.message || 'Failed to refresh delta.');
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatDateDisplay = (isoStr?: string) => {
    if (!isoStr) return '';
    try {
      const parts = isoStr.split('T')[0].split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
      }
      return isoStr;
    } catch {
      return isoStr;
    }
  };

  // Severity color helper
  const getSeverityBadge = (severity: string) => {
    const sev = severity.toLowerCase();
    if (sev === 'critical' || sev === 'urgent') {
      return 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-900';
    }
    if (sev === 'high') {
      return 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-orange-300 dark:border-orange-900';
    }
    if (sev === 'medium') {
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-900';
    }
    return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300 dark:border-blue-900';
  };

  // Category styling helper
  const getCategoryBadge = (category: ActionCategory) => {
    switch (category) {
      case 'BLOCKER':
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-900';
      case 'MISSING_CHECKIN':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-900';
      case 'RISK':
        return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900';
      case 'PROGRESS_REVIEW':
      default:
        return 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200 dark:border-sky-900';
    }
  };

  const getCategoryIcon = (category: ActionCategory) => {
    switch (category) {
      case 'BLOCKER':
        return <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />;
      case 'MISSING_CHECKIN':
        return <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />;
      case 'RISK':
        return <ShieldAlert className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />;
      case 'PROGRESS_REVIEW':
      default:
        return <CheckSquare className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />;
    }
  };

  const formatCategoryLabel = (category: ActionCategory) => {
    switch (category) {
      case 'BLOCKER':
        return 'Blocker';
      case 'MISSING_CHECKIN':
        return 'Missing Check-in';
      case 'RISK':
        return 'Delivery Risk';
      case 'PROGRESS_REVIEW':
        return 'Progress Review';
    }
  };

  // =========================================================================
  // 1. FORBIDDEN STATE (Employee or 403 Response)
  // =========================================================================
  if (isForbidden || !hasAccess) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 flex items-center justify-center">
            <ShieldAlert className="w-7 h-7 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Access Restricted (403 Forbidden)
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Team delta intelligence is reserved for engineering managers and directors. You do not have permission to access team-wide comparison reports.
            </p>
          </div>
          <div className="pt-2">
            <a
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition"
            >
              Return to Today Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. LOADING STATE
  // =========================================================================
  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-8 pb-16">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div className="space-y-2">
            <div className="h-8 w-64 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
            <div className="h-4 w-96 bg-slate-100 dark:bg-slate-850 rounded-md animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
        <div className="space-y-4">
          <div className="h-44 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          <div className="h-44 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
        </div>
      </div>
    );
  }

  // =========================================================================
  // 3. ERROR STATE
  // =========================================================================
  if (errorMsg || !data) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Unable to load team delta intelligence
            </h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {errorMsg || 'An unexpected error occurred while querying delta context.'}
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => loadData()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Retry Query</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Derive manager actions
  const actionItems = deriveManagerActions(data);

  // Quick summary counts
  const blockerActionsCount = actionItems.filter(a => a.category === 'BLOCKER').length;
  const missingCheckinsCount = (data.insufficient_data?.missing_checkins?.length || 0);
  const riskActionsCount = actionItems.filter(a => a.category === 'RISK').length;

  // Detailed progress & delta sections
  const completedWork = data.progress?.completed_work || [];
  const meaningfulProgress = data.progress?.meaningful_task_progress || [];
  const sprintProgress = data.progress?.sprint_progress;
  const newBlockers = data.blockers?.new_blockers || [];
  const existingBlockers = data.blockers?.existing_unresolved_blockers || [];
  const risks = data.risks || [];
  const insufficientData = data.insufficient_data;

  const totalDeltaEvents = 
    completedWork.length + 
    meaningfulProgress.length + 
    newBlockers.length + 
    existingBlockers.length + 
    risks.length + 
    actionItems.length;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      {/* ========================================================================= */}
      {/* HEADER & COMPARISON WINDOW SUMMARY                                        */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-900 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>What Changed Since Yesterday?</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold">
                  AI Verified Delta
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                A verified view of meaningful team changes since the previous working day.
              </p>
            </div>
          </div>

          {/* Comparison Window Details */}
          <div className="mt-3 flex flex-wrap items-center gap-2.5 text-xs">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 font-medium text-slate-700 dark:text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-blue-500" />
              <span>Today: <strong className="text-slate-900 dark:text-white">{formatDateDisplay(data.target_date)}</strong></span>
              <span className="opacity-40">&bull;</span>
              <span>Compared with: <strong className="text-slate-900 dark:text-white">{formatDateDisplay(data.previous_working_day)}</strong></span>
            </div>

            {data.is_weekend_lookback && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-semibold text-[11px]">
                <CalendarDays className="w-3.5 h-3.5 text-indigo-500" />
                <span>Comparing with Friday (Weekend Lookback)</span>
              </span>
            )}

            {data.team_scope && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 text-[11px]">
                <Users className="w-3 h-3 text-slate-400" />
                <span>Scope: {data.team_scope.manager_name} &bull; {data.team_scope.member_count} members ({data.team_scope.checked_in_count} checked in)</span>
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-200 font-bold text-xs shadow-xs transition disabled:opacity-50"
            title="Refresh delta analysis"
          >
            <RotateCw className={`w-3.5 h-3.5 text-blue-600 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TOP QUICK SUMMARY WIDGET (REQUIREMENT 6)                                  */}
      {/* ========================================================================= */}
      {actionItems.length === 0 ? (
        <div className="p-4.5 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/70 text-emerald-900 dark:text-emerald-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                ✓ No manager action required
              </div>
              <p className="text-xs text-emerald-800 dark:text-emerald-300/90 mt-0.5">
                No blockers, risks, or missing check-ins require attention for this comparison window.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold px-3 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 shrink-0 self-start sm:self-auto">
            All clear
          </span>
        </div>
      ) : (
        <div className="p-4.5 rounded-2xl bg-slate-900 text-white shadow-md space-y-3 border border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200">
                Needs Your Attention
              </span>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
              {actionItems.length} Action{actionItems.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 border border-white/10 font-medium">
              <span className="font-bold text-rose-400">[{blockerActionsCount}]</span>
              <span>Blocker{blockerActionsCount === 1 ? '' : 's'}</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 border border-white/10 font-medium">
              <span className="font-bold text-amber-400">[{missingCheckinsCount}]</span>
              <span>Missing Check-in{missingCheckinsCount === 1 ? '' : 's'}</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 border border-white/10 font-medium">
              <span className="font-bold text-sky-400">[{riskActionsCount}]</span>
              <span>Risk{riskActionsCount === 1 ? '' : 's'}</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* INSUFFICIENT DATA NOTICE (IF APPLICABLE)                                  */}
      {/* ========================================================================= */}
      {insufficientData && insufficientData.is_insufficient && (
        <div className="p-4.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 shadow-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-xs">
            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Not enough data to confidently summarize this area</span>
          </div>
          {insufficientData.notes && insufficientData.notes.length > 0 && (
            <ul className="text-xs text-amber-800 dark:text-amber-300/90 list-disc list-inside space-y-1 pl-1">
              {insufficientData.notes.map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
            </ul>
          )}
          {insufficientData.missing_checkins && insufficientData.missing_checkins.length > 0 && (
            <div className="text-xs text-amber-800 dark:text-amber-300 pt-1">
              <span className="font-semibold">Missing standup updates from: </span>
              <span>{insufficientData.missing_checkins.join(', ')}</span>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 1: MANAGER ACTION CENTER (REQUIREMENTS 1, 2, 3, 4, 5, 7, 9)       */}
      {/* ========================================================================= */}
      <section className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>NEEDS YOUR ATTENTION</span>
                <span className="sr-only">Needs Manager Attention</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Prioritized manager actions backed by verified team updates
              </p>
            </div>
          </div>
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300">
            {actionItems.length} action item{actionItems.length === 1 ? '' : 's'}
          </span>
        </div>

        {actionItems.length === 0 ? (
          <div className="p-6 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 text-center space-y-1.5">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 mx-auto" />
            <div className="font-bold text-xs text-emerald-900 dark:text-emerald-200">
              ✓ Everything looks on track
            </div>
            <p className="text-xs text-emerald-700 dark:text-emerald-400/90">
              No blockers, risks, or missing check-ins require your attention.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {actionItems.map((item) => (
              <div
                key={item.id}
                className="p-4.5 rounded-2xl bg-slate-50 dark:bg-slate-850/60 border border-slate-200 dark:border-slate-800 space-y-3 text-xs flex flex-col justify-between transition hover:border-slate-300 dark:hover:border-slate-700"
              >
                {/* Header: Category + Severity */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md font-bold text-[10px] uppercase border ${getCategoryBadge(item.category)}`}>
                      {getCategoryIcon(item.category)}
                      <span>{formatCategoryLabel(item.category)}</span>
                    </span>

                    <span className={`px-2 py-0.5 rounded-md font-bold uppercase text-[10px] border ${getSeverityBadge(item.severity)}`}>
                      {item.severity}
                    </span>
                  </div>

                  {/* Concise Description */}
                  <div className="font-bold text-slate-900 dark:text-white text-xs leading-snug pt-0.5">
                    {item.description}
                  </div>

                  {item.ownerOrPerson && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Users className="w-3 h-3 text-slate-400" />
                      <span>Involves: <strong className="text-slate-700 dark:text-slate-300">{item.ownerOrPerson}</strong></span>
                    </div>
                  )}
                </div>

                {/* Recommended Action */}
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1">
                  <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                    Recommended action:
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    {item.suggestedAction}
                  </p>
                </div>

                {/* Footer: Evidence & Action Button */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/60 dark:border-slate-800">
                  <div>
                    {item.evidence && item.evidence.length > 0 ? (
                      <EvidenceCitationGroup citations={item.evidence} size="sm" />
                    ) : (
                      <span className="text-[10px] text-slate-400">Team update context</span>
                    )}
                  </div>

                  {item.entityRoute && item.actionButtonText && (
                    <button
                      type="button"
                      onClick={() => navigate(item.entityRoute!)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-100 font-bold text-[11px] transition shrink-0"
                    >
                      <span>{item.actionButtonText}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* SECTION 2: PROGRESS (COMPLETED WORK & MEANINGFUL PROGRESS)                */}
      {/* ========================================================================= */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Team Progress & Completed Work
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            {completedWork.length} completed &bull; {meaningfulProgress.length} progressed
          </span>
        </div>

        {/* 2A. COMPLETED WORK */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Completed Work</span>
            </h3>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              {completedWork.length} task{completedWork.length === 1 ? '' : 's'} done
            </span>
          </div>

          {completedWork.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              <span>No tasks completed in this window.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {completedWork.map((task) => (
                <div
                  key={task.task_id}
                  className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/50 space-y-2 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-bold text-slate-900 dark:text-white text-xs leading-snug">
                      {task.title}
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 shrink-0">
                      Done
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 dark:text-slate-300">
                    <span className="font-medium text-slate-900 dark:text-white">{task.owner}</span>
                    <span className="opacity-40">&bull;</span>
                    <span>{task.difficulty} pts</span>
                    {task.completed_at && (
                      <>
                        <span className="opacity-40">&bull;</span>
                        <span className="text-slate-400">{formatDateDisplay(task.completed_at)}</span>
                      </>
                    )}
                  </div>

                  {task.evidence && task.evidence.length > 0 && (
                    <div className="pt-1">
                      <EvidenceCitationGroup citations={task.evidence} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2B. MEANINGFUL PROGRESS DELTAS */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Kanban className="w-4 h-4 text-blue-500" />
              <span>Meaningful Progress</span>
            </h3>
            <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
              {meaningfulProgress.length} active updates
            </span>
          </div>

          {meaningfulProgress.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              <span>No intermediate task progress changes reported.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {meaningfulProgress.map((task) => {
                const prevPct = Math.max(0, task.current_progress_pct - task.progress_delta_pct);
                return (
                  <div
                    key={task.task_id}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850/60 border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-900 dark:text-white text-xs leading-snug">
                          {task.title}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {task.owner}
                        </div>
                      </div>

                      {/* Prominent Delta Badge */}
                      <div className="text-right shrink-0">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 font-extrabold text-xs shadow-xs">
                          +{task.progress_delta_pct}%
                        </span>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {prevPct}% &rarr; {task.current_progress_pct}%
                        </div>
                      </div>
                    </div>

                    {/* Progress Slider Track */}
                    <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-blue-600 dark:bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, task.current_progress_pct)}%` }}
                      />
                    </div>

                    {task.note && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 italic">
                        "{task.note}"
                      </p>
                    )}

                    {task.pr_link && (
                      <div className="pt-0.5">
                        <a
                          href={task.pr_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-medium hover:underline"
                        >
                          <span>Inspect Pull Request</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    {task.evidence && task.evidence.length > 0 && (
                      <div className="pt-1">
                        <EvidenceCitationGroup citations={task.evidence} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 2C. SPRINT PROGRESS */}
        {sprintProgress && (
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Sprint Progress &bull; {sprintProgress.sprint_name || 'Active Sprint'}
                </h3>
              </div>
              <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                +{sprintProgress.delta_points} points completed in window
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Completed: {sprintProgress.completed_points_today} / {sprintProgress.total_points || 40} pts</span>
                <span>
                  {Math.round(((sprintProgress.completed_points_today || 0) / (sprintProgress.total_points || 1)) * 100)}% Complete
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-indigo-600 dark:bg-indigo-500 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.round(((sprintProgress.completed_points_today || 0) / (sprintProgress.total_points || 1)) * 100))}%`
                  }}
                />
              </div>
            </div>

            {sprintProgress.evidence && sprintProgress.evidence.length > 0 && (
              <div className="pt-1">
                <EvidenceCitationGroup citations={sprintProgress.evidence} />
              </div>
            )}
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* SECTION 3: BLOCKERS (NEW vs EXISTING UNRESOLVED)                          */}
      {/* ========================================================================= */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Team Blockers
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            {newBlockers.length} new &bull; {existingBlockers.length} existing unresolved
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* 3A. NEW BLOCKERS */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <span>New Blockers</span>
              </h3>
              <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                Created in window
              </span>
            </div>

            {newBlockers.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1 opacity-80" />
                <span>No new blockers reported.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {newBlockers.map((b) => (
                  <div
                    key={b.blocker_id}
                    className="p-3.5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-rose-950 dark:text-rose-100 leading-snug">
                        {b.summary}
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0 border ${getSeverityBadge(b.severity)}`}>
                        {b.severity}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                      <span>Owner: <strong>{b.owner}</strong></span>
                      {b.blocked_by && b.blocked_by !== 'Unassigned' && (
                        <>
                          <span className="opacity-40">&bull;</span>
                          <span>Blocked by: <strong>{b.blocked_by}</strong></span>
                        </>
                      )}
                    </div>

                    {b.evidence && b.evidence.length > 0 && (
                      <div className="pt-1">
                        <EvidenceCitationGroup citations={b.evidence} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3B. EXISTING UNRESOLVED BLOCKERS */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span>Existing Unresolved Blockers</span>
              </h3>
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                Pre-dated window
              </span>
            </div>

            {existingBlockers.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1 opacity-80" />
                <span>No existing unresolved blockers.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {existingBlockers.map((b) => (
                  <div
                    key={b.blocker_id}
                    className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-slate-900 dark:text-white leading-snug">
                        {b.summary}
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200 shrink-0">
                        Age: {b.age_days}d
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                      <span>Owner: <strong>{b.owner}</strong></span>
                      {b.blocked_by && b.blocked_by !== 'Unassigned' && (
                        <>
                          <span className="opacity-40">&bull;</span>
                          <span>Blocked by: <strong>{b.blocked_by}</strong></span>
                        </>
                      )}
                    </div>

                    {b.evidence && b.evidence.length > 0 && (
                      <div className="pt-1">
                        <EvidenceCitationGroup citations={b.evidence} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 4: RISKS                                                          */}
      {/* ========================================================================= */}
      <section className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Delivery & Sprint Risks
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            {risks.length} flagged
          </span>
        </div>

        {risks.length === 0 ? (
          <div className="py-4 text-center text-xs text-slate-400">
            <span>No significant risks detected.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {risks.map((risk) => (
              <div
                key={risk.risk_id}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850/70 border border-slate-200 dark:border-slate-800 space-y-2 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold text-slate-900 dark:text-white text-xs leading-snug">
                    {risk.summary}
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border shrink-0 ${getSeverityBadge(risk.severity)}`}>
                    {risk.severity}
                  </span>
                </div>

                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  {risk.rationale}
                </p>

                {risk.evidence && risk.evidence.length > 0 && (
                  <div className="pt-1">
                    <EvidenceCitationGroup citations={risk.evidence} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* EMPTY STATE (ZERO OVERALL ACTIVITY IN WINDOW)                             */}
      {/* ========================================================================= */}
      {totalDeltaEvents === 0 && (
        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            No meaningful changes were detected for this comparison window
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            All team metrics, sprint velocity, and task progress remained steady between {formatDateDisplay(data.previous_working_day)} and {formatDateDisplay(data.target_date)}.
          </p>
        </div>
      )}
    </div>
  );
};
