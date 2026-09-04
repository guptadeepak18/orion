import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  ArrowLeft,
  Download,
  ExternalLink,
  Pencil,
  Paperclip,
  RefreshCw,
  Info,
  BookOpen,
  X,
  Upload,
  Building2,
  FileText,
  Tag,
  Copy,
  Check,
  Calendar,
  Clock,
  CheckCircle2,
  GraduationCap,
  Sparkles,
  FileCheck,
  BrainCircuit,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useRoleAccess } from '../../lib/useRoleAccess';
import { getCaseStudyUrl } from './CaseStudyBankPage';
import { AICaseAnalyzer } from './AICaseAnalyzer';
import { AICaseNoteViewer } from './AICaseNoteViewer';

export interface CaseStudyDetail {
  id: string;
  title: string;
  author?: string;
  concept?: string;
  learning_objectives?: string;
  publisher_source?: string;
  industry_domain?: string;
  subject_tags?: string;
  product_number?: string;
  publication_date?: string;
  revision_date?: string;
  page_length?: string;
  duration?: string;
  accessibility_status?: string;
  external_link?: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  file_type?: string;
  is_active: boolean;
  uploaded_by?: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
  };
  created_at: string;
  updated_at: string;
}

// Parse paragraphs faithfully preserving exact text without mangling numbers, decimals or abbreviations
const parseParagraphs = (rawText: string): string[] => {
  if (!rawText || !rawText.trim()) return [];
  if (rawText.includes('\n')) {
    return rawText
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
  }
  return [rawText.trim()];
};

// Smart parser for Learning Objectives (supports bullet list form or paragraph prose form)
const parseLearningObjectives = (rawText: string): { isList: boolean; items: string[] } => {
  if (!rawText || !rawText.trim()) return { isList: false, items: [] };

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return { isList: false, items: [] };

  // Check if lines are formatted as numbered or bullet list items
  const hasNumberedPrefix = lines.some((line) =>
    /^(\d+[\.\)\-:]|\•|\-|\*|\([0-9a-zA-Z]\))\s+/.test(line)
  );

  if (hasNumberedPrefix || (lines.length > 1 && lines.every((l) => l.length < 300))) {
    const cleanedItems = lines
      .map((line) => line.replace(/^(\d+[\.\)\-:]|\•|\-|\*|\([0-9a-zA-Z]\))\s*/, '').trim())
      .filter(Boolean);

    return { isList: true, items: cleanedItems };
  }

  const paragraphs = rawText.includes('\n\n')
    ? rawText.split(/\n\n+/).map((p) => p.trim()).filter(Boolean)
    : [rawText.trim()];

  return { isList: false, items: paragraphs };
};

interface FileFormatConfig {
  type: string;
  name: string;
  badgeLabel: string;
  iconBg: string;
  textColor: string;
  borderColor: string;
  containerBg: string;
  buttonGradient: string;
  pillBg: string;
  buttonLabel: string;
}

const getFileFormatConfig = (fileType?: string, fileName?: string): FileFormatConfig => {
  const ext = (fileType || (fileName ? fileName.split('.').pop() : ''))?.toLowerCase().trim() || 'pdf';

  if (ext.includes('pdf')) {
    return {
      type: 'PDF',
      name: 'Adobe Acrobat PDF Document',
      badgeLabel: 'PDF DOCUMENT',
      iconBg: 'bg-gradient-to-br from-rose-500 via-rose-600 to-red-600 text-white shadow-rose-500/25',
      textColor: 'text-rose-600 dark:text-rose-400',
      borderColor: 'border-rose-200 dark:border-rose-900/60',
      containerBg: 'bg-rose-50/40 dark:bg-rose-950/20',
      buttonGradient: 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white shadow-md shadow-rose-500/25',
      pillBg: 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
      buttonLabel: 'Download PDF',
    };
  }

  if (ext.includes('doc')) {
    return {
      type: 'DOCX',
      name: 'Microsoft Word Document',
      badgeLabel: 'WORD DOCUMENT',
      iconBg: 'bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 text-white shadow-blue-500/25',
      textColor: 'text-blue-600 dark:text-blue-400',
      borderColor: 'border-blue-200 dark:border-blue-900/60',
      containerBg: 'bg-blue-50/40 dark:bg-blue-950/20',
      buttonGradient: 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-500/25',
      pillBg: 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      buttonLabel: 'Download Word DOCX',
    };
  }

  if (ext.includes('ppt')) {
    return {
      type: 'PPTX',
      name: 'PowerPoint Presentation Deck',
      badgeLabel: 'PRESENTATION DECK',
      iconBg: 'bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 text-white shadow-amber-500/25',
      textColor: 'text-amber-600 dark:text-amber-400',
      borderColor: 'border-amber-200 dark:border-amber-900/60',
      containerBg: 'bg-amber-50/40 dark:bg-amber-950/20',
      buttonGradient: 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-amber-500/25',
      pillBg: 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      buttonLabel: 'Download Presentation',
    };
  }

  if (ext.includes('xls') || ext.includes('csv')) {
    return {
      type: 'XLSX',
      name: 'Excel Financial Model & Spreadsheet',
      badgeLabel: 'SPREADSHEET DATA',
      iconBg: 'bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 text-white shadow-emerald-500/25',
      textColor: 'text-emerald-600 dark:text-emerald-400',
      borderColor: 'border-emerald-200 dark:border-emerald-900/60',
      containerBg: 'bg-emerald-50/40 dark:bg-emerald-950/20',
      buttonGradient: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md shadow-emerald-500/25',
      pillBg: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      buttonLabel: 'Download Spreadsheet',
    };
  }

  return {
    type: ext.toUpperCase() || 'FILE',
    name: 'Prescribed Course Resource',
    badgeLabel: `${ext.toUpperCase()} RESOURCE`,
    iconBg: 'bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 text-white shadow-indigo-500/25',
    textColor: 'text-indigo-600 dark:text-indigo-400',
    borderColor: 'border-indigo-200 dark:border-indigo-900/60',
    containerBg: 'bg-indigo-50/40 dark:bg-indigo-950/20',
    buttonGradient: 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md shadow-indigo-500/25',
    pillBg: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    buttonLabel: `Download ${ext.toUpperCase()}`,
  };
};

export const CaseStudyDetailPage: React.FC = () => {
  const { caseStudyId } = useParams<{ caseStudyId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, isCoordinator, isFacultyInternal, isFacultyExternal } = useRoleAccess();
  const isFacultyOrAdmin = isAdmin || isCoordinator || isFacultyInternal || isFacultyExternal;

  // Copy feedback state
  const [copiedProductNo, setCopiedProductNo] = useState(false);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formAuthor, setFormAuthor] = useState('');
  const [formConcept, setFormConcept] = useState('');
  const [formObjectives, setFormObjectives] = useState('');
  const [formSource, setFormSource] = useState('');
  const [formDomain, setFormDomain] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formProductNo, setFormProductNo] = useState('');
  const [formPubDate, setFormPubDate] = useState('');
  const [formRevDate, setFormRevDate] = useState('');
  const [formLength, setFormLength] = useState('');
  const [formDuration, setFormDuration] = useState('');
  const [formAccessibility, setFormAccessibility] = useState('ACCESSIBLE');
  const [formLink, setFormLink] = useState('');
  const [formFileUrl, setFormFileUrl] = useState('');
  const [formFileName, setFormFileName] = useState('');
  const [formFileSize, setFormFileSize] = useState<number | undefined>();
  const [formFileType, setFormFileType] = useState<string | undefined>();
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();

  const initialTabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'brief' | 'ai_analyzer' | 'ai_case_note'>(
    initialTabParam === 'ai_case_note' && isFacultyOrAdmin
      ? 'ai_case_note'
      : initialTabParam === 'ai_analyzer'
      ? 'ai_analyzer'
      : 'brief'
  );

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'ai_case_note' && activeTab !== 'ai_case_note') {
      if (isFacultyOrAdmin) {
        setActiveTab('ai_case_note');
      } else {
        switchTab('brief');
      }
    } else if (tabParam === 'ai_analyzer' && activeTab !== 'ai_analyzer') {
      setActiveTab('ai_analyzer');
    } else if (!tabParam && activeTab !== 'brief') {
      setActiveTab('brief');
    }
  }, [searchParams, isFacultyOrAdmin]);

  const switchTab = (newTab: 'brief' | 'ai_analyzer' | 'ai_case_note') => {
    if (newTab === 'ai_case_note' && !isFacultyOrAdmin) {
      return;
    }
    setActiveTab(newTab);
    const next = new URLSearchParams(searchParams);
    if (newTab === 'ai_case_note') {
      next.set('tab', 'ai_case_note');
    } else if (newTab === 'ai_analyzer') {
      next.set('tab', 'ai_analyzer');
    } else {
      next.delete('tab');
    }
    setSearchParams(next);
  };

  const updateUrlModal = (m: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (!m) {
      next.delete('modal');
    } else {
      next.set('modal', m);
    }
    setSearchParams(next);
  };

  // Fetch Case Study (Supports lookup by Product # or UUID)
  const { data: caseStudy, isLoading, isError } = useQuery<CaseStudyDetail>({
    queryKey: ['case-study-detail', caseStudyId],
    queryFn: async () => {
      const res = await api.get(`/case-studies/${encodeURIComponent(caseStudyId || '')}`);
      return res.data.data;
    },
    enabled: !!caseStudyId,
  });

  const closeEditModal = (syncUrl = true) => {
    setIsEditModalOpen(false);
    setErrorMsg(null);
    if (syncUrl) updateUrlModal(null);
  };

  // Edit Mutation
  const editMutation = useMutation({
    mutationFn: async () => {
      if (!caseStudy) throw new Error('No case study loaded');
      if (!formTitle.trim()) throw new Error('Case study title is required');

      const payload = {
        title: formTitle.trim(),
        author: formAuthor.trim() || null,
        concept: formConcept.trim() || null,
        learning_objectives: formObjectives.trim() || null,
        publisher_source: formSource.trim() || null,
        industry_domain: formDomain.trim() || null,
        subject_tags: formTags.trim() || null,
        product_number: formProductNo.trim() || null,
        publication_date: formPubDate.trim() || null,
        revision_date: formRevDate.trim() || null,
        page_length: formLength.trim() || null,
        duration: formDuration.trim() || null,
        accessibility_status: formAccessibility.trim() || null,
        external_link: formLink.trim() || null,
        file_url: formFileUrl || null,
        file_name: formFileName || null,
        file_size: formFileSize || null,
        file_type: formFileType || null,
      };

      const res = await api.put(`/case-studies/${caseStudy.id}`, payload);
      return res.data.data;
    },
    onSuccess: (updatedData: CaseStudyDetail) => {
      queryClient.invalidateQueries({ queryKey: ['case-study-detail'] });
      queryClient.invalidateQueries({ queryKey: ['case-studies'] });
      closeEditModal();

      const canonicalUrl = getCaseStudyUrl(updatedData);
      if (window.location.pathname !== canonicalUrl) {
        navigate(canonicalUrl, { replace: true });
      }
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.detail || err?.message || 'Failed to update case study');
    },
  });

  const openEditModal = (syncUrl = true) => {
    if (!caseStudy) return;
    setFormTitle(caseStudy.title || '');
    setFormAuthor(caseStudy.author || '');
    setFormConcept(caseStudy.concept || '');
    setFormObjectives(caseStudy.learning_objectives || '');
    setFormSource(caseStudy.publisher_source || '');
    setFormDomain(caseStudy.industry_domain || '');
    setFormTags(caseStudy.subject_tags || '');
    setFormProductNo(caseStudy.product_number || '');
    setFormPubDate(caseStudy.publication_date || '');
    setFormRevDate(caseStudy.revision_date || '');
    setFormLength(caseStudy.page_length || '');
    setFormDuration(caseStudy.duration || '');
    setFormAccessibility(caseStudy.accessibility_status || '');
    setFormLink(caseStudy.external_link || '');
    setFormFileUrl(caseStudy.file_url || '');
    setFormFileName(caseStudy.file_name || '');
    setFormFileSize(caseStudy.file_size);
    setFormFileType(caseStudy.file_type);
    setErrorMsg(null);
    setIsEditModalOpen(true);
    if (syncUrl) updateUrlModal('editCaseStudy');
  };

  const urlModal = searchParams.get('modal');

  useEffect(() => {
    if (!urlModal) {
      if (isEditModalOpen) closeEditModal(false);
      return;
    }

    if (urlModal === 'editCaseStudy' && !isEditModalOpen && caseStudy) {
      openEditModal(false);
    }
  }, [urlModal, caseStudy]);

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setErrorMsg(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/case-studies/upload-file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { file_url, file_name, file_size, file_type } = res.data.data;
      setFormFileUrl(file_url);
      setFormFileName(file_name);
      setFormFileSize(file_size);
      setFormFileType(file_type);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || err?.message || 'Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async () => {
    if (!caseStudy?.file_url) return;
    try {
      const downloadUrl = caseStudy.file_url.startsWith('http')
        ? caseStudy.file_url
        : `${caseStudy.file_url}?original_name=${encodeURIComponent(caseStudy.file_name || `${caseStudy.title}.pdf`)}`;
      const res = await api.get(downloadUrl, { responseType: 'blob' });
      const mimeType = caseStudy.file_type === 'pdf' ? 'application/pdf' : 'application/octet-stream';
      const blob = new Blob([res.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = caseStudy.file_name || `${caseStudy.title.replace(/[^a-zA-Z0-9_\-]/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Failed to download document: ' + (err?.response?.data?.detail || err?.message || 'Error'));
    }
  };

  const copyProductNumber = () => {
    if (!caseStudy?.product_number) return;
    navigator.clipboard.writeText(caseStudy.product_number);
    setCopiedProductNo(true);
    setTimeout(() => setCopiedProductNo(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="p-24 text-center text-slate-500">
        <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-indigo-500" />
        <p className="text-xs font-bold">Loading Business Case Study Details...</p>
      </div>
    );
  }

  if (isError || !caseStudy) {
    return (
      <div className="p-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg mx-auto my-12 bg-white dark:bg-slate-900">
        <Briefcase className="h-10 w-10 text-indigo-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Business Case Study Not Found</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          The requested case study could not be loaded from the institutional repository.
        </p>
        <button
          onClick={() => navigate('/case-studies')}
          className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
        >
          Back to Case Library
        </button>
      </div>
    );
  }

  // Parse subject tags
  const tagsList = caseStudy.subject_tags
    ? caseStudy.subject_tags.split(/[,;\n]/).map((t) => t.trim()).filter(Boolean)
    : [];

  const overviewParagraphs = parseParagraphs(caseStudy.concept || '');
  const learningObj = parseLearningObjectives(caseStudy.learning_objectives || '');

  return (
    <div className="space-y-6 animate-fadeIn pb-24 max-w-7xl mx-auto">
      {/* Top Header & Breadcrumb Bar (Clean Light Background) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            to="/case-studies"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Case Library
          </Link>
          <span className="text-slate-300 dark:text-slate-700 font-medium">/</span>
          <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
            {caseStudy.product_number || 'CASE NOTE'}
          </span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {caseStudy.file_url && (() => {
            const formatConfig = getFileFormatConfig(caseStudy.file_type, caseStudy.file_name);
            return (
              <button
                onClick={handleDownload}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl ${formatConfig.buttonGradient} text-xs font-bold transition-all hover:scale-105 cursor-pointer`}
              >
                <Download className="h-3.5 w-3.5" /> {formatConfig.buttonLabel}
              </button>
            );
          })()}

          {caseStudy.external_link && (
            <a
              href={caseStudy.external_link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Publisher Link
            </a>
          )}

          {/* AI Case Analyzer Mode Trigger */}
          <button
            onClick={() => switchTab(activeTab === 'ai_analyzer' ? 'brief' : 'ai_analyzer')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'ai_analyzer'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100'
            }`}
          >
            <BrainCircuit className="h-3.5 w-3.5" />
            <span>{activeTab === 'ai_analyzer' ? 'View Case Brief' : 'AI Case Analyzer'}</span>
          </button>

          {isFacultyOrAdmin && (
            <button
              onClick={() => openEditModal()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit Details
            </button>
          )}
        </div>
      </div>

      {/* Main Title & Hero Banner (Crisp Light Theme Background) */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        {/* Pills & Badges Row */}
        <div className="flex flex-wrap items-center gap-2">
          {caseStudy.publisher_source && (
            <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" /> {caseStudy.publisher_source}
            </span>
          )}
          {caseStudy.industry_domain && (
            <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5">
              <GraduationCap className="h-3.5 w-3.5" /> {caseStudy.industry_domain}
            </span>
          )}
          {caseStudy.product_number && (
            <button
              onClick={copyProductNumber}
              className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Click to copy Product #"
            >
              {copiedProductNo ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-slate-400" />}
              {caseStudy.product_number}
            </button>
          )}
          {caseStudy.accessibility_status && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> {caseStudy.accessibility_status}
            </span>
          )}
        </div>

        {/* Case Title */}
        <h1 className="text-2xl md:text-3xl lg:text-[32px] font-black tracking-tight text-slate-900 dark:text-white leading-tight">
          {caseStudy.title}
        </h1>

        {/* Author Byline */}
        {caseStudy.author && (
          <div className="text-sm font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 pt-0.5">
            <span className="text-slate-400">Authored by:</span>
            <span className="font-bold text-slate-900 dark:text-white underline decoration-indigo-300 underline-offset-4">
              {caseStudy.author}
            </span>
          </div>
        )}
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 overflow-x-auto no-scrollbar scroll-smooth">
        <button
          onClick={() => switchTab('brief')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'brief'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Case Brief & Specifications</span>
        </button>

        <button
          onClick={() => switchTab('ai_analyzer')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'ai_analyzer'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <BrainCircuit className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <span className="flex items-center gap-1.5">
            AI Case Analyzer
            <span className="px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-black">
              Outcome
            </span>
          </span>
        </button>

        {isFacultyOrAdmin && (
          <button
            onClick={() => switchTab('ai_case_note')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'ai_case_note'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span className="flex items-center gap-1.5">
              AI Case Note (Teaching Note)
              <span className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-[10px] font-black">
                BETA
              </span>
            </span>
          </button>
        )}
      </div>

      {/* Main Workspace Display based on activeTab */}
      {activeTab === 'ai_case_note' && isFacultyOrAdmin ? (
        <AICaseNoteViewer
          caseStudyId={caseStudy.id}
          caseTitle={caseStudy.title}
          domain={caseStudy.industry_domain}
          author={caseStudy.author}
          productNumber={caseStudy.product_number}
        />
      ) : activeTab === 'ai_analyzer' ? (
        <AICaseAnalyzer
          caseStudyId={caseStudy.id}
          caseTitle={caseStudy.title}
          domain={caseStudy.industry_domain}
        />
      ) : (
        /* 2-Column Responsive Layout: Overview & Content (Left) & Expanded Details Hub (Right) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (7.5 Columns): Redesigned Overview & Objectives */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
            {/* Overview & Executive Synopsis */}
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 md:p-8 space-y-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">
                    Overview & Executive Synopsis
                  </h2>
                  <p className="text-xs text-slate-400">Prescribed case context, business background, and strategic dilemma</p>
                </div>
              </div>

              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-slate-400">
                <Sparkles className="h-3.5 w-3.5 text-indigo-500" /> Prescribed Case Brief
              </span>
            </div>

            {overviewParagraphs.length > 0 ? (
              <div className="space-y-4 text-xs md:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-normal">
                {overviewParagraphs.map((para, idx) => (
                  <p key={idx} className="text-justify leading-relaxed">
                    {para}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No overview synopsis note provided for this case study.</p>
            )}
          </div>

          {/* Learning Objectives & Discussion Framework */}
          {learningObj.items.length > 0 && (
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 md:p-8 space-y-5 shadow-sm">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">
                    Learning Objectives & Discussion Framework
                  </h2>
                  <p className="text-xs text-slate-400">Pedagogical modules, analytical tools, and core student discussion outcomes</p>
                </div>
              </div>

              {learningObj.isList ? (
                <ul className="space-y-3 pt-1 text-xs md:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-normal">
                  {learningObj.items.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 font-bold text-xs border border-purple-200/80 dark:border-purple-800/80 mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="pt-0.5 leading-relaxed text-justify flex-1">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="space-y-4 pt-1 text-xs md:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-normal">
                  {learningObj.items.map((para, idx) => (
                    <p key={idx} className="text-justify leading-relaxed">
                      {para}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Fancy Prescribed Course Document Card */}
          {caseStudy.file_url && (() => {
            const formatConfig = getFileFormatConfig(caseStudy.file_type, caseStudy.file_name);
            return (
              <div className={`rounded-3xl border ${formatConfig.borderColor} ${formatConfig.containerBg} p-5 md:p-6 shadow-sm transition-all hover:shadow-md relative overflow-hidden`}>
                {/* Ambient Decorative Corner Glow */}
                <div className="absolute top-0 right-0 w-36 h-36 bg-white/50 dark:bg-white/5 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />

                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative z-10">
                  {/* Left: 3D Format Badge & Document Metadata */}
                  <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
                    {/* Fancy 3D Format Tile */}
                    <div className={`h-14 w-14 rounded-2xl ${formatConfig.iconBg} flex flex-col items-center justify-center font-black shadow-lg shrink-0 transform transition-transform group-hover:scale-105`}>
                      <div className="text-[10px] uppercase tracking-wider font-extrabold opacity-95">
                        {formatConfig.type}
                      </div>
                      <FileText className="h-4 w-4 mt-0.5 opacity-90" />
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider border ${formatConfig.pillBg} flex items-center gap-1`}>
                          <FileCheck className="h-3 w-3" /> {formatConfig.badgeLabel}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                          {caseStudy.file_size ? `${Math.round(caseStudy.file_size / 1024)} KB` : 'Prescribed Asset'}
                        </span>
                      </div>

                      <h4 className="text-sm md:text-base font-black text-slate-900 dark:text-white truncate">
                        {caseStudy.file_name || `${caseStudy.title}.${formatConfig.type.toLowerCase()}`}
                      </h4>

                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {formatConfig.name} • Prescribed for Class Discussion & LMS
                      </p>
                    </div>
                  </div>

                  {/* Right: Fancy Format Action Button */}
                  <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
                    <button
                      onClick={handleDownload}
                      className={`w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl ${formatConfig.buttonGradient} text-xs font-black transition-all hover:scale-105 active:scale-95 cursor-pointer`}
                    >
                      <Download className="h-4 w-4" />
                      <span>{formatConfig.buttonLabel}</span>
                      {caseStudy.file_size && (
                        <span className="opacity-80 font-normal text-[11px]">
                          ({Math.round(caseStudy.file_size / 1024)} KB)
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Right Column (4.5 Columns): Expanded & Rich Case Detail Hub */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-6 shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                  <Info className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  Case Specifications & Details
                </h3>
              </div>
            </div>

            {/* Structured Specifications Grid */}
            <div className="space-y-4">
              {/* Product Identifier */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Product #</div>
                  <div className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                    {caseStudy.product_number || 'Not Specified'}
                  </div>
                </div>
                {caseStudy.product_number && (
                  <button
                    onClick={copyProductNumber}
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-700 text-slate-500 hover:text-indigo-600 border border-slate-200 dark:border-slate-600 transition-colors"
                    title="Copy Product #"
                  >
                    {copiedProductNo ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>

              {/* Publication House & Discipline */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Building2 className="h-3 w-3 text-indigo-500" /> Source
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white leading-tight">
                    {caseStudy.publisher_source || '—'}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <GraduationCap className="h-3 w-3 text-indigo-500" /> Discipline
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white leading-tight">
                    {caseStudy.industry_domain || '—'}
                  </div>
                </div>
              </div>

              {/* Publication Timeline (Publication Date & Revision Date) */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-cyan-500" /> Published
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white">
                    {caseStudy.publication_date || '—'}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <RefreshCw className="h-3 w-3 text-amber-500" /> Revised
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white">
                    {caseStudy.revision_date || '—'}
                  </div>
                </div>
              </div>

              {/* Reading Scope & Duration */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <FileText className="h-3 w-3 text-indigo-500" /> Page Length
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white">
                    {caseStudy.page_length || '—'}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Clock className="h-3 w-3 text-purple-500" /> Duration
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white">
                    {caseStudy.duration || '—'}
                  </div>
                </div>
              </div>

              {/* Subject Taxonomy Classification */}
              {tagsList.length > 0 && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Tag className="h-3 w-3 text-indigo-500" /> Subject Classification
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tagsList.map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* EDIT MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Edit Business Case Study Details
              </h3>
              <button
                onClick={() => closeEditModal()}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-bold">
                  {errorMsg}
                </div>
              )}

              {/* Title (Only Mandatory Field) */}
              <div>
                <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Case Study Title *
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>

              {/* Author & Source */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Author / Creator
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Srikant M. Datar, Anjali Raina, Namrata Arora"
                    value={formAuthor}
                    onChange={(e) => setFormAuthor(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Source / Publisher
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Harvard Business School"
                    value={formSource}
                    onChange={(e) => setFormSource(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Overview */}
              <div>
                <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Overview / Synopsis Note
                </label>
                <textarea
                  rows={4}
                  value={formConcept}
                  onChange={(e) => setFormConcept(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:border-indigo-500 leading-relaxed"
                />
              </div>

              {/* Learning Objectives */}
              <div>
                <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Learning Objectives
                </label>
                <textarea
                  rows={4}
                  value={formObjectives}
                  onChange={(e) => setFormObjectives(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:border-indigo-500 leading-relaxed"
                />
              </div>

              {/* Discipline, Tags & Product # */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Discipline
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Accounting"
                    value={formDomain}
                    onChange={(e) => setFormDomain(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Subjects / Tags
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Accounting, Corporate Governance"
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Product #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 114049-PDF-ENG"
                    value={formProductNo}
                    onChange={(e) => setFormProductNo(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              {/* Publication Date, Revision Date, Length & Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Publication Date
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Jan 7, 2014"
                    value={formPubDate}
                    onChange={(e) => setFormPubDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Revision Date
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. May 6, 2014"
                    value={formRevDate}
                    onChange={(e) => setFormRevDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Length
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 18 page(s)"
                    value={formLength}
                    onChange={(e) => setFormLength(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Duration
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 38 minutes"
                    value={formDuration}
                    onChange={(e) => setFormDuration(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              {/* Document Upload */}
              <div>
                <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Attached Case Study Document
                </label>
                {formFileUrl ? (
                  <div className="flex items-center justify-between p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30">
                    <div className="flex items-center gap-2 min-w-0">
                      <Paperclip className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="font-bold text-slate-900 dark:text-white truncate">
                        {formFileName || 'Document Attached'}
                      </span>
                    </div>
                    <label className="cursor-pointer px-3 py-1 rounded-lg bg-white dark:bg-slate-800 font-bold text-indigo-600 border border-slate-200 dark:border-slate-700">
                      Replace
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
                        }}
                      />
                    </label>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                    <Upload className="h-4 w-4 text-slate-400" />
                    <span className="font-bold text-slate-600 dark:text-slate-400">
                      {isUploading ? 'Uploading...' : 'Upload File (PDF, Word, PPT, or Text)'}
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
                      }}
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button
                onClick={() => closeEditModal()}
                className="px-4 py-2 rounded-xl font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={() => editMutation.mutate()}
                disabled={editMutation.isPending}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-md shadow-indigo-500/20"
              >
                {editMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
