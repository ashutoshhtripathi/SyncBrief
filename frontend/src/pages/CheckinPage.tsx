import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Mic, 
  MicOff, 
  Flame, 
  CheckCircle2, 
  Send, 
  Save, 
  Clock, 
  ExternalLink,
  Loader2,
  AlertCircle,
  HelpCircle,
  RotateCcw,
  Check,
  ShieldCheck,
  ChevronRight,
  GitPullRequest,
  Bookmark
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import { submitCheckin, fetchCheckins } from '../api';
import { Checkin } from '../types';
import { CitationBadge } from '../components/CitationBadge';

export const CheckinPage: React.FC = () => {
  const { user } = useAuth();
  const [yesterday, setYesterday] = useState('');
  const [today, setToday] = useState('');
  const [blockers, setBlockers] = useState('');
  const [mood, setMood] = useState<number>(4);
  const [prLink, setPrLink] = useState('');
  const [workItemId, setWorkItemId] = useState('');
  
  const [isListening, setIsListening] = useState(false);
  const [activeSpeechField, setActiveSpeechField] = useState<'yesterday' | 'today' | 'blockers' | null>(null);
  const [speechSupported, setSpeechSupported] = useState(true);

  const [lastAutosave, setLastAutosave] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedCheckin, setSubmittedCheckin] = useState<Checkin | null>(null);
  const [pastCheckins, setPastCheckins] = useState<Checkin[]>([]);

  // 1. Load draft from localStorage on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem('syncbrief_checkin_draft');
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        setYesterday(parsed.yesterday || '');
        setToday(parsed.today || '');
        setBlockers(parsed.blockers || '');
        setMood(parsed.mood || 4);
        setPrLink(parsed.prLink || '');
        setWorkItemId(parsed.workItemId || '');
        setLastAutosave('Restored draft from session');
      } catch (e) {}
    }

    // Check Speech Recognition support
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setSpeechSupported(false);
    }

    // Load past check-ins
    fetchCheckins().then(setPastCheckins).catch(() => {});
  }, []);

  // 2. Autosave draft on change
  useEffect(() => {
    if (!yesterday && !today && !blockers) return;
    const timer = setTimeout(() => {
      const draft = { yesterday, today, blockers, mood, prLink, workItemId };
      localStorage.setItem('syncbrief_checkin_draft', JSON.stringify(draft));
      const now = new Date();
      setLastAutosave(`Draft autosaved at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`);
    }, 800);
    return () => clearTimeout(timer);
  }, [yesterday, today, blockers, mood, prLink, workItemId]);

  // Voice-to-text handler using Web Speech API
  const toggleSpeech = (field: 'yesterday' | 'today' | 'blockers') => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert("Web Speech API is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    if (isListening && activeSpeechField === field) {
      setIsListening(false);
      setActiveSpeechField(null);
      return;
    }

    const recognition = new SpeechRec();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setActiveSpeechField(field);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (field === 'yesterday') setYesterday(prev => (prev ? `${prev} ${transcript}` : transcript));
      if (field === 'today') setToday(prev => (prev ? `${prev} ${transcript}` : transcript));
      if (field === 'blockers') setBlockers(prev => (prev ? `${prev} ${transcript}` : transcript));
    };

    recognition.onerror = () => {
      setIsListening(false);
      setActiveSpeechField(null);
    };

    recognition.onend = () => {
      setIsListening(false);
      setActiveSpeechField(null);
    };

    recognition.start();
  };

  const fillHeroScenario = () => {
    setYesterday("Completed OAuth frontend flow and token refresh handler. Validated JWT storage in session.");
    setToday("Testing tenant login endpoints and writing Cypress integration test cases.");
    setBlockers("PR #184 Auth API is blocked waiting for database migration script from the backend team.");
    setMood(2);
    setPrLink("https://github.com/microsoft/SyncBrief/pull/184");
    setWorkItemId("ADO-4820");
  };

  const fillCleanScenario = () => {
    setYesterday("Refactored responsive header navigation and verified WCAG contrast tokens.");
    setToday("Implementing Azure DevOps work item sync modal.");
    setBlockers("None");
    setMood(5);
    setPrLink("https://github.com/microsoft/SyncBrief/pull/186");
    setWorkItemId("ADO-4825");
  };

  const handleClear = () => {
    setYesterday('');
    setToday('');
    setBlockers('');
    setMood(4);
    setPrLink('');
    setWorkItemId('');
    localStorage.removeItem('syncbrief_checkin_draft');
    setLastAutosave(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!yesterday.trim() || !today.trim()) {
      alert("Please provide achievements for yesterday and goals for today.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitCheckin({
        yesterday: yesterday.trim(),
        today: today.trim(),
        blockers_text: blockers.trim(),
        mood,
        pr_link: prLink.trim(),
        work_item_id: workItemId.trim(),
        status: 'submitted',
      });

      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
      });

      setSubmittedCheckin(result);
      localStorage.removeItem('syncbrief_checkin_draft');
      setLastAutosave(null);

      // Refresh list
      fetchCheckins().then(setPastCheckins).catch(() => {});
    } catch (err: any) {
      alert(`Submission error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const moodEmojis = [
    { score: 5, emoji: '⚡', label: 'Peak Momentum', color: 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' },
    { score: 4, emoji: '👍', label: 'Good Progress', color: 'border-blue-400 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300' },
    { score: 3, emoji: '😐', label: 'Steady / Neutral', color: 'border-slate-300 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300' },
    { score: 2, emoji: '🛑', label: 'Blocked / Stalled', color: 'border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300' },
    { score: 1, emoji: '🔥', label: 'Critical Impasse', color: 'border-rose-400 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              60-Second Async Check-in
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-semibold">
              Today's Standup
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Async standup update. Blockers are automatically extracted and verified against opted-in team channels.
          </p>
        </div>

        {user && (
          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <img
              src={user.avatar_url || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150'}
              alt={user.full_name}
              className="w-9 h-9 rounded-full object-cover ring-2 ring-blue-500/20"
            />
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">{user.full_name}</div>
              <div className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                <Flame className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                <span>{user.streak_count} Day Standup Streak!</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Scenario Fill Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-3.5 bg-blue-50/70 dark:bg-blue-950/40 rounded-2xl border border-blue-200/80 dark:border-blue-900/60 text-xs">
        <div className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
          <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="font-semibold">Quick Demo Presets:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={fillHeroScenario}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 shadow-xs transition"
          >
            <span>⚡ Priya's Blocker Scenario (Hero PR #184)</span>
          </button>
          <button
            type="button"
            onClick={fillCleanScenario}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-50 transition"
          >
            <span>✅ Clean Progress (All Clear)</span>
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
            title="Reset Form"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Confirmation State if just submitted */}
      {submittedCheckin && (
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/70 dark:bg-emerald-950/40 p-6 space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <h3 className="font-bold text-base">Check-in Submitted & AI Analyzed!</h3>
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  Great job! Your standup update has been synthesized into the team digest. Streak is at <b>{submittedCheckin.streak_count} days</b>.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setSubmittedCheckin(null);
                setYesterday('');
                setToday('');
                setBlockers('');
              }}
              className="text-xs font-semibold px-3 py-1.5 bg-emerald-600 text-white rounded-lg shadow-xs hover:bg-emerald-700 transition"
            >
              Submit Another
            </button>
          </div>

          {submittedCheckin.blockers && submittedCheckin.blockers.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800/80 space-y-3">
              <div className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                <span>AI Blocker Extraction & Verified Citations</span>
              </div>

              {submittedCheckin.blockers.map((b, idx) => (
                <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white">{b.summary}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 uppercase">
                      {b.severity}
                    </span>
                  </div>

                  {b.citations && b.citations.length > 0 && (
                    <div className="pt-1 flex flex-wrap items-center gap-2">
                      {b.citations.map((c, cidx) => (
                        <CitationBadge key={cidx} citation={c} size="sm" />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Check-in Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Yesterday */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold">1</span>
              <span>What did you accomplish yesterday?</span>
              <span className="text-rose-500">*</span>
            </label>

            <button
              type="button"
              onClick={() => toggleSpeech('yesterday')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                isListening && activeSpeechField === 'yesterday'
                  ? 'bg-rose-100 text-rose-700 animate-pulse border border-rose-300'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800'
              }`}
              title="Speak your update (Web Speech API)"
            >
              {isListening && activeSpeechField === 'yesterday' ? (
                <>
                  <MicOff className="w-3.5 h-3.5" />
                  <span>Recording...</span>
                  <span className="flex items-center gap-0.5 ml-1">
                    <span className="wave-bar" />
                    <span className="wave-bar" />
                    <span className="wave-bar" />
                  </span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5 text-blue-500" />
                  <span>Voice input</span>
                </>
              )}
            </button>
          </div>

          <textarea
            value={yesterday}
            onChange={(e) => setYesterday(e.target.value)}
            rows={3}
            placeholder="e.g. Completed OAuth frontend flow, fixed auth token expiration bug in session..."
            required
            className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-slate-900 dark:text-slate-100 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 outline-hidden transition"
          />
        </div>

        {/* Step 2: Today */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold">2</span>
              <span>What is your primary focus today?</span>
              <span className="text-rose-500">*</span>
            </label>

            <button
              type="button"
              onClick={() => toggleSpeech('today')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                isListening && activeSpeechField === 'today'
                  ? 'bg-rose-100 text-rose-700 animate-pulse border border-rose-300'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800'
              }`}
            >
              {isListening && activeSpeechField === 'today' ? (
                <>
                  <MicOff className="w-3.5 h-3.5" />
                  <span>Recording...</span>
                  <span className="flex items-center gap-0.5 ml-1">
                    <span className="wave-bar" />
                    <span className="wave-bar" />
                    <span className="wave-bar" />
                  </span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5 text-blue-500" />
                  <span>Voice input</span>
                </>
              )}
            </button>
          </div>

          <textarea
            value={today}
            onChange={(e) => setToday(e.target.value)}
            rows={3}
            placeholder="e.g. Testing tenant login endpoints and writing Cypress integration test cases..."
            required
            className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-slate-900 dark:text-slate-100 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 outline-hidden transition"
          />
        </div>

        {/* Step 3: Blockers & Dependencies (With AI Citation Hint) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold">3</span>
                <span>Any blockers or cross-team dependencies?</span>
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Mention PRs, teams, or channels. SyncBrief AI will automatically search opted-in channels for verified proof.
              </p>
            </div>

            <button
              type="button"
              onClick={() => toggleSpeech('blockers')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                isListening && activeSpeechField === 'blockers'
                  ? 'bg-rose-100 text-rose-700 animate-pulse border border-rose-300'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800'
              }`}
            >
              {isListening && activeSpeechField === 'blockers' ? (
                <>
                  <MicOff className="w-3.5 h-3.5" />
                  <span>Recording...</span>
                  <span className="flex items-center gap-0.5 ml-1">
                    <span className="wave-bar" />
                    <span className="wave-bar" />
                    <span className="wave-bar" />
                  </span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5 text-blue-500" />
                  <span>Voice input</span>
                </>
              )}
            </button>
          </div>

          <textarea
            value={blockers}
            onChange={(e) => setBlockers(e.target.value)}
            rows={2}
            placeholder="e.g. PR #184 Auth API is blocked waiting for database migration script from backend team (or leave empty if unblocked)"
            className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-slate-900 dark:text-slate-100 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 outline-hidden transition"
          />

          {blockers.trim() && (
            <div className="flex items-center gap-2 p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900/60 text-xs text-blue-700 dark:text-blue-300">
              <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>AI Citation Validator is ready to match verbatim evidence upon submission.</span>
            </div>
          )}
        </div>

        {/* Step 4: Momentum / Mood Indicator */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <label className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold">4</span>
            <span>How is your momentum / confidence today?</span>
          </label>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
            {moodEmojis.map((item) => (
              <button
                key={item.score}
                type="button"
                onClick={() => setMood(item.score)}
                className={`flex flex-col items-center p-3 rounded-xl border text-center transition-all ${
                  mood === item.score
                    ? `${item.color} shadow-sm ring-2 ring-blue-500/20 scale-102`
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                }`}
              >
                <span className="text-2xl mb-1">{item.emoji}</span>
                <span className="text-xs font-bold">{item.label}</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Score: {item.score}/5</span>
              </button>
            ))}
          </div>
        </div>

        {/* Step 5: Optional Links (PR & Azure DevOps) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Bookmark className="w-3.5 h-3.5" />
            <span>Optional Work Item & PR Attachment (Azure DevOps / GitHub)</span>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                Pull Request URL:
              </label>
              <div className="relative">
                <GitPullRequest className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="url"
                  value={prLink}
                  onChange={(e) => setPrLink(e.target.value)}
                  placeholder="https://github.com/microsoft/SyncBrief/pull/184"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                Azure DevOps Work Item ID:
              </label>
              <input
                type="text"
                value={workItemId}
                onChange={(e) => setWorkItemId(e.target.value)}
                placeholder="e.g. ADO-4820"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-hidden font-mono"
              />
            </div>
          </div>
        </div>

        {/* Autosave and Submit Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            {lastAutosave && (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>{lastAutosave}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/25 hover:shadow-xl transition-all duration-150 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Synthesizing Update...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit 60s Check-in</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Recent Check-ins History */}
      {pastCheckins.length > 0 && (
        <div className="pt-8 border-t border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Recent Team Standup Updates
            </h3>
            <span className="text-xs text-slate-500">{pastCheckins.length} submissions</span>
          </div>

          <div className="space-y-3">
            {pastCheckins.slice(0, 5).map((chk) => (
              <div
                key={chk.id}
                className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white">{chk.user_name}</span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      {chk.created_at ? new Date(chk.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Today'}
                    </span>
                  </div>
                  <span className="text-xs">Mood: {'⭐'.repeat(chk.mood)}</span>
                </div>

                <div className="text-slate-600 dark:text-slate-300 space-y-1">
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Done: </span>
                    {chk.yesterday}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Focus: </span>
                    {chk.today}
                  </div>
                  {chk.blockers_text && (
                    <div className="text-rose-600 dark:text-rose-400">
                      <span className="font-semibold">Blocker: </span>
                      {chk.blockers_text}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
