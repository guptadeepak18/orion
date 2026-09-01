import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  UserPlus,
  Search,
  Shield,
  ShieldCheck,
  Key,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  X,
  Phone,
  Mail,
  RefreshCw,
  UserCog,
  SlidersHorizontal,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../../components/Card';
import { useRoleAccess } from '../../lib/useRoleAccess';

interface Role {
  id: string;
  name: string;
  description?: string;
}

interface UserItem {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  is_active: boolean;
  roles: Role[];
  created_at?: string;
}

export const UsersPage: React.FC = () => {
  const { isAdmin } = useRoleAccess();
  const queryClient = useQueryClient();

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [includeAll, setIncludeAll] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const updateUrlModal = (m: string | null, params: Record<string, string | undefined> = {}) => {
    const next = new URLSearchParams(searchParams);
    if (!m) {
      next.delete('modal');
      next.delete('id');
    } else {
      next.set('modal', m);
      Object.entries(params).forEach(([k, v]) => {
        if (v) next.set(k, v);
        else next.delete(k);
      });
    }
    setSearchParams(next);
  };

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [resetPwdUser, setResetPwdUser] = useState<UserItem | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserItem | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    role_names: [] as string[],
    is_active: true,
  });

  const [newPassword, setNewPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // 1. Fetch System Roles
  const { data: rolesData = [] } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await api.get('/users/roles');
      return res.data.data;
    },
    enabled: isAdmin,
  });

  // 2. Fetch Users Directory
  const {
    data: users = [],
    isLoading,
    refetch,
  } = useQuery<UserItem[]>({
    queryKey: ['users-directory', roleFilter, statusFilter, includeAll],
    queryFn: async () => {
      const params: any = {};
      if (roleFilter !== 'all') params.role = roleFilter;
      if (statusFilter !== 'all') params.is_active = statusFilter === 'active';
      if (includeAll) params.include_all = true;

      const res = await api.get('/users', { params });
      return res.data.data;
    },
    enabled: isAdmin,
  });

  // 3. Mutations
  // Create User Mutation
  const createUserMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await api.post('/users', data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-directory'] });
      closeFormModal();
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.detail || err?.message || 'Failed to create user');
    },
  });

  // Update User Mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const res = await api.put(`/users/${id}`, data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-directory'] });
      closeFormModal();
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.detail || err?.message || 'Failed to update user');
    },
  });

  // Toggle Status Mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const res = await api.patch(`/users/${id}/status`, { is_active });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-directory'] });
    },
  });

  // Reset Password Mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ id, new_password }: { id: string; new_password: string }) => {
      const res = await api.post(`/users/${id}/reset-password`, { new_password });
      return res.data.data;
    },
    onSuccess: () => {
      closeResetPwdModal();
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.detail || err?.message || 'Failed to reset password');
    },
  });

  // Delete User Mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-directory'] });
      closeDeleteModal();
    },
  });

  const openCreateModal = (syncUrl = true) => {
    setEditingUser(null);
    setFormData({
      full_name: '',
      email: '',
      phone: '',
      password: '',
      role_names: ['crc_coordinator'],
      is_active: true,
    });
    setFormError(null);
    setIsCreateModalOpen(true);
    if (syncUrl) updateUrlModal('createUser');
  };

  const openEditModal = (user: UserItem, syncUrl = true) => {
    setEditingUser(user);
    setFormData({
      full_name: user.full_name,
      email: user.email,
      phone: user.phone || '',
      password: '',
      role_names: user.roles.map((r) => r.name),
      is_active: user.is_active,
    });
    setFormError(null);
    setIsCreateModalOpen(true);
    if (syncUrl) updateUrlModal('editUser', { id: user.id });
  };

  const closeFormModal = (syncUrl = true) => {
    setIsCreateModalOpen(false);
    setEditingUser(null);
    setFormError(null);
    if (syncUrl) updateUrlModal(null);
  };

  const openResetPwdModal = (user: UserItem, syncUrl = true) => {
    setResetPwdUser(user);
    setNewPassword('');
    setFormError(null);
    if (syncUrl) updateUrlModal('resetPassword', { id: user.id });
  };

  const closeResetPwdModal = (syncUrl = true) => {
    setResetPwdUser(null);
    setNewPassword('');
    setFormError(null);
    if (syncUrl) updateUrlModal(null);
  };

  const openDeleteModal = (user: UserItem, syncUrl = true) => {
    setDeletingUser(user);
    if (syncUrl) updateUrlModal('deleteUser', { id: user.id });
  };

  const closeDeleteModal = (syncUrl = true) => {
    setDeletingUser(null);
    if (syncUrl) updateUrlModal(null);
  };

  // Synchronize modal state with URL parameters
  const urlModal = searchParams.get('modal');
  const urlId = searchParams.get('id');

  useEffect(() => {
    if (!urlModal) {
      if (isCreateModalOpen) closeFormModal(false);
      if (resetPwdUser) closeResetPwdModal(false);
      if (deletingUser) closeDeleteModal(false);
      return;
    }

    if (urlModal === 'createUser' && !isCreateModalOpen) {
      openCreateModal(false);
    } else if (urlId && users.length > 0) {
      const found = users.find((u: UserItem) => u.id === urlId);
      if (found) {
        if (urlModal === 'editUser' && (!isCreateModalOpen || editingUser?.id !== found.id)) {
          openEditModal(found, false);
        } else if (urlModal === 'resetPassword' && (!resetPwdUser || resetPwdUser.id !== found.id)) {
          openResetPwdModal(found, false);
        } else if (urlModal === 'deleteUser' && (!deletingUser || deletingUser.id !== found.id)) {
          openDeleteModal(found, false);
        }
      }
    }
  }, [urlModal, urlId, users]);

  const handleToggleRole = (roleName: string) => {
    setFormData((prev) => {
      const exists = prev.role_names.includes(roleName);
      if (exists) {
        return { ...prev, role_names: prev.role_names.filter((r) => r !== roleName) };
      } else {
        return { ...prev, role_names: [...prev.role_names, roleName] };
      }
    });
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.full_name.trim()) {
      setFormError('Full name is required');
      return;
    }
    if (!formData.email.trim()) {
      setFormError('Email address is required');
      return;
    }
    if (formData.role_names.length === 0) {
      setFormError('Please select at least one role for this user');
      return;
    }

    if (editingUser) {
      updateUserMutation.mutate({
        id: editingUser.id,
        data: {
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone,
          role_names: formData.role_names,
          is_active: formData.is_active,
        },
      });
    } else {
      if (!formData.password || formData.password.length < 6) {
        setFormError('Password must be at least 6 characters long');
        return;
      }
      createUserMutation.mutate(formData);
    }
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let pwd = '';
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pwd);
  };

  const getRoleBadgeStyle = (roleName: string) => {
    switch (roleName) {
      case 'crc_admin':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800/50';
      case 'crc_coordinator':
        return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/50';
      case 'finance':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50';
      case 'approver':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/50';
      case 'reporting_readonly':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800/50';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="h-16 w-16 rounded-2xl bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4">
          <Shield className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Admin Access Required</h2>
        <p className="text-sm text-slate-500 max-w-md">
          The User Directory is strictly restricted to System Administrators. You do not have permission to view or manage user accounts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <UserCog className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">User Directory</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50">
                  {users.length} User{users.length !== 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Manage system administrators, coordinators, finance officers, and staff permissions (excluding Students & Faculty)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            title="Refresh Users List"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => openCreateModal()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20"
          >
            <UserPlus className="h-4 w-4" /> Add System User
          </button>
        </div>
      </div>

      {/* Filter & Toolbar */}
      <Card className="p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative w-full lg:w-96">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search user by name, email, or phone..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-end">
            {/* Filter by Role */}
            <div className="flex items-center gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="all">All System Roles</option>
                {rolesData.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name.replace(/_/g, ' ').toUpperCase()} ({r.description || 'Role'})
                  </option>
                ))}
              </select>
            </div>

            {/* Filter by Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>

            {/* Directory View Toggle */}
            <button
              onClick={() => setIncludeAll(!includeAll)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                includeAll
                  ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800'
                  : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
              }`}
              title="Toggle to include Student & Faculty accounts"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {includeAll ? 'Showing All Accounts (Inc. Students)' : 'Excl. Students & Faculty'}
            </button>
          </div>
        </div>
      </Card>

      {/* User Directory Table */}
      <Card className="p-0 overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
        {isLoading ? (
          <div className="p-12 text-center text-sm font-medium text-slate-500">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-500" />
            Loading User Directory...
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Users Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No matching system users found. Click "Add System User" to create a new user account.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">User Details</th>
                  <th className="py-3.5 px-4">Contact Info</th>
                  <th className="py-3.5 px-4">Assigned Roles</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                {users.map((user: UserItem) => {
                  const initials = user.full_name
                    .split(' ')
                    .map((n: string) => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase();

                  const isAdminUser = user.roles.some((r: any) => r.name === 'crc_admin');

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* User Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-9 w-9 rounded-xl font-extrabold text-xs flex items-center justify-center shadow-sm ${
                              isAdminUser
                                ? 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white'
                                : 'bg-gradient-to-tr from-cyan-600 to-blue-600 text-white'
                            }`}
                          >
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              {user.full_name}
                              {isAdminUser && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                                  Admin
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                              <Mail className="h-3 w-3 text-slate-400" /> {user.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td className="py-3.5 px-4">
                        {user.phone ? (
                          <div className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                            <Phone className="h-3 w-3 text-slate-400" /> {user.phone}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No phone added</span>
                        )}
                      </td>

                      {/* Roles */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1.5">
                          {user.roles.map((r: any) => (
                            <span
                              key={r.id}
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${getRoleBadgeStyle(
                                r.name
                              )}`}
                            >
                              {r.name.replace(/_/g, ' ').toUpperCase()}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() =>
                            toggleStatusMutation.mutate({ id: user.id, is_active: !user.is_active })
                          }
                          disabled={toggleStatusMutation.isPending}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all hover:scale-105"
                          title="Click to toggle Active/Inactive"
                        >
                          {user.is_active ? (
                            <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Active
                            </span>
                          ) : (
                            <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              <XCircle className="h-3 w-3" /> Inactive
                            </span>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEditModal(user)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-slate-600 hover:text-indigo-600 dark:text-slate-300 transition-colors"
                            title="Edit User & Roles"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>

                          <button
                            onClick={() => openResetPwdModal(user)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-950/50 text-slate-600 hover:text-amber-600 dark:text-slate-300 transition-colors"
                            title="Reset User Password"
                          >
                            <Key className="h-3.5 w-3.5" />
                          </button>

                          <button
                            onClick={() => openDeleteModal(user)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-600 hover:text-rose-600 dark:text-slate-300 transition-colors"
                            title="Delete User"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* CREATE / EDIT USER MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingUser ? 'Edit User Profile & Roles' : 'Create New System User'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingUser ? `Updating user: ${editingUser.email}` : 'Assign roles & system access'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => closeFormModal()}
                className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmitForm} className="p-6 space-y-4 overflow-y-auto flex-1">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300">
                  {formError}
                </div>
              )}

              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rajesh Sharma"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. rajesh@lexiconmile.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              {/* Mobile Phone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mobile / Phone Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. +91 9876543210"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              {/* Password (Only when creating) */}
              {!editingUser && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Minimum 6 characters"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              )}

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Assign System Roles <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 max-h-48 overflow-y-auto">
                  {rolesData.map((role) => {
                    const isSelected = formData.role_names.includes(role.name);
                    return (
                      <label
                        key={role.id}
                        className={`flex items-start gap-2.5 p-2 rounded-xl cursor-pointer border transition-all ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                          checked={isSelected}
                          onChange={() => handleToggleRole(role.name)}
                        />
                        <div>
                          <div className="text-xs font-bold capitalize">
                            {role.name.replace(/_/g, ' ')}
                          </div>
                          {role.description && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                              {role.description}
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Account Status</div>
                  <div className="text-[11px] text-slate-500">Allow this user to log into the application</div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    formData.is_active
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {formData.is_active ? 'Active' : 'Inactive'}
                </button>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => closeFormModal()}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createUserMutation.isPending || updateUserMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {editingUser
                    ? updateUserMutation.isPending
                      ? 'Updating...'
                      : 'Save Changes'
                    : createUserMutation.isPending
                    ? 'Creating...'
                    : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetPwdUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400 flex items-center justify-center">
                  <Key className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Reset User Password</h3>
                  <p className="text-[11px] text-slate-500">{resetPwdUser.email}</p>
                </div>
              </div>
              <button onClick={() => closeResetPwdModal()} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                New Password
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter new password"
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={generateRandomPassword}
                  className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold text-slate-700 dark:text-slate-300"
                  title="Generate Random Password"
                >
                  Generate
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => closeResetPwdModal()}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resetPasswordMutation.isPending || !newPassword}
                onClick={() =>
                  resetPasswordMutation.mutate({ id: resetPwdUser.id, new_password: newPassword })
                }
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors disabled:opacity-50"
              >
                {resetPasswordMutation.isPending ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 text-center space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete User Account?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete <strong>{deletingUser.full_name}</strong> ({deletingUser.email})? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => closeDeleteModal()}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteUserMutation.mutate(deletingUser.id)}
                disabled={deleteUserMutation.isPending}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors disabled:opacity-50"
              >
                {deleteUserMutation.isPending ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
