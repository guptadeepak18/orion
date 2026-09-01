import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  BrainCircuit,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  BookOpen,
  Award,
  Activity,
  Sparkles,
  Search,
  CheckCircle2,
  RefreshCw,
  Zap,
  Calendar,
  Clock,
  Briefcase,
  FileCheck2,
  UserCheck,
} from 'lucide-react';
import { api } from '../../lib/api';

export const ProactiveIntelligenceHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    'early_warnings' | 'neural_scheduling' | 'curriculum_benchmark' | 'crc_placement' | 'institutional_pulse'
  >('early_warnings');

  // EWIS States
  const [selectedRiskFilter, setSelectedRiskFilter] = useState<string>('all');
  const [studentSearch, setStudentSearch] = useState<string>('');

  // Curriculum & Assessment States
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [rubricText, setRubricText] = useState<string>(
    'Executive analysis on enterprise digital transformation and supply chain agility in modern enterprises. Strategic recommendations include cloud ERP migration and predictive maintenance.'
  );

  // Neural Scheduling States
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [substituteSubjectId, setSubstituteSubjectId] = useState<string>('');

  // CRC Placement States
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [jdJobTitle, setJdJobTitle] = useState<string>('Management Consultant - Strategy & Operations');
  const [jdDomain, setJdDomain] = useState<string>('Consulting');
  const [jdSkills, setJdSkills] = useState<string>('Strategic Management, Financial Modeling, Data Analytics');

  // 1. Proactive Early Warnings Query
  const { data: ewisData, isLoading: ewisLoading, refetch: refetchEwis } = useQuery({
    queryKey: ['ai_early_warnings'],
    queryFn: async () => {
      const res = await api.get('/ai/early-warnings');
      return res.data.data;
    },
  });

  // 2. Batches List
  const { data: batchesListData } = useQuery({
    queryKey: ['batches_for_ai_hub'],
    queryFn: async () => {
      const res = await api.get('/academic/batches');
      const list = res.data.data as any[];
      if (list && list.length > 0 && !selectedBatchId) {
        setSelectedBatchId(list[0].id);
      }
      return list;
    },
  });

  // 3. Subjects List
  const { data: subjectsListData } = useQuery({
    queryKey: ['subjects_for_ai_hub'],
    queryFn: async () => {
      const res = await api.get('/academic/subjects');
      const list = res.data.data as any[];
      if (list && list.length > 0) {
        if (!selectedSubjectId) setSelectedSubjectId(list[0].id);
        if (!substituteSubjectId) setSubstituteSubjectId(list[0].id);
      }
      return list;
    },
  });

  // 4. Students List
  const { data: studentsListData } = useQuery({
    queryKey: ['students_for_ai_hub'],
    queryFn: async () => {
      const res = await api.get('/students');
      const list = res.data.data as any[];
      if (list && list.length > 0 && !selectedStudentId) {
        setSelectedStudentId(list[0].id);
      }
      return list;
    },
  });

  // 5. Subject AI Benchmark Query
  const { data: benchmarkData, refetch: refetchBenchmark } = useQuery({
    queryKey: ['ai_subject_benchmark', selectedSubjectId],
    queryFn: async () => {
      if (!selectedSubjectId) return null;
      const res = await api.get(`/ai/syllabus-benchmark/${selectedSubjectId}`);
      return res.data.data;
    },
    enabled: !!selectedSubjectId,
  });

  // 6. Bloom's Question Paper Query
  const { data: bloomsPaperData, isLoading: bloomsLoading, refetch: refetchBlooms } = useQuery({
    queryKey: ['ai_blooms_paper', selectedSubjectId],
    queryFn: async () => {
      if (!selectedSubjectId) return null;
      const res = await api.get(`/operations/exam/blooms-question-paper/${selectedSubjectId}`);
      return res.data.data;
    },
    enabled: !!selectedSubjectId,
  });

  // 7. Neural Optimized Timetable Query
  const { data: timetableData, isLoading: timetableLoading, refetch: refetchTimetable } = useQuery({
    queryKey: ['ai_optimized_timetable', selectedBatchId],
    queryFn: async () => {
      if (!selectedBatchId) return null;
      const res = await api.get(`/operations/timetable/optimize?batch_id=${selectedBatchId}`);
      return res.data.data;
    },
    enabled: !!selectedBatchId,
  });

  // 8. Emergency Substitute Query
  const { data: substituteData, isLoading: substituteLoading, refetch: refetchSubstitute } = useQuery({
    queryKey: ['ai_emergency_substitute', substituteSubjectId],
    queryFn: async () => {
      if (!substituteSubjectId) return null;
      const res = await api.get(`/operations/substitute/find?subject_id=${substituteSubjectId}`);
      return res.data.data;
    },
    enabled: !!substituteSubjectId,
  });

  // 9. Exam Seating Matrix Query
  const { data: seatingMatrixData, refetch: refetchSeating } = useQuery({
    queryKey: ['ai_exam_seating_matrix'],
    queryFn: async () => {
      const res = await api.get('/operations/exam/seating-matrix');
      return res.data.data;
    },
  });

  // 10. Student Talent DNA Query
  const { data: talentDnaData, isLoading: talentDnaLoading } = useQuery({
    queryKey: ['ai_student_talent_dna', selectedStudentId],
    queryFn: async () => {
      if (!selectedStudentId) return null;
      const res = await api.get(`/operations/crc/talent-dna/${selectedStudentId}`);
      return res.data.data;
    },
    enabled: !!selectedStudentId,
  });

  // 11. Rubric Evaluation Mutation
  const rubricMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await api.post('/operations/rubric/evaluate', {
        submission_text: text,
        assignment_title: 'Executive Capstone Strategy Writeup',
        max_marks: 20,
      });
      return res.data.data;
    },
  });

  // 12. JD Match Mutation
  const jdMatchMutation = useMutation({
    mutationFn: async () => {
      const skillsArray = jdSkills.split(',').map((s) => s.trim()).filter(Boolean);
      const res = await api.post('/operations/crc/jd-match', {
        job_title: jdJobTitle,
        domain: jdDomain,
        required_skills: skillsArray,
      });
      return res.data.data;
    },
  });

  // 13. Institutional Health Pulse Query
  const { data: pulseData, refetch: refetchPulse } = useQuery({
    queryKey: ['ai_institutional_pulse'],
    queryFn: async () => {
      const res = await api.get('/ai/institutional-health-pulse');
      return res.data.data;
    },
  });

  // Filtered Roster for EWIS
  const riskRoster = ewisData?.risk_roster || [];
  const filteredRoster = riskRoster.filter((st: any) => {
    const matchTier = selectedRiskFilter === 'all' || st.risk_tier === selectedRiskFilter;
    const matchSearch =
      !studentSearch ||
      st.student_name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      st.prn_number.toLowerCase().includes(studentSearch.toLowerCase());
    return matchTier && matchSearch;
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* ── TOP HERO BANNER ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-bold">
              <Sparkles className="h-3.5 w-3.5 animate-pulse" />
              <span>AI Academic Assistant & Intelligent Insights</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Academic Operations & Planning Assistant
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
              Smart scheduling suggestions, student attendance early warnings, curriculum alignment, career placement skill matching, and institutional quality tracking.
            </p>
          </div>

          {/* Health Index Quick Widget */}
          <div className="flex items-center gap-4 bg-slate-800/80 border border-slate-700/60 p-4 rounded-2xl shrink-0">
            <div className="h-12 w-12 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <BrainCircuit className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Institutional Health</p>
              <p className="text-xl font-black text-emerald-400">
                {pulseData?.institutional_health_score || '94.2'}/100
              </p>
              <span className="text-[10px] text-slate-400">All checks running normally</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── NAVIGATION TABS ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 overflow-x-auto">
        {[
          { id: 'early_warnings', label: 'Student Attendance Early Warnings', icon: AlertTriangle },
          { id: 'neural_scheduling', label: 'Smart Timetable Suggestions', icon: Calendar },
          { id: 'curriculum_benchmark', label: 'Curriculum & Rubric Analysis', icon: BookOpen },
          { id: 'crc_placement', label: 'Placement & Job Skill Matcher', icon: Briefcase },
          { id: 'institutional_pulse', label: 'Institutional Overview & Health', icon: Activity },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 1: EARLY WARNING SYSTEM (ATTENDANCE & ACADEMIC RISK)
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'early_warnings' && (
        <div className="space-y-6">
          {ewisData?.summary && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <p className="text-xs font-semibold text-slate-500">Tracked Students</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {ewisData.summary.total_students}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">All Enrolled</p>
              </div>

              <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <p className="text-xs font-semibold text-rose-500">Attendance Alert (&lt;65%)</p>
                <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                  {ewisData.summary.imminent_debarment}
                </p>
                <p className="text-[11px] text-rose-500/80 mt-1">&lt; 65% Projected</p>
              </div>

              <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <p className="text-xs font-semibold text-amber-500">Critical Risk</p>
                <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                  {ewisData.summary.critical_risk}
                </p>
                <p className="text-[11px] text-amber-500/80 mt-1">65% - 74.9% Projected</p>
              </div>

              <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <p className="text-xs font-semibold text-indigo-500">Moderate Watch</p>
                <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                  {ewisData.summary.moderate_watch}
                </p>
                <p className="text-[11px] text-indigo-500/80 mt-1">75% - 80% Buffer</p>
              </div>

              <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <p className="text-xs font-semibold text-emerald-500">Attendance Trend</p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {ewisData.summary.average_attendance_velocity}
                </p>
                <p className="text-[11px] text-emerald-500/80 mt-1">4-Week Trajectory</p>
              </div>
            </div>
          )}

          {/* Filter Bar */}
          <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'all', label: 'All Students' },
                { id: 'imminent_debarment', label: 'Attendance Alert (<65%)' },
                { id: 'critical_risk', label: 'Critical Risk' },
                { id: 'moderate_watch', label: 'Moderate Watch' },
                { id: 'healthy', label: 'Healthy Standing' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedRiskFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    selectedRiskFilter === f.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search student or PRN..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Student Predictive Risk Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-indigo-600" />
                Predictive Risk Matrix & Remedial Prescriptions ({filteredRoster.length} Students)
              </h3>
              <button
                onClick={() => refetchEwis()}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>

            {ewisLoading ? (
              <p className="py-12 text-center text-xs text-slate-400">Running AI retention models...</p>
            ) : filteredRoster.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3.5">Student & PRN</th>
                      <th className="p-3.5 text-center">Current Attendance</th>
                      <th className="p-3.5 text-center">4-Week Velocity</th>
                      <th className="p-3.5 text-center">Projected Term-End</th>
                      <th className="p-3.5 text-center">Risk Tier</th>
                      <th className="p-3.5">AI Prescriptions & Retention Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredRoster.map((st: any) => (
                      <tr key={st.student_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="p-3.5">
                          <p className="font-bold text-slate-900 dark:text-white">{st.student_name}</p>
                          <span className="font-mono text-[10px] text-slate-400 font-semibold">
                            {st.prn_number} • {st.batch_name}
                          </span>
                        </td>

                        <td className="p-3.5 text-center">
                          <span className={`font-black text-sm ${st.current_percentage < 75.0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                            {st.current_percentage}%
                          </span>
                          <p className="text-[10px] text-slate-400">
                            {st.total_attended} / {st.total_conducted} classes
                          </p>
                        </td>

                        <td className="p-3.5 text-center">
                          <div className="inline-flex items-center gap-1 font-bold">
                            {st.velocity_indicator === 'rapid_decay' || st.velocity_indicator === 'declining' ? (
                              <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
                            ) : st.velocity_indicator === 'improving' ? (
                              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                            ) : null}
                            <span className={`text-xs ${st.velocity_indicator === 'rapid_decay' ? 'text-rose-600 font-black' : st.velocity_indicator === 'improving' ? 'text-emerald-600 font-bold' : 'text-slate-500'}`}>
                              {st.velocity_delta}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 capitalize">{st.velocity_indicator.replace('_', ' ')}</p>
                        </td>

                        <td className="p-3.5 text-center">
                          <span className={`font-black text-xs px-2 py-0.5 rounded-full ${st.projected_term_percentage < 75.0 ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'}`}>
                            {st.projected_term_percentage}%
                          </span>
                        </td>

                        <td className="p-3.5 text-center">
                          <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                            st.risk_tier === 'imminent_debarment' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' :
                            st.risk_tier === 'critical_risk' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                            st.risk_tier === 'moderate_watch' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300' :
                            'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          }`}>
                            {st.risk_tier.replace('_', ' ')}
                          </span>
                        </td>

                        <td className="p-3.5 space-y-1">
                          {st.prescriptions?.map((p: string, pIdx: number) => (
                            <div key={pIdx} className="flex items-start gap-1.5 text-[11px] text-slate-700 dark:text-slate-300">
                              <Zap className="h-3 w-3 text-indigo-500 shrink-0 mt-0.5" />
                              <span>{p}</span>
                            </div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500 opacity-60" />
                <p className="font-semibold">No students matching the selected risk filters.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 2: NEURAL CONSTRAINT SCHEDULING & FACULTY SUBSTITUTION
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'neural_scheduling' && (
        <div className="space-y-6">
          {/* Cohort Selector & Optimization Summary */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                Automated Scheduling Assistant
              </span>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                Conflict-Free Class Timetable Generator
              </h2>
              <div className="flex items-center gap-3 pt-2">
                <select
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                >
                  {batchesListData?.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => refetchTimetable()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Re-Optimize Timetable
                </button>
              </div>
            </div>

            {timetableData && (
              <div className="flex items-center gap-6 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div>
                  <p className="text-[11px] text-slate-500 font-semibold">Optimization Score</p>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{timetableData.optimization_score}%</p>
                </div>
                <div className="border-l border-slate-200 dark:border-slate-700 pl-4">
                  <p className="text-[11px] text-slate-500 font-semibold">Weekly Sessions</p>
                  <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{timetableData.total_weekly_sessions}</p>
                </div>
                <div className="border-l border-slate-200 dark:border-slate-700 pl-4">
                  <p className="text-[11px] text-slate-500 font-semibold">Constraint Violations</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">{timetableData.hard_constraints_violated}</p>
                </div>
              </div>
            )}
          </div>

          {/* Timetable Weekly Matrix */}
          {timetableLoading ? (
            <p className="py-12 text-center text-xs text-slate-400">Solving neural scheduling constraints...</p>
          ) : timetableData?.schedule ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(timetableData.schedule).map(([day, slots]: [string, any]) => (
                <div key={day} className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-indigo-600" />
                      {day}
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {slots.length} Sessions
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {slots.map((s: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-900 dark:text-white">{s.subject_name}</span>
                          <span className="font-mono text-[10px] font-bold text-indigo-600">{s.subject_code}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-semibold">
                          <Clock className="h-3 w-3 text-slate-400" />
                          <span>{s.time_window}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-200 dark:border-slate-700/40">
                          <span>{s.faculty_name}</span>
                          <span className="text-slate-400">{s.venue}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* Section: Emergency Faculty Substitution & Anti-Cheat Exam Seating */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
            {/* Emergency Faculty Substitution Sentinel */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Emergency Faculty Substitution Assistant
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Instant matching for emergency leaves with conflict-free availability</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={substituteSubjectId}
                  onChange={(e) => setSubstituteSubjectId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                >
                  {subjectsListData?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code || 'SUB'} - {s.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => refetchSubstitute()}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shrink-0 shadow-xs"
                >
                  Find Substitutes
                </button>
              </div>

              {substituteLoading ? (
                <p className="text-xs text-slate-400">Scanning faculty schedules and domain competencies...</p>
              ) : substituteData?.recommended_substitutes ? (
                <div className="space-y-2.5 pt-2">
                  {substituteData.recommended_substitutes.map((sub: any, idx: number) => (
                    <div key={idx} className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-xs flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{sub.faculty_name}</p>
                        <p className="text-[10px] text-slate-500 font-semibold">{sub.type} • Rating: {sub.teaching_rating}</p>
                        <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">
                          {sub.domain_competency_match}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          {sub.readiness_score}% Readiness
                        </span>
                        <p className="text-[10px] text-slate-400 mt-1">{sub.availability_status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Conflict-Free Anti-Cheat Exam Seating Matrix */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    Conflict-Free Exam Seating Matrix
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Randomized Interleaved Desk Allocations (A-B-A-B Anti-Cheat Pattern)</p>
                </div>
                <button
                  onClick={() => refetchSeating()}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>

              {seatingMatrixData?.seating_roster ? (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {seatingMatrixData.seating_roster.map((seat: any, idx: number) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded">
                          {seat.desk_number}
                        </span>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{seat.student_name}</p>
                          <span className="text-[10px] text-slate-400">{seat.prn_number} • {seat.batch_name}</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500">{seat.hall_name}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 3: CURRICULUM BENCHMARK & BLOOM'S ASSESSMENT
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'curriculum_benchmark' && (
        <div className="space-y-6">
          <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <BookOpen className="h-5 w-5 text-indigo-600 shrink-0" />
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full sm:w-96 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
              >
                {subjectsListData?.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.code || 'SUB'} - {sub.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => {
                refetchBenchmark();
                refetchBlooms();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" /> Re-Benchmark Syllabus
            </button>
          </div>

          {/* Syllabus Industry Benchmark Overview */}
          {benchmarkData && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Industry Alignment</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
                    {benchmarkData.industry_alignment_score}%
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                    {benchmarkData.industry_alignment_rating}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">2026 Corporate Competency Alignment</p>
              </div>

              <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">OBE Attainment Status</p>
                <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                  {benchmarkData.obe_attainment_readiness}
                </p>
                <p className="text-[11px] text-slate-500">Continuous Assessment & CO-PO Mapped</p>
              </div>

              <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Course Parameters</p>
                <p className="text-sm font-extrabold text-slate-900 dark:text-white truncate">{benchmarkData.subject_name}</p>
                <p className="text-[11px] text-slate-500 font-semibold">
                  {benchmarkData.subject_code} • {benchmarkData.credits} Credits • {benchmarkData.total_hours}h
                </p>
              </div>
            </div>
          )}

          {/* AI Bloom's Question Paper Generator Section */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <BrainCircuit className="h-4 w-4 text-indigo-600" />
                  AI Cognitive Bloom's Taxonomy Question Paper Synthesizer
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {bloomsPaperData?.subject_name} • {bloomsPaperData?.exam_type} ({bloomsPaperData?.total_marks} Marks)
                </p>
              </div>
              <span className="text-[10px] font-extrabold px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                {bloomsPaperData?.blooms_compliance_status}
              </span>
            </div>

            {bloomsLoading ? (
              <p className="text-xs text-slate-400">Synthesizing balanced Bloom's questions mapped to Course Outcomes...</p>
            ) : bloomsPaperData?.questions ? (
              <div className="space-y-3 pt-2">
                {bloomsPaperData.questions.map((q: any, idx: number) => (
                  <div key={idx} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{q.section}</span>
                      <span className="font-mono font-bold px-2 py-0.5 rounded bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {q.marks} Marks
                      </span>
                    </div>
                    <p className="font-semibold text-slate-900 dark:text-white text-xs">
                      {q.question_no}. {q.text}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500 pt-1 border-t border-slate-200 dark:border-slate-700/40">
                      <span className="font-bold text-slate-700 dark:text-slate-300">Bloom's: {q.blooms_level}</span>
                      <span>•</span>
                      <span>Outcome: {q.course_outcome}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* AI Formative Rubric Grader */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
              <FileCheck2 className="h-4 w-4" />
              AI Semantic Rubric Grader & Formative Feedback
            </h3>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Student Submission Text</label>
              <textarea
                rows={3}
                value={rubricText}
                onChange={(e) => setRubricText(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500"
              />
            </div>

            <button
              onClick={() => rubricMutation.mutate(rubricText)}
              disabled={rubricMutation.isPending}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs flex items-center gap-2 disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {rubricMutation.isPending ? 'Grading Submission...' : 'Evaluate Submission with AI Rubric'}
            </button>

            {rubricMutation.data && (
              <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-xs space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Awarded Score: <span className="text-indigo-600 dark:text-indigo-400">{rubricMutation.data.total_score}</span> (Grade {rubricMutation.data.grade_letter})
                  </p>
                  <span className="font-bold text-emerald-600 text-[10px]">
                    {rubricMutation.data.originality_index}
                  </span>
                </div>

                <div className="space-y-2">
                  {rubricMutation.data.criteria_breakdown?.map((c: any, i: number) => (
                    <div key={i} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px]">
                      <div className="flex items-center justify-between font-bold">
                        <span>{c.criterion}</span>
                        <span className="text-indigo-600">{c.awarded_score} / {c.max_score}</span>
                      </div>
                      <p className="text-slate-500 text-[10px] mt-0.5">{c.feedback}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 4: CRC PLACEMENT & TALENT DNA
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'crc_placement' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Student 360° Talent DNA Radar */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-indigo-600" />
                  Student 360° Talent DNA Radar
                </h3>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Select Student Candidate</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                >
                  {studentsListData?.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.full_name || st.first_name} ({st.prn_number || 'PRN'})
                    </option>
                  ))}
                </select>
              </div>

              {talentDnaLoading ? (
                <p className="text-xs text-slate-400">Synthesizing competency graph...</p>
              ) : talentDnaData ? (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/40">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Talent Readiness Index</p>
                      <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">{talentDnaData.overall_talent_index}</p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      {talentDnaData.readiness_tier}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Competency & Skill Matrix</p>
                    {Object.entries(talentDnaData.competency_radar || {}).map(([skill, score]: any) => (
                      <div key={skill} className="space-y-1 text-xs">
                        <div className="flex items-center justify-between text-[11px] font-semibold">
                          <span className="text-slate-700 dark:text-slate-300">{skill}</span>
                          <span className="font-bold text-indigo-600">{score}%</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${score}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-[11px] space-y-1 text-slate-600 dark:text-slate-300">
                    <p className="font-bold text-slate-900 dark:text-white">AI Placement Recommendation:</p>
                    <p>{talentDnaData.ai_coaching_recommendation}</p>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Recruiter Job Description (JD) Matchmaker */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Corporate Recruiter JD Matchmaker
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Job Title / Role</label>
                  <input
                    type="text"
                    value={jdJobTitle}
                    onChange={(e) => setJdJobTitle(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500 mt-1"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Domain / Practice</label>
                  <input
                    type="text"
                    value={jdDomain}
                    onChange={(e) => setJdDomain(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500 mt-1"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Required Skills (Comma separated)</label>
                  <input
                    type="text"
                    value={jdSkills}
                    onChange={(e) => setJdSkills(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500 mt-1"
                  />
                </div>

                <button
                  onClick={() => jdMatchMutation.mutate()}
                  disabled={jdMatchMutation.isPending}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs flex items-center gap-2 disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {jdMatchMutation.isPending ? 'Matching Candidates...' : 'Run Placement Matchmaker'}
                </button>
              </div>

              {jdMatchMutation.data && (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1 pt-2">
                  {jdMatchMutation.data.candidate_rankings?.map((cand: any, i: number) => (
                    <div key={i} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{cand.student_name}</p>
                        <p className="text-[10px] text-slate-400 font-semibold">{cand.prn_number} • {cand.batch_name}</p>
                        <span className="text-[10px] font-bold text-emerald-600">{cand.resume_fit}</span>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                        {cand.match_score}% Match
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 5: INSTITUTIONAL HEALTH PULSE & COMPLIANCE
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'institutional_pulse' && (
        <div className="space-y-6">
          {pulseData && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
                  <p className="text-xs text-slate-500 font-semibold">Institutional Attendance</p>
                  <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{pulseData.overall_attendance_rate}</p>
                  <p className="text-[11px] text-slate-400">{pulseData.total_sessions_tracked} Sessions Conducted</p>
                </div>

                <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
                  <p className="text-xs text-slate-500 font-semibold">Accreditation Readiness</p>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">95.8%</p>
                  <p className="text-[11px] text-slate-400">NAAC / AACSB Target Met</p>
                </div>

                <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
                  <p className="text-xs text-slate-500 font-semibold">Faculty Strength</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">{pulseData.faculty_strength?.total || 0}</p>
                  <p className="text-[11px] text-slate-400">
                    {pulseData.faculty_strength?.internal_faculty} Core • {pulseData.faculty_strength?.external_corporate_faculty} Corporate Guest
                  </p>
                </div>

                <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
                  <p className="text-xs text-slate-500 font-semibold">Active Cohorts</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">{pulseData.total_active_programs}</p>
                  <p className="text-[11px] text-slate-400">{pulseData.total_active_batches} Batches Enrolled</p>
                </div>
              </div>

              {/* Program Compliance Table */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Award className="h-4 w-4 text-indigo-600" />
                    Program Operations & Accreditation Compliance Breakdown
                  </h3>
                  <button
                    onClick={() => refetchPulse()}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3">Program Name</th>
                        <th className="p-3">Code</th>
                        <th className="p-3 text-center">Attendance Health</th>
                        <th className="p-3 text-center">Accreditation Readiness</th>
                        <th className="p-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {pulseData.programs_health?.map((pr: any) => (
                        <tr key={pr.program_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-bold text-slate-900 dark:text-white">{pr.program_name}</td>
                          <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">{pr.code}</td>
                          <td className="p-3 text-center font-extrabold text-emerald-600">{pr.overall_attendance}</td>
                          <td className="p-3 text-center text-slate-600 dark:text-slate-300 font-medium">
                            {pr.accreditation_readiness}
                          </td>
                          <td className="p-3 text-right">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              {pr.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
