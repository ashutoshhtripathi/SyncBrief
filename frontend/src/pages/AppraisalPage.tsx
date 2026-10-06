import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Award, 
  Download, 
  Printer, 
  FileSpreadsheet, 
  CheckCircle2, 
  RotateCw, 
  Flame, 
  ShieldCheck, 
  AlertCircle, 
  Star, 
  TrendingUp, 
  Filter,
  BarChart3,
  Target,
  Layers,
  ChevronDown,
  ChevronRight,
  Info,
  Sparkles,
  Clock,
  FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  fetchAppraisalReport, 
  getAppraisalCsvDownloadUrl, 
  fetchPerformanceCycles, 
  fetchPerformanceAppraisalEvidence 
} from '../api';
import { 
  AppraisalReport, 
  AppraisalEmployee, 
  PerformanceCycle, 
  PerformanceAppraisalEvidenceResponse,
  PerformanceAppraisalEvidenceItem
} from '../types';
import { PerformanceReviewDossier } from '../components/PerformanceReviewDossier';

export const AppraisalPage: React.FC = () => {
  const { user } = useAuth();

  // Active view: 'performance' (Quarterly Goals & Evidence) vs 'story' (Sprint Velocity Matrix)
  const [activeView, setActiveView] = useState<'performance' | 'story'>('performance');

  // --- Story Points State ---
  const [report, setReport] = useState<AppraisalReport | null>(null);
  const [selectedQuarter, setSelectedQuarter] = useState('Q3 2026');
  const [isLoadingStory, setIsLoadingStory] = useState(true);
  const [storyErrorMsg, setStoryErrorMsg] = useState<string | null>(null);

  // --- Performance Points State ---
  const [cycles, setCycles] = useState<PerformanceCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<number | undefined>(undefined);
  const [perfEvidence, setPerfEvidence] = useState<PerformanceAppraisalEvidenceResponse | null>(null);
  const [isLoadingPerf, setIsLoadingPerf] = useState(true);
  const [perfErrorMsg, setPerfErrorMsg] = useState<string | null>(null);
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<number | null>(null);

  // --- Performance Review Dossier Modal State ---
  const [reviewDossierUserId, setReviewDossierUserId] = useState<number | null>(null);
  const [reviewDossierCycleId, setReviewDossierCycleId] = useState<number | undefined>(undefined);
  const [isDossierOpen, setIsDossierOpen] = useState(false);

  const handleOpenDossier = (targetUserId: number, targetCycleId?: number) => {
    setReviewDossierUserId(targetUserId);
    setReviewDossierCycleId(targetCycleId);
    setIsDossierOpen(true);
  };

  // Load Story Appraisal Report
  useEffect(() => {
    loadStoryAppraisal();
  }, [user?.id, selectedQuarter]);

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
      .catch((err) => console.error("Failed to load cycles:", err));
  }, [user?.id]);

  // Load Performance Evidence when cycle changes
  useEffect(() => {
    if (selectedCycleId !== undefined) {
      loadPerformanceEvidence(selectedCycleId);
    }
  }, [selectedCycleId, user?.id]);

  const loadStoryAppraisal = async () => {
    setIsLoadingStory(true);
    setStoryErrorMsg(null);
    try {
      const data = await fetchAppraisalReport(selectedQuarter);
      setReport(data);
    } catch (err: any) {
      setStoryErrorMsg(err.message || 'Failed to load appraisal report');
    } finally {
      setIsLoadingStory(false);
    }
  };

  const loadPerformanceEvidence = async (cycleId?: number) => {
    setIsLoadingPerf(true);
    setPerfErrorMsg(null);
    try {
      const data = await fetchPerformanceAppraisalEvidence(cycleId);
      setPerfEvidence(data);
    } catch (err: any) {
      setPerfErrorMsg(err.message || 'Failed to load performance appraisal evidence');
    } finally {
      setIsLoadingPerf(false);
    }
  };

  const handleExportCsv = () => {
    const url = getAppraisalCsvDownloadUrl(selectedQuarter);
    window.open(url, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  const toggleExpand = (empId: number) => {
    setExpandedEmployeeId(prev => (prev === empId ? null : empId));
  };

  const employees = report?.employees || [];
  const teamTotalPoints = employees.reduce((acc, e) => acc + (Number.isFinite(e.total_points) ? e.total_points : 0), 0);
  const avgOnTimeRate = employees.length > 0
    ? employees.reduce((acc, e) => acc + (Number.isFinite(e.on_time_rate_pct) ? e.on_time_rate_pct : 0), 0) / employees.length
    : 0;
  const avgConsistency = employees.length > 0
    ? employees.reduce((acc, e) => acc + (Number.isFinite(e.checkin_consistency_pct) ? e.checkin_consistency_pct : 0), 0) / employees.length
    : 0;

  // Performance calculations
  const perfItems = perfEvidence?.items || [];
  const totalAssignedPerf = perfItems.reduce((acc, i) => acc + (Number.isFinite(i.total_assigned_points) ? i.total_assigned_points : 0), 0);
  const totalEarnedPerf = perfItems.reduce((acc, i) => acc + (Number.isFinite(i.total_earned_points) ? i.total_earned_points : 0), 0);
  const totalRemainingPerf = perfItems.reduce((acc, i) => acc + (Number.isFinite(i.total_remaining_points) ? i.total_remaining_points : 0), 0);
  const avgAchievementPerf = totalAssignedPerf > 0 ? (totalEarnedPerf / totalAssignedPerf) * 100 : 0;
  const totalCarriedGoals = perfItems.reduce((acc, i) => acc + (Number.isFinite(i.carried_goals_count) ? i.carried_goals_count : 0), 0);

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Top Header & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <span>Team Quarterly Appraisal & Review</span>
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold">
              Leadership Hierarchy View
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Protected subordinate evaluation console. Review goal achievement evidence and sprint delivery velocity.
          </p>
        </div>

        {/* Action Controls & Tab Switcher */}
        <div className="flex flex-wrap items-center gap-2.5 print:hidden">
          {/* View Switcher */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveView('performance')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeView === 'performance'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/60 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>Performance Evidence</span>
            </button>

            <button
              onClick={() => setActiveView('story')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeView === 'story'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/60 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Story Points Matrix</span>
            </button>
          </div>

          {activeView === 'story' && (
            <>
              {/* Export CSV */}
              <button
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition"
                title="Download CSV for HR Systems"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </>
          )}

          {/* Print / PDF */}
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold shadow-xs transition dark:bg-slate-700 dark:hover:bg-slate-600"
            title="Print or Save as PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Prominent Human Appraisal & Evaluation Disclaimer Banner */}
      <div className="p-4 rounded-3xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 shadow-xs space-y-1">
        <div className="flex items-center gap-2 font-bold text-xs">
          <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>Human Appraisal & Review Standard</span>
        </div>
        <p className="text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed pl-6">
          SyncBrief Performance Points and delivery metrics provide <strong>objective evidence for human manager evaluation</strong>; appraisal ratings, merit increments, and promotion decisions are <strong>not automated</strong>.
        </p>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: PERFORMANCE GOALS & APPRAISAL EVIDENCE                            */}
      {/* ========================================================================= */}
      {activeView === 'performance' && (
        <div className="space-y-6">
          {/* Cycle Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-blue-600" />
                <span>Performance Cycle:</span>
              </span>
              <select
                value={selectedCycleId}
                onChange={(e) => setSelectedCycleId(Number(e.target.value))}
                className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                {cycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.is_active ? '• Active Review' : '• Closed Archive'}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400">
              Evaluating subordinates under <strong className="text-slate-700 dark:text-slate-200">{perfEvidence?.manager_name || user?.full_name}</strong>
            </div>
          </div>

          {perfErrorMsg ? (
            <div className="p-6 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-2">
              <div className="font-bold flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <span>Access Notice</span>
              </div>
              <p className="text-xs leading-relaxed">{perfErrorMsg}</p>
            </div>
          ) : isLoadingPerf ? (
            <div className="flex items-center justify-center min-h-[300px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {/* Summary Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5">
                  <span className="text-xs text-slate-500 font-medium">Subordinates Evaluated</span>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {perfItems.length} <span className="text-xs font-normal text-slate-400">members</span>
                  </div>
                  <span className="text-[11px] text-blue-600 font-medium">Reporting in hierarchy</span>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5">
                  <span className="text-xs text-slate-500 font-medium">Assigned Performance Points</span>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {totalAssignedPerf.toFixed(1)} <span className="text-xs font-normal text-slate-400">pts</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">Total milestone quota</span>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5">
                  <span className="text-xs text-slate-500 font-medium">Earned Performance Points</span>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {totalEarnedPerf.toFixed(1)} <span className="text-xs font-normal text-slate-400">pts</span>
                  </div>
                  <span className="text-[11px] text-emerald-600 font-medium">
                    {avgAchievementPerf.toFixed(0)}% team achievement rate
                  </span>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5">
                  <span className="text-xs text-slate-500 font-medium">Carried Over Goals</span>
                  <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
                    {totalCarriedGoals}
                  </div>
                  <span className="text-[11px] text-amber-600 font-medium">
                    Preserves prior earned points
                  </span>
                </div>
              </div>

              {/* Subordinates Evidence Table */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Performance Goals Achievement Evidence</span>
                      <span className="text-xs font-normal text-slate-400">({perfEvidence?.cycle_name})</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Click any subordinate row to inspect their detailed individual goal milestones and progress notes.
                    </p>
                  </div>
                  <div className="text-xs font-mono text-slate-400">
                    Continuous Progress Points
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-3.5 px-4">Subordinate</th>
                        <th className="py-3.5 px-3">Role / Level</th>
                        <th className="py-3.5 px-3 text-center">Goals Progress</th>
                        <th className="py-3.5 px-3 text-right">Assigned</th>
                        <th className="py-3.5 px-3 text-right">Earned</th>
                        <th className="py-3.5 px-3 text-right">Remaining</th>
                        <th className="py-3.5 px-3 text-center">Achievement %</th>
                        <th className="py-3.5 px-3 text-center">Carried</th>
                        <th className="py-3.5 px-4 text-center">Detail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {perfItems.map((item) => {
                        const empId = item.user_id || (item as any).employee_id;
                        const empName = item.full_name || (item as any).employee_name;
                        const empTitle = item.title || (item as any).employee_title;
                        const goalsCompleted = item.completed_goals_count ?? (item as any).goals_completed ?? 0;
                        const goalsTotal = item.goals_count ?? (item as any).goals_total ?? 0;
                        const assignedPts = item.total_assigned_points ?? 0;
                        const earnedPts = item.total_earned_points ?? 0;
                        const remainingPts = item.total_remaining_points ?? 0;
                        const achievementRate = item.completion_rate_pct ?? (item as any).achievement_rate_pct ?? 0;
                        const carriedCount = item.carried_forward_goals_count ?? (item as any).carried_goals_count ?? 0;
                        const isExpanded = expandedEmployeeId === empId;

                        return (
                          <React.Fragment key={empId}>
                            <tr 
                              onClick={() => toggleExpand(empId)}
                              className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition cursor-pointer"
                            >
                              {/* Subordinate Name & Title */}
                              <td className="py-3.5 px-4">
                                <div>
                                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                    <span>{empName}</span>
                                    {isExpanded ? (
                                      <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
                                    ) : (
                                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-400">{empTitle}</div>
                                </div>
                              </td>

                              {/* Level */}
                              <td className="py-3.5 px-3">
                                <span className="font-mono text-slate-600 dark:text-slate-300 font-semibold">
                                  L{item.role_level}
                                </span>
                              </td>

                              {/* Goals Completed */}
                              <td className="py-3.5 px-3 text-center">
                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                  {goalsCompleted} / {goalsTotal}
                                </span>
                              </td>

                              {/* Assigned Points */}
                              <td className="py-3.5 px-3 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">
                                {assignedPts.toFixed(1)}
                              </td>

                              {/* Earned Points */}
                              <td className="py-3.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                                {earnedPts.toFixed(1)}
                              </td>

                              {/* Remaining Points */}
                              <td className="py-3.5 px-3 text-right font-mono text-sky-600 dark:text-sky-400">
                                {remainingPts.toFixed(1)}
                              </td>

                              {/* Achievement % */}
                              <td className="py-3.5 px-3 text-center">
                                <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                                  achievementRate >= 80
                                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                    : achievementRate >= 50
                                    ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                                    : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                                }`}>
                                  {achievementRate.toFixed(0)}%
                                </span>
                              </td>

                              {/* Carried Goals */}
                              <td className="py-3.5 px-3 text-center font-mono">
                                {carriedCount > 0 ? (
                                  <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                                    <RotateCw className="w-3.5 h-3.5" />
                                    <span>{carriedCount}</span>
                                  </span>
                                ) : (
                                  <span className="text-slate-400">0</span>
                                )}
                              </td>

                              {/* Action */}
                              <td className="py-3.5 px-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenDossier(empId, perfEvidence?.cycle_id);
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-[11px] border border-blue-200 dark:border-blue-800 shadow-xs transition"
                                    title="Open Performance Review Dossier"
                                  >
                                    <FileText className="w-3 h-3" />
                                    <span>Prepare Review</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => toggleExpand(empId)}
                                    className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-semibold text-[11px]"
                                  >
                                    {isExpanded ? 'Hide' : 'Goals'}
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* Expanded Goals Detail Drawer */}
                            {isExpanded && (
                              <tr className="bg-slate-50/60 dark:bg-slate-800/30">
                                <td colSpan={9} className="p-4 sm:p-6 space-y-3">
                                  <div className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center justify-between">
                                    <span>Detailed Goal Milestones for {empName}:</span>
                                    <span className="text-[11px] text-slate-400 font-normal">
                                      Zero duplicate points on carry-overs
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {(item.goals || []).map((g) => {
                                      const isCarried = g.carried_from_goal_id !== null && g.carried_from_goal_id !== undefined;
                                      const gProgress = g.current_progress_percentage ?? (g as any).current_progress_pct ?? 0;
                                      const gTarget = g.target_percentage ?? (g as any).target_pct ?? 100;
                                      return (
                                        <div 
                                          key={g.id} 
                                          className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 shadow-xs space-y-2"
                                        >
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="space-y-0.5">
                                              <div className="flex items-center gap-1.5 flex-wrap">
                                                {isCarried && (
                                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                                                    Carried Goal
                                                  </span>
                                                )}
                                              </div>
                                              <h5 className="font-bold text-xs text-slate-900 dark:text-white">
                                                {g.title}
                                              </h5>
                                            </div>

                                            <div className="text-right shrink-0">
                                              <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                                                {g.earned_points.toFixed(1)} / {g.assigned_points.toFixed(1)} pts
                                              </span>
                                            </div>
                                          </div>

                                          {/* Progress bar */}
                                          <div className="space-y-1">
                                            <div className="flex justify-between text-[10px] text-slate-500">
                                              <span>Progress: {gProgress}%</span>
                                              <span>Target: {gTarget}%</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                              <div 
                                                className="h-full bg-emerald-500 rounded-full" 
                                                style={{ width: `${Math.min(100, gProgress)}%` }}
                                              />
                                            </div>
                                          </div>

                                          {/* Points Math Breakdown */}
                                          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
                                            {isCarried ? (
                                              <span>Prior: <strong className="text-amber-600">{g.previously_earned_points.toFixed(1)}</strong></span>
                                            ) : (
                                              <span>New goal</span>
                                            )}
                                            <span>Cycle Earned: <strong className="text-emerald-600">{g.earned_points.toFixed(1)}</strong></span>
                                            <span>Remaining: <strong className="text-sky-600">{g.remaining_points.toFixed(1)}</strong></span>
                                          </div>

                                          {g.progress_note && (
                                            <div className="text-[10px] text-slate-500 italic bg-slate-50 dark:bg-slate-800/40 p-1.5 rounded-lg border border-slate-200/50 dark:border-slate-800">
                                              "{g.progress_note}"
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}

                      {perfItems.length === 0 && (
                        <tr>
                          <td colSpan={9} className="text-center py-8 text-slate-400">
                            No subordinate team performance records found for this cycle.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: TASK STORY POINTS & SPRINT VELOCITY MATRIX                         */}
      {/* ========================================================================= */}
      {activeView === 'story' && (
        <div className="space-y-6">
          {/* Quarter Dropdown */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Evaluation Quarter:
              </span>
              <select
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(e.target.value)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="Q3 2026">Q3 2026 (Current)</option>
                <option value="Q2 2026">Q2 2026 (Previous)</option>
                <option value="Q1 2026">Q1 2026</option>
              </select>
            </div>
            <div className="text-xs text-slate-500">
              Evaluated under <strong className="text-slate-700 dark:text-slate-200">{report?.manager_name}</strong>
            </div>
          </div>

          {storyErrorMsg ? (
            <div className="p-6 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-2">
              <div className="font-bold flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <span>Hierarchy Access Notice</span>
              </div>
              <p className="text-xs leading-relaxed">{storyErrorMsg}</p>
            </div>
          ) : isLoadingStory ? (
            <div className="flex items-center justify-center min-h-[300px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {/* Summary Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5">
                  <span className="text-xs text-slate-500 font-medium">Reporting Subordinates</span>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {employees.length} <span className="text-xs font-normal text-slate-400">members</span>
                  </div>
                  <span className="text-[11px] text-blue-600 font-medium">Under {report?.manager_name}</span>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5">
                  <span className="text-xs text-slate-500 font-medium">Total Team Story Points</span>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {teamTotalPoints.toFixed(1)} <span className="text-xs font-normal text-slate-400">pts</span>
                  </div>
                  <span className="text-[11px] text-emerald-600 font-medium">Earned this quarter</span>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5">
                  <span className="text-xs text-slate-500 font-medium">Avg On-Time Delivery Rate</span>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {avgOnTimeRate.toFixed(0)}%
                  </div>
                  <span className="text-[11px] text-emerald-600 font-medium">Target: &gt;80%</span>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5">
                  <span className="text-xs text-slate-500 font-medium">Avg Standup Consistency</span>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {avgConsistency.toFixed(0)}%
                  </div>
                  <span className="text-[11px] text-orange-600 font-medium">60s async submission rate</span>
                </div>
              </div>

              {/* Appraisal Performance Matrix Table */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Employee Performance & Story Points Matrix ({selectedQuarter})
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Visible exclusively to {report?.manager_name} and higher leadership in the reporting chain.
                    </p>
                  </div>
                  <div className="text-xs font-mono text-slate-400">
                    Formula: difficulty * (1 - 0.25 * carry_overs)
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-3.5 px-4">Employee</th>
                        <th className="py-3.5 px-3">Role / Level</th>
                        <th className="py-3.5 px-3 text-right">Points Earned</th>
                        <th className="py-3.5 px-3 text-center">Tasks Done</th>
                        <th className="py-3.5 px-3 text-center">On-Time %</th>
                        <th className="py-3.5 px-3 text-center">Carry-overs</th>
                        <th className="py-3.5 px-3 text-center">Blockers (R/S)</th>
                        <th className="py-3.5 px-3 text-center">Standup Rate</th>
                        <th className="py-3.5 px-3 text-center">Score</th>
                        <th className="py-3.5 px-4 text-center">Evaluation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {employees.map((emp) => {
                        const isExceeds = emp.rating_category.includes("Exceeds");
                        const isMeets = emp.rating_category.includes("Meets");

                        return (
                          <tr key={emp.user_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                            {/* Employee Avatar & Name */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <img
                                  src={emp.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                                  alt={emp.full_name}
                                  className="w-8 h-8 rounded-full object-cover ring-2 ring-blue-500/20"
                                />
                                <div>
                                  <div className="font-bold text-slate-900 dark:text-white">{emp.full_name}</div>
                                  <div className="text-[11px] text-slate-400">{emp.title}</div>
                                </div>
                              </div>
                            </td>

                            {/* Level */}
                            <td className="py-3.5 px-3">
                              <span className="font-mono text-slate-600 dark:text-slate-300 font-semibold">
                                L{emp.role_level}
                              </span>
                            </td>

                            {/* Points */}
                            <td className="py-3.5 px-3 text-right font-mono font-black text-blue-600 dark:text-blue-400 text-sm">
                              {emp.total_points.toFixed(1)}
                            </td>

                            {/* Tasks Done */}
                            <td className="py-3.5 px-3 text-center font-bold text-slate-800 dark:text-slate-200">
                              {emp.tasks_completed}
                            </td>

                            {/* On-Time Rate */}
                            <td className="py-3.5 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                                emp.on_time_rate_pct >= 85
                                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                  : emp.on_time_rate_pct >= 65
                                  ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                                  : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                              }`}>
                                {emp.on_time_rate_pct.toFixed(0)}%
                              </span>
                            </td>

                            {/* Carry-overs */}
                            <td className="py-3.5 px-3 text-center font-mono">
                              {emp.carry_over_count > 0 ? (
                                <span className="inline-flex items-center justify-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
                                  <RotateCw className="w-3.5 h-3.5" />
                                  <span>{emp.carry_over_count}</span>
                                </span>
                              ) : (
                                <span className="text-slate-400">0</span>
                              )}
                            </td>

                            {/* Blockers Raised/Resolved */}
                            <td className="py-3.5 px-3 text-center font-mono text-slate-600 dark:text-slate-400">
                              {emp.blockers_raised} / <span className="font-bold text-emerald-600">{emp.blockers_resolved}</span>
                            </td>

                            {/* Standup Consistency */}
                            <td className="py-3.5 px-3 text-center font-semibold text-slate-700 dark:text-slate-300">
                              {emp.checkin_consistency_pct.toFixed(0)}%
                            </td>

                            {/* Score */}
                            <td className="py-3.5 px-3 text-center font-mono font-bold text-slate-900 dark:text-white">
                              <div className="flex items-center justify-center gap-1">
                                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                <span>{emp.appraisal_score.toFixed(1)}</span>
                              </div>
                            </td>

                            {/* Evaluation Badge */}
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                  isExceeds
                                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300'
                                    : isMeets
                                    ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300'
                                    : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300'
                                }`}>
                                  {emp.rating_category}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenDossier(emp.user_id)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-[10px] border border-blue-200 dark:border-blue-800 transition shadow-xs"
                                  title="Prepare Performance Review Dossier"
                                >
                                  <FileText className="w-2.5 h-2.5" />
                                  <span>Prepare Review</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {employees.length === 0 && (
                        <tr>
                          <td colSpan={10} className="text-center py-8 text-slate-400">
                            No subordinate team records found for this quarter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Performance Review Dossier Modal */}
      {reviewDossierUserId && (
        <PerformanceReviewDossier
          userId={reviewDossierUserId}
          cycleId={reviewDossierCycleId}
          isOpen={isDossierOpen}
          onClose={() => {
            setIsDossierOpen(false);
            setReviewDossierUserId(null);
          }}
        />
      )}
    </div>
  );
};
