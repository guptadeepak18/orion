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

export const DashboardPage: React.FC = () => {
  const { user, updateUser } = useAuthStore();

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

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['dashboard_summary'],
    queryFn: async () => {
      const res = await api.get('/dashboard/summary');
      return res.data.data;
    },
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
  });

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
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

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="glass-panel rounded-3xl p-6 md:p-8 border border-slate-200/90 dark:border-slate-800/80 relative overflow-hidden transition-all duration-300 shadow-sm bg-gradient-to-r from-slate-50/80 via-indigo-50/30 to-cyan-50/50 dark:from-slate-900/90 dark:via-slate-900/60 dark:to-slate-950/90">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-cyan-500/10 via-indigo-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5 min-w-0 flex-1">
            <h1 className="text-2xl md:text-3.5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {getGreeting()}, <span className="gradient-text">{getDisplayName()}</span>
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">
              Welcome to <span className="font-semibold text-cyan-600 dark:text-cyan-400">Orion by HyperBuild</span> — Empowering institutional excellence with intelligent academic operations.
            </p>
          </div>

          {/* Right Side: Live Date & Time Widget (Seamless Background, No White Box) */}
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
      </div>

      {/* Metric Cards Grid */}
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
            subtitle="SLA Watchdog"
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

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Upcoming Sessions & Quick Actions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upcoming Academic Sessions */}
          <Card
            title="Upcoming Academic Sessions"
            subtitle="Real-time schedule & venue allocation"
            action={
              <Link
                to="/calendar"
                className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center space-x-1"
              >
                <span>View Full Calendar</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            }
          >
            {upcomingSessions.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No upcoming sessions scheduled yet.</p>
                <Link
                  to="/sessions"
                  className="mt-3 inline-flex items-center space-x-1 text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline"
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                  <span>Import or schedule a session</span>
                </Link>
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
                          {s.venue || 'Auditorium'}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 capitalize font-medium">
                          {s.mode || 'offline'}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 capitalize font-medium">
                          {s.faculty_type || 'internal'}
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
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Sessions & CSV</p>
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
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Directory & Marks</p>
              </Link>

              <Link
                to="/reports"
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 text-center transition-all group"
              >
                <div className="h-10 w-10 mx-auto rounded-xl bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <FileText className="h-5 w-5" />
                </div>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Reports</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Remuneration & Audit</p>
              </Link>
            </div>
          </Card>
        </div>

        {/* Right Column: Syllabus Progress, Venue Allocation & Pending Action Items */}
        <div className="space-y-6">
          {/* Syllabus Completion Tracker */}
          <Card
            title="Syllabus Delivery Progress"
            subtitle="Academic milestone tracking"
            action={
              <Link
                to="/reports"
                className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center space-x-1"
              >
                <span>View All</span>
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

          {/* Campus Venue Utilization */}
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

          {/* Pending Action Items */}
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
        </div>
      </div>
    </div>
  );
};


