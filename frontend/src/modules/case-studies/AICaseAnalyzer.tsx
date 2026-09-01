import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  RefreshCw,
  Printer,
  Check,
  Copy,
  Sliders,
  Compass,
  Building2,
  GitFork,
  CheckCircle2,
  Lightbulb,
  ShieldAlert,
  FileText,
  FileDown,
  Award,
  Target,
  BookOpen,
} from 'lucide-react';
import { api } from '../../lib/api';

interface AICaseAnalyzerProps {
  caseStudyId: string;
  caseTitle: string;
  domain?: string;
}

export const AICaseAnalyzer: React.FC<AICaseAnalyzerProps> = ({
  caseStudyId,
  caseTitle,
  domain,
}) => {
  const queryClient = useQueryClient();
  const [selectedLens, setSelectedLens] = useState<string>('outcome_mastery');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [isReconfiguring, setIsReconfiguring] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // 1. Fetch available Framework Lenses
  const { data: lensesData } = useQuery({
    queryKey: ['case_framework_lenses'],
    queryFn: async () => {
      const res = await api.get('/case-studies/meta/framework-lenses');
      return res.data.data;
    },
    staleTime: 1000 * 60 * 60,
  });

  // 2. Fetch User-Specific Saved Analysis
  const {
    data: savedAnalysis,
    isLoading: isAnalysisLoading,
  } = useQuery({
    queryKey: ['user_case_analysis', caseStudyId],
    queryFn: async () => {
      const res = await api.get(`/case-studies/${caseStudyId}/ai-analysis`);
      return res.data.data;
    },
  });

  // 3. Run/Re-Run Analysis Mutation
  const runAnalysisMutation = useMutation({
    mutationFn: async (params: { analysis_lens: string; custom_prompt?: string }) => {
      const res = await api.post(`/case-studies/${caseStudyId}/ai-analysis`, {
        analysis_lens: params.analysis_lens,
        custom_prompt: params.custom_prompt?.trim() || null,
      });
      return res.data.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['user_case_analysis', caseStudyId], data);
      setIsReconfiguring(false);
    },
  });

  // Copy helper
  const copyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Download Markdown
  const downloadMarkdownReport = () => {
    if (!savedAnalysis?.analysis) return;
    const a = savedAnalysis.analysis;
    const meta = a.meta || {};

    let md = `# Case Study Strategic Masterclass & Outcome Brief: ${meta.case_title || caseTitle}\n\n`;
    md += `**Framework:** ${meta.framework_lens || 'Outcome Mastery'}  |  **Generated:** ${meta.generated_timestamp || ''}\n\n---\n\n`;

    const snap = a.executive_snapshot;
    if (snap) {
      md += `## 1. Executive Snapshot & The Burning Platform\n\n`;
      if (snap.headline) md += `> **${snap.headline}**\n\n`;
      if (snap.burning_platform) md += `${snap.burning_platform}\n\n`;
      if (snap.core_dilemma) md += `**Core Strategic Dilemma:** ${snap.core_dilemma}\n\n`;
      if (snap.key_actors) {
        md += `### Key Decision Makers & Protagonists\n`;
        snap.key_actors.forEach((act: any) => (md += `- **${act.actor}:** ${act.position}\n`));
        md += `\n`;
      }
    }

    const conflict = a.conflict_and_market_forces;
    if (conflict) {
      md += `## 2. Conflict, Market Forces & Ecosystem Breakdown\n\n`;
      if (conflict.narrative) md += `${conflict.narrative}\n\n`;
      if (conflict.key_tensions) {
        md += `### Key Strategic Tensions\n`;
        conflict.key_tensions.forEach((t: any) => (md += `- **${t.tension_title}:** ${t.description}\n`));
        md += `\n`;
      }
      if (conflict.stakeholder_matrix) {
        md += `### Stakeholder Impact Matrix\n| Stakeholder | Leverage | Core Priority | Outcome |\n|---|---|---|---|\n`;
        conflict.stakeholder_matrix.forEach((s: any) => (md += `| ${s.stakeholder} | ${s.leverage} | ${s.priority} | ${s.outcome} |\n`));
        md += `\n`;
      }
    }

    const alts = a.strategic_alternatives;
    if (alts) {
      md += `## 3. Strategic Alternatives & Decision Matrix\n\n`;
      if (alts.framing) md += `${alts.framing}\n\n`;
      if (alts.options) {
        alts.options.forEach((opt: any) => {
          md += `### ${opt.option_name}\n${opt.description || ''}\n`;
          if (opt.pros) md += `- **Pros:** ${Array.isArray(opt.pros) ? opt.pros.join(', ') : opt.pros}\n`;
          if (opt.cons) md += `- **Cons:** ${Array.isArray(opt.cons) ? opt.cons.join(', ') : opt.cons}\n`;
          md += `- **Risk Tier:** ${opt.risk_level} | **Capital & Timeline:** ${opt.capital_and_time}\n\n`;
        });
      }
    }

    const outcome = a.real_world_outcome;
    if (outcome) {
      md += `## 4. The Real-World Outcome & Historical Resolution\n\n`;
      if (outcome.actual_decision) md += `### Actual Strategic Path Chosen:\n> **${outcome.actual_decision}**\n\n`;
      if (outcome.execution_and_aftermath) md += `### Execution Trajectory & Market Aftermath\n${outcome.execution_and_aftermath}\n\n`;
      if (outcome.measurable_results) {
        md += `### Quantifiable Outcomes\n| Metric / Event | Measured Value | Strategic Significance |\n|---|---|---|\n`;
        outcome.measurable_results.forEach((m: any) => (md += `| ${m.metric} | ${m.value} | ${m.significance} |\n`));
        md += `\n`;
      }
      if (outcome.long_term_legacy) md += `### Enduring Industry Legacy\n${outcome.long_term_legacy}\n\n`;
    }

    const root = a.root_cause_diagnostic;
    if (root) {
      md += `## 5. Root-Cause Diagnostic\n\n${root.why_it_happened || ''}\n\n`;
      if (root.critical_failure_or_success_factors) {
        root.critical_failure_or_success_factors.forEach((f: string) => (md += `- ${f}\n`));
        md += `\n`;
      }
    }

    const takeaways = a.key_business_takeaways;
    if (takeaways) {
      md += `## 6. Key Business Principles & Mental Models\n\n${takeaways.summary || ''}\n\n`;
      if (takeaways.principles) {
        takeaways.principles.forEach((p: any) => {
          md += `### ${p.principle_name}\n- **Core Concept:** ${p.concept}\n- **Managerial Application:** ${p.application}\n\n`;
        });
      }
    }

    const exam = a.exam_and_viva_prep;
    if (exam) {
      md += `## 7. Classroom Socratic Discussion & Exam Prep Guide\n\n`;
      if (exam.facilitation_note) md += `_${exam.facilitation_note}_\n\n`;
      if (exam.questions_and_answers) {
        exam.questions_and_answers.forEach((qa: any, i: number) => {
          md += `### Q${i + 1}: ${qa.question}\n**Model Answer:** ${qa.model_answer}\n*Framework: ${qa.framework_to_cite}*\n\n`;
        });
      }
    }

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Case_Outcome_Masterclass_${caseTitle.replace(/[^a-zA-Z0-9]/g, '_')}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Download DOCX
  const downloadDocx = async () => {
    try {
      const res = await api.get(`/case-studies/${caseStudyId}/ai-analysis/export?format=docx`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Case_Outcome_Masterclass_${caseTitle.replace(/[^a-zA-Z0-9]/g, '_')}.docx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('DOCX export failed. Please try again.');
    }
  };

  // Open PDF Print in new tab (Executive Masterclass Layout)
  const openPdfPrint = async () => {
    // Open blank window immediately to bypass pop-up blockers
    const win = window.open('', '_blank');
    if (win) {
      win.document.open();
      win.document.write(`<!DOCTYPE html>
<html>
<head><title>Loading AI Case Masterclass...</title></head>
<body style="font-family:sans-serif;padding:40px;text-align:center;color:#475569;background:#f8fafc;">
  <h2 style="color:#0f294a;">Synthesizing Case Masterclass Print View...</h2>
  <p>Please wait a moment while the document is rendered.</p>
</body>
</html>`);
      win.document.close();
    }

    try {
      const res = await api.get(`/case-studies/${caseStudyId}/ai-analysis/export?format=html`, {
        responseType: 'text',
      });
      const htmlContent = res.data;

      if (win) {
        win.document.open();
        win.document.write(htmlContent);
        win.document.close();
        setTimeout(() => {
          try {
            win.print();
          } catch (pe) {
            console.error('Print trigger notice:', pe);
          }
        }, 700);
      } else {
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      }
    } catch (e: any) {
      if (win) {
        win.document.body.innerHTML = `<div style="padding:40px;color:#dc2626;font-family:sans-serif;text-align:center;">
          <h2>Export Failed</h2>
          <p>${e?.response?.data?.message || e?.message || 'Error rendering document'}</p>
        </div>`;
      } else {
        alert('PDF export failed. Please try again.');
      }
    }
  };

  const handleExecuteAnalysis = () => {
    runAnalysisMutation.mutate({
      analysis_lens: selectedLens,
      custom_prompt: customPrompt,
    });
  };

  if (isAnalysisLoading) {
    return (
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-500 space-y-3">
        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-500" />
        <p className="text-sm font-bold">Retrieving case study strategic masterclass...</p>
      </div>
    );
  }

  const analysisContent = savedAnalysis?.analysis;
  const isNewOutcomeFormat = Boolean(analysisContent?.executive_snapshot || analysisContent?.real_world_outcome);

  return (
    <div className="space-y-6">
      {/* ── TOP CONTROL & STATUS HEADER ────────────────────────────────────────── */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 md:p-8 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-extrabold">
                <Award className="h-3.5 w-3.5" />
                <span>Case Outcome & Strategic Mastery • Student Learning Hub</span>
              </div>
              {domain && (
                <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-extrabold uppercase border border-slate-700">
                  {domain}
                </span>
              )}
            </div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2.5">
              Strategic Case Masterclass & Outcome Analysis
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Understand what actually happened, why leadership made their critical choices, the quantifiable business aftermath, core mental models, and exam prep.
            </p>
          </div>

          {/* Action Tools — Multi-Format Export Panel */}
          {savedAnalysis && !isReconfiguring && (
            <div className="flex flex-col gap-2 shrink-0">
              <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold text-left lg:text-right">
                Export Formatted Document
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={openPdfPrint}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-md shadow-rose-900/30"
                  title="Export styled document to PDF"
                >
                  <Printer className="h-3.5 w-3.5" />
                  PDF (Print)
                </button>

                <button
                  onClick={downloadDocx}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-md shadow-blue-900/30"
                  title="Download structured Word Document (.docx)"
                >
                  <FileText className="h-3.5 w-3.5" />
                  DOCX (Word)
                </button>

                <button
                  onClick={downloadMarkdownReport}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                  title="Download Markdown file"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  .MD
                </button>

                <button
                  onClick={() => setIsReconfiguring(true)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-indigo-400 hover:text-indigo-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Sliders className="h-3.5 w-3.5" />
                  Re-Analyze
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Saved Analysis Meta Bar */}
        {savedAnalysis && !isReconfiguring && (
          <div className="mt-6 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-slate-400">Analysis Lens:</span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                {savedAnalysis.analysis_lens_label || savedAnalysis.analysis_lens}
              </span>
              {savedAnalysis.custom_prompt && (
                <span className="text-slate-400 italic">
                  (Focus: "{savedAnalysis.custom_prompt}")
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-slate-400 font-medium text-[11px]">
              {analysisContent?.meta?.ai_powered && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 font-bold text-[10px]">
                  <Sparkles className="h-3 w-3 text-violet-400" />
                  Gemini AI Powered
                </span>
              )}
              {analysisContent?.meta?.estimated_reading_time && (
                <span>{analysisContent.meta.estimated_reading_time}</span>
              )}
              <span>•</span>
              <span className="text-emerald-400 font-bold">Saved in your private workspace</span>
            </div>
          </div>
        )}
      </div>

      {/* ── ANALYSIS RECONFIGURATION / INITIAL PROMPT FORM ────────────────────── */}
      {(!savedAnalysis || isReconfiguring) && (
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 md:p-8 space-y-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Compass className="h-4 w-4 text-indigo-600" />
                Select Strategic Lens & Case Focus
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Customize the pedagogical framework lens to align with your course syllabus or discussion topics.
              </p>
            </div>
            {savedAnalysis && (
              <button
                onClick={() => setIsReconfiguring(false)}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
              >
                Cancel
              </button>
            )}
          </div>

          {/* Framework Lens Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(lensesData || []).map((lens: any) => {
              const isSelected = selectedLens === lens.id;
              return (
                <div
                  key={lens.id}
                  onClick={() => setSelectedLens(lens.id)}
                  className={`p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`text-xs font-black ${
                        isSelected ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {lens.label}
                    </p>
                    {isSelected && <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {lens.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Optional Custom User Focus Prompt */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Specific Case Angle or Exam Focus (Optional):</span>
              <span className="text-[10px] text-slate-400 font-normal">e.g. Focus on regulatory negotiations in China</span>
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g. Focus deeply on how the protagonist handled regulatory negotiations and what the financial consequences were..."
              rows={2}
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Launch Button */}
          <div className="flex items-center justify-end gap-3 pt-2">
            {savedAnalysis && (
              <button
                onClick={() => setIsReconfiguring(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleExecuteAnalysis}
              disabled={runAnalysisMutation.isPending}
              className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-60"
            >
              {runAnalysisMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Synthesizing Real Case Outcomes & Strategic Mastery...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {savedAnalysis ? 'Regenerate Case Masterclass' : 'Generate Case Masterclass'}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── RICH CASE LEARNING & OUTCOME RESULTS DISPLAY ───────────────────────── */}
      {savedAnalysis && !isReconfiguring && isNewOutcomeFormat && (
        <div className="space-y-8">
          {/* Quick Module Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-bold">
            {[
              { id: 'all', label: 'All 7 Modules' },
              { id: 'snapshot', label: '1. Executive Snapshot' },
              { id: 'conflict', label: '2. Conflict & Forces' },
              { id: 'alternatives', label: '3. Decision Matrix' },
              { id: 'outcome', label: '4. Real-World Outcome ⭐' },
              { id: 'rootcause', label: '5. Root-Cause Diagnostic' },
              { id: 'takeaways', label: '6. Key Principles' },
              { id: 'exam', label: '7. Exam & Viva Prep' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-1.5 rounded-full whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── MODULE 1: EXECUTIVE SNAPSHOT & BURNING PLATFORM ── */}
          {(activeTab === 'all' || activeTab === 'snapshot') && analysisContent.executive_snapshot && (
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 md:p-8 space-y-6 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                    <Target className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      1. Executive Snapshot & The Burning Platform
                    </h3>
                    <p className="text-xs text-slate-400">The crisis trigger, protagonist pressure, and core dilemma</p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                  Context & Dilemma
                </span>
              </div>

              {/* Headline Callout */}
              {analysisContent.executive_snapshot.headline && (
                <div className="p-4 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 text-blue-950 dark:text-blue-100 text-xs md:text-sm font-bold leading-relaxed">
                  💡 {analysisContent.executive_snapshot.headline}
                </div>
              )}

              {/* Burning Platform Narrative */}
              {analysisContent.executive_snapshot.burning_platform && (
                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    The Burning Platform
                  </h4>
                  <p className="text-xs md:text-sm text-slate-800 dark:text-slate-200 leading-relaxed text-justify">
                    {analysisContent.executive_snapshot.burning_platform}
                  </p>
                </div>
              )}

              {/* Core Dilemma Banner */}
              {analysisContent.executive_snapshot.core_dilemma && (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-500 space-y-1">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                    Central Strategic Dilemma
                  </p>
                  <p className="text-xs md:text-sm font-bold text-amber-950 dark:text-amber-100 leading-relaxed">
                    {analysisContent.executive_snapshot.core_dilemma}
                  </p>
                </div>
              )}

              {/* Key Actors Grid */}
              {analysisContent.executive_snapshot.key_actors && (
                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Key Decision Makers & Protagonists
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {analysisContent.executive_snapshot.key_actors.map((a: any, i: number) => (
                      <div
                        key={i}
                        className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1"
                      >
                        <p className="font-extrabold text-xs text-indigo-600 dark:text-indigo-400">
                          {a.actor}
                        </p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                          {a.position}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── MODULE 2: CONFLICT & MARKET FORCES ── */}
          {(activeTab === 'all' || activeTab === 'conflict') && analysisContent.conflict_and_market_forces && (
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 md:p-8 space-y-6 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      2. Conflict, Market Forces & Ecosystem Breakdown
                    </h3>
                    <p className="text-xs text-slate-400">Industry friction, power dynamics, and stakeholder incentives</p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                  Ecosystem Forces
                </span>
              </div>

              {/* Narrative */}
              {analysisContent.conflict_and_market_forces.narrative && (
                <p className="text-xs md:text-sm text-slate-800 dark:text-slate-200 leading-relaxed text-justify">
                  {analysisContent.conflict_and_market_forces.narrative}
                </p>
              )}

              {/* Key Tensions Cards */}
              {analysisContent.conflict_and_market_forces.key_tensions && (
                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Core Strategic Tensions
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {analysisContent.conflict_and_market_forces.key_tensions.map((t: any, i: number) => (
                      <div
                        key={i}
                        className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-800/40 space-y-1.5"
                      >
                        <p className="font-extrabold text-xs text-purple-900 dark:text-purple-300">
                          ⚔️ {t.tension_title}
                        </p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                          {t.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stakeholder Impact Matrix Table */}
              {analysisContent.conflict_and_market_forces.stakeholder_matrix && (
                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Stakeholder Impact & Power Matrix
                  </h4>
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold border-b border-slate-200 dark:border-slate-700">
                          <th className="p-3">Stakeholder</th>
                          <th className="p-3">Leverage</th>
                          <th className="p-3">Core Priority</th>
                          <th className="p-3">Eventual Outcome</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                        {analysisContent.conflict_and_market_forces.stakeholder_matrix.map((s: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="p-3 font-bold text-indigo-600 dark:text-indigo-400">{s.stakeholder}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                s.leverage?.toLowerCase().includes('high') || s.leverage?.toLowerCase().includes('dom')
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                              }`}>
                                {s.leverage}
                              </span>
                            </td>
                            <td className="p-3">{s.priority}</td>
                            <td className="p-3 text-slate-600 dark:text-slate-400">{s.outcome}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── MODULE 3: STRATEGIC ALTERNATIVES MATRIX ── */}
          {(activeTab === 'all' || activeTab === 'alternatives') && analysisContent.strategic_alternatives && (
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 md:p-8 space-y-6 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                    <GitFork className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      3. Strategic Alternatives & Decision Matrix
                    </h3>
                    <p className="text-xs text-slate-400">Pathways evaluated by leadership and their trade-offs</p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                  Scenario Matrix
                </span>
              </div>

              {analysisContent.strategic_alternatives.framing && (
                <p className="text-xs md:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                  {analysisContent.strategic_alternatives.framing}
                </p>
              )}

              {/* Options Grid */}
              {analysisContent.strategic_alternatives.options && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {analysisContent.strategic_alternatives.options.map((opt: any, i: number) => (
                    <div
                      key={i}
                      className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-black text-slate-900 dark:text-white">
                            {opt.option_name}
                          </h4>
                        </div>
                        {opt.description && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                            {opt.description}
                          </p>
                        )}

                        {/* Pros */}
                        <div className="space-y-1 pt-1">
                          <p className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase">
                            Advantages (Pros):
                          </p>
                          <ul className="text-[11px] text-slate-700 dark:text-slate-300 space-y-1 list-disc list-inside">
                            {Array.isArray(opt.pros)
                              ? opt.pros.map((p: string, idx: number) => <li key={idx}>{p}</li>)
                              : <li>{opt.pros}</li>}
                          </ul>
                        </div>

                        {/* Cons */}
                        <div className="space-y-1 pt-1">
                          <p className="text-[10px] font-extrabold text-rose-600 dark:text-rose-400 uppercase">
                            Risks & Downsides (Cons):
                          </p>
                          <ul className="text-[11px] text-slate-700 dark:text-slate-300 space-y-1 list-disc list-inside">
                            {Array.isArray(opt.cons)
                              ? opt.cons.map((c: string, idx: number) => <li key={idx}>{c}</li>)
                              : <li>{opt.cons}</li>}
                          </ul>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-[10px]">
                        <span className="font-extrabold text-slate-700 dark:text-slate-300">
                          Risk: {opt.risk_level}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {opt.capital_and_time}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── MODULE 4: THE REAL-WORLD OUTCOME (STAR MODULE) ── */}
          {(activeTab === 'all' || activeTab === 'outcome') && analysisContent.real_world_outcome && (
            <div className="rounded-3xl bg-emerald-950/10 dark:bg-emerald-950/30 border-2 border-emerald-500/40 p-6 md:p-8 space-y-6 shadow-md shadow-emerald-900/10">
              <div className="flex items-center justify-between pb-3 border-b border-emerald-500/20">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/30">
                    <Award className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-emerald-950 dark:text-emerald-100 flex items-center gap-2">
                      4. The Real-World Outcome & Historical Resolution
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-600 text-white">
                        Actual Result
                      </span>
                    </h3>
                    <p className="text-xs text-emerald-800 dark:text-emerald-400">
                      What the company actually did, execution aftermath, and real measurable business results
                    </p>
                  </div>
                </div>
              </div>

              {/* The Actual Decision Card */}
              {analysisContent.real_world_outcome.actual_decision && (
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-500/30 shadow-sm space-y-1.5">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    The Actual Strategic Path Chosen
                  </p>
                  <p className="text-xs md:text-sm font-extrabold text-slate-900 dark:text-white leading-relaxed">
                    {analysisContent.real_world_outcome.actual_decision}
                  </p>
                </div>
              )}

              {/* Execution and Aftermath Narrative */}
              {analysisContent.real_world_outcome.execution_and_aftermath && (
                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                    Execution Trajectory & Market Aftermath
                  </h4>
                  <p className="text-xs md:text-sm text-slate-800 dark:text-slate-200 leading-relaxed text-justify whitespace-pre-line">
                    {analysisContent.real_world_outcome.execution_and_aftermath}
                  </p>
                </div>
              )}

              {/* Measurable Results Table */}
              {analysisContent.real_world_outcome.measurable_results && (
                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                    Quantifiable Outcomes & Hard Metrics
                  </h4>
                  <div className="overflow-x-auto rounded-2xl border border-emerald-500/20 bg-white dark:bg-slate-900">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-emerald-900/10 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 font-extrabold border-b border-emerald-500/20">
                          <th className="p-3">Outcome Metric / Event</th>
                          <th className="p-3">Measured Value / Terms</th>
                          <th className="p-3">Strategic Significance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-emerald-500/10 text-slate-800 dark:text-slate-200">
                        {analysisContent.real_world_outcome.measurable_results.map((m: any, i: number) => (
                          <tr key={i} className="hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20">
                            <td className="p-3 font-bold text-slate-900 dark:text-white">{m.metric}</td>
                            <td className="p-3">
                              <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-300 font-black text-xs">
                                {m.value}
                              </span>
                            </td>
                            <td className="p-3 text-slate-600 dark:text-slate-300">{m.significance}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Enduring Industry Legacy */}
              {analysisContent.real_world_outcome.long_term_legacy && (
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-500/20 space-y-1">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Enduring Industry Legacy
                  </p>
                  <p className="text-xs md:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                    {analysisContent.real_world_outcome.long_term_legacy}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── MODULE 5: ROOT-CAUSE DIAGNOSTIC ── */}
          {(activeTab === 'all' || activeTab === 'rootcause') && analysisContent.root_cause_diagnostic && (
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 md:p-8 space-y-6 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      5. Root-Cause Diagnostic: Why It Succeeded or Failed
                    </h3>
                    <p className="text-xs text-slate-400">Structural forces vs. managerial decisions that decided the outcome</p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  Diagnostic Breakdown
                </span>
              </div>

              {analysisContent.root_cause_diagnostic.why_it_happened && (
                <p className="text-xs md:text-sm text-slate-800 dark:text-slate-200 leading-relaxed text-justify">
                  {analysisContent.root_cause_diagnostic.why_it_happened}
                </p>
              )}

              {analysisContent.root_cause_diagnostic.critical_failure_or_success_factors && (
                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Decisive Determinants of the Outcome
                  </h4>
                  <div className="space-y-2">
                    {analysisContent.root_cause_diagnostic.critical_failure_or_success_factors.map((f: string, i: number) => (
                      <div
                        key={i}
                        className="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 text-xs text-slate-800 dark:text-slate-200 flex items-start gap-2.5"
                      >
                        <span className="font-extrabold text-amber-600 dark:text-amber-400 shrink-0">#{i + 1}</span>
                        <p className="leading-relaxed">{f}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── MODULE 6: KEY BUSINESS PRINCIPLES & MENTAL MODELS ── */}
          {(activeTab === 'all' || activeTab === 'takeaways') && analysisContent.key_business_takeaways && (
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 md:p-8 space-y-6 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-violet-50 dark:bg-violet-950 text-violet-600 dark:text-violet-400">
                    <Lightbulb className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      6. Key Business Principles & Strategic Mental Models
                    </h3>
                    <p className="text-xs text-slate-400">Transferable executive frameworks for your exams and future career</p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300">
                  Mental Models
                </span>
              </div>

              {analysisContent.key_business_takeaways.summary && (
                <p className="text-xs md:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                  {analysisContent.key_business_takeaways.summary}
                </p>
              )}

              {/* Principles Cards */}
              {analysisContent.key_business_takeaways.principles && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analysisContent.key_business_takeaways.principles.map((p: any, i: number) => (
                    <div
                      key={i}
                      className="p-5 rounded-2xl bg-violet-50/40 dark:bg-violet-950/20 border border-violet-200/60 dark:border-violet-800/40 space-y-2.5"
                    >
                      <h4 className="text-xs md:text-sm font-black text-violet-950 dark:text-violet-200">
                        {p.principle_name}
                      </h4>
                      <div className="space-y-1 text-xs">
                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                          <strong className="text-violet-900 dark:text-violet-300">Core Concept:</strong> {p.concept}
                        </p>
                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed pt-1">
                          <strong className="text-violet-900 dark:text-violet-300">Managerial Application:</strong> {p.application}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── MODULE 7: EXAM & VIVA PREP / CLASSROOM SOCRATIC GUIDE ── */}
          {(activeTab === 'all' || activeTab === 'exam') && analysisContent.exam_and_viva_prep && (
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 md:p-8 space-y-6 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      7. Classroom Socratic Discussion & Exam Prep Guide
                    </h3>
                    <p className="text-xs text-slate-400">High-yield case study viva questions with comprehensive model answers</p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                  Exam Mastery
                </span>
              </div>

              {analysisContent.exam_and_viva_prep.facilitation_note && (
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                  💡 {analysisContent.exam_and_viva_prep.facilitation_note}
                </p>
              )}

              {/* Q&A Cards */}
              {analysisContent.exam_and_viva_prep.questions_and_answers && (
                <div className="space-y-4">
                  {analysisContent.exam_and_viva_prep.questions_and_answers.map((qa: any, i: number) => (
                    <div
                      key={i}
                      className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-extrabold text-xs md:text-sm text-slate-900 dark:text-white">
                          <span className="text-teal-600 dark:text-teal-400 mr-1.5">Q{i + 1}:</span>
                          {qa.question}
                        </p>
                        <button
                          onClick={() => copyText(`q_${i}`, `Question: ${qa.question}\n\nModel Answer: ${qa.model_answer}\n\nFramework: ${qa.framework_to_cite}`)}
                          className="text-slate-400 hover:text-slate-600 shrink-0 p-1"
                          title="Copy Q&A"
                        >
                          {copiedKey === `q_${i}` ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>

                      <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1">
                        <p className="text-[10px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400">
                          Model Student Answer:
                        </p>
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                          {qa.model_answer}
                        </p>
                      </div>

                      {qa.framework_to_cite && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">Framework to Cite:</span>
                          <span>{qa.framework_to_cite}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
