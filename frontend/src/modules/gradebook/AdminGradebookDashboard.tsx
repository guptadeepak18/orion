import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  Search,
  AlertTriangle,
  Edit3,
  X,
  RefreshCw,
  Eye,
  Filter,
  RotateCcw,
  Check,
  BarChart3,
  FileSpreadsheet,
} from 'lucide-react';
import { api } from '../../lib/api';
import { StudentGradebookView } from './StudentGradebookView';
import { GradebookExportModal } from '../../components/GradebookExportModal';

interface AdminGradebookDashboardProps {
  onViewStudentTranscript?: (studentId: string) => void;
}

export const AdminGradebookDashboard: React.FC<AdminGradebookDashboardProps> = ({
  onViewStudentTranscript,
}) => {
  const queryClient = useQueryClient();

  // Filters state
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedComponent, setSelectedComponent] = useState<'all' | 'cce' | 'hyperbuild' | 'term_end'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStudentForView, setSelectedStudentForView] = useState<string | null>(null);

  // Comprehensive Export Modal State (.xlsx)
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

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
  const [isAiInsightsOpen, setIsAiInsightsOpen] = useState<boolean>(false);

  // 1. Load Programs
  const { data: programsData } = useQuery({
    queryKey: ['academic-programs-list'],
    queryFn: async () => {
      const res = await api.get('/academic/programs');
      return res.data?.data || res.data || [];
    },
  });

  // 2. Load Batches
  const { data: batchesData } = useQuery({
    queryKey: ['academic-batches-list'],
    queryFn: async () => {
      const res = await api.get('/academic/batches');
      return res.data?.data || res.data || [];
    },
  });

  // 3. Load Divisions
  const { data: divisionsData } = useQuery({
    queryKey: ['academic-divisions-list'],
    queryFn: async () => {
      const res = await api.get('/academic/divisions');
      return res.data?.data || res.data || [];
    },
  });

  // 4. Load Subjects
  const { data: subjectsData } = useQuery({
    queryKey: ['academic-subjects-list'],
    queryFn: async () => {
      const res = await api.get('/subjects');
      return res.data?.items || res.data || [];
    },
  });

  // 5. Load Cohort Gradebook Matrix
  const { data: cohortData } = useQuery({
    queryKey: [
      'cohort-gradebook',
      selectedProgramId,
      selectedBatchId,
      selectedDivisionId,
      selectedSubjectId,
      searchQuery,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedProgramId) params.append('program_id', selectedProgramId);
      if (selectedBatchId) params.append('batch_id', selectedBatchId);
      if (selectedDivisionId) params.append('division_id', selectedDivisionId);
      if (selectedSubjectId) params.append('subject_id', selectedSubjectId);
      if (searchQuery) params.append('search', searchQuery);
      const res = await api.get(`/gradebook/cohort?${params.toString()}`);
      return res.data;
    },
  });

  // AI Cohort Insights Mutation
  const aiInsightsMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {};
      if (selectedSubjectId) payload.subject_id = selectedSubjectId;
      if (selectedBatchId) payload.batch_id = selectedBatchId;
      const res = await api.post('/gradebook/cohort/ai-insights', payload);
      return res.data;
    },
    onSuccess: () => {
      setIsAiInsightsOpen(true);
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

  // Granular Subject-Wise Analytics Query
  const { data: subjectAnalytics } = useQuery({
    queryKey: ['subject-analytics', selectedSubjectId, selectedBatchId, selectedDivisionId],
    queryFn: async () => {
      if (!selectedSubjectId) return null;
      const params = new URLSearchParams();
      if (selectedBatchId) params.append('batch_id', selectedBatchId);
      if (selectedDivisionId) params.append('division_id', selectedDivisionId);
      const res = await api.get(`/gradebook/subjects/${selectedSubjectId}/analytics?${params.toString()}`);
      return res.data;
    },
    enabled: Boolean(selectedSubjectId),
  });

  const handleResetFilters = () => {
    setSelectedProgramId('');
    setSelectedBatchId('');
    setSelectedDivisionId('');
    setSelectedSubjectId('');
    setSelectedComponent('all');
    setSearchQuery('');
  };

  const hasActiveFilters =
    Boolean(selectedProgramId) ||
    Boolean(selectedBatchId) ||
    Boolean(selectedDivisionId) ||
    Boolean(selectedSubjectId) ||
    selectedComponent !== 'all' ||
    Boolean(searchQuery);

  const programsList = Array.isArray(programsData) ? programsData : [];
  const batchesList = Array.isArray(batchesData) ? batchesData : [];
  const divisionsList = Array.isArray(divisionsData) ? divisionsData : [];
  const subjects = Array.isArray(subjectsData) ? subjectsData : [];
  const subjectsList = subjects;

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
      {/* Clean Header Bar: Sub-heading & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Cohort Performance & Grades
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Master marksheet combining Continuous Evaluation (CCE), HyperBuild simulation labs, and Term End Examination
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => aiInsightsMutation.mutate()}
            disabled={aiInsightsMutation.isPending}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {aiInsightsMutation.isPending ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" /> AI Cohort Insights
              </>
            )}
          </button>

          <button
            onClick={() => setIsExportModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Export Marksheet (.xlsx)
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

      {/* AI Cohort Insights Drawer - Plain, Simple & Consistent */}
      {aiInsightsMutation.data && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  AI Cohort Assessment Diagnostic & Insights
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Synthesized across {rows.length} cohort students and {subjectsList.length} subjects
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsAiInsightsOpen(!isAiInsightsOpen)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              {isAiInsightsOpen ? 'Collapse' : 'Expand'}
            </button>
          </div>

          {isAiInsightsOpen && (
            <div className="space-y-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              {/* Executive Appraisal */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 leading-relaxed">
                <strong className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block mb-1">
                  Executive Appraisal:
                </strong>
                {aiInsightsMutation.data.executive_summary}
              </div>

              {/* Grid: Strengths & Learning Gaps */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Key Competencies Demonstrated
                  </span>
                  <ul className="space-y-1.5 text-emerald-950 dark:text-emerald-200">
                    {aiInsightsMutation.data.key_competencies_demonstrated?.map((s: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-emerald-500 font-bold">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" /> Systemic Rubric Gaps & Remediation Focus
                  </span>
                  <ul className="space-y-1.5 text-rose-950 dark:text-rose-200">
                    {aiInsightsMutation.data.systemic_learning_gaps?.map((g: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-rose-500 font-bold">•</span>
                        <span>{g}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* AI Engagement Analysis & Interventions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 space-y-1">
                  <strong className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block mb-1">
                    Student AI Engagement Diagnostic:
                  </strong>
                  <p className="leading-relaxed">{aiInsightsMutation.data.ai_offloading_analysis}</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 space-y-1">
                  <strong className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block mb-1">
                    Actionable Faculty Interventions:
                  </strong>
                  <ul className="space-y-1.5">
                    {aiInsightsMutation.data.at_risk_interventions?.map((rec: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-slate-400 font-bold">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DEDICATED SECTION ON TOP TO ANALYZE BY SUBJECT */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
        {/* Header with Subject Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Subject Performance Analysis & Diagnostics
              </h3>
              <p className="text-[11px] text-slate-400">
                Detailed simulation completion rates, evaluation metrics, and rubric diagnostics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs font-bold text-slate-500 shrink-0">Analyze Subject:</label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
            >
              <option value="">-- Choose Subject to Inspect --</option>
              {subjects.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedSubjectId ? (
          subjectAnalytics ? (
            <div className="space-y-5">
              {/* Subject Scheme Banner & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-extrabold text-[11px]">
                      {subjectAnalytics.subject?.code}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {subjectAnalytics.subject?.name}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Evaluation Scheme: CCE ({subjectAnalytics.subject?.cce_max_marks} marks) • HyperBuild ({subjectAnalytics.subject?.total_activities} simulation labs) • Term End Exam ({subjectAnalytics.subject?.term_end_max_marks} marks)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsExportModalOpen(true)}
                    className="px-3 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Export {subjectAnalytics.subject?.code} (.xlsx)
                  </button>
                </div>
              </div>

              {/* Subject KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10.5px] uppercase tracking-wider text-slate-400 font-bold block">Subject Average</span>
                  <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                    {subjectAnalytics.summary?.subject_average !== null ? `${subjectAnalytics.summary?.subject_average}%` : '—'}
                  </p>
                  <span className="text-[10px] text-slate-400">Total composite %</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10.5px] uppercase tracking-wider text-slate-400 font-bold block">CCE Mean</span>
                  <p className="text-xl font-black text-slate-800 dark:text-slate-200 mt-1">
                    {subjectAnalytics.summary?.cce_average !== null ? `${subjectAnalytics.summary?.cce_average} / ${subjectAnalytics.subject?.cce_max_marks}` : '—'}
                  </p>
                  <span className="text-[10px] text-slate-400">Continuous evaluation</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10.5px] uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-bold block">HyperBuild Labs Avg</span>
                  <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                    {subjectAnalytics.summary?.hyperbuild_average !== null ? `${subjectAnalytics.summary?.hyperbuild_average} / 100` : '—'}
                  </p>
                  <span className="text-[10px] text-slate-400">Total Avg: {subjectAnalytics.summary?.hyperbuild_total_average || '—'} pts</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10.5px] uppercase tracking-wider text-slate-400 font-bold block">Term End Exam Mean</span>
                  <p className="text-xl font-black text-slate-800 dark:text-slate-200 mt-1">
                    {subjectAnalytics.summary?.term_end_average !== null ? `${subjectAnalytics.summary?.term_end_average} / ${subjectAnalytics.subject?.term_end_max_marks}` : '—'}
                  </p>
                  <span className="text-[10px] text-slate-400">Final examination</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10.5px] uppercase tracking-wider text-purple-600 font-bold block">Distinction & Merit</span>
                  <p className="text-xl font-black text-purple-600 mt-1">
                    {(subjectAnalytics.tier_breakdown?.Distinction || 0) + (subjectAnalytics.tier_breakdown?.Merit || 0)}
                  </p>
                  <span className="text-[10px] text-slate-400">of {subjectAnalytics.summary?.total_students} students</span>
                </div>
              </div>

              {/* Activity Breakdown Table */}
              {subjectAnalytics.activities_analytics?.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    HyperBuild Practical Simulation Labs Breakdown ({subjectAnalytics.activities_analytics.length} Activities)
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/60 text-[10.5px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                          <th className="py-2.5 px-3">Lab #</th>
                          <th className="py-2.5 px-3">Activity Title</th>
                          <th className="py-2.5 px-3">Submissions</th>
                          <th className="py-2.5 px-3">Completion Rate</th>
                          <th className="py-2.5 px-3">Mean Score (/100)</th>
                          <th className="py-2.5 px-3">Score Range</th>
                          <th className="py-2.5 px-3">Avg AI Support</th>
                          <th className="py-2.5 px-3 text-right">Plagiarism Flags</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {subjectAnalytics.activities_analytics.map((act: any) => (
                          <tr key={act.activity_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                            <td className="py-2.5 px-3 font-mono font-bold text-indigo-600">
                              Act {act.activity_no}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white max-w-xs truncate">
                              {act.title}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300">
                              {act.total_submissions} / {subjectAnalytics.summary?.total_students}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                  <div
                                    className="h-full bg-indigo-600 rounded-full"
                                    style={{ width: `${act.completion_rate}%` }}
                                  />
                                </div>
                                <span className="font-bold text-[11px] text-slate-600 dark:text-slate-400">
                                  {act.completion_rate}%
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-mono font-black text-indigo-600 dark:text-indigo-400">
                              {act.average_score !== null ? `${act.average_score}/100` : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                              {act.min_score !== null && act.max_score !== null ? `${act.min_score} – ${act.max_score}` : '—'}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-600 dark:text-slate-400">
                              {act.average_ai_support !== null ? `${act.average_ai_support}%` : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {act.plagiarism_flags > 0 ? (
                                <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-[10.5px] font-black border border-rose-200 dark:border-rose-800">
                                  {act.plagiarism_flags} Flagged
                                </span>
                              ) : (
                                <span className="text-emerald-600 font-bold text-[11px]">0 Clean</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Performance Tier & Letter Grade Distribution */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Performance Tier Distribution
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    {Object.entries(subjectAnalytics.tier_breakdown || {}).map(([tier, count]: [string, any]) => {
                      const total = subjectAnalytics.summary?.total_students || 1;
                      const pct = Math.round((count / total) * 100);
                      return (
                        <div key={tier} className="space-y-0.5">
                          <div className="flex justify-between font-semibold">
                            <span className="text-slate-600 dark:text-slate-300">{tier}</span>
                            <span className="text-slate-400">{count} ({pct}%)</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                tier === 'Distinction'
                                  ? 'bg-purple-600'
                                  : tier === 'Merit'
                                  ? 'bg-indigo-600'
                                  : tier === 'Pass'
                                  ? 'bg-emerald-600'
                                  : 'bg-rose-500'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Letter Grade Breakdown
                  </h4>
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {Object.entries(subjectAnalytics.grade_breakdown || {}).map(([grd, count]: [string, any]) => (
                      <div key={grd} className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                        <span className="font-mono font-black text-xs text-slate-900 dark:text-white block">{grd}</span>
                        <span className="text-[11px] text-slate-400 font-bold">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* At-Risk Students List */}
              {subjectAnalytics.at_risk_students?.length > 0 && (
                <div className="p-4 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      At-Risk Students Requiring Academic Attention ({subjectAnalytics.at_risk_students.length})
                    </span>
                    <span className="text-[11px] text-rose-700 dark:text-rose-400 font-medium">
                      Scoring &lt; 50% in this subject
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {subjectAnalytics.at_risk_students.map((st: any) => (
                      <div key={st.student_id} className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 space-y-1">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{st.name}</p>
                        <p className="text-[10.5px] text-slate-400">PRN: {st.prn} • Div: {st.division}</p>
                        <p className="text-[11px] font-black text-rose-600 mt-0.5">Score: {st.total_percentage}% ({st.grade_letter})</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400 space-y-2">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-600" />
              <p>Gathering comprehensive subject analytics...</p>
            </div>
          )
        ) : (
          /* Empty / Prompt State with Quick-Select Subject Buttons */
          <div className="py-4 text-center space-y-3">
            <p className="text-xs text-slate-500 max-w-lg mx-auto">
              Select an academic subject above or click a quick-action course below to analyze simulation lab completion rates, component marks, and at-risk students:
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
              {subjects.map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSubjectId(s.id)}
                  className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/60 text-slate-700 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-300 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span className="font-mono text-indigo-600 dark:text-indigo-400">{s.code}</span>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span>{s.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Cohort Multi-Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
            <Filter className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Filter Cohort Marksheet</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400">
              Showing {rows.length} students
            </span>
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="text-xs text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 font-semibold ml-2 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" /> Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* 4 Academic Hierarchy Filters & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* 1. Program Filter */}
          <div>
            <label className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Program
            </label>
            <select
              value={selectedProgramId}
              onChange={(e) => setSelectedProgramId(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
            >
              <option value="">All Programs</option>
              {programsList.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Batch Filter */}
          <div>
            <label className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Batch
            </label>
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
            >
              <option value="">All Batches</option>
              {batchesList.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Division Filter */}
          <div>
            <label className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Division
            </label>
            <select
              value={selectedDivisionId}
              onChange={(e) => setSelectedDivisionId(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
            >
              <option value="">All Divisions</option>
              {divisionsList.map((d: any) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Subject Filter */}
          <div>
            <label className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Subject
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
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
          <div>
            <label className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Search Student
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Name or PRN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* 5. Assessment Component Filter Tabs */}
        <div className="pt-2 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-slate-400 mr-1">Assessment Component:</span>
          <button
            onClick={() => setSelectedComponent('all')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedComponent === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All Components
          </button>
          <button
            onClick={() => setSelectedComponent('cce')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedComponent === 'cce'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            CCE Continuous Evaluation
          </button>
          <button
            onClick={() => setSelectedComponent('hyperbuild')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedComponent === 'hyperbuild'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            HyperBuild Practical Labs
          </button>
          <button
            onClick={() => setSelectedComponent('term_end')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedComponent === 'term_end'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Term End Examination
          </button>
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
                {selectedSubjectId ? (
                  /* Subject Specific Header Columns */
                  <>
                    {(selectedComponent === 'all' || selectedComponent === 'cce') && (
                      <th className="py-3 px-3">CCE Marks</th>
                    )}
                    {(selectedComponent === 'all' || selectedComponent === 'hyperbuild') && (
                      <>
                        <th className="py-3 px-3">HyperBuild Labs Completed</th>
                        <th className="py-3 px-3">HyperBuild Score</th>
                      </>
                    )}
                    {(selectedComponent === 'all' || selectedComponent === 'term_end') && (
                      <th className="py-3 px-3">End Term Marks</th>
                    )}
                    {selectedComponent === 'all' && (
                      <>
                        <th className="py-3 px-3">Total Score</th>
                        <th className="py-3 px-3">Grade</th>
                        <th className="py-3 px-3">Status / Tier</th>
                      </>
                    )}
                  </>
                ) : (
                  /* Master Composite Header Columns */
                  <>
                    <th className="py-3 px-3">Overall Avg</th>
                    <th className="py-3 px-3">Overall Tier</th>
                    <th className="py-3 px-3">
                      {selectedComponent === 'all' && 'Subject Component Breakdown'}
                      {selectedComponent === 'cce' && 'Continuous Evaluation (CCE) by Subject'}
                      {selectedComponent === 'hyperbuild' && 'HyperBuild Practical Labs by Subject'}
                      {selectedComponent === 'term_end' && 'Term End Examination by Subject'}
                    </th>
                  </>
                )}
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {rows.map((row: any) => {
                // If single subject selected, extract that subject data
                const singleSubjData = selectedSubjectId
                  ? row.subjects?.find((s: any) => s.subject_id === selectedSubjectId)
                  : null;

                return (
                  <tr key={row.student_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-white">{row.name}</div>
                      <div className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                        {row.prn}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-500">{row.division}</td>

                    {/* A. Single Subject View */}
                    {selectedSubjectId ? (
                      <>
                        {(selectedComponent === 'all' || selectedComponent === 'cce') && (
                          <td className="py-3 px-3">
                            {singleSubjData?.cce_score !== null && singleSubjData?.cce_score !== undefined ? (
                              <span className="font-mono font-bold text-slate-900 dark:text-slate-200">
                                {singleSubjData.cce_score} / {singleSubjData.cce_max_marks || 50}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Pending</span>
                            )}
                          </td>
                        )}

                        {(selectedComponent === 'all' || selectedComponent === 'hyperbuild') && (
                          <>
                            <td className="py-3 px-3">
                              <span className="font-bold text-slate-900 dark:text-white">
                                {singleSubjData?.completion_ratio || `${singleSubjData?.activities_completed || 0} / ${singleSubjData?.total_released_activities || 0}`} completed
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              {singleSubjData?.hyperbuild_score !== null && singleSubjData?.hyperbuild_score !== undefined ? (
                                <div className="flex flex-col">
                                  <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">
                                    {singleSubjData.hyperbuild_score}/100
                                  </span>
                                  <span className="text-[10.5px] text-slate-400">
                                    Total: {singleSubjData.hyperbuild_total_score || 0} pts
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">No labs</span>
                              )}
                            </td>
                          </>
                        )}

                        {(selectedComponent === 'all' || selectedComponent === 'term_end') && (
                          <td className="py-3 px-3">
                            {singleSubjData?.term_end_score !== null && singleSubjData?.term_end_score !== undefined ? (
                              <span className="font-mono font-bold text-slate-900 dark:text-slate-200">
                                {singleSubjData.term_end_score} / {singleSubjData.term_end_max_marks || 50}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Scheduled</span>
                            )}
                          </td>
                        )}

                        {selectedComponent === 'all' && (
                          <>
                            <td className="py-3 px-3 font-black text-slate-900 dark:text-white">
                              {singleSubjData?.total_percentage !== null && singleSubjData?.total_percentage !== undefined
                                ? `${singleSubjData.total_percentage}%`
                                : '—'}
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-mono font-bold">
                                {singleSubjData?.grade_letter || 'IP'}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              {getTierBadge(singleSubjData?.performance_tier)}
                            </td>
                          </>
                        )}
                      </>
                    ) : (
                      /* B. All Subjects Master View */
                      <>
                        <td className="py-3 px-3 font-black text-slate-900 dark:text-white text-sm">
                          {row.overall_average !== null ? `${row.overall_average}%` : '—'}
                        </td>
                        <td className="py-3 px-3">{getTierBadge(row.overall_tier)}</td>
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap items-center gap-1.5 max-w-xl">
                            {row.subjects?.map((s: any) => (
                              <div
                                key={s.subject_id}
                                className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10.5px] flex items-center gap-1.5 flex-wrap"
                              >
                                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{s.subject_code}:</span>
                                
                                {selectedComponent === 'all' && (
                                  <>
                                    <span className="text-slate-500 font-semibold" title="CCE Marks">
                                      CCE: {s.cce_score !== null && s.cce_score !== undefined ? `${s.cce_score}` : '-'}
                                    </span>
                                    <span className="text-indigo-600 dark:text-indigo-300 font-semibold" title="HyperBuild Completed Labs & Average">
                                      HB: {s.completion_ratio || '0/0'} ({s.hyperbuild_score || 0}/100)
                                    </span>
                                    <span className="text-slate-500 font-semibold" title="End Term Marks">
                                      End: {s.term_end_score !== null && s.term_end_score !== undefined ? `${s.term_end_score}` : '-'}
                                    </span>
                                    <span className="font-black text-slate-900 dark:text-white border-l border-slate-200 dark:border-slate-700 pl-1.5">
                                      {s.total_percentage !== null ? `${s.total_percentage}%` : 'IP'}
                                    </span>
                                  </>
                                )}

                                {selectedComponent === 'cce' && (
                                  <span className="font-bold text-slate-900 dark:text-white">
                                    {s.cce_score !== null && s.cce_score !== undefined ? `${s.cce_score} / ${s.cce_max_marks || 50}` : 'Pending'}
                                  </span>
                                )}

                                {selectedComponent === 'hyperbuild' && (
                                  <span className="font-bold text-indigo-700 dark:text-indigo-300">
                                    {s.completion_ratio ? `${s.completion_ratio} completed` : '0/0'} ({s.hyperbuild_score || 0}/100)
                                  </span>
                                )}

                                {selectedComponent === 'term_end' && (
                                  <span className="font-bold text-slate-900 dark:text-white">
                                    {s.term_end_score !== null && s.term_end_score !== undefined ? `${s.term_end_score} / ${s.term_end_max_marks || 50}` : 'Scheduled'}
                                  </span>
                                )}

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
                                  className="text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer p-0.5 ml-1"
                                  title="Edit CCE & End Term Marks"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </td>
                      </>
                    )}

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          if (onViewStudentTranscript) {
                            onViewStudentTranscript(row.student_id);
                          } else {
                            setSelectedStudentForView(row.student_id);
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/60 text-slate-700 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-300 font-bold text-xs transition-all cursor-pointer inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Transcript
                      </button>
                    </td>
                  </tr>
                );
              })}
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

      {/* Gradebook Spreadsheet Export Modal (.xlsx) */}
      <GradebookExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        cohortRows={rows}
        subjects={subjects}
        currentSubjectId={selectedSubjectId || undefined}
      />
    </div>
  );
};
