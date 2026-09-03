import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  BookOpen,
  HelpCircle,
  Send,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Lock,
  Unlock,
  Upload,
  FileText,
  FileSpreadsheet,
  FileCode,
  File,
  X,
  Clock,
  GraduationCap,
  Award,
  Bot,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Paperclip,
  Check,
  Download,
  Edit3,
  Briefcase,
  ExternalLink,
} from 'lucide-react';
import { api } from '../../lib/api';
import { AICaseAnalyzer } from '../case-studies/AICaseAnalyzer';

export interface ActivityCaseStudy {
  id?: string;
  case_study_id?: string;
  title: string;
  author?: string;
  publisher_source?: string;
  industry_domain?: string;
  concept?: string;
  learning_objectives?: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  external_link?: string;
  discussion_questions?: string[];
  is_manual?: boolean;
}

interface AITool {
  tool?: string;
  tool_name?: string;
  name?: string;
  category?: string;
  purpose?: string;
  access?: string;
  how_to_access?: string;
}

interface RubricCriterion {
  criterion?: string;
  name?: string;
  weightage?: number;
  distinction?: string;
  merit?: string;
  pass_grade?: string;
  pass?: string;
  needs_work?: string;
}

interface UploadedFileItem {
  file_name: string;
  file_url: string;
  file_size?: number;
  file_type?: string;
  saved_path?: string;
}

interface ActivitySubmission {
  id: string;
  activity_id: string;
  student_id: string;
  student_name?: string;
  student_prn?: string;
  submission_text?: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  files?: UploadedFileItem[];
  ai_verification_notes?: string;
  ai_evaluation?: {
    total_score?: number;
    max_score?: number;
    performance_tier?: string;
    executive_summary?: string;
    strengths?: string[];
    areas_for_improvement?: string[];
    criteria_breakdown?: Array<{
      criterion: string;
      marks_awarded: number;
      max_marks: number;
      tier: string;
      rationale: string;
      evidence?: string;
    }>;
    critical_feedback?: string;
    model_used?: string;
    evaluated_at?: string;
  };
  submitted_at: string;
  status: string;
  grade?: string;
  score?: number;
  graded_by_name?: string;
  graded_at?: string;
  feedback?: string;
}

interface ActivityProps {
  activity: any;
  subjectId: string;
  isStudent: boolean;
  isFacultyOrAdmin: boolean;
  onEdit?: (act: any) => void;
  onDelete?: (actId: string) => void;
}

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['docx', 'doc', 'txt', 'rtf', 'pdf'].includes(ext)) {
    return <FileText className="h-4 w-4 text-indigo-500 shrink-0" />;
  } else if (['xlsx', 'xls', 'csv'].includes(ext)) {
    return <FileSpreadsheet className="h-4 w-4 text-emerald-500 shrink-0" />;
  } else if (['pptx', 'ppt'].includes(ext)) {
    return <FileText className="h-4 w-4 text-amber-500 shrink-0" />;
  } else if (['json', 'py', 'js', 'html', 'css'].includes(ext)) {
    return <FileCode className="h-4 w-4 text-purple-500 shrink-0" />;
  }
  return <File className="h-4 w-4 text-slate-500 shrink-0" />;
}

function formatBytes(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const HyperBuildActivityCard: React.FC<ActivityProps> = ({
  activity,
  subjectId: _subjectId,
  isStudent,
  isFacultyOrAdmin,
  onEdit,
  onDelete,
}) => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSubmitPanel, setShowSubmitPanel] = useState(false);
  const [activeSubmissionScorecard, setActiveSubmissionScorecard] = useState<ActivitySubmission | null>(null);
  const [localSubmission, setLocalSubmission] = useState<ActivitySubmission | undefined>(activity.my_submission);
  const [activeReadingCase, setActiveReadingCase] = useState<ActivityCaseStudy | null>(null);
  const [activeAICase, setActiveAICase] = useState<ActivityCaseStudy | null>(null);

  const updateUrlModal = (m: string | null, params: Record<string, string | undefined> = {}) => {
    const next = new URLSearchParams(searchParams);
    if (!m) {
      next.delete('modal');
      next.delete('activityId');
      next.delete('submissionId');
    } else {
      next.set('modal', m);
      Object.entries(params).forEach(([k, v]) => {
        if (v) next.set(k, v);
        else next.delete(k);
      });
    }
    setSearchParams(next);
  };

  const handleOpenSubmitPanel = (syncUrl = true) => {
    setShowSubmitPanel(true);
    if (syncUrl) updateUrlModal('submitHyperbuild', { activityId: activity.id });
  };

  const handleCloseSubmitPanel = (syncUrl = true) => {
    setShowSubmitPanel(false);
    setSelectedFiles([]);
    setSubmissionNotes('');
    setUploadError(null);
    if (syncUrl) updateUrlModal(null);
  };

  const handleOpenScorecard = (sub: ActivitySubmission, syncUrl = true) => {
    setActiveSubmissionScorecard(sub);
    if (syncUrl) updateUrlModal('evaluateHyperbuild', { activityId: activity.id, submissionId: sub.id });
  };

  const handleCloseScorecard = (syncUrl = true) => {
    setActiveSubmissionScorecard(null);
    if (syncUrl) updateUrlModal(null);
  };

  React.useEffect(() => {
    setLocalSubmission(activity.my_submission);
  }, [activity.my_submission]);

  // Multi-file submission state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const submission: ActivitySubmission | undefined = localSubmission;
  const isSubmitted = !!submission;
  const isReleased = activity.is_released;

  // Faculty submissions query
  const { data: facultySubmissions = [], isLoading: isLoadingSubs } = useQuery<ActivitySubmission[]>({
    queryKey: ['activity-submissions', activity.id],
    queryFn: async () => {
      const res = await api.get(`/lms/activities/${activity.id}/submissions`);
      return res.data;
    },
    enabled: isFacultyOrAdmin && isExpanded,
  });

  const urlModal = searchParams.get('modal');
  const urlActivityId = searchParams.get('activityId') || searchParams.get('id');
  const urlSubmissionId = searchParams.get('submissionId');

  React.useEffect(() => {
    if (!urlModal || urlActivityId !== activity.id) {
      if (showSubmitPanel) handleCloseSubmitPanel(false);
      if (activeSubmissionScorecard) handleCloseScorecard(false);
      return;
    }

    if (urlModal === 'submitHyperbuild' && urlActivityId === activity.id && !showSubmitPanel) {
      handleOpenSubmitPanel(false);
    } else if (urlModal === 'evaluateHyperbuild' && urlActivityId === activity.id && urlSubmissionId && facultySubmissions.length > 0) {
      const found = facultySubmissions.find((s) => s.id === urlSubmissionId);
      if (found && (!activeSubmissionScorecard || activeSubmissionScorecard.id !== found.id)) {
        handleOpenScorecard(found, false);
      }
    }
  }, [urlModal, urlActivityId, urlSubmissionId, activity.id, facultySubmissions]);

  // Toggle release mutation
  const toggleReleaseMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/academic/activities/${activity.id}/release`, {
        is_released: !isReleased,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subject-lms-overview'] });
    },
  });

  // Submit deliverable mutation
  const submitDeliverableMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post(`/lms/activities/${activity.id}/submit`, payload);
      return res.data;
    },
    onSuccess: (data: any) => {
      setLocalSubmission(data);
      queryClient.invalidateQueries({ queryKey: ['subject-lms-overview'] });
      queryClient.invalidateQueries({ queryKey: ['lms-enrolled-subjects'] });
      queryClient.invalidateQueries({ queryKey: ['activity-submissions', activity.id] });
      setSelectedFiles([]);
      setSubmissionNotes('');
      setShowSubmitPanel(false);
    },
    onError: (err: any) => {
      setUploadError(err?.response?.data?.detail || 'Failed to submit deliverable');
    },
  });

  // On-demand AI evaluate mutation (Faculty only)
  const [evaluatingSubId, setEvaluatingSubId] = useState<string | null>(null);
  const evaluateMutation = useMutation({
    mutationFn: async (subId: string) => {
      setEvaluatingSubId(subId);
      const res = await api.post(`/lms/activity-submissions/${subId}/evaluate`);
      return res.data;
    },
    onSuccess: (updatedSub) => {
      if (updatedSub && updatedSub.activity_id === activity.id) {
        setLocalSubmission(updatedSub);
      }
      queryClient.invalidateQueries({ queryKey: ['subject-lms-overview'] });
      queryClient.invalidateQueries({ queryKey: ['activity-submissions', activity.id] });
      if (activeSubmissionScorecard?.id === updatedSub.id) {
        setActiveSubmissionScorecard(updatedSub);
      }
    },
    onSettled: () => {
      setEvaluatingSubId(null);
    },
  });

  // Bulk AI evaluation query & mutation
  const { data: evalProgress } = useQuery({
    queryKey: ['activity-eval-progress', activity.id],
    queryFn: async () => {
      const res = await api.get(`/lms/activities/${activity.id}/evaluation-progress`);
      return res.data;
    },
    enabled: isFacultyOrAdmin && isExpanded,
    refetchInterval: (query) => (query.state.data?.status === 'in_progress' ? 2500 : 8000),
  });

  const bulkEvaluateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/lms/activities/${activity.id}/bulk-evaluate`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-eval-progress', activity.id] });
      queryClient.invalidateQueries({ queryKey: ['activity-submissions', activity.id] });
    },
  });

  // File selection handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeSelectedFile = (idx: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  // Submit handler (uploads files, then submits activity with AI first-pass evaluation)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0 && !submissionNotes.trim()) {
      setUploadError('Please select at least one solution file or provide your deliverable text.');
      return;
    }

    setUploadError(null);
    setIsUploading(true);

    try {
      const uploadedFileList: UploadedFileItem[] = [];

      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await api.post('/lms/files/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const d = res.data;
        uploadedFileList.push({
          file_name: d.original_filename || file.name,
          file_url: d.file_url,
          file_size: d.file_size || file.size,
          file_type: file.name.split('.').pop()?.toLowerCase() || '',
          saved_path: d.file_path,
        });
      }

      await submitDeliverableMutation.mutateAsync({
        submission_text: submissionNotes,
        files: uploadedFileList,
        file_url: uploadedFileList[0]?.file_url || null,
        file_name: uploadedFileList[0]?.file_name || null,
        file_size: uploadedFileList[0]?.file_size || null,
        ai_verification_notes: submissionNotes,
      });
    } catch (err: any) {
      setUploadError(err?.response?.data?.detail || err.message || 'File upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  // Parse AI tools list
  let toolsList: AITool[] = [];
  if (Array.isArray(activity.ai_tools)) {
    toolsList = activity.ai_tools;
  } else if (typeof activity.ai_tools === 'string') {
    try {
      toolsList = JSON.parse(activity.ai_tools);
    } catch {}
  }

  // Parse Rubric criteria list
  let rubricList: RubricCriterion[] = [];
  if (Array.isArray(activity.rubric)) {
    rubricList = activity.rubric;
  } else if (typeof activity.rubric === 'string') {
    try {
      rubricList = JSON.parse(activity.rubric);
    } catch {}
  }

  // Parse step by step instructions
  const parseInstructions = (inst?: string) => {
    if (!inst) return [];
    return inst
      .split(/\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((l) => {
        const numMatch = l.match(/^(\d+)[\.\)]\s*(.*)/);
        if (numMatch) {
          return { num: numMatch[1], text: numMatch[2] };
        }
        return { num: null, text: l.replace(/^[\-•\*]\s*/, '') };
      });
  };

  const parsedSteps = parseInstructions(activity.instructions);

  return (
    <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden transition-all">
      {/* ─── Header Bar (Always Visible) ─────────────────────────────────── */}
      <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Number circle, Title & Badges */}
        <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
          <div className="h-11 w-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-base font-black shrink-0 shadow-sm">
            {activity.activity_no}
          </div>

          <div className="space-y-1.5 flex-1 min-w-0">
            <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-snug">
              Activity {activity.activity_no}: {activity.title}
            </h4>

            <div className="flex items-center gap-2 flex-wrap text-xs">
              {activity.unit_mapping && (
                <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {activity.unit_mapping}
                </span>
              )}

              {(activity.estimated_time || activity.mode) && (
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {activity.estimated_time} {activity.mode ? `· ${activity.mode}` : ''}
                </span>
              )}

              {activity.file_naming && (
                <span className="px-2 py-0.5 rounded-md font-mono text-[10.5px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  {activity.file_naming}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Status Pill & Actions */}
        <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
          {/* Release / Lock Badge */}
          {isFacultyOrAdmin ? (
            <button
              onClick={() => toggleReleaseMutation.mutate()}
              disabled={toggleReleaseMutation.isPending}
              className={`px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border transition-all cursor-pointer flex items-center gap-1.5 shadow-sm ${
                isReleased
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
              }`}
              title="Click to toggle release status"
            >
              {isReleased ? (
                <>
                  <Unlock className="h-3.5 w-3.5 text-emerald-600" /> RELEASED
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5 text-amber-600" /> LOCKED (FACULTY ONLY)
                </>
              )}
            </button>
          ) : !isReleased ? (
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-amber-600" /> LOCKED
            </span>
          ) : null}

          {/* Submission Status Badge for Students */}
          {isSubmitted && (
            <span className="px-3 py-1.5 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 flex items-center gap-1.5 shadow-sm">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              {submission?.score != null ? `${submission.score}/100 Marks` : 'Submitted'}
            </span>
          )}

          {/* Faculty Edit/Delete Buttons */}
          {isFacultyOrAdmin && (
            <>
              {onEdit && (
                <button
                  onClick={() => onEdit(activity)}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-all cursor-pointer"
                  title="Edit Activity"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(activity.id)}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-all cursor-pointer"
                  title="Delete Activity"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </>
          )}

          {/* Expand/Collapse Chevron Button */}
          <button
            onClick={() => setIsExpanded((v) => !v)}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
            aria-label={isExpanded ? 'Collapse activity' : 'Expand activity'}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* ─── Collapsible Body ────────────────────────────────────────────── */}
      {isExpanded && (
        <div className="p-5 sm:p-6 border-t border-slate-100 dark:border-slate-800 space-y-6 bg-slate-50/40 dark:bg-slate-900/40 animate-fadeIn">
          {/* 1. WHY THIS ACTIVITY (Amber Callout Box) */}
          {activity.why_this_activity && (
            <div className="p-5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/90 dark:border-amber-800/60 space-y-2.5">
              <h5 className="font-black text-amber-950 dark:text-amber-200 uppercase tracking-wider text-[11px] flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" /> WHY THIS ACTIVITY
              </h5>
              <div className="space-y-2 text-xs sm:text-[13px] text-amber-950/90 dark:text-amber-100 leading-relaxed font-medium">
                {activity.why_this_activity
                  .split(/\n|•/)
                  .map((l: string) => l.trim())
                  .filter((l: string) => l.length > 0)
                  .map((line: string, idx: number) => (
                    <div key={idx} className="flex items-start gap-2.5">
                      <span className="text-amber-600 dark:text-amber-400 font-bold mt-0.5">•</span>
                      <span>{line.replace(/^[\-•\*]\s*/, '')}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* ─── ATTACHED CASE STUDIES & DECISION SCENARIOS ──────────────────── */}
          {activity.case_studies && activity.case_studies.length > 0 && (
            <div className="space-y-3">
              <h5 className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                ATTACHED CASE STUDIES & DECISION SCENARIOS ({activity.case_studies.length})
              </h5>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activity.case_studies.map((cs: ActivityCaseStudy, idx: number) => {
                  const caseId = cs.id || cs.case_study_id;
                  return (
                    <div
                      key={idx}
                      className="p-5 rounded-2xl bg-gradient-to-br from-amber-50/70 via-white to-orange-50/30 dark:from-amber-950/20 dark:via-slate-900 dark:to-orange-950/10 border border-amber-200/90 dark:border-amber-800/60 shadow-xs flex flex-col justify-between space-y-4 transition-all hover:border-amber-300 dark:hover:border-amber-700"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-2xs">
                            {cs.publisher_source || 'Case Study'}
                          </span>
                          {cs.industry_domain && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              {cs.industry_domain}
                            </span>
                          )}
                          {cs.author && (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                              by {cs.author}
                            </span>
                          )}
                        </div>

                        <h6 className="font-black text-slate-900 dark:text-white text-sm sm:text-base leading-snug">
                          {cs.title}
                        </h6>

                        {cs.concept && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
                            {cs.concept}
                          </p>
                        )}

                        {cs.file_name && (
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 w-fit">
                            <FileText className="h-3.5 w-3.5" />
                            <span>Document: {cs.file_name}</span>
                          </div>
                        )}
                      </div>

                      {/* Action Bar */}
                      <div className="pt-3 border-t border-amber-100 dark:border-amber-900/40 flex items-center justify-between gap-2 flex-wrap text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setActiveReadingCase(cs)}
                            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                          >
                            <BookOpen className="h-3.5 w-3.5" /> Read Case
                          </button>

                          {cs.file_url && (
                            <a
                              href={cs.file_url.startsWith('http') ? cs.file_url : `/api/v1${cs.file_url.startsWith('/') ? '' : '/'}${cs.file_url}`}
                              target="_blank"
                              rel="noreferrer"
                              download={cs.file_name || 'case-study'}
                              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-700 text-amber-900 dark:text-amber-200 font-bold border border-amber-200 dark:border-amber-800 flex items-center gap-1.5 transition-all shadow-2xs"
                            >
                              <Download className="h-3.5 w-3.5" /> Download
                            </a>
                          )}

                          {caseId && (
                            <a
                              href={`/case-studies/${caseId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1 transition-all"
                              title="Open in Case Studies Bank"
                            >
                              <ExternalLink className="h-3.5 w-3.5" /> Go to Case
                            </a>
                          )}
                        </div>

                        {/* AI Case Intelligence Button */}
                        <button
                          type="button"
                          onClick={() => setActiveAICase(cs)}
                          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold flex items-center gap-1.5 shadow-sm shadow-purple-500/20 transition-all cursor-pointer"
                        >
                          <Sparkles className="h-3.5 w-3.5" /> AI Case Intelligence
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. STEP-BY-STEP INSTRUCTIONS */}
          {activity.instructions && (
            <div className="space-y-3">
              <h5 className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> STEP-BY-STEP INSTRUCTIONS
              </h5>

              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 space-y-3.5">
                {parsedSteps.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-3 text-xs sm:text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed">
                    <span className="h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5 border border-indigo-200 dark:border-indigo-800 shadow-xs">
                      {step.num || idx + 1}
                    </span>
                    <span className="flex-1 font-medium">{step.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. AI TOOLS & PLATFORMS TABLE */}
          {toolsList.length > 0 && (
            <div className="space-y-3">
              <h5 className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" /> AI TOOLS & PLATFORMS
              </h5>

              <div className="overflow-x-auto rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      <th className="py-3 px-4 font-black">TOOL / PLATFORM</th>
                      <th className="py-3 px-4 font-black">CATEGORY</th>
                      <th className="py-3 px-4 font-black">PURPOSE IN ACTIVITY</th>
                      <th className="py-3 px-4 font-black">HOW TO ACCESS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {toolsList.map((t, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-bold text-indigo-700 dark:text-indigo-400">
                          {t.tool || t.tool_name || t.name}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-600 dark:text-slate-400">
                          {t.category || 'AI Tool'}
                        </td>
                        <td className="py-3 px-4 font-medium leading-relaxed">
                          {t.purpose || 'Deliverable generation & critique'}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {t.access || t.how_to_access || 'Web Platform'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. TWO-COLUMN CARDS: LEARNING OUTCOMES & SUBMISSION REQUIREMENTS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: Learning Outcomes */}
            {activity.learning_outcomes && (
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 space-y-3">
                <h5 className="font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-wider text-xs flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-emerald-600" /> LEARNING OUTCOMES
                </h5>
                <div className="space-y-2 text-xs sm:text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                  {activity.learning_outcomes
                    .split(/\n|•/)
                    .map((l: string) => l.trim())
                    .filter((l: string) => l.length > 0)
                    .map((line: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="text-emerald-500 font-bold mt-0.5">•</span>
                        <span>{line.replace(/^[\-•\*]\s*/, '')}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Right: Assessment Task & Submission Requirements */}
            {activity.submission_requirements && (
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 space-y-3">
                <h5 className="font-black text-sky-800 dark:text-sky-400 uppercase tracking-wider text-xs flex items-center gap-2">
                  <Send className="h-4 w-4 text-sky-600" /> ASSESSMENT TASK & SUBMISSION REQUIREMENTS
                </h5>
                <div className="space-y-2.5 text-xs sm:text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                  {activity.submission_requirements
                    .split(/\n|•/)
                    .map((l: string) => l.trim())
                    .filter((l: string) => l.length > 0)
                    .map((line: string, idx: number) => {
                      const wordCountMatch = line.match(/^(\d+)\s*(.*)/);
                      return (
                        <div key={idx} className="flex items-start gap-2">
                          <span className="text-sky-500 font-bold mt-0.5">•</span>
                          <span>
                            {wordCountMatch ? (
                              <>
                                <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono font-bold text-xs mr-1 border border-indigo-200 dark:border-indigo-800">
                                  {wordCountMatch[1]}
                                </span>
                                {wordCountMatch[2]}
                              </>
                            ) : (
                              line.replace(/^[\-•\*]\s*/, '')
                            )}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* 5. GRADING RUBRIC TABLE (4 TIERS) */}
          {rubricList.length > 0 && (
            <div className="space-y-3">
              <h5 className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs flex items-center gap-2">
                <Award className="h-4 w-4 text-amber-500" /> GRADING RUBRIC
              </h5>

              <div className="overflow-x-auto rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 text-[11px] font-black uppercase tracking-wider">
                      <th className="py-3 px-4 text-slate-700 dark:text-slate-300 min-w-[140px]">CRITERION</th>
                      <th className="py-3 px-4 text-emerald-700 dark:text-emerald-400 min-w-[200px]">DISTINCTION (85–100%)</th>
                      <th className="py-3 px-4 text-sky-700 dark:text-sky-400 min-w-[180px]">MERIT (70–84%)</th>
                      <th className="py-3 px-4 text-amber-700 dark:text-amber-400 min-w-[170px]">PASS (50–69%)</th>
                      <th className="py-3 px-4 text-rose-700 dark:text-rose-400 min-w-[160px]">NEEDS WORK (&lt;50%)</th>
                      <th className="py-3 px-4 text-slate-700 dark:text-slate-300 text-center min-w-[90px]">WEIGHTAGE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {rubricList.map((crit, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors align-top">
                        <td className="py-3.5 px-4 font-black text-slate-900 dark:text-white">
                          {crit.criterion || crit.name}
                        </td>
                        <td className="py-3.5 px-4 font-normal text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                          {crit.distinction}
                        </td>
                        <td className="py-3.5 px-4 font-normal text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                          {crit.merit}
                        </td>
                        <td className="py-3.5 px-4 font-normal text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                          {crit.pass_grade || crit.pass}
                        </td>
                        <td className="py-3.5 px-4 font-normal text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                          {crit.needs_work}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-xs text-slate-800 dark:text-slate-200 text-center align-top">
                          {crit.weightage !== undefined && crit.weightage !== null ? `${crit.weightage}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 6. FACULTY & ADMIN: STUDENT SUBMISSIONS REVIEW & ON-DEMAND AI EVALUATION */}
          {isFacultyOrAdmin && (
            <div className="p-5 rounded-3xl bg-indigo-50/40 dark:bg-slate-800/40 border border-indigo-200/80 dark:border-indigo-900/60 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <h5 className="text-sm font-black text-slate-900 dark:text-white">
                      Student Submissions & AI Assessment ({facultySubmissions.length})
                    </h5>
                    <p className="text-xs text-slate-500">
                      On-demand AI first-pass evaluation against the 4-tier grading rubric (Faculty / Admin only).
                    </p>
                  </div>
                </div>

                {facultySubmissions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => bulkEvaluateMutation.mutate()}
                    disabled={bulkEvaluateMutation.isPending || evalProgress?.status === 'in_progress'}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-sm flex items-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className={`h-3.5 w-3.5 ${evalProgress?.status === 'in_progress' ? 'animate-spin' : ''}`} />
                    <span>{evalProgress?.status === 'in_progress' ? 'Grading Submissions...' : '⚡ Bulk AI Evaluate All'}</span>
                  </button>
                )}
              </div>

              {/* Active Evaluation Progress Bar */}
              {evalProgress?.status === 'in_progress' && (
                <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-xs space-y-1.5">
                  <div className="flex items-center justify-between font-bold text-purple-900 dark:text-purple-200">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 animate-spin text-purple-600" />
                      <span>Grading submissions against rubrics...</span>
                    </span>
                    <span>{evalProgress?.processed_count || 0} / {evalProgress?.total_submissions || facultySubmissions.length}</span>
                  </div>
                  <div className="w-full h-1.5 bg-purple-200 dark:bg-purple-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-600 transition-all duration-300"
                      style={{
                        width: `${Math.round(((evalProgress?.processed_count || 0) / (evalProgress?.total_submissions || 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  {evalProgress?.current_student && (
                    <p className="text-[10px] text-purple-700 dark:text-purple-300">
                      Currently evaluating: <span className="font-semibold">{evalProgress.current_student}</span>
                    </p>
                  )}
                </div>
              )}

              {isLoadingSubs ? (
                <div className="py-6 text-center text-xs text-slate-400">Loading student submissions...</div>
              ) : facultySubmissions.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-500">
                  No student submissions received yet for Activity {activity.activity_no}.
                </div>
              ) : (
                <div className="space-y-3">
                  {facultySubmissions.map((sub: ActivitySubmission) => {
                    const isEvaluating = evaluatingSubId === sub.id;
                    const hasAiEval = !!sub.ai_evaluation;

                    return (
                      <div
                        key={sub.id}
                        className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-slate-900 dark:text-white">
                                {sub.student_name || 'Student'}
                              </span>
                              {sub.student_prn && (
                                <span className="px-2 py-0.5 rounded text-[10.5px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">
                                  {sub.student_prn}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Submitted on {new Date(sub.submitted_at).toLocaleString()}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {hasAiEval ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    activeSubmissionScorecard?.id === sub.id
                                      ? handleCloseScorecard()
                                      : handleOpenScorecard(sub)
                                  }
                                  className="px-3.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-black transition-all cursor-pointer flex items-center gap-1.5"
                                >
                                  <Award className="h-3.5 w-3.5 text-indigo-600" />
                                  Score: {sub.score || sub.ai_evaluation?.total_score}/100 ({sub.grade || sub.ai_evaluation?.performance_tier})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => evaluateMutation.mutate(sub.id)}
                                  disabled={isEvaluating}
                                  className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                                  title="Re-run AI Evaluation"
                                >
                                  <RefreshCw className={`h-3.5 w-3.5 ${isEvaluating ? 'animate-spin' : ''}`} />
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => evaluateMutation.mutate(sub.id)}
                                disabled={isEvaluating}
                                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-all shadow-md shadow-indigo-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                              >
                                {isEvaluating ? (
                                  <>
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Evaluating with AI...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="h-3.5 w-3.5" /> Evaluate with AI
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Submitted Files */}
                        {sub.files && sub.files.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {sub.files.map((f: UploadedFileItem, i: number) => (
                              <a
                                key={i}
                                href={f.file_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                              >
                                {getFileIcon(f.file_name)}
                                <span>{f.file_name}</span>
                                <Download className="h-3 w-3 text-indigo-500" />
                              </a>
                            ))}
                          </div>
                        )}

                        {/* Expanded Scorecard for this student */}
                        {activeSubmissionScorecard?.id === sub.id && sub.ai_evaluation && (
                          <div className="mt-3 p-5 rounded-2xl bg-indigo-50/50 dark:bg-slate-800/80 border border-indigo-100 dark:border-indigo-900/60 space-y-4 text-xs animate-fadeIn">
                            <div className="flex items-center justify-between pb-3 border-b border-indigo-100 dark:border-indigo-900/60">
                              <div>
                                <span className="font-bold text-indigo-950 dark:text-indigo-200 block text-sm">
                                  AI Academic Assessment Scorecard
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  Engine: {sub.ai_evaluation.model_used || 'HyperBuild Precision Evaluator'}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="font-black text-indigo-700 dark:text-indigo-300 text-lg sm:text-xl block">
                                  {sub.ai_evaluation.total_score} / 100
                                </span>
                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                  {sub.ai_evaluation.performance_tier}
                                </span>
                              </div>
                            </div>

                            {/* Executive Summary */}
                            {sub.ai_evaluation.executive_summary && (
                              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/40 text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                                <strong className="text-indigo-900 dark:text-indigo-200 block mb-1 text-[11px] uppercase tracking-wider font-black">
                                  Executive Summary:
                                </strong>
                                {sub.ai_evaluation.executive_summary}
                              </div>
                            )}

                            {/* Strengths & Deficiencies Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {sub.ai_evaluation.strengths && sub.ai_evaluation.strengths.length > 0 && (
                                <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 space-y-1.5">
                                  <h6 className="text-[11px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                                    <Check className="h-3.5 w-3.5" /> What Went Well (Strengths)
                                  </h6>
                                  <ul className="space-y-1 text-emerald-950 dark:text-emerald-200 font-medium">
                                    {sub.ai_evaluation.strengths.map((s: string, idx: number) => (
                                      <li key={idx} className="flex items-start gap-1.5">
                                        <span className="text-emerald-500 font-bold">•</span>
                                        <span>{s}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {sub.ai_evaluation.areas_for_improvement && sub.ai_evaluation.areas_for_improvement.length > 0 && (
                                <div className="p-3.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/40 space-y-1.5">
                                  <h6 className="text-[11px] font-black uppercase tracking-wider text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                                    <AlertTriangle className="h-3.5 w-3.5" /> Critical Deficiencies & Actionable Gaps
                                  </h6>
                                  <ul className="space-y-1 text-rose-950 dark:text-rose-200 font-medium">
                                    {sub.ai_evaluation.areas_for_improvement.map((s: string, idx: number) => (
                                      <li key={idx} className="flex items-start gap-1.5">
                                        <span className="text-rose-500 font-bold">•</span>
                                        <span>{s}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>

                            {/* Criteria Breakdown */}
                            {sub.ai_evaluation.criteria_breakdown && (
                              <div className="space-y-2">
                                <h6 className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px]">
                                  Criterion-by-Criterion Rubric Analysis:
                                </h6>
                                <div className="space-y-2">
                                  {sub.ai_evaluation.criteria_breakdown.map((cb: any, ci: number) => (
                                    <div key={ci} className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
                                      <div className="flex items-center justify-between font-bold">
                                        <span className="text-slate-900 dark:text-white font-bold">{cb.criterion}</span>
                                        <span className="text-indigo-600 dark:text-indigo-400 font-black">
                                          {cb.marks_awarded} / {cb.max_marks} marks ({cb.tier})
                                        </span>
                                      </div>
                                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed font-medium">{cb.rationale}</p>
                                      {cb.evidence && (
                                        <p className="text-[11px] text-slate-500 italic bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg">
                                          <strong className="text-slate-700 dark:text-slate-300 not-italic font-bold">Evidence Cited: </strong>
                                          {cb.evidence}
                                        </p>
                                      )}
                                      {cb.gap_identified && (
                                        <p className="text-[11px] text-rose-700 dark:text-rose-300 bg-rose-50/50 dark:bg-rose-950/30 p-2 rounded-lg font-medium">
                                          <strong>Deficiency / Missing Component: </strong>
                                          {cb.gap_identified}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Critical Masterclass Feedback */}
                            {sub.ai_evaluation.critical_feedback && (
                              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                                <h6 className="font-black text-indigo-900 dark:text-indigo-200 uppercase tracking-wider text-[11px]">
                                  Executive Academic Masterclass Appraisal:
                                </h6>
                                <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line font-medium text-xs sm:text-[13px]">
                                  {sub.ai_evaluation.critical_feedback}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 7. STUDENT: AI FIRST-PASS EVALUATION SCORECARD (When Evaluated) */}
          {isStudent && submission?.ai_evaluation && (
            <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-50/90 via-purple-50/50 to-white dark:from-slate-900 dark:via-indigo-950/20 dark:to-slate-900 border border-indigo-200 dark:border-indigo-800/80 space-y-5 shadow-sm">
              {/* Header: Score & Performance Tier */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-indigo-100 dark:border-indigo-900/60">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-lg font-black shadow-md shadow-indigo-500/20">
                    <Bot className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                      AI First-Pass Rubric Scorecard
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        Evaluated
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {submission.ai_evaluation.model_used || 'Google Gemini'}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-2xl sm:text-3xl font-black text-indigo-700 dark:text-indigo-300 leading-none">
                    {submission.ai_evaluation.total_score || submission.score || 0}
                    <span className="text-sm font-bold text-slate-400"> / 100</span>
                  </div>
                  <div className="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mt-1">
                    {submission.ai_evaluation.performance_tier || submission.grade || 'Evaluated'}
                  </div>
                </div>
              </div>

              {/* Executive Summary */}
              {submission.ai_evaluation.executive_summary && (
                <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-800/60 border border-indigo-100 dark:border-indigo-900/40 text-xs sm:text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                  <span className="font-bold text-indigo-900 dark:text-indigo-200 block mb-1">Executive Summary:</span>
                  {submission.ai_evaluation.executive_summary}
                </div>
              )}

              {/* Strengths & Areas for Improvement */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {submission.ai_evaluation.strengths && submission.ai_evaluation.strengths.length > 0 && (
                  <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 space-y-2">
                    <h6 className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5" /> Key Strengths
                    </h6>
                    <ul className="space-y-1.5 text-xs text-emerald-950 dark:text-emerald-200 font-medium">
                      {submission.ai_evaluation.strengths.map((s: string, i: number) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-emerald-500 font-bold">•</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {submission.ai_evaluation.areas_for_improvement && submission.ai_evaluation.areas_for_improvement.length > 0 && (
                  <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/40 space-y-2">
                    <h6 className="text-xs font-black uppercase tracking-wider text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" /> Areas for Improvement
                    </h6>
                    <ul className="space-y-1.5 text-xs text-rose-950 dark:text-rose-200 font-medium">
                      {submission.ai_evaluation.areas_for_improvement.map((s: string, i: number) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-rose-500 font-bold">•</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Criterion Breakdown Table */}
              {submission.ai_evaluation.criteria_breakdown && submission.ai_evaluation.criteria_breakdown.length > 0 && (
                <div className="space-y-2">
                  <h6 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Criterion-by-Criterion Rubric Scorecard
                  </h6>
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-[11px] font-black uppercase">
                          <th className="py-2.5 px-4">Criterion</th>
                          <th className="py-2.5 px-4 text-center">Score</th>
                          <th className="py-2.5 px-4">Performance Tier</th>
                          <th className="py-2.5 px-4">Evaluator Rationale</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {submission.ai_evaluation.criteria_breakdown.map((cb: any, i: number) => (
                          <tr key={i} className="align-top">
                            <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                              {cb.criterion}
                            </td>
                            <td className="py-3 px-4 font-black text-center text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                              {cb.marks_awarded} / {cb.max_marks}
                            </td>
                            <td className="py-3 px-4 font-semibold text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800">
                                {cb.tier}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                              <p>{cb.rationale}</p>
                              {cb.evidence && (
                                <p className="text-[11px] text-slate-500 italic mt-1 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg">
                                  <strong className="text-slate-700 dark:text-slate-300 not-italic font-bold">Evidence: </strong>
                                  {cb.evidence}
                                </p>
                              )}
                              {cb.gap_identified && (
                                <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-1 bg-rose-50/60 dark:bg-rose-950/30 p-2 rounded-lg font-medium">
                                  <strong>Deficiency / Gap: </strong>
                                  {cb.gap_identified}
                                </p>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* In-depth Critical Feedback */}
              {submission.ai_evaluation.critical_feedback && (
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <h6 className="text-xs font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-300">
                    Comprehensive Critical Appraisal & Guidance
                  </h6>
                  <p className="text-xs sm:text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed font-medium whitespace-pre-line">
                    {submission.ai_evaluation.critical_feedback}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 8. STUDENT: SUBMITTED DELIVERABLE DISPLAY */}
          {isStudent && isSubmitted && (
            <div className="p-5 rounded-3xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/50 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-100 dark:border-emerald-900/40">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h6 className="text-sm font-black text-emerald-950 dark:text-emerald-200 flex items-center gap-2">
                      Solution Deliverable Submitted
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        {submission.ai_evaluation ? 'Evaluated' : 'Awaiting Faculty AI Review'}
                      </span>
                    </h6>
                    <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 mt-0.5">
                      Submitted on {new Date(submission.submitted_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                {!showSubmitPanel && (
                  <button
                    type="button"
                    onClick={() => handleOpenSubmitPanel()}
                    className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold transition-all cursor-pointer shadow-xs"
                  >
                    Resubmit / Update Deliverable
                  </button>
                )}
              </div>

              {/* Submitted Files List */}
              {submission.files && submission.files.length > 0 && (
                <div className="space-y-2">
                  <h6 className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider">
                    Submitted Files ({submission.files.length}):
                  </h6>
                  <div className="flex flex-wrap gap-2">
                    {submission.files.map((f: UploadedFileItem, i: number) => (
                      <a
                        key={i}
                        href={f.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800/60 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-emerald-50/50 transition-all shadow-xs"
                      >
                        {getFileIcon(f.file_name)}
                        <span className="truncate max-w-[200px]">{f.file_name}</span>
                        {f.file_size && <span className="text-[10px] text-slate-400">({formatBytes(f.file_size)})</span>}
                        <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Submitted Notes */}
              {submission.submission_text && (
                <div className="p-3.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-emerald-100 dark:border-emerald-900/40 text-xs text-slate-700 dark:text-slate-300">
                  <span className="font-bold text-emerald-900 dark:text-emerald-300 block mb-1">Student Notes / Verification:</span>
                  <p className="whitespace-pre-line leading-relaxed">{submission.submission_text}</p>
                </div>
              )}
            </div>
          )}

          {/* 9. STUDENT SOLUTION UPLOAD / SUBMISSION FORM */}
          {isStudent && (!isSubmitted || showSubmitPanel) && (
            <div className="p-5 rounded-3xl border border-indigo-200/90 dark:border-indigo-800/60 bg-white dark:bg-slate-900 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Upload className="h-4 w-4" />
                  </div>
                  <div>
                    <h5 className="text-sm font-black text-slate-900 dark:text-white">
                      {isSubmitted ? 'Resubmit / Replace Solution Deliverable' : 'Submit Activity Deliverable & Solution'}
                    </h5>
                    <p className="text-xs text-slate-500">
                      Upload one or more files in any format (.docx, .pptx, .pdf, .xlsx, etc.) for your faculty submission.
                    </p>
                  </div>
                </div>
              </div>

              {(!isSubmitted || showSubmitPanel) && (
                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                  {/* Drag & Drop File Selector */}
                  <div className="relative border-2 border-dashed border-indigo-200 dark:border-indigo-800/80 rounded-2xl p-6 bg-indigo-50/30 dark:bg-indigo-950/20 text-center hover:bg-indigo-50/60 transition-all">
                    <input
                      type="file"
                      multiple
                      id={`file-upload-${activity.id}`}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={handleFileChange}
                    />
                    <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
                      <div className="h-12 w-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
                        <Paperclip className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                          Click to browse or drag & drop solution files
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Accepts all formats (.docx, .pptx, .pdf, .xlsx, .txt, .csv, etc.) · Multiple files supported
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Selected Files List */}
                  {selectedFiles.length > 0 && (
                    <div className="space-y-2">
                      <h6 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Files to be submitted ({selectedFiles.length}):
                      </h6>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {selectedFiles.map((f, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {getFileIcon(f.name)}
                              <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{f.name}</span>
                              <span className="text-[10px] text-slate-400">({formatBytes(f.size)})</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeSelectedFile(i)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-all cursor-pointer"
                              title="Remove file"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Optional Notes */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Solution Notes & AI Tool Verification Documentation (Optional)
                    </label>
                    <textarea
                      rows={3}
                      value={submissionNotes}
                      onChange={(e) => setSubmissionNotes(e.target.value)}
                      placeholder="Paste your executive summary, AI prompt logs, verification citations, or answers directly here..."
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {uploadError && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-400 font-semibold flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      {uploadError}
                    </div>
                  )}

                  {/* Submit Button */}
                  <div className="flex items-center justify-end gap-2 pt-2">
                    {showSubmitPanel && (
                      <button
                        type="button"
                        onClick={() => handleCloseSubmitPanel()}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={isUploading || submitDeliverableMutation.isPending}
                      className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all shadow-md shadow-indigo-500/25 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isUploading || submitDeliverableMutation.isPending ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" /> Uploading Solution...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" /> Submit Solution Deliverable
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── CASE STUDY READER MODAL ─────────────────────────────────────── */}
      {activeReadingCase && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Reader Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      {activeReadingCase.publisher_source || 'Case Study'}
                    </span>
                    {activeReadingCase.industry_domain && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {activeReadingCase.industry_domain}
                      </span>
                    )}
                  </div>
                  <h4 className="text-base font-black text-slate-900 dark:text-white mt-1">
                    {activeReadingCase.title}
                  </h4>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const toAi = activeReadingCase;
                    setActiveReadingCase(null);
                    setActiveAICase(toAi);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Launch AI Intelligence
                </button>
                <button
                  onClick={() => setActiveReadingCase(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Reader Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6 text-sm">
              {/* Author & Meta Bar */}
              {(activeReadingCase.author || activeReadingCase.file_url || activeReadingCase.external_link) && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 flex-wrap text-xs">
                  <div>
                    {activeReadingCase.author && (
                      <p className="font-semibold text-slate-700 dark:text-slate-300">
                        Author / Company: <span className="font-bold text-slate-900 dark:text-white">{activeReadingCase.author}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {activeReadingCase.file_url && (
                      <a
                        href={activeReadingCase.file_url.startsWith('http') ? activeReadingCase.file_url : `/api/v1${activeReadingCase.file_url.startsWith('/') ? '' : '/'}${activeReadingCase.file_url}`}
                        target="_blank"
                        rel="noreferrer"
                        download={activeReadingCase.file_name || 'case-study'}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1.5 transition-all shadow-sm"
                      >
                        <Download className="h-3.5 w-3.5" /> Download Full Document
                      </a>
                    )}
                    {activeReadingCase.external_link && (
                      <a
                        href={activeReadingCase.external_link}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1.5 transition-all"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> External Resource
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Scenario / Synopsis Narrative */}
              {activeReadingCase.concept && (
                <div className="space-y-3">
                  <h5 className="font-black text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-amber-600" /> Case Scenario Narrative & Executive Background
                  </h5>
                  <div className="p-6 rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-slate-800 dark:text-slate-200 leading-relaxed font-serif text-[14.5px] space-y-4">
                    {activeReadingCase.concept
                      .split(/\n\n|\r\n\r\n/)
                      .map((p, idx) => (
                        <p key={idx}>{p.trim()}</p>
                      ))}
                  </div>
                </div>
              )}

              {/* Learning Objectives */}
              {activeReadingCase.learning_objectives && (
                <div className="space-y-2">
                  <h5 className="font-black text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <GraduationCap className="h-4 w-4 text-emerald-600" /> Core Learning Objectives
                  </h5>
                  <div className="p-4 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 text-xs text-slate-700 dark:text-slate-300 space-y-2 font-medium leading-relaxed">
                    {activeReadingCase.learning_objectives
                      .split(/\n|•/)
                      .map((l) => l.trim())
                      .filter((l) => l.length > 0)
                      .map((line, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <span className="text-emerald-500 font-bold mt-0.5">•</span>
                          <span>{line.replace(/^[\-•\*]\s*/, '')}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Discussion Questions */}
              {activeReadingCase.discussion_questions && activeReadingCase.discussion_questions.length > 0 && (
                <div className="space-y-3">
                  <h5 className="font-black text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <HelpCircle className="h-4 w-4 text-indigo-600" /> Key Discussion & Strategic Questions
                  </h5>
                  <div className="space-y-2.5">
                    {activeReadingCase.discussion_questions.map((q, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40 text-xs flex items-start gap-3"
                      >
                        <span className="h-6 w-6 rounded-full bg-indigo-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-sm">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white leading-relaxed pt-0.5">
                          {q}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── AI CASE INTELLIGENCE MODAL ──────────────────────────────────── */}
      {activeAICase && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-purple-900/40 via-indigo-900/30 to-blue-900/20">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-purple-500/25">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                      Multi-Lens AI Intelligence
                    </span>
                    {activeAICase.industry_domain && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {activeAICase.industry_domain}
                      </span>
                    )}
                  </div>
                  <h4 className="text-base font-black text-slate-900 dark:text-white mt-0.5 truncate max-w-xl">
                    {activeAICase.title}
                  </h4>
                </div>
              </div>

              <button
                onClick={() => setActiveAICase(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* AI Analyzer Body */}
            <div className="p-6 overflow-y-auto flex-1">
              <AICaseAnalyzer
                caseStudyId={activeAICase.id || activeAICase.case_study_id || ''}
                caseTitle={activeAICase.title}
                domain={activeAICase.industry_domain}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


