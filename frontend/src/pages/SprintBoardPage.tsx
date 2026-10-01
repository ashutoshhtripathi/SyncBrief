import React, { useState, useEffect } from 'react';
import { 
  Kanban, 
  Plus, 
  Filter, 
  Calendar, 
  User as UserIcon, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ArrowRight, 
  RotateCw, 
  Flame, 
  Layers, 
  Tag, 
  Search,
  Sparkles,
  ChevronDown,
  X,
  Check,
  Edit2,
  Copy,
  Trash2,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  fetchSprints, 
  fetchTasks, 
  updateTaskStatus, 
  updateTask,
  createTask, 
  deleteTask,
  closeSprint, 
  fetchAllUsers,
  fetchMyReports
} from '../api';
import { Sprint, Task, User } from '../types';
import { Drawer } from '../components/ui/Drawer';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

export const SprintBoardPage: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<number | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [subordinates, setSubordinates] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Slide-over inspection drawer
  const [inspectingTask, setInspectingTask] = useState<Task | null>(null);

  // Filters
  const [selectedAssignee, setSelectedAssignee] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState<number | ''>('');
  const [newTaskPriority, setNewTaskPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [newTaskDifficulty, setNewTaskDifficulty] = useState<number>(3);
  
  // Close sprint form
  const [nextSprintName, setNextSprintName] = useState('');
  const [isClosing, setIsClosing] = useState(false);

  // Drag and drop state
  const [draggingTaskId, setDraggingTaskId] = useState<number | null>(null);

  // Inline editing state
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [inlineTitle, setInlineTitle] = useState('');

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [sprintsData, allUsers] = await Promise.all([
        fetchSprints(),
        fetchAllUsers().catch(() => [])
      ]);

      setSprints(sprintsData);
      setUsers(allUsers);

      const active = sprintsData.find(s => s.status === 'active') || sprintsData[0];
      if (active) {
        setSelectedSprintId(active.id);
        const tasksData = await fetchTasks({ sprint_id: active.id });
        setTasks(tasksData);
      }

      // Load manager subordinates for task assignment
      fetchMyReports().then(setSubordinates).catch(() => {});
    } finally {
      setIsLoading(false);
    }
  };

  const handleSprintChange = async (sprintId: number) => {
    setSelectedSprintId(sprintId);
    setIsLoading(true);
    try {
      const tasksData = await fetchTasks({ sprint_id: sprintId });
      setTasks(tasksData);
    } finally {
      setIsLoading(false);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, taskId: number) => {
    e.dataTransfer.setData('text/plain', taskId.toString());
    setDraggingTaskId(taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: 'To do' | 'In progress' | 'Blocked' | 'Done') => {
    e.preventDefault();
    const taskIdStr = e.dataTransfer.getData('text/plain');
    const taskId = Number(taskIdStr) || draggingTaskId;
    setDraggingTaskId(null);

    if (!taskId) return;

    // Optimistic UI update
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return { 
          ...t, 
          status: targetStatus,
          progress_pct: targetStatus === 'Done' ? 100 : (targetStatus === 'To do' ? 0 : (t.progress_pct || 50))
        };
      }
      return t;
    }));

    try {
      const newProgress = targetStatus === 'Done' ? 100 : (targetStatus === 'To do' ? 0 : undefined);
      await updateTaskStatus(taskId, targetStatus, newProgress);
      toast.success(`Task moved to "${targetStatus}"`);
    } catch (err) {
      // Revert if error
      if (selectedSprintId) {
        fetchTasks({ sprint_id: selectedSprintId }).then(setTasks);
      }
      toast.error('Failed to move task');
    }
  };

  // Sync drawer with URL ?taskId=123
  useEffect(() => {
    const paramTaskId = searchParams.get('taskId');
    if (paramTaskId && tasks.length > 0) {
      const found = tasks.find(t => t.id === Number(paramTaskId));
      if (found) setInspectingTask(found);
    }
  }, [searchParams, tasks]);

  const handleOpenTaskDrawer = (task: Task) => {
    setInspectingTask(task);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('taskId', task.id.toString());
    setSearchParams(newParams);
  };

  const handleCloseTaskDrawer = () => {
    setInspectingTask(null);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('taskId');
    setSearchParams(newParams);
  };

  const handleUpdateInspectingTask = async (updates: Partial<Task>, forceStaleVersion = false) => {
    if (!inspectingTask) return;
    const versionToSend = forceStaleVersion ? Math.max(0, (inspectingTask.version || 1) - 1) : inspectingTask.version;
    const prevInspecting = { ...inspectingTask };
    const updated = { ...inspectingTask, ...updates };
    setInspectingTask(updated);
    setTasks(prev => prev.map(t => t.id === inspectingTask.id ? updated : t));

    try {
      const res = await updateTask(inspectingTask.id, { ...updates, version: versionToSend });
      setInspectingTask(res);
      setTasks(prev => prev.map(t => t.id === inspectingTask.id ? res : t));
      toast.success(`Task updated to v${res.version}`);
    } catch (err: any) {
      if (err.status === 409) {
        toast.error('Conflict (HTTP 409): Task was modified by another user. Reloading latest state...');
        if (selectedSprintId) {
          const fresh = await fetchTasks({ sprint_id: selectedSprintId });
          setTasks(fresh);
          const freshTask = fresh.find(t => t.id === inspectingTask.id);
          if (freshTask) setInspectingTask(freshTask);
        }
      } else {
        setInspectingTask(prevInspecting);
        setTasks(prev => prev.map(t => t.id === inspectingTask.id ? prevInspecting : t));
        toast.error(err.message || 'Failed to update task');
      }
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('Are you sure you want to delete this task? (Soft-delete will preserve audit trail)')) return;
    try {
      await deleteTask(taskId);
      toast.success('Task moved to trash (soft delete)');
      handleCloseTaskDrawer();
      if (selectedSprintId) {
        const fresh = await fetchTasks({ sprint_id: selectedSprintId });
        setTasks(fresh);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete task');
    }
  };

  // Inline Title Save
  const handleSaveInlineTitle = async (taskId: number) => {
    if (!inlineTitle.trim()) {
      setEditingTaskId(null);
      return;
    }
    const prevTasks = [...tasks];
    setTasks(tasks.map((t) => (t.id === taskId ? { ...t, title: inlineTitle.trim() } : t)));
    setEditingTaskId(null);
    try {
      await updateTask(taskId, { title: inlineTitle.trim() });
      toast.success('Task title updated');
    } catch {
      setTasks(prevTasks);
      toast.error('Failed to update task');
    }
  };

  // Create Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !selectedSprintId) return;

    try {
      const created = await createTask({
        title: newTaskTitle.trim(),
        description: newTaskDesc.trim(),
        assignee_id: newTaskAssigneeId ? Number(newTaskAssigneeId) : null,
        priority: newTaskPriority,
        difficulty: newTaskDifficulty,
        sprint_id: selectedSprintId,
        status: 'To do',
      });

      setTasks(prev => [created, ...prev]);
      setIsCreateModalOpen(false);
      setNewTaskTitle('');
      setNewTaskDesc('');
      setNewTaskAssigneeId('');
    } catch (err: any) {
      alert(`Failed to create task: ${err.message}`);
    }
  };

  // Close Sprint
  const handleCloseSprint = async () => {
    if (!selectedSprintId) return;
    setIsClosing(true);
    try {
      const currentSprint = sprints.find(s => s.id === selectedSprintId);
      const res = await closeSprint(selectedSprintId, {
        create_next_sprint: true,
        next_sprint_name: nextSprintName || `Sprint ${(currentSprint?.id || 43) + 1}`,
      });

      alert(res.message || 'Sprint closed successfully! Unfinished tasks carried over with penalty count updated.');
      setIsCloseModalOpen(false);
      loadInitialData();
    } catch (err: any) {
      alert(`Error closing sprint: ${err.message}`);
    } finally {
      setIsClosing(false);
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    const matchesAssignee = selectedAssignee === 'all' || 
      (selectedAssignee === 'unassigned' ? !task.assignee_id : task.assignee_name === selectedAssignee);
    const matchesPriority = selectedPriority === 'all' || task.priority === selectedPriority;
    const matchesSearch = !searchQuery || 
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesAssignee && matchesPriority && matchesSearch;
  });

  const columns: { key: 'To do' | 'In progress' | 'Blocked' | 'Done'; title: string; color: string; badgeColor: string }[] = [
    { key: 'To do', title: 'To Do', color: 'border-slate-300 dark:border-slate-700', badgeColor: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300' },
    { key: 'In progress', title: 'In Progress', color: 'border-blue-400 dark:border-blue-700', badgeColor: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300' },
    { key: 'Blocked', title: 'Blocked', color: 'border-rose-400 dark:border-rose-700', badgeColor: 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300' },
    { key: 'Done', title: 'Done', color: 'border-emerald-400 dark:border-emerald-700', badgeColor: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' },
  ];

  const currentSprint = sprints.find(s => s.id === selectedSprintId);
  const unfinishedCount = tasks.filter(t => t.status !== 'Done').length;

  return (
    <div className="space-y-6 pb-16">
      {/* Top Controls & Sprint Info */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Kanban className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <span>Sprint Kanban Board</span>
            </h1>
            {currentSprint && (
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                currentSprint.status === 'active' 
                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800' 
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}>
                {currentSprint.status}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Drag and drop tasks across columns. Manager assignments, Fibonacci difficulty points, and automatic carry-over tracking.
          </p>
        </div>

        {/* Actions & Sprint Selector */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Sprint Selector */}
          <div className="relative">
            <select
              value={selectedSprintId || ''}
              onChange={(e) => handleSprintChange(Number(e.target.value))}
              className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              {sprints.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.status.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          {/* Add Task Button */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Task</span>
          </button>

          {/* Close Sprint Button (for Active Sprint) */}
          {currentSprint?.status === 'active' && (
            <button
              onClick={() => setIsCloseModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition"
            >
              <RotateCw className="w-4 h-4" />
              <span>Close Sprint ({unfinishedCount} to carry over)</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Assignee Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Assignee:</span>
            <select
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 outline-hidden"
            >
              <option value="all">All Teammates</option>
              {Array.from(new Set(tasks.map(t => t.assignee_name).filter(Boolean))).map((name) => (
                <option key={name as string} value={name as string}>{name as string}</option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Priority:</span>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 outline-hidden"
            >
              <option value="all">All Priorities</option>
              <option value="High">High Priority</option>
              <option value="Medium">Medium Priority</option>
              <option value="Low">Low Priority</option>
            </select>
          </div>
        </div>

        <div className="text-slate-500 dark:text-slate-400">
          Showing <span className="font-bold text-slate-900 dark:text-white">{filteredTasks.length}</span> of {tasks.length} tasks
        </div>
      </div>

      {/* 4-Column Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {columns.map((col) => {
          const colTasks = filteredTasks.filter(t => t.status === col.key);
          const totalPoints = colTasks.reduce((acc, t) => acc + (t.difficulty || 0), 0);

          return (
            <div
              key={col.key}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.key)}
              className="flex flex-col rounded-2xl bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-3 min-h-[520px]"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 px-1 border-b border-slate-200/80 dark:border-slate-800/80 mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">{col.title}</h3>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${col.badgeColor}`}>
                    {colTasks.length}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  {totalPoints} pts
                </span>
              </div>

              {/* Task Cards */}
              <div className="flex-1 space-y-3 overflow-y-auto">
                {colTasks.map((task) => {
                  const isHigh = task.priority === 'High';
                  const isMedium = task.priority === 'Medium';

                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onClick={() => handleOpenTaskDrawer(task)}
                      className={`group p-3.5 rounded-xl bg-white dark:bg-slate-800 border ${
                        draggingTaskId === task.id ? 'opacity-40 border-dashed border-blue-500' : 'border-slate-200 dark:border-slate-700/80'
                      } shadow-xs hover:shadow-md transition cursor-pointer space-y-2.5 hover:border-blue-300 dark:hover:border-blue-700`}
                    >
                      {/* Top Badges: Priority + Difficulty + Carry-over + Version */}
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                            isHigh 
                              ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300' 
                              : isMedium
                              ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                          }`}>
                            {task.priority}
                          </span>

                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60">
                            {task.difficulty} pts
                          </span>

                          {task.carried_over_count > 0 && (
                            <span 
                              className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300"
                              title={`Carried over ${task.carried_over_count} times (-${task.carried_over_count * 25}% points)`}
                            >
                              <RotateCw className="w-2.5 h-2.5 mr-1 text-purple-600" />
                              {task.carried_over_count}x
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-700/60 text-slate-500">v{task.version || 1}</span>
                          <span className="text-[11px] font-mono text-slate-400">#{task.id}</span>
                        </div>
                      </div>

                      {/* Title with Inline Editing */}
                      {editingTaskId === task.id ? (
                        <div className="flex items-center gap-1.5 pt-0.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={inlineTitle}
                            onChange={(e) => setInlineTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveInlineTitle(task.id);
                              if (e.key === 'Escape') setEditingTaskId(null);
                            }}
                            className="flex-1 px-2 py-1 text-xs rounded-lg border border-blue-400 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveInlineTitle(task.id)}
                            className="px-2 py-1 bg-blue-600 text-white text-[10px] font-bold rounded-md hover:bg-blue-700"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-1 group/title">
                          <h4 
                            onClick={() => {
                              setEditingTaskId(task.id);
                              setInlineTitle(task.title);
                            }}
                            className="text-xs font-bold text-slate-900 dark:text-white leading-snug cursor-pointer hover:text-blue-600 transition flex-1"
                            title="Click to edit title inline"
                          >
                            {task.title}
                          </h4>
                          <button
                            onClick={() => {
                              setEditingTaskId(task.id);
                              setInlineTitle(task.title);
                            }}
                            className="opacity-0 group-hover/title:opacity-100 p-0.5 text-slate-400 hover:text-blue-600 transition shrink-0"
                            title="Edit title inline"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      {/* Description if present */}
                      {task.description && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                          {task.description}
                        </p>
                      )}

                      {/* Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                          <span>Progress</span>
                          <span>{task.progress_pct}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-300 ${
                              task.status === 'Done' ? 'bg-emerald-500' : 'bg-blue-600'
                            }`}
                            style={{ width: `${task.progress_pct}%` }}
                          />
                        </div>
                      </div>

                      {/* Footer: Assignee & Column Move Shortcuts */}
                      <div className="flex items-center justify-between pt-1 text-[11px]">
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                          {task.assignee_avatar ? (
                            <img
                              src={task.assignee_avatar}
                              alt={task.assignee_name || ''}
                              className="w-4 h-4 rounded-full object-cover"
                            />
                          ) : (
                            <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          <span className="truncate max-w-[100px]">{task.assignee_name || 'Unassigned'}</span>
                        </div>

                        {/* Quick Status Shift Controls */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          {col.key !== 'Done' && (
                            <button
                              onClick={() => {
                                const nextStatus = col.key === 'To do' ? 'In progress' : (col.key === 'In progress' ? 'Done' : 'In progress');
                                updateTaskStatus(task.id, nextStatus, nextStatus === 'Done' ? 100 : undefined).then(() => {
                                  if (selectedSprintId) fetchTasks({ sprint_id: selectedSprintId }).then(setTasks);
                                });
                              }}
                              className="p-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-blue-500"
                              title="Move forward"
                            >
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {colTasks.length === 0 && (
                  <div className="h-32 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
                    <span>No tasks in {col.title}</span>
                    <span className="text-[10px] mt-0.5">Drag a card here to update</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Create Task */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                <span>Assign New Sprint Task</span>
              </h3>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="e.g. Implement Azure KeyVault secret rotation"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  placeholder="Acceptance criteria and technical details..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Assignee */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Assignee
                  </label>
                  <select
                    value={newTaskAssigneeId}
                    onChange={(e) => setNewTaskAssigneeId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-hidden"
                  >
                    <option value="">Unassigned</option>
                    {(subordinates.length > 0 ? subordinates : users).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({u.title})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as any)}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-hidden"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                {/* Difficulty */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Points (Fibonacci)
                  </label>
                  <select
                    value={newTaskDifficulty}
                    onChange={(e) => setNewTaskDifficulty(Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-hidden"
                  >
                    <option value={1}>1 Point (Trivial)</option>
                    <option value={2}>2 Points (Minor)</option>
                    <option value={3}>3 Points (Medium)</option>
                    <option value={5}>5 Points (Substantial)</option>
                    <option value={8}>8 Points (Complex)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs"
                >
                  Create & Assign Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Close Sprint */}
      {isCloseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <RotateCw className="w-5 h-5 text-amber-500" />
                <span>Close {currentSprint?.name}</span>
              </h3>
              <button 
                onClick={() => setIsCloseModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <p>
                Closing this sprint will mark completed tasks as closed and calculate final story points.
              </p>

              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{unfinishedCount} Incomplete Tasks Will Carry Over</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Each incomplete task's <span className="font-mono font-bold">carried_over_count</span> will be incremented by 1. For quarterly appraisals, each carry-over reduces points earned by 25%.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Next Sprint Name
                </label>
                <input
                  type="text"
                  value={nextSprintName}
                  onChange={(e) => setNextSprintName(e.target.value)}
                  placeholder={`Sprint ${(currentSprint?.id || 43) + 1} (Follow-up)`}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-hidden"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsCloseModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isClosing}
                onClick={handleCloseSprint}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50"
              >
                {isClosing ? 'Closing & Carrying Over...' : 'Confirm Sprint Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. TASK INSPECTION SLIDE-OVER DRAWER                     */}
      {/* ======================================================== */}
      <Drawer
        isOpen={!!inspectingTask}
        onClose={handleCloseTaskDrawer}
        title={inspectingTask ? `Task #${inspectingTask.id} Details` : 'Task Details'}
        description={inspectingTask ? `Sprint: ${currentSprint?.name || 'Active'} • Version ${inspectingTask.version || 1}` : ''}
        width="lg"
        footer={
          inspectingTask && (
            <div className="flex items-center justify-between w-full">
              <Button
                variant="danger"
                size="sm"
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                onClick={() => handleDeleteTask(inspectingTask.id)}
              >
                Delete Task
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Copy className="w-3.5 h-3.5" />}
                  onClick={() => {
                    const url = `${window.location.origin}${window.location.pathname}?taskId=${inspectingTask.id}`;
                    navigator.clipboard.writeText(url);
                    toast.success('Deep link copied to clipboard');
                  }}
                >
                  Copy Link
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCloseTaskDrawer}
                >
                  Done
                </Button>
              </div>
            </div>
          )
        }
      >
        {inspectingTask && (
          <div className="space-y-6">
            {/* Meta Tags Row */}
            <div className="flex flex-wrap items-center gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
              <Badge
                variant={
                  inspectingTask.status === 'Done'
                    ? 'success'
                    : inspectingTask.status === 'Blocked'
                    ? 'danger'
                    : inspectingTask.status === 'In progress'
                    ? 'primary'
                    : 'neutral'
                }
                dot
              >
                {inspectingTask.status}
              </Badge>

              <Badge
                variant={
                  inspectingTask.priority === 'High'
                    ? 'danger'
                    : inspectingTask.priority === 'Medium'
                    ? 'warning'
                    : 'neutral'
                }
              >
                {inspectingTask.priority} Priority
              </Badge>

              <Badge variant="primary">
                {inspectingTask.difficulty} Story Pts
              </Badge>

              <Badge variant="neutral">
                Optimistic v{inspectingTask.version || 1}
              </Badge>

              {inspectingTask.carried_over_count > 0 && (
                <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                  <RotateCw className="w-3 h-3 mr-1 text-purple-600" />
                  Carried Over {inspectingTask.carried_over_count}x (-{inspectingTask.carried_over_count * 25}% penalty)
                </span>
              )}
            </div>

            {/* Task Title Edit */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Task Title
              </label>
              <input
                type="text"
                value={inspectingTask.title}
                onChange={(e) => setInspectingTask({ ...inspectingTask, title: e.target.value })}
                onBlur={() => handleUpdateInspectingTask({ title: inspectingTask.title })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/40 outline-hidden"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Description & Acceptance Criteria
              </label>
              <textarea
                rows={3}
                value={inspectingTask.description || ''}
                onChange={(e) => setInspectingTask({ ...inspectingTask, description: e.target.value })}
                onBlur={() => handleUpdateInspectingTask({ description: inspectingTask.description })}
                placeholder="Acceptance criteria, architectural details, or links..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/40 outline-hidden leading-relaxed"
              />
            </div>

            {/* Quick Status Shift */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Move Status
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['To do', 'In progress', 'Blocked', 'Done'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      const newProgress = s === 'Done' ? 100 : (s === 'To do' ? 0 : undefined);
                      handleUpdateInspectingTask({ 
                        status: s, 
                        progress_pct: newProgress !== undefined ? newProgress : inspectingTask.progress_pct 
                      });
                    }}
                    className={`py-2 px-1 text-xs font-bold rounded-xl border transition ${
                      inspectingTask.status === s
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Progress Slider */}
            <div className="space-y-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">Completion Progress</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{inspectingTask.progress_pct}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={inspectingTask.progress_pct}
                onChange={(e) => setInspectingTask({ ...inspectingTask, progress_pct: Number(e.target.value) })}
                onMouseUp={() => handleUpdateInspectingTask({ progress_pct: inspectingTask.progress_pct })}
                onTouchEnd={() => handleUpdateInspectingTask({ progress_pct: inspectingTask.progress_pct })}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            {/* Assignee & Difficulty */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Assignee
                </label>
                <select
                  value={inspectingTask.assignee_id || ''}
                  onChange={(e) => handleUpdateInspectingTask({ assignee_id: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white outline-hidden"
                >
                  <option value="">Unassigned</option>
                  {(subordinates.length > 0 ? subordinates : users).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.title || u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Priority
                </label>
                <select
                  value={inspectingTask.priority}
                  onChange={(e) => handleUpdateInspectingTask({ priority: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white outline-hidden"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            {/* Optimistic Concurrency Demo Box */}
            <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/60 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-xs text-sky-900 dark:text-sky-200">
                  <ShieldAlert className="w-4 h-4 text-sky-600 shrink-0" />
                  <span>Optimistic Concurrency Protection</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-200/60 dark:bg-sky-900 text-sky-900 dark:text-sky-200 font-bold">
                  Locking v{inspectingTask.version || 1}
                </span>
              </div>
              <p className="text-[11px] text-sky-800 dark:text-sky-300 leading-relaxed">
                Prevents lost updates when multiple distributed engineers work on the same task simultaneously.
              </p>
              <button
                type="button"
                onClick={() => handleUpdateInspectingTask({ title: inspectingTask.title }, true)}
                className="w-full py-2 px-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-sky-100 dark:hover:bg-slate-700 border border-sky-300 dark:border-sky-800 text-sky-800 dark:text-sky-200 text-xs font-bold transition shadow-xs"
              >
                Test Conflict Handling (Simulate Stale Version)
              </button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
