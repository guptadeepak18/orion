import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Mail,
  Plus,
  Search,
  RotateCcw,
  Send,
  CheckCircle2,
  AlertCircle,
  X,
  Smartphone,
  Monitor,
  Sparkles,
  Code,
  Sliders,
  Palette,
  FileText,
  Upload,
  Layers,
  LayoutTemplate,
  Type,
  Link2,
  Shield,
  Eye,
  Paperclip,
} from 'lucide-react';
import { api } from '../../lib/api';

interface EmailTemplate {
  id: string;
  event_key: string;
  name: string;
  category: string;
  description?: string;
  subject: string;
  html_content: string;
  plain_text_content?: string;
  variables: string[];
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  'All',
  'Authentication & Onboarding',
  'Student Lifecycle',
  'Faculty & Sessions',
  'Academic & Attendance',
  'Academic & LMS',
  'Corporate Relations & Placement',
  'Custom & Broadcast',
];

const GRADIENT_PRESETS = [
  { id: 'cyan', label: 'Ocean Cyan', from: '#0e7490', to: '#06b6d4', text: '#cffafe' },
  { id: 'emerald', label: 'Emerald Green', from: '#059669', to: '#10b981', text: '#d1fae5' },
  { id: 'indigo', label: 'Royal Indigo', from: '#4338ca', to: '#6366f1', text: '#e0e7ff' },
  { id: 'amber', label: 'Amber Alert', from: '#d97706', to: '#f59e0b', text: '#fef3c7' },
  { id: 'rose', label: 'Rose Danger', from: '#e11d48', to: '#f43f5e', text: '#ffe4e6' },
  { id: 'purple', label: 'Vibrant Purple', from: '#7c3aed', to: '#a855f7', text: '#f3e8ff' },
  { id: 'teal', label: 'Corporate Teal', from: '#0f766e', to: '#14b8a6', text: '#ccfbf1' },
  { id: 'slate', label: 'Midnight Slate', from: '#0f172a', to: '#334155', text: '#e2e8f0' },
];

interface VisualEmailState {
  headerTitle: string;
  headerSubtitle: string;
  headerTheme: string;
  greeting: string;
  bodyParagraph1: string;
  bodyParagraph2: string;
  calloutType: 'none' | 'info' | 'success' | 'warning' | 'alert';
  calloutTitle: string;
  calloutPoints: string[];
  showDataGrid: boolean;
  dataGridTitle: string;
  dataGridRows: { label: string; value: string }[];
  showButton: boolean;
  buttonText: string;
  buttonUrl: string;
  buttonColor: string;
  footerSignOff: string;
  footerTeam: string;
}

const DEFAULT_VISUAL_STATE: VisualEmailState = {
  headerTitle: '{{title}}',
  headerSubtitle: '{{app_name}} — Campus Notification',
  headerTheme: 'cyan',
  greeting: 'Dear {{full_name}},',
  bodyParagraph1: 'We are pleased to share an important announcement regarding your academic journey with us.',
  bodyParagraph2: 'Please review the scheduled dates, venue instructions, and compliance requirements below.',
  calloutType: 'info',
  calloutTitle: 'Important Highlights',
  calloutPoints: ['Mandatory for all registered students', 'Valid identification card required upon entry'],
  showDataGrid: true,
  dataGridTitle: 'Session & Activity Details',
  dataGridRows: [
    { label: 'Program', value: '{{program_name}}' },
    { label: 'Date', value: '{{session_date}}' },
    { label: 'Time', value: '{{session_time}}' },
    { label: 'Venue', value: '{{venue}}' },
  ],
  showButton: true,
  buttonText: 'View on Student Portal →',
  buttonUrl: '{{action_url}}',
  buttonColor: '#0891b2',
  footerSignOff: 'Warm regards,',
  footerTeam: 'Academic Operations & CRC Team\nLexicon MILE',
};

// Helper: Compiles visual state to responsive HTML email markup
function compileVisualToHtml(v: VisualEmailState): string {
  const themeObj = GRADIENT_PRESETS.find((p) => p.id === v.headerTheme) || GRADIENT_PRESETS[0];

  let calloutHtml = '';
  if (v.calloutType !== 'none') {
    const bgMap = {
      info: '#f0f9ff',
      success: '#f0fdf4',
      warning: '#fffbeb',
      alert: '#fff1f2',
    };
    const borderMap = {
      info: '#bae6fd',
      success: '#bbf7d0',
      warning: '#fde68a',
      alert: '#fecdd3',
    };
    const textMap = {
      info: '#0369a1',
      success: '#15803d',
      warning: '#92400e',
      alert: '#9f1239',
    };
    const bg = bgMap[v.calloutType];
    const border = borderMap[v.calloutType];
    const col = textMap[v.calloutType];

    const pointsHtml = v.calloutPoints
      .filter((p) => p.trim())
      .map((p) => `<li style="margin-bottom: 4px;">${p}</li>`)
      .join('');

    calloutHtml = `
      <div style="background: ${bg}; border: 1px solid ${border}; border-radius: 14px; padding: 20px; margin: 22px 0; color: ${col};">
        ${v.calloutTitle ? `<h4 style="margin: 0 0 10px; font-size: 14px; font-weight: 700;">${v.calloutTitle}</h4>` : ''}
        ${pointsHtml ? `<ul style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.6;">${pointsHtml}</ul>` : ''}
      </div>`;
  }

  let dataGridHtml = '';
  if (v.showDataGrid && v.dataGridRows.length > 0) {
    const rowsHtml = v.dataGridRows
      .filter((r) => r.label.trim())
      .map(
        (r) => `
        <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px;">
          <span style="color: #64748b; font-weight: 500;">${r.label}</span>
          <span style="font-weight: 700; color: #1e293b;">${r.value}</span>
        </div>`
      )
      .join('');

    dataGridHtml = `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin: 22px 0;">
        ${v.dataGridTitle ? `<h4 style="margin: 0 0 12px; color: #334155; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">${v.dataGridTitle}</h4>` : ''}
        ${rowsHtml}
      </div>`;
  }

  let btnHtml = '';
  if (v.showButton && v.buttonText) {
    btnHtml = `
      <div style="text-align: center; margin: 26px 0 16px;">
        <a href="${v.buttonUrl || '#'}" style="display: inline-block; background: ${v.buttonColor || themeObj.from}; color: #ffffff !important; padding: 13px 30px; border-radius: 12px; font-weight: 700; text-decoration: none; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.12);">${v.buttonText}</a>
      </div>`;
  }

  const signOffLines = v.footerTeam
    .split('\n')
    .map((l) => `<strong>${l}</strong>`)
    .join('<br />');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; margin: 0; padding: 20px; color: #334155; }
    .card { max-width: 540px; margin: 20px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 12px 36px rgba(0,0,0,0.22); }
    .header { background: linear-gradient(135deg, ${themeObj.from} 0%, ${themeObj.to} 100%); padding: 34px 36px; text-align: left; }
    .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .header p { color: ${themeObj.text}; margin: 6px 0 0; font-size: 13px; font-weight: 500; }
    .content { padding: 36px; }
    .content p { font-size: 15px; line-height: 1.65; color: #334155; margin: 0 0 16px; }
    .footer { background: #f8fafc; padding: 20px 36px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>${v.headerTitle}</h1>
      <p>${v.headerSubtitle}</p>
    </div>
    <div class="content">
      <p>${v.greeting}</p>
      ${v.bodyParagraph1 ? `<p>${v.bodyParagraph1}</p>` : ''}
      ${v.bodyParagraph2 ? `<p>${v.bodyParagraph2}</p>` : ''}
      ${calloutHtml}
      ${dataGridHtml}
      ${btnHtml}
      <p style="margin-top: 26px;">${v.footerSignOff}<br />${signOffLines}</p>
    </div>
    <div class="footer">
      © 2026 Lexicon MILE. Powered by HyperBuild.<br />
      If you need assistance, please contact <a href="mailto:{{support_email}}" style="color: ${themeObj.from}; text-decoration: none;">{{support_email}}</a>.
    </div>
  </div>
</body>
</html>`;
}

export const EmailTemplatesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Editor mode tab: 'visual' or 'html'
  const [editorTab, setEditorTab] = useState<'visual' | 'html'>('visual');

  // Editing template state
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    category: 'General',
    description: '',
    subject: '',
    html_content: '',
    variables: [] as string[],
    is_active: true,
  });

  // Visual Designer state
  const [visualState, setVisualState] = useState<VisualEmailState>(DEFAULT_VISUAL_STATE);

  // AI Generation Modal states
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiTheme, setAiTheme] = useState('modern_gradient');
  const [aiAttachments, setAiAttachments] = useState<{ name: string; size: string; text_content?: string }[]>([]);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGeneratedResult, setAiGeneratedResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Create new template modal state
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    event_key: '',
    name: '',
    category: 'Custom & Broadcast',
    description: '',
    subject: '',
    html_content: '',
    variables: ['recipient_name', 'title', 'message', 'action_url', 'app_name'],
    is_active: true,
  });

  // Preview / test modal states
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [testRecipient, setTestRecipient] = useState('deepak.gupta@mile.education');
  const [testFeedback, setTestFeedback] = useState<{ success?: string; error?: string } | null>(null);
  const [activeVariableTarget, setActiveVariableTarget] = useState<string>('subject');

  // Fetch templates
  const { data: templates = [], isLoading } = useQuery<EmailTemplate[]>({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const res = await api.get('/email-templates');
      return res.data.data;
    },
  });

  // Sync Visual Designer when selecting a template
  const selectTemplateForEdit = (tmpl: EmailTemplate) => {
    setEditingTemplate(tmpl);
    setEditForm({
      name: tmpl.name,
      category: tmpl.category,
      description: tmpl.description || '',
      subject: tmpl.subject,
      html_content: tmpl.html_content,
      variables: tmpl.variables || [],
      is_active: tmpl.is_active,
    });
    // Set matching visual state defaults
    setVisualState((prev) => ({
      ...prev,
      headerTitle: tmpl.name,
      headerSubtitle: tmpl.category,
    }));
    setTestFeedback(null);
  };

  // Re-sync compiled HTML whenever Visual Designer state updates in visual mode
  const updateVisualState = (updater: (prev: VisualEmailState) => VisualEmailState) => {
    setVisualState((prev) => {
      const updated = updater(prev);
      const compiled = compileVisualToHtml(updated);
      setEditForm((f) => ({ ...f, html_content: compiled }));
      return updated;
    });
  };

  // Insert Variable into active field
  const handleInsertVariable = (varName: string) => {
    const placeholder = `{{${varName}}}`;
    if (activeVariableTarget === 'subject') {
      setEditForm((f) => ({ ...f, subject: f.subject + ' ' + placeholder }));
    } else if (activeVariableTarget === 'greeting') {
      updateVisualState((v) => ({ ...v, greeting: v.greeting + ' ' + placeholder }));
    } else if (activeVariableTarget === 'body') {
      updateVisualState((v) => ({ ...v, bodyParagraph1: v.bodyParagraph1 + ' ' + placeholder }));
    } else {
      setEditForm((f) => ({ ...f, html_content: f.html_content + placeholder }));
    }
  };

  // Save template mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingTemplate) return;
      const res = await api.put(`/email-templates/${editingTemplate.id}`, editForm);
      return res.data.data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      setEditingTemplate(updated);
      setTestFeedback({ success: 'Template changes saved successfully!' });
      setTimeout(() => setTestFeedback(null), 3000);
    },
    onError: (err: any) => {
      setTestFeedback({ error: err.response?.data?.detail || 'Failed to save template.' });
    },
  });

  // Create new template mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/email-templates', createForm);
      return res.data.data;
    },
    onSuccess: (newTmpl) => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      setIsCreating(false);
      selectTemplateForEdit(newTmpl);
      setTestFeedback({ success: `New template "${newTmpl.name}" created successfully!` });
      setTimeout(() => setTestFeedback(null), 3000);
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to create template.');
    },
  });

  // Reset to default mutation
  const resetMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/email-templates/${id}/reset`);
      return res.data.data;
    },
    onSuccess: (resetTmpl) => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      selectTemplateForEdit(resetTmpl);
      setTestFeedback({ success: 'Template restored to factory default!' });
      setTimeout(() => setTestFeedback(null), 3000);
    },
    onError: (err: any) => {
      setTestFeedback({ error: err.response?.data?.detail || 'Failed to reset template.' });
    },
  });

  // Test send mutation
  const testSendMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/email-templates/test-send', {
        recipient_email: testRecipient.trim(),
        subject: editForm.subject,
        html_content: editForm.html_content,
      });
      return res.data.data;
    },
    onSuccess: () => {
      setTestFeedback({ success: `Live test email dispatched to ${testRecipient} via Hostinger Mail API!` });
    },
    onError: (err: any) => {
      setTestFeedback({ error: err.response?.data?.detail || 'Failed to send test email.' });
    },
  });

  // AI Template Generation Handler
  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    try {
      const res = await api.post('/email-templates/ai-generate', {
        prompt: aiPrompt.trim(),
        category: editingTemplate ? editingTemplate.category : 'Custom & Broadcast',
        style_theme: aiTheme,
        variables: editingTemplate ? editingTemplate.variables : ['full_name', 'session_date', 'app_name'],
        file_attachments: aiAttachments,
      });

      if (res.data?.data) {
        setAiGeneratedResult(res.data.data);
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'AI generation failed. Please try again.');
    } finally {
      setAiGenerating(false);
    }
  };

  // Apply AI result to current editor
  const applyAiResultToEditor = () => {
    if (!aiGeneratedResult) return;
    setEditForm((prev) => ({
      ...prev,
      name: aiGeneratedResult.name || prev.name,
      subject: aiGeneratedResult.subject || prev.subject,
      html_content: aiGeneratedResult.html_content || prev.html_content,
      variables: Array.from(new Set([...prev.variables, ...(aiGeneratedResult.variables || [])])),
    }));
    setIsAiModalOpen(false);
    setAiGeneratedResult(null);
    setAiPrompt('');
    setTestFeedback({ success: '✨ AI generated template applied to editor!' });
    setTimeout(() => setTestFeedback(null), 3000);
  };

  // Handle file uploads for AI prompt context
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((f) => {
      const reader = new FileReader();
      reader.onload = () => {
        setAiAttachments((prev) => [
          ...prev,
          {
            name: f.name,
            size: `${(f.size / 1024).toFixed(1)} KB`,
            text_content: typeof reader.result === 'string' ? reader.result.slice(0, 1000) : '',
          },
        ]);
      };
      if (f.type.includes('text') || f.name.endsWith('.txt') || f.name.endsWith('.md')) {
        reader.readAsText(f);
      } else {
        reader.readAsDataURL(f);
      }
    });
  };

  // Compute live rendered preview with placeholder replacements
  const sampleContext: Record<string, string> = {
    full_name: 'Deepak Gupta',
    student_name: 'Deepak Gupta',
    faculty_name: 'Prof. Ananya Sharma',
    recipient_name: 'Deepak Gupta',
    prn_number: '20261029384756',
    otp: '749201',
    expiry_minutes: '15',
    program_name: 'Post Graduate Diploma in Management (PGDM)',
    batch_name: 'Batch 2026-2028',
    division_name: 'Division A',
    subject_name: 'Strategic Management & Leadership',
    session_date: '05 Sep 2026',
    session_time: '10:00 AM - 12:00 PM',
    venue: 'Executive Auditorium 3',
    attendance_percentage: '68',
    threshold_percentage: '75',
    sessions_attended: '17',
    total_sessions: '25',
    company_name: 'Goldman Sachs',
    job_role: 'Associate Financial Analyst',
    ctc_stipend: '₹14.5 LPA',
    eligibility_criteria: 'Min 60% in UG & PGDM with no backlogs',
    deadline_date: '10 Sep 2026',
    round_name: 'Technical & Case Study Round',
    interview_date: '12 Sep 2026, 11:30 AM',
    interview_venue: 'Virtual Boardroom 1',
    material_title: 'Unit 3 — Industry Case Study Frameworks',
    download_url: 'https://orion.dataxplore.club/materials/download',
    title: 'Executive Leadership Guest Lecture',
    message: 'We are pleased to invite you to our upcoming campus lecture session.',
    action_url: 'https://orion.dataxplore.club/dashboard',
    action_button_text: 'Open Orion Portal',
    rejection_reason: 'Submitted undergraduate certificate copy was unclear or missing official seal.',
    login_url: 'https://orion.dataxplore.club/login',
    app_name: 'Orion Portal',
    support_email: 'deepak.gupta@mile.education',
  };

  const renderSamplePreview = (content: string) => {
    if (!content) return '';
    return content.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
      return sampleContext[key] !== undefined ? sampleContext[key] : `{{${key}}}`;
    });
  };

  // Filter templates
  const filteredTemplates = templates.filter((t) => {
    const matchesCategory = selectedCategory === 'All' || t.category === selectedCategory;
    const matchesSearch =
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.event_key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Top Banner & AI Generator Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl text-white">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30 text-white shrink-0">
            <Mail className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Email Notifications & Visual Studio</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                12 Triggers Active
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              Design, customize, and trigger automated emails for student onboarding, attendance warnings, lecture schedules, and campus drives with live WYSIWYG & AI prompt synthesis.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            type="button"
            onClick={() => {
              setCreateForm({
                event_key: 'custom_event_' + Date.now().toString().slice(-4),
                name: 'Custom Campus Notification',
                category: 'Custom & Broadcast',
                description: 'Custom administrative notification trigger',
                subject: 'Notice: {{title}} — Orion Portal',
                html_content: compileVisualToHtml(DEFAULT_VISUAL_STATE),
                variables: ['recipient_name', 'title', 'message', 'action_url', 'app_name'],
                is_active: true,
              });
              setIsCreating(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" /> New Custom Trigger
          </button>
          <button
            type="button"
            onClick={() => setIsAiModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-500/25 transition-all cursor-pointer"
          >
            <Sparkles className="h-4 w-4" /> ✨ Generate with AI
          </button>
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Template Catalog & Filter */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search templates or events..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Category Pills */}
            <div className="flex flex-wrap gap-1.5 pb-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-xl text-[11px] font-semibold transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-cyan-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Template List */}
            <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
              {isLoading ? (
                <div className="py-12 text-center text-xs text-slate-400">Loading email triggers...</div>
              ) : filteredTemplates.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">No email templates found.</div>
              ) : (
                filteredTemplates.map((t) => {
                  const isSelected = editingTemplate?.id === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => selectTemplateForEdit(t)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left ${
                        isSelected
                          ? 'bg-cyan-500/10 border-cyan-500/40 shadow-xs dark:bg-cyan-950/30'
                          : 'bg-slate-50/70 dark:bg-slate-950/40 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {t.category}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {t.is_system && (
                            <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 flex items-center gap-0.5">
                              <Shield className="h-3 w-3" /> Core
                            </span>
                          )}
                          <span
                            className={`w-2 h-2 rounded-full ${
                              t.is_active ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                          />
                        </div>
                      </div>

                      <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                        {t.name}
                      </h4>
                      <p className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400 mt-0.5 truncate">
                        <code>{t.event_key}</code>
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Visual Editor & Live Preview */}
        <div className="lg:col-span-8 space-y-4">
          {editingTemplate ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
              {/* Header & Mode Switcher */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      {editForm.name}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                      {editingTemplate.event_key}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {editingTemplate.description || 'Configured system notification trigger'}
                  </p>
                </div>

                {/* Editor Tab Toggle */}
                <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setEditorTab('visual')}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      editorTab === 'visual'
                        ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <Sliders className="h-3.5 w-3.5" /> Visual Designer
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorTab('html')}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      editorTab === 'html'
                        ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <Code className="h-3.5 w-3.5" /> HTML Source
                  </button>
                </div>
              </div>

              {/* Feedback Alert */}
              {testFeedback && (
                <div
                  className={`p-3.5 rounded-2xl text-xs flex items-center gap-2.5 animate-fadeIn ${
                    testFeedback.success
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                      : 'bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400'
                  }`}
                >
                  {testFeedback.success ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0" />
                  )}
                  <span>{testFeedback.success || testFeedback.error}</span>
                </div>
              )}

              {/* Subject Line & Active Trigger Info */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Email Subject Template
                  </label>
                  <span className="text-[11px] text-slate-400">Supports dynamic placeholders</span>
                </div>
                <input
                  type="text"
                  value={editForm.subject}
                  onFocus={() => setActiveVariableTarget('subject')}
                  onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Dynamic Variable Chips Palette */}
              <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5 text-cyan-500" /> Click to Insert Variables into Active Field:
                  </span>
                  <span className="text-[10px] text-cyan-600 dark:text-cyan-400">
                    Target: <strong className="capitalize">{activeVariableTarget}</strong>
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(editForm.variables || []).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => handleInsertVariable(v)}
                      className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-cyan-500 hover:text-cyan-600 dark:hover:text-cyan-400 transition-all cursor-pointer shadow-2xs"
                    >
                      +{`{{${v}}}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* ─── TAB 1: VISUAL DESIGNER (WYSIWYG BUILDER) ─── */}
              {editorTab === 'visual' && (
                <div className="space-y-6 pt-2">
                  {/* Block 1: Header Banner & Colors */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Palette className="h-4 w-4 text-cyan-500" />
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                          Header Banner & Theme Colors
                        </h4>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">Banner Title</label>
                        <input
                          type="text"
                          value={visualState.headerTitle}
                          onChange={(e) => updateVisualState((v) => ({ ...v, headerTitle: e.target.value }))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">Banner Subtitle</label>
                        <input
                          type="text"
                          value={visualState.headerSubtitle}
                          onChange={(e) => updateVisualState((v) => ({ ...v, headerSubtitle: e.target.value }))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-2">Gradient Preset</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {GRADIENT_PRESETS.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => updateVisualState((v) => ({ ...v, headerTheme: p.id }))}
                            className={`p-2 rounded-xl text-left text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 ${
                              visualState.headerTheme === p.id
                                ? 'border-cyan-500 ring-2 ring-cyan-500/20 shadow-xs'
                                : 'border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            <span
                              className="w-3.5 h-3.5 rounded-full shrink-0 shadow-inner"
                              style={{ background: `linear-gradient(135deg, ${p.from}, ${p.to})` }}
                            />
                            <span className="truncate text-slate-700 dark:text-slate-300">{p.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Block 2: Salutation & Message Content */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex items-center gap-2">
                      <Type className="h-4 w-4 text-cyan-500" />
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                        Message Content & Salutation
                      </h4>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Salutation Greeting</label>
                      <input
                        type="text"
                        value={visualState.greeting}
                        onFocus={() => setActiveVariableTarget('greeting')}
                        onChange={(e) => updateVisualState((v) => ({ ...v, greeting: e.target.value }))}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Primary Paragraph</label>
                      <textarea
                        rows={2}
                        value={visualState.bodyParagraph1}
                        onFocus={() => setActiveVariableTarget('body')}
                        onChange={(e) => updateVisualState((v) => ({ ...v, bodyParagraph1: e.target.value }))}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 leading-relaxed"
                      />
                    </div>
                  </div>

                  {/* Block 3: Callout Card / Highlight Box */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-cyan-500" />
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                          Callout Highlight Box
                        </h4>
                      </div>
                      <select
                        value={visualState.calloutType}
                        onChange={(e: any) => updateVisualState((v) => ({ ...v, calloutType: e.target.value }))}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200"
                      >
                        <option value="none">Disabled (No Box)</option>
                        <option value="info">Info (Blue Card)</option>
                        <option value="success">Success (Green Card)</option>
                        <option value="warning">Warning (Amber Card)</option>
                        <option value="alert">Alert (Rose Card)</option>
                      </select>
                    </div>

                    {visualState.calloutType !== 'none' && (
                      <div className="space-y-2 pt-1">
                        <input
                          type="text"
                          placeholder="Callout Box Title"
                          value={visualState.calloutTitle}
                          onChange={(e) => updateVisualState((v) => ({ ...v, calloutTitle: e.target.value }))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                        />
                        <textarea
                          rows={2}
                          placeholder="Highlight key points (separated by line)"
                          value={visualState.calloutPoints.join('\n')}
                          onChange={(e) =>
                            updateVisualState((v) => ({
                              ...v,
                              calloutPoints: e.target.value.split('\n'),
                            }))
                          }
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    )}
                  </div>

                  {/* Block 4: Key-Value Data Grid */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <LayoutTemplate className="h-4 w-4 text-cyan-500" />
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                          Key-Value Data Matrix
                        </h4>
                      </div>
                      <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={visualState.showDataGrid}
                          onChange={(e) => updateVisualState((v) => ({ ...v, showDataGrid: e.target.checked }))}
                          className="rounded text-cyan-600"
                        />
                        <span>Enable Table</span>
                      </label>
                    </div>

                    {visualState.showDataGrid && (
                      <div className="space-y-2">
                        {visualState.dataGridRows.map((row, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input
                              type="text"
                              placeholder="Label (e.g. Venue)"
                              value={row.label}
                              onChange={(e) =>
                                updateVisualState((v) => {
                                  const rows = [...v.dataGridRows];
                                  rows[idx].label = e.target.value;
                                  return { ...v, dataGridRows: rows };
                                })
                              }
                              className="w-1/3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1 text-xs text-slate-900 dark:text-white"
                            />
                            <input
                              type="text"
                              placeholder="Value (e.g. {{venue}})"
                              value={row.value}
                              onChange={(e) =>
                                updateVisualState((v) => {
                                  const rows = [...v.dataGridRows];
                                  rows[idx].value = e.target.value;
                                  return { ...v, dataGridRows: rows };
                                })
                              }
                              className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1 text-xs text-slate-900 dark:text-white font-mono"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                updateVisualState((v) => ({
                                  ...v,
                                  dataGridRows: v.dataGridRows.filter((_, i) => i !== idx),
                                }))
                              }
                              className="p-1 text-slate-400 hover:text-rose-500"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            updateVisualState((v) => ({
                              ...v,
                              dataGridRows: [...v.dataGridRows, { label: 'New Field', value: '{{variable}}' }],
                            }))
                          }
                          className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 pt-1"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add Row
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Block 5: Action Button & Footer */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-cyan-500" />
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                          Action Button & Portal Link
                        </h4>
                      </div>
                      <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={visualState.showButton}
                          onChange={(e) => updateVisualState((v) => ({ ...v, showButton: e.target.checked }))}
                          className="rounded text-cyan-600"
                        />
                        <span>Show Button</span>
                      </label>
                    </div>

                    {visualState.showButton && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Button Label</label>
                          <input
                            type="text"
                            value={visualState.buttonText}
                            onChange={(e) => updateVisualState((v) => ({ ...v, buttonText: e.target.value }))}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Target URL</label>
                          <input
                            type="text"
                            value={visualState.buttonUrl}
                            onChange={(e) => updateVisualState((v) => ({ ...v, buttonUrl: e.target.value }))}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white font-mono"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ─── TAB 2: RAW HTML CODE EDITOR ─── */}
              {editorTab === 'html' && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Code className="h-4 w-4 text-cyan-500" /> HTML Markup (Inline CSS)
                    </label>
                    <span className="text-[11px] text-slate-400">Direct source code editor</span>
                  </div>
                  <textarea
                    rows={16}
                    value={editForm.html_content}
                    onFocus={() => setActiveVariableTarget('html')}
                    onChange={(e) => setEditForm({ ...editForm, html_content: e.target.value })}
                    className="w-full bg-slate-950 text-cyan-300 border border-slate-800 rounded-2xl p-4 font-mono text-xs leading-relaxed focus:outline-none focus:border-cyan-500"
                  />
                </div>
              )}

              {/* ─── LIVE PREVIEW PANE (DESKTOP / MOBILE) ─── */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-cyan-500" />
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Live Sample Preview
                    </h4>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setPreviewDevice('desktop')}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        previewDevice === 'desktop'
                          ? 'bg-white dark:bg-slate-900 text-cyan-600 shadow-xs'
                          : 'text-slate-400'
                      }`}
                    >
                      <Monitor className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewDevice('mobile')}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        previewDevice === 'mobile'
                          ? 'bg-white dark:bg-slate-900 text-cyan-600 shadow-xs'
                          : 'text-slate-400'
                      }`}
                    >
                      <Smartphone className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-slate-950 rounded-2xl flex justify-center overflow-x-auto shadow-inner">
                  <div
                    className={`bg-white rounded-2xl overflow-hidden transition-all duration-300 shadow-2xl ${
                      previewDevice === 'desktop' ? 'w-full max-w-[580px]' : 'w-[360px]'
                    }`}
                  >
                    <iframe
                      srcDoc={renderSamplePreview(editForm.html_content)}
                      title="Email Preview"
                      className="w-full h-[520px] border-none"
                    />
                  </div>
                </div>
              </div>

              {/* Bottom Actions: Save, Reset, and Live Test Dispatch */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                    placeholder="Test recipient"
                    className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none w-52"
                  />
                  <button
                    type="button"
                    disabled={testSendMutation.isPending}
                    onClick={() => testSendMutation.mutate()}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {testSendMutation.isPending ? 'Sending...' : 'Send Test'}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {editingTemplate.is_system && (
                    <button
                      type="button"
                      disabled={resetMutation.isPending}
                      onClick={() => resetMutation.mutate(editingTemplate.id)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Factory Default
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={updateMutation.isPending}
                    onClick={() => updateMutation.mutate()}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-md shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {updateMutation.isPending ? 'Saving...' : 'Save Template'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center text-slate-400 space-y-3">
              <Mail className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-700" />
              <p className="text-sm font-medium">Select an email notification trigger on the left to begin customizing.</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── AI TEMPLATE GENERATOR MODAL (WITH MULTI-MODAL FILE ATTACHMENTS) ─── */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">AI Template Generator</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Prompt-based HTML synthesis with multi-modal document attachments
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Prompt Input & Quick Ideas */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Describe Your Desired Email Template
                </label>
                <textarea
                  rows={3}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g. Design a high-impact gold-accented corporate invitation for our annual alumni leadership summit with speaker profiles and RSVP button..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-2xl p-3.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Style Presets */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Target Tone & Style</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'modern_gradient', label: 'Cyan / Ocean' },
                    { id: 'corporate', label: 'Corporate Dark' },
                    { id: 'academic', label: 'Academic Purple' },
                    { id: 'celebratory', label: 'Celebratory Green' },
                    { id: 'alert', label: 'Urgent Red' },
                    { id: 'gold', label: 'Executive Gold' },
                  ].map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setAiTheme(st.id)}
                      className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        aiTheme === st.id
                          ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Multi-modal File Attachments */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold text-slate-500">
                    Reference Files (PDFs, Images, Documents)
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Upload className="h-3.5 w-3.5" /> Attach File
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>

                {aiAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    {aiAttachments.map((f, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
                      >
                        <FileText className="h-3.5 w-3.5 text-purple-500" />
                        <span className="font-semibold">{f.name}</span> ({f.size})
                        <button
                          type="button"
                          onClick={() => setAiAttachments(aiAttachments.filter((_, idx) => idx !== i))}
                          className="text-slate-400 hover:text-rose-500 ml-1"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* AI Generated Preview or Generate Button */}
            {aiGeneratedResult ? (
              <div className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-purple-900 dark:text-purple-300">
                    Generated: {aiGeneratedResult.name}
                  </h4>
                  <span className="text-[11px] font-mono text-purple-600">
                    {aiGeneratedResult.variables?.length || 0} variables detected
                  </span>
                </div>
                <div className="max-h-52 overflow-y-auto rounded-xl bg-white dark:bg-slate-950 p-3 border border-purple-100 dark:border-purple-900">
                  <iframe
                    srcDoc={aiGeneratedResult.html_content}
                    title="AI Preview"
                    className="w-full h-44 border-none"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setAiGeneratedResult(null)}
                    className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Try Another Prompt
                  </button>
                  <button
                    type="button"
                    onClick={applyAiResultToEditor}
                    className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-500/25"
                  >
                    ✨ Apply to Studio Editor
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAiModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={aiGenerating || !aiPrompt.trim()}
                  onClick={handleAiGenerate}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-500/25 disabled:opacity-50 cursor-pointer"
                >
                  <Sparkles className="h-4 w-4" />
                  {aiGenerating ? 'Synthesizing Template...' : 'Generate with AI'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── CREATE NEW TEMPLATE MODAL ─── */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Create Custom Trigger</h3>
                  <p className="text-[11px] text-slate-500">Define a new system or broadcast notification event</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Unique Event Key (snake_case)</label>
                <input
                  type="text"
                  placeholder="e.g. scholarship_award_notice"
                  value={createForm.event_key}
                  onChange={(e) => setCreateForm({ ...createForm, event_key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Template Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. Merit Scholarship Award Notification"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Category Group</label>
                <select
                  value={createForm.category}
                  onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-semibold"
                >
                  {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Subject Line</label>
                <input
                  type="text"
                  placeholder="e.g. Congratulations {{recipient_name}} — Scholarship Award"
                  value={createForm.subject}
                  onChange={(e) => setCreateForm({ ...createForm, subject: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={createMutation.isPending || !createForm.event_key || !createForm.name || !createForm.subject}
                onClick={() => createMutation.mutate()}
                className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs shadow-md shadow-cyan-500/25 disabled:opacity-50"
              >
                {createMutation.isPending ? 'Creating...' : 'Create & Design'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
