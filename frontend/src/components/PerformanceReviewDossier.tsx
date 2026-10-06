import React, { useState, useEffect } from 'react';
import {
  X,
  Target,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Kanban,
  MessageSquare,
  ShieldCheck,
  Calendar,
  Lock,
  Save,
  Check,
  FileText,
  User as UserIcon,
  Layers,
  Sparkles
} from 'lucide-react';
import { PerformanceReviewDossier as DossierType } from '../types';
import { fetchPerformanceReviewDossier, updatePerformanceReviewNotes } from '../api';
import { EvidenceCitationBadge } from './EvidenceCitationBadge';

interface PerformanceReviewDossierProps {
  userId: number;
  cycleId?: number;
  isOpen: boolean;
  onClose: () => void;
}

export const PerformanceReviewDossier: React.FC<PerformanceReviewDossierProps> = ({
  userId,
  cycleId,
  isOpen,
  onClose
}) => {
  const [dossier, setDossier] = useState<DossierType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Private Manager Notes form state
  const [prepNotes, setPrepNotes] = useState('');
  const [agenda, setAgenda] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);
    setErrorMsg(null);

    fetchPerformanceReviewDossier(userId, cycleId)
      .then((data) => {
        if (!isMounted) return;
        setDossier(data);
        if (data.manager_notes) {
          setPrepNotes(data.manager_notes.preparation_notes || '');
          setAgenda(data.manager_notes.discussion_agenda || '');
        } else {
          setPrepNotes('');
          setAgenda('');
        }
      })
      .catch((err: any) => {
        if (!isMounted) return;
        setErrorMsg(err.message || 'Failed to load performance review dossier');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [userId, cycleId, isOpen]);

  const handleSaveNotes = async () => {
    if (!dossier) return;
    setIsSavingNotes(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const updated = await updatePerformanceReviewNotes(userId, {
        cycle_id: dossier.cycle.cycle_id,
        preparation_notes: prepNotes,
        discussion_agenda: agenda
      });
      setDossier((prev) => (prev ? { ...prev, manager_notes: updated } : null));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save review notes');
    } finally {
      setIsSavingNotes(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      data-testid="performance-review-dossier-modal"
    >
      <div 
        className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dossier-title"
      >
        {/* MODAL HEADER */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/40 shrink-0">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                <FileText className="w-5 h-5" />
              </span>
              <div>
                <h2 id="dossier-title" className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Performance Review Dossier</span>
                  {dossier?.cycle && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold">
                      {dossier.cycle.name}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Factual, evidence-grounded evaluation briefing. Human manager remains the sole decision maker.
                </p>
              </div>
            </div>

            {dossier?.employee && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-xs text-slate-600 dark:text-slate-300">
                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                  <UserIcon className="w-3.5 h-3.5 text-blue-500" />
                  {dossier.employee.full_name}
                </span>
                <span className="opacity-40">•</span>
                <span>Role: <strong>{dossier.employee.role}</strong> (L{dossier.employee.role_level})</span>
                {dossier.employee.manager_name && (
                  <>
                    <span className="opacity-40">•</span>
                    <span>Manager: <strong>{dossier.employee.manager_name}</strong></span>
                  </>
                )}
                {dossier.employee.email && (
                  <>
                    <span className="opacity-40">•</span>
                    <span className="font-mono text-slate-400">{dossier.employee.email}</span>
                  </>
                )}
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Close dossier"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 divide-y divide-slate-100 dark:divide-slate-800/80">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3" data-testid="dossier-loading">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-xs text-slate-500 font-medium">Consolidating verified review records...</p>
            </div>
          ) : errorMsg ? (
            <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 space-y-1.5" data-testid="dossier-error">
              <div className="font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Unable to load Review Dossier</span>
              </div>
              <p className="text-xs leading-relaxed">{errorMsg}</p>
            </div>
          ) : dossier ? (
            <>
              {/* 1. PERFORMANCE SNAPSHOT (Dimensions kept separate, no fake score) */}
              <div className="space-y-3 pt-1" data-testid="performance-snapshot-section">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Cycle Performance Snapshot & Dimensions
                  </h3>
                  {dossier.comparison.trend && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-slate-400">Trajectory:</span>
                      <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full ${
                        dossier.comparison.trend.direction === 'improving'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : dossier.comparison.trend.direction === 'declining'
                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}>
                        {dossier.comparison.trend.direction === 'improving' && <TrendingUp className="w-3 h-3" />}
                        {dossier.comparison.trend.direction === 'declining' && <TrendingDown className="w-3 h-3" />}
                        {dossier.comparison.trend.direction === 'stable' && <Minus className="w-3 h-3" />}
                        <span className="capitalize">{dossier.comparison.trend.direction.replace('_', ' ')}</span>
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {/* Current Cycle Goals */}
                  <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="text-[11px] text-slate-400 font-medium">Performance Goals</span>
                    <div className="text-xl font-bold text-slate-900 dark:text-white">
                      {dossier.comparison.current_cycle.completion_rate_pct.toFixed(0)}%
                    </div>
                    <span className="text-[10px] text-blue-600 block">
                      {dossier.comparison.current_cycle.completed_goals_count} / {dossier.comparison.current_cycle.total_goals_count} completed
                    </span>
                  </div>

                  {/* Cycle Earned Points */}
                  <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="text-[11px] text-slate-400 font-medium">Cycle Earned Points</span>
                    <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      {dossier.comparison.current_cycle.earned_points.toFixed(1)}
                    </div>
                    <span className="text-[10px] text-slate-400 block">
                      Assigned: {dossier.comparison.current_cycle.assigned_points.toFixed(1)} pts
                    </span>
                  </div>

                  {/* Task Delivery */}
                  <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="text-[11px] text-slate-400 font-medium">Task On-Time Rate</span>
                    <div className="text-xl font-bold text-slate-900 dark:text-white">
                      {dossier.operational_delivery.on_time_delivery_rate_pct.toFixed(0)}%
                    </div>
                    <span className="text-[10px] text-slate-400 block">
                      {dossier.operational_delivery.completed_tasks} tasks delivered
                    </span>
                  </div>

                  {/* Check-in Consistency */}
                  <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="text-[11px] text-slate-400 font-medium">Check-In Consistency</span>
                    <div className="text-xl font-bold text-slate-900 dark:text-white">
                      {dossier.operational_delivery.checkin_consistency_pct.toFixed(0)}%
                    </div>
                    <span className="text-[10px] text-orange-600 block">
                      Streak: {dossier.operational_delivery.checkin_streak} days
                    </span>
                  </div>

                  {/* Story Points */}
                  <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="text-[11px] text-slate-400 font-medium">Story Points Delivered</span>
                    <div className="text-xl font-bold text-sky-600 dark:text-sky-400 font-mono">
                      {dossier.operational_delivery.story_points_total.toFixed(1)}
                    </div>
                    <span className="text-[10px] text-slate-400 block">
                      Active Blockers: {dossier.operational_delivery.active_blockers}
                    </span>
                  </div>
                </div>

                {/* Cycle Comparison & YTD Metrics */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-4">
                    {dossier.comparison.previous_cycle && (
                      <div>
                        <span className="text-slate-400">Prior Cycle ({dossier.comparison.previous_cycle.cycle_name}):</span>{' '}
                        <strong className="text-slate-800 dark:text-slate-200 font-mono">
                          {dossier.comparison.previous_cycle.completion_rate_pct.toFixed(0)}%
                        </strong>
                      </div>
                    )}
                    {dossier.comparison.cycle_over_cycle_delta_pct !== null && dossier.comparison.cycle_over_cycle_delta_pct !== undefined && (
                      <div>
                        <span className="text-slate-400">Cycle Delta:</span>{' '}
                        <strong className={`font-mono ${
                          dossier.comparison.cycle_over_cycle_delta_pct > 0
                            ? 'text-emerald-600'
                            : dossier.comparison.cycle_over_cycle_delta_pct < 0
                            ? 'text-amber-600'
                            : 'text-slate-500'
                        }`}>
                          {dossier.comparison.cycle_over_cycle_delta_pct > 0 ? '+' : ''}
                          {dossier.comparison.cycle_over_cycle_delta_pct}%
                        </strong>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-400">Year-to-Date (YTD):</span>{' '}
                      <strong className="text-slate-800 dark:text-slate-200 font-mono">
                        {dossier.comparison.year_to_date_earned_points.toFixed(1)} / {dossier.comparison.year_to_date_assigned_points.toFixed(1)} pts ({dossier.comparison.year_to_date_completion_pct.toFixed(0)}%)
                      </strong>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 italic">
                    {dossier.comparison.trend?.summary}
                  </span>
                </div>
              </div>

              {/* 2. GOALS (Preserves no-double-counting logic) */}
              <div className="space-y-3 pt-5" data-testid="goals-section">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Performance Goals & Achievement Breakdown
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    No duplicate points on carry-overs
                  </span>
                </div>

                {dossier.goals.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No goals assigned for this cycle.</p>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3.5">Goal Title</th>
                          <th className="py-2.5 px-3 text-right">Assigned</th>
                          <th className="py-2.5 px-3 text-right">Prior Locked</th>
                          <th className="py-2.5 px-3 text-right">Cycle Earned</th>
                          <th className="py-2.5 px-3 text-right">Remaining</th>
                          <th className="py-2.5 px-3 text-center">Progress</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {dossier.goals.map((g) => (
                          <tr key={g.goal_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                            <td className="py-2.5 px-3.5">
                              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <span>{g.title}</span>
                                {g.carried_forward && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                                    <RotateCw className="w-2.5 h-2.5" />
                                    Carried
                                  </span>
                                )}
                              </div>
                              {g.source_task_title && (
                                <div className="text-[10px] text-slate-400">Task: {g.source_task_title}</div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">
                              {g.assigned_points.toFixed(1)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                              {g.previously_earned_points.toFixed(1)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {g.cycle_earned_points.toFixed(1)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-sky-600 dark:text-sky-400">
                              {g.remaining_points.toFixed(1)}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold">
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px]">
                                {g.progress.toFixed(0)}%
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                                g.status === 'completed'
                                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                  : g.status === 'carried_forward'
                                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                                  : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                              }`}>
                                {g.status.replace('_', ' ')}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 3. WORK DELIVERY & OPERATIONAL METRICS */}
              <div className="space-y-3 pt-5" data-testid="work-delivery-section">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Operational Work Delivery Metrics
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-400 block">Tasks Completed On-Time</span>
                    <strong className="text-slate-900 dark:text-white text-base">
                      {dossier.operational_delivery.tasks_on_time} / {dossier.operational_delivery.completed_tasks}
                    </strong>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Carried Over: {dossier.operational_delivery.tasks_carried_over}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-400 block">Check-in Consistency</span>
                    <strong className="text-slate-900 dark:text-white text-base">
                      {dossier.operational_delivery.checkin_consistency_pct.toFixed(0)}%
                    </strong>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Streak: {dossier.operational_delivery.checkin_streak} submissions
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-400 block">Blockers Raised / Resolved</span>
                    <strong className="text-slate-900 dark:text-white text-base">
                      {dossier.operational_delivery.blockers_raised} / {dossier.operational_delivery.blockers_resolved}
                    </strong>
                    <span className="text-[10px] text-rose-500 block mt-0.5">
                      Active: {dossier.operational_delivery.active_blockers}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-400 block">Story Points by Sprint</span>
                    <strong className="text-slate-900 dark:text-white text-base font-mono">
                      {dossier.operational_delivery.story_points_total.toFixed(1)} pts
                    </strong>
                    <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                      {dossier.operational_delivery.points_per_sprint.length} sprints recorded
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. VERIFIED EVIDENCE (Badges reusing EvidenceCitationBadge) */}
              <div className="space-y-3 pt-5" data-testid="verified-evidence-section">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Verified Audit Evidence ({dossier.verified_evidence.length})</span>
                  </h3>
                  <span className="text-[11px] text-slate-400">Click badges to inspect verbatim records</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {dossier.verified_evidence.map((ev, idx) => (
                    <EvidenceCitationBadge
                      key={`${ev.source_type}-${ev.source_id}-${idx}`}
                      citation={ev}
                      size="sm"
                    />
                  ))}
                </div>
              </div>

              {/* 5. FACTUAL DISCUSSION TOPICS */}
              <div className="space-y-3 pt-5" data-testid="discussion-topics-section">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                  <span>Factual Discussion Topics & Review Focus</span>
                </h3>

                <div className="space-y-2.5">
                  {dossier.review_intelligence.discussion_topics.map((topic, idx) => (
                    <div 
                      key={idx}
                      className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">
                          {topic.topic}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold capitalize bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 shrink-0">
                          {topic.category.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {topic.summary}
                      </p>
                      {topic.evidence.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {topic.evidence.map((ev, evIdx) => (
                            <EvidenceCitationBadge
                              key={`dt-${ev.source_type}-${ev.source_id}-${evIdx}`}
                              citation={ev}
                              size="sm"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 6. PRIVATE MANAGER NOTES (Hidden from employee, visible to authorized manager/director) */}
              {dossier.is_manager_or_director && (
                <div className="space-y-4 pt-5" data-testid="private-manager-notes-section">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400">
                        <Lock className="w-3.5 h-3.5" />
                      </span>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                          Private Manager Review Preparation Notes
                        </h3>
                        <span className="text-[10px] text-slate-400">
                          Visible strictly to evaluating manager and leadership hierarchy. Never visible to employee.
                        </span>
                      </div>
                    </div>

                    {dossier.manager_notes?.updated_at && (
                      <span className="text-[10px] text-slate-400">
                        Last saved: {new Date(dossier.manager_notes.updated_at).toLocaleString()}
                      </span>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Evaluation Preparation Notes
                      </label>
                      <textarea
                        value={prepNotes}
                        onChange={(e) => setPrepNotes(e.target.value)}
                        placeholder="Draft private observations, milestones delivered, or development themes for this employee..."
                        rows={3}
                        className="w-full text-xs p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Discussion Agenda & Next Steps
                      </label>
                      <textarea
                        value={agenda}
                        onChange={(e) => setAgenda(e.target.value)}
                        placeholder="Outline key discussion questions and goals alignment agenda for the review meeting..."
                        rows={2}
                        className="w-full text-xs p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div>
                        {saveSuccess && (
                          <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            <span>Notes successfully saved</span>
                          </span>
                        )}
                        {saveError && (
                          <span className="text-xs text-rose-600 font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>{saveError}</span>
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={handleSaveNotes}
                        disabled={isSavingNotes}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{isSavingNotes ? 'Saving...' : 'Save Review Notes'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
          <span>{dossier?.evidence_note || 'Verified SyncBrief review dossier.'}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
