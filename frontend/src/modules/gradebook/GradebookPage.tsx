import React, { useState } from 'react';
import { useAuthStore } from '../../lib/store';
import { StudentGradebookView } from './StudentGradebookView';
import { AdminGradebookDashboard } from './AdminGradebookDashboard';
import { Award, User, Users } from 'lucide-react';

export const GradebookPage: React.FC = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'admin' | 'student_preview'>('admin');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const isStudent = user?.roles?.includes('student') && !user?.roles?.some(r => ['crc_admin', 'crc_coordinator', 'faculty_internal', 'faculty_external'].includes(r));

  if (isStudent) {
    return <StudentGradebookView />;
  }

  // Admin / Faculty View with Preview Toggle
  return (
    <div className="space-y-6 animate-fadeIn pb-14">
      {/* Clean, Non-Fancy Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Award className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Academic Gradebook
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Continuous Comprehensive Evaluation (CCE), HyperBuild Practical Labs & Term End Examination
          </p>
        </div>

        {/* Clean Segmented Control Tabs */}
        <div className="bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl inline-flex items-center space-x-1 border border-slate-200 dark:border-slate-700 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('admin')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'admin'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> Cohort Analytics & Marks
          </button>
          <button
            onClick={() => setActiveTab('student_preview')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'student_preview'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> Preview Student View
          </button>
        </div>
      </div>

      {activeTab === 'admin' ? (
        <AdminGradebookDashboard
          onViewStudentTranscript={(stId) => {
            setSelectedStudentId(stId);
            setActiveTab('student_preview');
          }}
        />
      ) : (
        <StudentGradebookView
          studentId={selectedStudentId}
          onSelectStudentId={(id) => setSelectedStudentId(id)}
          onBackToCohort={() => setActiveTab('admin')}
        />
      )}
    </div>
  );
};
