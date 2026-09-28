import React from 'react';
import { Clock, Globe, Flame } from 'lucide-react';
import { TimezoneMember } from '../types';

interface TimezoneStripProps {
  members: TimezoneMember[];
}

export const TimezoneStrip: React.FC<TimezoneStripProps> = ({ members }) => {
  if (!members || members.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-blue-500" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Global Team Presence & Timezones
          </h4>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Working Hours (Online)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-400" /> Off Hours
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {members.map((member) => (
          <div
            key={member.user_id}
            className={`flex flex-col p-2.5 rounded-lg border transition-all ${
              member.is_online
                ? 'bg-slate-50/80 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80'
                : 'bg-slate-50/40 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800 opacity-75'
            }`}
          >
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <div className="relative">
                <img
                  src={member.avatar_url || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150'}
                  alt={member.full_name}
                  className="w-7 h-7 rounded-full object-cover"
                />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${
                    member.is_online ? 'bg-emerald-500' : 'bg-slate-400'
                  }`}
                  title={member.is_online ? 'Currently within working hours' : 'Outside core working hours'}
                />
              </div>

              <div className="flex items-center text-[10px] text-amber-600 dark:text-amber-400 font-semibold gap-0.5">
                <Flame className="w-3 h-3 fill-amber-400 text-amber-500" />
                <span>{member.streak_count}d</span>
              </div>
            </div>

            <div className="font-semibold text-xs text-slate-900 dark:text-white truncate">
              {member.full_name}
            </div>

            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
              {member.tz_abbr}
            </div>

            <div className="mt-1 flex items-center gap-1 text-[11px] font-mono text-slate-700 dark:text-slate-200">
              <Clock className="w-3 h-3 text-blue-500" />
              <span>{member.local_time_str}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
