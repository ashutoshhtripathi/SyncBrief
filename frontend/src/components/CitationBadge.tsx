import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';
import { CitationItem } from '../types';

interface CitationBadgeProps {
  citation: CitationItem;
  size?: 'sm' | 'md';
}

export const CitationBadge: React.FC<CitationBadgeProps> = ({ citation, size = 'md' }) => {
  const navigate = useNavigate();
  const isVerified = citation.status === 'VERIFIED';
  const channelDisplay = citation.channel.startsWith('#') ? citation.channel : `#${citation.channel}`;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Navigate to channel simulator and highlight message
    const channelName = citation.channel.replace('#', '');
    navigate(`/channels?channel=${encodeURIComponent(channelName)}&highlight=${encodeURIComponent(citation.message_id)}`);
  };

  return (
    <div
      onClick={handleClick}
      className={`group inline-flex items-center gap-2 rounded-xl border transition-all duration-150 cursor-pointer select-none shadow-xs ${
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-xs sm:text-sm'
      } ${
        isVerified
          ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 hover:shadow-md hover:border-emerald-400'
          : 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/60 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 hover:shadow-md'
      }`}
      title={isVerified ? `Verified chat evidence in ${channelDisplay} by ${citation.author || 'Author'}. Click to inspect message.` : (citation.rejection_reason || 'Unverified citation')}
    >
      <div className="flex items-center gap-1.5 shrink-0">
        {isVerified ? (
          <CheckCircle2 className={`${size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-emerald-600 dark:text-emerald-400`} />
        ) : (
          <AlertTriangle className={`${size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-amber-600 dark:text-amber-400`} />
        )}
        <span className="font-bold tracking-tight">
          {isVerified ? 'Verified Link' : 'Unverified'}
        </span>
      </div>

      <span className="opacity-80 font-mono text-[11px] flex items-center gap-0.5">
        {channelDisplay} &bull; {citation.message_id}
      </span>

      <ExternalLink className="w-3 h-3 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
    </div>
  );
};
