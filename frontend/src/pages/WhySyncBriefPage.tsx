import React, { useState } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  Upload, 
  FileText, 
  ShieldCheck, 
  Sparkles, 
  Clock, 
  Layers, 
  ArrowRight,
  ExternalLink,
  Check,
  AlertCircle,
  FileSpreadsheet
} from 'lucide-react';
import { importJiraCsv, fetchSprints } from '../api';
import { Sprint, Task } from '../types';

export const WhySyncBriefPage: React.FC = () => {
  const [csvContent, setCsvContent] = useState('');
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [targetSprintId, setTargetSprintId] = useState<number | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ count: number; tasks: Task[]; errors: string[] } | null>(null);

  React.useEffect(() => {
    fetchSprints().then(data => {
      setSprints(data);
      const active = data.find(s => s.status === 'active') || data[0];
      if (active) setTargetSprintId(active.id);
    }).catch(() => {});
  }, []);

  const sampleJiraCsv = `Issue key,Summary,Issue Type,Status,Priority,Custom field (Story Points),Assignee
SYNC-101,Implement OAuth2 refresh token rotation in API gateway,Story,In Progress,High,5,Priya Sharma
SYNC-102,Set up Azure Cosmos DB autoscale partition metrics,Task,To Do,Medium,3,James Wilson
SYNC-103,Add WCAG 2.1 AA accessibility contrast check in CI,Task,To Do,Low,2,Elena Rostova
SYNC-104,Audit Redis cache eviction spikes during peak load,Bug,In Progress,High,8,Rohan Patel`;

  const loadSampleCsv = () => {
    setCsvContent(sampleJiraCsv);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCsvContent((event.target?.result as string) || '');
      };
      reader.readAsText(file);
    }
  };

  const handleImport = async () => {
    if (!csvContent.trim()) {
      alert("Please provide Jira CSV content or load the sample preset.");
      return;
    }

    setIsImporting(true);
    setImportResult(null);
    try {
      const res = await importJiraCsv(csvContent, targetSprintId);
      setImportResult({
        count: res.imported_count,
        tasks: res.tasks,
        errors: res.errors
      });
    } catch (err: any) {
      alert(`Import error: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const comparisons = [
    {
      feature: 'Sprints & Story Points',
      syncbrief: 'Native Kanban with 1, 2, 3, 5, 8 Fibonacci points and automatic carry-over penalty calculation.',
      jira: 'Scrum and Kanban backlogs with customizable story point fields.',
      sharepoint: 'Generic static lists; lacks sprint lifecycles, Fibonacci difficulty, or carry-over penalty math.',
      isSyncBriefAdvantage: true,
      verdict: 'Purpose-Built Agile'
    },
    {
      feature: 'Daily Standup Coordination',
      syncbrief: '60-second async check-in with prefilled task dropdown, progress slider, and voice-to-text. Eliminates morning meeting fatigue.',
      jira: 'None built-in. Teams rely on external 15-30 minute synchronous Zoom / Teams standups.',
      sharepoint: 'None. Static announcements or survey lists requiring manual compilation.',
      isSyncBriefAdvantage: true,
      verdict: 'SyncBrief Saves ~33 hrs/mo'
    },
    {
      feature: 'AI Blocker Detection',
      syncbrief: 'Automated LLM extraction links blockers directly to pull requests, assigned tasks, and blocking teammates.',
      jira: 'Manual "Flag as Impediment" or custom workflow triggers that engineers frequently forget to update.',
      sharepoint: 'None. Requires manual custom status updates without NLP understanding.',
      isSyncBriefAdvantage: true,
      verdict: 'Proactive vs Reactive'
    },
    {
      feature: 'Cryptographic Source Citations',
      syncbrief: 'Every blocker is cited with exact message ID, channel (#backend), author, and verifiable chat quote with 1-click jump.',
      jira: 'None. Context must be manually summarized and copy-pasted into Jira comments.',
      sharepoint: 'None. Generic links to files without line-level or message-level evidence verification.',
      isSyncBriefAdvantage: true,
      verdict: 'Zero Hallucinations'
    },
    {
      feature: 'Citation Hallucination Guard',
      syncbrief: 'Multi-step validator inspects message store. If an LLM hallucinates quotes or messages, the citation is marked UNVERIFIED with reason.',
      jira: 'No native source message verification engine.',
      sharepoint: 'No AI verification pipeline.',
      isSyncBriefAdvantage: true,
      verdict: 'Verifiable Evidence'
    },
    {
      feature: 'Privacy-First Channel Boundaries',
      syncbrief: 'Strict opt-in channel boundaries. DM and private chat scraping is strictly prohibited and architecturally impossible.',
      jira: 'Broad workspace integration permissions often granting global read access across projects.',
      sharepoint: 'Complex nested permission inheritance that frequently leads to access leaks.',
      isSyncBriefAdvantage: true,
      verdict: 'Enterprise Compliance'
    },
    {
      feature: 'Quantified Meeting Time Saved',
      syncbrief: 'Live ROI engine tracks engineering hours and dollar savings returned to deep work based on team size & rate.',
      jira: 'Requires third-party Marketplace add-ons or custom BI dashboards.',
      sharepoint: 'No engineering ROI analytics.',
      isSyncBriefAdvantage: true,
      verdict: 'Built-in Executive ROI'
    },
    {
      feature: 'Ecosystem & Office Integrations',
      syncbrief: 'Microsoft Teams Adaptive Cards, Azure DevOps Work Item bidirectional sync, and one-click Jira CSV import.',
      jira: 'Vast Atlassian Marketplace with 3,000+ app connectors.',
      sharepoint: 'Deep M365 integration for documents, but slow and cumbersome for daily developer standups.',
      isJiraAdvantage: false,
      isSyncBriefAdvantage: true,
      verdict: 'Modern M365 Native'
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-16">
      {/* Hero Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3 pt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-bold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Honest Product Analysis</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
          Why SyncBrief AI vs. Jira & SharePoint
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Traditional project tools like Jira and SharePoint are bogged down by administrative complexity and meeting bloat. SyncBrief's true differentiator is <span className="font-semibold text-blue-600 dark:text-blue-400">replacing status meetings with async check-ins backed by verifiable chat citations</span>.
        </p>
      </div>

      {/* Comparison Matrix Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Feature-by-Feature Capability Matrix
            </h2>
            <p className="text-xs text-slate-500">
              An objective comparison across SyncBrief AI, Atlassian Jira, and Microsoft SharePoint.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-medium">
            <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span> SyncBrief AI
            </span>
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span> Jira
            </span>
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> SharePoint
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-4 px-5 w-1/5">Workflow Capability</th>
                <th className="py-4 px-5 w-2/5 bg-blue-50/50 dark:bg-blue-950/20 text-blue-950 dark:text-blue-200">
                  SyncBrief AI
                </th>
                <th className="py-4 px-5 w-1/5">Atlassian Jira</th>
                <th className="py-4 px-5 w-1/5">MS SharePoint</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {comparisons.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                  {/* Feature Title & Verdict */}
                  <td className="py-4 px-5 align-top">
                    <div className="font-bold text-slate-900 dark:text-white text-xs">{row.feature}</div>
                    <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      row.isSyncBriefAdvantage
                        ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}>
                      {row.verdict}
                    </span>
                  </td>

                  {/* SyncBrief Column */}
                  <td className="py-4 px-5 align-top bg-blue-50/30 dark:bg-blue-950/10 text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <span>{row.syncbrief}</span>
                    </div>
                  </td>

                  {/* Jira Column */}
                  <td className="py-4 px-5 align-top text-slate-600 dark:text-slate-400 leading-relaxed">
                    <div className="flex items-start gap-2">
                      <XCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <span>{row.jira}</span>
                    </div>
                  </td>

                  {/* SharePoint Column */}
                  <td className="py-4 px-5 align-top text-slate-600 dark:text-slate-400 leading-relaxed">
                    <div className="flex items-start gap-2">
                      <XCircle className="w-4 h-4 text-amber-500/70 shrink-0 mt-0.5" />
                      <span>{row.sharepoint}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Migration Bridge: Import Jira CSV into SyncBrief Sprint */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              <span>Migration Bridge: Import Jira CSV into Sprint</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Easily migrate active Jira backlog issues into SyncBrief's active sprint board.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadSampleCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-bold border border-blue-200 dark:border-blue-900 hover:bg-blue-100 transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Load Sample Jira Export</span>
            </button>
          </div>
        </div>

        {/* Import Configuration Form */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Target Sprint:</span>
              <select
                value={targetSprintId || ''}
                onChange={(e) => setTargetSprintId(e.target.value ? Number(e.target.value) : null)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white outline-hidden"
              >
                {sprints.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.status.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload CSV File</span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div>
            <textarea
              rows={5}
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              placeholder="Paste Jira CSV export content here (Issue Key, Summary, Priority, Story Points, Assignee)..."
              className="w-full font-mono text-xs p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleImport}
              disabled={isImporting || !csvContent.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              <span>{isImporting ? 'Importing Tasks...' : 'Import into Active Sprint'}</span>
            </button>
          </div>
        </div>

        {/* Import Results Banner */}
        {importResult && (
          <div className="p-4.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 space-y-3 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <h4 className="font-bold text-xs">
                Successfully imported {importResult.count} tasks into Sprint!
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {importResult.tasks.map((t) => (
                <div key={t.id} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-between">
                  <div className="truncate pr-2">
                    <span className="font-bold text-slate-900 dark:text-white">{t.title}</span>
                    <div className="text-[11px] text-slate-500">{t.assignee_name || 'Unassigned'}</div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 font-bold shrink-0">
                    {t.difficulty} pts
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
