import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Zap, KeyRound, Users, RefreshCw, CheckCircle2,
  X, ExternalLink, Lock, Unlock, History, Clock, Radio,
  Sparkles, FileText, Award, Check
} from 'lucide-react';
import { api } from '../../lib/api';
import { useSessionWebSocket } from '../../lib/useSessionWebSocket';

interface HyperbuildLiveConsoleModalProps {
  session: any;
  onClose: () => void;
}

export const HyperbuildLiveConsoleModal: React.FC<HyperbuildLiveConsoleModalProps> = ({ session, onClose }) => {
  const queryClient = useQueryClient();
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'roster' | 'submissions'>('roster');
  const [keyRemainingSeconds, setKeyRemainingSeconds] = useState<number>(0);
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [lockReasonInput, setLockReasonInput] = useState('');
  const [reopenMode, setReopenMode] = useState<'timed' | 'manual_indefinite'>('timed');
  const [reopenDuration, setReopenDuration] = useState<number>(15);
  const [reopenReasonInput, setReopenReasonInput] = useState('');

  // Selected scorecard for detail modal
  const [viewingScorecardSub, setViewingScorecardSub] = useState<any | null>(null);
  const [manualScoreInput, setManualScoreInput] = useState<string>('');
  const [manualFeedbackInput, setManualFeedbackInput] = useState<string>('');

  // Real-time WebSocket connection for instant classroom pushes
  const { isConnected: isWsLive } = useSessionWebSocket(session?.id);

  // 1. Fetch Session Hyperbuild Details
  const { data: sessionDetails, isLoading, refetch: refetchDetails } = useQuery({
    queryKey: ['hyperbuild-details', session.id],
    queryFn: async () => {
      const res = await api.get(`/hyperbuild/sessions/${session.id}/activities`);
      return res.data;
    },
    staleTime: 10000,
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

  // 3. Fetch Submissions for Selected Activity
  const { data: submissionsData = [], refetch: refetchSubmissions } = useQuery({
    queryKey: ['hyperbuild-submissions', selectedActivityId],
    queryFn: async () => {
      if (!selectedActivityId) return [];
      const res = await api.get(`/lms/activities/${selectedActivityId}/submissions`);
      return res.data || [];
    },
    enabled: Boolean(selectedActivityId),
    refetchInterval: 5000,
  });

  // 4. Fetch Live Evaluation Progress
  const { data: evalProgress, refetch: refetchProgress } = useQuery({
    queryKey: ['hyperbuild-eval-progress', selectedActivityId],
    queryFn: async () => {
      if (!selectedActivityId) return null;
      const res = await api.get(`/hyperbuild/activities/${selectedActivityId}/evaluation-progress`);
      return res.data;
    },
    enabled: Boolean(selectedActivityId),
    refetchInterval: (query) => (query.state.data?.status === 'in_progress' ? 2000 : 8000),
  });

  // 5. Fetch Audit Logs for Selected Activity
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

  // 6. Bulk AI Evaluation Mutation
  const bulkEvaluateMutation = useMutation({
    mutationFn: async (activityId: string) => {
      const res = await api.post(`/hyperbuild/sessions/${session.id}/activities/${activityId}/bulk-evaluate`);
      return res.data;
    },
    onSuccess: () => {
      refetchProgress();
      refetchSubmissions();
    },
  });

  // 7. Single Submission AI Evaluate Mutation
  const singleEvaluateMutation = useMutation({
    mutationFn: async (submissionId: string) => {
      const res = await api.post(`/lms/activity-submissions/${submissionId}/evaluate`);
      return res.data;
    },
    onSuccess: (updatedSub) => {
      refetchSubmissions();
      if (viewingScorecardSub?.id === updatedSub.id) {
        setViewingScorecardSub(updatedSub);
      }
    },
  });

  // 8. Faculty Manual Grade Override Mutation
  const manualGradeMutation = useMutation({
    mutationFn: async ({ submissionId, score, feedback }: { submissionId: string; score: number; feedback?: string }) => {
      let gradeTier = 'Pass';
      if (score >= 85) gradeTier = 'Distinction';
      else if (score >= 70) gradeTier = 'Merit';
      else if (score < 50) gradeTier = 'Needs Work';

      const res = await api.post(`/lms/activity-submissions/${submissionId}/grade`, {
        score,
        grade: gradeTier,
        feedback: feedback || viewingScorecardSub?.feedback || null,
        status: 'graded',
      });
      return res.data;
    },
    onSuccess: (data) => {
      setViewingScorecardSub(data);
      refetchSubmissions();
    },
  });

  // 9. Trigger 60s Challenge Key Mutation
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

  // 10. Extend Window Mutation
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

  // 11. Lock Window Mutation
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

  // 12. Reopen Window Mutation
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

  // 13. Manual Student Attendance Update Mutation
  const updateAttendanceMutation = useMutation({
    mutationFn: async ({ studentId, status, remarks }: { studentId: string; status: string; remarks?: string }) => {
      if (!selectedActivityId) return null;
      const res = await api.post(`/hyperbuild/activities/${selectedActivityId}/attendance`, {
        student_id: studentId,
        status,
        remarks,
      });
      return res.data;
    },
    onSuccess: () => {
      refetchRoster();
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['student-dossier'] });
      queryClient.invalidateQueries({ queryKey: ['hyperbuild-details'] });
    },
  });

  // 14. Bulk Attendance Update Mutation
  const bulkAttendanceMutation = useMutation({
    mutationFn: async (updates: Array<{ student_id: string; status: string; remarks?: string }>) => {
      if (!selectedActivityId) return null;
      const res = await api.post(`/hyperbuild/activities/${selectedActivityId}/attendance/bulk`, {
        updates,
      });
      return res.data;
    },
    onSuccess: () => {
      refetchRoster();
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['student-dossier'] });
      queryClient.invalidateQueries({ queryKey: ['hyperbuild-details'] });
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

  const totalSubmitted = submissionsData.length;
  const totalGraded = submissionsData.filter((s: any) => s.score !== null && s.score !== undefined).length;
  const isEvaluating = evalProgress?.status === 'in_progress';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto animate-fadeIn" role="dialog" aria-modal="true">
      <div className="glass-panel w-full max-w-5xl rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 space-y-6 my-6 max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Zap className="h-6 w-6 fill-amber-500 text-amber-500" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  HyperBuild Live Classroom Console
                </h3>
                {isWsLive && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 animate-pulse">
                    <Radio className="h-3 w-3" />
                    LIVE SYNC
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
            className="p-2 rounded-2xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-xs text-slate-500 font-medium">Loading HyperBuild activities...</div>
        ) : (
          <div className="space-y-6">
            {/* Horizontal Activity Switcher */}
            <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-none">
              {sessionDetails?.activities?.map((act: any) => {
                const isSelected = act.id === selectedActivityId;
                const isLocked = act.is_submission_locked;
                return (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => setSelectedActivityId(act.id)}
                    className={`px-4 py-2.5 rounded-2xl border text-xs font-bold transition-all shrink-0 flex items-center space-x-2 cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500 text-white border-amber-600 shadow-md shadow-amber-500/20'
                        : isLocked
                        ? 'bg-slate-50 dark:bg-slate-800/40 text-slate-500 border-slate-200 dark:border-slate-800 hover:border-amber-400'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-amber-400'
                    }`}
                  >
                    <span>Activity {act.activity_no}</span>
                    <span className="opacity-75 font-normal">({act.subject_code || act.subject_name || 'Subject'})</span>
                    {isLocked ? <Lock className="h-3 w-3 opacity-60" /> : <Unlock className="h-3 w-3 text-emerald-400" />}
                  </button>
                );
              })}
            </div>

            {currentActivity && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Col: Master Controls & Transition Key */}
                <div className="space-y-4">
                  <div className="p-4 rounded-3xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                          Active Activity Slot
                        </span>
                        <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                          Activity {currentActivity.activity_no}: {currentActivity.title}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Assigned Subject: <span className="font-semibold text-slate-700 dark:text-slate-300">{currentActivity.subject_name} ({currentActivity.subject_code})</span>
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowAuditLogs(!showAuditLogs)}
                        className={`p-2 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-1 cursor-pointer ${
                          showAuditLogs
                            ? 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                        title="View Window Audit Trail"
                      >
                        <History className="h-3.5 w-3.5" />
                        <span>Audit</span>
                      </button>
                    </div>

                    {/* Window Controls Bar */}
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center space-x-2 text-xs">
                        <span className="text-slate-500 font-medium">Window:</span>
                        {currentActivity.is_submission_locked ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40">
                            <Lock className="h-3 w-3" />
                            <span>Locked</span>
                          </span>
                        ) : currentActivity.is_reopened_indefinite ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/40">
                            <Unlock className="h-3 w-3" />
                            <span>Reopened (Manual)</span>
                          </span>
                        ) : currentActivity.reopened_until ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40">
                            <Clock className="h-3 w-3" />
                            <span>Reopened</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40">
                            <span>Open</span>
                          </span>
                        )}
                      </div>

                      {/* Quick Window Actions */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => extendWindowMutation.mutate({ activityId: currentActivity.id, minutes: 10 })}
                          disabled={extendWindowMutation.isPending}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
                        >
                          +10m
                        </button>
                        <button
                          type="button"
                          onClick={() => extendWindowMutation.mutate({ activityId: currentActivity.id, minutes: 15 })}
                          disabled={extendWindowMutation.isPending}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
                        >
                          +15m
                        </button>
                        {currentActivity.is_submission_locked ? (
                          <button
                            type="button"
                            onClick={() => setShowReopenModal(true)}
                            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Unlock className="h-3 w-3" />
                            <span>Reopen</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowLockModal(true)}
                            className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Lock className="h-3 w-3" />
                            <span>Lock</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Transition Key Box */}
                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="flex items-center space-x-1.5 font-bold text-slate-800 dark:text-slate-200">
                          <KeyRound className="h-4 w-4 text-amber-500" />
                          <span>Screen Transition Key</span>
                        </div>
                        <p className="text-[11px] text-slate-500">Students enter this key to verify presence & submit.</p>
                      </div>

                      <div className="flex items-center space-x-3">
                        {currentActivity.challenge_key ? (
                          <div className="flex items-center space-x-2">
                            <span className="px-4 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 font-mono font-bold text-xl text-amber-800 dark:text-amber-300 tracking-wider">
                              {currentActivity.challenge_key}
                            </span>
                            {keyRemainingSeconds > 0 && (
                              <span className="text-xs font-mono font-semibold text-amber-600">
                                {keyRemainingSeconds}s
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No key active</span>
                        )}

                        <button
                          type="button"
                          onClick={() => triggerKeyMutation.mutate(currentActivity.id)}
                          disabled={triggerKeyMutation.isPending}
                          className="px-3.5 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold text-xs hover:bg-slate-800 transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw className={`h-3 w-3 ${triggerKeyMutation.isPending ? 'animate-spin' : ''}`} />
                          <span>{currentActivity.challenge_key ? 'New Key' : 'Reveal Key'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Summary Metric Badges */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Verified Present</p>
                      <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {rosterData?.total_verified_present || 0}
                      </p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Submissions In</p>
                      <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-0.5">
                        {totalSubmitted}
                      </p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">AI Graded</p>
                      <p className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 mt-0.5">
                        {totalGraded} <span className="text-xs font-normal text-purple-500">/ {totalSubmitted}</span>
                      </p>
                    </div>
                  </div>

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

                {/* Right Col: Tabbed Roster vs AI Submissions & Grading */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab('roster')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                          activeTab === 'roster'
                            ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        <Users className="h-3.5 w-3.5" />
                        <span>Attendance Roster ({rosterData?.roster?.length || 0})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab('submissions')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                          activeTab === 'submissions'
                            ? 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Deliverables & AI Grading ({totalSubmitted})</span>
                      </button>
                    </div>

                    {activeTab === 'submissions' && (
                      <button
                        type="button"
                        onClick={() => bulkEvaluateMutation.mutate(currentActivity.id)}
                        disabled={bulkEvaluateMutation.isPending || isEvaluating || totalSubmitted === 0}
                        className="px-3 py-1 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-sm flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Sparkles className={`h-3.5 w-3.5 ${isEvaluating ? 'animate-spin' : ''}`} />
                        <span>{isEvaluating ? 'Grading in Progress...' : '⚡ AI Evaluate All'}</span>
                      </button>
                    )}
                  </div>

                  {/* Tab 1: Attendance Roster */}
                  {activeTab === 'roster' && (
                    <div className="space-y-3 text-xs">
                      {/* Sub-header with Subject Context & Bulk Actions */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 text-slate-500">
                        <div className="text-xs">
                          Attributing to: <strong className="font-semibold text-slate-800 dark:text-slate-200">{currentActivity.subject_name} ({currentActivity.subject_code})</strong>
                        </div>
                        {rosterData?.roster?.some((s: any) => s.is_eligible && !s.is_verified) && (
                          <button
                            type="button"
                            onClick={() => {
                              const eligibleUnverified = (rosterData?.roster || [])
                                .filter((s: any) => s.is_eligible && !s.is_verified)
                                .map((s: any) => ({ student_id: s.student_id, status: 'present' }));
                              if (eligibleUnverified.length > 0) {
                                bulkAttendanceMutation.mutate(eligibleUnverified);
                              }
                            }}
                            disabled={bulkAttendanceMutation.isPending}
                            className="px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 self-start sm:self-auto"
                          >
                            <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                            <span>Mark All Eligible Present ({rosterData?.roster?.filter((s: any) => s.is_eligible && !s.is_verified).length})</span>
                          </button>
                        )}
                      </div>

                      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
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
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-bold text-slate-900 dark:text-white line-clamp-1">{st.full_name}</p>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {st.is_verified ? (
                                    <>
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                                        <CheckCircle2 className="h-3 w-3" />
                                        <span>Verified</span>
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => updateAttendanceMutation.mutate({ studentId: st.student_id, status: 'absent' })}
                                        disabled={updateAttendanceMutation.isPending}
                                        className="px-2 py-0.5 rounded-lg border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-[10px] font-bold transition-all cursor-pointer disabled:opacity-50"
                                        title="Mark absent for this activity/subject"
                                      >
                                        Mark Absent
                                      </button>
                                    </>
                                  ) : st.is_eligible ? (
                                    <>
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400">
                                        Pending
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => updateAttendanceMutation.mutate({ studentId: st.student_id, status: 'present' })}
                                        disabled={updateAttendanceMutation.isPending}
                                        className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-xs"
                                        title="Manually verify student present for this activity/subject"
                                      >
                                        <Check className="h-2.5 w-2.5" />
                                        <span>Mark Present</span>
                                      </button>
                                    </>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-900">
                                      Ineligible (Domain)
                                    </span>
                                  )}
                                </div>
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
                  )}

                  {/* Tab 2: Submissions & AI Grading */}
                  {activeTab === 'submissions' && (
                    <div className="space-y-3">
                      {/* Active Evaluation Progress Bar */}
                      {isEvaluating && (
                        <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-xs space-y-1.5">
                          <div className="flex items-center justify-between font-bold text-purple-900 dark:text-purple-200">
                            <span className="flex items-center gap-1.5">
                              <Sparkles className="h-3.5 w-3.5 animate-spin text-purple-600" />
                              <span>Evaluating Submissions against Rubrics...</span>
                            </span>
                            <span>{evalProgress?.processed_count || 0} / {evalProgress?.total_submissions || totalSubmitted}</span>
                          </div>
                          <div className="w-full h-1.5 bg-purple-200 dark:bg-purple-900 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-purple-600 transition-all duration-300"
                              style={{
                                width: `${Math.round(((evalProgress?.processed_count || 0) / (evalProgress?.total_submissions || 1)) * 100)}%`,
                              }}
                            />
                          </div>
                          {evalProgress?.current_student && (
                            <p className="text-[10px] text-purple-700 dark:text-purple-300">
                              Grading: <span className="font-semibold">{evalProgress.current_student}</span>
                            </p>
                          )}
                        </div>
                      )}

                      {/* Submissions List */}
                      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 text-xs">
                        {submissionsData.length === 0 ? (
                          <div className="text-center py-10 text-slate-400 text-xs italic">
                            No student submissions recorded yet for this activity.
                          </div>
                        ) : (
                          submissionsData.map((sub: any) => {
                            const isGraded = sub.score !== null && sub.score !== undefined;
                            return (
                              <div
                                key={sub.id}
                                className={`p-3 rounded-2xl border transition-all ${
                                  isGraded
                                    ? 'bg-purple-50/40 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/40'
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="font-bold text-slate-900 dark:text-white line-clamp-1">
                                      {sub.student_name}
                                    </p>
                                    <p className="text-[10px] font-mono text-slate-500">
                                      PRN: {sub.student_prn || 'N/A'} · {new Date(sub.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  </div>

                                  {isGraded ? (
                                    <div className="text-right">
                                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                                        {sub.score} / 100
                                      </span>
                                      <p className="text-[10px] font-bold text-purple-600 mt-0.5">{sub.grade}</p>
                                    </div>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                      Ungraded
                                    </span>
                                  )}
                                </div>

                                {/* Deliverable Link & Action */}
                                <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                                  {sub.file_url ? (
                                    <a
                                      href={sub.file_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 font-medium truncate max-w-[200px]"
                                    >
                                      <FileText className="h-3 w-3 shrink-0" />
                                      <span className="truncate">{sub.file_name || 'Solution Document'}</span>
                                    </a>
                                  ) : (
                                    <span className="text-slate-400 italic text-[11px]">Text / Link Submission</span>
                                  )}

                                  <div className="flex items-center space-x-1.5">
                                    {isGraded ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setViewingScorecardSub(sub);
                                          setManualScoreInput(String(sub.score || ''));
                                          setManualFeedbackInput(sub.feedback || '');
                                        }}
                                        className="px-2.5 py-1 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                                      >
                                        <Award className="h-3 w-3" />
                                        <span>Scorecard</span>
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => singleEvaluateMutation.mutate(sub.id)}
                                        disabled={singleEvaluateMutation.isPending}
                                        className="px-2.5 py-1 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 text-white dark:text-slate-900 font-bold text-[10px] transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                      >
                                        <Sparkles className="h-3 w-3" />
                                        <span>Grade with AI</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
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
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600'
                  }`}
                >
                  Timed Window (+X mins)
                </button>
                <button
                  type="button"
                  onClick={() => setReopenMode('manual_indefinite')}
                  className={`p-2.5 rounded-xl border font-bold text-left transition-all ${
                    reopenMode === 'manual_indefinite'
                      ? 'bg-indigo-50 dark:bg-indigo-950 border-indigo-400 text-indigo-700 dark:text-indigo-300'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600'
                  }`}
                >
                  Manual Lock (Indefinite)
                </button>
              </div>
            </div>

            {reopenMode === 'timed' && (
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Extra Duration (Minutes)</label>
                <div className="flex space-x-2">
                  {[5, 10, 15, 30].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setReopenDuration(m)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                        reopenDuration === m
                          ? 'bg-amber-500 text-white border-amber-600'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">Reason for Reopening</label>
              <input
                type="text"
                value={reopenReasonInput}
                onChange={(e) => setReopenReasonInput(e.target.value)}
                placeholder="e.g. WiFi issue / Late entrants allowed"
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
                Confirm Reopen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rubric Scorecard Detail Inspector Modal */}
      {viewingScorecardSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto animate-fadeIn">
          <div className="w-full max-w-3xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5 my-6 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-600 border border-purple-500/20">
                  <Award className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Rubric Evaluation Scorecard: {viewingScorecardSub.student_name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    PRN: {viewingScorecardSub.student_prn || 'N/A'} · Model: {viewingScorecardSub.ai_evaluation?.model_used || 'Gemini 1.5'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingScorecardSub(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Score & Performance Tier Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-900/10 via-indigo-900/10 to-transparent border border-purple-200 dark:border-purple-800 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-purple-600">Assessed Performance Tier</p>
                <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">
                  {viewingScorecardSub.ai_evaluation?.performance_tier || viewingScorecardSub.grade || 'Graded'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-purple-600">Score Awarded</p>
                <p className="text-3xl font-extrabold text-purple-600 dark:text-purple-400">
                  {viewingScorecardSub.score} <span className="text-sm font-normal text-slate-400">/ 100</span>
                </p>
              </div>
            </div>

            {/* Executive Summary */}
            {viewingScorecardSub.ai_evaluation?.executive_summary && (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-1">
                <p className="text-[11px] font-bold uppercase text-slate-500">Executive Academic Summary</p>
                <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                  {viewingScorecardSub.ai_evaluation.executive_summary}
                </p>
              </div>
            )}

            {/* Criteria Breakdown */}
            {viewingScorecardSub.ai_evaluation?.criteria_breakdown && (
              <div className="space-y-2.5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Rubric Criteria Breakdown
                </p>
                <div className="space-y-2">
                  {viewingScorecardSub.ai_evaluation.criteria_breakdown.map((c: any, i: number) => (
                    <div key={i} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-slate-900 dark:text-white">{c.criterion}</span>
                        <span className="px-2 py-0.5 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-mono text-xs">
                          {c.marks_awarded} / {c.max_marks}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300">{c.rationale}</p>
                      {c.evidence && (
                        <p className="text-[10px] text-emerald-700 dark:text-emerald-400 italic bg-emerald-50 dark:bg-emerald-950/30 p-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                          Evidence Quoted: "{c.evidence}"
                        </p>
                      )}
                      {c.gap_identified && (
                        <p className="text-[10px] text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 p-1.5 rounded-lg border border-rose-200 dark:border-rose-800">
                          Gap: {c.gap_identified}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Strengths & Areas for Improvement */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {viewingScorecardSub.ai_evaluation?.strengths && (
                <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 space-y-1.5 text-xs">
                  <p className="font-bold text-emerald-800 dark:text-emerald-300 uppercase text-[10px]">What Went Well (Strengths)</p>
                  <ul className="space-y-1 text-[11px] text-emerald-900 dark:text-emerald-200 list-disc list-inside">
                    {viewingScorecardSub.ai_evaluation.strengths.map((s: string, idx: number) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {viewingScorecardSub.ai_evaluation?.areas_for_improvement && (
                <div className="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-1.5 text-xs">
                  <p className="font-bold text-amber-800 dark:text-amber-300 uppercase text-[10px]">Areas for Improvement</p>
                  <ul className="space-y-1 text-[11px] text-amber-900 dark:text-amber-200 list-disc list-inside">
                    {viewingScorecardSub.ai_evaluation.areas_for_improvement.map((a: string, idx: number) => (
                      <li key={idx}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Faculty Manual Grade Override */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white">Faculty Score Override & Notes</span>
                <button
                  type="button"
                  onClick={() => singleEvaluateMutation.mutate(viewingScorecardSub.id)}
                  disabled={singleEvaluateMutation.isPending}
                  className="px-2.5 py-1 rounded-xl text-xs font-semibold text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-950 border border-purple-200 dark:border-purple-800 flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="h-3 w-3" />
                  <span>Re-run AI Evaluation</span>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Final Score (/100)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={manualScoreInput}
                    onChange={(e) => setManualScoreInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Faculty Feedback / Guidance</label>
                  <input
                    type="text"
                    value={manualFeedbackInput}
                    onChange={(e) => setManualFeedbackInput(e.target.value)}
                    placeholder="Custom faculty remarks..."
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const score = parseFloat(manualScoreInput);
                    if (!isNaN(score)) {
                      manualGradeMutation.mutate({
                        submissionId: viewingScorecardSub.id,
                        score,
                        feedback: manualFeedbackInput,
                      });
                    }
                  }}
                  disabled={manualGradeMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Save Grade & Publish</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
