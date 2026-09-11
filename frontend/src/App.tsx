import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { useAuthStore } from './lib/store';
import { Layout } from './components/Layout';
import { PageContentSkeleton } from './components/PageContentSkeleton';

/**
 * Wraps dynamic component imports with retry and automatic recovery on stale chunk 404s.
 * Completely eliminates the blank screen transition bug when new builds are deployed.
 */
function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = 2,
  interval = 800
): React.LazyExoticComponent<T> {
  return React.lazy(() =>
    new Promise<{ default: T }>((resolve, reject) => {
      const doImport = (attemptsLeft: number) => {
        factory()
          .then((comp) => {
            sessionStorage.removeItem('chunk_reload_attempt');
            resolve(comp);
          })
          .catch((error) => {
            if (attemptsLeft <= 0) {
              const hasReloaded = sessionStorage.getItem('chunk_reload_attempt');
              if (!hasReloaded) {
                sessionStorage.setItem('chunk_reload_attempt', 'true');
                window.location.reload();
                return;
              }
              sessionStorage.removeItem('chunk_reload_attempt');
              reject(error);
            } else {
              setTimeout(() => {
                doImport(attemptsLeft - 1);
              }, interval);
            }
          });
      };
      doImport(retries);
    })
  );
}

// Code-split dynamic route imports with automatic retry and error recovery
const LoginPage = lazyWithRetry(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const DashboardPage = lazyWithRetry(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const UnauthorizedPage = lazyWithRetry(() => import('./pages/UnauthorizedPage').then(m => ({ default: m.UnauthorizedPage })));
const AcademicPage = lazyWithRetry(() => import('./modules/academic/AcademicPage').then(m => ({ default: m.AcademicPage })));
const SubjectsPage = lazyWithRetry(() => import('./modules/subjects/SubjectsPage').then(m => ({ default: m.SubjectsPage })));
const StudentsPage = lazyWithRetry(() => import('./modules/students/StudentsPage').then(m => ({ default: m.StudentsPage })));
const SessionsPage = lazyWithRetry(() => import('./modules/sessions/SessionsPage').then(m => ({ default: m.SessionsPage })));
const FacultyPage = lazyWithRetry(() => import('./modules/faculty/FacultyPage').then(m => ({ default: m.FacultyPage })));
const FinancePage = lazyWithRetry(() => import('./modules/finance/FinancePage').then(m => ({ default: m.FinancePage })));
const ApprovalsPage = lazyWithRetry(() => import('./modules/approvals/ApprovalsPage').then(m => ({ default: m.ApprovalsPage })));
const FeedbackPage = lazyWithRetry(() => import('./modules/feedback/FeedbackPage').then(m => ({ default: m.FeedbackPage })));
const ReportsPage = lazyWithRetry(() => import('./modules/reports/ReportsPage').then(m => ({ default: m.ReportsPage })));
const SystemSettingsPage = lazyWithRetry(() => import('./modules/system/SystemSettingsPage').then(m => ({ default: m.SystemSettingsPage })));
const EmailTemplatesPage = lazyWithRetry(() => import('./modules/system/EmailTemplatesPage').then(m => ({ default: m.EmailTemplatesPage })));
const RegisterPage = lazyWithRetry(() => import('./pages/RegisterPage').then(m => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazyWithRetry(() => import('./pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const VerifyEmailPage = lazyWithRetry(() => import('./pages/VerifyEmailPage').then(m => ({ default: m.VerifyEmailPage })));
const PendingApprovalPage = lazyWithRetry(() => import('./pages/PendingApprovalPage').then(m => ({ default: m.PendingApprovalPage })));
const StudentProfilePage = lazyWithRetry(() => import('./pages/StudentProfilePage').then(m => ({ default: m.StudentProfilePage })));
const UsersPage = lazyWithRetry(() => import('./modules/users/UsersPage').then(m => ({ default: m.UsersPage })));
const LMSPage = lazyWithRetry(() => import('./modules/lms/LMSPage').then(m => ({ default: m.LMSPage })));
const SubjectLMSHub = lazyWithRetry(() => import('./modules/lms/SubjectLMSHub').then(m => ({ default: m.SubjectLMSHub })));
const CaseStudyBankPage = lazyWithRetry(() => import('./modules/case-studies/CaseStudyBankPage').then(m => ({ default: m.CaseStudyBankPage })));
const CaseStudyDetailPage = lazyWithRetry(() => import('./modules/case-studies/CaseStudyDetailPage').then(m => ({ default: m.CaseStudyDetailPage })));
const AttendancePage = lazyWithRetry(() => import('./modules/attendance/AttendancePage').then(m => ({ default: m.AttendancePage })));
const ProactiveIntelligenceHub = lazyWithRetry(() => import('./modules/ai/ProactiveIntelligenceHub').then(m => ({ default: m.ProactiveIntelligenceHub })));
const GradebookPage = lazyWithRetry(() => import('./modules/gradebook/GradebookPage').then(m => ({ default: m.GradebookPage })));
const IdeathonHubPage = lazyWithRetry(() => import('./modules/ideathons/IdeathonHubPage').then(m => ({ default: m.IdeathonHubPage })));
const IdeathonDetailPage = lazyWithRetry(() => import('./modules/ideathons/IdeathonDetailPage').then(m => ({ default: m.IdeathonDetailPage })));
const IdeaSubmissionWorkspace = lazyWithRetry(() => import('./modules/ideathons/IdeaSubmissionWorkspace').then(m => ({ default: m.IdeaSubmissionWorkspace })));
const IdeathonEvaluationDashboard = lazyWithRetry(() => import('./modules/ideathons/IdeathonEvaluationDashboard').then(m => ({ default: m.IdeathonEvaluationDashboard })));
const IdeathonLeaderboard = lazyWithRetry(() => import('./modules/ideathons/IdeathonLeaderboard').then(m => ({ default: m.IdeathonLeaderboard })));
const HyperbuildProjectBoard = lazyWithRetry(() => import('./modules/ideathons/HyperbuildProjectBoard').then(m => ({ default: m.HyperbuildProjectBoard })));

/**
 * Route error boundary to catch dynamic import or render failures and display a graceful recovery action
 */
class RouteErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: any }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('Route error boundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4 text-2xl font-bold">
            !
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Something went wrong loading this view</h2>
          <p className="text-sm text-slate-400 max-w-md mb-6">
            A temporary connection issue or updated version occurred while transitioning to this page.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-sm transition-colors shadow-lg shadow-indigo-500/20"
            >
              Reload View
            </button>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.history.back();
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl text-sm transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
      <RouteErrorBoundary>
        <Suspense fallback={<PageContentSkeleton />}>
          <Outlet />
        </Suspense>
      </RouteErrorBoundary>
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

            {/* Competitions & Ideathon Hub */}
            <Route path="/ideathons" element={<IdeathonHubPage />} />
            <Route path="/ideathons/:id" element={<IdeathonDetailPage />} />
            <Route path="/ideathons/:id/workspace" element={<IdeaSubmissionWorkspace />} />
            <Route
              path="/ideathons/:id/evaluation"
              element={
                <RoleRoute allowedRoles={['crc_admin', 'crc_coordinator', 'faculty_internal', 'faculty_external']}>
                  <IdeathonEvaluationDashboard />
                </RoleRoute>
              }
            />
            <Route path="/ideathons/:id/leaderboard" element={<IdeathonLeaderboard />} />
            <Route path="/ideathons/projects/:projectId" element={<HyperbuildProjectBoard />} />

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
