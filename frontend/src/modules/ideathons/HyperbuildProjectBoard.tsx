import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Rocket,
  ArrowLeft,
  ExternalLink,
  Plus,
  Cpu,
  Edit,
  Globe,
  MessageSquare,
  Layers,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useRoleAccess } from '../../lib/useRoleAccess';

export const HyperbuildProjectBoard: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, isCoordinator, isFacultyInternal } = useRoleAccess();
  const isFacultyOrAdmin = isAdmin || isCoordinator || isFacultyInternal;

  const [activeMilestoneId, setActiveMilestoneId] = useState<string | null>(null);
  const [isToolLinksModalOpen, setIsToolLinksModalOpen] = useState(false);
  const [isAddMilestoneModalOpen, setIsAddMilestoneModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Tool links edit state
  const [toolLinksForm, setToolLinksForm] = useState({
    flutterflow_url: '',
    supabase_url: '',
    make_url: '',
    figma_url: '',
    deployed_app_url: '',
  });

  // Add milestone state
  const [newMilestoneForm, setNewMilestoneForm] = useState({
    title: '',
    description: '',
    order_index: 5,
  });

  // Submit deliverable state
  const [deliverableForm, setDeliverableForm] = useState({
    submission_notes: '',
    deliverable_urls: '',
    status: 'submitted',
  });

  // Faculty review state
  const [reviewForm, setReviewForm] = useState({
    status: 'approved',
    review_feedback: '',
  });

  // Fetch Project Details
  const { data: project, isLoading } = useQuery<any>({
    queryKey: ['incubated-project', projectId],
    queryFn: async () => {
      const res = await api.get(`/ideathons/incubated-projects/${projectId}`);
      return res.data?.data;
    },
    enabled: !!projectId,
  });

  React.useEffect(() => {
    if (project) {
      setToolLinksForm({
        flutterflow_url: project.tool_links?.flutterflow_url || '',
        supabase_url: project.tool_links?.supabase_url || '',
        make_url: project.tool_links?.make_url || '',
        figma_url: project.tool_links?.figma_url || '',
        deployed_app_url: project.tool_links?.deployed_app_url || '',
      });
      if (project.milestones && project.milestones.length > 0 && !activeMilestoneId) {
        setActiveMilestoneId(project.milestones[0].id);
      }
    }
  }, [project]);

  // Update Project Links Mutation
  const updateProjectMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.put(`/ideathons/incubated-projects/${projectId}`, payload);
      return res.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incubated-project', projectId] });
      setIsToolLinksModalOpen(false);
      setToastMessage('Toolchain links updated successfully!');
      setTimeout(() => setToastMessage(null), 3000);
    },
  });

  // Add Custom Milestone Mutation
  const addMilestoneMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post(`/ideathons/incubated-projects/${projectId}/milestones`, payload);
      return res.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incubated-project', projectId] });
      setIsAddMilestoneModalOpen(false);
      setNewMilestoneForm({ title: '', description: '', order_index: (project?.milestones?.length || 4) + 1 });
      setToastMessage('Custom sprint milestone added successfully!');
      setTimeout(() => setToastMessage(null), 3000);
    },
  });

  // Submit Deliverable Mutation
  const submitDeliverableMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.put(`/ideathons/incubated-projects/milestones/${activeMilestoneId}`, payload);
      return res.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incubated-project', projectId] });
      setToastMessage('Milestone deliverable submitted for mentor review!');
      setTimeout(() => setToastMessage(null), 3500);
    },
  });

  // Faculty Review Mutation
  const reviewMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post(`/ideathons/incubated-projects/milestones/${activeMilestoneId}/review`, payload);
      return res.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incubated-project', projectId] });
      setToastMessage('Milestone review saved successfully!');
      setTimeout(() => setToastMessage(null), 3500);
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 text-center text-slate-500 space-y-4">
        <p className="text-sm">Project not found.</p>
        <button
          onClick={() => navigate('/ideathons')}
          className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-300 text-xs font-semibold"
        >
          Back to Competitions Hub
        </button>
      </div>
    );
  }

  const milestones = project.milestones || [];
  const activeMilestone = milestones.find((m: any) => m.id === activeMilestoneId) || milestones[0];

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="space-y-1">
          <button
            onClick={() => navigate('/ideathons')}
            className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Competitions Hub</span>
          </button>

          <div className="flex items-center gap-3 pt-1">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{project.title}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                  {project.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                "{project.tagline}" • Team: <strong className="text-cyan-600 dark:text-cyan-400">{project.team_name}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsToolLinksModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Edit className="w-3.5 h-3.5 text-cyan-500" />
            <span>Workspace Links</span>
          </button>

          {isFacultyOrAdmin && (
            <button
              onClick={() => setIsAddMilestoneModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Sprint</span>
            </button>
          )}
        </div>
      </div>

      {toastMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between shadow-xs">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)}>✕</button>
        </div>
      )}

      {/* QUICK LAUNCH NO-CODE TOOLCHAIN DOCK */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-500" />
            Active HyperBuild No-Code Workspaces
          </span>
          <span className="text-[11px] text-slate-400">Click to launch toolchain</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          {/* FlutterFlow */}
          <a
            href={project.tool_links?.flutterflow_url || 'https://app.flutterflow.io'}
            target="_blank"
            rel="noreferrer"
            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-cyan-500 transition-colors flex flex-col justify-between space-y-1 group"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-cyan-600">FlutterFlow</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </div>
            <span className="text-[10px] text-slate-500">UI / Frontend Client</span>
          </a>

          {/* Supabase */}
          <a
            href={project.tool_links?.supabase_url || 'https://supabase.com'}
            target="_blank"
            rel="noreferrer"
            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-cyan-500 transition-colors flex flex-col justify-between space-y-1 group"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-cyan-600">Supabase</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </div>
            <span className="text-[10px] text-slate-500">PostgreSQL DB & Auth</span>
          </a>

          {/* Make / Automation */}
          <a
            href={project.tool_links?.make_url || 'https://make.com'}
            target="_blank"
            rel="noreferrer"
            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-cyan-500 transition-colors flex flex-col justify-between space-y-1 group"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-cyan-600">Make.com</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </div>
            <span className="text-[10px] text-slate-500">Workflow Automations</span>
          </a>

          {/* Figma */}
          <a
            href={project.tool_links?.figma_url || 'https://figma.com'}
            target="_blank"
            rel="noreferrer"
            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-cyan-500 transition-colors flex flex-col justify-between space-y-1 group"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-cyan-600">Figma</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </div>
            <span className="text-[10px] text-slate-500">UI / UX Prototype</span>
          </a>

          {/* Live Web Build */}
          <a
            href={project.tool_links?.deployed_app_url || '#'}
            target={project.tool_links?.deployed_app_url ? '_blank' : '_self'}
            rel="noreferrer"
            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-cyan-500 transition-colors flex flex-col justify-between space-y-1 group"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-cyan-600">Deployed App</span>
              <Globe className="w-3 h-3 text-slate-400" />
            </div>
            <span className="text-[10px] text-slate-500">
              {project.tool_links?.deployed_app_url ? 'Live Production URL' : 'Pending Build'}
            </span>
          </a>
        </div>
      </div>

      {/* SPRINT MILESTONES & REVIEW SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Sprints Navigation Sidebar (4 Cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
              Sprint Milestones
            </span>
            <span className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400">
              {milestones.filter((m: any) => m.status === 'approved').length} / {milestones.length} Completed
            </span>
          </div>

          <div className="space-y-2">
            {milestones.map((ms: any, idx: number) => {
              const isSelected = ms.id === activeMilestone?.id;
              const isApproved = ms.status === 'approved';
              const isSubmitted = ms.status === 'submitted';
              return (
                <div
                  key={ms.id}
                  onClick={() => setActiveMilestoneId(ms.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-1 ${
                    isSelected
                      ? 'bg-cyan-50/50 dark:bg-cyan-950/30 border-cyan-300 dark:border-cyan-700/60 shadow-xs'
                      : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono font-bold text-slate-500">Sprint #{ms.order_index || idx + 1}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isApproved
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                          : isSubmitted
                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      {ms.status.replace('_', ' ')}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug">{ms.title}</h4>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sprint Detail & Submission/Review Panel (8 Cols) */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 shadow-xs">
          {activeMilestone ? (
            <div className="space-y-6">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold uppercase text-cyan-600 dark:text-cyan-400">
                    Sprint #{activeMilestone.order_index}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Status: <strong className="text-slate-900 dark:text-slate-100 uppercase">{activeMilestone.status.replace('_', ' ')}</strong>
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{activeMilestone.title}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {activeMilestone.description}
                </p>
              </div>

              {/* Student Deliverable Submission Card */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                <h4 className="font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-cyan-500" />
                  Sprint Deliverable Submission
                </h4>

                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Deliverable URLs / Links</label>
                    <input
                      type="text"
                      placeholder="e.g. GitHub link, Figma link, or Deployed URL..."
                      value={deliverableForm.deliverable_urls || (activeMilestone.deliverable_urls || []).join(', ')}
                      onChange={(e) => setDeliverableForm({ ...deliverableForm, deliverable_urls: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Sprint Summary & Notes</label>
                    <textarea
                      rows={3}
                      placeholder="Summarize what was accomplished in this sprint..."
                      value={deliverableForm.submission_notes || activeMilestone.submission_notes || ''}
                      onChange={(e) => setDeliverableForm({ ...deliverableForm, submission_notes: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 leading-relaxed"
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        submitDeliverableMutation.mutate({
                          submission_notes: deliverableForm.submission_notes,
                          deliverable_urls: deliverableForm.deliverable_urls
                            ? deliverableForm.deliverable_urls.split(',').map((s: string) => s.trim())
                            : [],
                          status: 'submitted',
                        })
                      }
                      className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-colors cursor-pointer"
                    >
                      Submit Sprint Deliverable
                    </button>
                  </div>
                </div>
              </div>

              {/* Faculty Review Section */}
              {isFacultyOrAdmin && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
                    Faculty Mentor Review
                  </h4>

                  <div className="space-y-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Mentor Feedback</label>
                      <textarea
                        rows={2}
                        placeholder="Feedback on the sprint deliverables..."
                        value={reviewForm.review_feedback || activeMilestone.review_feedback || ''}
                        onChange={(e) => setReviewForm({ ...reviewForm, review_feedback: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <select
                        value={reviewForm.status}
                        onChange={(e) => setReviewForm({ ...reviewForm, status: e.target.value })}
                        className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                      >
                        <option value="approved">Approve Sprint</option>
                        <option value="needs_revision">Request Revision</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => reviewMutation.mutate(reviewForm)}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors cursor-pointer"
                      >
                        Save Mentor Verdict
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-8">Select a sprint to view details.</p>
          )}
        </div>
      </div>

      {/* Tool Links Edit Modal */}
      {isToolLinksModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Configure Workspace Links</h3>
              <button onClick={() => setIsToolLinksModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">FlutterFlow Project URL</label>
                <input
                  type="url"
                  value={toolLinksForm.flutterflow_url}
                  onChange={(e) => setToolLinksForm({ ...toolLinksForm, flutterflow_url: e.target.value })}
                  placeholder="https://app.flutterflow.io/..."
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Supabase Project URL</label>
                <input
                  type="url"
                  value={toolLinksForm.supabase_url}
                  onChange={(e) => setToolLinksForm({ ...toolLinksForm, supabase_url: e.target.value })}
                  placeholder="https://supabase.com/dashboard/..."
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Make.com Scenario URL</label>
                <input
                  type="url"
                  value={toolLinksForm.make_url}
                  onChange={(e) => setToolLinksForm({ ...toolLinksForm, make_url: e.target.value })}
                  placeholder="https://eu1.make.com/..."
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Figma File URL</label>
                <input
                  type="url"
                  value={toolLinksForm.figma_url}
                  onChange={(e) => setToolLinksForm({ ...toolLinksForm, figma_url: e.target.value })}
                  placeholder="https://figma.com/file/..."
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Live Production App URL</label>
                <input
                  type="url"
                  value={toolLinksForm.deployed_app_url}
                  onChange={(e) => setToolLinksForm({ ...toolLinksForm, deployed_app_url: e.target.value })}
                  placeholder="https://your-app.web.app"
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setIsToolLinksModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={() => updateProjectMutation.mutate({ tool_links: toolLinksForm })}
                className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs"
              >
                Save Links
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Milestone Modal */}
      {isAddMilestoneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Add Custom Sprint Milestone</h3>
              <button onClick={() => setIsAddMilestoneModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Sprint Title *</label>
                <input
                  type="text"
                  required
                  value={newMilestoneForm.title}
                  onChange={(e) => setNewMilestoneForm({ ...newMilestoneForm, title: e.target.value })}
                  placeholder="e.g. Sprint 5: Payment Gateway & Settlement Sandbox"
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Objectives & Deliverables</label>
                <textarea
                  rows={3}
                  value={newMilestoneForm.description}
                  onChange={(e) => setNewMilestoneForm({ ...newMilestoneForm, description: e.target.value })}
                  placeholder="Detailed goals for this incubation sprint..."
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setIsAddMilestoneModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={() => addMilestoneMutation.mutate(newMilestoneForm)}
                className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs"
              >
                Add Sprint
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
