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
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Square,
  Zap,
  MessageSquare,
  HelpCircle,
  Loader2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { streamAssistantMessage, sendAssistantMessage } from '../api';
import { ChatMessage, EvidenceCitation } from '../types';
import { EvidenceCitationBadge } from './EvidenceCitationBadge';
import { FormattedChatMessage } from './FormattedChatMessage';

interface FloatingChatbotWidgetProps {
  isOpen: boolean;
  onToggle: () => void;
  onOpenFullDrawer?: () => void;
}

export const FloatingChatbotWidget: React.FC<FloatingChatbotWidgetProps> = ({
  isOpen,
  onToggle,
  onOpenFullDrawer
}) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedCitations, setExpandedCitations] = useState<Record<string, boolean>>({});

  const toggleCitations = (msgId: string) => {
    setExpandedCitations(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isManagerOrDirector = user?.role === 'manager' || user?.role === 'director' || user?.role === 'admin' || (user?.role_level && user.role_level <= 2);

  const quickPrompts = isManagerOrDirector
    ? [
        "What changed yesterday?",
        "What is blocking my team?",
        "Current sprint status & goal",
        "Who is working on what?",
        "Critical dependencies"
      ]
    : [
        "What tasks are assigned to me?",
        "What blockers do I currently have?",
        "What changed in my work?",
        "My performance this quarter",
        "What is our sprint goal?"
      ];

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  // Smooth scroll to bottom on message updates
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
    }
  }, [messages, isStreaming, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading || isStreaming) return;

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
    setIsStreaming(true);

    const isExplicitCitationQuery = /link|source|citation|verified|proof|evidence|verify/i.test(text);
    const botMsgId = `bot_${Date.now()}`;
    if (isExplicitCitationQuery) {
      setExpandedCitations(prev => ({ ...prev, [botMsgId]: true }));
    }
    // Temporary placeholder message that receives streaming tokens
    const botPlaceholder: ChatMessage = {
      id: botMsgId,
      role: 'assistant',
      content: '',
      citations: [],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, botPlaceholder]);

    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;

    try {
      await streamAssistantMessage(
        {
          message: text,
          conversation_id: conversationId
        },
        {
          onToken: (token: string) => {
            setIsLoading(false);
            setMessages(prev => prev.map(m => {
              if (m.id === botMsgId) {
                return { ...m, content: m.content + token };
              }
              return m;
            }));
          },
          onDone: (donePayload) => {
            if (donePayload.conversation_id) {
              setConversationId(donePayload.conversation_id);
            }
            setMessages(prev => prev.map(m => {
              if (m.id === botMsgId) {
                return {
                  ...m,
                  content: donePayload.answer || m.content,
                  citations: donePayload.citations || [],
                  insufficient_data: donePayload.insufficient_data
                };
              }
              return m;
            }));
            setIsStreaming(false);
            setIsLoading(false);
          },
          onError: (err) => {
            console.error('Streaming error, falling back to sync:', err);
            // Fallback to standard request
            sendAssistantMessage({
              message: text,
              conversation_id: conversationId
            })
              .then(resp => {
                if (resp.conversation_id) setConversationId(resp.conversation_id);
                setMessages(prev => prev.map(m => {
                  if (m.id === botMsgId) {
                    return {
                      ...m,
                      content: resp.answer,
                      citations: resp.citations || [],
                      insufficient_data: resp.insufficient_data
                    };
                  }
                  return m;
                }));
              })
              .catch(syncErr => {
                setErrorMessage(syncErr.message || 'Failed to contact SyncBrief Assistant.');
                // Remove failed placeholder
                setMessages(prev => prev.filter(m => m.id !== botMsgId));
              })
              .finally(() => {
                setIsLoading(false);
                setIsStreaming(false);
              });
          }
        },
        abortCtrl.signal
      );
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setErrorMessage(err.message || 'Failed to get a response. Please try again.');
        setIsLoading(false);
        setIsStreaming(false);
      }
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
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
    if (isStreaming) handleStopGeneration();
    setMessages([]);
    setConversationId(undefined);
    setErrorMessage(null);
    inputRef.current?.focus();
  };

  const handleCopyMessage = (id: string, content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <>
      {/* 1. FLOATING LAUNCHER BUTTON */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3">
          <button
            type="button"
            onClick={onToggle}
            aria-label="Open SyncBrief Real-Time AI Chatbot"
            title="Ask SyncBrief AI Assistant (⌘J)"
            className="group relative flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-400 text-white font-semibold text-xs shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-105 active:scale-95 transition-all duration-200"
          >
            <div className="relative flex items-center justify-center">
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-slate-900" />
            </div>
            <span className="tracking-wide">Ask SyncBrief AI</span>
            <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/20 text-white font-medium">
              ⌘J
            </span>
          </button>
        </div>
      )}

      {/* 2. FLOATING CHAT CARD (When Open) */}
      {isOpen && (
        <div 
          role="dialog"
          aria-label="SyncBrief Real-Time AI Chatbot"
          className="fixed bottom-5 right-5 z-50 w-[440px] max-w-[calc(100vw-2.5rem)] h-[620px] max-h-[calc(100vh-3rem)] rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200"
        >
          {/* HEADER */}
          <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-indigo-50/40 dark:from-slate-900 dark:to-indigo-950/30 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white leading-none">
                    SyncBrief Assistant
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    Groq 120B
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Real-time data intelligence &bull; Zero hallucination
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleResetChat}
                title="New Conversation"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Reset Conversation"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              {onOpenFullDrawer && (
                <button
                  type="button"
                  onClick={() => {
                    onToggle();
                    onOpenFullDrawer();
                  }}
                  title="Expand to Full Drawer"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label="Expand to Drawer"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={onToggle}
                title="Close Chatbot"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close Chatbot"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* CHAT MESSAGES CONTAINER */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
            {messages.length === 0 ? (
              <div className="py-4 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3 shadow-xs">
                  <Bot className="w-6 h-6" />
                </div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  Real-Time Work Intelligence
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mt-1 mb-4 leading-relaxed">
                  Answers any question strictly grounded in your active sprint, tasks, check-ins, blockers, and dependencies.
                </p>

                {/* Quick Prompts */}
                <div className="w-full text-left space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
                    Ask Anything:
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {quickPrompts.map((prompt, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSendMessage(prompt)}
                        className="text-left text-xs px-3 py-2 rounded-xl bg-slate-50 hover:bg-indigo-50/80 dark:bg-slate-800/80 dark:hover:bg-indigo-950/40 text-slate-700 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-300 border border-slate-200/80 dark:border-slate-700/80 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all flex items-center justify-between group"
                      >
                        <span>{prompt}</span>
                        <Send className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} space-y-1`}
                >
                  <div className="flex items-center gap-1.5 px-1">
                    {msg.role === 'user' ? (
                      <span className="text-[10px] font-medium text-slate-400">You &bull; {msg.timestamp}</span>
                    ) : (
                      <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" /> SyncBrief AI &bull; {msg.timestamp}
                      </span>
                    )}
                  </div>

                  <div
                    className={`group relative max-w-[92%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-xs ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-medium rounded-tr-xs'
                        : 'bg-slate-100/90 dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/80 rounded-tl-xs'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <div className="whitespace-pre-line font-medium text-white">{msg.content}</div>
                    ) : (
                      <FormattedChatMessage
                        content={msg.content}
                        isStreaming={isStreaming && msg.role === 'assistant' && msg.id === messages[messages.length - 1]?.id}
                      />
                    )}

                    {/* Insufficient Data Guardrail Alert */}
                    {msg.insufficient_data && (
                      <div className="mt-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 flex items-start gap-1.5 text-[11px] text-amber-800 dark:text-amber-300">
                        <HelpCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold">Guardrail Notice:</span> The assistant only answers using verified records in your authorized hierarchy scope.
                        </div>
                      </div>
                    )}

                    {/* Citations Section */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-700/70 space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-emerald-500" />
                          Verified Sources ({msg.citations.length})
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {msg.citations.map((citation, idx) => (
                            <EvidenceCitationBadge key={idx} citation={citation} size="sm" />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Copy button */}
                    {msg.role === 'assistant' && msg.content && (
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg.id, msg.content)}
                        title="Copy answer"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded bg-white/80 dark:bg-slate-700/80 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 shadow-xs transition-opacity"
                      >
                        {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}

            {/* LOADING STATE */}
            {isLoading && !isStreaming && (
              <div className="flex flex-col items-start space-y-1 text-xs">
                <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 px-1">
                  <Sparkles className="w-2.5 h-2.5 animate-spin" /> Grounding in live data...
                </span>
                <div className="rounded-2xl rounded-tl-xs px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-2">
                  <div className="flex space-x-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    Groq 120B synthesis...
                  </span>
                </div>
              </div>
            )}

            {/* ERROR CARD */}
            {errorMessage && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-[11px] text-rose-700 dark:text-rose-300 flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">Assistant Request Failed</p>
                  <p className="mt-0.5 text-rose-600 dark:text-rose-400">{errorMessage}</p>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* INPUT AREA */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            {isStreaming && (
              <div className="mb-2 flex items-center justify-between text-[10px] text-slate-500">
                <span className="flex items-center gap-1 font-medium text-indigo-600 dark:text-indigo-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                  Streaming real-time response from Groq...
                </span>
                <button
                  type="button"
                  onClick={handleStopGeneration}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold"
                >
                  <Square className="w-2.5 h-2.5 fill-current" /> Stop
                </button>
              </div>
            )}

            <div className="relative flex items-center">
              <input
                ref={inputRef}
                type="text"
                data-testid="floating-assistant-input"
                aria-label="Ask SyncBrief message input"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isManagerOrDirector
                    ? "Ask about blockers, tasks, sprints, checkins..."
                    : "Ask about your tasks, blockers, or goals..."
                }
                disabled={isLoading || isStreaming}
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/90 text-xs text-slate-900 dark:text-white placeholder-slate-400 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-inner disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim() || isLoading || isStreaming}
                className="absolute right-1.5 p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 disabled:hover:bg-indigo-600 transition-colors shadow-xs"
                aria-label="Send Message"
              >
                {isLoading || isStreaming ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400 px-1">
              <span>Press <kbd className="px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-[9px]">Enter</kbd> to submit</span>
              <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                <ShieldCheck className="w-2.5 h-2.5 text-emerald-500" />
                RBAC Isolated
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
