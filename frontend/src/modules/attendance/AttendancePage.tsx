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
  ShieldAlert,
  ClipboardList,
  Filter,
  RotateCcw,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../../lib/api';
import { useAuthStore } from '../../lib/store';
import { AttendanceCorrectionModal } from './AttendanceCorrectionModal';
import { ExportAttendanceExcelModal } from './ExportAttendanceExcelModal';

export const AttendancePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const userRoles = user?.roles || [];
  const isFaculty = userRoles.includes('faculty_internal') || userRoles.includes('faculty_external');
  const isAdmin = userRoles.includes('crc_admin') || userRoles.includes('crc_coordinator') || userRoles.includes('admin') || userRoles.includes('approver');
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
  const getSessionTitle = (sess: any) => {
    if (!sess) return 'Session';
    if (
      sess.session_type === 'hyperbuild' ||
      (sess.venue && typeof sess.venue === 'string' && sess.venue.toLowerCase().includes('hyperbuild')) ||
      (sess.notes && typeof sess.notes === 'string' && sess.notes.toLowerCase().includes('hyperbuild')) ||
      sess.subject_name === 'HyperBuild Session' ||
      !sess.subject_id
    ) {
      return 'HyperBuild Session';
    }
    return sess.subject_name || 'Class Session';
  };

  const getSessionCode = (sess: any) => {
    if (!sess) return 'SUB';
    if (
      sess.session_type === 'hyperbuild' ||
      (sess.venue && typeof sess.venue === 'string' && sess.venue.toLowerCase().includes('hyperbuild')) ||
      (sess.notes && typeof sess.notes === 'string' && sess.notes.toLowerCase().includes('hyperbuild')) ||
      sess.subject_code === 'HB' ||
      !sess.subject_id
    ) {
      return 'HB';
    }
    return sess.subject_code || 'SUB';
  };

  const [sessionDateFilter, setSessionDateFilter] = useState<string>('');
  const [sessionCategoryFilter, setSessionCategoryFilter] = useState<string>('');
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
    queryKey: ['attendance_allocated_sessions', sessionDateFilter, sessionCategoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (sessionDateFilter) params.append('session_date', sessionDateFilter);
      if (sessionCategoryFilter) params.append('category', sessionCategoryFilter);
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
        if (st.status) map[st.student_id] = st.status;
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
    const unassigned = activeSheetData.students.filter(
      (st: any) => !attendanceMap[st.student_id] && !st.status
    );
    if (unassigned.length > 0) {
      alert(`Please take attendance for all students before finalizing (${unassigned.length} student(s) remain unmarked), or click 'Mark All P' / 'Mark All A'.`);
      return;
    }
    const records = activeSheetData.students.map((st: any) => ({
      student_id: st.student_id,
      status: attendanceMap[st.student_id] || st.status,
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
      const currentSt = attendanceMap[st.student_id] ?? st.status ?? '';
      
      // Status filter
      if (rosterStatusFilter === 'unmarked' && currentSt !== '') return false;
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
    if (!activeSheetData?.students) return { present: 0, absent: 0, late: 0, excused: 0, od: 0, unmarked: 0, total: 0, pct: 0 };
    const total = activeSheetData.students.length;
    let present = 0, absent = 0, late = 0, excused = 0, od = 0, unmarked = 0;

    activeSheetData.students.forEach((st: any) => {
      const s = attendanceMap[st.student_id] ?? st.status ?? '';
      if (s === 'present') present++;
      else if (s === 'absent') absent++;
      else if (s === 'late') { late++; present++; }
      else if (s === 'excused') { excused++; present++; }
      else if (s === 'od_duty') { od++; present++; }
      else unmarked++;
    });

    const markedTotal = total - unmarked;
    const pct = markedTotal > 0 ? Math.round((present / markedTotal) * 100) : 0;
    return { present, absent, late, excused, od, unmarked, total, pct };
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
        (attendanceMap[st.student_id] || st.status || 'UNMARKED').toUpperCase(),
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
  const [registerCategory, setRegisterCategory] = useState<string>('');
  const [registerSearch, setRegisterSearch] = useState<string>('');
  const [selectedAbsenteesModal, setSelectedAbsenteesModal] = useState<any | null>(null);

  const { data: classRegisterData = [], isPending: registerLoading } = useQuery({
    queryKey: ['class_attendance_register', registerStartDate, registerEndDate, registerSubjectId, registerStatusFilter, registerCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (registerStartDate) params.append('start_date', registerStartDate);
      if (registerEndDate) params.append('end_date', registerEndDate);
      if (registerSubjectId) params.append('subject_id', registerSubjectId);
      if (registerStatusFilter) params.append('status', registerStatusFilter);
      if (registerCategory) params.append('category', registerCategory);

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
      r.attendance_status === 'marked' && typeof r.attendance_percentage === 'number' ? `${r.attendance_percentage}%` : 'N/A',
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

  const [matrixCategoryFilter, setMatrixCategoryFilter] = useState<'all' | 'academic' | 'hyperbuild'>('all');
  const [matrixStudentSearch, setMatrixStudentSearch] = useState<string>('');
  const [matrixTierFilter, setMatrixTierFilter] = useState<string>('all');

  const { data: subjectMatrixData, isPending: matrixLoading } = useQuery({
    queryKey: ['subject_attendance_matrix', selectedSubjectId, matrixCategoryFilter],
    queryFn: async () => {
      if (!selectedSubjectId) return null;
      const catParam = matrixCategoryFilter !== 'all' ? `&category=${matrixCategoryFilter}` : '';
      const res = await api.get(`/attendance/subject-matrix?subject_id=${selectedSubjectId}${catParam}`);
      return res.data?.data;
    },
    enabled: activeTab === 'matrix' && !!selectedSubjectId,
  });

  const filteredMatrixStudents = useMemo(() => {
    if (!subjectMatrixData?.students) return [];
    return subjectMatrixData.students.filter((st: any) => {
      if (matrixTierFilter === 'eligible' && !st.is_exam_eligible) return false;
      if (matrixTierFilter === 'debarred' && !st.is_debarred) return false;
      if (matrixTierFilter === 'debarred_academic' && st.debarred_category !== 'academic_only' && st.debarred_category !== 'both') return false;
      if (matrixTierFilter === 'debarred_hyperbuild' && st.debarred_category !== 'hyperbuild_only' && st.debarred_category !== 'both') return false;
      if (matrixTierFilter === 'safe' && st.tier !== 'safe') return false;
      if (matrixTierFilter === 'warning' && st.tier !== 'warning') return false;
      if (matrixTierFilter === 'not_started' && st.tier !== 'not_started') return false;

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
    const sessionCols = (subjectMatrixData.sessions || []).map((s: any) => `${s.session_code || `S${s.session_no}`} (${s.session_date})`);
    const headers = [
      'Roll No',
      'PRN',
      'Student Name',
      'Academic Attended',
      'Academic Total',
      'Academic %',
      'HyperBuild Attended',
      'HyperBuild Total',
      'HyperBuild %',
      'Exam Eligible (>=75% Both)',
      'Debarment Standing',
      'Debarment Reason',
      ...sessionCols,
    ];

    const rows = (subjectMatrixData.students || []).map((st: any) => {
      const sessionVals = (subjectMatrixData.sessions || []).map((s: any) => {
        const stat = st.attendance_by_session?.[s.id] || '-';
        return `"${stat.toUpperCase()}"`;
      });
      return [
        `"${st.roll_no}"`,
        `"${st.student_prn}"`,
        `"${st.student_name.replace(/"/g, '""')}"`,
        st.academic_attended ?? 0,
        st.academic_total ?? 0,
        st.academic_percentage !== null ? `${st.academic_percentage}%` : 'Pending',
        st.hyperbuild_attended ?? 0,
        st.hyperbuild_total ?? 0,
        st.hyperbuild_percentage !== null ? `${st.hyperbuild_percentage}%` : 'Pending',
        st.is_exam_eligible ? 'YES' : 'NO',
        st.is_debarred ? 'DEBARRED' : 'ELIGIBLE',
        `"${(st.debarment_reason || '').replace(/"/g, '""')}"`,
        ...sessionVals,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e: any) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Subject_Attendance_Matrix_${subjectMatrixData.subject_code}_${matrixCategoryFilter}.csv`);
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

  const { data: programsListData = [] } = useQuery({
    queryKey: ['programs_list_for_dossier'],
    queryFn: async () => {
      const res = await api.get('/academic/programs');
      return (res.data?.data || []) as any[];
    },
    enabled: !isStudent,
  });

  const { data: batchesListData = [] } = useQuery({
    queryKey: ['batches_list_for_attendance'],
    queryFn: async () => {
      const res = await api.get('/academic/batches');
      return (res.data?.data || []) as any[];
    },
    enabled: !isStudent,
  });

  const { data: divisionsListData = [] } = useQuery({
    queryKey: ['divisions_list_for_dossier'],
    queryFn: async () => {
      const res = await api.get('/academic/divisions');
      return (res.data?.data || []) as any[];
    },
    enabled: !isStudent,
  });

  const studentProfileId = myStudentProfile?.student?.id || myStudentProfile?.id || '';

  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    isStudent ? (studentProfileId || 'me') : (selectedStudentIdParam || '')
  );

  // Filter states for Student Records tab
  const [dossierProgramFilter, setDossierProgramFilter] = useState<string>('');
  const [dossierBatchFilter, setDossierBatchFilter] = useState<string>('');
  const [dossierDivisionFilter, setDossierDivisionFilter] = useState<string>('');
  const [dossierStudentSearch, setDossierStudentSearch] = useState<string>('');

  // Chronological session log filters in Student Dossier
  const [dossierCategoryFilter, setDossierCategoryFilter] = useState<string>('all');
  const [dossierSubjectFilter, setDossierSubjectFilter] = useState<string>('all');
  const [dossierStatusFilter, setDossierStatusFilter] = useState<string>('all');

  // Extract available Programs, Batches, and Divisions dynamically
  const availableDossierPrograms = useMemo(() => {
    const map = new Map<string, string>();
    (programsListData || []).forEach((p: any) => {
      if (p.id && p.name) map.set(p.id, p.name);
    });
    (studentsListData || []).forEach((st: any) => {
      if (st.program_id && st.program_name) map.set(st.program_id, st.program_name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [programsListData, studentsListData]);

  const availableDossierBatches = useMemo(() => {
    const map = new Map<string, string>();
    (batchesListData || []).forEach((b: any) => {
      if (b.id && b.name) map.set(b.id, b.name);
    });
    (studentsListData || []).forEach((st: any) => {
      if (st.batch_id && st.batch_name) map.set(st.batch_id, st.batch_name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [batchesListData, studentsListData]);

  const availableDossierDivisions = useMemo(() => {
    const map = new Map<string, string>();
    (divisionsListData || []).forEach((d: any) => {
      if (d.id && d.name) map.set(d.id, d.name);
    });
    (studentsListData || []).forEach((st: any) => {
      if (Array.isArray(st.division_ids) && Array.isArray(st.division_names)) {
        st.division_ids.forEach((dId: string, idx: number) => {
          if (dId && st.division_names[idx]) map.set(dId, st.division_names[idx]);
        });
      } else if (st.division) {
        map.set(st.division, st.division);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [divisionsListData, studentsListData]);


  // Filter students list for Staff Dossier search panel
  const filteredDossierStudents = useMemo(() => {
    return (studentsListData || []).filter((st: any) => {
      if (dossierProgramFilter && st.program_id !== dossierProgramFilter && st.program_name !== dossierProgramFilter) {
        return false;
      }
      if (dossierBatchFilter && st.batch_id !== dossierBatchFilter && st.batch_name !== dossierBatchFilter) {
        return false;
      }
      if (dossierDivisionFilter) {
        const hasDivId = Array.isArray(st.division_ids) && st.division_ids.includes(dossierDivisionFilter);
        const hasDivName = Array.isArray(st.division_names) && st.division_names.includes(dossierDivisionFilter);
        const matchesSingle = st.division === dossierDivisionFilter;
        if (!hasDivId && !hasDivName && !matchesSingle) {
          return false;
        }
      }
      if (dossierStudentSearch.trim()) {
        const q = dossierStudentSearch.toLowerCase().trim();
        const matchesName = st.full_name?.toLowerCase().includes(q) || `${st.first_name || ''} ${st.last_name || ''}`.toLowerCase().includes(q);
        const matchesPrn = st.prn_number?.toLowerCase().includes(q);
        const matchesEmail = st.email_official?.toLowerCase().includes(q) || st.email?.toLowerCase().includes(q);
        const matchesRoll = st.roll_no?.toLowerCase().includes(q);
        if (!matchesName && !matchesPrn && !matchesEmail && !matchesRoll) {
          return false;
        }
      }
      return true;
    });
  }, [studentsListData, dossierProgramFilter, dossierBatchFilter, dossierDivisionFilter, dossierStudentSearch]);

  // Auto-select first student in filtered list if current selection is invalid
  useEffect(() => {
    if (activeTab === 'students') {
      if (isStudent && studentProfileId) {
        setSelectedStudentId(studentProfileId);
      } else if (!isStudent && filteredDossierStudents.length > 0) {
        const isCurrentInList = filteredDossierStudents.some((st: any) => st.id === selectedStudentId);
        if (!isCurrentInList) {
          const nextId = filteredDossierStudents[0].id;
          setSelectedStudentId(nextId);
          updateParams({ studentId: nextId });
        }
      }
    }
  }, [activeTab, isStudent, studentProfileId, filteredDossierStudents, selectedStudentId]);

  const effectiveDossierId = isStudent ? (studentProfileId || 'me') : (selectedStudentId || selectedStudentIdParam || '');

  const { data: studentDossierData, isPending: studentDossierLoading, error: studentDossierError, refetch: refetchDossier } = useQuery({
    queryKey: ['student_attendance_dossier', effectiveDossierId],
    queryFn: async () => {
      const endpoint = (isStudent && (!effectiveDossierId || effectiveDossierId === 'me'))
        ? '/attendance/student-dossier/me'
        : `/attendance/student-dossier/${effectiveDossierId}`;
      const res = await api.get(endpoint);
      return res.data?.data;
    },
    enabled: isStudent ? true : !!effectiveDossierId,
  });

  // Filtered session records for chronological session log in Dossier
  const filteredDossierSessionRecords = useMemo(() => {
    if (!studentDossierData?.session_records) return [];
    return studentDossierData.session_records.filter((rec: any) => {
      if (dossierCategoryFilter !== 'all') {
        const cat = rec.category || (rec.activity_id || rec.activity_no ? 'hyperbuild_activity' : 'academic_lecture');
        if (dossierCategoryFilter === 'academic' && cat !== 'academic_lecture') return false;
        if (dossierCategoryFilter === 'hyperbuild' && cat !== 'hyperbuild_activity') return false;
      }
      if (dossierSubjectFilter !== 'all') {
        if (rec.subject_id !== dossierSubjectFilter && rec.subject_code !== dossierSubjectFilter) return false;
      }
      if (dossierStatusFilter !== 'all') {
        if (rec.status !== dossierStatusFilter) return false;
      }
      return true;
    });
  }, [studentDossierData, dossierCategoryFilter, dossierSubjectFilter, dossierStatusFilter]);

  // Export Student Attendance Dossier to Excel (.xlsx) matching Daily Student Ledger format
  const handleExportDossierExcel = () => {
    if (!studentDossierData) return;

    const workbook = XLSX.utils.book_new();

    // ── Sheet 1: Session Attendance History (matches Daily Student Ledger format) ──
    const ledgerRows = (studentDossierData.session_records || []).map((rec: any) => {
      let dayOfWeek = '';
      if (rec.session_date) {
        try {
          const d = new Date(rec.session_date + 'T00:00:00');
          dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'long' });
        } catch (e) {}
      }
      const timeSlot = rec.session_time || (rec.start_time && rec.end_time ? `${rec.start_time} - ${rec.end_time}` : '');
      const catLabel = rec.category_label || (rec.category === 'hyperbuild_activity' || rec.activity_no ? 'HyperBuild Activity' : 'Academic Lecture');
      return {
        'Roll No': studentDossierData.roll_no || '—',
        'PRN Number': studentDossierData.student_prn,
        'Student Name': studentDossierData.student_name,
        'Academic Program': studentDossierData.program_name || '—',
        'Batch': studentDossierData.batch_name || '—',
        'Session Date': rec.session_date,
        'Day of Week': dayOfWeek,
        'Time Slot': timeSlot,
        'Category': catLabel,
        'Subject Code': rec.subject_code || '—',
        'Subject Name': rec.subject_name,
        'Activity / Topic': rec.activity_no ? `Act #${rec.activity_no}: ${rec.activity_title || ''}` : (rec.topic_name || rec.topic_delivered || '—'),
        'Faculty Name': rec.faculty_name || 'Faculty',
        'Venue / Classroom': rec.venue || '—',
        'Attendance Status': (rec.status || '').toUpperCase(),
        'Remarks / Notes': rec.remarks || (rec.activity_title ? `Activity: ${rec.activity_title}` : ''),
      };
    });

    const wsLedger = XLSX.utils.json_to_sheet(ledgerRows);
    wsLedger['!cols'] = [
      { wch: 10 },
      { wch: 16 },
      { wch: 24 },
      { wch: 28 },
      { wch: 20 },
      { wch: 14 },
      { wch: 12 },
      { wch: 16 },
      { wch: 22 },
      { wch: 14 },
      { wch: 30 },
      { wch: 28 },
      { wch: 22 },
      { wch: 16 },
      { wch: 18 },
      { wch: 32 },
    ];
    XLSX.utils.book_append_sheet(workbook, wsLedger, 'Attendance Ledger');

    // ── Sheet 2: Subject Breakdown Summary ──
    const subjectRows = (studentDossierData.subjects_breakdown || []).map((sb: any) => ({
      'Subject Code': sb.subject_code || '—',
      'Subject Name': sb.subject_name,
      'Academic Lectures Conducted': sb.academic_total ?? 0,
      'Academic Lectures Attended': sb.academic_attended ?? 0,
      'Academic Lectures %': `${sb.academic_percentage ?? 0}%`,
      'Academic Standing': sb.academic_status || (sb.academic_eligible ? 'Eligible (≥75%)' : 'Debarred (<75%)'),
      'HyperBuild Activities Conducted': sb.hyperbuild_total ?? 0,
      'HyperBuild Activities Attended': sb.hyperbuild_attended ?? 0,
      'HyperBuild Activities %': `${sb.hyperbuild_percentage ?? 0}%`,
      'HyperBuild Standing': sb.hyperbuild_status || (sb.hyperbuild_eligible ? 'Eligible (≥75%)' : 'Debarred (<75%)'),
      'Total Sessions': sb.total_sessions ?? 0,
      'Total Attended': sb.attended ?? 0,
      'Overall Attendance %': `${sb.percentage}%`,
      'Exam Eligibility Status': sb.is_exam_eligible ? 'ELIGIBLE FOR EXAM' : 'DEBARRED FROM EXAM',
      'Debarment Reason / Notes': sb.debarment_reason || (sb.is_exam_eligible ? 'Meets dual 75% requirement' : 'Failed 75% threshold'),
    }));
    const wsSubjects = XLSX.utils.json_to_sheet(subjectRows);
    wsSubjects['!cols'] = [
      { wch: 14 },
      { wch: 32 },
      { wch: 24 },
      { wch: 24 },
      { wch: 18 },
      { wch: 20 },
      { wch: 26 },
      { wch: 26 },
      { wch: 20 },
      { wch: 20 },
      { wch: 16 },
      { wch: 16 },
      { wch: 18 },
      { wch: 24 },
      { wch: 36 },
    ];
    XLSX.utils.book_append_sheet(workbook, wsSubjects, 'Subject Summary');

    // ── Sheet 3: Student Overview Profile ──
    const profileRows = [
      { 'Field': 'Student Name', 'Details': studentDossierData.student_name },
      { 'Field': 'PRN Number', 'Details': studentDossierData.student_prn },
      { 'Field': 'Roll Number', 'Details': studentDossierData.roll_no || '—' },
      { 'Field': 'Academic Program', 'Details': studentDossierData.program_name || '—' },
      { 'Field': 'Batch', 'Details': studentDossierData.batch_name || '—' },
      { 'Field': 'Academic Lectures Conducted', 'Details': studentDossierData.overall_academic_total ?? 0 },
      { 'Field': 'Academic Lectures Attended', 'Details': studentDossierData.overall_academic_attended ?? 0 },
      { 'Field': 'Academic Lectures Attendance %', 'Details': `${studentDossierData.overall_academic_percentage ?? 0}%` },
      { 'Field': 'HyperBuild Activities Conducted', 'Details': studentDossierData.overall_hyperbuild_total ?? 0 },
      { 'Field': 'HyperBuild Activities Attended', 'Details': studentDossierData.overall_hyperbuild_attended ?? 0 },
      { 'Field': 'HyperBuild Activities Attendance %', 'Details': `${studentDossierData.overall_hyperbuild_percentage ?? 0}%` },
      { 'Field': 'Total Classes Conducted', 'Details': studentDossierData.total_classes_conducted || 0 },
      { 'Field': 'Total Classes Attended', 'Details': studentDossierData.total_classes_attended || 0 },
      { 'Field': 'Cumulative Attendance %', 'Details': `${studentDossierData.overall_attendance_percentage ?? 0}%` },
      {
        'Field': 'Overall Standing',
        'Details':
          (studentDossierData.overall_attendance_percentage ?? 0) >= 75
            ? 'Safe (≥75%)'
            : (studentDossierData.overall_attendance_percentage ?? 0) >= 60
            ? 'Warning (60-74%)'
            : 'Debarred (<60%)',
      },
      { 'Field': 'Exam Eligibility Rule', 'Details': 'Mandatory minimum 75% in BOTH Academic Lectures and HyperBuild Activities for each subject.' },
      { 'Field': 'Exported At', 'Details': new Date().toLocaleString() },
    ];
    const wsProfile = XLSX.utils.json_to_sheet(profileRows);
    wsProfile['!cols'] = [{ wch: 32 }, { wch: 48 }];
    XLSX.utils.book_append_sheet(workbook, wsProfile, 'Student Overview');

    const safePrn = (studentDossierData.student_prn || 'Record').replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Student_Attendance_Dossier_${safePrn}_${dateStr}.xlsx`);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB 5: DUAL-APPROVAL QUEUE
  // ─────────────────────────────────────────────────────────────────────────────
  const [correctionStatusFilter, setCorrectionStatusFilter] = useState<string>('all');
  const [reviewingCorrection, setReviewingCorrection] = useState<any | null>(null);
  const [reviewAsRole, setReviewAsRole] = useState<'admin' | 'faculty'>('admin');
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
      queryClient.invalidateQueries({ queryKey: ['attendance_allocated_sessions'] });
      queryClient.invalidateQueries({ queryKey: ['session_attendance_sheet'] });
      queryClient.invalidateQueries({ queryKey: ['subject_attendance_matrix'] });
      queryClient.invalidateQueries({ queryKey: ['student_attendance_dossier'] });
      queryClient.invalidateQueries({ queryKey: ['debarment_risk'] });
      queryClient.invalidateQueries({ queryKey: ['class_attendance_register'] });
      queryClient.invalidateQueries({ queryKey: ['daily_student_class_ledger'] });
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
      queryClient.invalidateQueries({ queryKey: ['daily_student_class_ledger'] });
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
  const [debarmentBatchId, setDebarmentBatchId] = useState<string>('');
  const [debarmentSubjectId, setDebarmentSubjectId] = useState<string>('');
  const [debarmentCategory, setDebarmentCategory] = useState<string>('all');
  const [debarmentSearch, setDebarmentSearch] = useState<string>('');

  const { data: debarredStudentsData = [], isPending: debarmentLoading } = useQuery({
    queryKey: ['debarment_risk', debarmentThreshold, debarmentBatchId, debarmentSubjectId, debarmentCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('threshold', String(debarmentThreshold));
      if (debarmentBatchId) params.append('batch_id', debarmentBatchId);
      if (debarmentSubjectId) params.append('subject_id', debarmentSubjectId);
      if (debarmentCategory && debarmentCategory !== 'all') params.append('category', debarmentCategory);
      const res = await api.get(`/attendance/debarment-risk?${params.toString()}`);
      return (res.data?.data || []) as any[];
    },
    enabled: !isStudent && activeTab === 'compliance',
  });

  const filteredDebarredStudents = useMemo(() => {
    if (!debarmentSearch.trim()) return debarredStudentsData;
    const q = debarmentSearch.toLowerCase().trim();
    return debarredStudentsData.filter((item: any) =>
      (item.student_name && item.student_name.toLowerCase().includes(q)) ||
      (item.student_prn && item.student_prn.toLowerCase().includes(q)) ||
      (item.roll_no && item.roll_no.toLowerCase().includes(q)) ||
      (item.subject_name && item.subject_name.toLowerCase().includes(q)) ||
      (item.subject_code && item.subject_code.toLowerCase().includes(q))
    );
  }, [debarredStudentsData, debarmentSearch]);

  const handleExportDebarmentExcel = () => {
    if (!filteredDebarredStudents || filteredDebarredStudents.length === 0) return;
    const workbook = XLSX.utils.book_new();
    const rows = filteredDebarredStudents.map((st: any) => ({
      'Student Name': st.student_name,
      'PRN Number': st.student_prn,
      'Roll No': st.roll_no || '—',
      'Batch': st.batch_name || '—',
      'Subject Code': st.subject_code || '—',
      'Subject Name': st.subject_name || '—',
      'Academic Lectures %': `${st.academic_percentage ?? 0}%`,
      'HyperBuild Activities %': `${st.hyperbuild_percentage ?? 0}%`,
      'Overall Attendance %': `${st.attendance_percentage ?? 0}%`,
      'Debarred In Category': st.debarred_category === 'both' ? 'Both Academic & HyperBuild' : (st.debarred_category === 'hyperbuild_only' ? 'HyperBuild Only' : 'Academic Only'),
      'Debarment Reason': st.debarment_reason || 'Attendance < 75%',
      'Shortfall Sessions': st.shortfall_sessions || 0,
      'Exam Standing': 'DEBARRED FROM EXAM',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 22 },
      { wch: 16 },
      { wch: 12 },
      { wch: 18 },
      { wch: 14 },
      { wch: 30 },
      { wch: 20 },
      { wch: 22 },
      { wch: 20 },
      { wch: 26 },
      { wch: 38 },
      { wch: 18 },
      { wch: 24 },
    ];
    XLSX.utils.book_append_sheet(workbook, ws, 'Debarred Students Registry');
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Debarred_Students_Registry_${dateStr}.xlsx`);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB: DAILY STUDENT CLASS ATTENDANCE LEDGER
  // ─────────────────────────────────────────────────────────────────────────────
  const [ledgerStartDate, setLedgerStartDate] = useState<string>('');
  const [ledgerEndDate, setLedgerEndDate] = useState<string>('');
  const [ledgerBatchId, setLedgerBatchId] = useState<string>('');
  const [ledgerSubjectId, setLedgerSubjectId] = useState<string>('');
  const [ledgerSessionId, setLedgerSessionId] = useState<string>('');
  const [ledgerCategory, setLedgerCategory] = useState<string>('');
  const [ledgerStatus, setLedgerStatus] = useState<string>('');
  const [ledgerSearch, setLedgerSearch] = useState<string>('');
  const [ledgerLimit, setLedgerLimit] = useState<number>(50);
  const [ledgerPage, setLedgerPage] = useState<number>(1);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  const {
    data: studentLedgerData,
    isPending: studentLedgerLoading,
    error: studentLedgerError,
    refetch: refetchLedger,
  } = useQuery({
    queryKey: [
      'attendance_student_ledger',
      ledgerStartDate,
      ledgerEndDate,
      ledgerBatchId,
      ledgerSubjectId,
      ledgerSessionId,
      ledgerCategory,
      ledgerStatus,
      ledgerSearch,
      ledgerLimit,
      ledgerPage,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (ledgerStartDate) params.append('start_date', ledgerStartDate);
      if (ledgerEndDate) params.append('end_date', ledgerEndDate);
      if (ledgerBatchId) params.append('batch_id', ledgerBatchId);
      if (ledgerSubjectId) params.append('subject_id', ledgerSubjectId);
      if (ledgerSessionId) params.append('session_id', ledgerSessionId);
      if (ledgerCategory) params.append('category', ledgerCategory);
      if (ledgerStatus) params.append('status', ledgerStatus);
      if (ledgerSearch.trim()) params.append('search', ledgerSearch.trim());
      if (ledgerLimit) {
        params.append('limit', String(ledgerLimit));
        params.append('offset', String((ledgerPage - 1) * ledgerLimit));
      }
      const res = await api.get(`/attendance/student-ledger?${params.toString()}`);
      return res.data?.data;
    },
    enabled: activeTab === 'daily_ledger',
  });

  const handlePresetDate = (preset: 'today' | 'yesterday' | 'week' | 'month' | 'all') => {
    const today = new Date().toISOString().split('T')[0];
    if (preset === 'today') {
      setLedgerStartDate(today);
      setLedgerEndDate(today);
    } else if (preset === 'yesterday') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const yesterday = d.toISOString().split('T')[0];
      setLedgerStartDate(yesterday);
      setLedgerEndDate(yesterday);
    } else if (preset === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setLedgerStartDate(d.toISOString().split('T')[0]);
      setLedgerEndDate(today);
    } else if (preset === 'month') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setLedgerStartDate(d.toISOString().split('T')[0]);
      setLedgerEndDate(today);
    } else if (preset === 'all') {
      setLedgerStartDate('');
      setLedgerEndDate('');
    }
    setLedgerPage(1);
  };

  const handleResetLedgerFilters = () => {
    setLedgerStartDate('');
    setLedgerEndDate('');
    setLedgerBatchId('');
    setLedgerSubjectId('');
    setLedgerSessionId('');
    setLedgerCategory('');
    setLedgerStatus('');
    setLedgerSearch('');
    setLedgerPage(1);
  };


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
              onClick={() => setTab('daily_ledger')}
              className="px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-xs border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <ClipboardList className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Daily Student Ledger
            </button>
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
      <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
        {(isStudent
          ? [
              { id: 'students', label: 'My Attendance', icon: UserCheck },
              { id: 'approvals', label: 'My Disputes', icon: FileCheck2 },
              { id: 'compliance', label: 'Compliance Status', icon: ShieldCheck },
            ]
          : [
              { id: 'sessions', label: 'Take Attendance', icon: CheckCircle2 },
              { id: 'daily_ledger', label: 'Daily Student Ledger', icon: ClipboardList, badge: 'Granular' },
              { id: 'register', label: 'Class Register', icon: FileSpreadsheet },
              { id: 'matrix', label: 'Subject Matrix', icon: Layers },
              { id: 'students', label: 'Student Records', icon: Users },
              { id: 'approvals', label: 'Dispute Approvals', icon: FileCheck2 },
              { id: 'compliance', label: 'Debarment Watchlist', icon: AlertTriangle, badge: '< 75%' },
            ]
        ).map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          const badge = 'badge' in t ? (t as any).badge : undefined;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-900/50'
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
              <span>{t.label}</span>
              {badge && (
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                  isActive
                    ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}>
                  {badge}
                </span>
              )}
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

                {/* Category Filter */}
                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setSessionCategoryFilter('')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                      !sessionCategoryFilter
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setSessionCategoryFilter('academic')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                      sessionCategoryFilter === 'academic'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    🎓 Academic
                  </button>
                  <button
                    type="button"
                    onClick={() => setSessionCategoryFilter('hyperbuild')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                      sessionCategoryFilter === 'hyperbuild'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    ⚡ HyperBuild
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
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                              {getSessionCode(s)}
                            </span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                              s.is_hyperbuild || s.category === 'hyperbuild_session'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300'
                            }`}>
                              {s.is_hyperbuild || s.category === 'hyperbuild_session' ? '⚡ HyperBuild' : '🎓 Academic'}
                            </span>
                          </div>
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
                          {getSessionTitle(s)}
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
                        {getSessionTitle(activeSheetData)}
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

                    <button
                      type="button"
                      onClick={() => setAttendanceMap({})}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold transition-colors cursor-pointer"
                      title="Clear all selections"
                    >
                      Clear All
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
                      { id: 'unmarked', label: `Unmarked (${currentSheetStats.unmarked})` },
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
                        const currentSt = attendanceMap[st.student_id] ?? st.status ?? '';
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
                                {!currentSt && (
                                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 mr-1">
                                    Unmarked
                                  </span>
                                )}
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
                                    attendance_id: st.id || st.attendance_id || st.student_id,
                                    sessionId: activeSheetData.session_id,
                                    studentId: st.student_id,
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
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
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Category</label>
                <select
                  value={registerCategory}
                  onChange={(e) => setRegisterCategory(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                >
                  <option value="">All Categories</option>
                  <option value="academic">🎓 Academic Lectures</option>
                  <option value="hyperbuild">⚡ HyperBuild Sessions</option>
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
                  <option value="marked">Conducted &amp; Finalized</option>
                  <option value="pending">Pending Roll-Call</option>
                  <option value="upcoming">Upcoming / Scheduled</option>
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
                    <th className="p-3.5">Date &amp; Time</th>
                    <th className="p-3.5">Subject &amp; Activity</th>
                    <th className="p-3.5">Batch &amp; Venue</th>
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
                      const isMarked = reg.attendance_status === 'marked' && (reg.total_students || 0) > 0;
                      const isFuture = reg.attendance_status === 'upcoming' || (reg.session_date && new Date(reg.session_date) > new Date(new Date().toISOString().split('T')[0]));
                      const hasPct = typeof reg.attendance_percentage === 'number';
                      const isHigh = hasPct && reg.attendance_percentage >= 75;
                      const isMid = hasPct && reg.attendance_percentage >= 60 && reg.attendance_percentage < 75;
                      return (
                        <tr key={reg.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="p-3.5 whitespace-nowrap">
                            <div className="font-bold text-slate-900 dark:text-white">{reg.session_date}</div>
                            <div className="text-[11px] text-slate-500 font-mono">{reg.start_time} - {reg.end_time}</div>
                          </td>
                          <td className="p-3.5">
                            <div className="font-bold text-slate-900 dark:text-white">{reg.subject_name}</div>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                              <span className="font-mono">{reg.subject_code}</span>
                              <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                                reg.is_hyperbuild || reg.category === 'hyperbuild_session'
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300'
                              }`}>
                                {reg.is_hyperbuild || reg.category === 'hyperbuild_session' ? '⚡ HyperBuild' : '🎓 Academic'}
                              </span>
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
                            {isMarked && hasPct ? (
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
                            ) : (
                              <span className="px-2.5 py-1 rounded-full font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                {isFuture ? 'Scheduled' : 'Unmarked'}
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-center whitespace-nowrap">
                            {isMarked ? (
                              <>
                                <span className="font-bold text-emerald-600">{reg.present_count} P</span>
                                <span className="text-slate-300 mx-1">/</span>
                                <span className="font-bold text-rose-600">{reg.absent_count} A</span>
                                {reg.od_count > 0 && (
                                  <>
                                    <span className="text-slate-300 mx-1">/</span>
                                    <span className="font-bold text-cyan-600">{reg.od_count} OD</span>
                                  </>
                                )}
                              </>
                            ) : (
                              <span className="text-slate-400 font-mono text-[11px]">—</span>
                            )}
                          </td>
                          <td className="p-3.5 text-center">
                            {!isMarked ? (
                              <span className="text-slate-400 text-[11px] font-medium">—</span>
                            ) : reg.absentees && reg.absentees.length > 0 ? (
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
                            {isMarked ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                Finalized
                              </span>
                            ) : isFuture ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80">
                                Scheduled
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
                                Pending
                              </span>
                            )}
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
          {/* Subject & Category Selector Bar */}
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3.5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                {/* Subject Selector */}
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-indigo-600 shrink-0" />
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => {
                      setSelectedSubjectId(e.target.value);
                      updateParams({ subjectId: e.target.value });
                    }}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
                  >
                    {(subjectsListData || []).map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                </div>

                {/* Category Mode Switcher */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setMatrixCategoryFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      matrixCategoryFilter === 'all'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    All (Dual Track)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatrixCategoryFilter('academic')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      matrixCategoryFilter === 'academic'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    🎓 Academic Lectures
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatrixCategoryFilter('hyperbuild')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      matrixCategoryFilter === 'hyperbuild'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    ⚡ HyperBuild Activities
                  </button>
                </div>
              </div>

              {/* Export Button */}
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

            {/* Filter Row: Student Search & Exam Status / Tier Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search student name, PRN, roll..."
                  value={matrixStudentSearch}
                  onChange={(e) => setMatrixStudentSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-bold">
                <span className="text-slate-400 mr-1">Filter:</span>
                {[
                  { id: 'all', label: 'All Students' },
                  { id: 'eligible', label: '✓ Exam Eligible (≥75% both)' },
                  { id: 'debarred', label: '⚠️ Debarred (<75%)' },
                  { id: 'debarred_academic', label: 'Debarred: Academic' },
                  { id: 'debarred_hyperbuild', label: 'Debarred: HyperBuild' },
                ].map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setMatrixTierFilter(tier.id)}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      matrixTierFilter === tier.id
                        ? tier.id.startsWith('debarred')
                          ? 'bg-rose-600 text-white'
                          : tier.id === 'eligible'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Summary Stats Cards: Distinct Academic vs HyperBuild & Exam Eligibility */}
          {subjectMatrixData && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Card 1: Academic Lectures */}
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <span>🎓</span> Academic Lectures
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {subjectMatrixData.academic_summary?.total_conducted ?? 0} conducted
                    {(subjectMatrixData.academic_summary?.total_scheduled || 0) > (subjectMatrixData.academic_summary?.total_conducted || 0) &&
                      ` / ${subjectMatrixData.academic_summary.total_scheduled} sched`}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                    {(subjectMatrixData.academic_summary?.total_conducted ?? 0) === 0
                      ? '—'
                      : `${subjectMatrixData.academic_summary?.average_percentage ?? 0}%`}
                    <span className="text-[11px] font-normal text-slate-400 ml-1">avg</span>
                  </div>
                  <div className="text-xs font-medium text-slate-500">
                    <span className="text-emerald-600 font-bold">{subjectMatrixData.academic_summary?.safe_count ?? 0}</span> safe ·{' '}
                    <span className="text-rose-600 font-bold">{subjectMatrixData.academic_summary?.debarred_count ?? 0}</span> &lt; 75%
                  </div>
                </div>
              </div>

              {/* Card 2: HyperBuild Activities */}
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <span>⚡</span> HyperBuild Activities
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {subjectMatrixData.hyperbuild_summary?.total_conducted ?? 0} conducted
                    {(subjectMatrixData.hyperbuild_summary?.total_scheduled || 0) > (subjectMatrixData.hyperbuild_summary?.total_conducted || 0) &&
                      ` / ${subjectMatrixData.hyperbuild_summary.total_scheduled} sched`}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                    {(subjectMatrixData.hyperbuild_summary?.total_conducted ?? 0) === 0
                      ? '—'
                      : `${subjectMatrixData.hyperbuild_summary?.average_percentage ?? 0}%`}
                    <span className="text-[11px] font-normal text-slate-400 ml-1">avg</span>
                  </div>
                  <div className="text-xs font-medium text-slate-500">
                    <span className="text-emerald-600 font-bold">{subjectMatrixData.hyperbuild_summary?.safe_count ?? 0}</span> safe ·{' '}
                    <span className="text-rose-600 font-bold">{subjectMatrixData.hyperbuild_summary?.debarred_count ?? 0}</span> &lt; 75%
                  </div>
                </div>
              </div>

              {/* Card 3: Exam Eligibility (Min 75% in Both) */}
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4 text-amber-500" /> Exam Eligibility
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    Min 75% both · {subjectMatrixData.total_students} students
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <div className="text-2xl font-black text-slate-900 dark:text-white">
                    <span className="text-emerald-600">{subjectMatrixData.exam_summary?.eligible_count ?? 0}</span>
                    <span className="text-sm font-normal text-slate-400 mx-1">/</span>
                    <span className="text-rose-600">{subjectMatrixData.exam_summary?.debarred_count ?? 0}</span>
                    <span className="text-[11px] font-normal text-slate-400 ml-1.5">(eligible / debarred)</span>
                  </div>
                  <div className="text-[11px] font-medium text-slate-500">
                    {(subjectMatrixData.exam_summary?.debarred_count ?? 0) > 0 ? (
                      <span className="text-rose-600 font-semibold">
                        {subjectMatrixData.exam_summary?.debarred_academic_only ?? 0} Acad · {subjectMatrixData.exam_summary?.debarred_hyperbuild_only ?? 0} HB · {subjectMatrixData.exam_summary?.debarred_both ?? 0} Both
                      </span>
                    ) : (
                      <span className="text-emerald-600 font-bold">100% Eligible</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Matrix Cross-Tab Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20">
                  <tr>
                    <th className="p-3 sticky left-0 bg-slate-50 dark:bg-slate-800 z-30 min-w-[65px]">Roll No</th>
                    <th className="p-3 sticky left-[65px] bg-slate-50 dark:bg-slate-800 z-30 min-w-[110px]">PRN</th>
                    <th className="p-3 sticky left-[175px] bg-slate-50 dark:bg-slate-800 z-30 min-w-[170px]">Student Name</th>

                    {matrixCategoryFilter === 'all' ? (
                      <>
                        <th className="p-3 text-center min-w-[95px]">🎓 Academic %</th>
                        <th className="p-3 text-center min-w-[100px]">⚡ HyperBuild %</th>
                        <th className="p-3 text-center min-w-[100px]">Exam Standing</th>
                      </>
                    ) : matrixCategoryFilter === 'academic' ? (
                      <>
                        <th className="p-3 text-center min-w-[85px]">Attended</th>
                        <th className="p-3 text-center min-w-[95px]">Academic %</th>
                        <th className="p-3 text-center min-w-[90px]">Status</th>
                      </>
                    ) : (
                      <>
                        <th className="p-3 text-center min-w-[85px]">Attended</th>
                        <th className="p-3 text-center min-w-[95px]">HyperBuild %</th>
                        <th className="p-3 text-center min-w-[90px]">Status</th>
                      </>
                    )}

                    {subjectMatrixData?.sessions?.map((s: any) => (
                      <th
                        key={s.id}
                        className={`p-2.5 text-center min-w-[65px] font-mono text-[10px] ${
                          s.is_conducted === false ? 'opacity-70 bg-slate-100/50 dark:bg-slate-800/40' : ''
                        }`}
                        title={
                          s.is_hyperbuild
                            ? `⚡ HyperBuild Activity: ${s.activity_title || s.session_code} (${s.session_date})`
                            : `🎓 Academic Lecture: ${s.session_code} (${s.session_date})`
                        }
                      >
                        <div className="flex items-center justify-center gap-1 font-bold">
                          <span>{s.is_hyperbuild ? '⚡' : '🎓'} {s.session_code || `S${s.session_no}`}</span>
                          {s.is_conducted === false && (
                            <span className="px-1 py-0.2 text-[7.5px] font-sans font-bold uppercase rounded bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                              Sched
                            </span>
                          )}
                        </div>
                        <div className="text-slate-400 font-normal">{s.session_date?.slice(5) || ''}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {matrixLoading ? (
                    <tr>
                      <td colSpan={12} className="p-8 text-center text-slate-400">Loading subject matrix...</td>
                    </tr>
                  ) : filteredMatrixStudents.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="p-8 text-center text-slate-400">No student records match the selected filter.</td>
                    </tr>
                  ) : (
                    filteredMatrixStudents.map((st: any) => {
                      return (
                        <tr key={st.student_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-mono font-bold sticky left-0 bg-white dark:bg-slate-900 z-10 text-slate-700 dark:text-slate-300">
                            {st.roll_no}
                          </td>
                          <td className="p-3 font-mono text-[11px] font-bold sticky left-[65px] bg-white dark:bg-slate-900 z-10 text-slate-600 dark:text-slate-400">
                            {st.student_prn}
                          </td>
                          <td className="p-3 font-bold sticky left-[175px] bg-white dark:bg-slate-900 z-10 text-slate-900 dark:text-white">
                            {st.student_name}
                          </td>

                          {matrixCategoryFilter === 'all' ? (
                            <>
                              {/* Academic % */}
                              <td className="p-3 text-center">
                                {st.academic_total === 0 ? (
                                  <span className="px-2 py-0.5 rounded-full font-semibold text-[10px] bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                    No Classes
                                  </span>
                                ) : (
                                  <span
                                    className={`px-2 py-0.5 rounded-full font-bold text-[10.5px] ${
                                      st.academic_percentage >= 75
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                                    }`}
                                  >
                                    {st.academic_percentage}%{' '}
                                    <span className="text-[9px] opacity-75 font-normal">
                                      ({st.academic_attended}/{st.academic_total})
                                    </span>
                                  </span>
                                )}
                              </td>

                              {/* HyperBuild % */}
                              <td className="p-3 text-center">
                                {st.hyperbuild_total === 0 ? (
                                  <span className="px-2 py-0.5 rounded-full font-semibold text-[10px] bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                    No Classes
                                  </span>
                                ) : (
                                  <span
                                    className={`px-2 py-0.5 rounded-full font-bold text-[10.5px] ${
                                      st.hyperbuild_percentage >= 75
                                        ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300'
                                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                                    }`}
                                  >
                                    {st.hyperbuild_percentage}%{' '}
                                    <span className="text-[9px] opacity-75 font-normal">
                                      ({st.hyperbuild_attended}/{st.hyperbuild_total})
                                    </span>
                                  </span>
                                )}
                              </td>

                              {/* Exam Debarment Standing */}
                              <td className="p-3 text-center">
                                {st.academic_total === 0 && st.hyperbuild_total === 0 ? (
                                  <span className="px-2 py-0.5 rounded-full font-semibold text-[10px] bg-slate-100 text-slate-500 dark:bg-slate-800">
                                    Pending
                                  </span>
                                ) : st.is_debarred ? (
                                  <span
                                    className="px-2 py-0.5 rounded-full font-black text-[10px] bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800 inline-flex items-center gap-1 cursor-help"
                                    title={st.debarment_reason || 'Debarred from exam (< 75%)'}
                                  >
                                    <AlertTriangle className="h-2.5 w-2.5 text-rose-600" />
                                    DEBARRED
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full font-black text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 inline-flex items-center gap-1">
                                    <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />
                                    ELIGIBLE
                                  </span>
                                )}
                              </td>
                            </>
                          ) : matrixCategoryFilter === 'academic' ? (
                            <>
                              <td className="p-3 text-center font-semibold text-slate-700 dark:text-slate-300">
                                {st.academic_attended} / {st.academic_total}
                              </td>
                              <td className="p-3 text-center">
                                {st.academic_total === 0 ? (
                                  <span className="text-slate-400 text-[10px]">Pending</span>
                                ) : (
                                  <span
                                    className={`px-2 py-0.5 rounded-full font-black text-[11px] ${
                                      st.academic_eligible
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                                    }`}
                                  >
                                    {st.academic_percentage}%
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                {st.academic_total === 0 ? (
                                  <span className="text-slate-400 text-[10px]">Pending</span>
                                ) : st.academic_eligible ? (
                                  <span className="text-emerald-600 font-bold text-[11px]">Safe</span>
                                ) : (
                                  <span className="text-rose-600 font-bold text-[11px]">Debarred</span>
                                )}
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="p-3 text-center font-semibold text-slate-700 dark:text-slate-300">
                                {st.hyperbuild_attended} / {st.hyperbuild_total}
                              </td>
                              <td className="p-3 text-center">
                                {st.hyperbuild_total === 0 ? (
                                  <span className="text-slate-400 text-[10px]">Pending</span>
                                ) : (
                                  <span
                                    className={`px-2 py-0.5 rounded-full font-black text-[11px] ${
                                      st.hyperbuild_eligible
                                        ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300'
                                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                                    }`}
                                  >
                                    {st.hyperbuild_percentage}%
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                {st.hyperbuild_total === 0 ? (
                                  <span className="text-slate-400 text-[10px]">Pending</span>
                                ) : st.hyperbuild_eligible ? (
                                  <span className="text-indigo-600 font-bold text-[11px]">Safe</span>
                                ) : (
                                  <span className="text-rose-600 font-bold text-[11px]">Debarred</span>
                                )}
                              </td>
                            </>
                          )}

                          {/* Session Attendance Check Cells */}
                          {subjectMatrixData?.sessions?.map((s: any) => {
                            const stat = st.attendance_by_session?.[s.id] || 'unmarked';
                            const isScheduled = s.is_conducted === false;
                            return (
                              <td key={s.id} className="p-2 text-center">
                                <span
                                  className={`inline-block w-6 h-6 rounded-md text-[10px] font-black leading-6 text-center ${
                                    isScheduled
                                      ? 'text-slate-300 dark:text-slate-600 font-normal'
                                      : stat === 'present'
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
                                  title={
                                    isScheduled
                                      ? `${s.session_code || `Session ${s.session_no}`}: Scheduled (Future class)`
                                      : `${s.session_code || `Session ${s.session_no}`}: ${stat.toUpperCase()}`
                                  }
                                >
                                  {isScheduled
                                    ? '·'
                                    : stat === 'present'
                                    ? 'P'
                                    : stat === 'absent'
                                    ? 'A'
                                    : stat === 'od_duty'
                                    ? 'OD'
                                    : stat === 'excused'
                                    ? 'E'
                                    : stat === 'late'
                                    ? 'L'
                                    : '-'}
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
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <Filter className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Filter Student Records</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                    {filteredDossierStudents.length} of {studentsListData.length} students
                  </span>
                </div>

                {(dossierProgramFilter || dossierBatchFilter || dossierDivisionFilter || dossierStudentSearch) && (
                  <button
                    type="button"
                    onClick={() => {
                      setDossierProgramFilter('');
                      setDossierBatchFilter('');
                      setDossierDivisionFilter('');
                      setDossierStudentSearch('');
                    }}
                    className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                  >
                    <RotateCcw className="h-3 w-3" /> Reset Filters
                  </button>
                )}
              </div>

              {/* Filter Row: Program, Batch, Division, Search */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Program Filter */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Program
                  </label>
                  <select
                    value={dossierProgramFilter}
                    onChange={(e) => setDossierProgramFilter(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="">All Programs</option>
                    {availableDossierPrograms.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Batch Filter */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Batch
                  </label>
                  <select
                    value={dossierBatchFilter}
                    onChange={(e) => setDossierBatchFilter(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="">All Batches</option>
                    {availableDossierBatches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Division Filter */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Division
                  </label>
                  <select
                    value={dossierDivisionFilter}
                    onChange={(e) => setDossierDivisionFilter(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="">All Divisions</option>
                    {availableDossierDivisions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Search Student Input */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Search Student
                  </label>
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={dossierStudentSearch}
                      onChange={(e) => setDossierStudentSearch(e.target.value)}
                      placeholder="Name, PRN, or Roll..."
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-7 py-2 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400"
                    />
                    {dossierStudentSearch && (
                      <button
                        type="button"
                        onClick={() => setDossierStudentSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Student Dropdown & Export Action */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">
                    <Users className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <select
                      value={selectedStudentId}
                      onChange={(e) => {
                        setSelectedStudentId(e.target.value);
                        updateParams({ studentId: e.target.value });
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
                    >
                      {filteredDossierStudents.length === 0 ? (
                        <option value="" disabled>
                          No students match the selected filters
                        </option>
                      ) : (
                        filteredDossierStudents.map((st: any) => (
                          <option key={st.id} value={st.id}>
                            {st.first_name} {st.last_name || ''} ({st.prn_number || 'No PRN'}{st.roll_no ? ` · Roll: ${st.roll_no}` : ''})
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleExportDossierExcel}
                  disabled={!studentDossierData}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Export Dossier (Excel)
                </button>
              </div>
            </div>
          )}

          {studentDossierLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs">Loading attendance records...</div>
          ) : studentDossierData ? (
            <div className="space-y-6">
              {/* Dossier Header Card */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    {studentDossierData.student_name}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    PRN: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{studentDossierData.student_prn}</span> • {studentDossierData.program_name} • {studentDossierData.batch_name}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5">
                      <span>🎓</span> Academic Lectures: <strong className="text-slate-900 dark:text-white">{studentDossierData.overall_academic_attended ?? 0}/{studentDossierData.overall_academic_total ?? 0}</strong> ({studentDossierData.overall_academic_percentage ?? 0}%)
                    </span>
                    <span className="px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5">
                      <span>⚡</span> HyperBuild Activities: <strong className="text-indigo-900 dark:text-indigo-200">{studentDossierData.overall_hyperbuild_attended ?? 0}/{studentDossierData.overall_hyperbuild_total ?? 0}</strong> ({studentDossierData.overall_hyperbuild_percentage ?? 0}%)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleExportDossierExcel}
                    disabled={!studentDossierData}
                    className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <FileSpreadsheet className="h-4 w-4" /> Export to Excel
                  </button>
                  <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-center">
                    <div className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400">Cumulative Attendance</div>
                    <div className="text-xl font-black text-indigo-700 dark:text-indigo-300 mt-0.5">
                      {(studentDossierData.total_classes_conducted || 0) > 0
                        ? `${studentDossierData.overall_attendance_percentage ?? 0}%`
                        : '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Subject Breakdown Cards with Dual-Category Breakdown & Exam Eligibility Standing */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <Layers className="h-4 w-4 text-indigo-600" />
                    Course-by-Course Attendance & Exam Debarment Standing
                  </h3>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Rule: Min 75% required in <strong>Academic</strong> & <strong>HyperBuild</strong> to sit for exams
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {(studentDossierData.subjects_breakdown || []).map((sb: any) => {
                    const isDebarred = sb.is_debarred;
                    const acadPct = sb.academic_percentage ?? 0;
                    const hbPct = sb.hyperbuild_percentage ?? 0;
                    const hasAcad = (sb.academic_total ?? 0) > 0;
                    const hasHb = (sb.hyperbuild_total ?? 0) > 0;

                    return (
                      <div
                        key={sb.subject_id}
                        className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border transition-all ${
                          isDebarred
                            ? 'border-rose-300 dark:border-rose-900/60 shadow-xs bg-rose-50/10'
                            : 'border-slate-200 dark:border-slate-800 shadow-xs'
                        } space-y-3`}
                      >
                        {/* Header: Code + Name + Exam Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-mono text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded">
                              {sb.subject_code}
                            </span>
                            <h4 className="font-bold text-xs text-slate-900 dark:text-white mt-1 line-clamp-1" title={sb.subject_name}>
                              {sb.subject_name}
                            </h4>
                          </div>
                          <div>
                            {isDebarred ? (
                              <span
                                className="px-2 py-1 rounded-lg text-[10px] font-black bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800 flex items-center gap-1 shrink-0 whitespace-nowrap"
                                title={sb.debarment_reason || 'Debarred from exam (< 75%)'}
                              >
                                <AlertTriangle className="h-3 w-3 text-rose-600 dark:text-rose-400" />
                                DEBARRED
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded-lg text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1 shrink-0 whitespace-nowrap">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                EXAM ELIGIBLE
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Debarment Alert Notice if Debarred */}
                        {isDebarred && (
                          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-[11px] text-rose-700 dark:text-rose-300">
                            <strong>Debarment Notice:</strong> {sb.debarment_reason}
                          </div>
                        )}

                        {/* Dual Category Breakdown */}
                        <div className="space-y-2.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                          {/* Category 1: Academic Lectures */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                <span>🎓</span> Academic Lectures
                              </span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {hasAcad ? (
                                  <>
                                    {sb.academic_attended}/{sb.academic_total}{' '}
                                    <span className={acadPct >= 75 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                                      ({acadPct}%)
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-slate-400">0 Conducted</span>
                                )}
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  !hasAcad ? 'bg-slate-300 dark:bg-slate-700' : acadPct >= 75 ? 'bg-emerald-500' : 'bg-rose-500'
                                }`}
                                style={{ width: hasAcad ? `${Math.min(100, acadPct)}%` : '0%' }}
                              />
                            </div>
                            {hasAcad && acadPct < 75 && sb.academic_shortfall > 0 && (
                              <p className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">
                                Shortfall: Attend next {sb.academic_shortfall} lecture(s) to reach 75%
                              </p>
                            )}
                          </div>

                          {/* Category 2: HyperBuild Activities */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                <span>⚡</span> HyperBuild Activities
                              </span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {hasHb ? (
                                  <>
                                    {sb.hyperbuild_attended}/{sb.hyperbuild_total}{' '}
                                    <span className={hbPct >= 75 ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-rose-600 font-bold'}>
                                      ({hbPct}%)
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-slate-400">0 Conducted</span>
                                )}
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  !hasHb ? 'bg-slate-300 dark:bg-slate-700' : hbPct >= 75 ? 'bg-indigo-500' : 'bg-rose-500'
                                }`}
                                style={{ width: hasHb ? `${Math.min(100, hbPct)}%` : '0%' }}
                              />
                            </div>
                            {hasHb && hbPct < 75 && sb.hyperbuild_shortfall > 0 && (
                              <p className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">
                                Shortfall: Complete next {sb.hyperbuild_shortfall} activity/activities to reach 75%
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Overall Footer */}
                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <span>Combined: {sb.attended}/{sb.total_sessions} ({sb.percentage}%)</span>
                          <span className={sb.percentage >= 75 ? 'text-emerald-600 font-bold' : 'text-slate-500 font-medium'}>
                            {sb.percentage >= 75 ? 'Overall Safe' : 'Overall Low'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Chronological Session Attendance Log with Category, Subject, and Status Filters */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Clock className="h-4 w-4 text-indigo-600" />
                    Chronological Session Attendance Log
                    <span className="text-xs font-normal text-slate-400">
                      ({filteredDossierSessionRecords.length} records)
                    </span>
                  </h3>

                  {/* Filters */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Category Filter */}
                    <select
                      value={dossierCategoryFilter}
                      onChange={(e) => setDossierCategoryFilter(e.target.value)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                    >
                      <option value="all">All Categories</option>
                      <option value="academic">🎓 Academic Lectures</option>
                      <option value="hyperbuild">⚡ HyperBuild Activities</option>
                    </select>

                    {/* Subject Filter */}
                    <select
                      value={dossierSubjectFilter}
                      onChange={(e) => setDossierSubjectFilter(e.target.value)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 max-w-[180px]"
                    >
                      <option value="all">All Subjects</option>
                      {(studentDossierData.subjects_breakdown || []).map((sb: any) => (
                        <option key={sb.subject_id} value={sb.subject_id}>
                          {sb.subject_code ? `[${sb.subject_code}] ` : ''}{sb.subject_name}
                        </option>
                      ))}
                    </select>

                    {/* Status Filter */}
                    <select
                      value={dossierStatusFilter}
                      onChange={(e) => setDossierStatusFilter(e.target.value)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                    >
                      <option value="all">All Statuses</option>
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="excused">Excused / OD</option>
                    </select>

                    {(dossierCategoryFilter !== 'all' || dossierSubjectFilter !== 'all' || dossierStatusFilter !== 'all') && (
                      <button
                        type="button"
                        onClick={() => {
                          setDossierCategoryFilter('all');
                          setDossierSubjectFilter('all');
                          setDossierStatusFilter('all');
                        }}
                        className="text-xs font-bold text-rose-600 hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <X className="h-3.5 w-3.5" /> Clear
                      </button>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3">Date</th>
                        <th className="p-3">Category</th>
                        <th className="p-3">Subject & Activity / Topic</th>
                        <th className="p-3">Faculty</th>
                        <th className="p-3">Time & Venue</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredDossierSessionRecords.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400">
                            No session records found matching the selected filters.
                          </td>
                        </tr>
                      ) : (
                        filteredDossierSessionRecords.map((rec: any) => {
                          const isHb = rec.category === 'hyperbuild_activity' || Boolean(rec.activity_no);
                          return (
                            <tr key={rec.attendance_id || `${rec.session_id}-${rec.activity_id || ''}`} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                              <td className="p-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">{rec.session_date}</td>
                              <td className="p-3 whitespace-nowrap">
                                {isHb ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1 w-fit">
                                    <span>⚡</span> HyperBuild
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1 w-fit">
                                    <span>🎓</span> Academic
                                  </span>
                                )}
                              </td>
                              <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                                <div>
                                  {rec.subject_code ? `${rec.subject_code} · ` : ''}{rec.subject_name}
                                </div>
                                {isHb && rec.activity_title ? (
                                  <div className="text-[11px] font-normal text-indigo-600 dark:text-indigo-400 mt-0.5">
                                    Activity #{rec.activity_no}: {rec.activity_title}
                                  </div>
                                ) : rec.topic_name ? (
                                  <div className="text-[11px] font-normal text-slate-400 mt-0.5">
                                    Topic: {rec.topic_name}
                                  </div>
                                ) : null}
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
                                  onClick={() =>
                                    openCorrectionModal({
                                      attendance_id: rec.attendance_id || rec.id,
                                      sessionId: rec.session_id,
                                      activityId: rec.activity_id,
                                      studentId: studentDossierData?.student_id,
                                      studentName: studentDossierData?.student_name,
                                      studentPrn: studentDossierData?.student_prn,
                                      subjectName: rec.subject_name,
                                      sessionDate: rec.session_date,
                                      sessionTime: rec.session_time || (rec.start_time && rec.end_time ? `${rec.start_time} - ${rec.end_time}` : undefined),
                                      venue: rec.venue,
                                      currentStatus: rec.status,
                                    })
                                  }
                                  className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 text-slate-700 dark:text-slate-300 font-bold text-[11px] transition-colors cursor-pointer"
                                >
                                  Dispute
                                </button>
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

          ) : studentDossierError ? (
            <div className="p-8 text-center rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 max-w-xl mx-auto my-8">
              <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200">Unable to load attendance dossier</h3>
              <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">
                {(studentDossierError as any)?.response?.data?.detail || (studentDossierError as Error).message || 'Please try again.'}
              </p>
              <button
                type="button"
                onClick={() => refetchDossier()}
                className="mt-3 px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 text-xs">No attendance records found for this student.</div>
          )}
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
                  <th className="p-3.5 text-center">Faculty Review</th>
                  <th className="p-3.5 text-center">Admin Review</th>
                  <th className="p-3.5 text-center">Resolution</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {correctionsLoading ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">Loading requests...</td>
                  </tr>
                ) : (correctionsData || []).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">No correction requests found.</td>
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
                        {corr.activities_details && corr.activities_details.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {corr.activities_details.map((act: any) => (
                              <span
                                key={act.id}
                                className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80"
                                title={`Act #${act.activity_no}: ${act.title}`}
                              >
                                Act #{act.activity_no} ({act.subject_code || 'HB'})
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-3.5 text-center font-bold">
                        <span className="text-rose-600 uppercase">{corr.current_status}</span> &rarr;{' '}
                        <span className="text-emerald-600 uppercase">{corr.requested_status}</span>
                      </td>
                      <td className="p-3.5 max-w-xs truncate text-slate-600 dark:text-slate-400">{corr.reason}</td>
                      <td className="p-3.5 text-center">
                        {corr.faculty_action === 'approved' ? (
                          <div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ✓ Approved
                            </span>
                            {corr.faculty_approver_name && (
                              <div className="text-[10px] text-slate-500 mt-0.5 max-w-[110px] truncate mx-auto" title={corr.faculty_approver_name}>
                                {corr.faculty_approver_name}
                              </div>
                            )}
                          </div>
                        ) : corr.faculty_action === 'rejected' ? (
                          <div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              ✗ Rejected
                            </span>
                            {corr.faculty_approver_name && (
                              <div className="text-[10px] text-slate-500 mt-0.5 max-w-[110px] truncate mx-auto" title={corr.faculty_approver_name}>
                                {corr.faculty_approver_name}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            ⏳ Pending
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        {corr.admin_action === 'approved' ? (
                          <div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ✓ Approved
                            </span>
                            {corr.admin_approver_name && (
                              <div className="text-[10px] text-slate-500 mt-0.5 max-w-[110px] truncate mx-auto" title={corr.admin_approver_name}>
                                {corr.admin_approver_name}
                              </div>
                            )}
                          </div>
                        ) : corr.admin_action === 'rejected' ? (
                          <div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              ✗ Rejected
                            </span>
                            {corr.admin_approver_name && (
                              <div className="text-[10px] text-slate-500 mt-0.5 max-w-[110px] truncate mx-auto" title={corr.admin_approver_name}>
                                {corr.admin_approver_name}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            ⏳ Pending
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        {corr.status === 'approved' ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500 text-white shadow-xs">
                            DUAL APPROVED ✓
                          </span>
                        ) : corr.status === 'rejected' ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-500 text-white shadow-xs">
                            REJECTED ✗
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            PENDING REVIEW
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        {!isStudent && corr.status !== 'approved' && corr.status !== 'rejected' && (
                          <button
                            type="button"
                            onClick={() => {
                              setReviewError(null);
                              setReviewRemarks('');
                              setReviewAction('approved');
                              const facDone = corr.faculty_action === 'approved' || corr.faculty_action === 'rejected';
                              if (isFaculty && !isAdmin) {
                                setReviewAsRole('faculty');
                              } else if (isAdmin && !isFaculty) {
                                setReviewAsRole('admin');
                              } else if (isAdmin && isFaculty) {
                                setReviewAsRole(facDone ? 'admin' : 'faculty');
                              }
                              setReviewingCorrection(corr);
                            }}
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
            /* STUDENT PERSONAL COMPLIANCE & DUAL-TRACK EXAM ELIGIBILITY */
            <div className="space-y-6">
              {/* Compliance Status Header Card */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                      Institutional Exam Debarment & Compliance Standing
                    </h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                      (studentDossierData?.total_classes_conducted || 0) === 0
                        ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                        : (studentDossierData?.subjects_breakdown || []).some((sb: any) => sb.is_debarred)
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                    }`}>
                      {(studentDossierData?.total_classes_conducted || 0) === 0
                        ? 'Classes Pending'
                        : (studentDossierData?.subjects_breakdown || []).some((sb: any) => sb.is_debarred)
                        ? 'Debarment Risk Active'
                        : 'Fully Exam Eligible'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed max-w-3xl">
                    <strong>Institutional Examination Policy:</strong> Students require a <strong>minimum 75% attendance in BOTH categories</strong> (Academic Lectures AND HyperBuild Activities) for each enrolled course module. Falling below 75% in either category results in examination debarment for that particular subject.
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-center">
                    <div className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400">Cumulative Attendance</div>
                    <div className="text-2xl font-black text-indigo-700 dark:text-indigo-300 mt-0.5">
                      {(studentDossierData?.total_classes_conducted || 0) > 0
                        ? `${studentDossierData?.overall_attendance_percentage ?? 0}%`
                        : '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Recovery & Buffer Summary */}
              {(() => {
                const totalCond = studentDossierData?.total_classes_conducted || 0;
                const totalAtt = studentDossierData?.total_classes_attended || 0;
                const hasClasses = totalCond > 0;
                const currentPct = studentDossierData?.overall_attendance_percentage ?? 0;
                const debarredSubjects = (studentDossierData?.subjects_breakdown || []).filter((sb: any) => sb.is_debarred);
                const hasDebarred = debarredSubjects.length > 0;

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Recovery Action Card */}
                    <div className={`p-6 rounded-3xl border shadow-sm space-y-3 ${
                      !hasClasses
                        ? 'bg-slate-50/50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800'
                        : !hasDebarred
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40'
                        : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40'
                    }`}>
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2.5 rounded-2xl ${
                          !hasClasses
                            ? 'bg-slate-600 text-white'
                            : !hasDebarred
                            ? 'bg-emerald-600 text-white'
                            : 'bg-rose-600 text-white'
                        }`}>
                          {!hasClasses ? <Clock className="h-5 w-5" /> : !hasDebarred ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            {!hasClasses
                              ? 'Academic Sessions Pending'
                              : !hasDebarred
                              ? 'Compliant Standing Across All Subjects'
                              : `${debarredSubjects.length} Subject(s) at Risk of Debarment`}
                          </h4>
                          <p className="text-xs text-slate-500">
                            {!hasClasses
                              ? 'No classes have been conducted yet'
                              : !hasDebarred
                              ? 'You satisfy the dual 75% rule in all enrolled modules'
                              : 'Immediate attendance recovery required to sit for exams'}
                          </p>
                        </div>
                      </div>

                      {!hasClasses ? (
                        <div className="space-y-2 pt-1 text-xs text-slate-700 dark:text-slate-300">
                          <p className="leading-relaxed">
                            No sessions have been conducted or marked yet. Attendance tracking and compliance metrics will update dynamically once faculty begin taking roll call.
                          </p>
                        </div>
                      ) : !hasDebarred ? (
                        <div className="space-y-2 pt-1 text-xs text-slate-700 dark:text-slate-300">
                          <p className="leading-relaxed">
                            Your cumulative attendance is <strong className="text-emerald-600 font-black">{currentPct}%</strong> ({totalAtt} of {totalCond} classes attended), and both your Academic Lectures and HyperBuild Activities meet the mandatory 75% threshold in every course.
                          </p>
                          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-between">
                            <span className="font-semibold text-slate-600 dark:text-slate-400">Exam Eligibility Status:</span>
                            <span className="font-black text-emerald-700 dark:text-emerald-300">CLEARED FOR ALL EXAMS ✓</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 pt-1 text-xs text-slate-700 dark:text-slate-300">
                          <p className="leading-relaxed">
                            You are currently debarred from exams in: <strong className="text-rose-600 font-bold">{debarredSubjects.map((s: any) => s.subject_code || s.subject_name).join(', ')}</strong> due to sub-75% attendance in one or both categories.
                          </p>
                          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800/40 space-y-1.5">
                            {debarredSubjects.map((s: any) => (
                              <div key={s.subject_id} className="flex items-center justify-between text-[11px]">
                                <span className="font-bold text-slate-800 dark:text-slate-200">{s.subject_name}:</span>
                                <span className="text-rose-600 font-semibold">{s.debarment_reason}</span>
                              </div>
                            ))}
                          </div>
                          <p className="text-[11px] text-slate-500 italic">
                            Tip: Attend all upcoming lectures/labs and submit on-duty/medical slips via the Disputes tab if absences were institutional.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Policy Guidelines Card */}
                    <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3.5">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-indigo-600" />
                        Dual-Track Attendance Policy Rules
                      </h4>

                      <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-400">
                        <li className="flex items-start gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                          <span><strong>Category 1 — Academic Lectures:</strong> Standard classroom theory and tutorial sessions. Minimum 75% required.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                          <span><strong>Category 2 — HyperBuild Activities:</strong> Applied hands-on labs and challenge exercises. Minimum 75% required.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                          <span><strong>Zero-Tolerance Subject Debarment:</strong> Failing to achieve 75% in <em>either</em> category results in debarment from that subject's end-term exam.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                          <span><strong>Pending Categories:</strong> If no activities or lectures have been conducted yet in a category, you are not penalized until classes take place.</span>
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
                  Course-by-Course Exam Eligibility Grid
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(studentDossierData?.subjects_breakdown || []).map((sb: any) => {
                    const isDebarred = sb.is_debarred;
                    const acadPct = sb.academic_percentage ?? 0;
                    const hbPct = sb.hyperbuild_percentage ?? 0;
                    const hasAcad = (sb.academic_total ?? 0) > 0;
                    const hasHb = (sb.hyperbuild_total ?? 0) > 0;

                    return (
                      <div
                        key={sb.subject_id}
                        className={`p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border transition-all ${
                          isDebarred
                            ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/20'
                            : 'border-slate-200 dark:border-slate-700/60'
                        } space-y-2.5`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded">
                            {sb.subject_code}
                          </span>
                          {isDebarred ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                              DEBARRED FROM EXAM
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                              EXAM ELIGIBLE ✓
                            </span>
                          )}
                        </div>

                        <h5 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1" title={sb.subject_name}>
                          {sb.subject_name}
                        </h5>

                        {/* Dual Category Status */}
                        <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-700/60 text-[11px]">
                          {/* Academic */}
                          <div className="space-y-0.5">
                            <div className="flex justify-between">
                              <span className="text-slate-500">🎓 Academic Lectures:</span>
                              <span className={!hasAcad ? 'text-slate-400' : acadPct >= 75 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                                {hasAcad ? `${sb.academic_attended}/${sb.academic_total} (${acadPct}%)` : 'Pending'}
                              </span>
                            </div>
                            <div className="w-full h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${!hasAcad ? 'bg-slate-300' : acadPct >= 75 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                style={{ width: hasAcad ? `${Math.min(100, acadPct)}%` : '0%' }}
                              />
                            </div>
                          </div>

                          {/* HyperBuild */}
                          <div className="space-y-0.5">
                            <div className="flex justify-between">
                              <span className="text-slate-500">⚡ HyperBuild Activities:</span>
                              <span className={!hasHb ? 'text-slate-400' : hbPct >= 75 ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-rose-600 font-bold'}>
                                {hasHb ? `${sb.hyperbuild_attended}/${sb.hyperbuild_total} (${hbPct}%)` : 'Pending'}
                              </span>
                            </div>
                            <div className="w-full h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${!hasHb ? 'bg-slate-300' : hbPct >= 75 ? 'bg-indigo-500' : 'bg-rose-500'}`}
                                style={{ width: hasHb ? `${Math.min(100, hbPct)}%` : '0%' }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Debarment note if debarred */}
                        {isDebarred && sb.debarment_reason && (
                          <div className="p-2 rounded-lg bg-rose-100/60 dark:bg-rose-950/60 text-[10px] text-rose-800 dark:text-rose-300 font-medium">
                            {sb.debarment_reason}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* STAFF SUBJECT-LEVEL EXAM DEBARMENT REGISTRY */
            <>
              {/* Header & Filter Toolbar */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-rose-600" />
                      Subject Exam Debarment Registry (&lt; 75%)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Subject-by-subject debarment tracking enforcing the dual 75% rule (Academic Lectures & HyperBuild Activities).
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-500">Threshold:</span>
                      {[75, 65, 50].map((th) => (
                        <button
                          key={th}
                          onClick={() => setDebarmentThreshold(th)}
                          className={`px-3 py-1 rounded-xl text-xs font-black cursor-pointer ${
                            debarmentThreshold === th
                              ? 'bg-rose-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          &lt; {th}%
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleExportDebarmentExcel}
                      disabled={filteredDebarredStudents.length === 0}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5" /> Export Registry (.xlsx)
                    </button>
                  </div>
                </div>

                {/* Filter Controls Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  {/* Batch Filter */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                      Filter by Batch
                    </label>
                    <select
                      value={debarmentBatchId}
                      onChange={(e) => setDebarmentBatchId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                    >
                      <option value="">All Batches</option>
                      {batchesListData.map((b: any) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Subject Filter */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                      Filter by Subject
                    </label>
                    <select
                      value={debarmentSubjectId}
                      onChange={(e) => setDebarmentSubjectId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                    >
                      <option value="">All Subjects</option>
                      {subjectsListData.map((s: any) => (
                        <option key={s.id} value={s.id}>
                          {s.code ? `[${s.code}] ` : ''}{s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Category Filter */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                      Debarment Category
                    </label>
                    <select
                      value={debarmentCategory}
                      onChange={(e) => setDebarmentCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                    >
                      <option value="all">All Debarred Categories</option>
                      <option value="academic">🎓 Academic Lectures Only (&lt;75%)</option>
                      <option value="hyperbuild">⚡ HyperBuild Activities Only (&lt;75%)</option>
                      <option value="both">⚠️ Both Categories (&lt;75%)</option>
                    </select>
                  </div>

                  {/* Search Student */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                      Search Student / Subject
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={debarmentSearch}
                        onChange={(e) => setDebarmentSearch(e.target.value)}
                        placeholder="Name, PRN, Subject..."
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                      />
                      {debarmentSearch && (
                        <button
                          onClick={() => setDebarmentSearch('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Subject Debarment Registry Table */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3.5">Student</th>
                      <th className="p-3.5">Batch</th>
                      <th className="p-3.5">Subject</th>
                      <th className="p-3.5 text-center">Academic %</th>
                      <th className="p-3.5 text-center">HyperBuild %</th>
                      <th className="p-3.5 text-center">Debarred In</th>
                      <th className="p-3.5 text-center">Shortfall Target</th>
                      <th className="p-3.5 text-right">Exam Standing</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {debarmentLoading ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400">Evaluating subject-by-subject debarment standings...</td>
                      </tr>
                    ) : filteredDebarredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-emerald-600 font-bold">
                          ✓ No students are currently debarred under the selected filters!
                        </td>
                      </tr>
                    ) : (
                      filteredDebarredStudents.map((st: any) => {
                        const isBoth = st.debarred_category === 'both';
                        const isHbOnly = st.debarred_category === 'hyperbuild_only';

                        return (
                          <tr key={`${st.student_id}-${st.subject_id || 'all'}`} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                            <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                              <div>{st.student_name}</div>
                              <div className="text-[11px] font-mono text-slate-400">{st.student_prn}{st.roll_no ? ` · Roll: ${st.roll_no}` : ''}</div>
                            </td>
                            <td className="p-3.5 text-slate-700 dark:text-slate-300 font-medium">{st.batch_name}</td>
                            <td className="p-3.5">
                              <div className="font-bold text-slate-800 dark:text-slate-200">{st.subject_name || 'All Subjects'}</div>
                              {st.subject_code && (
                                <div className="text-[10px] font-mono text-slate-400">{st.subject_code}</div>
                              )}
                            </td>
                            <td className="p-3.5 text-center">
                              <span className={`font-black text-sm ${st.academic_percentage < debarmentThreshold ? 'text-rose-600' : 'text-emerald-600'}`}>
                                {st.academic_percentage}%
                              </span>
                            </td>
                            <td className="p-3.5 text-center">
                              <span className={`font-black text-sm ${st.hyperbuild_percentage < debarmentThreshold ? 'text-rose-600' : 'text-indigo-600 dark:text-indigo-400'}`}>
                                {st.hyperbuild_percentage}%
                              </span>
                            </td>
                            <td className="p-3.5 text-center">
                              {isBoth ? (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                                  ⚠️ Both Categories
                                </span>
                              ) : isHbOnly ? (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                                  ⚡ HyperBuild Only
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                  🎓 Academic Only
                                </span>
                              )}
                            </td>
                            <td className="p-3.5 text-center">
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                Shortfall: {st.shortfall_sessions} session(s)
                              </span>
                            </td>
                            <td className="p-3.5 text-right">
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-600 text-white uppercase shadow-xs">
                                DEBARRED FROM EXAM
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}


      {/* ═══════════════════════════════════════════════════════════════════════
          TAB: DAILY STUDENT CLASS ATTENDANCE LEDGER
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'daily_ledger' && (
        <div className="space-y-5 animate-fadeIn">
          {/* Top Header Card */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-500/20">
                <ClipboardList className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  Daily Student Class Attendance Ledger
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Granular View
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  View and audit every student's attendance for each class and each day with multi-parameter filtering and full Excel report export.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-stretch md:self-auto">
              <button
                type="button"
                onClick={() => refetchLedger()}
                className="p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                title="Refresh Ledger"
              >
                <RefreshCw className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsExportModalOpen(true)}
                className="flex-1 md:flex-initial px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>Export Report to Excel</span>
              </button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          {studentLedgerData?.summary && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
              {/* Total Records */}
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Class Records</span>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {studentLedgerData.summary.total_records.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Across {studentLedgerData.summary.unique_sessions} classes & {studentLedgerData.summary.unique_students} students
                </div>
              </div>

              {/* Attendance % */}
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Attendance Rate</span>
                  <span className={`text-xs font-black px-2 py-0.5 rounded-md ${
                    studentLedgerData.summary.attendance_percentage >= 75
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                  }`}>
                    {studentLedgerData.summary.attendance_percentage >= 75 ? 'Healthy' : 'Sub-75%'}
                  </span>
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {studentLedgerData.summary.attendance_percentage}%
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full ${
                      studentLedgerData.summary.attendance_percentage >= 75 ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(studentLedgerData.summary.attendance_percentage, 100)}%` }}
                  />
                </div>
              </div>

              {/* Present Records */}
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Present</span>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {studentLedgerData.summary.present_count.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {studentLedgerData.summary.total_records > 0
                    ? `${Math.round((studentLedgerData.summary.present_count / studentLedgerData.summary.total_records) * 100)}% of records`
                    : '0%'}
                </div>
              </div>

              {/* Absent Records */}
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Absent</span>
                <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                  {studentLedgerData.summary.absent_count.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {studentLedgerData.summary.total_records > 0
                    ? `${Math.round((studentLedgerData.summary.absent_count / studentLedgerData.summary.total_records) * 100)}% of records`
                    : '0%'}
                </div>
              </div>

              {/* Late / Excused / OD */}
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs col-span-2 lg:col-span-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Late / Excused / OD</span>
                <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                  {(
                    studentLedgerData.summary.late_count +
                    studentLedgerData.summary.excused_count +
                    studentLedgerData.summary.od_count
                  ).toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {studentLedgerData.summary.late_count} Late • {studentLedgerData.summary.excused_count} Excused • {studentLedgerData.summary.od_count} OD
                </div>
              </div>
            </div>
          )}

          {/* Filtering & Search Toolbar */}
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            {/* Quick Date Presets */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Date Presets:
                </span>
                {[
                  { id: 'today', label: 'Today' },
                  { id: 'yesterday', label: 'Yesterday' },
                  { id: 'week', label: 'Last 7 Days' },
                  { id: 'month', label: 'Last 30 Days' },
                  { id: 'all', label: 'All Dates' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePresetDate(p.id as any)}
                    className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs font-bold transition-colors cursor-pointer"
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {(ledgerStartDate || ledgerEndDate || ledgerBatchId || ledgerSubjectId || ledgerCategory || ledgerStatus || ledgerSearch) && (
                <button
                  type="button"
                  onClick={handleResetLedgerFilters}
                  className="text-xs font-bold text-rose-600 hover:underline cursor-pointer flex items-center gap-1"
                >
                  <X className="h-3.5 w-3.5" /> Reset Filters
                </button>
              )}
            </div>

            {/* Filter Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
              {/* Start Date */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={ledgerStartDate}
                  onChange={(e) => {
                    setLedgerStartDate(e.target.value);
                    setLedgerPage(1);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={ledgerEndDate}
                  onChange={(e) => {
                    setLedgerEndDate(e.target.value);
                    setLedgerPage(1);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>

              {/* Batch Filter */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Batch
                </label>
                <select
                  value={ledgerBatchId}
                  onChange={(e) => {
                    setLedgerBatchId(e.target.value);
                    setLedgerPage(1);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                >
                  <option value="">All Batches</option>
                  {batchesListData.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject Filter */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Subject
                </label>
                <select
                  value={ledgerSubjectId}
                  onChange={(e) => {
                    setLedgerSubjectId(e.target.value);
                    setLedgerPage(1);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                >
                  <option value="">All Subjects</option>
                  {subjectsListData.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.code ? `[${s.code}] ` : ''}{s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Category
                </label>
                <select
                  value={ledgerCategory}
                  onChange={(e) => {
                    setLedgerCategory(e.target.value);
                    setLedgerPage(1);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                >
                  <option value="">All Categories</option>
                  <option value="academic">🎓 Academic Lectures</option>
                  <option value="hyperbuild">⚡ HyperBuild Activities</option>
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Attendance Status
                </label>
                <select
                  value={ledgerStatus}
                  onChange={(e) => {
                    setLedgerStatus(e.target.value);
                    setLedgerPage(1);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                >
                  <option value="">All Statuses</option>
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="late">Late</option>
                  <option value="excused">Excused / Leave</option>
                  <option value="od_duty">On Duty (OD)</option>
                </select>
              </div>

              {/* Student Search */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Search Student
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={ledgerSearch}
                    onChange={(e) => {
                      setLedgerSearch(e.target.value);
                      setLedgerPage(1);
                    }}
                    placeholder="Name, PRN, Email..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                  />
                  {ledgerSearch && (
                    <button
                      onClick={() => setLedgerSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Granular Attendance Ledger Table */}
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    <th className="p-3.5 pl-5">Student Information</th>
                    <th className="p-3.5">Batch / Program</th>
                    <th className="p-3.5">Class Date & Slot</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5">Subject & Activity / Topic</th>
                    <th className="p-3.5">Faculty & Venue</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5">Timestamp / Notes</th>
                    <th className="p-3.5 pr-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {studentLedgerLoading ? (
                    <tr>
                      <td colSpan={9} className="p-12 text-center text-slate-400">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-500" />
                        <span className="text-xs font-bold">Loading student class attendance ledger...</span>
                      </td>
                    </tr>
                  ) : studentLedgerError ? (
                    <tr>
                      <td colSpan={9} className="p-12 text-center">
                        <AlertTriangle className="h-8 w-8 text-rose-500 mx-auto mb-2" />
                        <p className="text-sm font-bold text-rose-900 dark:text-rose-200">Unable to load attendance ledger</p>
                        <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 max-w-md mx-auto">
                          {(studentLedgerError as any)?.response?.data?.detail || (studentLedgerError as Error).message || 'Server error occurred'}
                        </p>
                        <button
                          type="button"
                          onClick={() => refetchLedger()}
                          className="mt-3 px-4 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 cursor-pointer"
                        >
                          Retry
                        </button>
                      </td>
                    </tr>
                  ) : !studentLedgerData?.items || studentLedgerData.items.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-12 text-center text-slate-400">
                        <ClipboardList className="h-8 w-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No attendance records found</p>
                        <p className="text-xs text-slate-400 mt-1">Try expanding your date range or adjusting the filters above.</p>
                        <button
                          type="button"
                          onClick={handleResetLedgerFilters}
                          className="mt-3 px-4 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-xs font-bold cursor-pointer"
                        >
                          Clear Filters
                        </button>
                      </td>
                    </tr>
                  ) : (
                    studentLedgerData.items.map((item: any) => {
                      const stLower = (item.status || '').toLowerCase();
                      const isHb = item.category === 'HyperBuild Activity' || item.session_type === 'hyperbuild' || Boolean(item.activity_no);

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                          {/* Student Info */}
                          <td className="p-3.5 pl-5">
                            <div className="font-extrabold text-slate-900 dark:text-white">
                              {item.student_name}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {item.student_prn || 'N/A'}
                              </span>
                              {item.roll_no && (
                                <span className="text-[10px] text-slate-400 font-semibold">
                                  #{item.roll_no}
                                </span>
                              )}
                            </div>
                            {item.official_email && (
                              <div className="text-[10px] text-slate-400 truncate max-w-[180px] mt-0.5">
                                {item.official_email}
                              </div>
                            )}
                          </td>

                          {/* Batch / Program */}
                          <td className="p-3.5">
                            <div className="font-bold text-slate-800 dark:text-slate-200">
                              {item.batch_name || 'N/A'}
                            </div>
                            <div className="text-[10.5px] text-slate-400">
                              {item.program_name} {item.division ? `• Div ${item.division}` : ''}
                            </div>
                          </td>

                          {/* Class Date & Slot */}
                          <td className="p-3.5">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                              {item.session_date}
                            </div>
                            <div className="text-[11px] text-slate-500 font-semibold">
                              {item.day_of_week}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1 mt-0.5">
                              <Clock className="h-3 w-3" />
                              {item.time_slot || `${item.start_time} - ${item.end_time}`}
                            </div>
                          </td>

                          {/* Category */}
                          <td className="p-3.5 whitespace-nowrap">
                            {isHb ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1 w-fit">
                                <span>⚡</span> HyperBuild
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1 w-fit">
                                <span>🎓</span> Academic
                              </span>
                            )}
                          </td>

                          {/* Subject & Activity / Topic */}
                          <td className="p-3.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                                {item.subject_code || 'HB'}
                              </span>
                              <span className="font-bold text-slate-900 dark:text-white truncate max-w-[200px]" title={item.subject_name}>
                                {item.subject_name}
                              </span>
                            </div>
                            {item.activity_title ? (
                              <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold truncate max-w-[220px] mt-0.5" title={item.activity_title}>
                                Act #{item.activity_no}: {item.activity_title}
                              </div>
                            ) : item.topic_delivered ? (
                              <div className="text-[10.5px] text-slate-500 truncate max-w-[220px] mt-0.5" title={item.topic_delivered}>
                                {item.topic_delivered}
                              </div>
                            ) : null}
                          </td>

                          {/* Faculty & Venue */}
                          <td className="p-3.5">
                            <div className="font-bold text-slate-800 dark:text-slate-200">
                              {item.faculty_name || 'Assigned Faculty'}
                            </div>
                            <div className="text-[10.5px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <MapPin className="h-3 w-3" />
                              {item.venue || 'Classroom'}
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="p-3.5 text-center">
                            {stLower === 'present' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                <CheckCircle2 className="h-3 w-3" /> Present
                              </span>
                            )}
                            {stLower === 'absent' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                <X className="h-3 w-3" /> Absent
                              </span>
                            )}
                            {stLower === 'late' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                <Clock className="h-3 w-3" /> Late
                              </span>
                            )}
                            {['excused', 'leave_approved'].includes(stLower) && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                <ShieldCheck className="h-3 w-3" /> Excused
                              </span>
                            )}
                            {['od_duty', 'on_duty'].includes(stLower) && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-cyan-100 text-cyan-800 dark:bg-cyan-950/80 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                                <CheckCircle2 className="h-3 w-3" /> On Duty
                              </span>
                            )}
                            {!['present', 'absent', 'late', 'excused', 'leave_approved', 'od_duty', 'on_duty'].includes(stLower) && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                {item.status}
                              </span>
                            )}
                          </td>

                          {/* Timestamp / Notes */}
                          <td className="p-3.5">
                            <div className="text-[10.5px] font-mono text-slate-500">
                              {item.marked_at ? new Date(item.marked_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                            </div>
                            {item.remarks && (
                              <div className="text-[10px] text-slate-400 italic truncate max-w-[150px] mt-0.5">
                                "{item.remarks}"
                              </div>
                            )}
                          </td>

                          {/* Action */}
                          <td className="p-3.5 pr-5 text-right">
                            <button
                              type="button"
                              onClick={() => openCorrectionModal({
                                attendance_id: item.attendance_id || item.id,
                                sessionId: item.session_id,
                                studentId: item.student_id,
                                activityId: item.activity_id,
                                studentName: item.student_name,
                                studentPrn: item.student_prn,
                                subjectName: item.subject_name,
                                sessionDate: item.session_date,
                                sessionTime: item.time_slot,
                                venue: item.venue,
                                currentStatus: item.status,
                              })}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                            >
                              Dispute / Correct
                            </button>
                          </td>

                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {studentLedgerData && studentLedgerData.total > 0 && (
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                  <span>
                    Showing <strong className="text-slate-900 dark:text-white">{((ledgerPage - 1) * ledgerLimit) + 1}</strong> to{' '}
                    <strong className="text-slate-900 dark:text-white">
                      {Math.min(ledgerPage * ledgerLimit, studentLedgerData.total)}
                    </strong>{' '}
                    of <strong className="text-slate-900 dark:text-white">{studentLedgerData.total.toLocaleString()}</strong> records
                  </span>

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Rows:</span>
                    <select
                      value={ledgerLimit}
                      onChange={(e) => {
                        setLedgerLimit(Number(e.target.value));
                        setLedgerPage(1);
                      }}
                      className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={250}>250</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={ledgerPage <= 1}
                    onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Previous
                  </button>

                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 px-2">
                    Page {ledgerPage} of {Math.ceil(studentLedgerData.total / ledgerLimit) || 1}
                  </span>

                  <button
                    type="button"
                    disabled={ledgerPage * ledgerLimit >= studentLedgerData.total}
                    onClick={() => setLedgerPage((p) => p + 1)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    Next <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
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
              const currentSt = attendanceMap[st.student_id] ?? st.status ?? '';
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
                          : currentSt === 'excused'
                          ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                          : currentSt === 'od_duty'
                          ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      Status: {currentSt ? currentSt.toUpperCase() : 'UNMARKED'}
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
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">Review Dispute Request</h4>
                <p className="text-[11px] text-slate-500">Tiered Verification: Course Faculty &amp; Academic Administration</p>
              </div>
              <button onClick={() => setReviewingCorrection(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Student & Session Summary */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-1">
                <div><span className="font-semibold text-slate-500">Student:</span> <span className="font-bold text-slate-900 dark:text-white">{reviewingCorrection.student_name}</span> <span className="font-mono text-[10px] text-slate-400">({reviewingCorrection.student_prn})</span></div>
                <div><span className="font-semibold text-slate-500">Subject:</span> {reviewingCorrection.subject_name} {reviewingCorrection.subject_code && `(${reviewingCorrection.subject_code})`}</div>
                <div><span className="font-semibold text-slate-500">Session:</span> {reviewingCorrection.session_date} {reviewingCorrection.session_time && `• ${reviewingCorrection.session_time}`}</div>
                <div><span className="font-semibold text-slate-500">Dispute:</span> <span className="text-rose-600 uppercase font-bold">{reviewingCorrection.current_status}</span> &rarr; <span className="text-emerald-600 uppercase font-bold">{reviewingCorrection.requested_status}</span></div>
                <div className="pt-1 text-slate-600 dark:text-slate-300"><span className="font-semibold text-slate-500">Student Reason:</span> <em>"{reviewingCorrection.reason}"</em></div>

                {reviewingCorrection.activities_details && reviewingCorrection.activities_details.length > 0 && (
                  <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700">
                    <span className="font-semibold text-slate-500 block mb-1">Disputed Activities ({reviewingCorrection.activities_details.length}):</span>
                    <div className="flex flex-wrap gap-1.5">
                      {reviewingCorrection.activities_details.map((act: any) => (
                        <div key={act.id} className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-[10.5px]">
                          <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300">Act #{act.activity_no}</span>: {act.title}
                          <span className="ml-1 px-1 py-0.2 rounded bg-white dark:bg-slate-900 text-[9px] font-semibold text-slate-600 dark:text-slate-400">
                            {act.subject_code || act.subject_name}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">
                      ✓ Approval verifies presence specifically for these {reviewingCorrection.activities_details.length} activity subject(s).
                    </p>
                  </div>
                )}
              </div>

              {/* Dual Approval Progress Status Card */}
              <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-xl space-y-2">
                <div className="font-bold text-[11px] text-indigo-900 dark:text-indigo-200 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
                  Dual-Approval Verification Pipeline
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <div className="font-semibold text-slate-500 text-[10px]">Tier 1: Course Faculty</div>
                    <div className="mt-0.5 font-bold">
                      {reviewingCorrection.faculty_action === 'approved' ? (
                        <span className="text-emerald-600">✓ Approved</span>
                      ) : reviewingCorrection.faculty_action === 'rejected' ? (
                        <span className="text-rose-600">✗ Rejected</span>
                      ) : (
                        <span className="text-amber-600">⏳ Pending Sign-off</span>
                      )}
                    </div>
                    {reviewingCorrection.faculty_approver_name && (
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">By: {reviewingCorrection.faculty_approver_name}</div>
                    )}
                    {reviewingCorrection.faculty_remarks && (
                      <div className="text-[10px] text-slate-500 italic mt-0.5 truncate">"{reviewingCorrection.faculty_remarks}"</div>
                    )}
                  </div>

                  <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <div className="font-semibold text-slate-500 text-[10px]">Tier 2: Academic Admin</div>
                    <div className="mt-0.5 font-bold">
                      {reviewingCorrection.admin_action === 'approved' ? (
                        <span className="text-emerald-600">✓ Approved</span>
                      ) : reviewingCorrection.admin_action === 'rejected' ? (
                        <span className="text-rose-600">✗ Rejected</span>
                      ) : (
                        <span className="text-amber-600">⏳ Pending Review</span>
                      )}
                    </div>
                    {reviewingCorrection.admin_approver_name && (
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">By: {reviewingCorrection.admin_approver_name}</div>
                    )}
                    {reviewingCorrection.admin_remarks && (
                      <div className="text-[10px] text-slate-500 italic mt-0.5 truncate">"{reviewingCorrection.admin_remarks}"</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Reviewing As Role Selector (if user has multiple roles) */}
              {isFaculty && isAdmin && (
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-between">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">Submit Review As:</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setReviewAsRole('faculty')}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                        reviewAsRole === 'faculty'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border'
                      }`}
                    >
                      Course Faculty
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewAsRole('admin')}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                        reviewAsRole === 'admin'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border'
                      }`}
                    >
                      Academic Admin
                    </button>
                  </div>
                </div>
              )}

              {/* Informative Guidance Alert on Dual-Approval Policy */}
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-[11px] text-amber-800 dark:text-amber-300">
                {reviewAsRole === 'admin' && reviewingCorrection.faculty_action !== 'approved' && (
                  <p>
                    ⚠️ <strong>Notice:</strong> Faculty review is still pending. Your administrative approval will be saved, but the student's attendance record and cumulative matrix will only update once the Course Faculty also grants approval.
                  </p>
                )}
                {reviewAsRole === 'faculty' && reviewingCorrection.admin_action !== 'approved' && (
                  <p>
                    ℹ️ <strong>Notice:</strong> Your faculty review will be recorded. The attendance correction will be officially applied to the student's records once Academic Administration completes final review.
                  </p>
                )}
                {((reviewAsRole === 'admin' && reviewingCorrection.faculty_action === 'approved') ||
                  (reviewAsRole === 'faculty' && reviewingCorrection.admin_action === 'approved')) && (
                  <p className="text-emerald-800 dark:text-emerald-300">
                    ✓ <strong>Final Sign-off:</strong> The other party has already approved! Submitting your approval now will complete the dual-approval requirements, update the student's attendance record, and dispatch a resolution confirmation email.
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Decision</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer font-bold text-emerald-600">
                    <input
                      type="radio"
                      name="reviewAction"
                      value="approved"
                      checked={reviewAction === 'approved'}
                      onChange={() => setReviewAction('approved')}
                      className="accent-emerald-600"
                    />
                    Approve Request
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
                    Reject Request
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Review Remarks / Rationale</label>
                <textarea
                  rows={2}
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                  placeholder="Enter decision rationale or justification..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              {reviewError && <p className="text-rose-600 text-xs font-bold">{reviewError}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setReviewingCorrection(null)}
                className="px-4 py-2 rounded-xl border text-slate-600 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (reviewAsRole === 'faculty') {
                    facultyReviewMutation.mutate({ id: reviewingCorrection.id, action: reviewAction, remarks: reviewRemarks });
                  } else {
                    adminReviewMutation.mutate({ id: reviewingCorrection.id, action: reviewAction, remarks: reviewRemarks });
                  }
                }}
                disabled={facultyReviewMutation.isPending || adminReviewMutation.isPending}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs disabled:opacity-50 cursor-pointer shadow-sm hover:bg-indigo-700"
              >
                {facultyReviewMutation.isPending || adminReviewMutation.isPending ? 'Submitting...' : `Submit as ${reviewAsRole === 'faculty' ? 'Faculty' : 'Admin'}`}
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
          sessionId={selectedAttendanceForCorrection.sessionId || selectedAttendanceForCorrection.session_id}
          initialActivityId={selectedAttendanceForCorrection.activityId || selectedAttendanceForCorrection.activity_id}
          studentId={selectedAttendanceForCorrection.studentId || selectedAttendanceForCorrection.student_id}
          studentName={selectedAttendanceForCorrection.studentName || selectedAttendanceForCorrection.student_name}
          studentPrn={selectedAttendanceForCorrection.studentPrn || selectedAttendanceForCorrection.student_prn}
          subjectName={selectedAttendanceForCorrection.subjectName || selectedAttendanceForCorrection.subject_name}
          sessionDate={selectedAttendanceForCorrection.sessionDate || selectedAttendanceForCorrection.session_date}
          sessionTime={selectedAttendanceForCorrection.sessionTime || selectedAttendanceForCorrection.session_time}
          venue={selectedAttendanceForCorrection.venue}
          currentStatus={selectedAttendanceForCorrection.currentStatus || selectedAttendanceForCorrection.status || 'absent'}
        />
      )}

      {/* ─── EXPORT ATTENDANCE TO EXCEL MODAL ──────────────────────────────── */}
      <ExportAttendanceExcelModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        filters={{
          startDate: ledgerStartDate,
          endDate: ledgerEndDate,
          batchId: ledgerBatchId,
          subjectId: ledgerSubjectId,
          sessionId: ledgerSessionId,
          category: ledgerCategory,
          status: ledgerStatus,
          search: ledgerSearch,
        }}
        totalMatchingRecords={studentLedgerData?.total || 0}
        previewItems={studentLedgerData?.items || []}
      />
    </div>
  );
};

