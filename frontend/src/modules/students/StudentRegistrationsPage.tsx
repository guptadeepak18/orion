import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserCheck,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Eye,
  X,
  GraduationCap,
} from 'lucide-react';
import { api } from '../../lib/api';

interface Registration {
  id: string;
  email: string;
  prn_number?: string;
  first_name: string;
  last_name?: string;
  full_name: string;
  gender?: string;
  father_name?: string;
  mother_name?: string;
  mobile_number: string;
  email_personal?: string;
  alternate_contact_number?: string;
  emergency_contact_name?: string;
  emergency_contact_number?: string;
  emergency_contact_relation?: string;
  blood_group?: string;
  ug_degree?: string;
  ug_score_type?: string;
  ug_score?: number;
  specialization_major?: string;
  specialization_minor?: string;
  is_email_verified: boolean;
  status: string;
  rejection_reason?: string;
  created_at: string;
}

interface Program {
  id: string;
  name: string;
  code: string;
}

interface Batch {
  id: string;
  name: string;
  program_id: string;
}

interface Division {
  id: string;
  name: string;
  program_id: string;
}

const SPECIALIZATIONS = [
  'Marketing',
  'Finance',
  'Human Resources',
  'Research & Business Analytics',
];

interface StudentRegistrationsPageProps {
  embedded?: boolean;
}

export const StudentRegistrationsPage: React.FC<StudentRegistrationsPageProps> = ({ embedded = false }) => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('pending_review');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedReg, setSelectedReg] = useState<Registration | null>(null);
  const [rejectingReg, setRejectingReg] = useState<Registration | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [approvingReg, setApprovingReg] = useState<Registration | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Approval Form State
  const [approvalForm, setApprovalForm] = useState({
    program_id: '',
    batch_id: '',
    division_id: '',
    trimester: 1,
    roll_no: '',
    enrollment_no: '',
    specialization_major: '',
    specialization_minor: '',
  });

  // Fetch registrations
  const { data: registrations = [], isLoading } = useQuery<Registration[]>({
    queryKey: ['student-registrations', statusFilter],
    queryFn: async () => {
      const url = statusFilter ? `/student-registrations?status=${statusFilter}` : '/student-registrations';
      const res = await api.get(url);
      return res.data.data;
    },
  });

  // Fetch academic programs
  const { data: programs = [] } = useQuery<Program[]>({
    queryKey: ['academic-programs'],
    queryFn: async () => {
      const res = await api.get('/academic/programs');
      return res.data.data;
    },
  });

  // Fetch batches
  const { data: batches = [] } = useQuery<Batch[]>({
    queryKey: ['academic-batches'],
    queryFn: async () => {
      const res = await api.get('/academic/batches');
      return res.data.data;
    },
  });

  // Fetch divisions
  const { data: divisions = [] } = useQuery<Division[]>({
    queryKey: ['academic-divisions'],
    queryFn: async () => {
      const res = await api.get('/academic/divisions');
      return res.data.data;
    },
  });

  const handleOpenApprove = (reg: Registration) => {
    // Default to PGDM
    const pgdmProg = programs.find((p) => p.code === 'PGDM' || p.name.toUpperCase().includes('PGDM')) || programs[0];
    const defaultProgramId = pgdmProg?.id || '';

    // Filter batches for PGDM, find 26-28
    const relevantBatches = batches.filter((b) => !defaultProgramId || b.program_id === defaultProgramId);
    const defaultBatch =
      relevantBatches.find((b) => b.name.includes('26-28') || b.name.includes('2026-2028')) ||
      relevantBatches[0] ||
      batches.find((b) => b.name.includes('26-28') || b.name.includes('2026-2028')) ||
      batches[0];

    const relevantDivisions = divisions.filter((d) => !defaultProgramId || d.program_id === defaultProgramId);

    setApprovalForm({
      program_id: defaultProgramId,
      batch_id: defaultBatch?.id || '',
      division_id: relevantDivisions[0]?.id || '',
      trimester: 1,
      roll_no: '',
      enrollment_no: '',
      specialization_major: reg.specialization_major || 'Marketing',
      specialization_minor: reg.specialization_minor || '',
    });
    setApprovingReg(reg);
    setActionError(null);
  };

  // When admin changes program inside the modal, adjust batch & division options
  const handleProgramChange = (progId: string) => {
    const relevantBatches = batches.filter((b) => b.program_id === progId);
    const defaultBatch =
      relevantBatches.find((b) => b.name.includes('26-28') || b.name.includes('2026-2028')) || relevantBatches[0];
    const relevantDivisions = divisions.filter((d) => d.program_id === progId);

    setApprovalForm((prev) => ({
      ...prev,
      program_id: progId,
      batch_id: defaultBatch?.id || '',
      division_id: relevantDivisions[0]?.id || '',
    }));
  };

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async ({ regId, data }: { regId: string; data: typeof approvalForm }) => {
      const res = await api.post(`/student-registrations/${regId}/approve`, data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setApprovingReg(null);
      setSelectedReg(null);
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.detail || 'Failed to approve registration.');
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ regId, reason }: { regId: string; reason: string }) => {
      const res = await api.post(`/student-registrations/${regId}/reject`, { reason });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-registrations'] });
      setRejectingReg(null);
      setRejectionReason('');
      setSelectedReg(null);
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.detail || 'Failed to reject registration.');
    },
  });

  const filteredList = registrations.filter((reg) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      reg.full_name?.toLowerCase().includes(term) ||
      reg.email?.toLowerCase().includes(term) ||
      reg.prn_number?.toLowerCase().includes(term) ||
      reg.mobile_number?.toLowerCase().includes(term)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_review':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock className="h-3.5 w-3.5" /> Pending Review
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3.5 w-3.5" /> Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <XCircle className="h-3.5 w-3.5" /> Rejected
          </span>
        );
      case 'pending_verification':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
            <Clock className="h-3.5 w-3.5" /> Email Pending
          </span>
        );
      default:
        return null;
    }
  };

  const availableBatches = batches.filter(
    (b) => !approvalForm.program_id || b.program_id === approvalForm.program_id
  );
  const availableDivisions = divisions.filter(
    (d) => !approvalForm.program_id || d.program_id === approvalForm.program_id
  );

  return (
    <div className={embedded ? 'space-y-6' : 'p-6 max-w-7xl mx-auto space-y-6'}>
      {/* Top Header */}
      {!embedded && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Student Registrations</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20">
                {registrations.length} Total
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Review and approve incoming student self-registrations.
            </p>
          </div>
        </div>
      )}

      {/* Global Action Error Alert */}
      {actionError && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="p-1 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-lg">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto p-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl">
          {[
            { id: 'pending_review', label: 'Pending Review' },
            { id: 'approved', label: 'Approved' },
            { id: 'rejected', label: 'Rejected' },
            { id: 'pending_verification', label: 'Unverified' },
            { id: '', label: 'All Requests' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                statusFilter === tab.id
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, PRN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Registrations List / Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <div className="h-8 w-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredList.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            <UserCheck className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="font-semibold text-slate-700 dark:text-slate-300">No registration requests found</p>
            <p className="text-xs text-slate-400 mt-1">There are no applications matching the current filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase text-[11px] tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4 min-w-[220px]">Student Details</th>
                  <th className="px-6 py-4 min-w-[210px]">Official Email</th>
                  <th className="px-6 py-4 min-w-[130px]">PRN Number</th>
                  <th className="px-6 py-4 min-w-[130px]">Mobile</th>
                  <th className="px-6 py-4 min-w-[140px]">Status</th>
                  <th className="px-6 py-4 min-w-[120px]">Submitted</th>
                  <th className="px-6 py-4 text-right min-w-[240px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredList.map((reg) => (
                  <tr
                    key={reg.id}
                    onClick={() => setSelectedReg(reg)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                        {reg.full_name}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {reg.ug_degree && (
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            {reg.ug_degree} ({reg.ug_score} {reg.ug_score_type?.toUpperCase()})
                          </span>
                        )}
                        {reg.specialization_major && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20">
                            {reg.specialization_major}
                            {reg.specialization_minor ? ` • ${reg.specialization_minor}` : ''}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-mono text-xs">
                      {reg.email}
                    </td>
                    <td className="px-6 py-4 text-slate-900 dark:text-white font-bold font-mono text-xs">
                      {reg.prn_number || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 text-xs">
                      {reg.mobile_number}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(reg.status)}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs whitespace-nowrap">
                      {new Date(reg.created_at).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setSelectedReg(reg)}
                          title="View student profile details"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold shadow-2xs transition-all cursor-pointer shrink-0"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-400" /> View
                        </button>
                        {reg.status === 'pending_review' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenApprove(reg)}
                              title="Review profile and approve registration"
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer shrink-0"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRejectingReg(reg);
                                setRejectionReason('');
                              }}
                              title="Reject registration application"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-xs font-semibold transition-all cursor-pointer shrink-0"
                            >
                              <XCircle className="h-3.5 w-3.5" /> Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{selectedReg.full_name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Registration Application Details</p>
              </div>
              <button
                onClick={() => setSelectedReg(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <p className="text-xs text-slate-400 uppercase font-semibold">PRN Number</p>
                <p className="font-bold text-slate-900 dark:text-white mt-0.5">{selectedReg.prn_number || 'N/A'}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <p className="text-xs text-slate-400 uppercase font-semibold">Official Email</p>
                <p className="font-medium text-slate-900 dark:text-white mt-0.5">{selectedReg.email}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <p className="text-xs text-slate-400 uppercase font-semibold">Mobile Number</p>
                <p className="font-medium text-slate-900 dark:text-white mt-0.5">{selectedReg.mobile_number}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <p className="text-xs text-slate-400 uppercase font-semibold">Personal Email</p>
                <p className="font-medium text-slate-900 dark:text-white mt-0.5">{selectedReg.email_personal || 'N/A'}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <p className="text-xs text-slate-400 uppercase font-semibold">Gender & Blood Group</p>
                <p className="font-medium text-slate-900 dark:text-white mt-0.5">
                  {selectedReg.gender || 'N/A'} • {selectedReg.blood_group || 'N/A'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <p className="text-xs text-slate-400 uppercase font-semibold">Parents</p>
                <p className="font-medium text-slate-900 dark:text-white mt-0.5">
                  Father: {selectedReg.father_name || 'N/A'} | Mother: {selectedReg.mother_name || 'N/A'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 col-span-2">
                <p className="text-xs text-slate-400 uppercase font-semibold">Specialization Choices</p>
                <p className="font-medium text-slate-900 dark:text-white mt-0.5">
                  Major: <strong className="text-cyan-600 dark:text-cyan-400">{selectedReg.specialization_major || 'Not Selected'}</strong>
                  {selectedReg.specialization_minor && (
                    <span className="text-slate-600 dark:text-slate-300"> | Minor: {selectedReg.specialization_minor}</span>
                  )}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 col-span-2">
                <p className="text-xs text-slate-400 uppercase font-semibold">Emergency Contact</p>
                <p className="font-medium text-slate-900 dark:text-white mt-0.5">
                  {selectedReg.emergency_contact_name} ({selectedReg.emergency_contact_relation}) —{' '}
                  {selectedReg.emergency_contact_number}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 col-span-2">
                <p className="text-xs text-slate-400 uppercase font-semibold">UG Background</p>
                <p className="font-medium text-slate-900 dark:text-white mt-0.5">
                  {selectedReg.ug_degree} — Score: {selectedReg.ug_score} ({selectedReg.ug_score_type?.toUpperCase()})
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setSelectedReg(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300"
              >
                Close
              </button>
              {selectedReg.status === 'pending_review' && (
                <>
                  <button
                    onClick={() => {
                      setRejectingReg(selectedReg);
                      setRejectionReason('');
                    }}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleOpenApprove(selectedReg)}
                    className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm"
                  >
                    Approve Student
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Approve & Complete Student Profile Modal */}
      {approvingReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                  <GraduationCap className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    Approve Registration & Assign Academic Profile
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Assign Program, Batch, and academic parameters for <strong>{approvingReg.full_name}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setApprovingReg(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Student Quick Info Strip */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-slate-400">PRN: </span>
                <strong className="text-slate-900 dark:text-white">{approvingReg.prn_number || 'N/A'}</strong>
              </div>
              <div>
                <span className="text-slate-400">Email: </span>
                <span className="font-mono text-cyan-600 dark:text-cyan-400">{approvingReg.email}</span>
              </div>
              <div>
                <span className="text-slate-400">Chosen Major: </span>
                <strong className="text-cyan-600 dark:text-cyan-400">
                  {approvingReg.specialization_major || 'Marketing'}
                  {approvingReg.specialization_minor ? ` / ${approvingReg.specialization_minor}` : ''}
                </strong>
              </div>
            </div>

            {/* Academic Profile Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                approveMutation.mutate({ regId: approvingReg.id, data: approvalForm });
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Program */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Program <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={approvalForm.program_id}
                    onChange={(e) => handleProgramChange(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="" disabled>Select Program</option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Batch */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Batch <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={approvalForm.batch_id}
                    onChange={(e) => setApprovalForm((f) => ({ ...f, batch_id: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="" disabled>Select Batch</option>
                    {availableBatches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Division / Section */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Division / Section
                  </label>
                  <select
                    value={approvalForm.division_id}
                    onChange={(e) => setApprovalForm((f) => ({ ...f, division_id: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">No Division Assigned (Unassigned)</option>
                    {availableDivisions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Trimester */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Trimester / Term
                  </label>
                  <select
                    value={approvalForm.trimester}
                    onChange={(e) => setApprovalForm((f) => ({ ...f, trimester: parseInt(e.target.value, 10) || 1 }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  >
                    {[1, 2, 3, 4, 5, 6].map((num) => (
                      <option key={num} value={num}>
                        Trimester {num}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Roll Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Roll Number (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 26PGDM042"
                    value={approvalForm.roll_no}
                    onChange={(e) => setApprovalForm((f) => ({ ...f, roll_no: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Enrollment Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Enrollment Number (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. EN2026042"
                    value={approvalForm.enrollment_no}
                    onChange={(e) => setApprovalForm((f) => ({ ...f, enrollment_no: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Major Specialization */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Major Specialization
                  </label>
                  <select
                    value={approvalForm.specialization_major}
                    onChange={(e) => setApprovalForm((f) => ({ ...f, specialization_major: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  >
                    {SPECIALIZATIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Minor Specialization */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Minor Specialization (Optional)
                  </label>
                  <select
                    value={approvalForm.specialization_minor}
                    onChange={(e) => setApprovalForm((f) => ({ ...f, specialization_minor: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">None / Not Decided</option>
                    {SPECIALIZATIONS.filter((s) => s !== approvalForm.specialization_major).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setApprovingReg(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={approveMutation.isPending || !approvalForm.program_id || !approvalForm.batch_id}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-2 transition-all cursor-pointer"
                >
                  {approveMutation.isPending ? 'Enrolling...' : 'Approve & Enroll Student'}
                  <CheckCircle2 className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Reject Registration</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Please state a reason for rejecting <strong>{rejectingReg.full_name}</strong>'s application. This reason will be visible to the student when they log in.
            </p>
            <textarea
              className="w-full h-24 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
              placeholder="Reason for rejection..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setRejectingReg(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={() => rejectMutation.mutate({ regId: rejectingReg.id, reason: rejectionReason })}
                disabled={rejectMutation.isPending || !rejectionReason.trim()}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm disabled:opacity-50"
              >
                {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
