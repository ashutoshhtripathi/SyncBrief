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
  BarChart3
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchAppraisalReport, getAppraisalCsvDownloadUrl } from '../api';
import { AppraisalReport, AppraisalEmployee } from '../types';

export const AppraisalPage: React.FC = () => {
  const { user } = useAuth();
  const [report, setReport] = useState<AppraisalReport | null>(null);
  const [selectedQuarter, setSelectedQuarter] = useState('Q3 2026');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadAppraisal();
  }, [user?.id, selectedQuarter]);

  const loadAppraisal = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchAppraisalReport(selectedQuarter);
      setReport(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load appraisal report');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCsv = () => {
    const url = getAppraisalCsvDownloadUrl(selectedQuarter);
    window.open(url, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const employees = report?.employees || [];
  const teamTotalPoints = employees.reduce((acc, e) => acc + e.total_points, 0);
  const avgOnTimeRate = employees.length > 0
    ? employees.reduce((acc, e) => acc + e.on_time_rate_pct, 0) / employees.length
    : 0;
  const avgConsistency = employees.length > 0
    ? employees.reduce((acc, e) => acc + e.checkin_consistency_pct, 0) / employees.length
    : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Header & Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <span>Team Quarterly Appraisal</span>
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold">
              Manager Review View
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Hierarchy-protected performance review report for subordinates. Sprints velocity, points, on-time reliability, and standup consistency.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 print:hidden">
          {/* Quarter Dropdown */}
          <select
            value={selectedQuarter}
            onChange={(e) => setSelectedQuarter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500"
          >
            <option value="Q3 2026">Q3 2026 (Current)</option>
            <option value="Q2 2026">Q2 2026 (Previous)</option>
            <option value="Q1 2026">Q1 2026</option>
          </select>

          {/* Export CSV */}
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition"
            title="Download CSV for Excel or HR Systems"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          {/* Print / PDF */}
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold shadow-xs transition dark:bg-slate-700 dark:hover:bg-slate-600"
            title="Print or Save as PDF"
          >
            <Printer className="w-4 h-4" />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {errorMsg ? (
        <div className="p-6 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-2">
          <div className="font-bold flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <span>Hierarchy Access Notice</span>
          </div>
          <p className="text-xs leading-relaxed">{errorMsg}</p>
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
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            isExceeds
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300'
                              : isMeets
                              ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300'
                              : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300'
                          }`}>
                            {emp.rating_category}
                          </span>
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
  );
};
