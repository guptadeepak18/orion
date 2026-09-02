import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Zap, KeyRound, Users, RefreshCw, CheckCircle2,
  X, ExternalLink, Lock, Unlock, History, Clock
} from 'lucide-react';
import { api } from '../../lib/api';

interface HyperbuildLiveConsoleModalProps {
  session: any;
  onClose: () => void;
}

export const HyperbuildLiveConsoleModal: React.FC<HyperbuildLiveConsoleModalProps> = ({ session, onClose }) => {
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [keyRemainingSeconds, setKeyRemainingSeconds] = useState<number>(0);
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [lockReasonInput, setLockReasonInput] = useState('');
  const [reopenMode, setReopenMode] = useState<'timed' | 'manual_indefinite'>('timed');
  const [reopenDuration, setReopenDuration] = useState<number>(15);
  const [reopenReasonInput, setReopenReasonInput] = useState('');

  // 1. Fetch Session Hyperbuild Details
  const { data: sessionDetails, isLoading, refetch: refetchDetails } = useQuery({
    queryKey: ['hyperbuild-details', session.id],
    queryFn: async () => {
      const res = await api.get(`/hyperbuild/sessions/${session.id}/activities`);
      return res.data;
    },
    refetchInterval: 6000,
  });

  // Select initial activity
  useEffect(() => {
    if (sessionDetails?.activities?.length) {
      if (!selectedActivityId) {
        const active = sessionDetails.activities.find((a: any) => a.status === 'active') || sessionDetails.activities[0];
        setSelectedActivityId(active.id);
      }
    }
  }, [sessionDetails, selectedActivityId]);

  const currentActivity = sessionDetails?.activities?.find((a: any) => a.id === selectedActivityId);

  // 2. Fetch Live Roster for Selected Activity
  const { data: rosterData, refetch: refetchRoster } = useQuery({
    queryKey: ['hyperbuild-roster', selectedActivityId],
    queryFn: async () => {
      if (!selectedActivityId) return null;
      const res = await api.get(`/hyperbuild/activities/${selectedActivityId}/roster`);
      return res.data;
    },
    enabled: Boolean(selectedActivityId),
    refetchInterval: 5000,
  });

  // 3. Fetch Audit Logs for Selected Activity
  const { data: auditData, refetch: refetchAudit } = useQuery({
    queryKey: ['hyperbuild-audit', selectedActivityId],
    queryFn: async () => {
      if (!selectedActivityId) return null;
      const res = await api.get(`/hyperbuild/activities/${selectedActivityId}/audit-logs`);
      return res.data;
    },
    enabled: Boolean(selectedActivityId) && showAuditLogs,
    refetchInterval: 6000,
  });

  // 4. Trigger 60s Challenge Key Mutation
  const triggerKeyMutation = useMutation({
    mutationFn: async (activityId: string) => {
      const res = await api.post(`/hyperbuild/activities/${activityId}/trigger-key?validity_seconds=60`);
      return res.data;
    },
    onSuccess: () => {
      setKeyRemainingSeconds(60);
      refetchDetails();
      refetchRoster();
      refetchAudit();
    },
  });

  // 5. Extend Window Mutation
  const extendWindowMutation = useMutation({
    mutationFn: async ({ activityId, minutes, reason }: { activityId: string; minutes: number; reason?: string }) => {
      const res = await api.post(`/hyperbuild/activities/${activityId}/window/extend`, {
        extension_minutes: minutes,
        reason: reason || `Extended +${minutes} mins by faculty`,
      });
      return res.data;
    },
    onSuccess: () => {
      refetchDetails();
      refetchAudit();
    },
  });

  // 6. Lock Window Mutation
  const lockWindowMutation = useMutation({
    mutationFn: async ({ activityId, reason }: { activityId: string; reason?: string }) => {
      const res = await api.post(`/hyperbuild/activities/${activityId}/window/lock`, {
        reason: reason || 'Locked by faculty',
      });
      return res.data;
    },
    onSuccess: () => {
      setShowLockModal(false);
      setLockReasonInput('');
      refetchDetails();
      refetchAudit();
    },
  });

  // 7. Reopen Window Mutation
  const reopenWindowMutation = useMutation({
    mutationFn: async ({ activityId, mode, duration, reason }: { activityId: string; mode: string; duration?: number; reason?: string }) => {
      const res = await api.post(`/hyperbuild/activities/${activityId}/window/reopen`, {
        mode,
        duration_minutes: duration,
        reason: reason || (mode === 'timed' ? `Reopened for ${duration} mins` : 'Reopened indefinitely'),
      });
      return res.data;
    },
    onSuccess: () => {
      setShowReopenModal(false);
      setReopenReasonInput('');
      refetchDetails();
      refetchAudit();
    },
  });

  // Countdown timer for Challenge Key
  useEffect(() => {
    if (keyRemainingSeconds <= 0) return;
    const interval = setInterval(() => {
      setKeyRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [keyRemainingSeconds]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto animate-fadeIn" role="dialog" aria-modal="true">
      <div className="glass-panel w-full max-w-5xl rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 space-y-6 my-6 max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-orange-500/20">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  HyperBuild Live Command Center
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                  Live Classroom Projector
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {session.subject_name || 'HyperBuild Session'} · 📍 {session.venue} · ⏰ {session.start_time} - {session.end_time} ({session.duration_minutes}m)
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowAuditLogs(!showAuditLogs)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                showAuditLogs
                  ? 'bg-purple-100 dark:bg-purple-950 border-purple-300 text-purple-700 dark:text-purple-300'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
              title="View Window Override Audit History"
            >
              <History className="h-4 w-4" />
              <span>Event Audit Log</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-2xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-xs text-slate-500 font-medium">
            Loading HyperBuild session activities & real-time roster...
          </div>
        ) : (
          <div className="space-y-6">
            {/* Sequential Activity Navigation Tabs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 bg-slate-100 dark:bg-slate-950 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
              {sessionDetails?.activities?.map((act: any) => {
                const isSelected = act.id === selectedActivityId;
                const isElective = (act.course_category || 'core').toLowerCase() !== 'core';
                return (
                  <button
                    key={act.id}
                    onClick={() => setSelectedActivityId(act.id)}
                    className={`flex flex-col text-left p-3 rounded-xl transition-all ${
                      isSelected
                        ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-md border border-cyan-500/30'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-900/50'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-extrabold text-[10px] uppercase tracking-wider">
                        Activity {act.activity_no}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                        isElective ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300' : 'bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300'
                      }`}>
                        {isElective ? `${act.elective_domain || 'Elective'}` : 'Core'}
                      </span>
                    </div>
                    <p className="font-bold text-slate-900 dark:text-white line-clamp-1">{act.title}</p>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                      <span>{act.start_time}-{act.end_time}</span>
                      <span className="font-mono font-semibold">{act.duration_minutes}m</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {currentActivity && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left 2 Cols: Live Activity Broadcast & Projector Challenge Key */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white border border-slate-800 shadow-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          {currentActivity.subject_name || 'Academic Subject'} ({currentActivity.course_category})
                        </span>
                        <h2 className="text-xl font-black mt-2 tracking-tight">
                          {currentActivity.title}
                        </h2>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Window Duration</p>
                        <p className="text-xl font-mono font-extrabold text-cyan-400">
                          {currentActivity.start_time} - {currentActivity.end_time}
                        </p>
                      </div>
                    </div>

                    {currentActivity.instructions && (
                      <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-slate-300 leading-relaxed">
                        <strong className="text-white block mb-0.5">Instructions & Deliverable:</strong>
                        {currentActivity.instructions}
                      </div>
                    )}

                    {/* Window Controls Bar */}
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-400 font-bold uppercase text-[10px]">Submission Window:</span>
                        {currentActivity.is_submission_locked ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-500/20 border border-rose-500/40 text-rose-300">
                            <Lock className="h-3 w-3" />
                            <span>Locked</span>
                          </span>
                        ) : currentActivity.is_reopened_indefinite ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-indigo-500/20 border border-indigo-500/40 text-indigo-300">
                            <Unlock className="h-3 w-3" />
                            <span>Reopened (Manual Lock)</span>
                          </span>
                        ) : currentActivity.reopened_until ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-500/20 border border-amber-500/40 text-amber-300">
                            <Clock className="h-3 w-3" />
                            <span>Reopened (Active)</span>
                          </span>
                        ) : currentActivity.extended_until ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                            <Clock className="h-3 w-3" />
                            <span>Extended Window</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-cyan-500/20 border border-cyan-500/40 text-cyan-300">
                            <span>Standard Window</span>
                          </span>
                        )}
                      </div>

                      {/* Quick Window Actions */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => extendWindowMutation.mutate({ activityId: currentActivity.id, minutes: 10 })}
                          disabled={extendWindowMutation.isPending}
                          className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-[11px] transition-colors cursor-pointer"
                        >
                          +10m
                        </button>
                        <button
                          type="button"
                          onClick={() => extendWindowMutation.mutate({ activityId: currentActivity.id, minutes: 15 })}
                          disabled={extendWindowMutation.isPending}
                          className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-[11px] transition-colors cursor-pointer"
                        >
                          +15m
                        </button>
                        {currentActivity.is_submission_locked ? (
                          <button
                            type="button"
                            onClick={() => setShowReopenModal(true)}
                            className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Unlock className="h-3 w-3" />
                            <span>Reopen Window</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowLockModal(true)}
                            className="px-3 py-1 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-bold text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Lock className="h-3 w-3" />
                            <span>Lock Now</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Classroom Display Challenge Key Box */}
                    <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-transparent border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="space-y-1 text-center sm:text-left">
                        <div className="flex items-center justify-center sm:justify-start space-x-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                          <KeyRound className="h-4 w-4" />
                          <span>60-Second Live Transition Key</span>
                        </div>
                        <p className="text-xs text-slate-400">
                          Broadcast this key to the classroom. Students enter it on their laptops.
                        </p>
                      </div>

                      <div className="flex items-center space-x-3">
                        {currentActivity.challenge_key ? (
                          <div className="flex flex-col items-center">
                            <div className="px-6 py-2.5 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 font-mono font-black text-3xl tracking-widest shadow-lg shadow-orange-500/30 animate-pulse">
                              {currentActivity.challenge_key}
                            </div>
                            {keyRemainingSeconds > 0 && (
                              <span className="text-[10px] font-bold text-amber-400 mt-1">
                                Expiring in {keyRemainingSeconds}s
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400 italic">No key active</div>
                        )}

                        <button
                          type="button"
                          onClick={() => triggerKeyMutation.mutate(currentActivity.id)}
                          disabled={triggerKeyMutation.isPending}
                          className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${triggerKeyMutation.isPending ? 'animate-spin' : ''}`} />
                          <span>{currentActivity.challenge_key ? 'Regenerate Key' : 'Reveal Screen Key'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Live Verification Ticker / Summary Bar */}
                  {rosterData && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Verified Present</p>
                        <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                          {rosterData.total_verified_present}
                        </p>
                      </div>
                      <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Eligible Cohort</p>
                        <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-0.5">
                          {rosterData.total_eligible_students}
                        </p>
                      </div>
                      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Live Rate</p>
                        <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">
                          {rosterData.total_eligible_students > 0
                            ? Math.round((rosterData.total_verified_present / rosterData.total_eligible_students) * 100)
                            : 0}%
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Audit Logs Drawer */}
                  {showAuditLogs && (
                    <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-purple-200 dark:border-purple-900/50 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                        <h4 className="text-xs font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                          <History className="h-4 w-4" />
                          <span>Window Override & Action Audit Trail ({auditData?.total_events || 0} events)</span>
                        </h4>
                        <span className="text-[10px] text-slate-500">Immutable Log</span>
                      </div>

                      <div className="space-y-2 max-h-48 overflow-y-auto text-xs">
                        {auditData?.logs?.length === 0 ? (
                          <div className="text-center py-4 text-slate-400 italic text-[11px]">No actions recorded yet.</div>
                        ) : (
                          auditData?.logs?.map((l: any) => (
                            <div key={l.id} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                                    {l.action.replace(/_/g, ' ')}
                                  </span>
                                  <span className="font-bold text-slate-800 dark:text-slate-200">{l.faculty_name}</span>
                                </div>
                                <p className="text-[11px] text-slate-500 mt-0.5">{l.reason}</p>
                              </div>
                              <span className="text-[10px] font-mono text-slate-400">
                                {new Date(l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Col: Live Roster & Anti-Proxy Stream */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-cyan-500" />
                      <span>Live Cohort Roster ({rosterData?.roster?.length || 0})</span>
                    </h4>
                    <button
                      onClick={() => refetchRoster()}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 text-xs"
                      title="Refresh Roster"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1 text-xs">
                    {rosterData?.roster?.map((st: any) => {
                      return (
                        <div
                          key={st.student_id}
                          className={`p-3 rounded-2xl border transition-all ${
                            st.is_verified
                              ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40'
                              : st.is_eligible
                              ? 'bg-amber-50/40 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900/30'
                              : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800/40 opacity-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-bold text-slate-900 dark:text-white line-clamp-1">{st.full_name}</p>
                            {st.is_verified ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>Verified</span>
                              </span>
                            ) : st.is_eligible ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400">
                                Pending Key
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-900">
                                Ineligible (Domain)
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1 font-mono">
                            <span>{st.prn_no || st.email}</span>
                            <span>{st.major_specialization ? `${st.major_specialization}` : 'General'}</span>
                          </div>

                          {st.submission_url && (
                            <div className="mt-2 pt-1 border-t border-slate-200 dark:border-slate-800 text-[11px]">
                              <a
                                href={st.submission_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 font-medium"
                              >
                                <ExternalLink className="h-3 w-3" />
                                <span className="truncate">View Output Artifact</span>
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lock Window Modal */}
      {showLockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 space-y-4 shadow-2xl">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Lock className="h-4 w-4 text-rose-500" />
              <span>Lock Activity Submission Window</span>
            </h4>
            <p className="text-xs text-slate-500">
              Students will no longer be able to submit deliverables or mark attendance for this activity segment until reopened.
            </p>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">Reason for Lock (Audit Trail)</label>
              <input
                type="text"
                value={lockReasonInput}
                onChange={(e) => setLockReasonInput(e.target.value)}
                placeholder="e.g. Activity time expired / All submissions in"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
              />
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowLockModal(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => currentActivity && lockWindowMutation.mutate({ activityId: currentActivity.id, reason: lockReasonInput })}
                disabled={lockWindowMutation.isPending}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md"
              >
                Confirm Lock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reopen Window Modal */}
      {showReopenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 space-y-4 shadow-2xl">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Unlock className="h-4 w-4 text-emerald-500" />
              <span>Reopen Activity Submission Window</span>
            </h4>
            
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-slate-500">Reopen Mode</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setReopenMode('timed')}
                  className={`p-2.5 rounded-xl border font-bold text-left transition-all ${
                    reopenMode === 'timed'
                      ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-400 text-emerald-700 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500'
                  }`}
                >
                  Timed Countdown
                </button>
                <button
                  type="button"
                  onClick={() => setReopenMode('manual_indefinite')}
                  className={`p-2.5 rounded-xl border font-bold text-left transition-all ${
                    reopenMode === 'manual_indefinite'
                      ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-400 text-emerald-700 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500'
                  }`}
                >
                  Until Manual Lock
                </button>
              </div>
            </div>

            {reopenMode === 'timed' && (
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Duration (Minutes)</label>
                <select
                  value={reopenDuration}
                  onChange={(e) => setReopenDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                >
                  <option value={5}>5 Minutes</option>
                  <option value={10}>10 Minutes</option>
                  <option value={15}>15 Minutes</option>
                  <option value={30}>30 Minutes</option>
                  <option value={60}>60 Minutes</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">Reason for Reopening (Audit Trail)</label>
              <input
                type="text"
                value={reopenReasonInput}
                onChange={(e) => setReopenReasonInput(e.target.value)}
                placeholder="e.g. Extension requested for group presentations"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowReopenModal(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => currentActivity && reopenWindowMutation.mutate({
                  activityId: currentActivity.id,
                  mode: reopenMode,
                  duration: reopenDuration,
                  reason: reopenReasonInput,
                })}
                disabled={reopenWindowMutation.isPending}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md"
              >
                Reopen Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
