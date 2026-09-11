import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Edit3,
  X,
  Save,
  CheckSquare,
  Square,
  AlertCircle,
  GraduationCap,
  Calendar,
} from 'lucide-react';
import { api } from '../../lib/api';

interface IdeathonEditModalProps {
  ideathon: any | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
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

export const IdeathonEditModal: React.FC<IdeathonEditModalProps> = ({
  ideathon,
  isOpen,
  onClose,
  onSaved,
}) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    title: '',
    theme: '',
    status: 'draft',
    brief: '',
    problem_statement: '',
    min_team_size: 1,
    max_team_size: 4,
    registration_start_at: '',
    registration_end_at: '',
    submission_start_at: '',
    submission_end_at: '',
    presentation_date: '',
    target_programs: ['ALL'] as string[],
    target_batches: ['ALL'] as string[],
    is_double_blind_screening: true,
    is_leaderboard_published: false,
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch academic programs
  const { data: programs = [] } = useQuery<ProgramItem[]>({
    queryKey: ['academic-programs'],
    queryFn: async () => {
      const res = await api.get('/academic/programs');
      return res.data?.data || [];
    },
    enabled: isOpen,
  });

  // Fetch academic batches
  const { data: batches = [] } = useQuery<BatchItem[]>({
    queryKey: ['academic-batches'],
    queryFn: async () => {
      const res = await api.get('/academic/batches');
      return res.data?.data || [];
    },
    enabled: isOpen,
  });

  useEffect(() => {
    if (ideathon && isOpen) {
      setFormData({
        title: ideathon.title || '',
        theme: ideathon.theme || '',
        status: ideathon.status || 'draft',
        brief: ideathon.brief || '',
        problem_statement: ideathon.problem_statement || '',
        min_team_size: ideathon.min_team_size || 1,
        max_team_size: ideathon.max_team_size || 4,
        registration_start_at: ideathon.registration_start_at ? ideathon.registration_start_at.split('T')[0] : '',
        registration_end_at: ideathon.registration_end_at ? ideathon.registration_end_at.split('T')[0] : '',
        submission_start_at: ideathon.submission_start_at ? ideathon.submission_start_at.split('T')[0] : '',
        submission_end_at: ideathon.submission_end_at ? ideathon.submission_end_at.split('T')[0] : '',
        presentation_date: ideathon.presentation_date ? ideathon.presentation_date.split('T')[0] : '',
        target_programs: ideathon.target_programs?.length ? ideathon.target_programs : ['ALL'],
        target_batches: ideathon.target_batches?.length ? ideathon.target_batches : ['ALL'],
        is_double_blind_screening: ideathon.is_double_blind_screening ?? true,
        is_leaderboard_published: ideathon.is_leaderboard_published ?? false,
      });
      setErrorMessage(null);
    }
  }, [ideathon, isOpen]);

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!ideathon?.id) throw new Error('No ideathon selected');
      const payload: any = {
        title: formData.title.trim(),
        theme: formData.theme.trim(),
        status: formData.status,
        brief: formData.brief,
        problem_statement: formData.problem_statement,
        min_team_size: Number(formData.min_team_size),
        max_team_size: Number(formData.max_team_size),
        target_programs: formData.target_programs,
        target_batches: formData.target_batches,
        is_double_blind_screening: formData.is_double_blind_screening,
        is_leaderboard_published: formData.is_leaderboard_published,
      };

      if (formData.registration_start_at) payload.registration_start_at = new Date(formData.registration_start_at).toISOString();
      if (formData.registration_end_at) payload.registration_end_at = new Date(formData.registration_end_at).toISOString();
      if (formData.submission_start_at) payload.submission_start_at = new Date(formData.submission_start_at).toISOString();
      if (formData.submission_end_at) payload.submission_end_at = new Date(formData.submission_end_at).toISOString();
      if (formData.presentation_date) payload.presentation_date = new Date(formData.presentation_date).toISOString();

      const res = await api.put(`/ideathons/${ideathon.id}`, payload);
      return res.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ideathons'] });
      queryClient.invalidateQueries({ queryKey: ['ideathon', ideathon?.id] });
      queryClient.invalidateQueries({ queryKey: ['ideathon', ideathon?.slug] });
      if (onSaved) onSaved();
      onClose();
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.detail || 'Failed to update competition.');
    },
  });

  if (!isOpen || !ideathon) return null;

  const toggleProgram = (progId: string) => {
    if (progId === 'ALL') {
      setFormData((prev) => ({ ...prev, target_programs: ['ALL'] }));
      return;
    }
    let next = formData.target_programs.filter((p) => p !== 'ALL');
    if (next.includes(progId)) {
      next = next.filter((p) => p !== progId);
      if (next.length === 0) next = ['ALL'];
    } else {
      next.push(progId);
    }
    setFormData((prev) => ({ ...prev, target_programs: next }));
  };

  const toggleBatch = (batchId: string) => {
    if (batchId === 'ALL') {
      setFormData((prev) => ({ ...prev, target_batches: ['ALL'] }));
      return;
    }
    let next = formData.target_batches.filter((b) => b !== 'ALL');
    if (next.includes(batchId)) {
      next = next.filter((b) => b !== batchId);
      if (next.length === 0) next = ['ALL'];
    } else {
      next.push(batchId);
    }
    setFormData((prev) => ({ ...prev, target_batches: next }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Edit Competition Details</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Update parameters, eligibility, timelines, and competition status
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateMutation.mutate();
          }}
          className="p-6 space-y-5 max-h-[75vh] overflow-y-auto"
        >
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Title & Theme */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Competition Title *</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Core Theme *</label>
              <input
                type="text"
                required
                value={formData.theme}
                onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          {/* Status & Team Sizes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Lifecycle Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
              >
                <option value="draft">Draft (Private)</option>
                <option value="registration_open">Registration Open</option>
                <option value="submission_open">Submission Open</option>
                <option value="evaluation">Jury Evaluation</option>
                <option value="presentation">Pitch Presentations</option>
                <option value="completed">Completed & Awards</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Min Team Size</label>
              <input
                type="number"
                min={1}
                max={10}
                value={formData.min_team_size}
                onChange={(e) => setFormData({ ...formData, min_team_size: parseInt(e.target.value) || 1 })}
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Max Team Size</label>
              <input
                type="number"
                min={1}
                max={10}
                value={formData.max_team_size}
                onChange={(e) => setFormData({ ...formData, max_team_size: parseInt(e.target.value) || 4 })}
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          {/* Dates Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Registration Deadline</label>
              <input
                type="date"
                value={formData.registration_end_at}
                onChange={(e) => setFormData({ ...formData, registration_end_at: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Submission Closes</label>
              <input
                type="date"
                value={formData.submission_end_at}
                onChange={(e) => setFormData({ ...formData, submission_end_at: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Presentation Date</label>
              <input
                type="date"
                value={formData.presentation_date}
                onChange={(e) => setFormData({ ...formData, presentation_date: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Target Programs Multi-Select */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-cyan-500" />
                Target Programs (Multiple Selection)
              </label>
              <span className="text-[11px] text-slate-400">
                {formData.target_programs.includes('ALL') ? 'Open to All Programs' : `${formData.target_programs.length} selected`}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => toggleProgram('ALL')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  formData.target_programs.includes('ALL')
                    ? 'bg-cyan-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-cyan-500/50'
                }`}
              >
                {formData.target_programs.includes('ALL') ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                All Programs
              </button>

              {programs.map((p) => {
                const isSelected = formData.target_programs.includes(p.id) || formData.target_programs.includes(p.code);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleProgram(p.code)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      isSelected && !formData.target_programs.includes('ALL')
                        ? 'bg-cyan-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-cyan-500/50'
                    }`}
                  >
                    {isSelected && !formData.target_programs.includes('ALL') ? (
                      <CheckSquare className="w-3.5 h-3.5" />
                    ) : (
                      <Square className="w-3.5 h-3.5" />
                    )}
                    <span>{p.code}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target Batches Multi-Select */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-cyan-500" />
                Target Batches (Multiple Selection)
              </label>
              <span className="text-[11px] text-slate-400">
                {formData.target_batches.includes('ALL') ? 'Open to All Batches' : `${formData.target_batches.length} selected`}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 max-h-36 overflow-y-auto">
              <button
                type="button"
                onClick={() => toggleBatch('ALL')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  formData.target_batches.includes('ALL')
                    ? 'bg-cyan-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-cyan-500/50'
                }`}
              >
                {formData.target_batches.includes('ALL') ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                All Batches
              </button>

              {batches.map((b) => {
                const isSelected = formData.target_batches.includes(b.id) || formData.target_batches.includes(b.name);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => toggleBatch(b.name)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      isSelected && !formData.target_batches.includes('ALL')
                        ? 'bg-cyan-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-cyan-500/50'
                    }`}
                  >
                    {isSelected && !formData.target_batches.includes('ALL') ? (
                      <CheckSquare className="w-3.5 h-3.5" />
                    ) : (
                      <Square className="w-3.5 h-3.5" />
                    )}
                    <span>{b.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Brief & Problem Statement */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Executive Brief</label>
            <textarea
              rows={3}
              value={formData.brief}
              onChange={(e) => setFormData({ ...formData, brief: e.target.value })}
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Core Problem Statement & Objectives</label>
            <textarea
              rows={4}
              value={formData.problem_statement}
              onChange={(e) => setFormData({ ...formData, problem_statement: e.target.value })}
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800">
            <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_double_blind_screening}
                onChange={(e) => setFormData({ ...formData, is_double_blind_screening: e.target.checked })}
                className="rounded-sm text-cyan-600 focus:ring-cyan-500 h-4 w-4"
              />
              <span>Double-Blind Jury Screening</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_leaderboard_published}
                onChange={(e) => setFormData({ ...formData, is_leaderboard_published: e.target.checked })}
                className="rounded-sm text-cyan-600 focus:ring-cyan-500 h-4 w-4"
              />
              <span>Publish Live Leaderboard & Podium</span>
            </label>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending || !formData.title.trim()}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer"
            >
              {updateMutation.isPending ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
