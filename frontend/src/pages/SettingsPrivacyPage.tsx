import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Lock, 
  FileText, 
  Cpu, 
  Clock, 
  RefreshCw,
  Search,
  Check,
  AlertTriangle
} from 'lucide-react';
import { fetchChannels, toggleChannelOptIn, fetchAuditTrail, deleteMyData } from '../api';
import { Channel, AuditLogItem } from '../types';
import { useAuth } from '../context/AuthContext';

export const SettingsPrivacyPage: React.FC = () => {
  const { user } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);
  const [auditSearch, setAuditSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [chans, logs] = await Promise.all([
        fetchChannels(),
        fetchAuditTrail(),
      ]);
      setChannels(chans);
      setAuditLogs(logs);
    } catch (err) {
      console.error('Failed to load settings data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleChannel = async (channel: Channel) => {
    try {
      const updated = await toggleChannelOptIn(channel.id, !channel.is_syncbrief_enabled);
      setChannels(prev => prev.map(c => (c.id === updated.id ? updated : c)));
    } catch (err) {
      alert('Failed to update channel privacy');
    }
  };

  const handleDeleteData = async () => {
    if (!window.confirm("Are you sure you want to purge all your check-in records? This action cannot be undone and complies with GDPR Article 17.")) {
      return;
    }

    try {
      const res = await deleteMyData();
      setDeleteStatus(res.message);
      await loadData();
    } catch (err) {
      alert('Failed to delete data');
    }
  };

  const filteredLogs = auditLogs.filter((l) =>
    auditSearch
      ? l.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
        l.model_used.toLowerCase().includes(auditSearch.toLowerCase()) ||
        l.input_summary.toLowerCase().includes(auditSearch.toLowerCase())
      : true
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Privacy Controls & AI Governance
          </h1>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold">
            Privacy-First Architecture
          </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Opt-in channel management, explainable AI audit trail, and GDPR data sovereignty.
        </p>
      </div>

      {/* Strict Privacy Boundary Guarantees */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-xs space-y-6">
        <div>
          <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-blue-600" />
            <span>Strict Privacy Boundary Guarantees</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            SyncBrief AI is architected from the ground up to respect team member privacy.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* What SyncBrief Can See */}
          <div className="p-5 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Opted-In Public Channels Only</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Only designated public channels (e.g. #backend, #frontend) are indexed for blocker validation. Citations link directly to verbatim text so developers know exactly what source was cited.
            </p>
          </div>

          {/* What SyncBrief NEVER Sees */}
          <div className="p-5 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider">
              <XCircle className="w-4 h-4 text-rose-600" />
              <span>Strict Zero Direct Message (DM) Scraping</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              SyncBrief AI has zero access to 1:1 direct messages, group chats, or un-opted channels. No personal communications are ever scanned, indexed, or stored.
            </p>
          </div>
        </div>
      </div>

      {/* Channel Opt-in Toggles */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Opted-In Team Channels
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {channels.filter(c => c.is_syncbrief_enabled).length} of {channels.length} Enabled
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {channels.map((ch) => (
            <div key={ch.id} className="py-3.5 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">{ch.name}</span>
                  {ch.is_syncbrief_enabled ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-semibold">
                      Active Source
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-[10px] font-semibold">
                      Excluded
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{ch.description}</p>
              </div>

              <button
                onClick={() => handleToggleChannel(ch)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  ch.is_syncbrief_enabled
                    ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
                }`}
              >
                {ch.is_syncbrief_enabled ? 'Disable Channel' : 'Enable Channel'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* AI Governance Audit Trail */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Explainable AI Governance Audit Log
              </h3>
              <p className="text-xs text-slate-500">
                Full transparency into every AI model call, validation check, and token latency.
              </p>
            </div>
          </div>

          <div className="relative w-48 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={auditSearch}
              onChange={(e) => setAuditSearch(e.target.value)}
              placeholder="Search audit trail..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-hidden"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                <th className="py-2.5 pr-4">Timestamp</th>
                <th className="py-2.5 pr-4">Action</th>
                <th className="py-2.5 pr-4">Model</th>
                <th className="py-2.5 pr-4">Input Context</th>
                <th className="py-2.5 text-right">Synthesis Output</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-300">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 pr-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                    {log.created_at ? new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Just now'}
                  </td>
                  <td className="py-2.5 pr-4 font-medium text-slate-900 dark:text-white">
                    {log.action}
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-blue-600 dark:text-blue-400 text-[11px] whitespace-nowrap">
                    {log.model_used}
                  </td>
                  <td className="py-2.5 pr-4 text-slate-500 truncate max-w-xs">
                    {log.input_summary}
                  </td>
                  <td className="py-2.5 text-right font-medium text-slate-700 dark:text-slate-200 truncate max-w-xs">
                    {log.output_summary}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* GDPR Data Purge */}
      <div className="rounded-3xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
          <Trash2 className="w-5 h-5" />
          <h3 className="font-bold text-base text-slate-900 dark:text-white">
            GDPR Article 17 Data Sovereignty
          </h3>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Request an immediate purge of your standup check-in history and AI synthesis drafts from the local tenant database.
        </p>

        <div className="flex items-center gap-4">
          <button
            onClick={handleDeleteData}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
          >
            Purge My Standup Data
          </button>
          {deleteStatus && (
            <span className="text-xs text-emerald-600 font-semibold">{deleteStatus}</span>
          )}
        </div>
      </div>
    </div>
  );
};
