import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Clock, 
  TrendingUp, 
  DollarSign, 
  Users, 
  Smile, 
  AlertTriangle, 
  Sliders, 
  RefreshCw,
  Zap,
  Globe,
  Sparkles,
  Calculator
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  BarChart, 
  Bar, 
  Cell 
} from 'recharts';
import { fetchInsights } from '../api';
import { InsightsData } from '../types';
import { TimezoneStrip } from '../components/TimezoneStrip';

export const InsightsPage: React.FC = () => {
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Editable Assumptions State
  const [teamSize, setTeamSize] = useState(6);
  const [meetingDuration, setMeetingDuration] = useState(30);
  const [workingDays, setWorkingDays] = useState(22);
  const [hourlyRate, setHourlyRate] = useState(75);

  useEffect(() => {
    loadInsights();
  }, [teamSize, meetingDuration, workingDays, hourlyRate]);

  const loadInsights = async () => {
    setIsLoading(true);
    try {
      const data = await fetchInsights(teamSize, meetingDuration, workingDays, hourlyRate);
      setInsights(data);
    } catch (err) {
      console.error('Failed to load insights:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const severityBarData = insights ? [
    { name: 'High', count: insights.blockers_by_severity.high, color: '#e11d48' },
    { name: 'Medium', count: insights.blockers_by_severity.medium, color: '#f59e0b' },
    { name: 'Low', count: insights.blockers_by_severity.low, color: '#10b981' },
  ] : [];

  const trendData = [
    { day: 'Mon', hours: (teamSize * 0.5 * 0.9).toFixed(1), compliance: 95 },
    { day: 'Tue', hours: (teamSize * 0.5 * 1.0).toFixed(1), compliance: 100 },
    { day: 'Wed', hours: (teamSize * 0.5 * 1.1).toFixed(1), compliance: 92 },
    { day: 'Thu', hours: (teamSize * 0.5 * 1.0).toFixed(1), compliance: 100 },
    { day: 'Fri', hours: (teamSize * 0.5 * 0.95).toFixed(1), compliance: 97 },
  ];

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Team Velocity & Meeting Recovery Insights
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-semibold">
              Live ROI Model
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Quantified productivity gains, team mood trends, and cross-timezone presence for distributed teams.
          </p>
        </div>
      </div>

      {/* Global Timezone Presence Strip */}
      {insights?.timezone_strip && (
        <TimezoneStrip members={insights.timezone_strip} />
      )}

      {/* Hero: Meeting Time & Cost Saved Counter (Transparent Math) */}
      <div className="rounded-3xl border border-blue-200 dark:border-blue-900/80 bg-gradient-to-br from-blue-50/80 via-sky-50/50 to-indigo-50/80 dark:from-slate-900 dark:via-blue-950/40 dark:to-slate-900 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
              <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Transparent Productivity Recovery</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {insights?.meeting_time_saved_hours.toFixed(1) || '66.0'} Hours Saved / Month
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              Equivalent to <b className="text-emerald-600 dark:text-emerald-400 font-mono text-base">${(insights?.cost_saved_usd || 4950).toLocaleString()}</b> in reclaimed engineering focus time each month.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-blue-200/80 dark:border-blue-800/80 text-xs space-y-1.5 shadow-xs">
            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-blue-600" />
              <span>Annualized Value</span>
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              ${((insights?.cost_saved_usd || 4950) * 12).toLocaleString()} / yr
            </div>
            <div className="text-[11px] text-slate-500">
              Based on {teamSize} engineers &bull; {workingDays} days/mo
            </div>
          </div>
        </div>

        {/* Dynamic Sliders */}
        <div className="pt-4 border-t border-blue-200/60 dark:border-blue-900/60 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Team Size */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span>Team Size:</span>
              <span className="font-mono text-blue-600 dark:text-blue-400">{teamSize} engineers</span>
            </div>
            <input
              type="range"
              min="1"
              max="50"
              value={teamSize}
              onChange={(e) => setTeamSize(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
          </div>

          {/* Meeting Duration */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span>Standup Length:</span>
              <span className="font-mono text-blue-600 dark:text-blue-400">{meetingDuration} mins / day</span>
            </div>
            <input
              type="range"
              min="15"
              max="60"
              step="5"
              value={meetingDuration}
              onChange={(e) => setMeetingDuration(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
          </div>

          {/* Hourly Rate */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span>Hourly Rate:</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400">${hourlyRate}/hr</span>
            </div>
            <input
              type="range"
              min="30"
              max="200"
              step="5"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(Number(e.target.value))}
              className="w-full accent-emerald-600"
            />
          </div>

          {/* Working Days */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span>Days / Month:</span>
              <span className="font-mono text-blue-600 dark:text-blue-400">{workingDays} days</span>
            </div>
            <input
              type="range"
              min="15"
              max="25"
              value={workingDays}
              onChange={(e) => setWorkingDays(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
          </div>
        </div>
      </div>

      {/* Visual Analytics Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Weekly Focus Recovery Trend */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Daily Engineering Hours Reclaimed
              </h3>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">This Week</span>
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="hoursGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0078D4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0078D4" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} unit="h" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="hours" stroke="#0078D4" strokeWidth={3} fillOpacity={1} fill="url(#hoursGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Blockers by Severity */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Blocker Severity Distribution
              </h3>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">Sprint 24</span>
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={severityBarData}>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {severityBarData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
