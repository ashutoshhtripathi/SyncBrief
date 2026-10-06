import React, { useState, useEffect } from 'react';
import { 
  Award, 
  TrendingUp, 
  CheckCircle2, 
  RotateCw, 
  Calendar, 
  ChevronRight, 
  ChevronLeft,
  ArrowUpRight, 
  ArrowDownRight,
  ShieldCheck, 
  AlertTriangle, 
  Target, 
  Layers, 
  Info, 
  Clock, 
  Sparkles,
  Users,
  User as UserIcon,
  HelpCircle,
  BarChart3,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  fetchMyPerformanceHistory, 
  fetchUserPerformanceHistory, 
  fetchTeamPerformanceHistory 
} from '../api';
import { 
  PerformanceHistoryResponse, 
  TeamPerformanceHistoryResponse, 
  QuarterPerformanceDetail,
  PerformanceGoal
} from '../types';

export const PerformanceHistoryPage: React.FC = () => {
  const { user } = useAuth();

  // Role detection
  const isDirectorOrAdmin = user?.role === 'admin' || user?.role === 'director' || (user?.role_level !== undefined && user.role_level <= 1);
  const isManager = user?.role === 'manager' || (user?.role_level !== undefined && user.role_level === 2);
  const hasManagerialScope = isDirectorOrAdmin || isManager;

  // View state: 'my' (My Performance) vs 'team' (Team Performance)
  const [activeTab, setActiveTab] = useState<'my' | 'team'>('my');

  // Drilldown user ID when viewing subordinate history from Team tab
  const [selectedSubordinateId, setSelectedSubordinateId] = useState<number | null>(null);

  // Data states
  const [historyData, setHistoryData] = useState<PerformanceHistoryResponse | null>(null);
  const [teamData, setTeamData] = useState<TeamPerformanceHistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected quarter for detailed goal inspection
  const [selectedQuarterCycleId, setSelectedQuarterCycleId] = useState<number | null>(null);

  // Load My Performance or Subordinate Performance
  useEffect(() => {
    if (activeTab === 'my' || (activeTab === 'team' && selectedSubordinateId !== null)) {
      setIsLoading(true);
      setError(null);
      const request = selectedSubordinateId !== null
        ? fetchUserPerformanceHistory(selectedSubordinateId)
        : fetchMyPerformanceHistory();

      request
        .then((data) => {
          setHistoryData(data);
          // Default inspected quarter to current cycle or latest quarter
          if (data.current_cycle) {
            setSelectedQuarterCycleId(data.current_cycle.cycle_id);
          } else if (data.historical_quarters.length > 0) {
            setSelectedQuarterCycleId(data.historical_quarters[data.historical_quarters.length - 1].cycle_id);
          }
        })
        .catch((err: any) => {
          console.error("Failed to load performance history:", err);
          setError(err.message || 'Failed to load performance history');
        })
        .finally(() => setIsLoading(false));
    }
  }, [activeTab, selectedSubordinateId, user?.id]);

  // Load Team Performance overview
  useEffect(() => {
    if (activeTab === 'team' && selectedSubordinateId === null && hasManagerialScope) {
      setIsLoading(true);
      setError(null);
      fetchTeamPerformanceHistory()
        .then(setTeamData)
        .catch((err: any) => {
          console.error("Failed to load team performance:", err);
          setError(err.message || 'Failed to load team performance history');
        })
        .finally(() => setIsLoading(false));
    }
  }, [activeTab, selectedSubordinateId, hasManagerialScope, user?.id]);

  const handleSelectSubordinate = (subId: number) => {
    setSelectedSubordinateId(subId);
  };

  const handleBackToTeam = () => {
    setSelectedSubordinateId(null);
  };

  const inspectedQuarter: QuarterPerformanceDetail | undefined = 
    historyData?.historical_quarters.find(q => q.cycle_id === selectedQuarterCycleId) ||
    historyData?.historical_quarters[historyData.historical_quarters.length - 1];

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-900 flex items-center justify-center shrink-0">
              <Award className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Performance History & Intelligence</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold">
                  Long-Term Deltas
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Permanent historical records of quarterly goals, yearly completion, and objective performance trends.
              </p>
            </div>
          </div>
        </div>

        {/* Role-Aware View Switcher (for Managers & Directors) */}
        {hasManagerialScope && (
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 self-start lg:self-auto">
            <button
              onClick={() => {
                setActiveTab('my');
                setSelectedSubordinateId(null);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'my'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>My Performance</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('team');
                setSelectedSubordinateId(null);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'team'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Team Performance</span>
            </button>
          </div>
        )}
      </div>

      {/* Loading & Error States */}
      {isLoading && (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
          <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Retrieving permanent performance records...</p>
        </div>
      )}

      {error && !isLoading && (
        <div className="p-6 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-3xl text-red-700 dark:text-red-300 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* TEAM PERFORMANCE OVERVIEW (Manager/Director View) */}
      {!isLoading && !error && activeTab === 'team' && selectedSubordinateId === null && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>TEAM PERFORMANCE</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                  {teamData?.members.length || 0} Members
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isDirectorOrAdmin ? 'Authorized organizational performance history across tenant.' : 'Authorized subordinates within your reporting tree.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {teamData?.members.map((member) => (
              <div 
                key={member.user_id}
                className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {member.full_name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{member.title}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      L{member.role_level}
                    </span>
                  </div>

                  {/* Current Cycle Metrics */}
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 mb-3.5">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-slate-600 dark:text-slate-300">
                        {member.current_cycle_name || 'Active Cycle'}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {member.current_completion_pct !== null && member.current_completion_pct !== undefined
                          ? `${member.current_completion_pct}%`
                          : 'No goals'}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-blue-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, member.current_completion_pct || 0)}%` }}
                      />
                    </div>
                  </div>

                  {/* Yearly Completion History Pills */}
                  {member.yearly_summaries.length > 0 && (
                    <div className="mb-4">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                        Yearly Completion
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {member.yearly_summaries.map(y => (
                          <span 
                            key={y.year}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-semibold"
                          >
                            <span>{y.year}:</span>
                            <strong>{y.completion_rate_pct}%</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Deterministic Trend */}
                  {member.latest_trend && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 italic">
                      "{member.latest_trend}"
                    </p>
                  )}
                </div>

                <button
                  onClick={() => handleSelectSubordinate(member.user_id)}
                  className="w-full mt-2 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 text-xs font-bold transition-all"
                >
                  <span>View Performance History</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* INDIVIDUAL / MY PERFORMANCE VIEW */}
      {!isLoading && !error && (activeTab === 'my' || (activeTab === 'team' && selectedSubordinateId !== null)) && historyData && (
        <div className="space-y-8">
          {/* Subordinate Drilldown Back Button */}
          {activeTab === 'team' && selectedSubordinateId !== null && (
            <div className="flex items-center justify-between bg-blue-50/60 dark:bg-blue-950/30 p-3.5 rounded-2xl border border-blue-200/80 dark:border-blue-900/60">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBackToTeam}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-all"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Back to Team</span>
                </button>
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  Viewing history for <strong className="text-slate-900 dark:text-white">{historyData.full_name}</strong> ({historyData.title})
                </div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                Authorized Subordinate
              </span>
            </div>
          )}

          {/* Section: EMPTY STATE */}
          {!historyData.has_history && (
            <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                No historical performance data available.
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                No performance goals or completed performance cycles recorded for this account. Active goals and closed quarterly cycles will automatically populate this permanent view.
              </p>
            </div>
          )}

          {historyData.has_history && (
            <>
              {/* SECTION 1: CURRENT CYCLE METRICS */}
              {historyData.current_cycle && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-3xl p-6 shadow-sm space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div>
                      <span className="text-[10px] font-bold tracking-wider uppercase text-blue-600 dark:text-blue-400">
                        ACTIVE EVALUATION WINDOW
                      </span>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>Current Cycle: {historyData.current_cycle.cycle_name}</span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold capitalize">
                          {historyData.current_cycle.status}
                        </span>
                      </h2>
                    </div>

                    <div className="text-right">
                      <div className="text-2xl font-black text-slate-900 dark:text-white">
                        {historyData.current_cycle.completion_rate_pct}%
                      </div>
                      <div className="text-[11px] font-semibold text-slate-400">
                        Cycle Completion Rate
                      </div>
                    </div>
                  </div>

                  {/* Metrics Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
                        Assigned
                      </span>
                      <span className="text-lg font-bold text-slate-900 dark:text-white">
                        {historyData.current_cycle.assigned_points} pts
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                      <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 block mb-1">
                        Earned (Cycle)
                      </span>
                      <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                        {historyData.current_cycle.earned_points} pts
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50">
                      <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 block mb-1">
                        Previously Earned
                      </span>
                      <span className="text-lg font-bold text-amber-700 dark:text-amber-300">
                        {historyData.current_cycle.previously_earned_points} pts
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50">
                      <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 block mb-1">
                        Lifetime Earned
                      </span>
                      <span className="text-lg font-bold text-blue-700 dark:text-blue-300">
                        {historyData.current_cycle.lifetime_earned_points} pts
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
                        Remaining
                      </span>
                      <span className="text-lg font-bold text-slate-900 dark:text-white">
                        {historyData.current_cycle.remaining_points} pts
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
                        Goals Count
                      </span>
                      <span className="text-lg font-bold text-slate-900 dark:text-white">
                        {historyData.current_cycle.total_goals_count}
                        <span className="text-xs text-slate-400 font-normal ml-1">
                          ({historyData.current_cycle.carried_goals_count} carried)
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-blue-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, historyData.current_cycle.completion_rate_pct)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 2: PERFORMANCE TREND & DETERMINISTIC INSIGHTS */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-blue-500" />
                      <span>PERFORMANCE TREND OVER TIME</span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Sequential quarter-by-quarter completion rate progression derived from verified delivered goals.
                    </p>
                  </div>

                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                    historyData.trend.direction === 'improving'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                      : historyData.trend.direction === 'declining'
                      ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                      : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
                  }`}>
                    {historyData.trend.direction === 'improving' && <ArrowUpRight className="w-3.5 h-3.5" />}
                    {historyData.trend.direction === 'declining' && <ArrowDownRight className="w-3.5 h-3.5" />}
                    <span className="capitalize">{historyData.trend.direction.replace('_', ' ')}</span>
                  </span>
                </div>

                {/* Deterministic Trend Insight */}
                <div className="p-3.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/60 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {historyData.trend.summary}
                  </p>
                </div>

                {/* Quarter Visual Progression Bars */}
                <div className="pt-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                    {historyData.historical_quarters.map((q) => (
                      <div 
                        key={q.cycle_id}
                        onClick={() => setSelectedQuarterCycleId(q.cycle_id)}
                        className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                          selectedQuarterCycleId === q.cycle_id
                            ? 'bg-blue-50/90 dark:bg-blue-950/70 border-blue-400 dark:border-blue-600 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                          {q.cycle_name}
                        </span>
                        <div className="text-base font-black text-slate-900 dark:text-white mb-1.5">
                          {q.completion_rate_pct}%
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mb-1">
                          <div 
                            className="bg-blue-600 h-full rounded-full"
                            style={{ width: `${Math.min(100, q.completion_rate_pct)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {q.cycle_earned_points}/{q.assigned_points} pts
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* SECTION 3: YEARLY SUMMARY */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-500" />
                    <span>YEARLY SUMMARY</span>
                  </h2>
                  <span className="text-xs text-slate-400 font-medium">
                    Annual aggregations across all quarters
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {historyData.yearly_summaries.map((yr) => (
                    <div 
                      key={yr.year}
                      className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-3xl p-5 shadow-sm space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-black text-slate-900 dark:text-white">
                          {yr.year}
                        </h3>
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                          {yr.quarters_count} Quarters
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between text-slate-500 dark:text-slate-400">
                          <span>Assigned Points:</span>
                          <strong className="text-slate-900 dark:text-white">{yr.assigned_points} pts</strong>
                        </div>
                        <div className="flex justify-between text-slate-500 dark:text-slate-400">
                          <span>Earned Points:</span>
                          <strong className="text-emerald-600 dark:text-emerald-400">{yr.earned_points} pts</strong>
                        </div>
                        <div className="flex justify-between text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                          <span>Completion Rate:</span>
                          <strong className="text-blue-600 dark:text-blue-400 font-bold">{yr.completion_rate_pct}%</strong>
                        </div>
                      </div>

                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-blue-600 h-full rounded-full"
                          style={{ width: `${Math.min(100, yr.completion_rate_pct)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION 4: QUARTER DETAIL & GOAL INSPECTOR */}
              {inspectedQuarter && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-3xl p-6 shadow-sm space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div>
                      <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
                        QUARTER DETAIL INSPECTOR
                      </span>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{inspectedQuarter.cycle_name}</span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold capitalize">
                          {inspectedQuarter.status}
                        </span>
                      </h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                        Assigned: <strong>{inspectedQuarter.assigned_points} pts</strong>
                      </span>
                      <span className="px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold">
                        Earned: <strong>{inspectedQuarter.cycle_earned_points} pts</strong>
                      </span>
                      <span className="px-3 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold">
                        Completion: <strong>{inspectedQuarter.completion_rate_pct}%</strong>
                      </span>
                    </div>
                  </div>

                  {/* Carry-Forward Breakdown Transparency Banner */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 flex items-start gap-3 text-xs">
                    <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold text-slate-800 dark:text-slate-200">
                        Carry-Forward Point Accountability
                      </p>
                      <p className="text-slate-500 dark:text-slate-400">
                        Previously Earned ({inspectedQuarter.previously_earned_points} pts) + Earned This Cycle ({inspectedQuarter.cycle_earned_points} pts) = Lifetime Earned ({inspectedQuarter.lifetime_earned_points} pts). Remaining available to earn: {inspectedQuarter.remaining_points} pts. Prior achievements are locked and never double-counted.
                      </p>
                    </div>
                  </div>

                  {/* Goal Cards */}
                  <div className="space-y-3.5">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] text-slate-400">
                      Quarterly Goals ({inspectedQuarter.goals.length})
                    </h3>

                    {inspectedQuarter.goals.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No specific goals recorded for this quarter.</p>
                    ) : (
                      inspectedQuarter.goals.map((goal, idx) => (
                        <div 
                          key={goal.id || idx}
                          className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-400">#{idx + 1}</span>
                              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                {goal.title}
                              </h4>
                              {goal.carried_from_goal_id && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 font-bold">
                                  Carried Goal
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-xs font-semibold">
                              <span className="px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                {goal.assigned_points} pts assigned
                              </span>
                              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">
                                {goal.earned_points} pts earned
                              </span>
                              <span className="text-slate-400">
                                ({goal.current_progress_percentage}%)
                              </span>
                            </div>
                          </div>

                          {goal.description && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {goal.description}
                            </p>
                          )}

                          <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className="bg-blue-600 h-full rounded-full"
                              style={{ width: `${Math.min(100, goal.current_progress_percentage)}%` }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
export default PerformanceHistoryPage;
