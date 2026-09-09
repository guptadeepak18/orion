import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { useAuthStore } from './lib/store';
import { Layout } from './components/Layout';

// Code-split dynamic route imports to keep initial bundle size minimal
const LoginPage = React.lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const UnauthorizedPage = React.lazy(() => import('./pages/UnauthorizedPage').then(m => ({ default: m.UnauthorizedPage })));
const AcademicPage = React.lazy(() => import('./modules/academic/AcademicPage').then(m => ({ default: m.AcademicPage })));
const SubjectsPage = React.lazy(() => import('./modules/subjects/SubjectsPage').then(m => ({ default: m.SubjectsPage })));
const StudentsPage = React.lazy(() => import('./modules/students/StudentsPage').then(m => ({ default: m.StudentsPage })));
const SessionsPage = React.lazy(() => import('./modules/sessions/SessionsPage').then(m => ({ default: m.SessionsPage })));
const FacultyPage = React.lazy(() => import('./modules/faculty/FacultyPage').then(m => ({ default: m.FacultyPage })));
const FinancePage = React.lazy(() => import('./modules/finance/FinancePage').then(m => ({ default: m.FinancePage })));
const ApprovalsPage = React.lazy(() => import('./modules/approvals/ApprovalsPage').then(m => ({ default: m.ApprovalsPage })));
const FeedbackPage = React.lazy(() => import('./modules/feedback/FeedbackPage').then(m => ({ default: m.FeedbackPage })));
const ReportsPage = React.lazy(() => import('./modules/reports/ReportsPage').then(m => ({ default: m.ReportsPage })));
const SystemSettingsPage = React.lazy(() => import('./modules/system/SystemSettingsPage').then(m => ({ default: m.SystemSettingsPage })));
const EmailTemplatesPage = React.lazy(() => import('./modules/system/EmailTemplatesPage').then(m => ({ default: m.EmailTemplatesPage })));
const RegisterPage = React.lazy(() => import('./pages/RegisterPage').then(m => ({ default: m.RegisterPage })));
const ForgotPasswordPage = React.lazy(() => import('./pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const VerifyEmailPage = React.lazy(() => import('./pages/VerifyEmailPage').then(m => ({ default: m.VerifyEmailPage })));
const PendingApprovalPage = React.lazy(() => import('./pages/PendingApprovalPage').then(m => ({ default: m.PendingApprovalPage })));
const StudentProfilePage = React.lazy(() => import('./pages/StudentProfilePage').then(m => ({ default: m.StudentProfilePage })));
const UsersPage = React.lazy(() => import('./modules/users/UsersPage').then(m => ({ default: m.UsersPage })));
const LMSPage = React.lazy(() => import('./modules/lms/LMSPage').then(m => ({ default: m.LMSPage })));
const SubjectLMSHub = React.lazy(() => import('./modules/lms/SubjectLMSHub').then(m => ({ default: m.SubjectLMSHub })));
const CaseStudyBankPage = React.lazy(() => import('./modules/case-studies/CaseStudyBankPage').then(m => ({ default: m.CaseStudyBankPage })));
const CaseStudyDetailPage = React.lazy(() => import('./modules/case-studies/CaseStudyDetailPage').then(m => ({ default: m.CaseStudyDetailPage })));
const AttendancePage = React.lazy(() => import('./modules/attendance/AttendancePage').then(m => ({ default: m.AttendancePage })));
const ProactiveIntelligenceHub = React.lazy(() => import('./modules/ai/ProactiveIntelligenceHub').then(m => ({ default: m.ProactiveIntelligenceHub })));
const GradebookPage = React.lazy(() => import('./modules/gradebook/GradebookPage').then(m => ({ default: m.GradebookPage })));

const PageLoader: React.FC = () => (
  <div className="min-h-[400px] flex flex-col items-center justify-center space-y-3">
    <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
    <span className="text-xs font-medium text-slate-400 tracking-wider uppercase animate-pulse">Loading View...</span>
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({
  children,
  allowedRoles,
}) => {
  const { accessToken, user } = useAuthStore();

  if (!accessToken || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const hasRole = allowedRoles.some(
      (role) => user.roles.includes(role) || user.roles.includes('crc_admin')
    );
    if (!hasRole) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <Layout>{children}</Layout>;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/pending-approval" element={<PendingApprovalPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          <Route
            path="/student-registrations"
            element={<Navigate to="/students" replace />}
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <StudentProfilePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/ai-intelligence"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'crc_admin',
                  'crc_coordinator',
                  'faculty_internal',
                  'faculty_external',
                  'finance',
                  'approver',
                  'reporting_readonly',
                ]}
              >
                <ProactiveIntelligenceHub />
              </ProtectedRoute>
            }
          />

          <Route
            path="/lms"
            element={
              <ProtectedRoute>
                <LMSPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/gradebook"
            element={
              <ProtectedRoute>
                <GradebookPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/lms/subjects/:subjectCode"
            element={
              <ProtectedRoute>
                <SubjectLMSHub />
              </ProtectedRoute>
            }
          />

          <Route
            path="/lms/subjects/:subjectCode/:section"
            element={
              <ProtectedRoute>
                <SubjectLMSHub />
              </ProtectedRoute>
            }
          />

          <Route
            path="/lms/:subjectCode"
            element={
              <ProtectedRoute>
                <SubjectLMSHub />
              </ProtectedRoute>
            }
          />

          <Route
            path="/lms/:subjectCode/:section"
            element={
              <ProtectedRoute>
                <SubjectLMSHub />
              </ProtectedRoute>
            }
          />

          <Route
            path="/academic"
            element={
              <ProtectedRoute allowedRoles={['crc_admin', 'crc_coordinator']}>
                <AcademicPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/subjects"
            element={
              <ProtectedRoute allowedRoles={['crc_admin', 'crc_coordinator', 'faculty_internal', 'faculty_external', 'approver', 'reporting_readonly']}>
                <SubjectsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/subjects/faculty-allocation"
            element={
              <ProtectedRoute allowedRoles={['crc_admin', 'crc_coordinator', 'faculty_internal', 'faculty_external', 'approver', 'reporting_readonly']}>
                <SubjectsPage initialTab="allocations" />
              </ProtectedRoute>
            }
          />

          <Route
            path="/faculty-allocation"
            element={
              <Navigate to="/subjects/faculty-allocation" replace />
            }
          />

          <Route
            path="/case-studies"
            element={
              <ProtectedRoute>
                <CaseStudyBankPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/case-studies/:caseStudyId"
            element={
              <ProtectedRoute>
                <CaseStudyDetailPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/students"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'crc_admin',
                  'crc_coordinator',
                  'faculty_internal',
                  'finance',
                  'approver',
                  'reporting_readonly',
                ]}
              >
                <StudentsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/sessions"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'crc_admin',
                  'crc_coordinator',
                  'faculty_internal',
                  'faculty_external',
                  'finance',
                  'approver',
                  'reporting_readonly',
                  'student',
                ]}
              >
                <SessionsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/attendance"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'crc_admin',
                  'crc_coordinator',
                  'faculty_internal',
                  'faculty_external',
                  'approver',
                  'reporting_readonly',
                  'student',
                ]}
              >
                <AttendancePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/attendance/:tab"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'crc_admin',
                  'crc_coordinator',
                  'faculty_internal',
                  'faculty_external',
                  'approver',
                  'reporting_readonly',
                  'student',
                ]}
              >
                <AttendancePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/calendar"
            element={
              <ProtectedRoute>
                <Navigate to="/sessions?view=calendar" replace />
              </ProtectedRoute>
            }
          />

          <Route
            path="/feedback"
            element={
              <ProtectedRoute>
                <FeedbackPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/faculty"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'crc_admin',
                  'crc_coordinator',
                  'faculty_internal',
                  'faculty_external',
                  'finance',
                  'approver',
                  'reporting_readonly',
                ]}
              >
                <FacultyPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/users"
            element={
              <ProtectedRoute allowedRoles={['crc_admin']}>
                <UsersPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/finance"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'crc_admin',
                  'crc_coordinator',
                  'faculty_external',
                  'finance',
                  'approver',
                  'reporting_readonly',
                ]}
              >
                <FinancePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/approvals"
            element={
              <ProtectedRoute allowedRoles={['crc_admin', 'crc_coordinator', 'finance', 'approver']}>
                <ApprovalsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/reports"
            element={
              <ProtectedRoute
                allowedRoles={['crc_admin', 'crc_coordinator', 'finance', 'approver', 'reporting_readonly']}
              >
                <ReportsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/system"
            element={
              <ProtectedRoute allowedRoles={['crc_admin']}>
                <SystemSettingsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/email-templates"
            element={
              <ProtectedRoute allowedRoles={['crc_admin']}>
                <EmailTemplatesPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
