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
  RefreshCw 
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

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Privacy Controls & Governance
          </h1>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold">
            Privacy-First Architecture
          </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Opt-in channels, GDPR data management, and the explainable AI audit trail.
        </p>
      </div>

      {/* Privacy Boundary Card */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-6">
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
          <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>What SyncBrief AI CAN Read</span>
            </div>
            <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-200">
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold">&bull;</span>
                <span>Messages in channels explicitly enabled below (#backend, #frontend, #devops).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold">&bull;</span>
                <span>Async standup updates you submit via the 60s form or Teams card.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold">&bull;</span>
                <span>Work item references (e.g. ADO-4820) and pull request URLs you attach.</span>
              </li>
            </ul>
          </div>

          {/* What SyncBrief CANNOT See */}
          <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-800/60 bg-rose-50/40 dark:bg-rose-950/20 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider">
              <XCircle className="w-4 h-4 text-rose-600" />
              <span>What SyncBrief AI NEVER Reads</span>
            </div>
            <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-200">
              <li className="flex items-start gap-2">
                <span className="text-rose-600 font-bold">&bull;</span>
                <span>Private 1-on-1 Teams direct messages (DMs) or group chats.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rose-600 font-bold">&bull;</span>
                <span>Any unopted or private team channels.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rose-600 font-bold">&bull;</span>
                <span>Personal files, emails, or call audio streams.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Channel Opt-In Management */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4">
        <div>
          <h3 className="font-bold text-base text-slate-900 dark:text-white">
            Channel Opt-in Toggles
          </h3>
          <p className="text-xs text-slate-500">
            Control which channels are analyzed for verifiable blocker evidence.
          </p>
        </div>

        <div className="space-y-2">
          {channels.map((chan) => (
            <div
              key={chan.id}
              className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40"
            >
              <div>
                <div className="font-bold text-xs text-slate-900 dark:text-white">
                  {chan.name}
                </div>
                <div className="text-[11px] text-slate-500">
                  {chan.description} &bull; {chan.member_count} members
                </div>
              </div>

              <button
                onClick={() => handleToggleChannel(chan)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  chan.is_syncbrief_enabled
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'
                }`}
              >
                {chan.is_syncbrief_enabled ? 'Opted In (Active)' : 'Opted Out'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Data Retention & GDPR Delete Button */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4">
        <div>
          <h3 className="font-bold text-base text-slate-900 dark:text-white">
            Data Retention & Right to be Forgotten (GDPR)
          </h3>
          <p className="text-xs text-slate-500">
            Automated 90-day retention with instant self-service data purging.
          </p>
        </div>

        {deleteStatus && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 text-xs text-emerald-800 dark:text-emerald-300 rounded-lg">
            {deleteStatus}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60">
          <div>
            <div className="font-bold text-xs text-rose-900 dark:text-rose-300">
              Purge My Standup History
            </div>
            <div className="text-[11px] text-rose-700 dark:text-rose-400">
              Permanently delete all check-in submissions and associated blocker citations for {user?.full_name}.
            </div>
          </div>

          <button
            onClick={handleDeleteData}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete My Data</span>
          </button>
        </div>
      </div>

      {/* AI Audit Trail */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-purple-600" />
              <span>AI Governance & Explainability Audit Trail</span>
            </h3>
            <p className="text-xs text-slate-500">
              Every AI output records model name, prompt version, and input IDs.
            </p>
          </div>
          <button
            onClick={loadData}
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg border border-slate-200 dark:border-slate-700"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">AI Model</th>
                <th className="py-2.5 px-3">Prompt Version</th>
                <th className="py-2.5 px-3">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 font-mono text-[11px]">
                  <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-blue-600 dark:text-blue-400">
                    {log.action}
                  </td>
                  <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200">
                    {log.model_used}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {log.prompt_version}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-sans truncate max-w-xs" title={log.output_summary}>
                    {log.output_summary}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
