import React, { useState, useEffect } from 'react';
import { 
  Kanban, 
  Plus, 
  ExternalLink, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  Clock, 
  User as UserIcon, 
  Layers, 
  RefreshCw,
  Code,
  X,
  Check,
  Search,
  Filter,
  Copy,
  Sparkles
} from 'lucide-react';
import { fetchBlockers, updateBlockerStatus, syncToDevOps, testHallucination } from '../api';
import { Blocker } from '../types';
import { CitationBadge } from '../components/CitationBadge';

export const BlockerBoardPage: React.FC = () => {
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draggedBlockerId, setDraggedBlockerId] = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<'open' | 'in_progress' | 'resolved' | null>(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');

  // Azure DevOps Work Item Modal State
  const [adoModalData, setAdoModalData] = useState<any | null>(null);
  const [isSyncingAdo, setIsSyncingAdo] = useState<number | null>(null);
  const [copiedAdo, setCopiedAdo] = useState(false);

  // Quick Blocker Modal State
  const [isNewBlockerModalOpen, setIsNewBlockerModalOpen] = useState(false);
  const [newSummary, setNewSummary] = useState('');
  const [newOwner, setNewOwner] = useState('Priya Sharma');
  const [newBlockedBy, setNewBlockedBy] = useState('Backend Team');
  const [newSeverity, setNewSeverity] = useState('high');

  useEffect(() => {
    loadBlockers();
  }, []);

  const loadBlockers = async () => {
    setIsLoading(true);
    try {
      const data = await fetchBlockers();
      setBlockers(data);
    } catch (err) {
      console.error('Failed to load blockers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (id: number) => {
    setDraggedBlockerId(id);
  };

  const handleDragOver = (e: React.DragEvent, colId: 'open' | 'in_progress' | 'resolved') => {
    e.preventDefault();
    setDragOverCol(colId);
  };

  const handleDrop = async (newStatus: 'open' | 'in_progress' | 'resolved') => {
    if (!draggedBlockerId) return;
    const targetId = draggedBlockerId;
    setDraggedBlockerId(null);
    setDragOverCol(null);

    // Optimistic UI update
    setBlockers(prev => prev.map(b => (b.id === targetId ? { ...b, status: newStatus } : b)));

    try {
      await updateBlockerStatus(targetId, newStatus);
    } catch (err) {
      console.error('Failed to update status on server:', err);
      loadBlockers();
    }
  };

  const handleCreateDevOpsWorkItem = async (blocker: Blocker) => {
    setIsSyncingAdo(blocker.id);
    try {
      const res = await syncToDevOps(blocker.id, {
        title: blocker.summary,
        description: `Owner: ${blocker.owner_name} | Blocked by: ${blocker.blocked_by}`,
      });
      // Update local blocker
      setBlockers(prev => prev.map(b => (b.id === blocker.id ? { ...b, devops_work_item_id: res.id, devops_payload: JSON.stringify(res.request_payload) } : b)));
      setAdoModalData(res);
    } catch (err) {
      alert('Error creating Azure DevOps work item');
    } finally {
      setIsSyncingAdo(null);
    }
  };

  const handleRunHallucinationTest = async () => {
    try {
      const res = await testHallucination();
      await loadBlockers();
      alert(`Deliberate Hallucination Test Injected! Notice how Blocker #${res.blocker_id} failed verbatim validation and is marked with an UNVERIFIED warning badge.`);
    } catch (err) {
      alert('Failed to trigger hallucination test');
    }
  };

  const handleCreateLocalBlocker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSummary.trim()) return;
    const nowStr = new Date().toISOString();
    const newB: Blocker = {
      id: Date.now(),
      summary: newSummary.trim(),
      owner_name: newOwner,
      blocked_by: newBlockedBy,
      severity: newSeverity as any,
      status: 'open',
      confidence: 0.95,
      created_at: nowStr,
      updated_at: nowStr,
      citations: [
        {
          message_id: 'msg_local',
          channel: '#backend',
          author: 'Vikram Joshi',
          quote: newSummary.trim(),
          status: 'VERIFIED'
        }
      ]
    };
    setBlockers(prev => [newB, ...prev]);
    setIsNewBlockerModalOpen(false);
    setNewSummary('');
  };

  const columns: { id: 'open' | 'in_progress' | 'resolved'; title: string; color: string; badgeBg: string }[] = [
    { id: 'open', title: 'Open Blockers', color: 'text-rose-600 dark:text-rose-400', badgeBg: 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300' },
    { id: 'in_progress', title: 'In Resolution', color: 'text-amber-600 dark:text-amber-400', badgeBg: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300' },
    { id: 'resolved', title: 'Resolved', color: 'text-emerald-600 dark:text-emerald-400', badgeBg: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' },
  ];

  const getAgeString = (dateStr: string) => {
    const diffHours = Math.max(1, Math.round((new Date().getTime() - new Date(dateStr).getTime()) / (1000 * 3600)));
    if (diffHours < 24) return `${diffHours}h old`;
    return `${Math.round(diffHours / 24)}d old`;
  };

  const filteredBlockers = blockers.filter((b) => {
    const matchSearch = b.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.owner_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.blocked_by.toLowerCase().includes(searchTerm.toLowerCase());
    const matchSev = selectedSeverity === 'all' || b.severity === selectedSeverity;
    return matchSearch && matchSev;
  });

  return (
    <div className="space-y-6 pb-20">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Kanban Blocker Board
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-semibold">
              Live Drag & Drop
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Drag cards across columns to update resolution status. 1-click sync to Azure DevOps Work Items.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Add Blocker */}
          <button
            onClick={() => setIsNewBlockerModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Blocker</span>
          </button>

          {/* Hallucination Demo Button for Judges */}
          <button
            onClick={handleRunHallucinationTest}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/60 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition shadow-xs"
            title="Demonstrate how the CitationValidator catches fake/hallucinated messages"
          >
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Test Hallucination Detection</span>
          </button>

          <button
            onClick={loadBlockers}
            className="p-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition"
            title="Refresh board"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by blocker, owner, or team..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-hidden"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto text-xs">
          <span className="text-slate-400 text-[11px] font-medium hidden md:inline">Severity:</span>
          {['all', 'high', 'medium', 'low'].map((sev) => (
            <button
              key={sev}
              onClick={() => setSelectedSeverity(sev)}
              className={`px-3 py-1 rounded-lg capitalize font-medium transition ${
                selectedSeverity === sev
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* Kanban Columns */}
      <div className="grid md:grid-cols-3 gap-6">
        {columns.map((col) => {
          const colBlockers = filteredBlockers.filter((b) => b.status === col.id);
          const isOver = dragOverCol === col.id;

          return (
            <div
              key={col.id}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={() => handleDrop(col.id)}
              className={`flex flex-col rounded-3xl p-4 border transition-all min-h-[580px] ${
                isOver
                  ? 'bg-blue-50/60 dark:bg-blue-950/30 border-blue-400 dark:border-blue-600 scale-[1.01]'
                  : 'bg-slate-100/70 dark:bg-slate-900/50 border-slate-200/90 dark:border-slate-800'
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <h3 className={`font-bold text-sm ${col.color}`}>
                    {col.title}
                  </h3>
                  <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${col.badgeBg}`}>
                    {colBlockers.length}
                  </span>
                </div>
              </div>

              {/* Cards list */}
              <div className="space-y-3.5 flex-1 overflow-y-auto">
                {colBlockers.map((blocker) => {
                  const isHigh = blocker.severity === 'high';
                  const citations = blocker.citations || [];

                  return (
                    <div
                      key={blocker.id}
                      draggable
                      onDragStart={() => handleDragStart(blocker.id)}
                      className="group cursor-grab active:cursor-grabbing p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-all space-y-3"
                    >
                      {/* Top Bar: Severity & Age */}
                      <div className="flex items-center justify-between text-[11px]">
                        <span className={`font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                          isHigh ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300' : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                        }`}>
                          {blocker.severity}
                        </span>

                        <div className="flex items-center gap-1 text-slate-400 font-mono">
                          <Clock className="w-3 h-3" />
                          <span>{getAgeString(blocker.created_at)}</span>
                        </div>
                      </div>

                      {/* Blocker Summary */}
                      <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white leading-snug">
                        {blocker.summary}
                      </p>

                      {/* Ownership Info */}
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-slate-700 dark:text-slate-300">Owner:</span> {blocker.owner_name}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-slate-700 dark:text-slate-300">Blocked By:</span> {blocker.blocked_by}
                        </div>
                      </div>

                      {/* Citations Badges */}
                      {citations.length > 0 && (
                        <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                          {citations.map((cit, cidx) => (
                            <div key={cidx} className="flex flex-col gap-1">
                              <CitationBadge citation={cit} size="sm" />
                              {cit.status === 'UNVERIFIED' && cit.rejection_reason && (
                                <span className="text-[10px] text-rose-500 italic pl-1 leading-tight">
                                  Validator: {cit.rejection_reason}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Azure DevOps Action */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                        {blocker.devops_work_item_id ? (
                          <div
                            onClick={() => {
                              setAdoModalData({
                                id: blocker.devops_work_item_id,
                                status: 'Synced to Azure DevOps',
                                request_payload: JSON.parse(blocker.devops_payload || '[]'),
                                is_mock: true,
                              });
                            }}
                            className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                          >
                            <span>{blocker.devops_work_item_id}</span>
                            <ExternalLink className="w-3 h-3" />
                          </div>
                        ) : (
                          <button
                            onClick={() => handleCreateDevOpsWorkItem(blocker)}
                            disabled={isSyncingAdo === blocker.id}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline"
                          >
                            <Code className="w-3 h-3" />
                            <span>{isSyncingAdo === blocker.id ? 'Creating...' : '+ Create ADO Work Item'}</span>
                          </button>
                        )}

                        <span className="text-[10px] text-slate-400 font-mono">
                          #{blocker.id}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {colBlockers.length === 0 && (
                  <div className="text-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-400">
                    No blockers in {col.title.toLowerCase()}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* New Blocker Quick Modal */}
      {isNewBlockerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600" />
                <span>Add New Blocker</span>
              </h3>
              <button onClick={() => setIsNewBlockerModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLocalBlocker} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Blocker Summary</label>
                <textarea
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  placeholder="e.g. Waiting on Redis cache cluster provision from DevOps team..."
                  rows={3}
                  required
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Owner</label>
                  <input
                    type="text"
                    value={newOwner}
                    onChange={(e) => setNewOwner(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Blocked By</label>
                  <input
                    type="text"
                    value={newBlockedBy}
                    onChange={(e) => setNewBlockedBy(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Severity</label>
                <select
                  value={newSeverity}
                  onChange={(e) => setNewSeverity(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                >
                  <option value="high">High (Sprint Risk)</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewBlockerModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow transition"
                >
                  Create Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Azure DevOps Work Item Inspector Modal */}
      {adoModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                  ADO
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    Azure DevOps Work Item Inspector
                  </h3>
                  <p className="text-xs text-slate-500">
                    REST API JSON Patch Document &bull; {adoModalData.id}
                  </p>
                </div>
              </div>
              <button onClick={() => setAdoModalData(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3.5 bg-blue-50 dark:bg-blue-950/40 rounded-2xl border border-blue-200 dark:border-blue-800 text-xs">
                <div>
                  <span className="font-bold text-blue-900 dark:text-blue-300">Work Item ID: </span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{adoModalData.id}</span>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold text-[11px]">
                  {adoModalData.status || 'Created (Live/Mock)'}
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    JSON-Patch Payload (PATCH api-version=7.1-preview.3):
                  </label>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(adoModalData.request_payload, null, 2));
                      setCopiedAdo(true);
                      setTimeout(() => setCopiedAdo(false), 2000);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-medium hover:underline"
                  >
                    {copiedAdo ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedAdo ? 'Copied!' : 'Copy JSON'}</span>
                  </button>
                </div>

                <pre className="p-4 bg-slate-950 text-sky-300 rounded-2xl text-xs font-mono overflow-x-auto max-h-72 leading-relaxed border border-slate-800">
                  {JSON.stringify(adoModalData.request_payload, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setAdoModalData(null)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
