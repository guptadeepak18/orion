import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../../components/Card';

export const SystemSettingsPage: React.FC = () => {
  const [instName, setInstName] = useState('Lexicon MILE');
  const [deptName, setDeptName] = useState('Career Readiness Cell (CRC)');
  const [slaHours, setSlaHours] = useState('24');
  const [llmProvider, setLlmProvider] = useState('anthropic');
  const [lastAgentResult, setLastAgentResult] = useState<string | null>(null);

  const queryClient = useQueryClient();

  useQuery({
    queryKey: ['system_settings'],
    queryFn: async () => {
      const res = await api.get('/system/settings');
      return res.data.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.put('/system/settings', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system_settings'] });
    },
  });

  const triggerAgentMutation = useMutation({
    mutationFn: async (agentName: string) => {
      const res = await api.post(`/system/agents/${agentName}/trigger`);
      return res.data;
    },
    onSuccess: (data) => {
      setLastAgentResult(data.data.action_taken);
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      institution_name: instName,
      department_name: deptName,
      default_session_sla_hours: parseInt(slaHours),
      llm_provider: llmProvider,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight gradient-text">System Administration & AI Settings</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Configure institutional branding, LLM provider selection, SLA turnaround rules, and AI Sentinel agent overrides.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Settings Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card title="Institutional & LLM Configuration">
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Institution Name
                  </label>
                  <input
                    type="text"
                    required
                    value={instName}
                    onChange={(e) => setInstName(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Department Name
                  </label>
                  <input
                    type="text"
                    required
                    value={deptName}
                    onChange={(e) => setDeptName(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Active LLM Provider
                  </label>
                  <select
                    value={llmProvider}
                    onChange={(e) => setLlmProvider(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="anthropic">Anthropic Claude (Recommended)</option>
                    <option value="openai">OpenAI GPT-4o</option>
                    <option value="local_fallback">Local Deterministic Fallback</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Approval SLA Threshold (Hours)
                  </label>
                  <input
                    type="number"
                    required
                    value={slaHours}
                    onChange={(e) => setSlaHours(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/35 transition-all"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </Card>
        </div>

        {/* AI Sentinel Override Panel */}
        <div className="space-y-6">
          <Card title="AI Sentinel Agent Console">
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Scheduler Sentinel</p>
                  <p className="text-[10px] text-slate-500">Conflict Guard</p>
                </div>
                <button
                  onClick={() => triggerAgentMutation.mutate('scheduler_sentinel')}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 flex items-center space-x-1 transition-colors"
                >
                  <Play className="h-3 w-3" />
                  <span>Audit</span>
                </button>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Faculty Compliance Agent</p>
                  <p className="text-[10px] text-slate-500">Document Expiry Scan</p>
                </div>
                <button
                  onClick={() => triggerAgentMutation.mutate('faculty_compliance_agent')}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 flex items-center space-x-1 transition-colors"
                >
                  <Play className="h-3 w-3" />
                  <span>Scan</span>
                </button>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Approval Watchdog</p>
                  <p className="text-[10px] text-slate-500">SLA Audit & Escalation</p>
                </div>
                <button
                  onClick={() => triggerAgentMutation.mutate('approval_watchdog')}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 flex items-center space-x-1 transition-colors"
                >
                  <Play className="h-3 w-3" />
                  <span>Run</span>
                </button>
              </div>

              {lastAgentResult && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-300 flex items-start space-x-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <p>{lastAgentResult}</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
