import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Zap, CheckCircle2, AlertCircle,
  X, Lock
} from 'lucide-react';
import { api } from '../../lib/api';

interface StudentHyperbuildModalProps {
  session: any;
  onClose: () => void;
}

export const StudentHyperbuildModal: React.FC<StudentHyperbuildModalProps> = ({ session, onClose }) => {
  const [enteredKey, setEnteredKey] = useState('');
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [verifError, setVerifError] = useState<string | null>(null);
  const [verifSuccess, setVerifSuccess] = useState<string | null>(null);

  // 1. Fetch Session Hyperbuild Details
  const { data: sessionDetails, isLoading, refetch } = useQuery({
    queryKey: ['student-hyperbuild', session.id],
    queryFn: async () => {
      const res = await api.get(`/hyperbuild/sessions/${session.id}/activities`);
      return res.data;
    },
    refetchInterval: 8000,
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

  const activeActivity = sessionDetails?.activities?.find((a: any) => a.status === 'active') || sessionDetails?.activities?.[0];

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
      };
      const res = await api.post(`/hyperbuild/activities/${activityId}/verify`, payload);
      return res.data;
    },
    onSuccess: (data) => {
      setVerifSuccess(data.message || 'Attendance verified successfully!');
      setEnteredKey('');
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
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                HyperBuild Session Verification
              </h3>
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
            {/* Sequential Activities Summary */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Session Activities
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sessionDetails?.activities?.map((act: any) => {
                  const isVerified = act.is_verified_by_student;
                  const isActive = act.status === 'active' && act.is_eligible;
                  return (
                    <div
                      key={act.id}
                      className={`p-2.5 rounded-xl border text-xs transition-all ${
                        isVerified
                          ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                          : isActive
                          ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700'
                          : !act.is_eligible
                          ? 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 opacity-60'
                          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-slate-900 dark:text-white">
                          Activity {act.activity_no} — {act.subject_name || act.subject_code || 'Subject'}
                        </span>
                        {isVerified ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Verified</span>
                          </span>
                        ) : !act.is_eligible ? (
                          <span className="text-[10px] text-slate-400">N/A</span>
                        ) : isActive ? (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            Active
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Upcoming</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                        {act.start_time?.slice(0, 5)} - {act.end_time?.slice(0, 5)} ({act.duration_minutes}m)
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active Activity Live Verification Box */}
            {activeActivity && (
              <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                  <span className="font-bold text-xs text-slate-900 dark:text-white">
                    Activity {activeActivity.activity_no} — {activeActivity.subject_name || activeActivity.subject_code || 'Subject'}
                  </span>
                  <span className="font-mono text-xs font-semibold text-slate-500">
                    {activeActivity.start_time?.slice(0, 5)} - {activeActivity.end_time?.slice(0, 5)} ({activeActivity.duration_minutes}m)
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
                        Enter Screen Key
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

                    {/* Submit Button */}
                    <button
                      type="button"
                      onClick={() => verifyMutation.mutate(activeActivity.id)}
                      disabled={verifyMutation.isPending || !enteredKey.trim()}
                      className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                    >
                      <span>{verifyMutation.isPending ? 'Verifying...' : 'Verify Attendance'}</span>
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
