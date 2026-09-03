import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Award,
  Sparkles,
  Download,
  Search,
  AlertTriangle,
  Edit3,
  CheckCircle2,
  X,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { api } from '../../lib/api';
import { StudentGradebookView } from './StudentGradebookView';

export const AdminGradebookDashboard: React.FC = () => {
  const queryClient = useQueryClient();

  // Filters state
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStudentForView, setSelectedStudentForView] = useState<string | null>(null);

  // Marks Entry Modal state
  const [editingGrade, setEditingGrade] = useState<{
    student_id: string;
    student_name: string;
    subject_id: string;
    subject_name: string;
    cce_score: number | '';
    term_end_score: number | '';
    remarks: string;
  } | null>(null);

  // AI Insights State
  const [isAiInsightsOpen, setIsAiInsightsOpen] = useState<boolean>(true);

  // Load Programs, Batches, Subjects for dropdowns
  const { data: subjectsData } = useQuery({
    queryKey: ['academic-subjects-list'],
    queryFn: async () => {
      const res = await api.get('/subjects');
      return res.data?.items || res.data || [];
    },
  });

  // Load Cohort Gradebook
  const { data: cohortData } = useQuery({
    queryKey: ['cohort-gradebook', selectedSubjectId, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedSubjectId) params.append('subject_id', selectedSubjectId);
      if (searchQuery) params.append('search', searchQuery);
      const res = await api.get(`/gradebook/cohort?${params.toString()}`);
      return res.data;
    },
  });

  // Load / Generate AI Cohort Insights
  const aiInsightsMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {};
      if (selectedSubjectId) payload.subject_id = selectedSubjectId;
      const res = await api.post('/gradebook/cohort/ai-insights', payload);
      return res.data;
    },
  });

  // Save Marks Mutation
  const saveMarksMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/gradebook/grades', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cohort-gradebook'] });
      setEditingGrade(null);
    },
  });

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (selectedSubjectId) params.append('subject_id', selectedSubjectId);
    const downloadUrl = `/gradebook/export?${params.toString()}`;
    window.open(api.defaults.baseURL + downloadUrl, '_blank');
  };

  const subjectsList = subjectsData || [];
  const rows = cohortData?.rows || [];
  const tierBreakdown = cohortData?.tier_breakdown || {};
  const cohortAverage = cohortData?.cohort_average;
  const totalStudents = cohortData?.total_students || 0;

  const getTierBadge = (tier?: string) => {
    if (!tier || tier === 'In Progress') {
      return <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">In Progress</span>;
    }
    if (tier.includes('Distinction')) {
      return <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-black bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300">Distinction</span>;
    }
    if (tier.includes('Merit')) {
      return <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300">Merit</span>;
    }
    if (tier.includes('Pass')) {
      return <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">Pass</span>;
    }
    return <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300">Needs Work</span>;
  };

  if (selectedStudentForView) {
    return (
      <StudentGradebookView
        studentId={selectedStudentForView}
        onBackToCohort={() => setSelectedStudentForView(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <Award className="w-6 h-6 text-indigo-600" /> Academic Gradebook & Cohort Intelligence
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Master marksheet combining CCE Continuous Evaluation, HyperBuild Practical Labs, and Term End Examination
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => aiInsightsMutation.mutate()}
            disabled={aiInsightsMutation.isPending}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-black transition-all shadow-md shadow-purple-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {aiInsightsMutation.isPending ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Synthesizing AI Insights...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" /> Generate AI Cohort Insights
              </>
            )}
          </button>

          <button
            onClick={handleExportCsv}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all shadow-md shadow-emerald-500/20 flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Export Excel/CSV
          </button>
        </div>
      </div>

      {/* Cohort KPIs Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">Cohort Average</span>
          <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
            {cohortAverage !== null && cohortAverage !== undefined ? `${cohortAverage}%` : '—'}
          </p>
          <span className="text-[10px] text-slate-400">Across enrolled subjects</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">Total Cohort</span>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalStudents}</p>
          <span className="text-[10px] text-slate-400">Active Students</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] uppercase tracking-wider text-purple-600 font-bold block">Distinction / Merit</span>
          <p className="text-2xl font-black text-purple-600 mt-1">
            {(tierBreakdown.Distinction || 0) + (tierBreakdown.Merit || 0)}
          </p>
          <span className="text-[10px] text-slate-400">
            {totalStudents > 0
              ? `${Math.round((((tierBreakdown.Distinction || 0) + (tierBreakdown.Merit || 0)) / totalStudents) * 100)}% of cohort`
              : '—'}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] uppercase tracking-wider text-emerald-600 font-bold block">Pass Tier</span>
          <p className="text-2xl font-black text-emerald-600 mt-1">{tierBreakdown.Pass || 0}</p>
          <span className="text-[10px] text-slate-400">Secured 50–69%</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] uppercase tracking-wider text-rose-600 font-bold block">At-Risk (&lt;50%)</span>
          <p className="text-2xl font-black text-rose-600 mt-1">{tierBreakdown['Needs Work'] || 0}</p>
          <span className="text-[10px] text-slate-400">Needs Remediation</span>
        </div>
      </div>

      {/* AI-Driven Cohort Intelligence Card */}
      {aiInsightsMutation.data && (
        <div className="rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 border border-indigo-900/60 p-6 text-white shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
                <Sparkles className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-purple-200">
                  AI-Driven Cohort Pedagogical Intelligence
                </h3>
                <p className="text-[11px] text-slate-400">
                  Generated via {aiInsightsMutation.data.model_used || 'HyperBuild Assessment Engine'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsAiInsightsOpen(!isAiInsightsOpen)}
              className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              {isAiInsightsOpen ? 'Collapse' : 'Expand'}
            </button>
          </div>

          {isAiInsightsOpen && (
            <div className="space-y-4 pt-2 border-t border-white/10 text-xs">
              {/* Executive Summary */}
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-slate-200 leading-relaxed">
                <strong className="text-purple-300 block mb-1 font-black text-[11px] uppercase tracking-wider">
                  Executive Appraisal:
                </strong>
                {aiInsightsMutation.data.executive_summary}
              </div>

              {/* Grid: Strengths & Learning Gaps */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-800/40 space-y-2">
                  <span className="text-[11px] uppercase font-black tracking-wider text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Key Competencies Demonstrated
                  </span>
                  <ul className="space-y-1.5 text-slate-300">
                    {aiInsightsMutation.data.key_competencies_demonstrated?.map((s: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-emerald-400 font-bold">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-3.5 rounded-2xl bg-rose-950/20 border border-rose-800/40 space-y-2">
                  <span className="text-[11px] uppercase font-black tracking-wider text-rose-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Systemic Rubric Gaps & Remediation Focus
                  </span>
                  <ul className="space-y-1.5 text-slate-300">
                    {aiInsightsMutation.data.systemic_learning_gaps?.map((g: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-rose-400 font-bold">•</span>
                        <span>{g}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* AI Offloading Analysis & Recommendations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <strong className="text-indigo-300 block mb-1 font-black text-[11px] uppercase tracking-wider">
                    Student AI Engagement Diagnostic:
                  </strong>
                  <p className="text-slate-300 leading-relaxed">{aiInsightsMutation.data.ai_offloading_analysis}</p>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <strong className="text-purple-300 block mb-1 font-black text-[11px] uppercase tracking-wider">
                    Actionable Faculty Interventions:
                  </strong>
                  <ul className="space-y-1 text-slate-300">
                    {aiInsightsMutation.data.at_risk_interventions?.map((rec: string, idx: number) => (
                      <li key={idx} className="truncate">
                        • {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cohort Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Subject Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Subject:</span>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
            >
              <option value="">All Subjects (Master Composite)</option>
              {subjectsList.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.code} - {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search student or PRN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white w-48 sm:w-64"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          Showing {rows.length} students
        </div>
      </div>

      {/* Cohort Master Matrix Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                <th className="py-3 px-4">Student & PRN</th>
                <th className="py-3 px-3">Division</th>
                <th className="py-3 px-3">Overall Avg</th>
                <th className="py-3 px-3">Overall Tier</th>
                <th className="py-3 px-3">Subject Component Breakdown</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {rows.map((row: any) => (
                <tr key={row.student_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900 dark:text-white">{row.name}</div>
                    <div className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                      {row.prn}
                    </div>
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-500">{row.division}</td>
                  <td className="py-3 px-3 font-black text-slate-900 dark:text-white text-sm">
                    {row.overall_average !== null ? `${row.overall_average}%` : '—'}
                  </td>
                  <td className="py-3 px-3">{getTierBadge(row.overall_tier)}</td>
                  <td className="py-3 px-3">
                    <div className="flex flex-wrap items-center gap-1.5 max-w-xl">
                      {row.subjects?.map((s: any) => (
                        <div
                          key={s.subject_id}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10.5px] flex items-center gap-2 flex-wrap"
                        >
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{s.subject_code}</span>
                          <span className="text-slate-500 font-semibold" title="CCE Marks">
                            CCE: {s.cce_score !== null && s.cce_score !== undefined ? `${s.cce_score}` : '-'}
                          </span>
                          <span className="text-indigo-600 dark:text-indigo-300 font-semibold" title="HyperBuild Total and Average">
                            HB: {s.hyperbuild_total_score !== null && s.hyperbuild_total_score !== undefined ? `${s.hyperbuild_total_score} (${s.hyperbuild_score || 0} avg)` : '-'}
                          </span>
                          <span className="text-slate-500 font-semibold" title="End Term Marks">
                            End: {s.term_end_score !== null && s.term_end_score !== undefined ? `${s.term_end_score}` : '-'}
                          </span>
                          <span className="font-black text-slate-900 dark:text-white border-l border-slate-200 dark:border-slate-700 pl-1.5">
                            {s.total_percentage !== null ? `${s.total_percentage}%` : 'IP'} ({s.grade_letter})
                          </span>
                          <button
                            onClick={() =>
                              setEditingGrade({
                                student_id: row.student_id,
                                student_name: row.name,
                                subject_id: s.subject_id,
                                subject_name: s.subject_name,
                                cce_score: s.cce_score ?? '',
                                term_end_score: s.term_end_score ?? '',
                                remarks: '',
                              })
                            }
                            className="text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer p-0.5"
                            title="Edit CCE & End Term Marks"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setSelectedStudentForView(row.student_id)}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/60 text-slate-700 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-300 font-bold text-xs transition-all cursor-pointer inline-flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> View Transcript
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Marks Entry / Edit Modal */}
      {editingGrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">Record / Edit Component Marks</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {editingGrade.student_name} • {editingGrade.subject_name}
                </p>
              </div>
              <button
                onClick={() => setEditingGrade(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Continuous Comprehensive Evaluation (CCE) Marks
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={editingGrade.cce_score}
                  onChange={(e) =>
                    setEditingGrade({
                      ...editingGrade,
                      cce_score: e.target.value === '' ? '' : parseFloat(e.target.value),
                    })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                  placeholder="e.g. 42.5"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  End Term Examination Marks
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={editingGrade.term_end_score}
                  onChange={(e) =>
                    setEditingGrade({
                      ...editingGrade,
                      term_end_score: e.target.value === '' ? '' : parseFloat(e.target.value),
                    })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                  placeholder="e.g. 45.0"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Faculty Comments / Remarks (Optional)
                </label>
                <textarea
                  value={editingGrade.remarks}
                  onChange={(e) => setEditingGrade({ ...editingGrade, remarks: e.target.value })}
                  rows={2}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  placeholder="e.g. Strong conceptual grasp shown in viva."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setEditingGrade(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  saveMarksMutation.mutate({
                    student_id: editingGrade.student_id,
                    subject_id: editingGrade.subject_id,
                    cce_score: editingGrade.cce_score === '' ? null : editingGrade.cce_score,
                    term_end_score: editingGrade.term_end_score === '' ? null : editingGrade.term_end_score,
                    remarks: editingGrade.remarks,
                  })
                }
                disabled={saveMarksMutation.isPending}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 cursor-pointer disabled:opacity-50"
              >
                {saveMarksMutation.isPending ? 'Saving...' : 'Save Component Marks'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
