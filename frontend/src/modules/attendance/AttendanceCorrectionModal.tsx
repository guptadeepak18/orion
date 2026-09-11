import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X,
  FileCheck2,
  AlertCircle,
  Clock,
  Calendar,
  MapPin,
  BookOpen,
  UploadCloud,
  Layers,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useModalScrollLock } from '../../lib/useModalScrollLock';

interface AttendanceCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  attendanceId: string;
  sessionId?: string;
  initialActivityId?: string;
  studentId?: string;
  studentName?: string;
  studentPrn?: string;
  subjectName?: string;
  subjectCode?: string;
  sessionDate?: string;
  sessionTime?: string;
  venue?: string;
  currentStatus: string;
}

export const AttendanceCorrectionModal: React.FC<AttendanceCorrectionModalProps> = ({
  isOpen,
  onClose,
  attendanceId,
  sessionId,
  initialActivityId,
  studentId,
  studentName,
  studentPrn,
  subjectName,
  subjectCode,
  sessionDate,
  sessionTime,
  venue,
  currentStatus,
}) => {
  const queryClient = useQueryClient();
  const [requestedStatus, setRequestedStatus] = useState<string>('present');
  const [reasonCategory, setReasonCategory] = useState<string>('biometric_error');
  const [reasonDetails, setReasonDetails] = useState<string>('');
  const [documentUrl, setDocumentUrl] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([]);

  // Fetch Hyperbuild activities for the session if sessionId is provided
  const { data: sessionActivities = [], isLoading: isLoadingActivities } = useQuery({
    queryKey: ['hyperbuild_session_activities', sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      try {
        const res = await api.get(`/hyperbuild/sessions/${sessionId}/activities`);
        const acts = res.data?.activities || res.data?.data?.activities || [];
        return (acts as any[]).sort((a: any, b: any) => (a.activity_no || 0) - (b.activity_no || 0));
      } catch (err) {
        return [];
      }
    },
    enabled: !!sessionId && isOpen,
  });

  // Pre-select activities:
  // - If initialActivityId is provided (student clicked Dispute for a specific activity), pre-select only that activity
  // - Else pre-select all unverified/eligible activities
  React.useEffect(() => {
    if (!sessionActivities || sessionActivities.length === 0) {
      setSelectedActivityIds([]);
      return;
    }
    if (initialActivityId) {
      setSelectedActivityIds([initialActivityId]);
    } else {
      const unverified = sessionActivities
        .filter((act: any) => !act.is_verified_by_student)
        .map((act: any) => act.id);
      setSelectedActivityIds(unverified.length > 0 ? unverified : sessionActivities.map((act: any) => act.id));
    }
  }, [sessionActivities, initialActivityId]);

  const toggleActivity = (actId: string) => {
    setSelectedActivityIds((prev) =>
      prev.includes(actId) ? prev.filter((id) => id !== actId) : [...prev, actId]
    );
  };

  const selectAllActivities = () => {
    setSelectedActivityIds(sessionActivities.map((a: any) => a.id));
  };

  const clearAllActivities = () => {
    setSelectedActivityIds([]);
  };

  const createCorrectionMutation = useMutation({
    mutationFn: async (payload: {
      attendance_id: string;
      session_id?: string;
      student_id?: string;
      requested_status: string;
      reason: string;
      document_url?: string;
      activity_ids?: string[];
    }) => {
      const res = await api.post('/attendance/corrections', payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance_corrections_list'] });
      queryClient.invalidateQueries({ queryKey: ['student_attendance_dossier'] });
      queryClient.invalidateQueries({ queryKey: ['attendance_allocated_sessions'] });
      queryClient.invalidateQueries({ queryKey: ['session_attendance_sheet'] });
      queryClient.invalidateQueries({ queryKey: ['subject_attendance_summary'] });
      onClose();
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.detail || 'Failed to submit correction request.');
    },
  });

  useModalScrollLock({ isOpen, onClose });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (sessionActivities.length > 0 && selectedActivityIds.length === 0) {
      setErrorMsg('Please select at least one HyperBuild activity for this attendance dispute.');
      return;
    }

    if (!reasonDetails.trim()) {
      setErrorMsg('Please provide a detailed explanation or reason for the attendance correction.');
      return;
    }

    const fullReason = `[Category: ${reasonCategory.replace('_', ' ').toUpperCase()}] ${reasonDetails.trim()}`;

    createCorrectionMutation.mutate({
      attendance_id: attendanceId,
      session_id: sessionId || undefined,
      student_id: studentId || undefined,
      requested_status: requestedStatus,
      reason: fullReason,
      document_url: documentUrl.trim() || undefined,
      activity_ids: selectedActivityIds.length > 0 ? selectedActivityIds : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm overscroll-contain">
      <div className="w-full h-[92dvh] sm:h-auto sm:max-h-[90dvh] sm:max-w-xl rounded-t-[2rem] sm:rounded-3xl flex flex-col overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl transition-all duration-200 overscroll-contain">
        {/* Header */}
        <div className="sticky top-0 z-20 px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0 pr-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20 shrink-0">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                Raise Attendance Correction
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Submit an official attendance dispute or correction
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6 space-y-4 text-xs touch-scroll">
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Session Overview Card */}
            <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" /> {subjectName || 'Academic Course'}
                </span>
                {subjectCode && (
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-indigo-200 dark:border-indigo-800">
                    {subjectCode}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-300 pt-1">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>{sessionDate || 'Date N/A'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span>{sessionTime || 'Regular Slot'}</span>
                </div>
                {venue && (
                  <div className="flex items-center gap-1.5 col-span-2">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span>Venue: {venue}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Student & Status Info */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">{studentName || 'Self'}</p>
                {studentPrn && <p className="font-mono text-[10px] text-slate-400">PRN: {studentPrn}</p>}
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Current Status
                </span>
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase mt-0.5 ${
                    currentStatus === 'present'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : currentStatus === 'absent'
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}
                >
                  {currentStatus}
                </span>
              </div>
            </div>

            {/* HyperBuild Activities Checklist (if applicable) */}
            {isLoadingActivities ? (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 text-center text-slate-500">
                Loading session activities...
              </div>
            ) : sessionActivities && sessionActivities.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-indigo-500" />
                    Applicable HyperBuild Activities <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllActivities}
                      className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300 dark:text-slate-700 text-[10px]">|</span>
                    <button
                      type="button"
                      onClick={clearAllActivities}
                      className="text-[10px] text-slate-400 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {sessionActivities.map((act: any) => {
                    const isSelected = selectedActivityIds.includes(act.id);
                    return (
                      <label
                        key={act.id}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 text-slate-900 dark:text-white'
                            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleActivity(act.id)}
                          className="mt-0.5 rounded accent-indigo-600"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white">
                              Act #{act.activity_no}: {act.title}
                            </span>
                            {act.is_verified_by_student ? (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                Verified
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                Unverified
                              </span>
                            )}
                          </div>
                          {act.description && (
                            <p className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {act.description}
                            </p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Requested Status */}
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-700 dark:text-slate-300">
                Requested Status Change <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'present', label: 'Mark Present' },
                  { value: 'od_duty', label: 'On Official Duty' },
                  { value: 'excused', label: 'Excused Leave' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRequestedStatus(opt.value)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      requestedStatus === opt.value
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reason Category */}
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-700 dark:text-slate-300">
                Reason Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={reasonCategory}
                onChange={(e) => setReasonCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500 font-medium"
              >
                <option value="attendance_marked_incorrectly">Attended Class but Marked Absent</option>
                <option value="technical_glitch">Technical Glitch / Device Connectivity Failure</option>
                <option value="faculty_correction">Faculty Marking Inadvertency / Proxy Correction</option>
                <option value="medical_leave">Medical Leave / Doctor's Certificate Submitted</option>
                <option value="official_duty">Institutional Representation / Competition / OD</option>
                <option value="placement_drive">Campus Placement Interview / Pre-Placement Talk</option>
                <option value="other">Other Legitimate Academic Reason</option>
              </select>
            </div>

            {/* Detailed Statement */}
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-700 dark:text-slate-300">
                Reason & Remarks <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="State the justification for attendance correction..."
                value={reasonDetails}
                onChange={(e) => setReasonDetails(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 resize-none"
              />
            </div>

            {/* Supporting Proof / Document Link */}
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-700 dark:text-slate-300">
                Supporting Document URL <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <UploadCloud className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="url"
                  placeholder="https://drive.google.com/... or document link"
                  value={documentUrl}
                  onChange={(e) => setDocumentUrl(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="sticky bottom-0 z-20 px-5 py-3 sm:px-6 sm:py-4 border-t border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createCorrectionMutation.isPending}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <FileCheck2 className="h-4 w-4" />
              {createCorrectionMutation.isPending ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
