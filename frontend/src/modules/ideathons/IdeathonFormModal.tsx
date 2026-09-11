import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Edit3,
  Plus,
  Trash2,
  X,
  Save,
  CheckSquare,
  Square,
  AlertCircle,
  GraduationCap,
  Calendar,
  Layers,
  Award,
  Sliders,
  HelpCircle,
  Settings,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../../lib/api';

export interface IdeathonFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  ideathon?: any | null; // if provided -> edit mode, if null -> create mode
  onSaved?: (savedIdeathon: any) => void;
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

const DEFAULT_TRACKS = [
  { id: 'fintech', name: 'FinTech & WealthOps', description: 'Next-gen wealth management, fraud detection, and treasury automation.' },
  { id: 'edtech', name: 'EdTech & Learning Automation', description: 'Student lifecycle assistants, adaptive tutoring, and automated grading ops.' },
  { id: 'healthtech', name: 'HealthTech & Wellness', description: 'Patient intake routing, preventive health trackers, and clinical ops balancing.' },
  { id: 'enterprise', name: 'Enterprise AI & Workflow Automation', description: 'Multi-agent operations, CRM enrichment, and automated invoice clearance.' },
];

const DEFAULT_STAGES = [
  { id: 'registration', title: 'Registration & Team Formation', description: 'Form cross-program teams (or register solo) and choose an innovation track.', date_label: 'Phase 1' },
  { id: 'submission', title: 'Market Research & Idea Submission', description: 'Complete 5-pillar research proposal: market validation, UVP, and no-code architecture.', date_label: 'Phase 2' },
  { id: 'screening', title: 'Phase 1 Jury Review & Shortlisting', description: 'Jury evaluates submissions against weighted rubrics to select finalists.', date_label: 'Phase 3' },
  { id: 'pitch', title: 'Grand Pitch Presentations', description: 'Live 7-minute pitch presentation before faculty panel and industry experts.', date_label: 'Phase 4' },
  { id: 'awards', title: 'Podium Announcement & Awards', description: 'Winners announced and digital credentials issued.', date_label: 'Phase 5' },
  { id: 'incubation', title: 'HyperBuild Project Incubation', description: 'Winning ventures inducted into HyperBuild incubator to construct functional MVPs.', date_label: 'Phase 6' },
];

const DEFAULT_RUBRICS = [
  { id: 'market_research', name: 'Market Dynamics & Research Depth', weightage: 25, max_score: 10, description: 'TAM/SAM sizing, macro trends, competitor landscape, and verified market signals.' },
  { id: 'market_gap', name: 'Market Gap & Problem Validation', weightage: 25, max_score: 10, description: 'Clear articulation of unmet customer friction and validation why alternatives fail.' },
  { id: 'solution_innovation', name: 'Solution Innovation & Moat', weightage: 20, max_score: 10, description: 'Creativity, originality of value proposition, customer journey, and defensibility.' },
  { id: 'hyperbuild_viability', name: 'No-Code Stack & Feasibility', weightage: 15, max_score: 10, description: 'Practicality of rapid MVP execution using FlutterFlow, Supabase, Make/n8n, and AI.' },
  { id: 'pitch_delivery', name: 'Pitch Presentation & Clarity', weightage: 15, max_score: 10, description: 'Compelling narrative structure, visual slide quality, and defense in Q&A.' },
];

const DEFAULT_PRIZES = [
  { rank: 1, title: 'Grand Winner (Gold)', reward: '₹50,000 Cash Award + Guaranteed Incubation + Mentor Advisory' },
  { rank: 2, title: 'First Runner-Up (Silver)', reward: '₹30,000 Cash Award + Incubation Fast-Track Support' },
  { rank: 3, title: 'Second Runner-Up (Bronze)', reward: '₹20,000 Cash Award + Innovation Sandbox Access' },
];

const DEFAULT_RULES = [
  'Cross-cohort participation is permitted across all eligible academic programs (PGDM, GMBA, BBA, HMCT).',
  'Each student may strictly belong to only one registered venture/team.',
  'Teams must submit original, unplagiarized research across all 5 workspace pillars.',
  'Presentations must adhere strictly to the 7-minute presentation and 3-minute Q&A time limit.',
];

const DEFAULT_FAQS = [
  { question: 'Can I participate individually without teammates?', answer: 'Yes! Individual solo ventures are fully supported. Simply provide your venture name at registration.' },
  { question: 'Can students from different programs form a team together?', answer: 'Yes, cross-program collaboration is permitted and encouraged.' },
  { question: 'What tools are allowed for the prototype?', answer: 'You may use any modern rapid application stack: FlutterFlow, Bubble, Supabase, Make.com, n8n, Gemini/OpenAI APIs, or custom code.' },
];

const formatForDateTimeLocal = (dateStr?: string | null) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => (n < 10 ? '0' + n : n);
    const YYYY = d.getFullYear();
    const MM = pad(d.getMonth() + 1);
    const DD = pad(d.getDate());
    const HH = pad(d.getHours());
    const mm = pad(d.getMinutes());
    return `${YYYY}-${MM}-${DD}T${HH}:${mm}`;
  } catch {
    return '';
  }
};

export const IdeathonFormModal: React.FC<IdeathonFormModalProps> = ({
  isOpen,
  onClose,
  ideathon,
  onSaved,
}) => {
  const queryClient = useQueryClient();
  const isEdit = !!ideathon?.id;

  const [activeTab, setActiveTab] = useState<
    'overview' | 'timelines' | 'tracks' | 'stages' | 'rubrics' | 'prizes' | 'rules_faqs' | 'settings'
  >('overview');

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    theme: '',
    status: 'registration_open',
    brief: '',
    problem_statement: '',
    banner_url: '',
    min_team_size: 1,
    max_team_size: 4,
    registration_start_at: '',
    registration_end_at: '',
    submission_start_at: '',
    submission_end_at: '',
    presentation_date: '',
    results_announced_at: '',
    target_programs: ['ALL'] as string[],
    target_batches: ['ALL'] as string[],
    tracks: DEFAULT_TRACKS as any[],
    process_and_stages: DEFAULT_STAGES as any[],
    rubrics: DEFAULT_RUBRICS as any[],
    prizes: DEFAULT_PRIZES as any[],
    rules_and_guidelines: DEFAULT_RULES as string[],
    faqs: DEFAULT_FAQS as any[],
    is_double_blind_screening: true,
    is_leaderboard_published: false,
    lead_faculty_id: '',
    assigned_faculty_ids: [] as string[],
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch Academic Programs
  const { data: programs = [] } = useQuery<ProgramItem[]>({
    queryKey: ['academic-programs'],
    queryFn: async () => {
      const res = await api.get('/academic/programs');
      return res.data?.data || [];
    },
    enabled: isOpen,
  });

  // Fetch Academic Batches
  const { data: batches = [] } = useQuery<BatchItem[]>({
    queryKey: ['academic-batches'],
    queryFn: async () => {
      const res = await api.get('/academic/batches');
      return res.data?.data || [];
    },
    enabled: isOpen,
  });

  // Fetch Available Faculty Members (Internal & External)
  const { data: faculties = [] } = useQuery({
    queryKey: ['competition-faculties'],
    queryFn: async () => {
      const res = await api.get('/ideathons/faculties');
      return res.data?.data || [];
    },
    enabled: isOpen,
  });

  // Populate data when modal opens or ideathon changes
  useEffect(() => {
    if (isOpen) {
      if (ideathon) {
        // Edit mode: populate existing values
        setFormData({
          title: ideathon.title || '',
          theme: ideathon.theme || '',
          status: ideathon.status || 'draft',
          brief: ideathon.brief || ideathon.description || '',
          problem_statement: ideathon.problem_statement || '',
          banner_url: ideathon.banner_url || '',
          min_team_size: ideathon.min_team_size ?? 1,
          max_team_size: ideathon.max_team_size ?? 4,
          registration_start_at: formatForDateTimeLocal(ideathon.registration_start_at),
          registration_end_at: formatForDateTimeLocal(ideathon.registration_end_at),
          submission_start_at: formatForDateTimeLocal(ideathon.submission_start_at),
          submission_end_at: formatForDateTimeLocal(ideathon.submission_end_at),
          presentation_date: formatForDateTimeLocal(ideathon.presentation_date),
          results_announced_at: formatForDateTimeLocal(ideathon.results_announced_at),
          target_programs: ideathon.target_programs?.length ? ideathon.target_programs : ['ALL'],
          target_batches: ideathon.target_batches?.length ? ideathon.target_batches : ['ALL'],
          tracks: ideathon.tracks?.length ? ideathon.tracks : DEFAULT_TRACKS,
          process_and_stages: ideathon.process_and_stages?.length ? ideathon.process_and_stages : DEFAULT_STAGES,
          rubrics: ideathon.rubrics?.length ? ideathon.rubrics : DEFAULT_RUBRICS,
          prizes: ideathon.prizes?.length ? ideathon.prizes : DEFAULT_PRIZES,
          rules_and_guidelines: ideathon.rules_and_guidelines?.length ? ideathon.rules_and_guidelines : DEFAULT_RULES,
          faqs: ideathon.faqs?.length ? ideathon.faqs : DEFAULT_FAQS,
          is_double_blind_screening: ideathon.is_double_blind_screening ?? true,
          is_leaderboard_published: ideathon.is_leaderboard_published ?? false,
          lead_faculty_id: ideathon.lead_faculty_id || '',
          assigned_faculty_ids: ideathon.assigned_faculty_ids || [],
        });
      } else {
        // Create mode: pre-fill standard defaults
        const now = new Date();
        const todayStr = formatForDateTimeLocal(now.toISOString());
        const regEndStr = formatForDateTimeLocal(new Date(Date.now() + 10 * 86400000).toISOString());
        const subEndStr = formatForDateTimeLocal(new Date(Date.now() + 15 * 86400000).toISOString());
        const pitchDateStr = formatForDateTimeLocal(new Date(Date.now() + 20 * 86400000).toISOString());
        const resultsDateStr = formatForDateTimeLocal(new Date(Date.now() + 22 * 86400000).toISOString());

        setFormData({
          title: '',
          theme: '',
          status: 'registration_open',
          brief: '',
          problem_statement: '',
          banner_url: '',
          min_team_size: 1,
          max_team_size: 4,
          registration_start_at: todayStr,
          registration_end_at: regEndStr,
          submission_start_at: todayStr,
          submission_end_at: subEndStr,
          presentation_date: pitchDateStr,
          results_announced_at: resultsDateStr,
          target_programs: ['ALL'],
          target_batches: ['ALL'],
          tracks: DEFAULT_TRACKS,
          process_and_stages: DEFAULT_STAGES,
          rubrics: DEFAULT_RUBRICS,
          prizes: DEFAULT_PRIZES,
          rules_and_guidelines: DEFAULT_RULES,
          faqs: DEFAULT_FAQS,
          is_double_blind_screening: true,
          is_leaderboard_published: false,
          lead_faculty_id: '',
          assigned_faculty_ids: [],
        });
      }
      setErrorMessage(null);
      setActiveTab('overview');
    }
  }, [isOpen, ideathon]);

  // Total Rubric Weightage Calculation
  const totalRubricWeight = React.useMemo(() => {
    return formData.rubrics.reduce((sum, r) => sum + (Number(r.weightage) || 0), 0);
  }, [formData.rubrics]);

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      setErrorMessage(null);
      const payload: any = {
        title: formData.title.trim(),
        theme: formData.theme.trim(),
        status: formData.status,
        brief: formData.brief.trim(),
        problem_statement: formData.problem_statement.trim(),
        banner_url: formData.banner_url || undefined,
        min_team_size: Number(formData.min_team_size),
        max_team_size: Number(formData.max_team_size),
        target_programs: formData.target_programs,
        target_batches: formData.target_batches,
        registration_start_at: formData.registration_start_at ? new Date(formData.registration_start_at).toISOString() : undefined,
        registration_end_at: formData.registration_end_at ? new Date(formData.registration_end_at).toISOString() : undefined,
        submission_start_at: formData.submission_start_at ? new Date(formData.submission_start_at).toISOString() : undefined,
        submission_end_at: formData.submission_end_at ? new Date(formData.submission_end_at).toISOString() : undefined,
        presentation_date: formData.presentation_date ? new Date(formData.presentation_date).toISOString() : undefined,
        results_announced_at: formData.results_announced_at ? new Date(formData.results_announced_at).toISOString() : undefined,
        tracks: formData.tracks,
        process_and_stages: formData.process_and_stages,
        rubrics: formData.rubrics.map((r) => ({
          ...r,
          weightage: Number(r.weightage),
          max_score: Number(r.max_score) || 10,
        })),
        prizes: formData.prizes.map((p) => ({
          ...p,
          rank: Number(p.rank),
        })),
        rules_and_guidelines: formData.rules_and_guidelines.filter((r) => r.trim().length > 0),
        faqs: formData.faqs.filter((f) => f.question.trim().length > 0),
        is_double_blind_screening: formData.is_double_blind_screening,
        is_leaderboard_published: formData.is_leaderboard_published,
        lead_faculty_id: formData.lead_faculty_id || undefined,
        assigned_faculty_ids: formData.assigned_faculty_ids,
      };

      if (isEdit) {
        const res = await api.put(`/ideathons/${ideathon.id}`, payload);
        return res.data?.data;
      } else {
        const res = await api.post('/ideathons', payload);
        return res.data?.data;
      }
    },
    onSuccess: (savedData) => {
      queryClient.invalidateQueries({ queryKey: ['ideathons'] });
      if (ideathon?.id) {
        queryClient.invalidateQueries({ queryKey: ['ideathon', ideathon.id] });
      }
      if (onSaved) onSaved(savedData);
      onClose();
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.detail || 'Failed to save competition. Please verify inputs.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.theme.trim()) {
      setErrorMessage('Competition Title and Core Theme are required.');
      setActiveTab('overview');
      return;
    }
    if (formData.min_team_size > formData.max_team_size) {
      setErrorMessage('Minimum team size cannot exceed maximum team size.');
      setActiveTab('timelines');
      return;
    }
    setErrorMessage(null);
    saveMutation.mutate();
  };

  // Cohort toggles
  const handleToggleProgram = (progCode: string) => {
    let current = [...formData.target_programs];
    if (progCode === 'ALL') {
      current = ['ALL'];
    } else {
      current = current.filter((p) => p !== 'ALL');
      if (current.includes(progCode)) {
        current = current.filter((p) => p !== progCode);
        if (current.length === 0) current = ['ALL'];
      } else {
        current.push(progCode);
      }
    }
    setFormData({ ...formData, target_programs: current });
  };

  const handleToggleBatch = (batchName: string) => {
    let current = [...formData.target_batches];
    if (batchName === 'ALL') {
      current = ['ALL'];
    } else {
      current = current.filter((b) => b !== 'ALL');
      if (current.includes(batchName)) {
        current = current.filter((b) => b !== batchName);
        if (current.length === 0) current = ['ALL'];
      } else {
        current.push(batchName);
      }
    }
    setFormData({ ...formData, target_batches: current });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
              {isEdit ? <Edit3 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {isEdit ? 'Configure Competition Details' : 'Launch New Innovation Challenge'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isEdit ? 'Update theme, criteria, tracks, rubrics, and dates' : 'Set up challenge scope, timelines, scoring criteria, and prizes'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto text-xs font-semibold shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-2 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>Overview & Scope</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('timelines')}
            className={`px-3 py-2 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'timelines'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Timelines & Eligibility</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tracks')}
            className={`px-3 py-2 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'tracks'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Innovation Tracks ({formData.tracks.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('stages')}
            className={`px-3 py-2 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'stages'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Stages & Process ({formData.process_and_stages.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rubrics')}
            className={`px-3 py-2 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'rubrics'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Jury Rubrics ({totalRubricWeight}%)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('prizes')}
            className={`px-3 py-2 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'prizes'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Prizes ({formData.prizes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rules_faqs')}
            className={`px-3 py-2 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'rules_faqs'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Rules & FAQs</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-2 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'settings'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TAB 1: OVERVIEW & SCOPE */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Competition Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. HyperBuild AI & Enterprise Innovation Ideathon 2026"
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Core Theme *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.theme}
                    onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
                    placeholder="e.g. Next-Gen Enterprise AI & Workflow Automation"
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Lifecycle Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="draft">Draft (Hidden from students)</option>
                    <option value="registration_open">Registration Open</option>
                    <option value="submission_open">Submission Open</option>
                    <option value="evaluation">Jury Evaluation Active</option>
                    <option value="presentation">Presentation & Pitch Day</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Banner / Graphic URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={formData.banner_url}
                    onChange={(e) => setFormData({ ...formData, banner_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Executive Brief & Objective
                </label>
                <textarea
                  rows={3}
                  value={formData.brief}
                  onChange={(e) => setFormData({ ...formData, brief: e.target.value })}
                  placeholder="Summarize the core innovation challenge, target outcomes, and scope..."
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500 leading-relaxed"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Core Problem Statement & Detailed Scope
                </label>
                <textarea
                  rows={4}
                  value={formData.problem_statement}
                  onChange={(e) => setFormData({ ...formData, problem_statement: e.target.value })}
                  placeholder="Detail the verified market friction, institutional or consumer pain point to be addressed..."
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500 leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* TAB 2: TIMELINES & ELIGIBILITY */}
          {activeTab === 'timelines' && (
            <div className="space-y-6">
              {/* Target Programs */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-cyan-500" />
                  Target Programs
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleProgram('ALL')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      formData.target_programs.includes('ALL')
                        ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-700 dark:text-cyan-300'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {formData.target_programs.includes('ALL') ? <CheckSquare className="w-3.5 h-3.5 text-cyan-500" /> : <Square className="w-3.5 h-3.5" />}
                    <span>All Programs (PGDM, GMBA, BBA, HMCT)</span>
                  </button>

                  {(programs.length > 0 ? programs.map((p) => p.code || p.name) : ['PGDM', 'GMBA', 'BBA', 'HMCT']).map((p) => {
                    const isSelected = formData.target_programs.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handleToggleProgram(p)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-700 dark:text-cyan-300'
                            : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-cyan-500" /> : <Square className="w-3.5 h-3.5" />}
                        <span>{p}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target Batches */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-cyan-500" />
                  Target Batches
                </label>
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleToggleBatch('ALL')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      formData.target_batches.includes('ALL')
                        ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-700 dark:text-cyan-300'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {formData.target_batches.includes('ALL') ? <CheckSquare className="w-3.5 h-3.5 text-cyan-500" /> : <Square className="w-3.5 h-3.5" />}
                    <span>All Active Batches</span>
                  </button>

                  {batches.map((b) => {
                    const isSelected = formData.target_batches.includes(b.name);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => handleToggleBatch(b.name)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-700 dark:text-cyan-300'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-cyan-500" /> : <Square className="w-3.5 h-3.5" />}
                        <span>{b.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Team Size Limits */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Minimum Team Size (1 for solo)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={formData.min_team_size}
                    onChange={(e) => setFormData({ ...formData, min_team_size: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Maximum Team Size
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={formData.max_team_size}
                    onChange={(e) => setFormData({ ...formData, max_team_size: parseInt(e.target.value) || 4 })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Lifecycle Timelines */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Key Milestones & Dates</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Registration Opens</label>
                    <input
                      type="datetime-local"
                      value={formData.registration_start_at}
                      onChange={(e) => setFormData({ ...formData, registration_start_at: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400">Registration Deadline (Date & Time) *</label>
                    <input
                      type="datetime-local"
                      value={formData.registration_end_at}
                      onChange={(e) => setFormData({ ...formData, registration_end_at: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border-2 border-cyan-500/40 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-cyan-500"
                    />
                    <p className="text-[10px] text-slate-400">Strict cutoff. No registrations or joins allowed after this time.</p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Submission Opens</label>
                    <input
                      type="datetime-local"
                      value={formData.submission_start_at}
                      onChange={(e) => setFormData({ ...formData, submission_start_at: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Submission Due Date & Time</label>
                    <input
                      type="datetime-local"
                      value={formData.submission_end_at}
                      onChange={(e) => setFormData({ ...formData, submission_end_at: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Pitch & Presentation Day</label>
                    <input
                      type="datetime-local"
                      value={formData.presentation_date}
                      onChange={(e) => setFormData({ ...formData, presentation_date: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Results Announcement</label>
                    <input
                      type="datetime-local"
                      value={formData.results_announced_at}
                      onChange={(e) => setFormData({ ...formData, results_announced_at: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: INNOVATION TRACKS */}
          {activeTab === 'tracks' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Innovation Tracks
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Tracks allow students to categorize their venture (e.g., FinTech, EdTech, HealthTech).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const id = `track_${Date.now()}`;
                    setFormData({
                      ...formData,
                      tracks: [...formData.tracks, { id, name: 'New Track', description: '' }],
                    });
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 text-xs font-semibold hover:bg-cyan-500/20 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Track</span>
                </button>
              </div>

              <div className="space-y-3">
                {formData.tracks.map((track, idx) => (
                  <div
                    key={track.id || idx}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-500 text-[11px]">Track #{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = formData.tracks.filter((_, i) => i !== idx);
                          setFormData({ ...formData, tracks: updated });
                        }}
                        className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                        title="Delete track"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Track Name *</label>
                        <input
                          type="text"
                          required
                          value={track.name}
                          onChange={(e) => {
                            const updated = [...formData.tracks];
                            updated[idx].name = e.target.value;
                            setFormData({ ...formData, tracks: updated });
                          }}
                          placeholder="e.g. FinTech & WealthOps"
                          className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Identifier Slug</label>
                        <input
                          type="text"
                          value={track.id}
                          onChange={(e) => {
                            const updated = [...formData.tracks];
                            updated[idx].id = e.target.value.toLowerCase().replace(/\s+/g, '_');
                            setFormData({ ...formData, tracks: updated });
                          }}
                          placeholder="e.g. fintech"
                          className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Description</label>
                      <input
                        type="text"
                        value={track.description || ''}
                        onChange={(e) => {
                          const updated = [...formData.tracks];
                          updated[idx].description = e.target.value;
                          setFormData({ ...formData, tracks: updated });
                        }}
                        placeholder="Brief summary of what this track encompasses..."
                        className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: STAGES & PROCESS */}
          {activeTab === 'stages' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Competition Stages & Progression
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Define the journey steps shown on the competition timeline.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const id = `stage_${Date.now()}`;
                    setFormData({
                      ...formData,
                      process_and_stages: [
                        ...formData.process_and_stages,
                        { id, title: 'New Stage', description: '', date_label: `Phase ${formData.process_and_stages.length + 1}` },
                      ],
                    });
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 text-xs font-semibold hover:bg-cyan-500/20 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Stage</span>
                </button>
              </div>

              <div className="space-y-3">
                {formData.process_and_stages.map((stage, idx) => (
                  <div
                    key={stage.id || idx}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 font-bold flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">Stage #{idx + 1}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = formData.process_and_stages.filter((_, i) => i !== idx);
                          setFormData({ ...formData, process_and_stages: updated });
                        }}
                        className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                        title="Delete stage"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Stage Title *</label>
                        <input
                          type="text"
                          required
                          value={stage.title}
                          onChange={(e) => {
                            const updated = [...formData.process_and_stages];
                            updated[idx].title = e.target.value;
                            setFormData({ ...formData, process_and_stages: updated });
                          }}
                          placeholder="e.g. Idea Screening"
                          className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Phase / Date Label</label>
                        <input
                          type="text"
                          value={stage.date_label || ''}
                          onChange={(e) => {
                            const updated = [...formData.process_and_stages];
                            updated[idx].date_label = e.target.value;
                            setFormData({ ...formData, process_and_stages: updated });
                          }}
                          placeholder="e.g. Phase 2 or Oct 15 - Oct 20"
                          className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Description</label>
                      <input
                        type="text"
                        value={stage.description || ''}
                        onChange={(e) => {
                          const updated = [...formData.process_and_stages];
                          updated[idx].description = e.target.value;
                          setFormData({ ...formData, process_and_stages: updated });
                        }}
                        placeholder="What participants are expected to achieve during this stage..."
                        className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: SCORING RUBRICS */}
          {activeTab === 'rubrics' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Jury Scoring Rubrics
                    </h4>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        totalRubricWeight === 100
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      Total Weight: {totalRubricWeight}% {totalRubricWeight === 100 ? '(Balanced)' : '(Recommended: 100%)'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Rubrics are used by jury members in the evaluation dashboard to grade submissions.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const id = `rubric_${Date.now()}`;
                    setFormData({
                      ...formData,
                      rubrics: [
                        ...formData.rubrics,
                        { id, name: 'New Criterion', weightage: 20, max_score: 10, description: '' },
                      ],
                    });
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 text-xs font-semibold hover:bg-cyan-500/20 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Rubric</span>
                </button>
              </div>

              <div className="space-y-3">
                {formData.rubrics.map((rubric, idx) => (
                  <div
                    key={rubric.id || idx}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-700 dark:text-slate-300">Criterion #{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = formData.rubrics.filter((_, i) => i !== idx);
                          setFormData({ ...formData, rubrics: updated });
                        }}
                        className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                        title="Delete rubric"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-6 space-y-1">
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Criterion Name *</label>
                        <input
                          type="text"
                          required
                          value={rubric.name}
                          onChange={(e) => {
                            const updated = [...formData.rubrics];
                            updated[idx].name = e.target.value;
                            setFormData({ ...formData, rubrics: updated });
                          }}
                          placeholder="e.g. Market Dynamics & Research Depth"
                          className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                        />
                      </div>

                      <div className="sm:col-span-3 space-y-1">
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Weightage (%) *</label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={rubric.weightage}
                          onChange={(e) => {
                            const updated = [...formData.rubrics];
                            updated[idx].weightage = parseFloat(e.target.value) || 0;
                            setFormData({ ...formData, rubrics: updated });
                          }}
                          className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
                        />
                      </div>

                      <div className="sm:col-span-3 space-y-1">
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Max Score</label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={rubric.max_score || 10}
                          onChange={(e) => {
                            const updated = [...formData.rubrics];
                            updated[idx].max_score = parseFloat(e.target.value) || 10;
                            setFormData({ ...formData, rubrics: updated });
                          }}
                          className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Evaluation Guideline / Description</label>
                      <input
                        type="text"
                        value={rubric.description || ''}
                        onChange={(e) => {
                          const updated = [...formData.rubrics];
                          updated[idx].description = e.target.value;
                          setFormData({ ...formData, rubrics: updated });
                        }}
                        placeholder="What criteria should the jury evaluate (e.g. data citations, TAM sizing)..."
                        className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: PRIZES & AWARDS */}
          {activeTab === 'prizes' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Podium Prizes & Incentives
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Displayed on competition cards and used in the Grand Leaderboard.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextRank = formData.prizes.length + 1;
                    setFormData({
                      ...formData,
                      prizes: [
                        ...formData.prizes,
                        { rank: nextRank, title: `Rank ${nextRank}`, reward: 'Cash prize & Incubation' },
                      ],
                    });
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 text-xs font-semibold hover:bg-cyan-500/20 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Prize</span>
                </button>
              </div>

              <div className="space-y-3">
                {formData.prizes.map((prize, idx) => (
                  <div
                    key={prize.rank || idx}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-amber-500" />
                        <span className="font-bold text-slate-700 dark:text-slate-300">Podium Position #{prize.rank}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = formData.prizes.filter((_, i) => i !== idx);
                          setFormData({ ...formData, prizes: updated });
                        }}
                        className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                        title="Delete prize"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-3 space-y-1">
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Rank #</label>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={prize.rank}
                          onChange={(e) => {
                            const updated = [...formData.prizes];
                            updated[idx].rank = parseInt(e.target.value) || (idx + 1);
                            setFormData({ ...formData, prizes: updated });
                          }}
                          className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
                        />
                      </div>

                      <div className="sm:col-span-4 space-y-1">
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Prize Title *</label>
                        <input
                          type="text"
                          required
                          value={prize.title}
                          onChange={(e) => {
                            const updated = [...formData.prizes];
                            updated[idx].title = e.target.value;
                            setFormData({ ...formData, prizes: updated });
                          }}
                          placeholder="e.g. Grand Winner (Gold)"
                          className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                        />
                      </div>

                      <div className="sm:col-span-5 space-y-1">
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Reward / Perks *</label>
                        <input
                          type="text"
                          required
                          value={prize.reward}
                          onChange={(e) => {
                            const updated = [...formData.prizes];
                            updated[idx].reward = e.target.value;
                            setFormData({ ...formData, prizes: updated });
                          }}
                          placeholder="e.g. ₹50,000 Cash + Direct Incubation"
                          className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 7: RULES & FAQS */}
          {activeTab === 'rules_faqs' && (
            <div className="space-y-6">
              {/* Rules List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Rules & Guidelines
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        rules_and_guidelines: [...formData.rules_and_guidelines, ''],
                      });
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 text-xs font-semibold hover:bg-cyan-500/20 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Rule</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {formData.rules_and_guidelines.map((rule, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs font-bold w-5 text-right">{idx + 1}.</span>
                      <input
                        type="text"
                        value={rule}
                        onChange={(e) => {
                          const updated = [...formData.rules_and_guidelines];
                          updated[idx] = e.target.value;
                          setFormData({ ...formData, rules_and_guidelines: updated });
                        }}
                        placeholder="Enter guideline or eligibility rule..."
                        className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = formData.rules_and_guidelines.filter((_, i) => i !== idx);
                          setFormData({ ...formData, rules_and_guidelines: updated });
                        }}
                        className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* FAQs */}
              <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Frequently Asked Questions (FAQs)
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        faqs: [...formData.faqs, { question: '', answer: '' }],
                      });
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 text-xs font-semibold hover:bg-cyan-500/20 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add FAQ</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {formData.faqs.map((faq, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-700 dark:text-slate-300">Question #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = formData.faqs.filter((_, i) => i !== idx);
                            setFormData({ ...formData, faqs: updated });
                          }}
                          className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <input
                        type="text"
                        value={faq.question}
                        onChange={(e) => {
                          const updated = [...formData.faqs];
                          updated[idx].question = e.target.value;
                          setFormData({ ...formData, faqs: updated });
                        }}
                        placeholder="e.g. Can we change our team members after registering?"
                        className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-semibold"
                      />

                      <textarea
                        rows={2}
                        value={faq.answer}
                        onChange={(e) => {
                          const updated = [...formData.faqs];
                          updated[idx].answer = e.target.value;
                          setFormData({ ...formData, faqs: updated });
                        }}
                        placeholder="Provide clear answer for students..."
                        className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: EVALUATION SETTINGS & FACULTY GOVERNANCE */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              {/* Faculty Leadership & Mentorship */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-cyan-500" />
                    Faculty Leadership & Mentorship Panel
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Designate a primary Lead Faculty (Internal or External) and select a faculty group / coordinators to oversee this competition.
                  </p>
                </div>

                {/* Lead Faculty Dropdown */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Lead Faculty (Internal / External)
                  </label>
                  <select
                    value={formData.lead_faculty_id}
                    onChange={(e) => setFormData({ ...formData, lead_faculty_id: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="">-- No Lead Faculty Assigned --</option>
                    {faculties.map((f: any) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.type} Faculty) — {f.email}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Assigned Faculty Group (Multiselect) */}
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Assigned Faculty Group / Mentors (Multiselect)
                    </label>
                    <span className="text-[11px] font-semibold text-cyan-600 dark:text-cyan-400">
                      {formData.assigned_faculty_ids.length} faculty selected
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                    {faculties.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-400">Loading faculty list...</div>
                    ) : (
                      faculties.map((f: any) => {
                        const isChecked = formData.assigned_faculty_ids.includes(f.id);
                        return (
                          <label
                            key={f.id}
                            className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                              isChecked
                                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-900 dark:text-cyan-200 font-semibold'
                                : 'bg-transparent border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-700/30 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFormData({
                                      ...formData,
                                      assigned_faculty_ids: [...formData.assigned_faculty_ids, f.id],
                                    });
                                  } else {
                                    setFormData({
                                      ...formData,
                                      assigned_faculty_ids: formData.assigned_faculty_ids.filter((id) => id !== f.id),
                                    });
                                  }
                                }}
                                className="w-3.5 h-3.5 rounded text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                              />
                              <div>
                                <span className="font-medium text-slate-800 dark:text-slate-200">{f.name}</span>
                                <span className="ml-1.5 text-[10px] text-slate-400">({f.email})</span>
                              </div>
                            </div>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                              {f.type}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Evaluation Controls */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <label className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Double-Blind Screening Mode
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      When enabled, jury members will not see student names, roll numbers, or batch identifiers during preliminary idea evaluation, preventing bias.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.is_double_blind_screening}
                    onChange={(e) => setFormData({ ...formData, is_double_blind_screening: e.target.checked })}
                    className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 mt-1 cursor-pointer"
                  />
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <label className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Publish Grand Leaderboard & Podium
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Make the podium rankings, scores, and digital certificates visible publicly to all students and faculty.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.is_leaderboard_published}
                    onChange={(e) => setFormData({ ...formData, is_leaderboard_published: e.target.checked })}
                    className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 mt-1 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800 shrink-0">
            <div className="text-[11px] text-slate-400">
              * Required fields. All sections can be edited anytime.
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
                type="submit"
                disabled={saveMutation.isPending || !formData.title.trim()}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saveMutation.isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Launch Competition'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
