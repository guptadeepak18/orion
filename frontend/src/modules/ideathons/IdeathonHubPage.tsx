import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Trophy,
  Plus,
  Search,
  Award,
  ArrowRight,
  ExternalLink,
  Zap,
  Edit3,
  Trash2,
  Bell,
  GraduationCap,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useRoleAccess } from '../../lib/useRoleAccess';
import { CertificateViewerModal, CertificateData } from './CertificateViewerModal';
import { IdeathonBroadcastModal } from './IdeathonBroadcastModal';
import { IdeathonFormModal } from './IdeathonFormModal';

export interface IdeathonItem {
  id: string;
  title: string;
  slug: string;
  theme: string;
  brief?: string;
  description?: string;
  problem_statement?: string;
  banner_url?: string;
  process_and_stages?: any[];
  rules_and_guidelines?: string[];
  faqs?: any[];
  target_programs: string[];
  target_batches: string[];
  min_team_size: number;
  max_team_size: number;
  registration_start_at?: string;
  registration_end_at?: string;
  submission_start_at?: string;
  submission_end_at?: string;
  presentation_date?: string;
  results_announced_at?: string;
  status: string;
  tracks: any[];
  rubrics: any[];
  prizes: any[];
  is_double_blind_screening: boolean;
  is_leaderboard_published: boolean;
  total_teams: number;
  total_submissions: number;
}

export const IdeathonHubPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, isCoordinator, isStudent } = useRoleAccess();
  const isPrivilegedAdmin = isAdmin || isCoordinator;

  const [activeTab, setActiveTab] = useState<'active' | 'incubated' | 'certificates' | 'all'>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCert, setSelectedCert] = useState<CertificateData | null>(null);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [broadcastIdeathon, setBroadcastIdeathon] = useState<IdeathonItem | null>(null);
  const [editIdeathon, setEditIdeathon] = useState<IdeathonItem | null>(null);
  const [deleteIdeathon, setDeleteIdeathon] = useState<IdeathonItem | null>(null);


  // Fetch Ideathons
  const { data: ideathons = [], isLoading } = useQuery<IdeathonItem[]>({
    queryKey: ['ideathons'],
    queryFn: async () => {
      const res = await api.get('/ideathons?status=all');
      return res.data?.data || [];
    },
  });

  // Fetch Incubated Projects
  const { data: incubatedProjects = [] } = useQuery<any[]>({
    queryKey: ['incubated-projects'],
    queryFn: async () => {
      const res = await api.get('/ideathons/incubated-projects');
      return res.data?.data || [];
    },
  });

  // Fetch Student's Certificates
  const { data: myCertificates = [] } = useQuery<CertificateData[]>({
    queryKey: ['my-certificates'],
    queryFn: async () => {
      if (!isStudent) return [];
      const res = await api.get('/ideathons/my/certificates');
      return res.data?.data || [];
    },
    enabled: isStudent,
  });


  // Delete Ideathon Mutation
  const deleteMutation = useMutation({
    mutationFn: async (ideathonId: string) => {
      await api.delete(`/ideathons/${ideathonId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ideathons'] });
      setDeleteIdeathon(null);
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to delete competition');
    },
  });

  // Filtered Ideathons
  const filteredIdeathons = ideathons.filter((ideo) => {
    const matchesSearch =
      ideo.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ideo.theme.toLowerCase().includes(searchTerm.toLowerCase());

    if (activeTab === 'active') {
      return matchesSearch && ideo.status !== 'completed' && ideo.status !== 'archived';
    }
    return matchesSearch;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Quick Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
            <Trophy className="w-6 h-6 text-amber-500" />
            Competitions & Innovation Hub
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Conduct market research, identify gaps, pitch solutions, and incubate live HyperBuild ventures.
          </p>
        </div>

        {isPrivilegedAdmin && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>New Competition</span>
          </button>
        )}
      </div>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Competitions</span>
          <span className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mt-1 block">{ideathons.length}</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Ventures Formed</span>
          <span className="text-xl font-extrabold text-cyan-600 dark:text-cyan-400 mt-1 block">
            {ideathons.reduce((acc, curr) => acc + (curr.total_teams || 0), 0)}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Submissions</span>
          <span className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1 block">
            {ideathons.reduce((acc, curr) => acc + (curr.total_submissions || 0), 0)}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Incubated MVPs</span>
          <span className="text-xl font-extrabold text-amber-500 mt-1 block">{incubatedProjects.length}</span>
        </div>
      </div>

      {/* Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar touch-scroll">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'active'
                ? 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Active Challenges ({ideathons.filter((i) => i.status !== 'completed' && i.status !== 'archived').length})
          </button>

          <button
            onClick={() => setActiveTab('incubated')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'incubated'
                ? 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Incubated Projects ({incubatedProjects.length})
          </button>

          {isStudent && (
            <button
              onClick={() => setActiveTab('certificates')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'certificates'
                  ? 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              My Certificates ({myCertificates.length})
            </button>
          )}

          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'all'
                ? 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            All Competitions ({ideathons.length})
          </button>
        </div>

        {/* Search */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search competitions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
          />
        </div>
      </div>

      {/* Competitions Grid */}
      {(activeTab === 'active' || activeTab === 'all') && (
        <div>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-48 rounded-2xl bg-slate-100 dark:bg-slate-800/40 animate-pulse" />
              ))}
            </div>
          ) : filteredIdeathons.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
              <Trophy className="w-10 h-10 text-slate-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">No Competitions Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No competitions match your filter. Check back soon or create a new event.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredIdeathons.map((ideo) => {
                const statusStr = ideo.status.replace('_', ' ');

                return (
                  <div
                    key={ideo.id}
                    className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-cyan-500/40 transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      {/* Status and Team limits row */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20">
                          {statusStr}
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium">
                          Teams of {ideo.min_team_size} – {ideo.max_team_size}
                        </span>
                      </div>

                      {/* Title & Theme */}
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 line-clamp-2">
                          {ideo.title}
                        </h3>
                        <p className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 mt-0.5 line-clamp-1">
                          Theme: {ideo.theme}
                        </p>
                      </div>

                      {/* Brief Snippet */}
                      {ideo.brief && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                          {ideo.brief}
                        </p>
                      )}

                      {/* Targeted Cohorts */}
                      <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                        <GraduationCap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {ideo.target_programs?.includes('ALL') ? (
                          <span className="text-slate-500 dark:text-slate-400">All Programs</span>
                        ) : (
                          ideo.target_programs?.slice(0, 3).map((p) => (
                            <span key={p} className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                              {p}
                            </span>
                          ))
                        )}
                      </div>

                      {/* Key Dates & Counts */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500">
                        <div>
                          <span className="text-slate-400 block">Submissions Due:</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {ideo.submission_end_at ? new Date(ideo.submission_end_at).toLocaleDateString() : 'TBD'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-400 block">Ventures:</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300">
                            {ideo.total_teams || 0} teams
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Toolbar */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                      <button
                        onClick={() => navigate(`/ideathons/${ideo.id}`)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-colors cursor-pointer"
                      >
                        <span>View Details</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      {isPrivilegedAdmin && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setBroadcastIdeathon(ideo)}
                            className="p-2 rounded-xl text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Broadcast notification to students"
                          >
                            <Bell className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setEditIdeathon(ideo)}
                            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Edit competition"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setDeleteIdeathon(ideo)}
                            className="p-2 rounded-xl text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Delete competition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Incubated Projects */}
      {activeTab === 'incubated' && (
        <div>
          {incubatedProjects.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
              <Zap className="w-10 h-10 text-slate-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">No Incubated Projects Yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Winning and approved ideathon submissions can be converted to active HyperBuild projects with 1 click.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {incubatedProjects.map((proj) => (
                <div
                  key={proj.id}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/10 text-amber-600 border border-amber-500/20">
                      {proj.status}
                    </span>
                    <span className="text-[11px] text-slate-400">Team: {proj.team_name}</span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{proj.title}</h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1">{proj.tagline}</p>
                  </div>

                  <button
                    onClick={() => navigate(`/ideathons/projects/${proj.id}`)}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs hover:opacity-90 transition-opacity cursor-pointer"
                  >
                    <span>Open Project Board</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Certificates */}
      {activeTab === 'certificates' && isStudent && (
        <div>
          {myCertificates.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
              <Award className="w-10 h-10 text-slate-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">No Certificates Earned Yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Participate in active challenges and submit your venture to earn verified credentials.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myCertificates.map((cert) => (
                <div
                  key={cert.id}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Verified Credential</span>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{cert.title}</h4>
                    <p className="text-xs text-slate-500">{cert.ideathon_title}</p>
                  </div>
                  <button
                    onClick={() => setSelectedCert(cert)}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-xs hover:bg-amber-500/20 transition-colors shrink-0 cursor-pointer"
                  >
                    View Credential
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create / Launch Competition Modal */}
      <IdeathonFormModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        ideathon={null}
        onSaved={(data) => {
          queryClient.invalidateQueries({ queryKey: ['ideathons'] });
          if (data?.id) navigate(`/ideathons/${data.id}`);
        }}
      />

      {/* Broadcast Notification Modal */}
      <IdeathonBroadcastModal
        ideathon={broadcastIdeathon}
        isOpen={!!broadcastIdeathon}
        onClose={() => setBroadcastIdeathon(null)}
      />

      {/* Edit Competition Modal */}
      <IdeathonFormModal
        isOpen={!!editIdeathon}
        onClose={() => setEditIdeathon(null)}
        ideathon={editIdeathon}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['ideathons'] })}
      />

      {/* Delete Confirmation Modal */}
      {deleteIdeathon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Delete Competition</h3>
                <p className="text-xs text-slate-500">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to delete{' '}
              <strong className="text-slate-900 dark:text-slate-100">{deleteIdeathon.title}</strong>? All registered
              teams, submissions, and evaluations will be removed.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setDeleteIdeathon(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteIdeathon.id)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Certificate Viewer Modal */}
      <CertificateViewerModal
        certificate={selectedCert}
        onClose={() => setSelectedCert(null)}
      />
    </div>
  );
};
