import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  MessageSquare, 
  Send, 
  ShieldCheck, 
  ShieldAlert, 
  Hash, 
  Lock, 
  Search, 
  Sparkles, 
  Info,
  CheckCircle2,
  Users,
  Eye,
  EyeOff,
  CornerDownRight,
  ExternalLink
} from 'lucide-react';
import { fetchChannels, fetchChannelMessages, postChannelMessage, toggleChannelOptIn } from '../api';
import { Channel, Message } from '../types';
import { useAuth } from '../context/AuthContext';

export const ChannelSimulatorPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const channelParam = searchParams.get('channel') || 'backend';
  const highlightParam = searchParams.get('highlight');

  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelName, setActiveChannelName] = useState<string>(channelParam.startsWith('#') ? channelParam : `#${channelParam}`);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(highlightParam);
  const [chatSearch, setChatSearch] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const highlightedRef = useRef<HTMLDivElement>(null);

  // Load channels on mount
  useEffect(() => {
    fetchChannels().then(setChannels).catch(() => {});
  }, []);

  // Update active channel when URL parameter changes
  useEffect(() => {
    if (channelParam) {
      const clean = channelParam.startsWith('#') ? channelParam : `#${channelParam}`;
      setActiveChannelName(clean);
    }
    if (highlightParam) {
      setHighlightedId(highlightParam);
    }
  }, [channelParam, highlightParam]);

  // Load messages whenever active channel changes
  useEffect(() => {
    loadMessages(activeChannelName);
  }, [activeChannelName]);

  // Scroll to highlight or bottom
  useEffect(() => {
    if (highlightedId && highlightedRef.current) {
      setTimeout(() => {
        highlightedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 250);
    } else if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, highlightedId]);

  const loadMessages = async (name: string) => {
    setIsLoadingMessages(true);
    try {
      const data = await fetchChannelMessages(name);
      setMessages(data);
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const sent = await postChannelMessage(activeChannelName, newMessage.trim());
      setMessages(prev => [...prev, sent]);
      setNewMessage('');
    } catch (err) {
      alert('Failed to post message');
    }
  };

  const handleTogglePrivacy = async (channel: Channel) => {
    try {
      const updated = await toggleChannelOptIn(channel.id, !channel.is_syncbrief_enabled);
      setChannels(prev => prev.map(c => (c.id === updated.id ? updated : c)));
    } catch (err) {
      alert('Failed to update privacy');
    }
  };

  const activeChannel = channels.find(c => c.name.toLowerCase() === activeChannelName.toLowerCase());

  const filteredMessages = messages.filter((m) =>
    chatSearch ? m.content.toLowerCase().includes(chatSearch.toLowerCase()) || m.author_name.toLowerCase().includes(chatSearch.toLowerCase()) : true
  );

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Microsoft Teams Channel Simulator
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-semibold">
              Evidence Data Lake
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Opted-in team channels act as verifiable evidence sources for standup blockers. Un-opted channels are never scraped.
          </p>
        </div>

        {highlightedId && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700/60 text-emerald-800 dark:text-emerald-300 text-xs font-semibold animate-pulse">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Target Evidence: {highlightedId}</span>
          </div>
        )}
      </div>

      {/* Main Teams UI Layout */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md overflow-hidden grid lg:grid-cols-4 min-h-[640px]">
        {/* Channel Navigation Sidebar */}
        <div className="lg:border-r border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <span>Channels</span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">{channels.length} Total</span>
          </div>

          {/* Channel list */}
          <div className="space-y-1.5">
            {channels.map((ch) => {
              const isActive = ch.name.toLowerCase() === activeChannelName.toLowerCase();
              return (
                <div
                  key={ch.id}
                  onClick={() => {
                    setActiveChannelName(ch.name);
                    setSearchParams({ channel: ch.name.replace('#', '') });
                  }}
                  className={`group flex items-center justify-between p-3 rounded-2xl cursor-pointer transition ${
                    isActive
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'hover:bg-slate-200/60 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Hash className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span className="text-xs truncate">{ch.name}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {ch.is_syncbrief_enabled ? (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTogglePrivacy(ch);
                        }}
                        className={`p-1 rounded-md transition ${isActive ? 'text-white hover:bg-blue-700' : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950'}`}
                        title="Opted-in channel (Click to disable)"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTogglePrivacy(ch);
                        }}
                        className={`p-1 rounded-md transition ${isActive ? 'text-white hover:bg-blue-700' : 'text-slate-400 hover:bg-slate-200'}`}
                        title="Excluded channel (Zero scraping)"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Privacy Legend */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-[11px] space-y-2 text-slate-500">
            <div className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[10px] tracking-wider">
              Privacy Boundary
            </div>
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Opted-in: Verifiable evidence source</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <EyeOff className="w-3.5 h-3.5 shrink-0" />
              <span>Opted-out: Strict zero-read guarantee</span>
            </div>
          </div>
        </div>

        {/* Message Stream */}
        <div className="lg:col-span-3 flex flex-col h-[640px] bg-white dark:bg-slate-900">
          {/* Channel Header Bar */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-950/30">
            <div className="flex items-center gap-2.5">
              <Hash className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {activeChannelName}
                </h3>
                <p className="text-[11px] text-slate-500 truncate">
                  {activeChannel?.description || 'Team engineering channel for async coordination'}
                </p>
              </div>
            </div>

            <div className="relative w-48 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={chatSearch}
                onChange={(e) => setChatSearch(e.target.value)}
                placeholder="Search messages..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-hidden"
              />
            </div>
          </div>

          {/* Messages List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {isLoadingMessages ? (
              <div className="text-center py-20 text-xs text-slate-400">
                Loading messages for {activeChannelName}...
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="text-center py-20 text-xs text-slate-400">
                No messages found matching search criteria.
              </div>
            ) : (
              filteredMessages.map((msg) => {
                const isTarget = highlightedId === msg.id || (highlightedId && msg.id.includes(highlightedId));

                return (
                  <div
                    key={msg.id}
                    ref={isTarget ? highlightedRef : null}
                    className={`flex items-start gap-3 p-3.5 rounded-2xl transition-all ${
                      isTarget
                        ? 'citation-highlight bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-400 dark:border-emerald-600 shadow-md'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <img
                      src={msg.author_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                      alt={msg.author_name}
                      className="w-9 h-9 rounded-full object-cover shrink-0 ring-2 ring-slate-200 dark:ring-slate-700"
                    />

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 dark:text-white">
                            {msg.author_name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                          {msg.id}
                        </span>
                      </div>

                      {/* Evidence Tag if highlighted */}
                      {isTarget && (
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-bold">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>VERIFIED STANDUP EVIDENCE CITED BY PRIYA SHARMA</span>
                        </div>
                      )}

                      <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-normal">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Preset Buttons & Input Box */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 space-y-2">
            <div className="flex items-center gap-2 overflow-x-auto text-[11px]">
              <span className="text-slate-400 font-medium shrink-0">Demo presets:</span>
              <button
                type="button"
                onClick={() => setNewMessage("Security review for v2.4 Auth migration is running right now. ETA is 4 PM today.")}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 whitespace-nowrap"
              >
                + Post ETA Update
              </button>
              <button
                type="button"
                onClick={() => setNewMessage("PR #184 schema is ready for staging review. Unblocked!")}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 whitespace-nowrap"
              >
                + Post Resolution
              </button>
            </div>

            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={`Send message to ${activeChannelName} as ${user?.full_name || 'Sarah'}...`}
                className="flex-1 px-4 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-hidden focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition flex items-center justify-center shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
