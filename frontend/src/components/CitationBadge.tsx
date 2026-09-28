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

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Navigate to channel simulator and highlight message
    const channelName = citation.channel.replace('#', '');
    navigate(`/channels?channel=${encodeURIComponent(channelName)}&highlight=${encodeURIComponent(citation.message_id)}`);
  };

  return (
    <div
      onClick={handleClick}
      className={`group inline-flex items-center gap-1.5 rounded-full border transition-all cursor-pointer select-none ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      } ${
        isVerified
          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 hover:shadow-sm'
          : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/60 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60'
      }`}
      title={isVerified ? `Verified chat evidence in ${citation.channel}. Click to inspect thread.` : (citation.rejection_reason || 'Unverified citation')}
    >
      {isVerified ? (
        <CheckCircle2 className={`${size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-emerald-600 dark:text-emerald-400 shrink-0`} />
      ) : (
        <AlertTriangle className={`${size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-amber-600 dark:text-amber-400 shrink-0`} />
      )}

      <span className="font-semibold">
        {isVerified ? 'Verified Link' : 'Unverified'}
      </span>
      <span className="opacity-75 font-mono text-[11px]">
        {citation.channel} &bull; {citation.message_id}
      </span>
      <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
    </div>
  );
};
