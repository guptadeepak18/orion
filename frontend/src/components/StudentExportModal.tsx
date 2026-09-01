import React, { useState } from 'react';
import { Download, X, CheckSquare, Square, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

export interface StudentExportData {
  id: string;
  full_name: string;
  prn_number: string;
  email_official?: string;
  email?: string;
  mobile_number?: string;
  phone?: string;
  program_name?: string;
  batch_name?: string;
  division_names?: string[];
  trimester?: number;
  roll_no?: string;
  gender?: string;
  father_name?: string;
  mother_name?: string;
  specialization_major?: string;
  specialization_minor?: string;
  ug_degree?: string;
  ug_score?: number | string;
  status?: string;
}

export interface ExportFieldOption {
  key: string;
  label: string;
  category: 'primary' | 'academic' | 'personal';
  defaultSelected: boolean;
  getValue: (s: StudentExportData) => string;
}

export const EXPORT_STUDENT_FIELDS: ExportFieldOption[] = [
  { key: 'prn_number', label: 'PRN Number', category: 'primary', defaultSelected: true, getValue: (s) => s.prn_number || '—' },
  { key: 'full_name', label: 'Full Name', category: 'primary', defaultSelected: true, getValue: (s) => s.full_name || '—' },
  { key: 'email_official', label: 'Official Email', category: 'primary', defaultSelected: true, getValue: (s) => s.email_official || s.email || '—' },
  { key: 'mobile_number', label: 'Mobile Number', category: 'primary', defaultSelected: true, getValue: (s) => s.mobile_number || s.phone || '—' },
  { key: 'program_name', label: 'Program', category: 'academic', defaultSelected: true, getValue: (s) => s.program_name || '—' },
  { key: 'batch_name', label: 'Batch', category: 'academic', defaultSelected: true, getValue: (s) => s.batch_name || '—' },
  { key: 'division_names', label: 'Division', category: 'academic', defaultSelected: true, getValue: (s) => (s.division_names && s.division_names.length > 0 ? s.division_names.join(', ') : '—') },
  { key: 'trimester', label: 'Trimester', category: 'academic', defaultSelected: true, getValue: (s) => s.trimester ? `Trimester ${s.trimester}` : '—' },
  { key: 'specialization_major', label: 'Major Specialization', category: 'academic', defaultSelected: false, getValue: (s) => s.specialization_major || '—' },
  { key: 'specialization_minor', label: 'Minor Specialization', category: 'academic', defaultSelected: false, getValue: (s) => s.specialization_minor || '—' },
  { key: 'gender', label: 'Gender', category: 'personal', defaultSelected: false, getValue: (s) => s.gender || '—' },
  { key: 'father_name', label: 'Father Name', category: 'personal', defaultSelected: false, getValue: (s) => s.father_name || '—' },
  { key: 'mother_name', label: 'Mother Name', category: 'personal', defaultSelected: false, getValue: (s) => s.mother_name || '—' },
  { key: 'ug_degree', label: 'UG Degree', category: 'personal', defaultSelected: false, getValue: (s) => s.ug_degree || '—' },
  { key: 'ug_score', label: 'UG Score', category: 'personal', defaultSelected: false, getValue: (s) => s.ug_score ? `${s.ug_score}%` : '—' },
  { key: 'status', label: 'Status', category: 'primary', defaultSelected: false, getValue: (s) => s.status || 'Active' },
];

interface StudentExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  students: StudentExportData[];
  filenamePrefix: string;
}

export const StudentExportModal: React.FC<StudentExportModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  students,
  filenamePrefix,
}) => {
  const [selectedKeys, setSelectedKeys] = useState<string[]>(
    EXPORT_STUDENT_FIELDS.filter((f) => f.defaultSelected).map((f) => f.key)
  );

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleField = (key: string) => {
    if (selectedKeys.includes(key)) {
      setSelectedKeys(selectedKeys.filter((k) => k !== key));
    } else {
      setSelectedKeys([...selectedKeys, key]);
    }
  };

  const selectAll = () => {
    setSelectedKeys(EXPORT_STUDENT_FIELDS.map((f) => f.key));
  };

  const deselectAll = () => {
    setSelectedKeys([]);
  };

  const handleExport = () => {
    if (selectedKeys.length === 0) return;

    const selectedFields = EXPORT_STUDENT_FIELDS.filter((f) => selectedKeys.includes(f.key));

    const rowData = students.map((s) => {
      const row: Record<string, string> = {};
      selectedFields.forEach((field) => {
        row[field.label] = field.getValue(s);
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(rowData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');

    // Auto column width calculation
    const colWidths = selectedFields.map((field) => {
      const maxLen = Math.max(
        field.label.length,
        ...rowData.map((r) => (r[field.label] ? String(r[field.label]).length : 0))
      );
      return { wch: Math.min(Math.max(maxLen + 4, 12), 45) };
    });
    worksheet['!cols'] = colWidths;

    const dateStr = new Date().toISOString().slice(0, 10);
    const cleanFilename = `${filenamePrefix.replace(/[^a-zA-Z0-9_-]/g, '_')}_${dateStr}.xlsx`;
    XLSX.writeFile(workbook, cleanFilename);

    onClose();
  };

  const categories = [
    { id: 'primary', label: 'Primary Information' },
    { id: 'academic', label: 'Academic & Program Details' },
    { id: 'personal', label: 'Personal & Qualification Details' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="glass-panel w-full max-w-2xl rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 transition-colors duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title} — Export to Excel (.xlsx)</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle} · {students.length} student(s)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Selection Bar */}
        <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800/80">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            {selectedKeys.length} of {EXPORT_STUDENT_FIELDS.length} fields selected
          </span>
          <div className="flex items-center space-x-3 text-xs">
            <button
              onClick={selectAll}
              className="text-cyan-600 dark:text-cyan-400 font-semibold hover:underline flex items-center space-x-1"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              <span>Select All</span>
            </button>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <button
              onClick={deselectAll}
              className="text-slate-500 dark:text-slate-400 font-semibold hover:underline flex items-center space-x-1"
            >
              <Square className="h-3.5 w-3.5" />
              <span>Deselect All</span>
            </button>
          </div>
        </div>

        {/* Category Field Checkboxes */}
        <div className="py-4 space-y-4 max-h-96 overflow-y-auto pr-1">
          {categories.map((cat) => {
            const fieldsInCat = EXPORT_STUDENT_FIELDS.filter((f) => f.category === cat.id);
            return (
              <div key={cat.id} className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  {cat.label}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {fieldsInCat.map((field) => {
                    const isChecked = selectedKeys.includes(field.key);
                    return (
                      <div
                        key={field.key}
                        onClick={() => toggleField(field.key)}
                        className={`p-2.5 rounded-xl border flex items-center space-x-3 cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-emerald-50/70 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                            : 'bg-slate-50/50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-xs font-semibold">{field.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Export format: <span className="font-semibold text-slate-700 dark:text-slate-300">Microsoft Excel (.xlsx)</span>
          </p>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={selectedKeys.length === 0}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Export {students.length} Student(s)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
