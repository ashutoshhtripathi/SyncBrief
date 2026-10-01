import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Mic, 
  MicOff, 
  Flame, 
  CheckCircle2, 
  Send, 
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
  Users,
  Target,
  ListTodo,
  TrendingUp,
  Percent,
  Zap,
  ThumbsUp,
  Minus,
  OctagonAlert,
  RotateCw
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import { 
  submitCheckin, 
  fetchCheckins, 
  fetchTasks, 
  fetchSprints, 
  fetchLastCheckinTask,
  fetchAllUsers
} from '../api';
import { Checkin, Task, Sprint, User as UserType } from '../types';
import { CitationBadge } from '../components/CitationBadge';

export const CheckinPage: React.FC = () => {
  const { user } = useAuth();
  
  // Guided form states
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [activeSprint, setActiveSprint] = useState<Sprint | null>(null);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [allSprintTasks, setAllSprintTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<UserType[]>([]);

  // Form inputs
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [customTaskTitle, setCustomTaskTitle] = useState('');
  const [progressPct, setProgressPct] = useState<number>(60);
  const [progressNote, setProgressNote] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [selectedSyncUsers, setSelectedSyncUsers] = useState<string[]>([]);
  const [blockers, setBlockers] = useState('');
  const [otherTaskIds, setOtherTaskIds] = useState<number[]>([]);
  const [mood, setMood] = useState<number>(4);
  const [prLink, setPrLink] = useState('');
  const [workItemId, setWorkItemId] = useState('');
  
  // Voice & autosave
  const [isListening, setIsListening] = useState(false);
  const [activeSpeechField, setActiveSpeechField] = useState<'progress' | 'next' | 'blockers' | null>(null);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [lastAutosave, setLastAutosave] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedCheckin, setSubmittedCheckin] = useState<Checkin | null>(null);
  const [pastCheckins, setPastCheckins] = useState<Checkin[]>([]);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);

  // Load initial data: sprints, tasks, teammates, last task pre-fill
  useEffect(() => {
    async function loadData() {
      setIsLoadingInitial(true);
      try {
        const [sprintsData, usersData] = await Promise.all([
          fetchSprints().catch(() => []),
          fetchAllUsers().catch(() => [])
        ]);

        setSprints(sprintsData);
        setTeamMembers(usersData.filter(u => u.id !== user?.id));

        const active = sprintsData.find(s => s.status === 'active') || sprintsData[0];
        setActiveSprint(active || null);

        if (active) {
          const tasksData = await fetchTasks({ sprint_id: active.id });
          setAllSprintTasks(tasksData);
          const mine = user ? tasksData.filter(t => t.assignee_id === user.id) : tasksData;
          setMyTasks(mine);
        }

        // Smart pre-fill: get yesterday's last task
        const lastTaskData = await fetchLastCheckinTask().catch(() => null);
        if (lastTaskData?.task_id) {
          setSelectedTaskId(lastTaskData.task_id);
          setProgressPct(Math.min(100, (lastTaskData.progress_pct || 0) + 15));
        }

        // Load past check-ins
        const checkins = await fetchCheckins().catch(() => []);
        setPastCheckins(checkins);
      } finally {
        setIsLoadingInitial(false);
      }
    }

    loadData();

    // Check Speech Recognition support
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setSpeechSupported(false);
    }
  }, [user?.id]);

  // Voice-to-text handler using Web Speech API
  const toggleSpeech = (field: 'progress' | 'next' | 'blockers') => {
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
      if (field === 'progress') setProgressNote(prev => (prev ? `${prev} ${transcript}` : transcript));
      if (field === 'next') setNextSteps(prev => (prev ? `${prev} ${transcript}` : transcript));
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

  const toggleSyncUser = (name: string) => {
    setSelectedSyncUsers(prev => 
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const toggleOtherTask = (taskId: number) => {
    setOtherTaskIds(prev => 
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  };

  // Hero scenario quick preset (PR #184 auth blocker with verified Teams citation)
  const fillHeroScenario = () => {
    const heroTask = allSprintTasks.find(t => t.title.toLowerCase().includes('jwt') || t.title.toLowerCase().includes('auth') || t.id === 1);
    if (heroTask) {
      setSelectedTaskId(heroTask.id);
    } else if (allSprintTasks.length > 0) {
      setSelectedTaskId(allSprintTasks[0].id);
    }
    setCustomTaskTitle("PR #184 Auth API & Token Refresh");
    setProgressPct(75);
    setProgressNote("Finished OAuth PKCE frontend exchange flow and session token storage. Cypress integration tests 80% passing.");
    setNextSteps("Deploy integration build once database migration 0042 is merged to staging.");
    setSelectedSyncUsers(["Vikram Joshi", "James Wilson"]);
    setBlockers("PR #184 Auth API is blocked waiting for database migration script from the backend team.");
    setMood(2);
    setPrLink("https://github.com/microsoft/SyncBrief/pull/184");
    setWorkItemId("ADO-4820");
  };

  const fillCleanScenario = () => {
    if (allSprintTasks.length > 1) {
      setSelectedTaskId(allSprintTasks[1].id);
    }
    setProgressPct(90);
    setProgressNote("Refactored responsive header navigation and verified WCAG contrast tokens. Added unit tests for navigation bar.");
    setNextSteps("Merge PR and start work on Sprint burndown analytics.");
    setSelectedSyncUsers(["Elena Rostova"]);
    setBlockers("None. On track for delivery this afternoon.");
    setMood(5);
    setPrLink("https://github.com/microsoft/SyncBrief/pull/186");
    setWorkItemId("ADO-4825");
  };

  const handleClear = () => {
    setSelectedTaskId(myTasks[0]?.id || null);
    setCustomTaskTitle('');
    setProgressPct(50);
    setProgressNote('');
    setNextSteps('');
    setSelectedSyncUsers([]);
    setBlockers('');
    setOtherTaskIds([]);
    setMood(4);
    setPrLink('');
    setWorkItemId('');
    setLastAutosave(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!progressNote.trim()) {
      alert("Please provide a brief note on how far you have reached.");
      return;
    }

    const currentTask = allSprintTasks.find(t => t.id === selectedTaskId);
    const chosenTitle = currentTask ? currentTask.title : (customTaskTitle || "General Sprint Execution");

    setIsSubmitting(true);
    try {
      const result = await submitCheckin({
        task_id: selectedTaskId,
        task_title: chosenTitle,
        progress_pct: progressPct,
        progress_note: progressNote.trim(),
        next_steps: nextSteps.trim(),
        sync_needed_with: selectedSyncUsers,
        other_task_ids: otherTaskIds,
        yesterday: `Worked on ${chosenTitle} (${progressPct}% complete). ${progressNote.trim()}`,
        today: nextSteps.trim() || `Continue progress on ${chosenTitle}`,
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
      setLastAutosave(null);

      // Refresh list
      fetchCheckins().then(setPastCheckins).catch(() => {});
    } catch (err: any) {
      alert(`Submission error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const moodOptions = [
    { score: 5, icon: Zap, label: 'Peak Momentum', color: 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' },
    { score: 4, icon: ThumbsUp, label: 'Good Progress', color: 'border-blue-400 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300' },
    { score: 3, icon: Minus, label: 'Steady / Neutral', color: 'border-slate-300 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300' },
    { score: 2, icon: OctagonAlert, label: 'Blocked / Stalled', color: 'border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300' },
    { score: 1, icon: Flame, label: 'Critical Impasse', color: 'border-rose-400 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              60-Second Task Check-in
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-semibold">
              {activeSprint ? activeSprint.name : "Active Sprint"}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Fast, structured async update linked directly to your sprint tasks. AI detects blockers and verifies chat citations.
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
            <AlertCircle className="w-3.5 h-3.5 text-blue-200" />
            <span>Load Hero Scenario (PR #184 Blocker)</span>
          </button>

          <button
            type="button"
            onClick={fillCleanScenario}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 shadow-xs transition"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
            <span>Load Clean Progress Update</span>
          </button>

          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Success Banner if just submitted */}
      {submittedCheckin && (
        <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 shadow-sm space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <h3 className="font-bold text-sm">Async Check-in Recorded for Today!</h3>
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  Logged for {submittedCheckin.task_title || "Sprint Task"} ({submittedCheckin.progress_pct || 100}% complete). Streak updated to {submittedCheckin.streak_count} days.
                </p>
              </div>
            </div>
            <span className="text-xs font-mono px-2 py-1 rounded bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
              {new Date(submittedCheckin.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* AI Blocker Result if detected */}
          {submittedCheckin.blockers && submittedCheckin.blockers.length > 0 ? (
            <div className="mt-3 p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-amber-300 dark:border-amber-900/60 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
                <AlertCircle className="w-4 h-4" />
                <span>AI Blocker Extracted with Verifiable Source Citation</span>
              </div>
              {submittedCheckin.blockers.map((b) => (
                <div key={b.id} className="text-xs space-y-1.5 text-slate-700 dark:text-slate-300">
                  <div className="font-semibold text-slate-900 dark:text-white">{b.summary}</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-semibold">
                      Severity: {b.severity.toUpperCase()}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Blocked by: <span className="font-semibold text-slate-700 dark:text-slate-200">{b.blocked_by}</span>
                    </span>
                    {b.citations && b.citations.map((c, i) => (
                      <CitationBadge key={i} citation={c} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 pt-1">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Zero blockers detected. Full speed ahead!</span>
            </div>
          )}
        </div>
      )}

      {/* Guided 6-Section Form */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-7">
        
        {/* Section A: Which Task are you working on? */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <Target className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>(A) Which Sprint Task are you working on?</span>
            </label>
            <span className="text-[11px] text-slate-400">Pre-filled with yesterday's active task</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <select
                value={selectedTaskId || ''}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  setSelectedTaskId(val);
                  const found = allSprintTasks.find(t => t.id === val);
                  if (found) {
                    setCustomTaskTitle(found.title);
                    setProgressPct(found.progress_pct || 50);
                  }
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-hidden"
              >
                <option value="">-- Choose My Sprint Task --</option>
                {allSprintTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.priority}] {t.title} ({t.difficulty} pts{t.carried_over_count > 0 ? `, carried ${t.carried_over_count}x` : ''})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <input
                type="text"
                value={customTaskTitle}
                onChange={(e) => setCustomTaskTitle(e.target.value)}
                placeholder="Or specify custom task title / PR summary..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Section B: How Far Have You Reached (Progress Slider + Note) */}
        <div className="space-y-3 p-4.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>(B) How far have you reached?</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                {progressPct}% Completed
              </span>
            </div>
          </div>

          {/* Interactive Progress Slider */}
          <div className="space-y-2">
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={progressPct}
              onChange={(e) => setProgressPct(Number(e.target.value))}
              className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-[11px] text-slate-400 font-mono">
              <button type="button" onClick={() => setProgressPct(10)} className="hover:text-blue-500">10% Started</button>
              <button type="button" onClick={() => setProgressPct(25)} className="hover:text-blue-500">25% Scaffold</button>
              <button type="button" onClick={() => setProgressPct(50)} className="hover:text-blue-500">50% Halfway</button>
              <button type="button" onClick={() => setProgressPct(75)} className="hover:text-blue-500">75% Testing</button>
              <button type="button" onClick={() => setProgressPct(100)} className="hover:text-blue-500">100% Done</button>
            </div>
          </div>

          {/* Short Note on Accomplishment */}
          <div className="relative pt-1">
            <textarea
              rows={2}
              value={progressNote}
              onChange={(e) => setProgressNote(e.target.value)}
              placeholder="Short note: What concrete work did you complete yesterday/today? (e.g. Auth endpoints validated, token refresh tested)"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
            {speechSupported && (
              <button
                type="button"
                onClick={() => toggleSpeech('progress')}
                className={`absolute right-3 bottom-3 p-1.5 rounded-lg text-xs transition ${
                  isListening && activeSpeechField === 'progress'
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white'
                }`}
                title="Voice input"
              >
                {isListening && activeSpeechField === 'progress' ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>

        {/* Section C: What is Next? */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <ChevronRight className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span>(C) What is next?</span>
            </label>
            <span className="text-[11px] text-slate-400">Immediate next steps / goals</span>
          </div>
          <div className="relative">
            <input
              type="text"
              value={nextSteps}
              onChange={(e) => setNextSteps(e.target.value)}
              placeholder="e.g. Write Cypress test suite and submit pull request for review"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
            {speechSupported && (
              <button
                type="button"
                onClick={() => toggleSpeech('next')}
                className={`absolute right-3 top-2.5 p-1 rounded-lg text-xs transition ${
                  isListening && activeSpeechField === 'next'
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white'
                }`}
                title="Voice input"
              >
                {isListening && activeSpeechField === 'next' ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>

        {/* Section D: Do you need to sync with anyone? (Teammate picker) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>(D) Do you need to sync with anyone?</span>
            </label>
            <span className="text-[11px] text-slate-400">Pick teammates you need quick alignment from</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {teamMembers.map((member) => {
              const isSelected = selectedSyncUsers.includes(member.full_name);
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => toggleSyncUser(member.full_name)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition border ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                  }`}
                >
                  <img
                    src={member.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'}
                    alt={member.full_name}
                    className="w-4 h-4 rounded-full object-cover"
                  />
                  <span>{member.full_name}</span>
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Section E: Any Blocker? (AI Blocker Detection with Verified Citation) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <span>(E) Any Blocker or Dependency?</span>
            </label>
            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
              AI checks opted-in channel evidence
            </span>
          </div>

          <div className="relative">
            <textarea
              rows={2}
              value={blockers}
              onChange={(e) => setBlockers(e.target.value)}
              placeholder="e.g. PR #184 Auth API is blocked waiting for database migration script from the backend team."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
            {speechSupported && (
              <button
                type="button"
                onClick={() => toggleSpeech('blockers')}
                className={`absolute right-3 bottom-3 p-1.5 rounded-lg text-xs transition ${
                  isListening && activeSpeechField === 'blockers'
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white'
                }`}
                title="Voice input"
              >
                {isListening && activeSpeechField === 'blockers' ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>

        {/* Section F: Other Tasks You Are Involved In */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <ListTodo className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>(F) Other sprint tasks you are supporting / reviewing:</span>
            </label>
            <span className="text-[11px] text-slate-400">Optional secondary tasks</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {allSprintTasks.filter(t => t.id !== selectedTaskId).slice(0, 6).map((t) => {
              const isSelected = otherTaskIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleOtherTask(t.id)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition ${
                    isSelected
                      ? 'bg-purple-100 dark:bg-purple-950/60 border-purple-400 text-purple-800 dark:text-purple-300 font-semibold'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-purple-300'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    {isSelected ? <Check className="w-3 h-3 text-purple-600 dark:text-purple-400" /> : <span className="text-slate-400">+</span>}
                    <span>{t.title.slice(0, 32)}...</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Team Vibe / Mood & Links Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Team Vibe / Energy Level
            </label>
            <div className="flex items-center gap-2">
              {moodOptions.map((m) => {
                const IconComp = m.icon;
                return (
                  <button
                    key={m.score}
                    type="button"
                    onClick={() => setMood(m.score)}
                    title={m.label}
                    className={`p-2.5 rounded-xl border flex items-center justify-center transition-all ${
                      mood === m.score
                        ? `${m.color} ring-2 ring-blue-500 scale-110 shadow-xs`
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 opacity-60 hover:opacity-100 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <IconComp className="w-4 h-4" />
                  </button>
                );
              })}
              <span className="text-xs text-slate-500 ml-2">
                {moodOptions.find(m => m.score === mood)?.label}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                GitHub / PR Link (Opt)
              </label>
              <input
                type="text"
                value={prLink}
                onChange={(e) => setPrLink(e.target.value)}
                placeholder="https://github.com/..."
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Azure Work Item ID
              </label>
              <input
                type="text"
                value={workItemId}
                onChange={(e) => setWorkItemId(e.target.value)}
                placeholder="e.g. ADO-4820"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-500" />
            <span>Target completion: &lt;60 seconds</span>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 via-sky-600 to-indigo-600 text-white font-bold text-sm shadow-md shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-700 transition disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing AI Citations...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Submit Guided Check-in</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
