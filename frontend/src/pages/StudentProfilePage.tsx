import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User,
  AlertCircle,
  Edit2,
  Save,
  X,
  CheckCircle2,
  Camera,
  Trash2,
  Upload,
  GraduationCap,
  Award,
  BookOpen,
  Users,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', 'Unknown'];

interface AuthMeResponse {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  avatar_url?: string | null;
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
  const [uploadingAvatar, setUploadingAvatar] = useState<boolean>(false);
  const avatarFileRef = useRef<HTMLInputElement>(null);

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
          avatar_url: updated.avatar_url,
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

  // Avatar Upload Handler
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Avatar image must be smaller than 5MB.');
      return;
    }

    setUploadingAvatar(true);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result as string;
        const res = await api.put('/auth/me/avatar', { avatar_base64: base64Data });
        const newAvatarUrl = res.data?.data?.avatar_url || base64Data;

        updateUser({ avatar_url: newAvatarUrl });
        queryClient.invalidateQueries({ queryKey: ['auth_me_profile'] });
        queryClient.invalidateQueries({ queryKey: ['my-student-profile'] });
        setSuccessMsg('Profile photo updated successfully!');
        setTimeout(() => setSuccessMsg(null), 3000);
      } catch (err: any) {
        setErrorMsg(err.response?.data?.detail || 'Failed to upload profile photo.');
      } finally {
        setUploadingAvatar(false);
      }
    };
    reader.onerror = () => {
      setErrorMsg('Could not read image file.');
      setUploadingAvatar(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = async () => {
    try {
      setUploadingAvatar(true);
      await api.delete('/auth/me/avatar');
      updateUser({ avatar_url: null });
      queryClient.invalidateQueries({ queryKey: ['auth_me_profile'] });
      queryClient.invalidateQueries({ queryKey: ['my-student-profile'] });
      setSuccessMsg('Profile photo removed.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      updateUser({ avatar_url: null });
    } finally {
      setUploadingAvatar(false);
    }
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

  const currentAvatarUrl = user?.avatar_url || (accountProfile as any)?.avatar_url;
  const currentFullName = isStudentRole ? student?.full_name : accountProfile?.full_name;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={avatarFileRef}
        onChange={handleAvatarUpload}
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
      />

      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-700 p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center space-x-5">
            {/* Interactive Avatar Container */}
            <div className="relative group/avatar">
              <div className="h-20 w-20 rounded-2xl overflow-hidden bg-white/10 backdrop-blur-md border-2 border-white/30 flex items-center justify-center text-3xl font-black shadow-lg">
                {currentAvatarUrl ? (
                  <img
                    src={currentAvatarUrl}
                    alt={currentFullName || 'Avatar'}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{currentFullName?.charAt(0) || 'U'}</span>
                )}
                {uploadingAvatar && (
                  <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {/* Hover Camera Overlay Button */}
              <button
                type="button"
                onClick={() => avatarFileRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 bg-slate-950/60 rounded-2xl flex flex-col items-center justify-center text-white opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-150 cursor-pointer"
                title="Change Avatar"
              >
                <Camera className="h-5 w-5" />
                <span className="text-[10px] font-bold mt-1">Upload</span>
              </button>
            </div>

            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight">{currentFullName}</h1>
                {currentAvatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="text-xs px-2 py-0.5 rounded-lg bg-white/15 hover:bg-white/25 text-white/90 transition-colors flex items-center gap-1 cursor-pointer"
                    title="Remove custom photo"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Remove</span>
                  </button>
                )}
                {isStudentRole && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-400/20 text-emerald-100 border border-emerald-300/30">
                    Active Student
                  </span>
                )}
              </div>
              <p className="text-cyan-100 text-sm flex items-center gap-2 mt-1.5 flex-wrap">
                {isStudentRole ? (
                  <>
                    <span>PRN: <strong className="text-white font-mono">{student?.prn_number || 'N/A'}</strong></span>
                    <span>•</span>
                    <span>{student?.program_name || 'Program Not Assigned'}</span>
                    {student?.batch_name && (
                      <>
                        <span>•</span>
                        <span className="text-cyan-200">{student?.batch_name}</span>
                      </>
                    )}
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
            <button
              type="button"
              onClick={() => avatarFileRef.current?.click()}
              disabled={uploadingAvatar}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 text-white font-semibold text-xs transition-all shadow-sm cursor-pointer"
            >
              <Upload className="h-4 w-4" />
              <span>{uploadingAvatar ? 'Uploading...' : 'Upload Photo'}</span>
            </button>

            {!isEditing ? (
              <button
                type="button"
                onClick={startEdit}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 text-white font-semibold text-sm transition-all shadow-lg cursor-pointer"
              >
                <Edit2 className="h-4 w-4" /> Edit Profile
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/50 hover:bg-slate-900/70 text-white font-semibold text-sm transition-all cursor-pointer"
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

      {/* STUDENT DETAILED PROFILE VIEW */}
      {isStudentRole && student && (
        <div className="space-y-6">
          {/* 1. Academic & Institutional Enrollment Details (Read-only) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="h-8 w-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <GraduationCap className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Academic & Institutional Enrollment
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Official registration records managed by the Academic Office
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                <Lock className="h-3 w-3" /> Managed by Admin
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">PRN Number</span>
                <p className="text-sm font-black font-mono text-cyan-700 dark:text-cyan-400">{student.prn_number || '—'}</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Roll / Enrollment No.</span>
                <p className="text-sm font-bold font-mono text-slate-800 dark:text-slate-200">{student.roll_no || student.enrollment_no || '—'}</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Official College Email</span>
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate" title={student.email_official || student.email}>
                  {student.email_official || student.email || '—'}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Program</span>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{student.program_name || 'PGDM'}</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Academic Batch</span>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{student.batch_name || 'Batch 2026'}</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Division / Section</span>
                <p className="text-sm font-bold text-indigo-700 dark:text-indigo-400">
                  {student.division_names && student.division_names.length > 0 ? student.division_names.join(', ') : 'Assigned to Batch'}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Current Term</span>
                <p className="text-sm font-bold text-slate-900 dark:text-white">Trimester {student.trimester || 1}</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Major Specialization</span>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{student.specialization_major || 'General Management'}</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Minor Specialization</span>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{student.specialization_minor || 'None'}</p>
              </div>
            </div>
          </div>

          {/* 2. Academic Performance & Attendance Metrics (Read-only) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="h-8 w-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <Award className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Performance & Attendance Compliance
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Real-time academic standing and attendance percentage
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                <ShieldCheck className="h-3 w-3 text-emerald-500" /> Auto-Calculated
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 space-y-1">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">Overall Attendance</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {student.attendance_percentage ?? 100.0}%
                  </span>
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    {(student.attendance_percentage ?? 100.0) >= 75 ? '✓ Compliant' : '⚠️ Risk'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {student.total_sessions_attended ?? 0} attended of {student.total_sessions_conducted ?? 0} conducted
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 space-y-1">
                <span className="text-xs font-bold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider">Cumulative CGPA</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                    {student.cgpa ? student.cgpa.toFixed(2) : '0.00'}
                  </span>
                  <span className="text-xs text-slate-400">/ 10.0</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Cumulative Grade Point Average</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Enrollment Status</span>
                <div className="flex items-center gap-2 pt-0.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-base font-bold text-slate-900 dark:text-white capitalize">{student.status || 'Active'}</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Registered and in good standing</p>
              </div>
            </div>
          </div>

          {/* 3. Undergraduate & Family Background (Read-only / Verified) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Undergraduate Background */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="h-7 w-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                  <BookOpen className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Undergraduate Background</h3>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-50 dark:border-slate-800">
                  <span className="text-slate-500">Degree Completed</span>
                  <span className="font-bold text-slate-900 dark:text-white">{student.ug_degree || 'B.Com / BBA / B.Tech'}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-50 dark:border-slate-800">
                  <span className="text-slate-500">Graduation Score Type</span>
                  <span className="font-bold uppercase text-slate-900 dark:text-white">{student.ug_score_type || 'CGPA'}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500">Graduation Score</span>
                  <span className="font-bold font-mono text-cyan-600 dark:text-cyan-400">
                    {student.ug_score ? `${student.ug_score} ${student.ug_score_type === 'percentage' ? '%' : 'CGPA'}` : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Family & Personal Information */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="h-7 w-7 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                  <Users className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Family Information</h3>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-50 dark:border-slate-800">
                  <span className="text-slate-500">Father's Name</span>
                  <span className="font-bold text-slate-900 dark:text-white">{student.father_name || '—'}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-50 dark:border-slate-800">
                  <span className="text-slate-500">Mother's Name</span>
                  <span className="font-bold text-slate-900 dark:text-white">{student.mother_name || '—'}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500">Gender</span>
                  <span className="font-bold text-slate-900 dark:text-white">{student.gender || 'Male'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Personal Contact & Emergency Information (EDITABLE) */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
            <div className="flex items-center space-x-2.5">
              <div className="h-8 w-8 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold">
                <User className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {isStudentRole ? 'Personal Contact & Emergency Information' : 'Personal Account Details'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isStudentRole ? 'Keep your contact numbers and emergency contacts up to date' : 'Manage your name and phone number'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                isEditing
                  ? 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-500/30'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
              }`}>
                {isEditing ? '✏️ Editing Mode' : '👁️ View Mode'}
              </span>
              {!isEditing && (
                <button
                  type="button"
                  onClick={startEdit}
                  className="px-3 py-1 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-700 text-white transition-colors flex items-center gap-1"
                >
                  <Edit2 className="h-3 w-3" /> Edit
                </button>
              )}
            </div>
          </div>

          {isStudentRole ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Official Mobile Number
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    required
                    value={studentForm.mobile_number}
                    onChange={(e) => setStudentForm({ ...studentForm, mobile_number: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                    placeholder="e.g. 9876543210"
                  />
                ) : (
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {student?.mobile_number || student?.phone || 'Not provided'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Personal Email Address
                </label>
                {isEditing ? (
                  <input
                    type="email"
                    required
                    value={studentForm.email_personal}
                    onChange={(e) => setStudentForm({ ...studentForm, email_personal: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                    placeholder="e.g. personal@gmail.com"
                  />
                ) : (
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {student?.email_personal || 'Not provided'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Alternate Contact Number
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={studentForm.alternate_contact_number}
                    onChange={(e) =>
                      setStudentForm({ ...studentForm, alternate_contact_number: e.target.value })
                    }
                    placeholder="Optional alternate phone"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                  />
                ) : (
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {student?.alternate_contact_number || 'None'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Blood Group
                </label>
                {isEditing ? (
                  <select
                    value={studentForm.blood_group}
                    onChange={(e) => setStudentForm({ ...studentForm, blood_group: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                  >
                    {BLOOD_GROUPS.map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {student?.blood_group || 'O+'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Emergency Contact Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    required
                    value={studentForm.emergency_contact_name}
                    onChange={(e) =>
                      setStudentForm({ ...studentForm, emergency_contact_name: e.target.value })
                    }
                    placeholder="e.g. Ramesh Jha"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                  />
                ) : (
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {student?.emergency_contact_name || 'Not provided'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Emergency Contact Number
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    required
                    value={studentForm.emergency_contact_number}
                    onChange={(e) =>
                      setStudentForm({ ...studentForm, emergency_contact_number: e.target.value })
                    }
                    placeholder="e.g. 9876543210"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                  />
                ) : (
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {student?.emergency_contact_number || 'Not provided'}
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Emergency Relation
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    required
                    value={studentForm.emergency_contact_relation}
                    onChange={(e) =>
                      setStudentForm({ ...studentForm, emergency_contact_relation: e.target.value })
                    }
                    placeholder="e.g. Father / Mother / Guardian"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                  />
                ) : (
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {student?.emergency_contact_relation || 'Parent'}
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* NON-STUDENT PROFILE FORM */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Full Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    required
                    value={accountForm.full_name}
                    onChange={(e) => setAccountForm({ ...accountForm, full_name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                  />
                ) : (
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {accountProfile?.full_name || 'N/A'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Phone Number
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={accountForm.phone}
                    onChange={(e) => setAccountForm({ ...accountForm, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                  />
                ) : (
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {accountProfile?.phone || 'Not provided'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Account Email (Read-only)
                </label>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {accountProfile?.email}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Assigned Roles
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(accountProfile?.roles || []).map((r) => (
                    <span
                      key={r}
                      className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800"
                    >
                      {r.replace('_', ' ').toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {isEditing && (
            <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                <Save className="h-4 w-4" />
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};
