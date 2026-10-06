import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showText = false,
  className = '',
}) => {
  const sizeMap = {
    sm: { icon: 'w-6 h-6', text: 'text-xs', badge: 'text-[9px] px-1 py-0.2' },
    md: { icon: 'w-8 h-8', text: 'text-sm', badge: 'text-[10px] px-1.5 py-0.2' },
    lg: { icon: 'w-10 h-10', text: 'text-lg', badge: 'text-xs px-2 py-0.5' },
    xl: { icon: 'w-12 h-12', text: 'text-xl', badge: 'text-xs px-2 py-0.5' },
  };

  const currentSize = sizeMap[size];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Dynamic Geometric SyncBrief Logo Icon */}
      <div
        className={`${currentSize.icon} rounded-xl shadow-md shadow-sky-500/15 hover:scale-105 transition-transform duration-200 shrink-0 overflow-hidden ring-1 ring-white/10`}
      >
        <svg
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          <defs>
            <linearGradient id="logoBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0F172A" />
              <stop offset="100%" stopColor="#020617" />
            </linearGradient>

            <linearGradient id="logoTopGrad" x1="18" y1="15" x2="44" y2="36" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#00F5FF" />
              <stop offset="50%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#2563EB" />
            </linearGradient>

            <linearGradient id="logoBottomGrad" x1="46" y1="49" x2="20" y2="28" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#818CF8" />
              <stop offset="50%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>

            <linearGradient id="logoBorderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#6366F1" stopOpacity="0.15" />
            </linearGradient>

            <radialGradient id="logoGlowGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#0F172A" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Squircle Base */}
          <rect x="1.5" y="1.5" width="61" height="61" rx="16" fill="url(#logoBgGrad)" />
          <rect x="1.5" y="1.5" width="61" height="61" rx="16" fill="url(#logoGlowGrad)" />
          <rect x="1.5" y="1.5" width="61" height="61" rx="16" stroke="url(#logoBorderGrad)" strokeWidth="1.2" />

          {/* Upper Sync Loop (S top curve) */}
          <path
            d="M 20 28 C 20 19.5 25.5 15 33 15 C 41 15 44.5 19.5 44.5 25.5 C 44.5 31.5 39.5 35 32 37.5"
            stroke="url(#logoTopGrad)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Lower Sync Loop (S bottom curve) */}
          <path
            d="M 44 36 C 44 44.5 38.5 49 31 49 C 23 49 19.5 44.5 19.5 38.5 C 19.5 32.5 24.5 29 32 26.5"
            stroke="url(#logoBottomGrad)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Core Kinetic Spark Node */}
          <circle cx="32" cy="32" r="2.6" fill="#38BDF8" />
          <circle cx="32" cy="32" r="1.2" fill="#FFFFFF" />
        </svg>
      </div>

      {/* Optional Wordmark */}
      {showText && (
        <div className="flex items-center gap-1.5 leading-none">
          <span className={`font-extrabold ${currentSize.text} text-slate-900 dark:text-white tracking-tight`}>
            SyncBrief
          </span>
          <span className={`font-bold ${currentSize.badge} rounded bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300`}>
            AI
          </span>
        </div>
      )}
    </div>
  );
};
