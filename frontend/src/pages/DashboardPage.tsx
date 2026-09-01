import React from 'react';
import { useQuery } from '@tanstack/react-query';
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
} from 'lucide-react';

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
  case_studies_count: number;
  cgpa?: number;
}

export const DashboardPage: React.FC = () => {
  const { user, updateUser } = useAuthStore();

  const isStudent = Boolean(user?.roles?.includes('student') && !user?.roles?.includes('crc_admin'));

  // Real-time live clock state
  const [currentTime, setCurrentTime] = React.useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['dashboard_summary'],
    queryFn: async () => {
      const res = await api.get('/dashboard/summary');
      return res.data.data;
    },
    enabled: !isStudent,
  });

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
    staleTime: 1000 * 60 * 60 * 6, // 6 hours cache
  });

  const { data: sessions } = useQuery({
    queryKey: ['dashboard_sessions'],
    queryFn: async () => {
      const res = await api.get('/sessions');
      return (res.data.data || []) as SessionItem[];
    },
  });

  const { data: pendingApprovals } = useQuery({
    queryKey: ['dashboard_pending_approvals'],
    queryFn: async () => {
      const res = await api.get('/approvals/pending');
      return (res.data.data || []) as PendingApproval[];
    },
    enabled: !isStudent,
  });

  const { data: syllabusList } = useQuery({
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

  const { data: venueList } = useQuery({
    queryKey: ['dashboard_venue_utilization'],
    queryFn: async () => {
      try {
        const res = await api.get('/reports/venue-utilization');
        return (res.data.data || []) as VenueItem[];
      } catch {
        return [] as VenueItem[];
      }
    },
    enabled: !isStudent,
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

  const upcomingSessions = (sessions || []).slice(0, 4);
  const activeSyllabus = (syllabusList || []).slice(0, 3);
  const topVenues = (venueList || []).slice(0, 3);

  // Student metrics
  const attendanceRate = studentSummary?.attendance_percentage ?? 100.0;
  const isHealthyAttendance = attendanceRate >= 75.0;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="glass-panel rounded-3xl p-6 md:p-8 border border-slate-200/90 dark:border-slate-800/80 relative overflow-hidden transition-all duration-300 shadow-sm bg-gradient-to-r from-slate-50/80 via-indigo-50/30 to-cyan-50/50 dark:from-slate-900/90 dark:via-slate-900/60 dark:to-slate-950/90 space-y-4">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-cyan-500/10 via-indigo-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        
        {/* Top Section: Greeting & Live Clock */}
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5 min-w-0 flex-1">
            <h1 className="text-2xl md:text-3.5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {getGreeting()}, <span className="gradient-text">{getDisplayName()}</span>
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">
              {isStudent ? (
                <>
                  Academic Student Portal • <span className="font-semibold text-cyan-600 dark:text-cyan-400">{studentSummary?.program_name || 'PGDM'}</span>
                  {studentSummary?.batch_name ? ` — ${studentSummary.batch_name}` : ''}
                  {studentSummary?.division_name ? ` (${studentSummary.division_name})` : ''} • Trimester {studentSummary?.trimester || 1}
                </>
              ) : (
                <>
                  Welcome to <span className="font-semibold text-cyan-600 dark:text-cyan-400">Lexicon MILE Academic Operations</span> — Centralized management for schedules, attendance, syllabus, and learning.
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

      {/* Metric Cards Grid */}
      {isStudent ? (
        /* STUDENT-SPECIFIC METRIC CARDS */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* 1. Attendance Rate */}
          <Link to="/attendance" className="group block">
            <Card
              title="Attendance Rate"
              subtitle={studentSummary?.attendance_standing || (isHealthyAttendance ? 'Good Standing' : 'Attendance Advisory')}
              action={
                <div className={`p-2 rounded-xl border ${isHealthyAttendance ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'} group-hover:scale-110 transition-transform`}>
                  {isHealthyAttendance ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                </div>
              }
            >
              <div className="mt-2 flex items-baseline justify-between">
                <span className={`text-3xl font-extrabold ${isHealthyAttendance ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {studentSummaryLoading ? '—' : `${attendanceRate}%`}
                </span>
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center space-x-1 group-hover:translate-x-0.5 transition-transform">
                  <span>View Record</span>
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
                  {studentSummaryLoading ? '—' : (studentSummary?.enrolled_subjects_count ?? 6)}
                </span>
                <span className="text-xs font-semibold text-cyan-700 dark:text-cyan-400 flex items-center space-x-1 group-hover:translate-x-0.5 transition-transform">
                  <span>LMS Hub</span>
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                Active learning modules & resources
              </p>
            </Card>
          </Link>

          {/* 3. Class Timetable / Upcoming */}
          <Link to="/sessions" className="group block">
            <Card
              title="Class Timetable"
              subtitle="Lectures & Sessions"
              action={<Calendar className="h-5 w-5 text-sky-600 dark:text-sky-400 group-hover:scale-110 transition-transform" />}
            >
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-3xl font-bold text-slate-900 dark:text-white">
                  {studentSummaryLoading ? '—' : (studentSummary?.upcoming_sessions_count ?? upcomingSessions.length)}
                </span>
                <span className="text-xs font-semibold text-sky-700 dark:text-sky-400 flex items-center space-x-1 group-hover:translate-x-0.5 transition-transform">
                  <span>Schedule</span>
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                Upcoming for your batch & division
              </p>
            </Card>
          </Link>

          {/* 4. Case Studies & Activities */}
          <Link to="/case-studies" className="group block">
            <Card
              title="Case Study Bank"
              subtitle="Business & Practical Studies"
              action={<Briefcase className="h-5 w-5 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />}
            >
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-3xl font-bold text-slate-900 dark:text-white">
                  {studentSummaryLoading ? '—' : (studentSummary?.case_studies_count ?? 4)}
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
      ) : (
        /* STAFF / ADMIN METRIC CARDS */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <Link to="/academic" className="group block">
            <Card
              title="Active Programs"
              subtitle="Program Setup"
              action={<Layers className="h-5 w-5 text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-transform" />}
            >
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-3xl font-bold text-slate-900 dark:text-white">
                  {summaryLoading ? '—' : (summary?.active_programs_count ?? 0)}
                </span>
                <span className="text-xs font-semibold text-cyan-700 dark:text-cyan-400 flex items-center space-x-1 group-hover:translate-x-0.5 transition-transform">
                  <span>Manage</span>
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Card>
          </Link>

          <Link to="/faculty" className="group block">
            <Card
              title="Faculty Directory"
              subtitle="Internal & External"
              action={<Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />}
            >
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-3xl font-bold text-slate-900 dark:text-white">
                  {summaryLoading ? '—' : (summary?.faculty_count ?? 0)}
                </span>
                <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 flex items-center space-x-1 group-hover:translate-x-0.5 transition-transform">
                  <span>Directory</span>
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Card>
          </Link>

          <Link to="/sessions" className="group block">
            <Card
              title="Scheduled Sessions"
              subtitle="Master Timetable"
              action={<Calendar className="h-5 w-5 text-sky-600 dark:text-sky-400 group-hover:scale-110 transition-transform" />}
            >
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-3xl font-bold text-slate-900 dark:text-white">
                  {summaryLoading ? '—' : (summary?.scheduled_sessions_count ?? 0)}
                </span>
                <span className="text-xs font-semibold text-sky-700 dark:text-sky-400 flex items-center space-x-1 group-hover:translate-x-0.5 transition-transform">
                  <span>Sessions</span>
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Card>
          </Link>

          <Link to="/approvals" className="group block">
            <Card
              title="Pending Approvals"
              subtitle="Awaiting Review & Sign-off"
              action={<FileCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />}
            >
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-3xl font-bold text-slate-900 dark:text-white">
                  {summaryLoading ? '—' : (summary?.pending_approvals_count ?? 0)}
                </span>
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center space-x-1 group-hover:translate-x-0.5 transition-transform">
                  <span>Review</span>
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Card>
          </Link>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Upcoming Classes & Quick Actions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upcoming Academic Classes */}
          <Card
            title={isStudent ? "My Upcoming Classes" : "Upcoming Academic Sessions"}
            subtitle={isStudent ? "Real-time class schedule, faculty & classroom details" : "Real-time schedule & venue allocation"}
            action={
              <Link
                to="/sessions?view=calendar"
                className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center space-x-1"
              >
                <span>View Full Schedule & Calendar</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            }
          >
            {upcomingSessions.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>{isStudent ? "No upcoming lectures scheduled today. Check back later or view the calendar." : "No upcoming sessions scheduled yet."}</p>
                {!isStudent && (
                  <Link
                    to="/sessions"
                    className="mt-3 inline-flex items-center space-x-1 text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline"
                  >
                    <CalendarPlus className="h-3.5 w-3.5" />
                    <span>Import or schedule a session</span>
                  </Link>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {upcomingSessions.map((s) => (
                  <div
                    key={s.id}
                    className="py-3.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 px-2 rounded-xl transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {s.venue || 'Classroom / Auditorium'}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 capitalize font-medium">
                          {s.mode || 'offline'}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 capitalize font-medium">
                          {s.faculty_type || 'Faculty'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span>{s.session_date}</span>
                        <span>•</span>
                        <span className="font-mono">{s.start_time} - {s.end_time}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 shrink-0">
                      <StatusBadge status={s.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Quick Action Shortcuts */}
          {isStudent ? (
            /* STUDENT QUICK ACTIONS */
            <Card title="Student Quick Actions" subtitle="Direct access to your academic and learning portals">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                <Link
                  to="/lms"
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-cyan-500/50 hover:bg-cyan-50/30 dark:hover:bg-cyan-950/20 text-center transition-all group"
                >
                  <div className="h-10 w-10 mx-auto rounded-xl bg-cyan-100 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Course LMS</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Modules & Notes</p>
                </Link>

                <Link
                  to="/attendance"
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 text-center transition-all group"
                >
                  <div className="h-10 w-10 mx-auto rounded-xl bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">My Attendance</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Logs & Standing</p>
                </Link>

                <Link
                  to="/case-studies"
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 text-center transition-all group"
                >
                  <div className="h-10 w-10 mx-auto rounded-xl bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Case Studies</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Management Library</p>
                </Link>

                <Link
                  to="/feedback"
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-500/50 hover:bg-purple-50/30 dark:hover:bg-purple-950/20 text-center transition-all group"
                >
                  <div className="h-10 w-10 mx-auto rounded-xl bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Feedback</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Faculty Evaluation</p>
                </Link>

                <Link
                  to="/profile"
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-500/50 hover:bg-sky-50/30 dark:hover:bg-sky-950/20 text-center transition-all group"
                >
                  <div className="h-10 w-10 mx-auto rounded-xl bg-sky-100 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <User className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">My Profile</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Personal Details</p>
                </Link>
              </div>
            </Card>
          ) : (
            /* STAFF QUICK ACTIONS */
            <Card title="Quick Actions" subtitle="Frequently used administrative workflows">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Link
                  to="/sessions"
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-cyan-500/50 hover:bg-cyan-50/30 dark:hover:bg-cyan-950/20 text-center transition-all group"
                >
                  <div className="h-10 w-10 mx-auto rounded-xl bg-cyan-100 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <CalendarPlus className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Schedule</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Manage Timetable</p>
                </Link>

                <Link
                  to="/faculty"
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 text-center transition-all group"
                >
                  <div className="h-10 w-10 mx-auto rounded-xl bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <UserPlus className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Add Faculty</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Internal & External</p>
                </Link>

                <Link
                  to="/students"
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-500/50 hover:bg-sky-50/30 dark:hover:bg-sky-950/20 text-center transition-all group"
                >
                  <div className="h-10 w-10 mx-auto rounded-xl bg-sky-100 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Students</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Directory & Profiles</p>
                </Link>

                <Link
                  to="/reports"
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 text-center transition-all group"
                >
                  <div className="h-10 w-10 mx-auto rounded-xl bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <FileText className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Reports</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Analytics & Logs</p>
                </Link>
              </div>
            </Card>
          )}
        </div>

        {/* Right Column: Syllabus Progress & Advisory */}
        <div className="space-y-6">
          {/* Syllabus Completion Tracker */}
          <Card
            title="Syllabus Delivery Progress"
            subtitle={isStudent ? "Course topic coverage" : "Academic milestone tracking"}
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
                        <span className="text-slate-400 dark:text-slate-500 ml-1.5 font-mono text-[11px]">({sub.subject_code})</span>
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
                      <span>{sub.completed_topics} of {sub.total_topics} topics covered</span>
                      <span>{sub.completion_index >= 100 ? 'Completed' : 'In Progress'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {isStudent ? (
            /* STUDENT ATTENDANCE ADVISORY & STANDING */
            <Card
              title="Attendance Standing"
              subtitle="Lexicon MILE compliance standard"
              action={
                <Link
                  to="/attendance"
                  className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center space-x-1"
                >
                  <span>Details</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              }
            >
              <div className="space-y-3.5">
                <div className={`p-3.5 rounded-2xl border ${isHealthyAttendance ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300' : 'bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300'} space-y-2`}>
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
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Need Academic Support?</span>
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
          ) : (
            /* STAFF CAMPUS VENUE UTILIZATION & PENDING APPROVALS */
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
                      <div key={v.venue} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
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
                  <Link
                    to="/approvals"
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Inbox
                  </Link>
                }
              >
                {(pendingApprovals || []).length === 0 ? (
                  <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center space-x-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                      All caught up! No pending approvals or urgent alerts.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {(pendingApprovals || []).slice(0, 3).map((app) => (
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
                      Review all {pendingApprovals?.length} pending items →
                    </Link>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
};


