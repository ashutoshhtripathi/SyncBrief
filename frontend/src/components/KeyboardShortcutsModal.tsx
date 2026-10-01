import React from 'react';
import { Dialog } from './ui/Dialog';
import { Keyboard, ArrowRight } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const shortcutGroups = [
    {
      category: 'General & Navigation',
      items: [
        { keys: ['⌘', 'K'], desc: 'Open Command Palette' },
        { keys: ['/'], desc: 'Search or focus search' },
        { keys: ['?'], desc: 'Show keyboard shortcuts cheat-sheet' },
        { keys: ['ESC'], desc: 'Close dialog, drawer, or search' },
      ],
    },
    {
      category: 'Actions',
      items: [
        { keys: ['C'], desc: 'Quick add new task' },
        { keys: ['⌘', '↵'], desc: 'Submit check-in or save task modal' },
      ],
    },
    {
      category: 'Jump to Page (G then ...)',
      items: [
        { keys: ['G', 'T'], desc: 'Jump to Today Dashboard' },
        { keys: ['G', 'B'], desc: 'Jump to Sprints Kanban Board' },
        { keys: ['G', 'C'], desc: 'Jump to 60s Check-in' },
        { keys: ['G', 'D'], desc: 'Jump to Daily Standup Digest' },
        { keys: ['G', 'P'], desc: 'Jump to My Points & Velocity' },
        { keys: ['G', 'A'], desc: 'Jump to Team Appraisal Review' },
      ],
    },
  ];

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Keyboard Shortcuts"
      description="Navigate SyncBrief at the speed of thought without touching the mouse"
      maxWidth="lg"
    >
      <div className="space-y-6">
        {shortcutGroups.map((group) => (
          <div key={group.category} className="space-y-2.5">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {group.category}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {group.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs"
                >
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    {item.desc}
                  </span>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {item.keys.map((k, kIdx) => (
                      <kbd
                        key={kIdx}
                        className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 shadow-2xs"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="text-center pt-2 text-[11px] text-slate-400">
          SyncBrief AI &bull; Engineered for sub-10 second task management
        </div>
      </div>
    </Dialog>
  );
};
