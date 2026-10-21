import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  X, 
  Send, 
  RotateCcw, 
  ShieldCheck, 
  AlertCircle, 
  Bot, 
  User as UserIcon,
  HelpCircle,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { sendAssistantMessage } from '../api';
import { ChatMessage, EvidenceCitation } from '../types';
import { EvidenceCitationBadge } from './EvidenceCitationBadge';
import { FormattedChatMessage } from './FormattedChatMessage';

interface AskSyncBriefDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
}

export const AskSyncBriefDrawer: React.FC<AskSyncBriefDrawerProps> = ({
  isOpen,
  onClose,
  initialPrompt
}) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedCitations, setExpandedCitations] = useState<Record<string, boolean>>({});

  const toggleCitations = (msgId: string) => {
    setExpandedCitations(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isManagerOrDirector = user?.role === 'manager' || user?.role === 'director' || user?.role === 'admin' || (user?.role_level && user.role_level <= 2);

  // Quick prompt presets based on role
  const quickPrompts = isManagerOrDirector
    ? [
        "What changed yesterday?",
        "What is blocking my team?",
        "Critical dependencies",
        "Current sprint risks",
        "How is Priya performing?"
      ]
    : [
        "What changed in my work?",
        "What blockers do I currently have?",
        "My performance this quarter",
        "What tasks are assigned to me?"
      ];

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  // Handle initial prompt if provided
  useEffect(() => {
    if (isOpen && initialPrompt && messages.length === 0) {
      handleSendMessage(initialPrompt);
    }
  }, [isOpen, initialPrompt]);

  // Scroll to bottom on message updates
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    setErrorMessage(null);
    const userMsgId = `user_${Date.now()}`;
    const newMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, newMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      const resp = await sendAssistantMessage({
        message: text,
        conversation_id: conversationId
      });

      if (resp.conversation_id) {
        setConversationId(resp.conversation_id);
      }

      const isExplicitCitationQuery = /link|source|citation|verified|proof|evidence|verify/i.test(text);
      const botMsgId = `bot_${Date.now()}`;
      if (isExplicitCitationQuery) {
        setExpandedCitations(prev => ({ ...prev, [botMsgId]: true }));
      }
      const botMsg: ChatMessage = {
        id: botMsgId,
        role: 'assistant',
        content: resp.answer,
        citations: resp.citations || [],
        insufficient_data: resp.insufficient_data,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to get a response from SyncBrief Assistant. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleResetChat = () => {
    setMessages([]);
    setConversationId(undefined);
    setErrorMessage(null);
    inputRef.current?.focus();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-sm transition-opacity animate-in fade-in duration-200">
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div 
          role="dialog"
          aria-modal="true"
          aria-label="Ask SyncBrief Assistant"
          className="w-screen max-w-xl bg-white dark:bg-slate-900 shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 transition-transform duration-300"
        >
          {/* HEADER */}
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white leading-none">
                    Ask SyncBrief
                  </h2>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <ShieldCheck className="w-3 h-3 text-emerald-500" />
                    Verified Evidence
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    ⚡ Groq 120B
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Grounded strictly in your authorized work intelligence
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleResetChat}
                title="New Conversation"
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Reset Conversation"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                title="Close"
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close Assistant Drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* CHAT MESSAGES BODY */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.length === 0 ? (
              <div className="py-6 flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4 shadow-sm">
                  <Bot className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Ask your authorized work intelligence
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1 mb-6 leading-relaxed">
                  SyncBrief Assistant answers natural language questions using verified database records. Non-hallucinatory, role-isolated, and traceable.
                </p>

                {/* Quick Prompts Chips */}
                <div className="w-full text-left space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
                    Suggested Questions
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {quickPrompts.map((prompt, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSendMessage(prompt)}
                        className="text-xs text-left px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800/80 dark:hover:bg-indigo-950/40 text-slate-700 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-300 border border-slate-200/80 dark:border-slate-700/80 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all shadow-sm"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} space-y-1.5`}
                >
                  <div className="flex items-center gap-1.5 px-1">
                    {msg.role === 'user' ? (
                      <span className="text-[11px] font-medium text-slate-400">You &bull; {msg.timestamp}</span>
                    ) : (
                      <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> SyncBrief &bull; {msg.timestamp}
                      </span>
                    )}
                  </div>

                  <div
                    className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-medium rounded-tr-sm'
                        : 'bg-slate-100/90 dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/80 rounded-tl-sm'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <p className="whitespace-pre-line font-medium text-white">{msg.content}</p>
                    ) : (
                      <FormattedChatMessage content={msg.content} />
                    )}

                    {/* Insufficient Data Alert */}
                    {msg.insufficient_data && (
                      <div className="mt-2.5 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                        <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold">Guardrail Notice:</span> The assistant only answers using verified records in your authorized hierarchy scope.
                        </div>
                      </div>
                    )}

                    {/* Citations Section */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-200/70 dark:border-slate-700/70 space-y-1.5">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                          Verified Citations ({msg.citations.length})
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {msg.citations.map((citation, idx) => (
                            <EvidenceCitationBadge key={idx} citation={citation} size="sm" />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {/* LOADING SKELETON */}
            {isLoading && (
              <div className="flex flex-col items-start space-y-1.5">
                <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 px-1">
                  <Sparkles className="w-3 h-3 animate-spin" /> SyncBrief is thinking...
                </span>
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3 bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-3">
                  <div className="flex space-x-1.5">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Grounding response in authorized SyncBrief records...
                  </span>
                </div>
              </div>
            )}

            {/* ERROR CARD */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">Assistant Request Failed</p>
                  <p className="mt-0.5 text-rose-600 dark:text-rose-400">{errorMessage}</p>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* INPUT & FOOTER */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="relative flex items-center">
              <input
                ref={inputRef}
                data-testid="assistant-input"
                aria-label="Ask SyncBrief message input"
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isManagerOrDirector
                    ? "Ask about blockers, what changed, dependencies, or performance..."
                    : "Ask about your tasks, blockers, or performance goals..."
                }
                disabled={isLoading}
                className="w-full pl-4 pr-12 py-3 rounded-xl bg-slate-100 dark:bg-slate-800/90 text-sm text-slate-900 dark:text-white placeholder-slate-400 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-inner disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim() || isLoading}
                className="absolute right-2 p-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 disabled:hover:bg-indigo-600 transition-colors shadow-sm"
                aria-label="Send Message"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span>Press <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[10px] font-mono">Enter</kbd> to submit</span>
              <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                Zero external database leakage
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
