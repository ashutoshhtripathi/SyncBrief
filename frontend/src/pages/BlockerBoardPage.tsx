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
  Check
} from 'lucide-react';
import { fetchBlockers, updateBlockerStatus, syncToDevOps, testHallucination } from '../api';
import { Blocker } from '../types';
import { CitationBadge } from '../components/CitationBadge';

export const BlockerBoardPage: React.FC = () => {
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draggedBlockerId, setDraggedBlockerId] = useState<number | null>(null);

  // Azure DevOps Work Item Modal State
  const [adoModalData, setAdoModalData] = useState<any | null>(null);
  const [isSyncingAdo, setIsSyncingAdo] = useState<number | null>(null);

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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (newStatus: 'open' | 'in_progress' | 'resolved') => {
    if (!draggedBlockerId) return;
    const targetId = draggedBlockerId;
    setDraggedBlockerId(null);

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
      alert(`Deliberate Hallucination Test Created! Blocker #${res.blocker_id} injected. Notice how the validator rejected the fake citation and flagged it with an unverified badge.`);
    } catch (err) {
      alert('Failed to trigger hallucination test');
    }
  };

  const columns: { id: 'open' | 'in_progress' | 'resolved'; title: string; color: string; bg: string }[] = [
    { id: 'open', title: 'Open Blockers', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60' },
    { id: 'in_progress', title: 'In Resolution', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60' },
    { id: 'resolved', title: 'Resolved', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60' },
  ];

  const getAgeString = (dateStr: string) => {
    const diffHours = Math.max(1, Math.round((new Date().getTime() - new Date(dateStr).getTime()) / (1000 * 3600)));
    if (diffHours < 24) return `${diffHours}h old`;
    return `${Math.round(diffHours / 24)}d old`;
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Kanban Blocker Board
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-semibold">
              Live Flow
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Drag cards across columns to update blocker resolution status. Sync directly to Azure DevOps Work Items.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Hallucination Demo Button for Judges */}
          <button
            onClick={handleRunHallucinationTest}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/60 text-amber-800 dark:text-amber-300 hover:bg-amber-100 transition shadow-xs"
            title="Demonstrate how the CitationValidator catches fake/hallucinated messages"
          >
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <span>Test Hallucination Detection</span>
          </button>

          <button
            onClick={loadBlockers}
            className="p-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition"
            title="Refresh board"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Kanban Columns */}
      <div className="grid md:grid-cols-3 gap-6">
        {columns.map((col) => {
          const colBlockers = blockers.filter(b => b.status === col.id);
          return (
            <div
              key={col.id}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(col.id)}
              className="flex flex-col rounded-2xl bg-slate-100/70 dark:bg-slate-900/50 p-4 border border-slate-200 dark:border-slate-800 min-h-[600px]"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <h3 className={`font-bold text-sm ${col.color}`}>
                    {col.title}
                  </h3>
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                    {colBlockers.length}
                  </span>
                </div>
              </div>

              {/* Cards list */}
              <div className="space-y-3 flex-1 overflow-y-auto">
                {colBlockers.map((blocker) => {
                  const isHigh = blocker.severity === 'high';
                  const citations = blocker.citations || [];

                  return (
                    <div
                      key={blocker.id}
                      draggable
                      onDragStart={() => handleDragStart(blocker.id)}
                      className="group cursor-grab active:cursor-grabbing p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-all space-y-3"
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
                          ID: #{blocker.id}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {colBlockers.length === 0 && (
                  <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-400">
                    No blockers in {col.title.toLowerCase()}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Azure DevOps Work Item Inspector Modal */}
      {adoModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                  ADO
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    Azure DevOps Work Item Inspector
                  </h3>
                  <p className="text-xs text-slate-500">
                    REST API JSON Patch operations &bull; {adoModalData.id}
                  </p>
                </div>
              </div>
              <button onClick={() => setAdoModalData(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800 text-xs">
                <div>
                  <span className="font-bold text-blue-900 dark:text-blue-300">Work Item ID: </span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{adoModalData.id}</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold text-[11px]">
                  {adoModalData.status || 'Created (Mock Mode)'}
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  JSON-Patch Document (PATCH api-version=7.1-preview.3):
                </label>
                <pre className="p-4 bg-slate-950 text-sky-300 rounded-xl text-xs font-mono overflow-x-auto max-h-72 leading-relaxed">
                  {JSON.stringify(adoModalData.request_payload, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setAdoModalData(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold"
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
