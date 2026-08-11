import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, AlertCircle, Edit2, Save, X, Lock, CheckCircle2, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', 'Unknown'];

interface AuthMeResponse {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  is_active: boolean;
  roles: string[];
}

export const StudentProfilePage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user, updateUser } = useAuthStore();
  const isStudentRole = user?.roles?.includes('student') || false;
  const [isEditing, setIsEditing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { data: profileSummary, isLoading: isLoadingStudentProfile } = useQuery({
    queryKey: ['my-student-profile'],
    queryFn: async () => {
      const res = await api.get('/students/me');
      return res.data.data;
    },
    enabled: isStudentRole,
  });

  const { data: authMe, isLoading: isLoadingAuthProfile } = useQuery<AuthMeResponse>({
    queryKey: ['auth_me_profile'],
    queryFn: async () => {
      const res = await api.get('/auth/me');
      return res.data.data;
    },
    enabled: !isStudentRole,
  });

  const student = profileSummary?.student;
  const accountProfile = authMe || user;
  const isLoading = isStudentRole ? isLoadingStudentProfile : isLoadingAuthProfile;

  const [studentForm, setStudentForm] = useState({
    mobile_number: '',
    email_personal: '',
    alternate_contact_number: '',
    emergency_contact_name: '',
    emergency_contact_number: '',
    emergency_contact_relation: '',
    blood_group: 'O+',
  });

  const [accountForm, setAccountForm] = useState({
    full_name: '',
    phone: '',
  });

  const startEdit = () => {
    if (isStudentRole) {
      if (!student) return;
      setStudentForm({
        mobile_number: student.mobile_number || '',
        email_personal: student.email_personal || '',
        alternate_contact_number: student.alternate_contact_number || '',
        emergency_contact_name: student.emergency_contact_name || '',
        emergency_contact_number: student.emergency_contact_number || '',
        emergency_contact_relation: student.emergency_contact_relation || '',
        blood_group: student.blood_group || 'O+',
      });
    } else {
      if (!accountProfile) return;
      setAccountForm({
        full_name: accountProfile.full_name || '',
        phone: accountProfile.phone || '',
      });
    }
    setIsEditing(true);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const updateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const endpoint = isStudentRole ? '/students/me' : '/auth/me';
      const res = await api.put(endpoint, payload);
      return res.data.data;
    },
    onSuccess: (updated) => {
      if (isStudentRole) {
        queryClient.invalidateQueries({ queryKey: ['my-student-profile'] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['auth_me_profile'] });
        updateUser({
          full_name: updated.full_name,
          phone: updated.phone,
          email: updated.email,
          roles: updated.roles,
        });
      }
      setIsEditing(false);
      setSuccessMsg('Personal details updated successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.detail || 'Failed to update profile.');
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (isStudentRole) {
      updateMutation.mutate(studentForm);
      return;
    }
    updateMutation.mutate({
      full_name: accountForm.full_name.trim(),
      phone: accountForm.phone.trim() || null,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isStudentRole && !student) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl">
        <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Profile Not Found</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          No student record is linked to your account. If you just registered, your application might still be under admin review.
        </p>
      </div>
    );
  }

  if (!isStudentRole && !accountProfile) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl">
        <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Profile Not Found</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          We could not load your profile details right now. Please try refreshing the page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-cyan-600 to-indigo-700 p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="h-16 w-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-2xl font-bold">
              {(isStudentRole ? student?.full_name : accountProfile?.full_name)?.charAt(0) || 'U'}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{isStudentRole ? student?.full_name : accountProfile?.full_name}</h1>
              <p className="text-cyan-100 text-sm flex items-center gap-2 mt-1">
                {isStudentRole ? (
                  <>
                    <span>PRN: <strong className="text-white">{student?.prn_number || 'N/A'}</strong></span>
                    <span>•</span>
                    <span>{student?.program_name || 'Program Not Assigned'}</span>
                  </>
                ) : (
                  <>
                    <span>{accountProfile?.email}</span>
                    <span>•</span>
                    <span>Role: {(accountProfile?.roles || []).join(', ') || 'User'}</span>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!isEditing ? (
              <button
                onClick={startEdit}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-semibold text-sm transition-all shadow-lg"
              >
                <Edit2 className="h-4 w-4" /> Edit Profile
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(false)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/40 hover:bg-slate-900/60 text-white font-semibold text-sm transition-all"
              >
                <X className="h-4 w-4" /> Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-sm">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Editable Personal Section */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
            <div className="flex items-center space-x-2">
              <User className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {isStudentRole ? 'Personal & Emergency Details' : 'Personal Account Details'}
              </h2>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/20">
              {isStudentRole ? 'Editable by Student' : 'Editable by User'}
            </span>
          </div>

          {isStudentRole ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Mobile Number</label>
              {isEditing ? (
                <input
                  type="text"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  value={studentForm.mobile_number}
                  onChange={(e) => setStudentForm({ ...studentForm, mobile_number: e.target.value })}
                  required
                />
              ) : (
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{student?.mobile_number || '—'}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Personal Email</label>
              {isEditing ? (
                <input
                  type="email"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  value={studentForm.email_personal}
                  onChange={(e) => setStudentForm({ ...studentForm, email_personal: e.target.value })}
                />
              ) : (
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{student?.email_personal || '—'}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Alternate Contact Number</label>
              {isEditing ? (
                <input
                  type="text"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  value={studentForm.alternate_contact_number}
                  onChange={(e) => setStudentForm({ ...studentForm, alternate_contact_number: e.target.value })}
                />
              ) : (
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{student?.alternate_contact_number || '—'}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Blood Group</label>
              {isEditing ? (
                <select
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  value={studentForm.blood_group}
                  onChange={(e) => setStudentForm({ ...studentForm, blood_group: e.target.value })}
                >
                  {BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              ) : (
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{student?.blood_group || '—'}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Emergency Contact Name</label>
              {isEditing ? (
                <input
                  type="text"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  value={studentForm.emergency_contact_name}
                  onChange={(e) => setStudentForm({ ...studentForm, emergency_contact_name: e.target.value })}
                />
              ) : (
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{student?.emergency_contact_name || '—'}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Emergency Contact Number & Relation</label>
              {isEditing ? (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Phone number"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                    value={studentForm.emergency_contact_number}
                    onChange={(e) => setStudentForm({ ...studentForm, emergency_contact_number: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="Relation (e.g. Parent)"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                    value={studentForm.emergency_contact_relation}
                    onChange={(e) => setStudentForm({ ...studentForm, emergency_contact_relation: e.target.value })}
                  />
                </div>
              ) : (
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {student?.emergency_contact_number ? `${student.emergency_contact_number} (${student.emergency_contact_relation || 'N/A'})` : '—'}
                </p>
              )}
            </div>
          </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Full Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                    value={accountForm.full_name}
                    onChange={(e) => setAccountForm({ ...accountForm, full_name: e.target.value })}
                    required
                  />
                ) : (
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{accountProfile?.full_name || '—'}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Phone Number</label>
                {isEditing ? (
                  <input
                    type="text"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                    value={accountForm.phone}
                    onChange={(e) => setAccountForm({ ...accountForm, phone: e.target.value })}
                    placeholder="Optional"
                  />
                ) : (
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{accountProfile?.phone || '—'}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Email Address</label>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{accountProfile?.email || '—'}</p>
              </div>
            </div>
          )}

          {isEditing && (
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-sm transition-colors disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </form>

      {/* Read-only Academic & System Details */}
      {isStudentRole ? (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Academic & Program Details</h2>
          </div>
          <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            <Lock className="h-3 w-3" /> Managed by Admin
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Official Email</p>
            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{student.email_official || student.email || '—'}</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Program</p>
            <p className="text-sm font-medium text-slate-900 dark:text-white">{student.program_name || 'Not assigned'}</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Batch</p>
            <p className="text-sm font-medium text-slate-900 dark:text-white">{student.batch_name || 'Not assigned'}</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Division</p>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              {student.divisions && student.divisions.length > 0
                ? student.divisions.map((d: any) => d.name).join(', ')
                : 'Not assigned'}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Trimester</p>
            <p className="text-sm font-medium text-slate-900 dark:text-white">Trimester {student.trimester || 1}</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">CGPA</p>
            <p className="text-sm font-medium text-slate-900 dark:text-white">{student.cgpa ? student.cgpa.toFixed(2) : 'N/A'}</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Major Specialization</p>
            <p className="text-sm font-medium text-slate-900 dark:text-white">{student.specialization_major || 'None'}</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Minor Specialization</p>
            <p className="text-sm font-medium text-slate-900 dark:text-white">{student.specialization_minor || 'None'}</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Parents</p>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              {student.father_name ? `F: ${student.father_name}` : ''}{student.mother_name ? ` | M: ${student.mother_name}` : ''}
            </p>
          </div>
        </div>
      </div>
      ) : (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Account & Access Details</h2>
          </div>
          <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            <Lock className="h-3 w-3" /> Role Managed by Admin
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Email</p>
            <p className="text-sm font-medium text-slate-900 dark:text-white">{accountProfile?.email || '—'}</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Assigned Roles</p>
            <p className="text-sm font-medium text-slate-900 dark:text-white">{(accountProfile?.roles || []).join(', ') || '—'}</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Status</p>
            <p className="text-sm font-medium text-slate-900 dark:text-white">{accountProfile?.is_active ? 'Active' : 'Inactive'}</p>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};
