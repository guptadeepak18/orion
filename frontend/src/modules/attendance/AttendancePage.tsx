import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  Users,
  Search,
  BookOpen,
  AlertTriangle,
  Lock,
  FileCheck2,
  X,
  UserCheck,
  RefreshCw,
  Download,
  Printer,
  Play,
  ArrowLeft,
  ArrowRight,
  FileSpreadsheet,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../lib/store';
import { AttendanceCorrectionModal } from './AttendanceCorrectionModal';

export const AttendancePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const userRoles = user?.roles || [];
  const isFaculty = userRoles.includes('faculty_internal') || userRoles.includes('faculty_external');
  const isStudent = Boolean(userRoles.includes('student') && !userRoles.includes('crc_admin'));

  // URL sync state
  const defaultTab = isStudent ? 'students' : 'sessions';
  const rawTab = searchParams.get('tab') || defaultTab;
  const activeTab = (isStudent && ['sessions', 'register', 'matrix'].includes(rawTab)) ? 'students' : rawTab;
  const selectedSessionIdParam = searchParams.get('sessionId');
  const selectedSubjectIdParam = searchParams.get('subjectId');
  const selectedStudentIdParam = searchParams.get('studentId');

  // Helper to update search params smoothly while preserving active tab
  const updateParams = (newParams: Record<string, string | null>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (!next.has('tab')) next.set('tab', activeTab);
      Object.entries(newParams).forEach(([k, v]) => {
        if (v === null || v === undefined) {
          next.delete(k);
        } else {
          next.set(k, v);
        }
      });
      return next;
    }, { replace: true });
  };

  const setTab = (tab: string) => setSearchParams({ tab });

  // Current student query if user is student
  const { data: myStudentProfile } = useQuery({
    queryKey: ['my_student_profile_for_attendance'],
    queryFn: async () => {
      const res = await api.get('/students/me');
      return res.data.data;
    },
    enabled: isStudent,
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB 1: SESSIONS / MARK ATTENDANCE
  // ─────────────────────────────────────────────────────────────────────────────
  const [sessionDateFilter, setSessionDateFilter] = useState<string>('');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(selectedSessionIdParam || null);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>({});
  const [remarksMap, setRemarksMap] = useState<Record<string, string>>({});
  const [markingSuccessMsg, setMarkingSuccessMsg] = useState<string | null>(null);

  // Roster Filter and Search State
  const [rosterSearch, setRosterSearch] = useState<string>('');
  const [rosterStatusFilter, setRosterStatusFilter] = useState<string>('all');

  // Kiosk / Interactive Focus Roll-Call Mode State
  const [isKioskOpen, setIsKioskOpen] = useState<boolean>(false);
  const [kioskIndex, setKioskIndex] = useState<number>(0);
  const [kioskAutoAdvance, setKioskAutoAdvance] = useState<boolean>(true);

  // Sync selectedSessionId with URL
  useEffect(() => {
    if (selectedSessionIdParam !== selectedSessionId) {
      setSelectedSessionId(selectedSessionIdParam || null);
    }
  }, [selectedSessionIdParam]);

  // Query allocated sessions
  const { data: allocatedSessionsData = [], isPending: sessionsLoading, refetch: refetchSessions } = useQuery({
    queryKey: ['attendance_allocated_sessions', sessionDateFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (sessionDateFilter) params.append('session_date', sessionDateFilter);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await api.get(`/attendance/sessions${qs}`);
      return (res.data?.data || []) as any[];
    },
    enabled: !isStudent,
  });

  // Auto-select first session if none selected and on sessions tab
  useEffect(() => {
    if (activeTab === 'sessions' && !selectedSessionId && allocatedSessionsData && allocatedSessionsData.length > 0) {
      const firstId = selectedSessionIdParam || allocatedSessionsData[0].id;
      setSelectedSessionId(firstId);
      updateParams({ sessionId: firstId });
    }
  }, [activeTab, allocatedSessionsData, selectedSessionId, selectedSessionIdParam]);

  // Query selected session attendance sheet
  const {
    data: activeSheetData,
  } = useQuery({
    queryKey: ['session_attendance_sheet', selectedSessionId],
    queryFn: async () => {
      if (!selectedSessionId) return null;
      const res = await api.get(`/sessions/${selectedSessionId}/attendance`);
      return res.data?.data;
    },
    enabled: !!selectedSessionId && !isStudent,
  });

  // Populate local attendance map when sheet is loaded
  useEffect(() => {
    if (activeSheetData?.students) {
      const map: Record<string, string> = {};
      const rem: Record<string, string> = {};
      activeSheetData.students.forEach((st: any) => {
        map[st.student_id] = st.status || 'present';
        if (st.remarks) rem[st.student_id] = st.remarks;
      });
      setAttendanceMap(map);
      setRemarksMap(rem);
    }
  }, [activeSheetData]);

  // Mutation: Mark and lock attendance
  const markAttendanceMutation = useMutation({
    mutationFn: async ({ sessionId, attendances }: { sessionId: string; attendances: any[] }) => {
      const res = await api.post(`/attendance/sessions/${sessionId}/mark-and-lock`, { attendances });
      return res.data.data;
    },
    onSuccess: () => {
      setMarkingSuccessMsg('Attendance finalized and locked successfully!');
      queryClient.invalidateQueries({ queryKey: ['attendance_allocated_sessions'] });
      queryClient.invalidateQueries({ queryKey: ['session_attendance_sheet'] });
      queryClient.invalidateQueries({ queryKey: ['subject_attendance_summary'] });
      queryClient.invalidateQueries({ queryKey: ['debarment_risk'] });
      queryClient.invalidateQueries({ queryKey: ['class_attendance_register'] });
      queryClient.invalidateQueries({ queryKey: ['subject_attendance_matrix'] });
      setTimeout(() => setMarkingSuccessMsg(null), 4000);
      setIsKioskOpen(false);
    },
  });

  const handleSaveAttendance = () => {
    if (!selectedSessionId || !activeSheetData) return;
    const records = activeSheetData.students.map((st: any) => ({
      student_id: st.student_id,
      status: attendanceMap[st.student_id] || 'present',
      remarks: remarksMap[st.student_id] || undefined,
    }));
    markAttendanceMutation.mutate({ sessionId: selectedSessionId, attendances: records });
  };

  // Keyboard navigation listener for Kiosk Roll-Call Mode
  useEffect(() => {
    if (!isKioskOpen || !activeSheetData?.students) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      const currentStudent = activeSheetData.students[kioskIndex];
      if (!currentStudent) return;

      const key = e.key.toUpperCase();

      const assignStatus = (status: string) => {
        setAttendanceMap((prev) => ({ ...prev, [currentStudent.student_id]: status }));
        if (kioskAutoAdvance && kioskIndex < activeSheetData.students.length - 1) {
          setKioskIndex((i) => i + 1);
        }
      };

      if (key === 'P') {
        e.preventDefault();
        assignStatus('present');
      } else if (key === 'A') {
        e.preventDefault();
        assignStatus('absent');
      } else if (key === 'L') {
        e.preventDefault();
        assignStatus('late');
      } else if (key === 'E') {
        e.preventDefault();
        assignStatus('excused');
      } else if (key === 'O' || key === 'D') {
        e.preventDefault();
        assignStatus('od_duty');
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        if (kioskIndex < activeSheetData.students.length - 1) {
          setKioskIndex((i) => i + 1);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (kioskIndex > 0) {
          setKioskIndex((i) => i - 1);
        }
      } else if (e.key === 'Escape') {
        setIsKioskOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isKioskOpen, kioskIndex, activeSheetData, kioskAutoAdvance]);

  // Filtered students for attendance roster sheet
  const filteredRosterStudents = useMemo(() => {
    if (!activeSheetData?.students) return [];
    return activeSheetData.students.filter((st: any) => {
      const currentSt = attendanceMap[st.student_id] || st.status || 'present';
      
      // Status filter
      if (rosterStatusFilter === 'present' && currentSt !== 'present') return false;
      if (rosterStatusFilter === 'absent' && currentSt !== 'absent') return false;
      if (rosterStatusFilter === 'od_excused' && !['late', 'excused', 'od_duty'].includes(currentSt)) return false;

      // Search filter
      if (rosterSearch.trim()) {
        const q = rosterSearch.toLowerCase();
        const name = (st.student_name || '').toLowerCase();
        const prn = (st.student_prn || '').toLowerCase();
        const roll = (st.roll_no || '').toLowerCase();
        return name.includes(q) || prn.includes(q) || roll.includes(q);
      }

      return true;
    });
  }, [activeSheetData, attendanceMap, rosterSearch, rosterStatusFilter]);

  // Stats calculation for current session sheet
  const currentSheetStats = useMemo(() => {
    if (!activeSheetData?.students) return { present: 0, absent: 0, late: 0, excused: 0, od: 0, total: 0, pct: 0 };
    const total = activeSheetData.students.length;
    let present = 0, absent = 0, late = 0, excused = 0, od = 0;

    activeSheetData.students.forEach((st: any) => {
      const s = attendanceMap[st.student_id] || st.status || 'present';
      if (s === 'present') present++;
      else if (s === 'absent') absent++;
      else if (s === 'late') { late++; present++; }
      else if (s === 'excused') { excused++; present++; }
      else if (s === 'od_duty') { od++; present++; }
    });

    const pct = total > 0 ? Math.round((present / total) * 100) : 0;
    return { present, absent, late, excused, od, total, pct };
  }, [activeSheetData, attendanceMap]);

  // Export current session sheet to CSV
  const handleExportSessionCSV = () => {
    if (!activeSheetData?.students) return;
    const rows = [
      ['#', 'PRN', 'Roll No', 'Student Name', 'Status', 'Remarks'],
      ...activeSheetData.students.map((st: any, idx: number) => [
        idx + 1,
        st.student_prn || '',
        st.roll_no || '',
        st.student_name || '',
        (attendanceMap[st.student_id] || st.status || 'present').toUpperCase(),
        remarksMap[st.student_id] || '',
      ]),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Attendance_${activeSheetData.subject_code}_${activeSheetData.session_date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB 2: DAILY CLASS ATTENDANCE REGISTER & REPORTS
  // ─────────────────────────────────────────────────────────────────────────────
  const [registerStartDate, setRegisterStartDate] = useState<string>('');
  const [registerEndDate, setRegisterEndDate] = useState<string>('');
  const [registerSubjectId, setRegisterSubjectId] = useState<string>('');
  const [registerStatusFilter, setRegisterStatusFilter] = useState<string>('');
  const [registerSearch, setRegisterSearch] = useState<string>('');
  const [selectedAbsenteesModal, setSelectedAbsenteesModal] = useState<any | null>(null);

  const { data: classRegisterData = [], isPending: registerLoading } = useQuery({
    queryKey: ['class_attendance_register', registerStartDate, registerEndDate, registerSubjectId, registerStatusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (registerStartDate) params.append('start_date', registerStartDate);
      if (registerEndDate) params.append('end_date', registerEndDate);
      if (registerSubjectId) params.append('subject_id', registerSubjectId);
      if (registerStatusFilter) params.append('status', registerStatusFilter);

      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await api.get(`/attendance/register${qs}`);
      return (res.data?.data || []) as any[];
    },
    enabled: activeTab === 'register',
  });

  const filteredRegisterData = useMemo(() => {
    if (!registerSearch.trim()) return classRegisterData;
    const q = registerSearch.toLowerCase();
    return classRegisterData.filter((r: any) =>
      r.subject_name?.toLowerCase().includes(q) ||
      r.subject_code?.toLowerCase().includes(q) ||
      r.faculty_name?.toLowerCase().includes(q) ||
      r.batch_name?.toLowerCase().includes(q) ||
      r.venue?.toLowerCase().includes(q)
    );
  }, [classRegisterData, registerSearch]);

  const handleExportRegisterCSV = () => {
    if (!filteredRegisterData || filteredRegisterData.length === 0) return;
    const headers = [
      'Session Date',
      'Start Time',
      'End Time',
      'Subject Code',
      'Subject Name',
      'Session Type',
      'Batch',
      'Venue',
      'Faculty',
      'Status',
      'Total Students',
      'Present Count',
      'Absent Count',
      'Attendance %',
      'Absentees List',
    ];

    const rows = filteredRegisterData.map((r: any) => [
      `"${r.session_date}"`,
      `"${r.start_time}"`,
      `"${r.end_time}"`,
      `"${r.subject_code}"`,
      `"${r.subject_name.replace(/"/g, '""')}"`,
      `"${r.session_type || 'Regular'}"`,
      `"${r.batch_name}"`,
      `"${r.venue}"`,
      `"${r.faculty_name}"`,
      `"${r.attendance_status}"`,
      r.total_students,
      r.present_count,
      r.absent_count,
      `${r.attendance_percentage}%`,
      `"${(r.absentees || []).map((a: any) => `${a.student_name} (${a.student_prn})`).join('; ')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e: any) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Class_Attendance_Register_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB 3: SUBJECT CUMULATIVE MATRIX
  // ─────────────────────────────────────────────────────────────────────────────
  const { data: subjectsListData = [] } = useQuery({
    queryKey: ['subjects_list_for_attendance'],
    queryFn: async () => {
      const res = await api.get('/academic/subjects');
      return (res.data?.data || []) as any[];
    },
  });

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    selectedSubjectIdParam || ''
  );

  useEffect(() => {
    if (!selectedSubjectId && subjectsListData && subjectsListData.length > 0) {
      const firstId = selectedSubjectIdParam || subjectsListData[0].id;
      setSelectedSubjectId(firstId);
      if (activeTab === 'matrix') {
        updateParams({ subjectId: firstId });
      }
    }
  }, [activeTab, subjectsListData, selectedSubjectId, selectedSubjectIdParam]);

  const [matrixStudentSearch, setMatrixStudentSearch] = useState<string>('');
  const [matrixTierFilter, setMatrixTierFilter] = useState<string>('all');

  const { data: subjectMatrixData, isPending: matrixLoading } = useQuery({
    queryKey: ['subject_attendance_matrix', selectedSubjectId],
    queryFn: async () => {
      if (!selectedSubjectId) return null;
      const res = await api.get(`/attendance/subject-matrix?subject_id=${selectedSubjectId}`);
      return res.data?.data;
    },
    enabled: activeTab === 'matrix' && !!selectedSubjectId,
  });

  const filteredMatrixStudents = useMemo(() => {
    if (!subjectMatrixData?.students) return [];
    return subjectMatrixData.students.filter((st: any) => {
      if (matrixTierFilter !== 'all' && st.tier !== matrixTierFilter) return false;
      if (matrixStudentSearch.trim()) {
        const q = matrixStudentSearch.toLowerCase();
        return (
          st.student_name.toLowerCase().includes(q) ||
          st.student_prn.toLowerCase().includes(q) ||
          st.roll_no.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [subjectMatrixData, matrixTierFilter, matrixStudentSearch]);

  const handleExportMatrixCSV = () => {
    if (!subjectMatrixData) return;
    const sessionCols = (subjectMatrixData.sessions || []).map((s: any) => `S${s.session_no} (${s.session_date})`);
    const headers = ['Roll No', 'PRN', 'Student Name', 'Total Attended', 'Total Classes', 'Overall %', 'Status Tier', ...sessionCols];

    const rows = (subjectMatrixData.students || []).map((st: any) => {
      const sessionVals = (subjectMatrixData.sessions || []).map((s: any) => {
        const stat = st.attendance_by_session?.[s.id] || '-';
        return `"${stat.toUpperCase()}"`;
      });
      return [
        `"${st.roll_no}"`,
        `"${st.student_prn}"`,
        `"${st.student_name.replace(/"/g, '""')}"`,
        st.total_attended,
        st.total_conducted,
        `${st.percentage}%`,
        `"${st.tier.toUpperCase()}"`,
        ...sessionVals,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e: any) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Subject_Attendance_Matrix_${subjectMatrixData.subject_code}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB 4: STUDENT-WISE DOSSIER
  // ─────────────────────────────────────────────────────────────────────────────
  const { data: studentsListData = [] } = useQuery({
    queryKey: ['students_list_for_attendance'],
    queryFn: async () => {
      const res = await api.get('/students');
      return (res.data?.data || []) as any[];
    },
    enabled: !isStudent,
  });

  const studentProfileId = myStudentProfile?.student?.id || myStudentProfile?.id || '';

  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    isStudent ? studentProfileId : (selectedStudentIdParam || '')
  );

  useEffect(() => {
    if (activeTab === 'students') {
      if (isStudent && studentProfileId) {
        setSelectedStudentId(studentProfileId);
        updateParams({ studentId: studentProfileId });
      } else if (!isStudent && !selectedStudentId && studentsListData && studentsListData.length > 0) {
        const firstId = selectedStudentIdParam || studentsListData[0].id;
        setSelectedStudentId(firstId);
        updateParams({ studentId: firstId });
      }
    }
  }, [activeTab, isStudent, studentProfileId, studentsListData, selectedStudentId, selectedStudentIdParam]);

  const { data: studentDossierData, isPending: studentDossierLoading } = useQuery({
    queryKey: ['student_attendance_dossier', selectedStudentId],
    queryFn: async () => {
      if (!selectedStudentId) return null;
      const res = await api.get(`/attendance/student-dossier/${selectedStudentId}`);
      return res.data?.data;
    },
    enabled: !!selectedStudentId && (activeTab === 'students' || isStudent),
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB 5: DUAL-APPROVAL QUEUE
  // ─────────────────────────────────────────────────────────────────────────────
  const [correctionStatusFilter, setCorrectionStatusFilter] = useState<string>('all');
  const [reviewingCorrection, setReviewingCorrection] = useState<any | null>(null);
  const [reviewAction, setReviewAction] = useState<'approved' | 'rejected'>('approved');
  const [reviewRemarks, setReviewRemarks] = useState<string>('');
  const [reviewError, setReviewError] = useState<string | null>(null);

  const { data: correctionsData = [], isPending: correctionsLoading, refetch: refetchCorrections } = useQuery({
    queryKey: ['attendance_corrections_list', correctionStatusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (correctionStatusFilter !== 'all') params.append('status', correctionStatusFilter);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await api.get(`/attendance/corrections${qs}`);
      return (res.data?.data || []) as any[];
    },
  });

  // Dual review mutations
  const facultyReviewMutation = useMutation({
    mutationFn: async ({ id, action, remarks }: { id: string; action: string; remarks?: string }) => {
      const res = await api.post(`/attendance/corrections/${id}/faculty-review`, { action, remarks });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance_corrections_list'] });
      setReviewingCorrection(null);
    },
    onError: (err: any) => {
      setReviewError(err?.response?.data?.detail || 'Failed to review request.');
    },
  });

  const adminReviewMutation = useMutation({
    mutationFn: async ({ id, action, remarks }: { id: string; action: string; remarks?: string }) => {
      const res = await api.post(`/attendance/corrections/${id}/admin-review`, { action, remarks });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance_corrections_list'] });
      queryClient.invalidateQueries({ queryKey: ['attendance_allocated_sessions'] });
      queryClient.invalidateQueries({ queryKey: ['session_attendance_sheet'] });
      queryClient.invalidateQueries({ queryKey: ['subject_attendance_matrix'] });
      queryClient.invalidateQueries({ queryKey: ['student_attendance_dossier'] });
      queryClient.invalidateQueries({ queryKey: ['debarment_risk'] });
      queryClient.invalidateQueries({ queryKey: ['class_attendance_register'] });
      setReviewingCorrection(null);
    },
    onError: (err: any) => {
      setReviewError(err?.response?.data?.detail || 'Failed to review request.');
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB 6: DEBARMENT COMPLIANCE & RECOVERY CALCULATOR (< 75%)
  // ─────────────────────────────────────────────────────────────────────────────
  const [debarmentThreshold, setDebarmentThreshold] = useState<number>(75.0);
  const { data: debarredStudentsData = [], isPending: debarmentLoading } = useQuery({
    queryKey: ['debarment_risk', debarmentThreshold],
    queryFn: async () => {
      const res = await api.get(`/attendance/debarment-risk?threshold=${debarmentThreshold}`);
      return (res.data?.data || []) as any[];
    },
    enabled: !isStudent && activeTab === 'compliance',
  });

  // Modal: Raise Correction
  const [selectedAttendanceForCorrection, setSelectedAttendanceForCorrection] = useState<any | null>(null);

  const openCorrectionModal = (record: any) => {
    setSelectedAttendanceForCorrection(record);
    updateParams({ modal: 'raiseCorrection', attendanceId: record.attendance_id || record.id });
  };

  const closeCorrectionModal = () => {
    setSelectedAttendanceForCorrection(null);
    updateParams({ modal: null, attendanceId: null });
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-24 max-w-7xl mx-auto">
      {/* ── TOP HEADER ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-500/25">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              {isStudent ? 'My Attendance Record' : 'Academic Attendance Hub'}
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                {isStudent ? 'Personal Record' : 'Live Register'}
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isStudent
                ? 'Track your course attendance %, review session-by-session logs, file dispute requests, and verify 75% policy standing.'
                : 'Classroom roll-call, session audit registers, subject attendance matrices, and compliance tracking.'}
            </p>
          </div>
        </div>

        {/* Global Quick Action */}
        {!isStudent && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab('register')}
              className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <FileSpreadsheet className="h-4 w-4 text-indigo-600" /> Class Registers
            </button>
            <button
              onClick={() => setTab('matrix')}
              className="px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-xs border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Layers className="h-4 w-4" /> Subject Matrix
            </button>
          </div>
        )}
      </div>

      {/* ── WORKSPACE TABS NAVIGATION ──────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 overflow-x-auto">
        {(isStudent
          ? [
              { id: 'students', label: 'My Attendance Record', icon: UserCheck },
              { id: 'approvals', label: 'My Dispute Requests', icon: FileCheck2 },
              { id: 'compliance', label: 'My Compliance & Standing', icon: ShieldCheck },
            ]
          : [
              { id: 'sessions', label: 'Take Class Attendance', icon: CheckCircle2 },
              { id: 'register', label: 'Class Attendance Register', icon: FileSpreadsheet },
              { id: 'matrix', label: 'Subject Cumulative Matrix', icon: Layers },
              { id: 'students', label: 'Student Attendance Records', icon: Users },
              { id: 'approvals', label: 'Dispute Requests & Approvals', icon: FileCheck2 },
              { id: 'compliance', label: 'Low Attendance Watchlist (< 75%)', icon: AlertTriangle },
            ]
        ).map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-900/50'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 1: TAKE CLASS ATTENDANCE
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'sessions' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Allocated Sessions Selector */}
          <div className="lg:col-span-4 space-y-4">
            <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-indigo-600" />
                  {isFaculty ? 'My Allocated Classes' : 'Scheduled Class Sessions'}
                </h3>
                <button
                  onClick={() => refetchSessions()}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Refresh Sessions"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Date Filter & Presets */}
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type="date"
                    value={sessionDateFilter}
                    onChange={(e) => setSessionDateFilter(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                  />
                  {sessionDateFilter && (
                    <button
                      onClick={() => setSessionDateFilter('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSessionDateFilter(new Date().toISOString().split('T')[0])}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-slate-700 dark:text-slate-300 text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() - 1);
                      setSessionDateFilter(d.toISOString().split('T')[0]);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-slate-700 dark:text-slate-300 text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    Yesterday
                  </button>
                  <button
                    type="button"
                    onClick={() => setSessionDateFilter('')}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-slate-700 dark:text-slate-300 text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    All Dates
                  </button>
                </div>
              </div>

              {/* Session Cards List */}
              <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
                {sessionsLoading ? (
                  <p className="py-8 text-center text-xs text-slate-400">Loading allocated sessions...</p>
                ) : allocatedSessionsData && allocatedSessionsData.length > 0 ? (
                  allocatedSessionsData.map((s) => {
                    const isSelected = selectedSessionId === s.id;
                    return (
                      <div
                        key={s.id}
                        onClick={() => {
                          setSelectedSessionId(s.id);
                          updateParams({ sessionId: s.id });
                        }}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 shadow-sm ring-2 ring-indigo-500/20'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/30 dark:bg-slate-900/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                            {s.subject_code || 'SUB'}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                              s.is_locked
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                                : s.attendance_status === 'marked'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                                : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {s.is_locked ? <Lock className="h-2.5 w-2.5" /> : null}
                            {s.is_locked ? 'Locked' : s.attendance_status === 'marked' ? 'Marked' : 'Pending'}
                          </span>
                        </div>

                        <p className="font-bold text-xs text-slate-900 dark:text-white mt-1.5 line-clamp-1">
                          {s.subject_name || 'Class Session'}
                        </p>

                        <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{s.session_date}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{s.start_time} - {s.end_time}</span>
                          </div>
                          <div className="flex items-center gap-1 col-span-2">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">{s.venue} • {s.batch_name}</span>
                          </div>
                        </div>

                        {s.total_students > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-[10px]">
                            <span className="text-slate-500">Attendance:</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              {s.present_count}/{s.total_students} Present ({Math.round((s.present_count / s.total_students) * 100)}%)
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    <Calendar className="h-8 w-8 mx-auto mb-2 opacity-40 text-indigo-400" />
                    <p className="font-semibold">No allocated class sessions found.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Attendance Marking Roster Sheet */}
          <div className="lg:col-span-8 space-y-4">
            {selectedSessionId && activeSheetData ? (
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                {/* Session Header Card & Live Metrics */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                        {activeSheetData.subject_name || 'Class Session'}
                      </h2>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                        {activeSheetData.batch_name || 'Batch'}
                      </span>
                      {activeSheetData.course_category === 'elective' || activeSheetData.elective_domain ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800 flex items-center gap-1">
                          🟣 Elective: {activeSheetData.elective_domain || 'Specialization'} ({activeSheetData.total_students} Eligible)
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800">
                          🔷 Core Subject (All Students)
                        </span>
                      )}
                      {activeSheetData.venue && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {activeSheetData.venue}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" /> {activeSheetData.session_date}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> {activeSheetData.start_time} - {activeSheetData.end_time}
                      </span>
                    </div>
                  </div>

                  {/* Summary Metric Counters */}
                  <div className="flex items-center gap-2 text-xs font-bold flex-wrap">
                    <div className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 shadow-2xs">
                      {currentSheetStats.present} Present ({currentSheetStats.pct}%)
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40 shadow-2xs">
                      {currentSheetStats.absent} Absent
                    </div>
                    {currentSheetStats.od > 0 && (
                      <div className="px-3 py-1.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/40 shadow-2xs">
                        {currentSheetStats.od} On Duty
                      </div>
                    )}
                  </div>
                </div>

                {markingSuccessMsg && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" /> {markingSuccessMsg}
                  </div>
                )}

                {/* ── ACTION BAR: Fast Kiosk Mode + Bulk Shortcuts + Search ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/30 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    {/* Focus Roll-Call Mode Trigger */}
                    <button
                      type="button"
                      onClick={() => {
                        setKioskIndex(0);
                        setIsKioskOpen(true);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-xs flex items-center gap-1.5 shadow-sm shadow-indigo-500/20 cursor-pointer"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" /> Focus Roll-Call Mode
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const m: Record<string, string> = {};
                        activeSheetData.students.forEach((st: any) => { m[st.student_id] = 'present'; });
                        setAttendanceMap(m);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      Mark All P
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const m: Record<string, string> = {};
                        activeSheetData.students.forEach((st: any) => { m[st.student_id] = 'absent'; });
                        setAttendanceMap(m);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-rose-100 hover:bg-rose-200 dark:bg-rose-950 text-rose-800 dark:text-rose-300 text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      Mark All A
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExportSessionCSV}
                      className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      title="Export CSV"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Filter and Search Bar for Roster Sheet */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search student by name, PRN, or roll no..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                      value={rosterSearch}
                      onChange={(e) => setRosterSearch(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center gap-1 text-[11px] font-bold">
                    <span className="text-slate-400 mr-1">Filter:</span>
                    {[
                      { id: 'all', label: `All (${activeSheetData.students.length})` },
                      { id: 'present', label: `Present (${currentSheetStats.present})` },
                      { id: 'absent', label: `Absent (${currentSheetStats.absent})` },
                      { id: 'od_excused', label: `OD / Excused (${currentSheetStats.od + currentSheetStats.excused + currentSheetStats.late})` },
                    ].map((f) => (
                      <button
                        type="button"
                        key={f.id}
                        onClick={() => setRosterStatusFilter(f.id)}
                        className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                          rosterStatusFilter === f.id
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Students Attendance Table */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3 w-12 text-center">#</th>
                        <th className="p-3">PRN & Roll No</th>
                        <th className="p-3">Student Name</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredRosterStudents.map((st: any, idx: number) => {
                        const currentSt = attendanceMap[st.student_id] || st.status || 'present';
                        return (
                          <tr key={st.student_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                            <td className="p-3 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                            <td className="p-3 font-mono font-bold text-slate-900 dark:text-slate-200">
                              {st.student_prn || 'PRN-N/A'} {st.roll_no ? `• #${st.roll_no}` : ''}
                            </td>
                            <td className="p-3">
                              <p className="font-bold text-slate-900 dark:text-white">{st.student_name}</p>
                              {st.specializations && (
                                <span className="text-[10px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800/40 inline-block mt-0.5">
                                  {st.specializations}
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              <div className="flex items-center justify-center gap-1.5">
                                {[
                                  { id: 'present', label: 'P', full: 'Present', color: 'emerald' },
                                  { id: 'absent', label: 'A', full: 'Absent', color: 'rose' },
                                  { id: 'late', label: 'L', full: 'Late', color: 'amber' },
                                  { id: 'excused', label: 'E', full: 'Excused', color: 'indigo' },
                                  { id: 'od_duty', label: 'OD', full: 'On Duty', color: 'cyan' },
                                ].map((opt) => {
                                  const isSel = currentSt === opt.id;
                                  return (
                                    <button
                                      type="button"
                                      key={opt.id}
                                      onClick={() => setAttendanceMap({ ...attendanceMap, [st.student_id]: opt.id })}
                                      className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                                        isSel
                                          ? opt.color === 'emerald'
                                            ? 'bg-emerald-600 text-white shadow-xs'
                                            : opt.color === 'rose'
                                            ? 'bg-rose-600 text-white shadow-xs'
                                            : opt.color === 'amber'
                                            ? 'bg-amber-600 text-white shadow-xs'
                                            : opt.color === 'cyan'
                                            ? 'bg-cyan-600 text-white shadow-xs'
                                            : 'bg-indigo-600 text-white shadow-xs'
                                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                                      }`}
                                      title={opt.full}
                                    >
                                      {opt.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  openCorrectionModal({
                                    attendance_id: st.id,
                                    studentName: st.student_name,
                                    studentPrn: st.student_prn,
                                    subjectName: activeSheetData.subject_name,
                                    sessionDate: activeSheetData.session_date,
                                    sessionTime: `${activeSheetData.start_time} - ${activeSheetData.end_time}`,
                                    venue: activeSheetData.venue,
                                    currentStatus: currentSt,
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 text-[11px] font-bold text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                              >
                                <FileCheck2 className="h-3 w-3" /> Dispute
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer Finalize Action */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Showing {filteredRosterStudents.length} of {activeSheetData.students.length} students
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveAttendance}
                    disabled={markAttendanceMutation.isPending}
                    className="px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <Lock className="h-4 w-4" />
                    {markAttendanceMutation.isPending ? 'Saving & Finalizing...' : 'Finalize & Lock Attendance'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-12 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-slate-400 space-y-2">
                <CheckCircle2 className="h-10 w-10 mx-auto text-indigo-400 opacity-40" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Select a Class Session from the Left Column
                </h3>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 2: DAILY CLASS ATTENDANCE REGISTER & REPORTS
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'register' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-indigo-600" />
                  Class Attendance Audit Register
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Review and audit attendance records for every class conducted across all batches and faculty.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportRegisterCSV}
                  disabled={filteredRegisterData.length === 0}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" /> Export Register (CSV)
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                  title="Print Report"
                >
                  <Printer className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Filter Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">From Date</label>
                <input
                  type="date"
                  value={registerStartDate}
                  onChange={(e) => setRegisterStartDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">To Date</label>
                <input
                  type="date"
                  value={registerEndDate}
                  onChange={(e) => setRegisterEndDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Subject</label>
                <select
                  value={registerSubjectId}
                  onChange={(e) => setRegisterSubjectId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                >
                  <option value="">All Subjects</option>
                  {(subjectsListData || []).map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Status</label>
                <select
                  value={registerStatusFilter}
                  onChange={(e) => setRegisterStatusFilter(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                >
                  <option value="">All Statuses</option>
                  <option value="marked">Marked & Locked</option>
                  <option value="pending">Pending Marking</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Search Query</label>
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search subject, faculty..."
                    value={registerSearch}
                    onChange={(e) => setRegisterSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Register Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[10.5px]">
                  <tr>
                    <th className="p-3.5">Date & Time</th>
                    <th className="p-3.5">Subject & Activity</th>
                    <th className="p-3.5">Batch & Venue</th>
                    <th className="p-3.5">Faculty</th>
                    <th className="p-3.5 text-center">Attendance %</th>
                    <th className="p-3.5 text-center">Breakdown (P / A / OD)</th>
                    <th className="p-3.5 text-center">Absentees</th>
                    <th className="p-3.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {registerLoading && classRegisterData.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">Loading class attendance register...</td>
                    </tr>
                  ) : filteredRegisterData.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">No class attendance records match your filter criteria.</td>
                    </tr>
                  ) : (
                    filteredRegisterData.map((reg: any) => {
                      const isHigh = reg.attendance_percentage >= 75;
                      const isMid = reg.attendance_percentage >= 60 && reg.attendance_percentage < 75;
                      return (
                        <tr key={reg.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="p-3.5 whitespace-nowrap">
                            <div className="font-bold text-slate-900 dark:text-white">{reg.session_date}</div>
                            <div className="text-[11px] text-slate-500 font-mono">{reg.start_time} - {reg.end_time}</div>
                          </td>
                          <td className="p-3.5">
                            <div className="font-bold text-slate-900 dark:text-white">{reg.subject_name}</div>
                            <div className="flex items-center gap-1 text-[11px] text-slate-500">
                              <span className="font-mono">{reg.subject_code}</span>
                              {reg.session_type && (
                                <span className="px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px]">
                                  {reg.session_type}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3.5">
                            <div className="font-bold text-slate-800 dark:text-slate-200">{reg.batch_name}</div>
                            <div className="text-[11px] text-slate-500">{reg.venue}</div>
                          </td>
                          <td className="p-3.5 font-medium text-slate-700 dark:text-slate-300">
                            {reg.faculty_name}
                          </td>
                          <td className="p-3.5 text-center">
                            <span
                              className={`px-2.5 py-1 rounded-full font-black text-xs ${
                                isHigh
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                                  : isMid
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                              }`}
                            >
                              {reg.attendance_percentage}%
                            </span>
                          </td>
                          <td className="p-3.5 text-center whitespace-nowrap">
                            <span className="font-bold text-emerald-600">{reg.present_count} P</span>
                            <span className="text-slate-300 mx-1">/</span>
                            <span className="font-bold text-rose-600">{reg.absent_count} A</span>
                            {reg.od_count > 0 && (
                              <>
                                <span className="text-slate-300 mx-1">/</span>
                                <span className="font-bold text-cyan-600">{reg.od_count} OD</span>
                              </>
                            )}
                          </td>
                          <td className="p-3.5 text-center">
                            {reg.absentees && reg.absentees.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => setSelectedAbsenteesModal({ session: reg, absentees: reg.absentees })}
                                className="px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[11px] font-bold border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer"
                              >
                                {reg.absentees.length} Absent
                              </button>
                            ) : (
                              <span className="text-emerald-600 text-[11px] font-bold">100% Present</span>
                            )}
                          </td>
                          <td className="p-3.5 text-right">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                reg.attendance_status === 'marked'
                                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {reg.attendance_status === 'marked' ? 'Finalized' : 'Pending'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 3: SUBJECT CUMULATIVE MATRIX & HEATMAP
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'matrix' && (
        <div className="space-y-6">
          {/* Subject & Batch Selector */}
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-indigo-600 shrink-0" />
                <select
                  value={selectedSubjectId}
                  onChange={(e) => {
                    setSelectedSubjectId(e.target.value);
                    updateParams({ subjectId: e.target.value });
                  }}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-white"
                >
                  {(subjectsListData || []).map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter student in matrix..."
                  value={matrixStudentSearch}
                  onChange={(e) => setMatrixStudentSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-1 text-[11px] font-bold">
                <span className="text-slate-400 mr-1">Tier:</span>
                {[
                  { id: 'all', label: 'All' },
                  { id: 'safe', label: 'Safe (≥75%)' },
                  { id: 'warning', label: 'Warning (60-74%)' },
                  { id: 'debarred', label: 'Debarred (<60%)' },
                ].map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setMatrixTierFilter(tier.id)}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      matrixTierFilter === tier.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportMatrixCSV}
                disabled={!subjectMatrixData}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" /> Export Matrix (CSV)
              </button>
            </div>
          </div>

          {/* Matrix Summary Stats Banner */}
          {subjectMatrixData && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Classes</div>
                <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{subjectMatrixData.total_sessions}</div>
              </div>
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Class Average</div>
                <div className="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-0.5">{subjectMatrixData.average_attendance_percentage}%</div>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Safe (≥ 75%)</div>
                <div className="text-lg font-black text-emerald-700 dark:text-emerald-300 mt-0.5">{subjectMatrixData.safe_count}</div>
              </div>
              <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Warning (60-74%)</div>
                <div className="text-lg font-black text-amber-700 dark:text-amber-300 mt-0.5">{subjectMatrixData.warning_count}</div>
              </div>
              <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">Debarred (&lt; 60%)</div>
                <div className="text-lg font-black text-rose-700 dark:text-rose-300 mt-0.5">{subjectMatrixData.debarred_count}</div>
              </div>
            </div>
          )}

          {/* Matrix Cross-Tab Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20">
                  <tr>
                    <th className="p-3.5 sticky left-0 bg-slate-50 dark:bg-slate-800 z-30 min-w-[70px]">Roll No</th>
                    <th className="p-3.5 sticky left-[70px] bg-slate-50 dark:bg-slate-800 z-30 min-w-[120px]">PRN</th>
                    <th className="p-3.5 sticky left-[190px] bg-slate-50 dark:bg-slate-800 z-30 min-w-[180px]">Student Name</th>
                    <th className="p-3.5 text-center min-w-[90px]">Overall %</th>
                    <th className="p-3.5 text-center min-w-[90px]">Attended</th>
                    {subjectMatrixData?.sessions?.map((s: any) => (
                      <th key={s.id} className="p-3 text-center min-w-[60px] font-mono text-[10px]">
                        <div>S{s.session_no}</div>
                        <div className="text-slate-400 font-normal">{s.session_date.slice(5)}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {matrixLoading ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400">Loading subject matrix...</td>
                    </tr>
                  ) : filteredMatrixStudents.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400">No student records found.</td>
                    </tr>
                  ) : (
                    filteredMatrixStudents.map((st: any) => {
                      const isHigh = st.percentage >= 75;
                      const isMid = st.percentage >= 60 && st.percentage < 75;
                      return (
                        <tr key={st.student_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-mono font-bold sticky left-0 bg-white dark:bg-slate-900 z-10 text-slate-700 dark:text-slate-300">
                            {st.roll_no}
                          </td>
                          <td className="p-3 font-mono text-[11px] font-bold sticky left-[70px] bg-white dark:bg-slate-900 z-10 text-slate-600 dark:text-slate-400">
                            {st.student_prn}
                          </td>
                          <td className="p-3 font-bold sticky left-[190px] bg-white dark:bg-slate-900 z-10 text-slate-900 dark:text-white">
                            {st.student_name}
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full font-black text-[11px] ${
                                isHigh
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                                  : isMid
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                              }`}
                            >
                              {st.percentage}%
                            </span>
                          </td>
                          <td className="p-3 text-center font-semibold text-slate-700 dark:text-slate-300">
                            {st.total_attended} / {st.total_conducted}
                          </td>
                          {subjectMatrixData?.sessions?.map((s: any) => {
                            const stat = st.attendance_by_session?.[s.id] || 'unmarked';
                            return (
                              <td key={s.id} className="p-2 text-center">
                                <span
                                  className={`inline-block w-6 h-6 rounded-md text-[10px] font-black leading-6 text-center ${
                                    stat === 'present'
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                                      : stat === 'absent'
                                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                                      : stat === 'od_duty' || stat === 'on_duty'
                                      ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/80 dark:text-cyan-300'
                                      : stat === 'excused'
                                      ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300'
                                      : stat === 'late'
                                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                                      : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                                  }`}
                                  title={`Session ${s.session_no}: ${stat.toUpperCase()}`}
                                >
                                  {stat === 'present' ? 'P' : stat === 'absent' ? 'A' : stat === 'od_duty' ? 'OD' : stat === 'excused' ? 'E' : stat === 'late' ? 'L' : '-'}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 4: STUDENT-WISE DOSSIER
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'students' && (
        <div className="space-y-6">
          {!isStudent && (
            <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
              <Users className="h-5 w-5 text-indigo-600 shrink-0" />
              <select
                value={selectedStudentId}
                onChange={(e) => {
                  setSelectedStudentId(e.target.value);
                  updateParams({ studentId: e.target.value });
                }}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white w-full sm:w-80"
              >
                {(studentsListData || []).map((st: any) => (
                  <option key={st.id} value={st.id}>
                    {st.first_name} {st.last_name || ''} ({st.prn_number || st.roll_no || 'PRN'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {studentDossierLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs">Loading attendance records...</div>
          ) : studentDossierData ? (
            <div className="space-y-6">
              {/* Dossier Header Card */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    {studentDossierData.student_name}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    PRN: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{studentDossierData.student_prn}</span> • {studentDossierData.program_name} • {studentDossierData.batch_name}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-center">
                    <div className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400">Cumulative Attendance</div>
                    <div className="text-xl font-black text-indigo-700 dark:text-indigo-300 mt-0.5">
                      {studentDossierData.overall_attendance_percentage ?? 100}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Subject Breakdown Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {(studentDossierData.subjects_breakdown || []).map((sb: any) => (
                  <div key={sb.subject_id} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded">
                        {sb.subject_code}
                      </span>
                      <span className={`text-xs font-black ${sb.percentage >= 75 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {sb.percentage}%
                      </span>
                    </div>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1">{sb.subject_name}</h4>
                    <div className="text-[11px] text-slate-500 flex justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span>Attended: {sb.attended}/{sb.total_sessions}</span>
                      <span className={sb.percentage >= 75 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                        {sb.percentage >= 75 ? 'Good Standing' : 'Low (<75%)'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Session History Timeline */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="h-4 w-4 text-indigo-600" />
                  Chronological Session Attendance Log
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3">Date</th>
                        <th className="p-3">Subject</th>
                        <th className="p-3">Faculty</th>
                        <th className="p-3">Time & Venue</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(studentDossierData.session_records || []).map((rec: any) => (
                        <tr key={rec.attendance_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-bold text-slate-900 dark:text-white">{rec.session_date}</td>
                          <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                            {rec.subject_code ? `${rec.subject_code} · ` : ''}{rec.subject_name}
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-400">{rec.faculty_name || 'Faculty'}</td>
                          <td className="p-3 text-slate-500 font-mono text-[11px]">
                            {rec.session_time || (rec.start_time && rec.end_time ? `${rec.start_time}-${rec.end_time}` : '')} • {rec.venue}
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                                rec.status === 'present'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : rec.status === 'absent'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  : 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300'
                              }`}
                            >
                              {rec.status}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => openCorrectionModal(rec)}
                              className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 text-slate-700 dark:text-slate-300 font-bold text-[11px] transition-colors cursor-pointer"
                            >
                              Dispute
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 5: DUAL-APPROVAL QUEUE
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'approvals' && (
        <div className="space-y-6">
          <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs font-bold">
              <span>Filter:</span>
              {['all', 'pending_faculty', 'pending_admin', 'approved', 'rejected'].map((st) => (
                <button
                  key={st}
                  onClick={() => setCorrectionStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl transition-all capitalize cursor-pointer ${
                    correctionStatusFilter === st
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
            <button
              onClick={() => refetchCorrections()}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5">Student</th>
                  <th className="p-3.5">Session</th>
                  <th className="p-3.5 text-center">Current &rarr; Requested</th>
                  <th className="p-3.5">Reason</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {correctionsLoading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">Loading requests...</td>
                  </tr>
                ) : (correctionsData || []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">No correction requests found.</td>
                  </tr>
                ) : (
                  (correctionsData || []).map((corr: any) => (
                    <tr key={corr.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                        <div>{corr.student_name}</div>
                        <div className="text-[11px] font-mono text-slate-400">{corr.student_prn}</div>
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-slate-800 dark:text-slate-200">{corr.subject_name}</div>
                        <div className="text-[11px] text-slate-500">{corr.session_date}</div>
                      </td>
                      <td className="p-3.5 text-center font-bold">
                        <span className="text-rose-600 uppercase">{corr.current_status}</span> &rarr;{' '}
                        <span className="text-emerald-600 uppercase">{corr.requested_status}</span>
                      </td>
                      <td className="p-3.5 max-w-xs truncate text-slate-600 dark:text-slate-400">{corr.reason}</td>
                      <td className="p-3.5 text-center">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 capitalize">
                          {corr.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        {!isStudent && (
                          <button
                            type="button"
                            onClick={() => setReviewingCorrection(corr)}
                            className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-[11px] shadow-sm hover:bg-indigo-700 cursor-pointer"
                          >
                            Review
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
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 6: DEBARMENT COMPLIANCE & RECOVERY CALCULATOR (< 75%)
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'compliance' && (
        <div className="space-y-6">
          {isStudent ? (
            /* STUDENT PERSONAL COMPLIANCE & RECOVERY CALCULATOR */
            <div className="space-y-6">
              {/* Compliance Status Header Card */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                      Institutional Attendance Compliance & Standing
                    </h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                      (studentDossierData?.overall_attendance_percentage ?? 100) >= 75
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                    }`}>
                      {(studentDossierData?.overall_attendance_percentage ?? 100) >= 75 ? 'Good Standing' : 'Attendance Advisory (<75%)'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Lexicon MILE mandates a minimum of 75% attendance in every course module to remain eligible for examinations and term credits.
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-center">
                    <div className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400">Current Attendance</div>
                    <div className="text-2xl font-black text-indigo-700 dark:text-indigo-300 mt-0.5">
                      {studentDossierData?.overall_attendance_percentage ?? 100}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Recovery & Buffer Calculator */}
              {(() => {
                const totalCond = studentDossierData?.total_classes_conducted || 0;
                const totalAtt = studentDossierData?.total_classes_attended || 0;
                const currentPct = studentDossierData?.overall_attendance_percentage ?? 100;
                const isCompliant = currentPct >= 75;
                const neededClasses = !isCompliant && totalCond > 0 ? Math.max(0, Math.ceil(3 * totalCond - 4 * totalAtt)) : 0;
                const safeBuffer = isCompliant && totalCond > 0 ? Math.max(0, Math.floor((totalAtt / 0.75) - totalCond)) : 0;

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Recovery Action Card */}
                    <div className={`p-6 rounded-3xl border shadow-sm space-y-3 ${
                      isCompliant
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40'
                        : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40'
                    }`}>
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2.5 rounded-2xl ${isCompliant ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                          {isCompliant ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            {isCompliant ? 'Compliant Standing' : 'Attendance Shortfall Target'}
                          </h4>
                          <p className="text-xs text-slate-500">
                            {isCompliant ? 'You meet institutional compliance standards' : 'Action required to restore eligibility'}
                          </p>
                        </div>
                      </div>

                      {isCompliant ? (
                        <div className="space-y-2 pt-1 text-xs text-slate-700 dark:text-slate-300">
                          <p className="leading-relaxed">
                            Your cumulative attendance is <strong className="text-emerald-600 font-black">{currentPct}%</strong>, which is above the mandatory 75% threshold.
                          </p>
                          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-between">
                            <span className="font-semibold text-slate-600 dark:text-slate-400">Permitted Absence Buffer:</span>
                            <span className="font-black text-emerald-700 dark:text-emerald-300">{safeBuffer} session(s)</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 pt-1 text-xs text-slate-700 dark:text-slate-300">
                          <p className="leading-relaxed">
                            Your cumulative attendance is <strong className="text-rose-600 font-black">{currentPct}%</strong> ({totalAtt} of {totalCond} sessions).
                          </p>
                          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800/40 flex items-center justify-between">
                            <span className="font-semibold text-slate-600 dark:text-slate-400">Target to reach 75%:</span>
                            <span className="font-black text-rose-700 dark:text-rose-300">Attend next {neededClasses} consecutive class(es)</span>
                          </div>
                          <p className="text-[11px] text-slate-500 italic">
                            Tip: Submit medical certificates or on-duty slips via the Dispute Requests tab if any sessions were wrongly recorded as absent.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Policy Guidelines Card */}
                    <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3.5">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-indigo-600" />
                        Institutional Guidelines & Exemptions
                      </h4>

                      <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-400">
                        <li className="flex items-start gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                          <span><strong>75% Mandatory Attendance:</strong> Required in each enrolled course to be eligible for end-term examinations.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                          <span><strong>On Duty (OD) & Leave:</strong> Institutional duties, placement activities, and authorized medical leaves must be filed within 3 working days.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                          <span><strong>Attendance Disputes:</strong> If biometric or manual attendance was incorrectly marked, use the <em>Dispute</em> button in your Attendance record.</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                );
              })()}

              {/* Subject Breakdown Health List */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers className="h-4 w-4 text-indigo-600" />
                  Course-by-Course Attendance Compliance Health
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(studentDossierData?.subjects_breakdown || []).map((sb: any) => {
                    const isSubHigh = sb.percentage >= 75;
                    return (
                      <div key={sb.subject_id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded">
                            {sb.subject_code}
                          </span>
                          <span className={`text-xs font-black ${isSubHigh ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {sb.percentage}%
                          </span>
                        </div>
                        <h5 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1">{sb.subject_name}</h5>
                        <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isSubHigh ? 'bg-emerald-500' : 'bg-rose-500'}`}
                            style={{ width: `${Math.min(100, sb.percentage)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-500 pt-0.5">
                          <span>{sb.attended}/{sb.total_sessions} attended</span>
                          <span className={isSubHigh ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                            {isSubHigh ? 'Compliant' : 'Below 75%'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* STAFF BATCH LOW ATTENDANCE WATCHLIST */
            <>
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Low Attendance Watchlist (&lt; 75%)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Students below the compliance threshold with calculated recovery session targets.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-500">Threshold:</span>
                  {[75, 65, 50].map((th) => (
                    <button
                      key={th}
                      onClick={() => setDebarmentThreshold(th)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer ${
                        debarmentThreshold === th
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      &lt; {th}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3.5">Student</th>
                      <th className="p-3.5">Batch</th>
                      <th className="p-3.5 text-center">Current Attendance %</th>
                      <th className="p-3.5 text-center">Attended / Total</th>
                      <th className="p-3.5 text-center">Recovery Target</th>
                      <th className="p-3.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {debarmentLoading ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400">Evaluating attendance risk...</td>
                      </tr>
                    ) : debarredStudentsData.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-emerald-600 font-bold">
                          ✓ No students are currently below the {debarmentThreshold}% attendance threshold!
                        </td>
                      </tr>
                    ) : (
                      debarredStudentsData.map((st: any) => (
                        <tr key={st.student_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                            <div>{st.student_name}</div>
                            <div className="text-[11px] font-mono text-slate-400">{st.student_prn}</div>
                          </td>
                          <td className="p-3.5 text-slate-700 dark:text-slate-300 font-medium">{st.batch_name}</td>
                          <td className="p-3.5 text-center font-black text-rose-600 text-sm">
                            {st.attendance_percentage}%
                          </td>
                          <td className="p-3.5 text-center font-semibold text-slate-600 dark:text-slate-400">
                            {st.attended_sessions} / {st.total_sessions}
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              Must attend {st.shortfall_sessions} more classes
                            </span>
                          </td>
                          <td className="p-3.5 text-right">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 uppercase">
                              Low Attendance (&lt;75%)
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── FULL-SCREEN FOCUS ROLL-CALL (KIOSK MODE) MODAL ────────────────── */}
      {isKioskOpen && activeSheetData?.students && activeSheetData.students.length > 0 && (
        <div className="fixed inset-0 z-80 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden">
            {/* Kiosk Top Bar */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-600 text-white font-bold">
                  <Play className="h-4 w-4 fill-current" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Interactive Roll-Call Mode
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {activeSheetData.subject_name} • {activeSheetData.batch_name}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2.5 py-1 rounded-lg">
                  {kioskIndex + 1} of {activeSheetData.students.length}
                </span>
                <button onClick={() => setIsKioskOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Kiosk Progress Bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5">
              <div
                className="bg-indigo-600 h-1.5 transition-all duration-200"
                style={{ width: `${((kioskIndex + 1) / activeSheetData.students.length) * 100}%` }}
              />
            </div>

            {/* Kiosk Student Card */}
            {(() => {
              const st = activeSheetData.students[kioskIndex];
              const currentSt = attendanceMap[st.student_id] || st.status || 'present';
              return (
                <div className="p-8 text-center space-y-6">
                  {/* Large Avatar */}
                  <div className="h-20 w-20 rounded-3xl bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-black text-2xl flex items-center justify-center mx-auto border-2 border-indigo-200 dark:border-indigo-800 shadow-md">
                    {st.student_name.slice(0, 2).toUpperCase()}
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                      {st.student_name}
                    </h3>
                    <p className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                      PRN: {st.student_prn || 'N/A'} {st.roll_no ? `• Roll No #${st.roll_no}` : ''}
                    </p>
                    {st.specializations && (
                      <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-2.5 py-0.5 rounded-full border border-purple-200 dark:border-purple-800/40 inline-block">
                        {st.specializations}
                      </span>
                    )}
                  </div>

                  {/* Current Status Pill */}
                  <div>
                    <span
                      className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${
                        currentSt === 'present'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : currentSt === 'absent'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          : currentSt === 'late'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300'
                      }`}
                    >
                      Status: {currentSt}
                    </span>
                  </div>

                  {/* 5 Big Action Buttons */}
                  <div className="grid grid-cols-5 gap-2 max-w-md mx-auto pt-2">
                    {[
                      { id: 'present', label: 'Present', key: 'P', color: 'bg-emerald-600 hover:bg-emerald-700' },
                      { id: 'absent', label: 'Absent', key: 'A', color: 'bg-rose-600 hover:bg-rose-700' },
                      { id: 'late', label: 'Late', key: 'L', color: 'bg-amber-600 hover:bg-amber-700' },
                      { id: 'excused', label: 'Excused', key: 'E', color: 'bg-indigo-600 hover:bg-indigo-700' },
                      { id: 'od_duty', label: 'On Duty', key: 'O', color: 'bg-cyan-600 hover:bg-cyan-700' },
                    ].map((btn) => (
                      <button
                        key={btn.id}
                        type="button"
                        onClick={() => {
                          setAttendanceMap({ ...attendanceMap, [st.student_id]: btn.id });
                          if (kioskAutoAdvance && kioskIndex < activeSheetData.students.length - 1) {
                            setKioskIndex(kioskIndex + 1);
                          }
                        }}
                        className={`p-3 rounded-2xl text-white font-bold flex flex-col items-center justify-center gap-1 transition-all shadow-sm ${btn.color} cursor-pointer`}
                      >
                        <span className="text-xs uppercase">{btn.label}</span>
                        <span className="font-mono text-[10px] bg-white/20 px-1.5 py-0.2 rounded font-black">[{btn.key}]</span>
                      </button>
                    ))}
                  </div>

                  {/* Auto advance toggle & Navigation */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-400">
                      <input
                        type="checkbox"
                        checked={kioskAutoAdvance}
                        onChange={(e) => setKioskAutoAdvance(e.target.checked)}
                        className="rounded accent-indigo-600"
                      />
                      <span>Auto-advance to next student</span>
                    </label>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={kioskIndex === 0}
                        onClick={() => setKioskIndex((i) => Math.max(0, i - 1))}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" /> Prev
                      </button>
                      <button
                        type="button"
                        disabled={kioskIndex === activeSheetData.students.length - 1}
                        onClick={() => setKioskIndex((i) => Math.min(activeSheetData.students.length - 1, i + 1))}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                      >
                        Next <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Kiosk Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 flex items-center justify-between">
              <div className="text-xs text-slate-500 font-medium">
                Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border text-[10px] font-mono">P</kbd>, <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border text-[10px] font-mono">A</kbd>, <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border text-[10px] font-mono">L</kbd>, <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border text-[10px] font-mono">E</kbd>, <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border text-[10px] font-mono">O</kbd> on your keyboard.
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsKioskOpen(false);
                  handleSaveAttendance();
                }}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" /> Save & Finish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── ABSENTEES LIST MODAL ───────────────────────────────────────────── */}
      {selectedAbsenteesModal && (
        <div className="fixed inset-0 z-80 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/40">
              <div>
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Absentees List ({selectedAbsenteesModal.absentees.length} Students)
                </h4>
                <p className="text-[11px] text-slate-500">
                  {selectedAbsenteesModal.session.subject_name} • {selectedAbsenteesModal.session.session_date}
                </p>
              </div>
              <button onClick={() => setSelectedAbsenteesModal(null)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 max-h-[400px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {selectedAbsenteesModal.absentees.map((a: any, idx: number) => (
                <div key={idx} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white">{a.student_name}</span>
                    <div className="text-[10.5px] font-mono text-slate-400">{a.student_prn} {a.roll_no ? `• #${a.roll_no}` : ''}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 uppercase">
                    Absent
                  </span>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedAbsenteesModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── REVIEW CORRECTION MODAL ───────────────────────────────────────── */}
      {reviewingCorrection && (
        <div className="fixed inset-0 z-80 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">Review Dispute Request</h4>
              <button onClick={() => setReviewingCorrection(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-1">
                <div><span className="font-semibold text-slate-500">Student:</span> <span className="font-bold text-slate-900 dark:text-white">{reviewingCorrection.student_name}</span></div>
                <div><span className="font-semibold text-slate-500">Subject:</span> {reviewingCorrection.subject_name}</div>
                <div><span className="font-semibold text-slate-500">Session:</span> {reviewingCorrection.session_date}</div>
                <div><span className="font-semibold text-slate-500">Dispute:</span> <span className="text-rose-600 uppercase font-bold">{reviewingCorrection.current_status}</span> &rarr; <span className="text-emerald-600 uppercase font-bold">{reviewingCorrection.requested_status}</span></div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Decision</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer font-bold text-emerald-600">
                    <input
                      type="radio"
                      name="reviewAction"
                      value="approved"
                      checked={reviewAction === 'approved'}
                      onChange={() => setReviewAction('approved')}
                      className="accent-emerald-600"
                    />
                    Approve
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-bold text-rose-600">
                    <input
                      type="radio"
                      name="reviewAction"
                      value="rejected"
                      checked={reviewAction === 'rejected'}
                      onChange={() => setReviewAction('rejected')}
                      className="accent-rose-600"
                    />
                    Reject
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Review Remarks</label>
                <textarea
                  rows={3}
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                  placeholder="Enter decision rationale..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              {reviewError && <p className="text-rose-600 text-xs font-bold">{reviewError}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setReviewingCorrection(null)}
                className="px-4 py-2 rounded-xl border text-slate-600 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const isPendingFac = reviewingCorrection.status === 'pending_faculty';
                  if (isPendingFac && isFaculty) {
                    facultyReviewMutation.mutate({ id: reviewingCorrection.id, action: reviewAction, remarks: reviewRemarks });
                  } else {
                    adminReviewMutation.mutate({ id: reviewingCorrection.id, action: reviewAction, remarks: reviewRemarks });
                  }
                }}
                disabled={facultyReviewMutation.isPending || adminReviewMutation.isPending}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs disabled:opacity-50"
              >
                Submit Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── RAISE CORRECTION MODAL ────────────────────────────────────────── */}
      {selectedAttendanceForCorrection && (
        <AttendanceCorrectionModal
          isOpen={!!selectedAttendanceForCorrection}
          onClose={closeCorrectionModal}
          attendanceId={selectedAttendanceForCorrection.attendance_id || selectedAttendanceForCorrection.id}
          studentName={selectedAttendanceForCorrection.studentName}
          studentPrn={selectedAttendanceForCorrection.studentPrn}
          subjectName={selectedAttendanceForCorrection.subjectName}
          sessionDate={selectedAttendanceForCorrection.sessionDate}
          sessionTime={selectedAttendanceForCorrection.sessionTime}
          venue={selectedAttendanceForCorrection.venue}
          currentStatus={selectedAttendanceForCorrection.currentStatus}
        />
      )}
    </div>
  );
};
