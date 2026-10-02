import React, { useState } from 'react';
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
  MessageSquare,
  ExternalLink,
  Code,
  Check,
  PlayCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CitationBadge } from '../components/CitationBadge';
import { TodayDashboard } from '../components/TodayDashboard';

interface LandingPageProps {
  onOpenQuickAdd?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenQuickAdd = () => {} }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeMainTab, setActiveMainTab] = useState<'today' | 'showcase'>('today');
  const [activeStepTab, setActiveStepTab] = useState<'checkin' | 'extract' | 'verify' | 'devops'>('verify');

  return (
    <div className="space-y-6 pb-20">
      {/* View Switcher: Daily Operations vs Product Tour */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200/70 dark:border-slate-800/70">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
          <button
            onClick={() => setActiveMainTab('today')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold transition ${
              activeMainTab === 'today'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span>Today's Standup Hub</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
              {user?.role?.toUpperCase()}
            </span>
          </button>

          <button
            onClick={() => setActiveMainTab('showcase')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold transition ${
              activeMainTab === 'showcase'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <PlayCircle className="w-3.5 h-3.5 text-emerald-500" />
            <span>Product Tour &amp; Pipeline</span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
          <span>Shortcuts:</span>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border text-[10px] font-mono">C</kbd>
          <span>New Task</span>
          <span>&bull;</span>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border text-[10px] font-mono">⌘K</kbd>
          <span>Command Palette</span>
        </div>
      </div>

      {/* Render Today Dashboard or Product Tour */}
      {activeMainTab === 'today' ? (
        <TodayDashboard onOpenQuickAdd={onOpenQuickAdd} />
      ) : (
        <div className="space-y-16 animate-in fade-in">
          {/* Hero Section */}
          <section className="relative overflow-hidden pt-6 pb-12 text-center">
        {/* Ambient Gradient Glows */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-gradient-to-tr from-blue-500/15 via-sky-400/20 to-indigo-500/15 blur-3xl -z-10 rounded-full pointer-events-none" />

        <div className="max-w-4xl mx-auto px-4 space-y-6">
          {/* Hackathon Pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50/90 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold shadow-xs backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 animate-pulse" />
            <span>Official Submission &bull; Microsoft Innovate 2026 Hackathon</span>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-slate-950 dark:text-white tracking-tight leading-[1.12]">
            Async updates.{' '}
            <span className="bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-600 bg-clip-text text-transparent">
              Verifiable evidence.
            </span>{' '}
            Zero status meetings.
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
            Replaces synchronous daily standups for distributed engineering teams. 
            60-second updates are synthesized into executive digests, and{' '}
            <span className="font-semibold text-slate-900 dark:text-white underline decoration-emerald-500/60 decoration-2">
              every extracted blocker is strictly verified with clickable evidence links
            </span>{' '}
            to verbatim messages in Microsoft Teams.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-4">
            <button
              onClick={() => navigate('/digest')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-lg shadow-blue-600/25 hover:shadow-xl transition-all duration-150 transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>Explore Standup Digest</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => navigate('/checkin')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-sm shadow-xs transition transform hover:-translate-y-0.5"
            >
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Submit Check-in</span>
            </button>
          </div>

          {/* Trust Badges */}
          <div className="pt-4 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Enterprise Multi-Tenant &bull; Role-Based Access
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <ShieldCheck className="w-4 h-4 text-blue-500" /> Privacy First (Zero DM Scraping)
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <Clock className="w-4 h-4 text-purple-500" /> Reclaims 30 Mins / Engineer / Day
            </span>
          </div>
        </div>
      </section>

      {/* Hero Interactive Showcase: The 4-Stage Verification Engine */}
      <section className="max-w-5xl mx-auto px-4">
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
          {/* Top Window Bar */}
          <div className="bg-slate-50 dark:bg-slate-800/80 px-6 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-400" />
                <span className="w-3 h-3 rounded-full bg-amber-400" />
                <span className="w-3 h-3 rounded-full bg-emerald-400" />
              </div>
              <span className="text-xs font-mono font-medium text-slate-600 dark:text-slate-400 ml-2">
                SyncBrief AI &bull; Interactive Verification Pipeline
              </span>
            </div>

            {/* Interactive Step Switcher Tabs */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
              <button
                onClick={() => setActiveStepTab('checkin')}
                className={`px-2.5 py-1 rounded font-semibold transition ${
                  activeStepTab === 'checkin' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                1. Check-in
              </button>
              <button
                onClick={() => setActiveStepTab('extract')}
                className={`px-2.5 py-1 rounded font-semibold transition ${
                  activeStepTab === 'extract' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                2. Extraction
              </button>
              <button
                onClick={() => setActiveStepTab('verify')}
                className={`px-2.5 py-1 rounded font-semibold transition ${
                  activeStepTab === 'verify' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                3. Evidence Proof
              </button>
              <button
                onClick={() => setActiveStepTab('devops')}
                className={`px-2.5 py-1 rounded font-semibold transition ${
                  activeStepTab === 'devops' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                4. ADO Sync
              </button>
            </div>
          </div>

          {/* Interactive Step Content Area */}
          <div className="p-6 md:p-8">
            {activeStepTab === 'checkin' && (
              <div className="space-y-4 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    Step 1: 60-Second Async Check-in
                  </span>
                  <span className="text-xs text-slate-400 font-mono">Priya Sharma (Frontend Dev)</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3 text-xs sm:text-sm">
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white">Yesterday: </span>
                    <span className="text-slate-600 dark:text-slate-300">Completed OAuth frontend flow and token refresh handler. Validated JWT storage in session.</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white">Today: </span>
                    <span className="text-slate-600 dark:text-slate-300">Testing tenant login endpoints and writing Cypress integration test cases.</span>
                  </div>
                  <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60">
                    <span className="font-bold text-rose-700 dark:text-rose-400">Blockers: </span>
                    <span className="text-slate-800 dark:text-slate-200 font-medium">PR #184 Auth API is blocked waiting for database migration script from the backend team.</span>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => setActiveStepTab('extract')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <span>Next: See AI Blocker Extraction</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {activeStepTab === 'extract' && (
              <div className="space-y-4 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Bot className="w-4 h-4" />
                    Step 2: AI Blocker Extraction & Entity Resolution
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-semibold">
                    Structured Analysis
                  </span>
                </div>
                <div className="grid sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <div className="text-slate-400 font-medium uppercase text-[10px]">Identified Entity</div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">PR #184 (Auth API)</div>
                    <div className="text-slate-500 mt-1">Cross-team dependency</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <div className="text-slate-400 font-medium uppercase text-[10px]">Assigned Severity</div>
                    <div className="text-sm font-bold text-rose-600 dark:text-rose-400 mt-1">HIGH (Release Blocker)</div>
                    <div className="text-slate-500 mt-1">ETA delay impact: &gt;24h</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <div className="text-slate-400 font-medium uppercase text-[10px]">Blocking Team</div>
                    <div className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-1">Backend Core (#backend)</div>
                    <div className="text-slate-500 mt-1">Lead: Vikram Joshi</div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => setActiveStepTab('verify')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <span>Next: Verifiable Chat Citation</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {activeStepTab === 'verify' && (
              <div className="grid md:grid-cols-2 gap-6 items-center animate-in fade-in">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Step 3: Strictly Verified Chat Evidence Link
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white leading-snug">
                    PR #184 Auth API is blocked on database migration script
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Instead of a manager wondering if this is genuine or chasing people in Slack/Teams, SyncBrief automatically validates and attaches the exact verbatim proof:
                  </p>

                  {/* Verifiable Link Badge */}
                  <div className="pt-2">
                    <CitationBadge
                      citation={{
                        message_id: 'msg_492',
                        channel: '#backend',
                        author: 'Vikram Joshi',
                        quote: 'The v2.4 Auth schema migration script 0042_oauth_tenants.sql is currently blocked on the security audit review. ETA is tomorrow 4 PM.',
                        status: 'VERIFIED'
                      }}
                      size="md"
                    />
                  </div>
                </div>

                {/* Evidence Callout Box */}
                <div className="p-5 rounded-2xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/70 dark:bg-emerald-950/30 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      Teams Thread Evidence (#backend)
                    </span>
                    <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400">msg_492</span>
                  </div>

                  <p className="text-xs italic text-slate-700 dark:text-slate-200 leading-relaxed bg-white/70 dark:bg-slate-900/60 p-3 rounded-lg border border-emerald-200/60 dark:border-emerald-800/50">
                    "The v2.4 Auth schema migration script 0042_oauth_tenants.sql is currently blocked on the security audit review. ETA is tomorrow 4 PM. Do not merge PR #184 until this runs."
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                    <span>Author: Vikram Joshi (Lead Backend)</span>
                    <button
                      onClick={() => navigate('/channels?channel=backend&highlight=msg_492')}
                      className="text-emerald-700 dark:text-emerald-300 font-bold hover:underline flex items-center gap-1"
                    >
                      <span>Jump to Simulator</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeStepTab === 'devops' && (
              <div className="space-y-4 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Code className="w-4 h-4" />
                    Step 4: 1-Click Azure DevOps Work Item Sync
                  </span>
                  <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">ADO-4820</span>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 text-sky-300 font-mono text-xs overflow-x-auto space-y-2">
                  <div className="text-slate-400">// Automatic JSON-Patch Document pushed to Azure DevOps REST API:</div>
                  <pre>{`[
  { "op": "add", "path": "/fields/System.Title", "value": "[SyncBrief] PR #184 Auth API Blocked" },
  { "op": "add", "path": "/fields/System.Tags", "value": "SyncBrief; Blocker; High-Severity" },
  { "op": "add", "path": "/fields/Custom.Blocked", "value": true },
  { "op": "add", "path": "/fields/Custom.EvidenceCitation", "value": "Teams: #backend msg_492 (Vikram Joshi)" }
]`}</pre>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Eliminates duplicate manual bug logging between Standup & Sprint Boards.</span>
                  <button
                    onClick={() => navigate('/blockers')}
                    className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <span>View Kanban Board</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Key Feature Cards Grid */}
      <section className="max-w-6xl mx-auto px-4 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Designed for High-Velocity Engineering Teams
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
            Everything your team needs to stay aligned across timezones without losing focus time.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-lg transition-all space-y-3 group">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              60-Second Async Check-in
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Native speech-to-text, keyboard shortcuts, autosave, and streak tracking. Team members share achievements and goals before their morning coffee.
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-lg transition-all space-y-3 group">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Verifiable Evidence Citations
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Every identified blocker is validated against opted-in channels. Strict verbatim matching ensures zero hallucinations and provides direct 1-click proof.
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-lg transition-all space-y-3 group">
            <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Kanban className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Kanban + Azure DevOps Sync
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Drag-and-drop blocker board automatically creates Work Items tagged as Blocked with citation evidence attached, bridging standup with sprint boards.
            </p>
          </div>
        </div>
      </section>

      {/* Comparison Table: Old Standups vs SyncBrief AI */}
      <section className="max-w-4xl mx-auto px-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
          <div className="p-5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-base text-slate-900 dark:text-white text-center">
              Daily Standup: Old Way vs SyncBrief AI
            </h3>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs sm:text-sm">
            <div className="grid grid-cols-3 p-4 font-semibold text-slate-500 uppercase tracking-wider text-[11px]">
              <div>Dimension</div>
              <div className="text-rose-600 dark:text-rose-400">Traditional Zoom Standup</div>
              <div className="text-emerald-600 dark:text-emerald-400 font-bold">SyncBrief AI</div>
            </div>

            <div className="grid grid-cols-3 p-4 items-center">
              <div className="font-medium text-slate-900 dark:text-white">Time Spent / Engineer</div>
              <div className="text-slate-500">30–45 mins / morning</div>
              <div className="text-emerald-600 dark:text-emerald-400 font-bold">60 seconds async</div>
            </div>

            <div className="grid grid-cols-3 p-4 items-center bg-slate-50/50 dark:bg-slate-800/30">
              <div className="font-medium text-slate-900 dark:text-white">Cross-Timezone Fit</div>
              <div className="text-slate-500">Awkward 7 AM or 9 PM calls</div>
              <div className="text-emerald-600 dark:text-emerald-400 font-bold">Whenever you start your day</div>
            </div>

            <div className="grid grid-cols-3 p-4 items-center">
              <div className="font-medium text-slate-900 dark:text-white">Blocker Verification</div>
              <div className="text-slate-500">Vague verbal claims & guessing</div>
              <div className="text-emerald-600 dark:text-emerald-400 font-bold">Strict verbatim chat citations</div>
            </div>

            <div className="grid grid-cols-3 p-4 items-center bg-slate-50/50 dark:bg-slate-800/30">
              <div className="font-medium text-slate-900 dark:text-white">Executive Visibility</div>
              <div className="text-slate-500">Scattered notes in Slack</div>
              <div className="text-emerald-600 dark:text-emerald-400 font-bold">Automated daily digest & ADO sync</div>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="max-w-4xl mx-auto px-4 text-center">
        <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-tr from-blue-700 via-sky-600 to-indigo-700 text-white shadow-xl space-y-5">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Ready to end synchronous status meetings?
          </h2>
          <p className="text-sm text-sky-100 max-w-lg mx-auto">
            Experience the complete Microsoft Innovate 2026 hackathon demo live in your browser right now.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => navigate('/digest')}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white text-blue-700 font-bold text-sm shadow hover:bg-sky-50 transition"
            >
              Explore Daily Digest
            </button>
            <button
              onClick={() => navigate('/checkin')}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-800/60 hover:bg-blue-800 text-white border border-white/20 font-bold text-sm transition"
            >
              Submit Daily Check-in
            </button>
          </div>
        </div>
      </section>
        </div>
      )}
    </div>
  );
};
