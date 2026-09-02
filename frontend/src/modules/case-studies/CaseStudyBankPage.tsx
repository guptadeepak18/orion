import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  Search,
  Plus,
  Download,
  Upload,
  Building2,
  Trash2,
  Pencil,
  X,
  Paperclip,
  CheckCircle2,
  RefreshCw,
  LayoutGrid,
  List as ListIcon,
  Layers,
  ArrowRight,
  GraduationCap,
  RotateCcw,
  Filter,
  ArrowUpDown,
  ChevronDown,
  Check,
  BrainCircuit,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useRoleAccess } from '../../lib/useRoleAccess';
import { Card } from '../../components/Card';

export interface CaseStudy {
  id: string;
  title: string;
  author?: string;
  concept?: string;
  learning_objectives?: string;
  publisher_source?: string;
  industry_domain?: string;
  subject_tags?: string;
  product_number?: string;
  publication_date?: string;
  revision_date?: string;
  page_length?: string;
  duration?: string;
  accessibility_status?: string;
  external_link?: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  file_type?: string;
  is_active: boolean;
  uploaded_by?: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
  };
  created_at: string;
  updated_at: string;
}

export const getCaseStudyUrl = (cs: { id?: string; product_number?: string }) => {
  if (cs.product_number && cs.product_number.trim()) {
    return `/case-studies/${encodeURIComponent(cs.product_number.trim())}`;
  }
  return `/case-studies/${cs.id || ''}`;
};

interface SearchableMultiSelectProps {
  label: string;
  allLabel?: string;
  options: { label: string; value: string; count?: number }[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

const SearchableMultiSelect: React.FC<SearchableMultiSelectProps> = ({
  label,
  allLabel,
  options,
  selectedValues,
  onChange,
  placeholder = 'Search options...',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, searchQuery]);

  const toggleOption = (val: string) => {
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter((v) => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  const handleSelectAll = () => {
    onChange(filteredOptions.map((o) => o.value));
  };

  const handleClear = () => {
    onChange([]);
  };

  // Compute button text
  const getButtonText = () => {
    if (selectedValues.length === 0) return allLabel || `All ${label}`;
    if (selectedValues.length === 1) {
      const match = options.find((o) => o.value === selectedValues[0]);
      return match ? match.label : selectedValues[0];
    }
    return `${label} (${selectedValues.length})`;
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
          selectedValues.length > 0
            ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 shadow-sm'
            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750'
        }`}
      >
        <span className="truncate max-w-[140px]">{getButtonText()}</span>
        {selectedValues.length > 1 && (
          <span className="h-4 min-w-[16px] px-1 rounded-full bg-indigo-600 text-white text-[10px] font-black flex items-center justify-center">
            {selectedValues.length}
          </span>
        )}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-200 text-slate-400 ${
            isOpen ? 'rotate-180 text-indigo-500' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-64 md:w-72 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50 overflow-hidden animate-fadeIn">
          {/* Top Search Box */}
          <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                autoFocus
                placeholder={placeholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-indigo-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-semibold text-slate-500 bg-slate-50/40 dark:bg-slate-800/20">
            <span className="text-[10px] uppercase font-bold text-slate-400">
              {filteredOptions.length} option{filteredOptions.length === 1 ? '' : 's'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-indigo-600 dark:text-indigo-400 hover:underline text-[11px] font-bold cursor-pointer"
              >
                Select All
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={handleClear}
                className="text-rose-600 dark:text-rose-400 hover:underline text-[11px] font-bold cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Scrollable Checkbox Options List */}
          <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5 text-xs">
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-xs">
                No matching options found
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = selectedValues.includes(option.value);
                return (
                  <div
                    key={option.value}
                    onClick={() => toggleOption(option.value)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 font-bold'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div
                        className={`h-4 w-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                      <span className="truncate text-xs">{option.label}</span>
                    </div>

                    {option.count !== undefined && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono shrink-0">
                        {option.count}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const CaseStudyBankPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isAdmin, isCoordinator, isFacultyInternal, isFacultyExternal } = useRoleAccess();
  const isFacultyOrAdmin = isAdmin || isCoordinator || isFacultyInternal || isFacultyExternal;

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [selectedPublishers, setSelectedPublishers] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedLength, setSelectedLength] = useState<string>('all');
  const [selectedResource, setSelectedResource] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<CaseStudy | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formAuthor, setFormAuthor] = useState('');
  const [formConcept, setFormConcept] = useState('');
  const [formObjectives, setFormObjectives] = useState('');
  const [formSource, setFormSource] = useState('');
  const [formDomain, setFormDomain] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formProductNo, setFormProductNo] = useState('');
  const [formPubDate, setFormPubDate] = useState('');
  const [formRevDate, setFormRevDate] = useState('');
  const [formLength, setFormLength] = useState('');
  const [formDuration, setFormDuration] = useState('');
  const [formAccessibility, setFormAccessibility] = useState('ACCESSIBLE');
  const [formLink, setFormLink] = useState('');
  const [formFileUrl, setFormFileUrl] = useState('');
  const [formFileName, setFormFileName] = useState('');
  const [formFileSize, setFormFileSize] = useState<number | undefined>();
  const [formFileType, setFormFileType] = useState<string | undefined>();
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch Case Studies
  const { data: rawCaseStudies = [], isLoading } = useQuery<CaseStudy[]>({
    queryKey: ['case-studies', searchTerm, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (sortBy) params.append('sort_by', sortBy);
      const res = await api.get(`/case-studies?${params.toString()}`);
      return res.data.data;
    },
  });

  // Extract unique metadata for metrics and filters
  const allDomains = useMemo(() => {
    return Array.from(new Set(rawCaseStudies.map((c) => c.industry_domain).filter(Boolean))) as string[];
  }, [rawCaseStudies]);

  const allPublishers = useMemo(() => {
    return Array.from(new Set(rawCaseStudies.map((c) => c.publisher_source).filter(Boolean))) as string[];
  }, [rawCaseStudies]);

  const allAuthors = useMemo(() => {
    const authors = new Set<string>();
    rawCaseStudies.forEach((c) => {
      if (c.author) {
        c.author.split(/[,;&]/).forEach((a) => {
          const trimmed = a.trim();
          if (trimmed) authors.add(trimmed);
        });
      }
    });
    return Array.from(authors);
  }, [rawCaseStudies]);

  // Options with count badges for SearchableMultiSelect
  const domainOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    rawCaseStudies.forEach((c) => {
      if (c.industry_domain) {
        counts[c.industry_domain] = (counts[c.industry_domain] || 0) + 1;
      }
    });
    return Object.keys(counts)
      .sort()
      .map((d) => ({
        label: d,
        value: d,
        count: counts[d],
      }));
  }, [rawCaseStudies]);

  const publisherOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    rawCaseStudies.forEach((c) => {
      if (c.publisher_source) {
        counts[c.publisher_source] = (counts[c.publisher_source] || 0) + 1;
      }
    });
    return Object.keys(counts)
      .sort()
      .map((p) => ({
        label: p,
        value: p,
        count: counts[p],
      }));
  }, [rawCaseStudies]);

  const tagOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    rawCaseStudies.forEach((c) => {
      if (c.subject_tags) {
        c.subject_tags.split(/[,;\n]/).forEach((t) => {
          const trimmed = t.trim();
          if (trimmed) {
            counts[trimmed] = (counts[trimmed] || 0) + 1;
          }
        });
      }
    });
    return Object.keys(counts)
      .sort()
      .map((t) => ({
        label: t,
        value: t,
        count: counts[t],
      }));
  }, [rawCaseStudies]);

  // Multi-dimensional filtering
  const filteredCaseStudies = useMemo(() => {
    return rawCaseStudies.filter((cs) => {
      // Domain Filter
      if (selectedDomains.length > 0) {
        if (!cs.industry_domain || !selectedDomains.includes(cs.industry_domain)) {
          return false;
        }
      }

      // Publisher Filter
      if (selectedPublishers.length > 0) {
        if (!cs.publisher_source || !selectedPublishers.includes(cs.publisher_source)) {
          return false;
        }
      }

      // Subject Tags Filter (Matches if any tag matches selected tag list)
      if (selectedTags.length > 0) {
        if (!cs.subject_tags) return false;
        const caseTagList = cs.subject_tags
          .toLowerCase()
          .split(/[,;\n]/)
          .map((t) => t.trim());
        const hasMatch = selectedTags.some((selected) =>
          caseTagList.some((ct) => ct.includes(selected.toLowerCase()))
        );
        if (!hasMatch) return false;
      }

      // Length Filter
      if (selectedLength !== 'all') {
        const pagesMatch = cs.page_length ? parseInt(cs.page_length.replace(/\D/g, ''), 10) : 0;
        if (selectedLength === 'brief' && pagesMatch > 10) return false;
        if (selectedLength === 'standard' && (pagesMatch < 10 || pagesMatch > 20)) return false;
        if (selectedLength === 'indepth' && pagesMatch < 20) return false;
      }

      // Resource Filter
      if (selectedResource === 'has_file' && !cs.file_url) return false;
      if (selectedResource === 'no_file' && cs.file_url) return false;

      return true;
    });
  }, [rawCaseStudies, selectedDomains, selectedPublishers, selectedTags, selectedLength, selectedResource]);

  // Reset all filters
  const resetFilters = () => {
    setSearchTerm('');
    setSelectedDomains([]);
    setSelectedPublishers([]);
    setSelectedTags([]);
    setSelectedLength('all');
    setSelectedResource('all');
    setSortBy('newest');
  };

  const isFiltered =
    searchTerm !== '' ||
    selectedDomains.length > 0 ||
    selectedPublishers.length > 0 ||
    selectedTags.length > 0 ||
    selectedLength !== 'all' ||
    selectedResource !== 'all' ||
    sortBy !== 'newest';

  // File Upload Handler
  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setErrorMsg(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/case-studies/upload-file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { file_url, file_name, file_size, file_type } = res.data.data;
      setFormFileUrl(file_url);
      setFormFileName(file_name);
      setFormFileSize(file_size);
      setFormFileType(file_type);
      if (!formTitle) {
        setFormTitle(file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '));
      }
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || err?.message || 'Failed to upload case study file');
    } finally {
      setIsUploading(false);
    }
  };

  // Download Handler
  const handleDownload = async (cs: CaseStudy, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!cs.file_url) return;
    try {
      const downloadUrl = cs.file_url.startsWith('http')
        ? cs.file_url
        : `${cs.file_url}?original_name=${encodeURIComponent(cs.file_name || `${cs.title}.pdf`)}`;
      const res = await api.get(downloadUrl, { responseType: 'blob' });
      const mimeType = cs.file_type === 'pdf' ? 'application/pdf' : 'application/octet-stream';
      const blob = new Blob([res.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = cs.file_name || `${cs.title.replace(/[^a-zA-Z0-9_\-]/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Failed to download document: ' + (err?.response?.data?.detail || err?.message || 'Error'));
    }
  };

  // Create / Edit Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!formTitle.trim()) throw new Error('Case study title is required');

      const payload = {
        title: formTitle.trim(),
        author: formAuthor.trim() || null,
        concept: formConcept.trim() || null,
        learning_objectives: formObjectives.trim() || null,
        publisher_source: formSource.trim() || null,
        industry_domain: formDomain.trim() || null,
        subject_tags: formTags.trim() || null,
        product_number: formProductNo.trim() || null,
        publication_date: formPubDate.trim() || null,
        revision_date: formRevDate.trim() || null,
        page_length: formLength.trim() || null,
        duration: formDuration.trim() || null,
        accessibility_status: formAccessibility.trim() || null,
        external_link: formLink.trim() || null,
        file_url: formFileUrl || null,
        file_name: formFileName || null,
        file_size: formFileSize || null,
        file_type: formFileType || null,
      };

      if (editingCase) {
        await api.put(`/case-studies/${editingCase.id}`, payload);
      } else {
        await api.post('/case-studies', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case-studies'] });
      queryClient.invalidateQueries({ queryKey: ['case-study-detail'] });
      closeModal();
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.detail || err?.message || 'Failed to save case study');
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!window.confirm('Are you sure you want to archive this case study from the repository?')) return;
      await api.delete(`/case-studies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case-studies'] });
      queryClient.invalidateQueries({ queryKey: ['case-study-detail'] });
    },
  });

  const [searchParams, setSearchParams] = useSearchParams();

  const updateUrlModal = (m: string | null, params: Record<string, string | undefined> = {}) => {
    const next = new URLSearchParams(searchParams);
    if (!m) {
      next.delete('modal');
      next.delete('id');
    } else {
      next.set('modal', m);
      Object.entries(params).forEach(([k, v]) => {
        if (v) next.set(k, v);
        else next.delete(k);
      });
    }
    setSearchParams(next);
  };

  const openCreateModal = (syncUrl = true) => {
    setEditingCase(null);
    setFormTitle('');
    setFormAuthor('');
    setFormConcept('');
    setFormObjectives('');
    setFormSource('');
    setFormDomain('');
    setFormTags('');
    setFormProductNo('');
    setFormPubDate('');
    setFormRevDate('');
    setFormLength('');
    setFormDuration('');
    setFormAccessibility('ACCESSIBLE');
    setFormLink('');
    setFormFileUrl('');
    setFormFileName('');
    setFormFileSize(undefined);
    setFormFileType(undefined);
    setErrorMsg(null);
    setIsCreateModalOpen(true);
    if (syncUrl) updateUrlModal('createCaseStudy');
  };

  const openEditModal = (cs: CaseStudy, e?: React.MouseEvent, syncUrl = true) => {
    if (e) e.stopPropagation();
    setEditingCase(cs);
    setFormTitle(cs.title || '');
    setFormAuthor(cs.author || '');
    setFormConcept(cs.concept || '');
    setFormObjectives(cs.learning_objectives || '');
    setFormSource(cs.publisher_source || '');
    setFormDomain(cs.industry_domain || '');
    setFormTags(cs.subject_tags || '');
    setFormProductNo(cs.product_number || '');
    setFormPubDate(cs.publication_date || '');
    setFormRevDate(cs.revision_date || '');
    setFormLength(cs.page_length || '');
    setFormDuration(cs.duration || '');
    setFormAccessibility(cs.accessibility_status || 'ACCESSIBLE');
    setFormLink(cs.external_link || '');
    setFormFileUrl(cs.file_url || '');
    setFormFileName(cs.file_name || '');
    setFormFileSize(cs.file_size);
    setFormFileType(cs.file_type);
    setErrorMsg(null);
    setIsCreateModalOpen(true);
    if (syncUrl) updateUrlModal('editCaseStudy', { id: cs.id });
  };

  const closeModal = (syncUrl = true) => {
    setIsCreateModalOpen(false);
    setEditingCase(null);
    setErrorMsg(null);
    if (syncUrl) updateUrlModal(null);
  };

  // Synchronize modal state with URL parameters
  const urlModal = searchParams.get('modal');
  const urlId = searchParams.get('id');

  useEffect(() => {
    if (!urlModal) {
      if (isCreateModalOpen) closeModal(false);
      return;
    }

    if (urlModal === 'createCaseStudy' && !isCreateModalOpen) {
      openCreateModal(false);
    } else if (urlId && rawCaseStudies.length > 0) {
      const found = rawCaseStudies.find((c) => c.id === urlId || c.product_number === urlId);
      if (found) {
        if (urlModal === 'editCaseStudy' && (!isCreateModalOpen || editingCase?.id !== found.id)) {
          openEditModal(found, undefined, false);
        }
      }
    }
  }, [urlModal, urlId, rawCaseStudies]);

  return (
    <div className="space-y-6 animate-fadeIn pb-20">
      {/* Header Banner (Clean Light Background) */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-sm relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5" /> Institutional Repository
              </span>
              <span className="text-xs text-slate-500 font-medium">Lexicon MILE Management Studies</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
              Case Library
            </h1>
            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
              Institutional library of prescribed business and management cases (Harvard, Ivey, Stanford, and In-House case studies). Click any case study to view its dedicated note, learning objectives, and download course assets.
            </p>
          </div>

          {isFacultyOrAdmin && (
            <button
              onClick={() => openCreateModal()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md shadow-indigo-500/20 transition-all hover:scale-105 shrink-0 cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Add Case Study
            </button>
          )}
        </div>
      </div>

      {/* Metrics Row (Meaningful Academic Repository Metrics) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Metric 1: Total Case Studies */}
        <Card className="p-4 flex items-center gap-3.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">{rawCaseStudies.length}</div>
            <div className="text-xs font-semibold text-slate-500">Total Case Studies</div>
          </div>
        </Card>

        {/* Metric 2: Publisher Sources */}
        <Card className="p-4 flex items-center gap-3.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="p-3 rounded-2xl bg-cyan-50 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-400">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {allPublishers.length}
            </div>
            <div className="text-xs font-semibold text-slate-500">Publisher Sources</div>
          </div>
        </Card>

        {/* Metric 3: Disciplines & Domains */}
        <Card className="p-4 flex items-center gap-3.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {allDomains.length}
            </div>
            <div className="text-xs font-semibold text-slate-500">Specialization Domains</div>
          </div>
        </Card>

        {/* Metric 4: Authors & Contributors */}
        <Card className="p-4 flex items-center gap-3.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {allAuthors.length}
            </div>
            <div className="text-xs font-semibold text-slate-500">Authors & Case Writers</div>
          </div>
        </Card>
      </div>

      {/* Multi-Dimensional Filter & Search Toolbar */}
      <div className="space-y-4 p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Row 1: Primary Search Bar, Sort & View Mode Toggle */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Box with generous width */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search case studies by title, author, concept, or product #..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500 font-medium transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title="Clear Search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Sort Order Dropdown */}
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300">
              <ArrowUpDown className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
              >
                <option value="newest">Sort: Newest Added</option>
                <option value="oldest">Sort: Oldest First</option>
                <option value="title">Sort: Title (A - Z)</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 border border-slate-200 dark:border-slate-700 p-1 rounded-2xl bg-slate-50 dark:bg-slate-800/60 shrink-0">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title="Table View"
              >
                <ListIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Filter Refinement Strip with Searchable Multi-Selects */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
              <Filter className="h-3.5 w-3.5 text-indigo-500 shrink-0" /> Filters:
            </div>

            {/* Disciplines Searchable Multi-Select */}
            <SearchableMultiSelect
              label="Disciplines"
              allLabel="All Disciplines"
              options={domainOptions}
              selectedValues={selectedDomains}
              onChange={setSelectedDomains}
              placeholder="Search disciplines..."
            />

            {/* Publishers Searchable Multi-Select */}
            <SearchableMultiSelect
              label="Publishers"
              allLabel="All Publishers"
              options={publisherOptions}
              selectedValues={selectedPublishers}
              onChange={setSelectedPublishers}
              placeholder="Search publishers..."
            />

            {/* Subjects & Tags Searchable Multi-Select */}
            <SearchableMultiSelect
              label="Subjects & Tags"
              allLabel="All Subjects & Tags"
              options={tagOptions}
              selectedValues={selectedTags}
              onChange={setSelectedTags}
              placeholder="Search subjects & tags..."
            />

            {/* Page Length Scope Dropdown */}
            <select
              value={selectedLength}
              onChange={(e) => setSelectedLength(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
            >
              <option value="all">All Case Lengths</option>
              <option value="brief">Brief Case (&lt; 10 pages)</option>
              <option value="standard">Standard Case (10 - 20 pages)</option>
              <option value="indepth">In-Depth Case (&gt; 20 pages)</option>
            </select>

            {/* Document Availability Dropdown */}
            <select
              value={selectedResource}
              onChange={(e) => setSelectedResource(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
            >
              <option value="all">All Resources</option>
              <option value="has_file">With Attached File (PDF)</option>
              <option value="no_file">Note Only (No File)</option>
            </select>

            {/* Reset Filters Button */}
            {isFiltered && (
              <button
                onClick={resetFilters}
                className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold flex items-center gap-1.5 hover:bg-rose-100 transition-colors cursor-pointer"
                title="Reset All Filters"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Clear Filters
              </button>
            )}
          </div>

          <div className="text-xs font-semibold text-slate-400">
            Showing <span className="font-bold text-slate-700 dark:text-slate-300">{filteredCaseStudies.length}</span> of {rawCaseStudies.length} case studies
          </div>
        </div>
      </div>

      {/* Case Studies Display */}
      {isLoading ? (
        <div className="p-20 text-center text-slate-500">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-indigo-500" />
          <p className="text-xs font-bold">Loading Case Library...</p>
        </div>
      ) : filteredCaseStudies.length === 0 ? (
        <div className="p-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900">
          <Briefcase className="h-10 w-10 text-indigo-400 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Business Case Studies Match Your Filters</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {isFiltered
              ? 'Try resetting some of your search terms or filter criteria.'
              : 'Add your first business case study to the institutional repository to get started.'}
          </p>
          {isFiltered && (
            <button
              onClick={resetFilters}
              className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer"
            >
              Reset All Filters
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCaseStudies.map((cs) => (
            <div
              key={cs.id}
              onClick={() => navigate(getCaseStudyUrl(cs))}
              className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between hover:border-indigo-300 dark:hover:border-indigo-700 cursor-pointer group"
            >
              <div className="space-y-3">
                {/* Highlighted Publisher Source & Discipline Badge */}
                <div className="flex items-center justify-between gap-2">
                  {cs.publisher_source ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200/90 dark:border-indigo-800">
                      <Building2 className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      {cs.publisher_source}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500">
                      Prescribed Case
                    </span>
                  )}

                  {cs.industry_domain && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-cyan-50 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                      {cs.industry_domain}
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-snug">
                    {cs.title}
                  </h3>
                  {cs.author && (
                    <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">
                      By: {cs.author}
                    </div>
                  )}
                </div>

                {cs.concept && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Overview & Focus
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-3 leading-relaxed text-justify">
                      {cs.concept}
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>
                    {cs.publication_date ? `Pub: ${cs.publication_date}` : ''}
                    {cs.revision_date ? ` (Rev: ${cs.revision_date})` : ''}
                  </span>
                  {cs.page_length && <span>{cs.page_length}</span>}
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:underline">
                      {isFacultyOrAdmin ? 'View Details & Note' : 'View Case Details'} <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`${getCaseStudyUrl(cs)}?tab=ai_analyzer`);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors"
                      title="Launch AI Case Analyzer"
                    >
                      <BrainCircuit className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                      <span>AI Analyzer</span>
                    </button>

                    {cs.file_url && (
                      <button
                        type="button"
                        onClick={(e) => handleDownload(cs, e)}
                        className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-200 dark:border-indigo-800 cursor-pointer"
                        title="Download Document"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {isFacultyOrAdmin && (
                      <>
                        <button
                          onClick={(e) => openEditModal(cs, e)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Edit Case Study"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMutation.mutate(cs.id);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors cursor-pointer"
                          title="Archive Case Study"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <table className="w-full text-xs text-left min-w-[750px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                <th className="py-3 px-4 min-w-[240px]">Case Study Title & Author</th>
                <th className="py-3 px-4 w-44 text-left">Publisher / Source</th>
                <th className="py-3 px-4 w-36">Discipline</th>
                <th className="py-3 px-4 w-40">Publication Date</th>
                <th className="py-3 px-4 min-w-[200px]">Overview Note</th>
                <th className="py-3 px-4 w-36 text-center">Actions & Resource</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredCaseStudies.map((cs) => (
                <tr
                  key={cs.id}
                  onClick={() => navigate(getCaseStudyUrl(cs))}
                  className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 cursor-pointer"
                >
                  <td className="py-3 px-4 align-top">
                    <div className="font-bold text-slate-900 dark:text-white leading-snug hover:text-indigo-600 transition-colors">
                      {cs.title}
                    </div>
                    {cs.author && (
                      <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
                        By: {cs.author}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 align-top">
                    {cs.publisher_source ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        <Building2 className="h-3 w-3 text-indigo-500" /> {cs.publisher_source}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 align-top">
                    {cs.industry_domain ? (
                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold bg-cyan-50 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                        {cs.industry_domain}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 align-top text-slate-600 dark:text-slate-400">
                    <div>{cs.publication_date || '—'}</div>
                    {cs.revision_date && (
                      <div className="text-[10px] text-slate-400">Rev: {cs.revision_date}</div>
                    )}
                  </td>
                  <td className="py-3 px-4 align-top text-slate-700 dark:text-slate-300 leading-relaxed line-clamp-2">
                    {cs.concept || '—'}
                  </td>
                  <td className="py-3 px-4 text-center align-top" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1.5">
                      <Link
                        to={`${getCaseStudyUrl(cs)}?tab=ai_analyzer`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors"
                        title="Launch AI Case Analyzer"
                      >
                        <BrainCircuit className="h-3 w-3" />
                        <span>AI Analysis</span>
                      </Link>
                      <Link
                        to={getCaseStudyUrl(cs)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-200"
                      >
                        View Brief
                      </Link>
                      {cs.file_url && (
                        <button
                          type="button"
                          onClick={(e) => handleDownload(cs, e)}
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-indigo-600 font-bold cursor-pointer"
                          title="Download"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {isFacultyOrAdmin && (
                        <button
                          onClick={(e) => openEditModal(cs, e)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 cursor-pointer"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                  <Briefcase className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {editingCase ? 'Edit Business Case Study' : 'Add New Business Case Study'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Only title is mandatory. All other publishing details and file uploads can be added as needed.
                  </p>
                </div>
              </div>
              <button
                onClick={() => closeModal()}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-bold text-rose-700 dark:text-rose-300">
                  {errorMsg}
                </div>
              )}

              {/* Title (Only Mandatory Field) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Case Study Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Tech Mahindra and the Acquisition of Satyam Computers"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>

              {/* Author & Source */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Author / Creator
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Srikant M. Datar, Anjali Raina, Namrata Arora"
                    value={formAuthor}
                    onChange={(e) => setFormAuthor(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Source / Publisher
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Harvard Business School"
                    value={formSource}
                    onChange={(e) => setFormSource(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Overview / Synopsis */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Overview / Synopsis Note
                </label>
                <textarea
                  rows={3}
                  placeholder="Summarize the core case synopsis, business scenario, and strategic dilemma..."
                  value={formConcept}
                  onChange={(e) => setFormConcept(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500 leading-relaxed"
                />
              </div>

              {/* Learning Objectives */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Learning Objectives
                </label>
                <textarea
                  rows={3}
                  placeholder="Outline key learning outcomes, pedagogical modules, analytical tools, or discussion takeaways..."
                  value={formObjectives}
                  onChange={(e) => setFormObjectives(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500 leading-relaxed"
                />
              </div>

              {/* Discipline, Tags & Product # */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Discipline
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Accounting"
                    value={formDomain}
                    onChange={(e) => setFormDomain(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Subjects / Tags
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Accounting, Corporate Governance"
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Product #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 114049-PDF-ENG"
                    value={formProductNo}
                    onChange={(e) => setFormProductNo(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              {/* Publication Date, Revision Date, Length & Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Publication Date
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Jan 7, 2014"
                    value={formPubDate}
                    onChange={(e) => setFormPubDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Revision Date
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. May 6, 2014"
                    value={formRevDate}
                    onChange={(e) => setFormRevDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Length
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 18 page(s)"
                    value={formLength}
                    onChange={(e) => setFormLength(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Duration
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 38 minutes"
                    value={formDuration}
                    onChange={(e) => setFormDuration(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              {/* Document Upload (Dropzone) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Attached Case Study Document
                </label>
                {formFileUrl ? (
                  <div className="flex items-center justify-between p-3 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Paperclip className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {formFileName || 'Case_Study_Document.pdf'}
                        </div>
                        {formFileSize && (
                          <div className="text-[10px] text-slate-400">
                            {Math.round(formFileSize / 1024)} KB • Attached for instant student access
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <label className="cursor-pointer px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-xs font-bold text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-colors">
                        Replace File
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleFileUpload(e.target.files[0]);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed border-indigo-200 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-950/20 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40 cursor-pointer transition-colors text-center">
                    {isUploading ? (
                      <div className="flex flex-col items-center gap-2 text-indigo-600 dark:text-indigo-400">
                        <RefreshCw className="h-6 w-6 animate-spin" />
                        <span className="text-xs font-bold">Uploading Document...</span>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-6 w-6 text-indigo-500 mb-1" />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          Click to upload document (PDF, Word, PPT, or Text)
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5">
                          Upload file or leave blank to save the note and metadata
                        </span>
                      </>
                    )}
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
                      className="hidden"
                      disabled={isUploading}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileUpload(e.target.files[0]);
                        }
                      }}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <button
                type="button"
                onClick={() => closeModal()}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || isUploading}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {saveMutation.isPending ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {editingCase ? 'Update Case Study' : 'Add to Repository'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
