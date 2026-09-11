import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sliders,
  ArrowLeft,
  ExternalLink,
  Award,
  Video,
  FileText,
  Save,
  CheckCircle2,
  AlertCircle,
  Users,
  Search,
  Layers,
} from 'lucide-react';
import { api } from '../../lib/api';

export const IdeathonEvaluationDashboard: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [evalRound, setEvalRound] = useState<'phase1_prelim' | 'phase2_presentation'>('phase1_prelim');

  // Scorecard State
  const [scores, setScores] = useState<Record<string, number>>({
    market_research: 8.0,
    market_gap: 8.5,
    solution_innovation: 8.0,
    hyperbuild_viability: 9.0,
    pitch_delivery: 7.5,
  });
  const [feedback, setFeedback] = useState('');
  const [strengths, setStrengths] = useState('');
  const [improvements, setImprovements] = useState('');
  const [recommendation, setRecommendation] = useState('shortlist_for_pitch');
  const [evalToast, setEvalToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch Ideathon Details
  const { data: ideathon } = useQuery<any>({
    queryKey: ['ideathon', id],
    queryFn: async () => {
      const res = await api.get(`/ideathons/${id}`);
      return res.data?.data;
    },
    enabled: !!id,
  });

  // Fetch Submissions
  const { data: submissions = [] } = useQuery<any[]>({
    queryKey: ['ideathon-submissions', id],
    queryFn: async () => {
      const res = await api.get(`/ideathons/${id}/submissions`);
      return res.data?.data || [];
    },
    enabled: !!id,
  });

  // Auto-select first submission if not selected
  React.useEffect(() => {
    if (submissions.length > 0 && !selectedSubId) {
      setSelectedSubId(submissions[0].id);
    }
  }, [submissions, selectedSubId]);

  // Fetch Selected Submission Detail
  const { data: currentSub } = useQuery<any>({
    queryKey: ['submission-detail', id, selectedSubId],
    queryFn: async () => {
      if (!selectedSubId) return null;
      const res = await api.get(`/ideathons/${id}/submissions/${selectedSubId}`);
      return res.data?.data;
    },
    enabled: !!id && !!selectedSubId,
  });

  // Populate existing scores if already evaluated
  React.useEffect(() => {
    if (currentSub?.evaluations && currentSub.evaluations.length > 0) {
      const lastEval = currentSub.evaluations[currentSub.evaluations.length - 1];
      if (lastEval?.scores) {
        setScores(lastEval.scores);
      }
      if (lastEval?.feedback) setFeedback(lastEval.feedback);
      if (lastEval?.strengths) setStrengths(lastEval.strengths);
      if (lastEval?.improvements) setImprovements(lastEval.improvements);
      if (lastEval?.recommendation) setRecommendation(lastEval.recommendation);
    }
  }, [currentSub]);

  // Submit Evaluation Mutation
  const evaluateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSubId) return;
      const payload = {
        round: evalRound,
        scores,
        feedback,
        strengths,
        improvements,
        recommendation,
      };
      const res = await api.post(`/ideathons/${id}/submissions/${selectedSubId}/evaluate`, payload);
      return res.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ideathon-submissions', id] });
      queryClient.invalidateQueries({ queryKey: ['submission-detail', id, selectedSubId] });
      queryClient.invalidateQueries({ queryKey: ['ideathon-leaderboard', id] });
      setEvalToast({ type: 'success', message: 'Evaluation scorecard recorded successfully!' });
      setTimeout(() => setEvalToast(null), 3500);
    },
    onError: (err: any) => {
      setEvalToast({ type: 'error', message: err.response?.data?.detail || 'Failed to submit evaluation.' });
      setTimeout(() => setEvalToast(null), 4000);
    },
  });

  // Calculate weighted total
  const rubrics = ideathon?.rubrics || [];
  const weightedTotal = React.useMemo(() => {
    let sum = 0;
    rubrics.forEach((r: any) => {
      const s = scores[r.id] ?? 5.0;
      const max = r.max_score || 10.0;
      const w = r.weightage || 20.0;
      sum += (s / max) * w;
    });
    return Math.round(sum * 10) / 10;
  }, [scores, rubrics]);

  const filteredSubs = submissions.filter((s) => {
    if (filterStatus === 'shortlisted' && s.status !== 'shortlisted') return false;
    if (filterStatus === 'submitted' && s.status !== 'submitted') return false;
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      const matchTitle = s.title?.toLowerCase().includes(q);
      const matchTeam = s.team_name?.toLowerCase().includes(q);
      return matchTitle || matchTeam;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="space-y-1">
          <button
            onClick={() => navigate(`/ideathons/${id}`)}
            className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Competition Brief</span>
          </button>

          <div className="flex items-center gap-3 pt-1">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                Jury Evaluation Dashboard
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {ideathon?.title || 'Ideathon'} • {submissions.length} Total Submissions
              </p>
            </div>
          </div>
        </div>

        {/* Phase / Round Switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setEvalRound('phase1_prelim')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              evalRound === 'phase1_prelim'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Phase 1: Idea Screening
          </button>
          <button
            onClick={() => setEvalRound('phase2_presentation')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              evalRound === 'phase2_presentation'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Phase 2: Live Pitch Day
          </button>
        </div>
      </div>

      {/* Alert / Toast */}
      {evalToast && (
        <div
          className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between shadow-xs ${
            evalToast.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
          }`}
        >
          <span className="flex items-center gap-2">
            {evalToast.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-rose-500" />}
            <strong>{evalToast.message}</strong>
          </span>
          <button onClick={() => setEvalToast(null)} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
      )}

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Col: Submissions Queue (4 Cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3.5 shadow-xs max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
              Submissions Queue ({filteredSubs.length})
            </span>
            <div className="flex items-center gap-1 text-[11px] font-semibold">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-2 py-0.5 rounded-lg cursor-pointer ${filterStatus === 'all' ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800' : 'text-slate-400 hover:text-slate-600'}`}
              >
                All
              </button>
              <button
                onClick={() => setFilterStatus('shortlisted')}
                className={`px-2 py-0.5 rounded-lg cursor-pointer ${filterStatus === 'shortlisted' ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Shortlisted
              </button>
            </div>
          </div>

          {/* Search Filter */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search team or venture..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          {/* Queue List */}
          <div className="space-y-2 pt-1">
            {filteredSubs.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No submissions match the filter.</p>
            ) : (
              filteredSubs.map((sub) => {
                const isSelected = sub.id === selectedSubId;
                return (
                  <div
                    key={sub.id}
                    onClick={() => setSelectedSubId(sub.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                      isSelected
                        ? 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-700/60 shadow-xs'
                        : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate max-w-[150px]">
                        {ideathon?.is_double_blind_screening ? `Venture #${sub.id.slice(0, 6).toUpperCase()}` : (sub.team_name || 'Team')}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                        {sub.final_score ? `${sub.final_score} pts` : 'Ungraded'}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug line-clamp-1">
                      {sub.title}
                    </h4>
                    {sub.tagline && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 italic">
                        "{sub.tagline}"
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Col: Inspection & Rubric Scorecard (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          {currentSub ? (
            <div className="space-y-6">
              {/* Submission Overview Card */}
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                        {ideathon?.is_double_blind_screening ? 'Double-Blind Review' : (currentSub.team_name || 'Venture')}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                        Status: <strong className="uppercase text-slate-700 dark:text-slate-300">{currentSub.status}</strong>
                      </span>
                    </div>
                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                      {currentSub.title}
                    </h2>
                    {currentSub.tagline && (
                      <p className="text-xs text-cyan-600 dark:text-cyan-400 font-medium italic">
                        "{currentSub.tagline}"
                      </p>
                    )}
                  </div>

                  {/* External Media Links */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {currentSub.pitch_deck_url && (
                      <a
                        href={currentSub.pitch_deck_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5 text-cyan-500" />
                        <span>Pitch Deck</span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </a>
                    )}
                    {currentSub.demo_video_url && (
                      <a
                        href={currentSub.demo_video_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 transition-colors"
                      >
                        <Video className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Pitch Video</span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </a>
                    )}
                    {currentSub.prototype_url && (
                      <a
                        href={currentSub.prototype_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Live Prototype</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* 5-Pillar Proposal Details */}
                <div className="space-y-3.5 text-xs">
                  {/* Pillar 1 */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-cyan-500" />
                      Pillar 1: Market Dynamics & Industry Research
                    </h4>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line text-xs">
                      {currentSub.market_dynamics || 'No market dynamics submitted.'}
                    </p>
                  </div>

                  {/* Pillar 2 */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-cyan-500" />
                      Pillar 2: Market Gap & Problem Validation
                    </h4>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line text-xs">
                      {currentSub.market_gap || 'No market gap detailed.'}
                    </p>
                    {currentSub.target_audience && (
                      <p className="text-slate-500 dark:text-slate-400 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px]">
                        <strong className="text-slate-700 dark:text-slate-300">Target Personas:</strong> {currentSub.target_audience}
                      </p>
                    )}
                  </div>

                  {/* Pillar 3 */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-cyan-500" />
                      Pillar 3: Proposed Solution & Value Proposition
                    </h4>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line text-xs">
                      {currentSub.proposed_solution || 'No solution description.'}
                    </p>
                    {currentSub.competitive_moat && (
                      <p className="text-slate-500 dark:text-slate-400 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px]">
                        <strong className="text-slate-700 dark:text-slate-300">Competitive Moat:</strong> {currentSub.competitive_moat}
                      </p>
                    )}
                  </div>

                  {/* Pillar 4 */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-cyan-500" />
                      Pillar 4: HyperBuild No-Code Tech Stack
                    </h4>
                    {currentSub.hyperbuild_stack && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                        <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Frontend</span>
                          <span className="text-slate-800 dark:text-slate-200 font-semibold">{currentSub.hyperbuild_stack.frontend || 'N/A'}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Backend</span>
                          <span className="text-slate-800 dark:text-slate-200 font-semibold">{currentSub.hyperbuild_stack.backend || 'N/A'}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Automations</span>
                          <span className="text-slate-800 dark:text-slate-200 font-semibold">{currentSub.hyperbuild_stack.automation || 'N/A'}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">AI Models</span>
                          <span className="text-slate-800 dark:text-slate-200 font-semibold">{currentSub.hyperbuild_stack.ai || 'N/A'}</span>
                        </div>
                      </div>
                    )}
                    {currentSub.hyperbuild_stack?.architecture_notes && (
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed italic pt-1">
                        Stack Notes: {currentSub.hyperbuild_stack.architecture_notes}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Rubric Scorecard Card */}
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Award className="w-5 h-5 text-indigo-500" />
                      Jury Rubric Scorecard
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                      Active Round: <strong className="text-indigo-600 dark:text-indigo-400 uppercase">{evalRound.replace('_', ' ')}</strong>
                    </p>
                  </div>

                  <div className="text-right">
                    <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{weightedTotal} / 100</div>
                    <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Weighted Score</div>
                  </div>
                </div>

                {/* Rubric Criteria Sliders & Scores */}
                <div className="space-y-3.5">
                  {rubrics.map((r: any) => {
                    const currentVal = scores[r.id] ?? 8.0;
                    return (
                      <div
                        key={r.id}
                        className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-900 dark:text-slate-100">{r.name}</span>
                            <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                              {r.weightage}% weight
                            </span>
                          </div>
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                            {currentVal} / {r.max_score || 10}
                          </span>
                        </div>

                        {r.description && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                            {r.description}
                          </p>
                        )}

                        <div className="flex items-center gap-3 pt-1">
                          <input
                            type="range"
                            min="0"
                            max={r.max_score || 10}
                            step="0.5"
                            value={currentVal}
                            onChange={(e) => setScores({ ...scores, [r.id]: parseFloat(e.target.value) })}
                            className="flex-1 accent-indigo-600 cursor-pointer"
                          />
                          <input
                            type="number"
                            min="0"
                            max={r.max_score || 10}
                            step="0.5"
                            value={currentVal}
                            onChange={(e) => setScores({ ...scores, [r.id]: parseFloat(e.target.value) || 0 })}
                            className="w-16 px-2 py-1 text-center text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Qualitative Feedback */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 dark:text-slate-300">Key Strengths & Differentiators</label>
                    <textarea
                      rows={3}
                      placeholder="What stood out about this proposal (e.g. unique insights, customer validation)..."
                      value={strengths}
                      onChange={(e) => setStrengths(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 dark:text-slate-300">Recommendations for Incubation MVP</label>
                    <textarea
                      rows={3}
                      placeholder="Constructive recommendations for execution and product build..."
                      value={improvements}
                      onChange={(e) => setImprovements(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Overall Evaluation Summary & Feedback</label>
                  <textarea
                    rows={2}
                    placeholder="General remarks, pitch observations, or jury panel notes..."
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Recommendation & Save Action */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <label className="font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">Jury Recommendation:</label>
                    <select
                      value={recommendation}
                      onChange={(e) => setRecommendation(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="shortlist_for_pitch">⭐ Shortlist for Pitch Round</option>
                      <option value="award_winner">🏆 Recommend for Podium Award</option>
                      <option value="incubate_in_hyperbuild">🚀 Direct HyperBuild Incubation</option>
                      <option value="needs_revision">⚠️ Needs Revision</option>
                      <option value="reject">❌ Not Recommended</option>
                    </select>
                  </div>

                  <button
                    onClick={() => evaluateMutation.mutate()}
                    disabled={evaluateMutation.isPending}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{evaluateMutation.isPending ? 'Recording Score...' : 'Submit Evaluation Scorecard'}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 space-y-2">
              <Users className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-semibold">Select a submission from the left queue to begin evaluation.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
