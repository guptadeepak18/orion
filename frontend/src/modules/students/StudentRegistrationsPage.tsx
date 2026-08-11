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
  Mail,
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
  is_email_verified: boolean;
  status: string;
  rejection_reason?: string;
  created_at: string;
}

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
  const [actionError, setActionError] = useState<string | null>(null);

  // Fetch registrations
  const { data: registrations = [], isLoading } = useQuery<Registration[]>({
    queryKey: ['student-registrations', statusFilter],
    queryFn: async () => {
      const url = statusFilter ? `/student-registrations?status=${statusFilter}` : '/student-registrations';
      const res = await api.get(url);
      return res.data.data;
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (regId: string) => {
      const res = await api.post(`/student-registrations/${regId}/approve`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-registrations'] });
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
      reg.full_name.toLowerCase().includes(term) ||
      reg.email.toLowerCase().includes(term) ||
      (reg.prn_number && reg.prn_number.toLowerCase().includes(term))
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_verification':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
            <Mail className="h-3 w-3" /> Email Unverified
          </span>
        );
      case 'pending_review':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/20">
            <Clock className="h-3 w-3 animate-spin" /> Awaiting Review
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" /> Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20">
            <XCircle className="h-3 w-3" /> Rejected
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {!embedded && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Student Registration Approvals</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Review and approve student self-registration requests. Approved students gain access to the application.
            </p>
          </div>
        </div>
      )}

      {actionError && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Tabs & Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-2xl">
        <div className="flex items-center space-x-1 overflow-x-auto">
          {[
            { id: 'pending_review', label: 'Awaiting Review' },
            { id: 'pending_verification', label: 'Unverified Email' },
            { id: 'approved', label: 'Approved' },
            { id: 'rejected', label: 'Rejected' },
            { id: '', label: 'All' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-cyan-600 dark:bg-cyan-500 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search name, email, PRN..."
            className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 w-full sm:w-64"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Registrations Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
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
                  <th className="px-6 py-4">Student Name</th>
                  <th className="px-6 py-4">Official Email</th>
                  <th className="px-6 py-4">PRN Number</th>
                  <th className="px-6 py-4">Mobile Number</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Submitted On</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredList.map((reg) => (
                  <tr key={reg.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900 dark:text-white">{reg.full_name}</div>
                      {reg.ug_degree && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">{reg.ug_degree} ({reg.ug_score} {reg.ug_score_type?.toUpperCase()})</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-mono text-xs">{reg.email}</td>
                    <td className="px-6 py-4 text-slate-900 dark:text-white font-semibold">{reg.prn_number || 'N/A'}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{reg.mobile_number}</td>
                    <td className="px-6 py-4">{getStatusBadge(reg.status)}</td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {new Date(reg.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => setSelectedReg(reg)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" /> View
                      </button>
                      {reg.status === 'pending_review' && (
                        <>
                          <button
                            onClick={() => approveMutation.mutate(reg.id)}
                            disabled={approveMutation.isPending}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                          </button>
                          <button
                            onClick={() => {
                              setRejectingReg(reg);
                              setRejectionReason('');
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors"
                          >
                            <XCircle className="h-3.5 w-3.5" /> Reject
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details Slide-in Modal */}
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
                <p className="font-medium text-slate-900 dark:text-white mt-0.5">{selectedReg.gender || 'N/A'} • {selectedReg.blood_group || 'N/A'}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <p className="text-xs text-slate-400 uppercase font-semibold">Parents</p>
                <p className="font-medium text-slate-900 dark:text-white mt-0.5">Father: {selectedReg.father_name || 'N/A'} | Mother: {selectedReg.mother_name || 'N/A'}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 col-span-2">
                <p className="text-xs text-slate-400 uppercase font-semibold">Emergency Contact</p>
                <p className="font-medium text-slate-900 dark:text-white mt-0.5">
                  {selectedReg.emergency_contact_name} ({selectedReg.emergency_contact_relation}) — {selectedReg.emergency_contact_number}
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
                    onClick={() => approveMutation.mutate(selectedReg.id)}
                    disabled={approveMutation.isPending}
                    className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm"
                  >
                    {approveMutation.isPending ? 'Approving...' : 'Approve Student'}
                  </button>
                </>
              )}
            </div>
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
