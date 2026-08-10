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
    { header: 'Students', accessor: 'student_count', className: 'text-slate-700 dark:text-slate-300 font-medium' },
    {
      header: 'Actions',
      accessor: (r) =>
        canManageCurriculum ? (
          <div className="flex items-center space-x-2">
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
          </div>
        ) : (
          <span className="text-xs text-slate-400">View only</span>
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
