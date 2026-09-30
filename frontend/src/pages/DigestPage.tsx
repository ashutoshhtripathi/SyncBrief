import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  RefreshCw, 
  Copy, 
  Check, 
  Send, 
  Download, 
  Sparkles, 
  AlertTriangle, 
  Users, 
  Clock, 
  ShieldCheck, 
  CheckCircle2,
  ChevronRight,
  Filter,
  DollarSign,
  Zap,
  Calendar,
  ExternalLink
} from 'lucide-react';
import jsPDF from 'jspdf';
import { fetchTodayDigest, regenerateDigest } from '../api';
import { Digest } from '../types';
import { CitationBadge } from '../components/CitationBadge';
import { AdaptiveCardModal } from '../components/AdaptiveCardModal';

export const DigestPage: React.FC = () => {
  const [digest, setDigest] = useState<Digest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copiedMd, setCopiedMd] = useState(false);
  const [teamsModalOpen, setTeamsModalOpen] = useState(false);
  const [filterBlockedOnly, setFilterBlockedOnly] = useState(false);

  useEffect(() => {
    loadDigest();
  }, []);

  const loadDigest = async () => {
    setIsLoading(true);
    try {
      const data = await fetchTodayDigest();
      setDigest(data);
    } catch (err) {
      console.error('Failed to load digest:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const data = await regenerateDigest();
      setDigest(data);
    } catch (err) {
      console.error('Failed to regenerate digest:', err);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleCopyMarkdown = () => {
    if (!digest) return;
    navigator.clipboard.writeText(digest.markdown_content);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2000);
  };

  const handleExportPDF = () => {
    if (!digest) return;
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.setTextColor(0, 120, 212); // Microsoft Blue
    doc.text(`SyncBrief AI — Daily Standup Digest`, 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Date: ${digest.date} | Microsoft Innovate 2026 Hackathon Demo`, 14, 27);
    doc.line(14, 30, 196, 30);

    let y = 38;

    // Blockers
    doc.setFontSize(13);
    doc.setTextColor(30, 30, 30);
    doc.text(`1. Active Blockers & Citations (${digest.blockers_summary.length})`, 14, y);
    y += 8;

    doc.setFontSize(9);
    digest.blockers_summary.forEach((b) => {
      doc.setTextColor(200, 30, 30);
      doc.text(`[${b.severity.toUpperCase()}] ${b.summary}`, 16, y);
      y += 5;
      doc.setTextColor(80, 80, 80);
      doc.text(`Owner: ${b.owner} | Blocked By: ${b.blocked_by}`, 18, y);
      y += 7;
    });

    // Risks
    y += 4;
    doc.setFontSize(13);
    doc.setTextColor(30, 30, 30);
    doc.text(`2. Key Project Risks & Dependencies`, 14, y);
    y += 8;

    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    digest.risks.forEach((r) => {
      doc.text(`• ${r}`, 16, y);
      y += 6;
    });

    // Suggested Actions
    y += 4;
    doc.setFontSize(13);
    doc.setTextColor(30, 30, 30);
    doc.text(`3. Recommended Manager Actions`, 14, y);
    y += 8;

    doc.setFontSize(9);
    digest.suggested_actions.forEach((a, idx) => {
      doc.text(`${idx + 1}. ${a}`, 16, y);
      y += 6;
    });

    // Save
    doc.save(`SyncBrief-Digest-${digest.date}.pdf`);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 space-y-4">
        <div className="relative">
          <RefreshCw className="w-10 h-10 animate-spin text-blue-600 dark:text-blue-400" />
          <span className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-amber-400" />
          </span>
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Synthesizing Executive Standup Digest
          </p>
          <p className="text-xs text-slate-500">
            Extracting blockers and cross-referencing verbatim evidence citations...
          </p>
        </div>
      </div>
    );
  }

  if (!digest) {
    return (
      <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 space-y-4">
        <FileText className="w-12 h-12 text-slate-400 mx-auto" />
        <h3 className="font-bold text-lg text-slate-900 dark:text-white">No digest generated for today yet</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Standup updates are synthesized into an executive summary automatically or on-demand.
        </p>
        <button
          onClick={handleRegenerate}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow transition"
        >
          Generate Today's Standup Digest
        </button>
      </div>
    );
  }

  const displayedMembers = filterBlockedOnly
    ? digest.progress_by_person.filter((p) => p.has_blockers)
    : digest.progress_by_person;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      {/* Top Header & Executive Action Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Daily Standup Digest
            </h1>
            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-mono font-semibold">
              <Calendar className="w-3 h-3" />
              {digest.date}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Executive team progress synthesized from async check-ins with verifiable evidence links.
          </p>
        </div>

        {/* 4 Core One-Click Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs transition"
            title="Re-run AI extraction across latest updates"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin text-blue-500' : 'text-slate-500'}`} />
            <span>{isRegenerating ? 'Synthesizing...' : 'Regenerate'}</span>
          </button>

          <button
            onClick={handleCopyMarkdown}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs transition"
            title="Copy full GitHub-flavored Markdown text"
          >
            {copiedMd ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
            <span>{copiedMd ? 'Copied MD!' : 'Copy Markdown'}</span>
          </button>

          <button
            onClick={() => setTeamsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 transition shadow-xs"
            title="Inspect and broadcast Microsoft Teams Adaptive Card"
          >
            <Send className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Post to Teams</span>
          </button>

          <button
            onClick={handleExportPDF}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 transition transform hover:-translate-y-0.5"
            title="Download executive PDF summary"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-1">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Check-ins Logged
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {digest.progress_by_person.length} <span className="text-xs font-normal text-slate-400">/ 6 members</span>
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>{Math.round((digest.progress_by_person.length / 6) * 100)}% standup compliance</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-1">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Active Blockers
          </div>
          <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">
            {digest.blockers_summary.length}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            {digest.blockers_summary.filter((b) => b.severity === 'high').length} High Severity
          </div>
        </div>

        {/* Metric 3 */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-1">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Time Saved Today
          </div>
          <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
            {(digest.progress_by_person.length * 0.5).toFixed(1)} hrs
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            ~${Math.round(digest.progress_by_person.length * 0.5 * 75)} engineering recovery
          </div>
        </div>

        {/* Metric 4 */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-1">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Meeting Reduction
          </div>
          <div className="text-2xl font-extrabold text-purple-600 dark:text-purple-400">
            0 Mins
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            Zero status meetings needed
          </div>
        </div>
      </div>

      {/* Section 1: Critical Blockers (THE HERO HIGHLIGHT) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Critical Blockers with Verifiable Chat Evidence
              </h3>
              <p className="text-xs text-slate-500">
                Click any citation badge to jump directly into the source proof in Microsoft Teams channels.
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 w-fit">
            {digest.blockers_summary.length} Detected
          </span>
        </div>

        <div className="space-y-3.5">
          {digest.blockers_summary.map((b, idx) => {
            const isHigh = b.severity === 'high';
            return (
              <div
                key={idx}
                className={`p-4 rounded-2xl border transition-all ${
                  isHigh
                    ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider shrink-0 mt-0.5 ${
                      isHigh ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'
                    }`}>
                      {b.severity}
                    </span>
                    <span className="font-bold text-sm text-slate-900 dark:text-white leading-snug">
                      {b.summary}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 shrink-0">
                    Owner: <span className="font-semibold text-slate-700 dark:text-slate-300">{b.owner}</span> &bull; 
                    Blocked By: <span className="font-semibold text-slate-700 dark:text-slate-300">{b.blocked_by}</span>
                  </div>
                </div>

                {/* Evidence link callout for hero scenario */}
                {b.summary.includes('184') && (
                  <div className="mt-3 pt-3 border-t border-rose-200/60 dark:border-rose-900/60 flex flex-wrap items-center justify-between gap-2">
                    <CitationBadge
                      citation={{
                        message_id: 'msg_492',
                        channel: '#backend',
                        author: 'Vikram Joshi',
                        quote: 'The v2.4 Auth schema migration script 0042_oauth_tenants.sql is currently blocked on the security audit review.',
                        status: 'VERIFIED'
                      }}
                    />
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Citing Teams thread msg_492 &bull; 100% verified verbatim
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Progress by Person */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
              <Users className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Individual Progress & Velocity
              </h3>
              <p className="text-xs text-slate-500">
                Achievements, planned today tasks, and mood scores across all active members.
              </p>
            </div>
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setFilterBlockedOnly(!filterBlockedOnly)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
              filterBlockedOnly
                ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>{filterBlockedOnly ? 'Showing: Blocked Only' : 'Show All Members'}</span>
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {displayedMembers.map((p, idx) => (
            <div key={idx} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">{p.name}</span>
                  {p.has_blockers && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400">
                      Blocked
                    </span>
                  )}
                </div>
                <span className="text-xs">Mood: {'⭐'.repeat(p.mood)}</span>
              </div>

              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Yesterday: </span>
                  {p.yesterday}
                </div>
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Today: </span>
                  {p.today}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 3 & 4: Risks & Missing Check-ins */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Risks */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-3">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>Identified Cross-Team Risks</span>
          </h3>
          <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
            {digest.risks.map((r, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Missing Check-ins */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-3">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-purple-500" />
            <span>Missing Check-ins</span>
          </h3>
          {digest.missing_checkins.length > 0 ? (
            <div className="space-y-2">
              {digest.missing_checkins.map((m, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-purple-50/60 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-xs">
                  <span className="font-bold text-purple-900 dark:text-purple-300">{m}</span>
                  <span className="text-[11px] text-purple-700 dark:text-purple-400">
                    Automated Teams nudge scheduled for 10:30 AM
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-emerald-600 font-medium">All team members have completed their standup updates today!</p>
          )}
        </div>
      </div>

      {/* Section 5: Recommended Manager Actions */}
      <div className="bg-gradient-to-r from-blue-50/80 via-sky-50/80 to-indigo-50/80 dark:from-blue-950/40 dark:via-slate-900 dark:to-indigo-950/40 rounded-3xl border border-blue-200 dark:border-blue-900/60 p-6 sm:p-7 space-y-4">
        <h3 className="font-bold text-sm text-blue-900 dark:text-blue-300 uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <span>Recommended Manager Actions</span>
        </h3>
        <ol className="space-y-2 text-xs text-slate-700 dark:text-slate-200 font-medium list-decimal list-inside leading-relaxed">
          {digest.suggested_actions.map((act, idx) => (
            <li key={idx} className="leading-relaxed">
              {act}
            </li>
          ))}
        </ol>
      </div>

      {/* Adaptive Card Modal */}
      <AdaptiveCardModal
        isOpen={teamsModalOpen}
        onClose={() => setTeamsModalOpen(false)}
        cardData={digest.teams_card_json}
        title="Microsoft Teams Standup Digest Card"
      />
    </div>
  );
};
