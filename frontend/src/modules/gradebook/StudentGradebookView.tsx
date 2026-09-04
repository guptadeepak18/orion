import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  GraduationCap,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Layers,
  FileCheck,
  AlertCircle,
  Check,
  AlertTriangle,
  Bot,
  FileText,
  ExternalLink,
  User,
} from 'lucide-react';
import { api } from '../../lib/api';

interface StudentGradebookViewProps {
  studentId?: string | null; // If provided, fetches this student's gradebook (for faculty preview)
  onBackToCohort?: () => void;
  onSelectStudentId?: (studentId: string) => void;
}

export const StudentGradebookView: React.FC<StudentGradebookViewProps> = ({
  studentId,
  onBackToCohort,
  onSelectStudentId,
}) => {
  const [viewMode, setViewMode] = useState<'combined' | 'subject'>('combined');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);

  const endpoint = studentId ? `/gradebook/students/${studentId}` : '/gradebook/me';

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['student-gradebook', studentId || 'me'],
    queryFn: async () => {
      const res = await api.get(endpoint);
      return res.data;
    },
  });

  // Query all students for preview selector
  const { data: studentsResponse } = useQuery({
    queryKey: ['students-list-preview'],
    queryFn: async () => {
      const res = await api.get('/students');
      return res.data?.data || res.data || [];
    },
    enabled: Boolean(onBackToCohort || onSelectStudentId),
  });

  const allStudents = Array.isArray(studentsResponse) ? studentsResponse : [];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-3">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          Loading Academic Gradebook & Analytics...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 max-w-xl mx-auto my-8">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-rose-900 dark:text-rose-200">Unable to load gradebook</h3>
        <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">
          {error instanceof Error ? error.message : 'Please check your connection and try again.'}
        </p>
        <button
          onClick={() => refetch()}
          className="mt-4 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-all cursor-pointer"
        >
          Try Again
        </button>
      </div>
    );
  }

  const { student, kpis, subjects, performance_timeline } = data;
  const currentSubject = subjects.find((s: any) => s.subject_id === selectedSubjectId) || subjects[0];

  const getTierColor = (tier?: string) => {
    if (!tier) return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300';
    if (tier.includes('Distinction')) return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800';
    if (tier.includes('Merit')) return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800';
    if (tier.includes('Pass')) return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
    if (tier.includes('Needs Work') || tier.includes('F')) return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';
    return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
  };

  return (
    <div className="space-y-6">
      {/* Faculty Preview Bar with Student Selector */}
      {(onBackToCohort || onSelectStudentId) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3 flex-wrap">
            {onBackToCohort && (
              <button
                onClick={onBackToCohort}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1.5 cursor-pointer"
              >
                ← Back to Cohort Gradebook
              </button>
            )}
            <span className="text-[11px] px-2.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 font-bold border border-amber-300 dark:border-amber-800">
              Preview Mode
            </span>
          </div>

          {/* Student Selector Dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-indigo-600" /> Select Student:
            </label>
            <select
              value={studentId || student?.id || ''}
              onChange={(e) => {
                if (onSelectStudentId) {
                  onSelectStudentId(e.target.value);
                }
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white max-w-xs sm:max-w-sm truncate"
            >
              {allStudents.map((st: any) => (
                <option key={st.id} value={st.id}>
                  {st.full_name || `${st.first_name} ${st.last_name || ''}`} — PRN: {st.prn_number || st.roll_no || 'N/A'}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Clean Student Profile Header & Overall KPIs */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold font-mono border border-indigo-200 dark:border-indigo-800">
                PRN: {student.prn || 'N/A'}
              </span>
              {student.divisions?.map((div: string) => (
                <span key={div} className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium">
                  Div: {div}
                </span>
              ))}
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-medium border border-emerald-200 dark:border-emerald-800">
                {student.batch}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{student.name}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {student.program} • Trimester Academic Transcript & Continuous Evaluation
            </p>
          </div>

          {/* Clean Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-center">
              <span className="text-[10.5px] uppercase tracking-wider text-slate-400 font-bold block">CGPA (10 pt)</span>
              <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5 block">
                {kpis.cgpa !== null ? kpis.cgpa : '—'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-center">
              <span className="text-[10.5px] uppercase tracking-wider text-slate-400 font-bold block">Overall Score</span>
              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                {kpis.overall_percentage !== null ? `${kpis.overall_percentage}%` : '—'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-center">
              <span className="text-[10.5px] uppercase tracking-wider text-slate-400 font-bold block">Credits</span>
              <span className="text-xl font-black text-slate-900 dark:text-white mt-0.5 block">{kpis.total_credits}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-center">
              <span className="text-[10.5px] uppercase tracking-wider text-slate-400 font-bold block">Courses</span>
              <span className="text-xl font-black text-purple-600 dark:text-purple-400 mt-0.5 block">{kpis.subjects_enrolled}</span>
            </div>
          </div>
        </div>

        {/* Tier Distribution Badges */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 font-semibold mr-1">Distribution:</span>
          <span className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 font-bold border border-purple-200 dark:border-purple-800/40">
            Distinction: {kpis.tier_counts?.Distinction || 0}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800/40">
            Merit: {kpis.tier_counts?.Merit || 0}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800/40">
            Pass: {kpis.tier_counts?.Pass || 0}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 font-bold border border-rose-200 dark:border-rose-800/40">
            Needs Work: {kpis.tier_counts?.['Needs Work'] || 0}
          </span>
        </div>
      </div>

      {/* View Switcher Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('combined')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              viewMode === 'combined'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Combined Overview (All Subjects)
          </button>
          <button
            onClick={() => {
              setViewMode('subject');
              if (!selectedSubjectId && subjects.length > 0) {
                setSelectedSubjectId(subjects[0].subject_id);
              }
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              viewMode === 'subject'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" /> Subject-by-Subject Drilldown
          </button>
        </div>

        <span className="text-[11px] text-slate-400 font-medium">
          Differentiated by CCE (Continuous), HyperBuild Practical, and Term End Examination
        </span>
      </div>

      {/* VIEW 1: COMBINED MULTI-SUBJECT MASTER TABLE */}
      {viewMode === 'combined' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">Academic Performance Matrix</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Summary of continuous evaluations, simulation labs, and summative assessments
              </p>
            </div>
            <span className="text-xs font-bold text-slate-500">{subjects.length} Subjects Active</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                  <th className="py-3.5 px-4">Subject & Code</th>
                  <th className="py-3.5 px-3">Credits</th>
                  <th className="py-3.5 px-3">CCE Marks</th>
                  <th className="py-3.5 px-3">HyperBuild Total</th>
                  <th className="py-3.5 px-3">HyperBuild Avg</th>
                  <th className="py-3.5 px-3">End Term Marks</th>
                  <th className="py-3.5 px-3">Total Score</th>
                  <th className="py-3.5 px-3">Grade</th>
                  <th className="py-3.5 px-3">Status / Tier</th>
                  <th className="py-3.5 px-4 text-right">Drilldown</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {subjects.map((sub: any) => (
                  <tr key={sub.subject_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 dark:text-white">{sub.name}</div>
                      <div className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                        {sub.code} • Trimester {sub.trimester}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-slate-600 dark:text-slate-300">
                      {sub.credits} Cr
                    </td>
                    <td className="py-3.5 px-3">
                      {sub.cce_score !== null ? (
                        <span className="font-mono font-bold text-slate-900 dark:text-slate-200">
                          {sub.cce_score} / {sub.cce_max_marks}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Pending</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3">
                      {sub.hyperbuild_total_score !== null ? (
                        <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300">
                          {sub.hyperbuild_total_score} / {sub.hyperbuild_max_total}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3">
                      {sub.hyperbuild_score !== null ? (
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900 dark:text-white text-xs">
                            {sub.completion_ratio || `${sub.activities_completed || 0} / ${sub.total_released_activities || 0}`}
                          </span>
                          <span className="text-[10.5px] text-slate-500 dark:text-slate-400">
                            Total: {sub.hyperbuild_total_score} pts • Avg: {sub.hyperbuild_score}/100
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">
                          0 / {sub.total_released_activities || 0}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-3">
                      {sub.term_end_score !== null ? (
                        <span className="font-mono font-bold text-slate-900 dark:text-slate-200">
                          {sub.term_end_score} / {sub.term_end_max_marks}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Scheduled</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3">
                      {sub.total_percentage !== null ? (
                        <span className="text-sm font-black text-slate-900 dark:text-white">
                          {sub.total_percentage}%
                        </span>
                      ) : (
                        <span className="text-slate-400 font-semibold">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-black text-xs">
                        {sub.grade_letter || 'IP'}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10.5px] font-black border ${getTierColor(sub.performance_tier)}`}>
                        {sub.performance_tier}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedSubjectId(sub.subject_id);
                          setViewMode('subject');
                        }}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="View Detailed Subject Breakdown"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: SUBJECT-BY-SUBJECT DRILLDOWN */}
      {viewMode === 'subject' && currentSubject && (
        <div className="space-y-6">
          {/* Subject Tab Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar scroll-smooth">
            {subjects.map((sub: any) => {
              const isSelected = sub.subject_id === currentSubject.subject_id;
              return (
                <button
                  key={sub.subject_id}
                  onClick={() => setSelectedSubjectId(sub.subject_id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-2 ${
                    isSelected
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <span className="font-mono text-[10.5px] px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/20">
                    {sub.code}
                  </span>
                  <span>{sub.name}</span>
                  {sub.total_percentage !== null && (
                    <span className="text-[10px] font-black opacity-80">({sub.total_percentage}%)</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Subject Header & 3 Component Cards */}
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-0.5 rounded-md font-mono font-bold text-xs bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                    {currentSubject.code}
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">
                    {currentSubject.credits} Credits • Category: {currentSubject.course_category}
                  </span>
                </div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white mt-1">
                  {currentSubject.name}
                </h2>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-bold">Total Grade</span>
                  <span className="text-2xl font-black text-slate-900 dark:text-white">
                    {currentSubject.total_percentage !== null ? `${currentSubject.total_percentage}%` : '—'}
                  </span>
                </div>
                <span className={`px-3 py-1.5 rounded-xl text-xs font-black border ${getTierColor(currentSubject.performance_tier)}`}>
                  {currentSubject.grade_letter || 'IP'} ({currentSubject.performance_tier})
                </span>
              </div>
            </div>

            {/* 3 Component Breakdown Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Component 1: CCE */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase font-black tracking-wider text-slate-500">
                    1. CCE Component
                  </span>
                  <FileCheck className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {currentSubject.cce_score !== null ? (
                    `${currentSubject.cce_score} / ${currentSubject.cce_max_marks}`
                  ) : (
                    <span className="text-slate-400 text-base font-semibold italic">Awaiting Submissions</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                  Continuous Comprehensive Evaluation: internal assignments, presentations, and case critiques (Max Marks: {currentSubject.cce_max_marks}).
                </p>
              </div>

              {/* Component 2: HyperBuild Activities */}
              <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase font-black tracking-wider text-indigo-700 dark:text-indigo-300">
                    2. HyperBuild Activities
                  </span>
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <div className="text-2xl font-black text-indigo-700 dark:text-indigo-300">
                    {currentSubject.hyperbuild_total_score !== null ? (
                      `${currentSubject.hyperbuild_total_score} / ${currentSubject.hyperbuild_max_total}`
                    ) : (
                      <span className="text-slate-400 text-base font-semibold italic">No Activity Graded</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-black text-indigo-900 dark:text-indigo-200">
                      Average: {currentSubject.hyperbuild_score !== null ? `${currentSubject.hyperbuild_score}/100` : '—'}
                    </span>
                    <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-white/60 dark:bg-black/20 px-2 py-0.5 rounded-md">
                      Completed {currentSubject.completion_ratio || `${currentSubject.activities_completed || 0} / ${currentSubject.total_released_activities || 0}`} Released Labs
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-indigo-900/70 dark:text-indigo-300/70 leading-tight">
                  AI-evaluated simulation labs: rigorous rubric appraisal, authentic authorship audit, and micro-compliance checklists.
                </p>
              </div>

              {/* Component 3: Term End Examination */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase font-black tracking-wider text-slate-500">
                    3. End Term Exam
                  </span>
                  <GraduationCap className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {currentSubject.term_end_score !== null ? (
                    `${currentSubject.term_end_score} / ${currentSubject.term_end_max_marks}`
                  ) : (
                    <span className="text-slate-400 text-base font-semibold italic">Scheduled End Term</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                  Summative terminal examination evaluating cumulative subject mastery (Max Marks: {currentSubject.term_end_max_marks}).
                </p>
              </div>
            </div>

            {/* HyperBuild Activities Granular List */}
            <div className="space-y-3 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" /> HyperBuild Activities & Simulation Labs
                </h3>
                <span className="text-xs text-slate-500 font-semibold">
                  {currentSubject.activities?.filter((a: any) => a.score !== null).length} / {currentSubject.activities?.length} Submitted
                </span>
              </div>

              {currentSubject.activities?.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                  No HyperBuild activities released yet for this course.
                </div>
              ) : (
                <div className="space-y-3">
                  {currentSubject.activities?.map((act: any) => {
                    const isExpanded = expandedActivityId === act.activity_id;
                    const hasGraded = act.score !== null;

                    return (
                      <div
                        key={act.activity_id}
                        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden transition-all shadow-xs"
                      >
                        <div
                          onClick={() => setExpandedActivityId(isExpanded ? null : act.activity_id)}
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <span className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                              {act.activity_no}
                            </span>
                            <div>
                              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                Activity {act.activity_no}: {act.title}
                              </h4>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                {act.submitted_at
                                  ? `Submitted on ${new Date(act.submitted_at).toLocaleDateString()}`
                                  : 'Not yet submitted'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {hasGraded ? (
                              <>
                                <span className="text-sm font-black text-slate-900 dark:text-white">
                                  {act.score}/100
                                </span>
                                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${getTierColor(act.performance_tier)}`}>
                                  {act.performance_tier}
                                </span>
                                {act.ai_support_percentage !== null && (
                                  <span className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                    AI: {act.ai_support_percentage}%
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">
                                Pending Submission
                              </span>
                            )}
                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </div>
                        </div>

                        {/* Expanded Full HyperBuild Feedback & Evaluation Scorecard */}
                        {isExpanded && (
                          <div className="p-5 bg-slate-50/80 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 space-y-4">
                            {/* Scorecard Header Bar */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-700">
                              <div className="flex items-center gap-2">
                                <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                                  <Sparkles className="w-4 h-4" />
                                </span>
                                <div>
                                  <h5 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                                    AI Rubric Evaluation Scorecard & Academic Audit
                                  </h5>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                    Evaluator Model: {act.ai_evaluation?.model_used || 'HyperBuild Assessment Engine'}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-slate-900 dark:text-white">
                                  Score: {act.score !== null ? `${act.score} / 100` : 'Pending'}
                                </span>
                                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${getTierColor(act.performance_tier)}`}>
                                  {act.performance_tier || 'Pending'}
                                </span>
                              </div>
                            </div>

                            {/* AI Assistance & Academic Integrity Banner */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {/* AI Support Percentage */}
                              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start gap-3 shadow-xs">
                                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                                  <Bot className="w-4 h-4" />
                                </div>
                                <div>
                                  <span className="text-[10.5px] uppercase font-bold text-slate-400 block">
                                    AI Assistance Diagnostic
                                  </span>
                                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                                    {act.ai_evaluation?.ai_support_percentage ?? act.ai_support_percentage ?? 20}% AI Support
                                    <span className="ml-1 text-[11px] font-normal text-slate-500">
                                      ({act.ai_evaluation?.ai_support_level || 'Bounded Support'})
                                    </span>
                                  </span>
                                  {act.ai_evaluation?.ai_audit_findings?.[0] && (
                                    <p className="text-[10.5px] text-slate-500 mt-0.5 line-clamp-1">
                                      {act.ai_evaluation.ai_audit_findings[0]}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Academic Integrity / Collusion Check */}
                              <div
                                className={`p-3.5 rounded-2xl border flex items-start gap-3 shadow-xs ${
                                  act.ai_evaluation?.plagiarism_flag
                                    ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 text-rose-900 dark:text-rose-200'
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                                }`}
                              >
                                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                                  <FileCheck className="w-4 h-4" />
                                </div>
                                <div>
                                  <span className="text-[10.5px] uppercase font-bold text-slate-400 block">
                                    Academic Integrity Audit
                                  </span>
                                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                                    {act.ai_evaluation?.plagiarism_flag
                                      ? 'Peer Collusion / Template Detected'
                                      : 'Original Submission Verified'}
                                  </span>
                                  {act.ai_evaluation?.collusion_details?.[0] ? (
                                    <p className="text-[10.5px] text-rose-600 dark:text-rose-300 mt-0.5 line-clamp-1">
                                      {act.ai_evaluation.collusion_details[0]}
                                    </p>
                                  ) : (
                                    <p className="text-[10.5px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                                      No unauthorized code or peer duplication detected
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Micro-Compliance Protocol Checklist (Steps 1 to 8) */}
                            {(act.ai_evaluation?.micro_compliance_audit || act.micro_compliance_audit) && (
                              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                    📋 Activity Protocol Micro-Audit Checklist
                                  </span>
                                  <span className="text-[10.5px] text-slate-400 font-semibold">
                                    Granular Requirements Compliance
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                  {Object.entries(act.ai_evaluation?.micro_compliance_audit || act.micro_compliance_audit).map(
                                    ([stepKey, val]: [string, any]) => {
                                      const isPassed = String(val).toLowerCase().startsWith('passed');
                                      const formattedKey = stepKey.replace(/_/g, ' ').replace(/^step\s*(\d+)/i, 'Step $1:');
                                      return (
                                        <div
                                          key={stepKey}
                                          className={`p-2.5 rounded-xl border flex items-start gap-2 ${
                                            isPassed
                                              ? 'bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-200/60 dark:border-emerald-900/30 text-emerald-900 dark:text-emerald-200'
                                              : 'bg-rose-50/40 dark:bg-rose-950/10 border-rose-200/60 dark:border-rose-900/30 text-rose-900 dark:text-rose-200'
                                          }`}
                                        >
                                          <span className="text-xs shrink-0 mt-0.5">{isPassed ? '✅' : '❌'}</span>
                                          <div className="min-w-0">
                                            <strong className="capitalize block text-[10.5px] font-bold text-slate-700 dark:text-slate-300">
                                              {formattedKey}
                                            </strong>
                                            <span className="line-clamp-2 text-[11px] leading-snug">{String(val)}</span>
                                          </div>
                                        </div>
                                      );
                                    }
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Executive Summary */}
                            {act.ai_evaluation?.executive_summary && (
                              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-950/80 text-xs sm:text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                                <span className="font-bold text-indigo-900 dark:text-indigo-300 block mb-1">
                                  Executive Summary:
                                </span>
                                {act.ai_evaluation.executive_summary}
                              </div>
                            )}

                            {/* Strengths & Areas for Improvement (2 Columns) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {act.ai_evaluation?.strengths && act.ai_evaluation.strengths.length > 0 && (
                                <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 space-y-2">
                                  <h6 className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                                    <Check className="h-3.5 w-3.5" /> Key Strengths
                                  </h6>
                                  <ul className="space-y-1.5 text-xs text-emerald-950 dark:text-emerald-200 font-medium">
                                    {act.ai_evaluation.strengths.map((s: string, i: number) => (
                                      <li key={i} className="flex items-start gap-1.5">
                                        <span className="text-emerald-500 font-bold">•</span>
                                        <span>{s}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {act.ai_evaluation?.areas_for_improvement && act.ai_evaluation.areas_for_improvement.length > 0 && (
                                <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/40 space-y-2">
                                  <h6 className="text-xs font-black uppercase tracking-wider text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                                    <AlertTriangle className="h-3.5 w-3.5" /> Areas for Improvement
                                  </h6>
                                  <ul className="space-y-1.5 text-xs text-rose-950 dark:text-rose-200 font-medium">
                                    {act.ai_evaluation.areas_for_improvement.map((s: string, i: number) => (
                                      <li key={i} className="flex items-start gap-1.5">
                                        <span className="text-rose-500 font-bold">•</span>
                                        <span>{s}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>

                            {/* Criterion-by-Criterion Rubric Scorecard Table */}
                            {act.ai_evaluation?.criteria_breakdown && act.ai_evaluation.criteria_breakdown.length > 0 && (
                              <div className="space-y-2">
                                <h6 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                  Criterion-by-Criterion Rubric Scorecard
                                </h6>
                                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-[11px] font-black uppercase text-slate-500">
                                        <th className="py-2.5 px-4">Criterion</th>
                                        <th className="py-2.5 px-4 text-center">Score</th>
                                        <th className="py-2.5 px-4">Tier</th>
                                        <th className="py-2.5 px-4">Evaluator Rationale</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                      {act.ai_evaluation.criteria_breakdown.map((cb: any, i: number) => (
                                        <tr key={i} className="align-top">
                                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                                            {cb.criterion}
                                          </td>
                                          <td className="py-3 px-4 font-black text-center text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                                            {cb.marks_awarded} / {cb.max_marks}
                                          </td>
                                          <td className="py-3 px-4 font-semibold text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-bold">
                                              {cb.tier}
                                            </span>
                                          </td>
                                          <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                                            <p>{cb.rationale}</p>
                                            {cb.evidence && (
                                              <p className="text-[11px] text-slate-500 italic mt-1 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg">
                                                <strong className="text-slate-700 dark:text-slate-300 not-italic font-bold">Evidence: </strong>
                                                {cb.evidence}
                                              </p>
                                            )}
                                            {cb.gap_identified && (
                                              <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-1 bg-rose-50/60 dark:bg-rose-950/30 p-2 rounded-lg font-medium">
                                                <strong>Deficiency / Gap: </strong>
                                                {cb.gap_identified}
                                              </p>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* In-depth Critical Masterclass Appraisal */}
                            {(act.ai_evaluation?.critical_feedback || act.feedback) && (
                              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                                <h6 className="text-xs font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-300">
                                  Comprehensive Critical Masterclass Appraisal
                                </h6>
                                <p className="text-xs sm:text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed font-medium whitespace-pre-line">
                                  {act.ai_evaluation?.critical_feedback || act.feedback}
                                </p>
                              </div>
                            )}

                            {/* Submitted Student Deliverables & Files */}
                            {(act.submission_text || (act.files && act.files.length > 0)) && (
                              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                                <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                                  Submitted Deliverables & Solution Artifacts
                                </span>

                                {act.files && act.files.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {act.files.map((f: any, idx: number) => (
                                      <a
                                        key={idx}
                                        href={f.file_url || '#'}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                                      >
                                        <FileText className="w-3.5 h-3.5 text-indigo-600" />
                                        <span>{f.file_name || `File ${idx + 1}`}</span>
                                        <ExternalLink className="w-3 h-3 text-slate-400" />
                                      </a>
                                    ))}
                                  </div>
                                )}

                                {act.submission_text && (
                                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
                                    <span className="font-bold block text-slate-900 dark:text-white mb-1">
                                      Student Notes / Methodology:
                                    </span>
                                    <p className="whitespace-pre-line leading-relaxed">{act.submission_text}</p>
                                  </div>
                                )}
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
        </div>
      )}

      {/* Performance Analytics Timeline */}
      {performance_timeline && performance_timeline.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" /> Recent Activity Performance Trajectory
            </h3>
            <span className="text-xs text-slate-400">Past {performance_timeline.length} Evaluations</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {performance_timeline.map((evt: any, i: number) => (
              <div
                key={i}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-center"
              >
                <span className="text-[10px] font-bold text-indigo-600 uppercase block">{evt.subject}</span>
                <span className="text-xs font-semibold text-slate-500 block truncate">{evt.activity}</span>
                <span className="text-lg font-black text-slate-900 dark:text-white mt-1 block">
                  {evt.score}/100
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">{evt.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
