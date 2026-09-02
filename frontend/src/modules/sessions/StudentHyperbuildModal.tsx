import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Zap, MapPin, CheckCircle2, AlertCircle,
  X, ShieldCheck, Lock, HelpCircle
} from 'lucide-react';
import { api } from '../../lib/api';

interface StudentHyperbuildModalProps {
  session: any;
  onClose: () => void;
}

export const StudentHyperbuildModal: React.FC<StudentHyperbuildModalProps> = ({ session, onClose }) => {
  const [enteredKey, setEnteredKey] = useState('');
  const [submissionUrl, setSubmissionUrl] = useState('');
  const [submissionText] = useState('');
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
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

  // Automatically request HTML5 browser geolocation on load
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGeoCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            acc: pos.coords.accuracy,
          });
          setGeoError(null);
        },
        () => {
          setGeoError('Please enable browser location so your presence can be verified on campus.');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setGeoError('Browser geolocation is not supported on this device.');
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
        submission_url: submissionUrl || null,
        submission_text: submissionText || null,
      };
      const res = await api.post(`/hyperbuild/activities/${activityId}/verify`, payload);
      return res.data;
    },
    onSuccess: (data) => {
      setVerifSuccess(data.message);
      setEnteredKey('');
      refetch();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || 'Verification failed. Please check the screen code or contact faculty.';
      setVerifError(msg);
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto animate-fadeIn" role="dialog" aria-modal="true">
      <div className="glass-panel w-full max-w-3xl rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 space-y-6 my-6 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                HyperBuild Live Student Workspace
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {session.subject_name} · ⏰ {session.start_time} - {session.end_time} ({session.duration_minutes}m)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-2xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-xs text-slate-500">Loading your personalized HyperBuild roadmap...</div>
        ) : (
          <div className="space-y-6">
            {/* Sequential Activities Progress Bar */}
            <div className="space-y-2">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Today's Activity Roadmap & Your Eligibility
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {sessionDetails?.activities?.map((act: any) => {
                  return (
                    <div
                      key={act.id}
                      className={`p-3.5 rounded-2xl border text-xs space-y-1 transition-all ${
                        act.is_verified_by_student
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
                          : act.status === 'active' && act.is_eligible
                          ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 shadow-md ring-2 ring-indigo-500/30'
                          : !act.is_eligible
                          ? 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 opacity-60'
                          : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold uppercase text-[10px] text-cyan-600 dark:text-cyan-400">
                          Act {act.activity_no} ({act.duration_minutes}m)
                        </span>
                        {act.is_verified_by_student ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Verified</span>
                          </span>
                        ) : !act.is_eligible ? (
                          <span className="text-[9px] font-bold text-slate-400">Not Applicable</span>
                        ) : act.status === 'active' ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-indigo-500 text-white animate-pulse">
                            Active Now
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Upcoming</span>
                        )}
                      </div>
                      <p className="font-bold text-slate-900 dark:text-white line-clamp-1">{act.title}</p>
                      <p className="text-[11px] text-slate-500 font-mono">{act.subject_name}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active Activity Live Verification Box */}
            {activeActivity && (
              <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                        Activity {activeActivity.activity_no} · {activeActivity.subject_name}
                      </span>
                      {activeActivity.is_submission_locked && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                          <Lock className="h-3 w-3" />
                          <span>Window Locked</span>
                        </span>
                      )}
                    </div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                      {activeActivity.title}
                    </h4>
                  </div>
                  <div className="text-right font-mono text-xs text-slate-500">
                    <p className="font-bold text-cyan-600 dark:text-cyan-400">{activeActivity.start_time} - {activeActivity.end_time}</p>
                    <p>{activeActivity.duration_minutes} Minutes</p>
                  </div>
                </div>

                {activeActivity.instructions && (
                  <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    <strong className="text-slate-900 dark:text-white block mb-0.5">Instructions:</strong>
                    {activeActivity.instructions}
                  </div>
                )}

                {/* Status Messages */}
                {verifSuccess && (
                  <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center space-x-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{verifSuccess}</span>
                  </div>
                )}

                {verifError && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 space-y-1">
                    <div className="flex items-start space-x-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span className="font-semibold leading-relaxed">{verifError}</span>
                    </div>
                    <p className="text-[11px] text-rose-600 dark:text-rose-400 pl-6 flex items-center gap-1 font-medium">
                      <HelpCircle className="h-3.5 w-3.5" />
                      <span>If you are facing a technical issue or need assistance, please consult your faculty in class.</span>
                    </p>
                  </div>
                )}

                {activeActivity.is_verified_by_student ? (
                  <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-center space-y-1">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400 mx-auto" />
                    <p className="font-extrabold text-xs text-emerald-900 dark:text-emerald-200">
                      Attendance Verified & Credited for {activeActivity.subject_name}!
                    </p>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                      +{activeActivity.duration_minutes} minutes recorded in your academic register.
                    </p>
                  </div>
                ) : !activeActivity.is_eligible ? (
                  <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                    This activity is for <strong>{activeActivity.elective_domain} Elective</strong>. You are not enrolled in this elective and can take a break or study until your next scheduled slot.
                  </div>
                ) : activeActivity.is_submission_locked ? (
                  <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-center space-y-1.5 text-xs text-amber-800 dark:text-amber-300">
                    <Lock className="h-5 w-5 mx-auto text-amber-600" />
                    <p className="font-bold">Submissions are currently closed for this activity.</p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400">
                      If you need extra time to submit your deliverable, please ask your faculty in class to extend or reopen the submission window.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 pt-2">
                    {/* Key Input */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        Step 1: Enter 3-Character Screen Key *
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="e.g. 7B9"
                        value={enteredKey}
                        onChange={(e) => setEnteredKey(e.target.value.toUpperCase())}
                        className="w-full px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-black text-lg tracking-widest text-center focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    {/* Deliverable URL */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        Step 2: Submit Activity Deliverable Link / Work Artifact (Optional)
                      </label>
                      <input
                        type="url"
                        placeholder="https://docs.google.com/spreadsheets/d/... or Miro link"
                        value={submissionUrl}
                        onChange={(e) => setSubmissionUrl(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    {/* Geolocation Tag */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-cyan-500" />
                        {geoCoords ? 'Campus Geolocation Locked' : 'Detecting Campus Location...'}
                      </span>
                      {geoError && <span className="text-amber-500 text-[10px]">{geoError}</span>}
                    </div>

                    {/* Submit Button */}
                    <button
                      type="button"
                      onClick={() => verifyMutation.mutate(activeActivity.id)}
                      disabled={verifyMutation.isPending || !enteredKey}
                      className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      <span>{verifyMutation.isPending ? 'Verifying on Campus...' : 'Verify Presence & Credit Subject Attendance'}</span>
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
