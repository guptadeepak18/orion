import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { useAuthStore } from './lib/store';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';
import { AcademicPage } from './modules/academic/AcademicPage';
import { SubjectsPage } from './modules/subjects/SubjectsPage';
import { StudentsPage } from './modules/students/StudentsPage';
import { SessionsPage } from './modules/sessions/SessionsPage';
import { FacultyPage } from './modules/faculty/FacultyPage';
import { FinancePage } from './modules/finance/FinancePage';
import { ApprovalsPage } from './modules/approvals/ApprovalsPage';
import { FeedbackPage } from './modules/feedback/FeedbackPage';
import { ReportsPage } from './modules/reports/ReportsPage';
import { SystemSettingsPage } from './modules/system/SystemSettingsPage';
import { EmailTemplatesPage } from './modules/system/EmailTemplatesPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { PendingApprovalPage } from './pages/PendingApprovalPage';
import { StudentProfilePage } from './pages/StudentProfilePage';
import { UsersPage } from './modules/users/UsersPage';
import { LMSPage } from './modules/lms/LMSPage';
import { SubjectLMSHub } from './modules/lms/SubjectLMSHub';
import { CaseStudyBankPage } from './modules/case-studies/CaseStudyBankPage';
import { CaseStudyDetailPage } from './modules/case-studies/CaseStudyDetailPage';
import { AttendancePage } from './modules/attendance/AttendancePage';
import { ProactiveIntelligenceHub } from './modules/ai/ProactiveIntelligenceHub';
import { GradebookPage } from './modules/gradebook/GradebookPage';

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
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
