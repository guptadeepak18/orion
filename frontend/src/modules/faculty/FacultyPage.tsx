import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Users, UserCheck, Sparkles, Edit3, Eye, X, Search,
  GraduationCap, Briefcase, User, CreditCard,
  Archive, Trash2, RotateCcw
} from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../../components/Card';
import { DataTable, Column } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { useRoleAccess } from '../../lib/useRoleAccess';

// ── Interfaces ──────────────────────────────────────────────────────────────
export interface FacultyInternal {
  id: string;
  user_id?: string;
  employee_id: string;
  full_name?: string;
  department: string;
  designation: string;
  email: string;
  phone?: string;
  date_of_birth?: string;
  gender?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  highest_qualification?: string;
  specialization?: string;
  research_area?: string;
  experience_years?: number;
  joining_date?: string;
  subjects_handled?: string[];
  linkedin_url?: string;
  publications?: number;
  is_active?: boolean;
  is_archived?: boolean;
}

export interface FacultyExternal {
  id: string;
  user_id?: string;
  name: string;
  designation?: string;
  organization?: string;
  expertise?: string[];
  email: string;
  phone?: string;
  date_of_birth?: string;
  gender?: string;
  highest_qualification?: string;
  experience_years?: number;
  linkedin_url?: string;
  is_gst_applicable: boolean;
  gst_rate_percent?: number;
  pan?: string;
  gst_number?: string;
  bank_account_no?: string;
  bank_ifsc?: string;
  bank_name?: string;
  address?: string;
  standard_rate_type: string;
  standard_rate: number;
  agreement_start?: string;
  agreement_end?: string;
  is_active: boolean;
  is_archived?: boolean;
}

// ── Initial Blank Forms ─────────────────────────────────────────────────────
const initialInternalForm = {
  employee_id: '',
  full_name: '',
  department: 'Management',
  designation: 'Assistant Professor',
  email: '',
  phone: '',
  date_of_birth: '',
  gender: 'Male',
  address: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  highest_qualification: 'Ph.D.',
  specialization: '',
  research_area: '',
  experience_years: '5',
  joining_date: '',
  subjects_handled: '',
  linkedin_url: '',
  publications: '0',
};

const initialExternalForm = {
  name: '',
  designation: 'Visiting Faculty',
  organization: '',
  expertise: '',
  email: '',
  phone: '',
  date_of_birth: '',
  gender: 'Male',
  highest_qualification: 'Ph.D. / MBA',
  experience_years: '10',
  linkedin_url: '',
  is_gst_applicable: false,
  gst_rate_percent: '18',
  pan: '',
  gst_number: '',
  bank_account_no: '',
  bank_ifsc: '',
  bank_name: '',
  address: '',
  standard_rate_type: 'per_hour',
  standard_rate: '2500',
  agreement_start: new Date().toISOString().split('T')[0],
  agreement_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  is_active: true,
};

export const FacultyPage: React.FC = () => {
  const { canManageFaculty } = useRoleAccess();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'external' | 'internal'>('external');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active');

  // Delete Confirm Modal State
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{ type: 'internal' | 'external', id: string, name: string } | null>(null);

  // Modals & Dossier State
  const [showInternalModal, setShowInternalModal] = useState(false);
  const [editingInternal, setEditingInternal] = useState<FacultyInternal | null>(null);
  const [internalForm, setInternalForm] = useState(initialInternalForm);

  const [showExternalModal, setShowExternalModal] = useState(false);
  const [editingExternal, setEditingExternal] = useState<FacultyExternal | null>(null);
  const [externalForm, setExternalForm] = useState(initialExternalForm);

  const [formSection, setFormSection] = useState<'personal' | 'academic' | 'financial'>('personal');

  // Dossier View Drawer
  const [viewInternal, setViewInternal] = useState<FacultyInternal | null>(null);
  const [viewExternal, setViewExternal] = useState<FacultyExternal | null>(null);

  // Queries
  const { data: externalList = [], isLoading: extLoading } = useQuery({
    queryKey: ['faculty_external'],
    queryFn: async () => {
      const res = await api.get('/faculty/external');
      return res.data.data as FacultyExternal[];
    },
  });

  const { data: internalList = [], isLoading: intLoading } = useQuery({
    queryKey: ['faculty_internal'],
    queryFn: async () => {
      const res = await api.get('/faculty/internal');
      return res.data.data as FacultyInternal[];
    },
  });

  // Mutations
  const saveInternalMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingInternal) {
        return (await api.put(`/faculty/internal/${editingInternal.id}`, payload)).data;
      }
      return (await api.post('/faculty/internal', payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faculty_internal'] });
      setShowInternalModal(false);
      setEditingInternal(null);
      setInternalForm(initialInternalForm);
    },
  });

  const saveExternalMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingExternal) {
        return (await api.put(`/faculty/external/${editingExternal.id}`, payload)).data;
      }
      return (await api.post('/faculty/external', payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faculty_external'] });
      setShowExternalModal(false);
      setEditingExternal(null);
      setExternalForm(initialExternalForm);
    },
  });

  // Archive & Delete Mutations
  const archiveInternalMutation = useMutation({
    mutationFn: async ({ id, is_archived }: { id: string; is_archived: boolean }) => {
      return (await api.put(`/faculty/internal/${id}/archive?is_archived=${is_archived}`)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faculty_internal'] });
      setViewInternal(null);
    },
  });

  const deleteInternalMutation = useMutation({
    mutationFn: async (id: string) => {
      return (await api.delete(`/faculty/internal/${id}`)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faculty_internal'] });
      setDeleteConfirmTarget(null);
      setViewInternal(null);
    },
  });

  const archiveExternalMutation = useMutation({
    mutationFn: async ({ id, is_archived }: { id: string; is_archived: boolean }) => {
      return (await api.put(`/faculty/external/${id}/archive?is_archived=${is_archived}`)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faculty_external'] });
      setViewExternal(null);
    },
  });

  const deleteExternalMutation = useMutation({
    mutationFn: async (id: string) => {
      return (await api.delete(`/faculty/external/${id}`)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faculty_external'] });
      setDeleteConfirmTarget(null);
      setViewExternal(null);
    },
  });

  // Handlers for Opening Forms
  const handleOpenAddInternal = () => {
    setEditingInternal(null);
    setInternalForm(initialInternalForm);
    setFormSection('personal');
    setShowInternalModal(true);
  };

  const handleOpenEditInternal = (fac: FacultyInternal) => {
    setEditingInternal(fac);
    setInternalForm({
      employee_id: fac.employee_id || '',
      full_name: fac.full_name || '',
      department: fac.department || 'Management',
      designation: fac.designation || 'Assistant Professor',
      email: fac.email || '',
      phone: fac.phone || '',
      date_of_birth: fac.date_of_birth || '',
      gender: fac.gender || 'Male',
      address: fac.address || '',
      emergency_contact_name: fac.emergency_contact_name || '',
      emergency_contact_phone: fac.emergency_contact_phone || '',
      highest_qualification: fac.highest_qualification || 'Ph.D.',
      specialization: fac.specialization || '',
      research_area: fac.research_area || '',
      experience_years: (fac.experience_years ?? 5).toString(),
      joining_date: fac.joining_date || '',
      subjects_handled: fac.subjects_handled ? fac.subjects_handled.join(', ') : '',
      linkedin_url: fac.linkedin_url || '',
      publications: (fac.publications ?? 0).toString(),
    });
    setFormSection('personal');
    setShowInternalModal(true);
  };

  const handleOpenAddExternal = () => {
    setEditingExternal(null);
    setExternalForm(initialExternalForm);
    setFormSection('personal');
    setShowExternalModal(true);
  };

  const handleOpenEditExternal = (fac: FacultyExternal) => {
    setEditingExternal(fac);
    setExternalForm({
      name: fac.name || '',
      designation: fac.designation || 'Visiting Faculty',
      organization: fac.organization || '',
      expertise: fac.expertise ? fac.expertise.join(', ') : '',
      email: fac.email || '',
      phone: fac.phone || '',
      date_of_birth: fac.date_of_birth || '',
      gender: fac.gender || 'Male',
      highest_qualification: fac.highest_qualification || 'Ph.D. / MBA',
      experience_years: (fac.experience_years ?? 10).toString(),
      linkedin_url: fac.linkedin_url || '',
      is_gst_applicable: fac.is_gst_applicable ?? false,
      gst_rate_percent: (fac.gst_rate_percent ?? 18).toString(),
      pan: fac.pan || '',
      gst_number: fac.gst_number || '',
      bank_account_no: fac.bank_account_no || '',
      bank_ifsc: fac.bank_ifsc || '',
      bank_name: fac.bank_name || '',
      address: fac.address || '',
      standard_rate_type: fac.standard_rate_type || 'per_hour',
      standard_rate: (fac.standard_rate ?? 2500).toString(),
      agreement_start: fac.agreement_start || '',
      agreement_end: fac.agreement_end || '',
      is_active: fac.is_active ?? true,
    });
    setFormSection('personal');
    setShowExternalModal(true);
  };

  // Submit handlers
  const handleSaveInternal = (e: React.FormEvent) => {
    e.preventDefault();
    const subjectsArray = internalForm.subjects_handled
      ? internalForm.subjects_handled.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    saveInternalMutation.mutate({
      employee_id: internalForm.employee_id,
      full_name: internalForm.full_name || null,
      department: internalForm.department,
      designation: internalForm.designation,
      email: internalForm.email,
      phone: internalForm.phone || null,
      date_of_birth: internalForm.date_of_birth || null,
      gender: internalForm.gender || null,
      address: internalForm.address || null,
      emergency_contact_name: internalForm.emergency_contact_name || null,
      emergency_contact_phone: internalForm.emergency_contact_phone || null,
      highest_qualification: internalForm.highest_qualification || null,
      specialization: internalForm.specialization || null,
      research_area: internalForm.research_area || null,
      experience_years: internalForm.experience_years ? parseInt(internalForm.experience_years) : 0,
      joining_date: internalForm.joining_date || null,
      subjects_handled: subjectsArray,
      linkedin_url: internalForm.linkedin_url || null,
      publications: internalForm.publications ? parseInt(internalForm.publications) : 0,
    });
  };

  const handleSaveExternal = (e: React.FormEvent) => {
    e.preventDefault();
    const expertiseArray = externalForm.expertise
      ? externalForm.expertise.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    saveExternalMutation.mutate({
      name: externalForm.name,
      designation: externalForm.designation || null,
      organization: externalForm.organization || null,
      expertise: expertiseArray,
      email: externalForm.email,
      phone: externalForm.phone || null,
      date_of_birth: externalForm.date_of_birth || null,
      gender: externalForm.gender || null,
      highest_qualification: externalForm.highest_qualification || null,
      experience_years: externalForm.experience_years ? parseInt(externalForm.experience_years) : 0,
      linkedin_url: externalForm.linkedin_url || null,
      is_gst_applicable: externalForm.is_gst_applicable,
      gst_rate_percent: externalForm.is_gst_applicable ? parseFloat(externalForm.gst_rate_percent || '18') : 0,
      pan: externalForm.pan || null,
      gst_number: externalForm.is_gst_applicable ? externalForm.gst_number || null : null,
      bank_account_no: externalForm.bank_account_no || null,
      bank_ifsc: externalForm.bank_ifsc || null,
      bank_name: externalForm.bank_name || null,
      address: externalForm.address || null,
      standard_rate_type: externalForm.standard_rate_type,
      standard_rate: parseFloat(externalForm.standard_rate || '0'),
      agreement_start: externalForm.agreement_start || null,
      agreement_end: externalForm.agreement_end || null,
      is_active: externalForm.is_active,
    });
  };

  // Filtered lists with statusFilter support
  const filteredExternal = externalList.filter((f) => {
    const matchesSearch = (f.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.organization || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    if (statusFilter === 'active') return !f.is_archived;
    if (statusFilter === 'archived') return f.is_archived;
    return true;
  });

  const filteredInternal = internalList.filter((f) => {
    const matchesSearch = (f.full_name || f.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.employee_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.department || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === 'active') return !f.is_archived;
    if (statusFilter === 'archived') return f.is_archived;
    return true;
  });

  // Table Columns
  const extColumns: Column<FacultyExternal>[] = [
    {
      header: 'Faculty Name & Org',
      accessor: (r) => (
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-xl bg-cyan-100 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 flex items-center justify-center font-bold text-cyan-600 dark:text-cyan-400 text-sm">
            {r.name ? r.name.charAt(0).toUpperCase() : 'E'}
          </div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100">{r.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{r.organization || 'Independent Industry Expert'}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Contact Info',
      accessor: (r) => (
        <div className="text-xs space-y-0.5">
          <p className="font-mono text-cyan-600 dark:text-cyan-400 font-semibold">{r.email}</p>
          <p className="text-slate-500 dark:text-slate-400">{r.phone || '—'}</p>
        </div>
      ),
    },
    {
      header: 'Standard Rate',
      accessor: (r) => (
        <span className="font-medium text-emerald-600 dark:text-emerald-400 text-xs bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-500/30">
          ₹{r.standard_rate.toLocaleString()} / {r.standard_rate_type.replace('_', ' ')}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: (r) => (
        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
          r.is_archived
            ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30'
            : 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
        }`}>
          {r.is_archived ? 'Archived' : 'Active'}
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: (r) => (
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setViewExternal(r)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="View Full Profile Dossier"
          >
            <Eye className="h-4 w-4" />
          </button>
          {canManageFaculty && (
            <>
              <button
                onClick={() => handleOpenEditExternal(r)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Edit Faculty Details"
              >
                <Edit3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => archiveExternalMutation.mutate({ id: r.id, is_archived: !r.is_archived })}
                className={`p-1.5 rounded-lg transition-colors ${
                  r.is_archived
                    ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                    : 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10'
                }`}
                title={r.is_archived ? "Unarchive / Restore Faculty Profile" : "Archive Faculty Profile"}
              >
                {r.is_archived ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              </button>
              <button
                onClick={() => setDeleteConfirmTarget({ type: 'external', id: r.id, name: r.name })}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                title="Delete Faculty Profile"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  const intColumns: Column<FacultyInternal>[] = [
    {
      header: 'Faculty Member',
      accessor: (r) => (
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-100 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-400 text-sm">
            {(r.full_name || r.email).charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100">{r.full_name || r.email.split('@')[0]}</p>
            <p className="text-xs text-indigo-600 dark:text-indigo-400 font-mono font-medium">ID: {r.employee_id}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Department & Role',
      accessor: (r) => (
        <div className="text-xs">
          <p className="font-semibold text-slate-800 dark:text-slate-200">{r.designation}</p>
          <p className="text-slate-500 dark:text-slate-400">{r.department}</p>
        </div>
      ),
    },
    {
      header: 'Contact Details',
      accessor: (r) => (
        <div className="text-xs space-y-0.5">
          <p className="font-mono text-cyan-600 dark:text-cyan-400 font-semibold">{r.email}</p>
          <p className="text-slate-500 dark:text-slate-400">{r.phone || '—'}</p>
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: (r) => (
        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
          r.is_archived
            ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30'
            : 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
        }`}>
          {r.is_archived ? 'Archived' : 'Active'}
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: (r) => (
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setViewInternal(r)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="View Full Profile Dossier"
          >
            <Eye className="h-4 w-4" />
          </button>
          {canManageFaculty && (
            <>
              <button
                onClick={() => handleOpenEditInternal(r)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Edit Faculty Details"
              >
                <Edit3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => archiveInternalMutation.mutate({ id: r.id, is_archived: !r.is_archived })}
                className={`p-1.5 rounded-lg transition-colors ${
                  r.is_archived
                    ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                    : 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10'
                }`}
                title={r.is_archived ? "Unarchive / Restore Faculty Profile" : "Archive Faculty Profile"}
              >
                {r.is_archived ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              </button>
              <button
                onClick={() => setDeleteConfirmTarget({ type: 'internal', id: r.id, name: r.full_name || r.email })}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                title="Delete Faculty Profile"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight gradient-text">Faculty Directory & Profile Vault</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Manage comprehensive personal, academic, professional & agreement profiles with full Archive and Delete options.
          </p>
        </div>
        {canManageFaculty && (
          <div className="flex items-center space-x-3">
            {activeTab === 'external' ? (
              <button
                onClick={handleOpenAddExternal}
                className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/35 transition-all duration-200"
              >
                <Plus className="h-4 w-4" />
                <span>Add External Expert</span>
              </button>
            ) : (
              <button
                onClick={handleOpenAddInternal}
                className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/35 transition-all duration-200"
              >
                <Plus className="h-4 w-4" />
                <span>Add Internal Faculty</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Sentinel Compliance Banner */}
      <div className="p-4 rounded-2xl glass-card border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-200">Compliance Vault Active</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Validates rate agreements, document compliance, research areas, and workload history across academic sessions.
            </p>
          </div>
        </div>
        <StatusBadge status="active" label="Compliance Vault Active" />
      </div>

      {/* Tabs & Search & Status Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-200 dark:border-slate-800 gap-4 pb-1">
        <div className="flex space-x-6 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('external')}
            className={`pb-3 text-sm font-semibold border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'external'
                ? 'border-cyan-500 text-cyan-700 dark:border-cyan-400 dark:text-cyan-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Visiting / External Experts ({externalList.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('internal')}
            className={`pb-3 text-sm font-semibold border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'internal'
                ? 'border-indigo-500 text-indigo-700 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <UserCheck className="h-4 w-4" />
            <span>Internal Faculty ({internalList.length})</span>
          </button>
        </div>

        {/* Status Filter & Search */}
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                statusFilter === 'active'
                  ? 'bg-white dark:bg-slate-800 text-cyan-700 dark:text-cyan-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter('archived')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                statusFilter === 'archived'
                  ? 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Archived
            </button>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              All
            </button>
          </div>

          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search faculty..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-cyan-500 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>
      </div>

      {/* Active Tab Table */}
      {activeTab === 'external' ? (
        <Card title="Visiting & External Industry Experts">
          {extLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-4">Loading external faculty...</p>
          ) : (
            <DataTable
              columns={extColumns}
              data={filteredExternal}
              keyExtractor={(r) => r.id}
              emptyMessage="No external faculty members match your query."
            />
          )}
        </Card>
      ) : (
        <Card title="Internal Full-Time & Adjunct Faculty">
          {intLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-4">Loading internal faculty...</p>
          ) : (
            <DataTable
              columns={intColumns}
              data={filteredInternal}
              keyExtractor={(r) => r.id}
              emptyMessage="No internal faculty members match your query."
            />
          )}
        </Card>
      )}

      {/* ── MODAL: DELETE CONFIRMATION ────────────────────────────────────────── */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 rounded-2xl bg-rose-100 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold">Delete Faculty Profile</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Permanent Profile Removal</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Are you sure you want to delete <span className="font-bold text-slate-900 dark:text-white">{deleteConfirmTarget.name}</span>? This action will remove their personal, academic, and financial profile records from the faculty directory.
            </p>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deleteConfirmTarget.type === 'internal') {
                    deleteInternalMutation.mutate(deleteConfirmTarget.id);
                  } else {
                    deleteExternalMutation.mutate(deleteConfirmTarget.id);
                  }
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-500/20"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD / EDIT INTERNAL FACULTY ────────────────────────────────── */}
      {showInternalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="glass-panel w-full max-w-2xl rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <UserCheck className="h-5 w-5 text-indigo-500" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {editingInternal ? 'Edit Internal Faculty Profile' : 'Add New Internal Faculty Profile'}
                </h3>
              </div>
              <button
                onClick={() => setShowInternalModal(false)}
                className="p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Section Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 my-4 space-x-4">
              <button
                type="button"
                onClick={() => setFormSection('personal')}
                className={`pb-2 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
                  formSection === 'personal'
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <User className="h-3.5 w-3.5" /> Personal & Contact
              </button>
              <button
                type="button"
                onClick={() => setFormSection('academic')}
                className={`pb-2 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
                  formSection === 'academic'
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <GraduationCap className="h-3.5 w-3.5" /> Academic & Research
              </button>
              <button
                type="button"
                onClick={() => setFormSection('financial')}
                className={`pb-2 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
                  formSection === 'financial'
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Briefcase className="h-3.5 w-3.5" /> Teaching & Professional
              </button>
            </div>

            <form onSubmit={handleSaveInternal} className="space-y-4">
              {/* SECTION 1: PERSONAL & CONTACT */}
              {formSection === 'personal' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Employee ID <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="EMP-2026-101"
                        value={internalForm.employee_id}
                        onChange={(e) => setInternalForm({ ...internalForm, employee_id: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Full Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Dr. Amit Saxena"
                        value={internalForm.full_name}
                        onChange={(e) => setInternalForm({ ...internalForm, full_name: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Official Email <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="amit.saxena@lexiconmile.com"
                        value={internalForm.email}
                        onChange={(e) => setInternalForm({ ...internalForm, email: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Mobile Phone Number
                      </label>
                      <input
                        type="text"
                        placeholder="+91 98765 43210"
                        value={internalForm.phone}
                        onChange={(e) => setInternalForm({ ...internalForm, phone: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Department
                      </label>
                      <select
                        value={internalForm.department}
                        onChange={(e) => setInternalForm({ ...internalForm, department: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="Management">Management</option>
                        <option value="Finance & Accounting">Finance & Accounting</option>
                        <option value="Marketing">Marketing</option>
                        <option value="Human Resources">Human Resources</option>
                        <option value="Analytics & IT">Analytics & IT</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Designation
                      </label>
                      <select
                        value={internalForm.designation}
                        onChange={(e) => setInternalForm({ ...internalForm, designation: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="Professor">Professor</option>
                        <option value="Associate Professor">Associate Professor</option>
                        <option value="Assistant Professor">Assistant Professor</option>
                        <option value="Adjunct Faculty">Adjunct Faculty</option>
                        <option value="Head of Department">Head of Department</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 2: ACADEMIC & RESEARCH */}
              {formSection === 'academic' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Highest Qualification
                      </label>
                      <input
                        type="text"
                        placeholder="Ph.D. / MBA / M.Tech"
                        value={internalForm.highest_qualification}
                        onChange={(e) => setInternalForm({ ...internalForm, highest_qualification: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Specialization (Major)
                      </label>
                      <input
                        type="text"
                        placeholder="Corporate Governance / Quantitative Finance"
                        value={internalForm.specialization}
                        onChange={(e) => setInternalForm({ ...internalForm, specialization: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Primary Research Area & Domain Focus
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Algorithmic Trading Models, ESG Governance"
                      value={internalForm.research_area}
                      onChange={(e) => setInternalForm({ ...internalForm, research_area: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              {/* SECTION 3: TEACHING & PROFESSIONAL */}
              {formSection === 'financial' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Subjects Handled (Comma Separated)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Financial Management, Security Analysis, Portfolio Theory"
                      value={internalForm.subjects_handled}
                      onChange={(e) => setInternalForm({ ...internalForm, subjects_handled: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowInternalModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveInternalMutation.isPending}
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
                >
                  {saveInternalMutation.isPending ? 'Saving...' : editingInternal ? 'Update Internal Profile' : 'Create Internal Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD / EDIT EXTERNAL FACULTY ────────────────────────────────── */}
      {showExternalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="glass-panel w-full max-w-2xl rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-cyan-500" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {editingExternal ? 'Edit External Faculty Profile' : 'Add Visiting / External Industry Expert'}
                </h3>
              </div>
              <button
                onClick={() => setShowExternalModal(false)}
                className="p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Section Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 my-4 space-x-4">
              <button
                type="button"
                onClick={() => setFormSection('personal')}
                className={`pb-2 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
                  formSection === 'personal'
                    ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <User className="h-3.5 w-3.5" /> Personal & Org
              </button>
              <button
                type="button"
                onClick={() => setFormSection('academic')}
                className={`pb-2 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
                  formSection === 'academic'
                    ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <GraduationCap className="h-3.5 w-3.5" /> Academic & Domain Expertise
              </button>
              <button
                type="button"
                onClick={() => setFormSection('financial')}
                className={`pb-2 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
                  formSection === 'financial'
                    ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <CreditCard className="h-3.5 w-3.5" /> Commercial & Banking Vault
              </button>
            </div>

            <form onSubmit={handleSaveExternal} className="space-y-4">
              {/* SECTION 1: PERSONAL & ORG */}
              {formSection === 'personal' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Full Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Dr. Rajesh Sharma"
                        value={externalForm.name}
                        onChange={(e) => setExternalForm({ ...externalForm, name: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Organization / Affiliation
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. McKinsey & Co / Independent"
                        value={externalForm.organization}
                        onChange={(e) => setExternalForm({ ...externalForm, organization: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Email Address <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="rajesh@industry.com"
                        value={externalForm.email}
                        onChange={(e) => setExternalForm({ ...externalForm, email: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Phone Number
                      </label>
                      <input
                        type="text"
                        placeholder="+91 98765 43210"
                        value={externalForm.phone}
                        onChange={(e) => setExternalForm({ ...externalForm, phone: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 2: ACADEMIC & EXPERTISE */}
              {formSection === 'academic' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Highest Qualification
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Ph.D. / MBA (Kellogg)"
                        value={externalForm.highest_qualification}
                        onChange={(e) => setExternalForm({ ...externalForm, highest_qualification: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Industry Experience (Years)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={externalForm.experience_years}
                        onChange={(e) => setExternalForm({ ...externalForm, experience_years: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Domain Expertise Areas (Comma Separated)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Valuation, M&A, Private Equity, Digital Transformation"
                      value={externalForm.expertise}
                      onChange={(e) => setExternalForm({ ...externalForm, expertise: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              )}

              {/* SECTION 3: COMMERCIAL & BANKING */}
              {formSection === 'financial' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Standard Rate (₹) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        value={externalForm.standard_rate}
                        onChange={(e) => setExternalForm({ ...externalForm, standard_rate: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Rate Structure <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={externalForm.standard_rate_type}
                        onChange={(e) => setExternalForm({ ...externalForm, standard_rate_type: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                      >
                        <option value="per_hour">Per Hour</option>
                        <option value="per_session">Per Session</option>
                        <option value="fixed">Fixed Project Fee</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                          GST Applicability & Tax Registration
                        </p>
                        <p className="text-[10px] text-slate-500">Toggle whether this faculty member charges GST on remuneration</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={externalForm.is_gst_applicable}
                          onChange={(e) => setExternalForm({ ...externalForm, is_gst_applicable: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600"></div>
                        <span className="ml-2.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                          {externalForm.is_gst_applicable ? 'GST Applicable' : 'GST Exempt / Non-GST'}
                        </span>
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">PAN Number</label>
                        <input
                          type="text"
                          placeholder="PAN Card Number"
                          value={externalForm.pan}
                          onChange={(e) => setExternalForm({ ...externalForm, pan: e.target.value })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono uppercase text-slate-900 dark:text-slate-100 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">
                          {externalForm.is_gst_applicable ? 'GSTIN Number *' : 'GST Status'}
                        </label>
                        {externalForm.is_gst_applicable ? (
                          <input
                            type="text"
                            placeholder="e.g. 27ABCDE1234F1Z5"
                            value={externalForm.gst_number}
                            onChange={(e) => setExternalForm({ ...externalForm, gst_number: e.target.value })}
                            className="w-full bg-white dark:bg-slate-900 border border-cyan-500 dark:border-cyan-400 rounded-lg px-3 py-1.5 text-xs font-mono uppercase text-slate-900 dark:text-slate-100 focus:outline-none"
                          />
                        ) : (
                          <div className="w-full px-3 py-1.5 bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-400 font-medium italic">
                            Non-GST (No Tax Applied)
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowExternalModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveExternalMutation.isPending}
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-cyan-600 hover:bg-cyan-700 text-white disabled:opacity-50"
                >
                  {saveExternalMutation.isPending ? 'Saving...' : editingExternal ? 'Update Profile' : 'Register Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DOSSIER DRAWER: INTERNAL FACULTY ────────────────────────────────────── */}
      {viewInternal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="glass-panel w-full max-w-xl rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 my-8">
            <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-indigo-500/30">
                  {(viewInternal.full_name || viewInternal.email).charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">{viewInternal.full_name || viewInternal.email.split('@')[0]}</h3>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                    {viewInternal.designation} · {viewInternal.department}
                  </p>
                </div>
              </div>
              <button onClick={() => setViewInternal(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              {/* Personal & Contact */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="h-4 w-4 text-indigo-500" /> Personal & Contact Info
                </h4>
                <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                  <p><span className="font-semibold text-slate-500">Employee ID:</span> {viewInternal.employee_id}</p>
                  <p><span className="font-semibold text-slate-500">Email:</span> {viewInternal.email}</p>
                  <p><span className="font-semibold text-slate-500">Phone:</span> {viewInternal.phone || '—'}</p>
                  <p><span className="font-semibold text-slate-500">Gender:</span> {viewInternal.gender || '—'}</p>
                </div>
              </div>

              {/* Academic Profile */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <GraduationCap className="h-4 w-4 text-indigo-500" /> Academic & Research Profile
                </h4>
                <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                  <p><span className="font-semibold text-slate-500">Qualification:</span> {viewInternal.highest_qualification || '—'}</p>
                  <p><span className="font-semibold text-slate-500">Experience:</span> {viewInternal.experience_years ? `${viewInternal.experience_years} Years` : '—'}</p>
                  <p><span className="font-semibold text-slate-500">Specialization:</span> {viewInternal.specialization || '—'}</p>
                  <p><span className="font-semibold text-slate-500">Research Area:</span> {viewInternal.research_area || '—'}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
              {canManageFaculty ? (
                <div className="flex space-x-2">
                  <button
                    onClick={() => archiveInternalMutation.mutate({ id: viewInternal.id, is_archived: !viewInternal.is_archived })}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 flex items-center gap-1.5"
                  >
                    {viewInternal.is_archived ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                    <span>{viewInternal.is_archived ? 'Restore' : 'Archive'}</span>
                  </button>
                  <button
                    onClick={() => setDeleteConfirmTarget({ type: 'internal', id: viewInternal.id, name: viewInternal.full_name || viewInternal.email })}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 flex items-center gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              ) : <div />}

              <button
                onClick={() => setViewInternal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DOSSIER DRAWER: EXTERNAL FACULTY ────────────────────────────────────── */}
      {viewExternal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="glass-panel w-full max-w-xl rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 my-8">
            <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 rounded-2xl bg-cyan-600 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-cyan-500/30">
                  {viewExternal.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">{viewExternal.name}</h3>
                  <p className="text-xs text-cyan-600 dark:text-cyan-400 font-semibold">
                    {viewExternal.designation || 'Visiting Professor'} · {viewExternal.organization || 'Independent Expert'}
                  </p>
                </div>
              </div>
              <button onClick={() => setViewExternal(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              {/* Personal & Contact */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="h-4 w-4 text-cyan-500" /> Personal & Contact Info
                </h4>
                <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                  <p><span className="font-semibold text-slate-500">Email:</span> {viewExternal.email}</p>
                  <p><span className="font-semibold text-slate-500">Phone:</span> {viewExternal.phone || '—'}</p>
                  <p><span className="font-semibold text-slate-500">Gender:</span> {viewExternal.gender || '—'}</p>
                </div>
              </div>

              {/* Commercial & Rate Info */}
              <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200 dark:border-emerald-500/30 space-y-2">
                <h4 className="font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard className="h-4 w-4 text-emerald-500" /> Financial & Rate Vault
                </h4>
                <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                  <p><span className="font-semibold text-slate-500">Standard Rate:</span> ₹{viewExternal.standard_rate.toLocaleString()} / {viewExternal.standard_rate_type.replace('_', ' ')}</p>
                  <p><span className="font-semibold text-slate-500">GST Status:</span> <span className={`font-semibold ${viewExternal.is_gst_applicable ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>{viewExternal.is_gst_applicable ? `GST Registered (${viewExternal.gst_rate_percent ?? 18}%)` : 'GST Exempt / Non-GST'}</span></p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
              {canManageFaculty ? (
                <div className="flex space-x-2">
                  <button
                    onClick={() => archiveExternalMutation.mutate({ id: viewExternal.id, is_archived: !viewExternal.is_archived })}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 flex items-center gap-1.5"
                  >
                    {viewExternal.is_archived ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                    <span>{viewExternal.is_archived ? 'Restore' : 'Archive'}</span>
                  </button>
                  <button
                    onClick={() => setDeleteConfirmTarget({ type: 'external', id: viewExternal.id, name: viewExternal.name })}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 flex items-center gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              ) : <div />}

              <button
                onClick={() => setViewExternal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
