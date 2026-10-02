import React, { useState, useEffect } from 'react';
import { 
  Award, 
  TrendingUp, 
  CheckCircle2, 
  RotateCw, 
  Flame, 
  HelpCircle, 
  Calculator, 
  BarChart2, 
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  AlertTriangle,
  Target,
  Plus,
  RefreshCw,
  Sliders,
  Check,
  Clock,
  Sparkles,
  ChevronRight,
  Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  fetchMyPoints, 
  fetchPerformanceCycles, 
  fetchMyPerformanceSummary, 
  updateGoalProgress, 
  createPerformanceGoal,
  fetchHierarchy
} from '../api';
import { 
  PointsSummary, 
  PerformanceCycle, 
  PerformanceSummaryEmployee, 
  PerformanceGoal,
  HierarchyNode
} from '../types';

export const MyPointsPage: React.FC = () => {
  const { user } = useAuth();

  // Active Tab: 'story' (Sprint Delivery Velocity) vs 'performance' (Quarterly OKRs & Goals)
  const [activeTab, setActiveTab] = useState<'story' | 'performance'>('performance');

  // --- Story Points State ---
  const [pointsData, setPointsData] = useState<PointsSummary | null>(null);
  const [isLoadingStory, setIsLoadingStory] = useState(true);
  const [calculatorDifficulty, setCalculatorDifficulty] = useState<number>(5);
  const [calculatorCarryOvers, setCalculatorCarryOvers] = useState<number>(1);

  // --- Performance Points State ---
  const [cycles, setCycles] = useState<PerformanceCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<number | undefined>(undefined);
  const [perfSummary, setPerfSummary] = useState<PerformanceSummaryEmployee | null>(null);
  const [isLoadingPerf, setIsLoadingPerf] = useState(true);
  const [perfError, setPerfError] = useState<string | null>(null);
  const [isUpdatingGoal, setIsUpdatingGoal] = useState<number | null>(null);
  const [progressSliders, setProgressSliders] = useState<Record<number, number>>({});
  const [progressNotes, setProgressNotes] = useState<Record<number, string>>({});
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // --- Goal Creation Modal (for Managers / Directors) ---
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [subordinates, setSubordinates] = useState<{ id: number; name: string }[]>([]);
  const [newGoalAssigneeId, setNewGoalAssigneeId] = useState<number>(user?.id || 0);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalDesc, setNewGoalDesc] = useState('');
  const [newGoalCategory, setNewGoalCategory] = useState<'delivery' | 'technical_excellence' | 'mentorship' | 'strategic'>('delivery');
  const [newGoalPoints, setNewGoalPoints] = useState<number>(5);
  const [isSubmittingGoal, setIsSubmittingGoal] = useState(false);
  const [createGoalError, setCreateGoalError] = useState<string | null>(null);

  // Load Story Points Data
  useEffect(() => {
    fetchMyPoints()
      .then(setPointsData)
      .catch((err) => console.error("Failed to load story points:", err))
      .finally(() => setIsLoadingStory(false));
  }, [user?.id]);

  // Load Performance Cycles
  useEffect(() => {
    fetchPerformanceCycles()
      .then((data) => {
        setCycles(data);
        const active = data.find(c => c.is_active);
        if (active) {
          setSelectedCycleId(active.id);
        } else if (data.length > 0) {
          setSelectedCycleId(data[0].id);
        }
      })
      .catch((err) => console.error("Failed to load performance cycles:", err));
  }, [user?.id]);

  // Load Performance Summary when cycle changes
  useEffect(() => {
    if (selectedCycleId !== undefined) {
      loadPerformanceSummary(selectedCycleId);
    }
  }, [selectedCycleId, user?.id]);

  // Load subordinates for Manager/Director goal assignment
  useEffect(() => {
    if (user?.role === 'manager' || user?.role === 'director' || (user?.role_level && user.role_level <= 2)) {
      fetchHierarchy()
        .then((treeList) => {
          const subs: { id: number; name: string }[] = [];
          const extractSubs = (node: HierarchyNode) => {
            if (node.id === user.id) {
              node.children?.forEach(c => {
                subs.push({ id: c.id, name: c.name });
                c.children?.forEach(gc => subs.push({ id: gc.id, name: gc.name }));
              });
            } else {
              node.children?.forEach(extractSubs);
            }
          };
          treeList.forEach(extractSubs);
          setSubordinates(subs);
          if (subs.length > 0) {
            setNewGoalAssigneeId(subs[0].id);
          }
        })
        .catch((err) => console.error("Failed to load subordinates:", err));
    }
  }, [user?.id, user?.role, user?.role_level]);

  const loadPerformanceSummary = async (cycleId?: number) => {
    setIsLoadingPerf(true);
    setPerfError(null);
    try {
      const summary = await fetchMyPerformanceSummary(cycleId);
      setPerfSummary(summary);
      // Initialize progress slider values
      const initialSliders: Record<number, number> = {};
      const initialNotes: Record<number, string> = {};
      (summary?.goals || []).forEach(g => {
        const prog = g.current_progress_percentage ?? (g as any).current_progress_pct ?? 0;
        initialSliders[g.id] = prog;
        initialNotes[g.id] = g.progress_note || '';
      });
      setProgressSliders(initialSliders);
      setProgressNotes(initialNotes);
    } catch (err: any) {
      console.error("Failed to load performance summary:", err);
      setPerfError(err?.message || "Failed to load performance summary");
    } finally {
      setIsLoadingPerf(false);
    }
  };

  const handleUpdateProgress = async (goalId: number, syncTask = false) => {
    setIsUpdatingGoal(goalId);
    setActionSuccessMsg(null);
    try {
      const progressVal = progressSliders[goalId] ?? 0;
      const noteVal = progressNotes[goalId] ?? '';
      await updateGoalProgress(goalId, {
        current_progress_pct: progressVal,
        progress_note: noteVal,
        sync_task: syncTask
      });
      setActionSuccessMsg(`Goal progress updated successfully!`);
      setTimeout(() => setActionSuccessMsg(null), 4000);
      await loadPerformanceSummary(selectedCycleId);
    } catch (err: any) {
      alert(err.message || 'Failed to update goal progress');
    } finally {
      setIsUpdatingGoal(null);
    }
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCycleId) return;
    setIsSubmittingGoal(true);
    setCreateGoalError(null);
    try {
      await createPerformanceGoal({
        cycle_id: selectedCycleId,
        employee_id: newGoalAssigneeId,
        title: newGoalTitle,
        description: newGoalDesc,
        category: newGoalCategory,
        assigned_points: newGoalPoints,
        target_pct: 100
      });
      setShowCreateModal(false);
      setNewGoalTitle('');
      setNewGoalDesc('');
      setNewGoalPoints(5);
      setActionSuccessMsg('New performance goal assigned successfully!');
      setTimeout(() => setActionSuccessMsg(null), 4000);
      await loadPerformanceSummary(selectedCycleId);
    } catch (err: any) {
      setCreateGoalError(err.message || 'Failed to assign goal');
    } finally {
      setIsSubmittingGoal(false);
    }
  };

  // Story formula interactive simulation
  const simulatedEarned = Math.max(0, calculatorDifficulty * (1 - 0.25 * calculatorCarryOvers));

  const isManagerOrDirector = user?.role === 'manager' || user?.role === 'director' || (user?.role_level && user.role_level <= 2);

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <span>Points & Goals Management</span>
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700">
              {user?.full_name} ({user?.title || user?.role})
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Two distinct systems: <strong className="text-slate-700 dark:text-slate-300">Task Story Points</strong> (sprint velocity with rollover deductions) & <strong className="text-slate-700 dark:text-slate-300">Performance Points</strong> (quarterly milestone achievements with carry-forward preservation).
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('performance')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'performance'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/50 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Target className="w-4 h-4" />
            <span>Performance Points</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
              OKRs
            </span>
          </button>

          <button
            onClick={() => setActiveTab('story')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'story'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/50 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Task Story Points</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              Sprints
            </span>
          </button>
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: PERFORMANCE POINTS & GOALS (QUARTERLY ACHIEVEMENTS)                */}
      {/* ========================================================================= */}
      {activeTab === 'performance' && (
        <div className="space-y-6">
          {/* Controls Bar: Cycle Selector & Manager Goal Assignment */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>Performance Cycle:</span>
              </span>
              <select
                value={selectedCycleId ?? ''}
                onChange={(e) => setSelectedCycleId(Number(e.target.value))}
                className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                {cycles.length === 0 && (
                  <option value="">No cycles available</option>
                )}
                {cycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.is_active || c.status === 'active' ? '• Active Cycle' : '• Closed'}
                  </option>
                ))}
              </select>

              {(perfSummary?.cycle_is_active || (cycles.find(c => c.id === selectedCycleId)?.status === 'active')) ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  Active Review Period
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  Closed Period (Read-Only)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => loadPerformanceSummary(selectedCycleId)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition"
                title="Refresh Goals"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>

              {isManagerOrDirector && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Assign Subordinate Goal</span>
                </button>
              )}
            </div>
          </div>

          {isLoadingPerf ? (
            <div className="flex items-center justify-center min-h-[300px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : perfError ? (
            <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Unable to load performance goals
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  {perfError}
                </p>
              </div>
              <button
                onClick={() => loadPerformanceSummary(selectedCycleId)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition"
              >
                Retry Loading
              </button>
            </div>
          ) : perfSummary ? (
            (() => {
              const totalAssigned = perfSummary.total_assigned_points ?? 0;
              const totalEarned = perfSummary.total_earned_points ?? perfSummary.total_cycle_earned_points ?? 0;
              const totalRemaining = perfSummary.total_remaining_points ?? 0;
              const totalGoals = perfSummary.total_goals_count ?? perfSummary.goals_count ?? (perfSummary.goals?.length || 0);
              const completedGoals = perfSummary.completed_goals_count ?? 0;
              const inProgressGoals = perfSummary.in_progress_goals_count ?? Math.max(0, totalGoals - completedGoals);
              const carriedGoals = perfSummary.carried_forward_goals_count ?? 0;
              const cycleName = perfSummary.cycle_name || 'Quarterly Cycle';
              const selectedCycle = cycles.find(c => c.id === selectedCycleId);
              const isCycleActive = perfSummary.cycle_is_active ?? (selectedCycle ? (selectedCycle.is_active || selectedCycle.status === 'active') : true);
              const goalsList = perfSummary.goals || [];

              return (
                <>
                  {/* KPI Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Total Assigned */}
                    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                        <span>Assigned Points</span>
                        <Target className="w-4 h-4 text-blue-500" />
                      </div>
                      <div className="text-2xl font-black text-slate-900 dark:text-white">
                        {totalAssigned.toFixed(1)} <span className="text-xs font-normal text-slate-400">pts</span>
                      </div>
                      <div className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
                        Across {totalGoals} assigned quarterly goals
                      </div>
                    </div>

                    {/* Earned Points */}
                    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                        <span>Earned in {cycleName}</span>
                        <Award className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                        {totalEarned.toFixed(1)} <span className="text-xs font-normal text-slate-400">pts</span>
                      </div>
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        {totalAssigned > 0 
                          ? `${((totalEarned / totalAssigned) * 100).toFixed(0)}% achievement rate`
                          : '0% achievement rate'}
                      </div>
                    </div>

                    {/* Remaining Points */}
                    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                        <span>Available to Earn</span>
                        <Clock className="w-4 h-4 text-sky-500" />
                      </div>
                      <div className="text-2xl font-black text-sky-600 dark:text-sky-400">
                        {totalRemaining.toFixed(1)} <span className="text-xs font-normal text-slate-400">pts</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        Zero penalty for in-progress work
                      </div>
                    </div>

                    {/* Goals Status */}
                    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                        <span>Goal Completion</span>
                        <CheckCircle2 className="w-4 h-4 text-indigo-500" />
                      </div>
                      <div className="text-2xl font-black text-slate-900 dark:text-white">
                        {completedGoals} / {totalGoals}
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                        <span>{inProgressGoals} active</span>
                        {carriedGoals > 0 && (
                          <span className="text-amber-600 font-semibold">
                            • {carriedGoals} carried
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Carry-Forward Invariant & Human Evaluation Notice Banner */}
                  <div className="p-5 rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 text-white shadow-lg space-y-3 border border-indigo-800/40">
                    <div className="flex items-start gap-3">
                      <Sparkles className="w-5 h-5 text-indigo-300 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <span>Performance Points Carry-Forward Architecture</span>
                          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                            Zero Duplication
                          </span>
                        </h3>
                        <p className="text-xs text-indigo-200/90 leading-relaxed">
                          Incomplete goals carried forward into a new cycle preserve their prior achievement. Points already earned in earlier cycles are locked; in the new cycle, you can <strong>only earn the remaining points</strong> up to the original target.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs border-t border-indigo-800/60">
                      <div className="p-2.5 rounded-xl bg-indigo-950/60 border border-indigo-800/50 space-y-0.5">
                        <span className="text-[11px] font-bold text-indigo-300">Continuous Math Formula</span>
                        <p className="text-[11px] text-slate-300 font-mono">
                          Cycle Earned = max(0, Assigned × Progress% - Prior Earned)
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-indigo-950/60 border border-indigo-800/50 space-y-0.5">
                        <span className="text-[11px] font-bold text-indigo-300">No Penalty Deductions</span>
                        <p className="text-[11px] text-slate-300">
                          Unlike sprint story points, performance points do not decay with rollovers.
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-indigo-950/60 border border-indigo-800/50 space-y-0.5">
                        <span className="text-[11px] font-bold text-indigo-300">Human Evaluation Evidence</span>
                        <p className="text-[11px] text-slate-300">
                          Objective evidence for human manager review during quarterly appraisal.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Goals Cards List */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-blue-600" />
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          Assigned Performance Goals ({goalsList.length})
                        </h3>
                      </div>
                      <span className="text-xs text-slate-400">
                        Cycle: {cycleName}
                      </span>
                    </div>

                    {goalsList.length === 0 ? (
                      <div className="p-10 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
                        <Target className="w-10 h-10 text-slate-400 mx-auto" />
                        <div className="text-sm font-bold text-slate-700 dark:text-slate-300">No performance goals assigned in {cycleName}</div>
                        <p className="text-xs text-slate-400 max-w-md mx-auto">
                          Goals for this quarterly cycle are assigned by your reporting manager.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4">
                        {goalsList.map((g) => {
                          const categoryRaw = g.category || 'delivery';
                          const categoryStr = categoryRaw.toLowerCase();
                          const currentProgress = g.current_progress_percentage ?? (g as any).current_progress_pct ?? 0;
                          const targetPct = g.target_percentage ?? (g as any).target_pct ?? 100;
                          const taskId = g.source_task_id ?? (g as any).task_id;
                          const assignedPts = g.assigned_points ?? 0;
                          const previouslyEarnedPts = g.previously_earned_points ?? 0;

                          const sliderVal = progressSliders[g.id] ?? currentProgress;
                          const noteVal = progressNotes[g.id] ?? '';
                          const isDirty = sliderVal !== currentProgress || noteVal !== (g.progress_note || '');

                          // Projected cycle points based on local slider
                          const projectedLifetime = Math.round(assignedPts * (Math.min(100, sliderVal) / 100) * 100) / 100;
                          const projectedCycleEarned = Math.max(0, Math.round((projectedLifetime - previouslyEarnedPts) * 100) / 100);
                          const projectedRemaining = Math.max(0, Math.round((assignedPts - previouslyEarnedPts - projectedCycleEarned) * 100) / 100);

                          const isCarried = Boolean(g.carried_from_goal_id || g.status === 'carried_forward');

                          return (
                            <div 
                              key={g.id} 
                              className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition space-y-4"
                            >
                              {/* Card Top: Category, Title, Manager, Points Badges */}
                              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                <div className="space-y-1.5">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                      categoryStr === 'delivery'
                                        ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900'
                                        : categoryStr === 'technical_excellence'
                                        ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900'
                                        : categoryStr === 'mentorship'
                                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900'
                                        : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
                                    }`}>
                                      {categoryRaw.replace(/_/g, ' ')}
                                    </span>

                                    {isCarried && (
                                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                                        <RotateCw className="w-3 h-3" />
                                        <span>Carried Over Goal</span>
                                      </span>
                                    )}

                                    {taskId && (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                        Task #{taskId}
                                      </span>
                                    )}
                                  </div>

                                  <h4 className="text-base font-bold text-slate-900 dark:text-white">
                                    {g.title}
                                  </h4>

                                  {g.description && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
                                      {g.description}
                                    </p>
                                  )}

                                  <div className="text-[11px] text-slate-400">
                                    Assigned by <span className="font-semibold text-slate-600 dark:text-slate-300">{g.manager_name || 'Manager'}</span>
                                  </div>
                                </div>

                                {/* Points Summary Box */}
                                <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 shrink-0">
                                  <div className="text-center px-2">
                                    <div className="text-[10px] uppercase font-bold text-slate-400">Assigned</div>
                                    <div className="text-lg font-black text-slate-900 dark:text-white font-mono">
                                      {assignedPts.toFixed(1)}
                                    </div>
                                  </div>

                                  {isCarried && (
                                    <div className="text-center px-2 border-l border-slate-200 dark:border-slate-700">
                                      <div className="text-[10px] uppercase font-bold text-amber-500">Prior Earned</div>
                                      <div className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono">
                                        {previouslyEarnedPts.toFixed(1)}
                                      </div>
                                    </div>
                                  )}

                                  <div className="text-center px-2 border-l border-slate-200 dark:border-slate-700">
                                    <div className="text-[10px] uppercase font-bold text-emerald-500">Cycle Earned</div>
                                    <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                      {projectedCycleEarned.toFixed(1)}
                                    </div>
                                  </div>

                                  <div className="text-center px-2 border-l border-slate-200 dark:border-slate-700">
                                    <div className="text-[10px] uppercase font-bold text-sky-500">Remaining</div>
                                    <div className="text-lg font-black text-sky-600 dark:text-sky-400 font-mono">
                                      {projectedRemaining.toFixed(1)}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Progress Bar & Slider */}
                              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                <div className="flex justify-between items-center text-xs">
                                  <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                    <span>Reported Progress</span>
                                    <span className="font-mono text-blue-600 dark:text-blue-400 font-black text-sm">
                                      {sliderVal}%
                                    </span>
                                  </span>
                                  <span className="text-[11px] text-slate-400">
                                    Target: {targetPct}%
                                  </span>
                                </div>

                                {/* Dual Progress Display Bar */}
                                <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                                  {/* Prior earned portion */}
                                  {isCarried && assignedPts > 0 && (
                                    <div 
                                      className="h-full bg-amber-500" 
                                      style={{ width: `${(previouslyEarnedPts / assignedPts) * 100}%` }}
                                      title={`Prior Earned: ${previouslyEarnedPts} pts`}
                                    />
                                  )}
                                  {/* Newly earned portion in cycle */}
                                  <div 
                                    className="h-full bg-emerald-500 transition-all duration-300" 
                                    style={{ width: `${assignedPts > 0 ? (projectedCycleEarned / assignedPts) * 100 : 0}%` }}
                                    title={`Earned in this cycle: ${projectedCycleEarned} pts`}
                                  />
                                </div>

                                {/* Employee Interactive Progress Controls (when cycle is active) */}
                                {isCycleActive && (
                                  <div className="pt-2 space-y-3">
                                    <div className="flex items-center gap-4">
                                      <input 
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="5"
                                        value={sliderVal}
                                        onChange={(e) => {
                                          const val = Number(e.target.value);
                                          setProgressSliders(prev => ({ ...prev, [g.id]: val }));
                                        }}
                                        className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                      />
                                    </div>

                                    <div className="flex flex-col sm:flex-row items-center gap-2">
                                      <input
                                        type="text"
                                        placeholder="Add milestone note or deliverable link..."
                                        value={noteVal}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setProgressNotes(prev => ({ ...prev, [g.id]: val }));
                                        }}
                                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 outline-hidden focus:ring-2 focus:ring-blue-500"
                                      />

                                      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                                        {taskId && (
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateProgress(g.id, true)}
                                            disabled={isUpdatingGoal === g.id}
                                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition flex items-center gap-1"
                                            title="Auto-sync progress with linked Task status"
                                          >
                                            <RefreshCw className="w-3 h-3" />
                                            <span>Sync Task</span>
                                          </button>
                                        )}

                                        <button
                                          type="button"
                                          onClick={() => handleUpdateProgress(g.id, false)}
                                          disabled={isUpdatingGoal === g.id || !isDirty}
                                          className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                                            isDirty
                                              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                                          }`}
                                        >
                                          {isUpdatingGoal === g.id ? (
                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                          ) : (
                                            <Check className="w-3.5 h-3.5" />
                                          )}
                                          <span>Save Progress</span>
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {g.progress_note && !isCycleActive && (
                                  <div className="text-[11px] text-slate-500 italic bg-slate-50 dark:bg-slate-800/40 p-2 rounded-xl border border-slate-200/60 dark:border-slate-800">
                                    Latest note: "{g.progress_note}"
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              );
            })()
          ) : (
            <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
              <Target className="w-10 h-10 text-slate-400 mx-auto" />
              <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                No Performance Summary Available
              </div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No performance data found for the selected cycle.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TASK STORY POINTS (SPRINT DELIVERY VELOCITY)                       */}
      {/* ========================================================================= */}
      {activeTab === 'story' && (
        isLoadingStory ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
        <div className="space-y-8">
          {/* Informational Sub-header */}
          <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-blue-900 dark:text-blue-200 text-xs flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                <strong>Sprint Story Points</strong> estimate task delivery complexity (Fibonacci 1, 2, 3, 5, 8). Incomplete tasks rolled over across sprints incur a <strong>-25% deduction per carry-over</strong>.
              </span>
            </div>
            {pointsData && (
              <span className="font-mono font-bold text-blue-700 dark:text-blue-300 shrink-0">
                Quarter: {pointsData.quarter}
              </span>
            )}
          </div>

          {/* Story KPI Cards Grid */}
          {pointsData && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: On-time Completion */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                  <span>On-Time Completion</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {pointsData.tasks_completed_on_time ?? 0} <span className="text-xs font-normal text-slate-400">tasks</span>
                </div>
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <span>{(pointsData.on_time_rate_pct ?? 0).toFixed(0)}% delivery reliability</span>
                </div>
              </div>

              {/* Card 2: Carry Overs */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                  <span>Carried Over Tasks</span>
                  <RotateCw className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {pointsData.tasks_carried_over ?? 0} <span className="text-xs font-normal text-slate-400">tasks</span>
                </div>
                <div className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                  -25% deduction per carry-over
                </div>
              </div>

              {/* Card 3: Standup Consistency */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                  <span>Standup Consistency</span>
                  <Flame className="w-4 h-4 text-orange-500" />
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {(pointsData.checkin_consistency_pct ?? 0).toFixed(0)}%
                </div>
                <div className="text-[11px] text-orange-600 dark:text-orange-400 font-semibold">
                  {pointsData.checkin_streak ?? 0} day consecutive streak
                </div>
              </div>

              {/* Card 4: Blockers Resolved */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                  <span>Blockers Resolved</span>
                  <ShieldCheck className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {pointsData.blockers_resolved ?? 0} <span className="text-xs font-normal text-slate-400">resolved</span>
                </div>
                <div className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
                  Proactive blocker surfacing
                </div>
              </div>
            </div>
          )}

          {/* Transparent Formula Banner & Interactive Calculator */}
          <div className="p-6 rounded-3xl bg-slate-900 text-white shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <Calculator className="w-5 h-5 text-sky-400" />
                <div>
                  <h3 className="font-bold text-sm">Transparent Sprint Points Calculation Formula</h3>
                  <p className="text-xs text-slate-400">
                    Formula applied identically to all team members during sprint closes and delivery estimation.
                  </p>
                </div>
              </div>

              <div className="px-3.5 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 font-mono text-xs text-sky-300">
                Points = Difficulty × (1.0 - 0.25 × CarryOvers)
              </div>
            </div>

            {/* Step-by-Step Penalty Scale */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center text-xs">
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/80">
                <div className="text-slate-400 text-[11px]">0 Carry-overs</div>
                <div className="font-black text-emerald-400 text-base mt-1">100%</div>
                <div className="text-[10px] text-slate-400">Full Points</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/80">
                <div className="text-slate-400 text-[11px]">1 Carry-over</div>
                <div className="font-black text-blue-400 text-base mt-1">75%</div>
                <div className="text-[10px] text-slate-400">-25% Penalty</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/80">
                <div className="text-slate-400 text-[11px]">2 Carry-overs</div>
                <div className="font-black text-amber-400 text-base mt-1">50%</div>
                <div className="text-[10px] text-slate-400">-50% Penalty</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/80">
                <div className="text-slate-400 text-[11px]">3 Carry-overs</div>
                <div className="font-black text-orange-400 text-base mt-1">25%</div>
                <div className="text-[10px] text-slate-400">-75% Penalty</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/80 col-span-2 sm:col-span-1">
                <div className="text-slate-400 text-[11px]">4+ Carry-overs</div>
                <div className="font-black text-rose-400 text-base mt-1">0%</div>
                <div className="text-[10px] text-slate-400">Min 0 Points</div>
              </div>
            </div>

            {/* Live Mini Calculator */}
            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-slate-300">
              <span className="font-semibold text-slate-400">Try it:</span>
              <div className="flex items-center gap-1.5">
                <span>Difficulty:</span>
                <select
                  value={calculatorDifficulty}
                  onChange={(e) => setCalculatorDifficulty(Number(e.target.value))}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white outline-hidden"
                >
                  <option value={1}>1 pt</option>
                  <option value={2}>2 pts</option>
                  <option value={3}>3 pts</option>
                  <option value={5}>5 pts</option>
                  <option value={8}>8 pts</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span>Carry-overs:</span>
                <select
                  value={calculatorCarryOvers}
                  onChange={(e) => setCalculatorCarryOvers(Number(e.target.value))}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white outline-hidden"
                >
                  <option value={0}>0 (On time)</option>
                  <option value={1}>1 (Slipped 1x)</option>
                  <option value={2}>2 (Slipped 2x)</option>
                  <option value={3}>3 (Slipped 3x)</option>
                  <option value={4}>4+ (Overdue)</option>
                </select>
              </div>

              <div className="font-bold text-sky-400 flex items-center gap-1">
                <span>=</span>
                <span className="text-sm bg-sky-500/20 px-2.5 py-0.5 rounded-md border border-sky-500/40">
                  {simulatedEarned.toFixed(2)} Points Awarded
                </span>
              </div>
            </div>
          </div>

          {/* Per-Sprint Velocity Bars */}
          {pointsData && pointsData.points_per_sprint && pointsData.points_per_sprint.length > 0 && (
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-blue-600" />
                  <span>Sprint Velocity Trend</span>
                </h3>
                <span className="text-xs text-slate-400 font-mono">Completed Tasks per Sprint</span>
              </div>

              <div className="space-y-3">
                {pointsData.points_per_sprint.map((sprint, idx) => {
                  const maxPoints = Math.max(...pointsData.points_per_sprint.map(s => s.points), 20);
                  const barWidthPct = Math.min(100, Math.max(10, (sprint.points / maxPoints) * 100));

                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{sprint.sprint_name}</span>
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{sprint.points.toFixed(1)} pts</span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-600 to-sky-500 rounded-full transition-all duration-500"
                          style={{ width: `${barWidthPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Task Points Audit Breakdown Table */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Task Points Ledger & Delivery Audit
                </h3>
              </div>
              <span className="text-xs text-slate-400">
                {pointsData?.tasks?.length || 0} tasks evaluated
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Task Title</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Difficulty</th>
                    <th className="py-3 px-3">Carry-overs</th>
                    <th className="py-3 px-3">Deduction %</th>
                    <th className="py-3 px-4 text-right">Earned Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {pointsData?.tasks?.map((t) => (
                    <tr key={t.task_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">{t.title}</div>
                        <div className="text-[11px] text-slate-400 font-mono">Task #{t.task_id}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          t.status === 'Done'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                            : t.status === 'Blocked'
                            ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                            : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                        }`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {t.difficulty} pts
                      </td>
                      <td className="py-3 px-3">
                        {t.carried_over_count > 0 ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                            <RotateCw className="w-3.5 h-3.5" />
                            <span>{t.carried_over_count}x</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">0 (On time)</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400">
                        {t.penalty_pct_applied > 0 ? `-${t.penalty_pct_applied.toFixed(0)}%` : '0%'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-blue-600 dark:text-blue-400 text-sm">
                        {t.earned_points.toFixed(1)} pts
                      </td>
                    </tr>
                  ))}
                  {(!pointsData?.tasks || pointsData.tasks.length === 0) && (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-slate-400">
                        No completed tasks in current quarter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}

      {/* ========================================================================= */}
      {/* MODAL: ASSIGN NEW PERFORMANCE GOAL (FOR MANAGERS / DIRECTORS)            */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Target className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Assign Performance Goal
                </h3>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateGoal} className="p-6 space-y-4">
              {createGoalError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs">
                  {createGoalError}
                </div>
              )}

              {/* Subordinate Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Assign to Reporting Subordinate
                </label>
                <select
                  value={newGoalAssigneeId}
                  onChange={(e) => setNewGoalAssigneeId(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {subordinates.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Subordinate #{s.id})
                    </option>
                  ))}
                  {subordinates.length === 0 && (
                    <option value={user?.id || 0}>{user?.full_name} (Self)</option>
                  )}
                </select>
              </div>

              {/* Goal Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Goal / Milestone Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Implement Multi-Tenant Isolation with Zero Leaks"
                  value={newGoalTitle}
                  onChange={(e) => setNewGoalTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Goal Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Success Criteria
                </label>
                <textarea
                  rows={2}
                  placeholder="Objective measurable outcomes..."
                  value={newGoalDesc}
                  onChange={(e) => setNewGoalDesc(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Category & Points */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={newGoalCategory}
                    onChange={(e) => setNewGoalCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="delivery">Delivery</option>
                    <option value="technical_excellence">Technical Excellence</option>
                    <option value="mentorship">Mentorship</option>
                    <option value="strategic">Strategic</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Assigned Performance Points
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    step="0.5"
                    value={newGoalPoints}
                    onChange={(e) => setNewGoalPoints(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingGoal}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                >
                  {isSubmittingGoal ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Assign Goal</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
