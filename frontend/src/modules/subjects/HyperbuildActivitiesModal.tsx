import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  X,
  RefreshCw,
  Lock,
  Unlock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Plus,
  Pencil,
  Trash2,
  Save,
  BookOpen,
  HelpCircle,
  Wrench,
  Award,
  Briefcase,
  FileText,
  Search,
} from 'lucide-react';
import { api } from '../../lib/api';

export interface ActivityCaseStudy {
  id?: string;
  case_study_id?: string;
  title: string;
  author?: string;
  publisher_source?: string;
  industry_domain?: string;
  concept?: string; // Synopsis / Overview
  learning_objectives?: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  external_link?: string;
  discussion_questions?: string[];
  is_manual?: boolean;
}

interface ActivityTool {
  tool: string;
  category: string;
  purpose: string;
  access: string;
}

interface ActivityRubric {
  criterion: string;
  weightage?: number;
  distinction: string;
  merit: string;
  pass_grade: string;
  needs_work: string;
}

interface ActivityItem {
  id: string;
  subject_id: string;
  activity_no: number;
  title: string;
  unit_mapping?: string;
  estimated_time?: string;
  mode?: string;
  file_naming?: string;
  why_this_activity?: string;
  instructions?: string;
  ai_tools?: ActivityTool[];
  learning_outcomes?: string;
  submission_requirements?: string;
  rubric?: ActivityRubric[];
  is_released: boolean;
  released_at?: string;
  released_by?: string;
  case_study_id?: string;
  case_studies?: ActivityCaseStudy[];
}

interface Subject {
  id: string;
  name: string;
  code: string;
}

interface Props {
  subject: Subject;
  onClose: () => void;
}

// Clean Section Text Formatter for Bullets, Numbered Lists & Paragraphs
const FormattedSectionText: React.FC<{ text?: string }> = ({ text }) => {
  if (!text) return null;

  const rawLines = text
    .split(/\n|•/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (rawLines.length === 0) return null;

  return (
    <div className="space-y-2.5 text-xs">
      {rawLines.map((line, idx) => {
        const numMatch = line.match(/^(\(?\d+\)?[\.\:]?)\s*(.*)/);
        if (numMatch && numMatch[2]) {
          return (
            <div key={idx} className="flex items-start gap-2.5 leading-relaxed text-slate-800 dark:text-slate-200">
              <span className="h-5 w-5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-extrabold text-[11px] flex items-center justify-center shrink-0 mt-0.5 shadow-sm border border-indigo-200 dark:border-indigo-800">
                {numMatch[1].replace(/[\.\:\(\)]/g, '')}
              </span>
              <span className="flex-1 font-sans leading-relaxed">{numMatch[2]}</span>
            </div>
          );
        }

        const cleanLine = line.replace(/^[\-•\*\>]\s*/, '');
        return (
          <div key={idx} className="flex items-start gap-2.5 leading-relaxed text-slate-800 dark:text-slate-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0 mt-2 shadow-sm"></span>
            <span className="flex-1 font-sans leading-relaxed">{cleanLine}</span>
          </div>
        );
      })}
    </div>
  );
};

export const HyperbuildActivitiesModal: React.FC<Props> = ({ subject, onClose }) => {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  React.useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Form Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ActivityItem | null>(null);

  // Form Fields State
  const [formActivityNo, setFormActivityNo] = useState<number>(1);
  const [formTitle, setFormTitle] = useState('');
  const [formUnitMapping, setFormUnitMapping] = useState('');
  const [formEstimatedTime, setFormEstimatedTime] = useState('');
  const [formMode, setFormMode] = useState('Individual');
  const [formFileNaming, setFormFileNaming] = useState('');
  const [formWhyThisActivity, setFormWhyThisActivity] = useState('');
  const [formInstructions, setFormInstructions] = useState('');
  const [formLearningOutcomes, setFormLearningOutcomes] = useState('');
  const [formSubmissionRequirements, setFormSubmissionRequirements] = useState('');
  
  // Dynamic AI Tools, Rubric Rows, and Case Studies
  const [formAiTools, setFormAiTools] = useState<ActivityTool[]>([]);
  const [formRubric, setFormRubric] = useState<ActivityRubric[]>([]);
  const [formCaseStudies, setFormCaseStudies] = useState<ActivityCaseStudy[]>([]);

  // Modals for Attaching Case Studies
  const [isLibraryPickerOpen, setIsLibraryPickerOpen] = useState(false);
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');
  const [isManualCaseModalOpen, setIsManualCaseModalOpen] = useState(false);
  const [manualQuestionsText, setManualQuestionsText] = useState('');
  const [manualCaseForm, setManualCaseForm] = useState<ActivityCaseStudy>({
    title: '',
    author: '',
    publisher_source: 'Executive Business Scenario',
    industry_domain: 'General Management',
    concept: '',
    learning_objectives: '',
    file_url: '',
    file_name: '',
    external_link: '',
    discussion_questions: [],
    is_manual: true,
  });

  // Fetch Activities for Subject
  const { data: activitiesList = [], isLoading, refetch } = useQuery<ActivityItem[]>({
    queryKey: ['subject-activities', subject.id],
    queryFn: async () => {
      const res = await api.get(`/academic/subjects/${subject.id}/activities`);
      return res.data.data;
    },
  });

  // Fetch Library Case Studies
  const { data: libraryCases = [], isLoading: isLoadingLibrary } = useQuery<any[]>({
    queryKey: ['library_case_studies_picker'],
    queryFn: async () => {
      const res = await api.get('/case-studies');
      return res.data.data;
    },
    enabled: isLibraryPickerOpen,
  });

  // Toggle Release Mutation
  const toggleReleaseMutation = useMutation({
    mutationFn: async ({ activityId, isReleased }: { activityId: string; isReleased: boolean }) => {
      const res = await api.patch(`/academic/subjects/${subject.id}/activities/${activityId}/release`, {
        is_released: isReleased,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subject-activities', subject.id] });
    },
  });

  // Batch Release Mutation
  const batchReleaseMutation = useMutation({
    mutationFn: async ({ activityIds, isReleased }: { activityIds: string[]; isReleased: boolean }) => {
      const res = await api.post(`/academic/subjects/${subject.id}/activities/batch-release`, {
        activity_ids: activityIds,
        is_released: isReleased,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subject-activities', subject.id] });
    },
  });

  // Create Activity Mutation
  const createActivityMutation = useMutation({
    mutationFn: async (payload: Partial<ActivityItem>) => {
      const res = await api.post(`/academic/subjects/${subject.id}/activities`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subject-activities', subject.id] });
      closeForm();
    },
  });

  // Save Edit Activity Mutation
  const updateActivityMutation = useMutation({
    mutationFn: async ({ activityId, payload }: { activityId: string; payload: Partial<ActivityItem> }) => {
      const res = await api.put(`/academic/subjects/${subject.id}/activities/${activityId}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subject-activities', subject.id] });
      closeForm();
    },
  });

  // Delete Activity Mutation
  const deleteActivityMutation = useMutation({
    mutationFn: async (activityId: string) => {
      await api.delete(`/academic/subjects/${subject.id}/activities/${activityId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subject-activities', subject.id] });
    },
  });

  const openCreateForm = () => {
    setEditingActivity(null);
    setFormActivityNo(activitiesList.length + 1);
    setFormTitle('');
    setFormUnitMapping('');
    setFormEstimatedTime('3 hours');
    setFormMode('Individual');
    setFormFileNaming(`[RollNo]_LAW_Act${String(activitiesList.length + 1).padStart(2, '0')}`);
    setFormWhyThisActivity('');
    setFormInstructions('');
    setFormLearningOutcomes('');
    setFormSubmissionRequirements('');
    setFormAiTools([
      { tool: 'ChatGPT (GPT-4o)', category: 'LLM — Legal Analysis', purpose: 'Research and comparative analysis', access: 'chat.openai.com' },
    ]);
    setFormRubric([
      { criterion: 'Primary Legal & Doctrinal Accuracy', weightage: 35, distinction: 'Extensive analysis with exact statutory references.', merit: 'Good analysis with relevant references.', pass_grade: 'Basic summary.', needs_work: 'Superficial or incorrect.' },
      { criterion: 'AI-Assisted Critique with Verification', weightage: 35, distinction: 'Comprehensive prompt logs with independent citation check.', merit: 'Good AI critique with verified outputs.', pass_grade: 'Basic prompt without deep verification.', needs_work: 'Unverified AI output.' },
      { criterion: 'Business Implications & Professional Memo', weightage: 30, distinction: 'Boardroom-ready risk mitigation and strategic deal structuring.', merit: 'Clear commercial takeaways.', pass_grade: 'Generic implications.', needs_work: 'Lacks business relevance.' },
    ]);
    setFormCaseStudies([]);
    setIsFormOpen(true);
  };

  const openEditForm = (act: ActivityItem) => {
    setEditingActivity(act);
    setFormActivityNo(act.activity_no);
    setFormTitle(act.title || '');
    setFormUnitMapping(act.unit_mapping || '');
    setFormEstimatedTime(act.estimated_time || '');
    setFormMode(act.mode || 'Individual');
    setFormFileNaming(act.file_naming || '');
    setFormWhyThisActivity(act.why_this_activity || '');
    setFormInstructions(act.instructions || '');
    setFormLearningOutcomes(act.learning_outcomes || '');
    setFormSubmissionRequirements(act.submission_requirements || '');
    setFormAiTools(act.ai_tools && act.ai_tools.length > 0 ? act.ai_tools : []);
    
    // Ensure existing rubrics have a default weightage if not present
    let rawRubric: ActivityRubric[] = act.rubric && act.rubric.length > 0 ? act.rubric : [];
    if (rawRubric.length > 0) {
      const hasAnyWeight = rawRubric.some(r => r.weightage !== undefined && r.weightage !== null);
      if (!hasAnyWeight) {
        const equalShare = Math.floor(100 / rawRubric.length);
        const remainder = 100 - equalShare * rawRubric.length;
        rawRubric = rawRubric.map((r, i) => ({
          ...r,
          weightage: i === rawRubric.length - 1 ? equalShare + remainder : equalShare,
        }));
      }
    }
    setFormRubric(rawRubric);
    setFormCaseStudies(act.case_studies && act.case_studies.length > 0 ? act.case_studies : []);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingActivity(null);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Partial<ActivityItem> = {
      activity_no: formActivityNo,
      title: formTitle,
      unit_mapping: formUnitMapping,
      estimated_time: formEstimatedTime,
      mode: formMode,
      file_naming: formFileNaming,
      why_this_activity: formWhyThisActivity,
      instructions: formInstructions,
      learning_outcomes: formLearningOutcomes,
      submission_requirements: formSubmissionRequirements,
      ai_tools: formAiTools,
      rubric: formRubric,
      case_studies: formCaseStudies,
      case_study_id: formCaseStudies[0]?.id || formCaseStudies[0]?.case_study_id || undefined,
    };

    if (editingActivity) {
      updateActivityMutation.mutate({ activityId: editingActivity.id, payload });
    } else {
      createActivityMutation.mutate(payload);
    }
  };

  // Helper functions to manage AI Tools rows
  const addAiToolRow = () => {
    setFormAiTools([...formAiTools, { tool: '', category: '', purpose: '', access: '' }]);
  };
  const removeAiToolRow = (idx: number) => {
    setFormAiTools(formAiTools.filter((_, i) => i !== idx));
  };
  const updateAiToolRow = (idx: number, field: keyof ActivityTool, val: string) => {
    const updated = [...formAiTools];
    updated[idx][field] = val;
    setFormAiTools(updated);
  };

  // Helper functions to manage Rubric rows
  const addRubricRow = () => {
    const currentTotal = formRubric.reduce((acc, r) => acc + (Number(r.weightage) || 0), 0);
    const remaining = Math.max(0, 100 - currentTotal);
    setFormRubric([
      ...formRubric,
      {
        criterion: '',
        weightage: remaining > 0 ? remaining : 20,
        distinction: '',
        merit: '',
        pass_grade: '',
        needs_work: '',
      },
    ]);
  };

  const balanceRubricWeightages = () => {
    if (formRubric.length === 0) return;
    const equalShare = Math.floor(100 / formRubric.length);
    const remainder = 100 - equalShare * formRubric.length;
    const updated = formRubric.map((r, i) => ({
      ...r,
      weightage: i === formRubric.length - 1 ? equalShare + remainder : equalShare,
    }));
    setFormRubric(updated);
  };

  const removeRubricRow = (idx: number) => {
    setFormRubric(formRubric.filter((_, i) => i !== idx));
  };

  const updateRubricRow = (idx: number, field: keyof ActivityRubric, val: any) => {
    const updated = [...formRubric];
    updated[idx] = { ...updated[idx], [field]: val };
    setFormRubric(updated);
  };

  // Case Study Handlers
  const handleAttachFromLibrary = (cs: any) => {
    const newCase: ActivityCaseStudy = {
      id: cs.id,
      case_study_id: cs.id,
      title: cs.title,
      author: cs.author || '',
      publisher_source: cs.publisher_source || 'Library Case Study',
      industry_domain: cs.industry_domain || 'Business Strategy',
      concept: cs.concept || '',
      learning_objectives: cs.learning_objectives || '',
      file_url: cs.file_url || '',
      file_name: cs.file_name || '',
      file_size: cs.file_size || 0,
      external_link: cs.external_link || '',
      is_manual: false,
    };
    // Avoid duplicates
    if (!formCaseStudies.some((c) => (c.id === cs.id || c.case_study_id === cs.id))) {
      setFormCaseStudies([...formCaseStudies, newCase]);
    }
    setIsLibraryPickerOpen(false);
  };

  const handleSaveManualCase = () => {
    if (!manualCaseForm.title.trim()) return;
    const questions = manualQuestionsText
      .split('\n')
      .map((q) => q.trim().replace(/^[\-•\*\d+\.]\s*/, ''))
      .filter((q) => q.length > 0);

    const createdCase: ActivityCaseStudy = {
      ...manualCaseForm,
      discussion_questions: questions,
      is_manual: true,
    };
    setFormCaseStudies([...formCaseStudies, createdCase]);
    setIsManualCaseModalOpen(false);
    setManualCaseForm({
      title: '',
      author: '',
      publisher_source: 'Executive Business Scenario',
      industry_domain: 'General Management',
      concept: '',
      learning_objectives: '',
      file_url: '',
      file_name: '',
      external_link: '',
      discussion_questions: [],
      is_manual: true,
    });
    setManualQuestionsText('');
  };

  const removeCaseStudy = (idx: number) => {
    setFormCaseStudies(formCaseStudies.filter((_, i) => i !== idx));
  };

  const releasedCount = activitiesList.filter((a) => a.is_released).length;
  const totalCount = activitiesList.length;

  const handleToggleAll = (release: boolean) => {
    const ids = activitiesList.map((a) => a.id);
    batchReleaseMutation.mutate({ activityIds: ids, isReleased: release });
  };

  const filteredLibraryCases = libraryCases.filter((c: any) => {
    if (!librarySearchQuery.trim()) return true;
    const q = librarySearchQuery.toLowerCase();
    return (
      c.title?.toLowerCase().includes(q) ||
      c.publisher_source?.toLowerCase().includes(q) ||
      c.industry_domain?.toLowerCase().includes(q) ||
      c.concept?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Interactive Learning Activities & Case Studies — {subject.name}
                <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800">
                  {subject.code}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage structured learning activities, attached case studies, recommended AI tools, and evaluation rubrics.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={openCreateForm}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-indigo-500/20 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Add Activity
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Global Action Bar */}
        <div className="px-6 py-3 bg-slate-100/60 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-600 dark:text-slate-400">Status:</span>
            <span className="font-bold text-slate-900 dark:text-white">
              {releasedCount} of {totalCount} Activities Released to Students
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleToggleAll(true)}
              disabled={batchReleaseMutation.isPending || releasedCount === totalCount}
              className="px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-all disabled:opacity-50 flex items-center gap-1 cursor-pointer"
            >
              <Unlock className="h-3.5 w-3.5" /> Release All
            </button>
            <button
              onClick={() => handleToggleAll(false)}
              disabled={batchReleaseMutation.isPending || releasedCount === 0}
              className="px-3 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800 hover:bg-amber-100 transition-all disabled:opacity-50 flex items-center gap-1 cursor-pointer"
            >
              <Lock className="h-3.5 w-3.5" /> Lock All (Faculty Only)
            </button>
            <button
              onClick={() => refetch()}
              className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
              title="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Scrollable Activity List */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {isLoading ? (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-indigo-500" />
              <span>Loading HyperBuild activities...</span>
            </div>
          ) : activitiesList.length === 0 ? (
            <div className="p-12 text-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl space-y-3">
              <Sparkles className="h-8 w-8 mx-auto text-slate-400" />
              <p className="font-semibold text-slate-600 dark:text-slate-300">No activities found for this subject.</p>
              <button
                onClick={openCreateForm}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="h-4 w-4" /> Create First Activity
              </button>
            </div>
          ) : (
            activitiesList.map((act) => {
              const isExpanded = expandedId === act.id;
              const caseStudiesCount = act.case_studies?.length || 0;

              return (
                <div
                  key={act.id}
                  className={`rounded-2xl border transition-all ${
                    act.is_released
                      ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/10 dark:bg-emerald-950/10'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                  }`}
                >
                  {/* Header Row */}
                  <div className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-extrabold flex items-center justify-center text-sm shrink-0 border border-indigo-200 dark:border-indigo-800">
                        {act.activity_no}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {act.title}
                          </h4>
                          {caseStudiesCount > 0 && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                              <Briefcase className="h-3 w-3" /> {caseStudiesCount} Case Study{caseStudiesCount > 1 ? 'ies' : ''}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex-wrap">
                          {act.unit_mapping && <span>{act.unit_mapping}</span>}
                          {act.estimated_time && <span>• {act.estimated_time}</span>}
                          {act.file_naming && (
                            <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">
                              {act.file_naming}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() =>
                          toggleReleaseMutation.mutate({ activityId: act.id, isReleased: !act.is_released })
                        }
                        disabled={toggleReleaseMutation.isPending}
                        className={`px-3 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1 transition-all ${
                          act.is_released
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                            : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                        }`}
                        title="Click to toggle release status"
                      >
                        {act.is_released ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                        <span>{act.is_released ? 'RELEASED' : 'LOCKED'}</span>
                      </button>

                      <button
                        onClick={() => openEditForm(act)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Edit Activity"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete Activity #${act.activity_no}?`)) {
                            deleteActivityMutation.mutate(act.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Delete Activity"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => setExpandedId(isExpanded ? null : act.id)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-4 bg-slate-50/50 dark:bg-slate-800/20 text-xs">
                      {/* Attached Case Studies Preview */}
                      {act.case_studies && act.case_studies.length > 0 && (
                        <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 space-y-2.5">
                          <h5 className="font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                            <Briefcase className="h-3.5 w-3.5 text-amber-600" /> Attached Case Studies ({act.case_studies.length})
                          </h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {act.case_studies.map((cs, idx) => (
                              <div key={idx} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-amber-200/60 dark:border-amber-900/50 space-y-1.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                    {cs.publisher_source || 'Case Study'}
                                  </span>
                                  {cs.industry_domain && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                      {cs.industry_domain}
                                    </span>
                                  )}
                                </div>
                                <h6 className="font-bold text-slate-900 dark:text-white text-xs">{cs.title}</h6>
                                {cs.concept && (
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">{cs.concept}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {act.why_this_activity && (
                        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                          <h5 className="font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider text-[10px] flex items-center gap-1">
                            <HelpCircle className="h-3 w-3 text-amber-600" /> Why This Activity
                          </h5>
                          <FormattedSectionText text={act.why_this_activity} />
                        </div>
                      )}

                      {act.instructions && (
                        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                          <h5 className="font-bold text-indigo-800 dark:text-indigo-400 uppercase tracking-wider text-[10px] flex items-center gap-1">
                            <BookOpen className="h-3 w-3 text-indigo-600" /> Step-by-Step Instructions
                          </h5>
                          <FormattedSectionText text={act.instructions} />
                        </div>
                      )}

                      {act.ai_tools && act.ai_tools.length > 0 && (
                        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
                          <h5 className="font-bold text-purple-800 dark:text-purple-400 uppercase tracking-wider text-[10px] flex items-center gap-1">
                            <Wrench className="h-3 w-3 text-purple-600" /> AI Tools Required
                          </h5>
                          <div className="flex flex-wrap gap-2">
                            {act.ai_tools.map((t, idx) => (
                              <span
                                key={idx}
                                className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold border border-purple-200 dark:border-purple-800 text-[11px]"
                              >
                                {t.tool} ({t.category}) — {t.purpose}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ─── CREATE / EDIT ACTIVITY MODAL ────────────────────────────────────── */}
      {isFormOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
              <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {editingActivity ? (
                  <>
                    <Pencil className="h-4 w-4 text-indigo-600" /> Edit HyperBuild Activity #{editingActivity.activity_no}
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 text-indigo-600" /> Create New HyperBuild Activity
                  </>
                )}
              </h4>
              <button onClick={closeForm} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
              {/* Basic Meta */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Activity No</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={20}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold"
                    value={formActivityNo}
                    onChange={(e) => setFormActivityNo(Number(e.target.value))}
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Activity Title</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold"
                    placeholder="e.g. Amazon v. Future Retail Case Lab — Emergency Arbitration"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Unit Mapping</label>
                  <input
                    type="text"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                    placeholder="e.g. Unit 1 — Foundations of Business Law"
                    value={formUnitMapping}
                    onChange={(e) => setFormUnitMapping(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Estimated Time</label>
                  <input
                    type="text"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                    placeholder="e.g. 3–4 hours"
                    value={formEstimatedTime}
                    onChange={(e) => setFormEstimatedTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">File Naming Format</label>
                  <input
                    type="text"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
                    placeholder="e.g. [RollNo]_LAW_Act01"
                    value={formFileNaming}
                    onChange={(e) => setFormFileNaming(e.target.value)}
                  />
                </div>
              </div>

              {/* ─── CASE STUDIES ATTACHMENT SECTION ──────────────────────── */}
              <div className="space-y-3 p-4 rounded-2xl bg-gradient-to-r from-amber-50/70 to-orange-50/50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800/60">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                      <Briefcase className="h-3.5 w-3.5 text-amber-600" /> Attached Case Studies & Real-World Scenarios ({formCaseStudies.length})
                    </label>
                    <p className="text-[11px] text-amber-800/80 dark:text-amber-400 mt-0.5">
                      Select cases from the college Case Library or author a custom case scenario for this lab.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsLibraryPickerOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Search className="h-3.5 w-3.5" /> From Case Library
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsManualCaseModalOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-slate-700 text-amber-900 dark:text-amber-200 font-bold text-xs border border-amber-300 dark:border-amber-700 shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Custom Case
                    </button>
                  </div>
                </div>

                {formCaseStudies.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 bg-white/60 dark:bg-slate-900/60 border border-dashed border-amber-200 dark:border-amber-900/60 rounded-xl">
                    <p className="text-xs font-semibold text-amber-900/70 dark:text-amber-300">
                      No case study attached to this activity. Click "From Case Library" or "Add Custom Case" above.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {formCaseStudies.map((cs, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-900/50 shadow-xs space-y-2 relative group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              {cs.publisher_source || 'Case Study'}
                            </span>
                            {cs.industry_domain && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                {cs.industry_domain}
                              </span>
                            )}
                            {cs.is_manual && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                                Custom Author
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCaseStudy(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition-colors"
                            title="Remove Case Study"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <h5 className="font-bold text-slate-900 dark:text-white text-xs leading-snug">
                          {cs.title}
                        </h5>

                        {cs.concept && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                            {cs.concept}
                          </p>
                        )}

                        {cs.file_name && (
                          <div className="flex items-center gap-1 text-[10.5px] text-indigo-600 dark:text-indigo-400 font-medium">
                            <FileText className="h-3 w-3" />
                            <span>Attachment: {cs.file_name}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Why This Activity */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Why This Activity (Objective / Rationale)</label>
                <textarea
                  rows={4}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white leading-relaxed font-sans"
                  placeholder="Explain why students are doing this activity and its business relevance..."
                  value={formWhyThisActivity}
                  onChange={(e) => setFormWhyThisActivity(e.target.value)}
                />
              </div>

              {/* Step-by-Step Instructions */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Step-by-Step Instructions</label>
                <textarea
                  rows={5}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white leading-relaxed font-sans"
                  placeholder="Provide step-by-step instructions (1. Locate judgment... 2. Write summary...)"
                  value={formInstructions}
                  onChange={(e) => setFormInstructions(e.target.value)}
                />
              </div>

              {/* DYNAMIC EDITOR: AI Tools & Platforms */}
              <div className="space-y-2 p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-800/40">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                    <Wrench className="h-3.5 w-3.5 text-purple-600" /> AI Tools & Platforms Required
                  </label>
                  <button
                    type="button"
                    onClick={addAiToolRow}
                    className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-sm"
                  >
                    <Plus className="h-3 w-3" /> Add AI Tool
                  </button>
                </div>

                {formAiTools.length === 0 ? (
                  <p className="text-slate-500 text-[11px] italic">No AI tools defined. Click "Add AI Tool" to add tools.</p>
                ) : (
                  <div className="space-y-2">
                    {formAiTools.map((t, idx) => (
                      <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-purple-100 dark:border-purple-900/50">
                        <input
                          type="text"
                          placeholder="Tool Name (e.g. ChatGPT)"
                          className="md:col-span-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white font-bold"
                          value={t.tool}
                          onChange={(e) => updateAiToolRow(idx, 'tool', e.target.value)}
                        />
                        <input
                          type="text"
                          placeholder="Category (e.g. LLM)"
                          className="md:col-span-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white"
                          value={t.category}
                          onChange={(e) => updateAiToolRow(idx, 'category', e.target.value)}
                        />
                        <input
                          type="text"
                          placeholder="Purpose in activity"
                          className="md:col-span-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white"
                          value={t.purpose}
                          onChange={(e) => updateAiToolRow(idx, 'purpose', e.target.value)}
                        />
                        <input
                          type="text"
                          placeholder="How to Access"
                          className="md:col-span-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white font-mono text-[10px]"
                          value={t.access}
                          onChange={(e) => updateAiToolRow(idx, 'access', e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => removeAiToolRow(idx)}
                          className="md:col-span-1 p-1 text-slate-400 hover:text-rose-600 flex justify-center"
                          title="Remove Tool"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Learning Outcomes & Submission Requirements */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Learning Outcomes</label>
                  <textarea
                    rows={4}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white leading-relaxed"
                    placeholder="List learning outcomes..."
                    value={formLearningOutcomes}
                    onChange={(e) => setFormLearningOutcomes(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Assessment Task & Submission Requirements</label>
                  <textarea
                    rows={4}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white leading-relaxed"
                    placeholder="List submission requirements..."
                    value={formSubmissionRequirements}
                    onChange={(e) => setFormSubmissionRequirements(e.target.value)}
                  />
                </div>
              </div>

              {/* DYNAMIC EDITOR: Grading Rubric */}
              <div className="space-y-3 p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <label className="font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                      <Award className="h-3.5 w-3.5 text-amber-600" /> Grading Rubric & Criteria Weightage
                    </label>
                    {(() => {
                      const totalWeight = formRubric.reduce((acc, r) => acc + (Number(r.weightage) || 0), 0);
                      const isBalanced = totalWeight === 100;
                      return (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                            isBalanced
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                              : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                          }`}
                        >
                          {isBalanced ? '✓ Total: 100% (100 Marks)' : `⚠ Total: ${totalWeight}% / 100%`}
                        </span>
                      );
                    })()}
                  </div>

                  <div className="flex items-center gap-2">
                    {formRubric.length > 0 && (
                      <button
                        type="button"
                        onClick={balanceRubricWeightages}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-slate-700 text-amber-900 dark:text-amber-200 text-[11px] font-bold border border-amber-200 dark:border-amber-800 shadow-xs cursor-pointer"
                        title="Distribute 100% weightage equally across all criteria"
                      >
                        ⚖ Balance Evenly
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={addRubricRow}
                      className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-sm cursor-pointer"
                    >
                      <Plus className="h-3 w-3" /> Add Rubric Criterion
                    </button>
                  </div>
                </div>

                {formRubric.length === 0 ? (
                  <p className="text-slate-500 text-[11px] italic">No rubric criteria defined. Click "Add Rubric Criterion" to add rubric rows.</p>
                ) : (
                  <div className="space-y-3">
                    {formRubric.map((r, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-200/60 dark:border-amber-900/50 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                            Criterion #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeRubricRow(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                            title="Remove Criterion"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Criterion Name + Weightage input */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                          <div className="md:col-span-9">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                              Criterion Title
                            </label>
                            <input
                              type="text"
                              placeholder="Criterion Name (e.g. Legal Analysis Depth)"
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white font-bold text-xs"
                              value={r.criterion}
                              onChange={(e) => updateRubricRow(idx, 'criterion', e.target.value)}
                            />
                          </div>
                          <div className="md:col-span-3">
                            <label className="block text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-0.5">
                              Weightage (% / Marks)
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min={1}
                                max={100}
                                placeholder="35"
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white font-black text-xs pr-7"
                                value={r.weightage ?? ''}
                                onChange={(e) => updateRubricRow(idx, 'weightage', Number(e.target.value) || 0)}
                              />
                              <span className="absolute right-2.5 top-1.5 text-slate-400 font-bold text-xs pointer-events-none">%</span>
                            </div>
                          </div>
                        </div>

                        {/* 4 Performance Tiers */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-[11px] pt-1">
                          <div>
                            <label className="block text-[10px] font-bold text-emerald-600">Distinction (85-100%)</label>
                            <input
                              type="text"
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-200 text-xs"
                              value={r.distinction}
                              onChange={(e) => updateRubricRow(idx, 'distinction', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-cyan-600">Merit (70-84%)</label>
                            <input
                              type="text"
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-200 text-xs"
                              value={r.merit}
                              onChange={(e) => updateRubricRow(idx, 'merit', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-amber-600">Pass (50-69%)</label>
                            <input
                              type="text"
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-200 text-xs"
                              value={r.pass_grade}
                              onChange={(e) => updateRubricRow(idx, 'pass_grade', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-rose-600">Needs Work (&lt;50%)</label>
                            <input
                              type="text"
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-200 text-xs"
                              value={r.needs_work}
                              onChange={(e) => updateRubricRow(idx, 'needs_work', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Form Footer */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createActivityMutation.isPending || updateActivityMutation.isPending}
                  className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1.5 shadow-md shadow-indigo-500/20 disabled:opacity-50 cursor-pointer"
                >
                  <Save className="h-4 w-4" /> {editingActivity ? 'Save Changes' : 'Create Activity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── CASE STUDY LIBRARY PICKER MODAL ─────────────────────────────────── */}
      {isLibraryPickerOpen && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-amber-600" />
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                  Select Case Study from College Library
                </h4>
              </div>
              <button onClick={() => setIsLibraryPickerOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-100 dark:border-slate-800">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by title, publisher, domain or keywords..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                  value={librarySearchQuery}
                  onChange={(e) => setLibrarySearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {isLoadingLibrary ? (
                <div className="py-8 text-center text-slate-400 flex flex-col items-center gap-2">
                  <RefreshCw className="h-5 w-5 animate-spin text-amber-500" />
                  <span className="text-xs">Fetching library case studies...</span>
                </div>
              ) : filteredLibraryCases.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No matching case studies found in library.
                </div>
              ) : (
                filteredLibraryCases.map((cs: any) => {
                  const isAlreadyAttached = formCaseStudies.some((c) => c.id === cs.id || c.case_study_id === cs.id);
                  return (
                    <div
                      key={cs.id}
                      className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:border-amber-300 dark:hover:border-amber-700 transition-all flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            {cs.publisher_source || 'Library Case'}
                          </span>
                          {cs.industry_domain && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              {cs.industry_domain}
                            </span>
                          )}
                          {cs.file_name && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center gap-0.5">
                              <FileText className="h-2.5 w-2.5" /> PDF/Doc
                            </span>
                          )}
                        </div>
                        <h5 className="font-bold text-slate-900 dark:text-white text-xs leading-snug">
                          {cs.title}
                        </h5>
                        {cs.concept && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                            {cs.concept}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={isAlreadyAttached}
                        onClick={() => handleAttachFromLibrary(cs)}
                        className={`px-3.5 py-1.5 rounded-xl font-bold text-xs shrink-0 transition-all ${
                          isAlreadyAttached
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                            : 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm cursor-pointer'
                        }`}
                      >
                        {isAlreadyAttached ? 'Attached' : 'Attach'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── MANUAL / CUSTOM CASE STUDY MODAL ─────────────────────────────────── */}
      {isManualCaseModalOpen && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-amber-600" />
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                  Author Custom Case Study / Decision Scenario
                </h4>
              </div>
              <button onClick={() => setIsManualCaseModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Case Study Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Zepto Quick Commerce Unit Economics & Dark Store Expansion"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold"
                  value={manualCaseForm.title}
                  onChange={(e) => setManualCaseForm({ ...manualCaseForm, title: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Company / Author</label>
                  <input
                    type="text"
                    placeholder="e.g. Zepto / Prof. Sharma"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                    value={manualCaseForm.author || ''}
                    onChange={(e) => setManualCaseForm({ ...manualCaseForm, author: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Industry / Domain</label>
                  <input
                    type="text"
                    placeholder="e.g. E-Commerce & Supply Chain"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                    value={manualCaseForm.industry_domain || ''}
                    onChange={(e) => setManualCaseForm({ ...manualCaseForm, industry_domain: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Publisher / Source Tag</label>
                <input
                  type="text"
                  placeholder="e.g. Executive Business Scenario / Custom Harvard Style"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  value={manualCaseForm.publisher_source || ''}
                  onChange={(e) => setManualCaseForm({ ...manualCaseForm, publisher_source: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Case Narrative / Synopsis / Scenario Narrative *</label>
                <textarea
                  rows={6}
                  required
                  placeholder="Enter the complete business scenario, background, competitive dilemma, and strategic trade-offs..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white leading-relaxed"
                  value={manualCaseForm.concept || ''}
                  onChange={(e) => setManualCaseForm({ ...manualCaseForm, concept: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Discussion & Strategic Questions (One per line)</label>
                <textarea
                  rows={4}
                  placeholder="1. How can Zepto achieve contribution margin positivity?&#10;2. Evaluate the dark store density trade-off..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white leading-relaxed"
                  value={manualQuestionsText}
                  onChange={(e) => setManualQuestionsText(e.target.value)}
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">External Resource / Reference URL</label>
                <input
                  type="url"
                  placeholder="https://hbr.org/case/... or https://..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono text-[11px]"
                  value={manualCaseForm.external_link || ''}
                  onChange={(e) => setManualCaseForm({ ...manualCaseForm, external_link: e.target.value })}
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50/50 dark:bg-slate-800/40">
              <button
                type="button"
                onClick={() => setIsManualCaseModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveManualCase}
                disabled={!manualCaseForm.title.trim()}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" /> Attach to Activity
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
