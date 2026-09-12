import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Bell,
  X,
  Send,
  Users,
  CheckSquare,
  Square,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  Calendar,
  Mail,
} from 'lucide-react';
import { api } from '../../lib/api';

interface IdeathonBroadcastModalProps {
  ideathon: {
    id: string;
    title: string;
    theme: string;
    target_programs?: string[];
    target_batches?: string[];
    submission_end_at?: string;
  } | null;
  isOpen: boolean;
  onClose: () => void;
}

interface ProgramItem {
  id: string;
  code: string;
  name: string;
}

interface BatchItem {
  id: string;
  name: string;
  program_id: string;
}

export const IdeathonBroadcastModal: React.FC<IdeathonBroadcastModalProps> = ({
  ideathon,
  isOpen,
  onClose,
}) => {
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [successResult, setSuccessResult] = useState<{
    notified_count: number;
    emails_queued?: number;
    email_dispatched?: boolean;
    message: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch all programs
  const { data: programs = [] } = useQuery<ProgramItem[]>({
    queryKey: ['academic-programs'],
    queryFn: async () => {
      const res = await api.get('/academic/programs');
      return res.data?.data || [];
    },
    enabled: isOpen,
  });

  // Fetch all batches
  const { data: batches = [] } = useQuery<BatchItem[]>({
    queryKey: ['academic-batches'],
    queryFn: async () => {
      const res = await api.get('/academic/batches');
      return res.data?.data || [];
    },
    enabled: isOpen,
  });

  // Pre-fill defaults when ideathon opens
  useEffect(() => {
    if (ideathon && isOpen) {
      setTitle(`📢 Innovation Challenge: ${ideathon.title}`);
      const deadlineStr = ideathon.submission_end_at
        ? ` Registration & submissions are now open until ${new Date(ideathon.submission_end_at).toLocaleDateString()}.`
        : '';
      setMessage(
        `Exciting news! The '${ideathon.title}' is officially open. Theme: ${ideathon.theme}.${deadlineStr} Form your venture team and register via the Competitions Hub to compete for incubation grants and awards!`
      );
      setSuccessResult(null);
      setErrorMessage(null);

      // Initialize selected programs from ideathon target_programs
      if (ideathon.target_programs && !ideathon.target_programs.includes('ALL')) {
        setSelectedPrograms(ideathon.target_programs);
      } else {
        setSelectedPrograms(['ALL']);
      }

      // Initialize selected batches
      if (ideathon.target_batches && !ideathon.target_batches.includes('ALL')) {
        setSelectedBatches(ideathon.target_batches);
      } else {
        setSelectedBatches(['ALL']);
      }
    }
  }, [ideathon, isOpen]);

  // Broadcast Mutation
  const broadcastMutation = useMutation({
    mutationFn: async () => {
      if (!ideathon?.id) throw new Error('No competition selected');
      const res = await api.post(`/ideathons/${ideathon.id}/broadcast`, {
        program_ids: selectedPrograms,
        batch_ids: selectedBatches,
        title: title.trim(),
        message: message.trim(),
        send_email: sendEmail,
      });
      return res.data?.data;
    },
    onSuccess: (data) => {
      setSuccessResult(data);
      setErrorMessage(null);
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.detail || 'Failed to dispatch notification broadcast.');
    },
  });

  if (!isOpen || !ideathon) return null;

  // Toggle Program Selection
  const toggleProgram = (progId: string) => {
    if (progId === 'ALL') {
      setSelectedPrograms(['ALL']);
      return;
    }

    let next = selectedPrograms.filter((p) => p !== 'ALL');
    if (next.includes(progId)) {
      next = next.filter((p) => p !== progId);
      if (next.length === 0) next = ['ALL'];
    } else {
      next.push(progId);
    }
    setSelectedPrograms(next);
  };

  // Toggle Batch Selection
  const toggleBatch = (batchId: string) => {
    if (batchId === 'ALL') {
      setSelectedBatches(['ALL']);
      return;
    }

    let next = selectedBatches.filter((b) => b !== 'ALL');
    if (next.includes(batchId)) {
      next = next.filter((b) => b !== batchId);
      if (next.length === 0) next = ['ALL'];
    } else {
      next.push(batchId);
    }
    setSelectedBatches(next);
  };

  // Filter batches to show based on selected programs
  const visibleBatches = selectedPrograms.includes('ALL')
    ? batches
    : batches.filter((b) => selectedPrograms.includes(b.program_id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Broadcast Competition Notification</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Trigger in-app notification & alert to students in targeted cohorts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {successResult ? (
            <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">Broadcast Dispatched Successfully</h4>
              <div className="text-sm text-slate-600 dark:text-slate-300 space-y-2">
                <p>
                  Delivered in-app notification to{' '}
                  <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                    {successResult.notified_count} student accounts
                  </strong>
                  . Students will see the alert in their top notification bell with a direct link to the challenge.
                </p>
                {successResult.emails_queued !== undefined && successResult.emails_queued > 0 ? (
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/60 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Queued {successResult.emails_queued} announcement emails via Orion Mail Service (Hostinger / Brevo fallback).
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="pt-2">
                <button
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold text-xs hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Competition Context Banner */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Target Competition</span>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{ideathon.title}</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Theme: {ideathon.theme}
                </span>
              </div>

              {/* Program Multi-Select */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-cyan-500" />
                    Target Academic Programs (Multiple Selection)
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {selectedPrograms.includes('ALL') ? 'All Programs' : `${selectedPrograms.length} selected`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => toggleProgram('ALL')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      selectedPrograms.includes('ALL')
                        ? 'bg-cyan-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-cyan-500/50'
                    }`}
                  >
                    {selectedPrograms.includes('ALL') ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                    All Programs
                  </button>

                  {programs.map((p) => {
                    const isSelected = selectedPrograms.includes(p.id) || selectedPrograms.includes(p.code);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleProgram(p.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          isSelected && !selectedPrograms.includes('ALL')
                            ? 'bg-cyan-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-cyan-500/50'
                        }`}
                      >
                        {isSelected && !selectedPrograms.includes('ALL') ? (
                          <CheckSquare className="w-3.5 h-3.5" />
                        ) : (
                          <Square className="w-3.5 h-3.5" />
                        )}
                        <span>{p.code}</span>
                        <span className="text-[10px] opacity-70 hidden sm:inline">({p.name})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Batch Multi-Select */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-cyan-500" />
                    Target Batches (Multiple Selection)
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {selectedBatches.includes('ALL') ? 'All Batches' : `${selectedBatches.length} selected`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 max-h-36 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => toggleBatch('ALL')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      selectedBatches.includes('ALL')
                        ? 'bg-cyan-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-cyan-500/50'
                    }`}
                  >
                    {selectedBatches.includes('ALL') ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                    All Batches
                  </button>

                  {visibleBatches.map((b) => {
                    const isSelected = selectedBatches.includes(b.id) || selectedBatches.includes(b.name);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => toggleBatch(b.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          isSelected && !selectedBatches.includes('ALL')
                            ? 'bg-cyan-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-cyan-500/50'
                        }`}
                      >
                        {isSelected && !selectedBatches.includes('ALL') ? (
                          <CheckSquare className="w-3.5 h-3.5" />
                        ) : (
                          <Square className="w-3.5 h-3.5" />
                        )}
                        <span>{b.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Broadcast Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Notification Subject / Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 📢 New Competition: HyperBuild Ideathon 2026"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {/* Broadcast Message */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Notification Message Body</label>
                <textarea
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter clear instructions for students..."
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {/* Email Broadcast Toggle */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <label htmlFor="send-email-toggle" className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer block">
                      Dispatch Official Email Notifications
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Sends branded HTML invitation emails to students' registered <code className="text-[10px] text-indigo-500 dark:text-indigo-400 font-mono">@mile.education</code> inboxes via Orion Mail Service (Hostinger / Brevo fallback).
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                  <input
                    id="send-email-toggle"
                    type="checkbox"
                    checked={sendEmail}
                    onChange={(e) => setSendEmail(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-cyan-600"></div>
                </label>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!successResult && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Users className="w-4 h-4 text-cyan-500" />
              <span>Broadcasts in-app alerts{sendEmail ? ' & sends student emails' : ''}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={broadcastMutation.isPending || !title.trim()}
                onClick={() => broadcastMutation.mutate()}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer"
              >
                {broadcastMutation.isPending ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Broadcasting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Notification</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
