import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  GraduationCap,
  Layers,
  BookOpen,
  Pencil,
  Trash2,
  ListPlus,
  ChevronRight,
  ChevronDown,
  Users,
  UserPlus,
  UserMinus,
  X,
  Search,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../../components/Card';
import { DataTable, Column } from '../../components/DataTable';
import { useRoleAccess } from '../../lib/useRoleAccess';

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
  division?: string;
  student_count: number;
  is_active: boolean;
}

interface Subject {
  id: string;
  name: string;
  code: string;
  credits: number;
}

interface Topic {
  id: string;
  subject_id: string;
  name: string;
  sequence_no: number;
  planned_hours: number;
}

interface StudentBrief {
  id: string;
  full_name: string;
  prn_number: string;
  program_id?: string;
  program_name?: string;
  batch_id?: string;
  batch_name?: string;
  trimester: number;
  email_official: string;
  roll_no: string;
  status: string;
}

export const AcademicPage: React.FC = () => {
  const { canManageCurriculum } = useRoleAccess();
  const [activeTab, setActiveTab] = useState<'programs' | 'batches' | 'subjects'>('programs');

  // Modal States
  const [modalType, setModalType] = useState<
    'createProgram' | 'editProgram' | 'createBatch' | 'editBatch' | 'createSubject' | 'editSubject' | 'createTopic' | null
  >(null);

  // Form State
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [programIdInput, setProgramIdInput] = useState('');
  const [divisionInput, setDivisionInput] = useState('');
  const [studentCountInput, setStudentCountInput] = useState(60);
  const [creditsInput, setCreditsInput] = useState(3);
  const [sequenceNoInput, setSequenceNoInput] = useState(1);
  const [plannedHoursInput, setPlannedHoursInput] = useState(2);
  const [subjectIdForTopic, setSubjectIdForTopic] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null);

  // Batch Students State
  const [selectedBatchForStudents, setSelectedBatchForStudents] = useState<Batch | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignSearch, setAssignSearch] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

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

  // Batch Students Query (only when a batch is selected)
  const { data: batchStudentsData, isLoading: batchStudentsLoading } = useQuery({
    queryKey: ['batch-students', selectedBatchForStudents?.id],
    queryFn: async () => {
      if (!selectedBatchForStudents) return [];
      const res = await api.get(`/academic/batches/${selectedBatchForStudents.id}/students`);
      return res.data.data as StudentBrief[];
    },
    enabled: !!selectedBatchForStudents,
  });

  // All Students Query (for assign modal)
  const { data: allStudentsData } = useQuery({
    queryKey: ['students-all'],
    queryFn: async () => {
      const res = await api.get('/students');
      return res.data.data as StudentBrief[];
    },
    enabled: showAssignModal,
  });

  const { data: subjectsData, isLoading: subLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const res = await api.get('/academic/subjects');
      return res.data.data as Subject[];
    },
  });

  const { data: topicsData } = useQuery({
    queryKey: ['topics', expandedSubjectId],
    queryFn: async () => {
      if (!expandedSubjectId) return [];
      const res = await api.get(`/academic/topics?subject_id=${expandedSubjectId}`);
      return res.data.data as Topic[];
    },
    enabled: !!expandedSubjectId,
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
    mutationFn: async (payload: { program_id?: string; name: string; code: string; division: string; student_count: number }) => {
      const res = await api.post('/academic/batches', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      closeModal();
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.error?.message || err?.message || 'Failed to create batch & division');
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

  // Assign students mutation
  const assignStudentsMutation = useMutation({
    mutationFn: async ({ batchId, studentIds, assign }: { batchId: string; studentIds: string[]; assign: boolean }) => {
      const res = await api.post(`/academic/batches/${batchId}/students/assign`, {
        student_ids: studentIds,
        assign,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-students', selectedBatchForStudents?.id] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['students-all'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setSelectedStudentIds(new Set());
      setShowAssignModal(false);
    },
    onError: (err: any) => {
      alert(err?.response?.data?.error?.message || 'Failed to update enrollment');
    },
  });

  // Remove single student from batch
  const removeStudentFromBatch = (studentId: string) => {
    if (!selectedBatchForStudents) return;
    if (!confirm('Remove this student from the batch?')) return;
    assignStudentsMutation.mutate({
      batchId: selectedBatchForStudents.id,
      studentIds: [studentId],
      assign: false,
    });
  };

  const handleBulkAssign = () => {
    if (!selectedBatchForStudents || selectedStudentIds.size === 0) return;
    assignStudentsMutation.mutate({
      batchId: selectedBatchForStudents.id,
      studentIds: Array.from(selectedStudentIds),
      assign: true,
    });
  };

  // Subject Mutations
  const createSubjectMutation = useMutation({
    mutationFn: async (payload: { name: string; code: string; credits: number }) => {
      const res = await api.post('/academic/subjects', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      closeModal();
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.error?.message || err?.message || 'Failed to create subject');
    },
  });

  const updateSubjectMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<Subject> }) => {
      const res = await api.put(`/academic/subjects/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      closeModal();
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.error?.message || err?.message || 'Failed to update subject');
    },
  });

  const deleteSubjectMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/academic/subjects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    },
    onError: (err: any) => {
      alert(err?.response?.data?.error?.message || 'Failed to delete subject');
    },
  });

  // Topic Mutation
  const createTopicMutation = useMutation({
    mutationFn: async (payload: { subject_id: string; name: string; sequence_no: number; planned_hours: number }) => {
      const res = await api.post('/academic/topics', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics', expandedSubjectId] });
      closeModal();
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.error?.message || err?.message || 'Failed to create topic');
    },
  });

  const deleteTopicMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/academic/topics/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics', expandedSubjectId] });
    },
  });

  // Handlers
  const closeModal = () => {
    setModalType(null);
    setSelectedId(null);
    setNameInput('');
    setCodeInput('');
    setDescInput('');
    setProgramIdInput('');
    setDivisionInput('');
    setStudentCountInput(60);
    setCreditsInput(3);
    setSequenceNoInput(1);
    setPlannedHoursInput(2);
    setSubjectIdForTopic(null);
    setErrorMsg(null);
  };

  const openCreateProgram = () => {
    closeModal();
    setModalType('createProgram');
  };

  const openEditProgram = (prog: Program) => {
    closeModal();
    setSelectedId(prog.id);
    setNameInput(prog.name);
    setCodeInput(prog.code);
    setDescInput(prog.description || '');
    setModalType('editProgram');
  };

  const openCreateBatch = () => {
    closeModal();
    if (programsData && programsData.length > 0) {
      setProgramIdInput(programsData[0].id);
    }
    setModalType('createBatch');
  };

  const openEditBatch = (batch: Batch) => {
    closeModal();
    setSelectedId(batch.id);
    setNameInput(batch.name);
    setCodeInput(batch.code);
    setProgramIdInput(batch.program_id || '');
    setDivisionInput(batch.division || 'Main');
    setStudentCountInput(batch.student_count);
    setModalType('editBatch');
  };

  const openCreateSubject = () => {
    closeModal();
    setModalType('createSubject');
  };

  const openEditSubject = (sub: Subject) => {
    closeModal();
    setSelectedId(sub.id);
    setNameInput(sub.name);
    setCodeInput(sub.code);
    setCreditsInput(sub.credits);
    setModalType('editSubject');
  };

  const openCreateTopic = (subjectId: string) => {
    closeModal();
    setSubjectIdForTopic(subjectId);
    setExpandedSubjectId(subjectId);
    setSequenceNoInput((topicsData?.length || 0) + 1);
    setModalType('createTopic');
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
        division: divisionInput || 'Main',
        student_count: Number(studentCountInput),
      });
    } else if (modalType === 'editBatch' && selectedId) {
      updateBatchMutation.mutate({
        id: selectedId,
        payload: {
          program_id: programIdInput || undefined,
          name: nameInput,
          code: codeInput,
          division: divisionInput,
          student_count: Number(studentCountInput),
        },
      });
    } else if (modalType === 'createSubject') {
      createSubjectMutation.mutate({
        name: nameInput,
        code: codeInput,
        credits: Number(creditsInput),
      });
    } else if (modalType === 'editSubject' && selectedId) {
      updateSubjectMutation.mutate({
        id: selectedId,
        payload: { name: nameInput, code: codeInput, credits: Number(creditsInput) },
      });
    } else if (modalType === 'createTopic' && subjectIdForTopic) {
      createTopicMutation.mutate({
        subject_id: subjectIdForTopic,
        name: nameInput,
        sequence_no: Number(sequenceNoInput),
        planned_hours: Number(plannedHoursInput),
      });
    }
  };

  const isSaving =
    createProgramMutation.isPending ||
    updateProgramMutation.isPending ||
    createBatchMutation.isPending ||
    updateBatchMutation.isPending ||
    createSubjectMutation.isPending ||
    updateSubjectMutation.isPending ||
    createTopicMutation.isPending;

  // Columns Definitions
  const programColumns: Column<Program>[] = [
    { header: 'Code', accessor: 'code', className: 'font-mono text-cyan-600 dark:text-cyan-400 font-semibold' },
    { header: 'Program Name', accessor: 'name', className: 'font-medium text-slate-900 dark:text-slate-100' },
    { header: 'Description', accessor: (r) => r.description || '—', className: 'text-slate-500 dark:text-slate-400' },
    {
      header: 'Status',
      accessor: (r) => (
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
            r.is_active
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30'
              : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30'
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
    { header: 'Batch Code', accessor: 'code', className: 'font-mono text-indigo-600 dark:text-indigo-400 font-semibold' },
    { header: 'Batch Name', accessor: 'name', className: 'font-medium text-slate-900 dark:text-slate-100' },
    { header: 'Division', accessor: (r) => r.division || 'Main', className: 'text-slate-500 dark:text-slate-400' },
    { header: 'Capacity', accessor: 'student_count', className: 'text-slate-700 dark:text-slate-300 font-medium' },
    {
      header: 'Actions',
      accessor: (r) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setSelectedBatchForStudents(r);
              setShowAssignModal(false);
              setSelectedStudentIds(new Set());
            }}
            className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors text-xs font-semibold"
            title="View & Manage Students"
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

  const subjectColumns: Column<Subject>[] = [
    {
      header: '',
      accessor: (r) => (
        <button
          onClick={() => setExpandedSubjectId(expandedSubjectId === r.id ? null : r.id)}
          className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
        >
          {expandedSubjectId === r.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      ),
    },
    { header: 'Subject Code', accessor: 'code', className: 'font-mono text-sky-600 dark:text-sky-400 font-semibold' },
    { header: 'Subject Name', accessor: 'name', className: 'font-medium text-slate-900 dark:text-slate-100' },
    { header: 'Credits', accessor: 'credits', className: 'text-slate-700 dark:text-slate-300 font-medium' },
    {
      header: 'Actions',
      accessor: (r) =>
        canManageCurriculum ? (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => openCreateTopic(r.id)}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-cyan-50 text-cyan-700 border border-cyan-200 hover:bg-cyan-100 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/30 dark:hover:bg-cyan-500/20 flex items-center space-x-1 transition-colors"
            >
              <ListPlus className="h-3.5 w-3.5" />
              <span>Add Topic</span>
            </button>
            <button
              onClick={() => openEditSubject(r)}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              title="Edit Subject"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete subject ${r.name}?`)) deleteSubjectMutation.mutate(r.id);
              }}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              title="Delete Subject"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <span className="text-xs text-slate-400">View only</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight gradient-text">Academic Backbone</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Manage institutional programs, academic terms, batches, divisions, subjects, and topics.
          </p>
        </div>
        {canManageCurriculum && (
          <div>
            {activeTab === 'programs' && (
              <button
                onClick={openCreateProgram}
                className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/35 transition-all duration-200"
              >
                <Plus className="h-4 w-4" />
                <span>New Program</span>
              </button>
            )}

            {activeTab === 'batches' && (
              <button
                onClick={openCreateBatch}
                className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-sky-600 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/35 transition-all duration-200"
              >
                <Plus className="h-4 w-4" />
                <span>New Batch & Division</span>
              </button>
            )}

            {activeTab === 'subjects' && (
              <button
                onClick={openCreateSubject}
                className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-sky-600 to-emerald-600 text-white shadow-lg shadow-sky-500/20 hover:shadow-sky-500/35 transition-all duration-200"
              >
                <Plus className="h-4 w-4" />
                <span>New Subject</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-6">
        <button
          onClick={() => setActiveTab('programs')}
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
          onClick={() => setActiveTab('batches')}
          className={`pb-3 text-sm font-medium border-b-2 flex items-center space-x-2 transition-colors ${
            activeTab === 'batches'
              ? 'border-cyan-600 text-cyan-600 dark:border-cyan-400 dark:text-cyan-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Batches & Divisions ({batchesData?.length || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('subjects')}
          className={`pb-3 text-sm font-medium border-b-2 flex items-center space-x-2 transition-colors ${
            activeTab === 'subjects'
              ? 'border-cyan-600 text-cyan-600 dark:border-cyan-400 dark:text-cyan-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          <span>Subjects & Topics ({subjectsData?.length || 0})</span>
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
        <div className="space-y-6">
          <Card title="Active Batches & Divisions">
            {batchLoading ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-4">Loading batches...</p>
            ) : (
              <DataTable
                columns={batchColumns}
                data={batchesData || []}
                keyExtractor={(r) => r.id}
                emptyMessage="No batches created yet. Click 'New Batch & Division' above."
              />
            )}
          </Card>

          {/* Batch Students Panel */}
          {selectedBatchForStudents && (
            <Card
              title={
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-indigo-500" />
                  <span>Students in <span className="text-indigo-600 dark:text-indigo-400 font-bold">{selectedBatchForStudents.name}</span></span>
                </div>
              }
              action={
                <div className="flex items-center space-x-2">
                  {canManageCurriculum && (
                    <button
                      onClick={() => setShowAssignModal(true)}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 to-sky-600 text-white shadow-sm hover:opacity-90 transition-opacity"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      <span>Add Students</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSelectedBatchForStudents(null);
                      setShowAssignModal(false);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Close panel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              }
            >
              {batchStudentsLoading ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 py-4">Loading students...</p>
              ) : !batchStudentsData || batchStudentsData.length === 0 ? (
                <div className="py-10 flex flex-col items-center space-y-3 text-center">
                  <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10">
                    <Users className="h-8 w-8 text-indigo-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No students enrolled in this batch yet.</p>
                  {canManageCurriculum && (
                    <button
                      onClick={() => setShowAssignModal(true)}
                      className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow transition-colors"
                    >
                      <UserPlus className="h-4 w-4" />
                      <span>Add Students</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{batchStudentsData.length} student(s) enrolled</p>
                  {batchStudentsData.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300">
                          {s.full_name.charAt(0).toUpperCase()}
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
                          onClick={() => removeStudentFromBatch(s.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                          title="Remove from batch"
                        >
                          <UserMinus className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {activeTab === 'subjects' && (
        <div className="space-y-4">
          <Card title="Curriculum Subjects & Topics">
            {subLoading ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-4">Loading subjects...</p>
            ) : (
              <DataTable
                columns={subjectColumns}
                data={subjectsData || []}
                keyExtractor={(r) => r.id}
                emptyMessage="No subjects registered yet. Click 'New Subject' above."
              />
            )}
          </Card>

          {/* Topics List Card for Expanded Subject */}
          {expandedSubjectId && (
            <Card
              title={`Topics for ${subjectsData?.find((s) => s.id === expandedSubjectId)?.name || 'Subject'}`}
              action={
                <button
                  onClick={() => openCreateTopic(expandedSubjectId)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-500 dark:hover:bg-cyan-600 text-white shadow transition-colors"
                >
                  + Add Topic
                </button>
              }
            >
              {topicsData?.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 italic py-2">No topics added for this subject yet.</p>
              ) : (
                <div className="space-y-2">
                  {topicsData?.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-sm"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="h-6 w-6 rounded-full bg-cyan-50 dark:bg-slate-800 border border-cyan-200 dark:border-slate-700 flex items-center justify-center text-xs font-bold text-cyan-700 dark:text-cyan-400">
                          {t.sequence_no}
                        </span>
                        <div>
                          <p className="font-medium text-slate-800 dark:text-slate-200">{t.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{t.planned_hours} planned hours</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (confirm(`Delete topic ${t.name}?`)) deleteTopicMutation.mutate(t.id);
                        }}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* Assign Students Modal */}
      {showAssignModal && selectedBatchForStudents && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-2xl max-h-[80vh] flex flex-col rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Add Students to Batch</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Select students to enroll in <span className="font-semibold text-indigo-600 dark:text-indigo-400">{selectedBatchForStudents.name}</span></p>
              </div>
              <button
                onClick={() => { setShowAssignModal(false); setSelectedStudentIds(new Set()); setAssignSearch(''); }}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name or PRN..."
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Student List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-2">
              {(() => {
                const enrolledIds = new Set(batchStudentsData?.map((s) => s.id) || []);
                const unassigned = (allStudentsData || []).filter(
                  (s) => !enrolledIds.has(s.id) &&
                    (assignSearch === '' ||
                      s.full_name.toLowerCase().includes(assignSearch.toLowerCase()) ||
                      s.prn_number.toLowerCase().includes(assignSearch.toLowerCase()))
                );
                if (unassigned.length === 0) {
                  return (
                    <div className="py-10 text-center">
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {assignSearch ? 'No students match your search.' : 'All students are already enrolled in this batch.'}
                      </p>
                    </div>
                  );
                }
                return unassigned.map((s) => (
                  <label
                    key={s.id}
                    className={`flex items-center space-x-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      selectedStudentIds.has(s.id)
                        ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 hover:border-indigo-300 dark:hover:border-indigo-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedStudentIds.has(s.id)}
                      onChange={(e) => {
                        const next = new Set(selectedStudentIds);
                        if (e.target.checked) next.add(s.id); else next.delete(s.id);
                        setSelectedStudentIds(next);
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300 flex-shrink-0">
                      {s.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{s.full_name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        PRN: <span className="font-mono">{s.prn_number}</span>
                        {s.program_name && <span> · {s.program_name}</span>}
                        {s.batch_name && <span> · Currently in: {s.batch_name}</span>}
                      </p>
                    </div>
                  </label>
                ));
              })()}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selectedStudentIds.size > 0 ? `${selectedStudentIds.size} student(s) selected` : 'Select students to enroll'}
              </p>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => { setShowAssignModal(false); setSelectedStudentIds(new Set()); setAssignSearch(''); }}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkAssign}
                  disabled={selectedStudentIds.size === 0 || assignStudentsMutation.isPending}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-sky-600 text-white shadow disabled:opacity-50 hover:opacity-90 transition-opacity"
                >
                  {assignStudentsMutation.isPending ? 'Enrolling...' : `Enroll ${selectedStudentIds.size > 0 ? `(${selectedStudentIds.size})` : ''}`}
                </button>
              </div>
            </div>
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
              {modalType === 'createBatch' && 'Create Batch & Division'}
              {modalType === 'editBatch' && 'Edit Batch & Division'}
              {modalType === 'createSubject' && 'Create Subject'}
              {modalType === 'editSubject' && 'Edit Subject'}
              {modalType === 'createTopic' && 'Add Topic to Subject'}
            </h3>

            {errorMsg && (
              <div className="p-3 mb-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs font-semibold">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Program selection for Batches */}
              {(modalType === 'createBatch' || modalType === 'editBatch') && programsData && programsData.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Academic Program
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
                  {modalType.includes('Topic')
                    ? 'Topic Name'
                    : modalType.includes('Subject')
                    ? 'Subject Name'
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

              {/* Code Input for Program / Batch / Subject */}
              {!modalType.includes('Topic') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Code
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MBA-EXEC or BATCH-2026"
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              )}

              {/* Description for Program */}
              {(modalType === 'createProgram' || modalType === 'editProgram') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Description
                  </label>
                  <textarea
                    placeholder="Program overview and description..."
                    value={descInput}
                    onChange={(e) => setDescInput(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500 h-20"
                  />
                </div>
              )}

              {/* Batch specific inputs */}
              {(modalType === 'createBatch' || modalType === 'editBatch') && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Division
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Div-A"
                      value={divisionInput}
                      onChange={(e) => setDivisionInput(e.target.value)}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Student Count
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={studentCountInput}
                      onChange={(e) => setStudentCountInput(Number(e.target.value))}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              )}

              {/* Subject specific inputs */}
              {(modalType === 'createSubject' || modalType === 'editSubject') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Credits
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={creditsInput}
                    onChange={(e) => setCreditsInput(Number(e.target.value))}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              )}

              {/* Topic specific inputs */}
              {modalType === 'createTopic' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Sequence No
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={sequenceNoInput}
                      onChange={(e) => setSequenceNoInput(Number(e.target.value))}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Planned Hours
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={plannedHoursInput}
                      onChange={(e) => setPlannedHoursInput(Number(e.target.value))}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={closeModal}
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
    </div>
  );
};
