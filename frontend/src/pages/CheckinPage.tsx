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
  AlertCircle
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!yesterday || !today) {
      alert("Please provide achievements for yesterday and goals for today.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitCheckin({
        yesterday,
        today,
        blockers_text: blockers,
        mood,
        pr_link: prLink,
        work_item_id: workItemId,
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
    { score: 5, emoji: '⚡', label: 'Peak Momentum' },
    { score: 4, emoji: '👍', label: 'Good Progress' },
    { score: 3, emoji: '😐', label: 'Steady / Neutral' },
    { score: 2, emoji: '🛑', label: 'Blocked / Stalled' },
    { score: 1, emoji: '🔥', label: 'Critical Impasse' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
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
            Fast, high-fidelity standup update. Citations are automatically verified against opted-in channels.
          </p>
        </div>

        {user && (
          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <img
              src={user.avatar_url || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150'}
              alt={user.full_name}
              className="w-8 h-8 rounded-full object-cover"
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

      {/* Confirmation State if just submitted */}
      {submittedCheckin && (
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/70 dark:bg-emerald-950/40 p-6 space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              <h3 className="font-bold text-base">Check-in Submitted & AI Analyzed!</h3>
            </div>
            <button
              onClick={() => {
                setSubmittedCheckin(null);
                setYesterday('');
                setToday('');
                setBlockers('');
              }}
              className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline"
            >
              Submit another check-in
            </button>
          </div>

          <p className="text-xs text-emerald-900 dark:text-emerald-200">
            Great job! Your update has been synthesized into the team standup digest. Streak is now at <b>{submittedCheckin.streak_count} days</b>.
          </p>

          {submittedCheckin.blockers && submittedCheckin.blockers.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800 space-y-3">
              <div className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                <span>AI Blocker Extraction & Verified Citations</span>
              </div>

              {submittedCheckin.blockers.map((b: any) => (
                <div key={b.id} className="space-y-2 text-xs">
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    &bull; {b.summary}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-slate-500">
                      Owner: {b.owner_name} &bull; Blocked by: {b.blocked_by}
                    </span>
                    {b.citations?.map((cit: any, cidx: number) => (
                      <CitationBadge key={cidx} citation={cit} size="sm" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Check-in Form */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 space-y-6">
        {/* Quick demo presets for judges */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-blue-50/60 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-900/60 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-blue-800 dark:text-blue-300">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span>Hackathon Judge Quick Fills:</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fillHeroScenario}
              className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 rounded font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 transition"
            >
              Fill Hero Scenario (PR #184 Blocker)
            </button>
            <button
              type="button"
              onClick={fillCleanScenario}
              className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition"
            >
              Fill On-Track Update
            </button>
          </div>
        </div>

        {/* 1. Yesterday */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>1. What did you accomplish yesterday?</span>
              <span className="text-rose-500">*</span>
            </label>
            <button
              type="button"
              onClick={() => toggleSpeech('yesterday')}
              className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition ${
                isListening && activeSpeechField === 'yesterday'
                  ? 'bg-rose-100 text-rose-700 animate-pulse'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Speak using browser Web Speech API"
            >
              {isListening && activeSpeechField === 'yesterday' ? (
                <>
                  <Mic className="w-3.5 h-3.5 text-rose-600" />
                  <span className="text-[11px] font-bold">Listening...</span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Voice input</span>
                </>
              )}
            </button>
          </div>
          <textarea
            value={yesterday}
            onChange={(e) => setYesterday(e.target.value)}
            placeholder="e.g., Completed OAuth frontend flow & token refresh handler. Validated JWT storage in session."
            rows={2}
            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            required
          />
        </div>

        {/* 2. Today */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>2. What is your primary focus today?</span>
              <span className="text-rose-500">*</span>
            </label>
            <button
              type="button"
              onClick={() => toggleSpeech('today')}
              className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition ${
                isListening && activeSpeechField === 'today'
                  ? 'bg-rose-100 text-rose-700 animate-pulse'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Speak using browser Web Speech API"
            >
              {isListening && activeSpeechField === 'today' ? (
                <>
                  <Mic className="w-3.5 h-3.5 text-rose-600" />
                  <span className="text-[11px] font-bold">Listening...</span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Voice input</span>
                </>
              )}
            </button>
          </div>
          <textarea
            value={today}
            onChange={(e) => setToday(e.target.value)}
            placeholder="e.g., Testing tenant login endpoints and writing Cypress integration test cases."
            rows={2}
            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            required
          />
        </div>

        {/* 3. Blockers */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>3. Any blockers or dependencies?</span>
              <span className="text-xs font-normal text-slate-500">(Type 'None' if on track)</span>
            </label>
            <button
              type="button"
              onClick={() => toggleSpeech('blockers')}
              className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition ${
                isListening && activeSpeechField === 'blockers'
                  ? 'bg-rose-100 text-rose-700 animate-pulse'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Speak using browser Web Speech API"
            >
              {isListening && activeSpeechField === 'blockers' ? (
                <>
                  <Mic className="w-3.5 h-3.5 text-rose-600" />
                  <span className="text-[11px] font-bold">Listening...</span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Voice input</span>
                </>
              )}
            </button>
          </div>
          <textarea
            value={blockers}
            onChange={(e) => setBlockers(e.target.value)}
            placeholder="e.g., PR #184 Auth API is blocked waiting for database migration script from the backend team."
            rows={2}
            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
          />
        </div>

        {/* 4. Mood & Energy Level */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-900 dark:text-white block">
            4. Energy & Mood Today
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {moodEmojis.map((item) => (
              <button
                key={item.score}
                type="button"
                onClick={() => setMood(item.score)}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                  mood === item.score
                    ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/80 ring-2 ring-blue-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <span className="text-2xl mb-1">{item.emoji}</span>
                <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">{item.label}</span>
                <span className="text-[10px] text-slate-400 font-mono">{item.score}/5</span>
              </button>
            ))}
          </div>
        </div>

        {/* 5. Optional PR or Work Item Key */}
        <div className="grid sm:grid-cols-2 gap-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Optional Pull Request Link
            </label>
            <input
              type="text"
              value={prLink}
              onChange={(e) => setPrLink(e.target.value)}
              placeholder="https://github.com/microsoft/SyncBrief/pull/184"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Optional Azure DevOps Work Item
            </label>
            <input
              type="text"
              value={workItemId}
              onChange={(e) => setWorkItemId(e.target.value)}
              placeholder="ADO-4820"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Submit Action Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {lastAutosave ? (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {lastAutosave}
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Save className="w-3.5 h-3.5" />
                Autosave active
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-md transition"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Extracting Blockers & Citations...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Submit 60-Second Check-in</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Standup History */}
      {pastCheckins.length > 0 && (
        <div className="space-y-4 pt-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" />
            <span>Recent Team Check-in Timeline</span>
          </h3>

          <div className="space-y-3">
            {pastCheckins.slice(0, 5).map((chk) => (
              <div key={chk.id} className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{chk.user_name}</span>
                    <span className="text-[11px] font-normal text-slate-400 font-mono">
                      {new Date(chk.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <span className="text-xs">
                    Mood: {'⭐'.repeat(chk.mood)}
                  </span>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 text-xs text-slate-600 dark:text-slate-300">
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Yesterday: </span>
                    {chk.yesterday}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Today: </span>
                    {chk.today}
                  </div>
                </div>

                {chk.blockers_text && chk.blockers_text.toLowerCase() !== 'none' && (
                  <div className="pt-1 text-xs text-rose-600 dark:text-rose-400 font-medium">
                    Blocker: {chk.blockers_text}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
