import { useAuthStore } from './store';

export interface RoleAccess {
  roles: string[];
  isAdmin: boolean;
  isCoordinator: boolean;
  isFacultyInternal: boolean;
  isFacultyExternal: boolean;
  isFinance: boolean;
  isApprover: boolean;
  isAuditor: boolean;
  isStudent: boolean;
  
  // Feature Capabilities
  canManageCurriculum: boolean;
  canManageStudents: boolean;
  canManageFaculty: boolean;
  canScheduleSessions: boolean;
  canManageFinance: boolean;
  canApprove: boolean;
  canViewReports: boolean;
  isReadOnly: boolean;
}

export const useRoleAccess = (): RoleAccess => {
  const { user } = useAuthStore();
  const roles = user?.roles || [];

  const isAdmin = roles.includes('crc_admin');
  const isCoordinator = roles.includes('crc_coordinator');
  const isFacultyInternal = roles.includes('faculty_internal');
  const isFacultyExternal = roles.includes('faculty_external');
  const isFinance = roles.includes('finance');
  const isApprover = roles.includes('approver');
  const isAuditor = roles.includes('reporting_readonly');
  const isStudent = roles.includes('student');

  return {
    roles,
    isAdmin,
    isCoordinator,
    isFacultyInternal,
    isFacultyExternal,
    isFinance,
    isApprover,
    isAuditor,
    isStudent,

    canManageCurriculum: isAdmin || isCoordinator,
    canManageStudents: isAdmin || isCoordinator,
    canManageFaculty: isAdmin || isCoordinator,
    canScheduleSessions: isAdmin || isCoordinator,
    canManageFinance: isAdmin || isFinance,
    canApprove: isAdmin || isApprover || isFinance,
    canViewReports: isAdmin || isCoordinator || isFinance || isApprover || isAuditor,
    isReadOnly: isAuditor || (!isAdmin && !isCoordinator && !isFinance && !isApprover && !isFacultyExternal),
  };
};
