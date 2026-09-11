import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Rocket,
  ArrowLeft,
  Save,
  CheckCircle2,
  Sparkles,
  BarChart2,
  Target,
  Lightbulb,
  Cpu,
  Video,
  Layers,
  FileCheck,
  AlertCircle,
} from 'lucide-react';
import { api } from '../../lib/api';



export const IdeaSubmissionWorkspace: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [saveToast, setSaveToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    tagline: '',
    track_id: '',
    executive_summary: '',
    market_dynamics: '',
    market_gap: '',
    proposed_solution: '',
    target_audience: '',
    competitive_moat: '',
    hyperbuild_stack: {
      frontend: '',
      backend: '',
      automation: '',
      ai: '',
      architecture_notes: '',
    } as any,
    pitch_deck_url: '',
    demo_video_url: '',
    prototype_url: '',
  });

  // Fetch Ideathon
  const { data: ideathon } = useQuery<any>({
    queryKey: ['ideathon', id],
    queryFn: async () => {
      const res = await api.get(`/ideathons/${id}`);
      return res.data?.data;
    },
    enabled: !!id,
  });

  // Fetch My Team & Submission
  const { data: myTeam } = useQuery<any>({
    queryKey: ['ideathon-my-team', id],
    queryFn: async () => {
      const res = await api.get(`/ideathons/${id}/my-team`);
      return res.data?.data;
    },
    enabled: !!id,
  });

  // Fetch Existing Submission
  const { data: existingSub } = useQuery<any>({
    queryKey: ['ideathon-submission', id, myTeam?.submission_id],
    queryFn: async () => {
      if (!myTeam?.submission_id) return null;
      const res = await api.get(`/ideathons/${id}/submissions/${myTeam.submission_id}`);
      return res.data?.data;
    },
    enabled: !!id && !!myTeam?.submission_id,
  });

  // Populate data when existing submission is loaded
  useEffect(() => {
    if (existingSub) {
      setFormData({
        title: existingSub.title || '',
        tagline: existingSub.tagline || '',
        track_id: existingSub.track_id || '',
        executive_summary: existingSub.executive_summary || '',
        market_dynamics: existingSub.market_dynamics || '',
        market_gap: existingSub.market_gap || '',
        proposed_solution: existingSub.proposed_solution || '',
        target_audience: existingSub.target_audience || '',
        competitive_moat: existingSub.competitive_moat || '',
        hyperbuild_stack: existingSub.hyperbuild_stack || {
          frontend: '',
          backend: '',
          automation: '',
          ai: '',
          architecture_notes: '',
        },
        pitch_deck_url: existingSub.pitch_deck_url || '',
        demo_video_url: existingSub.demo_video_url || '',
        prototype_url: existingSub.prototype_url || '',
      });
    } else if (myTeam) {
      setFormData((prev) => ({
        ...prev,
        title: prev.title || myTeam.name || '',
        track_id: prev.track_id || myTeam.track_id || '',
      }));
    }
  }, [existingSub, myTeam]);

  // Submit Mutation
  const submitMutation = useMutation({
    mutationFn: async (isFinal: boolean) => {
      const payload = {
        ...formData,
        status: isFinal ? 'submitted' : 'draft',
      };
      const res = await api.post(`/ideathons/${id}/submissions`, payload);
      return res.data?.data;
    },
    onSuccess: (_, isFinal) => {
      queryClient.invalidateQueries({ queryKey: ['ideathon-my-team', id] });
      queryClient.invalidateQueries({ queryKey: ['ideathon-submission', id] });
      setSaveToast({
        type: 'success',
        message: isFinal ? 'Venture proposal successfully submitted for jury review!' : 'Draft saved successfully.',
      });
      setTimeout(() => setSaveToast(null), 3500);

      if (isFinal) {
        navigate(`/ideathons/${id}`);
      }
    },
    onError: (err: any) => {
      setSaveToast({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to save submission. Please check inputs.',
      });
      setTimeout(() => setSaveToast(null), 4000);
    },
  });

  const isSubmitted = existingSub?.status === 'submitted';

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header Bar */}
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
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                5-Pillar Idea Submission Workspace
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Team: <strong className="text-cyan-600 dark:text-cyan-400">{myTeam?.name || 'Your Team'}</strong> • {ideathon?.title || 'Ideathon'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => submitMutation.mutate(false)}
            disabled={submitMutation.isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{submitMutation.isPending ? 'Saving...' : 'Save Draft'}</span>
          </button>

          <button
            onClick={() => submitMutation.mutate(true)}
            disabled={submitMutation.isPending || !formData.title || !formData.tagline}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSubmitted ? 'Update Submission' : 'Submit Final Proposal'}</span>
          </button>
        </div>
      </div>

      {/* Save Notification Toast */}
      {saveToast && (
        <div
          className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between shadow-xs ${
            saveToast.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
          }`}
        >
          <span className="flex items-center gap-2">
            {saveToast.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-rose-500" />}
            <strong>{saveToast.message}</strong>
          </span>
          <button onClick={() => setSaveToast(null)} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
      )}

      {/* 5-Step Stepper Navigation */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-semibold">
        {[
          { num: 1, label: 'Market Research', icon: BarChart2 },
          { num: 2, label: 'Market Gap', icon: Target },
          { num: 3, label: 'Solution & UVP', icon: Lightbulb },
          { num: 4, label: 'Tech Plan', icon: Cpu },
          { num: 5, label: 'Pitch Media', icon: Video },
        ].map((s) => {
          const Icon = s.icon;
          const isActive = currentStep === s.num;
          return (
            <button
              key={s.num}
              onClick={() => setCurrentStep(s.num as any)}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all cursor-pointer ${
                isActive
                  ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-xs border border-slate-200 dark:border-slate-700'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* STEP CONTENT CONTAINER */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
        {/* STEP 1: Market Dynamics & Industry Research */}
        {currentStep === 1 && (
          <div className="space-y-5">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 text-xs font-bold uppercase tracking-wider">
                <BarChart2 className="w-4 h-4" /> Pillar 1 of 5
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                Market Dynamics & Industry Research
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Analyze macro industry trends, calculate market sizing (TAM/SAM/SOM), and document existing solutions.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Venture / Solution Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Omnichannel Procurement Bot"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">One-Line Tagline *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Autonomous invoice matching and reconciliation for mid-market suppliers"
                  value={formData.tagline}
                  onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Executive Summary</label>
              <textarea
                rows={3}
                placeholder="High-level synthesis of your proposed innovation and why it matters..."
                value={formData.executive_summary}
                onChange={(e) => setFormData({ ...formData, executive_summary: e.target.value })}
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500 leading-relaxed"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Comprehensive Market Research & Macro Dynamics *
                </label>
                <span className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 font-mono">25% Rubric Weight</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Detail market growth rates, industry headwinds, market sizing estimates, and cite secondary sources or reports.
              </p>
              <textarea
                rows={6}
                placeholder="e.g. In India alone, SME procurement faces 32% order discrepancy due to legacy ERPs. The domestic B2B commerce market stands at $1.1T with a 24% CAGR..."
                value={formData.market_dynamics}
                onChange={(e) => setFormData({ ...formData, market_dynamics: e.target.value })}
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500 leading-relaxed"
              />
            </div>
          </div>
        )}

        {/* STEP 2: Market Gap Identification */}
        {currentStep === 2 && (
          <div className="space-y-5">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 text-xs font-bold uppercase tracking-wider">
                <Target className="w-4 h-4" /> Pillar 2 of 5
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                Market Gap & Problem Validation
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Pinpoint the exact underserved customer pain point and explain why current incumbent tools fail.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Precise Market Gap Identified *
                </label>
                <span className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 font-mono">25% Rubric Weight</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                What is the specific missing link? Why are customers currently underserved or paying for fragmented workarounds?
              </p>
              <textarea
                rows={5}
                placeholder="Describe the concrete gap. Include any user interviews, surveys, or observed operational breakdowns..."
                value={formData.market_gap}
                onChange={(e) => setFormData({ ...formData, market_gap: e.target.value })}
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500 leading-relaxed"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Target User Personas & Demographics</label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Who experiences this pain most intensely? (e.g. Junior Procurement Officers in mid-sized manufacturing firms)
              </p>
              <textarea
                rows={3}
                placeholder="Persona 1: Primary decision maker. Persona 2: Daily operational user..."
                value={formData.target_audience}
                onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500 leading-relaxed"
              />
            </div>
          </div>
        )}

        {/* STEP 3: Proposed Solution & UVP */}
        {currentStep === 3 && (
          <div className="space-y-5">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 text-xs font-bold uppercase tracking-wider">
                <Lightbulb className="w-4 h-4" /> Pillar 3 of 5
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                Proposed Solution & Unique Value Proposition
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Explain your product mechanics, step-by-step user journey, and defensive competitive advantages.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Proposed Solution Mechanics & User Journey *
                </label>
                <span className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 font-mono">20% Rubric Weight</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                How does the application work from the moment a user signs up to the realization of core value?
              </p>
              <textarea
                rows={5}
                placeholder="Describe the end-to-end user workflow: Input -> Processing & Logic -> Output & Delighted outcome..."
                value={formData.proposed_solution}
                onChange={(e) => setFormData({ ...formData, proposed_solution: e.target.value })}
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500 leading-relaxed"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Unique Value Proposition (UVP) & Defensible Moat
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Why will users choose your solution over competitors? What stops competitors from easily replicating it?
              </p>
              <textarea
                rows={4}
                placeholder="e.g. 10x faster invoice turnaround with 99.4% OCR verification accuracy via proprietary multi-modal prompt cascades..."
                value={formData.competitive_moat}
                onChange={(e) => setFormData({ ...formData, competitive_moat: e.target.value })}
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500 leading-relaxed"
              />
            </div>
          </div>
        )}

        {/* STEP 4: HyperBuild No-Code Tech Stack */}
        {currentStep === 4 && (
          <div className="space-y-5">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 text-xs font-bold uppercase tracking-wider">
                <Cpu className="w-4 h-4" /> Pillar 4 of 5
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                Technical Implementation Plan
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Describe in detail how you will technically implement your solution. For each section below, explain the specific tools, technologies, languages, or platforms you plan to use and why they are the right choice for your idea.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Frontend */}
              <div className="space-y-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-cyan-500" />
                  Frontend / Mobile Client
                </label>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  What framework, language, or platform will you use to build the user interface? Describe the screens, navigation flow, and how users will interact with your solution.
                </p>
                <textarea
                  rows={4}
                  placeholder="e.g. We will build a React Native app using Expo. The app will have three main screens: a dashboard, a submission form, and a profile page. We chose React Native because our team is familiar with JavaScript and it supports both iOS and Android from a single codebase..."
                  value={formData.hyperbuild_stack.frontend}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      hyperbuild_stack: { ...formData.hyperbuild_stack, frontend: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500 leading-relaxed resize-none"
                />
              </div>

              {/* Backend */}
              <div className="space-y-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-indigo-500" />
                  Database, Backend & Auth
                </label>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  How will you store and manage data? Describe your database structure, backend logic, and how you will handle user authentication and access control.
                </p>
                <textarea
                  rows={4}
                  placeholder="e.g. We will use Firebase Firestore as our database because it provides real-time sync. Authentication will be handled via Firebase Auth with Google Sign-In. Our data model will have three collections: users, reports, and alerts. Access rules will restrict students from viewing other students' data..."
                  value={formData.hyperbuild_stack.backend}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      hyperbuild_stack: { ...formData.hyperbuild_stack, backend: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500 leading-relaxed resize-none"
                />
              </div>

              {/* Automation */}
              <div className="space-y-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Workflow Automation & Integrations
                </label>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  What automations, APIs, or third-party integrations will power your solution? Describe triggers, actions, and how data moves between services.
                </p>
                <textarea
                  rows={4}
                  placeholder="e.g. When a user submits a report, a Cloud Function will automatically send a WhatsApp notification to the assigned coordinator via the Twilio API. We will also integrate Google Maps API to show location data. Scheduled jobs will generate nightly summary emails via SendGrid..."
                  value={formData.hyperbuild_stack.automation}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      hyperbuild_stack: { ...formData.hyperbuild_stack, automation: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500 leading-relaxed resize-none"
                />
              </div>

              {/* AI */}
              <div className="space-y-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <FileCheck className="w-3.5 h-3.5 text-emerald-500" />
                  AI / ML & Intelligence Layer
                </label>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Will your solution use AI or machine learning? Describe what the AI does, which model or API you will use, and how it improves your solution. If not applicable, write N/A and explain why.
                </p>
                <textarea
                  rows={4}
                  placeholder="e.g. We will use the Google Gemini API to analyse uploaded images and classify damage severity automatically. The model will be prompted with structured context about the product category. This reduces manual review time from 2 hours to under 5 minutes..."
                  value={formData.hyperbuild_stack.ai}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      hyperbuild_stack: { ...formData.hyperbuild_stack, ai: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500 leading-relaxed resize-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                End-to-End Data Flow & Architecture
              </label>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Describe the complete journey of data through your system — from the moment a user takes an action to the final output. How do all the components above connect together?
              </p>
              <textarea
                rows={4}
                placeholder="e.g. A student opens the app (React Native) → logs in via Firebase Auth → submits a report → the data is saved in Firestore → a Cloud Function triggers → sends a WhatsApp alert to the coordinator via Twilio → the coordinator logs in via the web dashboard → views a Gemini-generated summary of the report..."
                value={formData.hyperbuild_stack.architecture_notes}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    hyperbuild_stack: { ...formData.hyperbuild_stack, architecture_notes: e.target.value },
                  })
                }
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500 leading-relaxed"
              />
            </div>
          </div>
        )}

        {/* STEP 5: Pitch Media & External Demos */}
        {currentStep === 5 && (
          <div className="space-y-5">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 text-xs font-bold uppercase tracking-wider">
                <Video className="w-4 h-4" /> Pillar 5 of 5
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                Pitch Deck, Video Demo & Prototype
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Attach your presentation slides, loom video walkthrough, or deployed sandbox prototype for jury screening.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Pitch Deck URL (Google Slides / Canva / PDF link)
                </label>
                <input
                  type="url"
                  placeholder="https://docs.google.com/presentation/d/..."
                  value={formData.pitch_deck_url}
                  onChange={(e) => setFormData({ ...formData, pitch_deck_url: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Pitch Video Walkthrough (Loom / YouTube / Drive link)
                </label>
                <input
                  type="url"
                  placeholder="https://www.loom.com/share/..."
                  value={formData.demo_video_url}
                  onChange={(e) => setFormData({ ...formData, demo_video_url: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Live Interactive Prototype / MVP URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://app.flutterflow.io/run/... or https://your-demo.web.app"
                  value={formData.prototype_url}
                  onChange={(e) => setFormData({ ...formData, prototype_url: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Stepper Footer Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            disabled={currentStep === 1}
            onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1) as any)}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-30 cursor-pointer"
          >
            ← Previous Pillar
          </button>

          <div className="flex items-center gap-2">
            {currentStep < 5 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => Math.min(5, prev + 1) as any)}
                className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold transition-opacity hover:opacity-90 cursor-pointer shadow-xs"
              >
                Next Pillar →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => submitMutation.mutate(true)}
                disabled={submitMutation.isPending || !formData.title || !formData.tagline}
                className="inline-flex items-center gap-1.5 px-6 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitted ? 'Update Submission' : 'Submit Final Proposal'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
