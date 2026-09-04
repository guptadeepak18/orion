import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  RefreshCw,
  Printer,
  Clock,
  BookOpen,
  GraduationCap,
  Users,
  Target,
  FileText,
  Lightbulb,
  ShieldAlert,
  Compass,
  Layers,
  Award,
  Table,
  CheckCircle2,
  AlertTriangle,
  FileDown,
} from 'lucide-react';
import { api } from '../../lib/api';

interface AICaseNoteViewerProps {
  caseStudyId: string;
  caseTitle: string;
  domain?: string;
  author?: string;
  productNumber?: string;
}

const DURATION_OPTIONS = [
  { value: 60, label: '60 Minutes (Compact)' },
  { value: 80, label: '80 Minutes (Standard Session)' },
  { value: 90, label: '90 Minutes (Executive Extended)' },
  { value: 120, label: '120 Minutes (Two-Part Workshop)' },
];

const COURSE_FOCUS_OPTIONS = [
  'Strategy & General Management',
  'Business Ethics & Corporate Governance',
  'Leadership & Crisis Turnaround',
  'M&A and Post-Merger Integration',
  'Emerging Markets & Nonmarket Strategy',
  'Financial Risk Management & Treasury',
];

export const AICaseNoteViewer: React.FC<AICaseNoteViewerProps> = ({
  caseStudyId,
  caseTitle,
  author,
  productNumber,
}) => {
  const queryClient = useQueryClient();
  const [durationMinutes, setDurationMinutes] = useState<number>(80);
  const [courseFocus, setCourseFocus] = useState<string>('Strategy & General Management');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [isConfiguring, setIsConfiguring] = useState<boolean>(false);
  const [activePastureTab, setActivePastureTab] = useState<number>(1);
  const [activeSection, setActiveSection] = useState<string>('all');

  // 1. Fetch saved AI Case Note
  const { data: caseNoteData } = useQuery({
    queryKey: ['case_study_ai_note', caseStudyId],
    queryFn: async () => {
      const res = await api.get(`/case-studies/${caseStudyId}/ai-case-note`);
      return res.data.data;
    },
    staleTime: 10 * 60 * 1000,
  });

  // 2. Generate/Regenerate Mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/case-studies/${caseStudyId}/ai-case-note`, {
        duration_minutes: durationMinutes,
        course_focus: courseFocus,
        custom_prompt: customPrompt.trim() || undefined,
      });
      return res.data.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['case_study_ai_note', caseStudyId], data);
      setIsConfiguring(false);
    },
  });

  // Export handlers
  const handleExportDOCX = async () => {
    try {
      const res = await api.get(`/case-studies/${caseStudyId}/ai-case-note/export?format=docx`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AI_Case_Note_${caseTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Failed to download Word document: ' + (err?.message || 'Error'));
    }
  };

  const handleExportHTMLOrPDF = async () => {
    // Open blank window immediately to prevent popup blocker blocking
    const win = window.open('', '_blank');
    if (win) {
      win.document.open();
      win.document.write(`<!DOCTYPE html>
<html>
<head><title>Loading AI Case Note...</title></head>
<body style="font-family:sans-serif;padding:40px;text-align:center;color:#475569;background:#f8fafc;">
  <h2 style="color:#0f294a;">Synthesizing Teaching Note Print View...</h2>
  <p>Please wait a moment while the document is rendered.</p>
</body>
</html>`);
      win.document.close();
    }

    try {
      const res = await api.get(`/case-studies/${caseStudyId}/ai-case-note/export?format=html`, {
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
        // Fallback: create blob and open
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      }
    } catch (err: any) {
      if (win) {
        win.document.body.innerHTML = `<div style="padding:40px;color:#dc2626;font-family:sans-serif;text-align:center;">
          <h2>Export Failed</h2>
          <p>${err?.response?.data?.message || err?.message || 'Error rendering document'}</p>
        </div>`;
      } else {
        alert('PDF Print export failed: ' + (err?.message || 'Error'));
      }
    }
  };

  const handleExportMarkdown = () => {
    if (!caseNote) return;
    let md = `# AI Case Note — ${caseNote.meta?.case_title || caseTitle}\n\n`;
    md += `**SUPPORTING:** ${caseNote.meta?.case_title || caseTitle}\n`;
    md += `**Authors:** ${caseNote.meta?.authors || author || 'Case Faculty'}\n`;
    md += `**Setting:** ${caseNote.meta?.setting || 'Global'}\n`;
    md += `**Authorized for:** ${caseNote.meta?.authorized_for || 'Faculty Member, Lexicon MILE'}\n\n`;
    md += `---\n\n`;

    if (caseNote.overview) {
      md += `## 1. Case Overview\n\n`;
      md += `### Story Synopsis\n${caseNote.overview.story_synopsis}\n\n`;
      md += `### Decision Point\n> **${caseNote.overview.decision_point}**\n\n`;
      if (caseNote.overview.key_individuals) {
        md += `### Key Individuals\n| Name | Title | Role in Case |\n|---|---|---|\n`;
        caseNote.overview.key_individuals.forEach((ind: any) => {
          md += `| ${ind.name} | ${ind.title} | ${ind.role} |\n`;
        });
        md += `\n`;
      }
      if (caseNote.overview.contextual_facts) {
        md += `### Key Contextual Facts\n`;
        caseNote.overview.contextual_facts.forEach((f: string) => {
          md += `- ${f}\n`;
        });
        md += `\n`;
      }
    }

    if (caseNote.learning_objectives) {
      md += `## 2. Learning Objectives\n\n`;
      caseNote.learning_objectives.forEach((obj: string) => {
        md += `${obj}\n`;
      });
      md += `\n`;
    }

    if (caseNote.theory_and_frameworks) {
      md += `## 3. Theory and Frameworks\n\n`;
      caseNote.theory_and_frameworks.forEach((t: any, i: number) => {
        md += `### ${i + 1}. ${t.framework_name}\n*Pedagogical purpose:* ${t.pedagogical_purpose}\n\n`;
      });
    }

    if (caseNote.discussion_plan?.pastures) {
      md += `## 4. Discussion Plan (${caseNote.discussion_plan.assumed_format || '80-min session'})\n\n`;
      caseNote.discussion_plan.pastures.forEach((p: any) => {
        md += `### Pasture ${p.pasture_number}: ${p.title} (${p.estimated_time})\n`;
        md += `*Framing:* ${p.framing}\n\n`;
        p.questions?.forEach((q: any) => {
          md += `#### Question ${q.question_id}: ${q.question_text}\n\n`;
          if (q.expected_responses?.encourage) {
            md += `- **Encourage:** ${q.expected_responses.encourage}\n`;
          }
          if (q.expected_responses?.redirect) {
            md += `- **Redirect:** ${q.expected_responses.redirect}\n`;
          }
          if (q.analysis) {
            md += `\n**Analysis:** ${q.analysis}\n\n`;
          }
        });
      });
    }

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AI_Case_Note_${caseTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const caseNote = caseNoteData?.case_note;
  const isGenerating = generateMutation.isPending;

  // Render initial setup / preferences card if no case note exists yet or user clicks Reconfigure
  const showConfigForm = !caseNote || isConfiguring;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Header Banner matching Teaching Note UI */}
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-[#0f294a] to-slate-950 text-white p-6 md:p-8 shadow-xl relative overflow-hidden border border-slate-800">
        {/* Glow decoration */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none -ml-10 -mb-10" />

        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-indigo-300">
                <Sparkles className="h-6 w-6 text-amber-400 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl md:text-2xl font-black tracking-tight text-white">
                    AI Case Note Generator
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950">
                    BETA
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-medium">
                  Comprehensive Pedagogical Teaching Note Specification
                </p>
              </div>
            </div>

            {caseNote && !showConfigForm && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsConfiguring(true)}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-white/10"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Customize Preferences</span>
                </button>
              </div>
            )}
          </div>

          <p className="text-xs md:text-sm text-slate-300 leading-relaxed max-w-3xl">
            Generate an authoritative, classroom-tested Teaching Note that equips instructors with discussion pastures, Socratic questions, board plan matrices, in-class activities, and career-specific takeaways.
          </p>

          {/* AI Case Note inclusions summary pill checklist */}
          <div className="pt-2 border-t border-white/10">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">
              AI Case Notes include the following pedagogical assets:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs text-slate-200">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span>Summary of the central problem</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span>Brief list of learning objectives</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span>Suggested case discussion flow (Pastures 1–4)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span>In-class activity & quick poll ideas</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span>Board plan & stakeholder repair matrix</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span>Protagonists and key individual roles</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Preferences & Generation Card (When configuring or initial state) */}
      {showConfigForm && (
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 md:p-8 space-y-6 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                <Layers className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Teaching Note Customization Preferences
              </h3>
            </div>
            {caseNote && (
              <button
                onClick={() => setIsConfiguring(false)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Duration Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-indigo-500" />
                <span>Classroom Session Duration</span>
              </label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                {DURATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Course Focus */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5 text-indigo-500" />
                <span>Target Course Discipline</span>
              </label>
              <select
                value={courseFocus}
                onChange={(e) => setCourseFocus(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                {COURSE_FOCUS_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Custom Instructor Emphasis / Prompt */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                <span>Custom Instructor Focus / Socratic Prompt (Optional)</span>
              </span>
              <span className="text-[11px] text-slate-400 font-normal">
                e.g. &quot;Emphasize board independence and reverse-scale integration&quot;
              </span>
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Add specific topics, exhibits, or questions you want the AI Case Note to emphasize during classroom discussion..."
              rows={3}
              className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => generateMutation.mutate()}
              disabled={isGenerating}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-black shadow-lg shadow-indigo-500/25 transition-all hover:scale-105 active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Synthesizing Teaching Note...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  <span>Generate AI Case Note</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 3. Main Case Note Viewer when generated */}
      {caseNote && (
        <div className="space-y-6">
          {/* Executive Export Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-[11px] font-extrabold tracking-wider uppercase border border-red-200 dark:border-red-800 flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" /> Do Not Copy or Post
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Authorized for {caseNote.meta?.authorized_for || 'Faculty Member, Lexicon MILE'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportHTMLOrPDF}
                className="px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/50 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer"
                title="Print-ready Teaching Note PDF"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>PDF (Print / Export)</span>
              </button>

              <button
                onClick={handleExportDOCX}
                className="px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer"
                title="Download formatted Microsoft Word document"
              >
                <FileDown className="h-3.5 w-3.5" />
                <span>DOCX (Word)</span>
              </button>

              <button
                onClick={handleExportMarkdown}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer"
                title="Download Markdown for LMS"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>.MD</span>
              </button>
            </div>
          </div>

          {/* Section Quick Nav Filter */}
          <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
            {[
              { id: 'all', label: 'Complete Teaching Note' },
              { id: 'overview', label: '1. Overview & Protagonists' },
              { id: 'objectives', label: '2. Objectives & Why Teach' },
              { id: 'theories', label: '3. Theory & Frameworks' },
              { id: 'strategy', label: '4. Classroom Strategy' },
              { id: 'pastures', label: '5. Socratic Discussion Plan' },
              { id: 'takeaways', label: '6. Career Takeaways' },
              { id: 'alternatives', label: '7. Alternative Approaches' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeSection === tab.id
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 4. Document Body */}
          <div className="space-y-8">
            {/* Header Box */}
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 md:p-8 space-y-4 shadow-sm">
              <div className="space-y-1">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-red-600 dark:text-red-400">
                  Do Not Copy or Post
                </div>
                <div className="text-xs text-slate-400 italic">
                  Case Note created for {caseNote.meta?.authorized_for || 'Faculty Member, Lexicon MILE'} on {caseNote.meta?.generated_timestamp}
                </div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white pt-1">
                  AI Case Note — {caseNote.meta?.case_title || caseTitle}
                </h1>
                <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  SUPPORTING: {caseNote.meta?.case_title || caseTitle} by {caseNote.meta?.authors || author || 'Case Faculty'}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border-l-4 border-indigo-600 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                This Case Note is authorized for <strong>{caseNote.meta?.authorized_for || 'Faculty Member, Lexicon MILE'}</strong>.<br />
                <span className="text-[11px] text-slate-400">
                  This case note was created by generative AI. Although we strive for accuracy, its responses may be inaccurate or incomplete. Please review all information provided carefully.
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-bold text-slate-700 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800">
                <span>Case: <strong className="font-mono text-indigo-600 dark:text-indigo-400">{caseNote.meta?.case_code || productNumber || '9-114-049'}</strong></span>
                <span>•</span>
                <span>Authors: <strong>{caseNote.meta?.authors || author}</strong></span>
                <span>•</span>
                <span>Setting: <strong>{caseNote.meta?.setting || 'India, IT Services'}</strong></span>
                <span>•</span>
                <span>Duration: <strong>{caseNote.meta?.assumed_duration || '80-minute session'}</strong></span>
              </div>
            </div>

            {/* MODULE 1: CASE OVERVIEW */}
            {(activeSection === 'all' || activeSection === 'overview') && caseNote.overview && (
              <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 md:p-8 space-y-6 shadow-sm">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900 dark:text-white">
                      1. Case Overview
                    </h2>
                    <p className="text-xs text-slate-400">Story synopsis, central decision point, key individuals, and contextual facts</p>
                  </div>
                </div>

                {/* Story Synopsis */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Story Synopsis
                  </h3>
                  <div className="space-y-3 text-xs md:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {caseNote.overview.story_synopsis.split('\n\n').map((p: string, idx: number) => (
                      <p key={idx} className="text-justify leading-relaxed">{p}</p>
                    ))}
                  </div>
                </div>

                {/* Decision Point Box */}
                {caseNote.overview.decision_point && (
                  <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border-l-4 border-indigo-600 space-y-1.5">
                    <div className="text-[11px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                      <Target className="h-3.5 w-3.5" />
                      <span>The Central Decision Point</span>
                    </div>
                    <p className="text-xs md:text-sm font-bold text-slate-900 dark:text-white leading-relaxed">
                      {caseNote.overview.decision_point}
                    </p>
                  </div>
                )}

                {/* Key Individuals Table */}
                {caseNote.overview.key_individuals && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-indigo-500" />
                      <span>Key Individuals & Protagonists</span>
                    </h3>
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                            <th className="py-3 px-4 font-black w-1/4">Name</th>
                            <th className="py-3 px-4 font-black w-1/3">Title</th>
                            <th className="py-3 px-4 font-black">Role in Case</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {caseNote.overview.key_individuals.map((ind: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{ind.name}</td>
                              <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{ind.title}</td>
                              <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{ind.role}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Contextual Facts & Red Herrings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  {caseNote.overview.contextual_facts && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        <span>Key Facts Front-of-Mind</span>
                      </h3>
                      <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                        {caseNote.overview.contextual_facts.map((fact: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                            <span>{fact}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {caseNote.overview.red_herrings && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        <span>Red Herrings & Analytical Traps</span>
                      </h3>
                      <ul className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                        {caseNote.overview.red_herrings.map((rh: any, idx: number) => (
                          <li key={idx} className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 space-y-1">
                            <div className="font-bold text-amber-900 dark:text-amber-200">
                              ⚠️ {rh.trap}
                            </div>
                            <div className="text-[11px] text-slate-600 dark:text-slate-400">
                              {rh.guidance}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* MODULE 2: LEARNING OBJECTIVES & WHY TEACH */}
            {(activeSection === 'all' || activeSection === 'objectives') && (
              <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 md:p-8 space-y-6 shadow-sm">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900 dark:text-white">
                      2. Learning Objectives & Why Teach This Case
                    </h2>
                    <p className="text-xs text-slate-400">Target pedagogical competencies and curricular placement</p>
                  </div>
                </div>

                {caseNote.learning_objectives && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      By the end of class, students should be able to:
                    </h3>
                    <div className="space-y-2.5">
                      {caseNote.learning_objectives.map((obj: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-3 p-3 rounded-2xl bg-purple-50/40 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-600 text-white font-bold text-[11px]">
                            {idx + 1}
                          </span>
                          <span className="text-xs md:text-sm text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                            {obj.replace(/^(\d+[\.\)\-:]|\•)\s*/, '')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {caseNote.why_teach_this_case && (
                  <div className="space-y-3 pt-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Why Teach This Case
                    </h3>
                    {caseNote.why_teach_this_case.overview && (
                      <p className="text-xs md:text-sm text-slate-700 dark:text-slate-300 leading-relaxed text-justify">
                        {caseNote.why_teach_this_case.overview}
                      </p>
                    )}
                    {caseNote.why_teach_this_case.suitable_courses && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {caseNote.why_teach_this_case.suitable_courses.map((c: string, idx: number) => (
                          <span key={idx} className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
                            <GraduationCap className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                            <span>{c}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    {caseNote.why_teach_this_case.setting_significance && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 italic pt-1">
                        {caseNote.why_teach_this_case.setting_significance}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* MODULE 3: THEORY AND FRAMEWORKS */}
            {(activeSection === 'all' || activeSection === 'theories') && caseNote.theory_and_frameworks && (
              <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 md:p-8 space-y-6 shadow-sm">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                    <Compass className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900 dark:text-white">
                      3. Theory and Frameworks
                    </h2>
                    <p className="text-xs text-slate-400">Academic models and their explicit classroom pedagogical purposes</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {caseNote.theory_and_frameworks.map((t: any, idx: number) => (
                    <div key={idx} className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                          {idx + 1}
                        </span>
                        <h4 className="text-xs font-black text-slate-900 dark:text-white">
                          {t.framework_name}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed text-justify">
                        <strong className="text-indigo-600 dark:text-indigo-400">Pedagogical Purpose:</strong> {t.pedagogical_purpose}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* MODULE 4: CLASSROOM STRATEGY */}
            {(activeSection === 'all' || activeSection === 'strategy') && caseNote.classroom_strategy?.activities && (
              <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 md:p-8 space-y-6 shadow-sm">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900 dark:text-white">
                      4. Classroom Strategy & In-Class Activities
                    </h2>
                    <p className="text-xs text-slate-400">Pre-discussion mappings, live polls, and active debate exercises</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {caseNote.classroom_strategy.activities.map((act: any, idx: number) => (
                    <div key={idx} className="p-5 rounded-2xl bg-emerald-50/30 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/80 space-y-3">
                      <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="p-1 rounded-md bg-emerald-600 text-white text-[10px]">ACT {idx + 1}</span>
                        <span>{act.title}</span>
                      </h3>
                      {act.setup && (
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                          <strong className="text-emerald-700 dark:text-emerald-300">Setup:</strong> {act.setup}
                        </p>
                      )}
                      {act.implementation && (
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                          <strong className="text-emerald-700 dark:text-emerald-300">Implementation:</strong> {act.implementation}
                        </p>
                      )}
                      {act.why_it_works && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 italic">
                          <strong>Why it works:</strong> {act.why_it_works}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* MODULE 5: SOCRATIC DISCUSSION PLAN (PASTURES 1 TO 4) */}
            {(activeSection === 'all' || activeSection === 'pastures') && caseNote.discussion_plan && (
              <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 md:p-8 space-y-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                      <MessageSquareIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-900 dark:text-white">
                        5. Discussion Plan & Socratic Probing
                      </h2>
                      <p className="text-xs text-slate-400">Assumed format: {caseNote.discussion_plan.assumed_format || '80-minute in-person session'}</p>
                    </div>
                  </div>

                  {/* Pasture Tabs */}
                  <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
                    {(caseNote.discussion_plan.pastures || []).map((past: any) => (
                      <button
                        key={past.pasture_number}
                        onClick={() => setActivePastureTab(past.pasture_number)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          activePastureTab === past.pasture_number
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        Pasture {past.pasture_number}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Active Pasture Details */}
                {(() => {
                  const past = (caseNote.discussion_plan.pastures || []).find(
                    (p: any) => p.pasture_number === activePastureTab
                  ) || caseNote.discussion_plan.pastures?.[0];

                  if (!past) return null;

                  return (
                    <div className="space-y-6 animate-fadeIn">
                      <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-black text-indigo-900 dark:text-indigo-200">
                            Pasture {past.pasture_number}: {past.title}
                          </h3>
                          <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 text-[11px] font-bold">
                            {past.estimated_time}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300 italic">
                          <strong>Framing for instructor:</strong> {past.framing}
                        </p>
                      </div>

                      {/* Questions */}
                      <div className="space-y-6">
                        {(past.questions || []).map((q: any, qIdx: number) => (
                          <div key={qIdx} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 bg-slate-50/40 dark:bg-slate-800/30">
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-1">
                                <span className="text-[11px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                                  Question {q.question_id}
                                </span>
                                <h4 className="text-sm md:text-base font-black text-slate-900 dark:text-white leading-snug">
                                  {q.question_text}
                                </h4>
                              </div>
                              {q.estimated_time && (
                                <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold shrink-0">
                                  {q.estimated_time}
                                </span>
                              )}
                            </div>

                            {/* Board Plan Matrix */}
                            {q.board_plan_matrix && (
                              <div className="space-y-2">
                                <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                                  <Table className="h-3.5 w-3.5 text-indigo-500" />
                                  <span>Board Plan: Interactive Matrix</span>
                                </div>
                                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                                  <table className="w-full text-left text-xs">
                                    <thead>
                                      <tr className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                                        <th className="py-2.5 px-3 font-bold">Stakeholder</th>
                                        <th className="py-2.5 px-3 font-bold">Nature of Trust Breach</th>
                                        <th className="py-2.5 px-3 font-bold">Repair Mechanism</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                      {q.board_plan_matrix.map((row: any, rIdx: number) => (
                                        <tr key={rIdx}>
                                          <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">{row.stakeholder}</td>
                                          <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{row.nature_of_breach}</td>
                                          <td className="py-2 px-3 text-slate-700 dark:text-slate-300 font-medium">{row.repair_mechanism}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* Encourage & Redirect Cards */}
                            {q.expected_responses && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                {q.expected_responses.encourage && (
                                  <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 space-y-1">
                                    <span className="text-[11px] font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1">
                                      <CheckCircle2 className="h-3 w-3" /> Encourage Responses
                                    </span>
                                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                                      {q.expected_responses.encourage}
                                    </p>
                                  </div>
                                )}

                                {q.expected_responses.redirect && (
                                  <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 space-y-1">
                                    <span className="text-[11px] font-black text-rose-800 dark:text-rose-300 uppercase tracking-wider flex items-center gap-1">
                                      <AlertTriangle className="h-3 w-3" /> Redirect Erroneous Views
                                    </span>
                                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                                      {q.expected_responses.redirect}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* If students struggle */}
                            {q.expected_responses?.if_struggling && (
                              <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200">
                                <strong>If students struggle:</strong> {q.expected_responses.if_struggling}
                              </div>
                            )}

                            {/* Deep Analysis & Framework Connection */}
                            <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 space-y-1.5">
                              {q.analysis && (
                                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                                  <strong className="text-slate-900 dark:text-white">Analysis:</strong> {q.analysis}
                                </p>
                              )}
                              {q.framework_connection && (
                                <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
                                  Framework Connection: {q.framework_connection}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Timing Summary Table */}
                {caseNote.discussion_plan.timing_summary && (
                  <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Timing Summary
                    </h3>
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                            <th className="py-2.5 px-4 font-black">Pasture</th>
                            <th className="py-2.5 px-4 font-black">Focus</th>
                            <th className="py-2.5 px-4 font-black">Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {caseNote.discussion_plan.timing_summary.map((ts: any, idx: number) => (
                            <tr key={idx} className={ts.pasture === 'Total' ? 'bg-slate-50 dark:bg-slate-800 font-bold' : ''}>
                              <td className="py-2 px-4 font-bold text-slate-900 dark:text-white">{ts.pasture}</td>
                              <td className="py-2 px-4 text-slate-700 dark:text-slate-300">{ts.focus}</td>
                              <td className="py-2 px-4 font-semibold text-indigo-600 dark:text-indigo-400">{ts.time}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MODULE 6: TAKEAWAYS & APPLICATION */}
            {(activeSection === 'all' || activeSection === 'takeaways') && caseNote.takeaways_and_application && (
              <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 md:p-8 space-y-6 shadow-sm">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
                    <Award className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900 dark:text-white">
                      6. Takeaways & Application (Career-Tailored Learnings)
                    </h2>
                    <p className="text-xs text-slate-400">Transferable executive mental models mapped to specific student career paths</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Strategy & Consulting */}
                  {caseNote.takeaways_and_application.strategy_and_consulting && (
                    <div className="p-5 rounded-2xl bg-blue-50/40 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/60 space-y-3">
                      <h3 className="text-xs font-black uppercase tracking-wider text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                        <TrendingUpIcon className="h-3.5 w-3.5 text-blue-600" />
                        <span>Strategy, Consulting & Corp Dev</span>
                      </h3>
                      <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                        {caseNote.takeaways_and_application.strategy_and_consulting.map((item: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* General Management */}
                  {caseNote.takeaways_and_application.general_management_and_leadership && (
                    <div className="p-5 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-900/60 space-y-3">
                      <h3 className="text-xs font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-indigo-600" />
                        <span>General Management & Leadership</span>
                      </h3>
                      <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                        {caseNote.takeaways_and_application.general_management_and_leadership.map((item: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Ethics & Governance */}
                  {caseNote.takeaways_and_application.ethics_and_governance && (
                    <div className="p-5 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/60 space-y-3">
                      <h3 className="text-xs font-black uppercase tracking-wider text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                        <ShieldAlert className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Ethics & Corporate Governance</span>
                      </h3>
                      <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                        {caseNote.takeaways_and_application.ethics_and_governance.map((item: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* MODULE 7: ALTERNATIVE APPROACHES */}
            {(activeSection === 'all' || activeSection === 'alternatives') && caseNote.alternative_approaches && (
              <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 md:p-8 space-y-6 shadow-sm">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900 dark:text-white">
                      7. Alternative Approaches & Course Adaptations
                    </h2>
                    <p className="text-xs text-slate-400">Course variations for ethics-only modules, two-session sequences, and executive workshops</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {caseNote.alternative_approaches.map((alt: any, idx: number) => (
                    <div key={idx} className="p-5 rounded-2xl bg-purple-50/30 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-800/80 space-y-2">
                      <h3 className="text-sm font-black text-purple-900 dark:text-purple-200">
                        {alt.approach_name}
                      </h3>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed text-justify">
                        {alt.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Helper icons
function MessageSquareIcon(props: any) {
  return <BookOpen {...props} />;
}
function TrendingUpIcon(props: any) {
  return <Target {...props} />;
}
