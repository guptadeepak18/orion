import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  CheckSquare,
  Square,
  Download,
  Filter,
  CheckCircle2,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { api } from '../../lib/api';
import * as XLSX from 'xlsx';

export interface ExportFieldOption {
  key: string;
  label: string;
  category: 'student' | 'session' | 'attendance';
  description?: string;
}

export const ALL_EXPORT_FIELDS: ExportFieldOption[] = [
  // Student Information
  { key: 'student_prn', label: 'PRN Number', category: 'student' },
  { key: 'student_name', label: 'Student Name', category: 'student' },
  { key: 'roll_no', label: 'Roll Number', category: 'student' },
  { key: 'official_email', label: 'Official Email', category: 'student' },
  { key: 'personal_email', label: 'Personal Email', category: 'student' },
  { key: 'phone', label: 'Mobile Number', category: 'student' },
  { key: 'program_name', label: 'Academic Program', category: 'student' },
  { key: 'batch_name', label: 'Batch', category: 'student' },
  { key: 'division', label: 'Division', category: 'student' },
  { key: 'trimester', label: 'Trimester', category: 'student' },

  // Session & Class Details
  { key: 'session_date', label: 'Session Date (YYYY-MM-DD)', category: 'session' },
  { key: 'day_of_week', label: 'Day of Week', category: 'session' },
  { key: 'time_slot', label: 'Time Slot', category: 'session' },
  { key: 'start_time', label: 'Start Time', category: 'session' },
  { key: 'end_time', label: 'End Time', category: 'session' },
  { key: 'subject_code', label: 'Subject Code', category: 'session' },
  { key: 'subject_name', label: 'Subject Name', category: 'session' },
  { key: 'topic_delivered', label: 'Topic / Activity Title', category: 'session' },
  { key: 'session_type', label: 'Session Type', category: 'session' },
  { key: 'venue', label: 'Venue / Classroom', category: 'session' },
  { key: 'faculty_name', label: 'Faculty Name', category: 'session' },

  // Attendance Status & Records
  { key: 'status', label: 'Attendance Status (Present / Absent)', category: 'attendance' },
  { key: 'marked_at', label: 'Marked At Timestamp', category: 'attendance' },
  { key: 'remarks', label: 'Remarks / Notes', category: 'attendance' },
];

export const PRESET_CONFIGS: Record<string, { label: string; icon: string; fields: string[] }> = {
  standard: {
    label: 'Standard Report',
    icon: '📊',
    fields: [
      'student_prn',
      'student_name',
      'batch_name',
      'session_date',
      'day_of_week',
      'time_slot',
      'subject_code',
      'subject_name',
      'faculty_name',
      'status',
    ],
  },
  all: {
    label: 'All 24 Fields',
    icon: '⚡',
    fields: ALL_EXPORT_FIELDS.map((f) => f.key),
  },
  roster: {
    label: 'Student Roster',
    icon: '🎓',
    fields: [
      'student_prn',
      'student_name',
      'roll_no',
      'program_name',
      'batch_name',
      'division',
      'phone',
      'official_email',
      'session_date',
      'subject_name',
      'status',
    ],
  },
  audit: {
    label: 'Academic Audit Log',
    icon: '🔍',
    fields: [
      'session_date',
      'day_of_week',
      'time_slot',
      'subject_name',
      'topic_delivered',
      'venue',
      'faculty_name',
      'student_prn',
      'student_name',
      'status',
      'marked_at',
      'remarks',
    ],
  },
};

interface ExportAttendanceExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: {
    startDate?: string;
    endDate?: string;
    batchId?: string;
    subjectId?: string;
    sessionId?: string;
    status?: string;
    search?: string;
  };
  totalMatchingRecords: number;
  previewItems?: any[];
}

export const ExportAttendanceExcelModal: React.FC<ExportAttendanceExcelModalProps> = ({
  isOpen,
  onClose,
  filters,
  totalMatchingRecords,
  previewItems = [],
}) => {
  const [selectedKeys, setSelectedKeys] = useState<string[]>(PRESET_CONFIGS.standard.fields);
  const [filename, setFilename] = useState<string>(
    `Attendance_Ledger_${new Date().toISOString().split('T')[0]}`
  );
  const [activeCategory, setActiveCategory] = useState<'all' | 'student' | 'session' | 'attendance'>('all');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleField = (key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSelectAll = () => {
    setSelectedKeys(ALL_EXPORT_FIELDS.map((f) => f.key));
  };

  const handleDeselectAll = () => {
    setSelectedKeys([]);
  };

  const applyPreset = (presetKey: string) => {
    const p = PRESET_CONFIGS[presetKey];
    if (p) {
      setSelectedKeys(p.fields);
    }
  };

  const handleDownload = async () => {
    if (selectedKeys.length === 0) {
      setExportError('Please select at least one field to export.');
      return;
    }

    setIsExporting(true);
    setExportError(null);

    const safeFilename = (filename.trim() || 'Attendance_Ledger').replace(/\.xlsx$/i, '');

    try {
      // Primary Method: Server-side formatted styled Excel file
      const payload = {
        fields: selectedKeys,
        start_date: filters.startDate || null,
        end_date: filters.endDate || null,
        batch_id: filters.batchId || null,
        subject_id: filters.subjectId || null,
        session_id: filters.sessionId || null,
        status: filters.status || null,
        search: filters.search || null,
        filename: safeFilename,
      };

      const res = await api.post('/attendance/student-ledger/export-excel', payload, {
        responseType: 'blob',
      });

      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${safeFilename}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      onClose();
    } catch (err: any) {
      console.warn('Backend excel export failed, falling back to client-side XLSX generator:', err);
      // Fallback Method: Client-side XLSX generation
      try {
        const fieldLabels: Record<string, string> = {};
        ALL_EXPORT_FIELDS.forEach((f) => {
          fieldLabels[f.key] = f.label;
        });

        // Use preview items or fetch items
        let exportData = previewItems;
        if (!exportData || exportData.length === 0) {
          const res = await api.get('/attendance/student-ledger', {
            params: {
              start_date: filters.startDate || undefined,
              end_date: filters.endDate || undefined,
              batch_id: filters.batchId || undefined,
              subject_id: filters.subjectId || undefined,
              session_id: filters.sessionId || undefined,
              status: filters.status || undefined,
              search: filters.search || undefined,
              limit: 5000,
            },
          });
          exportData = res.data?.data?.items || [];
        }

        const rows = exportData.map((item) => {
          const rowObj: Record<string, any> = {};
          selectedKeys.forEach((k) => {
            const label = fieldLabels[k] || k;
            rowObj[label] = item[k] !== undefined && item[k] !== null ? item[k] : '';
          });
          return rowObj;
        });

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Ledger');
        XLSX.writeFile(workbook, `${safeFilename}.xlsx`);
        onClose();
      } catch (clientErr: any) {
        setExportError(clientErr?.message || 'Failed to generate Excel file. Please try again.');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const filteredFields = ALL_EXPORT_FIELDS.filter((f) => {
    if (activeCategory === 'all') return true;
    return f.category === activeCategory;
  });

  return (
    <div className="fixed inset-0 z-80 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-600 text-white font-black shadow-md shadow-emerald-500/20">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                Export Attendance to Excel
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  .XLSX Format
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose exactly which student, class, and attendance fields to include in your spreadsheet.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Filename & Scope Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                File Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  placeholder="Attendance_Ledger"
                  className="w-full pl-3.5 pr-14 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                  .xlsx
                </span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 flex flex-col justify-center">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                <Filter className="h-3.5 w-3.5" />
                <span>Export Scope Summary</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{totalMatchingRecords}</span> records will be exported matching active filters.
              </p>
            </div>
          </div>

          {/* Quick Presets */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Quick Field Presets
              </span>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="text-slate-500 hover:underline font-bold cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(PRESET_CONFIGS).map(([key, preset]) => {
                const isSelected =
                  preset.fields.length === selectedKeys.length &&
                  preset.fields.every((k) => selectedKeys.includes(k));
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyPreset(key)}
                    className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/60 shadow-xs ring-1 ring-indigo-500'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base">{preset.icon}</span>
                      {isSelected && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                      )}
                    </div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {preset.label}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {preset.fields.length} columns
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
            {[
              { id: 'all', label: `All Fields (${ALL_EXPORT_FIELDS.length})` },
              {
                id: 'student',
                label: `Student Info (${ALL_EXPORT_FIELDS.filter((f) => f.category === 'student').length})`,
              },
              {
                id: 'session',
                label: `Session & Class (${ALL_EXPORT_FIELDS.filter((f) => f.category === 'session').length})`,
              },
              {
                id: 'attendance',
                label: `Attendance Status (${ALL_EXPORT_FIELDS.filter((f) => f.category === 'attendance').length})`,
              },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id as any)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer text-center ${
                  activeCategory === cat.id
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Fields Selection Checkbox Grid */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-slate-50/30 dark:bg-slate-900/30">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[260px] overflow-y-auto pr-1">
              {filteredFields.map((field) => {
                const isChecked = selectedKeys.includes(field.key);
                return (
                  <div
                    key={field.key}
                    onClick={() => toggleField(field.key)}
                    className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all cursor-pointer select-none ${
                      isChecked
                        ? 'border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/40 dark:bg-indigo-950/30'
                        : 'border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 hover:bg-slate-100/50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="shrink-0">
                      {isChecked ? (
                        <CheckSquare className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      ) : (
                        <Square className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold truncate ${
                        isChecked
                          ? 'text-slate-900 dark:text-white'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}>
                        {field.label}
                      </p>
                      <p className="text-[10px] font-mono text-slate-400 truncate">
                        key: {field.key}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {exportError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs font-bold">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{exportError}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-bold">
            <span className="text-indigo-600 dark:text-indigo-400">{selectedKeys.length}</span> of {ALL_EXPORT_FIELDS.length} columns selected
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={isExporting || selectedKeys.length === 0}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              <Download className={`h-4 w-4 ${isExporting ? 'animate-bounce' : ''}`} />
              {isExporting ? 'Generating Excel...' : 'Download Excel (.xlsx)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
