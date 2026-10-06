import React, { useState } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  Kanban, 
  Layers, 
  MessageSquare, 
  ShieldCheck,
  Clock,
  User,
  Quote,
  Target,
  GitFork
} from 'lucide-react';
import { EvidenceCitation } from '../types';

interface EvidenceCitationBadgeProps {
  citation: EvidenceCitation;
  size?: 'sm' | 'md';
  className?: string;
}

export const EvidenceCitationBadge: React.FC<EvidenceCitationBadgeProps> = ({ 
  citation, 
  size = 'sm',
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isVerified = citation.verified;

  const getSourceIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'dependency':
      case 'task_dependency':
        return <GitFork className="w-3 h-3 text-cyan-500 shrink-0" />;
      case 'goal':
      case 'performance_goal':
        return <Target className="w-3 h-3 text-purple-500 shrink-0" />;
      case 'task':
        return <Kanban className="w-3 h-3 text-blue-500 shrink-0" />;
      case 'checkin':
        return <MessageSquare className="w-3 h-3 text-sky-500 shrink-0" />;
      case 'blocker':
        return <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />;
      case 'sprint':
        return <Layers className="w-3 h-3 text-indigo-500 shrink-0" />;
      case 'digest':
      default:
        return <FileText className="w-3 h-3 text-slate-500 shrink-0" />;
    }
  };

  const formatSourceLabel = (type: string, id: string) => {
    const capitalized = type.charAt(0).toUpperCase() + type.slice(1);
    return `${capitalized} #${id}`;
  };

  return (
    <div className={`inline-block relative ${className}`} data-testid={`evidence-${citation.source_type}-${citation.source_id}`}>
      {/* Clickable Compact Trigger Pill */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded((prev) => !prev);
        }}
        className={`group inline-flex items-center gap-1.5 rounded-xl border transition-all duration-150 cursor-pointer select-none font-medium shadow-xs ${
          size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
        } ${
          isVerified
            ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 hover:border-emerald-400'
            : 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/60 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 hover:border-amber-400'
        }`}
        title={isVerified ? 'Verified evidence citation. Click to inspect source.' : (citation.rejection_reason || 'Unverified citation')}
      >
        <span className="flex items-center gap-1 shrink-0 font-bold">
          {isVerified ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          )}
          <span>{isVerified ? '✓ Verified' : 'Unverified'}</span>
        </span>

        <span className="opacity-60">•</span>

        <span className="font-mono text-[10px] tracking-tight flex items-center gap-1">
          {getSourceIcon(citation.source_type)}
          <span>{formatSourceLabel(citation.source_type, citation.source_id)}</span>
        </span>

        {isExpanded ? (
          <ChevronUp className="w-3 h-3 opacity-60 group-hover:opacity-100 transition" />
        ) : (
          <ChevronDown className="w-3 h-3 opacity-60 group-hover:opacity-100 transition" />
        )}
      </button>

      {/* Expanded Verified Evidence Detail Card */}
      {isExpanded && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="mt-2 w-full max-w-md p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-2.5 text-left text-xs z-30 relative animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Card Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className={`w-4 h-4 ${isVerified ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'}`} />
              <span className="font-bold text-slate-900 dark:text-white">
                {isVerified ? 'Verified Source Evidence' : 'Unverified Citation'}
              </span>
            </div>
            <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {formatSourceLabel(citation.source_type, citation.source_id)}
            </span>
          </div>

          {/* Title & Metadata */}
          <div className="space-y-1">
            <div className="font-semibold text-slate-900 dark:text-white leading-snug">
              {citation.title}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3 text-slate-400" />
                <span>{citation.author_or_owner || 'Unknown'}</span>
              </span>
              {citation.timestamp && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>{citation.timestamp}</span>
                </span>
              )}
            </div>
          </div>

          {/* Excerpt Quote */}
          {citation.excerpt && (
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850/80 border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
              <div className="flex items-start gap-1.5">
                <Quote className="w-3 h-3 text-blue-500 shrink-0 mt-0.5 opacity-70" />
                <span className="italic">{citation.excerpt}</span>
              </div>
            </div>
          )}

          {/* Rejection notice if unverified */}
          {!isVerified && citation.rejection_reason && (
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-[11px] text-amber-800 dark:text-amber-300">
              <span className="font-bold">Validation rejection: </span>
              <span>{citation.rejection_reason}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              ✓ Grounded in SyncBrief audit records
            </span>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium hover:underline"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

interface EvidenceCitationGroupProps {
  citations: EvidenceCitation[];
  size?: 'sm' | 'md';
  className?: string;
}

export const EvidenceCitationGroup: React.FC<EvidenceCitationGroupProps> = ({ 
  citations, 
  size = 'sm',
  className = '' 
}) => {
  if (!citations || citations.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {citations.map((c, idx) => (
        <EvidenceCitationBadge 
          key={`${c.source_type}-${c.source_id}-${idx}`} 
          citation={c} 
          size={size} 
        />
      ))}
    </div>
  );
};
