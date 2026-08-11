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
import { CalendarPage } from './modules/calendar/CalendarPage';
import { FeedbackPage } from './modules/feedback/FeedbackPage';
import { ReportsPage } from './modules/reports/ReportsPage';
import { SystemSettingsPage } from './modules/system/SystemSettingsPage';
import { RegisterPage } from './pages/RegisterPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { PendingApprovalPage } from './pages/PendingApprovalPage';
import { StudentProfilePage } from './pages/StudentProfilePage';

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
                  'student',
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
            path="/calendar"
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
                <CalendarPage />
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

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
