import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Mail,
  Plus,
  Search,
  RotateCcw,
  Trash2,
  Send,
  CheckCircle2,
  AlertCircle,
  X,
  Smartphone,
  Monitor,
  Sparkles,
  Code,
  Sliders,
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
  'Custom & Broadcast',
];

export const EmailTemplatesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');

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

  // Create new template modal state
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    event_key: '',
    name: '',
    category: 'Custom & Broadcast',
    description: '',
    subject: '',
    html_content: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: Arial, sans-serif; background: #f8fafc; padding: 20px;">
  <div style="max-width: 540px; margin: auto; background: #ffffff; border-radius: 16px; padding: 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
    <h2 style="color: #0891b2; margin-top: 0;">{{title}}</h2>
    <p>Dear <strong>{{recipient_name}}</strong>,</p>
    <p>{{message}}</p>
    <div style="margin-top: 24px; text-align: center;">
      <a href="{{action_url}}" style="background: #0891b2; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Details</a>
    </div>
  </div>
</body>
</html>`,
    variables: ['recipient_name', 'title', 'message', 'action_url', 'app_name'],
    is_active: true,
  });

  // Preview / test modal states
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [testRecipient, setTestRecipient] = useState('deepak.gupta@mile.education');
  const [testFeedback, setTestFeedback] = useState<{ success?: string; error?: string } | null>(null);

  // Fetch templates
  const { data: templates = [], isLoading } = useQuery<EmailTemplate[]>({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const res = await api.get('/email-templates');
      return res.data.data;
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof editForm> }) => {
      const res = await api.put(`/email-templates/${id}`, data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      setEditingTemplate(null);
      setTestFeedback(null);
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof createForm) => {
      const res = await api.post('/email-templates', data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      setIsCreating(false);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/email-templates/${id}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
    },
  });

  // Reset mutation
  const resetMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/email-templates/${id}/reset`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      setEditingTemplate(null);
    },
  });

  // Send Test Email mutation
  const sendTestMutation = useMutation({
    mutationFn: async ({ templateId, recipient, subject, htmlContent }: { templateId: string; recipient: string; subject: string; htmlContent: string }) => {
      const res = await api.post(`/email-templates/${templateId}/send-test`, {
        recipient_email: recipient,
        subject,
        html_content: htmlContent,
      });
      return res.data.data;
    },
    onSuccess: (data: any) => {
      setTestFeedback({ success: data.message || `Test email sent to ${testRecipient}!` });
    },
    onError: (err: any) => {
      setTestFeedback({ error: err.response?.data?.detail || 'Failed to dispatch test email.' });
    },
  });

  const handleOpenEdit = (t: EmailTemplate) => {
    setEditingTemplate(t);
    setEditForm({
      name: t.name,
      category: t.category,
      description: t.description || '',
      subject: t.subject,
      html_content: t.html_content,
      variables: t.variables || [],
      is_active: t.is_active,
    });
    setTestFeedback(null);
    setTestRecipient('deepak.gupta@mile.education');
  };

  const handleToggleActive = (t: EmailTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    updateMutation.mutate({ id: t.id, data: { is_active: !t.is_active } });
  };

  const insertVariable = (varName: string) => {
    const placeholder = `{{${varName}}}`;
    setEditForm((prev) => ({
      ...prev,
      html_content: prev.html_content + placeholder,
    }));
  };

  // Sample context for live preview replacement
  const sampleContext: Record<string, string> = {
    full_name: 'Deepak Gupta',
    student_name: 'Deepak Gupta',
    faculty_name: 'Prof. Deepak Gupta',
    recipient_name: 'Deepak Gupta',
    prn_number: '26PGDM001',
    otp: '749201',
    expiry_minutes: '10',
    program_name: 'PGDM - Post Graduate Diploma in Management',
    batch_name: 'PGDM Batch 2026-2028',
    division_name: 'Division A',
    subject_name: 'Marketing Strategy & Operations',
    session_date: '15 Sep 2026',
    session_time: '10:00 AM - 12:00 PM',
    room_no: 'Auditorium Hall 2',
    attendance_percentage: '68',
    threshold_percentage: '75',
    sessions_attended: '17',
    total_sessions: '25',
    title: 'Upcoming Campus Industry Lecture',
    message: 'We are pleased to invite you to our upcoming executive leadership seminar on campus.',
    action_url: 'https://orion.mile.education/dashboard',
    action_button_text: 'View Session Details',
    rejection_reason: 'Graduation marks statement attachment is unverified or incomplete.',
    login_url: 'https://orion.mile.education/login',
    app_name: 'Orion Portal',
    support_email: 'deepak.gupta@mile.education',
  };

  const renderPreviewHtml = (rawHtml: string) => {
    let output = rawHtml;
    Object.keys(sampleContext).forEach((key) => {
      const reg = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      output = output.replace(reg, sampleContext[key]);
    });
    return output;
  };

  const renderPreviewSubject = (rawSub: string) => {
    let output = rawSub;
    Object.keys(sampleContext).forEach((key) => {
      const reg = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      output = output.replace(reg, sampleContext[key]);
    });
    return output;
  };

  const filteredTemplates = templates.filter((t) => {
    const matchesCat = selectedCategory === 'All' || t.category === selectedCategory;
    const matchesSearch =
      !searchTerm ||
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.event_key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const activeCount = templates.filter((t) => t.is_active).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Email Notifications & Templates</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
              {activeCount} / {templates.length} Active
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage application activities that trigger emails, customize HTML layouts, and test dispatches via Hostinger.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Add Notification Trigger
          </button>
        </div>
      </div>

      {/* Control Bar: Categories & Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto p-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search triggers or subjects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Activity Templates Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center p-16">
          <div className="h-8 w-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center text-slate-500">
          <Mail className="h-10 w-10 mx-auto text-slate-400 mb-3" />
          <p className="font-semibold text-slate-700 dark:text-slate-300">No email notification triggers found</p>
          <p className="text-xs text-slate-400 mt-1">Try selecting a different category or search term.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className={`group bg-white dark:bg-slate-900 border rounded-3xl p-6 transition-all shadow-xs hover:shadow-md flex flex-col justify-between ${
                template.is_active
                  ? 'border-slate-200 dark:border-slate-800'
                  : 'border-slate-200/60 dark:border-slate-800/40 opacity-75 bg-slate-50/50 dark:bg-slate-900/40'
              }`}
            >
              <div className="space-y-3">
                {/* Header: Category & Active Toggle */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {template.category}
                    </span>
                    {template.is_system && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                        System Core
                      </span>
                    )}
                  </div>

                  {/* Active Toggle */}
                  <button
                    type="button"
                    onClick={(e) => handleToggleActive(template, e)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                      template.is_active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        template.is_active ? 'translate-x-4.5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                {/* Title & Key */}
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                    {template.name}
                  </h3>
                  <p className="font-mono text-xs text-cyan-600 dark:text-cyan-400 mt-0.5">
                    {template.event_key}
                  </p>
                </div>

                {/* Description */}
                {template.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                    {template.description}
                  </p>
                )}

                {/* Subject Preview */}
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs">
                  <span className="text-slate-400 font-semibold uppercase text-[10px] block mb-0.5">Subject:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 line-clamp-1">{template.subject}</span>
                </div>

                {/* Variables */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {template.variables?.slice(0, 4).map((v) => (
                    <span
                      key={v}
                      className="px-2 py-0.5 rounded-md font-mono text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700/80"
                    >
                      {`{{${v}}}`}
                    </span>
                  ))}
                  {template.variables?.length > 4 && (
                    <span className="text-[10px] text-slate-400 self-center">
                      +{template.variables.length - 4} more
                    </span>
                  )}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-between gap-2 pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5">
                  {template.is_system ? (
                    <button
                      type="button"
                      onClick={() => resetMutation.mutate(template.id)}
                      title="Reset to default design"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Delete custom trigger "${template.name}"?`)) {
                          deleteMutation.mutate(template.id);
                        }
                      }}
                      title="Delete trigger"
                      className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenEdit(template)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-cyan-600 dark:bg-slate-800 dark:hover:bg-cyan-600 text-white text-xs font-semibold transition-all cursor-pointer"
                >
                  <Sliders className="h-3.5 w-3.5" /> Customize Design
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor & Live Preview Modal */}
      {editingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-6xl w-full h-[94vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/80 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 flex items-center justify-center">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    {editingTemplate.name}
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                      {editingTemplate.event_key}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Customize the email subject, HTML markup, and preview live changes.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTemplate(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Split Screen Body */}
            <div className="grid grid-cols-1 lg:grid-cols-2 flex-1 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-100 dark:divide-slate-800">
              {/* Left Column: Code & Configuration Editor */}
              <div className="flex flex-col h-full overflow-y-auto p-6 space-y-4">
                {/* Subject Editor */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Email Subject Line <span className="text-rose-500">*</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    required
                    value={editForm.subject}
                    onChange={(e) => setEditForm((f) => ({ ...f, subject: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white font-medium focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Variable Tokens Palette */}
                <div className="p-3.5 rounded-2xl bg-cyan-50/60 dark:bg-cyan-950/20 border border-cyan-200/80 dark:border-cyan-800/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-cyan-900 dark:text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" /> Click variable to append to template
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {editForm.variables.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => insertVariable(v)}
                        title="Click to insert in HTML body"
                        className="px-2.5 py-1 rounded-lg font-mono text-xs bg-white dark:bg-slate-900 text-cyan-700 dark:text-cyan-400 border border-cyan-300 dark:border-cyan-700 hover:bg-cyan-100 dark:hover:bg-cyan-900 transition-colors cursor-pointer"
                      >
                        {`{{${v}}}`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* HTML Source Editor */}
                <div className="flex-1 flex flex-col space-y-1.5 min-h-[320px]">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Code className="h-3.5 w-3.5 text-cyan-500" /> HTML Template Source
                    </label>
                    <span className="text-[11px] text-slate-400">Standard HTML / Inline CSS</span>
                  </div>
                  <textarea
                    required
                    value={editForm.html_content}
                    onChange={(e) => setEditForm((f) => ({ ...f, html_content: e.target.value }))}
                    rows={16}
                    className="flex-1 w-full bg-slate-950 text-cyan-300 font-mono text-xs p-4 rounded-2xl border border-slate-800 focus:outline-none focus:border-cyan-500 leading-relaxed resize-none shadow-inner"
                  />
                </div>
              </div>

              {/* Right Column: Live Visual Preview & Test Email Dispatch */}
              <div className="flex flex-col h-full overflow-hidden bg-slate-100/70 dark:bg-slate-950/60 p-6 space-y-4">
                {/* Preview Toolbar */}
                <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs shrink-0">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPreviewDevice('desktop')}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        previewDevice === 'desktop'
                          ? 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Monitor className="h-3.5 w-3.5" /> Desktop
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewDevice('mobile')}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        previewDevice === 'mobile'
                          ? 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Smartphone className="h-3.5 w-3.5" /> Mobile
                    </button>
                  </div>

                  <span className="text-[11px] font-semibold text-slate-400">
                    Live Dynamic Preview
                  </span>
                </div>

                {/* Simulated Email Client View */}
                <div className="flex-1 overflow-y-auto flex items-center justify-center p-2">
                  <div
                    className={`bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden transition-all flex flex-col h-full max-h-[600px] ${
                      previewDevice === 'mobile' ? 'w-[360px]' : 'w-full'
                    }`}
                  >
                    {/* Simulated Email Client Subject Bar */}
                    <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 shrink-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {renderPreviewSubject(editForm.subject)}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        From: <span className="font-mono text-cyan-600 dark:text-cyan-400">no-reply@dataxplore.club</span>
                      </div>
                    </div>

                    {/* Rendered HTML Iframe Preview */}
                    <div className="flex-1 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-950">
                      <div
                        dangerouslySetInnerHTML={{
                          __html: renderPreviewHtml(editForm.html_content),
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Live Test Email Sender Strip */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 shrink-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Send className="h-3.5 w-3.5 text-cyan-500" /> Send Live Test Email via Hostinger
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="email"
                      value={testRecipient}
                      onChange={(e) => setTestRecipient(e.target.value)}
                      placeholder="e.g. deepak.gupta@mile.education"
                      className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      type="button"
                      disabled={sendTestMutation.isPending || !testRecipient}
                      onClick={() =>
                        sendTestMutation.mutate({
                          templateId: editingTemplate.id,
                          recipient: testRecipient,
                          subject: editForm.subject,
                          htmlContent: editForm.html_content,
                        })
                      }
                      className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      {sendTestMutation.isPending ? (
                        'Sending...'
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5" /> Dispatch Test
                        </>
                      )}
                    </button>
                  </div>

                  {testFeedback?.success && (
                    <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>{testFeedback.success}</span>
                    </div>
                  )}

                  {testFeedback?.error && (
                    <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{testFeedback.error}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Bottom Save Bar */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
              <div>
                {editingTemplate.is_system && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Reset this template to the factory institutional layout?')) {
                        resetMutation.mutate(editingTemplate.id);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reset to Factory Default
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditingTemplate(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={updateMutation.isPending}
                  onClick={() =>
                    updateMutation.mutate({
                      id: editingTemplate.id,
                      data: editForm,
                    })
                  }
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save Template Changes'}
                  <CheckCircle2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add New Custom Trigger Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 flex items-center justify-center">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Create Notification Trigger</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Define a new application trigger with custom HTML styling and placeholders.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate(createForm);
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Trigger Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Placement Drive Notification"
                    value={createForm.name}
                    onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Event Trigger Key <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. placement_drive_alert"
                    value={createForm.event_key}
                    onChange={(e) => setCreateForm((f) => ({ ...f, event_key: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-cyan-600 dark:text-cyan-400 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Category
                  </label>
                  <select
                    value={createForm.category}
                    onChange={(e) => setCreateForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  >
                    {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Subject Line <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. {{title}} — Placement Drive Invitation"
                    value={createForm.subject}
                    onChange={(e) => setCreateForm((f) => ({ ...f, subject: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Activity Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe when this email notification is dispatched by the system..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || !createForm.name || !createForm.event_key || !createForm.subject}
                  className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm shadow-md shadow-cyan-500/20 disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create Trigger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
