import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  BookOpen,
  Sparkles,
  FileText,
  Video,
  CheckSquare,
  CalendarCheck,
  Calendar,
  Layers,
  Upload,
  Download,
  Plus,
  Trash2,
  ExternalLink,
  Clock,
  Send,
  CheckCircle2,
  X,
  Award,
  ChevronRight,
  ChevronLeft,
  GraduationCap,
  Target,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../lib/store';
import { StructuredSyllabusViewer } from '../subjects/StructuredSyllabusViewer';
import { HyperBuildActivityCard } from './HyperBuildActivityCard';
import { SubjectGradebookTab } from './SubjectGradebookTab';

// Helper component for rich text formatting
const FormattedSectionText: React.FC<{ text?: string }> = ({ text }) => {
  if (!text) return null;

  const rawLines = text
    .split(/\n|•/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (rawLines.length === 0) return null;

  return (
    <div className="space-y-2.5 text-xs">
      {rawLines.map((line, idx) => {
        const numMatch = line.match(/^(\(?\d+\)?[\.\:]?)\s*(.*)/);
        if (numMatch && numMatch[2]) {
          return (
            <div key={idx} className="flex items-start gap-2.5 leading-relaxed text-slate-800 dark:text-slate-200">
              <span className="h-5 w-5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-extrabold text-[11px] flex items-center justify-center shrink-0 mt-0.5 shadow-sm border border-indigo-200 dark:border-indigo-800">
                {numMatch[1].replace(/[\.\:\(\)]/g, '')}
              </span>
              <span className="flex-1 font-sans leading-relaxed">{numMatch[2]}</span>
            </div>
          );
        }

        const cleanLine = line.replace(/^[\-•\*\>]\s*/, '');
        return (
          <div key={idx} className="flex items-start gap-2.5 leading-relaxed text-slate-800 dark:text-slate-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0 mt-2 shadow-sm"></span>
            <span className="flex-1 font-sans leading-relaxed">{cleanLine}</span>
          </div>
        );
      })}
    </div>
  );
};

// ─── Session Plan Viewer ─────────────────────────────────────────────────────
// Fetches the file via authenticated API (blob) so JWT is sent correctly.
// Direct iframe/object src URLs cannot send the Authorization header.
const SessionPlanViewer: React.FC<{ subject: any }> = ({ subject }) => {
  const [blobUrl, setBlobUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Parse metadata
  let spMeta: { file_name?: string; file_type?: string } | null = null;
  let spIsFile = false;
  let spIsPlainText = false;

  if (subject.session_plan) {
    if (subject.session_plan.trim().startsWith('{')) {
      try { spMeta = JSON.parse(subject.session_plan); spIsFile = true; } catch {}
    } else {
      spIsPlainText = true;
    }
  }

  const fileType = (spMeta?.file_type || '').toLowerCase();
  const fileName = spMeta?.file_name || `${subject.code}_Session_Plan`;
  const isPdf = fileType === 'pdf';
  const isTxt = fileType === 'txt';
  const isOfficeDoc = ['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt'].includes(fileType);
  const canEmbed = isPdf || isTxt;

  const viewApiPath = `/lms/subjects/${subject.id}/session-plan/view`;
  const downloadApiPath = `/lms/subjects/${subject.id}/session-plan/download`;

  // Fetch file as blob via authenticated api when it's a file
  React.useEffect(() => {
    if (!spIsFile) return;
    let objectUrl: string | null = null;
    setLoading(true);
    setError(null);

    api.get(viewApiPath, { responseType: 'blob' })
      .then((res) => {
        const mimeType = isPdf ? 'application/pdf' : isTxt ? 'text/plain' : 'application/octet-stream';
        const blob = new Blob([res.data], { type: mimeType });
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch((err) => {
        console.error('SessionPlanViewer fetch error:', err);
        setError('Failed to load session plan. Please try downloading it.');
      })
      .finally(() => setLoading(false));

    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [subject.id, spIsFile]);

  const handleDownload = async () => {
    try {
      const res = await api.get(downloadApiPath, { responseType: 'blob' });
      const blob = new Blob([res.data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed', err);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shadow-indigo-500/20">
            <Calendar className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Session Plan</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {spIsFile
                ? `${fileName} · ${fileType.toUpperCase()} Document`
                : spIsPlainText
                ? 'Text-based session breakdown'
                : 'Class schedule & lesson roadmap'}
            </p>
          </div>
        </div>
        {spIsFile && (
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Download {fileType.toUpperCase()}
          </button>
        )}
      </div>

      {/* Body */}
      {!subject.session_plan ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Calendar className="h-10 w-10 text-slate-300" />
          <p className="text-sm font-semibold text-slate-500">No session plan uploaded yet</p>
          <p className="text-xs text-slate-400">The faculty/admin has not uploaded a session plan for this subject.</p>
        </div>
      ) : spIsPlainText ? (
        <div className="p-6">
          <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
            <FormattedSectionText text={subject.session_plan} />
          </div>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="h-8 w-8 border-[3px] border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-500">Loading session plan...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <FileText className="h-10 w-10 text-slate-300" />
          <p className="text-sm text-slate-500 font-semibold">{error}</p>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md"
          >
            <Download className="h-3.5 w-3.5" /> Download File
          </button>
        </div>
      ) : blobUrl && canEmbed ? (
        /* PDF / TXT inline viewer via blob URL */
        <div className="relative w-full" style={{ height: '78vh', minHeight: '580px' }}>
          <iframe
            src={isPdf ? `${blobUrl}#toolbar=1&navpanes=1&scrollbar=1&view=FitH` : blobUrl}
            title="Session Plan Viewer"
            className="w-full h-full border-0"
            allow="fullscreen"
          />
        </div>
      ) : blobUrl && isOfficeDoc ? (
        /* Office docs: show download prompt since blob URL can't be Google-previewed */
        <div className="flex flex-col items-center justify-center py-20 gap-5">
          <div className="h-16 w-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 flex items-center justify-center">
            <FileText className="h-8 w-8 text-indigo-500" />
          </div>
          <div className="text-center space-y-1.5">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{fileName}</p>
            <p className="text-xs text-slate-500">{fileType.toUpperCase()} Document · Cannot be previewed inline</p>
          </div>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-all shadow-md shadow-indigo-500/20"
          >
            <Download className="h-4 w-4" /> Download to View
          </button>
        </div>
      ) : null}
    </div>
  );
};

export const SubjectLMSHub: React.FC = () => {
  const { subjectCode, section } = useParams<{ subjectCode: string; section?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  type TabId = 'overview' | 'syllabus' | 'session_plan' | 'activities' | 'resources' | 'recordings' | 'assessments' | 'attendance' | 'gradebook';
  const VALID_SECTIONS: TabId[] = ['overview', 'syllabus', 'session_plan', 'activities', 'resources', 'recordings', 'assessments', 'attendance', 'gradebook'];

  // Derive active tab from URL section param
  const activeTab: TabId = (section && VALID_SECTIONS.includes(section as TabId)) ? (section as TabId) : 'overview';

  // Navigate + update URL when switching tabs
  const navigateToTab = (tab: TabId) => {
    if (tab === 'overview') {
      navigate(`/lms/subjects/${subjectCode}`, { replace: true });
    } else {
      navigate(`/lms/subjects/${subjectCode}/${tab}`, { replace: true });
    }
  };

  const isStudent = user?.roles.includes('student') && !user?.roles.some(r => ['crc_admin', 'crc_coordinator'].includes(r));
  const isFacultyOrAdmin = !isStudent;

  const [searchParams, setSearchParams] = useSearchParams();

  // --- Modals State ---
  const [isUploadResourceOpen, setIsUploadResourceOpen] = useState(false);
  const [isAddRecordingOpen, setIsAddRecordingOpen] = useState(false);
  const [isCreateAssessmentOpen, setIsCreateAssessmentOpen] = useState(false);
  const [selectedActivityForSubmit, setSelectedActivityForSubmit] = useState<any | null>(null);
  const [selectedAssessmentForSubmit, setSelectedAssessmentForSubmit] = useState<any | null>(null);

  const updateUrlModal = (m: string | null, params: Record<string, string | undefined> = {}) => {
    const next = new URLSearchParams(searchParams);
    if (!m) {
      next.delete('modal');
      next.delete('id');
      next.delete('activityId');
      next.delete('assessmentId');
    } else {
      next.set('modal', m);
      Object.entries(params).forEach(([k, v]) => {
        if (v) next.set(k, v);
        else next.delete(k);
      });
    }
    setSearchParams(next);
  };

  const openUploadResource = (syncUrl = true) => {
    setIsUploadResourceOpen(true);
    if (syncUrl) updateUrlModal('uploadResource');
  };

  const closeUploadResource = (syncUrl = true) => {
    setIsUploadResourceOpen(false);
    setResTitle('');
    setResDescription('');
    setResFile(null);
    setResLink('');
    if (syncUrl) updateUrlModal(null);
  };

  const openAddRecording = (syncUrl = true) => {
    setIsAddRecordingOpen(true);
    if (syncUrl) updateUrlModal('addRecording');
  };

  const closeAddRecording = (syncUrl = true) => {
    setIsAddRecordingOpen(false);
    setRecTitle('');
    setRecUrl('');
    setRecTopic('');
    setRecPasscode('');
    if (syncUrl) updateUrlModal(null);
  };

  const openCreateAssessment = (syncUrl = true) => {
    setIsCreateAssessmentOpen(true);
    if (syncUrl) updateUrlModal('createAssessment');
  };

  const closeCreateAssessment = (syncUrl = true) => {
    setIsCreateAssessmentOpen(false);
    setAssTitle('');
    setAssDescription('');
    setAssInstructions('');
    if (syncUrl) updateUrlModal(null);
  };

  const openSubmitHyperbuild = (activity: any, syncUrl = true) => {
    setSelectedActivityForSubmit(activity);
    if (syncUrl) updateUrlModal('submitHyperbuild', { activityId: activity.id });
  };

  const closeSubmitHyperbuild = (syncUrl = true) => {
    setSelectedActivityForSubmit(null);
    setSubText('');
    setSubFile(null);
    setAiNotes('');
    if (syncUrl) updateUrlModal(null);
  };

  const openSubmitAssessment = (assessment: any, syncUrl = true) => {
    setSelectedAssessmentForSubmit(assessment);
    if (syncUrl) updateUrlModal('submitAssessment', { assessmentId: assessment.id });
  };

  const closeSubmitAssessment = (syncUrl = true) => {
    setSelectedAssessmentForSubmit(null);
    setSubText('');
    setSubFile(null);
    if (syncUrl) updateUrlModal(null);
  };

  // Form states for Upload Resource
  const [resTitle, setResTitle] = useState('');
  const [resDescription, setResDescription] = useState('');
  const [resType, setResType] = useState('slides');
  const [resLink, setResLink] = useState('');
  const [resFile, setResFile] = useState<File | null>(null);
  const [resUnit, setResUnit] = useState<number>(1);

  // Form states for Add Recording
  const [recTitle, setRecTitle] = useState('');
  const [recUrl, setRecUrl] = useState('');
  const [recDate] = useState(new Date().toISOString().split('T')[0]);
  const [recDuration, setRecDuration] = useState<number>(60);
  const [recPlatform, setRecPlatform] = useState('Zoom');
  const [recTopic, setRecTopic] = useState('');
  const [recPasscode, setRecPasscode] = useState('');

  // Form states for Create Assessment
  const [assTitle, setAssTitle] = useState('');
  const [assDescription, setAssDescription] = useState('');
  const [assType, setAssType] = useState('assignment');
  const [assTotalMarks, setAssTotalMarks] = useState<number>(100);
  const [assWeightage, setAssWeightage] = useState<number>(20);
  const [assDueDate, setAssDueDate] = useState('');
  const [assInstructions, setAssInstructions] = useState('');

  // Student Submissions State
  const [subText, setSubText] = useState('');
  const [subFile, setSubFile] = useState<File | null>(null);
  const [aiNotes, setAiNotes] = useState('');

  // Fetch Subject LMS Overview by subject code
  const { data: lmsData, isLoading, error, refetch } = useQuery({
    queryKey: ['subject-lms-overview', subjectCode],
    queryFn: async () => {
      const res = await api.get(`/lms/subjects/by-code/${subjectCode}/overview`);
      return res.data;
    },
    enabled: !!subjectCode,
  });

  const urlModal = searchParams.get('modal');
  const urlActivityId = searchParams.get('activityId') || searchParams.get('id');
  const urlAssessmentId = searchParams.get('assessmentId') || searchParams.get('id');

  useEffect(() => {
    if (!urlModal) {
      if (isUploadResourceOpen) closeUploadResource(false);
      if (isAddRecordingOpen) closeAddRecording(false);
      if (isCreateAssessmentOpen) closeCreateAssessment(false);
      if (selectedActivityForSubmit) closeSubmitHyperbuild(false);
      if (selectedAssessmentForSubmit) closeSubmitAssessment(false);
      return;
    }

    if (urlModal === 'uploadResource' && !isUploadResourceOpen) {
      openUploadResource(false);
    } else if (urlModal === 'addRecording' && !isAddRecordingOpen) {
      openAddRecording(false);
    } else if (urlModal === 'createAssessment' && !isCreateAssessmentOpen) {
      openCreateAssessment(false);
    } else if (urlModal === 'submitHyperbuild' && urlActivityId && lmsData?.hyperbuild_activities) {
      const found = lmsData.hyperbuild_activities.find((a: any) => a.id === urlActivityId);
      if (found && (!selectedActivityForSubmit || selectedActivityForSubmit.id !== found.id)) {
        openSubmitHyperbuild(found, false);
      }
    } else if (urlModal === 'submitAssessment' && urlAssessmentId && lmsData?.assessments) {
      const found = lmsData.assessments.find((a: any) => a.id === urlAssessmentId);
      if (found && (!selectedAssessmentForSubmit || selectedAssessmentForSubmit.id !== found.id)) {
        openSubmitAssessment(found, false);
      }
    }
  }, [urlModal, urlActivityId, urlAssessmentId, lmsData]);

  // --- Mutations ---
  const uploadResourceMutation = useMutation({
    mutationFn: async () => {
      let fileUrl = '';
      let fileName = '';
      let fileSize = 0;

      if (resFile) {
        const formData = new FormData();
        formData.append('file', resFile);
        const uploadRes = await api.post('/lms/files/upload', formData);
        fileUrl = uploadRes.data.file_url;
        fileName = uploadRes.data.original_filename;
        fileSize = uploadRes.data.file_size;
      }

      await api.post(`/lms/subjects/${lmsData?.subject?.id}/resources`, {
        title: resTitle,
        description: resDescription,
        resource_type: resType,
        file_url: fileUrl || undefined,
        file_name: fileName || undefined,
        file_size: fileSize || undefined,
        external_link: resLink || undefined,
        unit_number: resUnit,
        is_published: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subject-lms-overview', subjectCode] });
      closeUploadResource();
    },
  });

  const addRecordingMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/lms/subjects/${lmsData?.subject?.id}/recordings`, {
        title: recTitle,
        recording_url: recUrl,
        recording_date: recDate,
        duration_minutes: recDuration,
        platform: recPlatform,
        topic_covered: recTopic,
        passcode: recPasscode || undefined,
        is_published: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subject-lms-overview', subjectCode] });
      closeAddRecording();
    },
  });

  const createAssessmentMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/lms/subjects/${lmsData?.subject?.id}/assessments`, {
        title: assTitle,
        description: assDescription,
        assessment_type: assType,
        total_marks: assTotalMarks,
        weightage_percentage: assWeightage,
        due_date: assDueDate ? new Date(assDueDate).toISOString() : undefined,
        instructions: assInstructions,
        is_published: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subject-lms-overview', subjectCode] });
      closeCreateAssessment();
    },
  });

  const submitAssessmentMutation = useMutation({
    mutationFn: async () => {
      let fileUrl = '';
      let fileName = '';
      let fileSize = 0;

      if (subFile) {
        const formData = new FormData();
        formData.append('file', subFile);
        const uploadRes = await api.post('/lms/files/upload', formData);
        fileUrl = uploadRes.data.file_url;
        fileName = uploadRes.data.original_filename;
        fileSize = uploadRes.data.file_size;
      }

      await api.post(`/lms/assessments/${selectedAssessmentForSubmit.id}/submit`, {
        submission_text: subText || undefined,
        file_url: fileUrl || undefined,
        file_name: fileName || undefined,
        file_size: fileSize || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subject-lms-overview', subjectCode] });
      closeSubmitAssessment();
    },
  });

  const submitActivityMutation = useMutation({
    mutationFn: async () => {
      let fileUrl = '';
      let fileName = '';
      let fileSize = 0;

      if (subFile) {
        const formData = new FormData();
        formData.append('file', subFile);
        const uploadRes = await api.post('/lms/files/upload', formData);
        fileUrl = uploadRes.data.file_url;
        fileName = uploadRes.data.original_filename;
        fileSize = uploadRes.data.file_size;
      }

      await api.post(`/lms/activities/${selectedActivityForSubmit.id}/submit`, {
        submission_text: subText || undefined,
        file_url: fileUrl || undefined,
        file_name: fileName || undefined,
        file_size: fileSize || undefined,
        ai_verification_notes: aiNotes || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subject-lms-overview', subjectCode] });
      closeSubmitHyperbuild();
    },
  });

  const deleteResourceMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/lms/resources/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subject-lms-overview', subjectCode] });
    },
  });

  const deleteRecordingMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/lms/recordings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subject-lms-overview', subjectCode] });
    },
  });

  const deleteAssessmentMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/lms/assessments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subject-lms-overview', subjectCode] });
    },
  });

  if (isLoading) {
    return (
      <div className="p-20 text-center text-slate-500">
        <BookOpen className="h-10 w-10 animate-spin mx-auto mb-3 text-indigo-500" />
        <p className="text-sm font-bold">Loading Course LMS Hub...</p>
      </div>
    );
  }

  if (error || !lmsData || !lmsData.subject) {
    return (
      <div className="p-10 max-w-md mx-auto my-14 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-500 flex items-center justify-center mx-auto">
          <BookOpen className="h-7 w-7" />
        </div>
        <h3 className="text-lg font-black text-slate-900 dark:text-white">Unable to Load Course LMS</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {(error as any)?.response?.data?.error?.message || (error as any)?.message || `Could not find course information for "${subjectCode}".`}
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => navigate('/lms')}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors"
          >
            ← Back to Courses
          </button>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all"
          >
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  const { subject, activities = [], resources = [], recordings = [], assessments = [], attendance } = lmsData;

  let parsedSyllabus: any = null;
  if (subject?.syllabus && typeof subject.syllabus === 'string') {
    try {
      if (subject.syllabus.trim().startsWith('{')) {
        parsedSyllabus = JSON.parse(subject.syllabus);
      }
    } catch (e) {
      console.error('Failed to parse syllabus JSON', e);
    }
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Layers, count: null },
    { id: 'syllabus', label: 'Syllabus', icon: BookOpen, count: null },
    { id: 'session_plan', label: 'Session Plan', icon: Calendar, count: null },
    { id: 'activities', label: 'HyperBuild AI Labs', icon: Sparkles, count: isStudent ? (activities?.length ? `${activities.length}` : '0') : activities?.length },
    { id: 'resources', label: 'Files & Resources', icon: FileText, count: resources?.length },
    { id: 'recordings', label: 'Recordings', icon: Video, count: recordings?.length },
    { id: 'assessments', label: 'Assessments', icon: CheckSquare, count: assessments?.length },
    { id: 'attendance', label: 'Attendance', icon: CalendarCheck, count: attendance ? `${attendance.attendance_percentage}%` : null },
    { id: 'gradebook', label: 'Subject Gradebook', icon: Award, count: null },
  ];

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* Top Navigation & Breadcrumb Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <button
          onClick={() => navigate('/lms')}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Back to My Courses
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800" title="Subject Code">
            {subject.code}
          </span>
          {subject.course_code && (
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700" title="Course Code">
              {subject.course_code}
            </span>
          )}
          <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            Trimester {subject.trimester} • {subject.is_non_credit ? 'Non-Credit' : `${subject.credits} Credits`} • {subject.total_hours || 30} Hours
          </span>
          {subject.course_category === 'elective' && (
            <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              Elective: {subject.elective_domain || 'Specialization'}
            </span>
          )}
        </div>
      </div>

      {/* Hero Subject Banner */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 sm:p-8 border border-slate-200/90 dark:border-slate-800 shadow-sm relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-3xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                COURSE LEARNING PORTAL
              </span>
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                TRIMESTER {subject.trimester}
              </span>
              {subject.programs && subject.programs.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  {subject.programs.map((p: any) => p.name).join(', ')}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
              {subject.name}
            </h1>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
              {parsedSyllabus?.course_overview
                ? parsedSyllabus.course_overview.slice(0, 220).replace(/\n/g, ' ') + '...'
                : 'Access syllabus, lecture resources, lab activities, assignments, and attendance records.'}
            </p>
          </div>

          {/* Real-Time Student Attendance Card */}
          {attendance && (
            <div className="flex items-center gap-5 bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shrink-0 self-start lg:self-center shadow-xs">
              <div className="text-center px-1">
                <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{attendance.attendance_percentage}%</div>
                <div className="text-[10px] uppercase font-bold text-slate-500 mt-0.5">Attendance Rate</div>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[9.5px] font-black uppercase ${
                  attendance.attendance_percentage >= 75
                    ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                }`}>
                  {attendance.attendance_percentage >= 75 ? 'Eligible' : 'Warning'}
                </span>
              </div>
              <div className="text-center px-3 border-l border-slate-200 dark:border-slate-700 space-y-1">
                <div className="text-xl font-bold text-slate-900 dark:text-white">
                  {attendance.sessions_attended} <span className="text-slate-400 text-sm font-normal">/ {attendance.total_sessions_conducted}</span>
                </div>
                <div className="text-[10px] uppercase font-bold text-slate-500">Sessions Attended</div>
                <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">{attendance.total_sessions_conducted} Conducted</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sub-Section Header with Back Navigation (Only visible when viewing a specific tab) */}
      {activeTab !== 'overview' && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navigateToTab('overview')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-400 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer shadow-2xs"
          >
            <ChevronLeft className="h-4 w-4" /> Back to Course Overview
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Viewing section:</span>
            <span className="px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {tabs.find((t) => t.id === activeTab)?.label}
            </span>
          </div>
        </div>
      )}

      {/* TAB CONTENT AREAS */}

      {/* 1. OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Full-Width Single Row: 7 Interactive Module Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {/* 1. Syllabus Card */}
            <div
              onClick={() => navigateToTab('syllabus')}
              className="cursor-pointer rounded-2xl border border-indigo-200/90 dark:border-indigo-900/50 bg-gradient-to-b from-indigo-50/60 to-white dark:from-indigo-950/30 dark:to-slate-900 p-3.5 space-y-2.5 hover:shadow-md hover:border-indigo-400 dark:hover:border-indigo-600 transition-all flex flex-col justify-between group shadow-2xs"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="h-8 w-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-200">
                    8 Secs
                  </span>
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                    Syllabus
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug line-clamp-1 mt-0.5">
                    Curriculum & Units
                  </p>
                </div>
              </div>
              <div className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 inline-flex items-center gap-0.5 pt-1.5 border-t border-indigo-100 dark:border-indigo-900/40">
                Syllabus <ChevronRight className="h-3 w-3" />
              </div>
            </div>

            {/* 2. Session Plan Card */}
            <div
              onClick={() => navigateToTab('session_plan')}
              className="cursor-pointer rounded-2xl border border-blue-200/90 dark:border-blue-900/50 bg-gradient-to-b from-blue-50/60 to-white dark:from-blue-950/30 dark:to-slate-900 p-3.5 space-y-2.5 hover:shadow-md hover:border-blue-400 dark:hover:border-blue-600 transition-all flex flex-col justify-between group shadow-2xs"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="h-8 w-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-500/20 group-hover:scale-105 transition-transform">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200">
                    {subject.total_hours || 30}h
                  </span>
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                    Session Plan
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug line-clamp-1 mt-0.5">
                    Class Schedule
                  </p>
                </div>
              </div>
              <div className="text-[10px] font-bold text-blue-700 dark:text-blue-400 inline-flex items-center gap-0.5 pt-1.5 border-t border-blue-100 dark:border-blue-900/40">
                Schedule <ChevronRight className="h-3 w-3" />
              </div>
            </div>

            {/* 3. AI Labs Card */}
            <div
              onClick={() => navigateToTab('activities')}
              className="cursor-pointer rounded-2xl border border-amber-200/90 dark:border-amber-900/50 bg-gradient-to-b from-amber-50/60 to-white dark:from-amber-950/30 dark:to-slate-900 p-3.5 space-y-2.5 hover:shadow-md hover:border-amber-400 dark:hover:border-amber-600 transition-all flex flex-col justify-between group shadow-2xs"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="h-8 w-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm shadow-amber-500/20 group-hover:scale-105 transition-transform">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200">
                    {activities.length} Labs
                  </span>
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors line-clamp-1">
                    Learning Activities
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug line-clamp-1 mt-0.5">
                    Case Studies & Exercises
                  </p>
                </div>
              </div>
              <div className="text-[10px] font-bold text-amber-700 dark:text-amber-400 inline-flex items-center gap-0.5 pt-1.5 border-t border-amber-100 dark:border-amber-900/40">
                Activities <ChevronRight className="h-3 w-3" />
              </div>
            </div>

            {/* 4. Files & Resources Card */}
            <div
              onClick={() => navigateToTab('resources')}
              className="cursor-pointer rounded-2xl border border-purple-200/90 dark:border-purple-900/50 bg-gradient-to-b from-purple-50/60 to-white dark:from-purple-950/30 dark:to-slate-900 p-3.5 space-y-2.5 hover:shadow-md hover:border-purple-400 dark:hover:border-purple-600 transition-all flex flex-col justify-between group shadow-2xs"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="h-8 w-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-sm shadow-purple-500/20 group-hover:scale-105 transition-transform">
                    <FileText className="h-4 w-4" />
                  </div>
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-200">
                    {resources.length} Files
                  </span>
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors line-clamp-1">
                    Lecture Notes
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug line-clamp-1 mt-0.5">
                    PPTs & Resources
                  </p>
                </div>
              </div>
              <div className="text-[10px] font-bold text-purple-700 dark:text-purple-400 inline-flex items-center gap-0.5 pt-1.5 border-t border-purple-100 dark:border-purple-900/40">
                Browse <ChevronRight className="h-3 w-3" />
              </div>
            </div>

            {/* 5. Class Recordings Card */}
            <div
              onClick={() => navigateToTab('recordings')}
              className="cursor-pointer rounded-2xl border border-rose-200/90 dark:border-rose-900/50 bg-gradient-to-b from-rose-50/60 to-white dark:from-rose-950/30 dark:to-slate-900 p-3.5 space-y-2.5 hover:shadow-md hover:border-rose-400 dark:hover:border-rose-600 transition-all flex flex-col justify-between group shadow-2xs"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="h-8 w-8 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-sm shadow-rose-500/20 group-hover:scale-105 transition-transform">
                    <Video className="h-4 w-4" />
                  </div>
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200">
                    {recordings.length} Videos
                  </span>
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors line-clamp-1">
                    Recordings
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug line-clamp-1 mt-0.5">
                    Class Archives
                  </p>
                </div>
              </div>
              <div className="text-[10px] font-bold text-rose-700 dark:text-rose-400 inline-flex items-center gap-0.5 pt-1.5 border-t border-rose-100 dark:border-rose-900/40">
                Watch <ChevronRight className="h-3 w-3" />
              </div>
            </div>

            {/* 6. Assessments Card */}
            <div
              onClick={() => navigateToTab('assessments')}
              className="cursor-pointer rounded-2xl border border-emerald-200/90 dark:border-emerald-900/50 bg-gradient-to-b from-emerald-50/60 to-white dark:from-emerald-950/30 dark:to-slate-900 p-3.5 space-y-2.5 hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-600 transition-all flex flex-col justify-between group shadow-2xs"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="h-8 w-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                    <CheckSquare className="h-4 w-4" />
                  </div>
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200">
                    {assessments.length} Tasks
                  </span>
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-1">
                    Assessments
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug line-clamp-1 mt-0.5">
                    Tasks & Grading
                  </p>
                </div>
              </div>
              <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-0.5 pt-1.5 border-t border-emerald-100 dark:border-emerald-900/40">
                Tasks <ChevronRight className="h-3 w-3" />
              </div>
            </div>

            {/* 7. Attendance Card */}
            <div
              onClick={() => navigateToTab('attendance')}
              className="cursor-pointer rounded-2xl border border-cyan-200/90 dark:border-cyan-900/50 bg-gradient-to-b from-cyan-50/60 to-white dark:from-cyan-950/30 dark:to-slate-900 p-3.5 space-y-2.5 hover:shadow-md hover:border-cyan-400 dark:hover:border-cyan-600 transition-all flex flex-col justify-between group shadow-2xs"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="h-8 w-8 rounded-xl bg-cyan-600 text-white flex items-center justify-center shadow-sm shadow-cyan-500/20 group-hover:scale-105 transition-transform">
                    <CalendarCheck className="h-4 w-4" />
                  </div>
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-200">
                    {attendance ? `${attendance.attendance_percentage}%` : 'Logs'}
                  </span>
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors line-clamp-1">
                    Attendance
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug line-clamp-1 mt-0.5">
                    Presence Logs
                  </p>
                </div>
              </div>
              <div className="text-[10px] font-bold text-cyan-700 dark:text-cyan-400 inline-flex items-center gap-0.5 pt-1.5 border-t border-cyan-100 dark:border-cyan-900/40">
                Attendance <ChevronRight className="h-3 w-3" />
              </div>
            </div>
          </div>

          {/* 2-Column Content Layout (Main + Sidebar) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Column (2/3 width) */}
            <div className="lg:col-span-2 space-y-6">
            
            {/* Card 1: Executive Summary & Course Scope */}
            <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shadow-xs">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      Course Executive Summary & Academic Focus
                    </h3>
                    <p className="text-[11px] text-slate-500">Core theoretical concepts, legal frameworks, and executive decision competencies.</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Approved Syllabus v2.4
                </span>
              </div>

              {/* Course Overview Text */}
              <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-normal bg-slate-50/70 dark:bg-slate-800/40 p-4 sm:p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                {parsedSyllabus?.course_overview ? (
                  <p className="whitespace-pre-line leading-relaxed text-slate-800 dark:text-slate-200">{parsedSyllabus.course_overview}</p>
                ) : (
                  <p className="leading-relaxed text-slate-800 dark:text-slate-200">
                    This course delivers a comprehensive curriculum integrating core theoretical concepts with hands-on HyperBuild AI activities.
                    Students are evaluated across drafting assignments, real-world case labs, interactive quizzes, and session engagement.
                  </p>
                )}
              </div>
            </div>

            {/* Card 2: Teaching Units & Curriculum Roadmap */}
            {parsedSyllabus?.topics && parsedSyllabus.topics.length > 0 && (
              <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                      <Layers className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                        Teaching Units & Course Roadmap
                      </h4>
                      <p className="text-[11px] text-slate-500">Structured modular unit breakdown across 30 planned contact hours.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateToTab('syllabus')}
                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    Full Syllabus <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {parsedSyllabus.topics.map((unit: any, idx: number) => {
                    const uNum = unit.unit_number || idx + 1;
                    const rawTitle = (unit.unit_title || unit.title || unit.name || '').trim();
                    const cleanTitle = rawTitle.replace(/^Unit\s*\d+[\:\-\s]*/i, '').trim() || rawTitle || `Unit ${uNum}`;
                    const hours = unit.hours || unit.planned_hours;

                    return (
                      <div
                        key={unit.id || idx}
                        onClick={() => navigateToTab('syllabus')}
                        className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-white dark:hover:bg-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-pointer space-y-2.5 group shadow-2xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono text-[10px] font-black border border-indigo-200 dark:border-indigo-800">
                            UNIT {uNum}
                          </span>
                          {hours && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                              <Clock className="h-3 w-3 text-slate-400" /> {hours} Hours
                            </span>
                          )}
                        </div>
                        <h5 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {cleanTitle}
                        </h5>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Card 4: Assessment Scheme & Evaluation Rubrics Preview */}
            <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                    <GraduationCap className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Scheme of Assessment & Marks Allocation
                    </h4>
                    <p className="text-[11px] text-slate-500">Evaluation breakdown across continuous assessment and term-end examination.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigateToTab('syllabus')}
                  className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  View Rubrics <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/40 space-y-1 text-center">
                  <span className="text-[10px] uppercase font-extrabold text-indigo-700 dark:text-indigo-300">Continuous Assessment (CCE)</span>
                  <div className="text-2xl font-black text-indigo-700 dark:text-indigo-300">{parsedSyllabus?.cce_marks || 50} Marks</div>
                  <p className="text-[11px] text-slate-500">50% Internal Weightage</p>
                </div>
                <div className="p-4 rounded-2xl bg-cyan-50/50 dark:bg-cyan-950/30 border border-cyan-200/70 dark:border-cyan-800/40 space-y-1 text-center">
                  <span className="text-[10px] uppercase font-extrabold text-cyan-700 dark:text-cyan-300">Term End Exam (TEE)</span>
                  <div className="text-2xl font-black text-cyan-700 dark:text-cyan-300">{parsedSyllabus?.tee_marks || 50} Marks</div>
                  <p className="text-[11px] text-slate-500">50% Final Examination</p>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/40 space-y-1 text-center">
                  <span className="text-[10px] uppercase font-extrabold text-emerald-700 dark:text-emerald-300">Total Subject Weightage</span>
                  <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{parsedSyllabus?.total_marks || 100} Marks</div>
                  <p className="text-[11px] text-slate-500">Passing Threshold: 40%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column Sidebar (1/3 width) */}
          <div className="space-y-6">
            {/* Card 1: Course Details Specifications */}
            <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 shadow-sm">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <Target className="h-4 w-4 text-indigo-500" /> Course Specifications
              </h4>
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                  <span className="text-slate-500">Subject Code</span>
                  <span className="font-bold text-slate-900 dark:text-white px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">{subject.code}</span>
                </div>
                {subject.course_code && (
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                    <span className="text-slate-500">Course Code</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{subject.course_code}</span>
                  </div>
                )}
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                  <span className="text-slate-500">Term / Trimester</span>
                  <span className="font-bold text-slate-900 dark:text-white">Trimester {subject.trimester}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                  <span className="text-slate-500">Course Type</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {subject.course_category === 'elective'
                      ? `Elective (${subject.elective_domain || 'General'})`
                      : 'Core Course'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                  <span className="text-slate-500">Credit Value</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {subject.is_non_credit ? 'Non-Credit' : `${subject.credits} Credits`}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                  <span className="text-slate-500">Planned Hours</span>
                  <span className="font-bold text-slate-900 dark:text-white">{subject.total_hours || 30} Contact Hours</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                  <span className="text-slate-500">Evaluation Split</span>
                  <span className="font-bold text-slate-900 dark:text-white">50 CCE + 50 TEE (100M)</span>
                </div>
                {subject.programs && subject.programs.length > 0 && (
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                    <span className="text-slate-500">Program</span>
                    <span className="font-bold text-slate-900 dark:text-white">{subject.programs.map((p: any) => p.name).join(', ')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Card 2: Course Outcomes (COs) Summary */}
            {Array.isArray(parsedSyllabus?.course_outcomes) && parsedSyllabus.course_outcomes.length > 0 && (
              <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                      <Award className="h-4 w-4" />
                    </div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                      Course Outcomes (COs)
                    </h4>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-200">
                    {parsedSyllabus.course_outcomes.length} Outcomes
                  </span>
                </div>

                <div className="space-y-3">
                  {parsedSyllabus.course_outcomes.map((co: any, idx: number) => {
                    const coCode = co.code || `CO ${idx + 1}`;
                    const statement = co.statement || co.description || co.outcome || co.text || '';
                    const bloomsLevel = co.blooms_level || co.bloom_level || co.level || '';
                    const poKeys = ['po1', 'po2', 'po3', 'po4', 'po5'].filter(
                      (k) => co[k] && co[k] !== '-' && co[k] !== ''
                    );

                    return (
                      <div
                        key={co.id || idx}
                        className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-2 hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-mono text-[10.5px] font-black border border-purple-200 dark:border-purple-800">
                            {coCode}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {bloomsLevel && (
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/80">
                                {bloomsLevel}
                              </span>
                            )}
                            {poKeys.length > 0 && (
                              <span className="text-[9.5px] font-bold text-slate-500 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                {poKeys.map((p) => p.toUpperCase()).join(', ')}
                              </span>
                            )}
                          </div>
                        </div>

                        {statement && (
                          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
                            {statement}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => navigateToTab('syllabus')}
                  className="w-full py-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-bold transition-all text-center cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Award className="h-3.5 w-3.5" /> View CO-PO Articulation Matrix →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* 2. SYLLABUS TAB */}
      {activeTab === 'syllabus' && (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <StructuredSyllabusViewer
            syllabusRaw={subject.syllabus}
            subjectId={subject.id}
            subjectName={subject.name}
            subjectCode={subject.code}
            isStudent={isStudent}
            onEditClick={() => {
              navigate('/subjects');
            }}
          />
        </div>
      )}

      {/* 3. SESSION PLAN TAB */}
      {activeTab === 'session_plan' && <SessionPlanViewer subject={subject} />}

      {/* 4. HYPERBUILD AI ACTIVITIES TAB */}
      {activeTab === 'activities' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-500/10 border border-amber-400/30">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-950 dark:text-amber-200">HyperBuild AI Activities Hub</h4>
                <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                  {isStudent
                    ? 'Activities unlock automatically according to your class timetable schedule. Complete and submit your work for AI evaluation.'
                    : 'All course activities. Activities unlock automatically for students when their scheduled timetable session begins, or can be manually released below.'}
                </p>
              </div>
            </div>
          </div>

          {activities.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed border-amber-200/80 dark:border-amber-900/40 bg-amber-50/20 dark:bg-amber-950/10 rounded-3xl space-y-2">
              <Sparkles className="h-8 w-8 text-amber-400 mx-auto mb-1" />
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {isStudent ? 'No Activities Released Yet' : 'No Activities Found'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                {isStudent
                  ? 'Activities for this subject will automatically appear here as soon as their scheduled class session begins on your timetable.'
                  : 'No activities have been defined for this course yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((act: any) => (
                <HyperBuildActivityCard
                  key={act.id}
                  activity={act}
                  subjectId={subject.id}
                  isStudent={!!isStudent}
                  isFacultyOrAdmin={!!isFacultyOrAdmin}
                  onEdit={() => navigate('/subjects')}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. FILES & RESOURCES TAB */}
      {activeTab === 'resources' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-500" /> Course Files & Learning Resources
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Access faculty lecture slides, readings, reference materials, and study handouts.</p>
            </div>

            {isFacultyOrAdmin && (
              <button
                onClick={() => openUploadResource()}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-md shadow-purple-500/20 flex items-center gap-1.5"
              >
                <Upload className="h-3.5 w-3.5" /> Upload File / Resource
              </button>
            )}
          </div>

          {resources.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
              <FileText className="h-8 w-8 text-purple-400 mx-auto mb-2" />
              <p className="text-xs text-slate-500">No resources uploaded yet for this subject.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {resources.map((res: any) => (
                <div
                  key={res.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                        {res.resource_type}
                      </span>
                      {res.unit_number && (
                        <span className="text-[11px] font-bold text-slate-400">Unit {res.unit_number}</span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">{res.title}</h4>
                    {res.description && <p className="text-xs text-slate-500 leading-relaxed">{res.description}</p>}
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {res.file_url && (
                        <a
                          href={res.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold text-xs hover:bg-indigo-100"
                        >
                          <Download className="h-3.5 w-3.5" /> Download
                        </a>
                      )}
                      {res.external_link && (
                        <a
                          href={res.external_link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Open Link
                        </a>
                      )}
                    </div>

                    {isFacultyOrAdmin && (
                      <button
                        onClick={() => deleteResourceMutation.mutate(res.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950"
                        title="Delete Resource"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 6. RECORDINGS TAB */}
      {activeTab === 'recordings' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Video className="h-5 w-5 text-cyan-500" /> Lecture Recordings & Video Archives
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Stream and review recorded classroom sessions.</p>
            </div>

            {isFacultyOrAdmin && (
              <button
                onClick={() => openAddRecording()}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold transition-all shadow-md shadow-cyan-500/20 flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Add Recording Link
              </button>
            )}
          </div>

          {recordings.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
              <Video className="h-8 w-8 text-cyan-400 mx-auto mb-2" />
              <p className="text-xs text-slate-500">No lecture recordings added yet for this subject.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recordings.map((rec: any) => (
                <div
                  key={rec.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                        {rec.platform}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400">{rec.recording_date}</span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">{rec.title}</h4>
                    {rec.topic_covered && (
                      <p className="text-xs text-slate-500 leading-relaxed font-semibold">Topic: {rec.topic_covered}</p>
                    )}
                    {rec.duration_minutes && (
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {rec.duration_minutes} minutes
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <a
                      href={rec.recording_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs shadow-sm"
                    >
                      <Video className="h-3.5 w-3.5" /> Watch Recording
                    </a>

                    {isFacultyOrAdmin && (
                      <button
                        onClick={() => deleteRecordingMutation.mutate(rec.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950"
                        title="Delete Recording"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 7. ASSESSMENTS TAB */}
      {activeTab === 'assessments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-amber-500" /> Continuous Assessments & Assignments
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Submit tasks and view grades/feedback.</p>
            </div>

            {isFacultyOrAdmin && (
              <button
                onClick={() => openCreateAssessment()}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-md shadow-amber-500/20 flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Create Assessment
              </button>
            )}
          </div>

          {assessments.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
              <CheckSquare className="h-8 w-8 text-amber-400 mx-auto mb-2" />
              <p className="text-xs text-slate-500">No assessments published yet for this subject.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {assessments.map((ass: any) => (
                <div
                  key={ass.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 shadow-sm"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          {ass.assessment_type}
                        </span>
                        <span className="text-xs font-bold text-slate-500">Max Marks: {ass.total_marks}</span>
                        {ass.weightage_percentage && (
                          <span className="text-xs font-bold text-slate-500">• Weightage: {ass.weightage_percentage}%</span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{ass.title}</h4>
                    </div>

                    <div className="flex items-center gap-2">
                      {ass.my_submission ? (
                        <div className="text-right">
                          <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Submitted ({ass.my_submission.status})
                          </span>
                          {ass.my_submission.marks_obtained !== null && (
                            <div className="text-xs font-black text-emerald-600 mt-1">
                              Marks: {ass.my_submission.marks_obtained} / {ass.total_marks}
                            </div>
                          )}
                        </div>
                      ) : isStudent ? (
                        <button
                          onClick={() => openSubmitAssessment(ass)}
                          className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20 flex items-center gap-1.5"
                        >
                          <Send className="h-3.5 w-3.5" /> Submit Assignment
                        </button>
                      ) : null}

                      {isFacultyOrAdmin && (
                        <button
                          onClick={() => deleteAssessmentMutation.mutate(ass.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title="Delete Assessment"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {ass.description && <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{ass.description}</p>}
                  {ass.instructions && (
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                      <h5 className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 text-[10px]">
                        Submission Instructions
                      </h5>
                      <FormattedSectionText text={ass.instructions} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 8. ATTENDANCE TAB */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          {attendance ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-1">
                  <div className="text-3xl font-black text-emerald-500">{attendance.attendance_percentage}%</div>
                  <div className="text-xs uppercase font-bold text-slate-400">Overall Subject Attendance</div>
                </div>

                <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-1">
                  <div className="text-3xl font-black text-indigo-500">{attendance.sessions_attended}</div>
                  <div className="text-xs uppercase font-bold text-slate-400">Sessions Attended</div>
                </div>

                <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-1">
                  <div className="text-3xl font-black text-slate-700 dark:text-slate-300">{attendance.total_sessions_conducted}</div>
                  <div className="text-xs uppercase font-bold text-slate-400">Total Sessions Held</div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CalendarCheck className="h-5 w-5 text-emerald-500" /> Chronological Session Attendance Log
                </h3>

                {attendance.sessions_log.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No session logs recorded yet for this subject.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400">
                          <th className="py-2.5 px-3.5">Date</th>
                          <th className="py-2.5 px-3.5">Timing</th>
                          <th className="py-2.5 px-3.5">Topic Delivered</th>
                          <th className="py-2.5 px-3.5">Venue</th>
                          <th className="py-2.5 px-3.5">Attendance Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {attendance.sessions_log.map((log: any, idx: number) => (
                          <tr key={idx}>
                            <td className="py-2.5 px-3.5 font-bold text-slate-900 dark:text-white">{log.session_date}</td>
                            <td className="py-2.5 px-3.5 text-slate-500">{log.start_time} - {log.end_time}</td>
                            <td className="py-2.5 px-3.5 text-slate-800 dark:text-slate-200">{log.topic_name || 'General Lecture'}</td>
                            <td className="py-2.5 px-3.5 text-slate-500">{log.venue}</td>
                            <td className="py-2.5 px-3.5">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                  log.status === 'present'
                                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                    : log.status === 'late'
                                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                                    : log.status === 'excused' || log.status === 'leave_approved'
                                    ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                                    : log.status === 'od_duty' || log.status === 'on_duty' || log.status === 'on duty'
                                    ? 'bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300'
                                    : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                                }`}
                              >
                                {log.status === 'od_duty' ? 'ON DUTY' : log.status.replace(/_/g, ' ')}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
              <CalendarCheck className="h-8 w-8 mx-auto mb-2 text-slate-400" />
              <p className="text-xs font-semibold">Attendance view is available for enrolled students.</p>
            </div>
          )}
        </div>
      )}

      {/* 9. GRADEBOOK TAB */}
      {activeTab === 'gradebook' && (
        <SubjectGradebookTab
          subject={subject}
          isStudent={Boolean(isStudent)}
          isFacultyOrAdmin={Boolean(isFacultyOrAdmin)}
        />
      )}

      {/* --- MODALS --- */}

      {/* 1. Modal: Upload Resource */}
      {isUploadResourceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Upload className="h-4 w-4 text-purple-500" /> Upload Course Resource
              </h4>
              <button onClick={() => setIsUploadResourceOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                uploadResourceMutation.mutate();
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Resource Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Unit 1 Lecture Presentation"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  value={resTitle}
                  onChange={(e) => setResTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Type</label>
                  <select
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                    value={resType}
                    onChange={(e) => setResType(e.target.value)}
                  >
                    <option value="slides">Slides (PPT/PDF)</option>
                    <option value="document">Document / Notes</option>
                    <option value="case_study">Case Study</option>
                    <option value="link">External Resource Link</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Unit Number</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                    value={resUnit}
                    onChange={(e) => setResUnit(Number(e.target.value))}
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">File Attachment</label>
                <input
                  type="file"
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                  onChange={(e) => setResFile(e.target.files?.[0] || null)}
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">External Link (Optional)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  value={resLink}
                  onChange={(e) => setResLink(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => closeUploadResource()}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadResourceMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-md disabled:opacity-50"
                >
                  {uploadResourceMutation.isPending ? 'Uploading...' : 'Save Resource'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal: Add Recording */}
      {isAddRecordingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Video className="h-4 w-4 text-cyan-500" /> Add Lecture Recording
              </h4>
              <button onClick={() => closeAddRecording()} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                addRecordingMutation.mutate();
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Recording Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lecture 02: Contract Formation"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  value={recTitle}
                  onChange={(e) => setRecTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Recording URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://zoom.us/rec/play/..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono text-[11px]"
                  value={recUrl}
                  onChange={(e) => setRecUrl(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Platform</label>
                  <select
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                    value={recPlatform}
                    onChange={(e) => setRecPlatform(e.target.value)}
                  >
                    <option value="Zoom">Zoom</option>
                    <option value="Teams">MS Teams</option>
                    <option value="Google Drive">Google Drive</option>
                    <option value="YouTube">YouTube</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Duration (minutes)</label>
                  <input
                    type="number"
                    min={1}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                    value={recDuration}
                    onChange={(e) => setRecDuration(Number(e.target.value))}
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Topic Covered</label>
                <input
                  type="text"
                  placeholder="Key concepts discussed in this session..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  value={recTopic}
                  onChange={(e) => setRecTopic(e.target.value)}
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Passcode (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Pass@123"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono text-[11px]"
                  value={recPasscode}
                  onChange={(e) => setRecPasscode(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => closeAddRecording()}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addRecordingMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold shadow-md disabled:opacity-50"
                >
                  {addRecordingMutation.isPending ? 'Saving...' : 'Add Recording'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Modal: Submit HyperBuild AI Activity */}
      {selectedActivityForSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" /> Submit Activity {selectedActivityForSubmit.activity_no} Deliverable
                </h4>
                <p className="text-xs text-slate-500">{selectedActivityForSubmit.title}</p>
              </div>
              <button onClick={() => closeSubmitHyperbuild()} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitActivityMutation.mutate();
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Deliverable File Upload (PDF/Word/Excel)
                </label>
                <input
                  type="file"
                  required
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"
                  onChange={(e) => setSubFile(e.target.files?.[0] || null)}
                />
                {selectedActivityForSubmit.file_naming && (
                  <p className="text-[11px] text-slate-400 font-mono mt-1">
                    Required File Name Format: {selectedActivityForSubmit.file_naming}
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  AI Tool Interaction & Verification Notes
                </label>
                <textarea
                  rows={3}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white leading-relaxed"
                  placeholder="Record which AI model was used, sample prompt, and how you independently verified the AI outputs..."
                  value={aiNotes}
                  onChange={(e) => setAiNotes(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => closeSubmitHyperbuild()}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitActivityMutation.isPending}
                  className="px-6 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-md disabled:opacity-50"
                >
                  {submitActivityMutation.isPending ? 'Submitting...' : 'Submit Activity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Modal: Submit Assessment */}
      {selectedAssessmentForSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-indigo-500" /> Submit Assignment
                </h4>
                <p className="text-xs text-slate-500">{selectedAssessmentForSubmit.title}</p>
              </div>
              <button onClick={() => closeSubmitAssessment()} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitAssessmentMutation.mutate();
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Assignment File Upload (PDF/Word)
                </label>
                <input
                  type="file"
                  required
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  onChange={(e) => setSubFile(e.target.files?.[0] || null)}
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Submission Notes / Text (Optional)
                </label>
                <textarea
                  rows={3}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white leading-relaxed"
                  placeholder="Add any comments or explanatory notes for the faculty..."
                  value={subText}
                  onChange={(e) => setSubText(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => closeSubmitAssessment()}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitAssessmentMutation.isPending}
                  className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md disabled:opacity-50"
                >
                  {submitAssessmentMutation.isPending ? 'Submitting...' : 'Submit Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Modal: Create Assessment */}
      {isCreateAssessmentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="h-4 w-4 text-amber-500" /> Create New Assessment
              </h4>
              <button onClick={() => closeCreateAssessment()} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createAssessmentMutation.mutate();
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Assessment Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mid-Term Case Analysis"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  value={assTitle}
                  onChange={(e) => setAssTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Type</label>
                  <select
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                    value={assType}
                    onChange={(e) => setAssType(e.target.value)}
                  >
                    <option value="assignment">Assignment</option>
                    <option value="quiz">Quiz</option>
                    <option value="case_study">Case Study</option>
                    <option value="project">Project</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Total Marks</label>
                  <input
                    type="number"
                    min={1}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                    value={assTotalMarks}
                    onChange={(e) => setAssTotalMarks(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Weightage %</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                    value={assWeightage}
                    onChange={(e) => setAssWeightage(Number(e.target.value))}
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Due Date</label>
                <input
                  type="datetime-local"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  value={assDueDate}
                  onChange={(e) => setAssDueDate(e.target.value)}
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Instructions</label>
                <textarea
                  rows={3}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white"
                  placeholder="Task instructions and guidelines..."
                  value={assInstructions}
                  onChange={(e) => setAssInstructions(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => closeCreateAssessment()}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createAssessmentMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-md disabled:opacity-50"
                >
                  {createAssessmentMutation.isPending ? 'Creating...' : 'Create Assessment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
