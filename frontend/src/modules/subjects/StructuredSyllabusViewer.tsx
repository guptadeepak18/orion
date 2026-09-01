import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  GraduationCap,
  Layers,
  Award,
  FileCheck,
  Bookmark,
  Download,
  ExternalLink,
  Clock,
  Pencil,
  ChevronDown,
  Briefcase,
  Laptop,
  Eye,
  Paperclip,
  CheckSquare,
  X,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../lib/api';
import { UnitContentFormatter } from './UnitContentFormatter';

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
  component?: string;
  name?: string;
  title?: string;
  details?: string;
  description?: string;
  deliverable?: string;
  marks?: number;
  max_marks?: number;
}

export interface BookItem {
  id: string;
  title?: string;
  name?: string;
  authors?: string;
  author?: string;
  publisher?: string;
  edition_year?: string;
  edition?: string;
  year?: string;
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

const SYLLABUS_NAV_SECTIONS = [
  { id: 'overview', label: 'Overview', icon: BookOpen, desc: 'Context & Programme Outcomes' },
  { id: 'outcomes', label: 'Course Outcomes', icon: Award, desc: 'CO-PO Mapping Matrix' },
  { id: 'units', label: 'Units & Topics', icon: Layers, desc: 'Teaching Units & Planned Hours' },
  { id: 'industry', label: 'Applied Learning', icon: FileCheck, desc: 'Cases, Assignments & Tools' },
  { id: 'assessment', label: 'Assessment Scheme', icon: GraduationCap, desc: 'CCE & TEE Marks Breakdown' },
  { id: 'books', label: 'Reading List', icon: Bookmark, desc: 'Textbooks & Reference Material' },
] as const;

interface StructuredSyllabusViewerProps {
  syllabusRaw?: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  isStudent?: boolean;
  onEditClick?: () => void;
}

export const StructuredSyllabusViewer: React.FC<StructuredSyllabusViewerProps> = ({
  syllabusRaw,
  subjectId,
  subjectName,
  subjectCode,
  isStudent = true,
  onEditClick,
}) => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [downloadingFormat, setDownloadingFormat] = useState<'docx' | 'pdf' | null>(null);
  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({
    'unit-0': true,
  });

  const toggleUnit = (key: string) => {
    setExpandedUnits((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const expandAllUnits = (topics: UnitTopicItem[]) => {
    const all: Record<string, boolean> = {};
    topics.forEach((t, i) => {
      all[t.id || `unit-${i}`] = true;
    });
    setExpandedUnits(all);
  };

  const collapseAllUnits = () => {
    setExpandedUnits({});
  };

  const [activePreviewCase, setActivePreviewCase] = useState<CaseStudyItem | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const handlePreviewCaseStudy = async (cs: CaseStudyItem) => {
    setActivePreviewCase(cs);
    setPreviewError(null);
    setPreviewBlobUrl(null);

    if (!cs.file_url) {
      if (cs.link) {
        window.open(cs.link, '_blank');
        setActivePreviewCase(null);
      } else {
        setPreviewError('No electronic document or web link attached for this case study.');
      }
      return;
    }

    setIsPreviewLoading(true);
    try {
      const url = cs.file_url.startsWith('http') ? cs.file_url : `${cs.file_url}?inline=true`;
      const res = await api.get(url, { responseType: 'blob' });
      const mimeType = cs.file_type === 'pdf' ? 'application/pdf' : 'application/octet-stream';
      const blob = new Blob([res.data], { type: mimeType });
      const objUrl = window.URL.createObjectURL(blob);
      setPreviewBlobUrl(objUrl);
    } catch (err: any) {
      setPreviewError(err?.response?.data?.detail || err?.message || 'Failed to load document for preview');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const closePreviewModal = () => {
    if (previewBlobUrl) {
      window.URL.revokeObjectURL(previewBlobUrl);
    }
    setPreviewBlobUrl(null);
    setActivePreviewCase(null);
    setPreviewError(null);
  };

  const handleDownloadCaseStudyDocument = async (cs: CaseStudyItem) => {
    if (!cs.file_url) return;
    try {
      const downloadUrl = cs.file_url.startsWith('http')
        ? cs.file_url
        : `${cs.file_url}?original_name=${encodeURIComponent(cs.file_name || `${cs.title}.pdf`)}`;

      const res = await api.get(downloadUrl, { responseType: 'blob' });
      const mimeType = cs.file_type === 'pdf' ? 'application/pdf' : 'application/octet-stream';
      const blob = new Blob([res.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = cs.file_name || `${cs.title.replace(/[^a-zA-Z0-9_\-]/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Failed to download case study document: ' + (err?.response?.data?.detail || err?.message || 'Download error'));
    }
  };

  // Parse structured syllabus JSON safely
  let syllabus: SyllabusData = {
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
  };

  let isStructuredJson = false;

  if (syllabusRaw) {
    try {
      if (syllabusRaw.trim().startsWith('{')) {
        const parsed = JSON.parse(syllabusRaw);
        syllabus = {
          course_overview: parsed.course_overview || '',
          course_outcomes: Array.isArray(parsed.course_outcomes) ? parsed.course_outcomes : [],
          topics: Array.isArray(parsed.topics) ? parsed.topics : [],
          case_studies: Array.isArray(parsed.case_studies) ? parsed.case_studies : [],
          live_assignments: Array.isArray(parsed.live_assignments) ? parsed.live_assignments : [],
          software_exposure: parsed.software_exposure || '',
          cce_marks: parsed.cce_marks !== undefined ? parsed.cce_marks : 50,
          tee_marks: parsed.tee_marks !== undefined ? parsed.tee_marks : 50,
          total_marks: parsed.total_marks !== undefined ? parsed.total_marks : 100,
          cce_components: Array.isArray(parsed.cce_components) ? parsed.cce_components : [],
          recommended_textbooks: Array.isArray(parsed.recommended_textbooks) ? parsed.recommended_textbooks : [],
          reference_books: Array.isArray(parsed.reference_books) ? parsed.reference_books : [],
        };
        isStructuredJson = true;
      } else {
        syllabus.course_overview = syllabusRaw;
      }
    } catch {
      syllabus.course_overview = syllabusRaw;
    }
  }

  const handleExport = async (format: 'docx' | 'pdf') => {
    try {
      setDownloadingFormat(format);
      const res = await api.get(`/academic/subjects/${subjectId}/syllabus/export?format=${format}`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], {
        type: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${subjectCode}_Syllabus.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export syllabus:', err);
      alert('Unable to export syllabus document. Please try again.');
    } finally {
      setDownloadingFormat(null);
    }
  };

  const getBloomBadgeColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'knowledge':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'understand':
        return 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800';
      case 'application':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'analysis':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'evaluation':
        return 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'create':
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      default:
        return 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  if (!syllabusRaw) {
    return (
      <div className="p-12 text-center text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
        <BookOpen className="h-8 w-8 mx-auto mb-2 text-slate-400" />
        <p className="text-xs font-semibold">No syllabus defined yet for this subject.</p>
      </div>
    );
  }

  // If plain text (not structured JSON)
  if (!isStructuredJson && syllabus.course_overview) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Course Syllabus</h4>
            <p className="text-xs text-slate-500">Official syllabus document for {subjectName}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport('docx')}
              disabled={downloadingFormat !== null}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm"
            >
              <Download className="h-3.5 w-3.5 text-indigo-500" />
              {downloadingFormat === 'docx' ? 'Downloading...' : 'Word (.docx)'}
            </button>
            <button
              onClick={() => handleExport('pdf')}
              disabled={downloadingFormat !== null}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm"
            >
              <Download className="h-3.5 w-3.5 text-rose-500" />
              {downloadingFormat === 'pdf' ? 'Downloading...' : 'PDF (.pdf)'}
            </button>
          </div>
        </div>
        <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
          {syllabus.course_overview}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Export Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 mb-1">
            <GraduationCap className="h-3 w-3" /> Accredited Syllabus
          </div>
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
            {subjectCode}: {subjectName}
          </h3>
          <p className="text-xs text-slate-500">
            Official 9-Section Course Curriculum & Learning Matrix
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!isStudent && onEditClick && (
            <button
              onClick={onEditClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-all"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit in Syllabus Builder
            </button>
          )}

          <button
            onClick={() => handleExport('docx')}
            disabled={downloadingFormat !== null}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-sm transition-all"
            title="Download Word format"
          >
            <Download className="h-3.5 w-3.5 text-indigo-500" />
            {downloadingFormat === 'docx' ? 'Exporting...' : 'Word (.docx)'}
          </button>

          <button
            onClick={() => handleExport('pdf')}
            disabled={downloadingFormat !== null}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-sm transition-all"
            title="Download PDF format"
          >
            <Download className="h-3.5 w-3.5 text-rose-500" />
            {downloadingFormat === 'pdf' ? 'Exporting...' : 'PDF (.pdf)'}
          </button>
        </div>
      </div>

      {/* Structured Sub-Tab Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
        {SYLLABUS_NAV_SECTIONS.map((sec) => {
          const isActive = activeTab === sec.id;
          const Icon = sec.icon;
          return (
            <button
              key={sec.id}
              onClick={() => setActiveTab(sec.id)}
              className={`flex items-center justify-center gap-2 py-3 px-3.5 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-900/40'
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 transition-colors ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`} />
              <span className="truncate whitespace-nowrap">{sec.label}</span>
            </button>
          );
        })}
      </div>

      {/* SECTION CONTENT PANELS */}

      {/* 1. OVERVIEW & PROGRAM OUTCOMES */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-indigo-500" /> 1. Course Overview
            </h4>
            <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
              {syllabus.course_overview || 'No course overview narrative specified.'}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-800/40 space-y-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <h4 className="text-xs font-bold text-indigo-950 dark:text-indigo-200 uppercase tracking-wider">
                9. Program Outcomes (PO Reference Matrix)
              </h4>
            </div>
            <div className="overflow-x-auto rounded-xl border border-indigo-200/60 dark:border-indigo-800/40 bg-white dark:bg-slate-900">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-indigo-50/80 dark:bg-indigo-950/60 border-b border-indigo-100 dark:border-indigo-800/40 text-indigo-900 dark:text-indigo-300 text-[11px]">
                    <th className="py-2.5 px-4 font-bold w-20">PO Code</th>
                    <th className="py-2.5 px-4 font-bold">Programme Outcome Definition</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {PROGRAM_OUTCOMES_REF.map((item) => (
                    <tr key={item.po} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                      <td className="py-2.5 px-4 font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                        {item.po}
                      </td>
                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300 font-medium">
                        {item.desc}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. COURSE OUTCOMES & PO MAPPING */}
      {activeTab === 'outcomes' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Award className="h-4 w-4 text-indigo-500" /> 2. Course Outcomes & PO Mapping Matrix
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Mapping of course learning objectives to Bloom's taxonomy & Programme Outcomes (1: Low, 2: Med, 3: High).
              </p>
            </div>
          </div>

          {syllabus.course_outcomes.length === 0 ? (
            <div className="p-8 text-center text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
              <Award className="h-6 w-6 mx-auto mb-1 text-slate-400" />
              <p className="text-xs">No course outcomes listed yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
              <table className="w-full text-xs text-left min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                    <th className="py-3 px-3 w-14 text-center">CO #</th>
                    <th className="py-3 px-4 min-w-[280px]">Course Outcome Statement</th>
                    <th className="py-3 px-3 w-32">Bloom's Level</th>
                    <th className="py-3 px-2 w-14 text-center text-indigo-600 dark:text-indigo-400">PO 1</th>
                    <th className="py-3 px-2 w-14 text-center text-indigo-600 dark:text-indigo-400">PO 2</th>
                    <th className="py-3 px-2 w-14 text-center text-indigo-600 dark:text-indigo-400">PO 3</th>
                    <th className="py-3 px-2 w-14 text-center text-indigo-600 dark:text-indigo-400">PO 4</th>
                    <th className="py-3 px-2 w-14 text-center text-indigo-600 dark:text-indigo-400">PO 5</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {syllabus.course_outcomes.map((co, idx) => (
                    <tr key={co.id || idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-indigo-50 dark:bg-indigo-950 font-bold text-indigo-700 dark:text-indigo-300 font-mono text-[11px]">
                          CO{idx + 1}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                        {co.statement}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase border ${getBloomBadgeColor(
                            co.blooms_level
                          )}`}
                        >
                          {co.blooms_level || 'Understand'}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center font-bold text-slate-700 dark:text-slate-300">
                        {co.po1 || '-'}
                      </td>
                      <td className="py-3 px-2 text-center font-bold text-slate-700 dark:text-slate-300">
                        {co.po2 || '-'}
                      </td>
                      <td className="py-3 px-2 text-center font-bold text-slate-700 dark:text-slate-300">
                        {co.po3 || '-'}
                      </td>
                      <td className="py-3 px-2 text-center font-bold text-slate-700 dark:text-slate-300">
                        {co.po4 || '-'}
                      </td>
                      <td className="py-3 px-2 text-center font-bold text-slate-700 dark:text-slate-300">
                        {co.po5 || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3. UNITS & TOPICS */}
      {activeTab === 'units' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Layers className="h-4 w-4 text-cyan-500" /> 3. Topics to be Covered (Unit Breakdown)
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Click on any unit header to expand or collapse its sub-topics and case discussions.
              </p>
            </div>

            {syllabus.topics.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => expandAllUnits(syllabus.topics)}
                  className="px-2.5 py-1 text-[11px] font-bold text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 hover:bg-cyan-100 dark:hover:bg-cyan-900/40 rounded-lg border border-cyan-200 dark:border-cyan-800 transition-colors"
                >
                  Expand All
                </button>
                <button
                  type="button"
                  onClick={collapseAllUnits}
                  className="px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
                >
                  Collapse All
                </button>
              </div>
            )}
          </div>

          {syllabus.topics.length === 0 ? (
            <div className="p-8 text-center text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
              <Layers className="h-6 w-6 mx-auto mb-1 text-slate-400" />
              <p className="text-xs">No units defined yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {syllabus.topics.map((unit, idx) => {
                const uNum = unit.unit_number || idx + 1;
                const unitKey = unit.id || `unit-${idx}`;
                const isExpanded = !!expandedUnits[unitKey];

                // Avoid "Unit 1: Unit 1" duplicate
                const rawTitle = unit.unit_title?.trim() || '';
                const displayTitle = rawTitle && !rawTitle.toLowerCase().startsWith(`unit ${uNum}`) && !rawTitle.toLowerCase().startsWith(`unit`)
                  ? `Unit ${uNum}: ${rawTitle}`
                  : rawTitle || `Unit ${uNum}`;

                return (
                  <div
                    key={unitKey}
                    className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all overflow-hidden"
                  >
                    {/* Collapsible Unit Header Bar */}
                    <button
                      type="button"
                      onClick={() => toggleUnit(unitKey)}
                      className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="h-8 w-8 rounded-xl bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 font-extrabold text-xs flex items-center justify-center border border-cyan-200 dark:border-cyan-800 shrink-0">
                          U{uNum}
                        </span>
                        <div className="min-w-0">
                          <h5 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {displayTitle}
                          </h5>
                          {!isExpanded && (
                            <p className="text-[11px] text-slate-400 truncate max-w-md">
                              {unit.content ? unit.content.slice(0, 80) + '...' : 'Click to view topics'}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                          <Clock className="h-3 w-3 text-cyan-500" /> {unit.hours} Hrs
                        </span>

                        <div className={`p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                          <ChevronDown className="h-4 w-4" />
                        </div>
                      </div>
                    </button>

                    {/* Expandable Content Area */}
                    {isExpanded && (
                      <div className="px-5 pb-5 pt-2 border-t border-slate-100 dark:border-slate-800 animate-fadeIn">
                        <UnitContentFormatter content={unit.content} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. APPLIED LEARNING & INDUSTRY */}
      {activeTab === 'industry' && (
        <div className="space-y-8 animate-fadeIn">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 mb-1">
              <Briefcase className="h-3 w-3" /> Industry Relevance
            </div>
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              4. Applied Learning, Cases & Industry Exposure
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Prescribed real-world case studies, hands-on live assignments, and industry-standard software platforms.
            </p>
          </div>

          {/* 4a. Prescribed Business Case Studies */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
                <BookOpen className="h-4 w-4" />
                <h5 className="text-xs font-black uppercase tracking-wider">
                  PRESCRIBED BUSINESS CASE STUDIES & READING MATERIALS
                </h5>
              </div>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                {syllabus.case_studies.length} {syllabus.case_studies.length === 1 ? 'Case' : 'Cases'}
              </span>
            </div>

            {syllabus.case_studies.length === 0 ? (
              <div className="p-8 text-center text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                <BookOpen className="h-6 w-6 mx-auto mb-1 text-slate-400" />
                <p className="text-xs">No business case studies specified for this course.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {syllabus.case_studies.map((cs, idx) => {
                  const isBankCase = Boolean((cs.id && cs.id.length > 15) || cs.product_number);
                  const targetUrl = cs.product_number ? `/case-studies/${encodeURIComponent(cs.product_number)}` : `/case-studies/${cs.id}`;
                  const displayConcept = cs.communication_concept || cs.concept;
                  return (
                    <div
                      key={cs.id || idx}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3.5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div className="space-y-2.5">
                        {/* Top Row: CS Badge + Title + Action Buttons */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-mono text-[11px] font-black border border-indigo-200 dark:border-indigo-800 shrink-0 mt-0.5">
                              CS{idx + 1}
                            </span>
                            <div className="min-w-0">
                              {isBankCase ? (
                                <Link
                                  to={targetUrl}
                                  className="font-bold text-sm text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors inline-flex items-center gap-1.5 leading-snug"
                                  title="Open Case Study Details"
                                >
                                  <span>{cs.title}</span>
                                  <Eye className="h-3 w-3 text-indigo-500 opacity-60 shrink-0" />
                                </Link>
                              ) : (
                                <h4 className="font-bold text-sm text-slate-900 dark:text-white leading-snug">
                                  {cs.title}
                                </h4>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons: Read Case, Details, Download */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Read Case */}
                            {cs.file_url ? (
                              <button
                                type="button"
                                onClick={() => handlePreviewCaseStudy(cs)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs border border-indigo-200 dark:border-indigo-800 transition-all shadow-sm cursor-pointer"
                                title="Open Inbuilt Case Document Viewer"
                              >
                                <Eye className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" /> Read Case
                              </button>
                            ) : cs.link ? (
                              <a
                                href={cs.link}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs border border-indigo-200 dark:border-indigo-800 transition-all shadow-sm"
                                title="Open External Resource"
                              >
                                <ExternalLink className="h-3.5 w-3.5" /> Read Case
                              </a>
                            ) : null}

                            {/* Details Button */}
                            {isBankCase && (
                              <Link
                                to={targetUrl}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-bold text-xs border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
                                title="View Full Case Details & Learning Objectives"
                              >
                                <BookOpen className="h-3.5 w-3.5" /> Details
                              </Link>
                            )}

                            {/* Download Icon Button */}
                            {cs.file_url && (
                              <button
                                type="button"
                                onClick={() => handleDownloadCaseStudyDocument(cs)}
                                className="p-1.5 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                title={`Download ${cs.file_name || cs.title}`}
                              >
                                <Download className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Author */}
                        {cs.author && (
                          <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
                            By: {cs.author}
                          </div>
                        )}

                        {/* Concept Covered */}
                        <div className="space-y-0.5">
                          <span className="block text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                            CONCEPT COVERED:
                          </span>
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                            {displayConcept || 'Course case study analysis and concept application.'}
                          </p>
                        </div>
                      </div>

                      {/* Bottom: Attachment / File Info */}
                      {(cs.file_name || cs.file_url) && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-1.5 font-mono">
                          <Paperclip className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                          <span className="truncate">{cs.file_name || `${cs.title}.pdf`}</span>
                          {cs.file_size && (
                            <span className="shrink-0 text-slate-400">({Math.round(cs.file_size / 1024)} KB)</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4b. Live Practical Assignments */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-cyan-700 dark:text-cyan-300">
                <FileCheck className="h-4 w-4" />
                <h5 className="text-xs font-black uppercase tracking-wider">
                  4B. LIVE PRACTICAL ASSIGNMENTS & SIMULATION TASKS
                </h5>
              </div>
              <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400">
                {syllabus.live_assignments.length} {syllabus.live_assignments.length === 1 ? 'Assignment' : 'Assignments'}
              </span>
            </div>

            {syllabus.live_assignments.length === 0 ? (
              <div className="p-8 text-center text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                <FileCheck className="h-6 w-6 mx-auto mb-1 text-slate-400" />
                <p className="text-xs">No practical assignments specified for this course.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
                <table className="w-full text-xs text-left min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                      <th className="py-3.5 px-3.5 w-16 text-center">Task #</th>
                      <th className="py-3.5 px-4 w-60">Assignment Name</th>
                      <th className="py-3.5 px-4 min-w-[280px]">Task Description & Deliverables</th>
                      <th className="py-3.5 px-4 w-64">Platform / Tool / Portal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {syllabus.live_assignments.map((la, idx) => {
                      const platformItems = la.platform
                        ? la.platform
                            .split(/\r?\n|;|•/)
                            .map((p) => p.trim())
                            .filter((p) => p.length > 0)
                        : [];

                      return (
                        <tr key={la.id || idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                          <td className="py-4 px-3.5 text-center align-top">
                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg bg-cyan-50 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 font-mono text-[11px] font-black border border-cyan-200 dark:border-cyan-800">
                              LA{idx + 1}
                            </span>
                          </td>
                          <td className="py-4 px-4 font-bold text-slate-900 dark:text-white align-top">
                            <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-snug">
                              {la.assignment}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-slate-600 dark:text-slate-300 leading-relaxed align-top">
                            <p className="text-xs leading-relaxed font-normal">
                              {la.description || 'Practical industry exercise'}
                            </p>
                          </td>
                          <td className="py-4 px-4 align-top">
                            {platformItems.length > 0 ? (
                              <div className="space-y-1.5">
                                {platformItems.map((toolPart, pIdx) => {
                                  const isUrl = toolPart.startsWith('http://') || toolPart.startsWith('https://');
                                  const domainMatch = !isUrl && toolPart.match(/\b([a-zA-Z0-9-]+\.(?:gov\.in|nic\.in|org|com|in|edu|net)[^\s]*)/i);
                                  const linkHref = isUrl ? toolPart : domainMatch ? `https://${domainMatch[1]}` : null;

                                  const BadgeContent = (
                                    <div className="flex items-start gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-50/60 dark:bg-cyan-950/40 text-cyan-900 dark:text-cyan-200 border border-cyan-200/80 dark:border-cyan-800/60 text-[11px] font-medium transition-all hover:bg-cyan-100/70 dark:hover:bg-cyan-900/50">
                                      <Laptop className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                                      <span className="leading-snug break-words flex-1">{toolPart}</span>
                                      {linkHref && (
                                        <ExternalLink className="h-2.5 w-2.5 text-cyan-500 opacity-60 shrink-0 mt-0.5 ml-1" />
                                      )}
                                    </div>
                                  );

                                  return linkHref ? (
                                    <a
                                      key={pIdx}
                                      href={linkHref}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="block group"
                                      title={`Open ${toolPart}`}
                                    >
                                      {BadgeContent}
                                    </a>
                                  ) : (
                                    <div key={pIdx}>{BadgeContent}</div>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 4c. Software & Tools Exposure */}
          {syllabus.software_exposure && (
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-50 via-slate-50/80 to-indigo-50/40 dark:from-slate-900 dark:via-slate-900/90 dark:to-indigo-950/30 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    <Laptop className="h-4 w-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      4c. Software, Toolkits & Digital Exposure
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Industry software platforms and digital toolkits integrated into hands-on learning.
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0 self-start sm:self-auto">
                  ● Hands-On Applied Fluency
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {syllabus.software_exposure
                  .split(/\n|•|(?:\r\n)/)
                  .map((t) => t.trim().replace(/^[-*•\d+\.]\s*/, ''))
                  .filter((t) => t.length > 0)
                  .map((tool, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3.5 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
                    >
                      <div className="h-5 w-5 rounded-md bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-[10px] font-mono shrink-0 mt-0.5 border border-indigo-200 dark:border-indigo-800">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                          {tool}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. ASSESSMENT SCHEME */}
      {activeTab === 'assessment' && (
        <div className="space-y-8 animate-fadeIn">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 mb-1">
              <GraduationCap className="h-3 w-3" /> Academic Evaluation
            </div>
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              5 & 6. Scheme of Assessment & CCE Breakdown
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Continuous Comprehensive Evaluation (CCE) and Term End Examination (TEE) marks allocation and rubrics.
            </p>
          </div>

          {/* Marks Allocation Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Card 1: CCE */}
            <div className="p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/50 shadow-sm flex flex-col justify-between space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700">
                  CONTINUOUS ASSESSMENT
                </span>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  {Math.round(((syllabus.cce_marks || 50) / (syllabus.total_marks || 100)) * 100)}% Weight
                </span>
              </div>
              <div>
                <div className="text-3xl font-black text-indigo-700 dark:text-indigo-300 tracking-tight">
                  {syllabus.cce_marks || 50} Marks
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-bold mt-0.5">
                  Continuous Comprehensive Evaluation (CCE)
                </p>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-2.5 border-t border-indigo-100 dark:border-indigo-900/40 leading-relaxed">
                Includes individual drafting tasks, case analysis, quizzes, and live simulation assignments.
              </div>
            </div>

            {/* Card 2: TEE */}
            <div className="p-5 rounded-2xl bg-cyan-50/50 dark:bg-cyan-950/30 border border-cyan-200/80 dark:border-cyan-800/50 shadow-sm flex flex-col justify-between space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-cyan-100 dark:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-700">
                  TERM END EXAMINATION
                </span>
                <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400">
                  {Math.round(((syllabus.tee_marks || 50) / (syllabus.total_marks || 100)) * 100)}% Weight
                </span>
              </div>
              <div>
                <div className="text-3xl font-black text-cyan-700 dark:text-cyan-300 tracking-tight">
                  {syllabus.tee_marks || 50} Marks
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-bold mt-0.5">
                  Term End Examination (TEE)
                </p>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-2.5 border-t border-cyan-100 dark:border-cyan-900/40 leading-relaxed">
                Comprehensive end-of-term summative written / practical examination.
              </div>
            </div>

            {/* Card 3: Total */}
            <div className="p-5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/50 shadow-sm flex flex-col justify-between space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700">
                  TOTAL WEIGHTAGE
                </span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  Passing: 40%
                </span>
              </div>
              <div>
                <div className="text-3xl font-black text-emerald-700 dark:text-emerald-300 tracking-tight">
                  {syllabus.total_marks || 100} Marks
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-bold mt-0.5">
                  Total Subject Credit Weightage
                </p>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-2.5 border-t border-emerald-100 dark:border-emerald-900/40 leading-relaxed">
                Minimum aggregate qualifying benchmark required for subject academic credits.
              </div>
            </div>
          </div>

          {/* 6. CCE Evaluation Components Breakdown */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
                <CheckSquare className="h-4 w-4" />
                <h5 className="text-xs font-black uppercase tracking-wider">
                  6. CONTINUOUS COMPREHENSIVE EVALUATION (CCE) BREAKDOWN
                </h5>
              </div>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                {syllabus.cce_components.length} {syllabus.cce_components.length === 1 ? 'Component' : 'Components'}
                {syllabus.cce_components.length > 0 && ` | ${syllabus.cce_components.reduce((sum, c) => sum + (c.marks !== undefined ? c.marks : c.max_marks !== undefined ? c.max_marks : 0), 0) || syllabus.cce_marks || 50} Marks`}
              </span>
            </div>

            {syllabus.cce_components.length === 0 ? (
              <div className="p-8 text-center text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                <CheckSquare className="h-6 w-6 mx-auto mb-1 text-slate-400" />
                <p className="text-xs">No specific CCE evaluation components configured for this subject.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
                <table className="w-full text-xs text-left min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                      <th className="py-3.5 px-3.5 w-20 text-center">Task #</th>
                      <th className="py-3.5 px-4 w-60">Evaluation Component</th>
                      <th className="py-3.5 px-4 min-w-[280px]">Description, Scope & Deliverables</th>
                      <th className="py-3.5 px-4 w-32 text-center">Max Marks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {syllabus.cce_components.map((comp, idx) => {
                      const compName = comp.name || comp.component || comp.title || `Assessment ${idx + 1}`;
                      const compDetails = comp.details || comp.description || comp.deliverable || '';
                      const compMarks = comp.marks !== undefined ? comp.marks : comp.max_marks !== undefined ? comp.max_marks : 10;

                      return (
                        <tr key={comp.id || idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                          <td className="py-4 px-3.5 text-center align-top">
                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-mono text-[11px] font-black border border-indigo-200 dark:border-indigo-800">
                              CCE{idx + 1}
                            </span>
                          </td>
                          <td className="py-4 px-4 font-bold text-slate-900 dark:text-white align-top">
                            <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-snug">
                              {compName}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-slate-600 dark:text-slate-300 leading-relaxed align-top">
                            <p className="text-xs leading-relaxed font-normal">
                              {compDetails || 'Comprehensive assessment of subject concepts, analytical problem solving, and student coursework.'}
                            </p>
                          </td>
                          <td className="py-4 px-4 text-center align-top">
                            <span className="inline-flex items-center justify-center px-3 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-extrabold text-xs border border-indigo-200 dark:border-indigo-800 shadow-2xs">
                              {compMarks} Marks
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. READING LIST */}
      {activeTab === 'books' && (
        <div className="space-y-8 animate-fadeIn">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 mb-1">
              <Bookmark className="h-3 w-3" /> Literature & Statutory References
            </div>
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              7 & 8. Prescribed Reading List & Statutory Sources
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Recommended textbooks, reference volumes, regulatory bare acts, and authoritative publications.
            </p>
          </div>

          {/* 7. Recommended Textbooks */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
                <BookOpen className="h-4 w-4" />
                <h5 className="text-xs font-black uppercase tracking-wider">
                  7. RECOMMENDED CORE TEXTBOOKS
                </h5>
              </div>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                {syllabus.recommended_textbooks.length} {syllabus.recommended_textbooks.length === 1 ? 'Book' : 'Books'}
              </span>
            </div>

            {syllabus.recommended_textbooks.length === 0 ? (
              <div className="p-8 text-center text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                <BookOpen className="h-6 w-6 mx-auto mb-1 text-slate-400" />
                <p className="text-xs">No recommended textbooks specified for this course.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {syllabus.recommended_textbooks.map((book, idx) => {
                  const title = book.title || book.name || `Textbook ${idx + 1}`;
                  const authors = book.authors || book.author;
                  const publisher = book.publisher;
                  const edition = book.edition || book.edition_year || book.year;

                  return (
                    <div
                      key={book.id || idx}
                      className="group rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all flex flex-col justify-between"
                    >
                      <div className="flex items-start gap-4">
                        {/* 3D Book Spine Cover Graphic */}
                        <div className="w-16 sm:w-20 shrink-0 aspect-[3/4.2] rounded-xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 dark:from-indigo-600 dark:via-indigo-800 dark:to-slate-950 text-white p-2 flex flex-col justify-between shadow-md border-l-[5px] border-indigo-400 dark:border-indigo-300 relative select-none overflow-hidden group-hover:scale-[1.03] transition-transform duration-200">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[9px] font-black text-indigo-200 tracking-wider">TB{idx + 1}</span>
                            <Bookmark className="h-3.5 w-3.5 text-amber-300 fill-amber-300 drop-shadow-xs" />
                          </div>
                          <div className="text-center my-auto">
                            <BookOpen className="h-5 w-5 text-white/80 mx-auto drop-shadow-xs" />
                            <div className="w-6 h-0.5 bg-indigo-300/40 rounded mx-auto mt-1" />
                          </div>
                          <div className="text-[8.5px] font-bold text-indigo-200 text-center tracking-tight truncate border-t border-indigo-500/30 pt-1">
                            {edition || 'Latest'}
                          </div>
                        </div>

                        {/* Book Metadata & Actions */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between space-y-2.5">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                <BookOpen className="h-2.5 w-2.5" /> Core Textbook
                              </span>
                              <a
                                href={`https://www.google.com/search?tbm=bks&q=${encodeURIComponent(title + ' ' + (authors || ''))}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/60 text-slate-600 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300 text-[11px] font-bold transition-colors"
                                title="Search on Google Books"
                              >
                                <ExternalLink className="h-3 w-3" /> Search
                              </a>
                            </div>

                            <h5 className="font-bold text-sm text-slate-900 dark:text-white leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {title}
                            </h5>

                            {authors && (
                              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1">
                                <span className="text-slate-400 dark:text-slate-500 font-normal">Author:</span> {authors}
                              </p>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                            <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400 truncate">
                              <span className="text-slate-400 text-[10px] font-bold uppercase">Publisher:</span>
                              <strong className="text-slate-700 dark:text-slate-300 font-semibold truncate">{publisher || 'Standard Academic'}</strong>
                            </div>
                            <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400 sm:justify-end">
                              <span className="text-slate-400 text-[10px] font-bold uppercase">Edition:</span>
                              <strong className="text-slate-700 dark:text-slate-300 font-semibold">{edition || 'Latest Edition'}</strong>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 8. Reference Books & Journals */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
                <Bookmark className="h-4 w-4" />
                <h5 className="text-xs font-black uppercase tracking-wider">
                  8. REFERENCE BOOKS & STATUTORY SOURCES
                </h5>
              </div>
              <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                {syllabus.reference_books.length} {syllabus.reference_books.length === 1 ? 'Reference' : 'References'}
              </span>
            </div>

            {syllabus.reference_books.length === 0 ? (
              <div className="p-8 text-center text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                <Bookmark className="h-6 w-6 mx-auto mb-1 text-slate-400" />
                <p className="text-xs">No reference books specified.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {syllabus.reference_books.map((book, idx) => {
                  const title = book.title || book.name || `Reference ${idx + 1}`;
                  const authors = book.authors || book.author;
                  const publisher = book.publisher;
                  const edition = book.edition || book.edition_year || book.year;

                  return (
                    <div
                      key={book.id || idx}
                      className="group rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-purple-300 dark:hover:border-purple-700 transition-all flex flex-col justify-between"
                    >
                      <div className="flex items-start gap-4">
                        {/* 3D Book Spine Cover Graphic (Purple Theme) */}
                        <div className="w-16 sm:w-20 shrink-0 aspect-[3/4.2] rounded-xl bg-gradient-to-br from-purple-700 via-purple-800 to-slate-950 text-white p-2 flex flex-col justify-between shadow-md border-l-[5px] border-purple-400 dark:border-purple-300 relative select-none overflow-hidden group-hover:scale-[1.03] transition-transform duration-200">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[9px] font-black text-purple-200 tracking-wider">RB{idx + 1}</span>
                            <Bookmark className="h-3.5 w-3.5 text-purple-200 fill-purple-200/60 drop-shadow-xs" />
                          </div>
                          <div className="text-center my-auto">
                            <Bookmark className="h-5 w-5 text-white/80 mx-auto drop-shadow-xs" />
                            <div className="w-6 h-0.5 bg-purple-300/40 rounded mx-auto mt-1" />
                          </div>
                          <div className="text-[8.5px] font-bold text-purple-200 text-center tracking-tight truncate border-t border-purple-500/30 pt-1">
                            {edition || 'Latest'}
                          </div>
                        </div>

                        {/* Book Metadata & Actions */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between space-y-2.5">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                <Bookmark className="h-2.5 w-2.5" /> Reference Volume
                              </span>
                              <a
                                href={`https://www.google.com/search?tbm=bks&q=${encodeURIComponent(title + ' ' + (authors || ''))}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 hover:bg-purple-50 dark:bg-slate-800 dark:hover:bg-purple-950/60 text-slate-600 hover:text-purple-600 dark:text-slate-400 dark:hover:text-purple-300 text-[11px] font-bold transition-colors"
                                title="Search on Google Books"
                              >
                                <ExternalLink className="h-3 w-3" /> Search
                              </a>
                            </div>

                            <h5 className="font-bold text-sm text-slate-900 dark:text-white leading-snug group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                              {title}
                            </h5>

                            {authors && (
                              <p className="text-xs text-purple-600 dark:text-purple-400 font-bold flex items-center gap-1">
                                <span className="text-slate-400 dark:text-slate-500 font-normal">Author:</span> {authors}
                              </p>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                            <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400 truncate">
                              <span className="text-slate-400 text-[10px] font-bold uppercase">Publisher:</span>
                              <strong className="text-slate-700 dark:text-slate-300 font-semibold truncate">{publisher || 'Standard Source'}</strong>
                            </div>
                            <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400 sm:justify-end">
                              <span className="text-slate-400 text-[10px] font-bold uppercase">Edition:</span>
                              <strong className="text-slate-700 dark:text-slate-300 font-semibold">{edition || 'Latest Edition'}</strong>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Inbuilt Case Study Document Viewer Modal */}
      {activePreviewCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-6 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-5xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
              <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
                <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs uppercase shrink-0 shadow-md shadow-indigo-500/20">
                  {activePreviewCase.file_type || 'PDF'}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      Inbuilt Case Reader
                    </span>
                    {activePreviewCase.product_number && (
                      <span className="text-[10px] font-mono text-slate-400">
                        #{activePreviewCase.product_number}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white truncate">
                    {activePreviewCase.title}
                  </h3>
                  {activePreviewCase.author && (
                    <p className="text-[11px] text-slate-500 truncate">
                      By: {activePreviewCase.author}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* View Details Link */}
                <Link
                  to={
                    activePreviewCase.product_number
                      ? `/case-studies/${encodeURIComponent(activePreviewCase.product_number)}`
                      : `/case-studies/${activePreviewCase.id}`
                  }
                  target="_blank"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-600 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Full Case Details
                </Link>

                {/* Download Button */}
                {activePreviewCase.file_url && (
                  <button
                    type="button"
                    onClick={() => handleDownloadCaseStudyDocument(activePreviewCase)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm shadow-indigo-500/20 transition-all cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" /> Download
                  </button>
                )}

                {/* Close Button */}
                <button
                  type="button"
                  onClick={closePreviewModal}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Close Viewer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body / Viewer */}
            <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-2 sm:p-4 overflow-hidden relative">
              {isPreviewLoading ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                  <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
                  <p className="text-xs font-bold">Loading Case Document into Inbuilt Viewer...</p>
                </div>
              ) : previewError ? (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                  <p className="text-sm font-bold text-rose-600 dark:text-rose-400 mb-3">{previewError}</p>
                  {activePreviewCase.file_url && (
                    <button
                      onClick={() => handleDownloadCaseStudyDocument(activePreviewCase)}
                      className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                    >
                      Download Document Directly
                    </button>
                  )}
                </div>
              ) : previewBlobUrl ? (
                <iframe
                  src={previewBlobUrl}
                  title={activePreviewCase.title}
                  className="w-full h-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white"
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
                  <p className="text-xs">No preview available for this document.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
