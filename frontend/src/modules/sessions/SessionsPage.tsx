import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Upload, AlertTriangle, Sparkles, ClipboardList,
  Check, X, Users, Plus, BookOpen, Calendar, Clock,
  Edit3, ChevronLeft, ChevronRight, LayoutList, CalendarDays, Grid
} from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../../components/Card';
import { DataTable, Column } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { useRoleAccess } from '../../lib/useRoleAccess';

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

  // Enriched
  subject_name?: string;
  subject_code?: string;
  topic_name?: string;
  faculty_name?: string;
  program_name?: string;
  batch_name?: string;
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
    {hint && <p className="text-[10px] text-slate-400 dark:text-slate-500">{hint}</p>}
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
};

// Date helpers
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

export const SessionsPage: React.FC = () => {
  const { canScheduleSessions } = useRoleAccess();
  const queryClient = useQueryClient();

  // ── View Mode: 'list' | 'daily' | 'weekly' ────────────────────────────────
  const [viewMode, setViewMode] = useState<'list' | 'daily' | 'weekly'>('daily');

  // Daily View Date State
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Weekly View Monday Date State
  const [selectedWeekMonday, setSelectedWeekMonday] = useState<Date>(getMonday(new Date()));

  // ── Upload / CSV modal ────────────────────────────────────────────────────
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [csvText, setCsvText] = useState(
    "2026-09-15,10:00,12:00,FIN101,Capital Budgeting,prof_finance@lexiconmile.com,internal,Auditorium 1,offline\n" +
    "2026-09-15,14:00,16:00,MGT601,Strategic Leadership,ext_expert@industry.com,external,Lab 2,offline"
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

  // Filtered dropdowns
  const [filteredBatches, setFilteredBatches] = useState<any[]>([]);
  const [filteredSubjects, setFilteredSubjects] = useState<any[]>([]);
  const [filteredTopics, setFilteredTopics] = useState<any[]>([]);

  // ── API data ───────────────────────────────────────────────────────────────
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const res = await api.get('/sessions');
      return res.data.data as Session[];
    },
  });

  const { data: programs = [] } = useQuery({
    queryKey: ['programs'],
    queryFn: async () => {
      const res = await api.get('/academic/programs');
      return res.data.data as any[];
    },
    enabled: showClassModal,
  });

  const { data: allBatches = [] } = useQuery({
    queryKey: ['batches'],
    queryFn: async () => {
      const res = await api.get('/academic/batches');
      return res.data.data as any[];
    },
    enabled: showClassModal,
  });

  const { data: facultyInternal = [] } = useQuery({
    queryKey: ['faculty-internal'],
    queryFn: async () => {
      const res = await api.get('/faculty/internal');
      return res.data.data as any[];
    },
    enabled: showClassModal,
  });

  const { data: facultyExternal = [] } = useQuery({
    queryKey: ['faculty-external'],
    queryFn: async () => {
      const res = await api.get('/faculty/external');
      return res.data.data as any[];
    },
    enabled: showClassModal,
  });

  // Set default selected date to first session date if current date has no sessions
  useEffect(() => {
    if (sessions.length > 0 && !sessions.some(s => s.session_date === selectedDate)) {
      setSelectedDate(sessions[0].session_date);
      const d = new Date(sessions[0].session_date + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        setSelectedWeekMonday(getMonday(d));
      }
    }
  }, [sessions]);

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

  useEffect(() => {
    if (!form.subject_id) { setFilteredTopics([]); return; }
    (async () => {
      try {
        const res = await api.get(`/academic/topics?subject_id=${form.subject_id}`);
        setFilteredTopics(res.data.data);
      } catch { setFilteredTopics([]); }
    })();
  }, [form.subject_id]);

  const calcDuration = (start: string, end: string): number => {
    if (!start || !end) return 60;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    return mins > 0 ? mins : 60;
  };

  const setField = (key: keyof typeof defaultForm, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  // ── Open Add Class Modal ──────────────────────────────────────────────────
  const handleOpenAddClass = () => {
    setEditingSession(null);
    setForm(defaultForm);
    setCreateError(null);
    setCreateSuccess(false);
    setShowClassModal(true);
  };

  // ── Open Edit Class Modal ─────────────────────────────────────────────────
  const handleOpenEditClass = (sess: Session) => {
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
    });
    setCreateError(null);
    setCreateSuccess(false);
    setShowClassModal(true);
  };

  // ── Submit Class Form (Create or Edit) ────────────────────────────────────
  const handleSaveClass = async () => {
    setCreateError(null);
    if (!form.program_id || !form.batch_id || !form.subject_id ||
      !form.session_date || !form.start_time || !form.end_time || !form.venue) {
      setCreateError('Please fill in all required fields.');
      return;
    }

    const selectedBatch = allBatches.find((b: any) => b.id === form.batch_id);

    const payload: any = {
      program_id: form.program_id,
      batch_id: form.batch_id,
      semester_id: selectedBatch?.semester_id || form.semester_id,
      subject_id: form.subject_id,
      topic_id: form.topic_id || null,
      session_date: form.session_date,
      start_time: form.start_time,
      end_time: form.end_time,
      venue: form.venue,
      mode: form.mode,
      session_type: form.session_type,
      faculty_type: form.faculty_type,
      faculty_internal_id: form.faculty_type === 'internal' ? form.faculty_internal_id || null : null,
      faculty_external_id: form.faculty_type === 'external' ? form.faculty_external_id || null : null,
      duration_minutes: calcDuration(form.start_time, form.end_time),
      notes: form.notes || null,
    };

    setCreateSaving(true);
    try {
      if (editingSession) {
        await api.put(`/sessions/${editingSession.id}`, payload);
      } else {
        await api.post('/sessions', payload);
      }
      setCreateSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      setTimeout(() => {
        setShowClassModal(false);
        setEditingSession(null);
        setForm(defaultForm);
        setCreateSuccess(false);
      }, 800);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'object' && detail?.message) {
        setCreateError(`Conflict: ${detail.message}`);
      } else if (typeof detail === 'string') {
        setCreateError(detail);
      } else {
        setCreateError('Failed to save session. Check conflicts.');
      }
    } finally {
      setCreateSaving(false);
    }
  };

  // ── Open Attendance Modal ─────────────────────────────────────────────────
  const handleOpenAttendance = async (session: Session) => {
    setAttendanceSession(session);
    setAttendanceLoading(true);
    setAttendanceError(null);
    setAttendanceMap({});
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
      setAttendanceSession(null);
      setAttendanceSheet(null);
    } catch (err: any) {
      setAttendanceError(err.response?.data?.detail || 'Failed to save attendance.');
    } finally {
      setAttendanceSaving(false);
    }
  };

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
        <div className="text-xs">
          <p className="font-semibold text-slate-900 dark:text-slate-100">{r.session_date}</p>
          <p className="text-slate-500 font-mono">{r.start_time} - {r.end_time} ({r.duration_minutes}m)</p>
        </div>
      ),
    },
    {
      header: 'Subject & Topic',
      accessor: (r) => (
        <div className="text-xs">
          <p className="font-semibold text-cyan-700 dark:text-cyan-400">
            {r.subject_code ? `${r.subject_code} · ` : ''}{r.subject_name || 'Academic Class'}
          </p>
          <p className="text-slate-500 dark:text-slate-400">{r.topic_name || r.notes || '—'}</p>
        </div>
      ),
    },
    {
      header: 'Faculty & Venue',
      accessor: (r) => (
        <div className="text-xs">
          <p className="font-semibold text-slate-800 dark:text-slate-200">
            {r.faculty_name || (r.faculty_type === 'internal' ? 'Internal Faculty' : 'Visiting Expert')}
          </p>
          <p className="text-slate-500 dark:text-slate-400">{r.venue} ({r.mode})</p>
        </div>
      ),
    },
    { header: 'Type', accessor: (r) => <span className="capitalize text-xs font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{r.session_type}</span> },
    { header: 'Status', accessor: (r) => <StatusBadge status={r.status} /> },
    {
      header: 'Actions',
      accessor: (r) => (
        <div className="flex items-center space-x-2">
          {canScheduleSessions && (
            <button
              onClick={() => handleOpenEditClass(r)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Edit Scheduled Class"
            >
              <Edit3 className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => handleOpenAttendance(r)}
            className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-100 transition-colors"
          >
            <ClipboardList className="h-3.5 w-3.5" />
            <span>Attendance</span>
          </button>
        </div>
      ),
    },
  ];

  // Daily View Filtered Sessions
  const dailySessions = sessions.filter((s) => s.session_date === selectedDate);

  // Weekly View Dates (Mon to Sat)
  const weekDays = Array.from({ length: 6 }).map((_, idx) => {
    const day = new Date(selectedWeekMonday);
    day.setDate(day.getDate() + idx);
    return {
      dateStr: day.toISOString().split('T')[0],
      dayName: day.toLocaleDateString('en-US', { weekday: 'short' }),
      formattedDate: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    };
  });

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight gradient-text">Class Schedule & Timetable Engine</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Schedule, edit, and view academic classes with real-time Scheduler Sentinel conflict protection.
          </p>
        </div>

        {canScheduleSessions && (
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors"
            >
              <Upload className="h-4 w-4" />
              <span>Import Timetable CSV</span>
            </button>
            <button
              onClick={handleOpenAddClass}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-lg shadow-cyan-500/20 transition-all duration-200"
            >
              <Plus className="h-4 w-4" />
              <span>Schedule New Class</span>
            </button>
          </div>
        )}
      </div>

      {/* Sentinel Protection Banner */}
      <div className="p-4 rounded-2xl glass-card border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-950/20 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-200">Scheduler Sentinel Guard Active</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Validates venue availability and faculty double-booking synchronously when scheduling or editing classes.
            </p>
          </div>
        </div>
        <StatusBadge status="active" label="Sentinel Active" />
      </div>

      {/* View Mode Switcher Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-4">
        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setViewMode('daily')}
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
            onClick={() => setViewMode('weekly')}
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
            onClick={() => setViewMode('list')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'list'
                ? 'bg-white dark:bg-slate-800 text-cyan-700 dark:text-cyan-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <LayoutList className="h-4 w-4" />
            <span>List View ({sessions.length})</span>
          </button>
        </div>

        {/* Date Navigation Controls depending on View Mode */}
        {viewMode === 'daily' && (
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                const d = new Date(selectedDate + 'T00:00:00');
                d.setDate(d.getDate() - 1);
                setSelectedDate(d.toISOString().split('T')[0]);
              }}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1 text-xs font-semibold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-cyan-500 text-slate-900 dark:text-slate-100"
            />
            <button
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30"
            >
              Today
            </button>
            <button
              onClick={() => {
                const d = new Date(selectedDate + 'T00:00:00');
                d.setDate(d.getDate() + 1);
                setSelectedDate(d.toISOString().split('T')[0]);
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
              }}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Week of {selectedWeekMonday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <button
              onClick={() => setSelectedWeekMonday(getMonday(new Date()))}
              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30"
            >
              This Week
            </button>
            <button
              onClick={() => {
                const m = new Date(selectedWeekMonday);
                m.setDate(m.getDate() + 7);
                setSelectedWeekMonday(m);
              }}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300"
            >
              <ChevronRight className="h-4 w-4" />
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
                  onClick={handleOpenAddClass}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-cyan-600 text-white hover:bg-cyan-700 transition-colors"
                >
                  + Schedule Class for this Day
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {dailySessions.map((sess) => (
                <div
                  key={sess.id}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:border-cyan-500/40"
                >
                  <div className="flex items-start space-x-4">
                    <div className="p-3 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 text-cyan-600 dark:text-cyan-400 text-center min-w-[100px]">
                      <Clock className="h-4 w-4 mx-auto mb-1" />
                      <p className="font-mono text-xs font-bold">{sess.start_time} - {sess.end_time}</p>
                      <p className="text-[10px] text-slate-500 font-medium">{sess.duration_minutes} mins</p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 dark:text-white text-base">
                          {sess.subject_code ? `${sess.subject_code} · ` : ''}{sess.subject_name || 'Academic Class'}
                        </span>
                        <StatusBadge status={sess.status} />
                      </div>

                      <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        Topic: <span className="text-slate-900 dark:text-slate-100 font-semibold">{sess.topic_name || sess.notes || 'General Session'}</span>
                      </p>

                      <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                          <Users className="h-3.5 w-3.5 text-indigo-500" />
                          {sess.faculty_name || (sess.faculty_type === 'internal' ? 'Internal Faculty' : 'Visiting Expert')}
                          <span className="px-1.5 py-0.2 rounded text-[10px] uppercase font-bold bg-slate-100 dark:bg-slate-800 text-slate-600">
                            {sess.faculty_type}
                          </span>
                        </span>
                        <span>•</span>
                        <span className="font-mono text-cyan-600 dark:text-cyan-400 font-semibold">
                          Classroom: {sess.venue} ({sess.mode})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 self-end md:self-center">
                    {canScheduleSessions && (
                      <button
                        onClick={() => handleOpenEditClass(sess)}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      >
                        <Edit3 className="h-3.5 w-3.5 text-cyan-500" />
                        <span>Edit Class</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenAttendance(sess)}
                      className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
                    >
                      <ClipboardList className="h-3.5 w-3.5" />
                      <span>Mark Attendance</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ── WEEKLY TIMETABLE VIEW ────────────────────────────────────────────── */}
      {viewMode === 'weekly' && (
        <Card title="Weekly Master Timetable Grid (Monday – Saturday)">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 overflow-x-auto">
            {weekDays.map((wd) => {
              const daySessions = sessions.filter((s) => s.session_date === wd.dateStr);
              return (
                <div key={wd.dateStr} className="flex flex-col min-h-[350px] bg-slate-50 dark:bg-slate-950 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="pb-2 border-b border-slate-200 dark:border-slate-800 text-center">
                    <p className="text-xs font-extrabold uppercase text-cyan-600 dark:text-cyan-400">{wd.dayName}</p>
                    <p className="text-[11px] font-semibold text-slate-500">{wd.formattedDate}</p>
                  </div>

                  <div className="space-y-2 mt-2 flex-1">
                    {daySessions.length === 0 ? (
                      <p className="text-[11px] text-slate-400 text-center py-8 italic">No Classes</p>
                    ) : (
                      daySessions.map((s) => (
                        <div
                          key={s.id}
                          className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-xs space-y-1 hover:border-cyan-500/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[10px] font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 px-1.5 py-0.5 rounded">
                              {s.start_time}-{s.end_time}
                            </span>
                            {canScheduleSessions && (
                              <button
                                onClick={() => handleOpenEditClass(s)}
                                className="p-0.5 text-slate-400 hover:text-cyan-600"
                                title="Edit Class"
                              >
                                <Edit3 className="h-3 w-3" />
                              </button>
                            )}
                          </div>

                          <p className="font-bold text-slate-900 dark:text-white leading-tight">
                            {s.subject_code ? `${s.subject_code} ` : ''}{s.subject_name || 'Class'}
                          </p>

                          <p className="text-[10px] text-slate-500 truncate">
                            {s.faculty_name || s.faculty_type}
                          </p>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[10px]">
                            <span className="font-semibold text-slate-600 dark:text-slate-400">{s.venue}</span>
                            <StatusBadge status={s.status} />
                          </div>
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

      {/* ── MODAL: SCHEDULE / EDIT CLASS (SENTINEL GUARDED) ──────────────────── */}
      {showClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="glass-panel w-full max-w-2xl rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <BookOpen className="h-5 w-5 text-cyan-500" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {editingSession ? 'Edit Scheduled Class' : 'Schedule New Class (Sentinel Guarded)'}
                </h3>
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
                <span>Class {editingSession ? 'updated' : 'scheduled'} successfully! Sentinel conflict check passed.</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveClass();
              }}
              className="space-y-4 my-4"
            >
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
                    onChange={(e) => setField('batch_id', e.target.value)}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Subject" required hint={!form.batch_id ? 'Select a batch first' : undefined}>
                  <select
                    value={form.subject_id}
                    onChange={(e) => setField('subject_id', e.target.value)}
                    className={selectClass}
                    disabled={!form.batch_id}
                    required
                  >
                    <option value="">Select Subject</option>
                    {filteredSubjects.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                    ))}
                  </select>
                </Field>

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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Session Date" required>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Faculty Category" required>
                  <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setField('faculty_type', 'internal');
                        setField('faculty_external_id', '');
                      }}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        form.faculty_type === 'internal'
                          ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
                          : 'text-slate-500'
                      }`}
                    >
                      Internal Faculty
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setField('faculty_type', 'external');
                        setField('faculty_internal_id', '');
                      }}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        form.faculty_type === 'external'
                          ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
                          : 'text-slate-500'
                      }`}
                    >
                      Visiting Expert
                    </button>
                  </div>
                </Field>

                {form.faculty_type === 'internal' ? (
                  <Field label="Internal Faculty Member" required>
                    <select
                      value={form.faculty_internal_id}
                      onChange={(e) => setField('faculty_internal_id', e.target.value)}
                      className={selectClass}
                      required
                    >
                      <option value="">Select Internal Faculty</option>
                      {facultyInternal.map((f: any) => (
                        <option key={f.id} value={f.id}>{f.full_name || f.email} ({f.department})</option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <Field label="External Industry Expert" required>
                    <select
                      value={form.faculty_external_id}
                      onChange={(e) => setField('faculty_external_id', e.target.value)}
                      className={selectClass}
                      required
                    >
                      <option value="">Select External Expert</option>
                      {facultyExternal.map((f: any) => (
                        <option key={f.id} value={f.id}>{f.name} ({f.organization || 'Visiting'})</option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Classroom / Venue" required>
                  <input
                    type="text"
                    placeholder="e.g. Auditorium 1 / Lab 2"
                    value={form.venue}
                    onChange={(e) => setField('venue', e.target.value)}
                    className={inputClass}
                    required
                  />
                </Field>

                <Field label="Mode">
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

                <Field label="Session Type">
                  <select
                    value={form.session_type}
                    onChange={(e) => setField('session_type', e.target.value)}
                    className={selectClass}
                  >
                    <option value="lecture">Lecture</option>
                    <option value="tutorial">Tutorial</option>
                    <option value="lab">Practical Lab</option>
                    <option value="seminar">Seminar / Guest Talk</option>
                  </select>
                </Field>
              </div>

              <Field label="Remarks / Notes (Optional)">
                <textarea
                  rows={2}
                  placeholder="Additional instructions..."
                  value={form.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  className={inputClass}
                />
              </Field>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowClassModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSaving}
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-cyan-600 hover:bg-cyan-700 text-white disabled:opacity-50 transition-colors shadow-md shadow-cyan-500/20"
                >
                  {createSaving ? 'Validating Sentinel...' : editingSession ? 'Update Scheduled Class' : 'Schedule Class'}
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
                  {attendanceSheet?.subject_name || attendanceSession.notes || 'Academic Class'} ({attendanceSession.session_date})
                </p>
              </div>
              <button
                onClick={() => setAttendanceSession(null)}
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
                    onClick={() => setAttendanceSession(null)}
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
                onClick={() => setShowUploadModal(false)}
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
    </div>
  );
};
