import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { useAuthStore } from './lib/store';
import { Layout } from './components/Layout';
import { PageContentSkeleton } from './components/PageContentSkeleton';

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

/**
 * Role-based permission guard that wraps individual protected views.
 * Preserves the surrounding layout without unmounting it.
 */
const RoleRoute: React.FC<{ allowedRoles?: string[]; children: React.ReactNode }> = ({
  allowedRoles,
  children,
}) => {
  const { user } = useAuthStore();
  if (allowedRoles && allowedRoles.length > 0) {
    const hasRole = allowedRoles.some(
      (role) => user?.roles.includes(role) || user?.roles.includes('crc_admin')
    );
    if (!hasRole) {
      return <Navigate to="/unauthorized" replace />;
    }
  }
  return <>{children}</>;
};

/**
 * Persistent Authenticated Layout Route:
 * Stays permanently mounted across all protected page navigations.
 * The sidebar, navbar, avatar, and background NEVER unmount or flash.
 * Inner page transitions display a subtle glassmorphism skeleton during chunk loading.
 */
const AuthenticatedLayoutRoute: React.FC = () => {
  const { accessToken, user } = useAuthStore();

  if (!accessToken || !user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Layout>
      <Suspense fallback={<PageContentSkeleton />}>
        <Outlet />
      </Suspense>
    </Layout>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public Authentication & Onboarding Routes */}
          <Route path="/login" element={<Suspense fallback={<div className="min-h-screen bg-slate-950" />}><LoginPage /></Suspense>} />
          <Route path="/register" element={<Suspense fallback={<div className="min-h-screen bg-slate-950" />}><RegisterPage /></Suspense>} />
          <Route path="/forgot-password" element={<Suspense fallback={<div className="min-h-screen bg-slate-950" />}><ForgotPasswordPage /></Suspense>} />
          <Route path="/verify-email" element={<Suspense fallback={<div className="min-h-screen bg-slate-950" />}><VerifyEmailPage /></Suspense>} />
          <Route path="/pending-approval" element={<Suspense fallback={<div className="min-h-screen bg-slate-950" />}><PendingApprovalPage /></Suspense>} />
          <Route path="/unauthorized" element={<Suspense fallback={<div className="min-h-screen bg-slate-950" />}><UnauthorizedPage /></Suspense>} />

          {/* Persistent Authenticated Application Routes */}
          <Route element={<AuthenticatedLayoutRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/profile" element={<StudentProfilePage />} />

            <Route
              path="/ai-intelligence"
              element={
                <RoleRoute
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
                </RoleRoute>
              }
            />

            <Route path="/lms" element={<LMSPage />} />
            <Route path="/gradebook" element={<GradebookPage />} />
            <Route path="/lms/subjects/:subjectCode" element={<SubjectLMSHub />} />
            <Route path="/lms/subjects/:subjectCode/:section" element={<SubjectLMSHub />} />
            <Route path="/lms/:subjectCode" element={<SubjectLMSHub />} />
            <Route path="/lms/:subjectCode/:section" element={<SubjectLMSHub />} />

            <Route
              path="/academic"
              element={
                <RoleRoute allowedRoles={['crc_admin', 'crc_coordinator']}>
                  <AcademicPage />
                </RoleRoute>
              }
            />

            <Route
              path="/subjects"
              element={
                <RoleRoute
                  allowedRoles={[
                    'crc_admin',
                    'crc_coordinator',
                    'faculty_internal',
                    'faculty_external',
                    'approver',
                    'reporting_readonly',
                  ]}
                >
                  <SubjectsPage />
                </RoleRoute>
              }
            />

            <Route
              path="/subjects/faculty-allocation"
              element={
                <RoleRoute
                  allowedRoles={[
                    'crc_admin',
                    'crc_coordinator',
                    'faculty_internal',
                    'faculty_external',
                    'approver',
                    'reporting_readonly',
                  ]}
                >
                  <SubjectsPage initialTab="allocations" />
                </RoleRoute>
              }
            />

            <Route
              path="/faculty-allocation"
              element={<Navigate to="/subjects/faculty-allocation" replace />}
            />

            <Route path="/case-studies" element={<CaseStudyBankPage />} />
            <Route path="/case-studies/:caseStudyId" element={<CaseStudyDetailPage />} />

            <Route
              path="/students"
              element={
                <RoleRoute
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
                </RoleRoute>
              }
            />

            <Route
              path="/sessions"
              element={
                <RoleRoute
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
                </RoleRoute>
              }
            />

            <Route
              path="/attendance"
              element={
                <RoleRoute
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
                </RoleRoute>
              }
            />

            <Route
              path="/attendance/:tab"
              element={
                <RoleRoute
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
                </RoleRoute>
              }
            />

            <Route
              path="/calendar"
              element={<Navigate to="/sessions?view=calendar" replace />}
            />

            <Route path="/feedback" element={<FeedbackPage />} />

            <Route
              path="/faculty"
              element={
                <RoleRoute
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
                </RoleRoute>
              }
            />

            <Route
              path="/users"
              element={
                <RoleRoute allowedRoles={['crc_admin']}>
                  <UsersPage />
                </RoleRoute>
              }
            />

            <Route
              path="/finance"
              element={
                <RoleRoute
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
                </RoleRoute>
              }
            />

            <Route
              path="/approvals"
              element={
                <RoleRoute allowedRoles={['crc_admin', 'crc_coordinator', 'finance', 'approver']}>
                  <ApprovalsPage />
                </RoleRoute>
              }
            />

            <Route
              path="/reports"
              element={
                <RoleRoute
                  allowedRoles={[
                    'crc_admin',
                    'crc_coordinator',
                    'finance',
                    'approver',
                    'reporting_readonly',
                  ]}
                >
                  <ReportsPage />
                </RoleRoute>
              }
            />

            <Route
              path="/system"
              element={
                <RoleRoute allowedRoles={['crc_admin']}>
                  <SystemSettingsPage />
                </RoleRoute>
              }
            />

            <Route
              path="/email-templates"
              element={
                <RoleRoute allowedRoles={['crc_admin']}>
                  <EmailTemplatesPage />
                </RoleRoute>
              }
            />

            <Route
              path="/student-registrations"
              element={<Navigate to="/students" replace />}
            />
          </Route>

          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
