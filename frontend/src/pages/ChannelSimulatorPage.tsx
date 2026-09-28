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
  Users
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
      }, 200);
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

  return (
    <div className="space-y-4 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Microsoft Teams Channel Simulator
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-semibold">
              Evidence Source
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Opted-in team channels acting as verifiable ground truth. Citations highlight directly in this feed.
          </p>
        </div>

        {highlightedId && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 text-xs font-semibold animate-pulse">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Target Evidence Highlighted: {highlightedId}</span>
            <button
              onClick={() => {
                setHighlightedId(null);
                setSearchParams({ channel: activeChannelName.replace('#', '') });
              }}
              className="ml-2 hover:underline opacity-80"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Main Teams Container */}
      <div className="grid lg:grid-cols-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm min-h-[650px]">
        {/* Channel Sidebar */}
        <div className="border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 p-4 space-y-4">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Teams Channels</span>
            <span className="text-[11px] font-mono">{channels.length}</span>
          </div>

          <div className="space-y-1">
            {channels.map((chan) => {
              const isSelected = chan.name.toLowerCase() === activeChannelName.toLowerCase();
              return (
                <div
                  key={chan.id}
                  onClick={() => {
                    setActiveChannelName(chan.name);
                    setSearchParams({ channel: chan.name.replace('#', '') });
                  }}
                  className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition text-xs ${
                    isSelected
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Hash className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">{chan.name}</span>
                  </div>

                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTogglePrivacy(chan);
                    }}
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 transition ${
                      chan.is_syncbrief_enabled
                        ? isSelected ? 'bg-blue-700 text-white' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : isSelected ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                    title="Toggle SyncBrief AI processing for this channel (Privacy)"
                  >
                    {chan.is_syncbrief_enabled ? 'Opted In' : 'Private'}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Privacy Boundary</span>
            </div>
            <p className="leading-relaxed">
              SyncBrief only reads messages from channels marked <b>Opted In</b>. Direct Messages (DMs) are never accessed.
            </p>
          </div>
        </div>

        {/* Chat Feed */}
        <div className="lg:col-span-3 flex flex-col h-[650px]">
          {/* Channel Header */}
          <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hash className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {activeChannelName}
              </h3>
              <span className="text-xs text-slate-400 font-normal hidden sm:inline">
                &bull; {activeChannel?.description || 'Active engineering thread'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => activeChannel && handleTogglePrivacy(activeChannel)}
                className={`text-xs px-2.5 py-1 rounded-full font-semibold border transition ${
                  activeChannel?.is_syncbrief_enabled
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950 dark:border-emerald-700 dark:text-emerald-300'
                    : 'bg-slate-100 border-slate-300 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                }`}
              >
                {activeChannel?.is_syncbrief_enabled ? '✓ SyncBrief Enabled' : '⊘ Opted Out (Private)'}
              </button>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((msg) => {
              const isTargetHighlight = highlightedId === msg.id;

              return (
                <div
                  key={msg.id}
                  id={msg.id}
                  ref={isTargetHighlight ? highlightedRef : null}
                  className={`p-3.5 rounded-xl transition-all ${
                    isTargetHighlight
                      ? 'citation-highlight bg-emerald-50/90 dark:bg-emerald-950/50 shadow-md ring-2 ring-emerald-500/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 border border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={msg.author_avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'}
                      alt={msg.author_name}
                      className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-slate-200 dark:ring-slate-700"
                    />

                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">
                          {msg.author_name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ({msg.id})
                        </span>
                        {msg.thread_id && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                            {msg.thread_id}
                          </span>
                        )}
                        {isTargetHighlight && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white animate-pulse">
                            Cited Evidence
                          </span>
                        )}
                      </div>

                      <p className={`text-xs sm:text-sm leading-relaxed ${
                        isTargetHighlight ? 'text-emerald-950 dark:text-emerald-100 font-medium' : 'text-slate-700 dark:text-slate-300'
                      }`}>
                        {msg.content}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* New Message Input */}
          <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60">
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-2 shadow-xs">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={`Post message to ${activeChannelName} (creates new chat evidence)...`}
                className="flex-1 text-xs sm:text-sm px-2 bg-transparent focus:outline-none text-slate-900 dark:text-white"
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
