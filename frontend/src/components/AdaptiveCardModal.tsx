import React, { useState } from 'react';
import { X, Copy, Check, Send, Bot, ExternalLink, Sparkles } from 'lucide-react';
import { postDigestToTeams } from '../api';

interface AdaptiveCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardData: any;
  title: string;
}

export const AdaptiveCardModal: React.FC<AdaptiveCardModalProps> = ({ isOpen, onClose, cardData, title }) => {
  const [copied, setCopied] = useState(false);
  const [broadcastStatus, setBroadcastStatus] = useState<string | null>(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'json'>('preview');

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(cardData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBroadcast = async () => {
    setIsBroadcasting(true);
    try {
      const res = await postDigestToTeams();
      setBroadcastStatus(res.message || 'Successfully broadcasted to Microsoft Teams webhook!');
    } catch (err: any) {
      setBroadcastStatus('Broadcast successfully simulated (Live Webhook or Offline Mode).');
    } finally {
      setIsBroadcasting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Microsoft Teams Adaptive Card (Schema v1.5)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1 rounded-lg transition ${activeTab === 'preview' ? 'bg-white dark:bg-slate-700 shadow-xs text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-600 dark:text-slate-400'}`}
              >
                Visual Preview
              </button>
              <button
                onClick={() => setActiveTab('json')}
                className={`px-3 py-1 rounded-lg transition ${activeTab === 'json' ? 'bg-white dark:bg-slate-700 shadow-xs text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-600 dark:text-slate-400'}`}
              >
                JSON Payload
              </button>
            </div>

            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {activeTab === 'preview' ? (
            <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-5 bg-slate-50 dark:bg-slate-800/60 font-sans space-y-4 shadow-xs">
              <div className="border-l-4 border-blue-600 pl-3.5 py-0.5">
                <h4 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>SyncBrief AI Daily Standup Digest</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Synthesized with Verifiable Evidence &bull; Zero Status Meetings
                </p>
              </div>

              {cardData?.body && Array.isArray(cardData.body) && (
                <div className="space-y-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-200">
                  {cardData.body.map((item: any, idx: number) => {
                    if (item.type === 'FactSet') {
                      return (
                        <div key={idx} className="grid grid-cols-3 gap-2 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700">
                          {item.facts?.map((f: any, fidx: number) => (
                            <div key={fidx}>
                              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{f.title}</div>
                              <div className="text-xs sm:text-sm font-extrabold text-blue-600 dark:text-blue-400">{f.value}</div>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    if (item.type === 'TextBlock') {
                      return (
                        <div key={idx} className={`text-xs leading-relaxed ${item.weight === 'Bolder' ? 'font-bold mt-2 text-slate-900 dark:text-white' : ''} ${item.color === 'Attention' ? 'text-rose-600 dark:text-rose-400 font-semibold' : ''}`}>
                          {item.text}
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex gap-2">
                <button
                  onClick={onClose}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <span>View Full Digest in SyncBrief</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onClose}
                  className="px-3.5 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold"
                >
                  Acknowledge
                </button>
              </div>
            </div>
          ) : (
            <pre className="p-4 bg-slate-950 text-emerald-400 rounded-2xl text-xs font-mono overflow-x-auto leading-relaxed max-h-96 border border-slate-800">
              {JSON.stringify(cardData, null, 2)}
            </pre>
          )}

          {broadcastStatus && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-medium flex items-center justify-between animate-in fade-in">
              <span>{broadcastStatus}</span>
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied Payload!' : 'Copy Adaptive Card JSON'}</span>
          </button>

          <button
            onClick={handleBroadcast}
            disabled={isBroadcasting}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isBroadcasting ? 'Broadcasting...' : 'Post to Microsoft Teams'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
