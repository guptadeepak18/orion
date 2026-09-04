import React, { useState, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
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
  Eye,
  RefreshCw,
  ChevronDown,
  Paperclip,
  CheckCircle2,
  Briefcase,
  Search,
  Award,
  FileCheck,
  Bookmark,
  Users,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../../components/Card';
import { useRoleAccess } from '../../lib/useRoleAccess';
import { HyperbuildActivitiesModal } from './HyperbuildActivitiesModal';
import { UnitContentFormatter } from './UnitContentFormatter';
import { FacultySubjectAllocationTab } from './FacultySubjectAllocationTab';

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
  course_code?: string;
  trimester: number;
  is_non_credit: boolean;
  credits: number;
  total_hours?: number;
  course_category?: string;
  elective_domain?: string;
  is_archived: boolean;
  syllabus?: string;
  session_plan?: string;
  hyperbuild_activities?: string;
  programs: ProgramSummary[];
  batch_allocations: BatchAllocation[];
  batch_id?: string;
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
  communication_concept?: string;
  author?: string;
  publisher_source?: string;
  product_number?: string;
  link?: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  file_type?: string;
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

const SYLLABUS_SECTIONS = [
  { id: 'overview', label: 'Overview', icon: BookOpen, description: 'Course summary and programme outcomes' },
  { id: 'outcomes', label: 'Learning outcomes', icon: Award, description: 'Course outcomes and PO mapping' },
  { id: 'units', label: 'Units and topics', icon: Layers, description: 'Teaching units and planned hours' },
  { id: 'industry', label: 'Applied learning', icon: FileCheck, description: 'Cases, assignments, and tools' },
  { id: 'assessment', label: 'Assessment', icon: GraduationCap, description: 'Marks and CCE components' },
  { id: 'books', label: 'Reading list', icon: Bookmark, description: 'Textbooks and references' },
] as const;

export interface SubjectsPageProps {
  initialTab?: 'subjects' | 'allocations';
}

export const SubjectsPage: React.FC<SubjectsPageProps> = ({ initialTab }) => {
  const { canManageCurriculum } = useRoleAccess();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  // Main Navigation Tab State (Subjects Directory vs Faculty Allocation)
  const queryTab = searchParams.get('tab') as 'subjects' | 'allocations' | null;
  const pathTab = location.pathname.includes('faculty-allocation') ? 'allocations' : null;
  const [activeSection, setActiveSection] = useState<'subjects' | 'allocations'>(
    queryTab || pathTab || initialTab || 'subjects'
  );

  useEffect(() => {
    if (queryTab) {
      setActiveSection(queryTab);
    } else if (pathTab) {
      setActiveSection('allocations');
    }
  }, [queryTab, pathTab]);

  const handleSectionTabChange = (tab: 'subjects' | 'allocations') => {
    setActiveSection(tab);
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    next.delete('modal');
    next.delete('id');
    next.delete('subtab');
    setSearchParams(next);
  };

  // Archive Filter Tab State
  const [viewTab, setViewTab] = useState<'active' | 'archived'>('active');

  // Modal Types
  const [modalType, setModalType] = useState<
    'createSubject' | 'editSubject' | 'syllabusModal' | 'sessionPlanModal' | 'hyperbuildModal' | 'report' | null
  >(null);

  // Syllabus Modal Active Sub-Tab (1 to 6)
  const [syllabusSubTab, setSyllabusSubTab] = useState<
    'overview' | 'outcomes' | 'units' | 'industry' | 'assessment' | 'books'
  >('overview');

  const updateUrlModal = (m: string | null, params: Record<string, string | undefined> = {}) => {
    const next = new URLSearchParams(searchParams);
    if (!m) {
      next.delete('modal');
      next.delete('id');
      next.delete('subtab');
    } else {
      next.set('modal', m);
      Object.entries(params).forEach(([k, v]) => {
        if (v) next.set(k, v);
        else next.delete(k);
      });
    }
    setSearchParams(next);
  };

  // Selected Subject for Modals
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);

  // Completion Report Data
  const [reportData, setReportData] = useState<CompletionReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Form State for Subject Create / Edit
  const [nameInput, setNameInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [courseCodeInput, setCourseCodeInput] = useState('');
  const [courseCategoryInput, setCourseCategoryInput] = useState<'core' | 'elective'>('core');
  const [electiveDomainInput, setElectiveDomainInput] = useState<string>('Marketing');
  const [isNonCreditInput, setIsNonCreditInput] = useState<boolean>(false);
  const [creditsInput, setCreditsInput] = useState<number>(3);
  const [totalHoursInput, setTotalHoursInput] = useState<number>(30);

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

  const [builderExpandedUnits, setBuilderExpandedUnits] = useState<Record<string, boolean>>({
    'unit-0': true,
  });

  const toggleBuilderUnit = (key: string) => {
    setBuilderExpandedUnits((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const expandAllBuilderUnits = () => {
    const all: Record<string, boolean> = {};
    syllabusData.topics.forEach((t, i) => {
      all[t.id || `unit-${i}`] = true;
    });
    setBuilderExpandedUnits(all);
  };

  const collapseAllBuilderUnits = () => {
    setBuilderExpandedUnits({});
  };

  const [uploadingCsId, setUploadingCsId] = useState<string | null>(null);

  const handleCaseStudyFileUpload = async (csIndex: number, file: File) => {
    const cs = syllabusData.case_studies[csIndex];
    if (!cs) return;
    setUploadingCsId(cs.id);
    setErrorMsg(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/academic/case-studies/upload-file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { file_url, file_name, file_size, file_type } = res.data.data;
      const updated = [...syllabusData.case_studies];
      updated[csIndex].file_url = file_url;
      updated[csIndex].file_name = file_name;
      updated[csIndex].file_size = file_size;
      updated[csIndex].file_type = file_type;
      setSyllabusData({ ...syllabusData, case_studies: updated });
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || err?.message || 'Failed to upload case study document');
    } finally {
      setUploadingCsId(null);
    }
  };

  // Case Library Picker State
  const [isBankPickerOpen, setIsBankPickerOpen] = useState(false);
  const [bankSearchTerm, setBankSearchTerm] = useState('');

  const { data: bankCaseStudies = [] } = useQuery<any[]>({
    queryKey: ['case-studies-bank-picker', bankSearchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (bankSearchTerm) params.append('search', bankSearchTerm);
      const res = await api.get(`/case-studies?${params.toString()}`);
      return res.data.data;
    },
    enabled: isBankPickerOpen,
  });

  const attachCaseStudyFromBank = (cs: any) => {
    const existing = [...syllabusData.case_studies];
    const newCase = {
      id: cs.id || `cs-${Date.now()}`,
      title: cs.title,
      concept: cs.concept || '',
      communication_concept: '',
      author: cs.author || '',
      publisher_source: cs.publisher_source || '',
      product_number: cs.product_number || '',
      link: cs.external_link || '',
      file_url: cs.file_url,
      file_name: cs.file_name,
      file_size: cs.file_size,
      file_type: cs.file_type,
    };

    if (existing.length === 1 && !existing[0].title && !existing[0].concept) {
      setSyllabusData({ ...syllabusData, case_studies: [newCase] });
    } else {
      setSyllabusData({ ...syllabusData, case_studies: [...existing, newCase] });
    }
    setIsBankPickerOpen(false);
  };

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch Subjects (Active or Archived)
  const { data: subjectsData = [], isLoading: subLoading } = useQuery<Subject[]>({
    queryKey: ['subjects', viewTab],
    queryFn: async () => {
      const res = await api.get(`/academic/subjects?is_archived=${viewTab === 'archived'}`);
      return res.data.data;
    },
  });

  // Fetch Batches for allocation label fallbacks
  const { data: batchesData = [] } = useQuery({
    queryKey: ['academic_batches_all'],
    queryFn: async () => {
      try {
        const res = await api.get('/academic/batches');
        return (res.data?.data || res.data || []) as any[];
      } catch {
        return [];
      }
    },
  });

  const batchMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    (batchesData || []).forEach((b: any) => {
      if (b.id && b.name) map[b.id] = b.name;
    });
    return map;
  }, [batchesData]);

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
  const [isUploadingSessionPlan, setIsUploadingSessionPlan] = useState(false);
  const [isSessionPlanPreviewOpen, setIsSessionPlanPreviewOpen] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const handleOpenSessionPlanPreview = async () => {
    if (!selectedSubject) return;
    setIsSessionPlanPreviewOpen(true);
    setIsPreviewLoading(true);
    if (previewBlobUrl) {
      window.URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
    try {
      const res = await api.get(`/academic/subjects/${selectedSubject.id}/session-plan/view`, {
        responseType: 'blob',
      });
      let mimeType = (res.headers['content-type'] as string) || 'application/pdf';
      const blob = new Blob([res.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      setPreviewBlobUrl(url);
    } catch (err: any) {
      console.error('Failed to load session plan preview:', err);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleCloseSessionPlanPreview = () => {
    if (previewBlobUrl) {
      window.URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
    setIsSessionPlanPreviewOpen(false);
  };

  const handleUploadSessionPlanFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSubject) return;
    setIsUploadingSessionPlan(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post(`/academic/subjects/${selectedSubject.id}/session-plan/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const updatedSub = res.data.data;
      setSelectedSubject(updatedSub);
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    } catch (err: any) {
      alert('Failed to upload session plan file: ' + (err?.response?.data?.detail || err?.message || 'Error'));
    } finally {
      setIsUploadingSessionPlan(false);
    }
  };

  const handleDownloadSessionPlanFile = async () => {
    if (!selectedSubject) return;
    try {
      const res = await api.get(`/academic/subjects/${selectedSubject.id}/session-plan/download`, {
        responseType: 'blob',
      });
      let filename = `${selectedSubject.code}_Session_Plan`;
      if (selectedSubject.session_plan && selectedSubject.session_plan.startsWith('{')) {
        try {
          const meta = JSON.parse(selectedSubject.session_plan);
          if (meta.file_name) filename = meta.file_name;
        } catch (e) {}
      }
      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Failed to download session plan file: ' + (err?.response?.data?.detail || err?.message || 'Error'));
    }
  };

  const handleDeleteSessionPlanFile = async () => {
    if (!selectedSubject || !confirm('Are you sure you want to remove the uploaded session plan file?')) return;
    try {
      const res = await api.delete(`/academic/subjects/${selectedSubject.id}/session-plan/file`);
      const updatedSub = res.data.data;
      setSelectedSubject(updatedSub);
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    } catch (err: any) {
      alert('Failed to delete session plan file: ' + (err?.response?.data?.detail || err?.message || 'Error'));
    }
  };

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
  const closeModal = (syncUrl = true) => {
    if (syncUrl) updateUrlModal(null);
    setModalType(null);
    setSelectedSubject(null);
    setNameInput('');
    setCodeInput('');
    setCourseCodeInput('');
    setCourseCategoryInput('core');
    setElectiveDomainInput('Marketing');
    setIsNonCreditInput(false);
    setCreditsInput(3);
    setTotalHoursInput(30);
    setErrorMsg(null);
    setSyllabusSubTab('overview');
  };

  const openCreateSubject = (syncUrl = true) => {
    closeModal(false);
    setModalType('createSubject');
    if (syncUrl) updateUrlModal('createSubject');
  };

  const openEditSubject = (subj: Subject, syncUrl = true) => {
    closeModal(false);
    setSelectedSubject(subj);
    setNameInput(subj.name);
    setCodeInput(subj.code);
    setCourseCodeInput(subj.course_code || '');
    setCourseCategoryInput((subj.course_category as any) || 'core');
    setElectiveDomainInput(subj.elective_domain || 'Marketing');
    setIsNonCreditInput(subj.is_non_credit || false);
    setCreditsInput(subj.credits || 3);
    setTotalHoursInput(subj.total_hours !== undefined ? subj.total_hours : 30);
    setModalType('editSubject');
    if (syncUrl) updateUrlModal('editSubject', { id: subj.id });
  };

  // Open Dedicated Syllabus Window
  const openSyllabusWindow = (subj: Subject, syncUrl = true, subtab?: string) => {
    closeModal(false);
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
    const targetSubtab = (subtab as any) || 'overview';
    setSyllabusSubTab(targetSubtab);
    setModalType('syllabusModal');
    if (syncUrl) updateUrlModal('syllabus', { id: subj.id, subtab: targetSubtab });
  };

  const openSessionPlanWindow = (subj: Subject, syncUrl = true) => {
    closeModal(false);
    setSelectedSubject(subj);
    setModalType('sessionPlanModal');
    if (syncUrl) updateUrlModal('sessionPlan', { id: subj.id });
  };

  const openHyperbuildWindow = (subj: Subject, syncUrl = true) => {
    closeModal(false);
    setSelectedSubject(subj);
    setModalType('hyperbuildModal');
    if (syncUrl) updateUrlModal('hyperbuild', { id: subj.id });
  };

  const openReportModal = async (subj: Subject, syncUrl = true) => {
    setSelectedSubject(subj);
    setModalType('report');
    if (syncUrl) updateUrlModal('report', { id: subj.id });
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

  // Deep-link URL modal synchronization
  const urlModal = searchParams.get('modal');
  const urlSubjectId = searchParams.get('id');
  const urlSubtab = searchParams.get('subtab');

  useEffect(() => {
    if (!urlModal) {
      if (modalType) closeModal(false);
      return;
    }

    if (urlModal === 'createSubject') {
      if (modalType !== 'createSubject') openCreateSubject(false);
      return;
    }

    if (urlSubjectId && subjectsData.length > 0) {
      const found = subjectsData.find((s) => s.id === urlSubjectId);
      if (found) {
        if (urlModal === 'editSubject' && modalType !== 'editSubject') {
          openEditSubject(found, false);
        } else if (urlModal === 'syllabus' && modalType !== 'syllabusModal') {
          openSyllabusWindow(found, false, urlSubtab || undefined);
        } else if (urlModal === 'sessionPlan' && modalType !== 'sessionPlanModal') {
          openSessionPlanWindow(found, false);
        } else if (urlModal === 'hyperbuild' && modalType !== 'hyperbuildModal') {
          openHyperbuildWindow(found, false);
        } else if (urlModal === 'report' && modalType !== 'report') {
          openReportModal(found, false);
        }
      }
    }
  }, [urlModal, urlSubjectId, urlSubtab, subjectsData]);

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
      course_code: courseCodeInput || undefined,
      course_category: courseCategoryInput,
      elective_domain: courseCategoryInput === 'elective' ? electiveDomainInput : undefined,
      is_non_credit: isNonCreditInput,
      credits: isNonCreditInput ? 0 : creditsInput,
      total_hours: totalHoursInput || 30,
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
      case_studies: [
        ...syllabusData.case_studies,
        { id: `cs-${Date.now()}`, title: '', concept: '', communication_concept: '', link: '' },
      ],
    });
  };

  const removeCaseStudyRow = (id: string) => {
    setSyllabusData({
      ...syllabusData,
      case_studies: syllabusData.case_studies.filter((cs) => cs.id !== id),
    });
  };

  const addLiveAssignmentRow = () => {
    setSyllabusData({
      ...syllabusData,
      live_assignments: [...syllabusData.live_assignments, { id: `la-${Date.now()}`, assignment: '', description: '', platform: '' }],
    });
  };

  const removeLiveAssignmentRow = (id: string) => {
    setSyllabusData({
      ...syllabusData,
      live_assignments: syllabusData.live_assignments.filter((la) => la.id !== id),
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

  const removeCCEComponentRow = (id: string) => {
    setSyllabusData({
      ...syllabusData,
      cce_components: syllabusData.cce_components.filter((cce) => cce.id !== id),
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

  const removeBookRow = (type: 'recommended' | 'reference', id: string) => {
    if (type === 'recommended') {
      setSyllabusData({
        ...syllabusData,
        recommended_textbooks: syllabusData.recommended_textbooks.filter((b) => b.id !== id),
      });
    } else {
      setSyllabusData({
        ...syllabusData,
        reference_books: syllabusData.reference_books.filter((b) => b.id !== id),
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Primary Navigation Tabs: Subjects Catalog vs Faculty Allocation */}
      <div className="flex items-center space-x-2 border-b-2 border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => handleSectionTabChange('subjects')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer ${
            activeSection === 'subjects'
              ? 'bg-cyan-600 dark:bg-cyan-500 text-white shadow-lg shadow-cyan-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <BookOpen className="h-4 w-4" /> Course Subjects Directory
        </button>
        <button
          onClick={() => handleSectionTabChange('allocations')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer ${
            activeSection === 'allocations'
              ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Users className="h-4 w-4" /> Faculty-Subject Allocation
        </button>
      </div>

      {activeSection === 'allocations' ? (
        <FacultySubjectAllocationTab />
      ) : (
        <>
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpen className="h-6 w-6 text-cyan-500" />
                Subjects Directory
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Manage course subjects, official course codes, credits, instructional hours, course syllabus, and lab activities.
              </p>
            </div>
            {canManageCurriculum && (
              <button
                onClick={() => openCreateSubject()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-500 dark:hover:bg-cyan-600 text-white text-sm font-semibold transition-colors shadow-md shadow-cyan-500/20 cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Add New Subject
              </button>
            )}
          </div>

          {/* Filter Tabs: Active vs Archived */}
          <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2">
            <button
              onClick={() => setViewTab('active')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                viewTab === 'active'
                  ? 'bg-cyan-600 dark:bg-cyan-500 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <BookOpen className="h-4 w-4" /> Active Subjects
            </button>
            <button
              onClick={() => setViewTab('archived')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
              <Card key={subject.id} className="p-6 transition-all duration-200 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-4">
                {/* 1. Header Row: Codes, Title, and Category Badges */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                    {/* Subject Code */}
                    <span className="font-mono text-xs font-black px-3 py-1 rounded-xl bg-cyan-600 text-white shadow-sm shadow-cyan-500/20">
                      {subject.code}
                    </span>

                    {/* Course Code (if present) */}
                    {subject.course_code && (
                      <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700" title="Course Code">
                        Course: {subject.course_code}
                      </span>
                    )}

                    {/* Subject Name */}
                    <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                      {subject.name}
                    </h2>
                  </div>

                  {/* Right Header Badges: Course Type, Credits & Hours, Status */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {/* Course Type / Elective Domain */}
                    {subject.course_category === 'elective' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shadow-sm whitespace-nowrap">
                        <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                        Elective • {subject.elective_domain || 'General'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shadow-sm whitespace-nowrap">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                        Core Course
                      </span>
                    )}

                    {/* Credits & Hours Badge */}
                    {subject.is_non_credit ? (
                      <span className="px-3 py-1 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shadow-sm whitespace-nowrap">
                        Non-Credit ({subject.total_hours || 30}h)
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-sm whitespace-nowrap">
                        {subject.credits} Credits • {subject.total_hours || 30} Hours
                      </span>
                    )}

                    {/* Archived Status */}
                    {subject.is_archived && (
                      <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        Archived
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. Middle Section: Programs & Batches Allocations */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                  {/* Associated Programs */}
                  <div className="flex items-start gap-2">
                    <Building className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Associated Programs:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {subject.programs && subject.programs.length > 0 ? (
                          subject.programs.map((p) => (
                            <span key={p.id} className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700">
                              {p.code} <span className="font-normal opacity-70">({p.name})</span>
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 italic">Applicable to all programs</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Batch Allocations & Academic Periods */}
                  <div className="flex items-start gap-2">
                    <Layers className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Academic Period & Batches:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {subject.batch_allocations && subject.batch_allocations.length > 0 ? (
                          subject.batch_allocations.map((ba) => {
                            const bName = ba.batch_name || batchMap[ba.batch_id] || (subject.batch_id && batchMap[subject.batch_id]) || 'PGDM Batch';
                            return (
                              <span key={ba.batch_id || ba.id} className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-medium border border-indigo-200 dark:border-indigo-800 text-xs">
                                <strong className="font-bold">{bName}</strong> — {ba.term_label || `Trimester ${ba.term_number || subject.trimester || 1}`} {ba.start_date ? `(${ba.start_date} → ${ba.end_date || 'Ongoing'})` : ''}
                              </span>
                            );
                          })
                        ) : subject.batch_id && batchMap[subject.batch_id] ? (
                          <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-medium border border-indigo-200 dark:border-indigo-800 text-xs">
                            <strong className="font-bold">{batchMap[subject.batch_id]}</strong> — Trimester {subject.trimester || 1}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-xs">No specific batch allocated</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Action Toolbar Footer */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left: Dedicated Curriculum Workspaces */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Syllabus Builder */}
                    <button
                      onClick={() => openSyllabusWindow(subject)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-xs font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-sm transition-all hover:scale-[1.02] cursor-pointer"
                      title="Open 9-Section Structured Syllabus Builder"
                    >
                      <FileText className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" /> Syllabus Builder
                    </button>

                    {/* Session Plan */}
                    <button
                      onClick={() => openSessionPlanWindow(subject)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 text-xs font-bold text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 shadow-sm transition-all hover:scale-[1.02] cursor-pointer"
                      title="Open Dedicated Session Plan Window"
                    >
                      <Calendar className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" /> Session Plan
                    </button>

                    {/* HyperBuild Activities */}
                    <button
                      onClick={() => openHyperbuildWindow(subject)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-xs font-bold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shadow-sm transition-all hover:scale-[1.02] cursor-pointer"
                      title="Open HyperBuild AI Lab Activities Window"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" /> HyperBuild Activities
                    </button>

                    {/* Completion Report */}
                    <button
                      onClick={() => openReportModal(subject)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-sm transition-all hover:scale-[1.02] cursor-pointer"
                      title="View Faculty Session Delivery & Topic Completion Report"
                    >
                      <BarChart2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Completion Report
                    </button>
                  </div>

                  {/* Right: Administrative Actions */}
                  {canManageCurriculum && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => openEditSubject(subject)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-cyan-600 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                        title="Edit Subject Basic Info & Allocations"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>

                      {!subject.is_archived ? (
                        <button
                          onClick={() => {
                            if (confirm(`Archive subject '${subject.name}'?`)) {
                              archiveSubjectMutation.mutate(subject.id);
                            }
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800/80 transition-colors cursor-pointer"
                          title="Archive Subject"
                        >
                          <Archive className="h-3.5 w-3.5" /> Archive
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            unarchiveSubjectMutation.mutate(subject.id);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800/80 transition-colors cursor-pointer"
                          title="Restore Subject"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Restore
                        </button>
                      )}

                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to permanently delete '${subject.name}'? This action cannot be undone.`)) {
                            deleteSubjectMutation.mutate(subject.id);
                          }
                        }}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                        title="Delete Subject"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>
    </>
  )}

      {/* Create / Edit Subject Basic Modal */}
      {(modalType === 'createSubject' || modalType === 'editSubject') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {modalType === 'createSubject' ? 'Add New Subject' : `Edit Subject: ${selectedSubject?.code}`}
              </h3>
              <button onClick={() => closeModal()} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubjectSubmit} className="space-y-5">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Subject Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 font-semibold"
                      placeholder="e.g. Legal Aspects of Business"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Subject Code <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 font-semibold font-mono"
                      placeholder="e.g. LAB"
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Course Catalog Code
                    </label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 font-mono"
                      placeholder="e.g. 1GNC02 / PGDM-501"
                      value={courseCodeInput}
                      onChange={(e) => setCourseCodeInput(e.target.value)}
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Official course code in syllabus & catalog</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Instructional Hours (Total Hours)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="300"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                      placeholder="e.g. 30"
                      value={totalHoursInput}
                      onChange={(e) => setTotalHoursInput(parseInt(e.target.value) || 0)}
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Total planned instructional delivery hours</p>
                  </div>
                </div>

                {/* Course Category (Core vs Elective) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Course Type <span className="text-rose-500">*</span>
                    </label>
                    <select
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white font-medium focus:outline-none focus:border-cyan-500 cursor-pointer"
                      value={courseCategoryInput}
                      onChange={(e) => setCourseCategoryInput(e.target.value as 'core' | 'elective')}
                    >
                      <option value="core">Core Course</option>
                      <option value="elective">Elective</option>
                    </select>
                    <p className="text-[11px] text-slate-400 mt-1">Mandatory core course or student elective</p>
                  </div>

                  {courseCategoryInput === 'elective' ? (
                    <div className="p-3.5 rounded-2xl bg-purple-50/60 dark:bg-purple-950/30 border-2 border-purple-400 dark:border-purple-500 ring-4 ring-purple-400/20 shadow-md">
                      <label className="block text-xs font-black text-purple-900 dark:text-purple-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>Specialization Domain <span className="text-rose-500">*</span></span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200">
                          Elective Domain
                        </span>
                      </label>
                      <select
                        className="w-full bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                        value={electiveDomainInput}
                        onChange={(e) => setElectiveDomainInput(e.target.value)}
                      >
                        <option value="Marketing">Marketing</option>
                        <option value="Finance">Finance</option>
                        <option value="Human Resources">Human Resources</option>
                        <option value="Research & Business Analytics">Research & Business Analytics</option>
                      </select>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <p className="text-xs text-slate-400 italic">
                        Standard mandatory core subject for student curricula.
                      </p>
                    </div>
                  )}
                </div>

                {/* Credit Grading */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Credit Grading</label>
                    <label className="flex items-center space-x-2 text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        className="rounded text-cyan-600 focus:ring-cyan-500 h-4 w-4"
                        checked={isNonCreditInput}
                        onChange={(e) => setIsNonCreditInput(e.target.checked)}
                      />
                      <span>Non-Credit Subject</span>
                    </label>
                  </div>

                  {!isNonCreditInput && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Credit Weightage</label>
                      <input
                        type="number"
                        min="1"
                        max="12"
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 font-semibold"
                        value={creditsInput}
                        onChange={(e) => setCreditsInput(parseInt(e.target.value) || 0)}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => closeModal()}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubjectMutation.isPending || updateSubjectMutation.isPending}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs shadow-md shadow-cyan-500/20 transition-all disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
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
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="syllabus-builder-title"
            className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            {/* Header */}
            <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 id="syllabus-builder-title" className="text-lg font-bold text-slate-900 dark:text-white">
                      Syllabus builder
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">6 workspaces · 9 syllabus sections</p>
                  </div>
                </div>
                <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  {selectedSubject.name}
                  <span className="ml-2 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {selectedSubject.code}
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Word / PDF Upload Button */}
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20">
                  <Upload className="h-4 w-4" />
                  <span>{uploadSyllabusMutation.isPending ? 'Parsing document…' : 'Import Word or PDF'}</span>
                  <input
                    type="file"
                    accept=".docx,.doc,.pdf"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploadSyllabusMutation.isPending}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => closeModal()}
                  aria-label="Close syllabus builder"
                  className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Notification Banners */}
            {uploadSuccessMsg && (
              <div className="mx-5 mt-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 sm:mx-6">
                <span>{uploadSuccessMsg}</span>
                <button onClick={() => setUploadSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {errorMsg && (
              <div className="mx-5 mt-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 sm:mx-6">
                <span>{errorMsg}</span>
                <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            <form onSubmit={handleSaveSyllabus} className="flex min-h-0 flex-1 flex-col">
              <div className="flex min-h-0 flex-1 flex-col border-t border-slate-100 dark:border-slate-800 lg:flex-row lg:border-t-0">
                {/* Section navigation stays visible so users can move through the syllabus without losing context. */}
                <nav aria-label="Syllabus sections" className="flex shrink-0 gap-1 overflow-x-auto no-scrollbar scroll-smooth border-b border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/30 lg:w-60 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r">
                  {SYLLABUS_SECTIONS.map((section) => {
                    const isActive = syllabusSubTab === section.id;
                    const Icon = section.icon;
                    return (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => setSyllabusSubTab(section.id)}
                        className={`min-w-40 rounded-xl px-3 py-2.5 text-left transition-colors lg:min-w-0 ${
                          isActive
                            ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-200 dark:bg-slate-900 dark:text-indigo-300 dark:ring-indigo-500/30'
                            : 'text-slate-600 hover:bg-white/80 dark:text-slate-400 dark:hover:bg-slate-900/70'
                        }`}
                      >
                        <span className="flex items-center gap-2 text-xs font-semibold">
                          <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`} />
                          <span className="truncate">{section.label}</span>
                        </span>
                        <span className="mt-1 hidden text-[11px] leading-4 text-slate-500 dark:text-slate-400 lg:block pl-6">
                          {section.description}
                        </span>
                      </button>
                    );
                  })}
                </nav>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                  <div className="mx-auto max-w-4xl space-y-6">
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
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        2. Course Outcomes & PO Mapping Matrix
                      </h4>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        Map each outcome to Bloom's Taxonomy Level and PO1–PO5 on a 1–3 scale (Low: 1, Medium: 2, High: 3).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addCourseOutcomeRow}
                      className="flex w-fit items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Outcome
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <div className="min-w-[940px]">
                      <div className="grid grid-cols-[3.25rem_minmax(20rem,1fr)_9rem_repeat(5,minmax(4rem,4.75rem))_2.5rem] items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-400">
                        <span>CO</span>
                        <span>Outcome statement</span>
                        <span>Bloom level</span>
                        {['PO 1', 'PO 2', 'PO 3', 'PO 4', 'PO 5'].map((po) => (
                          <span key={po} className="text-center text-indigo-600 dark:text-indigo-400">{po}</span>
                        ))}
                        <span className="sr-only">Remove</span>
                      </div>

                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {syllabusData.course_outcomes.map((co, index) => (
                          <div
                            key={co.id}
                            className="group grid grid-cols-[3.25rem_minmax(20rem,1fr)_9rem_repeat(5,minmax(4rem,4.75rem))_2.5rem] items-start gap-2 px-3 py-3 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/30"
                          >
                            <span className="mt-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 font-mono text-[11px] font-bold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                              {index + 1}
                            </span>

                            <textarea
                              rows={2}
                              aria-label={`Course outcome ${index + 1} statement`}
                              className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                              placeholder="Write a clear, measurable learning outcome..."
                              value={co.statement}
                              onChange={(e) => {
                                const updated = [...syllabusData.course_outcomes];
                                updated[index].statement = e.target.value;
                                setSyllabusData({ ...syllabusData, course_outcomes: updated });
                              }}
                            />

                            <select
                              aria-label={`Course outcome ${index + 1} Bloom level`}
                              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
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

                            {['po1', 'po2', 'po3', 'po4', 'po5'].map((poKey, pIdx) => (
                              <select
                                key={poKey}
                                aria-label={`Course outcome ${index + 1} PO ${pIdx + 1} mapping`}
                                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-1 py-1.5 text-center text-xs font-semibold text-slate-700 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                value={(co as any)[poKey]}
                                onChange={(e) => {
                                  const updated = [...syllabusData.course_outcomes];
                                  (updated[index] as any)[poKey] = e.target.value;
                                  setSyllabusData({ ...syllabusData, course_outcomes: updated });
                                }}
                              >
                                <option value="-">-</option>
                                <option value="1">1</option>
                                <option value="2">2</option>
                                <option value="3">3</option>
                              </select>
                            ))}

                            <button
                              type="button"
                              onClick={() => removeCourseOutcomeRow(co.id)}
                              aria-label={`Remove course outcome ${index + 1}`}
                              className="mt-1 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500/20 dark:hover:bg-rose-500/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-Tab 3: Topics to be Covered / Units (Section 3) */}
              {syllabusSubTab === 'units' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        3. Topics to be Covered (Unit Breakdown)
                      </h4>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        Define teaching units, planned lecture hours, and syllabus topics. Each unit is collapsible for effortless editing.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {syllabusData.topics.length > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={expandAllBuilderUnits}
                            className="px-2.5 py-1.5 text-xs font-bold text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 hover:bg-cyan-100 rounded-xl border border-cyan-200 dark:border-cyan-800 transition-colors"
                          >
                            Expand All
                          </button>
                          <button
                            type="button"
                            onClick={collapseAllBuilderUnits}
                            className="px-2.5 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors"
                          >
                            Collapse All
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={addUnitTopicRow}
                        className="flex items-center gap-1.5 rounded-xl bg-cyan-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-cyan-700"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Unit
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {syllabusData.topics.map((unit, index) => {
                      const uKey = unit.id || `unit-${index}`;
                      const isExpanded = !!builderExpandedUnits[uKey];

                      return (
                        <div
                          key={uKey}
                          className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden transition-all"
                        >
                          {/* Unit Card Header (Collapsible trigger) */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <button
                                type="button"
                                onClick={() => toggleBuilderUnit(uKey)}
                                className="h-8 w-8 rounded-xl bg-cyan-50 dark:bg-cyan-950 font-mono text-xs font-extrabold text-cyan-700 dark:text-cyan-300 flex items-center justify-center border border-cyan-200 dark:border-cyan-800 shrink-0 hover:bg-cyan-100 transition-colors"
                                title="Toggle Collapse"
                              >
                                U{unit.unit_number || index + 1}
                              </button>

                              <div className="flex-1 min-w-0">
                                <input
                                  type="text"
                                  aria-label={`Unit ${index + 1} title`}
                                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-900 dark:text-white outline-none transition-colors placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10"
                                  placeholder="e.g. Contract Law, Drafting and Digital Agreements"
                                  value={unit.unit_title}
                                  onChange={(e) => {
                                    const updated = [...syllabusData.topics];
                                    updated[index].unit_title = e.target.value;
                                    setSyllabusData({ ...syllabusData, topics: updated });
                                  }}
                                />
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min="1"
                                  aria-label={`Unit ${index + 1} planned hours`}
                                  className="w-16 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-center text-xs font-bold text-slate-700 dark:text-slate-200 outline-none transition-colors focus:border-cyan-500"
                                  value={unit.hours}
                                  onChange={(e) => {
                                    const updated = [...syllabusData.topics];
                                    updated[index].hours = parseInt(e.target.value) || 0;
                                    setSyllabusData({ ...syllabusData, topics: updated });
                                  }}
                                />
                                <span className="text-[11px] text-slate-500 font-semibold">Hrs</span>
                              </div>

                              {syllabusData.topics.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeUnitTopicRow(unit.id)}
                                  aria-label={`Remove unit ${index + 1}`}
                                  className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 focus:outline-none dark:hover:bg-rose-500/10"
                                  title="Delete Unit"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => toggleBuilderUnit(uKey)}
                                className={`p-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition-transform duration-200 ${
                                  isExpanded ? 'rotate-180' : ''
                                }`}
                                title={isExpanded ? 'Collapse Unit' : 'Expand Unit'}
                              >
                                <ChevronDown className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          {/* Unit Content Body (Collapsible) */}
                          {isExpanded && (
                            <div className="p-5 space-y-4 animate-fadeIn">
                              <div className="space-y-1.5">
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                  Unit Topics, Sub-Modules & Learning Concepts
                                </label>
                                <textarea
                                  rows={4}
                                  aria-label={`Unit ${index + 1} topics and content`}
                                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-3 text-xs leading-relaxed text-slate-900 dark:text-white outline-none transition-colors placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10"
                                  placeholder="Enter topics separated by newlines, semicolons, or headers (e.g. Concept Name: Subtopic 1; Subtopic 2. Case Discussion: Landmark case...)"
                                  value={unit.content}
                                  onChange={(e) => {
                                    const updated = [...syllabusData.topics];
                                    updated[index].content = e.target.value;
                                    setSyllabusData({ ...syllabusData, topics: updated });
                                  }}
                                />
                              </div>

                              {/* Live Formatted Preview */}
                              {unit.content && unit.content.trim() && (
                                <div className="rounded-xl bg-slate-50/60 dark:bg-slate-800/30 p-3.5 border border-slate-100 dark:border-slate-800 space-y-2">
                                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    <Eye className="h-3 w-3 text-cyan-500" /> Formatted Structure Preview (as seen in LMS & Viewer)
                                  </div>
                                  <UnitContentFormatter content={unit.content} />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sub-Tab 4: Recommended Industry-Based Learning Activities (Section 4) */}
              {syllabusSubTab === 'industry' && (
                <div className="space-y-8">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      4. Applied Learning, Cases & Industry Exposure
                    </h4>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      Specify real-world business case studies, practical assignments, and industry software tools students will engage with.
                    </p>
                  </div>

                  {/* 4a. Case Studies */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-indigo-500" />
                          <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                            4a. Prescribed Business Case Studies
                          </h5>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Select from the institutional business case library or upload a new case study document (PDF/DOCX).
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setBankSearchTerm('');
                            setIsBankPickerOpen(true);
                          }}
                          className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 text-xs font-bold shadow-sm shadow-indigo-500/25 transition-all"
                        >
                          <Briefcase className="h-3.5 w-3.5" /> Pick from Case Library
                        </button>
                        <button
                          type="button"
                          onClick={addCaseStudyRow}
                          className="flex items-center gap-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add Custom
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {syllabusData.case_studies.map((cs, idx) => (
                        <div
                          key={cs.id}
                          className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-sm"
                        >
                          {/* Top Row: Case Title & Delete Action */}
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 flex-1">
                              <span className="h-7 w-7 rounded-lg bg-indigo-50 dark:bg-indigo-950 font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800 shrink-0">
                                CS{idx + 1}
                              </span>
                              <div className="flex-1">
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
                                  Case Study Title *
                                </label>
                                <input
                                  type="text"
                                  aria-label={`Case study ${idx + 1} title`}
                                  className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 text-xs font-bold text-slate-900 dark:text-white outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700"
                                  placeholder="e.g. Tech Mahindra and the Acquisition of Satyam Computers"
                                  value={cs.title}
                                  onChange={(e) => {
                                    const updated = [...syllabusData.case_studies];
                                    updated[idx].title = e.target.value;
                                    setSyllabusData({ ...syllabusData, case_studies: updated });
                                  }}
                                />
                              </div>
                            </div>

                            {syllabusData.case_studies.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeCaseStudyRow(cs.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors shrink-0 mt-3"
                                title="Delete Case Study"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>

                          {/* Row 2: Case Overview */}
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
                              Case Overview *
                            </label>
                            <textarea
                              rows={2}
                              aria-label={`Case study ${idx + 1} overview`}
                              className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-900 dark:text-white outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 leading-relaxed"
                              placeholder="Detailed synopsis of the business scenario, corporate dilemma, or key challenges..."
                              value={cs.concept}
                              onChange={(e) => {
                                const updated = [...syllabusData.case_studies];
                                updated[idx].concept = e.target.value;
                                setSyllabusData({ ...syllabusData, case_studies: updated });
                              }}
                            />
                          </div>

                          {/* Row 3: Communication Concept Covered */}
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-0.5">
                              Communication Concept Covered
                            </label>
                            <input
                              type="text"
                              aria-label={`Case study ${idx + 1} communication concept`}
                              className="w-full rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-950/20 px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-white outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                              placeholder="e.g. Crisis communication & stakeholder messaging during corporate turnaround"
                              value={cs.communication_concept || ''}
                              onChange={(e) => {
                                const updated = [...syllabusData.case_studies];
                                updated[idx].communication_concept = e.target.value;
                                setSyllabusData({ ...syllabusData, case_studies: updated });
                              }}
                            />
                          </div>

                          {/* Mandatory Document Upload & Optional Web Link */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                            {/* Document Upload Area */}
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center justify-between">
                                <span>Case Study Document (Mandatory for LMS) *</span>
                                {cs.file_url && (
                                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 text-[10px] font-bold">
                                    <CheckCircle2 className="h-3 w-3" /> Ready
                                  </span>
                                )}
                              </label>

                              {cs.file_url ? (
                                <div className="flex items-center justify-between p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Paperclip className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                      {cs.file_name || 'Case_Study_Document.pdf'}
                                    </span>
                                    {cs.file_size && (
                                      <span className="text-[10px] text-slate-400 shrink-0">
                                        ({Math.round(cs.file_size / 1024)} KB)
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0 ml-2">
                                    <label className="cursor-pointer px-2 py-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800 hover:bg-slate-50 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors">
                                      Replace
                                      <input
                                        type="file"
                                        accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
                                        className="hidden"
                                        disabled={uploadingCsId === cs.id}
                                        onChange={(e) => {
                                          if (e.target.files && e.target.files[0]) {
                                            handleCaseStudyFileUpload(idx, e.target.files[0]);
                                          }
                                        }}
                                      />
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = [...syllabusData.case_studies];
                                        updated[idx].file_url = undefined;
                                        updated[idx].file_name = undefined;
                                        updated[idx].file_size = undefined;
                                        setSyllabusData({ ...syllabusData, case_studies: updated });
                                      }}
                                      className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                                      title="Remove Document"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <label className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-dashed border-indigo-300 dark:border-indigo-700 bg-indigo-50/30 dark:bg-indigo-950/20 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer transition-colors text-xs font-bold text-indigo-700 dark:text-indigo-300">
                                  {uploadingCsId === cs.id ? (
                                    <span className="flex items-center gap-1.5">
                                      <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Uploading Document...
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1.5">
                                      <Upload className="h-3.5 w-3.5" /> Upload Case Study Document (PDF / DOCX)
                                    </span>
                                  )}
                                  <input
                                    type="file"
                                    accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
                                    className="hidden"
                                    disabled={uploadingCsId === cs.id}
                                    onChange={(e) => {
                                      if (e.target.files && e.target.files[0]) {
                                        handleCaseStudyFileUpload(idx, e.target.files[0]);
                                      }
                                    }}
                                  />
                                </label>
                              )}
                            </div>

                            {/* Optional External URL */}
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                External Web Link / Citation (Optional)
                              </label>
                              <input
                                type="text"
                                aria-label={`Case study ${idx + 1} access link`}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-white outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700"
                                placeholder="e.g. https://hbsp.harvard.edu/... or Law Reporter Citation"
                                value={cs.link}
                                onChange={(e) => {
                                  const updated = [...syllabusData.case_studies];
                                  updated[idx].link = e.target.value;
                                  setSyllabusData({ ...syllabusData, case_studies: updated });
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 4b. Live Practical Assignments */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-cyan-500" />
                          <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                            4b. Live Practical Assignments & Simulation Tasks
                          </h5>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Specify hands-on industry assignments, legal audits, drafting exercises, or simulations.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={addLiveAssignmentRow}
                        className="flex items-center gap-1.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 px-3 py-1.5 text-xs font-bold text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800 hover:bg-cyan-100 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Live Assignment
                      </button>
                    </div>

                    <div className="space-y-3">
                      {syllabusData.live_assignments.map((la, idx) => (
                        <div
                          key={la.id}
                          className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-sm"
                        >
                          {/* Assignment Name & Platform */}
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              <span className="h-7 w-7 rounded-lg bg-cyan-50 dark:bg-cyan-950 font-mono font-bold text-xs text-cyan-700 dark:text-cyan-400 flex items-center justify-center border border-cyan-200 dark:border-cyan-800 shrink-0">
                                LA{idx + 1}
                              </span>
                              <div className="flex-1">
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
                                  Assignment Name *
                                </label>
                                <input
                                  type="text"
                                  aria-label={`Live assignment ${idx + 1} name`}
                                  className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 text-xs font-bold text-slate-900 dark:text-white outline-none transition-colors focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 dark:border-slate-700"
                                  placeholder="e.g. Landmark Judgment Brief: Amazon v. Future Retail"
                                  value={la.assignment}
                                  onChange={(e) => {
                                    const updated = [...syllabusData.live_assignments];
                                    updated[idx].assignment = e.target.value;
                                    setSyllabusData({ ...syllabusData, live_assignments: updated });
                                  }}
                                />
                              </div>
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
                              <div className="flex-1">
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
                                  Platform / Tool / Portal
                                </label>
                                <input
                                  type="text"
                                  aria-label={`Live assignment ${idx + 1} platform`}
                                  className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-white outline-none transition-colors focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 dark:border-slate-700"
                                  placeholder="e.g. Supreme Court of India & Indian Kanoon"
                                  value={la.platform}
                                  onChange={(e) => {
                                    const updated = [...syllabusData.live_assignments];
                                    updated[idx].platform = e.target.value;
                                    setSyllabusData({ ...syllabusData, live_assignments: updated });
                                  }}
                                />
                              </div>

                              {syllabusData.live_assignments.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeLiveAssignmentRow(la.id)}
                                  className="mt-3 p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                                  title="Delete Live Assignment"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Task Description & Deliverables */}
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                              Task Description & Deliverables *
                            </label>
                            <textarea
                              rows={2}
                              className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-800/80 p-2.5 text-xs text-slate-900 dark:text-white outline-none transition-colors focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 dark:border-slate-700 leading-relaxed"
                              placeholder="Describe the student task, practical steps, simulation context, and exact deliverable expected..."
                              value={la.description}
                              onChange={(e) => {
                                const updated = [...syllabusData.live_assignments];
                                updated[idx].description = e.target.value;
                                setSyllabusData({ ...syllabusData, live_assignments: updated });
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 4c. Software & Tools Exposure */}
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30 p-5 space-y-4 shadow-sm">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                          4c. Software, Toolkits & Digital Exposure
                        </label>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        List software packages, digital portals, compliance toolkits, and AI platforms (bullet points or newline separated).
                      </p>
                    </div>

                    <textarea
                      rows={3}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-xs text-slate-900 dark:text-white outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 leading-relaxed font-mono"
                      placeholder="• ODR platforms & AI-assisted legal research tools (SCC Online, Manupatra)&#10;• MCA21 Portal for SPICe+ company incorporation&#10;• AI-Assisted Contract Review and CLM Tools"
                      value={syllabusData.software_exposure}
                      onChange={(e) => setSyllabusData({ ...syllabusData, software_exposure: e.target.value })}
                    />

                    {syllabusData.software_exposure && (
                      <div className="space-y-2 pt-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Showcase Preview in LMS:
                        </span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {syllabusData.software_exposure
                            .split(/\n|•|(?:\r\n)/)
                            .map((t) => t.trim().replace(/^[-*•\d+\.]\s*/, ''))
                            .filter((t) => t.length > 0)
                            .map((tool, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 shadow-xs"
                              >
                                <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                                <span className="truncate">{tool}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sub-Tab 5: Scheme of Assessment & CCE Components (Sections 5 & 6) */}
              {syllabusSubTab === 'assessment' && (
                <div className="space-y-6">
                  {/* Section 5: Scheme of Assessment */}
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">5. Scheme of assessment</h4>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Set the marks allocation for continuous and terminal evaluation.</p>
                    </div>
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-400">
                        <span className="px-4 py-2.5">CCE marks</span><span className="border-l border-slate-200 px-4 py-2.5 dark:border-slate-700">TEE marks</span><span className="border-l border-slate-200 px-4 py-2.5 dark:border-slate-700">Total marks</span>
                      </div>
                      <div className="grid grid-cols-3">
                        <div className="p-3">
                        <input
                          type="number"
                          aria-label="CCE marks"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                          value={syllabusData.cce_marks}
                          onChange={(e) => {
                            const cce = parseInt(e.target.value) || 0;
                            setSyllabusData({ ...syllabusData, cce_marks: cce, total_marks: cce + syllabusData.tee_marks });
                          }}
                        />
                      </div>
                        <div className="border-l border-slate-200 p-3 dark:border-slate-700">
                        <input
                          type="number"
                          aria-label="TEE marks"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                          value={syllabusData.tee_marks}
                          onChange={(e) => {
                            const tee = parseInt(e.target.value) || 0;
                            setSyllabusData({ ...syllabusData, tee_marks: tee, total_marks: syllabusData.cce_marks + tee });
                          }}
                        />
                      </div>
                        <div className="border-l border-slate-200 p-3 dark:border-slate-700">
                        <input
                          type="number"
                          disabled
                          aria-label="Total marks"
                          className="w-full rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300"
                          value={syllabusData.total_marks}
                        />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 6: Suggested CCE Components */}
                  <div className="space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">6. CCE components</h4>
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">List each continuous-evaluation component and its contribution.</p>
                      </div>
                      <button
                        type="button"
                        onClick={addCCEComponentRow}
                        className="flex w-fit items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add CCE Component
                      </button>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      <div className="min-w-[640px]">
                        <div className="grid grid-cols-[minmax(14rem,0.9fr)_6rem_minmax(20rem,1.4fr)_2.5rem] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-400">
                          <span>Component</span>
                          <span className="text-center">Marks</span>
                          <span>Details</span>
                          <span className="sr-only">Delete</span>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                          {syllabusData.cce_components.map((cce, idx) => (
                            <div key={cce.id} className="grid grid-cols-[minmax(14rem,0.9fr)_6rem_minmax(20rem,1.4fr)_2.5rem] items-center gap-2 px-3 py-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/30">
                              <input type="text" aria-label={`CCE component ${idx + 1} name`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="Component name" value={cce.name} onChange={(e) => { const updated = [...syllabusData.cce_components]; updated[idx].name = e.target.value; setSyllabusData({ ...syllabusData, cce_components: updated }); }} />
                              <input type="number" aria-label={`CCE component ${idx + 1} marks`} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-center text-xs font-semibold text-slate-700 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200" value={cce.marks} onChange={(e) => { const updated = [...syllabusData.cce_components]; updated[idx].marks = parseInt(e.target.value) || 0; setSyllabusData({ ...syllabusData, cce_components: updated }); }} />
                              <textarea rows={1} aria-label={`CCE component ${idx + 1} details`} className="resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="Describe the task, evidence, or presentation..." value={cce.details} onChange={(e) => { const updated = [...syllabusData.cce_components]; updated[idx].details = e.target.value; setSyllabusData({ ...syllabusData, cce_components: updated }); }} />
                              {syllabusData.cce_components.length > 1 ? (
                                <button type="button" onClick={() => removeCCEComponentRow(cce.id)} className="p-1 text-slate-400 hover:text-rose-600 transition-colors" title="Delete CCE Component">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              ) : <span />}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-Tab 6: Textbooks & Reference Books (Sections 7 & 8) */}
              {syllabusSubTab === 'books' && (
                <div className="space-y-7">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">7–8. Reading list</h4>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Maintain the core textbooks and supporting references in a consistent citation format.</p>
                  </div>

                  {/* Section 7: Recommended Textbooks */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Recommended textbooks
                      </h5>
                      <button
                        type="button"
                        onClick={() => addBookRow('recommended')}
                        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Textbook
                      </button>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      <div className="min-w-[760px]">
                        <div className="grid grid-cols-[minmax(16rem,1.3fr)_minmax(11rem,0.9fr)_minmax(10rem,0.8fr)_5rem_5rem_2.5rem] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-400">
                          <span>Book title</span>
                          <span>Author</span>
                          <span>Publisher</span>
                          <span>Year</span>
                          <span>Edition</span>
                          <span className="sr-only">Delete</span>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                          {syllabusData.recommended_textbooks.map((tb, idx) => (
                            <div key={tb.id} className="grid grid-cols-[minmax(16rem,1.3fr)_minmax(11rem,0.9fr)_minmax(10rem,0.8fr)_5rem_5rem_2.5rem] items-center gap-2 px-3 py-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/30">
                              <input type="text" aria-label={`Recommended textbook ${idx + 1} title`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="Book title" value={tb.name} onChange={(e) => { const updated = [...syllabusData.recommended_textbooks]; updated[idx].name = e.target.value; setSyllabusData({ ...syllabusData, recommended_textbooks: updated }); }} />
                              <input type="text" aria-label={`Recommended textbook ${idx + 1} author`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="Author" value={tb.author} onChange={(e) => { const updated = [...syllabusData.recommended_textbooks]; updated[idx].author = e.target.value; setSyllabusData({ ...syllabusData, recommended_textbooks: updated }); }} />
                              <input type="text" aria-label={`Recommended textbook ${idx + 1} publisher`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="Publisher" value={tb.publisher} onChange={(e) => { const updated = [...syllabusData.recommended_textbooks]; updated[idx].publisher = e.target.value; setSyllabusData({ ...syllabusData, recommended_textbooks: updated }); }} />
                              <input type="text" aria-label={`Recommended textbook ${idx + 1} year`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="Year" value={tb.year} onChange={(e) => { const updated = [...syllabusData.recommended_textbooks]; updated[idx].year = e.target.value; setSyllabusData({ ...syllabusData, recommended_textbooks: updated }); }} />
                              <input type="text" aria-label={`Recommended textbook ${idx + 1} edition`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="Edition" value={tb.edition} onChange={(e) => { const updated = [...syllabusData.recommended_textbooks]; updated[idx].edition = e.target.value; setSyllabusData({ ...syllabusData, recommended_textbooks: updated }); }} />
                              {syllabusData.recommended_textbooks.length > 1 ? (
                                <button type="button" onClick={() => removeBookRow('recommended', tb.id)} className="p-1 text-slate-400 hover:text-rose-600 transition-colors" title="Delete Textbook">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              ) : <span />}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 8: Reference Books */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Reference books
                      </h5>
                      <button
                        type="button"
                        onClick={() => addBookRow('reference')}
                        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Reference Book
                      </button>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      <div className="min-w-[760px]">
                        <div className="grid grid-cols-[minmax(16rem,1.3fr)_minmax(11rem,0.9fr)_minmax(10rem,0.8fr)_5rem_5rem_2.5rem] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-400">
                          <span>Book title</span>
                          <span>Author</span>
                          <span>Publisher</span>
                          <span>Year</span>
                          <span>Edition</span>
                          <span className="sr-only">Delete</span>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                          {syllabusData.reference_books.map((rb, idx) => (
                            <div key={rb.id} className="grid grid-cols-[minmax(16rem,1.3fr)_minmax(11rem,0.9fr)_minmax(10rem,0.8fr)_5rem_5rem_2.5rem] items-center gap-2 px-3 py-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/30">
                              <input type="text" aria-label={`Reference book ${idx + 1} title`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="Book title" value={rb.name} onChange={(e) => { const updated = [...syllabusData.reference_books]; updated[idx].name = e.target.value; setSyllabusData({ ...syllabusData, reference_books: updated }); }} />
                              <input type="text" aria-label={`Reference book ${idx + 1} author`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="Author" value={rb.author} onChange={(e) => { const updated = [...syllabusData.reference_books]; updated[idx].author = e.target.value; setSyllabusData({ ...syllabusData, reference_books: updated }); }} />
                              <input type="text" aria-label={`Reference book ${idx + 1} publisher`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="Publisher" value={rb.publisher} onChange={(e) => { const updated = [...syllabusData.reference_books]; updated[idx].publisher = e.target.value; setSyllabusData({ ...syllabusData, reference_books: updated }); }} />
                              <input type="text" aria-label={`Reference book ${idx + 1} year`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="Year" value={rb.year} onChange={(e) => { const updated = [...syllabusData.reference_books]; updated[idx].year = e.target.value; setSyllabusData({ ...syllabusData, reference_books: updated }); }} />
                              <input type="text" aria-label={`Reference book ${idx + 1} edition`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="Edition" value={rb.edition} onChange={(e) => { const updated = [...syllabusData.reference_books]; updated[idx].edition = e.target.value; setSyllabusData({ ...syllabusData, reference_books: updated }); }} />
                              {syllabusData.reference_books.length > 1 ? (
                                <button type="button" onClick={() => removeBookRow('reference', rb.id)} className="p-1 text-slate-400 hover:text-rose-600 transition-colors" title="Delete Reference Book">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              ) : <span />}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => closeModal()}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>

                  {/* Export Options */}
                  <button
                    type="button"
                    disabled={exportingFmt !== null}
                    onClick={() => handleDownloadExport('docx')}
                    className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20"
                    title="Download Syllabus in Word (.docx) Format"
                  >
                    <Download className="h-4 w-4 text-blue-500" />
                    <span>{exportingFmt === 'docx' ? 'Generating Word...' : 'Export Word (.docx)'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={exportingFmt !== null}
                    onClick={() => handleDownloadExport('pdf')}
                    className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20"
                    title="Download Syllabus in PDF (.pdf) Format"
                  >
                    <FileText className="h-4 w-4 text-rose-500" />
                    <span>{exportingFmt === 'pdf' ? 'Generating PDF...' : 'Export PDF (.pdf)'}</span>
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={updateSubjectMutation.isPending}
                  className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition-colors hover:bg-indigo-700 disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="h-6 w-6 text-cyan-500" /> Session Plan Management
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {selectedSubject.name} ({selectedSubject.code}) — Upload, View in Tool & Download Session Plan
                </p>
              </div>
              <button onClick={() => closeModal()} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Session Plan Document Upload & View Controls */}
            {(() => {
              let spMeta: any = null;
              if (selectedSubject.session_plan && selectedSubject.session_plan.startsWith('{')) {
                try {
                  spMeta = JSON.parse(selectedSubject.session_plan);
                } catch (e) {}
              }

              return (
                <div className="space-y-4">
                  {/* Upload Section */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-500/10 via-blue-500/5 to-purple-500/10 border border-cyan-200 dark:border-cyan-800/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-cyan-600 text-white flex items-center justify-center shadow-md shadow-cyan-500/20">
                        <Upload className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          Upload Session Plan Document
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Upload Word (.docx), PDF (.pdf), Excel (.xlsx), or Text files for in-app viewing & download
                        </p>
                      </div>
                    </div>

                    <label className="cursor-pointer flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs transition-all shadow-md shadow-cyan-500/20">
                      {isUploadingSessionPlan ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" /> Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" /> Choose Session Plan File
                        </>
                      )}
                      <input
                        type="file"
                        accept=".docx,.doc,.pdf,.xlsx,.xls,.txt"
                        className="hidden"
                        onChange={handleUploadSessionPlanFile}
                        disabled={isUploadingSessionPlan}
                      />
                    </label>
                  </div>

                  {/* Attached Document Card (if file exists) */}
                  {spMeta && spMeta.file_name && (
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-xs uppercase border border-indigo-200 dark:border-indigo-800">
                          {spMeta.file_type || 'DOC'}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            {spMeta.file_name}
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              Uploaded Document
                            </span>
                          </div>
                          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                            {spMeta.file_size ? `${(spMeta.file_size / 1024).toFixed(1)} KB` : ''} • Uploaded{' '}
                            {spMeta.uploaded_at ? new Date(spMeta.uploaded_at).toLocaleDateString() : 'Recently'}
                          </div>
                        </div>
                      </div>

                      {/* View & Download Action Buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleOpenSessionPlanPreview}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold transition-colors"
                          title="View Session Plan inside tool"
                        >
                          <Eye className="h-3.5 w-3.5" /> View in Tool
                        </button>

                        <button
                          type="button"
                          onClick={handleDownloadSessionPlanFile}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold transition-colors"
                          title="Download session plan file"
                        >
                          <Download className="h-3.5 w-3.5" /> Download
                        </button>

                        <button
                          type="button"
                          onClick={handleDeleteSessionPlanFile}
                          className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                          title="Remove uploaded session plan"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="flex items-center justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => closeModal()}
                className="px-6 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 transition-colors"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IN-APP SESSION PLAN DOCUMENT PREVIEW MODAL */}
      {isSessionPlanPreviewOpen && selectedSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-5xl w-full p-6 space-y-4 shadow-2xl max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                  <Eye className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    Session Plan Document Viewer
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      {selectedSubject.code}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedSubject.name} — In-App Document Preview
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadSessionPlanFile}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-md shadow-emerald-500/20"
                >
                  <Download className="h-4 w-4" /> Download Original File
                </button>
                <button
                  onClick={handleCloseSessionPlanPreview}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Document Viewer Body */}
            <div className="flex-1 overflow-y-auto p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 min-h-[450px]">
              {(() => {
                let spMeta: any = null;
                if (selectedSubject.session_plan && selectedSubject.session_plan.startsWith('{')) {
                  try {
                    spMeta = JSON.parse(selectedSubject.session_plan);
                  } catch (e) {}
                }

                if (isPreviewLoading) {
                  return (
                    <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
                      <RefreshCw className="h-8 w-8 animate-spin text-indigo-500 mb-3" />
                      <p className="text-xs font-bold">Loading Session Plan Document...</p>
                    </div>
                  );
                }

                if (previewBlobUrl) {
                  return (
                    <iframe
                      src={previewBlobUrl}
                      className="w-full h-[580px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white"
                      title="Session Plan Viewer"
                    />
                  );
                }

                if (spMeta && spMeta.extracted_text) {
                  return (
                    <div className="space-y-4">
                      <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center justify-between">
                        <span>Extracted Document Content ({spMeta.file_name})</span>
                        <span className="text-[11px] font-medium text-slate-500">
                          {spMeta.extracted_text.length} characters
                        </span>
                      </div>
                      <div className="whitespace-pre-wrap font-sans text-xs text-slate-800 dark:text-slate-200 leading-relaxed p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                        {spMeta.extracted_text}
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="whitespace-pre-wrap font-mono text-xs text-slate-800 dark:text-slate-200 leading-relaxed p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                    No uploaded session plan document available to preview.
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* SEPARATE DEDICATED WINDOW 3: HyperBuild AI Activities Manager & Controlled Release System */}
      {modalType === 'hyperbuildModal' && selectedSubject && (
        <HyperbuildActivitiesModal
          subject={selectedSubject}
          onClose={closeModal}
        />
      )}

      {/* CASE LIBRARY SELECTOR MODAL */}
      {isBankPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-3xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
                  <Briefcase className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Select from Case Library
                  </h3>
                  <p className="text-xs text-slate-500">
                    Search and pick pre-approved Harvard, Ivey, Stanford, or In-House business case studies.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBankPickerOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search repository by case title, author, concept, or domain..."
                  value={bankSearchTerm}
                  onChange={(e) => setBankSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                />
              </div>
            </div>

            {/* Case Studies List */}
            <div className="p-6 overflow-y-auto space-y-3 flex-1 bg-slate-50/30 dark:bg-slate-950/20">
              {bankCaseStudies.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <Briefcase className="h-8 w-8 mx-auto mb-2 text-indigo-400 opacity-60" />
                  <p className="text-xs font-bold">No matching business case studies found in library</p>
                </div>
              ) : (
                bankCaseStudies.map((cs: any) => (
                  <div
                    key={cs.id}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {cs.publisher_source && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            {cs.publisher_source}
                          </span>
                        )}
                        {cs.industry_domain && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                            {cs.industry_domain}
                          </span>
                        )}
                        {cs.product_number && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            #{cs.product_number}
                          </span>
                        )}
                      </div>

                      <h4 className="text-xs font-black text-slate-900 dark:text-white leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {cs.title}
                      </h4>

                      {cs.author && (
                        <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                          By: {cs.author}
                        </div>
                      )}

                      <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {cs.concept}
                      </p>

                      <div className="flex items-center gap-3 text-[10px] text-slate-400 font-medium pt-0.5 flex-wrap">
                        {cs.page_length && <span>{cs.page_length}</span>}
                        {cs.duration && <span>• {cs.duration}</span>}
                        {cs.file_name && (
                          <span className="flex items-center gap-1">
                            <Paperclip className="h-3 w-3 text-indigo-500 shrink-0" />
                            {cs.file_name} ({Math.round((cs.file_size || 0) / 1024)} KB)
                          </span>
                        )}
                        <a
                          href={`/case-studies/${cs.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline ml-auto"
                        >
                          View Full Case Note ↗
                        </a>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => attachCaseStudyFromBank(cs)}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-sm shadow-indigo-500/20 transition-all shrink-0 w-full sm:w-auto flex items-center justify-center gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" /> Attach to Syllabus
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end">
              <button
                type="button"
                onClick={() => setIsBankPickerOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SEPARATE DEDICATED WINDOW 3: Session Completion Report Modal */}
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
              <button onClick={() => closeModal()} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
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
                    <p className="text-xl font-bold text-emerald-600 dark:emerald-400 mt-0.5">{reportData.total_sessions_completed} / {reportData.total_sessions_scheduled}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                    <p className="text-[11px] text-slate-400 uppercase font-semibold">Completion %</p>
                    <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">{reportData.completion_percentage}%</p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => closeModal()}
                className="px-6 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 transition-colors"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
