import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Zap, CheckCircle2, AlertCircle,
  X, Lock, Radio, Upload, Link as LinkIcon, FileText
} from 'lucide-react';
import { api } from '../../lib/api';
import { useSessionWebSocket } from '../../lib/useSessionWebSocket';

interface StudentHyperbuildModalProps {
  session: any;
  onClose: () => void;
}

export const StudentHyperbuildModal: React.FC<StudentHyperbuildModalProps> = ({ session, onClose }) => {
  const [enteredKey, setEnteredKey] = useState('');
  const [submissionUrl, setSubmissionUrl] = useState('');
  const [submissionText, setSubmissionText] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ file_name: string; file_url: string; file_size?: number } | null>(null);
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [verifError, setVerifError] = useState<string | null>(null);
  const [verifSuccess, setVerifSuccess] = useState<string | null>(null);

  // Real-time WebSocket connection for instant classroom pushes
  const { isConnected: isWsLive } = useSessionWebSocket(session?.id);

  // 1. Fetch Session Hyperbuild Details
  const { data: sessionDetails, isLoading, refetch } = useQuery({
    queryKey: ['student-hyperbuild', session.id],
    queryFn: async () => {
      const res = await api.get(`/hyperbuild/sessions/${session.id}/activities`);
      return res.data;
    },
    staleTime: 10000,
  });

  // Silent background geolocation (no UI prompts or errors)
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGeoCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            acc: pos.coords.accuracy,
          });
        },
        () => {},
        { enableHighAccuracy: false, timeout: 3000 }
      );
    }
  }, []);

  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);

  // Sort activities chronologically by start_time ASC
  const sortedActivities = React.useMemo(() => {
    if (!sessionDetails?.activities) return [];
    return [...sessionDetails.activities].sort((a: any, b: any) => {
      const timeA = a.start_time || '00:00';
      const timeB = b.start_time || '00:00';
      if (timeA !== timeB) return timeA.localeCompare(timeB);
      return (a.activity_no || 0) - (b.activity_no || 0);
    });
  }, [sessionDetails?.activities]);

  // Determine active/selected activity
  const activeActivity = React.useMemo(() => {
    if (!sortedActivities || sortedActivities.length === 0) return null;
    if (selectedActivityId) {
      const found = sortedActivities.find((a: any) => a.id === selectedActivityId);
      if (found) return found;
    }
    if (sessionDetails?.active_activity_id) {
      const found = sortedActivities.find((a: any) => a.id === sessionDetails.active_activity_id);
      if (found) return found;
    }
    const active = sortedActivities.find((a: any) => a.status === 'active');
    if (active) return active;
    const unverified = sortedActivities.find((a: any) => a.is_eligible && !a.is_verified_by_student);
    if (unverified) return unverified;
    return sortedActivities[0];
  }, [sortedActivities, selectedActivityId, sessionDetails?.active_activity_id]);

  const handleSelectActivity = (actId: string) => {
    if (actId === activeActivity?.id) return;
    setSelectedActivityId(actId);
    setEnteredKey('');
    setUploadedFile(null);
    setSubmissionUrl('');
    setSubmissionText('');
    setVerifError(null);
    setVerifSuccess(null);
  };

  // Handle solution file upload with client validation
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (< 25MB)
    if (file.size > 25 * 1024 * 1024) {
      setVerifError('File exceeds the 25MB maximum upload limit.');
      return;
    }

    setUploadingFile(true);
    setVerifError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/lms/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadedFile({
        file_name: res.data.original_filename || file.name,
        file_url: res.data.file_url,
        file_size: res.data.file_size || file.size,
      });
    } catch (err: any) {
      setVerifError(err.response?.data?.detail || 'File upload failed. Please try again.');
    } finally {
      setUploadingFile(false);
    }
  };

  // 2. Submit Verification Mutation
  const verifyMutation = useMutation({
    mutationFn: async (activityId: string) => {
      setVerifError(null);
      setVerifSuccess(null);
      const payload = {
        challenge_key: enteredKey,
        latitude: geoCoords?.lat || null,
        longitude: geoCoords?.lng || null,
        accuracy_meters: geoCoords?.acc || null,
        submission_url: uploadedFile?.file_url || (submissionUrl.trim() ? submissionUrl.trim() : null),
        submission_text: submissionText.trim() ? submissionText.trim() : null,
      };
      const res = await api.post(`/hyperbuild/activities/${activityId}/verify`, payload);
      return res.data;
    },
    onSuccess: (data) => {
      setVerifSuccess(data.message || 'Attendance & deliverable verified successfully!');
      setEnteredKey('');
      setSubmissionUrl('');
      setSubmissionText('');
      setUploadedFile(null);
      refetch();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || 'Verification failed. Please check the screen code or ask your faculty.';
      setVerifError(msg);
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn" role="dialog" aria-modal="true">
      <div className="w-full max-w-2xl rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900 space-y-5 my-6 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Zap className="h-5 w-5 fill-amber-500 text-amber-500" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  HyperBuild Session Verification
                </h3>
                {isWsLive && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 animate-pulse">
                    <Radio className="h-2.5 w-2.5" />
                    LIVE
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                📍 {session.venue || 'HyperBuild Lab'} · ⏰ {session.start_time?.slice(0, 5)} - {session.end_time?.slice(0, 5)} ({session.duration_minutes} mins)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-500 font-medium">Loading session activities...</div>
        ) : (
          <div className="space-y-4">
            {/* Sequential Activities Summary with Selection */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Select Activity to Mark Attendance
                </p>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                  Sorted by schedule time · Click to switch
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sortedActivities.map((act: any) => {
                  const isVerified = act.is_verified_by_student;
                  const isActive = act.status === 'active' && act.is_eligible;
                  const isSelected = activeActivity?.id === act.id;
                  return (
                    <button
                      type="button"
                      key={act.id}
                      onClick={() => handleSelectActivity(act.id)}
                      className={`w-full text-left p-3 rounded-xl border text-xs transition-all cursor-pointer relative ${
                        isSelected
                          ? 'ring-2 ring-amber-500 border-amber-500 bg-amber-50/90 dark:bg-amber-950/40 shadow-sm'
                          : isVerified
                          ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 hover:border-emerald-400'
                          : isActive
                          ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700 hover:border-amber-400'
                          : !act.is_eligible
                          ? 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 opacity-60'
                          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-slate-900 dark:text-white truncate max-w-[180px]">
                          Activity {act.activity_no} — {act.subject_name || act.subject_code || 'Subject'}
                        </span>
                        {isVerified ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Verified</span>
                          </span>
                        ) : !act.is_eligible ? (
                          <span className="text-[10px] text-slate-400 shrink-0">N/A</span>
                        ) : isActive ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 shrink-0">
                            Active
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 shrink-0">Upcoming</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500 font-mono">
                        <span>
                          {act.start_time?.slice(0, 5)} - {act.end_time?.slice(0, 5)} ({act.duration_minutes}m)
                        </span>
                        {isSelected && (
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                            Selected ✓
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Activity Live Verification Box */}
            {activeActivity && (
              <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 uppercase">
                      Marking Attendance
                    </span>
                    <span className="font-bold text-xs text-slate-900 dark:text-white">
                      Activity {activeActivity.activity_no}: {activeActivity.subject_name || activeActivity.subject_code || 'Subject'}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-semibold text-slate-500">
                    ⏰ {activeActivity.start_time?.slice(0, 5)} - {activeActivity.end_time?.slice(0, 5)} ({activeActivity.duration_minutes}m)
                  </span>
                </div>

                {/* Status Messages */}
                {verifSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center space-x-2 font-medium">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{verifSuccess}</span>
                  </div>
                )}

                {verifError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 flex items-start space-x-2 font-medium">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                    <span>{verifError}</span>
                  </div>
                )}

                {activeActivity.is_verified_by_student ? (
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-center space-y-1">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mx-auto" />
                    <p className="font-bold text-xs text-emerald-900 dark:text-emerald-200">
                      Attendance Verified & Credited!
                    </p>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                      +{activeActivity.duration_minutes} minutes recorded in your attendance register.
                    </p>
                  </div>
                ) : !activeActivity.is_eligible ? (
                  <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                    This activity is for elective specialization students. You are not enrolled in this elective.
                  </div>
                ) : activeActivity.is_submission_locked ? (
                  <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-center space-y-1 text-xs text-amber-800 dark:text-amber-300">
                    <Lock className="h-4 w-4 mx-auto text-amber-600" />
                    <p className="font-bold">Verification window is currently closed for this activity.</p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400">
                      Please ask your faculty in class if you need it reopened.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 pt-1">
                    {/* Key Input */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        1. Enter Screen Key <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="e.g. 7B9"
                        value={enteredKey}
                        onChange={(e) => setEnteredKey(e.target.value.toUpperCase())}
                        className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold text-xl tracking-widest text-center focus:outline-none focus:border-amber-500"
                        autoFocus
                      />
                    </div>

                    {/* Deliverable File / URL Upload */}
                    <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700/60">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        2. Attach Solution Deliverable (Optional)
                      </label>
                      
                      {uploadedFile ? (
                        <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-2 truncate">
                            <FileText className="h-4 w-4 text-emerald-600 shrink-0" />
                            <span className="font-semibold text-emerald-900 dark:text-emerald-200 truncate">{uploadedFile.file_name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setUploadedFile(null)}
                            className="p-1 text-slate-400 hover:text-rose-600 text-xs"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label className="flex flex-col items-center justify-center p-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500 bg-white dark:bg-slate-900/60 cursor-pointer transition-colors text-center">
                            <Upload className="h-4 w-4 text-slate-400 mb-1" />
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                              {uploadingFile ? 'Uploading file securely...' : 'Upload Solution File (PDF, DOCX, XLSX, PPTX)'}
                            </span>
                            <span className="text-[10px] text-slate-400">Max size: 25MB · Streamed upload</span>
                            <input
                              type="file"
                              className="hidden"
                              disabled={uploadingFile}
                              onChange={handleFileUpload}
                              accept=".pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.csv,.txt,.zip"
                            />
                          </label>

                          <div className="relative flex items-center">
                            <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
                            <span className="flex-shrink mx-2 text-[10px] font-bold uppercase text-slate-400">or deliverable link</span>
                            <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
                          </div>

                          <div className="relative">
                            <LinkIcon className="h-3.5 w-3.5 absolute left-3 top-3 text-slate-400" />
                            <input
                              type="url"
                              placeholder="Google Drive, GitHub, Notion, or Loom URL..."
                              value={submissionUrl}
                              onChange={(e) => setSubmissionUrl(e.target.value)}
                              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Submit Button */}
                    <button
                      type="button"
                      onClick={() => verifyMutation.mutate(activeActivity.id)}
                      disabled={verifyMutation.isPending || !enteredKey.trim() || uploadingFile}
                      className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 mt-3"
                    >
                      <span>
                        {verifyMutation.isPending
                          ? 'Verifying...'
                          : `Verify Attendance & Submit (Activity #${activeActivity.activity_no})`}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
