import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Trophy,
  ArrowLeft,
  Sparkles,
  Eye,
  EyeOff,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useRoleAccess } from '../../lib/useRoleAccess';
import { CertificateViewerModal, CertificateData } from './CertificateViewerModal';

export const IdeathonLeaderboard: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, isCoordinator, isFacultyInternal } = useRoleAccess();
  const isFacultyOrAdmin = isAdmin || isCoordinator || isFacultyInternal;

  const [selectedCert, setSelectedCert] = useState<CertificateData | null>(null);
  const [incubationNotice, setIncubationNotice] = useState<string | null>(null);

  // Fetch Leaderboard
  const { data: leaderboard, isLoading } = useQuery<any>({
    queryKey: ['ideathon-leaderboard', id],
    queryFn: async () => {
      const res = await api.get(`/ideathons/${id}/leaderboard`);
      return res.data?.data;
    },
    enabled: !!id,
  });

  // Toggle Publish Mutation
  const togglePublishMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/ideathons/${id}/publish-leaderboard`);
      return res.data?.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ideathon-leaderboard', id] });
      queryClient.invalidateQueries({ queryKey: ['ideathon', id] });
      setIncubationNotice(data.is_published ? 'Leaderboard published! Digital certificates generated.' : 'Leaderboard unpublished.');
      setTimeout(() => setIncubationNotice(null), 3500);
    },
  });

  // Convert to Incubated Project Mutation
  const incubateMutation = useMutation({
    mutationFn: async (submissionId: string) => {
      const res = await api.post(`/ideathons/${id}/submissions/${submissionId}/incubate`);
      return res.data?.data;
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['ideathon-leaderboard', id] });
      queryClient.invalidateQueries({ queryKey: ['incubated-projects'] });
      setIncubationNotice(`Venture "${project.title}" successfully inducted into HyperBuild Incubation!`);
      setTimeout(() => setIncubationNotice(null), 4000);
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const podium = leaderboard?.podium || [];
  const rankings = leaderboard?.rankings || [];
  const isPublished = leaderboard?.is_published;

  const first = podium[0];
  const second = podium[1];
  const third = podium[2];

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
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
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                Grand Leaderboard & Official Podium
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {leaderboard?.ideathon_title || 'Competition'}
              </p>
            </div>
          </div>
        </div>

        {/* Admin Publish Action */}
        {isFacultyOrAdmin && (
          <button
            onClick={() => togglePublishMutation.mutate()}
            disabled={togglePublishMutation.isPending}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
              isPublished
                ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:bg-rose-100'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white'
            }`}
          >
            {isPublished ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span>{isPublished ? 'Unpublish Leaderboard' : 'Publish Leaderboard & Award Certificates'}</span>
          </button>
        )}
      </div>

      {incubationNotice && (
        <div className="p-4 rounded-2xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 text-cyan-800 dark:text-cyan-200 text-xs flex items-center justify-between shadow-xs">
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-500" />
            <strong>{incubationNotice}</strong>
          </span>
          <button onClick={() => setIncubationNotice(null)} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
      )}

      {/* TOP 3 PODIUM VISUALIZER */}
      {podium.length > 0 && (
        <div className="space-y-4">
          <div className="text-center space-y-1">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              Podium Recognition
            </span>
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              Top 3 Innovator Ventures
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end max-w-5xl mx-auto pt-4">
            {/* 2nd Place (Silver) */}
            {second && (
              <div className="order-2 md:order-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-center space-y-4 shadow-xs flex flex-col justify-between md:min-h-[360px]">
                <div className="space-y-2.5">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 flex items-center justify-center mx-auto text-xl shadow-xs">
                    🥈
                  </div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    2nd Place • Silver
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 leading-snug">{second.project_title}</h3>
                  {second.project_tagline && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic">"{second.project_tagline}"</p>
                  )}
                  <p className="text-xs font-bold text-cyan-600 dark:text-cyan-400">Team {second.team_name}</p>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="text-xl font-mono font-black text-slate-800 dark:text-slate-200">{second.final_score} pts</div>
                  {isFacultyOrAdmin && !second.is_incubated && (
                    <button
                      onClick={() => incubateMutation.mutate(second.submission_id)}
                      className="w-full py-2 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 hover:bg-cyan-100 border border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 text-xs font-bold transition-colors cursor-pointer"
                    >
                      🚀 Induct into Incubation
                    </button>
                  )}
                  {second.is_incubated && (
                    <button
                      onClick={() => navigate(`/ideathons/projects/${second.incubated_project_id}`)}
                      className="w-full py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold"
                    >
                      ⚡ Active in Incubator
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 1st Place (Gold Podium) */}
            {first && (
              <div className="order-1 md:order-2 bg-white dark:bg-slate-900 border-2 border-amber-400 dark:border-amber-500/60 rounded-2xl p-6 text-center space-y-4 shadow-md flex flex-col justify-between md:min-h-[400px] relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-widest shadow-xs">
                  GRAND WINNER
                </div>

                <div className="space-y-3 pt-2">
                  <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 flex items-center justify-center mx-auto text-2xl shadow-xs">
                    🥇
                  </div>
                  <span className="inline-block px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                    1st Place • Gold Podium
                  </span>
                  <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 leading-snug">{first.project_title}</h3>
                  {first.project_tagline && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic">"{first.project_tagline}"</p>
                  )}
                  <p className="text-xs font-bold text-amber-600 dark:text-amber-400">Team {first.team_name}</p>
                </div>

                <div className="pt-4 border-t border-amber-200 dark:border-amber-900/40 space-y-2">
                  <div className="text-2xl font-mono font-black text-amber-600 dark:text-amber-400">{first.final_score} pts</div>
                  {isFacultyOrAdmin && !first.is_incubated && (
                    <button
                      onClick={() => incubateMutation.mutate(first.submission_id)}
                      className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-colors shadow-xs cursor-pointer"
                    >
                      🚀 Convert to Incubated Project
                    </button>
                  )}
                  {first.is_incubated && (
                    <button
                      onClick={() => navigate(`/ideathons/projects/${first.incubated_project_id}`)}
                      className="w-full py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold"
                    >
                      ⚡ Active in Incubator
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 3rd Place (Bronze) */}
            {third && (
              <div className="order-3 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-6 text-center space-y-4 shadow-xs flex flex-col justify-between md:min-h-[350px]">
                <div className="space-y-2.5">
                  <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex items-center justify-center mx-auto text-xl shadow-xs">
                    🥉
                  </div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                    3rd Place • Bronze
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 leading-snug">{third.project_title}</h3>
                  {third.project_tagline && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic">"{third.project_tagline}"</p>
                  )}
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-500">Team {third.team_name}</p>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="text-xl font-mono font-black text-slate-800 dark:text-slate-200">{third.final_score} pts</div>
                  {isFacultyOrAdmin && !third.is_incubated && (
                    <button
                      onClick={() => incubateMutation.mutate(third.submission_id)}
                      className="w-full py-2 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 hover:bg-cyan-100 border border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 text-xs font-bold transition-colors cursor-pointer"
                    >
                      🚀 Induct into Incubation
                    </button>
                  )}
                  {third.is_incubated && (
                    <button
                      onClick={() => navigate(`/ideathons/projects/${third.incubated_project_id}`)}
                      className="w-full py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold"
                    >
                      ⚡ Active in Incubator
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FULL RANKINGS TABLE */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Cohort Submissions & Matrix Rankings
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            {rankings.length} Submissions Ranked
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-bold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="p-4 w-16">Rank</th>
                  <th className="p-4">Venture & Tagline</th>
                  <th className="p-4">Team & Lead</th>
                  <th className="p-4 text-center">Phase 1 Score</th>
                  <th className="p-4 text-center">Phase 2 Score</th>
                  <th className="p-4 text-right">Composite Score</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {rankings.map((row: any) => (
                  <tr key={row.rank} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="p-4 font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                      {row.rank === 1 ? '🥇 #1' : row.rank === 2 ? '🥈 #2' : row.rank === 3 ? '🥉 #3' : `#${row.rank}`}
                    </td>

                    <td className="p-4">
                      <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">{row.project_title}</div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] truncate max-w-xs">{row.project_tagline}</div>
                    </td>

                    <td className="p-4">
                      <div className="font-bold text-slate-800 dark:text-slate-200">{row.team_name}</div>
                      <div className="text-slate-400 text-[11px]">{row.lead_name} ({row.members?.length || 1} members)</div>
                    </td>

                    <td className="p-4 text-center font-mono text-slate-600 dark:text-slate-400">
                      {row.phase1_score || '-'}
                    </td>

                    <td className="p-4 text-center font-mono text-slate-600 dark:text-slate-400">
                      {row.phase2_score || '-'}
                    </td>

                    <td className="p-4 text-right font-mono font-extrabold text-sm text-indigo-600 dark:text-indigo-400">
                      {row.final_score} pts
                    </td>

                    <td className="p-4 text-right">
                      {isFacultyOrAdmin && !row.is_incubated && (
                        <button
                          onClick={() => incubateMutation.mutate(row.submission_id)}
                          className="px-3 py-1.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 hover:bg-cyan-100 border border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          Incubate Idea
                        </button>
                      )}
                      {row.is_incubated && (
                        <button
                          onClick={() => navigate(`/ideathons/projects/${row.incubated_project_id}`)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold"
                        >
                          View Project
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Certificate Viewer Modal */}
      {selectedCert && (
        <CertificateViewerModal
          certificate={selectedCert}
          onClose={() => setSelectedCert(null)}
        />
      )}
    </div>
  );
};
