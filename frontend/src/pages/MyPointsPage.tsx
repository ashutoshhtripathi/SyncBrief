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
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchMyPoints } from '../api';
import { PointsSummary } from '../types';

export const MyPointsPage: React.FC = () => {
  const { user } = useAuth();
  const [pointsData, setPointsData] = useState<PointsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [calculatorDifficulty, setCalculatorDifficulty] = useState<number>(5);
  const [calculatorCarryOvers, setCalculatorCarryOvers] = useState<number>(1);

  useEffect(() => {
    fetchMyPoints()
      .then(setPointsData)
      .catch((err) => console.error("Failed to load points:", err))
      .finally(() => setIsLoading(false));
  }, [user?.id]);

  // Formula interactive simulation
  const simulatedEarned = Math.max(0, calculatorDifficulty * (1 - 0.25 * calculatorCarryOvers));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <span>My Quarterly Points & Appraisal</span>
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold">
              {pointsData?.quarter || 'Q3 2026'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track your sprint task points, on-time velocity, check-in consistency, and quarterly appraisal score.
          </p>
        </div>

        {pointsData && (
          <div className="flex items-center gap-3 bg-gradient-to-r from-blue-600 to-sky-600 text-white px-5 py-2.5 rounded-2xl shadow-md shadow-blue-500/20">
            <div>
              <div className="text-[11px] font-semibold text-blue-100 uppercase tracking-wider">Total Earned</div>
              <div className="text-2xl font-black">{pointsData.total_points.toFixed(1)} <span className="text-xs font-normal">pts</span></div>
            </div>
            <div className="pl-3 border-l border-white/20 text-[11px] space-y-0.5">
              <div>On-time: <span className="font-bold">{pointsData.on_time_rate_pct.toFixed(0)}%</span></div>
              <div>Streak: <span className="font-bold">{pointsData.checkin_streak} days</span></div>
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards Grid */}
      {pointsData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: On-time Completion */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>On-Time Completion</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {pointsData.tasks_completed_on_time} <span className="text-xs font-normal text-slate-400">tasks</span>
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <span>{pointsData.on_time_rate_pct.toFixed(0)}% delivery reliability</span>
            </div>
          </div>

          {/* Card 2: Carry Overs */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>Carried Over Tasks</span>
              <RotateCw className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {pointsData.tasks_carried_over} <span className="text-xs font-normal text-slate-400">tasks</span>
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
              {pointsData.checkin_consistency_pct.toFixed(0)}%
            </div>
            <div className="text-[11px] text-orange-600 dark:text-orange-400 font-semibold">
              {pointsData.checkin_streak} day consecutive streak
            </div>
          </div>

          {/* Card 4: Blockers Resolved */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>Blockers Resolved</span>
              <ShieldCheck className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {pointsData.blockers_resolved} <span className="text-xs font-normal text-slate-400">resolved</span>
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
              <h3 className="font-bold text-sm">Transparent Points Calculation Formula</h3>
              <p className="text-xs text-slate-400">
                Formula applied identically to all team members during sprint closes and quarterly appraisal.
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
              <span>Points Earned per Sprint</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">Quarterly Velocity Trend</span>
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
  );
};
