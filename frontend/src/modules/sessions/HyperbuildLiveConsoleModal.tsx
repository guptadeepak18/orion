import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Zap, KeyRound, Users, RefreshCw, CheckCircle2,
  X, Lock, Unlock, History, Radio,
  Check, AlertTriangle, ClipboardList, Search, ShieldAlert,
  Clock, CheckCheck, Copy
} from 'lucide-react';
import { api } from '../../lib/api';
import { useSessionWebSocket } from '../../lib/useSessionWebSocket';

const generateFastKey = () => {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 3; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

interface HyperbuildLiveConsoleModalProps {
  session: any;
  onClose: () => void;
}

export const HyperbuildLiveConsoleModal: React.FC<HyperbuildLiveConsoleModalProps> = ({ session, onClose }) => {
  const queryClient = useQueryClient();
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [keyRemainingSeconds, setKeyRemainingSeconds] = useState<number>(0);
  const [localChallengeKey, setLocalChallengeKey] = useState<string | null>(null);
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [lockReasonInput, setLockReasonInput] = useState('');
  const [reopenMode, setReopenMode] = useState<'timed' | 'manual_indefinite'>('timed');
  const [reopenDuration, setReopenDuration] = useState<number>(15);
  const [reopenReasonInput, setReopenReasonInput] = useState('');

  // Roster filtering and report states
  const [rosterFilter, setRosterFilter] = useState<'all' | 'present' | 'absent' | 'downgraded' | 'rc_absent'>('all');
  const [rosterSearch, setRosterSearch] = useState<string>('');
  const [showSummaryReportModal, setShowSummaryReportModal] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  // Clear local challenge key when activity changes
  useEffect(() => {
    setLocalChallengeKey(null);
  }, [selectedActivityId]);

  // Real-time WebSocket connection for instant classroom pushes
  const handleWsEvent = useCallback((event: any) => {
    if (event.type === 'challenge_key_triggered' && event.data) {
      if (event.data.activity_id === selectedActivityId || !selectedActivityId) {
        setLocalChallengeKey(event.data.challenge_key);
        setKeyRemainingSeconds(event.data.active_seconds || 180);
      }
    }
  }, [selectedActivityId]);

  const { isConnected: isWsLive } = useSessionWebSocket(session?.id, handleWsEvent);

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
  const effectiveChallengeKey = localChallengeKey || currentActivity?.challenge_key;

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

  // 9. Trigger 180s Challenge Key Mutation
  const triggerKeyMutation = useMutation({
    mutationFn: async ({ activityId, customKey }: { activityId: string; customKey?: string }) => {
      const url = `/hyperbuild/activities/${activityId}/trigger-key?validity_seconds=180${customKey ? `&custom_key=${encodeURIComponent(customKey)}` : ''}`;
      const res = await api.post(url);
      return res.data;
    },
    onSuccess: (data) => {
      if (data?.challenge_key) {
        setLocalChallengeKey(data.challenge_key);
        setKeyRemainingSeconds(data.active_seconds || 180);
        queryClient.setQueryData(['hyperbuild-details', session.id], (old: any) => {
          if (!old?.activities) return old;
          return {
            ...old,
            activities: old.activities.map((a: any) =>
              a.id === data.activity_id
                ? {
                    ...a,
                    challenge_key: data.challenge_key,
                    challenge_key_active_until: data.active_until,
                    status: 'active',
                  }
                : a
            ),
          };
        });
      }
      refetchRoster();
      if (showAuditLogs) refetchAudit();
    },
    onError: () => {
      setLocalChallengeKey(null);
      refetchDetails();
    },
  });

  const handleTriggerKey = (activityId: string) => {
    const fastKey = generateFastKey();
    // 1. Instant 0ms local display on screen
    setLocalChallengeKey(fastKey);
    setKeyRemainingSeconds(180);

    // 2. Optimistically update TanStack Query cache so any listener gets it immediately
    queryClient.setQueryData(['hyperbuild-details', session.id], (old: any) => {
      if (!old?.activities) return old;
      return {
        ...old,
        activities: old.activities.map((a: any) =>
          a.id === activityId
            ? {
                ...a,
                challenge_key: fastKey,
                challenge_key_active_until: new Date(Date.now() + 180000).toISOString(),
                status: 'active',
              }
            : a
        ),
      };
    });

    // 3. Fire mutation to sync with backend
    triggerKeyMutation.mutate({ activityId, customKey: fastKey });
  };

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

  // Synchronize key countdown timer with active_until
  useEffect(() => {
    if (localChallengeKey && keyRemainingSeconds > 0) {
      return;
    }
    if (currentActivity?.challenge_key_active_until) {
      const activeUntil = new Date(currentActivity.challenge_key_active_until).getTime();
      const now = Date.now();
      const diffSecs = Math.max(0, Math.floor((activeUntil - now) / 1000));
      setKeyRemainingSeconds(diffSecs);
      if (diffSecs === 0 && localChallengeKey) {
        setLocalChallengeKey(null);
      }
    } else if (!currentActivity?.challenge_key && !localChallengeKey) {
      setKeyRemainingSeconds(0);
    }
  }, [currentActivity?.challenge_key, currentActivity?.challenge_key_active_until, localChallengeKey]);

  // Countdown timer for Challenge Key
  useEffect(() => {
    if (keyRemainingSeconds <= 0) {
      if (localChallengeKey) setLocalChallengeKey(null);
      return;
    }
    const interval = setInterval(() => {
      setKeyRemainingSeconds((prev) => {
        if (prev <= 1) {
          if (localChallengeKey) setLocalChallengeKey(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [keyRemainingSeconds, localChallengeKey]);

  const filteredRoster = (rosterData?.roster || []).filter((st: any) => {
    if (rosterSearch.trim()) {
      const q = rosterSearch.toLowerCase();
      const matches =
        (st.full_name || '').toLowerCase().includes(q) ||
        (st.prn_no || '').toLowerCase().includes(q) ||
        (st.email || '').toLowerCase().includes(q);
      if (!matches) return false;
    }
    if (rosterFilter === 'present') return st.final_status === 'present';
    if (rosterFilter === 'absent') return st.final_status === 'absent';
    if (rosterFilter === 'downgraded') return Boolean(st.is_downgraded);
    if (rosterFilter === 'rc_absent') return st.roll_call_status === 'absent';
    return true;
  });

  const generateReportText = () => {
    if (!currentActivity || !rosterData) return '';
    const nowStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const downgradedStudents = (rosterData?.roster || []).filter((s: any) => s.is_downgraded);
    const rcAbsentStudents = (rosterData?.roster || []).filter((s: any) => s.roll_call_status === 'absent');

    let text = `📊 HYPERBUILD DUAL-VERIFICATION ATTENDANCE AUDIT REPORT\n`;
    text += `Session: ${session?.batch_name || 'Batch'} · ${session?.venue || 'HyperBuild Lab'}\n`;
    text += `Date: ${session?.session_date || nowStr} | Time: ${session?.start_time?.slice(0, 5)} - ${session?.end_time?.slice(0, 5)}\n`;
    text += `Activity #${currentActivity.activity_no}: ${currentActivity.title || 'Practical Lab'}\n`;
    text += `Assigned Subject: ${currentActivity.subject_name} (${currentActivity.subject_code})\n`;
    text += `---------------------------------------------------\n`;
    text += `👥 Total Students in Roster: ${rosterData?.roster?.length || 0}\n`;
    text += `✅ Roll Call Present: ${rosterData?.roll_call_present_count || 0}\n`;
    text += `❌ Roll Call Absent: ${rosterData?.roll_call_absent_count || 0}\n`;
    text += `🔑 Secret Keys Verified: ${rosterData?.keys_verified_count || 0}\n`;
    text += `⚠️ Auto-Absent Downgraded (Key Missing): ${rosterData?.downgraded_absent_count || 0}\n`;
    text += `📈 FINAL EFFECTIVE ATTENDANCE:\n`;
    text += `   • Present: ${rosterData?.final_present_count || 0}\n`;
    text += `   • Absent: ${rosterData?.final_absent_count || 0}\n`;

    if (downgradedStudents.length > 0) {
      text += `\n⚠️ AUTO-ABSENT STUDENTS (Marked Present in Roll Call, but Secret Key Missing):\n`;
      downgradedStudents.forEach((s: any, idx: number) => {
        text += `   ${idx + 1}. ${s.full_name} (PRN: ${s.prn_no || 'N/A'})\n`;
      });
    }

    if (rcAbsentStudents.length > 0) {
      text += `\n🔒 ROLL CALL ABSENT STUDENTS (Key Entry Locked Out):\n`;
      rcAbsentStudents.forEach((s: any, idx: number) => {
        text += `   ${idx + 1}. ${s.full_name} (PRN: ${s.prn_no || 'N/A'})\n`;
      });
    }

    return text;
  };

  const handleCopyReport = () => {
    const report = generateReportText();
    if (!report) return;
    navigator.clipboard.writeText(report);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-2 sm:p-4 overflow-y-auto animate-fadeIn" role="dialog" aria-modal="true">
      <div className="glass-panel w-full max-w-5xl rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 space-y-4 sm:space-y-6 my-2 sm:my-6 max-h-[96vh] sm:max-h-[92vh] overflow-y-auto">
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
                          <span>Screen Transition Key (180s)</span>
                        </div>
                        <p className="text-[11px] text-slate-500">Students enter this key within 180s to verify presence & submit.</p>
                      </div>

                      <div className="flex items-center space-x-3">
                        {effectiveChallengeKey ? (
                          <div className="flex items-center space-x-2">
                            <span className="px-4 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 font-mono font-bold text-xl text-amber-800 dark:text-amber-300 tracking-wider">
                              {effectiveChallengeKey}
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
                          onClick={() => handleTriggerKey(currentActivity.id)}
                          disabled={triggerKeyMutation.isPending}
                          className="px-3.5 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold text-xs hover:bg-slate-800 transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw className={`h-3 w-3 ${triggerKeyMutation.isPending ? 'animate-spin' : ''}`} />
                          <span>{effectiveChallengeKey ? 'New Key' : 'Reveal Key'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Dual Verification Audit Metrics Header & Report Button */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <ShieldAlert className="h-3.5 w-3.5 text-indigo-500" />
                        Dual Verification Attendance Audit
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowSummaryReportModal(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/60 text-slate-700 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-300 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-all cursor-pointer shadow-xs"
                      >
                        <ClipboardList className="h-3.5 w-3.5" />
                        <span>Audit Report</span>
                      </button>
                    </div>

                    {/* KPI Cards Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {/* Roll Call */}
                      <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center shadow-xs">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Roll Call</p>
                        <div className="flex items-center justify-center gap-1.5 mt-1">
                          <span className="text-sm font-extrabold text-emerald-600" title="Present in roll call">
                            {rosterData?.roll_call_present_count ?? 0} P
                          </span>
                          <span className="text-xs text-slate-300">/</span>
                          <span className="text-sm font-extrabold text-rose-600" title="Absent in roll call">
                            {rosterData?.roll_call_absent_count ?? 0} A
                          </span>
                        </div>
                      </div>

                      {/* Keys Verified */}
                      <div className="p-3 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 text-center shadow-xs">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Keys Verified</p>
                        <p className="text-lg font-black text-blue-600 dark:text-blue-400 mt-0.5">
                          {rosterData?.keys_verified_count ?? 0}
                        </p>
                      </div>

                      {/* Auto-Absent Downgraded */}
                      <div className={`p-3 rounded-2xl border text-center shadow-xs ${
                        (rosterData?.downgraded_absent_count ?? 0) > 0
                          ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800/80'
                          : 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800'
                      }`}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center justify-center gap-1">
                          {(rosterData?.downgraded_absent_count ?? 0) > 0 && <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />}
                          Auto-Absent
                        </p>
                        <p className={`text-lg font-black mt-0.5 ${
                          (rosterData?.downgraded_absent_count ?? 0) > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-slate-400'
                        }`}>
                          {rosterData?.downgraded_absent_count ?? 0}
                        </p>
                      </div>

                      {/* Final Attendance */}
                      <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-center shadow-xs">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Final Attendance</p>
                        <div className="flex items-center justify-center gap-1.5 mt-1">
                          <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-300" title="Final Present">
                            {rosterData?.final_present_count ?? 0} P
                          </span>
                          <span className="text-xs text-slate-300">/</span>
                          <span className="text-sm font-extrabold text-rose-600 dark:text-rose-400" title="Final Absent">
                            {rosterData?.final_absent_count ?? 0} A
                          </span>
                        </div>
                      </div>
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

                {/* Right Col: Live Attendance Roster */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center space-x-2">
                      <div className="p-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                        <Users className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                        Live Attendance Roster
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {rosterData?.roster?.length || 0} students
                      </span>
                    </div>
                  </div>

                  {/* Attendance Roster Content */}
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

                    {/* Search and Filters */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Filter by name, PRN, or email..."
                          value={rosterSearch}
                          onChange={(e) => setRosterSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                        />
                      </div>

                      <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none text-[11px] font-bold">
                        {[
                          { id: 'all', label: `All (${rosterData?.roster?.length || 0})` },
                          { id: 'present', label: `Present (${rosterData?.final_present_count || 0})` },
                          { id: 'absent', label: `Absent (${rosterData?.final_absent_count || 0})` },
                          { id: 'downgraded', label: `⚠️ Key Missing (${rosterData?.downgraded_absent_count || 0})` },
                          { id: 'rc_absent', label: `🔒 RC Absent (${rosterData?.roll_call_absent_count || 0})` },
                        ].map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setRosterFilter(f.id as any)}
                            className={`px-2.5 py-1 rounded-xl transition-all shrink-0 cursor-pointer ${
                              rosterFilter === f.id
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
                      {filteredRoster.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 italic text-xs">
                          No students match the current filter.
                        </div>
                      ) : (
                        filteredRoster.map((st: any) => {
                          const isRcAbsent = st.roll_call_status === 'absent';
                          const isFinalPresent = st.final_status === 'present' || st.final_status === 'late';
                          const isFinalLate = st.final_status === 'late';
                          const isDowngraded = Boolean(st.is_downgraded);

                          return (
                            <div
                              key={st.student_id}
                              className={`p-3 rounded-2xl border transition-all ${
                                isFinalPresent
                                  ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40'
                                  : isDowngraded
                                  ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900/60'
                                  : isRcAbsent
                                  ? 'bg-rose-50/30 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/30'
                                  : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800/40'
                              }`}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between sm:justify-start gap-2">
                                    <p className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm truncate">
                                      {st.full_name}
                                    </p>
                                    <span className={`sm:hidden px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${
                                      isFinalLate
                                        ? 'bg-amber-500 text-white shadow-xs'
                                        : isFinalPresent
                                        ? 'bg-emerald-600 text-white shadow-xs'
                                        : 'bg-rose-600 text-white shadow-xs'
                                    }`}>
                                      {isFinalLate ? 'Late' : isFinalPresent ? 'Present' : 'Absent'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono mt-0.5 flex-wrap">
                                    <span>{st.prn_no || st.email}</span>
                                    <span>•</span>
                                    <span className="truncate max-w-[160px] sm:max-w-none">
                                      {st.major_specialization ? `${st.major_specialization}` : 'General'}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-1.5 flex-wrap sm:flex-nowrap shrink-0 pt-1.5 sm:pt-0 border-t border-slate-200/60 dark:border-slate-800/60 sm:border-0">
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {/* Roll Call Pill */}
                                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                                      st.roll_call_status === 'present'
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                        : st.roll_call_status === 'late'
                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                        : st.roll_call_status === 'absent'
                                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                    }`}>
                                      RC: {st.roll_call_status || 'Unmarked'}
                                    </span>

                                    {/* Key Verification Pill */}
                                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                                      st.is_verified
                                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                        : isRcAbsent
                                        ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                    }`}>
                                      Key: {st.is_verified ? 'Verified' : isRcAbsent ? 'Locked' : 'Missing'}
                                    </span>

                                    {/* Final Status Badge on desktop */}
                                    <span className={`hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                      isFinalLate
                                        ? 'bg-amber-500 text-white shadow-xs'
                                        : isFinalPresent
                                        ? 'bg-emerald-600 text-white shadow-xs'
                                        : 'bg-rose-600 text-white shadow-xs'
                                    }`}>
                                      {isFinalLate ? 'Late' : isFinalPresent ? 'Present' : 'Absent'}
                                    </span>
                                  </div>

                                  {/* Action button */}
                                  {isFinalPresent ? (
                                    <button
                                      type="button"
                                      onClick={() => updateAttendanceMutation.mutate({ studentId: st.student_id, status: 'absent' })}
                                      disabled={updateAttendanceMutation.isPending}
                                      className="px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-[10px] font-bold transition-all cursor-pointer disabled:opacity-50 shrink-0"
                                      title="Override student to absent"
                                    >
                                      Mark Absent
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => updateAttendanceMutation.mutate({ studentId: st.student_id, status: 'present' })}
                                      disabled={updateAttendanceMutation.isPending}
                                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-xs shrink-0"
                                      title="Manually override and verify student present"
                                    >
                                      <Check className="h-2.5 w-2.5" />
                                      <span>Mark Present</span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Warning banners */}
                              {isDowngraded && (
                                <div className="mt-2 p-2 rounded-xl bg-amber-100/70 dark:bg-amber-950/60 border border-amber-300/80 dark:border-amber-900 text-[10px] font-bold text-amber-900 dark:text-amber-200 flex items-start gap-1.5 leading-normal">
                                  <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0 mt-0.5" />
                                  <span className="break-words flex-1">Auto-Absent Downgraded: Marked {st.roll_call_status === 'late' ? 'Late' : 'Present'} in Roll Call, but did not enter challenge key within window.</span>
                                </div>
                              )}

                              {isRcAbsent && (
                                <div className="mt-2 p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-[10px] font-medium text-slate-600 dark:text-slate-400 flex items-start gap-1.5 leading-normal">
                                  <Lock className="h-3 w-3 text-slate-400 shrink-0 mt-0.5" />
                                  <span className="break-words flex-1">Roll Call Absent: Student workspace key input is locked out.</span>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
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
              <span>Lock Activity Attendance Window</span>
            </h4>
            <p className="text-xs text-slate-500">
              Students will no longer be able to mark attendance with keys for this activity segment until reopened.
            </p>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">Reason for Lock (Audit Trail)</label>
              <input
                type="text"
                value={lockReasonInput}
                onChange={(e) => setLockReasonInput(e.target.value)}
                placeholder="e.g. Activity time expired / Attendance window closed"
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
              <span>Reopen Activity Attendance Window</span>
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

        {/* Session Summary Audit Report Modal */}
        {showSummaryReportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4 max-h-[88vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    <ClipboardList className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      HyperBuild Session Audit Report
                    </h3>
                    <p className="text-xs text-slate-500">
                      Dual-verification breakdown and auto-absent tracking
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSummaryReportModal(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Copy action & quick stats */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Activity #{currentActivity?.activity_no}: {currentActivity?.title}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyReport}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all cursor-pointer shadow-sm"
                  >
                    {copiedReport ? <CheckCheck className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedReport ? 'Copied to Clipboard!' : 'Copy Summary Report'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Roll Call</span>
                    <p className="font-extrabold text-slate-800 dark:text-slate-200 mt-0.5">
                      {rosterData?.roll_call_present_count ?? 0} P / {rosterData?.roll_call_absent_count ?? 0} A
                    </p>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Keys Verified</span>
                    <p className="font-extrabold text-blue-600 dark:text-blue-400 mt-0.5">
                      {rosterData?.keys_verified_count ?? 0}
                    </p>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Auto-Absent</span>
                    <p className="font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">
                      {rosterData?.downgraded_absent_count ?? 0}
                    </p>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Final Present</span>
                    <p className="font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {rosterData?.final_present_count ?? 0}
                    </p>
                  </div>
                </div>
              </div>

              {/* List of auto-absent students */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  <span>Auto-Absent Students ({rosterData?.downgraded_absent_count ?? 0})</span>
                </h4>
                {(rosterData?.roster || []).filter((s: any) => s.is_downgraded).length === 0 ? (
                  <p className="text-xs text-slate-400 italic p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                    None! All students marked present in roll call verified their secret keys.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {(rosterData?.roster || [])
                      .filter((s: any) => s.is_downgraded)
                      .map((s: any, idx: number) => (
                        <div key={s.student_id} className="p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white">{idx + 1}. {s.full_name}</span>
                            <span className="text-slate-500 text-[11px] ml-2 font-mono">PRN: {s.prn_no || 'N/A'}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              updateAttendanceMutation.mutate({ studentId: s.student_id, status: 'present' });
                            }}
                            disabled={updateAttendanceMutation.isPending}
                            className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition-all cursor-pointer disabled:opacity-50"
                          >
                            Override to Present
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Pre-formatted Text Preview */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-500">Report Preview:</span>
                <pre className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-[11px] font-mono whitespace-pre-wrap max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-800">
                  {generateReportText()}
                </pre>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowSummaryReportModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};
