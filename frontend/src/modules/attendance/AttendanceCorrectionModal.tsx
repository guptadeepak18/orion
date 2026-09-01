import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  FileCheck2,
  AlertCircle,
  Clock,
  Calendar,
  MapPin,
  BookOpen,
  UploadCloud,
} from 'lucide-react';
import { api } from '../../lib/api';

interface AttendanceCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  attendanceId: string;
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

  const createCorrectionMutation = useMutation({
    mutationFn: async (payload: {
      attendance_id: string;
      requested_status: string;
      reason: string;
      document_url?: string;
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

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!reasonDetails.trim()) {
      setErrorMsg('Please provide a detailed explanation or reason for the attendance correction.');
      return;
    }

    const fullReason = `[Category: ${reasonCategory.replace('_', ' ').toUpperCase()}] ${reasonDetails.trim()}`;

    createCorrectionMutation.mutate({
      attendance_id: attendanceId,
      requested_status: requestedStatus,
      reason: fullReason,
      document_url: documentUrl.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Raise Attendance Correction Request
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
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
                <span>{sessionTime || 'Scheduled Slot'}</span>
              </div>
              {venue && (
                <div className="flex items-center gap-1.5 col-span-2">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  <span>Venue: {venue}</span>
                </div>
              )}
            </div>

            {studentName && (
              <div className="pt-2 border-t border-indigo-100/80 dark:border-indigo-900/40 flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-900 dark:text-white">
                  {studentName} {studentPrn ? `(${studentPrn})` : ''}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 uppercase">
                  Currently: {currentStatus}
                </span>
              </div>
            )}
          </div>

          {/* Requested Status */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 dark:text-slate-300">
              Requested Corrected Status <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'present', label: 'Present' },
                { id: 'excused', label: 'Excused' },
                { id: 'od_duty', label: 'On Duty (OD)' },
              ].map((st) => (
                <button
                  type="button"
                  key={st.id}
                  onClick={() => setRequestedStatus(st.id)}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    requestedStatus === st.id
                      ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 font-bold ring-2 ring-indigo-500/20'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300 font-semibold'
                  }`}
                >
                  <p className="font-bold text-xs">{st.label}</p>
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
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
            >
              <option value="biometric_error">Biometric Device / Scanner Error</option>
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

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createCorrectionMutation.isPending}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
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
