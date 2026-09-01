import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckSquare, Check, X, Sparkles, Bot } from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../../components/Card';
import { StatusBadge } from '../../components/StatusBadge';
import { useRoleAccess } from '../../lib/useRoleAccess';

interface PendingApproval {
  id: string;
  entity_type: string;
  entity_id: string;
  new_status: string;
  context_summary?: string;
  acted_at: string;
}

export const ApprovalsPage: React.FC = () => {
  const { canApprove } = useRoleAccess();
  const queryClient = useQueryClient();

  const { data: approvals, isLoading } = useQuery({
    queryKey: ['pending_approvals'],
    queryFn: async () => {
      const res = await api.get('/approvals/pending');
      return res.data.data as PendingApproval[];
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({ stage_id, entity_type, entity_id, action, comments }: any) => {
      const res = await api.post('/approvals/action', {
        stage_id,
        entity_type,
        entity_id,
        action,
        comments,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending_approvals'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight gradient-text">Approvals & Sign-off Inbox</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Review academic engagements, curriculum updates, and fee approvals with automated context summaries.
          </p>
        </div>
      </div>

      {/* SLA Status Banner */}
      <div className="p-4 rounded-2xl glass-card border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-950/20 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-200">Turnaround Tracking Active</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Generates concise summaries and sends timely reminders to ensure prompt review cycles.
            </p>
          </div>
        </div>
        <StatusBadge status="active" label="Tracking Active" />
      </div>

      {/* Pending Items */}
      <Card title="Pending Approvals Inbox">
        {isLoading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-4">Loading approval inbox...</p>
        ) : !approvals || approvals.length === 0 ? (
          <div className="py-12 text-center">
            <CheckSquare className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-600 mb-3" />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-300">All clear! No pending approval requests.</p>
            <p className="text-xs text-slate-500 mt-1">New requests will appear here with AI summaries.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {approvals.map((item) => (
              <div
                key={item.id}
                className="p-5 rounded-2xl glass-card border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
              >
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30 capitalize">
                      {item.entity_type}
                    </span>
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400">ID: {item.entity_id.substring(0, 8)}</span>
                    <StatusBadge status={item.new_status} />
                  </div>

                  {item.context_summary && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 text-xs text-slate-700 dark:text-slate-300 flex items-start space-x-2.5">
                      <Sparkles className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                      <p><span className="font-semibold text-cyan-700 dark:text-cyan-300">AI Context Summary:</span> {item.context_summary}</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-3 shrink-0">
                  {canApprove ? (
                    <>
                      <button
                        onClick={() =>
                          actionMutation.mutate({
                            stage_id: '00000000-0000-0000-0000-000000000000',
                            entity_type: item.entity_type,
                            entity_id: item.entity_id,
                            action: 'rejected',
                            comments: 'Rejected by approver',
                          })
                        }
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30 dark:hover:bg-rose-500/20 flex items-center space-x-1.5 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>Reject</span>
                      </button>

                      <button
                        onClick={() =>
                          actionMutation.mutate({
                            stage_id: '00000000-0000-0000-0000-000000000000',
                            entity_type: item.entity_type,
                            entity_id: item.entity_id,
                            action: 'approved',
                            comments: 'Approved by approver',
                          })
                        }
                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white flex items-center space-x-1.5 shadow-lg shadow-emerald-500/20 transition-colors"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Approve Stage</span>
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-slate-400 font-medium px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                      Pending Approver Action
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
