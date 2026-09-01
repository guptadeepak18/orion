import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  BookOpen,
  Calendar,
  Plus,
  Pencil,
  Trash2,
  Search,
  CheckCircle2,
  X,
  Layers,
  GraduationCap,
  UserCheck,
  AlertCircle
} from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../../components/Card';
import { useRoleAccess } from '../../lib/useRoleAccess';

interface FacultyAllocation {
  id: string;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  course_code?: string;
  course_category?: string;
  credits?: number;
  total_hours?: number;
  batch_id: string;
  batch_name: string;
  batch_code?: string;
  program_id?: string;
  program_name?: string;
  program_code?: string;
  faculty_type?: 'internal' | 'external';
  faculty_internal_id?: string;
  faculty_external_id?: string;
  faculty_name?: string;
  faculty_email?: string;
  faculty_organization?: string;
  faculty_designation?: string;
  term_type: string;
  term_number: number;
  term_label?: string;
  start_date?: string;
  end_date?: string;
  status: string;
}

interface SubjectItem {
  id: string;
  name: string;
  code: string;
  course_code?: string;
  course_category?: string;
  credits: number;
  total_hours?: number;
  is_archived: boolean;
}

interface ProgramItem {
  id: string;
  name: string;
  code: string;
}

interface BatchItem {
  id: string;
  name: string;
  code: string;
  program_id?: string;
}

interface InternalFaculty {
  id: string;
  full_name: string;
  employee_id: string;
  designation: string;
  department: string;
  email: string;
  is_active: boolean;
}

interface ExternalFaculty {
  id: string;
  name: string;
  organization?: string;
  designation?: string;
  email: string;
  is_active: boolean;
}

export const FacultySubjectAllocationTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { canManageCurriculum } = useRoleAccess();

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProgramFilter, setSelectedProgramFilter] = useState<string>('ALL');
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('ALL');
  const [facultyTypeFilter, setFacultyTypeFilter] = useState<string>('ALL');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<FacultyAllocation | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  // Modal Form Inputs
  const [subjectIdInput, setSubjectIdInput] = useState('');
  const [batchIdInput, setBatchIdInput] = useState('');
  const [facTypeInput, setFacTypeInput] = useState<'internal' | 'external'>('internal');
  const [facInternalIdInput, setFacInternalIdInput] = useState('');
  const [facExternalIdInput, setFacExternalIdInput] = useState('');
  const [termTypeInput, setTermTypeInput] = useState('trimester');
  const [termNumberInput, setTermNumberInput] = useState(1);
  const [termLabelInput, setTermLabelInput] = useState('Trimester 1');
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  const [statusInput, setStatusInput] = useState('active');

  // Queries
  const { data: allocations = [], isLoading: allocLoading } = useQuery<FacultyAllocation[]>({
    queryKey: ['faculty-subject-allocations'],
    queryFn: async () => {
      const res = await api.get('/academic/allocations');
      return res.data.data;
    },
  });

  const { data: subjects = [] } = useQuery<SubjectItem[]>({
    queryKey: ['subjects-active-only'],
    queryFn: async () => {
      const res = await api.get('/academic/subjects');
      return res.data.data.filter((s: SubjectItem) => !s.is_archived);
    },
  });

  const { data: programs = [] } = useQuery<ProgramItem[]>({
    queryKey: ['programs'],
    queryFn: async () => {
      const res = await api.get('/academic/programs');
      return res.data.data;
    },
  });

  const { data: batches = [] } = useQuery<BatchItem[]>({
    queryKey: ['batches'],
    queryFn: async () => {
      const res = await api.get('/academic/batches');
      return res.data.data;
    },
  });

  const { data: internalFaculty = [] } = useQuery<InternalFaculty[]>({
    queryKey: ['faculty-internal-active'],
    queryFn: async () => {
      const res = await api.get('/faculty/internal');
      return res.data.data.filter((f: InternalFaculty) => f.is_active);
    },
  });

  const { data: externalFaculty = [] } = useQuery<ExternalFaculty[]>({
    queryKey: ['faculty-external-active'],
    queryFn: async () => {
      const res = await api.get('/faculty/external');
      return res.data.data.filter((f: ExternalFaculty) => f.is_active);
    },
  });

  // Mutations
  const createAllocationMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/academic/allocations', payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faculty-subject-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      queryClient.invalidateQueries({ queryKey: ['my-subjects'] });
      closeModal();
    },
    onError: (err: any) => {
      setModalError(err?.response?.data?.detail || err?.message || 'Failed to create allocation');
    },
  });

  const updateAllocationMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await api.put(`/academic/allocations/${id}`, payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faculty-subject-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      queryClient.invalidateQueries({ queryKey: ['my-subjects'] });
      closeModal();
    },
    onError: (err: any) => {
      setModalError(err?.response?.data?.detail || err?.message || 'Failed to update allocation');
    },
  });

  const deleteAllocationMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/academic/allocations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faculty-subject-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      queryClient.invalidateQueries({ queryKey: ['my-subjects'] });
    },
    onError: (err: any) => {
      alert(err?.response?.data?.detail || 'Failed to delete allocation');
    },
  });

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

  // Modal Openers
  const openCreateModal = (syncUrl = true) => {
    setEditingAllocation(null);
    setSubjectIdInput(subjects.length > 0 ? subjects[0].id : '');
    setBatchIdInput(batches.length > 0 ? batches[0].id : '');
    setFacTypeInput('internal');
    setFacInternalIdInput(internalFaculty.length > 0 ? internalFaculty[0].id : '');
    setFacExternalIdInput(externalFaculty.length > 0 ? externalFaculty[0].id : '');
    setTermTypeInput('trimester');
    setTermNumberInput(1);
    setTermLabelInput('Trimester 1');
    setStartDateInput('');
    setEndDateInput('');
    setStatusInput('active');
    setModalError(null);
    setIsModalOpen(true);
    if (syncUrl) updateUrlModal('createAllocation');
  };

  const openEditModal = (alloc: FacultyAllocation, syncUrl = true) => {
    setEditingAllocation(alloc);
    setSubjectIdInput(alloc.subject_id);
    setBatchIdInput(alloc.batch_id);
    setFacTypeInput(alloc.faculty_type || 'internal');
    setFacInternalIdInput(alloc.faculty_internal_id || (internalFaculty.length > 0 ? internalFaculty[0].id : ''));
    setFacExternalIdInput(alloc.faculty_external_id || (externalFaculty.length > 0 ? externalFaculty[0].id : ''));
    setTermTypeInput(alloc.term_type || 'trimester');
    setTermNumberInput(alloc.term_number || 1);
    setTermLabelInput(alloc.term_label || `Trimester ${alloc.term_number || 1}`);
    setStartDateInput(alloc.start_date || '');
    setEndDateInput(alloc.end_date || '');
    setStatusInput(alloc.status || 'active');
    setModalError(null);
    setIsModalOpen(true);
    if (syncUrl) updateUrlModal('editAllocation', { id: alloc.id });
  };

  const closeModal = (syncUrl = true) => {
    if (syncUrl) updateUrlModal(null);
    setIsModalOpen(false);
    setEditingAllocation(null);
    setModalError(null);
  };

  // Synchronize modal state with URL query parameters
  const urlModal = searchParams.get('modal');
  const urlAllocId = searchParams.get('id');

  useEffect(() => {
    if (!urlModal) {
      if (isModalOpen) closeModal(false);
      return;
    }

    if (urlModal === 'createAllocation' && !isModalOpen) {
      openCreateModal(false);
    } else if (urlModal === 'editAllocation' && urlAllocId && allocations.length > 0) {
      const found = allocations.find((a) => a.id === urlAllocId);
      if (found && (!isModalOpen || editingAllocation?.id !== found.id)) {
        openEditModal(found, false);
      }
    }
  }, [urlModal, urlAllocId, allocations]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!subjectIdInput) {
      setModalError('Please select a valid subject.');
      return;
    }
    if (!batchIdInput) {
      setModalError('Please select a program batch.');
      return;
    }

    const payload = {
      subject_id: subjectIdInput,
      batch_id: batchIdInput,
      faculty_type: facTypeInput,
      faculty_internal_id: facTypeInput === 'internal' && facInternalIdInput ? facInternalIdInput : null,
      faculty_external_id: facTypeInput === 'external' && facExternalIdInput ? facExternalIdInput : null,
      term_type: termTypeInput,
      term_number: termNumberInput,
      term_label: termLabelInput || `${termTypeInput === 'trimester' ? 'Trimester' : 'Semester'} ${termNumberInput}`,
      start_date: startDateInput || null,
      end_date: endDateInput || null,
      status: statusInput,
    };

    if (editingAllocation) {
      updateAllocationMutation.mutate({ id: editingAllocation.id, payload });
    } else {
      createAllocationMutation.mutate(payload);
    }
  };

  // Filtered Allocations
  const filteredAllocations = allocations.filter((alloc) => {
    const matchesSearch =
      alloc.subject_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alloc.subject_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (alloc.faculty_name && alloc.faculty_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      alloc.batch_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (alloc.program_name && alloc.program_name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesProgram = selectedProgramFilter === 'ALL' || alloc.program_id === selectedProgramFilter;
    const matchesBatch = selectedBatchFilter === 'ALL' || alloc.batch_id === selectedBatchFilter;
    const matchesFacType =
      facultyTypeFilter === 'ALL' || alloc.faculty_type === facultyTypeFilter;

    return matchesSearch && matchesProgram && matchesBatch && matchesFacType;
  });

  // Calculate Summary Statistics
  const uniqueSubjectsCount = new Set(allocations.map((a) => a.subject_id)).size;
  const uniqueBatchesCount = new Set(allocations.map((a) => a.batch_id)).size;
  const assignedFacultyCount = new Set(
    allocations.filter((a) => a.faculty_name).map((a) => a.faculty_internal_id || a.faculty_external_id || a.faculty_name)
  ).size;

  return (
    <div className="space-y-6">
      {/* Section Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-500" />
            Faculty-Subject Allocation Hub
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Allocate existing curriculum subjects to academic batches and assign internal faculty or visiting experts. Assigned subjects automatically reflect on student and faculty portals.
          </p>
        </div>

        {canManageCurriculum && (
          <button
            onClick={() => openCreateModal()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20 shrink-0"
          >
            <Plus className="h-4 w-4" /> Allocate Faculty to Subject
          </button>
        )}
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-900 dark:text-white">{allocations.length}</div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total Allocations</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-900 dark:text-white">{uniqueSubjectsCount}</div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Covered Subjects</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-900 dark:text-white">{uniqueBatchesCount}</div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Batches Configured</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-900 dark:text-white">{assignedFacultyCount}</div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Assigned Faculty</div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search subject, faculty, batch..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Program Filter */}
          <select
            value={selectedProgramFilter}
            onChange={(e) => setSelectedProgramFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Programs</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
            ))}
          </select>

          {/* Batch Filter */}
          <select
            value={selectedBatchFilter}
            onChange={(e) => setSelectedBatchFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Batches</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          {/* Faculty Type Filter */}
          <select
            value={facultyTypeFilter}
            onChange={(e) => setFacultyTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Faculty Types</option>
            <option value="internal">Internal Faculty</option>
            <option value="external">Visiting Experts</option>
          </select>
        </div>
      </div>

      {/* Allocations Grid / Table */}
      {allocLoading ? (
        <div className="flex items-center justify-center p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl">
          <div className="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredAllocations.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-slate-500">
          <Users className="h-10 w-10 mx-auto text-slate-400 mb-3" />
          <p className="font-semibold text-slate-700 dark:text-slate-300">No faculty-subject allocations found</p>
          <p className="text-xs text-slate-400 mt-1">
            {canManageCurriculum ? "Click 'Allocate Faculty to Subject' above to map a subject to a batch and faculty instructor." : "No allocations match your filter criteria."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAllocations.map((alloc) => (
            <Card
              key={alloc.id}
              className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-4 hover:shadow-md transition-all duration-200"
            >
              {/* Subject & Code Header */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-black px-2.5 py-0.5 rounded-lg bg-indigo-600 text-white shadow-sm shadow-indigo-500/20">
                      {alloc.subject_code}
                    </span>
                    {alloc.course_code && (
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                        {alloc.course_code}
                      </span>
                    )}
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      {alloc.subject_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    <span className="capitalize">{alloc.course_category || 'Core'} Course</span>
                    <span>•</span>
                    <span>{alloc.credits} Credits</span>
                    <span>•</span>
                    <span>{alloc.total_hours || 30} Hours</span>
                  </div>
                </div>

                {/* Status Badge */}
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                  alloc.status === 'active'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}>
                  {alloc.status}
                </span>
              </div>

              {/* Assigned Faculty Section */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <UserCheck className="h-3.5 w-3.5 text-indigo-500" />
                    Assigned Instructor
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    alloc.faculty_type === 'external'
                      ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                      : 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                  }`}>
                    {alloc.faculty_type === 'external' ? 'Visiting Expert' : 'Internal Faculty'}
                  </span>
                </div>

                {alloc.faculty_name ? (
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                      {alloc.faculty_name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {alloc.faculty_name}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {alloc.faculty_designation || alloc.faculty_organization || alloc.faculty_email || 'Faculty'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-amber-600 dark:text-amber-400 italic flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5" /> No faculty assigned yet
                  </div>
                )}
              </div>

              {/* Batch, Program & Term Period Details */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="space-y-0.5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Program & Batch</div>
                  <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                    {alloc.batch_name}
                  </div>
                  {alloc.program_code && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      {alloc.program_code}
                    </div>
                  )}
                </div>

                <div className="space-y-0.5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Academic Term</div>
                  <div className="font-bold text-indigo-600 dark:text-indigo-400">
                    {alloc.term_label || `Trimester ${alloc.term_number}`}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-slate-400" />
                    {alloc.start_date ? `${alloc.start_date} ~ ${alloc.end_date || 'Ongoing'}` : 'Scheduled'}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {canManageCurriculum && (
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => openEditModal(alloc)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit / Reassign
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Remove allocation of '${alloc.subject_name}' for batch '${alloc.batch_name}'?`)) {
                        deleteAllocationMutation.mutate(alloc.id);
                      }
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition-colors"
                    title="Remove Allocation"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* CREATE / EDIT ALLOCATION MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-500" />
                  {editingAllocation ? 'Edit Faculty-Subject Allocation' : 'New Faculty-Subject Allocation'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Select existing subject, program batch, and assign faculty instructor
                </p>
              </div>
              <button
                onClick={() => closeModal()}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Error Message */}
            {modalError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {/* Field 1: Subject Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Subject <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={subjectIdInput}
                  onChange={(e) => setSubjectIdInput(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="" disabled>Select Subject</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code}) {s.course_code ? `— ${s.course_code}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Field 2: Batch Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Target Batch & Program <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={batchIdInput}
                  onChange={(e) => setBatchIdInput(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="" disabled>Select Batch</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Field 3: Faculty Type & Faculty Member */}
              <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-indigo-950 dark:text-indigo-200 uppercase tracking-wider mb-1.5">
                    Faculty Instructor Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFacTypeInput('internal')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                        facTypeInput === 'internal'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      Internal Faculty
                    </button>
                    <button
                      type="button"
                      onClick={() => setFacTypeInput('external')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                        facTypeInput === 'external'
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      Visiting Expert
                    </button>
                  </div>
                </div>

                {/* Faculty Dropdown */}
                {facTypeInput === 'internal' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Select Internal Faculty Member
                    </label>
                    <select
                      value={facInternalIdInput}
                      onChange={(e) => setFacInternalIdInput(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                    >
                      <option value="">No Faculty Assigned</option>
                      {internalFaculty.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.full_name} ({f.designation} • {f.department})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Select Visiting / External Expert
                    </label>
                    <select
                      value={facExternalIdInput}
                      onChange={(e) => setFacExternalIdInput(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                    >
                      <option value="">No Faculty Assigned</option>
                      {externalFaculty.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} ({f.organization || 'External Expert'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Field 4: Academic Period & Term */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Term Type
                  </label>
                  <select
                    value={termTypeInput}
                    onChange={(e) => {
                      setTermTypeInput(e.target.value);
                      setTermLabelInput(`${e.target.value === 'trimester' ? 'Trimester' : 'Semester'} ${termNumberInput}`);
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="trimester">Trimester</option>
                    <option value="semester">Semester</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Term Number
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={termNumberInput}
                    onChange={(e) => {
                      const num = parseInt(e.target.value) || 1;
                      setTermNumberInput(num);
                      setTermLabelInput(`${termTypeInput === 'trimester' ? 'Trimester' : 'Semester'} ${num}`);
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Term Label
                  </label>
                  <input
                    type="text"
                    value={termLabelInput}
                    onChange={(e) => setTermLabelInput(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                    placeholder="e.g. Trimester 1"
                  />
                </div>
              </div>

              {/* Field 5: Schedule Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDateInput}
                    onChange={(e) => setStartDateInput(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDateInput}
                    onChange={(e) => setEndDateInput(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Field 6: Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Allocation Status
                </label>
                <select
                  value={statusInput}
                  onChange={(e) => setStatusInput(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white cursor-pointer"
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="upcoming">Upcoming</option>
                </select>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => closeModal()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createAllocationMutation.isPending || updateAllocationMutation.isPending}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20 disabled:opacity-50 flex items-center gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {editingAllocation ? 'Save Allocation Changes' : 'Confirm Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
