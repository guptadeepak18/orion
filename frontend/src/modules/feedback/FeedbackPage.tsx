import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { QrCode, Sparkles, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../../components/Card';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuthStore } from '../../lib/store';

export const FeedbackPage: React.FC = () => {
  const userRoles = useAuthStore((state) => state.user?.roles || []);
  const isStudent = userRoles.includes('student') && !userRoles.includes('crc_admin');

  const [openText, setOpenText] = useState('Excellent and highly engaging lecture! Great real-world case studies.');
  const [submittedScore, setSubmittedScore] = useState<number | null>(null);

  const submitMutation = useMutation({
    mutationFn: async () => {
      // Submit demo response
      const res = await api.post('/feedback/responses', {
        form_id: '00000000-0000-0000-0000-000000000000',
        ratings: { q1: 5, q2: 5, q3: 4 },
        open_text: openText,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setSubmittedScore(data.data.sentiment_score);
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight gradient-text">
            {isStudent ? 'Session & Faculty Feedback' : 'Feedback Forms & Evaluations'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {isStudent
              ? 'Submit your feedback and ratings for conducted academic sessions to help improve teaching quality.'
              : 'View session feedback forms, QR codes, and response sentiment summaries.'}
          </p>
        </div>
      </div>

      {/* Status Banner (Staff & Faculty Only) */}
      {!isStudent && (
        <div className="p-4 rounded-2xl glass-card border border-cyan-200 dark:border-cyan-500/30 bg-cyan-50/50 dark:bg-cyan-950/20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-cyan-100 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-200">Automated Feedback Processing Active</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Automatically generates feedback forms and QR codes on session completion and processes response sentiment.
              </p>
            </div>
          </div>
          <StatusBadge status="active" label="Active" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sample Form Builder & QR Preview */}
        <Card title="Session QR Feedback Generator">
          <div className="space-y-4">
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center">
              <div className="h-28 w-28 rounded-2xl bg-white dark:bg-slate-950 border border-cyan-300 dark:border-cyan-500/30 p-3 flex items-center justify-center mb-3 shadow-inner">
                <QrCode className="h-20 w-20 text-cyan-600 dark:text-cyan-400" />
              </div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Scannable Student Feedback QR</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Auto-generated upon session completion</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Default Questions</label>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 space-y-1">
                <p>1. How clearly did the faculty explain core concepts? (1-5)</p>
                <p>2. How interactive and engaging was the session? (1-5)</p>
                <p>3. Open constructive comments</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Sentiment Analysis Test Widget */}
        <Card title="Live Sentiment Analyzer">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Student Open Comments
              </label>
              <textarea
                value={openText}
                onChange={(e) => setOpenText(e.target.value)}
                className="w-full h-28 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl p-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <button
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
              className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/35 transition-all duration-200 disabled:opacity-50"
            >
              {submitMutation.isPending ? 'Analyzing Sentiment...' : 'Analyze Feedback Sentiment'}
            </button>

            {submittedScore !== null && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center space-x-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Sentiment Score Calculated</p>
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                    Score: {submittedScore} (Positive Sentiment)
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
