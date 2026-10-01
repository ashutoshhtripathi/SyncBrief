import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Network, 
  ShieldCheck, 
  UserPlus, 
  Edit3, 
  Trash2, 
  ChevronRight, 
  AlertTriangle, 
  Building2, 
  GraduationCap, 
  CheckCircle2, 
  XCircle, 
  Lock, 
  Key, 
  X,
  Search,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  fetchHierarchy, 
  fetchAllUsers, 
  createUser, 
  updateUser, 
  deleteUser, 
  fetchUserPoints 
} from '../api';
import { HierarchyNode, User } from '../types';

export const OrgHierarchyPage: React.FC = () => {
  const { user, loginAs } = useAuth();
  const toast = useToast();
  const [hierarchy, setHierarchy] = useState<HierarchyNode[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Test visibility state
  const [testTargetUserId, setTestTargetUserId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ status: number; message: string; data?: any } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // User CRUD Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: 'demo1234',
    role: 'member',
    title: 'Software Engineer',
    role_level: 4,
    reports_to_id: null as number | null,
    org_type: 'engineering'
  });

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [treeData, usersData] = await Promise.all([
        fetchHierarchy(),
        fetchAllUsers()
      ]);
      setHierarchy(treeData);
      setAllUsers(usersData);
    } finally {
      setIsLoading(false);
    }
  };

  // Test backend hierarchy visibility rule
  const handleTestVisibility = async (targetId: number) => {
    setTestTargetUserId(targetId);
    setIsTesting(true);
    setTestResult(null);
    try {
      const data = await fetchUserPoints(targetId);
      setTestResult({
        status: 200,
        message: `Success (200 OK): Allowed to access ${data.user_name}'s points & records as they are yourself or a subordinate in your reporting chain.`,
        data
      });
    } catch (err: any) {
      setTestResult({
        status: 403,
        message: `Access Denied (403 Forbidden): ${err.message}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createUser({
        ...formData,
        role_level: Number(formData.role_level),
        reports_to_id: formData.reports_to_id ? Number(formData.reports_to_id) : null
      });
      setIsAddModalOpen(false);
      setFormData({
        full_name: '',
        email: '',
        password: 'demo1234',
        role: 'member',
        title: 'Software Engineer',
        role_level: 3,
        reports_to_id: null,
        org_type: 'engineering'
      });
      loadData();
      toast.success("User successfully added to organization hierarchy!");
    } catch (err: any) {
      toast.error(`Error creating user: ${err.message}`);
    }
  };

  // Edit User
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForEdit) return;

    try {
      await updateUser(selectedUserForEdit.id, {
        full_name: formData.full_name,
        title: formData.title,
        role: formData.role as any,
        role_level: Number(formData.role_level),
        reports_to_id: formData.reports_to_id ? Number(formData.reports_to_id) : null,
        org_type: formData.org_type as any
      });
      setIsEditModalOpen(false);
      loadData();
      toast.success("User updated successfully!");
    } catch (err: any) {
      toast.error(`Error updating user: ${err.message}`);
    }
  };

  // Delete User
  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await deleteUser(userToDelete.id);
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
      loadData();
      toast.success("User deleted from hierarchy.");
    } catch (err: any) {
      toast.error(`Error deleting user: ${err.message}`);
    }
  };

  const openEditModal = (u: User) => {
    setSelectedUserForEdit(u);
    setFormData({
      full_name: u.full_name,
      email: u.email,
      password: '',
      role: u.role,
      title: u.title,
      role_level: u.role_level || 4,
      reports_to_id: u.reports_to_id || null,
      org_type: u.org_type || 'engineering'
    });
    setIsEditModalOpen(true);
  };

  // Render recursive hierarchy tree
  const renderTree = (node: HierarchyNode, depth = 0) => {
    const isCurrentUser = user?.id === node.id;

    return (
      <div key={node.id} className="space-y-2.5">
        <div 
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border transition-all ${
            isCurrentUser 
              ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-400 dark:border-blue-700 ring-2 ring-blue-500/20' 
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
          style={{ marginLeft: `${depth * 28}px` }}
        >
          <div className="flex items-center gap-3">
            <img
              src={node.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'}
              alt={node.name}
              className="w-9 h-9 rounded-full object-cover ring-2 ring-slate-200 dark:ring-slate-700"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900 dark:text-white">{node.name}</span>
                {isCurrentUser && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white">
                    You
                  </span>
                )}
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  Level {node.role_level}
                </span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                <span>{node.title}</span>
                <span>&bull;</span>
                <span className="font-mono text-[11px]">{node.email}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions & Visibility Test */}
          <div className="flex items-center gap-2 pt-2 sm:pt-0">
            <button
              onClick={() => handleTestVisibility(node.id)}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold transition flex items-center gap-1"
              title="Test backend 403 RBAC visibility check on this user"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
              <span>Test Visibility</span>
            </button>

            {!isCurrentUser && (
              <button
                onClick={() => loginAs(node.role as any, node.id)}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold hover:bg-blue-100 transition"
                title="Switch login to this user"
              >
                <span>Switch to User</span>
              </button>
            )}

            <button
              onClick={() => {
                const u = allUsers.find(x => x.id === node.id);
                if (u) openEditModal(u);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Edit User"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Children Subordinates */}
        {node.children && node.children.length > 0 && (
          <div className="space-y-2 border-l-2 border-slate-200 dark:border-slate-800 ml-4 pl-2">
            {node.children.map(child => renderTree(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const currentOrgNodes = hierarchy;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Network className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <span>Organization Hierarchy &amp; Backend RBAC</span>
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Generic 3-level structure (Director &gt; Manager &gt; Employee) strictly enforced in backend controllers. Peers and superiors return HTTP 403 Forbidden.
          </p>
        </div>

        <button
          onClick={() => {
            setFormData({
              full_name: '',
              email: '',
              password: 'demo1234',
              role: 'employee',
              title: 'Software Engineer',
              role_level: 3,
              reports_to_id: user?.id || null,
              org_type: 'engineering'
            });
            setIsAddModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add User to Org</span>
        </button>
      </div>

      {/* Org Structure Pill */}
      <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-blue-800 dark:text-blue-200 text-xs font-semibold w-fit">
        <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        <span>SyncBrief Engineering Team &bull; Director (L1) &rarr; Manager (L2) &rarr; Employee (L3)</span>
      </div>

      {/* Backend Visibility Verification Result Banner */}
      {testResult && (
        <div className={`p-4.5 rounded-2xl border text-xs space-y-2 animate-in fade-in ${
          testResult.status === 200 
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
            : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-100'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold">
              {testResult.status === 200 ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : (
                <Lock className="w-5 h-5 text-rose-600" />
              )}
              <span>Backend Controller Response: HTTP {testResult.status}</span>
            </div>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-black/10">
              Evaluated for: {user?.full_name} (L{user?.role_level})
            </span>
          </div>
          <p className="leading-relaxed">{testResult.message}</p>
        </div>
      )}

      {/* Hierarchy Visual Tree */}
      <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Reporting Structure & Levels
          </div>
          <div className="text-xs text-slate-400">
            Click "Test Visibility" on any user to verify backend 403 rule
          </div>
        </div>

        <div className="space-y-3">
          {currentOrgNodes.map(rootNode => renderTree(rootNode, 0))}
          {currentOrgNodes.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-xs">
              No users configured in this hierarchy branch.
            </div>
          )}
        </div>
      </div>

      {/* Admin User Management Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              All Users & Reporting Chain Ledger (Admin CRUD)
            </h3>
            <p className="text-xs text-slate-500">
              Configure who reports to whom and their role levels.
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {allUsers.length} Users Total
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-3">Role</th>
                <th className="py-3 px-3">Level</th>
                <th className="py-3 px-3">Hierarchy / Org</th>
                <th className="py-3 px-3">Reports To</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {allUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900 dark:text-white">{u.full_name}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                  </td>
                  <td className="py-3 px-3">
                    <span className="capitalize">{u.role}</span>
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                    L{u.role_level || 5}
                  </td>
                  <td className="py-3 px-3 capitalize text-slate-600 dark:text-slate-400">
                    {u.org_type || 'engineering'}
                  </td>
                  <td className="py-3 px-3 font-medium text-slate-800 dark:text-slate-200">
                    {u.manager_name || 'Top-Level (None)'}
                  </td>
                  <td className="py-3 px-4 text-right space-x-1">
                    <button
                      onClick={() => openEditModal(u)}
                      className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setUserToDelete(u);
                        setIsDeleteModalOpen(true);
                      }}
                      className="px-2.5 py-1 rounded bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-300 font-semibold transition"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add User */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                <span>Add User to Org Hierarchy</span>
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Role Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Role Level</label>
                  <select
                    value={formData.role_level}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      role_level: Number(e.target.value),
                      role: Number(e.target.value) === 1 ? 'director' : (Number(e.target.value) === 2 ? 'manager' : 'employee')
                    }))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-hidden"
                  >
                    <option value={1}>L1 (Director)</option>
                    <option value={2}>L2 (Manager)</option>
                    <option value={3}>L3 (Employee)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reports To (Direct Parent Manager)
                </label>
                <select
                  value={formData.reports_to_id || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, reports_to_id: e.target.value ? Number(e.target.value) : null }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-hidden"
                >
                  <option value="">Top Level (No Manager / Self-governing)</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.title} - L{u.role_level})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs"
                >
                  Add User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit User */}
      {isEditModalOpen && selectedUserForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-600" />
                <span>Edit User & Hierarchy Assignment</span>
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Role Level</label>
                  <select
                    value={formData.role_level}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      role_level: Number(e.target.value),
                      role: Number(e.target.value) === 1 ? 'director' : (Number(e.target.value) === 2 ? 'manager' : 'employee')
                    }))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-hidden"
                  >
                    <option value={1}>L1 (Director)</option>
                    <option value={2}>L2 (Manager)</option>
                    <option value={3}>L3 (Employee)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Role Type</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-hidden"
                  >
                    <option value="director">Director</option>
                    <option value="manager">Manager</option>
                    <option value="employee">Employee</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reports To (Manager Parent)
                </label>
                <select
                  value={formData.reports_to_id || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, reports_to_id: e.target.value ? Number(e.target.value) : null }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-hidden"
                >
                  <option value="">Top Level (No Manager)</option>
                  {allUsers.filter(x => x.id !== selectedUserForEdit.id).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.title} - L{u.role_level})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete User Confirmation */}
      {isDeleteModalOpen && userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4 animate-in fade-in">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>Confirm Delete User</span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to remove <span className="font-bold text-slate-900 dark:text-white">{userToDelete.full_name}</span> from the organization? Their assigned tasks and reporting connections will be unlinked.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
