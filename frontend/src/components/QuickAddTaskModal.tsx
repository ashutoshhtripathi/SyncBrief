import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Sparkles, Check, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { createTask, fetchAllUsers, fetchSprints } from '../api';
import { User, Sprint } from '../types';

interface QuickAddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated?: () => void;
}

export const QuickAddTaskModal: React.FC<QuickAddTaskModalProps> = ({
  isOpen,
  onClose,
  onTaskCreated,
}) => {
  const { user } = useAuth();
  const toast = useToast();
  const titleInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [difficulty, setDifficulty] = useState<number>(3);
  const [assigneeId, setAssigneeId] = useState<number | undefined>(user?.id);
  const [sprintId, setSprintId] = useState<number | undefined>(undefined);

  const [users, setUsers] = useState<User[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setPriority('Medium');
      setDifficulty(3);
      setAssigneeId(user?.id);

      Promise.all([fetchAllUsers(), fetchSprints()]).then(([allUsers, allSprints]) => {
        setUsers(allUsers);
        setSprints(allSprints);
        const activeSprint = allSprints.find((s) => s.status === 'active') || allSprints[0];
        if (activeSprint) {
          setSprintId(activeSprint.id);
        }
      }).catch(() => {});

      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, user?.id]);

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim()) {
      toast.warning('Please enter a task title');
      titleInputRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      await createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        difficulty,
        assignee_id: assigneeId || user?.id,
        sprint_id: sprintId,
        status: 'To do',
        progress_pct: 0,
      });

      toast.success(`Task "${title.trim()}" created successfully!`);
      if (onTaskCreated) onTaskCreated();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Quick Add Task</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Press C anytime to open &bull; Cmd+Enter to save</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Task Title <span className="text-rose-500">*</span>
            </label>
            <input
              ref={titleInputRef}
              type="text"
              placeholder="e.g. Implement webhook authentication for Teams connector"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Priority Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Priority
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/70 rounded-xl">
                {(['Low', 'Medium', 'High'] as const).map((p) => {
                  const isSelected = priority === p;
                  let color = isSelected ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900';
                  if (isSelected && p === 'High') color = 'bg-rose-600 text-white shadow-xs';
                  if (isSelected && p === 'Medium') color = 'bg-amber-600 text-white shadow-xs';
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`py-1.5 text-xs font-semibold rounded-lg transition ${color}`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Story Points / Difficulty Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Story Points (Fibonacci)
              </label>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 5, 8].map((pts) => (
                  <button
                    key={pts}
                    type="button"
                    onClick={() => setDifficulty(pts)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                      difficulty === pts
                        ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-500/20'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {pts}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Assignee & Sprint */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Assignee
                </label>
                {user && assigneeId !== user.id && (
                  <button
                    type="button"
                    onClick={() => setAssigneeId(user.id)}
                    className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    Assign to me
                  </button>
                )}
              </div>
              <select
                value={assigneeId || ''}
                onChange={(e) => setAssigneeId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.title})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Sprint Target
              </label>
              <select
                value={sprintId || ''}
                onChange={(e) => setSprintId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                {sprints.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.status})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Optional Short Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Short Description / Acceptance Criteria <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Key deliverable or acceptance note..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Modal Actions */}
          <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
            <div className="text-[11px] text-slate-400">
              Formula: <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">{difficulty} pts</span> on completion
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !title.trim()}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Creating...' : 'Create Task'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
