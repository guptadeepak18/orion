import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserCheck,
  Plus,
  Search,
  Pencil,
  Trash2,
  FileText,
  Award,
  Calendar,
  GraduationCap,
  Phone,
  Mail,
  HeartPulse,
  ShieldAlert,
  BookOpen,
  X,
  User,
  Users,
  Briefcase,
  CheckCircle2,
  Download,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../../components/Card';
import { DataTable, Column } from '../../components/DataTable';
import { useRoleAccess } from '../../lib/useRoleAccess';
import { StudentExportModal } from '../../components/StudentExportModal';
import { StudentRegistrationsPage } from './StudentRegistrationsPage';

interface Program {
  id: string;
  name: string;
  code: string;
}

interface Batch {
  id: string;
  name: string;
  code: string;
}

interface Division {
  id: string;
  batch_id: string;
  name: string;
  code: string;
}

interface Student {
  id: string;
  user_id?: string;
  first_name: string;
  last_name?: string;
  full_name: string;
  father_name: string;
  mother_name: string;
  mobile_number: string;
  email_official: string;
  email_personal: string;
  alternate_contact_number?: string;
  emergency_contact_number: string;
  emergency_contact_name: string;
  emergency_contact_relation: string;
  blood_group: string;
  prn_number: string;
  program_id?: string;
  batch_id?: string;
  division_ids?: string[];
  division_names?: string[];
  program_name?: string;
  batch_name?: string;
  trimester: number;
  ug_degree: string;
  ug_score_type: 'percentage' | 'cgpa';
  ug_score: number;
  specialization_major: string;
  specialization_minor: string;
  gender?: string;
  roll_no: string;
  enrollment_no: string;
  email: string;
  phone?: string;
  cgpa: number;
  attendance_percentage: number;
  total_sessions_conducted?: number;
  total_sessions_attended?: number;
  status: string;
  is_active: boolean;
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const TRIMESTERS = [1, 2, 3, 4, 5, 6];
const SPECIALIZATIONS = [
  'Marketing',
  'Finance',
  'Human Resources',
  'Research & Business Analytics',
];
const MAJOR_SPECIALIZATIONS = SPECIALIZATIONS;
const MINOR_SPECIALIZATIONS = SPECIALIZATIONS;
const UG_DEGREES = [
  'B.Tech / B.E.',
  'BBA / BMS',
  'B.Com (Hons / General)',
  'B.Sc (Comp Sci / IT / Math)',
  'BCA',
  'BA (Economics / Arts)',
  'Other Bachelor Degree',
];

export const StudentsPage: React.FC = () => {
  const { canManageStudents, isStudent, isAdmin, isCoordinator } = useRoleAccess();
  const canViewRegistrationApprovals = !isStudent && (isAdmin || isCoordinator);
  const [activeSection, setActiveSection] = useState<'directory' | 'approvals'>('directory');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProgramFilter, setSelectedProgramFilter] = useState('');
  const [selectedBatchFilter, setSelectedBatchFilter] = useState('');

  // Modals state
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'personal' | 'contact' | 'academic' | 'ug'>('personal');
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedStudentForReport, setSelectedStudentForReport] = useState<Student | null>(null);

  // 20 Student Form Inputs
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [emailOfficial, setEmailOfficial] = useState('');
  const [emailPersonal, setEmailPersonal] = useState('');
  const [alternateContact, setAlternateContact] = useState('');
  const [emergencyContactNumber, setEmergencyContactNumber] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactRelation, setEmergencyContactRelation] = useState('Parent');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [gender, setGender] = useState('Male');
  const [prnNumber, setPrnNumber] = useState('');
  const [programId, setProgramId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [selectedDivisionIds, setSelectedDivisionIds] = useState<string[]>([]);
  const [trimester, setTrimester] = useState(1);
  const [ugDegree, setUgDegree] = useState('BBA / BMS');
  const [ugScoreType, setUgScoreType] = useState<'percentage' | 'cgpa'>('cgpa');
  const [ugScore, setUgScore] = useState<number | string>(8.0);
  const [specMajor, setSpecMajor] = useState('Marketing');
  const [specMinor, setSpecMinor] = useState('Finance');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const queryClient = useQueryClient();

  // Queries
  const { data: programs } = useQuery({
    queryKey: ['programs'],
    queryFn: async () => {
      const res = await api.get('/academic/programs');
      return res.data.data as Program[];
    },
  });

  const { data: batches } = useQuery({
    queryKey: ['batches'],
    queryFn: async () => {
      const res = await api.get('/academic/batches');
      return res.data.data as Batch[];
    },
  });

  const { data: programDivisions } = useQuery({
    queryKey: ['divisions-for-program', programId],
    queryFn: async () => {
      if (!programId) return [];
      const res = await api.get(`/academic/divisions?program_id=${programId}`);
      return res.data.data as Division[];
    },
    enabled: !!programId,
  });

  const { data: studentsData, isLoading } = useQuery({
    queryKey: ['students', selectedProgramFilter, selectedBatchFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedProgramFilter) params.append('program_id', selectedProgramFilter);
      if (selectedBatchFilter) params.append('batch_id', selectedBatchFilter);
      if (searchQuery) params.append('q', searchQuery);
      const res = await api.get(`/students?${params.toString()}`);
      return res.data.data as Student[];
    },
  });

  // Mutations
  const createStudentMutation = useMutation({
    mutationFn: async (payload: Partial<Student>) => {
      const res = await api.post('/students', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      closeModal();
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.error?.message || err?.response?.data?.detail || 'Failed to create student');
    },
  });

  const updateStudentMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<Student> }) => {
      const res = await api.put(`/students/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      closeModal();
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.error?.message || err?.response?.data?.detail || 'Failed to update student');
    },
  });

  const deleteStudentMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/students/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (err: any) => {
      alert(err?.response?.data?.error?.message || 'Failed to delete student');
    },
  });

  // Handlers
  const closeModal = () => {
    setShowModal(false);
    setEditingStudent(null);
    setActiveTab('personal');
    setFirstName('');
    setLastName('');
    setFatherName('');
    setMotherName('');
    setMobileNumber('');
    setEmailOfficial('');
    setEmailPersonal('');
    setAlternateContact('');
    setEmergencyContactNumber('');
    setEmergencyContactName('');
    setEmergencyContactRelation('Parent');
    setBloodGroup('O+');
    setGender('Male');
    setPrnNumber('');
    setProgramId('');
    setBatchId('');
    setSelectedDivisionIds([]);
    setTrimester(1);
    setUgDegree('BBA / BMS');
    setUgScoreType('cgpa');
    setUgScore(8.0);
    setSpecMajor('Marketing');
    setSpecMinor('Finance');
    setErrorMsg(null);
  };

  const openCreateModal = () => {
    closeModal();
    if (programs && programs.length > 0) setProgramId(programs[0].id);
    if (batches && batches.length > 0) setBatchId(batches[0].id);
    setShowModal(true);
  };

  const openEditModal = (st: Student) => {
    closeModal();
    setEditingStudent(st);
    setFirstName(st.first_name || (st.full_name ? st.full_name.split(' ')[0] : ''));
    setLastName(st.last_name || (st.full_name && st.full_name.includes(' ') ? st.full_name.split(' ').slice(1).join(' ') : ''));
    setFatherName(st.father_name || '');
    setMotherName(st.mother_name || '');
    setMobileNumber(st.mobile_number || st.phone || '');
    setEmailOfficial(st.email_official || st.email || '');
    setEmailPersonal(st.email_personal || st.email || '');
    setAlternateContact(st.alternate_contact_number || '');
    setEmergencyContactNumber(st.emergency_contact_number || '');
    setEmergencyContactName(st.emergency_contact_name || '');
    setEmergencyContactRelation(st.emergency_contact_relation || 'Parent');
    setBloodGroup(st.blood_group || 'O+');
    setGender(st.gender || 'Male');
    setPrnNumber(st.prn_number || st.roll_no || '');
    setProgramId(st.program_id || (programs?.[0]?.id || ''));
    setBatchId(st.batch_id || (batches?.[0]?.id || ''));
    setSelectedDivisionIds(st.division_ids || []);
    setTrimester(st.trimester || 1);
    setUgDegree(st.ug_degree || 'BBA / BMS');
    setUgScoreType(st.ug_score_type || 'cgpa');
    setUgScore(st.ug_score ?? 8.0);
    setSpecMajor(st.specialization_major || 'Marketing');
    setSpecMinor(st.specialization_minor || 'Finance');
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validation for Mandatory fields
    if (!firstName.trim()) {
      setErrorMsg('First Name is mandatory.');
      setActiveTab('personal');
      return;
    }
    if (!fatherName.trim() || !motherName.trim()) {
      setErrorMsg("Father's Name and Mother's Name are mandatory.");
      setActiveTab('personal');
      return;
    }
    if (!bloodGroup.trim() || !prnNumber.trim()) {
      setErrorMsg('Blood Group and PRN Number are mandatory.');
      setActiveTab('personal');
      return;
    }
    if (!mobileNumber.trim() || !emailOfficial.trim() || !emailPersonal.trim()) {
      setErrorMsg('Primary Contact details (Mobile, Official Email, Personal Email) are mandatory.');
      setActiveTab('contact');
      return;
    }
    if (!emergencyContactNumber.trim() || !emergencyContactName.trim() || !emergencyContactRelation.trim()) {
      setErrorMsg('All Emergency Contact details are mandatory.');
      setActiveTab('contact');
      return;
    }
    if (!programId || !batchId) {
      setErrorMsg('Program and Batch selection are mandatory.');
      setActiveTab('academic');
      return;
    }
    if (!specMajor.trim() || !specMinor.trim()) {
      setErrorMsg('Major and Minor Specializations are mandatory.');
      setActiveTab('academic');
      return;
    }
    if (!ugDegree.trim() || ugScore === '' || Number(ugScore) < 0) {
      setErrorMsg('Undergraduate Degree and a valid Score are mandatory.');
      setActiveTab('ug');
      return;
    }

    const payload: Partial<Student> = {
      first_name: firstName.trim(),
      last_name: lastName.trim() || undefined,
      father_name: fatherName.trim(),
      mother_name: motherName.trim(),
      gender: gender.trim(),
      mobile_number: mobileNumber.trim(),
      email_official: emailOfficial.trim(),
      email_personal: emailPersonal.trim(),
      alternate_contact_number: alternateContact.trim() || undefined,
      emergency_contact_number: emergencyContactNumber.trim(),
      emergency_contact_name: emergencyContactName.trim(),
      emergency_contact_relation: emergencyContactRelation.trim(),
      blood_group: bloodGroup.trim(),
      prn_number: prnNumber.trim(),
      program_id: programId,
      batch_id: batchId,
      division_ids: selectedDivisionIds,
      trimester: Number(trimester),
      ug_degree: ugDegree.trim(),
      ug_score_type: ugScoreType,
      ug_score: Number(ugScore),
      specialization_major: specMajor.trim(),
      specialization_minor: specMinor.trim(),
    };

    if (editingStudent) {
      updateStudentMutation.mutate({ id: editingStudent.id, payload });
    } else {
      createStudentMutation.mutate(payload);
    }
  };

  // Metrics
  const totalStudents = studentsData?.length || 0;
  const avgCgpa =
    totalStudents > 0
      ? (studentsData!.reduce((acc, s) => acc + (s.cgpa || 0), 0) / totalStudents).toFixed(2)
      : '0.00';
  const avgAttendance =
    totalStudents > 0
      ? (studentsData!.reduce((acc, s) => acc + (s.attendance_percentage || 0), 0) / totalStudents).toFixed(1)
      : '0.0';

  // Columns Definition
  const columns: Column<Student>[] = [
    {
      header: 'PRN Number',
      accessor: (r) => (
        <div>
          <span className="font-mono text-cyan-700 dark:text-cyan-400 font-bold">
            {r.prn_number || r.roll_no}
          </span>
          <span className="ml-2 inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {r.blood_group || 'O+'}
          </span>
          <span className="ml-1 inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/40">
            {r.gender || 'Male'}
          </span>
        </div>
      ),
    },
    {
      header: 'Student Name & Contacts',
      accessor: (r) => (
        <div>
          <p className="font-bold text-slate-900 dark:text-slate-100">
            {r.full_name || `${r.first_name} ${r.last_name || ''}`.trim()}
          </p>
          <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            <span>{r.email_official || r.email}</span>
            <span>•</span>
            <span>{r.mobile_number || r.phone || 'N/A'}</span>
          </div>
        </div>
      ),
    },
    {
      header: 'Program & Trimester',
      accessor: (r) => (
        <div>
          <span className="font-medium text-slate-800 dark:text-slate-200">
            {r.program_name || 'PGDM Core'}
          </span>
          <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            <span className="font-mono">{r.batch_name || 'Batch 2026'}</span>
            <span className="px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40 text-[10px] font-bold">
              Trim {r.trimester || 1}
            </span>
          </div>
          {r.division_names && r.division_names.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {r.division_names.map((dname, idx) => (
                <span key={idx} className="px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40 text-[10px] font-semibold">
                  {dname}
                </span>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Specializations',
      accessor: (r) => (
        <div>
          <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-cyan-50 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/40">
            {r.specialization_major || 'Marketing'}
          </span>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Minor: {r.specialization_minor || 'Digital Mkt'}
          </p>
        </div>
      ),
    },
    {
      header: 'UG Background',
      accessor: (r) => (
        <div>
          <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
            {r.ug_degree || 'BBA'}
          </p>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            Score: {r.ug_score ?? 8.0} {r.ug_score_type === 'percentage' ? '%' : 'CGPA'}
          </span>
        </div>
      ),
    },
    {
      header: 'Attendance',
      accessor: (r) => {
        const pct = r.attendance_percentage ?? 100;
        const conducted = r.total_sessions_conducted ?? 0;
        const attended = r.total_sessions_attended ?? 0;
        const hasData = conducted > 0;
        return (
          <div className="flex flex-col gap-0.5">
            <span
              className={`font-semibold px-2 py-0.5 rounded-md border text-xs ${
                pct >= 85
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30'
                  : pct >= 75
                  ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30'
                  : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30'
              }`}
            >
              {pct.toFixed(1)}%
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              {hasData ? `${attended}/${conducted} sessions` : 'Auto-tracked'}
            </span>
          </div>
        );
      },
    },
    {
      header: 'Actions',
      accessor: (r) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setSelectedStudentForReport(r)}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-cyan-50 text-cyan-700 border border-cyan-200 hover:bg-cyan-100 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/30 dark:hover:bg-cyan-500/20 flex items-center space-x-1 transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Profile Dossier</span>
          </button>
          {canManageStudents && (
            <>
              <button
                onClick={() => openEditModal(r)}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                title="Edit Student"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete student record for ${r.full_name || r.first_name}?`))
                    deleteStudentMutation.mutate(r.id);
                }}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                title="Delete Student"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {canViewRegistrationApprovals && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-2xl inline-flex items-center space-x-1">
          <button
            type="button"
            onClick={() => setActiveSection('directory')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
              activeSection === 'directory'
                ? 'bg-cyan-600 dark:bg-cyan-500 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Student Directory
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('approvals')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
              activeSection === 'approvals'
                ? 'bg-cyan-600 dark:bg-cyan-500 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Registration Approvals
          </button>
        </div>
      )}

      {activeSection === 'approvals' ? (
        <StudentRegistrationsPage embedded />
      ) : (
        <>
      {/* Page Title & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight gradient-text">
            {isStudent ? 'My Student Academic Portal' : 'Student Directory & Academic Records'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {isStudent
              ? 'View your institutional transcript, session attendance breakdown, and profile dossier.'
              : 'Record and manage comprehensive student profiles (personal, parentage, emergency, academic trimester, and UG background).'}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setExportOpen(true)}
            disabled={!studentsData || studentsData.length === 0}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 disabled:opacity-50 transition-colors shadow-sm"
            title="Export student directory to Excel (.xlsx)"
          >
            <Download className="h-4 w-4" />
            <span>Export XLSX</span>
          </button>
          {canManageStudents && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/35 transition-all duration-200"
            >
              <Plus className="h-4 w-4" />
              <span>Enroll New Student</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <Card
          title="Enrolled Students"
          subtitle="Directory Total"
          action={<UserCheck className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />}
        >
          <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{totalStudents}</p>
        </Card>
        <Card
          title="Active Batches"
          subtitle="Program Setup"
          action={<GraduationCap className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
        >
          <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{batches?.length || 1}</p>
        </Card>
        <Card
          title="Avg Attendance"
          subtitle="Overall Metric"
          action={<Calendar className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
        >
          <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{avgAttendance}%</p>
        </Card>
        <Card
          title="Avg CGPA"
          subtitle="Transcript Metric"
          action={<Award className="h-5 w-5 text-sky-600 dark:text-sky-400" />}
        >
          <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{avgCgpa}</p>
        </Card>
      </div>

      {/* Search & Filter Bar */}
      <Card title="Student Directory Search & Filters">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by PRN, student name, email, specialization, or parent name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex items-center space-x-3 w-full md:w-auto">
            <select
              value={selectedProgramFilter}
              onChange={(e) => setSelectedProgramFilter(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="">All Programs</option>
              {programs?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>

            <select
              value={selectedBatchFilter}
              onChange={(e) => setSelectedBatchFilter(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="">All Batches</option>
              {batches?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Directory Table */}
      <Card title="Student Directory Records">
        {isLoading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-4">Loading student records...</p>
        ) : (
          <DataTable
            columns={columns}
            data={studentsData || []}
            keyExtractor={(r) => r.id}
            emptyMessage="No students found matching the selected criteria. Click 'Enroll New Student' to add a student record."
          />
        )}
      </Card>

      {/* Comprehensive 20-Field Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="glass-panel w-full max-w-3xl rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 transition-colors duration-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {editingStudent ? 'Edit Student Information' : 'Enroll New Student Record'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Complete all 20 required fields for institutional student directory & compliance.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3.5 mb-6 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs font-semibold flex items-center space-x-2">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Modal Navigation Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6 space-x-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('personal')}
                className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center space-x-2 whitespace-nowrap transition-colors ${
                  activeTab === 'personal'
                    ? 'border-cyan-600 text-cyan-600 dark:border-cyan-400 dark:text-cyan-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <User className="h-4 w-4" />
                <span>1. Personal & Parents</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('contact')}
                className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center space-x-2 whitespace-nowrap transition-colors ${
                  activeTab === 'contact'
                    ? 'border-cyan-600 text-cyan-600 dark:border-cyan-400 dark:text-cyan-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Phone className="h-4 w-4" />
                <span>2. Contacts & Emergency</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('academic')}
                className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center space-x-2 whitespace-nowrap transition-colors ${
                  activeTab === 'academic'
                    ? 'border-cyan-600 text-cyan-600 dark:border-cyan-400 dark:text-cyan-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <GraduationCap className="h-4 w-4" />
                <span>3. Program & Specializations</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ug')}
                className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center space-x-2 whitespace-nowrap transition-colors ${
                  activeTab === 'ug'
                    ? 'border-cyan-600 text-cyan-600 dark:border-cyan-400 dark:text-cyan-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <BookOpen className="h-4 w-4" />
                <span>4. UG Background</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* TAB 1: Personal & Family */}
              {activeTab === 'personal' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        1. First Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Aarav"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        2. Last Name <span className="text-slate-400 font-normal normal-case">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Sharma"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        3. Father's Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Ramesh Sharma"
                        value={fatherName}
                        onChange={(e) => setFatherName(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        4. Mother's Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Sunita Sharma"
                        value={motherName}
                        onChange={(e) => setMotherName(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Gender <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        12. Blood Group <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={bloodGroup}
                        onChange={(e) => setBloodGroup(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                      >
                        {BLOOD_GROUPS.map((bg) => (
                          <option key={bg} value={bg}>
                            {bg}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        13. PRN Number <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. PRN2026005"
                        value={prnNumber}
                        onChange={(e) => setPrnNumber(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 font-mono placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Contacts & Emergency */}
              {activeTab === 'contact' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        5. Mobile Number <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="+91 9876543210"
                        value={mobileNumber}
                        onChange={(e) => setMobileNumber(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        8. Alternate Contact Number <span className="text-slate-400 font-normal normal-case">(Optional)</span>
                      </label>
                      <input
                        type="tel"
                        placeholder="+91 9876500001"
                        value={alternateContact}
                        onChange={(e) => setAlternateContact(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        6. Official Email Address <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="student@lexiconmile.com"
                        value={emailOfficial}
                        onChange={(e) => setEmailOfficial(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        7. Personal Email Address <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="student.personal@gmail.com"
                        value={emailPersonal}
                        onChange={(e) => setEmailPersonal(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-3">
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center space-x-1.5">
                      <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <span>Emergency Contact Dossier</span>
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                          10. Contact Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Ramesh Sharma"
                          value={emergencyContactName}
                          onChange={(e) => setEmergencyContactName(e.target.value)}
                          className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                          11. Relation <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Father / Mother / Guardian"
                          value={emergencyContactRelation}
                          onChange={(e) => setEmergencyContactRelation(e.target.value)}
                          className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                          9. Emergency Phone <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="tel"
                          required
                          placeholder="+91 9876500002"
                          value={emergencyContactNumber}
                          onChange={(e) => setEmergencyContactNumber(e.target.value)}
                          className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Program & Specializations */}
              {activeTab === 'academic' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        14. Program <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={programId}
                        onChange={(e) => setProgramId(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                      >
                        {programs?.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.code} — {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        15. Batch <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={batchId}
                        onChange={(e) => setBatchId(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                      >
                        {batches?.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        16. Trimester <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={trimester}
                        onChange={(e) => setTrimester(Number(e.target.value))}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:border-cyan-500"
                      >
                        {TRIMESTERS.map((t) => (
                          <option key={t} value={t}>
                            Trimester {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Divisions Selection (Mandatory Multi-Select) */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Program Divisions <span className="text-rose-500">*</span> <span className="text-slate-400 font-normal capitalize">(Select one or more)</span>
                    </label>
                    {programDivisions && programDivisions.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {programDivisions.map((div) => {
                          const isSelected = selectedDivisionIds.includes(div.id);
                          return (
                            <button
                              key={div.id}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedDivisionIds(selectedDivisionIds.filter((id) => id !== div.id));
                                } else {
                                  setSelectedDivisionIds([...selectedDivisionIds, div.id]);
                                }
                              }}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center space-x-1.5 ${
                                isSelected
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-800 hover:border-indigo-400'
                              }`}
                            >
                              {isSelected && <CheckCircle2 className="h-3.5 w-3.5" />}
                              <span>{div.name} ({div.code})</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">
                        No divisions defined for this program yet. You can create divisions under Program Setup.
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        19. Specialization (Major) <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={specMajor}
                        onChange={(e) => setSpecMajor(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                      >
                        {MAJOR_SPECIALIZATIONS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        20. Specialization (Minor) <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={specMinor}
                        onChange={(e) => setSpecMinor(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                      >
                        {MINOR_SPECIALIZATIONS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: Undergraduate Background */}
              {activeTab === 'ug' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      17. Undergraduate Degree <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={ugDegree}
                      onChange={(e) => setUgDegree(e.target.value)}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                    >
                      {UG_DEGREES.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        18. Score Evaluation Format <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={ugScoreType}
                        onChange={(e) => setUgScoreType(e.target.value as 'percentage' | 'cgpa')}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                      >
                        <option value="cgpa">CGPA (Out of 10.0 or 4.0)</option>
                        <option value="percentage">Percentage (%)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        18. Score Value ({ugScoreType === 'percentage' ? '%' : 'CGPA'}) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        step={ugScoreType === 'percentage' ? '0.1' : '0.01'}
                        min="0"
                        max={ugScoreType === 'percentage' ? '100' : '10.0'}
                        required
                        placeholder={ugScoreType === 'percentage' ? 'e.g. 85.5' : 'e.g. 8.75'}
                        value={ugScore}
                        onChange={(e) => setUgScore(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Footer Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between pt-5 border-t border-slate-200 dark:border-slate-800 gap-3">
                <div className="flex space-x-2 text-xs">
                  {activeTab !== 'personal' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (activeTab === 'ug') setActiveTab('academic');
                        else if (activeTab === 'academic') setActiveTab('contact');
                        else if (activeTab === 'contact') setActiveTab('personal');
                      }}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                    >
                      ← Previous Section
                    </button>
                  )}
                  {activeTab !== 'ug' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (activeTab === 'personal') setActiveTab('contact');
                        else if (activeTab === 'contact') setActiveTab('academic');
                        else if (activeTab === 'academic') setActiveTab('ug');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 font-semibold hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      Next Section →
                    </button>
                  )}
                </div>

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createStudentMutation.isPending || updateStudentMutation.isPending}
                    className="px-5 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-md shadow-cyan-500/20 disabled:opacity-50 transition-all"
                  >
                    {editingStudent ? 'Update Student Record' : 'Save & Register Student'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Comprehensive Student Profile Dossier Modal (All 20 Fields) */}
      {selectedStudentForReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="glass-panel w-full max-w-3xl rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 transition-colors duration-200 space-y-6 my-8">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-5">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800 font-mono">
                    PRN: {selectedStudentForReport.prn_number || selectedStudentForReport.roll_no}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                    Blood: {selectedStudentForReport.blood_group || 'O+'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                    {selectedStudentForReport.gender || 'Male'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    Trimester {selectedStudentForReport.trimester || 1}
                  </span>
                </div>
                <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">
                  {selectedStudentForReport.full_name || `${selectedStudentForReport.first_name} ${selectedStudentForReport.last_name || ''}`.trim()}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {selectedStudentForReport.program_name || 'PGDM Core'} • {selectedStudentForReport.batch_name || 'Batch 2026'}
                </p>
              </div>
              <button
                onClick={() => setSelectedStudentForReport(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Grid of 20 Field Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Section 1: Parents & Identification */}
              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 space-y-2.5">
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  <Users className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                  <span>Personal & Parentage</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Gender:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedStudentForReport.gender || 'Male'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">First Name:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedStudentForReport.first_name || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Last Name:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedStudentForReport.last_name || '(None)'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Father's Name:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedStudentForReport.father_name || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Mother's Name:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedStudentForReport.mother_name || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Section 2: Contact Information */}
              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 space-y-2.5">
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  <Mail className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Contact Channels</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Mobile No:</span>
                    <span className="font-semibold font-mono text-slate-800 dark:text-slate-200">{selectedStudentForReport.mobile_number || selectedStudentForReport.phone || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Alternate No:</span>
                    <span className="font-semibold font-mono text-slate-800 dark:text-slate-200">{selectedStudentForReport.alternate_contact_number || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Official Email:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedStudentForReport.email_official || selectedStudentForReport.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Personal Email:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedStudentForReport.email_personal || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Section 3: Emergency Contact Dossier */}
              <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-2.5">
                <div className="flex items-center space-x-2 text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                  <HeartPulse className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span>Emergency Contact</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Contact Person:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedStudentForReport.emergency_contact_name || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Relationship:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedStudentForReport.emergency_contact_relation || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Emergency Phone:</span>
                    <span className="font-bold font-mono text-amber-700 dark:text-amber-400">{selectedStudentForReport.emergency_contact_number || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Section 4: Academic Specialization & UG */}
              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 space-y-2.5">
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  <Briefcase className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Specializations & UG Background</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Major Specialization:</span>
                    <span className="font-bold text-cyan-700 dark:text-cyan-400">{selectedStudentForReport.specialization_major || 'Marketing'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Minor Specialization:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedStudentForReport.specialization_minor || 'Finance'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">UG Degree:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedStudentForReport.ug_degree || 'BBA'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">UG Score:</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">
                      {selectedStudentForReport.ug_score ?? 8.0} ({selectedStudentForReport.ug_score_type === 'percentage' ? '%' : 'CGPA'})
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Performance Indicators */}
            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 text-center">
                <p className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">Current CGPA</p>
                <p className="text-2xl font-bold text-indigo-800 dark:text-indigo-200 mt-0.5">
                  {(selectedStudentForReport.cgpa || 0).toFixed(2)}
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-center">
                <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">Attendance</p>
                <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200 mt-0.5">
                  {(selectedStudentForReport.attendance_percentage ?? 100).toFixed(1)}%
                </p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {(selectedStudentForReport.total_sessions_conducted ?? 0) > 0
                    ? `${selectedStudentForReport.total_sessions_attended ?? 0}/${selectedStudentForReport.total_sessions_conducted} classes`
                    : '⚡ Auto-calculated'}
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-cyan-50/60 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-900/50 text-center">
                <p className="text-xs text-cyan-700 dark:text-cyan-300 font-medium">Compliance Status</p>
                <p className="text-2xl font-bold text-cyan-800 dark:text-cyan-200 mt-0.5 capitalize">
                  {selectedStudentForReport.status || 'Active'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Student Field Export Modal */}
      {exportOpen && (
        <StudentExportModal
          isOpen={exportOpen}
          onClose={() => setExportOpen(false)}
          title="Student Directory Export"
          subtitle="Export filtered directory list"
          students={studentsData || []}
          filenamePrefix="Student_Directory"
        />
      )}
      </>
      )}
    </div>
  );
};
