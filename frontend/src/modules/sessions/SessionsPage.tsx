import { SearchableVenueSelect } from "./SearchableVenueSelect";
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Upload, AlertTriangle, Sparkles, ClipboardList,
  Check, X, Users, Plus, BookOpen, Calendar, Clock,
  Edit3, ChevronLeft, ChevronRight, LayoutList, CalendarDays, Grid, MapPin, Trash2,
  ArrowLeftRight, Shuffle, Undo2, TrendingUp, CheckCircle2, Download, AlertCircle, Zap
} from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../../components/Card';
import { DataTable, Column } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { useRoleAccess } from '../../lib/useRoleAccess';
import { useAuthStore } from '../../lib/store';
import { HyperbuildLiveConsoleModal } from './HyperbuildLiveConsoleModal';
import { StudentHyperbuildModal } from './StudentHyperbuildModal';
import { AcademicEventModal, AcademicEventItem, EVENT_CATEGORIES } from './AcademicEventModal';
import {
  Mic, ExternalLink, Eye
} from 'lucide-react';


export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  venue: string;
  mode: string;
  faculty_type: string;
  status: string;
}

export interface Session {
  id: string;
  program_id: string;
  batch_id: string;
  semester_id: string;
  subject_id: string;
  topic_id?: string;
  session_date: string;
  start_time: string;
  end_time: string;
  session_type: string;
  faculty_type: string;
  faculty_internal_id?: string;
  faculty_external_id?: string;
  venue: string;
  mode: string;
  duration_minutes: number;
  status: string;
  attendance_status?: string;
  feedback_status?: string;
  notes?: string;
  hyperbuild_activity_no?: string;
  lecture_number?: number;

  // Real-time Variance & Baseline
  variance_status?: string;
  variance_reason?: string;
  variance_recorded_at?: string;
  original_subject_id?: string;
  original_subject_name?: string;
  original_subject_code?: string;
  original_faculty_type?: string;
  original_faculty_internal_id?: string;
  original_faculty_external_id?: string;
  original_faculty_name?: string;
  original_venue?: string;

  // Enriched
  subject_name?: string;
  subject_code?: string;
  topic_name?: string;
  faculty_name?: string;
  program_name?: string;
  batch_name?: string;
  hyperbuild_activities?: Array<{
    id: string;
    activity_no: number;
    title: string;
    start_time: string;
    end_time: string;
    subject_id?: string;
    subject_name?: string;
    subject_code?: string;
    duration_minutes: number;
    submission_type?: string;
    status?: string;
  }>;
}

interface StudentAttendanceRecord {
  id?: string;
  session_id: string;
  student_id: string;
  student_name: string;
  student_prn: string;
  status: string;
  remarks?: string;
}

interface SessionAttendanceSheet {
  session_id: string;
  batch_id: string;
  batch_name?: string;
  subject_name?: string;
  session_date: string;
  start_time: string;
  end_time: string;
  venue: string;
  status: string;
  attendance_status?: string;
  total_students: number;
  present_count: number;
  absent_count: number;
  students: StudentAttendanceRecord[];
}

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode; hint?: string }> = ({
  label, required, children, hint
}) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
      {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
    </label>
    {children}
    {hint && <p className="text-[11px] text-slate-400 dark:text-slate-500">{hint}</p>}
  </div>
);

const inputClass =
  'w-full px-3 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 dark:focus:border-cyan-400 transition-all duration-150';

const selectClass =
  'w-full px-3 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 dark:focus:border-cyan-400 appearance-none cursor-pointer transition-all duration-150';

const defaultForm = {
  program_id: '',
  batch_id: '',
  semester_id: '',
  subject_id: '',
  topic_id: '',
  session_date: new Date().toISOString().split('T')[0],
  start_time: '10:00',
  end_time: '12:00',
  venue: '',
  mode: 'offline',
  session_type: 'lecture',
  faculty_type: 'internal',
  faculty_internal_id: '',
  faculty_external_id: '',
  notes: '',
  hyperbuild_activity_no: '',
  lecture_number: '' as number | string,
};

// Date helpers
const getLocalIsoDate = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  const localISOTime = (new Date(now.getTime() - offset)).toISOString().split('T')[0];
  return localISOTime;
};

const formatDisplayDate = (dStr: string) => {
  if (!dStr) return '';
  const d = new Date(dStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

const getMonday = (d: Date) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
};

const formatSessionType = (type?: string, hyperbuildNo?: string) => {
  if (!type) return 'Lecture';
  const t = type.toLowerCase();
  if (t === 'hyperbuild' || t === 'hyperbuild_lab' || t === 'hyperbuild lab') {
    return hyperbuildNo ? `HyperBuild Lab (Activity #${hyperbuildNo})` : 'HyperBuild Lab';
  }
  if (t === 'lab') return 'Practical Lab';
  if (t === 'seminar') return 'Seminar / Guest Talk';
  if (t === 'tutorial') return 'Tutorial';
  if (t === 'case_study') return 'Case Study Analysis';
  if (t === 'workshop') return 'Workshop';
  if (t === 'assessment') return 'Assessment / Quiz';
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export const SessionsPage: React.FC = () => {
  const { canScheduleSessions } = useRoleAccess();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();


  const [searchParams, setSearchParams] = useSearchParams();

  const userRoles = user?.roles || [];
  const isAdmin = Boolean(userRoles.includes('crc_admin') || userRoles.includes('crc_coordinator') || userRoles.includes('admin') || canScheduleSessions);
  const isStudent = Boolean(userRoles.includes('student') && !isAdmin);
  const isFaculty = userRoles.includes('faculty_internal') || userRoles.includes('faculty_external');
  const canMarkAttendance = !isStudent && (canScheduleSessions || isFaculty || userRoles.includes('crc_coordinator'));

  const queryView = searchParams.get('view') as 'list' | 'daily' | 'weekly' | 'calendar' | 'variance' | null;
  const queryDate = searchParams.get('date');
  const queryCalendarMode = searchParams.get('calendar_mode') as 'agenda' | 'month' | null;

  // ── View Mode: 'daily' | 'weekly' | 'list' | 'calendar' | 'variance' ───────
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'list' | 'calendar' | 'variance'>(queryView || 'daily');
  // ── Scheduled Academic Events & Milestones State ─────────────────────────
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AcademicEventItem | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<AcademicEventItem | null>(null);
  const [deleteEventLoading, setDeleteEventLoading] = useState(false);
  const [eventCategoryFilter, setEventCategoryFilter] = useState('all');
  const [eventBatchFilter, setEventBatchFilter] = useState('');
  const [eventStatusFilter, setEventStatusFilter] = useState('all');
  const [eventSearchQuery, setEventSearchQuery] = useState('');
  const [selectedPosterEvent, setSelectedPosterEvent] = useState<AcademicEventItem | null>(null);

  const { data: academicEvents = [], isLoading: isAcademicEventsLoading } = useQuery<AcademicEventItem[]>({
    queryKey: ['academic_events', eventCategoryFilter, eventBatchFilter, eventStatusFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (eventCategoryFilter && eventCategoryFilter !== 'all') params.category = eventCategoryFilter;
      if (eventBatchFilter) params.batch_id = eventBatchFilter;
      if (eventStatusFilter && eventStatusFilter !== 'all') params.status = eventStatusFilter;
      const res = await api.get('/academic-events', { params });
      return res.data.data;
    },
    enabled: viewMode === 'calendar',
  });



  const handleOpenCreateEvent = () => {
    setEditingEvent(null);
    setShowEventModal(true);
  };

  const handleOpenEditEvent = (ev: AcademicEventItem) => {
    setEditingEvent(ev);
    setShowEventModal(true);
  };

  const handleDeleteEvent = (ev: AcademicEventItem) => {
    setDeletingEvent(ev);
  };

  const confirmDeleteEvent = async () => {
    if (!deletingEvent) return;
    setDeleteEventLoading(true);
    try {
      await api.delete(`/academic-events/${deletingEvent.id}`);
      queryClient.invalidateQueries({ queryKey: ['academic_events'] });
      queryClient.invalidateQueries({ queryKey: ['calendar_events'] });
      setDeletingEvent(null);
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to delete academic event');
    } finally {
      setDeleteEventLoading(false);
    }
  };
  const [calendarMode, setCalendarMode] = useState<'agenda' | 'month'>(queryCalendarMode || 'agenda');

  // Daily View Date State
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return queryDate || getLocalIsoDate();
  });

  // Weekly View Monday Date State
  const [selectedWeekMonday, setSelectedWeekMonday] = useState<Date>(() => {
    const dateToUse = queryDate ? new Date(queryDate + 'T00:00:00') : new Date();
    return getMonday(dateToUse);
  });

  useEffect(() => {
    if (queryView && ['list', 'daily', 'weekly', 'calendar', 'variance'].includes(queryView)) {
      setViewMode(queryView);
    }
  }, [queryView]);

  useEffect(() => {
    if (queryCalendarMode && ['agenda', 'month'].includes(queryCalendarMode)) {
      setCalendarMode(queryCalendarMode);
    }
  }, [queryCalendarMode]);

  useEffect(() => {
    if (queryDate) {
      setSelectedDate(queryDate);
      setSelectedWeekMonday(getMonday(new Date(queryDate + 'T00:00:00')));
    }
  }, [queryDate]);

  const handleViewModeChange = (mode: 'daily' | 'weekly' | 'list' | 'calendar' | 'variance') => {
    setViewMode(mode);
    const next = new URLSearchParams(searchParams);
    next.set('view', mode);
    if (mode === 'calendar' && !next.has('calendar_mode')) {
      next.set('calendar_mode', calendarMode);
    }
    setSearchParams(next);
  };

  const handleCalendarModeChange = (mode: 'agenda' | 'month') => {
    setCalendarMode(mode);
    const next = new URLSearchParams(searchParams);
    next.set('view', 'calendar');
    next.set('calendar_mode', mode);
    setSearchParams(next);
  };

  const handleDateChange = (dStr: string) => {
    setSelectedDate(dStr);
    setSelectedWeekMonday(getMonday(new Date(dStr + 'T00:00:00')));
    const next = new URLSearchParams(searchParams);
    next.set('date', dStr);
    setSearchParams(next);
  };

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

  // ── Real-Time Variance Modal State ────────────────────────────────────────
  const [varianceSession, setVarianceSession] = useState<Session | null>(null);
  const [varianceMode, setVarianceMode] = useState<'faculty_substitution' | 'subject_swapped' | 'cancelled' | 'revert_as_planned'>('faculty_substitution');
  const [varianceReason, setVarianceReason] = useState<string>('');
  const [substituteFacultyType, setSubstituteFacultyType] = useState<'internal' | 'external'>('internal');
  const [substituteFacultyInternalId, setSubstituteFacultyInternalId] = useState<string>('');
  const [substituteFacultyExternalId, setSubstituteFacultyExternalId] = useState<string>('');
  const [swappedSubjectId, setSwappedSubjectId] = useState<string>('');
  const [swappedTopicId, setSwappedTopicId] = useState<string>('');
  const [newVenueInput, setNewVenueInput] = useState<string>('');
  const [varianceSaving, setVarianceSaving] = useState(false);
  const [varianceError, setVarianceError] = useState<string | null>(null);

  // Variance Analytics Filter States
  const [varianceStartDate, setVarianceStartDate] = useState<string>('');
  const [varianceEndDate, setVarianceEndDate] = useState<string>('');
  const [varianceBatchFilter, setVarianceBatchFilter] = useState<string>('');

  // ── Timetable CSV Import ──────────────────────────────────────────────────
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [csvText, setCsvText] = useState(
    'Program,Batch,Term,Date,StartTime,EndTime,SessionType,SubjectCode,Topic,FacultyType,FacultyIdentifier,Venue,Mode,DurationMinutes\n'
  );
  const [previewData, setPreviewData] = useState<any>(null);

  // ── Attendance Modal ──────────────────────────────────────────────────────
  const [attendanceSession, setAttendanceSession] = useState<Session | null>(null);
  const [attendanceSheet, setAttendanceSheet] = useState<SessionAttendanceSheet | null>(null);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>({});
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);

  // ── Schedule / Edit Session Modal ─────────────────────────────────────────
  const [showClassModal, setShowClassModal] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSaving, setCreateSaving] = useState(false);
  const [createSuccess, setCreateSuccess] = useState(false);

  // ── HyperBuild Live Command & Student Workspace State ─────────────────────
  const [hyperbuildConsoleSession, setHyperbuildConsoleSession] = useState<Session | null>(null);
  const [studentHyperbuildSession, setStudentHyperbuildSession] = useState<Session | null>(null);
    const [subjectActivitiesMap, setSubjectActivitiesMap] = useState<Record<string, any[]>>({});

  const fetchSubjectActivities = async (subjectId: string) => {
    if (!subjectId || subjectActivitiesMap[subjectId]) return;
    try {
      const res = await api.get(`/academic/subjects/${subjectId}/activities`);
      if (res.data?.data) {
        setSubjectActivitiesMap((prev) => ({ ...prev, [subjectId]: res.data.data }));
      }
    } catch {
      // fallback
    }
  };

  const [hyperbuildActivities, setHyperbuildActivities] = useState<Array<{
    activity_no: number;
    title: string;
    description?: string;
    subject_id: string;
    start_time: string;
    end_time: string;
    duration_minutes: number;
    submission_type: string;
    instructions?: string;
  }>>([]);

  // Delete session modal state (Admin only)
  const [deletingSession, setDeletingSession] = useState<Session | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Filtered dropdowns
  const [filteredBatches, setFilteredBatches] = useState<any[]>([]);
  const [filteredSubjects, setFilteredSubjects] = useState<any[]>([]);
  const [filteredTopics, setFilteredTopics] = useState<any[]>([]);

  // ── API data ───────────────────────────────────────────────────────────────
  const { data: studentProfile } = useQuery({
    queryKey: ['my-student-profile'],
    queryFn: async () => {
      const res = await api.get('/students/me');
      return res.data.data;
    },
    enabled: user?.roles?.includes('student'),
  });

  const currentBatchId = searchParams.get('batch_id') || studentProfile?.student?.batch_id;

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['sessions', currentBatchId],
    queryFn: async () => {
      const url = currentBatchId ? `/sessions?batch_id=${currentBatchId}` : '/sessions';
      const res = await api.get(url);
      return res.data.data as Session[];
    },
    enabled: !!currentBatchId || !user?.roles?.includes('student'),
  });

  const { data: programs = [] } = useQuery({
    queryKey: ['programs'],
    queryFn: async () => {
      const res = await api.get('/academic/programs');
      return res.data.data as any[];
    },
    enabled: showClassModal || showEventModal || !!varianceSession || viewMode === 'variance' || viewMode === 'calendar',
  });

  const { data: allBatches = [] } = useQuery({
    queryKey: ['batches'],
    queryFn: async () => {
      const res = await api.get('/academic/batches');
      return res.data.data as any[];
    },
    enabled: showClassModal || showEventModal || !!varianceSession || viewMode === 'variance' || viewMode === 'calendar',
  });

  const { data: allDivisions = [] } = useQuery({
    queryKey: ['all-divisions'],
    queryFn: async () => {
      const res = await api.get('/academic/divisions');
      return res.data.data as any[];
    },
    enabled: showClassModal || showEventModal || !!varianceSession || viewMode === 'variance' || viewMode === 'calendar',
  });

  const { data: allSubjects = [] } = useQuery({
    queryKey: ['all-subjects'],
    queryFn: async () => {
      const res = await api.get('/academic/subjects');
      return res.data.data as any[];
    },
    enabled: showClassModal || showEventModal || !!varianceSession || viewMode === 'variance' || viewMode === 'calendar',
  });

  const { data: facultyInternal = [] } = useQuery({
    queryKey: ['faculty-internal'],
    queryFn: async () => {
      const res = await api.get('/faculty/internal');
      return res.data.data as any[];
    },
    enabled: showClassModal || showEventModal || !!varianceSession || viewMode === 'variance' || viewMode === 'calendar',
  });

  const { data: facultyExternal = [] } = useQuery({
    queryKey: ['faculty-external'],
    queryFn: async () => {
      const res = await api.get('/faculty/external');
      return res.data.data as any[];
    },
    enabled: showClassModal || showEventModal || !!varianceSession || viewMode === 'variance' || viewMode === 'calendar',
  });

  const { data: allAllocations = [] } = useQuery({
    queryKey: ['academic-allocations'],
    queryFn: async () => {
      const res = await api.get('/academic/allocations');
      return (res.data.data || []) as any[];
    },
    enabled: showClassModal || !!varianceSession,
  });



  const { data: varianceReportData, isLoading: varianceReportLoading } = useQuery({
    queryKey: ['timetable_variance_analytics', varianceStartDate, varianceEndDate, varianceBatchFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (varianceStartDate) params.set('start_date', varianceStartDate);
      if (varianceEndDate) params.set('end_date', varianceEndDate);
      if (varianceBatchFilter) params.set('batch_id', varianceBatchFilter);
      const res = await api.get(`/sessions/variance-analytics?${params.toString()}`);
      return res.data.data;
    },
    enabled: viewMode === 'variance',
  });

  // Force Today's date on mount if no date is present in URL
  useEffect(() => {
    if (!queryDate) {
      const today = getLocalIsoDate();
      setSelectedDate(today);
      setSelectedWeekMonday(getMonday(new Date()));
      
      // Force push to URL to bypass any internal state caching
      const next = new URLSearchParams(searchParams);
      next.set('date', today);
      setSearchParams(next, { replace: true });
    }
  }, []);

  // Cascade filtering for form
  useEffect(() => {
    if (!form.program_id) { setFilteredBatches([]); return; }
    setFilteredBatches(allBatches.filter((b: any) => b.program_id === form.program_id));
  }, [form.program_id, allBatches]);

  useEffect(() => {
    if (!form.batch_id) { setFilteredSubjects([]); return; }
    const batch = allBatches.find((b: any) => b.id === form.batch_id);
    if (batch && !form.semester_id) setForm((f) => ({ ...f, semester_id: batch.semester_id }));
    (async () => {
      try {
        const res = await api.get(`/academic/subjects?batch_id=${form.batch_id}`);
        setFilteredSubjects(res.data.data);
      } catch { setFilteredSubjects([]); }
    })();
  }, [form.batch_id]);

  const handleSubjectChange = async (selectedSubjId: string) => {
    if (!selectedSubjId) {
      setForm((prev) => ({
        ...prev,
        subject_id: '',
        topic_id: '',
        lecture_number: '',
      }));
      setFilteredTopics([]);
      return;
    }

    // 1. Fetch topics
    try {
      const res = await api.get(`/academic/topics?subject_id=${selectedSubjId}`);
      setFilteredTopics(res.data.data || []);
    } catch {
      setFilteredTopics([]);
    }

    // 2. Fetch allocated faculty
    let facultyUpdates: any = {};
    if (allAllocations && allAllocations.length > 0) {
      const alloc = allAllocations.find(
        (a: any) =>
          a.subject_id === selectedSubjId &&
          (!form.batch_id || a.batch_id === form.batch_id)
      );
      if (alloc) {
        if (alloc.faculty_type === 'external' && alloc.faculty_external_id) {
          facultyUpdates = {
            faculty_type: 'external',
            faculty_external_id: alloc.faculty_external_id,
            faculty_internal_id: '',
          };
        } else if (alloc.faculty_internal_id) {
          facultyUpdates = {
            faculty_type: 'internal',
            faculty_internal_id: alloc.faculty_internal_id,
            faculty_external_id: '',
          };
        }
      }
    }

    // 3. Fetch next lecture number
    let nextLectureNumber: any = 1;
    if (form.batch_id && form.session_type !== 'hyperbuild') {
      try {
        const res = await api.get(`/sessions/next-lecture-number?batch_id=${form.batch_id}&subject_id=${selectedSubjId}`);
        if (res.data?.data?.next_lecture_number !== undefined) {
          nextLectureNumber = res.data.data.next_lecture_number;
        }
      } catch {
        nextLectureNumber = 1;
      }
    }

    // 4. Update form state atomically
    setForm((prev) => ({
      ...prev,
      subject_id: selectedSubjId,
      topic_id: '',
      lecture_number: nextLectureNumber,
      ...facultyUpdates,
    }));
  };

  // Re-calculate lecture number if batch or session_type changes
  useEffect(() => {
    if (form.batch_id && form.subject_id && form.session_type !== 'hyperbuild' && !editingSession) {
      (async () => {
        try {
          const res = await api.get(`/sessions/next-lecture-number?batch_id=${form.batch_id}&subject_id=${form.subject_id}`);
          if (res.data?.data?.next_lecture_number !== undefined) {
            setForm((prev) => ({ ...prev, lecture_number: res.data.data.next_lecture_number }));
          }
        } catch {}
      })();
    }
  }, [form.batch_id, form.session_type]);

  const calcDuration = (start: string, end: string): number => {
    if (!start || !end) return 60;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    return mins > 0 ? mins : 60;
  };

  const setField = (key: keyof typeof defaultForm, value: any) =>
    setForm((f) => ({ ...f, [key]: value }));

  // ── Time & Duration Helpers ─────────────────────────────────────────────
  const addMinutesToTime = (timeStr: string, minsToAdd: number): string => {
    if (!timeStr) return '10:45';
    const [h, m] = timeStr.split(':').map(Number);
    const total = h * 60 + m + minsToAdd;
    const newH = Math.floor(total / 60) % 24;
    const newM = total % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
  };

  const isTimeBefore = (t1: string, t2: string): boolean => {
    if (!t1 || !t2) return false;
    const [h1, m1] = t1.split(':').map(Number);
    const [h2, m2] = t2.split(':').map(Number);
    return h1 * 60 + m1 < h2 * 60 + m2;
  };

  // ── HyperBuild Activity State Handlers ────────────────────────────────────
  const handleAddHyperbuildActivity = () => {
    const nextNo = hyperbuildActivities.length + 1;
    const masterStart = form.start_time || '10:00';
    const masterEnd = form.end_time || '13:00';

    let actStart = masterStart;
    if (hyperbuildActivities.length > 0) {
      const lastAct = hyperbuildActivities[hyperbuildActivities.length - 1];
      if (lastAct.end_time && isTimeBefore(lastAct.end_time, masterEnd)) {
        actStart = lastAct.end_time;
      }
    }

    let actEnd = addMinutesToTime(actStart, 45);
    if (isTimeBefore(masterEnd, actEnd)) {
      actEnd = masterEnd;
    }

    const duration = calcDuration(actStart, actEnd);

    setHyperbuildActivities((prev) => [
      ...prev,
      {
        activity_no: nextNo,
        title: `Activity ${nextNo}`,
        subject_id: '',
        start_time: actStart,
        end_time: actEnd,
        duration_minutes: duration,
        submission_type: 'link_or_text',
        instructions: '',
      },
    ]);
  };

  const handleRemoveHyperbuildActivity = (index: number) => {
    setHyperbuildActivities((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((act, i) => ({ ...act, activity_no: i + 1 }))
    );
  };

  const handleUpdateHyperbuildActivity = (index: number, key: string, val: any) => {
    if (key === 'subject_id' && val) {
      fetchSubjectActivities(val);
    }
    setHyperbuildActivities((prev) => {
      const copy = [...prev];
      const updatedAct = { ...copy[index], [key]: val };

      // Automatically recalculate duration whenever start_time or end_time changes
      if (key === 'start_time' || key === 'end_time') {
        const s = key === 'start_time' ? val : updatedAct.start_time;
        const e = key === 'end_time' ? val : updatedAct.end_time;
        if (s && e) {
          updatedAct.duration_minutes = calcDuration(s, e);
        }
      }

      copy[index] = updatedAct;
      return copy;
    });
  };

  const handleSelectPredefinedActivity = (index: number, subjectId: string, activityId: string) => {
    const predefinedList = subjectActivitiesMap[subjectId] || [];
    const chosen = predefinedList.find((a: any) => a.id === activityId);
    if (!chosen) return;

    setHyperbuildActivities((prev) => {
      const copy = [...prev];
      const current = copy[index];
      const s = current.start_time || form.start_time || '10:00';
      const e = current.end_time || addMinutesToTime(s, 45);
      copy[index] = {
        ...current,
        subject_id: subjectId || current.subject_id,
        activity_no: chosen.activity_no || (index + 1),
        title: chosen.title || `Activity ${chosen.activity_no}`,
        instructions: chosen.instructions || chosen.submission_requirements || '',
        duration_minutes: calcDuration(s, e),
      };
      return copy;
    });
  };

  const handleOpenAddClass = (syncUrl = true) => {
    document.body.style.overflow = 'hidden';
    setEditingSession(null);
    const initialBatch = allBatches[0]?.id || '';
    const initialProg = allBatches[0]?.program_id || programs[0]?.id || '';
    setForm({
      ...defaultForm,
      program_id: initialProg,
      batch_id: initialBatch,
      session_date: selectedDate,
      session_type: 'lecture',
      lecture_number: '',
    });
    setHyperbuildActivities([]);
    setCreateError(null);
    setCreateSuccess(false);
    setShowClassModal(true);
    if (syncUrl) updateUrlModal('scheduleClass');
  };

  const handleOpenAddHyperbuild = (syncUrl = true) => {
    document.body.style.overflow = 'hidden';
    setEditingSession(null);
    const initialBatch = allBatches[0]?.id || '';
    const initialProg = allBatches[0]?.program_id || programs[0]?.id || '';
    setForm({
      ...defaultForm,
      program_id: initialProg,
      batch_id: initialBatch,
      session_date: selectedDate,
      session_type: 'hyperbuild',
      start_time: '10:00',
      end_time: '13:00',
      subject_id: '',
      topic_id: '',
      lecture_number: '',
    });
    setHyperbuildActivities([
      {
        activity_no: 1,
        title: 'Activity 1: Case Briefing & Context',
        subject_id: '',
        start_time: '10:00',
        end_time: '11:15',
        duration_minutes: 75,
        submission_type: 'link_or_text',
        instructions: '',
      },
      {
        activity_no: 2,
        title: 'Activity 2: Execution Sprint & Deliverables',
        subject_id: '',
        start_time: '11:15',
        end_time: '13:00',
        duration_minutes: 105,
        submission_type: 'link_or_text',
        instructions: '',
      }
    ]);
    setCreateError(null);
    setCreateSuccess(false);
    setShowClassModal(true);
    if (syncUrl) updateUrlModal('scheduleHyperbuild');
  };

  // ── Open Edit Class Modal ─────────────────────────────────────────────────
  const handleOpenEditClass = async (sess: Session, syncUrl = true) => {
    document.body.style.overflow = 'hidden';
    setEditingSession(sess);
    setForm({
      program_id: sess.program_id || '',
      batch_id: sess.batch_id || '',
      semester_id: sess.semester_id || '',
      subject_id: sess.subject_id || '',
      topic_id: sess.topic_id || '',
      session_date: sess.session_date,
      start_time: sess.start_time,
      end_time: sess.end_time,
      venue: sess.venue || '',
      mode: sess.mode || 'offline',
      session_type: sess.session_type || 'lecture',
      faculty_type: sess.faculty_type || 'internal',
      faculty_internal_id: sess.faculty_internal_id || '',
      faculty_external_id: sess.faculty_external_id || '',
      notes: sess.notes || '',
      hyperbuild_activity_no: sess.hyperbuild_activity_no ? String(sess.hyperbuild_activity_no) : '',
      lecture_number: sess.lecture_number !== undefined && sess.lecture_number !== null ? sess.lecture_number : '',
    });

    if (sess.session_type === 'hyperbuild') {
      try {
        const hbRes = await api.get(`/hyperbuild/sessions/${sess.id}/activities`);
        if (hbRes.data?.activities?.length) {
          setHyperbuildActivities(hbRes.data.activities.map((a: any) => ({
            activity_no: a.activity_no,
            title: a.title,
            subject_id: a.subject_id,
            start_time: a.start_time,
            end_time: a.end_time,
            duration_minutes: a.duration_minutes,
            submission_type: a.submission_type || 'link_or_text',
            instructions: a.instructions || '',
          })));
        } else {
          setHyperbuildActivities([]);
        }
      } catch {
        setHyperbuildActivities([]);
      }
    } else {
      setHyperbuildActivities([]);
    }

    setCreateError(null);
    setCreateSuccess(false);
    setShowClassModal(true);
    if (syncUrl) updateUrlModal('editClass', { id: sess.id });
  };

  const handleCloseClassModal = (syncUrl = true) => {
    document.body.style.overflow = '';
    setShowClassModal(false);
    setEditingSession(null);
    setForm(defaultForm);
    setHyperbuildActivities([]);
    setCreateError(null);
    setCreateSuccess(false);
    if (syncUrl) updateUrlModal(null);
  };

  // ── Submit Class Form (Create or Edit) ────────────────────────────────────
  const handleSaveClass = async () => {
    setCreateError(null);
    const isHyperBuild = form.session_type === 'hyperbuild';

    // Validate faculty selection
    if (form.faculty_type === 'internal' && !form.faculty_internal_id) {
      setCreateError('Please select an internal faculty member.');
      return;
    }
    if (form.faculty_type === 'external' && !form.faculty_external_id) {
      setCreateError('Please select a visiting faculty member.');
      return;
    }

    if (isHyperBuild) {
      if (!form.program_id || !form.batch_id || !form.session_date || !form.start_time || !form.end_time || !form.venue) {
        setCreateError('Please fill in all required fields.');
        return;
      }
      if (hyperbuildActivities.length === 0) {
        setCreateError('Please add at least one activity.');
        return;
      }
      for (const act of hyperbuildActivities) {
        if (!act.subject_id) {
          setCreateError(`Activity ${act.activity_no}: Please select a subject.`);
          return;
        }
        if (!act.title?.trim()) {
          setCreateError(`Activity ${act.activity_no}: Please enter an activity title.`);
          return;
        }
        if (act.start_time && act.end_time) {
          if (act.start_time < form.start_time || act.end_time > form.end_time) {
            setCreateError(`Activity ${act.activity_no} time (${act.start_time} - ${act.end_time}) must be within the class time (${form.start_time} - ${form.end_time}).`);
            return;
          }
          if (act.end_time <= act.start_time) {
            setCreateError(`Activity ${act.activity_no} end time (${act.end_time}) must be after start time (${act.start_time}).`);
            return;
          }
        }
      }
    } else {
      if (!form.program_id || !form.batch_id || !form.subject_id ||
        !form.session_date || !form.start_time || !form.end_time || !form.venue) {
        setCreateError('Please fill in all required fields.');
        return;
      }
    }

    const selectedBatch = allBatches.find((b: any) => b.id === form.batch_id);

    // Helper: convert empty/falsy/invalid strings to null for UUID fields
    const toUUID = (v: any): string | null =>
      v && typeof v === 'string' && v.trim().length > 0 && v.trim() !== 'null' && v.trim() !== 'undefined'
        ? v.trim()
        : null;

    const payload: any = {
      program_id: toUUID(form.program_id),
      batch_id: toUUID(form.batch_id),
      semester_id: toUUID(selectedBatch?.semester_id) || toUUID(form.semester_id),
      subject_id: isHyperBuild ? null : toUUID(form.subject_id),
      topic_id: isHyperBuild ? null : toUUID(form.topic_id),
      session_date: form.session_date,
      start_time: form.start_time.length === 5 ? form.start_time + ':00' : form.start_time,
      end_time: form.end_time.length === 5 ? form.end_time + ':00' : form.end_time,
      venue: form.venue,
      mode: form.mode,
      session_type: form.session_type,
      faculty_type: form.faculty_type,
      faculty_internal_id: form.faculty_type === 'internal' ? toUUID(form.faculty_internal_id) : null,
      faculty_external_id: form.faculty_type === 'external' ? toUUID(form.faculty_external_id) : null,
      duration_minutes: calcDuration(form.start_time, form.end_time),
      notes: form.notes || null,
      hyperbuild_activity_no: null,
      lecture_number: isHyperBuild
        ? null
        : (form.lecture_number !== '' && form.lecture_number !== null && form.lecture_number !== undefined
            ? parseInt(form.lecture_number as any, 10)
            : null),
    };

    setCreateSaving(true);
    try {
      let savedSessionId = editingSession?.id;
      if (editingSession) {
        await api.put(`/sessions/${editingSession.id}`, payload);
      } else {
        const createRes = await api.post('/sessions', payload);
        savedSessionId = createRes.data?.data?.id;
      }

      // If HyperBuild and activities defined, configure activities
      if (form.session_type === 'hyperbuild' && savedSessionId && hyperbuildActivities.length > 0) {
        const validActivities = hyperbuildActivities.map((a) => ({
          activity_no: a.activity_no,
          title: a.title,
          description: null,
          subject_id: toUUID(a.subject_id),
          start_time: a.start_time.length === 5 ? a.start_time + ':00' : a.start_time,
          end_time: a.end_time.length === 5 ? a.end_time + ':00' : a.end_time,
          duration_minutes: a.duration_minutes || calcDuration(a.start_time, a.end_time),
          submission_type: a.submission_type || 'link_or_text',
          instructions: a.instructions || null,
        }));
        await api.post(`/hyperbuild/sessions/${savedSessionId}/activities`, {
          activities: validActivities,
        });
      }

      setCreateSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      setTimeout(() => {
        handleCloseClassModal();
      }, 800);
    } catch (err: any) {
      const data = err.response?.data;
      let errorText = '';

      if (Array.isArray(data?.detail)) {
        // Pydantic validation error array
        errorText = data.detail
          .map((d: any) => `${d.loc ? d.loc.filter((x: any) => x !== 'body').join(' -> ') + ': ' : ''}${d.msg}`)
          .join('; ');
      } else if (typeof data?.detail === 'object' && data?.detail !== null) {
        if (data.detail.message) {
          errorText = data.detail.message;
          if (data.detail.details?.conflicting_session) {
            const cs = data.detail.details.conflicting_session;
            errorText += ` (Conflict with: ${cs.subject_name || 'Class'} from ${cs.start_time?.slice(0, 5)} to ${cs.end_time?.slice(0, 5)} in ${cs.venue})`;
          }
        } else {
          errorText = JSON.stringify(data.detail);
        }
      } else if (typeof data?.detail === 'string') {
        errorText = data.detail;
      } else if (data?.message) {
        errorText = data.message;
      } else if (err.message) {
        errorText = err.message;
      } else {
        errorText = 'Failed to save session. Please verify slot timings and faculty availability.';
      }

      setCreateError(errorText);
    } finally {
      setCreateSaving(false);
    }
  };

  // ── Open Attendance Modal ─────────────────────────────────────────────────
  const handleOpenAttendance = async (session: Session, syncUrl = true) => {
    setAttendanceSession(session);
    setAttendanceLoading(true);
    setAttendanceError(null);
    setAttendanceMap({});
    if (syncUrl) updateUrlModal('markAttendance', { id: session.id });
    try {
      const res = await api.get(`/sessions/${session.id}/attendance`);
      const sheet = res.data.data as SessionAttendanceSheet;
      setAttendanceSheet(sheet);
      const initialMap: Record<string, string> = {};
      sheet.students.forEach((st) => { initialMap[st.student_id] = st.status || 'present'; });
      setAttendanceMap(initialMap);
    } catch (err: any) {
      setAttendanceError(err.response?.data?.detail || 'Failed to load attendance sheet.');
    } finally {
      setAttendanceLoading(false);
    }
  };

  const handleCloseAttendance = (syncUrl = true) => {
    setAttendanceSession(null);
    setAttendanceSheet(null);
    setAttendanceError(null);
    if (syncUrl) updateUrlModal(null);
  };

  const handleSaveAttendance = async () => {
    if (!attendanceSession || !attendanceSheet) return;
    setAttendanceSaving(true);
    setAttendanceError(null);
    try {
      const payload = {
        attendances: Object.entries(attendanceMap).map(([student_id, status]) => ({
          student_id,
          status,
        })),
      };
      await api.post(`/sessions/${attendanceSession.id}/attendance`, payload);
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      handleCloseAttendance();
    } catch (err: any) {
      setAttendanceError(err.response?.data?.detail || 'Failed to save attendance.');
    } finally {
      setAttendanceSaving(false);
    }
  };

  const handleOpenUploadModal = (syncUrl = true) => {
    setShowUploadModal(true);
    if (syncUrl) updateUrlModal('importSessionsCsv');
  };

  const handleCloseUploadModal = (syncUrl = true) => {
    setShowUploadModal(false);
    setPreviewData(null);
    if (syncUrl) updateUrlModal(null);
  };

  // ── Real-Time Variance Handler (Admin / Staff) ────────────────────────────
  const handleOpenVarianceModal = (session: Session) => {
    setVarianceSession(session);
    setVarianceMode(session.variance_status && session.variance_status !== 'as_planned' ? (session.variance_status as any) : 'faculty_substitution');
    setVarianceReason(session.variance_reason || '');
    setSubstituteFacultyType((session.faculty_type as 'internal' | 'external') || 'internal');
    setSubstituteFacultyInternalId(session.faculty_internal_id || '');
    setSubstituteFacultyExternalId(session.faculty_external_id || '');
    setSwappedSubjectId(session.subject_id || '');
    setSwappedTopicId(session.topic_id || '');
    setNewVenueInput(session.venue || '');
    setVarianceError(null);
  };

  const handleSaveVariance = async () => {
    if (!varianceSession) return;
    if (varianceMode !== 'revert_as_planned' && !varianceReason.trim()) {
      setVarianceError('Please specify a reason for this schedule adjustment.');
      return;
    }
    if (varianceMode === 'faculty_substitution') {
      if (substituteFacultyType === 'internal' && !substituteFacultyInternalId) {
        setVarianceError('Please select a substitute internal faculty.');
        return;
      }
      if (substituteFacultyType === 'external' && !substituteFacultyExternalId) {
        setVarianceError('Please select a substitute visiting faculty.');
        return;
      }
    }
    if (varianceMode === 'subject_swapped') {
      if (!swappedSubjectId) {
        setVarianceError('Please select the replacement subject.');
        return;
      }
      if (substituteFacultyType === 'internal' && !substituteFacultyInternalId) {
        setVarianceError('Please select the faculty conducting the replacement subject.');
        return;
      }
      if (substituteFacultyType === 'external' && !substituteFacultyExternalId) {
        setVarianceError('Please select the visiting faculty conducting the replacement subject.');
        return;
      }
    }

    setVarianceSaving(true);
    setVarianceError(null);
    try {
      const payload: any = {
        variance_type: varianceMode,
        reason: varianceReason.trim() || 'Reverted to original planned schedule',
        new_venue: newVenueInput.trim() || undefined,
      };
      if (varianceMode === 'faculty_substitution' || varianceMode === 'subject_swapped') {
        payload.substitute_faculty_type = substituteFacultyType;
        if (substituteFacultyType === 'internal') {
          payload.substitute_faculty_internal_id = substituteFacultyInternalId;
        } else {
          payload.substitute_faculty_external_id = substituteFacultyExternalId;
        }
      }
      if (varianceMode === 'subject_swapped') {
        payload.swapped_subject_id = swappedSubjectId;
        payload.swapped_topic_id = swappedTopicId || undefined;
      }

      await api.post(`/sessions/${varianceSession.id}/variance`, payload);
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['calendar_events'] });
      queryClient.invalidateQueries({ queryKey: ['timetable_variance_analytics'] });
      setVarianceSession(null);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === 'object' && detail?.message) {
        setVarianceError(`${detail.message} (${detail.conflict_type || 'Schedule Conflict'})`);
      } else if (typeof detail === 'string') {
        setVarianceError(detail);
      } else {
        setVarianceError('Failed to record schedule variance.');
      }
    } finally {
      setVarianceSaving(false);
    }
  };

  const handleExportVarianceCsv = () => {
    if (!varianceReportData?.sessions_breakdown?.length) {
      alert('No variance records found for the selected filters.');
      return;
    }
    const headers = [
      'Session Date',
      'Start Time',
      'End Time',
      'Venue',
      'Batch',
      'Planned Subject',
      'Planned Faculty',
      'Actual Subject',
      'Actual Faculty',
      'Variance Status',
      'Conducted As Planned?',
      'Variance Reason',
      'Recorded At',
    ];
    const rows = varianceReportData.sessions_breakdown.map((item: any) => [
      `"${item.session_date}"`,
      `"${item.start_time}"`,
      `"${item.end_time}"`,
      `"${item.venue}"`,
      `"${item.batch_name || ''}"`,
      `"${item.planned_subject_code ? item.planned_subject_code + ' - ' : ''}${item.planned_subject_name}"`,
      `"${item.planned_faculty_name}"`,
      `"${item.actual_subject_code ? item.actual_subject_code + ' - ' : ''}${item.actual_subject_name}"`,
      `"${item.actual_faculty_name}"`,
      `"${item.variance_status}"`,
      `"${item.is_adherent ? 'YES' : 'NO'}"`,
      `"${(item.variance_reason || '').replace(/"/g, '""')}"`,
      `"${item.variance_recorded_at || ''}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `timetable_variance_report_${varianceStartDate || 'all'}_to_${varianceEndDate || 'all'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Delete session handler (Admin only)
  const handleDeleteSession = (session: Session) => {
    setDeletingSession(session);
    setDeleteError(null);
  };

  const confirmDeleteSession = async () => {
    if (!deletingSession) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await api.delete(`/sessions/${deletingSession.id}`);
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['calendar_events'] });
      queryClient.invalidateQueries({ queryKey: ['timetable_variance_analytics'] });
      setDeletingSession(null);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Failed to delete session';
      setDeleteError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setDeleteLoading(false);
    }
  };

  // Synchronize modal state with URL parameters
  const urlModal = searchParams.get('modal');
  const urlId = searchParams.get('id');

  useEffect(() => {
    if (!urlModal) {
      if (showClassModal) handleCloseClassModal(false);
      if (attendanceSession) handleCloseAttendance(false);
      if (showUploadModal) handleCloseUploadModal(false);
      return;
    }

    if (urlModal === 'scheduleClass' && !showClassModal) {
      handleOpenAddClass(false);
    } else if (urlModal === 'scheduleHyperbuild' && !showClassModal) {
      handleOpenAddHyperbuild(false);
    } else if (urlModal === 'importSessionsCsv' && !showUploadModal) {
      handleOpenUploadModal(false);
    } else if (urlId && sessions.length > 0) {
      const found = sessions.find((s) => s.id === urlId);
      if (found) {
        if (urlModal === 'editClass' && canScheduleSessions && (!showClassModal || editingSession?.id !== found.id)) {
          handleOpenEditClass(found, false);
        } else if (urlModal === 'markAttendance' && canMarkAttendance && (!attendanceSession || attendanceSession?.id !== found.id)) {
          handleOpenAttendance(found, false);
        }
      }
    }
  }, [urlModal, urlId, sessions, canScheduleSessions, canMarkAttendance]);

  // CSV Preview & Commit
  const handlePreviewCsv = async () => {
    const lines = csvText.split('\n').filter((l) => l.trim().length > 0);
    const rawRows = lines.map((line, idx) => {
      const parts = line.split(',').map((p) => p.trim());
      return {
        row_number: idx + 1,
        session_date: parts[0] || '2026-09-15',
        start_time: parts[1] || '10:00',
        end_time: parts[2] || '12:00',
        subject_code: parts[3] || 'FIN101',
        topic_title: parts[4] || 'General Session',
        faculty_email: parts[5] || 'prof@lexiconmile.com',
        faculty_type: parts[6] || 'internal',
        venue: parts[7] || 'Room 101',
        mode: parts[8] || 'offline',
      };
    });
    setPreviewData({ batch_id: '94db10f5-0e72-4765-b32d-3182562b5c29', valid_count: rawRows.length, conflict_count: 0, rows: rawRows });
  };

  // ── Table Columns ─────────────────────────────────────────────────────────
  const columns: Column<Session>[] = [
    {
      header: 'Date & Time',
      accessor: (r) => (
        <div className="text-xs whitespace-nowrap">
          <p className="font-semibold text-slate-900 dark:text-slate-100">{r.session_date}</p>
          <p className="text-slate-500 font-mono text-[11px]">
            {r.start_time?.slice(0, 5)} - {r.end_time?.slice(0, 5)} ({r.duration_minutes}m)
          </p>
        </div>
      ),
    },
    {
      header: 'Subject & Session',
      accessor: (r) => (
        <div className="text-xs space-y-0.5">
          <p className="font-bold text-slate-900 dark:text-white">
            {r.session_type === 'hyperbuild'
              ? 'HyperBuild Lab Session'
              : `${r.subject_code ? `${r.subject_code} · ` : ''}${r.subject_name || 'Academic Class'}${(r.lecture_number || r.session_type === 'lecture') ? ` (Lecture - ${r.lecture_number || 1})` : ''}`}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-500 dark:text-slate-400 font-medium">
              {formatSessionType(r.session_type, r.hyperbuild_activity_no)}
            </span>
            {r.variance_status === 'subject_swapped' && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                <Shuffle className="h-3 w-3" />
                <span>Swapped</span>
              </span>
            )}
            {r.variance_status === 'faculty_substituted' && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                <ArrowLeftRight className="h-3 w-3" />
                <span>Substituted</span>
              </span>
            )}
            {r.variance_status === 'cancelled' && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                <span>Cancelled</span>
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      header: 'Faculty & Venue',
      accessor: (r) => (
        <div className="text-xs space-y-0.5">
          <p className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[160px]">
            {r.faculty_name || (r.faculty_type === 'internal' ? 'Internal Faculty' : 'Visiting Expert')}
          </p>
          <p className="text-slate-500 dark:text-slate-400 text-[11px] truncate max-w-[160px]">
            {r.venue} <span className="capitalize text-slate-400">({r.mode})</span>
          </p>
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: (r) => <StatusBadge status={r.status} />,
    },
    ...(!isStudent ? [{
      header: 'Actions',
      accessor: (r: Session) => (
        <div className="flex items-center space-x-1 justify-end">
          {r.session_type === 'hyperbuild' && (
            <button
              onClick={() => setHyperbuildConsoleSession(r)}
              className="p-1.5 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
              title="HyperBuild Live Command Center"
            >
              <Zap className="h-3.5 w-3.5" />
            </button>
          )}
          {canScheduleSessions && (
            <button
              onClick={() => handleOpenVarianceModal(r)}
              className="p-1.5 rounded-lg text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors cursor-pointer"
              title="Record Variance (Substitute / Swap / Cancel)"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
            </button>
          )}
          {canScheduleSessions && (
            <button
              onClick={() => handleOpenEditClass(r)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Edit Scheduled Class"
            >
              <Edit3 className="h-3.5 w-3.5" />
            </button>
          )}
          {canMarkAttendance && (
            <button
              onClick={() => handleOpenAttendance(r)}
              className="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer"
              title="Mark Attendance"
            >
              <ClipboardList className="h-3.5 w-3.5" />
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => handleDeleteSession(r)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
              title="Delete Scheduled Class"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ),
    }] : [{
      header: 'Workspace',
      accessor: (r: Session) => (
        <div>
          {r.session_type === 'hyperbuild' && (
            <button
              onClick={() => setStudentHyperbuildSession(r)}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 transition-colors cursor-pointer"
            >
              Workspace
            </button>
          )}
        </div>
      ),
    }]),
  ];

  // Daily View Filtered Sessions
  const dailySessions = sessions.filter((s) => s.session_date === selectedDate);

  // Weekly View Dates (7 days: Monday through Sunday)
  const weekDays = Array.from({ length: 7 }).map((_, idx) => {
    const day = new Date(selectedWeekMonday);
    day.setDate(day.getDate() + idx);
    const dateStr = day.toISOString().split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];
    return {
      dateStr,
      dayName: day.toLocaleDateString('en-US', { weekday: 'short' }),
      formattedDate: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      isToday: dateStr === todayStr,
    };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Class Schedule & Timetable</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {isStudent
              ? 'View your daily and upcoming class timetable, lecture timings, and classrooms.'
              : 'Schedule and manage class timetables with automatic conflict detection.'}
          </p>
        </div>

        {canScheduleSessions && (
          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={() => handleOpenUploadModal()}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors shadow-xs cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5 text-slate-500" />
              <span>Import CSV</span>
            </button>
            <button
              onClick={() => handleOpenCreateEvent()}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors shadow-xs cursor-pointer"
            >
              <Calendar className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
              <span>Schedule Event</span>
            </button>
            <button
              onClick={() => handleOpenAddHyperbuild()}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors shadow-xs cursor-pointer"
            >
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <span>Schedule HyperBuild</span>
            </button>
            <button
              onClick={() => handleOpenAddClass()}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Schedule Class</span>
            </button>
          </div>
        )}
      </div>

      {/* View Mode Switcher Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-4">
        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 flex-wrap gap-1">
          <button
            onClick={() => handleViewModeChange('daily')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'daily'
                ? 'bg-white dark:bg-slate-800 text-cyan-700 dark:text-cyan-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <CalendarDays className="h-4 w-4" />
            <span>Daily View</span>
          </button>
          <button
            onClick={() => handleViewModeChange('weekly')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'weekly'
                ? 'bg-white dark:bg-slate-800 text-cyan-700 dark:text-cyan-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Grid className="h-4 w-4" />
            <span>Weekly View</span>
          </button>
          <button
            onClick={() => handleViewModeChange('list')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'list'
                ? 'bg-white dark:bg-slate-800 text-cyan-700 dark:text-cyan-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <LayoutList className="h-4 w-4" />
            <span>List Directory ({sessions.length})</span>
          </button>
          <button
            onClick={() => handleViewModeChange('calendar')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'calendar'
                ? 'bg-white dark:bg-slate-800 text-cyan-700 dark:text-cyan-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>Academic Calendar & Events</span>
          </button>
          {!isStudent && (
            <button
              onClick={() => handleViewModeChange('variance')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'variance'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40'
              }`}
            >
              <TrendingUp className="h-4 w-4" />
              <span>Plan vs Actual Variance</span>
            </button>
          )}
        </div>

        {/* Date Navigation Controls depending on View Mode */}
        {viewMode === 'daily' && (
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                const d = new Date(selectedDate + 'T00:00:00');
                d.setDate(d.getDate() - 1);
                handleDateChange(d.toISOString().split('T')[0]);
              }}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="px-3 py-1 text-xs font-semibold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-cyan-500 text-slate-900 dark:text-slate-100"
            />
            <button
              onClick={() => handleDateChange(new Date().toISOString().split('T')[0])}
              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30"
            >
              Today
            </button>
            <button
              onClick={() => {
                const d = new Date(selectedDate + 'T00:00:00');
                d.setDate(d.getDate() + 1);
                handleDateChange(d.toISOString().split('T')[0]);
              }}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {viewMode === 'weekly' && (
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                const m = new Date(selectedWeekMonday);
                m.setDate(m.getDate() - 7);
                setSelectedWeekMonday(m);
                handleDateChange(m.toISOString().split('T')[0]);
              }}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Week of {selectedWeekMonday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <button
              onClick={() => {
                const todayMon = getMonday(new Date());
                setSelectedWeekMonday(todayMon);
                handleDateChange(todayMon.toISOString().split('T')[0]);
              }}
              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30"
            >
              This Week
            </button>
            <button
              onClick={() => {
                const m = new Date(selectedWeekMonday);
                m.setDate(m.getDate() + 7);
                setSelectedWeekMonday(m);
                handleDateChange(m.toISOString().split('T')[0]);
              }}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {viewMode === 'calendar' && (
          <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => handleCalendarModeChange('agenda')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                calendarMode === 'agenda'
                  ? 'bg-cyan-600 dark:bg-cyan-500 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Agenda View
            </button>
            <button
              onClick={() => handleCalendarModeChange('month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                calendarMode === 'month'
                  ? 'bg-cyan-600 dark:bg-cyan-500 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Month Grid
            </button>
          </div>
        )}
      </div>

      {/* ── DAILY TIMETABLE VIEW ────────────────────────────────────────────── */}
      {viewMode === 'daily' && (
        <Card title={`Daily Class Timetable — ${formatDisplayDate(selectedDate)}`}>
          {dailySessions.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Calendar className="h-10 w-10 text-slate-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No classes scheduled for {formatDisplayDate(selectedDate)}.</p>
              {canScheduleSessions && (
                <button
                  onClick={() => handleOpenAddClass()}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-cyan-600 text-white hover:bg-cyan-700 transition-colors"
                >
                  + Schedule Class for this Day
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {dailySessions.map((sess) => {
                const isHyper = sess.session_type === 'hyperbuild';
                return (
                <div
                  key={sess.id}
                  className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                    isHyper
                      ? 'border-amber-200 dark:border-amber-900/60 hover:border-amber-400 bg-amber-50/10 dark:bg-amber-950/10'
                      : 'border-slate-200 dark:border-slate-800 hover:border-cyan-500/40'
                  }`}
                >
                  <div className="flex items-start space-x-4">
                    <div className={`p-3 rounded-xl border text-center min-w-[105px] ${
                      isHyper
                        ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400'
                        : 'bg-cyan-50 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/30 text-cyan-600 dark:text-cyan-400'
                    }`}>
                      {isHyper ? (
                        <Zap className="h-4 w-4 mx-auto mb-1 fill-amber-500 text-amber-500" />
                      ) : (
                        <Clock className="h-4 w-4 mx-auto mb-1" />
                      )}
                      <p className="font-mono text-xs font-bold">{sess.start_time?.slice(0, 5)} - {sess.end_time?.slice(0, 5)}</p>
                      <p className="text-[10px] text-slate-500 font-medium">{sess.duration_minutes} mins</p>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-2 flex-wrap gap-1">
                        <span className="font-bold text-slate-900 dark:text-white text-base">
                          {isHyper
                            ? 'HyperBuild Lab Session'
                            : `${sess.subject_code ? `${sess.subject_code} · ` : ''}${sess.subject_name || 'Academic Class'}${(sess.lecture_number || sess.session_type === 'lecture') ? ` (Lecture - ${sess.lecture_number || 1})` : ''}`}
                        </span>
                        <StatusBadge status={sess.status} />
                      </div>

                      <div className="text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1.5 flex-wrap">
                        {isHyper ? (
                          <div className="flex flex-wrap items-center gap-2">
                            {sess.hyperbuild_activities && sess.hyperbuild_activities.length > 0 ? (
                              sess.hyperbuild_activities.map((act) => (
                                <span
                                  key={act.id || act.activity_no}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-semibold"
                                >
                                  <span>{act.subject_name || act.subject_code || 'Subject'} - Activity {act.activity_no}</span>
                                  <span className="font-mono text-[11px] text-amber-700 dark:text-amber-400 font-normal">
                                    ({act.start_time?.slice(0, 5)} - {act.end_time?.slice(0, 5)})
                                  </span>
                                </span>
                              ))
                            ) : (
                              <span className="inline-flex items-center gap-1 font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800 text-[11px]">
                                <Zap className="h-3 w-3 fill-amber-500 text-amber-500" />
                                HyperBuild Lab Session
                              </span>
                            )}
                          </div>
                        ) : (
                          <>
                            <span className="inline-flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800 text-[11px]">
                              <BookOpen className="h-3 w-3" />
                              {formatSessionType(sess.session_type, sess.hyperbuild_activity_no)}
                            </span>
                            {sess.topic_name && (
                              <span className="text-slate-500 dark:text-slate-400 font-normal">
                                · Topic: <strong className="text-slate-700 dark:text-slate-200">{sess.topic_name}</strong>
                              </span>
                            )}
                          </>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs text-slate-500">
                        <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                          <Users className="h-3.5 w-3.5 text-indigo-500" />
                          <span>{sess.faculty_name || (sess.faculty_type === 'internal' ? 'Internal Faculty' : 'Visiting Expert')}</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] uppercase font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {sess.faculty_type}
                          </span>
                        </span>
                        <span>•</span>
                        <span className="font-medium text-cyan-700 dark:text-cyan-400 flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-cyan-500" />
                          <span>{sess.venue}</span>
                          <span className="text-slate-400 font-normal">({sess.mode})</span>
                        </span>
                        {sess.notes && !isHyper && (
                          <>
                            <span>•</span>
                            <span className="text-slate-400 dark:text-slate-500 italic truncate max-w-xs">{sess.notes}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 self-end md:self-center">
                    {sess.session_type === 'hyperbuild' && (
                      isStudent ? (
                        <button
                          onClick={() => setStudentHyperbuildSession(sess)}
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-extrabold rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-sm transition-all cursor-pointer"
                        >
                          <Zap className="h-3.5 w-3.5" />
                          <span>HyperBuild Workspace</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => setHyperbuildConsoleSession(sess)}
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm transition-colors cursor-pointer"
                          title="Open HyperBuild Live Classroom Command Center"
                        >
                          <Zap className="h-3.5 w-3.5" />
                          <span>Live Console</span>
                        </button>
                      )
                    )}
                    {canScheduleSessions && (
                      <button
                        onClick={() => handleOpenVarianceModal(sess)}
                        className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 transition-colors"
                        title="Record Variance (Substitute / Swap / Cancel / Revert)"
                      >
                        <ArrowLeftRight className="h-3.5 w-3.5" />
                        <span>Substitute/Swap</span>
                      </button>
                    )}
                    {canScheduleSessions && (
                      <button
                        onClick={() => handleOpenEditClass(sess)}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      >
                        <Edit3 className="h-3.5 w-3.5 text-cyan-500" />
                        <span>Edit Class</span>
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteSession(sess)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 transition-colors"
                        title="Delete Class (Admin Only)"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete</span>
                      </button>
                    )}
                    {canMarkAttendance && (
                      <button
                        onClick={() => handleOpenAttendance(sess)}
                        className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
                      >
                        <ClipboardList className="h-3.5 w-3.5" />
                        <span>Mark Attendance</span>
                      </button>
                    )}
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </Card>
      )}

      {/* ── WEEKLY TIMETABLE VIEW ────────────────────────────────────────────── */}
      {viewMode === 'weekly' && (
        <Card title="Weekly Class Timetable (Monday – Sunday)">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {weekDays.map((wd) => {
              const daySessions = sessions
                .filter((s) => s.session_date === wd.dateStr)
                .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

              return (
                <div
                  key={wd.dateStr}
                  className={`flex flex-col min-h-[420px] rounded-2xl border p-2.5 transition-all ${
                    wd.isToday
                      ? 'bg-cyan-50/30 dark:bg-cyan-950/20 border-cyan-300 dark:border-cyan-800/60 shadow-xs'
                      : 'bg-slate-50/70 dark:bg-slate-950/60 border-slate-200/80 dark:border-slate-800'
                  }`}
                >
                  {/* Column Header */}
                  <div className="pb-2 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <span className={`text-xs font-bold uppercase ${wd.isToday ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-800 dark:text-slate-200'}`}>
                        {wd.dayName}
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        {wd.formattedDate}
                      </p>
                    </div>
                    {daySessions.length > 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {daySessions.length}
                      </span>
                    )}
                  </div>

                  {/* Sessions Container */}
                  <div className="space-y-2 mt-2 flex-1 max-h-[640px] overflow-y-auto pr-0.5">
                    {daySessions.length === 0 ? (
                      <div className="flex items-center justify-center h-48 text-center">
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">No classes</p>
                      </div>
                    ) : (
                      daySessions.map((s) => (
                        <div
                          key={s.id}
                          className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1.5 transition-all hover:border-slate-300 dark:hover:border-slate-700"
                        >
                          {/* Time & Session Type */}
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono text-[10px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                              {s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}
                            </span>
                            {s.session_type === 'hyperbuild' && (
                              <span className="text-[9px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200/60 dark:border-amber-800/40">
                                HyperBuild
                              </span>
                            )}
                          </div>

                          {/* Subject Code & Name */}
                          <div>
                            <p className="font-bold text-xs text-slate-900 dark:text-white leading-snug">
                              {s.session_type === 'hyperbuild'
                                ? 'HyperBuild Lab Session'
                                : `${s.subject_code ? `${s.subject_code} · ` : ''}${s.subject_name || 'Academic Class'}${(s.lecture_number || s.session_type === 'lecture') ? ` (Lecture - ${s.lecture_number || 1})` : ''}`}
                            </p>
                          </div>

                          {/* Faculty */}
                          {s.faculty_name && (
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                              {s.faculty_name}
                            </p>
                          )}

                          {/* Venue & Mode */}
                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/60 text-[10px] text-slate-500">
                            <span className="font-medium text-slate-600 dark:text-slate-400 truncate max-w-[120px]" title={s.venue}>
                              {s.venue}
                            </span>
                            <span className="capitalize font-medium text-slate-400">
                              {s.mode}
                            </span>
                          </div>

                          {/* Weekly Card Quick Action Toolbar */}
                          {(isAdmin || canScheduleSessions) && (
                            <div className="flex items-center justify-end gap-1 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleOpenVarianceModal(s); }}
                                className="p-1 rounded text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                                title="Substitute / Swap / Adjust"
                              >
                                <ArrowLeftRight className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleOpenEditClass(s); }}
                                className="p-1 rounded text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-950/40"
                                title="Edit Class"
                              >
                                <Edit3 className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleDeleteSession(s); }}
                                className="p-1 rounded text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                title="Delete Class"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── LIST VIEW ───────────────────────────────────────────────────────── */}
      {viewMode === 'list' && (
        <Card title="Master Session Directory">
          {isLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-4">Loading timetable sessions...</p>
          ) : (
            <DataTable
              columns={columns}
              data={sessions}
              keyExtractor={(r) => r.id}
              emptyMessage="No sessions scheduled yet."
            />
          )}
        </Card>
      )}

      {/* ── ACADEMIC CALENDAR & EVENTS VIEW (COMPREHENSIVE CRUD HUB) ──────────── */}
      {viewMode === 'calendar' && (
        <div className="space-y-6">
          {/* Header Card with Filters & Action */}
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
                    <Calendar className="h-5 w-5" />
                  </span>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    Scheduled Academic Events & Milestones
                  </h2>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Institutional timetable registry for masterclasses, examinations, workshops, industrial visits, placement drives, and capstone deadlines outside regular classes.
                </p>
              </div>

              {canScheduleSessions && (
                <button
                  onClick={handleOpenCreateEvent}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-purple-500/20 transition-all cursor-pointer shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  <span>Schedule Academic Event / Milestone</span>
                </button>
              )}
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
              {/* Category Filter */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Event Category
                </label>
                <select
                  value={eventCategoryFilter}
                  onChange={(e) => setEventCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold outline-none cursor-pointer"
                >
                  <option value="all">All Event Categories</option>
                  {EVENT_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Batch Filter */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Batch / Cohort
                </label>
                <select
                  value={eventBatchFilter}
                  onChange={(e) => setEventBatchFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold outline-none cursor-pointer"
                >
                  <option value="">All Batches / Cohorts</option>
                  {allBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Event Status
                </label>
                <select
                  value={eventStatusFilter}
                  onChange={(e) => setEventStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold outline-none cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="scheduled">Scheduled (Upcoming)</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="postponed">Postponed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* Search Box */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Search by Title / Speaker
                </label>
                <input
                  type="text"
                  placeholder="Filter events..."
                  value={eventSearchQuery}
                  onChange={(e) => setEventSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium outline-none focus:border-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Events Grid / List Display */}
          {isAcademicEventsLoading ? (
            <div className="p-16 text-center text-slate-500">
              <Sparkles className="h-8 w-8 animate-spin mx-auto mb-2 text-purple-500" />
              <p className="text-xs font-bold">Loading Academic Events & Milestones...</p>
            </div>
          ) : (() => {
            const filteredEvents = academicEvents.filter((ev) => {
              if (!eventSearchQuery.trim()) return true;
              const q = eventSearchQuery.toLowerCase();
              return (
                ev.title.toLowerCase().includes(q) ||
                (ev.speaker_guest_details && ev.speaker_guest_details.toLowerCase().includes(q)) ||
                (ev.organizer_name && ev.organizer_name.toLowerCase().includes(q)) ||
                (ev.venue && ev.venue.toLowerCase().includes(q)) ||
                (ev.description && ev.description.toLowerCase().includes(q))
              );
            });

            if (filteredEvents.length === 0) {
              return (
                <div className="p-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900 space-y-3">
                  <Calendar className="mx-auto h-12 w-12 text-purple-400/60" />
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    No Scheduled Academic Events Found
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    {eventCategoryFilter !== 'all' || eventBatchFilter || eventSearchQuery
                      ? 'No events match your active filters. Try clearing or broadening your criteria.'
                      : 'Schedule guest lectures, workshop series, midterm/endterm exam timetables, or capstone review milestones.'}
                  </p>
                  {canScheduleSessions && (
                    <button
                      onClick={handleOpenCreateEvent}
                      className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Schedule New Event Now</span>
                    </button>
                  )}
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredEvents.map((ev) => {
                  const catConfig = EVENT_CATEGORIES.find((c) => c.value === ev.event_category);
                  const catLabel = catConfig?.label || ev.event_category.replace(/_/g, ' ');

                  const isMultiDay = ev.end_date && ev.end_date !== ev.start_date;

                  return (
                    <div
                      key={ev.id}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                    >
                      <div className="space-y-3">
                        {/* Poster Banner / Creative Thumbnail */}
                        {ev.poster_url && (
                          <div
                            onClick={() => setSelectedPosterEvent(ev)}
                            className="relative group/poster cursor-pointer overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-black/10 h-36 flex items-center justify-center -mx-1 -mt-1 shadow-sm"
                          >
                            <img
                              src={ev.poster_url.startsWith('http') ? ev.poster_url : `${api.defaults.baseURL || ''}${ev.poster_url}`}
                              alt={ev.title}
                              className="w-full h-full object-cover group-hover/poster:scale-105 transition-all duration-300"
                              onError={(e: any) => {
                                e.target.style.display = 'none';
                              }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-80 group-hover/poster:opacity-95 transition-opacity flex items-end justify-between p-3 text-white">
                              <span className="text-[10px] font-medium uppercase tracking-wider bg-black/50 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/20">
                                Creative
                              </span>
                              <span className="text-[11px] font-medium flex items-center gap-1 text-white/90">
                                <Eye className="h-3.5 w-3.5" /> View Creative
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Top Category Badge & Status Pill */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {catLabel}
                          </span>

                          <StatusBadge status={ev.status} />
                        </div>

                        {/* Title */}
                        <div>
                          <h3 className="text-sm font-black text-slate-900 dark:text-white leading-snug group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                            {ev.title}
                          </h3>
                        </div>

                        {/* Speaker / Guest Details */}
                        {ev.speaker_guest_details && (
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50/50 dark:bg-purple-950/30 px-2.5 py-1.5 rounded-xl border border-purple-100 dark:border-purple-900/50">
                            <Mic className="h-3.5 w-3.5 shrink-0 text-purple-600 dark:text-purple-400" />
                            <span className="truncate">{ev.speaker_guest_details}</span>
                          </div>
                        )}

                        {/* Date & Time Chips */}
                        <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 pt-1">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                            <span className="font-bold">
                              {ev.start_date}
                              {isMultiDay ? ` to ${ev.end_date}` : ''}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span>
                              {ev.is_all_day
                                ? 'All Day Milestone'
                                : `${ev.start_time ? ev.start_time.slice(0, 5) : '09:00'} - ${ev.end_time ? ev.end_time.slice(0, 5) : '17:00'}`}
                            </span>
                          </div>

                          {ev.venue && (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span className="font-medium truncate">{ev.venue}</span>
                              <span className="text-[10px] uppercase font-bold text-slate-400">
                                ({ev.mode})
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Description snippet */}
                        {ev.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed pt-1">
                            {ev.description}
                          </p>
                        )}
                      </div>

                      {/* Footer: Scope & Action Buttons */}
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="font-semibold text-slate-500 truncate">
                            {ev.batch_name || ev.program_name || 'All Batches (Institute-Wide)'}
                          </span>

                          <span
                            className={`px-2 py-0.5 rounded-md font-bold uppercase text-[10px] ${
                              ev.is_mandatory
                                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                            }`}
                          >
                            {ev.is_mandatory ? 'Mandatory' : 'Optional'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1">
                          {ev.registration_link ? (
                            <a
                              href={ev.registration_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline"
                            >
                              <span>Join / Register</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400 font-medium">
                              {ev.organizer_name || 'Academic Cell'}
                            </span>
                          )}

                          {canScheduleSessions && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleOpenEditEvent(ev)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors cursor-pointer"
                                title="Edit Academic Event"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              {isAdmin && (
                                <button
                                  onClick={() => handleDeleteEvent(ev)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                  title="Delete / Cancel Event"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── TIMETABLE VARIANCE & PLAN ADHERENCE VIEW ───────────────────────── */}
      {viewMode === 'variance' && (
        <div className="space-y-6">
          {/* Variance Header Card with Filter Bar & Export */}
          <Card
            title="Timetable Plan Adherence & Variance Analytics"
            action={
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={handleExportVarianceCsv}
                  className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export Variance Report (CSV)</span>
                </button>
              </div>
            }
          >
            {/* Filter controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 pb-4 border-b border-slate-200 dark:border-slate-800 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Filter by Batch</label>
                <select
                  value={varianceBatchFilter}
                  onChange={(e) => setVarianceBatchFilter(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                >
                  <option value="">All Batches</option>
                  {allBatches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">From Date</label>
                <input
                  type="date"
                  value={varianceStartDate}
                  onChange={(e) => setVarianceStartDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">To Date</label>
                <input
                  type="date"
                  value={varianceEndDate}
                  onChange={(e) => setVarianceEndDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                />
              </div>
            </div>

            {/* KPI Summary Cards */}
            {varianceReportLoading ? (
              <div className="py-8 text-center text-xs text-slate-500">Loading timetable variance analytics...</div>
            ) : varianceReportData ? (
              <div className="space-y-6 pt-4">
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  {/* Adherence Rate */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-200 dark:border-indigo-500/30">
                    <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Plan Adherence</p>
                    <p className={`text-2xl font-extrabold mt-1 ${
                      varianceReportData.adherence_percentage >= 90 ? 'text-emerald-600 dark:text-emerald-400' :
                      varianceReportData.adherence_percentage >= 75 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {varianceReportData.adherence_percentage}%
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Classes as planned</p>
                  </div>

                  {/* Total Planned */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Sessions</p>
                    <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">{varianceReportData.total_planned_sessions}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Scheduled slots</p>
                  </div>

                  {/* As Planned */}
                  <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40">
                    <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">As Planned</p>
                    <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">{varianceReportData.conducted_as_planned}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Zero deviations</p>
                  </div>

                  {/* Faculty Substituted */}
                  <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
                    <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Faculty Substituted</p>
                    <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">{varianceReportData.faculty_substituted}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Same subject</p>
                  </div>

                  {/* Subject Swapped */}
                  <div className="p-4 rounded-2xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40">
                    <p className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Subject Swapped</p>
                    <p className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 mt-1">{varianceReportData.subject_swapped}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Curriculum adjusted</p>
                  </div>

                  {/* Cancelled */}
                  <div className="p-4 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40">
                    <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Cancelled</p>
                    <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">{varianceReportData.cancelled_sessions + varianceReportData.rescheduled_sessions}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Classes dropped</p>
                  </div>
                </div>

                {/* Plan vs. Actual Comparison Matrix Table */}
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Date & Time</th>
                        <th className="py-3 px-4">Batch / Venue</th>
                        <th className="py-3 px-4">Original Planned Schedule</th>
                        <th className="py-3 px-4">Actual Conducted Reality</th>
                        <th className="py-3 px-4">Variance Status</th>
                        <th className="py-3 px-4">Deviation Reason</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-950/40">
                      {varianceReportData.sessions_breakdown.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400 italic">No scheduled session records match the selected filter.</td>
                        </tr>
                      ) : (
                        varianceReportData.sessions_breakdown.map((item: any) => (
                          <tr key={item.session_id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                            <td className="py-3 px-4 font-mono">
                              <p className="font-bold text-slate-900 dark:text-white">{item.session_date}</p>
                              <p className="text-[11px] text-slate-500">{item.start_time} - {item.end_time}</p>
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-semibold text-slate-800 dark:text-slate-200">{item.batch_name || 'Cohort'}</p>
                              <p className="text-[11px] text-slate-500">{item.venue}</p>
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-semibold text-slate-900 dark:text-slate-100">
                                {item.planned_subject_code ? `${item.planned_subject_code} · ` : ''}{item.planned_subject_name}
                              </p>
                              <p className="text-[11px] text-slate-500">👨‍🏫 {item.planned_faculty_name}</p>
                            </td>
                            <td className="py-3 px-4">
                              <p className={`font-semibold ${item.planned_subject_name !== item.actual_subject_name ? 'text-purple-600 dark:text-purple-400' : 'text-slate-900 dark:text-slate-100'}`}>
                                {item.actual_subject_code ? `${item.actual_subject_code} · ` : ''}{item.actual_subject_name}
                              </p>
                              <p className={`text-[11px] ${item.planned_faculty_name !== item.actual_faculty_name ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-slate-500'}`}>
                                👨‍🏫 {item.actual_faculty_name}
                              </p>
                            </td>
                            <td className="py-3 px-4">
                              {item.variance_status === 'as_planned' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                                  <CheckCircle2 className="h-3 w-3" />
                                  <span>As Planned</span>
                                </span>
                              )}
                              {item.variance_status === 'faculty_substituted' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                                  <ArrowLeftRight className="h-3 w-3" />
                                  <span>Faculty Substituted</span>
                                </span>
                              )}
                              {item.variance_status === 'subject_swapped' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                                  <Shuffle className="h-3 w-3" />
                                  <span>Subject Swapped</span>
                                </span>
                              )}
                              {item.variance_status === 'cancelled' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                                  <span>Cancelled</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-[11px]">
                              {item.variance_reason ? (
                                <p className="italic">"{item.variance_reason}"</p>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {canScheduleSessions && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const orig = sessions.find((s) => s.id === item.session_id);
                                    if (orig) handleOpenVarianceModal(orig);
                                  }}
                                  className="p-1.5 rounded-lg text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 border border-purple-200 dark:border-purple-800 transition-colors text-xs font-semibold inline-flex items-center gap-1"
                                >
                                  <ArrowLeftRight className="h-3.5 w-3.5" />
                                  <span>Adjust</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </Card>
        </div>
      )}

      {/* ── MODAL: SCHEDULE / EDIT CLASS ──────────────────────────────────── */}
      {showClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="schedule-class-title">
          <div className="glass-panel w-full max-w-2xl rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                {form.session_type === 'hyperbuild' ? (
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                    <Zap className="h-5 w-5 fill-amber-500 text-amber-500" />
                  </div>
                ) : (
                  <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-500">
                    <BookOpen className="h-5 w-5 text-cyan-500" />
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {form.session_type === 'hyperbuild'
                      ? (editingSession ? 'Edit HyperBuild Lab' : 'Schedule HyperBuild Lab')
                      : (editingSession ? 'Edit Academic Class' : 'Schedule Academic Class')}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {form.session_type === 'hyperbuild'
                      ? 'Configure master lab slot and sequential modular activities with multi-subject credit.'
                      : 'Schedule standard lectures, tutorials, and practical labs with timetable conflict prevention.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowClassModal(false)}
                className="p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {createError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-start space-x-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{createError}</span>
              </div>
            )}

            {createSuccess && (
              <div className="mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs flex items-center space-x-2">
                <Check className="h-4 w-4" />
                <span>Class {editingSession ? 'updated' : 'scheduled'} successfully without timetable conflicts.</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveClass();
              }}
              className="space-y-4 my-4 text-xs"
            >
              {/* Session Type & Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {form.session_type === 'hyperbuild' ? (
                  <Field label="Session Type">
                    <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-xs flex items-center gap-2 h-[38px]">
                      <Zap className="h-4 w-4 fill-amber-500 text-amber-500" />
                      <span>HyperBuild Lab (Modular Activities)</span>
                    </div>
                  </Field>
                ) : (
                  <Field label="Session Type" required>
                    <select
                      value={form.session_type}
                      onChange={(e) => setField('session_type', e.target.value)}
                      className={selectClass}
                    >
                      <option value="lecture">Lecture</option>
                      <option value="tutorial">Tutorial</option>
                      <option value="lab">Practical Lab</option>
                      <option value="seminar">Seminar</option>
                      <option value="case_discussion">Case Discussion</option>
                      <option value="assessment">Assessment</option>
                    </select>
                  </Field>
                )}

                <Field label="Delivery Mode">
                  <select
                    value={form.mode}
                    onChange={(e) => setField('mode', e.target.value)}
                    className={selectClass}
                  >
                    <option value="offline">Offline (In-Person)</option>
                    <option value="online">Online (Virtual)</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </Field>
              </div>

              {/* Program & Batch */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Program" required>
                  <select
                    value={form.program_id}
                    onChange={(e) => setField('program_id', e.target.value)}
                    className={selectClass}
                    required
                  >
                    <option value="">Select Program</option>
                    {programs.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Batch" required hint={!form.program_id ? 'Select a program first' : undefined}>
                  <select
                    value={form.batch_id}
                    onChange={(e) => {
                      const bId = e.target.value;
                      setField('batch_id', bId);
                      if (bId && form.subject_id && form.session_type !== 'hyperbuild' && !editingSession) {
                        fetchNextLectureNumber(bId, form.subject_id);
                      }
                    }}
                    className={selectClass}
                    disabled={!form.program_id}
                    required
                  >
                    <option value="">Select Batch</option>
                    {filteredBatches.map((b: any) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </Field>
              </div>

              {/* Standard Class only: Subject, Lecture Number & Topic */}
              {form.session_type !== 'hyperbuild' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Subject" required hint={!form.batch_id ? 'Select a batch first' : undefined}>
                      <select
                        value={form.subject_id}
                        onChange={(e) => handleSubjectChange(e.target.value)}
                        className={selectClass}
                        disabled={!form.batch_id}
                        required
                      >
                        <option value="">Select Subject</option>
                        {filteredSubjects.map((s: any) => (
                          <option key={s.id} value={s.id}>{s.code ? `${s.code} · ` : ''}{s.name}</option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Lecture Number" required hint="Auto-increments for this subject">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Lecture -</span>
                        <input
                          type="number"
                          min={1}
                          value={form.lecture_number !== undefined && form.lecture_number !== null ? form.lecture_number : ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setField('lecture_number', val === '' ? '' : parseInt(val, 10));
                          }}
                          placeholder="Auto"
                          className={inputClass}
                          required
                        />
                      </div>
                    </Field>
                  </div>

                  <Field label="Topic (Optional)" hint={!form.subject_id ? 'Select a subject first' : undefined}>
                    <select
                      value={form.topic_id}
                      onChange={(e) => setField('topic_id', e.target.value)}
                      className={selectClass}
                      disabled={!form.subject_id}
                    >
                      <option value="">Select Topic</option>
                      {filteredTopics.map((t: any) => (
                        <option key={t.id} value={t.id}>{t.title}</option>
                      ))}
                    </select>
                  </Field>
                </>
              )}

              {/* Date & Time Slot */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Date" required>
                  <input
                    type="date"
                    value={form.session_date}
                    onChange={(e) => setField('session_date', e.target.value)}
                    className={inputClass}
                    required
                  />
                </Field>

                <Field label="Start Time" required>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setField('start_time', e.target.value)}
                    className={inputClass}
                    required
                  />
                </Field>

                <Field label="End Time" required>
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={(e) => setField('end_time', e.target.value)}
                    className={inputClass}
                    required
                  />
                </Field>
              </div>

              {/* Venue & Faculty Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Venue" required>
                  <SearchableVenueSelect
                    value={form.venue}
                    onChange={(val) => setField('venue', val)}
                    placeholder="Select or search classroom / lab / hall"
                    required
                  />
                </Field>

                <Field label="Faculty Category" required>
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setField('faculty_type', 'internal');
                        setField('faculty_external_id', '');
                      }}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        form.faculty_type === 'internal'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-500'
                      }`}
                    >
                      Internal
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setField('faculty_type', 'external');
                        setField('faculty_internal_id', '');
                      }}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        form.faculty_type === 'external'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-500'
                      }`}
                    >
                      Visiting
                    </button>
                  </div>
                </Field>
              </div>

              {/* Faculty Member */}
              <div>
                {form.faculty_type === 'internal' ? (
                  <Field label="Internal Faculty" required>
                    <select
                      value={form.faculty_internal_id}
                      onChange={(e) => setField('faculty_internal_id', e.target.value)}
                      className={selectClass}
                      required
                    >
                      <option value="">Select Faculty</option>
                      {facultyInternal.map((f: any) => (
                        <option key={f.id} value={f.id}>{f.full_name || f.email} ({f.department})</option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <Field label="Visiting Expert" required>
                    <select
                      value={form.faculty_external_id}
                      onChange={(e) => setField('faculty_external_id', e.target.value)}
                      className={selectClass}
                      required
                    >
                      <option value="">Select Visiting Expert</option>
                      {facultyExternal.map((f: any) => (
                        <option key={f.id} value={f.id}>{f.name} ({f.organization || 'Visiting'})</option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>

              {/* HyperBuild Activities */}
              {form.session_type === 'hyperbuild' && (
                <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Activities ({hyperbuildActivities.length})
                    </h4>
                    <button
                      type="button"
                      onClick={handleAddHyperbuildActivity}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
                    >
                      + Add Activity
                    </button>
                  </div>

                  {hyperbuildActivities.length === 0 ? (
                    <div className="py-3 text-center text-xs text-slate-400">
                      No activities added. Click "+ Add Activity" to add one.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {hyperbuildActivities.map((act, index) => (
                        <div
                          key={index}
                          className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-700 dark:text-slate-300">
                              Activity {act.activity_no}
                            </span>
                            {hyperbuildActivities.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveHyperbuildActivity(index)}
                                className="text-xs text-rose-500 hover:text-rose-700 font-semibold cursor-pointer"
                              >
                                Remove
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                Subject *
                              </label>
                              <select
                                value={act.subject_id}
                                onChange={(e) => {
                                  handleUpdateHyperbuildActivity(index, 'subject_id', e.target.value);
                                }}
                                className={selectClass}
                                required
                              >
                                <option value="">Select Subject</option>
                                {filteredSubjects.map((s: any) => (
                                  <option key={s.id} value={s.id}>
                                    {s.code ? `${s.code} · ` : ''}{s.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                Predefined Activity
                              </label>
                              {act.subject_id ? (
                                <select
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleSelectPredefinedActivity(index, act.subject_id, e.target.value);
                                    }
                                  }}
                                  className={selectClass}
                                >
                                  <option value="">Select from predefined...</option>
                                  {(subjectActivitiesMap[act.subject_id] || []).map((pa: any) => (
                                    <option key={pa.id} value={pa.id}>
                                      Activity {pa.activity_no}: {pa.title}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <div className="px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 text-slate-400">
                                  Select subject first
                                </div>
                              )}
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                              Activity Title *
                            </label>
                            <input
                              type="text"
                              value={act.title}
                              onChange={(e) => handleUpdateHyperbuildActivity(index, 'title', e.target.value)}
                              placeholder="Activity title"
                              className={inputClass}
                              required
                            />
                          </div>

                          <div className="grid grid-cols-3 gap-2.5">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                Start Time
                              </label>
                              <input
                                type="time"
                                min={form.start_time}
                                max={form.end_time}
                                value={act.start_time}
                                onChange={(e) => handleUpdateHyperbuildActivity(index, 'start_time', e.target.value)}
                                className={inputClass}
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                End Time
                              </label>
                              <input
                                type="time"
                                min={act.start_time || form.start_time}
                                max={form.end_time}
                                value={act.end_time}
                                onChange={(e) => handleUpdateHyperbuildActivity(index, 'end_time', e.target.value)}
                                className={inputClass}
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                Duration
                              </label>
                              <div className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center h-[38px]">
                                {act.duration_minutes || calcDuration(act.start_time, act.end_time)} mins
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Instructions (Optional)</label>
                            <input
                              type="text"
                              value={act.instructions || ''}
                              onChange={(e) => handleUpdateHyperbuildActivity(index, 'instructions', e.target.value)}
                              placeholder="Instructions for students"
                              className={inputClass}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <Field label="Remarks (Optional)">
                <textarea
                  rows={2}
                  placeholder="Notes..."
                  value={form.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  className={inputClass}
                />
              </Field>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => handleCloseClassModal()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSaving}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {createSaving
                    ? 'Saving...'
                    : editingSession
                    ? 'Update Class'
                    : 'Schedule Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: MARK ATTENDANCE ──────────────────────────────────────────── */}
      {attendanceSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="glass-panel w-full max-w-xl rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-indigo-500" />
                  Mark Class Attendance
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {attendanceSheet?.subject_name || attendanceSession.notes || 'Academic Class'}
                  {attendanceSession.lecture_number && attendanceSession.session_type !== 'hyperbuild' ? ` (Lecture - ${attendanceSession.lecture_number})` : ''} ({attendanceSession.session_date})
                </p>
              </div>
              <button
                onClick={() => handleCloseAttendance()}
                className="p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {attendanceError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 text-rose-700 text-xs">
                {attendanceError}
              </div>
            )}

            {attendanceLoading ? (
              <p className="py-8 text-center text-sm text-slate-500">Loading student attendance sheet...</p>
            ) : attendanceSheet ? (
              <div className="space-y-4 my-4">
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-500">Batch:</span>{' '}
                    <span className="font-bold text-slate-900 dark:text-white">{attendanceSheet.batch_name || 'PGDM'}</span>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        const allP: Record<string, string> = {};
                        attendanceSheet.students.forEach((st) => { allP[st.student_id] = 'present'; });
                        setAttendanceMap(allP);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 text-[11px] font-semibold"
                    >
                      Mark All Present
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const allA: Record<string, string> = {};
                        attendanceSheet.students.forEach((st) => { allA[st.student_id] = 'absent'; });
                        setAttendanceMap(allA);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 text-[11px] font-semibold"
                    >
                      Mark All Absent
                    </button>
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {attendanceSheet.students.map((st) => (
                    <div
                      key={st.student_id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{st.student_name}</p>
                        <p className="font-mono text-[10px] text-slate-500">PRN: {st.student_prn}</p>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setAttendanceMap({ ...attendanceMap, [st.student_id]: 'present' })}
                          className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                            attendanceMap[st.student_id] === 'present'
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          Present
                        </button>
                        <button
                          type="button"
                          onClick={() => setAttendanceMap({ ...attendanceMap, [st.student_id]: 'absent' })}
                          className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                            attendanceMap[st.student_id] === 'absent'
                              ? 'bg-rose-600 text-white shadow-sm'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          Absent
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleCloseAttendance()}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAttendance}
                    disabled={attendanceSaving}
                    className="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
                  >
                    {attendanceSaving ? 'Saving...' : 'Save & Update Attendance %'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ── MODAL: IMPORT CSV ────────────────────────────────────────────────── */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-lg rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Import Timetable CSV</h3>
            <textarea
              rows={5}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="w-full font-mono text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-slate-100"
            />
            <div className="flex justify-end space-x-3 mt-4">
              <button
                type="button"
                onClick={() => handleCloseUploadModal()}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePreviewCsv}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-cyan-600 text-white hover:bg-cyan-700"
              >
                Parse & Preview
              </button>
            </div>

            {previewData && (
              <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 text-xs text-emerald-800 dark:text-emerald-300">
                Parsed {previewData.valid_count} valid sessions ready to schedule.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: DELETE SESSION CONFIRMATION (ADMIN ONLY) ─────────────────── */}
      {deletingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn" role="dialog" aria-modal="true" aria-labelledby="delete-session-title">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 id="delete-session-title" className="text-base font-bold text-slate-900 dark:text-white">Delete Scheduled Session</h3>
                <p className="text-xs text-slate-500">Admin Action · Irreversible</p>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 text-xs space-y-2">
              <p className="font-bold text-slate-900 dark:text-white text-sm">
                {deletingSession.subject_code ? `${deletingSession.subject_code} · ` : ''}{deletingSession.subject_name || 'Academic Class'}
              </p>
              <div className="text-slate-600 dark:text-slate-400 space-y-1 font-mono text-[11px]">
                <p>📅 Date: {deletingSession.session_date}</p>
                <p>⏰ Time: {deletingSession.start_time} - {deletingSession.end_time} ({deletingSession.duration_minutes}m)</p>
                <p>📍 Venue: {deletingSession.venue} ({deletingSession.mode})</p>
                <p>👨‍🏫 Faculty: {deletingSession.faculty_name || deletingSession.faculty_type}</p>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Are you sure you want to delete this scheduled session? It will be removed from the master timetable directory and student schedules.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingSession(null)}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteSession}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/20 transition-all flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{deleteLoading ? 'Deleting...' : 'Delete Session'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: REAL-TIME TIMETABLE VARIANCE & SUBSTITUTION ──────────────── */}
      {varianceSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn" role="dialog" aria-modal="true" aria-labelledby="variance-modal-title">
          <div className="glass-panel w-full max-w-2xl rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 space-y-5 my-8 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-2xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400">
                  <ArrowLeftRight className="h-5 w-5" />
                </div>
                <div>
                  <h3 id="variance-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
                    Real-Time Timetable Variance & Substitution
                  </h3>
                  <p className="text-xs text-slate-500">
                    Adjust execution in real-time without losing the original planned schedule.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVarianceSession(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Baseline Planned Schedule Reference Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 text-xs space-y-1">
              <p className="font-extrabold uppercase tracking-wider text-[10px] text-cyan-600 dark:text-cyan-400">
                Original Planned Baseline
              </p>
              <p className="font-bold text-sm text-slate-900 dark:text-white">
                {varianceSession.original_subject_code || varianceSession.subject_code ? `${varianceSession.original_subject_code || varianceSession.subject_code} · ` : ''}
                {varianceSession.original_subject_name || varianceSession.subject_name || 'Scheduled Subject'}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                <p>📅 {varianceSession.session_date}</p>
                <p>⏰ {varianceSession.start_time}-{varianceSession.end_time}</p>
                <p>📍 {varianceSession.original_venue || varianceSession.venue}</p>
                <p>👨‍🏫 {varianceSession.original_faculty_name || varianceSession.faculty_name || varianceSession.faculty_type}</p>
              </div>
            </div>

            {/* Action Type Selector Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setVarianceMode('faculty_substitution')}
                className={`flex items-center justify-center space-x-1.5 py-2 px-2.5 rounded-xl font-semibold transition-all ${
                  varianceMode === 'faculty_substitution'
                    ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                <span>Substitute Faculty</span>
              </button>
              <button
                type="button"
                onClick={() => setVarianceMode('subject_swapped')}
                className={`flex items-center justify-center space-x-1.5 py-2 px-2.5 rounded-xl font-semibold transition-all ${
                  varianceMode === 'subject_swapped'
                    ? 'bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Shuffle className="h-3.5 w-3.5" />
                <span>Swap Subject</span>
              </button>
              <button
                type="button"
                onClick={() => setVarianceMode('cancelled')}
                className={`flex items-center justify-center space-x-1.5 py-2 px-2.5 rounded-xl font-semibold transition-all ${
                  varianceMode === 'cancelled'
                    ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <X className="h-3.5 w-3.5" />
                <span>Cancel Class</span>
              </button>
              <button
                type="button"
                onClick={() => setVarianceMode('revert_as_planned')}
                className={`flex items-center justify-center space-x-1.5 py-2 px-2.5 rounded-xl font-semibold transition-all ${
                  varianceMode === 'revert_as_planned'
                    ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Undo2 className="h-3.5 w-3.5" />
                <span>Revert to Plan</span>
              </button>
            </div>

            {/* Error banner */}
            {varianceError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{varianceError}</span>
              </div>
            )}

            {/* Mode 1: Faculty Substitution Form */}
            {varianceMode === 'faculty_substitution' && (
              <div className="space-y-4 text-xs">
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs">
                  Conducting the <strong>same scheduled subject</strong> ({varianceSession.subject_name || 'Subject'}) with an alternate substitute faculty.
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Faculty Category</label>
                    <select
                      value={substituteFacultyType}
                      onChange={(e) => setSubstituteFacultyType(e.target.value as 'internal' | 'external')}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                    >
                      <option value="internal">Internal Faculty Member</option>
                      <option value="external">External Visiting Expert</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Substitute Faculty Member *</label>
                    {substituteFacultyType === 'internal' ? (
                      <select
                        value={substituteFacultyInternalId}
                        onChange={(e) => setSubstituteFacultyInternalId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                      >
                        <option value="">Select Internal Faculty...</option>
                        {facultyInternal.map((f) => (
                          <option key={f.id} value={f.id}>{f.full_name || f.email}</option>
                        ))}
                      </select>
                    ) : (
                      <select
                        value={substituteFacultyExternalId}
                        onChange={(e) => setSubstituteFacultyExternalId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                      >
                        <option value="">Select Visiting Expert...</option>
                        {facultyExternal.map((f) => (
                          <option key={f.id} value={f.id}>{f.name} ({f.organization || 'Visiting'})</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Mode 2: Subject & Faculty Swap Form */}
            {varianceMode === 'subject_swapped' && (
              <div className="space-y-4 text-xs">
                <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900 text-purple-800 dark:text-purple-300 text-xs">
                  Swapping the scheduled slot to a <strong>different replacement subject and faculty</strong>.
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Replacement Subject *</label>
                  <select
                    value={swappedSubjectId}
                    onChange={(e) => setSwappedSubjectId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                  >
                    <option value="">Select Subject...</option>
                    {allSubjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.code ? `${sub.code} · ` : ''}{sub.name} ({sub.course_category || 'Academic'})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Faculty Category</label>
                    <select
                      value={substituteFacultyType}
                      onChange={(e) => setSubstituteFacultyType(e.target.value as 'internal' | 'external')}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                    >
                      <option value="internal">Internal Faculty Member</option>
                      <option value="external">External Visiting Expert</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Faculty Taking the Subject *</label>
                    {substituteFacultyType === 'internal' ? (
                      <select
                        value={substituteFacultyInternalId}
                        onChange={(e) => setSubstituteFacultyInternalId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                      >
                        <option value="">Select Internal Faculty...</option>
                        {facultyInternal.map((f) => (
                          <option key={f.id} value={f.id}>{f.full_name || f.email}</option>
                        ))}
                      </select>
                    ) : (
                      <select
                        value={substituteFacultyExternalId}
                        onChange={(e) => setSubstituteFacultyExternalId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                      >
                        <option value="">Select Visiting Expert...</option>
                        {facultyExternal.map((f) => (
                          <option key={f.id} value={f.id}>{f.name} ({f.organization || 'Visiting'})</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Mode 3: Cancellation */}
            {varianceMode === 'cancelled' && (
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs space-y-1">
                <p className="font-bold text-sm">Class Cancellation Notice</p>
                <p>This session will be marked as cancelled in the timetable. Please specify the official reason below so it is accurately captured in compliance and adherence audits.</p>
              </div>
            )}

            {/* Mode 4: Revert to Plan */}
            {varianceMode === 'revert_as_planned' && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs space-y-1">
                <p className="font-bold text-sm">Restore Original Baseline Plan</p>
                <p>This will reset the session back to its original planned subject (<strong>{varianceSession.original_subject_name || varianceSession.subject_name}</strong>) and assigned faculty (<strong>{varianceSession.original_faculty_name || varianceSession.faculty_name}</strong>) and mark the variance status as <em>As Planned</em>.</p>
              </div>
            )}

            {/* Reason input with quick-select suggestions */}
            {varianceMode !== 'revert_as_planned' && (
              <div className="space-y-2 text-xs">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Reason for Schedule Adjustment / Deviation *
                </label>
                <input
                  type="text"
                  value={varianceReason}
                  onChange={(e) => setVarianceReason(e.target.value)}
                  placeholder="e.g., Faculty emergency leave, Syllabus swap, Clashing schedule..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-purple-500 font-medium"
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    'Faculty Emergency Leave',
                    'Syllabus Acceleration Swap',
                    'Faculty Medical Leave',
                    'Official Academic Duty',
                    'Guest Lecture Insertion',
                    'Classroom Maintenance',
                  ].map((sugg) => (
                    <button
                      key={sugg}
                      type="button"
                      onClick={() => setVarianceReason(sugg)}
                      className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-medium transition-colors"
                    >
                      + {sugg}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setVarianceSession(null)}
                disabled={varianceSaving}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveVariance}
                disabled={varianceSaving}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-500/20 transition-all flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                <span>{varianceSaving ? 'Saving Variance...' : 'Save & Record Variance'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: HYPERBUILD FACULTY COMMAND CONSOLE (PROJECTOR) ─────────── */}
      {hyperbuildConsoleSession && (
        <HyperbuildLiveConsoleModal
          session={hyperbuildConsoleSession}
          onClose={() => setHyperbuildConsoleSession(null)}
        />
      )}

      {/* ── MODAL: SCHEDULE / EDIT ACADEMIC EVENT & MILESTONE ──────────────── */}
      <AcademicEventModal
        isOpen={showEventModal}
        onClose={() => {
          setShowEventModal(false);
          setEditingEvent(null);
        }}
        event={editingEvent}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['academic_events'] });
          queryClient.invalidateQueries({ queryKey: ['calendar_events'] });
        }}
        programs={programs}
        batches={allBatches}
        divisions={allDivisions}
      />

      {/* ── MODAL: DELETE ACADEMIC EVENT CONFIRMATION ──────────────────────── */}
      {deletingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900">
                <Trash2 className="h-5 w-5" />
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Delete Academic Event?
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to delete <strong>{deletingEvent.title}</strong> scheduled for{' '}
              <strong>{deletingEvent.start_date}</strong>? This action will remove the milestone from the academic calendar.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingEvent(null)}
                disabled={deleteEventLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteEventLoading}
                onClick={confirmDeleteEvent}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/25 transition-all cursor-pointer disabled:opacity-50"
              >
                {deleteEventLoading ? 'Deleting...' : 'Delete Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: HYPERBUILD STUDENT LIVE WORKSPACE ───────────────────────── */}
      {studentHyperbuildSession && (
        <StudentHyperbuildModal
          session={studentHyperbuildSession}
          onClose={() => setStudentHyperbuildSession(null)}
        />
      )}

      {/* ── ACADEMIC EVENT POSTER LIGHTBOX MODAL ────────────────────────── */}
      {selectedPosterEvent && selectedPosterEvent.poster_url && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
          onClick={() => setSelectedPosterEvent(null)}
        >
          <div
            className="relative max-w-3xl w-full bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
              <div>
                <h3 className="font-semibold text-sm text-slate-900 dark:text-white truncate max-w-md">
                  {selectedPosterEvent.title}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Event Creative
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPosterEvent(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-950 flex items-center justify-center max-h-[75vh] overflow-auto">
              <img
                src={selectedPosterEvent.poster_url.startsWith('http') ? selectedPosterEvent.poster_url : `${api.defaults.baseURL || ''}${selectedPosterEvent.poster_url}`}
                alt={selectedPosterEvent.title}
                className="max-h-[70vh] w-auto object-contain rounded-xl"
              />
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-between">
              <div className="text-xs text-slate-500">
                {selectedPosterEvent.poster_filename || 'Event Creative'}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={selectedPosterEvent.poster_url.startsWith('http') ? selectedPosterEvent.poster_url : `${api.defaults.baseURL || ''}${selectedPosterEvent.poster_url}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open Full Image
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
