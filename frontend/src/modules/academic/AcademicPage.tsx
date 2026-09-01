import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  GraduationCap,
  Layers,
  FolderTree,
  Pencil,
  Trash2,
  Users,
  UserPlus,
  RefreshCw,
  X,
  Search,
  Download,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../../components/Card';
import { DataTable, Column } from '../../components/DataTable';
import { useRoleAccess } from '../../lib/useRoleAccess';
import { StudentExportModal } from '../../components/StudentExportModal';

interface Program {
  id: string;
  name: string;
  code: string;
  description?: string;
  is_active: boolean;
}

interface Batch {
  id: string;
  program_id: string;
  name: string;
  code: string;
  student_count: number;
  is_active: boolean;
}

interface Division {
  id: string;
  program_id: string;
  program_name?: string;
  name: string;
  code: string;
  description?: string;
  student_count: number;
  is_active: boolean;
}

interface StudentBrief {
  id: string;
  full_name: string;
  prn_number: string;
  program_id?: string;
  program_name?: string;
  batch_id?: string;
  batch_name?: string;
  division_ids?: string[];
  division_names?: string[];
  trimester: number;
  email_official: string;
  roll_no: string;
  status: string;
}

export const AcademicPage: React.FC = () => {
  const { canManageCurriculum } = useRoleAccess();
  const [searchParams, setSearchParams] = useSearchParams();

  const queryTab = searchParams.get('tab') as 'programs' | 'batches' | 'divisions' | null;
  const [activeTab, setActiveTab] = useState<'programs' | 'batches' | 'divisions'>(queryTab || 'programs');

  useEffect(() => {
    if (queryTab) setActiveTab(queryTab);
  }, [queryTab]);

  const handleTabChange = (tab: 'programs' | 'batches' | 'divisions') => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    next.delete('modal');
    next.delete('id');
    next.delete('batchId');
    next.delete('divId');
    next.delete('studentId');
    next.delete('modalTab');
    setSearchParams(next);
  };

  // Modal States
  const [modalType, setModalType] = useState<
    'createProgram' | 'editProgram' | 'createBatch' | 'editBatch' | 'createDivision' | 'editDivision' | null
  >(null);

  // Form State
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [programIdInput, setProgramIdInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Batch Students State
  const [selectedBatchForStudents, setSelectedBatchForStudents] = useState<Batch | null>(null);
  const [assignSearch, setAssignSearch] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [reassigningStudent, setReassigningStudent] = useState<StudentBrief | null>(null);
  const [targetBatchId, setTargetBatchId] = useState<string>('');
  const [batchModalTab, setBatchModalTab] = useState<'enrolled' | 'unassigned'>('enrolled');

  // Division Students Modal State
  const [selectedDivisionForStudents, setSelectedDivisionForStudents] = useState<Division | null>(null);
  const [divModalTab, setDivModalTab] = useState<'enrolled' | 'unassigned'>('enrolled');
  const [divAssignSearch, setDivAssignSearch] = useState('');
  const [selectedDivStudentIds, setSelectedDivStudentIds] = useState<Set<string>>(new Set());

  // Export Modal State
  const [exportTarget, setExportTarget] = useState<{
    title: string;
    subtitle: string;
    students: StudentBrief[];
    filenamePrefix: string;
  } | null>(null);

  const updateUrlModal = (m: string | null, params: Record<string, string | undefined> = {}) => {
    const next = new URLSearchParams(searchParams);
    if (!m) {
      next.delete('modal');
      next.delete('id');
      next.delete('batchId');
      next.delete('divId');
      next.delete('studentId');
      next.delete('modalTab');
    } else {
      next.set('modal', m);
      Object.entries(params).forEach(([k, v]) => {
        if (v) next.set(k, v);
        else next.delete(k);
      });
    }
    setSearchParams(next);
  };

  const queryClient = useQueryClient();

  // Queries
  const { data: programsData, isLoading: progLoading } = useQuery({
    queryKey: ['programs'],
    queryFn: async () => {
      const res = await api.get('/academic/programs');
      return res.data.data as Program[];
    },
  });

  const { data: batchesData, isLoading: batchLoading } = useQuery({
    queryKey: ['batches'],
    queryFn: async () => {
      const res = await api.get('/academic/batches');
      return res.data.data as Batch[];
    },
  });

  const { data: divisionsData, isLoading: divLoading } = useQuery({
    queryKey: ['divisions'],
    queryFn: async () => {
      const res = await api.get('/academic/divisions');
      return res.data.data as Division[];
    },
  });

  // Batch Students Query
  const { data: batchStudentsData, isLoading: batchStudentsLoading } = useQuery({
    queryKey: ['batch-students', selectedBatchForStudents?.id],
    queryFn: async () => {
      if (!selectedBatchForStudents) return [];
      const res = await api.get(`/students?batch_id=${selectedBatchForStudents.id}`);
      return res.data.data as StudentBrief[];
    },
    enabled: !!selectedBatchForStudents,
  });

  // All Students Query (for batch unassigned modal)
  const { data: allStudentsData, isLoading: allStudentsLoading } = useQuery({
    queryKey: ['students-all'],
    queryFn: async () => {
      const res = await api.get('/students');
      return res.data.data as StudentBrief[];
    },
    enabled: !!selectedBatchForStudents,
  });

  // Division Students Query
  const { data: divStudentsData, isLoading: divStudentsLoading } = useQuery({
    queryKey: ['division-students', selectedDivisionForStudents?.id],
    queryFn: async () => {
      if (!selectedDivisionForStudents) return [];
      const res = await api.get(`/academic/divisions/${selectedDivisionForStudents.id}/students`);
      return res.data.data as StudentBrief[];
    },
    enabled: !!selectedDivisionForStudents,
  });

  // Parent Program Students Query (for Division allocation across all batches in Program)
  const { data: programStudentsData, isLoading: programStudentsLoading } = useQuery({
    queryKey: ['program-students-for-div', selectedDivisionForStudents?.program_id],
    queryFn: async () => {
      if (!selectedDivisionForStudents) return [];
      const res = await api.get(`/students?program_id=${selectedDivisionForStudents.program_id}`);
      return res.data.data as StudentBrief[];
    },
    enabled: !!selectedDivisionForStudents,
  });

  // Program Mutations
  const createProgramMutation = useMutation({
    mutationFn: async (payload: { name: string; code: string; description: string }) => {
      const res = await api.post('/academic/programs', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      closeModal();
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.error?.message || err?.message || 'Failed to create program');
    },
  });

  const updateProgramMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<Program> }) => {
      const res = await api.put(`/academic/programs/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      closeModal();
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.error?.message || err?.message || 'Failed to update program');
    },
  });

  const deleteProgramMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/academic/programs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
    },
    onError: (err: any) => {
      alert(err?.response?.data?.error?.message || 'Failed to delete program');
    },
  });

  // Batch Mutations
  const createBatchMutation = useMutation({
    mutationFn: async (payload: { program_id?: string; name: string; code: string }) => {
      const res = await api.post('/academic/batches', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      closeModal();
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.error?.message || err?.message || 'Failed to create batch');
    },
  });

  const updateBatchMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<Batch> }) => {
      const res = await api.put(`/academic/batches/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      closeModal();
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.error?.message || err?.message || 'Failed to update batch');
    },
  });

  const deleteBatchMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/academic/batches/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
    },
    onError: (err: any) => {
      alert(err?.response?.data?.error?.message || 'Failed to delete batch');
    },
  });

  // Division Mutations
  const createDivisionMutation = useMutation({
    mutationFn: async (payload: { program_id: string; name: string; code: string; description?: string }) => {
      const res = await api.post('/academic/divisions', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divisions'] });
      closeModal();
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.error?.message || err?.message || 'Failed to create division');
    },
  });

  const updateDivisionMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<Division> }) => {
      const res = await api.put(`/academic/divisions/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divisions'] });
      closeModal();
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.error?.message || err?.message || 'Failed to update division');
    },
  });

  const deleteDivisionMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/academic/divisions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divisions'] });
    },
    onError: (err: any) => {
      alert(err?.response?.data?.error?.message || 'Failed to delete division');
    },
  });

  // Batch Reassign Mutation (removes from current batch, assigns to target active batch)
  const reassignStudentBatchMutation = useMutation({
    mutationFn: async ({ studentId, batchId }: { studentId: string; batchId: string }) => {
      const res = await api.put(`/students/${studentId}`, { batch_id: batchId });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-students', selectedBatchForStudents?.id] });
      queryClient.invalidateQueries({ queryKey: ['students-all'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setReassigningStudent(null);
      setTargetBatchId('');
    },
    onError: (err: any) => {
      alert(err?.response?.data?.error?.message || 'Failed to reassign student batch');
    },
  });

  // Bulk Assign Mutation
  const bulkAssignStudentsMutation = useMutation({
    mutationFn: async ({ batchId, studentIds }: { batchId: string; studentIds: string[] }) => {
      const res = await api.post(`/academic/batches/${batchId}/students/assign`, {
        student_ids: studentIds,
        assign: true,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-students', selectedBatchForStudents?.id] });
      queryClient.invalidateQueries({ queryKey: ['students-all'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setSelectedStudentIds(new Set());
    },
    onError: (err: any) => {
      alert(err?.response?.data?.error?.message || 'Failed to assign students');
    },
  });

  // Assign Division Students Mutation
  const assignDivisionStudentsMutation = useMutation({
    mutationFn: async ({ divisionId, studentIds, assign }: { divisionId: string; studentIds: string[]; assign: boolean }) => {
      const res = await api.post(`/academic/divisions/${divisionId}/students/assign`, {
        student_ids: studentIds,
        assign,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['division-students', selectedDivisionForStudents?.id] });
      queryClient.invalidateQueries({ queryKey: ['divisions'] });
      setSelectedDivStudentIds(new Set());
    },
    onError: (err: any) => {
      alert(err?.response?.data?.error?.message || 'Failed to update division students');
    },
  });

  // Handlers
  const closeModal = (syncUrl = true) => {
    if (syncUrl) updateUrlModal(null);
    setModalType(null);
    setSelectedId(null);
    setNameInput('');
    setCodeInput('');
    setDescInput('');
    setProgramIdInput('');
    setErrorMsg(null);
  };

  const openCreateProgram = (syncUrl = true) => {
    closeModal(false);
    setModalType('createProgram');
    if (syncUrl) updateUrlModal('createProgram');
  };

  const openEditProgram = (prog: Program, syncUrl = true) => {
    closeModal(false);
    setSelectedId(prog.id);
    setNameInput(prog.name);
    setCodeInput(prog.code);
    setDescInput(prog.description || '');
    setModalType('editProgram');
    if (syncUrl) updateUrlModal('editProgram', { id: prog.id });
  };

  const openCreateBatch = (syncUrl = true) => {
    closeModal(false);
    if (programsData && programsData.length > 0) {
      setProgramIdInput(programsData[0].id);
    }
    setModalType('createBatch');
    if (syncUrl) updateUrlModal('createBatch');
  };

  const openEditBatch = (batch: Batch, syncUrl = true) => {
    closeModal(false);
    setSelectedId(batch.id);
    setNameInput(batch.name);
    setCodeInput(batch.code);
    setProgramIdInput(batch.program_id || '');
    setModalType('editBatch');
    if (syncUrl) updateUrlModal('editBatch', { id: batch.id });
  };

  const openCreateDivision = (syncUrl = true) => {
    closeModal(false);
    if (programsData && programsData.length > 0) {
      setProgramIdInput(programsData[0].id);
    }
    setModalType('createDivision');
    if (syncUrl) updateUrlModal('createDivision');
  };

  const openEditDivision = (div: Division, syncUrl = true) => {
    closeModal(false);
    setSelectedId(div.id);
    setNameInput(div.name);
    setCodeInput(div.code);
    setProgramIdInput(div.program_id || '');
    setDescInput(div.description || '');
    setModalType('editDivision');
    if (syncUrl) updateUrlModal('editDivision', { id: div.id });
  };

  const openBatchStudentsModal = (batch: Batch, syncUrl = true, tab: 'enrolled' | 'unassigned' = 'enrolled') => {
    setSelectedBatchForStudents(batch);
    setBatchModalTab(tab);
    setAssignSearch('');
    setSelectedStudentIds(new Set());
    if (syncUrl) updateUrlModal('batchStudents', { batchId: batch.id, modalTab: tab });
  };

  const closeBatchStudentsModal = (syncUrl = true) => {
    if (syncUrl) updateUrlModal(null);
    setSelectedBatchForStudents(null);
    setAssignSearch('');
    setSelectedStudentIds(new Set());
  };

  const openDivisionStudentsModal = (div: Division, syncUrl = true, tab: 'enrolled' | 'unassigned' = 'enrolled') => {
    setSelectedDivisionForStudents(div);
    setDivModalTab(tab);
    setDivAssignSearch('');
    setSelectedDivStudentIds(new Set());
    if (syncUrl) updateUrlModal('divisionStudents', { divId: div.id, modalTab: tab });
  };

  const closeDivisionStudentsModal = (syncUrl = true) => {
    if (syncUrl) updateUrlModal(null);
    setSelectedDivisionForStudents(null);
    setDivAssignSearch('');
    setSelectedDivStudentIds(new Set());
  };

  const openReassignModal = (student: StudentBrief, syncUrl = true) => {
    setReassigningStudent(student);
    const availableBatches = (batchesData || []).filter((b) => b.id !== selectedBatchForStudents?.id);
    if (availableBatches.length > 0) {
      setTargetBatchId(availableBatches[0].id);
    } else {
      setTargetBatchId('');
    }
    if (syncUrl) updateUrlModal('reassignBatch', { studentId: student.id });
  };

  const closeReassignModal = (syncUrl = true) => {
    if (syncUrl) {
      if (selectedBatchForStudents) {
        updateUrlModal('batchStudents', { batchId: selectedBatchForStudents.id, modalTab: batchModalTab });
      } else {
        updateUrlModal(null);
      }
    }
    setReassigningStudent(null);
  };

  // Synchronize modal state with URL parameters
  const urlModal = searchParams.get('modal');
  const urlId = searchParams.get('id');
  const urlBatchId = searchParams.get('batchId');
  const urlDivId = searchParams.get('divId');
  const urlStudentId = searchParams.get('studentId');
  const urlModalTab = (searchParams.get('modalTab') as 'enrolled' | 'unassigned') || 'enrolled';

  useEffect(() => {
    if (!urlModal) {
      if (modalType) closeModal(false);
      if (selectedBatchForStudents) closeBatchStudentsModal(false);
      if (selectedDivisionForStudents) closeDivisionStudentsModal(false);
      if (reassigningStudent) closeReassignModal(false);
      return;
    }

    if (urlModal === 'createProgram' && modalType !== 'createProgram') openCreateProgram(false);
    if (urlModal === 'createBatch' && modalType !== 'createBatch') openCreateBatch(false);
    if (urlModal === 'createDivision' && modalType !== 'createDivision') openCreateDivision(false);

    if (urlId) {
      if (urlModal === 'editProgram' && programsData) {
        const p = programsData.find((x) => x.id === urlId);
        if (p && modalType !== 'editProgram') openEditProgram(p, false);
      }
      if (urlModal === 'editBatch' && batchesData) {
        const b = batchesData.find((x) => x.id === urlId);
        if (b && modalType !== 'editBatch') openEditBatch(b, false);
      }
      if (urlModal === 'editDivision' && divisionsData) {
        const d = divisionsData.find((x) => x.id === urlId);
        if (d && modalType !== 'editDivision') openEditDivision(d, false);
      }
    }

    if (urlModal === 'batchStudents' && urlBatchId && batchesData) {
      const b = batchesData.find((x) => x.id === urlBatchId);
      if (b && selectedBatchForStudents?.id !== b.id) {
        openBatchStudentsModal(b, false, urlModalTab);
      }
    }

    if (urlModal === 'divisionStudents' && urlDivId && divisionsData) {
      const d = divisionsData.find((x) => x.id === urlDivId);
      if (d && selectedDivisionForStudents?.id !== d.id) {
        openDivisionStudentsModal(d, false, urlModalTab);
      }
    }
  }, [urlModal, urlId, urlBatchId, urlDivId, urlStudentId, urlModalTab, programsData, batchesData, divisionsData]);

  const handleConfirmReassign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassigningStudent || !targetBatchId) return;
    reassignStudentBatchMutation.mutate({
      studentId: reassigningStudent.id,
      batchId: targetBatchId,
    });
  };

  const handleBulkAssign = () => {
    if (!selectedBatchForStudents || selectedStudentIds.size === 0) return;
    bulkAssignStudentsMutation.mutate({
      batchId: selectedBatchForStudents.id,
      studentIds: Array.from(selectedStudentIds),
    });
  };

  const handleBulkDivAssign = (assign: boolean) => {
    if (!selectedDivisionForStudents || selectedDivStudentIds.size === 0) return;
    assignDivisionStudentsMutation.mutate({
      divisionId: selectedDivisionForStudents.id,
      studentIds: Array.from(selectedDivStudentIds),
      assign,
    });
  };

  // Submit Handlers
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (modalType === 'createProgram') {
      createProgramMutation.mutate({ name: nameInput, code: codeInput, description: descInput });
    } else if (modalType === 'editProgram' && selectedId) {
      updateProgramMutation.mutate({
        id: selectedId,
        payload: { name: nameInput, code: codeInput, description: descInput },
      });
    } else if (modalType === 'createBatch') {
      createBatchMutation.mutate({
        program_id: programIdInput || undefined,
        name: nameInput,
        code: codeInput,
      });
    } else if (modalType === 'editBatch' && selectedId) {
      updateBatchMutation.mutate({
        id: selectedId,
        payload: {
          program_id: programIdInput || undefined,
          name: nameInput,
          code: codeInput,
        },
      });
    } else if (modalType === 'createDivision') {
      createDivisionMutation.mutate({
        program_id: programIdInput,
        name: nameInput,
        code: codeInput,
        description: descInput,
      });
    } else if (modalType === 'editDivision' && selectedId) {
      updateDivisionMutation.mutate({
        id: selectedId,
        payload: {
          program_id: programIdInput || undefined,
          name: nameInput,
          code: codeInput,
          description: descInput,
        },
      });
    }
  };

  const isSaving =
    createProgramMutation.isPending ||
    updateProgramMutation.isPending ||
    createBatchMutation.isPending ||
    updateBatchMutation.isPending ||
    createDivisionMutation.isPending ||
    updateDivisionMutation.isPending;

  // Columns Definitions
  const programColumns: Column<Program>[] = [
    { header: 'Code', accessor: 'code', className: 'font-mono text-cyan-600 dark:text-cyan-400 font-semibold' },
    { header: 'Program Name', accessor: 'name', className: 'font-medium text-slate-900 dark:text-slate-100' },
    { header: 'Description', accessor: (r) => r.description || '—', className: 'text-slate-500 dark:text-slate-400' },
    {
      header: 'Status',
      accessor: (r) => (
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            r.is_active
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
          }`}
        >
          {r.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: (r) =>
        canManageCurriculum ? (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => openEditProgram(r)}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              title="Edit Program"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete program ${r.name}?`)) deleteProgramMutation.mutate(r.id);
              }}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              title="Delete Program"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <span className="text-xs text-slate-400">View only</span>
        ),
    },
  ];

  const batchColumns: Column<Batch>[] = [
    { header: 'Batch Code', accessor: 'code', className: 'font-mono text-cyan-600 dark:text-cyan-400 font-semibold' },
    { header: 'Batch Name', accessor: 'name', className: 'font-medium text-slate-900 dark:text-slate-100' },
    {
      header: 'Enrolled Students',
      accessor: (r) => (
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30">
          {r.student_count || 0} Students
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: (r) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => openBatchStudentsModal(r)}
            className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors flex items-center space-x-1"
          >
            <Users className="h-3.5 w-3.5" />
            <span>Students</span>
          </button>
          {canManageCurriculum && (
            <>
              <button
                onClick={() => openEditBatch(r)}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                title="Edit Batch"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete batch ${r.name}?`)) deleteBatchMutation.mutate(r.id);
                }}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                title="Delete Batch"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  const divisionColumns: Column<Division>[] = [
    { header: 'Division Code', accessor: 'code', className: 'font-mono text-cyan-600 dark:text-cyan-400 font-semibold' },
    { header: 'Division Name', accessor: 'name', className: 'font-medium text-slate-900 dark:text-slate-100' },
    { header: 'Parent Program', accessor: (r) => r.program_name || '—', className: 'text-slate-700 dark:text-slate-300 font-medium' },
    {
      header: 'Assigned Students',
      accessor: (r) => (
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/30">
          {r.student_count || 0} Students
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: (r) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => openDivisionStudentsModal(r)}
            className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors flex items-center space-x-1"
          >
            <Users className="h-3.5 w-3.5" />
            <span>Students</span>
          </button>
          {canManageCurriculum && (
            <>
              <button
                onClick={() => openEditDivision(r)}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                title="Edit Division"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete division ${r.name}?`)) deleteDivisionMutation.mutate(r.id);
                }}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                title="Delete Division"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight gradient-text">Program Setup</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Manage institutional programs, academic terms, batches, and sub-divisions.
          </p>
        </div>
        {canManageCurriculum && (
          <div>
            {activeTab === 'programs' && (
              <button
                onClick={() => openCreateProgram()}
                className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/35 transition-all duration-200"
              >
                <Plus className="h-4 w-4" />
                <span>New Program</span>
              </button>
            )}

            {activeTab === 'batches' && (
              <button
                onClick={() => openCreateBatch()}
                className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-sky-600 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/35 transition-all duration-200"
              >
                <Plus className="h-4 w-4" />
                <span>New Batch</span>
              </button>
            )}

            {activeTab === 'divisions' && (
              <button
                onClick={() => openCreateDivision()}
                className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/20 hover:shadow-purple-500/35 transition-all duration-200"
              >
                <Plus className="h-4 w-4" />
                <span>New Division</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-6">
        <button
          onClick={() => handleTabChange('programs')}
          className={`pb-3 text-sm font-medium border-b-2 flex items-center space-x-2 transition-colors ${
            activeTab === 'programs'
              ? 'border-cyan-600 text-cyan-600 dark:border-cyan-400 dark:text-cyan-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <GraduationCap className="h-4 w-4" />
          <span>Programs ({programsData?.length || 0})</span>
        </button>
        <button
          onClick={() => handleTabChange('batches')}
          className={`pb-3 text-sm font-medium border-b-2 flex items-center space-x-2 transition-colors ${
            activeTab === 'batches'
              ? 'border-cyan-600 text-cyan-600 dark:border-cyan-400 dark:text-cyan-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Batches ({batchesData?.length || 0})</span>
        </button>
        <button
          onClick={() => handleTabChange('divisions')}
          className={`pb-3 text-sm font-medium border-b-2 flex items-center space-x-2 transition-colors ${
            activeTab === 'divisions'
              ? 'border-cyan-600 text-cyan-600 dark:border-cyan-400 dark:text-cyan-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <FolderTree className="h-4 w-4" />
          <span>Divisions ({divisionsData?.length || 0})</span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'programs' && (
        <Card title="Degree & Diploma Programs">
          {progLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-4">Loading programs...</p>
          ) : (
            <DataTable
              columns={programColumns}
              data={programsData || []}
              keyExtractor={(r) => r.id}
              emptyMessage="No academic programs created yet. Click 'New Program' to add your first program."
            />
          )}
        </Card>
      )}

      {activeTab === 'batches' && (
        <Card title="Academic Batches">
          {batchLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-4">Loading batches...</p>
          ) : (
            <DataTable
              columns={batchColumns}
              data={batchesData || []}
              keyExtractor={(r) => r.id}
              emptyMessage="No batches created yet. Click 'New Batch' to add a batch."
            />
          )}
        </Card>
      )}

      {activeTab === 'divisions' && (
        <Card title="Program Divisions">
          {divLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-4">Loading divisions...</p>
          ) : (
            <DataTable
              columns={divisionColumns}
              data={divisionsData || []}
              keyExtractor={(r) => r.id}
              emptyMessage="No divisions created yet. Click 'New Division' to add a division under a program."
            />
          )}
        </Card>
      )}

      {/* Batch Students Enrollment Modal */}
      {selectedBatchForStudents && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-4xl rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 transition-colors duration-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Students in {selectedBatchForStudents.name} ({selectedBatchForStudents.code})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Manage enrolled students and assign unallocated students to this batch.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() =>
                    setExportTarget({
                      title: `Batch: ${selectedBatchForStudents.name}`,
                      subtitle: `Batch Code: ${selectedBatchForStudents.code}`,
                      students: batchStudentsData || [],
                      filenamePrefix: `Batch_${selectedBatchForStudents.name}_Students`,
                    })
                  }
                  disabled={!batchStudentsData || batchStudentsData.length === 0}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                  title="Export student list to Excel (.xlsx)"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export XLSX</span>
                </button>
                <button
                  onClick={() => closeBatchStudentsModal()}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Tab navigation within Modal */}
            <div className="flex space-x-4 border-b border-slate-200 dark:border-slate-800 mt-4">
              <button
                onClick={() => {
                  setBatchModalTab('enrolled');
                  updateUrlModal('batchStudents', { batchId: selectedBatchForStudents.id, modalTab: 'enrolled' });
                }}
                className={`pb-2.5 text-sm font-semibold border-b-2 flex items-center space-x-2 transition-colors ${
                  batchModalTab === 'enrolled'
                    ? 'border-cyan-600 text-cyan-600 dark:border-cyan-400 dark:text-cyan-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Users className="h-4 w-4" />
                <span>Enrolled Students ({batchStudentsData?.length || 0})</span>
              </button>
              <button
                onClick={() => {
                  setBatchModalTab('unassigned');
                  updateUrlModal('batchStudents', { batchId: selectedBatchForStudents.id, modalTab: 'unassigned' });
                }}
                className={`pb-2.5 text-sm font-semibold border-b-2 flex items-center space-x-2 transition-colors ${
                  batchModalTab === 'unassigned'
                    ? 'border-cyan-600 text-cyan-600 dark:border-cyan-400 dark:text-cyan-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <UserPlus className="h-4 w-4" />
                <span>
                  Enroll Remaining Students (
                  {(allStudentsData || []).filter((s) => !s.batch_id).length})
                </span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {batchModalTab === 'enrolled' ? (
                batchStudentsLoading ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
                    Loading batch students...
                  </p>
                ) : batchStudentsData?.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                      No students enrolled in this batch yet.
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Switch to "Enroll Remaining Students" tab to allocate students to this batch.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {batchStudentsData?.map((s) => (
                      <div key={s.id} className="py-3 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="h-9 w-9 rounded-full bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 flex items-center justify-center text-cyan-700 dark:text-cyan-300 font-bold text-xs">
                            {s.full_name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{s.full_name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              PRN: <span className="font-mono">{s.prn_number}</span> · Trimester {s.trimester}
                              {s.program_name && <span> · {s.program_name}</span>}
                            </p>
                          </div>
                        </div>
                        {canManageCurriculum && (
                          <button
                            onClick={() => openReassignModal(s)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 transition-colors"
                            title="Reassign to another batch"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            <span>Reassign Batch</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )
              ) : (
                /* Unassigned / Remaining Students Allocation Tab */
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search remaining students by PRN or Name..."
                      value={assignSearch}
                      onChange={(e) => setAssignSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-cyan-500 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  {allStudentsLoading ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
                      Loading remaining directory students...
                    </p>
                  ) : (
                    (() => {
                      const unassignedList = (allStudentsData || []).filter((s) => {
                        const notInBatch = !s.batch_id;
                        const matchQuery =
                          !assignSearch ||
                          s.full_name.toLowerCase().includes(assignSearch.toLowerCase()) ||
                          s.prn_number.toLowerCase().includes(assignSearch.toLowerCase());
                        return notInBatch && matchQuery;
                      });

                      if (unassignedList.length === 0) {
                        return (
                          <div className="text-center py-8">
                            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                              All students in the directory are already allocated to a batch.
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between px-1">
                            <button
                              onClick={() => {
                                if (selectedStudentIds.size === unassignedList.length) {
                                  setSelectedStudentIds(new Set());
                                } else {
                                  setSelectedStudentIds(new Set(unassignedList.map((s) => s.id)));
                                }
                              }}
                              className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline"
                            >
                              {selectedStudentIds.size === unassignedList.length
                                ? 'Deselect All'
                                : `Select All (${unassignedList.length})`}
                            </button>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {selectedStudentIds.size} student(s) selected
                            </span>
                          </div>

                          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 bg-slate-50/50 dark:bg-slate-950/50">
                            {unassignedList.map((s) => {
                              const isChecked = selectedStudentIds.has(s.id);
                              return (
                                <div
                                  key={s.id}
                                  onClick={() => {
                                    const newSet = new Set(selectedStudentIds);
                                    if (isChecked) newSet.delete(s.id);
                                    else newSet.add(s.id);
                                    setSelectedStudentIds(newSet);
                                  }}
                                  className={`py-2.5 px-3 flex items-center justify-between cursor-pointer rounded-xl transition-colors ${
                                    isChecked
                                      ? 'bg-cyan-50/80 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30'
                                      : 'hover:bg-slate-100 dark:hover:bg-slate-900'
                                  }`}
                                >
                                  <div className="flex items-center space-x-3">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {}}
                                      className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                                    />
                                    <div>
                                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                        {s.full_name}
                                      </p>
                                      <p className="text-xs text-slate-500 dark:text-slate-400">
                                        PRN: <span className="font-mono">{s.prn_number}</span> · {s.program_name || 'No Program'}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end space-x-3">
              <button
                onClick={() => setSelectedBatchForStudents(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Close
              </button>

              {batchModalTab === 'unassigned' && selectedStudentIds.size > 0 && (
                <button
                  onClick={handleBulkAssign}
                  disabled={bulkAssignStudentsMutation.isPending}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-emerald-600 to-cyan-600 text-white shadow disabled:opacity-50 transition-opacity"
                >
                  {bulkAssignStudentsMutation.isPending
                    ? 'Enrolling...'
                    : `Enroll ${selectedStudentIds.size} Selected Student(s)`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Division Students Modal */}
      {selectedDivisionForStudents && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-4xl rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 transition-colors duration-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Students in Division {selectedDivisionForStudents.name} ({selectedDivisionForStudents.code})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Parent Program: <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedDivisionForStudents.program_name}</span>
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() =>
                    setExportTarget({
                      title: `Division: ${selectedDivisionForStudents.name}`,
                      subtitle: `Program: ${selectedDivisionForStudents.program_name || 'Academic Program'}`,
                      students: divStudentsData || [],
                      filenamePrefix: `Division_${selectedDivisionForStudents.name}_Students`,
                    })
                  }
                  disabled={!divStudentsData || divStudentsData.length === 0}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                  title="Export student list to Excel (.xlsx)"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export XLSX</span>
                </button>
                <button
                  onClick={() => closeDivisionStudentsModal()}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Tab navigation within Modal */}
            <div className="flex space-x-4 border-b border-slate-200 dark:border-slate-800 mt-4">
              <button
                onClick={() => {
                  setDivModalTab('enrolled');
                  updateUrlModal('divisionStudents', { divId: selectedDivisionForStudents.id, modalTab: 'enrolled' });
                }}
                className={`pb-2.5 text-sm font-semibold border-b-2 flex items-center space-x-2 transition-colors ${
                  divModalTab === 'enrolled'
                    ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Users className="h-4 w-4" />
                <span>Assigned Students ({divStudentsData?.length || 0})</span>
              </button>
              <button
                onClick={() => {
                  setDivModalTab('unassigned');
                  updateUrlModal('divisionStudents', { divId: selectedDivisionForStudents.id, modalTab: 'unassigned' });
                }}
                className={`pb-2.5 text-sm font-semibold border-b-2 flex items-center space-x-2 transition-colors ${
                  divModalTab === 'unassigned'
                    ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <UserPlus className="h-4 w-4" />
                <span>
                  Assign Remaining Program Students (
                  {(programStudentsData || []).filter((s) => !divStudentsData?.some((ds) => ds.id === s.id)).length})
                </span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {divModalTab === 'enrolled' ? (
                divStudentsLoading ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
                    Loading division students...
                  </p>
                ) : divStudentsData?.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                      No students assigned to this division yet.
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Switch to "Assign Remaining Program Students" tab to allocate students from {selectedDivisionForStudents.program_name}.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {divStudentsData?.map((s) => (
                      <div key={s.id} className="py-3 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="h-9 w-9 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                            {s.full_name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{s.full_name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              PRN: <span className="font-mono">{s.prn_number}</span> · Batch: {s.batch_name || 'No Batch'}
                            </p>
                          </div>
                        </div>
                        {canManageCurriculum && (
                          <button
                            onClick={() => {
                              if (confirm(`Remove ${s.full_name} from division ${selectedDivisionForStudents.name}?`)) {
                                assignDivisionStudentsMutation.mutate({
                                  divisionId: selectedDivisionForStudents.id,
                                  studentIds: [s.id],
                                  assign: false,
                                });
                              }
                            }}
                            className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 transition-colors"
                          >
                            <span>Remove</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )
              ) : (
                /* Assign Remaining Program Students Tab */
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search program students by PRN or Name..."
                      value={divAssignSearch}
                      onChange={(e) => setDivAssignSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  {programStudentsLoading ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
                      Loading program students...
                    </p>
                  ) : (
                    (() => {
                      const unassignedFromDiv = (programStudentsData || []).filter((s) => {
                        const notInDiv = !divStudentsData?.some((ds) => ds.id === s.id);
                        const matchQuery =
                          !divAssignSearch ||
                          s.full_name.toLowerCase().includes(divAssignSearch.toLowerCase()) ||
                          s.prn_number.toLowerCase().includes(divAssignSearch.toLowerCase());
                        return notInDiv && matchQuery;
                      });

                      if (unassignedFromDiv.length === 0) {
                        return (
                          <div className="text-center py-8">
                            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                              All students in {selectedDivisionForStudents.program_name} are already assigned to this division.
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between px-1">
                            <button
                              onClick={() => {
                                if (selectedDivStudentIds.size === unassignedFromDiv.length) {
                                  setSelectedDivStudentIds(new Set());
                                } else {
                                  setSelectedDivStudentIds(new Set(unassignedFromDiv.map((s) => s.id)));
                                }
                              }}
                              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                            >
                              {selectedDivStudentIds.size === unassignedFromDiv.length
                                ? 'Deselect All'
                                : `Select All (${unassignedFromDiv.length})`}
                            </button>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {selectedDivStudentIds.size} student(s) selected
                            </span>
                          </div>

                          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 bg-slate-50/50 dark:bg-slate-950/50">
                            {unassignedFromDiv.map((s) => {
                              const isChecked = selectedDivStudentIds.has(s.id);
                              return (
                                <div
                                  key={s.id}
                                  onClick={() => {
                                    const newSet = new Set(selectedDivStudentIds);
                                    if (isChecked) newSet.delete(s.id);
                                    else newSet.add(s.id);
                                    setSelectedDivStudentIds(newSet);
                                  }}
                                  className={`py-2.5 px-3 flex items-center justify-between cursor-pointer rounded-xl transition-colors ${
                                    isChecked
                                      ? 'bg-indigo-50/80 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30'
                                      : 'hover:bg-slate-100 dark:hover:bg-slate-900'
                                  }`}
                                >
                                  <div className="flex items-center space-x-3">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {}}
                                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <div>
                                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                        {s.full_name}
                                      </p>
                                      <p className="text-xs text-slate-500 dark:text-slate-400">
                                        PRN: <span className="font-mono">{s.prn_number}</span> · Batch: {s.batch_name || 'No Batch'}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end space-x-3">
              <button
                onClick={() => setSelectedDivisionForStudents(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Close
              </button>

              {divModalTab === 'unassigned' && selectedDivStudentIds.size > 0 && (
                <button
                  onClick={() => handleBulkDivAssign(true)}
                  disabled={assignDivisionStudentsMutation.isPending}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow disabled:opacity-50 transition-opacity"
                >
                  {assignDivisionStudentsMutation.isPending
                    ? 'Assigning...'
                    : `Assign ${selectedDivStudentIds.size} Student(s) to Division`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reassign Batch Confirmation Modal */}
      {reassigningStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 transition-colors duration-200">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Reassign Student Batch
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
              Select an active batch to transfer <span className="font-bold text-slate-900 dark:text-slate-100">{reassigningStudent.full_name}</span> (PRN: {reassigningStudent.prn_number}).
            </p>

            <form onSubmit={handleConfirmReassign} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Target Batch
                </label>
                <select
                  value={targetBatchId}
                  onChange={(e) => setTargetBatchId(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  {(batchesData || [])
                    .filter((b) => b.id !== selectedBatchForStudents?.id)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name || b.code}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => closeReassignModal()}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reassignStudentBatchMutation.isPending || !targetBatchId}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow disabled:opacity-50 transition-opacity"
                >
                  {reassignStudentBatchMutation.isPending ? 'Transferring...' : 'Confirm Reassignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unified Dynamic Modal */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-lg rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 transition-colors duration-200">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
              {modalType === 'createProgram' && 'Create Academic Program'}
              {modalType === 'editProgram' && 'Edit Academic Program'}
              {modalType === 'createBatch' && 'Create Batch'}
              {modalType === 'editBatch' && 'Edit Batch'}
              {modalType === 'createDivision' && 'Create Division'}
              {modalType === 'editDivision' && 'Edit Division'}
            </h3>

            {errorMsg && (
              <div className="p-3 mb-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs font-semibold">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Program selection for Batches & Divisions */}
              {(modalType === 'createBatch' || modalType === 'editBatch' || modalType === 'createDivision' || modalType === 'editDivision') && programsData && programsData.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Parent Academic Program
                  </label>
                  <select
                    value={programIdInput}
                    onChange={(e) => setProgramIdInput(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    {programsData.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} — {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Name Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  {modalType.includes('Division')
                    ? 'Division Name'
                    : modalType.includes('Batch')
                    ? 'Batch Name'
                    : 'Program Name'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter name..."
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Code Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Code
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DIV-A or BATCH-2026"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Description for Program or Division */}
              {(modalType === 'createProgram' || modalType === 'editProgram' || modalType === 'createDivision' || modalType === 'editDivision') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Description
                  </label>
                  <textarea
                    placeholder="Overview and description..."
                    value={descInput}
                    onChange={(e) => setDescInput(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500 h-20"
                  />
                </div>
              )}


              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => closeModal()}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-500 dark:hover:bg-cyan-600 text-white disabled:opacity-50 transition-colors"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Student Field Export Modal */}
      {exportTarget && (
        <StudentExportModal
          isOpen={!!exportTarget}
          onClose={() => setExportTarget(null)}
          title={exportTarget.title}
          subtitle={exportTarget.subtitle}
          students={exportTarget.students}
          filenamePrefix={exportTarget.filenamePrefix}
        />
      )}
    </div>
  );
};
