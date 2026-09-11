import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Trophy,
  Rocket,
  Users,
  Calendar,
  Clock,
  ArrowRight,
  Copy,
  Check,
  Sliders,
  Layers,
  ShieldCheck,
  AlertCircle,
  Edit3,
  Trash2,
  Bell,
  GraduationCap,
  Award,
  ArrowLeft,
  Search,
  Crown,
  ChevronDown,
  ChevronUp,
  Eye,
  UserPlus,
  UserMinus,
  X,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useRoleAccess } from '../../lib/useRoleAccess';
import { IdeathonBroadcastModal } from './IdeathonBroadcastModal';
import { IdeathonFormModal } from './IdeathonFormModal';

export const IdeathonDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, isCoordinator, isFacultyInternal, isFacultyExternal, isStudent } = useRoleAccess();
  const isFacultyOrAdmin = isAdmin || isCoordinator || isFacultyInternal || isFacultyExternal;
  const isPrivilegedAdmin = isAdmin || isCoordinator;

  const [copiedCode, setCopiedCode] = useState(false);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Admin/Faculty View & Filter States
  const [testStudentView, setTestStudentView] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [submissionFilter, setSubmissionFilter] = useState<'all' | 'submitted' | 'pending'>('all');
  const [expandedTeamIds, setExpandedTeamIds] = useState<Record<string, boolean>>({});

  const toggleTeamExpand = (teamId: string) => {
    setExpandedTeamIds((prev) => ({
      ...prev,
      [teamId]: prev[teamId] === undefined ? false : !prev[teamId],
    }));
  };

  // Team Form States
  const [teamAction, setTeamAction] = useState<'register' | 'join'>('register');
  const [teamName, setTeamName] = useState('');
  const [selectedTrack, setSelectedTrack] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [teamError, setTeamError] = useState<string | null>(null);

  // Admin Team Management State
  const [addMemberModalTeam, setAddMemberModalTeam] = useState<any | null>(null);
  const [studentSearchInput, setStudentSearchInput] = useState('');
  const [selectedStudentToAdd, setSelectedStudentToAdd] = useState<any | null>(null);
  const [selectedRoleToAdd, setSelectedRoleToAdd] = useState('Member');
  const [adminTeamActionError, setAdminTeamActionError] = useState<string | null>(null);
  const [deleteTeamConfirm, setDeleteTeamConfirm] = useState<any | null>(null);
  const [removeMemberConfirm, setRemoveMemberConfirm] = useState<{ team: any; member: any } | null>(null);

  // Fetch Ideathon Details
  const { data: ideathon, isLoading } = useQuery<any>({
    queryKey: ['ideathon', id],
    queryFn: async () => {
      const res = await api.get(`/ideathons/${id}`);
      return res.data?.data;
    },
    enabled: !!id,
  });

  // Fetch Current Student's Team (or Admin Preview Team)
  const { data: myTeam } = useQuery<any>({
    queryKey: ['ideathon-my-team', ideathon?.id],
    queryFn: async () => {
      if (!ideathon?.id) return null;
      const res = await api.get(`/ideathons/${ideathon.id}/my-team`);
      return res.data?.data;
    },
    enabled: !!ideathon?.id,
  });

  // Fetch All Teams for Admin, Coordinator, Faculty & Staff
  const { data: allTeams = [], isLoading: isTeamsLoading } = useQuery<any[]>({
    queryKey: ['ideathon-teams', ideathon?.id],
    queryFn: async () => {
      if (!ideathon?.id) return [];
      const res = await api.get(`/ideathons/${ideathon.id}/teams`);
      return res.data?.data || [];
    },
    enabled: !!ideathon?.id && !isStudent,
  });

  // Deadline & Datetime Formatting
  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return 'TBD';
    const d = new Date(dateStr);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const isRegistrationClosed = ideathon?.registration_end_at
    ? new Date() > new Date(ideathon.registration_end_at)
    : false;

  // Filter & Search Teams for Admin/Faculty view
  const filteredTeams = allTeams.filter((team: any) => {
    if (submissionFilter === 'submitted' && !team.has_submission) return false;
    if (submissionFilter === 'pending' && team.has_submission) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchesName = team.name?.toLowerCase().includes(q);
    const matchesCode = team.code?.toLowerCase().includes(q);
    const matchesLeader = team.leader_name?.toLowerCase().includes(q);
    const matchesMember = team.members?.some(
      (m: any) =>
        m.student_name?.toLowerCase().includes(q) ||
        m.student_email?.toLowerCase().includes(q) ||
        m.student_prn?.toLowerCase().includes(q) ||
        m.program_name?.toLowerCase().includes(q)
    );
    return matchesName || matchesCode || matchesLeader || matchesMember;
  });

  // Register Team Mutation
  const registerTeamMutation = useMutation({
    mutationFn: async (payload: { name: string; track_id?: string }) => {
      const res = await api.post(`/ideathons/${ideathon.id}/teams`, payload);
      return res.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ideathon-my-team', ideathon?.id] });
      queryClient.invalidateQueries({ queryKey: ['ideathon', id] });
      setTeamError(null);
    },
    onError: (err: any) => {
      setTeamError(err.response?.data?.detail || 'Failed to register team.');
    },
  });

  // Join Team Mutation
  const joinTeamMutation = useMutation({
    mutationFn: async (payload: { code: string }) => {
      const res = await api.post(`/ideathons/${ideathon.id}/teams/join`, payload);
      return res.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ideathon-my-team', ideathon?.id] });
      queryClient.invalidateQueries({ queryKey: ['ideathon', id] });
      setTeamError(null);
    },
    onError: (err: any) => {
      setTeamError(err.response?.data?.detail || 'Invalid team join code or team is full.');
    },
  });

  // Delete Ideathon Mutation
  const deleteIdeathonMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/ideathons/${ideathon.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ideathons'] });
      navigate('/ideathons');
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to delete competition.');
    },
  });

  // Available Students for Admin Add Member
  const { data: availableStudents = [], isLoading: isLoadingAvailableStudents } = useQuery<any[]>({
    queryKey: ['ideathon-available-students', ideathon?.id, studentSearchInput],
    queryFn: async () => {
      if (!ideathon?.id || !addMemberModalTeam) return [];
      const res = await api.get(`/ideathons/${ideathon.id}/available-students`, {
        params: studentSearchInput ? { search: studentSearchInput } : {},
      });
      return res.data?.data || [];
    },
    enabled: !!ideathon?.id && !!addMemberModalTeam && isPrivilegedAdmin,
  });

  // Admin Update Team Track
  const updateTeamMutation = useMutation({
    mutationFn: async ({ teamId, data }: { teamId: string; data: { track_id?: string; name?: string } }) => {
      const res = await api.patch(`/ideathons/teams/${teamId}`, data);
      return res.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ideathon-teams', ideathon?.id] });
      queryClient.invalidateQueries({ queryKey: ['ideathon', id] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to update team.');
    },
  });

  // Admin Add Member to Team
  const adminAddMemberMutation = useMutation({
    mutationFn: async ({ teamId, studentId, role }: { teamId: string; studentId: string; role: string }) => {
      const res = await api.post(`/ideathons/teams/${teamId}/members`, {
        student_id: studentId,
        role: role,
      });
      return res.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ideathon-teams', ideathon?.id] });
      queryClient.invalidateQueries({ queryKey: ['ideathon', id] });
      setAddMemberModalTeam(null);
      setSelectedStudentToAdd(null);
      setStudentSearchInput('');
      setAdminTeamActionError(null);
    },
    onError: (err: any) => {
      setAdminTeamActionError(err.response?.data?.detail || 'Failed to add student to team.');
    },
  });

  // Admin Remove Member from Team
  const adminRemoveMemberMutation = useMutation({
    mutationFn: async ({ teamId, studentId }: { teamId: string; studentId: string }) => {
      const res = await api.delete(`/ideathons/teams/${teamId}/members/${studentId}`);
      return res.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ideathon-teams', ideathon?.id] });
      queryClient.invalidateQueries({ queryKey: ['ideathon', id] });
      setRemoveMemberConfirm(null);
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to remove member.');
    },
  });

  // Admin Delete Team
  const adminDeleteTeamMutation = useMutation({
    mutationFn: async (teamId: string) => {
      const res = await api.delete(`/ideathons/teams/${teamId}`);
      return res.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ideathon-teams', ideathon?.id] });
      queryClient.invalidateQueries({ queryKey: ['ideathon', id] });
      setDeleteTeamConfirm(null);
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to delete team.');
    },
  });

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) {
      setTeamError('Venture or Team Name is required.');
      return;
    }
    setTeamError(null);
    registerTeamMutation.mutate({ name: teamName.trim(), track_id: selectedTrack || undefined });
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) {
      setTeamError('Please enter a 6-character team join code.');
      return;
    }
    setTeamError(null);
    joinTeamMutation.mutate({ code: joinCode.trim().toUpperCase() });
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!ideathon) {
    return (
      <div className="p-8 text-center text-slate-400 space-y-4">
        <p>Competition not found.</p>
        <button
          onClick={() => navigate('/ideathons')}
          className="px-4 py-2 bg-slate-800 rounded-xl text-white text-xs cursor-pointer"
        >
          Back to Competitions Hub
        </button>
      </div>
    );
  }

  const statusLabel = ideathon.status.replace('_', ' ');

  return (
    <div className="space-y-6 pb-12">
      {/* Top Breadcrumb & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          onClick={() => navigate('/ideathons')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Competitions Hub</span>
        </button>

        <div className="flex items-center flex-wrap gap-2">
          {ideathon.is_leaderboard_published && (
            <button
              onClick={() => navigate(`/ideathons/${ideathon.id}/leaderboard`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold text-xs hover:bg-amber-500/20 transition-all cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
              <span>Leaderboard & Podium</span>
            </button>
          )}

          {isFacultyOrAdmin && (
            <button
              onClick={() => navigate(`/ideathons/${ideathon.id}/evaluation`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-semibold text-xs hover:bg-indigo-500/20 transition-all cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-500" />
              <span>Jury Scorecard</span>
            </button>
          )}

          {isPrivilegedAdmin && (
            <>
              <button
                onClick={() => setIsBroadcastModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-700 dark:text-cyan-300 font-semibold text-xs hover:bg-cyan-500/20 transition-all cursor-pointer"
                title="Send announcement to targeted programs & batches"
              >
                <Bell className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>Notify Students</span>
              </button>

              <button
                onClick={() => setIsEditModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                <span>Edit</span>
              </button>

              <button
                onClick={() => setIsDeleteModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold text-xs hover:bg-rose-500/20 transition-all cursor-pointer"
                title="Delete this competition"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Delete</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Clean Competition Overview Card */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                {statusLabel}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                Teams of {ideathon.min_team_size} – {ideathon.max_team_size}
              </span>
              {ideathon.is_double_blind_screening && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  Double-Blind Screening
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              {ideathon.title}
            </h1>
            <p className="text-sm font-semibold text-cyan-600 dark:text-cyan-400">
              Theme: {ideathon.theme}
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs shrink-0 pt-1">
            <div className="text-right">
              <span className="text-slate-400 block text-[11px]">Teams Registered</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{ideathon.total_teams || 0}</span>
            </div>
            <div className="text-right border-l border-slate-200 dark:border-slate-800 pl-4">
              <span className="text-slate-400 block text-[11px]">Ideas Submitted</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{ideathon.total_submissions || 0}</span>
            </div>
          </div>
        </div>

        {/* Key Dates Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <Calendar className="w-4 h-4 text-cyan-500 shrink-0" />
            <span>
              Registration Deadline:{' '}
              <strong className={isRegistrationClosed ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-900 dark:text-slate-100'}>
                {formatDateTime(ideathon.registration_end_at)}
              </strong>
              {isRegistrationClosed && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  Closed
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <Clock className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              Submission Deadline:{' '}
              <strong className="text-slate-900 dark:text-slate-100">
                {formatDateTime(ideathon.submission_end_at)}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <Award className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>
              Pitch Day:{' '}
              <strong className="text-slate-900 dark:text-slate-100">
                {formatDateTime(ideathon.presentation_date)}
              </strong>
            </span>
          </div>
        </div>

        {/* Faculty Leadership & Mentors */}
        {(ideathon.lead_faculty || (ideathon.assigned_faculties && ideathon.assigned_faculties.length > 0)) && (
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs">
            {ideathon.lead_faculty && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-semibold">Lead Faculty:</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{ideathon.lead_faculty.full_name}</span>
                  {ideathon.lead_faculty.department && (
                    <span className="text-[10px] font-normal opacity-80">({ideathon.lead_faculty.department})</span>
                  )}
                </span>
              </div>
            )}
            {ideathon.assigned_faculties && ideathon.assigned_faculties.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-400 font-semibold">Faculty Mentors:</span>
                {ideathon.assigned_faculties.map((f: any) => (
                  <span
                    key={f.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                  >
                    <span>{f.full_name}</span>
                    {f.type && <span className="text-[9px] uppercase opacity-70">[{f.type}]</span>}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Brief, Problem Statement, Cohorts, Rubrics (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Brief & Problem Statement Card */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Executive Brief
              </h2>
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {ideathon.brief || ideathon.description || 'No detailed brief provided for this competition.'}
              </p>
            </div>

            {ideathon.problem_statement && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-400">
                  Core Problem Statement & Objectives
                </h3>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {ideathon.problem_statement}
                </p>
              </div>
            )}
          </div>

          {/* Eligible Cohorts Card */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-cyan-500" />
              Eligible Programs & Batches
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <span className="text-slate-400 font-semibold block">Target Programs:</span>
                <div className="flex flex-wrap gap-1.5">
                  {ideathon.target_programs?.includes('ALL') ? (
                    <span className="px-2.5 py-1 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 font-semibold">
                      Open to All Academic Programs (PGDM, GMBA, BBA, HMCT)
                    </span>
                  ) : (
                    ideathon.target_programs?.map((p: string) => (
                      <span
                        key={p}
                        className="px-2.5 py-1 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 font-semibold"
                      >
                        {p}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-slate-400 font-semibold block">Target Batches:</span>
                <div className="flex flex-wrap gap-1.5">
                  {ideathon.target_batches?.includes('ALL') ? (
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-semibold">
                      All Active Batches
                    </span>
                  ) : (
                    ideathon.target_batches?.map((b: string) => (
                      <span
                        key={b}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-semibold"
                      >
                        {b}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 italic pt-1">
              Cross-program and cross-batch collaboration is permitted. Students can team up across programs and batches.
            </p>
          </div>

          {/* Process Stages Timeline */}
          {ideathon.process_and_stages && ideathon.process_and_stages.length > 0 && (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-500" />
                Competition Stages & Process
              </h2>

              <div className="space-y-3">
                {ideathon.process_and_stages.map((stage: any, idx: number) => (
                  <div
                    key={stage.id || idx}
                    className="flex items-start gap-3.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs"
                  >
                    <div className="w-6 h-6 rounded-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100">{stage.title}</h4>
                      <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                        {stage.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Evaluation Rubrics & Prizes */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              Evaluation Criteria & Awards
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ideathon.rubrics && ideathon.rubrics.map((r: any) => (
                <div
                  key={r.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-slate-100">{r.name}</span>
                    <span className="px-2 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px]">
                      {r.weightage}% weight
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{r.description}</p>
                </div>
              ))}
            </div>

            {/* Prizes list */}
            {ideathon.prizes && ideathon.prizes.length > 0 && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Podium Prizes</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  {ideathon.prizes.slice(0, 3).map((prize: any) => (
                    <div
                      key={prize.rank}
                      className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 text-center space-y-1"
                    >
                      <Trophy className="w-4 h-4 text-amber-500 mx-auto" />
                      <span className="font-bold text-slate-900 dark:text-slate-100 block">{prize.title}</span>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400">{prize.reward}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Student Participation & Quick Actions */}
        <div className="space-y-6">
          {/* Student Participation & Team Roster Card */}
          {!isStudent && !testStudentView ? (
            /* ADMIN / FACULTY / STAFF VIEW: Full Registered Teams & Team Compositions */
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Student Participation & Teams
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {allTeams.length} registered ventures • Team compositions & status
                    </p>
                  </div>
                </div>

                {/* Switch to Test Registration View */}
                <button
                  onClick={() => setTestStudentView(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                  title="Preview student registration form"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                  <span>Test Student View</span>
                </button>
              </div>

              {/* Deadline Status Banner */}
              <div
                className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                  isRegistrationClosed
                    ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-300'
                    : 'bg-cyan-50/50 dark:bg-cyan-950/20 border-cyan-200/50 dark:border-cyan-900/30 text-cyan-800 dark:text-cyan-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Registration Deadline: <strong>{formatDateTime(ideathon.registration_end_at)}</strong>
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                    isRegistrationClosed
                      ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                      : 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300'
                  }`}
                >
                  {isRegistrationClosed ? 'Closed' : 'Open'}
                </span>
              </div>

              {/* Search & Filter Controls */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search team, student name, PRN, email..."
                    className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-[11px]">
                  <button
                    onClick={() => setSubmissionFilter('all')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                      submissionFilter === 'all'
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    All ({allTeams.length})
                  </button>
                  <button
                    onClick={() => setSubmissionFilter('submitted')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                      submissionFilter === 'submitted'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50'
                    }`}
                  >
                    Submitted ({allTeams.filter((t: any) => t.has_submission).length})
                  </button>
                  <button
                    onClick={() => setSubmissionFilter('pending')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                      submissionFilter === 'pending'
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50'
                    }`}
                  >
                    Pending ({allTeams.filter((t: any) => !t.has_submission).length})
                  </button>
                </div>
              </div>

              {/* Teams List */}
              {isTeamsLoading ? (
                <div className="p-6 text-center text-xs text-slate-400">Loading registered teams...</div>
              ) : filteredTeams.length === 0 ? (
                <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 text-center space-y-1.5 text-xs text-slate-500">
                  <Users className="w-6 h-6 mx-auto text-slate-400" />
                  <p className="font-semibold text-slate-700 dark:text-slate-300">
                    {allTeams.length === 0 ? 'No Teams Registered Yet' : 'No teams match search query'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {allTeams.length === 0
                      ? 'Student team formations will appear here in real-time.'
                      : 'Try adjusting your search keywords or filter.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
                  {filteredTeams.map((team: any) => {
                    const isExpanded = expandedTeamIds[team.id] !== false; // default expanded
                    return (
                      <div
                        key={team.id}
                        className="rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 overflow-hidden text-xs"
                      >
                        {/* Team Card Header */}
                        <div className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                                  {team.name}
                                </h4>
                                {isPrivilegedAdmin && ideathon.tracks && ideathon.tracks.length > 0 ? (
                                  <select
                                    value={team.track_id || ''}
                                    onChange={(e) => updateTeamMutation.mutate({ teamId: team.id, data: { track_id: e.target.value } })}
                                    className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
                                    title="Change Innovation Track"
                                  >
                                    <option value="" className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300">Select Track</option>
                                    {ideathon.tracks.map((t: any) => (
                                      <option key={t.id} value={t.id} className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300">
                                        Track: {t.name}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  team.track_id && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                                      {ideathon.tracks?.find((t: any) => t.id === team.track_id)?.name || 'Track'}
                                    </span>
                                  )
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500">
                                Team Lead: <strong className="text-slate-700 dark:text-slate-300">{team.leader_name || 'Leader'}</strong>
                              </p>
                            </div>

                            {/* Actions: Join Code, Add Member, Delete Team */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => handleCopyCode(team.code)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono font-bold text-[11px] text-slate-700 dark:text-slate-300 hover:border-cyan-500 cursor-pointer"
                                title="Click to copy join code"
                              >
                                <span>{team.code}</span>
                                <Copy className="w-2.5 h-2.5 text-slate-400" />
                              </button>

                              {isPrivilegedAdmin && (
                                <>
                                  <button
                                    onClick={() => {
                                      setAddMemberModalTeam(team);
                                      setSelectedStudentToAdd(null);
                                      setStudentSearchInput('');
                                      setSelectedRoleToAdd('Member');
                                      setAdminTeamActionError(null);
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 text-[11px] font-bold transition-colors cursor-pointer"
                                    title="Add Student to this Team"
                                  >
                                    <UserPlus className="w-3 h-3" />
                                    <span>Add Member</span>
                                  </button>

                                  <button
                                    onClick={() => setDeleteTeamConfirm(team)}
                                    className="p-1 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition-colors cursor-pointer"
                                    title="Delete Team"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Submission Status Pill */}
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px]">
                            {team.has_submission ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                                <Check className="w-3 h-3" />
                                <span>Proposal: {team.submission?.title || 'Submitted'}</span>
                              </span>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                Proposal Pending Submission
                              </span>
                            )}

                            <button
                              onClick={() => toggleTeamExpand(team.id)}
                              className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-semibold cursor-pointer"
                            >
                              <span>{team.members?.length || 0} Members</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>

                        {/* Members Breakdown */}
                        {isExpanded && team.members && team.members.length > 0 && (
                          <div className="px-3 pb-3 pt-1 space-y-1.5 border-t border-slate-200/50 dark:border-slate-700/50 bg-white/60 dark:bg-slate-900/60">
                            {team.members.map((m: any) => {
                              const isLeader = m.role?.toLowerCase() === 'leader';
                              return (
                                <div
                                  key={m.id}
                                  className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-800 flex items-start justify-between gap-2 text-[11px]"
                                >
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-1.5">
                                      {isLeader && <Crown className="w-3 h-3 text-amber-500" />}
                                      <span className="font-bold text-slate-900 dark:text-slate-100">
                                        {m.student_name}
                                      </span>
                                      <span
                                        className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                                          isLeader
                                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                        }`}
                                      >
                                        {m.role}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[10px]">
                                      {m.student_email && <span>{m.student_email}</span>}
                                      {m.student_prn && <span>• PRN: {m.student_prn}</span>}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    {(m.program_name || m.batch_name) && (
                                      <span className="text-[10px] text-right text-slate-500 dark:text-slate-400 font-medium">
                                        {m.program_name} {m.batch_name ? `• ${m.batch_name}` : ''}
                                      </span>
                                    )}
                                    {isPrivilegedAdmin && (
                                      <button
                                        onClick={() => setRemoveMemberConfirm({ team, member: m })}
                                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                        title={`Remove ${m.student_name} from team`}
                                      >
                                        <UserMinus className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* STUDENT VIEW (Or Admin in Preview Mode): Registration & Team Management */
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              {/* Preview Banner for Admins */}
              {testStudentView && (
                <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-semibold">
                    <Eye className="w-4 h-4 text-indigo-500" />
                    <span>Student Registration Preview Mode</span>
                  </div>
                  <button
                    onClick={() => setTestStudentView(false)}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-bold hover:bg-indigo-500 transition-colors cursor-pointer"
                  >
                    Back to Team Roster
                  </button>
                </div>
              )}

              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-500" />
                Student Participation
              </h3>

              {/* Deadline Alert for Students */}
              <div
                className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                  isRegistrationClosed
                    ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-300'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                  <span>
                    Deadline: <strong>{formatDateTime(ideathon.registration_end_at)}</strong>
                  </span>
                </div>
                {isRegistrationClosed && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-600 dark:text-rose-400">
                    Closed
                  </span>
                )}
              </div>

              {myTeam ? (
                /* Already Registered with a Team */
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-600 dark:text-slate-300">Your Team</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                        {myTeam.status}
                      </span>
                    </div>
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{myTeam.name}</h4>

                    {/* Join Code with One-Click Copy */}
                    <div className="flex items-center justify-between pt-1 border-t border-emerald-200/60 dark:border-emerald-900/40">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">Team Code:</span>
                      <button
                        onClick={() => handleCopyCode(myTeam.code)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono font-bold text-xs hover:border-cyan-500 cursor-pointer"
                        title="Click to copy join code"
                      >
                        <span>{myTeam.code}</span>
                        {copiedCode ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-slate-400" />}
                      </button>
                    </div>
                  </div>

                  {/* Team Members */}
                  {myTeam.members && (
                    <div className="space-y-1.5 text-xs">
                      <span className="text-slate-400 font-semibold block text-[11px]">
                        Team Members ({myTeam.members.length})
                      </span>
                      <div className="space-y-1">
                        {myTeam.members.map((m: any) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800"
                          >
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {m.student_name || 'Member'}
                            </span>
                            <span className="text-[10px] text-slate-400">{m.role}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Go To Workspace Button */}
                  <button
                    onClick={() => navigate(`/ideathons/${ideathon.id}/workspace`)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer"
                  >
                    <Rocket className="w-4 h-4" />
                    <span>Open Idea Submission Workspace</span>
                  </button>
                </div>
              ) : isRegistrationClosed ? (
                /* Registration Deadline Passed — No New Registrations */
                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs space-y-2 text-center">
                  <AlertCircle className="w-6 h-6 mx-auto text-rose-500" />
                  <h4 className="font-bold text-rose-800 dark:text-rose-200">Team Registration Closed</h4>
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 leading-relaxed">
                    The registration cutoff was <strong>{formatDateTime(ideathon.registration_end_at)}</strong>.
                    No new venture teams can be created or joined after this deadline.
                  </p>
                </div>
              ) : (
                /* Not Registered Yet & Registration is Open */
                <div className="space-y-4">
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Participate solo or form a team of up to {ideathon.max_team_size} students.
                  </p>

                  {/* Toggle Action */}
                  <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => {
                        setTeamAction('register');
                        setTeamError(null);
                      }}
                      className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer ${
                        teamAction === 'register'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Register Venture
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTeamAction('join');
                        setTeamError(null);
                      }}
                      className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer ${
                        teamAction === 'join'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Join with Code
                    </button>
                  </div>

                  {teamError && (
                    <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{teamError}</span>
                    </div>
                  )}

                  {teamAction === 'register' ? (
                    <form onSubmit={handleRegisterSubmit} className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Venture / Team Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={teamName}
                          onChange={(e) => setTeamName(e.target.value)}
                          placeholder="e.g. Apex HyperFlow"
                          className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
                        />
                      </div>

                      {ideathon.tracks && ideathon.tracks.length > 0 && (
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Innovation Track
                          </label>
                          <select
                            value={selectedTrack}
                            onChange={(e) => setSelectedTrack(e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
                          >
                            <option value="">Select a track (optional)</option>
                            {ideathon.tracks.map((t: any) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={registerTeamMutation.isPending || !teamName.trim()}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer"
                      >
                        {registerTeamMutation.isPending ? 'Registering...' : 'Register Team & Get Code'}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleJoinSubmit} className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          6-Character Team Join Code *
                        </label>
                        <input
                          type="text"
                          maxLength={12}
                          value={joinCode}
                          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                          placeholder="e.g. IDEO-4X9B"
                          className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono focus:outline-hidden focus:ring-2 focus:ring-cyan-500 uppercase"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={joinTeamMutation.isPending || !joinCode.trim()}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 disabled:opacity-50 font-bold text-xs transition-opacity shadow-xs cursor-pointer"
                      >
                        {joinTeamMutation.isPending ? 'Joining...' : 'Join Team'}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Faculty / Admin Controls */}
          {isFacultyOrAdmin && (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-500" />
                Evaluator & Admin Tools
              </h3>

              <div className="space-y-2 text-xs">
                <button
                  onClick={() => navigate(`/ideathons/${ideathon.id}/evaluation`)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-900/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/50 transition-colors cursor-pointer"
                >
                  <span className="font-semibold">Open Jury Scorecard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => navigate(`/ideathons/${ideathon.id}/leaderboard`)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100/50 transition-colors cursor-pointer"
                >
                  <span className="font-semibold">View Live Leaderboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                {isPrivilegedAdmin && (
                  <button
                    onClick={() => setIsBroadcastModalOpen(true)}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-200/50 dark:border-cyan-900/40 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100/50 transition-colors cursor-pointer"
                  >
                    <span className="font-semibold">Broadcast Student Alert</span>
                    <Bell className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Broadcast Notification Modal */}
      <IdeathonBroadcastModal
        ideathon={ideathon}
        isOpen={isBroadcastModalOpen}
        onClose={() => setIsBroadcastModalOpen(false)}
      />

      {/* Edit Competition Modal */}
      <IdeathonFormModal
        ideathon={ideathon}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['ideathon', id] })}
      />

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Delete Competition</h3>
                <p className="text-xs text-slate-500">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete{' '}
              <strong className="text-slate-900 dark:text-slate-100">{ideathon.title}</strong>? All registered teams,
              submissions, evaluations, and associated project data will be removed.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={deleteIdeathonMutation.isPending}
                onClick={() => deleteIdeathonMutation.mutate()}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer"
              >
                {deleteIdeathonMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Admin: Add Member Modal */}
      {addMemberModalTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Add Student to Team</h3>
                  <p className="text-xs text-slate-500">
                    Team: <strong className="text-cyan-600 dark:text-cyan-400">{addMemberModalTeam.name}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAddMemberModalTeam(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {adminTeamActionError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2 shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{adminTeamActionError}</span>
              </div>
            )}

            {/* Search Input */}
            <div className="relative shrink-0">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={studentSearchInput}
                onChange={(e) => setStudentSearchInput(e.target.value)}
                placeholder="Search eligible students by name, PRN, or email..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            {/* Role Picker */}
            <div className="flex items-center gap-2 shrink-0 text-xs">
              <label className="text-slate-500 font-semibold">Assign Role:</label>
              <select
                value={selectedRoleToAdd}
                onChange={(e) => setSelectedRoleToAdd(e.target.value)}
                className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
              >
                <option value="Member">Member</option>
                <option value="Tech Architect">Tech Architect</option>
                <option value="Product Lead">Product Lead</option>
                <option value="Researcher">Researcher</option>
                <option value="Designer">Designer</option>
              </select>
            </div>

            {/* Eligible Students List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-[160px] max-h-[260px]">
              {isLoadingAvailableStudents ? (
                <div className="p-6 text-center text-xs text-slate-400">Loading eligible students...</div>
              ) : availableStudents.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                  {studentSearchInput
                    ? 'No eligible students match your search.'
                    : 'All enrolled students are already registered in teams for this competition.'}
                </div>
              ) : (
                availableStudents.map((s: any) => {
                  const isSelected = selectedStudentToAdd?.id === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => setSelectedStudentToAdd(s)}
                      className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-cyan-500/10 border-cyan-500/50 text-slate-900 dark:text-slate-100 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 hover:border-cyan-500/30 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold truncate">{s.full_name}</span>
                          {s.prn_number && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                              PRN: {s.prn_number}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">{s.email_official}</p>
                      </div>

                      <div className="text-right shrink-0 text-[10px] text-slate-500 dark:text-slate-400">
                        <div>{s.program_name || 'Program'}</div>
                        <div>{s.batch_name || ''}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800 shrink-0 text-xs">
              <div className="text-slate-500">
                {selectedStudentToAdd ? (
                  <span>
                    Selected: <strong className="text-slate-800 dark:text-slate-200">{selectedStudentToAdd.full_name}</strong>
                  </span>
                ) : (
                  <span>Click a student above to select</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAddMemberModalTeam(null)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={!selectedStudentToAdd || adminAddMemberMutation.isPending}
                  onClick={() => {
                    if (!selectedStudentToAdd) return;
                    adminAddMemberMutation.mutate({
                      teamId: addMemberModalTeam.id,
                      studentId: selectedStudentToAdd.id,
                      role: selectedRoleToAdd,
                    });
                  }}
                  className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer"
                >
                  {adminAddMemberMutation.isPending ? 'Adding...' : 'Add to Team'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin: Delete Team Confirmation Modal */}
      {deleteTeamConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Delete Team</h3>
                <p className="text-xs text-slate-500">This action permanently deletes the team</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete team{' '}
              <strong className="text-slate-900 dark:text-slate-100">{deleteTeamConfirm.name}</strong>?
              All memberships, submitted proposals, and jury scorecard evaluations for this team will be removed.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setDeleteTeamConfirm(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={adminDeleteTeamMutation.isPending}
                onClick={() => adminDeleteTeamMutation.mutate(deleteTeamConfirm.id)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer"
              >
                {adminDeleteTeamMutation.isPending ? 'Deleting...' : 'Confirm Delete Team'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin: Remove Member Confirmation Modal */}
      {removeMemberConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <UserMinus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Remove Team Member</h3>
                <p className="text-xs text-slate-500">
                  Team: <strong className="text-slate-800 dark:text-slate-200">{removeMemberConfirm.team.name}</strong>
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Remove <strong className="text-slate-900 dark:text-slate-100">{removeMemberConfirm.member.student_name}</strong> from this team?
              {removeMemberConfirm.member.role?.toLowerCase() === 'leader' && (
                <span className="block mt-2 text-amber-600 dark:text-amber-400 font-medium">
                  Note: Because this member is the team Leader, leadership will automatically be assigned to the next remaining member.
                </span>
              )}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setRemoveMemberConfirm(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={adminRemoveMemberMutation.isPending}
                onClick={() =>
                  adminRemoveMemberMutation.mutate({
                    teamId: removeMemberConfirm.team.id,
                    studentId: removeMemberConfirm.member.student_id,
                  })
                }
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer"
              >
                {adminRemoveMemberMutation.isPending ? 'Removing...' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
