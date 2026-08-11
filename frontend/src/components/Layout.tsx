import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard,
  GraduationCap,
  Calendar,
  Users,
  DollarSign,
  CheckSquare,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
  UserCheck,
} from 'lucide-react';
import { useAuthStore } from '../lib/store';
import { StatusBadge } from './StatusBadge';
import { CopilotDrawer } from './CopilotDrawer';
import { ThemeSwitcher } from './ThemeSwitcher';
import { Logo } from './Logo';

interface NavItem {
  label: string;
  path: string;
  icon: React.FC<{ className?: string }>;
  roles: string[];
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
    roles: [
      'crc_admin',
      'crc_coordinator',
      'faculty_internal',
      'faculty_external',
      'finance',
      'approver',
      'reporting_readonly',
      'student',
    ],
  },
  {
    label: 'Programs',
    path: '/academic',
    icon: GraduationCap,
    roles: ['crc_admin', 'crc_coordinator'],
  },
  {
    label: 'Student Directory',
    path: '/students',
    icon: UserCheck,
    roles: [
      'crc_admin',
      'crc_coordinator',
      'faculty_internal',
      'finance',
      'approver',
      'reporting_readonly',
      'student',
    ],
  },
  {
    label: 'Timetable & Sessions',
    path: '/sessions',
    icon: Calendar,
    roles: [
      'crc_admin',
      'crc_coordinator',
      'faculty_internal',
      'faculty_external',
      'finance',
      'approver',
      'reporting_readonly',
      'student',
    ],
  },
  {
    label: 'Faculty Directory',
    path: '/faculty',
    icon: Users,
    roles: [
      'crc_admin',
      'crc_coordinator',
      'faculty_internal',
      'faculty_external',
      'finance',
      'approver',
      'reporting_readonly',
    ],
  },
  {
    label: 'Money & Remuneration',
    path: '/finance',
    icon: DollarSign,
    roles: [
      'crc_admin',
      'crc_coordinator',
      'faculty_external',
      'finance',
      'approver',
      'reporting_readonly',
    ],
  },
  {
    label: 'Approvals',
    path: '/approvals',
    icon: CheckSquare,
    roles: ['crc_admin', 'crc_coordinator', 'finance', 'approver'],
  },
  {
    label: 'Reports & Analytics',
    path: '/reports',
    icon: BarChart3,
    roles: ['crc_admin', 'crc_coordinator', 'finance', 'approver', 'reporting_readonly'],
  },
  {
    label: 'System Settings',
    path: '/system',
    icon: SettingsIcon,
    roles: ['crc_admin'],
  },
];

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const userRoles = user?.roles || [];

  const queryClient = useQueryClient();

  const handleLogout = () => {
    logout();
    queryClient.clear();
    navigate('/login');
  };

  const filteredNav = navItems.filter((item) =>
    item.roles.some((role) => userRoles.includes(role) || userRoles.includes('crc_admin'))
  );

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Sidebar */}
      <aside className="w-64 glass-panel border-r border-slate-200 dark:border-slate-800/80 flex flex-col justify-between p-4 hidden md:flex">
        <div>
          {/* Logo / Header */}
          <div className="mb-4 pb-3 border-b border-slate-200 dark:border-slate-800/80">
            <Logo />
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {filteredNav.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-cyan-50 text-cyan-700 border border-cyan-200 shadow-sm dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/30 dark:shadow-cyan-500/10'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900/60'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800/80">
          <div className="flex items-center space-x-3 px-3 py-2">
            <div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300">
              <UserCheck className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                {user?.full_name || user?.email?.split('@')[0] || 'User'}
              </p>
              <div className="flex items-center space-x-1 mt-0.5">
                {userRoles[0] && <StatusBadge status={userRoles[0]} className="text-[10px] px-1.5 py-0" />}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full mt-3 flex items-center justify-center space-x-2 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20 border border-transparent transition-all duration-200"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <header className="h-16 glass-panel border-b border-slate-200 dark:border-slate-800/80 px-6 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center space-x-3">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Environment:</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30">
              Local Dev (Phases 0–6 Operational)
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden md:inline">
              Single Source of Truth — Career Readiness Cell
            </span>
            <ThemeSwitcher />
          </div>
        </header>

        {/* Page Container */}
        <div className="p-6 max-w-7xl w-full mx-auto">{children}</div>

        {/* Operational Copilot Drawer */}
        <CopilotDrawer />
      </main>
    </div>
  );
};
