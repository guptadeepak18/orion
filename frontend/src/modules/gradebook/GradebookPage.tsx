import React, { useState } from 'react';
import { useAuthStore } from '../../lib/store';
import { StudentGradebookView } from './StudentGradebookView';
import { AdminGradebookDashboard } from './AdminGradebookDashboard';
import { Award, User, Users } from 'lucide-react';

export const GradebookPage: React.FC = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'admin' | 'student_preview'>('admin');

  const isStudent = user?.roles?.includes('student') && !user?.roles?.some(r => ['crc_admin', 'crc_coordinator', 'faculty_internal', 'faculty_external'].includes(r));

  if (isStudent) {
    return <StudentGradebookView />;
  }

  // Admin / Faculty View with Preview Toggle
  return (
    <div className="space-y-6">
      {/* Top Banner with Toggle for Faculty/Admin */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 rounded-2xl border border-indigo-900/50 shadow-md text-white">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black tracking-tight">Academic Gradebook Management System</h2>
            <p className="text-[11px] text-slate-300">
              Institutional Grading • Continuous Comprehensive Evaluation (CCE) • AI HyperBuild Labs • Term End Marks
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-black/30 p-1 rounded-xl border border-white/10 shrink-0">
          <button
            onClick={() => setActiveTab('admin')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'admin'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Cohort Analytics & Marks
          </button>
          <button
            onClick={() => setActiveTab('student_preview')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'student_preview'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" /> Preview Student View
          </button>
        </div>
      </div>

      {activeTab === 'admin' ? (
        <AdminGradebookDashboard />
      ) : (
        <StudentGradebookView onBackToCohort={() => setActiveTab('admin')} />
      )}
    </div>
  );
};
