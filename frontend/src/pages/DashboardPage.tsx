import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { api } from '../lib/api';
import { Card } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import {
  Users,
  Calendar,
  FileCheck,
  Layers,
  ArrowRight,
  Clock,
  CheckCircle2,
  CalendarPlus,
  UserPlus,
  FileText,
  GraduationCap,
  BookOpen,
  Building2,
  Quote,
  Sparkles,
  Briefcase,
  User,
  MessageSquare,
  ShieldCheck,
  AlertTriangle,
  Award,
  MapPin,
  Eye,
  Zap,
  Radio,
  ClipboardList,
  Plus,
} from 'lucide-react';
import { AcademicEventDetailModal } from '../modules/sessions/AcademicEventDetailModal';
import { AcademicEventModal, AcademicEventItem, EVENT_CATEGORIES } from '../modules/sessions/AcademicEventModal';
import { StudentHyperbuildModal } from '../modules/sessions/StudentHyperbuildModal';
import { HyperbuildLiveConsoleModal } from '../modules/sessions/HyperbuildLiveConsoleModal';

interface SessionItem {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  session_type: string;
  faculty_type: string;
  venue: string;
  mode: string;
  status: string;
  subject_name?: string;
  subject_code?: string;
  faculty_name?: string;
  faculty_internal_id?: string;
  faculty_external_id?: string;
  batch_id?: string;
  batch_name?: string;
  lecture_number?: number;
  notes?: string;
  hyperbuild_activities?: any[];
}

interface PendingApproval {
  id: string;
  entity_type: string;
  entity_id: string;
  new_status: string;
  context_summary?: string;
  acted_at: string;
}

interface SyllabusItem {
  subject_code: string;
  subject_name: string;
  total_topics: number;
  completed_topics: number;
  completion_index: number;
}

interface VenueItem {
  venue: string;
  total_sessions: number;
  total_hours: number;
  utilization_percentage: number;
}

interface ThoughtOfTheDay {
  thought: string;
  author: string;
  date: string;
  source: string;
}

interface StudentDashboardSummary {
  student_id?: string;
  student_name: string;
  program_name?: string;
  batch_name?: string;
  division_name?: string;
  trimester: number;
  attendance_percentage: number;
  total_sessions_conducted: number;
  total_sessions_attended: number;
  attendance_standing: string;
  enrolled_subjects_count: number;
  upcoming_sessions_count: number;
  today_sessions_count?: number;
  case_studies_count: number;
  cgpa?: number;
}

interface FacultyDashboardSummary {
  faculty_id?: string;
  faculty_name: string;
  faculty_type: string;
  today_sessions_count: number;
  upcoming_sessions_count: number;
  active_hyperbuild_count: number;
  assigned_subjects_count: number;
  upcoming_events_count: number;
}

interface AdminDashboardSummary {
  active_programs_count: number;
  faculty_count: number;
  scheduled_sessions_count: number;
  pending_approvals_count: number;
  today_sessions_count?: number;
  pending_registrations_count?: number;
  upcoming_events_count?: number;
}

export const DashboardPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user, updateUser } = useAuthStore();

  // ── Role Differentiation ──────────────────────────────────────────────────
  const userRoles = useMemo(() => user?.roles || [], [user?.roles]);
  const isStudent = useMemo(
    () => Boolean(userRoles.includes('student') && !userRoles.includes('crc_admin') && !userRoles.includes('super_admin')),
    [userRoles]
  );
  const isFaculty = useMemo(
    () =>
      Boolean(
        (userRoles.includes('faculty_internal') || userRoles.includes('faculty_external')) &&
          !isStudent &&
          !userRoles.includes('crc_admin') &&
          !userRoles.includes('super_admin')
      ),
    [userRoles, isStudent]
  );
  const isAdmin = !isStudent && !isFaculty;

  // ── Real-Time Live Clock ──────────────────────────────────────────────────
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute local date ISO string (YYYY-MM-DD)
  const todayIso = useMemo(() => {
    const year = currentTime.getFullYear();
    const month = String(currentTime.getMonth() + 1).padStart(2, '0');
    const day = String(currentTime.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, [currentTime]);

  const currentDate = currentTime.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const formattedTime = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  // ── Modal & Interactive State ─────────────────────────────────────────────
  const [scheduleTab, setScheduleTab] = useState<'all' | 'classes' | 'events'>('all');
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<AcademicEventItem | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AcademicEventItem | null>(null);
  const [studentHyperbuildSession, setStudentHyperbuildSession] = useState<SessionItem | null>(null);
  const [hyperbuildConsoleSession, setHyperbuildConsoleSession] = useState<SessionItem | null>(null);

  // ── User Data ─────────────────────────────────────────────────────────────
  const { data: meData } = useQuery({
    queryKey: ['auth_me', user?.id],
    queryFn: async () => {
      try {
        const res = await api.get('/auth/me');
        if (res.data.data) {
          updateUser(res.data.data);
          return res.data.data;
        }
      } catch {
        // ignore
      }
      return user;
    },
    enabled: !!user,
  });

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getDisplayName = () => {
    const activeUser = user || meData;
    if (!activeUser) return 'User';
    if (activeUser.full_name && activeUser.full_name.trim()) {
      return activeUser.full_name.trim();
    }
    if (activeUser.email) {
      const prefix = activeUser.email.split('@')[0];
      return prefix
        .split(/[._]/)
        .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(' ');
    }
    return 'User';
  };

  // ── Role-Specific Summary Queries ─────────────────────────────────────────
  const { data: studentSummary, isLoading: studentSummaryLoading } = useQuery<StudentDashboardSummary>({
    queryKey: ['dashboard_student_summary', user?.id],
    queryFn: async () => {
      try {
        const res = await api.get('/dashboard/student-summary');
        return res.data.data;
      } catch {
        return null;
      }
    },
    enabled: isStudent,
  });

  const { data: facultySummary, isLoading: facultySummaryLoading } = useQuery<FacultyDashboardSummary>({
    queryKey: ['dashboard_faculty_summary', user?.id],
    queryFn: async () => {
      try {
        const res = await api.get('/dashboard/faculty-summary');
        return res.data.data;
      } catch {
        return null;
      }
    },
    enabled: isFaculty,
  });

  const { data: adminSummary, isLoading: adminSummaryLoading } = useQuery<AdminDashboardSummary>({
    queryKey: ['dashboard_admin_summary'],
    queryFn: async () => {
      try {
        const res = await api.get('/dashboard/summary');
        return res.data.data;
      } catch {
        return null;
      }
    },
    enabled: isAdmin,
  });

  // ── Universal Data Queries ────────────────────────────────────────────────
  const { data: thoughtData = {
    thought: 'Small daily improvements over time lead to stunning results.',
    author: 'Robin Sharma',
    date: new Date().toISOString().split('T')[0],
    source: 'curated',
  } } = useQuery<ThoughtOfTheDay>({
    queryKey: ['dashboard_thought_of_the_day'],
    queryFn: async () => {
      try {
        const res = await api.get('/dashboard/thought-of-the-day');
        return res.data?.data || res.data;
      } catch {
        return {
          thought: 'Small daily improvements over time lead to stunning results.',
          author: 'Robin Sharma',
          date: new Date().toISOString().split('T')[0],
          source: 'curated',
        };
      }
    },
    staleTime: 1000 * 60 * 60 * 6,
  });

  const { data: sessions = [] } = useQuery<SessionItem[]>({
    queryKey: ['dashboard_sessions'],
    queryFn: async () => {
      try {
        const res = await api.get('/sessions');
        return (res.data.data || []) as SessionItem[];
      } catch {
        return [] as SessionItem[];
      }
    },
  });

  const { data: academicEvents = [] } = useQuery<AcademicEventItem[]>({
    queryKey: ['dashboard_academic_events'],
    queryFn: async () => {
      try {
        const res = await api.get('/academic-events');
        return (res.data.data || []) as AcademicEventItem[];
      } catch {
        return [] as AcademicEventItem[];
      }
    },
  });

  const { data: pendingApprovals = [] } = useQuery<PendingApproval[]>({
    queryKey: ['dashboard_pending_approvals'],
    queryFn: async () => {
      try {
        const res = await api.get('/approvals/pending');
        return (res.data.data || []) as PendingApproval[];
      } catch {
        return [] as PendingApproval[];
      }
    },
    enabled: isAdmin,
  });

  const { data: syllabusList = [] } = useQuery<SyllabusItem[]>({
    queryKey: ['dashboard_syllabus_completion'],
    queryFn: async () => {
      try {
        const res = await api.get('/reports/syllabus-completion');
        return (res.data.data || []) as SyllabusItem[];
      } catch {
        return [] as SyllabusItem[];
      }
    },
  });

  const { data: venueList = [] } = useQuery<VenueItem[]>({
    queryKey: ['dashboard_venue_utilization'],
    queryFn: async () => {
      try {
        const res = await api.get('/reports/venue-utilization');
        return (res.data.data || []) as VenueItem[];
      } catch {
        return [] as VenueItem[];
      }
    },
    enabled: isAdmin,
  });

  // Supporting queries for Event Creation (Admin)
  const { data: programs = [] } = useQuery({
    queryKey: ['dashboard_programs'],
    queryFn: async () => {
      try {
        const res = await api.get('/academic/programs');
        return res.data.data || [];
      } catch {
        return [];
      }
    },
    enabled: isAdmin,
  });

  const { data: batches = [] } = useQuery({
    queryKey: ['dashboard_batches'],
    queryFn: async () => {
      try {
        const res = await api.get('/academic/batches');
        return res.data.data || [];
      } catch {
        return [];
      }
    },
    enabled: isAdmin,
  });

  const { data: divisions = [] } = useQuery({
    queryKey: ['dashboard_divisions'],
    queryFn: async () => {
      try {
        const res = await api.get('/academic/divisions');
        return res.data.data || [];
      } catch {
        return [];
      }
    },
    enabled: isAdmin,
  });

  // ── Helper Categorization ─────────────────────────────────────────────────
  const getCategoryLabel = (category: string) => {
    const c = EVENT_CATEGORIES.find((cat) => cat.value === category);
    return c?.label || (category || 'other').replace(/_/g, ' ');
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'celebration':
        return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20';
      case 'guest_lecture':
        return 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20';
      case 'workshop':
        return 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20';
      case 'exam_midterm':
      case 'exam_endterm':
        return 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20';
      case 'placement_drive':
        return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20';
      case 'conclave':
        return 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20';
      default:
        return 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20';
    }
  };

  // ── Session Filtering for Each Role ───────────────────────────────────────
  // Today's classes for Student
  const studentTodayClasses = useMemo(() => {
    return sessions.filter((s) => s.session_date === todayIso && s.status !== 'cancelled');
  }, [sessions, todayIso]);

  const studentActiveTodaySession = useMemo(() => {
    if (studentTodayClasses.length === 0) return null;
    return studentTodayClasses.find((s) => s.session_type === 'hyperbuild') || studentTodayClasses[0];
  }, [studentTodayClasses]);

  // Today's classes for Faculty
  const facultyTodayClasses = useMemo(() => {
    return sessions.filter((s) => {
      if (s.session_date !== todayIso || s.status === 'cancelled') return false;
      if (!facultySummary?.faculty_id) return true;
      return (
        s.faculty_internal_id === facultySummary.faculty_id ||
        s.faculty_external_id === facultySummary.faculty_id ||
        s.faculty_name?.toLowerCase() === facultySummary.faculty_name?.toLowerCase() ||
        s.faculty_name?.toLowerCase() === getDisplayName().toLowerCase()
      );
    });
  }, [sessions, todayIso, facultySummary, user, meData]);

  // Filtered upcoming lists
  const upcomingClassesList = useMemo(() => {
    return sessions
      .filter((s) => s.status !== 'cancelled' && (!s.session_date || s.session_date >= todayIso))
      .sort((a, b) => a.session_date.localeCompare(b.session_date) || (a.start_time || '').localeCompare(b.start_time || ''));
  }, [sessions, todayIso]);

  const facultyUpcomingClasses = useMemo(() => {
    return upcomingClassesList.filter((s) => {
      if (!facultySummary?.faculty_id) return true;
      return (
        s.faculty_internal_id === facultySummary.faculty_id ||
        s.faculty_external_id === facultySummary.faculty_id ||
        s.faculty_name?.toLowerCase() === facultySummary.faculty_name?.toLowerCase() ||
        s.faculty_name?.toLowerCase() === getDisplayName().toLowerCase()
      );
    });
  }, [upcomingClassesList, facultySummary, user, meData]);

  const upcomingEventsList = useMemo(() => {
    return academicEvents
      .filter((ev) => ev.status !== 'cancelled' && (!ev.start_date || (ev.end_date || ev.start_date) >= todayIso))
      .sort((a, b) => a.start_date.localeCompare(b.start_date) || (a.start_time || '').localeCompare(b.start_time || ''));
  }, [academicEvents, todayIso]);

  type FeedItem =
    | { kind: 'session'; id: string; date: string; time: string; session: SessionItem }
    | { kind: 'event'; id: string; date: string; time: string; event: AcademicEventItem };

  const targetClassesList = isFaculty ? facultyUpcomingClasses : upcomingClassesList;

  const allUpcomingFeed: FeedItem[] = useMemo(() => {
    return [
      ...targetClassesList.map((s) => ({
        kind: 'session' as const,
        id: `session-${s.id}`,
        date: s.session_date,
        time: s.start_time || '00:00',
        session: s,
      })),
      ...upcomingEventsList.map((ev) => ({
        kind: 'event' as const,
        id: `event-${ev.id}`,
        date: ev.start_date,
        time: ev.start_time || '00:00',
        event: ev,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  }, [targetClassesList, upcomingEventsList]);

  const displayedFeed: FeedItem[] = useMemo(() => {
    const list =
      scheduleTab === 'classes'
        ? targetClassesList.map((s) => ({
            kind: 'session' as const,
            id: `session-${s.id}`,
            date: s.session_date,
            time: s.start_time || '00:00',
            session: s,
          }))
        : scheduleTab === 'events'
        ? upcomingEventsList.map((ev) => ({
            kind: 'event' as const,
            id: `event-${ev.id}`,
            date: ev.start_date,
            time: ev.start_time || '00:00',
            event: ev,
          }))
        : allUpcomingFeed;

    return list.slice(0, 6);
  }, [scheduleTab, targetClassesList, upcomingEventsList, allUpcomingFeed]);

  const activeSyllabus = useMemo(() => (syllabusList || []).slice(0, 3), [syllabusList]);
  const topVenues = useMemo(() => (venueList || []).slice(0, 3), [venueList]);

  // Student metrics
  const attendanceRate = studentSummary?.attendance_percentage ?? 100.0;
  const isHealthyAttendance = attendanceRate >= 75.0;

  return (
    <div className="space-y-6">
      {/* ── TOP BANNER: WELCOME & REAL-TIME DIGITAL CLOCK ─────────────────── */}
      <div className="glass-panel rounded-3xl p-6 md:p-8 border border-slate-200/90 dark:border-slate-800/80 relative overflow-hidden transition-all duration-300 shadow-sm bg-gradient-to-r from-slate-50/80 via-indigo-50/30 to-cyan-50/50 dark:from-slate-900/90 dark:via-slate-900/60 dark:to-slate-950/90 space-y-4">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-cyan-500/10 via-indigo-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        {/* Top Section: Greeting & Live Clock */}
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5 min-w-0 flex-1">
            <h1 className="text-2xl md:text-3.5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {getGreeting()}, <span className="gradient-text">{getDisplayName()}</span>
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">
              {isStudent && (
                <>
                  Academic Student Portal •{' '}
                  <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                    {studentSummary?.program_name || 'PGDM'}
                  </span>
                  {studentSummary?.batch_name ? ` — ${studentSummary.batch_name}` : ''}
                  {studentSummary?.division_name ? ` (${studentSummary.division_name})` : ''} • Trimester{' '}
                  {studentSummary?.trimester || 1}
                </>
              )}
              {isFaculty && (
                <>
                  Faculty Academic Console •{' '}
                  <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                    Live Classroom Delivery & HyperBuild Command
                  </span>{' '}
                  — Attendance roll call, 180s key verification & evaluation.
                </>
              )}
              {isAdmin && (
                <>
                  Welcome to{' '}
                  <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                    Lexicon MILE Academic Operations
                  </span>{' '}
                  — Master timetable, student registrations, events & curriculum delivery.
                </>
              )}
            </p>
          </div>

          {/* Right Side: Live Date & Time Widget */}
          <div className="flex items-center space-x-3.5 shrink-0 bg-transparent">
            <div className="h-11 w-11 rounded-2xl bg-cyan-500/10 dark:bg-cyan-400/10 border border-cyan-500/20 dark:border-cyan-400/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shadow-sm">
              <Clock className="h-5.5 w-5.5" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                <Calendar className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>{currentDate}</span>
              </div>
              <div className="flex items-center space-x-2 text-base md:text-lg font-mono font-extrabold text-slate-900 dark:text-white">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <span className="tracking-tight">{formattedTime}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Thought of the Day Row */}
        {thoughtData?.thought && (
          <div className="relative z-10 pt-3.5 border-t border-slate-200/70 dark:border-slate-800/70 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="h-8 w-8 rounded-xl bg-indigo-500/10 dark:bg-indigo-400/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-2xs">
                <Quote className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                <span className="text-[10.5px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 shrink-0 flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" /> Thought of the Day:
                </span>
                <p className="text-xs sm:text-sm italic font-medium text-slate-700 dark:text-slate-300">
                  &ldquo;{thoughtData.thought}&rdquo;
                  <span className="not-italic font-bold text-slate-900 dark:text-slate-100 ml-1.5 whitespace-nowrap">
                    — {thoughtData.author}
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── PRIORITY LIVE CLASS BANNER: STUDENT VIEW ───────────────────────── */}
      {isStudent && studentActiveTodaySession && (
        <div className="relative overflow-hidden rounded-3xl p-5 md:p-6 border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 via-indigo-500/10 to-purple-500/10 dark:from-cyan-950/40 dark:via-indigo-950/30 dark:to-purple-950/40 shadow-sm transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 shrink-0 mt-0.5 shadow-sm">
                <Zap className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wide bg-cyan-500/20 text-cyan-800 dark:text-cyan-200 border border-cyan-500/30">
                    <Radio className="h-3 w-3 animate-pulse text-cyan-600 dark:text-cyan-400" />
                    Today's Classroom Session
                  </span>
                  {studentActiveTodaySession.session_type === 'hyperbuild' && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/30">
                      ⚡ HyperBuild Lab
                    </span>
                  )}
                  <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                    📍 {studentActiveTodaySession.venue || 'Campus Classroom'} · ⏰{' '}
                    {studentActiveTodaySession.start_time} - {studentActiveTodaySession.end_time}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {studentActiveTodaySession.subject_name || studentActiveTodaySession.venue}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Faculty: {studentActiveTodaySession.faculty_name || 'Assigned Instructor'} • Activity window & 180s challenge key verification will activate during scheduled class time.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
              {studentActiveTodaySession.session_type === 'hyperbuild' ? (
                <button
                  type="button"
                  onClick={() => setStudentHyperbuildSession(studentActiveTodaySession)}
                  className="px-5 py-2.5 rounded-2xl text-xs font-extrabold bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-md shadow-cyan-500/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <Zap className="h-4 w-4" />
                  <span>Enter Screen Key & Open Workspace</span>
                </button>
              ) : (
                <Link
                  to="/sessions"
                  className="px-4 py-2 rounded-2xl text-xs font-bold bg-white dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <span>View Timetable</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── PRIORITY TODAY'S CLASSROOM CONSOLE: FACULTY VIEW ───────────────── */}
      {isFaculty && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <span>Today's Assigned Sessions & Live Command</span>
            </h2>
            <Link
              to="/sessions?view=daily"
              className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
            >
              <span>Full Daily Timetable</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {facultyTodayClasses.length === 0 ? (
            <div className="rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-center text-xs text-slate-500 dark:text-slate-400">
              <Calendar className="h-6 w-6 mx-auto mb-2 opacity-50 text-cyan-500" />
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                No lectures or lab sessions assigned to you for today ({currentDate}).
              </p>
              <p className="mt-1 text-slate-400">
                Check upcoming sessions below or review the master academic schedule.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {facultyTodayClasses.map((sess) => (
                <div
                  key={sess.id}
                  className="rounded-3xl p-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:border-cyan-500/40 transition-all space-y-3.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10.5px] px-2 py-0.5 rounded-full font-bold bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                          {sess.session_type === 'hyperbuild' ? '⚡ HyperBuild Lab' : 'Lecture'}
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                          {sess.start_time} - {sess.end_time}
                        </span>
                        <StatusBadge status={sess.status} />
                      </div>
                      <h4 className="text-sm md:text-base font-bold text-slate-900 dark:text-white truncate">
                        {sess.subject_name || sess.venue}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap">
                        <span>📍 {sess.venue}</span>
                        <span>•</span>
                        <span>👥 {sess.batch_name || 'Assigned Cohort'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-[11px] text-slate-500">
                      {sess.session_type === 'hyperbuild'
                        ? '180s Screen Key & Roster ready'
                        : 'Attendance roll call ready'}
                    </div>

                    <div className="flex items-center gap-2">
                      {sess.session_type === 'hyperbuild' ? (
                        <button
                          type="button"
                          onClick={() => setHyperbuildConsoleSession(sess)}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                        >
                          <Zap className="h-3.5 w-3.5" />
                          <span>Launch Live Console</span>
                        </button>
                      ) : (
                        <Link
                          to={`/sessions?date=${sess.session_date}`}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all flex items-center gap-1.5"
                        >
                          <ClipboardList className="h-3.5 w-3.5" />
                          <span>Take Roll Call</span>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── METRIC CARDS GRID: ADAPTIVE BY ROLE ────────────────────────────── */}
      {isStudent && (
        /* STUDENT-SPECIFIC METRIC CARDS */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* 1. Attendance Rate */}
          <Link to="/attendance" className="group block">
            <Card
              title="Attendance Rate"
              subtitle={studentSummary?.attendance_standing || (isHealthyAttendance ? 'Good Standing' : 'Attendance Advisory')}
              action={
                <div
                  className={`p-2 rounded-xl border ${
                    isHealthyAttendance
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
                  } group-hover:scale-110 transition-transform`}
                >
                  {isHealthyAttendance ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                </div>
              }
            >
              <div className="mt-2 flex items-baseline justify-between">
                <span
                  className={`text-3xl font-extrabold ${
                    isHealthyAttendance ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {studentSummaryLoading ? '—' : `${attendanceRate}%`}
                </span>
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center space-x-1 group-hover:translate-x-0.5 transition-transform">
                  <span>Dossier</span>
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                {studentSummary?.total_sessions_attended ?? 0} of {studentSummary?.total_sessions_conducted ?? 0} sessions marked
              </p>
            </Card>
          </Link>

          {/* 2. Enrolled Courses */}
          <Link to="/lms" className="group block">
            <Card
              title="Enrolled Courses"
              subtitle={`Trimester ${studentSummary?.trimester || 1} Curriculum`}
              action={<BookOpen className="h-5 w-5 text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-transform" />}
            >
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-3xl font-bold text-slate-900 dark:text-white">
                  {studentSummaryLoading ? '—' : studentSummary?.enrolled_subjects_count ?? 6}
                </span>
                <span className="text-xs font-semibold text-cyan-700 dark:text-cyan-400 flex items-center space-x-1 group-hover:translate-x-0.5 transition-transform">
                  <span>LMS Hub</span>
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                Modules, syllabus & course resources
              </p>
            </Card>
          </Link>

          {/* 3. Class Timetable & Schedule */}
          <Link to="/sessions" className="group block">
            <Card
              title="Class Timetable"
              subtitle="Lectures & Lab Sessions"
              action={<Calendar className="h-5 w-5 text-sky-600 dark:text-sky-400 group-hover:scale-110 transition-transform" />}
            >
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-3xl font-bold text-slate-900 dark:text-white">
                  {studentSummaryLoading ? '—' : studentSummary?.upcoming_sessions_count ?? targetClassesList.length}
                </span>
                <span className="text-xs font-semibold text-sky-700 dark:text-sky-400 flex items-center space-x-1 group-hover:translate-x-0.5 transition-transform">
                  <span>Schedule</span>
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                {studentTodayClasses.length > 0
                  ? `${studentTodayClasses.length} session${studentTodayClasses.length > 1 ? 's' : ''} scheduled today`
                  : 'Upcoming for your cohort'}
              </p>
            </Card>
          </Link>

          {/* 4. Case Studies & Activities */}
          <Link to="/case-studies" className="group block">
            <Card
              title="Case Study Bank"
              subtitle="Business & Simulation Cases"
              action={<Briefcase className="h-5 w-5 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />}
            >
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-3xl font-bold text-slate-900 dark:text-white">
                  {studentSummaryLoading ? '—' : studentSummary?.case_studies_count ?? 4}
                </span>
                <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 flex items-center space-x-1 group-hover:translate-x-0.5 transition-transform">
                  <span>Library</span>
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                Harvard & industry management cases
              </p>
            </Card>
          </Link>
        </div>
      )}

      {isFaculty && (
        /* FACULTY-SPECIFIC METRIC CARDS */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* 1. Today's Classes */}
          <Link to="/sessions?view=daily" className="group block">
            <Card
              title="Classes Today"
              subtitle={currentDate}
              action={<Clock className="h-5 w-5 text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-transform" />}
            >
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-3xl font-bold text-slate-900 dark:text-white">
                  {facultySummaryLoading ? '—' : facultySummary?.today_sessions_count ?? facultyTodayClasses.length}
                </span>
                <span className="text-xs font-semibold text-cyan-700 dark:text-cyan-400 flex items-center space-x-1 group-hover:translate-x-0.5 transition-transform">
                  <span>Daily View</span>
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                Assigned lecture & lab slots
              </p>
            </Card>
          </Link>

          {/* 2. Total Upcoming Sessions */}
          <Link to="/sessions" className="group block">
            <Card
              title="Upcoming Sessions"
              subtitle="Term Schedule"
              action={<Calendar className="h-5 w-5 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />}
            >
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-3xl font-bold text-slate-900 dark:text-white">
                  {facultySummaryLoading ? '—' : facultySummary?.upcoming_sessions_count ?? facultyUpcomingClasses.length}
                </span>
                <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 flex items-center space-x-1 group-hover:translate-x-0.5 transition-transform">
                  <span>Timetable</span>
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                Assigned across programs & cohorts
              </p>
            </Card>
          </Link>

          {/* 3. HyperBuild Labs */}
          <Link to="/sessions" className="group block">
            <Card
              title="HyperBuild Labs"
              subtitle="180s Key & Live Roster"
              action={<Zap className="h-5 w-5 text-amber-500 group-hover:scale-110 transition-transform" />}
            >
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-3xl font-bold text-slate-900 dark:text-white">
                  {facultySummaryLoading ? '—' : facultySummary?.active_hyperbuild_count ?? 0}
                </span>
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center space-x-1 group-hover:translate-x-0.5 transition-transform">
                  <span>Console</span>
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                Interactive classroom challenges
              </p>
            </Card>
          </Link>

          {/* 4. Academic Events */}
          <Link to="/sessions?view=calendar" className="group block">
            <Card
              title="Campus Events"
              subtitle="Milestones & Conclaves"
              action={<Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform" />}
            >
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-3xl font-bold text-slate-900 dark:text-white">
                  {facultySummaryLoading ? '—' : facultySummary?.upcoming_events_count ?? upcomingEventsList.length}
                </span>
                <span className="text-xs font-semibold text-purple-700 dark:text-purple-400 flex items-center space-x-1 group-hover:translate-x-0.5 transition-transform">
                  <span>Calendar</span>
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                Conclaves, guest talks & celebrations
              </p>
            </Card>
          </Link>
        </div>
      )}

      {isAdmin && (
        /* ADMIN / CRC STAFF METRIC CARDS */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* 1. Active Programs */}
          <Link to="/academic" className="group block">
            <Card
              title="Active Programs"
              subtitle="Curriculum & Cohorts"
              action={<Layers className="h-5 w-5 text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-transform" />}
            >
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-3xl font-bold text-slate-900 dark:text-white">
                  {adminSummaryLoading ? '—' : adminSummary?.active_programs_count ?? 0}
                </span>
                <span className="text-xs font-semibold text-cyan-700 dark:text-cyan-400 flex items-center space-x-1 group-hover:translate-x-0.5 transition-transform">
                  <span>Manage</span>
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                Active degree & PGDM streams
              </p>
            </Card>
          </Link>

          {/* 2. Faculty Directory */}
          <Link to="/faculty" className="group block">
            <Card
              title="Faculty Directory"
              subtitle="Internal & External"
              action={<Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />}
            >
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-3xl font-bold text-slate-900 dark:text-white">
                  {adminSummaryLoading ? '—' : adminSummary?.faculty_count ?? 0}
                </span>
                <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 flex items-center space-x-1 group-hover:translate-x-0.5 transition-transform">
                  <span>Directory</span>
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                Roster, teaching assignments & rates
              </p>
            </Card>
          </Link>

          {/* 3. Scheduled Sessions */}
          <Link to="/sessions" className="group block">
            <Card
              title="Sessions Today / Total"
              subtitle="Master Timetable"
              action={<Calendar className="h-5 w-5 text-sky-600 dark:text-sky-400 group-hover:scale-110 transition-transform" />}
            >
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-3xl font-bold text-slate-900 dark:text-white">
                  {adminSummaryLoading ? '—' : `${adminSummary?.today_sessions_count ?? 0} / ${adminSummary?.scheduled_sessions_count ?? 0}`}
                </span>
                <span className="text-xs font-semibold text-sky-700 dark:text-sky-400 flex items-center space-x-1 group-hover:translate-x-0.5 transition-transform">
                  <span>Schedule</span>
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                Campus-wide timetable slots
              </p>
            </Card>
          </Link>

          {/* 4. Pending Registrations & Approvals */}
          <Link to="/student-registrations" className="group block">
            <Card
              title="Pending Review & Sign-off"
              subtitle="Student Applicants & Approvals"
              action={
                <div className="relative">
                  <FileCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                  {((adminSummary?.pending_registrations_count ?? 0) > 0 || (adminSummary?.pending_approvals_count ?? 0) > 0) && (
                    <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping" />
                  )}
                </div>
              }
            >
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-3xl font-bold text-slate-900 dark:text-white">
                  {adminSummaryLoading
                    ? '—'
                    : (adminSummary?.pending_registrations_count ?? 0) + (adminSummary?.pending_approvals_count ?? 0)}
                </span>
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center space-x-1 group-hover:translate-x-0.5 transition-transform">
                  <span>Review</span>
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                {adminSummary?.pending_registrations_count ?? 0} new student applicants · {adminSummary?.pending_approvals_count ?? 0} approvals
              </p>
            </Card>
          </Link>
        </div>
      )}

      {/* ── MAIN CONTENT GRID ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Classes, Events & Quick Actions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upcoming Academic Classes & Events Feed */}
          <Card
            title={
              isStudent
                ? 'My Upcoming Classes & Events'
                : isFaculty
                ? 'My Assigned Classes & Institute Events'
                : 'Campus Timetable & Academic Events'
            }
            subtitle={
              isStudent
                ? 'Real-time class schedule, campus events & celebrations'
                : isFaculty
                ? 'Assigned classroom schedule, student milestones & conclaves'
                : 'Master academic timetable & scheduled institute events'
            }
            action={
              <div className="flex items-center gap-3">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingEvent(null);
                      setShowEventModal(true);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 transition-all shadow-2xs cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Schedule Event</span>
                  </button>
                )}
                <Link
                  to="/sessions?view=calendar"
                  className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center space-x-1"
                >
                  <span className="hidden sm:inline">Calendar View</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            }
          >
            {/* Filter Pills */}
            <div className="flex items-center justify-between gap-2 mb-3.5 pb-3 border-b border-slate-100 dark:border-slate-800/80 flex-wrap">
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setScheduleTab('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    scheduleTab === 'all'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  All ({allUpcomingFeed.length})
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleTab('classes')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    scheduleTab === 'classes'
                      ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400'
                  }`}
                >
                  Classes ({targetClassesList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleTab('events')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    scheduleTab === 'events'
                      ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400'
                  }`}
                >
                  Events ({upcomingEventsList.length})
                </button>
              </div>

              <Link
                to="/sessions"
                className="text-xs font-semibold text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 flex items-center gap-1"
              >
                <span>View Full Timetable</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {displayedFeed.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>
                  {scheduleTab === 'classes'
                    ? isStudent
                      ? 'No upcoming lectures scheduled. Check back later or view the calendar.'
                      : 'No upcoming class sessions scheduled yet.'
                    : scheduleTab === 'events'
                    ? 'No upcoming academic events or milestones scheduled.'
                    : 'No upcoming sessions or events scheduled yet.'}
                </p>
                {isAdmin && (
                  <div className="mt-3 flex items-center justify-center gap-3 text-xs">
                    <Link
                      to="/sessions"
                      className="inline-flex items-center space-x-1 font-semibold text-cyan-600 dark:text-cyan-400 hover:underline"
                    >
                      <CalendarPlus className="h-3.5 w-3.5" />
                      <span>Schedule a session</span>
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {displayedFeed.map((item) => {
                  if (item.kind === 'session') {
                    const s = item.session;
                    const isHyper = s.session_type === 'hyperbuild';
                    const isToday = s.session_date === todayIso;

                    return (
                      <div
                        key={item.id}
                        className="py-3.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 px-3 rounded-2xl transition-colors border border-transparent hover:border-slate-200/80 dark:hover:border-slate-800/80"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={`h-11 w-11 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${
                              isHyper
                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
                                : 'bg-cyan-500/10 dark:bg-cyan-400/10 border-cyan-500/20 text-cyan-600 dark:text-cyan-400'
                            }`}
                          >
                            {isHyper ? <Zap className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
                          </div>
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-[11px] px-2 py-0.5 rounded-full font-bold border ${
                                  isHyper
                                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                                    : 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-200/60 dark:border-cyan-800/40'
                                }`}
                              >
                                {isHyper ? 'HyperBuild Lab' : 'Class'}
                              </span>
                              <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                {s.subject_name || s.venue || 'Classroom Session'}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 capitalize font-medium">
                                {s.mode || 'offline'}
                              </span>
                              {s.batch_name && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-medium">
                                  {s.batch_name}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                                <span className={`font-semibold ${isToday ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                  {isToday ? 'Today' : s.session_date}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span className="font-mono">
                                  {s.start_time} - {s.end_time}
                                </span>
                              </div>
                              {s.venue && (
                                <div className="flex items-center gap-1.5">
                                  <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                  <span className="truncate">{s.venue}</span>
                                </div>
                              )}
                              {s.faculty_name && (
                                <span className="text-slate-600 dark:text-slate-400">
                                  👨‍🏫 {s.faculty_name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 sm:self-center shrink-0">
                          {isHyper && isStudent && (
                            <button
                              type="button"
                              onClick={() => setStudentHyperbuildSession(s)}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-xs flex items-center gap-1 transition-all cursor-pointer"
                            >
                              <Zap className="h-3.5 w-3.5" />
                              <span>Enter Key</span>
                            </button>
                          )}

                          {isHyper && (isFaculty || isAdmin) && (
                            <button
                              type="button"
                              onClick={() => setHyperbuildConsoleSession(s)}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-xs flex items-center gap-1 transition-all cursor-pointer"
                            >
                              <Zap className="h-3.5 w-3.5" />
                              <span>Console</span>
                            </button>
                          )}

                          <StatusBadge status={s.status} />
                          <Link
                            to="/sessions"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 transition-colors"
                            title="View Timetable"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </div>
                      </div>
                    );
                  }

                  const ev = item.event;
                  const catLabel = getCategoryLabel(ev.event_category);
                  const isMultiDay = ev.end_date && ev.end_date !== ev.start_date;
                  const posterFullUrl = ev.poster_url
                    ? ev.poster_url.startsWith('http')
                      ? ev.poster_url
                      : `${api.defaults.baseURL || ''}${ev.poster_url}`
                    : null;

                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedEventForDetail(ev)}
                      className="py-3.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-purple-50/40 dark:hover:bg-purple-950/20 px-3 rounded-2xl transition-all border border-transparent hover:border-purple-200/80 dark:hover:border-purple-800/60 cursor-pointer group"
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        {posterFullUrl ? (
                          <div className="relative h-12 w-12 rounded-xl overflow-hidden shrink-0 border border-purple-200/80 dark:border-purple-800/80 shadow-2xs group-hover:scale-105 transition-transform bg-purple-950/20">
                            <img
                              src={posterFullUrl}
                              alt={ev.title}
                              className="w-full h-full object-cover"
                              onError={(e: any) => {
                                e.target.style.display = 'none';
                              }}
                            />
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Eye className="h-3.5 w-3.5 text-white" />
                            </div>
                          </div>
                        ) : (
                          <div className="h-11 w-11 rounded-xl bg-purple-500/10 dark:bg-purple-400/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                            <Sparkles className="h-5 w-5" />
                          </div>
                        )}

                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${getCategoryBadgeClass(
                                ev.event_category
                              )}`}
                            >
                              {catLabel}
                            </span>
                            {ev.is_mandatory && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-extrabold uppercase tracking-wide border border-rose-500/20">
                                Mandatory
                              </span>
                            )}
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors truncate">
                              {ev.title}
                            </h4>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 capitalize font-medium">
                              {ev.mode || 'offline'}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {ev.start_date}
                                {isMultiDay ? ` to ${ev.end_date}` : ''}
                              </span>
                            </div>

                            {ev.is_all_day ? (
                              <span className="font-semibold text-purple-600 dark:text-purple-400">All Day</span>
                            ) : ev.start_time ? (
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span className="font-mono">
                                  {ev.start_time}
                                  {ev.end_time ? ` - ${ev.end_time}` : ''}
                                </span>
                              </div>
                            ) : null}

                            {ev.venue && (
                              <div className="flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span className="truncate">{ev.venue}</span>
                              </div>
                            )}

                            {ev.speaker_guest_details && (
                              <span className="text-purple-600 dark:text-purple-400 font-medium truncate max-w-xs">
                                • {ev.speaker_guest_details}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:self-center shrink-0">
                        <StatusBadge status={ev.status} />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEventForDetail(ev);
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900/50 px-2.5 py-1.5 rounded-xl border border-purple-200 dark:border-purple-800/80 transition-all cursor-pointer shadow-2xs"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>View Details</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Role-Specific Quick Actions Dock */}
          {isStudent && (
            <Card title="Student Academic Dock" subtitle="Direct access to your learning and evaluation tools">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                <Link
                  to="/lms"
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-cyan-500/50 hover:bg-cyan-50/30 dark:hover:bg-cyan-950/20 text-center transition-all group"
                >
                  <div className="h-10 w-10 mx-auto rounded-xl bg-cyan-100 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Course LMS</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Syllabus & Modules</p>
                </Link>

                <Link
                  to="/attendance"
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 text-center transition-all group"
                >
                  <div className="h-10 w-10 mx-auto rounded-xl bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Attendance Dossier</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Records & Exemption</p>
                </Link>

                <Link
                  to="/gradebook"
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 text-center transition-all group"
                >
                  <div className="h-10 w-10 mx-auto rounded-xl bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <Award className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Gradebook & GPA</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Evaluations & Marks</p>
                </Link>

                <Link
                  to="/case-studies"
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 text-center transition-all group"
                >
                  <div className="h-10 w-10 mx-auto rounded-xl bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Case Studies</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Harvard Business Bank</p>
                </Link>

                <Link
                  to="/feedback"
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-500/50 hover:bg-purple-50/30 dark:hover:bg-purple-950/20 text-center transition-all group"
                >
                  <div className="h-10 w-10 mx-auto rounded-xl bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Faculty Feedback</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Term Evaluations</p>
                </Link>

                <Link
                  to="/profile"
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-500/50 hover:bg-sky-50/30 dark:hover:bg-sky-950/20 text-center transition-all group"
                >
                  <div className="h-10 w-10 mx-auto rounded-xl bg-sky-100 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <User className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Student Profile</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Academic Credentials</p>
                </Link>
              </div>
            </Card>
          )}

          {isFaculty && (
            <Card title="Faculty Quick Actions" subtitle="Classroom delivery, attendance, and evaluation shortcuts">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                <Link
                  to="/sessions"
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-cyan-500/50 hover:bg-cyan-50/30 dark:hover:bg-cyan-950/20 text-center transition-all group"
                >
                  <div className="h-10 w-10 mx-auto rounded-xl bg-cyan-100 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <CalendarPlus className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Timetable & Schedule</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">All Assigned Slots</p>
                </Link>

                <Link
                  to={`/sessions?date=${todayIso}`}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 text-center transition-all group"
                >
                  <div className="h-10 w-10 mx-auto rounded-xl bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <ClipboardList className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Roll Call Attendance</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Daily Session Marking</p>
                </Link>

                <Link
                  to="/lms"
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 text-center transition-all group"
                >
                  <div className="h-10 w-10 mx-auto rounded-xl bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Syllabus & LMS</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Delivery Progress</p>
                </Link>

                <Link
                  to="/students"
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-500/50 hover:bg-sky-50/30 dark:hover:bg-sky-950/20 text-center transition-all group"
                >
                  <div className="h-10 w-10 mx-auto rounded-xl bg-sky-100 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Student Roster</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Cohorts & Profiles</p>
                </Link>

                <Link
                  to="/case-studies"
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-500/50 hover:bg-purple-50/30 dark:hover:bg-purple-950/20 text-center transition-all group"
                >
                  <div className="h-10 w-10 mx-auto rounded-xl bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Case Studies</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Harvard Management Bank</p>
                </Link>

                <Link
                  to="/reports"
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500/50 hover:bg-amber-50/30 dark:hover:bg-amber-950/20 text-center transition-all group"
                >
                  <div className="h-10 w-10 mx-auto rounded-xl bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <FileText className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Academic Reports</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Attendance Dossiers</p>
                </Link>
              </div>
            </Card>
          )}

          {isAdmin && (
            <Card title="Administrative Quick Actions" subtitle="Frequently used academic and management workflows">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                <Link
                  to="/sessions"
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-cyan-500/50 hover:bg-cyan-50/30 dark:hover:bg-cyan-950/20 text-center transition-all group"
                >
                  <div className="h-9 w-9 mx-auto rounded-xl bg-cyan-100 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                    <CalendarPlus className="h-4.5 w-4.5" />
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Schedule</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Timetable</p>
                </Link>

                <Link
                  to="/student-registrations"
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 text-center transition-all group"
                >
                  <div className="h-9 w-9 mx-auto rounded-xl bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                    <FileCheck className="h-4.5 w-4.5" />
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Applicants</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Registrations</p>
                </Link>

                <Link
                  to="/faculty"
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 text-center transition-all group"
                >
                  <div className="h-9 w-9 mx-auto rounded-xl bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                    <UserPlus className="h-4.5 w-4.5" />
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Faculty</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Roster</p>
                </Link>

                <Link
                  to="/students"
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-500/50 hover:bg-sky-50/30 dark:hover:bg-sky-950/20 text-center transition-all group"
                >
                  <div className="h-9 w-9 mx-auto rounded-xl bg-sky-100 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                    <GraduationCap className="h-4.5 w-4.5" />
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Students</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Directory</p>
                </Link>

                <Link
                  to="/academic"
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-500/50 hover:bg-purple-50/30 dark:hover:bg-purple-950/20 text-center transition-all group"
                >
                  <div className="h-9 w-9 mx-auto rounded-xl bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                    <Layers className="h-4.5 w-4.5" />
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Academic</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Curriculum</p>
                </Link>

                <Link
                  to="/reports"
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-rose-500/50 hover:bg-rose-50/30 dark:hover:bg-rose-950/20 text-center transition-all group"
                >
                  <div className="h-9 w-9 mx-auto rounded-xl bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                    <FileText className="h-4.5 w-4.5" />
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Reports</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Compliance</p>
                </Link>
              </div>
            </Card>
          )}
        </div>

        {/* Right 1 Column: Meaningful Contextual Insights */}
        <div className="space-y-6">
          {/* Syllabus Progress Tracker */}
          <Card
            title="Syllabus Delivery Progress"
            subtitle={isStudent ? 'Your course topic coverage' : 'Academic milestone tracking'}
            action={
              <Link
                to="/lms"
                className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center space-x-1"
              >
                <span>View LMS</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            }
          >
            {activeSyllabus.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 text-center text-xs text-slate-500 dark:text-slate-400">
                <BookOpen className="h-6 w-6 mx-auto mb-1.5 opacity-40" />
                <p>No syllabus data logged yet.</p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {activeSyllabus.map((sub) => (
                  <div key={sub.subject_code} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-slate-100">{sub.subject_name}</span>
                        <span className="text-slate-400 dark:text-slate-500 ml-1.5 font-mono text-[11px]">
                          ({sub.subject_code})
                        </span>
                      </div>
                      <span className="font-semibold text-cyan-700 dark:text-cyan-400">
                        {sub.completion_index}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-500"
                        style={{ width: `${Math.min(100, sub.completion_index)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
                      <span>
                        {sub.completed_topics} of {sub.total_topics} topics covered
                      </span>
                      <span>{sub.completion_index >= 100 ? 'Completed' : 'In Progress'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Student-specific: Attendance Standing & Policy Compliance */}
          {isStudent && (
            <Card
              title="Attendance Standing"
              subtitle="Lexicon MILE compliance standard"
              action={
                <Link
                  to="/attendance"
                  className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center space-x-1"
                >
                  <span>Dossier</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              }
            >
              <div className="space-y-3.5">
                <div
                  className={`p-3.5 rounded-2xl border ${
                    isHealthyAttendance
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300'
                  } space-y-2`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4" /> Policy Requirement: 75%
                    </span>
                    <span className="text-xs font-black">{attendanceRate}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200/60 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isHealthyAttendance ? 'bg-emerald-500' : 'bg-amber-500'}`}
                      style={{ width: `${Math.min(100, attendanceRate)}%` }}
                    />
                  </div>
                  <p className="text-[11px] font-medium leading-relaxed">
                    {isHealthyAttendance
                      ? 'You are in Good Standing with the institutional attendance criteria.'
                      : 'Your attendance is currently below the 75% requirement. Please review your attendance record.'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Need Academic Support?
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    For leaves, medical exemptions, or attendance disputes, submit a request via the Attendance page.
                  </p>
                  <Link
                    to="/attendance"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline pt-0.5"
                  >
                    <span>File an Attendance Request</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </Card>
          )}

          {/* Faculty-specific: Classroom Readiness & Verification Advisory */}
          {isFaculty && (
            <Card title="Classroom Operations Guide" subtitle="HyperBuild & attendance protocols">
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-200/80 dark:border-cyan-800/60 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-cyan-900 dark:text-cyan-300">
                    <Zap className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                    <span>HyperBuild Live Sessions</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    Challenge keys remain active for <strong>180 seconds</strong> on the classroom screen. Students verify presence by entering the key on their devices.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-800/60 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 dark:text-indigo-300">
                    <ClipboardList className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Roll Call Reconciliation</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    Manual roll call is mapped directly to key verifications. Faculty can mark students present/absent directly from the live console.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Admin-specific: Venue Utilization & Approvals Inbox */}
          {isAdmin && (
            <>
              <Card
                title="Venue & Hall Utilization"
                subtitle="Campus space allocation"
                action={
                  <Link
                    to="/reports"
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center space-x-1"
                  >
                    <span>Details</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                }
              >
                {topVenues.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 text-center text-xs text-slate-500 dark:text-slate-400">
                    <Building2 className="h-6 w-6 mx-auto mb-1.5 opacity-40" />
                    <p>No venue bookings recorded yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {topVenues.map((v) => (
                      <div
                        key={v.venue}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Building2 className="h-4 w-4 text-slate-400" />
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{v.venue}</span>
                          </div>
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {v.utilization_percentage}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden mt-2">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${Math.min(100, v.utilization_percentage)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-1.5">
                          <span>{v.total_sessions} sessions</span>
                          <span>{v.total_hours} hrs booked</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card
                title="Pending Actions"
                subtitle="Requires review or sign-off"
                action={
                  <Link to="/approvals" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                    Inbox
                  </Link>
                }
              >
                {pendingApprovals.length === 0 ? (
                  <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center space-x-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                      All caught up! No pending approvals or urgent alerts.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {pendingApprovals.slice(0, 3).map((app) => (
                      <div
                        key={app.id}
                        className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-900 dark:text-amber-300 capitalize">
                            {app.entity_type.replace('_', ' ')}
                          </span>
                          <StatusBadge status={app.new_status} />
                        </div>
                        {app.context_summary && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2">
                            {app.context_summary}
                          </p>
                        )}
                      </div>
                    ))}
                    <Link
                      to="/approvals"
                      className="block text-center text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline pt-1"
                    >
                      Review all {pendingApprovals.length} pending items →
                    </Link>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>

      {/* ── MODAL: HYPERBUILD STUDENT WORKSPACE (180S KEY VERIFICATION) ───── */}
      {studentHyperbuildSession && (
        <StudentHyperbuildModal
          session={studentHyperbuildSession}
          onClose={() => setStudentHyperbuildSession(null)}
        />
      )}

      {/* ── MODAL: HYPERBUILD FACULTY LIVE CONSOLE (PROJECTOR COMMAND) ─────── */}
      {hyperbuildConsoleSession && (
        <HyperbuildLiveConsoleModal
          session={hyperbuildConsoleSession}
          onClose={() => setHyperbuildConsoleSession(null)}
        />
      )}

      {/* ── MODAL: ACADEMIC EVENT COMPLETE DETAILS ────────────────────────── */}
      <AcademicEventDetailModal
        isOpen={!!selectedEventForDetail}
        onClose={() => setSelectedEventForDetail(null)}
        event={selectedEventForDetail}
        canManage={isAdmin}
        onEdit={(ev) => {
          setSelectedEventForDetail(null);
          setEditingEvent(ev);
          setShowEventModal(true);
        }}
        onDelete={() => {
          setSelectedEventForDetail(null);
          queryClient.invalidateQueries({ queryKey: ['dashboard_academic_events'] });
        }}
      />

      {/* ── MODAL: SCHEDULE / EDIT ACADEMIC EVENT ─────────────────────────── */}
      {showEventModal && (
        <AcademicEventModal
          isOpen={showEventModal}
          onClose={() => {
            setShowEventModal(false);
            setEditingEvent(null);
          }}
          event={editingEvent}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['dashboard_academic_events'] });
          }}
          programs={programs}
          batches={batches}
          divisions={divisions}
        />
      )}
    </div>
  );
};
