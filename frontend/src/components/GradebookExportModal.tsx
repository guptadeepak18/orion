import React, { useState } from 'react';
import { Download, X, CheckSquare, Square, FileSpreadsheet, Layers } from 'lucide-react';
import * as XLSX from 'xlsx';

export interface GradebookExportField {
  key: string;
  label: string;
  category: 'identity' | 'cce' | 'hyperbuild' | 'term_end' | 'composite';
  defaultSelected: boolean;
}

export const GRADEBOOK_EXPORT_FIELDS: GradebookExportField[] = [
  // Student Identity
  { key: 'prn', label: 'PRN Number', category: 'identity', defaultSelected: true },
  { key: 'name', label: 'Student Full Name', category: 'identity', defaultSelected: true },
  { key: 'email', label: 'Official Email', category: 'identity', defaultSelected: true },
  { key: 'division', label: 'Class Division', category: 'identity', defaultSelected: true },
  { key: 'batch', label: 'Batch', category: 'identity', defaultSelected: true },
  { key: 'program', label: 'Academic Program', category: 'identity', defaultSelected: true },

  // CCE Component
  { key: 'cce_score', label: 'CCE Marks Obtained', category: 'cce', defaultSelected: true },
  { key: 'cce_max', label: 'CCE Max Marks', category: 'cce', defaultSelected: true },

  // HyperBuild Component
  { key: 'hb_completion', label: 'Labs Completed / Total Released (e.g. 2 / 2)', category: 'hyperbuild', defaultSelected: true },
  { key: 'hb_total', label: 'HyperBuild Total Score (Points)', category: 'hyperbuild', defaultSelected: true },
  { key: 'hb_average', label: 'HyperBuild Average (/100)', category: 'hyperbuild', defaultSelected: true },

  // Term End Component
  { key: 'term_end_score', label: 'Term End Exam Marks Obtained', category: 'term_end', defaultSelected: true },
  { key: 'term_end_max', label: 'Term End Max Marks', category: 'term_end', defaultSelected: true },

  // Composite & Standing
  { key: 'total_percentage', label: 'Subject Composite Percentage (%)', category: 'composite', defaultSelected: true },
  { key: 'grade_letter', label: 'Subject Letter Grade (O, A+, A...)', category: 'composite', defaultSelected: true },
  { key: 'performance_tier', label: 'Subject Performance Tier (Distinction/Merit...)', category: 'composite', defaultSelected: true },
  { key: 'overall_average', label: 'Overall Cohort Average (%)', category: 'composite', defaultSelected: true },
  { key: 'overall_tier', label: 'Overall Cohort Performance Tier', category: 'composite', defaultSelected: true },
];

interface GradebookExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  cohortRows: any[];
  subjects: any[];
  currentSubjectId?: string;
}

export const GradebookExportModal: React.FC<GradebookExportModalProps> = ({
  isOpen,
  onClose,
  cohortRows,
  subjects,
  currentSubjectId,
}) => {
  const [selectedSubjectScope, setSelectedSubjectScope] = useState<string>(currentSubjectId || 'ALL');
  const [selectedKeys, setSelectedKeys] = useState<string[]>(
    GRADEBOOK_EXPORT_FIELDS.filter((f) => f.defaultSelected).map((f) => f.key)
  );

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      if (currentSubjectId) {
        setSelectedSubjectScope(currentSubjectId);
      }
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, currentSubjectId]);

  if (!isOpen) return null;

  const toggleField = (key: string) => {
    if (selectedKeys.includes(key)) {
      setSelectedKeys(selectedKeys.filter((k) => k !== key));
    } else {
      setSelectedKeys([...selectedKeys, key]);
    }
  };

  const selectAll = () => {
    setSelectedKeys(GRADEBOOK_EXPORT_FIELDS.map((f) => f.key));
  };

  const deselectAll = () => {
    setSelectedKeys([]);
  };

  const handleExport = () => {
    if (selectedKeys.length === 0 || cohortRows.length === 0) return;

    const isSingleSubject = selectedSubjectScope !== 'ALL';
    const singleSubjObj = isSingleSubject
      ? subjects.find((s) => s.id === selectedSubjectScope)
      : null;

    const exportData: Record<string, any>[] = [];

    cohortRows.forEach((row) => {
      const item: Record<string, any> = {};

      // Student Identity
      if (selectedKeys.includes('prn')) item['PRN Number'] = row.prn || '—';
      if (selectedKeys.includes('name')) item['Student Name'] = row.name || '—';
      if (selectedKeys.includes('email')) item['Official Email'] = row.email || '—';
      if (selectedKeys.includes('division')) item['Division'] = row.division || '—';
      if (selectedKeys.includes('batch')) item['Batch'] = row.batch || '—';
      if (selectedKeys.includes('program')) item['Program'] = row.program || '—';

      if (isSingleSubject && singleSubjObj) {
        const subjData = row.subjects?.find((s: any) => s.subject_id === singleSubjObj.id) || row.subjects?.[0] || {};
        
        if (selectedKeys.includes('cce_score')) item[`CCE Marks (${subjData.cce_max_marks || 50})`] = subjData.cce_score ?? '—';
        if (selectedKeys.includes('cce_max')) item['CCE Max Marks'] = subjData.cce_max_marks || 50;

        if (selectedKeys.includes('hb_completion')) {
          item['HyperBuild Labs Completed / Total'] = subjData.completion_ratio || `${subjData.activities_completed || 0} / ${subjData.total_released_activities || 0}`;
        }
        if (selectedKeys.includes('hb_total')) item['HyperBuild Total Points'] = subjData.hyperbuild_total_score ?? '—';
        if (selectedKeys.includes('hb_average')) item['HyperBuild Avg (/100)'] = subjData.hyperbuild_score ?? '—';

        if (selectedKeys.includes('term_end_score')) item[`Term End Exam Marks (${subjData.term_end_max_marks || 50})`] = subjData.term_end_score ?? '—';
        if (selectedKeys.includes('term_end_max')) item['Term End Max Marks'] = subjData.term_end_max_marks || 50;

        if (selectedKeys.includes('total_percentage')) item['Total Score (%)'] = subjData.total_percentage !== null && subjData.total_percentage !== undefined ? `${subjData.total_percentage}%` : '—';
        if (selectedKeys.includes('grade_letter')) item['Letter Grade'] = subjData.grade_letter || '—';
        if (selectedKeys.includes('performance_tier')) item['Performance Tier'] = subjData.performance_tier || '—';
      } else {
        // Master Cohort View: Add subject columns dynamically
        if (selectedKeys.includes('overall_average')) {
          item['Overall Cohort Avg (%)'] = row.overall_average !== null && row.overall_average !== undefined ? `${row.overall_average}%` : '—';
        }
        if (selectedKeys.includes('overall_tier')) {
          item['Overall Standing Tier'] = row.overall_tier || '—';
        }

        row.subjects?.forEach((s: any) => {
          const prefix = s.subject_code || s.subject_name || 'Subject';
          if (selectedKeys.includes('cce_score')) item[`[${prefix}] CCE`] = s.cce_score ?? '—';
          if (selectedKeys.includes('hb_completion')) {
            item[`[${prefix}] Labs Completed/Released`] = s.completion_ratio || `${s.activities_completed || 0} / ${s.total_released_activities || 0}`;
          }
          if (selectedKeys.includes('hb_average')) item[`[${prefix}] HyperBuild Avg (/100)`] = s.hyperbuild_score ?? '—';
          if (selectedKeys.includes('term_end_score')) item[`[${prefix}] End Term`] = s.term_end_score ?? '—';
          if (selectedKeys.includes('total_percentage')) item[`[${prefix}] Total %`] = s.total_percentage !== null && s.total_percentage !== undefined ? `${s.total_percentage}%` : '—';
          if (selectedKeys.includes('grade_letter')) item[`[${prefix}] Grade`] = s.grade_letter || '—';
          if (selectedKeys.includes('performance_tier')) item[`[${prefix}] Tier`] = s.performance_tier || '—';
        });
      }

      exportData.push(item);
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    const sheetName = isSingleSubject && singleSubjObj ? singleSubjObj.code.slice(0, 31) : 'Cohort Marksheet';
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Auto-fit column widths
    const headers = Object.keys(exportData[0] || {});
    const colWidths = headers.map((header) => {
      const maxLen = Math.max(
        header.length,
        ...exportData.map((row) => (row[header] ? String(row[header]).length : 0))
      );
      return { wch: Math.min(Math.max(maxLen + 3, 11), 50) };
    });
    worksheet['!cols'] = colWidths;

    const dateStr = new Date().toISOString().slice(0, 10);
    const prefix = isSingleSubject && singleSubjObj ? `${singleSubjObj.code}_Gradebook` : 'Cohort_Master_Gradebook';
    const filename = `${prefix}_${dateStr}.xlsx`;

    XLSX.writeFile(workbook, filename);
    onClose();
  };

  const categories = [
    { id: 'identity', label: '1. Student Demographics & Credentials' },
    { id: 'cce', label: '2. Continuous Comprehensive Evaluation (CCE)' },
    { id: 'hyperbuild', label: '3. HyperBuild Simulation Labs' },
    { id: 'term_end', label: '4. Term End Examination' },
    { id: 'composite', label: '5. Overall Standing & Performance Tiers' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-3xl rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 space-y-5 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Gradebook Marksheet Export — Excel (.xlsx)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose evaluation components and student credentials to include in your spreadsheet
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scope Selector Bar */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Export Scope:</span>
          </div>
          <select
            value={selectedSubjectScope}
            onChange={(e) => setSelectedSubjectScope(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
          >
            <option value="ALL">All Enrolled Subjects (Master Cohort Matrix)</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Quick Select Buttons */}
        <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800 shrink-0 text-xs">
          <span className="font-semibold text-slate-500">
            {selectedKeys.length} of {GRADEBOOK_EXPORT_FIELDS.length} columns selected
          </span>
          <div className="flex items-center space-x-3">
            <button
              onClick={selectAll}
              className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center space-x-1 cursor-pointer"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              <span>Select All</span>
            </button>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <button
              onClick={deselectAll}
              className="text-slate-500 font-semibold hover:underline flex items-center space-x-1 cursor-pointer"
            >
              <Square className="h-3.5 w-3.5" />
              <span>Deselect All</span>
            </button>
          </div>
        </div>

        {/* Field Selector Grid (Scrollable) */}
        <div className="overflow-y-auto space-y-4 pr-1 flex-1">
          {categories.map((cat) => {
            const fields = GRADEBOOK_EXPORT_FIELDS.filter((f) => f.category === cat.id);
            return (
              <div key={cat.id} className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {cat.label}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {fields.map((field) => {
                    const checked = selectedKeys.includes(field.key);
                    return (
                      <div
                        key={field.key}
                        onClick={() => toggleField(field.key)}
                        className={`flex items-center space-x-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          checked
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-bold'
                            : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-medium'
                        }`}
                      >
                        {checked ? (
                          <CheckSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        ) : (
                          <Square className="h-4 w-4 text-slate-400 shrink-0" />
                        )}
                        <span className="truncate">{field.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <span className="text-xs text-slate-400">
            Exporting {cohortRows.length} student row(s) to native Excel (.xlsx)
          </span>
          <div className="flex items-center space-x-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={selectedKeys.length === 0 || cohortRows.length === 0}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/20 flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              <span>Download Excel (.xlsx)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
