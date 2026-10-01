import React, { useState } from 'react';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  src?: string | null;
  name: string;
  size?: AvatarSize;
  isOnline?: boolean;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  isOnline,
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);

  const sizeClasses: Record<AvatarSize, { container: string; text: string; dot: string }> = {
    xs: { container: 'w-5 h-5', text: 'text-[9px]', dot: 'w-1.5 h-1.5' },
    sm: { container: 'w-7 h-7', text: 'text-[11px]', dot: 'w-2 h-2' },
    md: { container: 'w-8 h-8', text: 'text-xs', dot: 'w-2.5 h-2.5' },
    lg: { container: 'w-10 h-10', text: 'text-sm', dot: 'w-3 h-3' },
    xl: { container: 'w-14 h-14', text: 'text-base font-bold', dot: 'w-3.5 h-3.5' },
  };

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className={`relative inline-flex shrink-0 ${sizeClasses[size].container} ${className}`}>
      {src && !imgError ? (
        <img
          src={src}
          alt={name}
          onError={() => setImgError(true)}
          className="w-full h-full rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700"
        />
      ) : (
        <div className={`w-full h-full rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-semibold flex items-center justify-center ring-1 ring-blue-200 dark:ring-blue-800 ${sizeClasses[size].text}`}>
          {initials || '?'}
        </div>
      )}

      {isOnline !== undefined && (
        <span
          className={`absolute bottom-0 right-0 rounded-full ring-2 ring-white dark:ring-slate-900 ${
            sizeClasses[size].dot
          } ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`}
        />
      )}
    </div>
  );
};
