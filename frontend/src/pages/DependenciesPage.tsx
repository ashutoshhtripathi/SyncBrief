import React, { useState, useEffect } from 'react';
import { 
  GitFork, 
  AlertTriangle, 
  Clock, 
  Layers, 
  Kanban, 
  Plus, 
  CheckCircle2, 
  X, 
  Filter, 
  ArrowRight, 
  RefreshCw,
  Search,
  Trash2,
  ShieldCheck,
  Flame,
  Network
} from 'lucide-react';
import { 
  fetchDependencies, 
  fetchDependencySummary, 
  createDependency, 
  updateDependencyStatus, 
  deleteDependency,
  fetchTasks 
} from '../api';
import { 
  DependencyItem, 
  DependencySummaryResponse, 
  Task 
} from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { EvidenceCitationBadge } from '../components/EvidenceCitationBadge';

export const DependenciesPage: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [dependencies, setDependencies] = useState<DependencyItem[]>([]);
  const [summary, setSummary] = useState<DependencySummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Filters state
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [crossTeamOnly, setCrossTeamOnly] = useState<boolean>(false);
  const [agingOnly, setAgingOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Add dependency modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [availableTasks, setAvailableTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<number | ''>('');
  const [selectedPrereqTaskId, setSelectedPrereqTaskId] = useState<number | ''>('');
  const [dependencyType, setDependencyType] = useState<string>('blocks');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const loadDependencies = async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const filters: any = {};
      if (statusFilter !== 'all') filters.status = statusFilter;
      if (severityFilter !== 'all') filters.severity = severityFilter;
      if (crossTeamOnly) filters.cross_team_only = true;
      if (agingOnly) filters.aging = true;
      if (searchQuery.trim()) filters.team = searchQuery.trim();

      const data = await fetchDependencies(filters);
      setDependencies(data.dependencies);
      setSummary(data.summary);
    } catch (err: any) {
      setIsError(true);
      setErrorMessage(err.message || 'Failed to load cross-team dependencies');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDependencies();
  }, [statusFilter, severityFilter, crossTeamOnly, agingOnly]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadDependencies();
  };

  const openAddModal = async () => {
    setIsModalOpen(true);
    try {
      const taskList = await fetchTasks();
      setAvailableTasks(taskList);
      if (taskList.length > 0) {
        setSelectedTaskId(taskList[0].id);
        if (taskList.length > 1) {
          setSelectedPrereqTaskId(taskList[1].id);
        }
      }
    } catch (err) {
      toast.error('Failed to load tasks for selection');
    }
  };

  const handleCreateDependency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskId || !selectedPrereqTaskId) {
      toast.warning('Please select both dependent and prerequisite tasks');
      return;
    }
    if (selectedTaskId === selectedPrereqTaskId) {
      toast.error('A task cannot depend on itself');
      return;
    }

    setIsSubmitting(true);
    try {
      await createDependency({
        task_id: Number(selectedTaskId),
        depends_on_task_id: Number(selectedPrereqTaskId),
        dependency_type: dependencyType,
        notes: notes.trim() || undefined
      });
      toast.success('Task dependency created successfully');
      setIsModalOpen(false);
      setNotes('');
      loadDependencies();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create dependency');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusToggle = async (dep: DependencyItem) => {
    const nextStatus = dep.status === 'resolved' ? 'open' : 'resolved';
    try {
      await updateDependencyStatus(dep.dependency_id, nextStatus);
      toast.success(`Dependency marked as ${nextStatus}`);
      loadDependencies();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update dependency status');
    }
  };

  const handleDelete = async (depId: string) => {
    if (!confirm('Are you sure you want to remove this explicit task dependency?')) return;
    try {
      await deleteDependency(depId);
      toast.success('Dependency removed');
      loadDependencies();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove dependency');
    }
  };

  const getSeverityBadge = (severity: string) => {
    const s = severity.toLowerCase();
    if (s === 'critical') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800/60">
          <Flame className="w-3 h-3 text-rose-600" /> Critical
        </span>
      );
    }
    if (s === 'high') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60">
          <AlertTriangle className="w-3 h-3 text-amber-600" /> High
        </span>
      );
    }
    if (s === 'medium') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800/60">
          Medium
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
        Low
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" data-testid="dependencies-page">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 dark:bg-blue-950/80 rounded-xl text-blue-600 dark:text-blue-400">
              <GitFork className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Cross-Team Dependency Intelligence
                <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-md font-medium">
                  Verified
                </span>
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                Deterministic tracking of who is waiting on whom, blocked work items, aging dependencies, and active sprint delivery impact.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadDependencies}
            className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-850 transition"
            title="Refresh dependencies"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={openAddModal}
            data-testid="add-dependency-btn"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            Add Dependency
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4" data-testid="dependency-summary-cards">
          <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Critical Blockers
              </span>
              <Flame className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
              {summary.critical_count}
            </div>
            <div className="text-xs text-slate-500 mt-1">Requires immediate unblocking</div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                High Priority
              </span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
              {summary.high_count}
            </div>
            <div className="text-xs text-slate-500 mt-1">High impact dependencies</div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-orange-200 dark:border-orange-900/50 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                Aging (&ge;2 Days)
              </span>
              <Clock className="w-4 h-4 text-orange-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
              {summary.aging_count}
            </div>
            <div className="text-xs text-slate-500 mt-1">Stalled beyond 48 hours</div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-900/50 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                Cross-Team
              </span>
              <Network className="w-4 h-4 text-sky-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
              {summary.cross_team_count}
            </div>
            <div className="text-xs text-slate-500 mt-1">Across organizational boundaries</div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/50 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Affected Tasks
              </span>
              <Kanban className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
              {summary.affected_tasks_count}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              In {summary.affected_sprints_count} sprint{summary.affected_sprints_count === 1 ? '' : 's'}
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'active'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('resolved')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'resolved'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Resolved
            </button>
          </div>

          {/* Quick Toggles */}
          <button
            type="button"
            onClick={() => setCrossTeamOnly(!crossTeamOnly)}
            data-testid="toggle-cross-team"
            className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition ${
              crossTeamOnly
                ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-400 text-sky-700 dark:text-sky-300 font-semibold'
                : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
            }`}
          >
            ↔ Cross-Team Only
          </button>

          <button
            type="button"
            onClick={() => setAgingOnly(!agingOnly)}
            data-testid="toggle-aging"
            className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition ${
              agingOnly
                ? 'bg-orange-50 dark:bg-orange-950/60 border-orange-400 text-orange-700 dark:text-orange-300 font-semibold'
                : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
            }`}
          >
            ⏳ Aging Only
          </button>

          {/* Severity Dropdown */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 text-xs text-slate-700 dark:text-slate-300"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by team or owner..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 w-52"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium transition"
          >
            Apply
          </button>
        </form>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl" data-testid="dependencies-loading">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Analyzing cross-team dependencies and active sprint delivery impact...
          </p>
        </div>
      )}

      {/* Error State */}
      {!isLoading && isError && (
        <div className="p-6 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-2xl text-center" data-testid="dependencies-error">
          <AlertTriangle className="w-8 h-8 text-rose-600 dark:text-rose-400 mx-auto mb-2" />
          <h3 className="text-base font-semibold text-rose-900 dark:text-rose-200">Unable to load dependencies</h3>
          <p className="text-xs text-rose-700 dark:text-rose-400 mt-1">{errorMessage}</p>
          <button
            type="button"
            onClick={loadDependencies}
            className="mt-4 px-4 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-medium hover:bg-rose-700 transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && dependencies.length === 0 && (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl" data-testid="dependencies-empty">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">No dependencies found</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            No work items match your current filter settings. Work is flowing smoothly across team boundaries.
          </p>
          {(statusFilter !== 'all' || crossTeamOnly || agingOnly || severityFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('all');
                setSeverityFilter('all');
                setCrossTeamOnly(false);
                setAgingOnly(false);
                setSearchQuery('');
              }}
              className="mt-4 px-4 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl transition"
            >
              Reset Filters
            </button>
          )}
        </div>
      )}

      {/* Dependency List */}
      {!isLoading && !isError && dependencies.length > 0 && (
        <div className="space-y-4" data-testid="dependencies-list">
          {dependencies.map((dep) => (
            <div
              key={dep.dependency_id}
              className={`bg-white dark:bg-slate-900 border rounded-2xl p-6 shadow-xs transition-all ${
                dep.status === 'resolved'
                  ? 'border-slate-200/80 dark:border-slate-800/80 opacity-75'
                  : dep.severity === 'critical'
                  ? 'border-rose-300 dark:border-rose-900/60 shadow-rose-500/5'
                  : dep.severity === 'high'
                  ? 'border-amber-300 dark:border-amber-900/60 shadow-amber-500/5'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
              data-testid={`dependency-card-${dep.dependency_id}`}
            >
              {/* Header Badges */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  {getSeverityBadge(dep.severity)}

                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wider ${
                    dep.status === 'resolved'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300'
                      : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700'
                  }`}>
                    {dep.status}
                  </span>

                  {dep.is_cross_team && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                      ↔ Cross-Team
                    </span>
                  )}

                  {dep.is_aging && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-300 dark:border-orange-800">
                      ⏳ Blocked: {dep.age_days} day{dep.age_days === 1 ? '' : 's'}
                    </span>
                  )}

                  {dep.is_sprint_at_risk && dep.affected_sprint_name && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
                      🔥 {dep.affected_sprint_name} At Risk
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono text-[11px] text-slate-400">ID: {dep.dependency_id}</span>
                </div>
              </div>

              {/* Waiting Relationship Diagram */}
              <div className="py-4 grid grid-cols-1 md:grid-cols-11 gap-4 items-center">
                {/* Source Person & Team */}
                <div className="md:col-span-5 p-3.5 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Source (Waiting Work)
                  </span>
                  <div className="font-semibold text-slate-900 dark:text-white mt-1 text-sm">
                    {dep.source_owner}
                  </div>
                  <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                    {dep.source_team}
                  </div>
                  {dep.source_task_title && (
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 flex items-center gap-1">
                      <Kanban className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{dep.source_task_title}</span>
                    </div>
                  )}
                </div>

                {/* Arrow indicator */}
                <div className="md:col-span-1 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] font-semibold text-slate-400 mb-0.5 hidden md:block">
                    waiting for
                  </span>
                  <div className="w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Dependency Person & Team */}
                <div className="md:col-span-5 p-3.5 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Prerequisite / Blocker
                  </span>
                  <div className="font-semibold text-slate-900 dark:text-white mt-1 text-sm">
                    {dep.dependency_owner}
                  </div>
                  <div className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                    {dep.dependency_team}
                  </div>
                  {dep.dependent_task_title && (
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 flex items-center gap-1">
                      <Kanban className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{dep.dependent_task_title}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Summary and Impact */}
              <div className="pt-2 pb-3 space-y-2">
                <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {dep.summary}
                </div>
                {dep.downstream_impact_summary && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">Delivery Impact:</span>
                    <span>{dep.downstream_impact_summary}</span>
                  </div>
                )}
              </div>

              {/* Verified Evidence Row */}
              {dep.evidence && dep.evidence.length > 0 && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1 mr-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Verified Evidence:
                  </span>
                  {dep.evidence.map((ev, i) => (
                    <EvidenceCitationBadge key={i} citation={ev} size="sm" />
                  ))}
                </div>
              )}

              {/* Footer Actions */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="text-[11px] text-slate-400">
                  Source: <strong className="capitalize text-slate-600 dark:text-slate-300">{dep.source_type}</strong>
                </div>

                <div className="flex items-center gap-2">
                  {dep.source_type === 'explicit' && (
                    <button
                      type="button"
                      onClick={() => handleDelete(dep.dependency_id)}
                      className="px-2.5 py-1 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                      title="Delete dependency link"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleStatusToggle(dep)}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold transition ${
                      dep.status === 'resolved'
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {dep.status === 'resolved' ? 'Re-open' : 'Mark Resolved'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Task Dependency Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4" data-testid="add-dependency-modal">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <GitFork className="w-5 h-5 text-blue-600" />
                Add Task Dependency
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDependency} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Dependent Task (Work that is blocked)
                </label>
                <select
                  value={selectedTaskId}
                  onChange={(e) => setSelectedTaskId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 text-sm text-slate-800 dark:text-slate-200"
                  required
                >
                  <option value="" disabled>Select blocked task</option>
                  {availableTasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      #{t.id} - {t.title} ({t.assignee_name || 'Unassigned'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Prerequisite Task (Work causing the dependency)
                </label>
                <select
                  value={selectedPrereqTaskId}
                  onChange={(e) => setSelectedPrereqTaskId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 text-sm text-slate-800 dark:text-slate-200"
                  required
                >
                  <option value="" disabled>Select prerequisite task</option>
                  {availableTasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      #{t.id} - {t.title} ({t.assignee_name || 'Unassigned'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Dependency Type
                </label>
                <select
                  value={dependencyType}
                  onChange={(e) => setDependencyType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 text-sm text-slate-800 dark:text-slate-200"
                >
                  <option value="blocks">Blocks (Hard prerequisite)</option>
                  <option value="relates_to">Relates to (Soft dependency)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Notes / Technical Context
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Waiting for DB schema migration script from backend team before API integration can merge..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 text-sm text-slate-800 dark:text-slate-200 h-20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Dependency'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
