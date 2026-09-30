import React from 'react';
import { Clock, Globe, Flame, Sun, Moon } from 'lucide-react';
import { TimezoneMember } from '../types';

interface TimezoneStripProps {
  members: TimezoneMember[];
}

export const TimezoneStrip: React.FC<TimezoneStripProps> = ({ members }) => {
  if (!members || members.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Global Team Presence & Timezones
          </h4>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Core Working Hours
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" /> Outside Core Hours
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {members.map((member) => (
          <div
            key={member.user_id}
            className={`flex flex-col p-3 rounded-2xl border transition-all ${
              member.is_online
                ? 'bg-slate-50/80 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 shadow-2xs hover:shadow-xs'
                : 'bg-slate-50/30 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800/80 opacity-70'
            }`}
          >
            <div className="flex items-center justify-between gap-1 mb-2">
              <div className="relative">
                <img
                  src={member.avatar_url || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150'}
                  alt={member.full_name}
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-slate-200 dark:ring-slate-700"
                />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${
                    member.is_online ? 'bg-emerald-500' : 'bg-slate-400'
                  }`}
                  title={member.is_online ? 'Within working hours' : 'Outside core working hours'}
                />
              </div>

              <div className="flex items-center text-[10px] text-amber-600 dark:text-amber-400 font-bold gap-0.5 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded-md">
                <Flame className="w-3 h-3 fill-amber-400 text-amber-500" />
                <span>{member.streak_count}d</span>
              </div>
            </div>

            <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
              {member.full_name}
            </div>

            <div className="text-[10px] text-slate-400 truncate">
              {member.tz_abbr} &bull; {member.role}
            </div>

            <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-700 dark:text-slate-200">
              <div className="flex items-center gap-1">
                {member.is_online ? (
                  <Sun className="w-3 h-3 text-amber-500" />
                ) : (
                  <Moon className="w-3 h-3 text-slate-400" />
                )}
                <span>{member.local_time_str}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
