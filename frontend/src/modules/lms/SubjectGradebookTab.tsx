import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Award,
  Sparkles,
  FileSpreadsheet,
  Search,
  Edit3,
  X,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Filter,
  CheckSquare,
} from 'lucide-react';
import { api } from '../../lib/api';
import { GradebookExportModal } from '../../components/GradebookExportModal';

interface SubjectGradebookTabProps {
  subject: any;
  isStudent: boolean;
  isFacultyOrAdmin: boolean;
}

export const SubjectGradebookTab: React.FC<SubjectGradebookTabProps> = ({
  subject,
  isStudent,
  isFacultyOrAdmin,
}) => {
  const queryClient = useQueryClient();

  // Filters state (faculty view)
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);

  // Marks Entry Modal state (faculty view)
  const [editingGrade, setEditingGrade] = useState<{
    student_id: string;
    student_name: string;
    cce_score: number | '';
    term_end_score: number | '';
    remarks: string;
  } | null>(null);

  // 1. Student's Own Gradebook Query
  const { data: studentGbData, isLoading: isStudentGbLoading } = useQuery({
    queryKey: ['student-my-gradebook', subject?.id],
    queryFn: async () => {
      const res = await api.get('/gradebook/me');
      return res.data;
    },
    enabled: isStudent && Boolean(subject?.id),
  });

  // 2. Faculty / Admin: Cohort Marksheet for this Subject
  const { data: cohortData, isLoading: isCohortLoading } = useQuery({
    queryKey: ['cohort-gradebook-subject', subject?.id, selectedDivisionId, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (subject?.id) params.append('subject_id', subject.id);
      if (selectedDivisionId) params.append('division_id', selectedDivisionId);
      if (searchQuery) params.append('search', searchQuery);
      const res = await api.get(`/gradebook/cohort?${params.toString()}`);
      return res.data;
    },
    enabled: isFacultyOrAdmin && Boolean(subject?.id),
  });

  // 3. Faculty / Admin: Subject-Specific Performance Analytics
  const { data: subjectAnalytics } = useQuery({
    queryKey: ['subject-analytics', subject?.id, selectedDivisionId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedDivisionId) params.append('division_id', selectedDivisionId);
      const res = await api.get(`/gradebook/subjects/${subject.id}/analytics?${params.toString()}`);
      return res.data;
    },
    enabled: isFacultyOrAdmin && Boolean(subject?.id),
  });

  // 4. Load Divisions for Filter
  const { data: divisionsData } = useQuery({
    queryKey: ['academic-divisions-list'],
    queryFn: async () => {
      const res = await api.get('/academic/divisions');
      return res.data?.data || res.data || [];
    },
    enabled: isFacultyOrAdmin,
  });

  // Mutation: Save Student Grade (CCE & Term End)
  const saveMarksMutation = useMutation({
    mutationFn: async (payload: {
      student_id: string;
      subject_id: string;
      cce_score?: number | null;
      term_end_score?: number | null;
      remarks?: string;
    }) => {
      const res = await api.post('/gradebook/grades', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cohort-gradebook-subject', subject?.id] });
      queryClient.invalidateQueries({ queryKey: ['subject-analytics', subject?.id] });
      setEditingGrade(null);
    },
    onError: (err: any) => {
      alert(err?.response?.data?.detail || 'Failed to update marks.');
    },
  });

  const getTierBadge = (tier?: string) => {
    if (!tier || tier === 'In Progress') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">
          In Progress
        </span>
      );
    }
    if (tier.includes('Distinction')) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10.5px] font-black bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
          {tier}
        </span>
      );
    }
    if (tier.includes('Merit')) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10.5px] font-black bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
          {tier}
        </span>
      );
    }
    if (tier.includes('Pass')) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10.5px] font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          {tier}
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-[10.5px] font-black bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
        {tier}
      </span>
    );
  };

  // ==========================================
  // RENDER: STUDENT VIEW
  // ==========================================
  if (isStudent) {
    if (isStudentGbLoading) {
      return (
        <div className="p-12 text-center text-slate-400 space-y-2">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
          <p className="text-xs font-semibold">Loading your subject gradecard and evaluated labs...</p>
        </div>
      );
    }

    const currentSubj = studentGbData?.subjects?.find(
      (s: any) => s.subject_id === subject?.id || s.code === subject?.code
    );

    if (!currentSubj) {
      return (
        <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No Evaluation Records Available</p>
          <p className="text-xs text-slate-400">
            You are enrolled in {subject?.name}. As faculty grades your simulation labs and assignments, your marksheet will update here.
          </p>
        </div>
      );
    }

    const activitiesList = currentSubj.activities || [];
    const cceAssessmentsList = currentSubj.cce_assessments || [];

    return (
      <div className="space-y-6">
        {/* Hero Subject Standing Card */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 text-white shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
            <Award className="w-56 h-56" />
          </div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-xs font-mono font-bold uppercase">
                  {subject.code}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  Trimester {subject.trimester} • {subject.credits} Credits
                </span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white">{subject.name}</h2>
              <p className="text-xs text-slate-400 max-w-xl">
                Cumulative standing combining Continuous Evaluation (CCE), HyperBuild practical simulation labs, and Term End Examination.
              </p>
            </div>

            <div className="flex items-center gap-4 bg-slate-800/90 p-4 rounded-2xl border border-slate-700/60 shrink-0">
              <div className="text-center pr-4 border-r border-slate-700/60">
                <div className="text-[10px] uppercase font-bold text-slate-400">Total Score</div>
                <div className="text-3xl font-bold mt-0.5 text-white">
                  {currentSubj.total_percentage !== null ? `${currentSubj.total_percentage}%` : 'IP'}
                </div>
              </div>
              <div className="text-center pr-4 border-r border-slate-700/60">
                <div className="text-[10px] uppercase font-bold text-slate-400">Grade</div>
                <div className="text-3xl font-bold text-slate-100 mt-0.5">
                  {currentSubj.grade_letter || 'IP'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] uppercase font-bold text-slate-400">Tier</div>
                <div className="text-xs font-bold uppercase mt-2 px-2.5 py-1 rounded-full bg-slate-700 text-slate-200">
                  {currentSubj.performance_tier || 'In Progress'}
                </div>
              </div>
            </div>
          </div>

          {/* 3 Component Breakdown Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-6 pt-6 border-t border-slate-800">
            {/* Component 1: CCE */}
            <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <span className="text-[10.5px] uppercase font-bold text-slate-400 block">1. Continuous Evaluation (CCE)</span>
              <div className="text-lg font-bold mt-1 text-white">
                {currentSubj.cce_score !== null ? `${currentSubj.cce_score} / ${currentSubj.cce_max_marks}` : 'Pending'}
              </div>
              <span className="text-[10px] text-slate-400">
                {currentSubj.cce_completion_ratio || '0/0'} Assignments • Max {currentSubj.cce_max_marks || 50} Marks
              </span>
            </div>

            {/* Component 2: HyperBuild Labs */}
            <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <span className="text-[10.5px] uppercase font-bold text-slate-400 block">2. HyperBuild Practical Labs</span>
              <div className="text-lg font-bold mt-1 text-white">
                {currentSubj.hyperbuild_score !== null ? `${currentSubj.hyperbuild_score} / 100` : 'No Labs'}
              </div>
              <span className="text-[10px] text-slate-400">
                {currentSubj.completion_ratio || `${currentSubj.activities_completed || 0} / ${currentSubj.total_released_activities || 0}`} Labs Completed • Total: {currentSubj.hyperbuild_total_score || 0} pts
              </span>
            </div>

            {/* Component 3: Term End */}
            <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <span className="text-[10.5px] uppercase font-bold text-slate-400 block">3. Term End Examination</span>
              <div className="text-lg font-bold mt-1 text-white">
                {currentSubj.term_end_score !== null ? `${currentSubj.term_end_score} / ${currentSubj.term_end_max_marks}` : 'Scheduled'}
              </div>
              <span className="text-[10px] text-slate-400">Summative terminal examination</span>
            </div>
          </div>
        </div>

        {/* Continuous Comprehensive Evaluation (CCE) Detailed Assignments Breakdown */}
        {cceAssessmentsList.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-emerald-600" />
                Continuous Assessment (CCE) Internal Assignments ({cceAssessmentsList.length})
              </h3>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                CCE Aggregate: {currentSubj.cce_score !== null ? `${currentSubj.cce_score} / ${currentSubj.cce_max_marks}` : 'Pending'} ({currentSubj.cce_completion_ratio || '0/0'} Evaluated)
              </span>
            </div>

            <div className="space-y-2.5">
              {cceAssessmentsList.map((ass: any, idx: number) => {
                const hasMarks = ass.marks_obtained !== null;
                return (
                  <div
                    key={ass.assessment_id || idx}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                        hasMarks
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}>
                        #{idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {ass.title}
                          </h4>
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {ass.assessment_type}
                          </span>
                        </div>
                        {ass.feedback && (
                          <p className="text-[11px] text-slate-500 italic mt-0.5">
                            "{ass.feedback}"
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      {hasMarks ? (
                        <div className="text-right">
                          <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
                            {ass.marks_obtained} / {ass.total_marks}
                          </div>
                          <div className="text-[10.5px] font-bold text-slate-400">
                            {ass.percentage}%
                          </div>
                        </div>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10.5px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500">
                          {ass.status === 'submitted' ? 'Submitted (Awaiting Review)' : 'Pending Submission'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* All Evaluated Labs & Assessments Granular List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Evaluated Practical Simulation Labs & Assessments ({activitiesList.length})
            </h3>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
              {currentSubj.completion_ratio || `${currentSubj.activities_completed || 0} / ${currentSubj.total_released_activities || 0}`} Completed
            </span>
          </div>

          {activitiesList.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
              No simulation lab activities released or evaluated yet for this course.
            </div>
          ) : (
            <div className="space-y-3">
              {activitiesList.map((act: any) => {
                const isExpanded = expandedActivityId === act.activity_id;
                const hasGraded = act.score !== null;

                return (
                  <div
                    key={act.activity_id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden transition-all shadow-xs"
                  >
                    <div
                      onClick={() => setExpandedActivityId(isExpanded ? null : act.activity_id)}
                      className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                            hasGraded
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                          }`}
                        >
                          {act.activity_no}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {act.title}
                          </h4>
                          <p className="text-[11px] text-slate-400">
                            {hasGraded ? `Evaluated ${act.submitted_at ? `on ${new Date(act.submitted_at).toLocaleDateString()}` : ''}` : 'Pending Submission / Review'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {hasGraded ? (
                          <>
                            <div className="text-right">
                              <div className="text-sm font-black text-indigo-600 dark:text-indigo-400 font-mono">
                                {act.score} / 100
                              </div>
                              <div className="text-[10px] font-bold text-slate-400">
                                {act.grade || 'Graded'}
                              </div>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                (act.score || 0) >= 75
                                  ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'
                                  : (act.score || 0) >= 50
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                              }`}
                            >
                              {act.grade || 'Graded'}
                            </span>
                          </>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10.5px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500">
                            Not Graded
                          </span>
                        )}
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 space-y-3 text-xs">
                        {act.feedback && (
                          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                              Faculty & Evaluator Feedback:
                            </span>
                            <p className="text-slate-700 dark:text-slate-300 italic text-[11.5px] leading-relaxed">
                              "{act.feedback}"
                            </p>
                          </div>
                        )}

                        {act.ai_evaluation?.strengths?.length > 0 && (
                          <div>
                            <span className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-600 block mb-1">
                              Key Strengths:
                            </span>
                            <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-300 text-[11px]">
                              {act.ai_evaluation.strengths.map((s: string, idx: number) => (
                                <li key={idx}>{s}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {act.ai_evaluation?.areas_for_improvement?.length > 0 && (
                          <div>
                            <span className="text-[10.5px] font-bold uppercase tracking-wider text-rose-600 block mb-1">
                              Areas for Improvement:
                            </span>
                            <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-300 text-[11px]">
                              {act.ai_evaluation.areas_for_improvement.map((g: string, idx: number) => (
                                <li key={idx}>{g}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: FACULTY / ADMIN VIEW
  // ==========================================
  const rows = cohortData?.rows || [];
  const divisions = Array.isArray(divisionsData) ? divisionsData : [];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-extrabold text-xs">
              {subject.code}
            </span>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">
              {subject.name} — Subject Gradebook
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            CCE ({subject.cce_max_marks || 50} pts) • HyperBuild Practical Simulation Labs • Term End Exam ({subject.term_end_max_marks || 50} pts)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Export Marksheet (.xlsx)
          </button>
        </div>
      </div>

      {/* Subject Performance KPIs */}
      {subjectAnalytics && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[10.5px] uppercase tracking-wider text-slate-400 font-bold block">Subject Average</span>
            <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
              {subjectAnalytics.summary?.subject_average !== null ? `${subjectAnalytics.summary?.subject_average}%` : '—'}
            </p>
            <span className="text-[10px] text-slate-400">Total composite %</span>
          </div>

          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[10.5px] uppercase tracking-wider text-slate-400 font-bold block">CCE Mean</span>
            <p className="text-xl font-black text-slate-800 dark:text-slate-200 mt-1">
              {subjectAnalytics.summary?.cce_average !== null ? `${subjectAnalytics.summary?.cce_average} / ${subject.cce_max_marks || 50}` : '—'}
            </p>
            <span className="text-[10px] text-slate-400">Continuous evaluation</span>
          </div>

          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[10.5px] uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-bold block">HyperBuild Labs Mean</span>
            <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
              {subjectAnalytics.summary?.hyperbuild_average !== null ? `${subjectAnalytics.summary?.hyperbuild_average} / 100` : '—'}
            </p>
            <span className="text-[10px] text-slate-400">Total Avg: {subjectAnalytics.summary?.hyperbuild_total_average || '—'} pts</span>
          </div>

          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[10.5px] uppercase tracking-wider text-slate-800 dark:text-slate-200 font-bold block">End Term Mean</span>
            <p className="text-xl font-black text-slate-800 dark:text-slate-200 mt-1">
              {subjectAnalytics.summary?.term_end_average !== null ? `${subjectAnalytics.summary?.term_end_average} / ${subject.term_end_max_marks || 50}` : '—'}
            </p>
            <span className="text-[10px] text-slate-400">Final examination</span>
          </div>

          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[10.5px] uppercase tracking-wider text-purple-600 font-bold block">Distinction & Merit</span>
            <p className="text-xl font-black text-purple-600 mt-1">
              {(subjectAnalytics.tier_breakdown?.Distinction || 0) + (subjectAnalytics.tier_breakdown?.Merit || 0)}
            </p>
            <span className="text-[10px] text-slate-400">of {subjectAnalytics.summary?.total_students} students</span>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
            <Filter className="w-3.5 h-3.5 text-indigo-600" />
            <span>Division:</span>
          </div>
          <select
            value={selectedDivisionId}
            onChange={(e) => setSelectedDivisionId(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
          >
            <option value="">All Divisions</option>
            {divisions.map((d: any) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search student or PRN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* HyperBuild Activities Breakdown Table */}
      {subjectAnalytics?.activities_analytics?.length > 0 && (
        <div className="space-y-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            HyperBuild Practical Simulation Labs Breakdown ({subjectAnalytics.activities_analytics.length} Activities)
          </h4>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-[10.5px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                  <th className="py-2.5 px-3">Lab #</th>
                  <th className="py-2.5 px-3">Title</th>
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
                  <tr key={act.activity_id || act.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                      Act {act.activity_no}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white max-w-xs truncate">
                      {act.title}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                      {(act.total_submissions ?? act.submissions_count ?? 0)} / {(subjectAnalytics.summary?.total_students ?? 0)}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div
                            className="h-full bg-slate-700 dark:bg-slate-300 rounded-full"
                            style={{ width: `${act.completion_rate}%` }}
                          />
                        </div>
                        <span className="font-semibold text-[11px] text-slate-600 dark:text-slate-400">
                          {act.completion_rate}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                      {act.average_score !== null ? `${act.average_score}/100` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                      {act.min_score != null && act.max_score != null
                        ? `${act.min_score} – ${act.max_score}`
                        : (act.score_range && act.score_range !== '—' ? act.score_range : '—')}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-600 dark:text-slate-400">
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

      {/* Cohort Subject Marksheet Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Student Performance & Marksheet ({rows.length} Students)
          </h3>
          <span className="text-xs text-slate-400">
            Click edit icon to enter or adjust CCE & Term End scores
          </span>
        </div>

        {isCohortLoading ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-600" />
            <p className="text-xs">Gathering student records and simulation scores...</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No student marksheet records found for this course filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-[10.5px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                  <th className="py-3 px-4">Student & PRN</th>
                  <th className="py-3 px-3">Division</th>
                  <th className="py-3 px-3">CCE Marks</th>
                  <th className="py-3 px-3">HyperBuild Labs</th>
                  <th className="py-3 px-3">HyperBuild Score</th>
                  <th className="py-3 px-3">End Term Marks</th>
                  <th className="py-3 px-3">Total Score</th>
                  <th className="py-3 px-3">Grade</th>
                  <th className="py-3 px-3">Status / Tier</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {rows.map((row: any) => {
                  const sData = row.subjects?.find((s: any) => s.subject_id === subject.id);

                  return (
                    <tr key={row.student_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">{row.name}</div>
                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          {row.prn}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-500">{row.division}</td>
                      
                      {/* CCE */}
                      <td className="py-3 px-3">
                        {sData?.cce_score !== null && sData?.cce_score !== undefined ? (
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-200">
                            {sData.cce_score} / {sData.cce_max_marks || subject.cce_max_marks || 50}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Pending</span>
                        )}
                      </td>

                      {/* HyperBuild Labs Completed */}
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {sData?.completion_ratio || `${sData?.activities_completed || 0} / ${sData?.total_released_activities || 0}`}
                        </span>
                      </td>

                      {/* HyperBuild Score */}
                      <td className="py-3 px-3">
                        {sData?.hyperbuild_score !== null && sData?.hyperbuild_score !== undefined ? (
                          <div className="flex flex-col">
                            <span className="font-mono font-bold text-slate-900 dark:text-white">
                              {sData.hyperbuild_score}/100
                            </span>
                            <span className="text-[10px] text-slate-500">
                              Total: {sData.hyperbuild_total_score || 0} pts
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">No labs</span>
                        )}
                      </td>

                      {/* Term End */}
                      <td className="py-3 px-3">
                        {sData?.term_end_score !== null && sData?.term_end_score !== undefined ? (
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-200">
                            {sData.term_end_score} / {sData.term_end_max_marks || subject.term_end_max_marks || 50}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Scheduled</span>
                        )}
                      </td>

                      {/* Total Score */}
                      <td className="py-3 px-3 font-black text-slate-900 dark:text-white">
                        {sData?.total_percentage !== null && sData?.total_percentage !== undefined
                          ? `${sData.total_percentage}%`
                          : '—'}
                      </td>

                      {/* Grade */}
                      <td className="py-3 px-3">
                        <span className="font-mono font-black px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white">
                          {sData?.grade_letter || 'IP'}
                        </span>
                      </td>

                      {/* Tier */}
                      <td className="py-3 px-3">
                        {getTierBadge(sData?.performance_tier)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() =>
                            setEditingGrade({
                              student_id: row.student_id,
                              student_name: row.name,
                              cce_score: sData?.cce_score ?? '',
                              term_end_score: sData?.term_end_score ?? '',
                              remarks: '',
                            })
                          }
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/60 text-slate-700 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-300 font-bold text-xs transition-all cursor-pointer inline-flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" /> Edit Marks
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Marks Entry Modal */}
      {editingGrade && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Enter Subject Marks
                </h3>
                <p className="text-xs text-slate-400">
                  {editingGrade.student_name} • {subject.code}
                </p>
              </div>
              <button
                onClick={() => setEditingGrade(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Continuous Comprehensive Evaluation (CCE) Marks (Max: {subject.cce_max_marks || 50})
                </label>
                <input
                  type="number"
                  min="0"
                  max={subject.cce_max_marks || 50}
                  step="0.5"
                  value={editingGrade.cce_score}
                  onChange={(e) =>
                    setEditingGrade({
                      ...editingGrade,
                      cce_score: e.target.value === '' ? '' : parseFloat(e.target.value),
                    })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold"
                  placeholder="e.g. 38.5"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Term End Examination Marks (Max: {subject.term_end_max_marks || 50})
                </label>
                <input
                  type="number"
                  min="0"
                  max={subject.term_end_max_marks || 50}
                  step="0.5"
                  value={editingGrade.term_end_score}
                  onChange={(e) =>
                    setEditingGrade({
                      ...editingGrade,
                      term_end_score: e.target.value === '' ? '' : parseFloat(e.target.value),
                    })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold"
                  placeholder="e.g. 42.0"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Faculty Evaluation Remarks
                </label>
                <textarea
                  rows={2}
                  value={editingGrade.remarks}
                  onChange={(e) =>
                    setEditingGrade({ ...editingGrade, remarks: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                  placeholder="Optional qualitative feedback..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setEditingGrade(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  saveMarksMutation.mutate({
                    student_id: editingGrade.student_id,
                    subject_id: subject.id,
                    cce_score: editingGrade.cce_score === '' ? null : editingGrade.cce_score,
                    term_end_score: editingGrade.term_end_score === '' ? null : editingGrade.term_end_score,
                    remarks: editingGrade.remarks,
                  })
                }
                disabled={saveMarksMutation.isPending}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 cursor-pointer disabled:opacity-50"
              >
                {saveMarksMutation.isPending ? 'Saving...' : 'Save Subject Marks'}
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
        subjects={[subject]}
        currentSubjectId={subject.id}
      />
    </div>
  );
};
