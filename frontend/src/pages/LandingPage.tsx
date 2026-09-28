import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, 
  ShieldCheck, 
  Clock, 
  ArrowRight, 
  CheckCircle2, 
  FileText, 
  Bot, 
  Kanban,
  Users,
  Zap,
  TrendingUp,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { loginAs, user } = useAuth();

  const handleTryDemo = async (role: 'manager' | 'member' = 'manager') => {
    await loginAs(role);
    navigate(role === 'manager' ? '/digest' : '/checkin');
  };

  return (
    <div className="space-y-16 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24 text-center">
        {/* Background gradient decorative glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-blue-500/20 via-sky-400/20 to-purple-500/20 blur-3xl -z-10 rounded-full pointer-events-none" />

        <div className="max-w-4xl mx-auto px-4 space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-semibold shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span>Microsoft Innovate 2026 Hackathon Finalist</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-slate-950 dark:text-white tracking-tight leading-[1.15]">
            Async updates. <span className="bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-600 bg-clip-text text-transparent">Verifiable evidence.</span> Zero status meetings.
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
            SyncBrief AI replaces synchronous daily standups for distributed engineering teams. 
            60-second updates are synthesized into executive digests, and 
            <span className="font-semibold text-slate-900 dark:text-white"> every single blocker is cited to exact source chat messages</span> so managers verify instead of chasing people.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-4">
            <button
              onClick={() => handleTryDemo('manager')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md hover:shadow-xl transition-all duration-150 transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>Try Live Demo as Manager</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => handleTryDemo('member')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-sm shadow-xs transition"
            >
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Submit 60s Check-in as Member</span>
            </button>
          </div>

          <div className="pt-3 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-4">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> No signup required
            </span>
            <span>&bull;</span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-500" /> Privacy-First (Opted-in channels only)
            </span>
            <span>&bull;</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-purple-500" /> Saves 30 mins / engineer / day
            </span>
          </div>
        </div>
      </section>

      {/* Hero Scenario Preview Card */}
      <section className="max-w-5xl mx-auto px-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
          <div className="bg-slate-50 dark:bg-slate-800/80 px-6 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-400" />
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
              <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 ml-2">
                SyncBrief AI &bull; Verifiable Evidence Engine
              </span>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
              Hero Scenario Active
            </span>
          </div>

          <div className="p-6 md:p-8 grid md:grid-cols-2 gap-6 items-center">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                Detected Blocker
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white leading-snug">
                PR #184 Auth API is blocked waiting for database migration script from the backend team
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Priya reported this in her async standup update. Instead of manager guessing whether this is real or waiting until tomorrow's meeting, SyncBrief automatically links the exact chat proof:
              </p>

              {/* Verified Citation Box */}
              <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-950/30 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Verified Evidence Link
                  </span>
                  <span className="font-mono text-slate-500 text-[11px]">#backend &bull; msg_492</span>
                </div>
                <p className="text-xs italic text-slate-700 dark:text-slate-200">
                  "The v2.4 Auth schema migration script 0042_oauth_tenants.sql is currently blocked on the security audit review. ETA is tomorrow 4 PM. Do not merge PR #184 until this runs."
                </p>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  Author: Vikram Joshi (Lead Backend) &bull; Proof validated verbatim against database
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-5 border border-slate-200 dark:border-slate-700/80 space-y-4">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Bot className="w-4 h-4 text-blue-500" />
                <span>SyncBrief AI Unblocking Pipeline</span>
              </h4>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700">
                  <span className="text-slate-500">Standup Update</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">60-second async check-in</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700">
                  <span className="text-slate-500">Strict Validator</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">Verbatim substring check passed</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700">
                  <span className="text-slate-500">Azure DevOps Sync</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">Blocked=Yes work item ADO-4820</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700">
                  <span className="text-slate-500">Microsoft Teams</span>
                  <span className="font-semibold text-purple-600 dark:text-purple-400">Adaptive Card broadcast ready</span>
                </div>
              </div>

              <button
                onClick={() => navigate('/channels?channel=backend&highlight=msg_492')}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition"
              >
                Inspect Live Message in Teams Simulator &rarr;
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="max-w-5xl mx-auto px-4 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Engineered for Modern Microsoft Ecosystems
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
            Everything your team needs to eliminate status meetings while gaining 10x higher transparency.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">60s Check-in + Voice</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Browser Web Speech API enables engineers to speak their updates on mobile or desktop. Autosaves drafts locally.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Verifiable Citations</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Strict substring verification ensures zero AI hallucination. Unverified references are rejected and flagged.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Executive Daily Digest</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Synthesizes achievements, blockers, cross-timezone risks, and missing check-ins. Export to Markdown or PDF.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Kanban className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Blocker Board + ADO</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Drag-and-drop Kanban board with direct Azure DevOps REST API integration to create flagged Work Items.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Meeting Savings Calculator</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Transparent, editable math showing engineering hours and dollar savings recovered from status meetings.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Privacy First & Audit Trail</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Zero DM scraping. Only opted-in channels are read. Full explainability audit trail storing model and prompt version.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
