import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Pencil,
  Trash2,
  BookOpen,
  Layers,
  BarChart2,
  X,
  Building,
  Archive,
  RotateCcw,
  FileText,
  Calendar,
  Sparkles,
  Save,
  GraduationCap,
  Upload,
  Download,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../../components/Card';
import { useRoleAccess } from '../../lib/useRoleAccess';

interface ProgramSummary {
  id: string;
  name: string;
  code: string;
}

interface BatchAllocation {
  id?: string;
  batch_id: string;
  batch_name?: string;
  term_type?: string;
  term_number?: number;
  term_label?: string;
  start_date?: string;
  end_date?: string;
}

interface Subject {
  id: string;
  name: string;
  code: string;
  trimester: number;
  is_non_credit: boolean;
  credits: number;
  is_archived: boolean;
  syllabus?: string;
  session_plan?: string;
  hyperbuild_activities?: string;
  programs: ProgramSummary[];
  batch_allocations: BatchAllocation[];
  batch_id?: string;
}

interface Program {
  id: string;
  name: string;
  code: string;
}

interface Batch {
  id: string;
  name: string;
  code: string;
}

interface CompletionReport {
  subject_id: string;
  subject_name: string;
  subject_code: string;
  trimester: number;
  credits: number;
  is_non_credit: boolean;
  total_sessions_scheduled: number;
  total_sessions_completed: number;
  total_delivered_hours: number;
  completion_percentage: number;
}

// Structured Syllabus Interfaces
export interface CourseOutcomeItem {
  id: string;
  statement: string;
  blooms_level: string;
  po1: string;
  po2: string;
  po3: string;
  po4: string;
  po5: string;
}

export interface UnitTopicItem {
  id: string;
  unit_number: number;
  unit_title: string;
  content: string;
  hours: number;
}

export interface CaseStudyItem {
  id: string;
  title: string;
  concept: string;
  link: string;
}

export interface LiveAssignmentItem {
  id: string;
  assignment: string;
  description: string;
  platform: string;
}

export interface CCEComponentItem {
  id: string;
  name: string;
  marks: number;
  details: string;
}

export interface BookItem {
  id: string;
  name: string;
  author: string;
  publisher: string;
  year: string;
  edition: string;
}

export interface SyllabusData {
  course_overview: string;
  course_outcomes: CourseOutcomeItem[];
  topics: UnitTopicItem[];
  case_studies: CaseStudyItem[];
  live_assignments: LiveAssignmentItem[];
  software_exposure: string;
  cce_marks: number;
  tee_marks: number;
  total_marks: number;
  cce_components: CCEComponentItem[];
  recommended_textbooks: BookItem[];
  reference_books: BookItem[];
}

const PROGRAM_OUTCOMES_REF = [
  { po: 'PO 1', desc: 'Apply knowledge of management theories and practices to solve business problems.' },
  { po: 'PO 2', desc: 'Foster Analytical and critical thinking abilities for data-based decision making.' },
  { po: 'PO 3', desc: 'Ability to develop Value based Leadership ability.' },
  { po: 'PO 4', desc: 'Ability to understand, analyse and communicate global, economic, legal, and ethical aspects of business.' },
  { po: 'PO 5', desc: 'Ability to lead themselves and others in the achievement of organizational goals, contributing effectively to a team environment.' },
];

const BLOOMS_LEVELS = ['Knowledge', 'Understand', 'Application', 'Analysis', 'Evaluation', 'Create'];

const TERM_PRESETS = [
  { type: 'trimester', number: 1, label: 'Trimester 1' },
  { type: 'trimester', number: 2, label: 'Trimester 2' },
  { type: 'trimester', number: 3, label: 'Trimester 3' },
  { type: 'trimester', number: 4, label: 'Trimester 4' },
  { type: 'trimester', number: 5, label: 'Trimester 5' },
  { type: 'trimester', number: 6, label: 'Trimester 6' },

  { type: 'semester', number: 1, label: 'Semester 1' },
  { type: 'semester', number: 2, label: 'Semester 2' },
  { type: 'semester', number: 3, label: 'Semester 3' },
  { type: 'semester', number: 4, label: 'Semester 4' },
  { type: 'semester', number: 5, label: 'Semester 5' },
  { type: 'semester', number: 6, label: 'Semester 6' },
  { type: 'semester', number: 7, label: 'Semester 7' },
  { type: 'semester', number: 8, label: 'Semester 8' },

  { type: 'term', number: 1, label: 'Term 1 (Lexicon, Pune)' },
  { type: 'term', number: 2, label: 'Term 2 (USW, UK)' },
];

export const SubjectsPage: React.FC = () => {
  const { canManageCurriculum } = useRoleAccess();
  const queryClient = useQueryClient();

  // Archive Filter Tab State
  const [viewTab, setViewTab] = useState<'active' | 'archived'>('active');

  // Modal Types
  const [modalType, setModalType] = useState<
    'createSubject' | 'editSubject' | 'syllabusModal' | 'sessionPlanModal' | 'hyperbuildModal' | 'report' | null
  >(null);
  const [createStep, setCreateStep] = useState<'basic' | 'programs'>('basic');

  // Syllabus Modal Active Sub-Tab (1 to 6)
  const [syllabusSubTab, setSyllabusSubTab] = useState<
    'overview' | 'outcomes' | 'units' | 'industry' | 'assessment' | 'books'
  >('overview');

  // Selected Subject for Modals
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);

  // Completion Report Data
  const [reportData, setReportData] = useState<CompletionReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Form State for Subject Create / Edit
  const [nameInput, setNameInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [isNonCreditInput, setIsNonCreditInput] = useState<boolean>(false);
  const [creditsInput, setCreditsInput] = useState<number>(3);
  const [selectedProgramIds, setSelectedProgramIds] = useState<string[]>([]);
  const [batchAllocations, setBatchAllocations] = useState<BatchAllocation[]>([]);

  // Form State for Structured Syllabus Builder
  const [syllabusData, setSyllabusData] = useState<SyllabusData>({
    course_overview: '',
    course_outcomes: [],
    topics: [],
    case_studies: [],
    live_assignments: [],
    software_exposure: '',
    cce_marks: 50,
    tee_marks: 50,
    total_marks: 100,
    cce_components: [],
    recommended_textbooks: [],
    reference_books: [],
  });

  // Form States for Session Plan & HyperBuild Activities Windows
  const [sessionPlanInput, setSessionPlanInput] = useState('');
  const [hyperbuildInput, setHyperbuildInput] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch Subjects (Active or Archived)
  const { data: subjectsData = [], isLoading: subLoading } = useQuery<Subject[]>({
    queryKey: ['subjects', viewTab],
    queryFn: async () => {
      const res = await api.get(`/academic/subjects?is_archived=${viewTab === 'archived'}`);
      return res.data.data;
    },
  });

  // Fetch Programs for Multi-Select
  const { data: programsData = [] } = useQuery<Program[]>({
    queryKey: ['programs'],
    queryFn: async () => {
      const res = await api.get('/academic/programs');
      return res.data.data;
    },
  });

  // Fetch Batches for Multi-Select & Date Allocation
  const { data: batchesData = [] } = useQuery<Batch[]>({
    queryKey: ['batches'],
    queryFn: async () => {
      const res = await api.get('/academic/batches');
      return res.data.data;
    },
  });

  // Create Subject Mutation
  const createSubjectMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/academic/subjects', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      closeModal();
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.detail || err?.message || 'Failed to create subject');
    },
  });

  // Update Subject Mutation
  const updateSubjectMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await api.put(`/academic/subjects/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      closeModal();
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.detail || err?.message || 'Failed to update subject');
    },
  });

  // Upload Word / PDF Syllabus Mutation
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);
  const [exportingFmt, setExportingFmt] = useState<'docx' | 'pdf' | null>(null);

  const handleDownloadExport = async (fmt: 'docx' | 'pdf') => {
    if (!selectedSubject) return;
    setExportingFmt(fmt);
    try {
      const res = await api.get(`/academic/subjects/${selectedSubject.id}/syllabus/export?format=${fmt}`, {
        responseType: 'blob',
      });
      const mimeType = fmt === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const blob = new Blob([res.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedSubject.code}_Syllabus.${fmt}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Failed to download syllabus document: ' + (err?.response?.data?.detail || err?.message || 'Download error'));
    } finally {
      setExportingFmt(null);
    }
  };

  const uploadSyllabusMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/academic/subjects/parse-syllabus-file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.data;
    },
    onSuccess: (parsedData: SyllabusData) => {
      setSyllabusData(parsedData);
      setUploadSuccessMsg('Syllabus document parsed successfully! All 9 sections populated. Review and save below.');
      setTimeout(() => setUploadSuccessMsg(null), 8000);
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.detail || err?.message || 'Failed to parse syllabus document');
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setErrorMsg(null);
      setUploadSuccessMsg(null);
      uploadSyllabusMutation.mutate(e.target.files[0]);
    }
  };

  // Archive Subject Mutation
  const archiveSubjectMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/academic/subjects/${id}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    },
    onError: (err: any) => {
      alert(err?.response?.data?.detail || 'Failed to archive subject');
    },
  });

  // Unarchive / Restore Subject Mutation
  const unarchiveSubjectMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/academic/subjects/${id}/unarchive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    },
    onError: (err: any) => {
      alert(err?.response?.data?.detail || 'Failed to restore subject');
    },
  });

  // Delete Subject Mutation
  const deleteSubjectMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/academic/subjects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    },
    onError: (err: any) => {
      alert(err?.response?.data?.detail || 'Failed to delete subject');
    },
  });

  // Handlers
  const closeModal = () => {
    setModalType(null);
    setSelectedSubject(null);
    setNameInput('');
    setCodeInput('');
    setIsNonCreditInput(false);
    setCreditsInput(3);
    setSelectedProgramIds([]);
    setBatchAllocations([]);
    setSessionPlanInput('');
    setHyperbuildInput('');
    setErrorMsg(null);
    setCreateStep('basic');
    setSyllabusSubTab('overview');
  };

  const openCreateSubject = () => {
    closeModal();
    setModalType('createSubject');
  };

  const openEditSubject = (subj: Subject) => {
    closeModal();
    setSelectedSubject(subj);
    setNameInput(subj.name);
    setCodeInput(subj.code);
    setIsNonCreditInput(subj.is_non_credit || false);
    setCreditsInput(subj.credits || 3);
    setSelectedProgramIds(subj.programs ? subj.programs.map((p) => p.id) : []);
    setBatchAllocations(
      subj.batch_allocations
        ? subj.batch_allocations.map((b) => ({
            batch_id: b.batch_id,
            term_type: b.term_type || 'trimester',
            term_number: b.term_number || 1,
            term_label: b.term_label || 'Trimester 1',
            start_date: b.start_date || '',
            end_date: b.end_date || '',
          }))
        : []
    );
    setModalType('editSubject');
  };

  // Open Dedicated Syllabus Window
  const openSyllabusWindow = (subj: Subject) => {
    closeModal();
    setSelectedSubject(subj);

    // Helper to parse existing syllabus JSON or build defaults
    let parsed: SyllabusData;
    try {
      if (subj.syllabus && subj.syllabus.startsWith('{')) {
        parsed = JSON.parse(subj.syllabus);
      } else {
        parsed = {
          course_overview: subj.syllabus || '',
          course_outcomes: [
            {
              id: 'co-1',
              statement: 'Explain the legal framework governing commercial business operations, contract formation, and dispute resolution.',
              blooms_level: 'Knowledge',
              po1: '2',
              po2: '-',
              po3: '-',
              po4: '2',
              po5: '-',
            },
          ],
          topics: [
            {
              id: 'unit-1',
              unit_number: 1,
              unit_title: 'Unit 1: Introduction & Legal Foundations',
              content: 'Overview of business legal environment, regulatory architecture, and ADR mechanisms.',
              hours: 6,
            },
          ],
          case_studies: [
            { id: 'cs-1', title: 'Satyam Corporate Governance', concept: 'Governance & Risk Allocation', link: 'https://hbsp.harvard.edu' },
          ],
          live_assignments: [
            { id: 'la-1', assignment: 'NDA & SaaS Agreement Review', description: 'Review and draft NDAs and service agreements.', platform: 'Lexicon LMS' },
          ],
          software_exposure: 'MS Word (Legal Drafting), LexisNexis',
          cce_marks: 50,
          tee_marks: 50,
          total_marks: 100,
          cce_components: [
            { id: 'cce-1', name: 'Assignment 1: NDA Drafting', marks: 20, details: 'Draft a NDA agreement based on given business case.' },
            { id: 'cce-2', name: 'Assignment 2: Corporate Governance Case Study', marks: 30, details: 'Analyze competition law compliance requirements.' },
          ],
          recommended_textbooks: [
            { id: 'tb-1', name: 'Legal Aspects of Business', author: 'Akhileshwar Pathak', publisher: 'McGraw Hill', year: '2022', edition: '8th' },
          ],
          reference_books: [
            { id: 'rb-1', name: 'Business Law', author: 'N.D. Kapoor', publisher: 'Sultan Chand & Sons', year: '2023', edition: '38th' },
          ],
        };
      }
    } catch {
      parsed = {
        course_overview: subj.syllabus || '',
        course_outcomes: [],
        topics: [{ id: 'unit-1', unit_number: 1, unit_title: 'Unit 1', content: '', hours: 6 }],
        case_studies: [],
        live_assignments: [],
        software_exposure: '',
        cce_marks: 50,
        tee_marks: 50,
        total_marks: 100,
        cce_components: [],
        recommended_textbooks: [],
        reference_books: [],
      };
    }

    setSyllabusData(parsed);
    setSyllabusSubTab('overview');
    setModalType('syllabusModal');
  };

  const openSessionPlanWindow = (subj: Subject) => {
    closeModal();
    setSelectedSubject(subj);
    setSessionPlanInput(subj.session_plan || '');
    setModalType('sessionPlanModal');
  };

  const openHyperbuildWindow = (subj: Subject) => {
    closeModal();
    setSelectedSubject(subj);
    setHyperbuildInput(subj.hyperbuild_activities || '');
    setModalType('hyperbuildModal');
  };

  const openReportModal = async (subj: Subject) => {
    setSelectedSubject(subj);
    setModalType('report');
    setReportLoading(true);
    try {
      const res = await api.get(`/academic/subjects/${subj.id}/completion-report`);
      setReportData(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setReportLoading(false);
    }
  };

  const handleProgramToggle = (progId: string) => {
    if (selectedProgramIds.includes(progId)) {
      setSelectedProgramIds(selectedProgramIds.filter((id) => id !== progId));
    } else {
      setSelectedProgramIds([...selectedProgramIds, progId]);
    }
  };

  const handleBatchToggle = (batchId: string) => {
    const exists = batchAllocations.some((b) => b.batch_id === batchId);
    if (exists) {
      setBatchAllocations(batchAllocations.filter((b) => b.batch_id !== batchId));
    } else {
      setBatchAllocations([
        ...batchAllocations,
        {
          batch_id: batchId,
          term_type: 'trimester',
          term_number: 1,
          term_label: 'Trimester 1',
          start_date: '',
          end_date: '',
        },
      ]);
    }
  };

  const handleBatchFieldChange = (batchId: string, field: string, value: any) => {
    setBatchAllocations(
      batchAllocations.map((b) => {
        if (b.batch_id === batchId) {
          const updated = { ...b, [field]: value };
          if (field === 'term_preset') {
            const preset = TERM_PRESETS.find((p) => p.label === value);
            if (preset) {
              updated.term_type = preset.type;
              updated.term_number = preset.number;
              updated.term_label = preset.label;
            }
          }
          return updated;
        }
        return b;
      })
    );
  };

  const handleSubjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!nameInput.trim() || !codeInput.trim()) {
      setErrorMsg('Subject Name and Subject Code are required');
      return;
    }

    const payload = {
      name: nameInput,
      code: codeInput,
      is_non_credit: isNonCreditInput,
      credits: isNonCreditInput ? 0 : creditsInput,
      program_ids: selectedProgramIds,
      batch_allocations: batchAllocations,
    };

    if (modalType === 'createSubject') {
      createSubjectMutation.mutate(payload);
    } else if (modalType === 'editSubject' && selectedSubject) {
      updateSubjectMutation.mutate({ id: selectedSubject.id, payload });
    }
  };

  // Structured Syllabus Save Handler
  const handleSaveSyllabus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubject) return;
    const jsonString = JSON.stringify(syllabusData);
    updateSubjectMutation.mutate({
      id: selectedSubject.id,
      payload: { syllabus: jsonString },
    });
  };

  const handleSaveSessionPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubject) return;
    updateSubjectMutation.mutate({
      id: selectedSubject.id,
      payload: { session_plan: sessionPlanInput || null },
    });
  };

  const handleSaveHyperbuild = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubject) return;
    updateSubjectMutation.mutate({
      id: selectedSubject.id,
      payload: { hyperbuild_activities: hyperbuildInput || null },
    });
  };

  // Syllabus Sub-item Adders
  const addCourseOutcomeRow = () => {
    const newRow: CourseOutcomeItem = {
      id: `co-${Date.now()}`,
      statement: '',
      blooms_level: 'Knowledge',
      po1: '-',
      po2: '-',
      po3: '-',
      po4: '-',
      po5: '-',
    };
    setSyllabusData({ ...syllabusData, course_outcomes: [...syllabusData.course_outcomes, newRow] });
  };

  const removeCourseOutcomeRow = (id: string) => {
    setSyllabusData({ ...syllabusData, course_outcomes: syllabusData.course_outcomes.filter((co) => co.id !== id) });
  };

  const addUnitTopicRow = () => {
    const nextUnitNum = syllabusData.topics.length + 1;
    const newUnit: UnitTopicItem = {
      id: `unit-${Date.now()}`,
      unit_number: nextUnitNum,
      unit_title: `Unit ${nextUnitNum}: `,
      content: '',
      hours: 6,
    };
    setSyllabusData({ ...syllabusData, topics: [...syllabusData.topics, newUnit] });
  };

  const removeUnitTopicRow = (id: string) => {
    setSyllabusData({ ...syllabusData, topics: syllabusData.topics.filter((u) => u.id !== id) });
  };

  const addCaseStudyRow = () => {
    setSyllabusData({
      ...syllabusData,
      case_studies: [...syllabusData.case_studies, { id: `cs-${Date.now()}`, title: '', concept: '', link: '' }],
    });
  };

  const addLiveAssignmentRow = () => {
    setSyllabusData({
      ...syllabusData,
      live_assignments: [...syllabusData.live_assignments, { id: `la-${Date.now()}`, assignment: '', description: '', platform: '' }],
    });
  };

  const addCCEComponentRow = () => {
    setSyllabusData({
      ...syllabusData,
      cce_components: [
        ...syllabusData.cce_components,
        { id: `cce-${Date.now()}`, name: `Assignment ${syllabusData.cce_components.length + 1}`, marks: 10, details: '' },
      ],
    });
  };

  const addBookRow = (type: 'recommended' | 'reference') => {
    const newBook: BookItem = { id: `bk-${Date.now()}`, name: '', author: '', publisher: '', year: '', edition: '' };
    if (type === 'recommended') {
      setSyllabusData({ ...syllabusData, recommended_textbooks: [...syllabusData.recommended_textbooks, newBook] });
    } else {
      setSyllabusData({ ...syllabusData, reference_books: [...syllabusData.reference_books, newBook] });
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-cyan-500" />
            Subjects Directory
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage course subjects, multi-program allocations, per-batch academic periods, 9-section structured syllabus builder, and completion analytics.
          </p>
        </div>
        {canManageCurriculum && (
          <button
            onClick={openCreateSubject}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-500 dark:hover:bg-cyan-600 text-white text-sm font-semibold transition-colors shadow-md shadow-cyan-500/20"
          >
            <Plus className="h-4 w-4" /> Add New Subject
          </button>
        )}
      </div>

      {/* Filter Tabs: Active vs Archived */}
      <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setViewTab('active')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            viewTab === 'active'
              ? 'bg-cyan-600 dark:bg-cyan-500 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <BookOpen className="h-4 w-4" /> Active Subjects
        </button>
        <button
          onClick={() => setViewTab('archived')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            viewTab === 'archived'
              ? 'bg-amber-600 dark:bg-amber-500 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Archive className="h-4 w-4" /> Archived Subjects
        </button>
      </div>

      {/* Subjects List */}
      <div className="grid grid-cols-1 gap-4">
        {subLoading ? (
          <div className="flex items-center justify-center p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl">
            <div className="h-8 w-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : subjectsData.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-slate-500">
            <BookOpen className="h-10 w-10 mx-auto text-slate-400 mb-3" />
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              No {viewTab === 'archived' ? 'archived' : 'active'} subjects found
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {viewTab === 'active'
                ? "Click 'Add New Subject' to create your first course subject."
                : 'No subjects have been archived yet.'}
            </p>
          </div>
        ) : (
          subjectsData.map((subject) => {
            return (
              <Card key={subject.id} className="p-6 transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Subject Summary */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30">
                        {subject.code}
                      </span>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">{subject.name}</h2>
                      {subject.is_non_credit ? (
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                          Non-Credit Course
                        </span>
                      ) : (
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                          {subject.credits} Credits
                        </span>
                      )}
                      {subject.is_archived && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          Archived
                        </span>
                      )}
                    </div>

                    {/* Programs & Per-Batch Period badges */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400 pt-1">
                      <div className="flex items-center gap-1.5">
                        <Building className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Programs:</span>
                        {subject.programs && subject.programs.length > 0 ? (
                          subject.programs.map((p) => (
                            <span key={p.id} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                              {p.code || p.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400">All Programs</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Layers className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Batch Allocations & Term:</span>
                        {subject.batch_allocations && subject.batch_allocations.length > 0 ? (
                          subject.batch_allocations.map((ba) => (
                            <span key={ba.batch_id} className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-medium border border-indigo-200 dark:border-indigo-500/20">
                              <strong>{ba.batch_name || 'Batch'}</strong> — {ba.term_label || `Trimester ${ba.term_number || 1}`} {ba.start_date ? `(${ba.start_date} → ${ba.end_date || 'Ongoing'})` : ''}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400">Not Allocated</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar — 3 SEPARATE Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {/* Separate Window 1: Syllabus */}
                    <button
                      onClick={() => openSyllabusWindow(subject)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-xs font-semibold text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 transition-colors"
                      title="Update 9-Section Syllabus Builder"
                    >
                      <FileText className="h-3.5 w-3.5 text-indigo-500" /> Syllabus Builder
                    </button>

                    {/* Separate Window 2: Session Plan */}
                    <button
                      onClick={() => openSessionPlanWindow(subject)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 text-xs font-semibold text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30 transition-colors"
                      title="Update Session Plan in Separate Window"
                    >
                      <Calendar className="h-3.5 w-3.5 text-cyan-500" /> Session Plan
                    </button>

                    {/* Separate Window 3: HyperBuild Activities */}
                    <button
                      onClick={() => openHyperbuildWindow(subject)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 text-xs font-semibold text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 transition-colors"
                      title="Update HyperBuild Activities in Separate Window"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" /> HyperBuild Activities
                    </button>

                    {/* Completion Report */}
                    <button
                      onClick={() => openReportModal(subject)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                      title="View Faculty Session Completion Report"
                    >
                      <BarChart2 className="h-3.5 w-3.5 text-emerald-500" /> Completion Report
                    </button>

                    {canManageCurriculum && (
                      <>
                        <button
                          onClick={() => openEditSubject(subject)}
                          className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Edit Subject Info"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>

                        {/* Archive / Restore button */}
                        {!subject.is_archived ? (
                          <button
                            onClick={() => {
                              if (confirm(`Archive subject '${subject.name}'?`)) {
                                archiveSubjectMutation.mutate(subject.id);
                              }
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 transition-colors"
                            title="Archive Subject"
                          >
                            <Archive className="h-3.5 w-3.5" /> Archive
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              unarchiveSubjectMutation.mutate(subject.id);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 transition-colors"
                            title="Restore Subject"
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Restore
                          </button>
                        )}

                        <button
                          onClick={() => {
                            if (confirm(`Delete subject '${subject.name}' permanently?`)) {
                              deleteSubjectMutation.mutate(subject.id);
                            }
                          }}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                          title="Delete Subject"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Create / Edit Subject Basic Modal */}
      {(modalType === 'createSubject' || modalType === 'editSubject') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {modalType === 'createSubject' ? 'Add New Subject' : `Edit Subject: ${selectedSubject?.code}`}
              </h3>
              <button onClick={closeModal} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs">
                {errorMsg}
              </div>
            )}

            <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <button
                type="button"
                onClick={() => setCreateStep('basic')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  createStep === 'basic'
                    ? 'bg-cyan-600 dark:bg-cyan-500 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                1. Basic Info
              </button>
              <button
                type="button"
                onClick={() => setCreateStep('programs')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  createStep === 'programs'
                    ? 'bg-cyan-600 dark:bg-cyan-500 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                2. Programs & Per-Batch Periods
              </button>
            </div>

            <form onSubmit={handleSubjectSubmit} className="space-y-6">
              {createStep === 'basic' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                        Subject Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                        placeholder="e.g. Legal Aspects of Business"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                        Subject Code <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                        placeholder="e.g. 1GNC02"
                        value={codeInput}
                        onChange={(e) => setCodeInput(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">Course Type</label>
                      <div className="flex items-center space-x-3 pt-2">
                        <label className="flex items-center space-x-2 text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            className="rounded text-cyan-600 focus:ring-cyan-500 h-4 w-4"
                            checked={isNonCreditInput}
                            onChange={(e) => setIsNonCreditInput(e.target.checked)}
                          />
                          <span>Non-Credit Course</span>
                        </label>
                      </div>
                    </div>

                    {!isNonCreditInput && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">Credits</label>
                        <input
                          type="number"
                          min="1"
                          max="12"
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                          value={creditsInput}
                          onChange={(e) => setCreditsInput(parseInt(e.target.value) || 0)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {createStep === 'programs' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                      Associated Programs (Select all that apply)
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {programsData.map((prog) => {
                        const isSelected = selectedProgramIds.includes(prog.id);
                        return (
                          <button
                            type="button"
                            key={prog.id}
                            onClick={() => handleProgramToggle(prog.id)}
                            className={`p-3 rounded-xl border text-left text-xs font-medium transition-all ${
                              isSelected
                                ? 'bg-cyan-50 dark:bg-cyan-500/10 border-cyan-500 text-cyan-700 dark:text-cyan-400 font-bold'
                                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <div className="font-semibold">{prog.code}</div>
                            <div className="text-[11px] opacity-75 truncate">{prog.name}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                      Allocated Batches, Academic Period & Schedule Dates
                    </label>
                    <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                      {batchesData.map((batch) => {
                        const alloc = batchAllocations.find((b) => b.batch_id === batch.id);
                        const isAllocated = !!alloc;
                        return (
                          <div
                            key={batch.id}
                            className={`p-4 rounded-2xl border transition-all ${
                              isAllocated
                                ? 'bg-indigo-50/50 dark:bg-indigo-500/10 border-indigo-300 dark:border-indigo-500/30'
                                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <label className="flex items-center space-x-2 text-sm font-semibold text-slate-900 dark:text-white cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                  checked={isAllocated}
                                  onChange={() => handleBatchToggle(batch.id)}
                                />
                                <span>{batch.name} ({batch.code})</span>
                              </label>
                            </div>

                            {isAllocated && (
                              <div className="mt-3 pt-3 border-t border-indigo-100 dark:border-indigo-500/20 space-y-3">
                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                                    Academic Period (Trimester / Semester / Term)
                                  </label>
                                  <select
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white font-medium"
                                    value={alloc.term_label || 'Trimester 1'}
                                    onChange={(e) => handleBatchFieldChange(batch.id, 'term_preset', e.target.value)}
                                  >
                                    <optgroup label="PGDM — Trimester Pattern">
                                      {TERM_PRESETS.filter((p) => p.type === 'trimester').map((p) => (
                                        <option key={p.label} value={p.label}>
                                          {p.label}
                                        </option>
                                      ))}
                                    </optgroup>
                                    <optgroup label="BBA & HMCT — Semester Pattern">
                                      {TERM_PRESETS.filter((p) => p.type === 'semester').map((p) => (
                                        <option key={p.label} value={p.label}>
                                          {p.label}
                                        </option>
                                      ))}
                                    </optgroup>
                                    <optgroup label="GMBA — Term Pattern">
                                      {TERM_PRESETS.filter((p) => p.type === 'term').map((p) => (
                                        <option key={p.label} value={p.label}>
                                          {p.label}
                                        </option>
                                      ))}
                                    </optgroup>
                                  </select>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Subject Start Date</label>
                                    <input
                                      type="date"
                                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                                      value={alloc.start_date || ''}
                                      onChange={(e) => handleBatchFieldChange(batch.id, 'start_date', e.target.value)}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Subject End Date</label>
                                    <input
                                      type="date"
                                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                                      value={alloc.end_date || ''}
                                      onChange={(e) => handleBatchFieldChange(batch.id, 'end_date', e.target.value)}
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubjectMutation.isPending || updateSubjectMutation.isPending}
                  className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-sm transition-colors disabled:opacity-50"
                >
                  {modalType === 'createSubject' ? 'Save Subject' : 'Update Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SEPARATE DEDICATED WINDOW 1: 9-SECTION STRUCTURED SYLLABUS BUILDER MODAL */}
      {modalType === 'syllabusModal' && selectedSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-5xl w-full p-6 space-y-6 shadow-2xl max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="h-6 w-6 text-indigo-500" /> Syllabus Builder (9 Sections)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {selectedSubject.name} ({selectedSubject.code})
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Word / PDF Upload Button */}
                <label className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white text-xs font-bold transition-all cursor-pointer shadow-md shadow-indigo-500/20">
                  <Upload className="h-4 w-4" />
                  <span>{uploadSyllabusMutation.isPending ? 'Parsing Document...' : 'Upload Word / PDF Syllabus'}</span>
                  <input
                    type="file"
                    accept=".docx,.doc,.pdf"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploadSyllabusMutation.isPending}
                  />
                </label>

                <button onClick={closeModal} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Notification Banners */}
            {uploadSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between">
                <span>{uploadSuccessMsg}</span>
                <button onClick={() => setUploadSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center justify-between">
                <span>{errorMsg}</span>
                <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Sub-Tabs for 9 Sections */}
            <div className="flex items-center space-x-1.5 border-b border-slate-100 dark:border-slate-800 pb-2 overflow-x-auto text-xs font-bold">
              {[
                { id: 'overview', label: '1. Overview & PO Reference' },
                { id: 'outcomes', label: '2. Outcomes & PO Matrix' },
                { id: 'units', label: '3. Units / Topics' },
                { id: 'industry', label: '4. Industry Learning' },
                { id: 'assessment', label: '5 & 6. Assessment & CCE' },
                { id: 'books', label: '7 & 8. Textbooks & References' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSyllabusSubTab(t.id as any)}
                  className={`px-3 py-2 rounded-xl transition-all shrink-0 ${
                    syllabusSubTab === t.id
                      ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSaveSyllabus} className="space-y-6">
              {/* Sub-Tab 1: Course Overview & Fixed Program Outcomes Reference */}
              {syllabusSubTab === 'overview' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                      1. Course Overview (Detailed Paragraphs)
                    </label>
                    <textarea
                      rows={6}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl p-4 text-xs text-slate-900 dark:text-white leading-relaxed focus:outline-none focus:border-indigo-500 font-sans"
                      placeholder="Enter detailed course overview paragraphs covering context, objectives, and legal/business environment..."
                      value={syllabusData.course_overview}
                      onChange={(e) => setSyllabusData({ ...syllabusData, course_overview: e.target.value })}
                    />
                  </div>

                  {/* Section 9: Fixed Program Outcomes Reference Table */}
                  <div className="p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 space-y-3">
                    <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-indigo-500" /> 9. Program Outcomes (Fixed Reference for all Subjects)
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="border-b border-indigo-200 dark:border-indigo-500/30 text-indigo-800 dark:text-indigo-300">
                            <th className="py-2 px-3 font-bold w-16">PO</th>
                            <th className="py-2 px-3 font-bold">Program Outcome Description</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-indigo-100 dark:divide-indigo-500/10">
                          {PROGRAM_OUTCOMES_REF.map((item) => (
                            <tr key={item.po}>
                              <td className="py-2.5 px-3 font-bold text-indigo-700 dark:text-indigo-400">{item.po}</td>
                              <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-medium">{item.desc}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-Tab 2: Course Outcomes & PO Matrix (Section 2) */}
              {syllabusSubTab === 'outcomes' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        2. Course Outcomes & PO Mapping Matrix
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Map each outcome to Bloom's Taxonomy Level and PO1–PO5 on a 1–3 scale (Low: 1, Medium: 2, High: 3).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addCourseOutcomeRow}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Outcome
                    </button>
                  </div>

                  <div className="space-y-3">
                    {syllabusData.course_outcomes.map((co, index) => (
                      <div key={co.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-mono text-xs font-bold px-2 py-1 rounded bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 mt-1">
                            CO {index + 1}
                          </span>
                          <div className="flex-1">
                            <textarea
                              rows={2}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white"
                              placeholder="Course Outcome Statement (e.g. Explain the sources and foundations of Indian business law...)"
                              value={co.statement}
                              onChange={(e) => {
                                const updated = [...syllabusData.course_outcomes];
                                updated[index].statement = e.target.value;
                                setSyllabusData({ ...syllabusData, course_outcomes: updated });
                              }}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCourseOutcomeRow(co.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Bloom's & PO Matrix */}
                        <div className="grid grid-cols-2 sm:grid-cols-7 gap-2 items-center bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                          <div className="col-span-2 sm:col-span-2">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bloom's Level</label>
                            <select
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 font-semibold"
                              value={co.blooms_level}
                              onChange={(e) => {
                                const updated = [...syllabusData.course_outcomes];
                                updated[index].blooms_level = e.target.value;
                                setSyllabusData({ ...syllabusData, course_outcomes: updated });
                              }}
                            >
                              {BLOOMS_LEVELS.map((bl) => (
                                <option key={bl} value={bl}>
                                  {bl}
                                </option>
                              ))}
                            </select>
                          </div>

                          {['po1', 'po2', 'po3', 'po4', 'po5'].map((poKey, pIdx) => (
                            <div key={poKey} className="text-center">
                              <label className="block text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mb-1">PO {pIdx + 1}</label>
                              <select
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-1 py-1 text-center font-bold"
                                value={(co as any)[poKey]}
                                onChange={(e) => {
                                  const updated = [...syllabusData.course_outcomes];
                                  (updated[index] as any)[poKey] = e.target.value;
                                  setSyllabusData({ ...syllabusData, course_outcomes: updated });
                                }}
                              >
                                <option value="-">-</option>
                                <option value="1">1 (Low)</option>
                                <option value="2">2 (Med)</option>
                                <option value="3">3 (High)</option>
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sub-Tab 3: Topics to be Covered / Units (Section 3) */}
              {syllabusSubTab === 'units' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        3. Topics to be Covered (Unit Breakdown)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Add Unit 1, Unit 2, etc., along with unit content and planned lecture hours.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addUnitTopicRow}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold shadow-sm"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Unit
                    </button>
                  </div>

                  <div className="space-y-4">
                    {syllabusData.topics.map((unit, index) => (
                      <div key={unit.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <input
                            type="text"
                            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 dark:text-white flex-1"
                            value={unit.unit_title}
                            onChange={(e) => {
                              const updated = [...syllabusData.topics];
                              updated[index].unit_title = e.target.value;
                              setSyllabusData({ ...syllabusData, topics: updated });
                            }}
                          />
                          <div className="flex items-center gap-2 shrink-0">
                            <label className="text-[11px] font-semibold text-slate-500">Hours:</label>
                            <input
                              type="number"
                              min="1"
                              className="w-16 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold"
                              value={unit.hours}
                              onChange={(e) => {
                                const updated = [...syllabusData.topics];
                                updated[index].hours = parseInt(e.target.value) || 0;
                                setSyllabusData({ ...syllabusData, topics: updated });
                              }}
                            />
                            {syllabusData.topics.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeUnitTopicRow(unit.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        <textarea
                          rows={3}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white leading-relaxed"
                          placeholder="Unit topics and detailed sub-content..."
                          value={unit.content}
                          onChange={(e) => {
                            const updated = [...syllabusData.topics];
                            updated[index].content = e.target.value;
                            setSyllabusData({ ...syllabusData, topics: updated });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sub-Tab 4: Recommended Industry-Based Learning Activities (Section 4) */}
              {syllabusSubTab === 'industry' && (
                <div className="space-y-6">
                  {/* 4a. Case Studies */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        4a. Case Studies
                      </h4>
                      <button
                        type="button"
                        onClick={addCaseStudyRow}
                        className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Case Study
                      </button>
                    </div>

                    {syllabusData.case_studies.map((cs, idx) => (
                      <div key={cs.id} className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                        <input
                          type="text"
                          className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs"
                          placeholder="Case Study Title"
                          value={cs.title}
                          onChange={(e) => {
                            const updated = [...syllabusData.case_studies];
                            updated[idx].title = e.target.value;
                            setSyllabusData({ ...syllabusData, case_studies: updated });
                          }}
                        />
                        <input
                          type="text"
                          className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs"
                          placeholder="Communication / Concept Covered"
                          value={cs.concept}
                          onChange={(e) => {
                            const updated = [...syllabusData.case_studies];
                            updated[idx].concept = e.target.value;
                            setSyllabusData({ ...syllabusData, case_studies: updated });
                          }}
                        />
                        <input
                          type="text"
                          className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs"
                          placeholder="Source / Access Link (HBSP)"
                          value={cs.link}
                          onChange={(e) => {
                            const updated = [...syllabusData.case_studies];
                            updated[idx].link = e.target.value;
                            setSyllabusData({ ...syllabusData, case_studies: updated });
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  {/* 4b. Live Assignments */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        4b. Live Assignments
                      </h4>
                      <button
                        type="button"
                        onClick={addLiveAssignmentRow}
                        className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Live Assignment
                      </button>
                    </div>

                    {syllabusData.live_assignments.map((la, idx) => (
                      <div key={la.id} className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                        <input
                          type="text"
                          className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs"
                          placeholder="Assignment Name"
                          value={la.assignment}
                          onChange={(e) => {
                            const updated = [...syllabusData.live_assignments];
                            updated[idx].assignment = e.target.value;
                            setSyllabusData({ ...syllabusData, live_assignments: updated });
                          }}
                        />
                        <input
                          type="text"
                          className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs"
                          placeholder="Task Description"
                          value={la.description}
                          onChange={(e) => {
                            const updated = [...syllabusData.live_assignments];
                            updated[idx].description = e.target.value;
                            setSyllabusData({ ...syllabusData, live_assignments: updated });
                          }}
                        />
                        <input
                          type="text"
                          className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs"
                          placeholder="Source / Platform"
                          value={la.platform}
                          onChange={(e) => {
                            const updated = [...syllabusData.live_assignments];
                            updated[idx].platform = e.target.value;
                            setSyllabusData({ ...syllabusData, live_assignments: updated });
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  {/* 4c. Software Exposure */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                      4c. Software Exposure (Tools & Bullet List)
                    </h4>
                    <textarea
                      rows={2}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white"
                      placeholder="e.g. MS Excel, LexisNexis, SPSS, PowerBI"
                      value={syllabusData.software_exposure}
                      onChange={(e) => setSyllabusData({ ...syllabusData, software_exposure: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* Sub-Tab 5: Scheme of Assessment & CCE Components (Sections 5 & 6) */}
              {syllabusSubTab === 'assessment' && (
                <div className="space-y-6">
                  {/* Section 5: Scheme of Assessment */}
                  <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 space-y-3">
                    <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">
                      5. Scheme of Assessment
                    </h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">CCE Marks</label>
                        <input
                          type="number"
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                          value={syllabusData.cce_marks}
                          onChange={(e) => {
                            const cce = parseInt(e.target.value) || 0;
                            setSyllabusData({ ...syllabusData, cce_marks: cce, total_marks: cce + syllabusData.tee_marks });
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">TEE Marks</label>
                        <input
                          type="number"
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                          value={syllabusData.tee_marks}
                          onChange={(e) => {
                            const tee = parseInt(e.target.value) || 0;
                            setSyllabusData({ ...syllabusData, tee_marks: tee, total_marks: syllabusData.cce_marks + tee });
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Total Marks</label>
                        <input
                          type="number"
                          disabled
                          className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-400"
                          value={syllabusData.total_marks}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 6: Suggested CCE Components */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        6. Suggested CCE Components (Assignment 1, 2, Presentations)
                      </h4>
                      <button
                        type="button"
                        onClick={addCCEComponentRow}
                        className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add CCE Component
                      </button>
                    </div>

                    {syllabusData.cce_components.map((cce, idx) => (
                      <div key={cce.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <input
                            type="text"
                            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 dark:text-white flex-1"
                            placeholder="Component Name (e.g. Assignment 1: NDA Drafting)"
                            value={cce.name}
                            onChange={(e) => {
                              const updated = [...syllabusData.cce_components];
                              updated[idx].name = e.target.value;
                              setSyllabusData({ ...syllabusData, cce_components: updated });
                            }}
                          />
                          <div className="flex items-center gap-2">
                            <label className="text-[11px] font-semibold text-slate-500">Marks:</label>
                            <input
                              type="number"
                              className="w-16 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold"
                              value={cce.marks}
                              onChange={(e) => {
                                const updated = [...syllabusData.cce_components];
                                updated[idx].marks = parseInt(e.target.value) || 0;
                                setSyllabusData({ ...syllabusData, cce_components: updated });
                              }}
                            />
                          </div>
                        </div>
                        <textarea
                          rows={2}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white"
                          placeholder="Assignment details in paragraph form..."
                          value={cce.details}
                          onChange={(e) => {
                            const updated = [...syllabusData.cce_components];
                            updated[idx].details = e.target.value;
                            setSyllabusData({ ...syllabusData, cce_components: updated });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sub-Tab 6: Textbooks & Reference Books (Sections 7 & 8) */}
              {syllabusSubTab === 'books' && (
                <div className="space-y-6">
                  {/* Section 7: Recommended Textbooks */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        7. Recommended Textbooks
                      </h4>
                      <button
                        type="button"
                        onClick={() => addBookRow('recommended')}
                        className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Textbook
                      </button>
                    </div>

                    {syllabusData.recommended_textbooks.map((tb, idx) => (
                      <div key={tb.id} className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                        <input
                          type="text"
                          className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs font-medium"
                          placeholder="Book Name"
                          value={tb.name}
                          onChange={(e) => {
                            const updated = [...syllabusData.recommended_textbooks];
                            updated[idx].name = e.target.value;
                            setSyllabusData({ ...syllabusData, recommended_textbooks: updated });
                          }}
                        />
                        <input
                          type="text"
                          className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs"
                          placeholder="Author"
                          value={tb.author}
                          onChange={(e) => {
                            const updated = [...syllabusData.recommended_textbooks];
                            updated[idx].author = e.target.value;
                            setSyllabusData({ ...syllabusData, recommended_textbooks: updated });
                          }}
                        />
                        <input
                          type="text"
                          className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs"
                          placeholder="Publisher"
                          value={tb.publisher}
                          onChange={(e) => {
                            const updated = [...syllabusData.recommended_textbooks];
                            updated[idx].publisher = e.target.value;
                            setSyllabusData({ ...syllabusData, recommended_textbooks: updated });
                          }}
                        />
                        <input
                          type="text"
                          className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs"
                          placeholder="Year"
                          value={tb.year}
                          onChange={(e) => {
                            const updated = [...syllabusData.recommended_textbooks];
                            updated[idx].year = e.target.value;
                            setSyllabusData({ ...syllabusData, recommended_textbooks: updated });
                          }}
                        />
                        <input
                          type="text"
                          className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs"
                          placeholder="Edition"
                          value={tb.edition}
                          onChange={(e) => {
                            const updated = [...syllabusData.recommended_textbooks];
                            updated[idx].edition = e.target.value;
                            setSyllabusData({ ...syllabusData, recommended_textbooks: updated });
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Section 8: Reference Books */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        8. Reference Books
                      </h4>
                      <button
                        type="button"
                        onClick={() => addBookRow('reference')}
                        className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Reference Book
                      </button>
                    </div>

                    {syllabusData.reference_books.map((rb, idx) => (
                      <div key={rb.id} className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                        <input
                          type="text"
                          className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs font-medium"
                          placeholder="Book Name"
                          value={rb.name}
                          onChange={(e) => {
                            const updated = [...syllabusData.reference_books];
                            updated[idx].name = e.target.value;
                            setSyllabusData({ ...syllabusData, reference_books: updated });
                          }}
                        />
                        <input
                          type="text"
                          className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs"
                          placeholder="Author"
                          value={rb.author}
                          onChange={(e) => {
                            const updated = [...syllabusData.reference_books];
                            updated[idx].author = e.target.value;
                            setSyllabusData({ ...syllabusData, reference_books: updated });
                          }}
                        />
                        <input
                          type="text"
                          className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs"
                          placeholder="Publisher"
                          value={rb.publisher}
                          onChange={(e) => {
                            const updated = [...syllabusData.reference_books];
                            updated[idx].publisher = e.target.value;
                            setSyllabusData({ ...syllabusData, reference_books: updated });
                          }}
                        />
                        <input
                          type="text"
                          className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs"
                          placeholder="Year"
                          value={rb.year}
                          onChange={(e) => {
                            const updated = [...syllabusData.reference_books];
                            updated[idx].year = e.target.value;
                            setSyllabusData({ ...syllabusData, reference_books: updated });
                          }}
                        />
                        <input
                          type="text"
                          className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs"
                          placeholder="Edition"
                          value={rb.edition}
                          onChange={(e) => {
                            const updated = [...syllabusData.reference_books];
                            updated[idx].edition = e.target.value;
                            setSyllabusData({ ...syllabusData, reference_books: updated });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Cancel
                  </button>

                  {/* Export Options */}
                  <button
                    type="button"
                    disabled={exportingFmt !== null}
                    onClick={() => handleDownloadExport('docx')}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-xs font-bold text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 transition-colors disabled:opacity-50"
                    title="Download Syllabus in Word (.docx) Format"
                  >
                    <Download className="h-4 w-4 text-blue-500" />
                    <span>{exportingFmt === 'docx' ? 'Generating Word...' : 'Export Word (.docx)'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={exportingFmt !== null}
                    onClick={() => handleDownloadExport('pdf')}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-xs font-bold text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 transition-colors disabled:opacity-50"
                    title="Download Syllabus in PDF (.pdf) Format"
                  >
                    <FileText className="h-4 w-4 text-rose-500" />
                    <span>{exportingFmt === 'pdf' ? 'Generating PDF...' : 'Export PDF (.pdf)'}</span>
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={updateSubjectMutation.isPending}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors shadow-md shadow-indigo-500/20 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" /> Save Complete Syllabus
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SEPARATE DEDICATED WINDOW 2: Session Plan Modal */}
      {modalType === 'sessionPlanModal' && selectedSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="h-6 w-6 text-cyan-500" /> Session Plan Editor
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {selectedSubject.name} ({selectedSubject.code})
                </p>
              </div>
              <button onClick={closeModal} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSessionPlan} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Session Plan Details (Lecture Sequences, Topics & Planned Hours)
                </label>
                <p className="text-[11px] text-slate-500 mb-2">
                  Specify session sequence numbers, lecture topics, planned duration, and teaching methodology.
                </p>
                <textarea
                  rows={14}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl p-4 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-cyan-500 leading-relaxed"
                  placeholder="Session 1: Indian Contract Act Overview (3 hrs)..."
                  value={sessionPlanInput}
                  onChange={(e) => setSessionPlanInput(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateSubjectMutation.isPending}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-sm transition-colors shadow-md shadow-cyan-500/20 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" /> Save Session Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SEPARATE DEDICATED WINDOW 3: HyperBuild Activities Modal */}
      {modalType === 'hyperbuildModal' && selectedSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="h-6 w-6 text-amber-500" /> HyperBuild Activities & Case Studies
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {selectedSubject.name} ({selectedSubject.code})
                </p>
              </div>
              <button onClick={closeModal} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveHyperbuild} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  HyperBuild Activities (Case Studies, Live Assignments & Simulations)
                </label>
                <p className="text-[11px] text-slate-500 mb-2">
                  Add HBSP/Harvard case study links, IIM simulations, live industry projects, and experiential assignments.
                </p>
                <textarea
                  rows={14}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl p-4 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-amber-500 leading-relaxed"
                  placeholder="Case Study 1: Satyam Corporate Governance (HBSP access link)..."
                  value={hyperbuildInput}
                  onChange={(e) => setHyperbuildInput(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateSubjectMutation.isPending}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm transition-colors shadow-md shadow-amber-500/20 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" /> Save HyperBuild Activities
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Faculty Session Completion Report Modal */}
      {modalType === 'report' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart2 className="h-5 w-5 text-cyan-500" /> Session Completion Report
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {selectedSubject?.name} ({selectedSubject?.code})
                </p>
              </div>
              <button onClick={closeModal} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            {reportLoading ? (
              <div className="flex items-center justify-center p-12">
                <div className="h-8 w-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : reportData ? (
              <div className="space-y-6">
                <div className="p-5 rounded-2xl bg-gradient-to-r from-cyan-500/10 to-indigo-500/10 border border-cyan-500/20 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-slate-900 dark:text-white">Overall Session Completion</span>
                    <span className="font-extrabold text-cyan-600 dark:text-cyan-400 text-lg">{reportData.completion_percentage}%</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
                    <div className="bg-gradient-to-r from-cyan-500 to-indigo-600 h-full transition-all duration-500" style={{ width: `${reportData.completion_percentage}%` }} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                    <p className="text-[11px] text-slate-400 uppercase font-semibold">Delivered Hours</p>
                    <p className="text-xl font-bold text-cyan-600 dark:text-cyan-400 mt-0.5">{reportData.total_delivered_hours} hrs</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                    <p className="text-[11px] text-slate-400 uppercase font-semibold">Sessions Completed</p>
                    <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{reportData.total_sessions_completed} / {reportData.total_sessions_scheduled}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                    <p className="text-[11px] text-slate-400 uppercase font-semibold">Completion %</p>
                    <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">{reportData.completion_percentage}%</p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
              <button onClick={closeModal} className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
