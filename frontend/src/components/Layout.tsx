import React, { useState, useEffect, useRef } from 'react';
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
  BookOpen,
  LogOut,
  UserCheck,
  Sparkles,
  Briefcase,
  ClipboardCheck,
  BrainCircuit,
  ChevronDown,
  ShieldCheck,
  Mail,
  MessageSquare,
  User,
  Layers,
  Menu,
  X,
  ChevronsUpDown,
  Compass,
  PanelLeftClose,
  PanelLeftOpen,
  Camera,
  ExternalLink,
} from 'lucide-react';
import { useAuthStore } from '../lib/store';
import { StatusBadge } from './StatusBadge';
import { CopilotDrawer } from './CopilotDrawer';
import { ThemeSwitcher } from './ThemeSwitcher';
import { Logo } from './Logo';
import { api } from '../lib/api';

export interface NavItem {
  label: string;
  path: string;
  icon: React.FC<{ className?: string }>;
  roles: string[];
  badge?: string;
  badgeColor?: string;
}

export interface NavCategory {
  id: string;
  label: string;
  items: NavItem[];
}

const CRC_SIDEBAR_COLLAPSED_KEY = 'crc_sidebar_collapsed_categories_v2';
const CRC_SIDEBAR_MINIMIZED_KEY = 'crc_sidebar_minimized_state';

const navCategories: NavCategory[] = [
  {
    id: 'overview',
    label: 'Overview & AI',
    items: [
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
        label: 'AI Academic Assistant',
        path: '/ai-intelligence',
        icon: BrainCircuit,
        badge: 'AI',
        badgeColor: 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-xs',
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
    ],
  },
  {
    id: 'academics',
    label: 'Academic Operations',
    items: [
      {
        label: 'Programs & Terms',
        path: '/academic',
        icon: GraduationCap,
        roles: ['crc_admin', 'crc_coordinator'],
      },
      {
        label: 'Subjects & Syllabus',
        path: '/subjects',
        icon: BookOpen,
        roles: [
          'crc_admin',
          'crc_coordinator',
          'faculty_internal',
          'faculty_external',
          'approver',
          'reporting_readonly',
        ],
      },
      {
        label: 'Class Schedule & Calendar',
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
    ],
  },
  {
    id: 'faculty_teaching',
    label: 'Faculty & Teaching',
    items: [
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
        label: 'Faculty Allocation',
        path: '/subjects/faculty-allocation',
        icon: Layers,
        roles: [
          'crc_admin',
          'crc_coordinator',
          'faculty_internal',
          'faculty_external',
          'approver',
          'reporting_readonly',
        ],
      },
      {
        label: 'Attendance Tracking',
        path: '/attendance',
        icon: ClipboardCheck,
        roles: [
          'crc_admin',
          'crc_coordinator',
          'faculty_internal',
          'faculty_external',
          'approver',
          'reporting_readonly',
          'student',
        ],
      },
    ],
  },
  {
    id: 'learning_students',
    label: 'Students & Learning',
    items: [
      {
        label: 'Course Directory & LMS',
        path: '/lms',
        icon: Sparkles,
        badge: 'LMS',
        badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
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
        label: 'Case Study Library',
        path: '/case-studies',
        icon: Briefcase,
        roles: [
          'crc_admin',
          'crc_coordinator',
          'faculty_internal',
          'faculty_external',
          'student',
          'approver',
          'reporting_readonly',
        ],
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
        ],
      },
      {
        label: 'My Student Profile',
        path: '/profile',
        icon: User,
        roles: ['student'],
      },
      {
        label: 'Feedback & Ratings',
        path: '/feedback',
        icon: MessageSquare,
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
    ],
  },
  {
    id: 'governance_finance',
    label: 'Governance & Finance',
    items: [
      {
        label: 'Approvals Hub',
        path: '/approvals',
        icon: CheckSquare,
        roles: ['crc_admin', 'crc_coordinator', 'finance', 'approver'],
      },
      {
        label: 'Faculty Remuneration & Finance',
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
        label: 'Reports & Analytics',
        path: '/reports',
        icon: BarChart3,
        roles: ['crc_admin', 'crc_coordinator', 'finance', 'approver', 'reporting_readonly'],
      },
    ],
  },
  {
    id: 'administration',
    label: 'Administration',
    items: [
      {
        label: 'User Accounts & Permissions',
        path: '/users',
        icon: ShieldCheck,
        roles: ['crc_admin'],
      },
      {
        label: 'Email Notifications & Templates',
        path: '/email-templates',
        icon: Mail,
        roles: ['crc_admin'],
      },
      {
        label: 'System Settings',
        path: '/system',
        icon: SettingsIcon,
        roles: ['crc_admin'],
      },
      {
        label: 'My Profile',
        path: '/profile',
        icon: User,
        roles: ['crc_admin', 'crc_coordinator', 'faculty_internal', 'faculty_external', 'finance', 'approver', 'reporting_readonly'],
      },
    ],
  },
];

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, updateUser, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const userRoles = user?.roles || [];
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState<boolean>(false);
  const [uploadingAvatar, setUploadingAvatar] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sidebar minimize/collapse state (icon-only mode vs full sidebar)
  const [isMinimized, setIsMinimized] = useState<boolean>(() => {
    try {
      return localStorage.getItem(CRC_SIDEBAR_MINIMIZED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebarMinimize = () => {
    setIsMinimized((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(CRC_SIDEBAR_MINIMIZED_KEY, String(next));
      } catch (e) {
        console.warn('Failed to persist sidebar minimize state', e);
      }
      return next;
    });
  };

  // Persistent category accordion collapsed state: false = open (default), true = collapsed
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(CRC_SIDEBAR_COLLAPSED_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to parse sidebar collapsed state from localStorage', e);
    }
    return {};
  });

  // Toggle individual category collapse
  const toggleCategory = (categoryId: string) => {
    setCollapsedMap((prev) => {
      const next = { ...prev, [categoryId]: !prev[categoryId] };
      try {
        localStorage.setItem(CRC_SIDEBAR_COLLAPSED_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn('Failed to persist sidebar collapsed state', e);
      }
      return next;
    });
  };

  // Toggle all categories expand / collapse
  const areAllCollapsed = navCategories.every((cat) => collapsedMap[cat.id] === true);
  const toggleAllCategories = () => {
    const nextState = !areAllCollapsed;
    const next: Record<string, boolean> = {};
    navCategories.forEach((cat) => {
      next[cat.id] = nextState;
    });
    setCollapsedMap(next);
    try {
      localStorage.setItem(CRC_SIDEBAR_COLLAPSED_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn('Failed to persist sidebar collapsed state', e);
    }
  };

  // Auto-expand category if current route is inside it
  useEffect(() => {
    const activeCat = navCategories.find((cat) =>
      cat.items.some(
        (item) =>
          location.pathname === item.path ||
          (item.path !== '/' && location.pathname.startsWith(item.path + '/'))
      )
    );
    if (activeCat && collapsedMap[activeCat.id] === true) {
      setCollapsedMap((prev) => {
        const next = { ...prev, [activeCat.id]: false };
        try {
          localStorage.setItem(CRC_SIDEBAR_COLLAPSED_KEY, JSON.stringify(next));
        } catch (e) {}
        return next;
      });
    }
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    queryClient.clear();
    navigate('/login');
  };

  // Handle Quick Avatar Upload
  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: 5MB
    if (file.size > 5 * 1024 * 1024) {
      alert('Avatar image must be under 5MB');
      return;
    }

    try {
      setUploadingAvatar(true);
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        try {
          const res = await api.put('/auth/me', { avatar_url: base64Data });
          if (res.data?.data) {
            updateUser({ avatar_url: res.data.data.avatar_url || base64Data });
            queryClient.invalidateQueries({ queryKey: ['auth_me_profile'] });
            queryClient.invalidateQueries({ queryKey: ['my-student-profile'] });
          }
        } catch (err) {
          console.error('Failed to update avatar:', err);
          // Fallback to local storage update
          updateUser({ avatar_url: base64Data });
        } finally {
          setUploadingAvatar(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Avatar read error:', err);
      setUploadingAvatar(false);
    }
  };

  const isStudent = userRoles.includes('student') && !userRoles.includes('crc_admin');

  // Filter items by user role
  const isItemAllowed = (item: NavItem) => {
    if (isStudent) {
      return item.roles.includes('student');
    }
    return item.roles.some(
      (role) => userRoles.includes(role) || (userRoles.includes('crc_admin') && role !== 'student')
    );
  };

  const categorizedNav = navCategories
    .map((category) => ({
      ...category,
      items: category.items.filter(isItemAllowed),
    }))
    .filter((category) => category.items.length > 0);

  // Find active item label for top navbar breadcrumb
  let activePageTitle = 'Dashboard';
  for (const cat of navCategories) {
    for (const item of cat.items) {
      if (
        location.pathname === item.path ||
        (item.path !== '/' && item.path !== '/dashboard' && location.pathname.startsWith(item.path))
      ) {
        activePageTitle = item.label;
        break;
      }
    }
  }

  // Format primary role label
  const roleDisplayMap: Record<string, string> = {
    crc_admin: 'Administrator',
    crc_coordinator: 'Academic Coordinator',
    faculty_internal: 'Internal Faculty',
    faculty_external: 'External Faculty',
    finance: 'Finance Officer',
    approver: 'Approval Authority',
    reporting_readonly: 'Auditor (Read-Only)',
    student: 'Student',
  };

  const primaryRole = userRoles[0]
    ? roleDisplayMap[userRoles[0]] ||
      userRoles[0]
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    : 'Member';

  const renderNavContent = (minimizedMode: boolean = false) => {
    if (minimizedMode) {
      return (
        <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-4 custom-scrollbar py-2">
          {categorizedNav.map((category) => (
            <div key={category.id} className="space-y-1">
              {/* Category Divider Dot in Minimized Mode */}
              <div className="w-6 h-0.5 bg-slate-200 dark:bg-slate-800 mx-auto my-2 rounded-full" />
              <div className="space-y-1.5">
                {category.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    location.pathname === item.path ||
                    (item.path !== '/' &&
                      item.path !== '/dashboard' &&
                      location.pathname.startsWith(item.path + '/'));

                  return (
                    <div key={item.path} className="relative group flex justify-center">
                      <Link
                        to={item.path}
                        className={`flex items-center justify-center h-10 w-10 rounded-xl transition-all duration-150 ${
                          isActive
                            ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/40 shadow-xs'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/70'
                        }`}
                      >
                        <Icon className="h-5 w-5 shrink-0" />
                      </Link>

                      {/* Floating Tooltip */}
                      <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-md text-white border border-slate-700/60 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 pointer-events-none whitespace-nowrap">
                        <div className="text-xs font-bold flex items-center gap-2">
                          <span>{item.label}</span>
                          {item.badge && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full font-black bg-cyan-500 text-slate-950">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">{category.label}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-y-auto pr-1 space-y-3.5 custom-scrollbar">
        <div className="flex items-center justify-between px-2 pt-0.5 pb-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Navigation Menu
          </span>
          <button
            onClick={toggleAllCategories}
            className="text-[10px] font-bold text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors flex items-center gap-1 cursor-pointer"
            title={areAllCollapsed ? 'Expand all categories' : 'Collapse all categories'}
          >
            <ChevronsUpDown className="h-3 w-3" />
            <span>{areAllCollapsed ? 'Expand All' : 'Collapse All'}</span>
          </button>
        </div>

        <nav className="space-y-2.5">
          {categorizedNav.map((category) => {
            const isCollapsed = collapsedMap[category.id] === true;
            const hasActiveChild = category.items.some(
              (item) =>
                location.pathname === item.path ||
                (item.path !== '/' &&
                  item.path !== '/dashboard' &&
                  location.pathname.startsWith(item.path))
            );

            return (
              <div key={category.id} className="space-y-1">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(category.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[10.5px] font-extrabold tracking-wider uppercase transition-all duration-150 select-none cursor-pointer group ${
                    hasActiveChild
                      ? 'text-cyan-700 dark:text-cyan-400 bg-cyan-50/70 dark:bg-cyan-950/40'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="truncate">{category.label}</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {category.items.length}
                    </span>
                  </div>
                  <div className="flex items-center text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300">
                    <ChevronDown
                      className={`h-3.5 w-3.5 transform transition-transform duration-200 ${
                        isCollapsed ? '-rotate-90 text-slate-400' : 'rotate-0 text-slate-500'
                      }`}
                    />
                  </div>
                </button>

                {/* Category Items List */}
                <div
                  className={`space-y-0.5 pl-1 transition-all duration-200 ease-in-out ${
                    isCollapsed ? 'max-h-0 opacity-0 overflow-hidden pointer-events-none' : 'max-h-96 opacity-100'
                  }`}
                >
                  {category.items.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                      location.pathname === item.path ||
                      (item.path !== '/' &&
                        item.path !== '/dashboard' &&
                        location.pathname.startsWith(item.path + '/'));

                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150 group ${
                          isActive
                            ? 'bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-indigo-500/5 text-cyan-700 dark:text-cyan-300 font-bold border border-cyan-500/30 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon
                            className={`h-4 w-4 shrink-0 transition-colors ${
                              isActive
                                ? 'text-cyan-600 dark:text-cyan-400'
                                : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                            }`}
                          />
                          <span className="truncate">{item.label}</span>
                        </div>

                        {item.badge && (
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 ${
                              item.badgeColor || 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Hidden File Input for Avatar Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleAvatarFileSelect}
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
      />

      {/* Desktop Sidebar with Expand/Minimize Mode */}
      <aside
        className={`bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-r border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between hidden md:flex h-screen sticky top-0 shrink-0 z-20 overflow-hidden transition-all duration-300 ease-in-out ${
          isMinimized ? 'w-18 min-w-[4.5rem] max-w-[4.5rem] p-2' : 'w-64 min-w-[16rem] max-w-[16rem] p-3.5'
        }`}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Logo / Header (Icon when minimized, Full Logo when expanded) */}
          <div className="mb-2 pb-2.5 border-b border-slate-200/80 dark:border-slate-800/80 shrink-0 flex items-center justify-between">
            <Logo collapsed={isMinimized} />
            {!isMinimized && (
              <button
                onClick={toggleSidebarMinimize}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Minimize Sidebar"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Collapsible Categorized Navigation (Takes full height) */}
          {renderNavContent(isMinimized)}
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="relative flex flex-col w-72 max-w-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-4 shadow-2xl z-10 h-full">
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-200 dark:border-slate-800">
              <Logo />
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {renderNavContent(false)}

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 mt-2">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto bg-slate-50 dark:bg-slate-950">
        {/* Top Header */}
        <header className="h-14 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 px-4 md:px-6 flex items-center justify-between sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-3">
            {/* Desktop Sidebar Toggle Button */}
            <button
              onClick={toggleSidebarMinimize}
              className="hidden md:flex p-1.5 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title={isMinimized ? 'Expand Sidebar' : 'Minimize Sidebar'}
            >
              {isMinimized ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </button>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white md:hidden hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Breadcrumb / Institutional Identifier */}
            <div className="flex items-center gap-2 text-xs">
              <span className="font-extrabold text-slate-800 dark:text-slate-200 hidden sm:inline">
                Lexicon MILE
              </span>
              <span className="text-slate-400 hidden sm:inline">/</span>
              <span className="font-semibold text-cyan-600 dark:text-cyan-400 flex items-center gap-1.5">
                <Compass className="h-3.5 w-3.5" />
                {activePageTitle}
              </span>
            </div>
          </div>

          {/* Top Right Header Controls */}
          <div className="flex items-center space-x-3">
            <ThemeSwitcher />

            {/* User Profile Dropdown Pill */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className={`flex items-center space-x-2.5 p-1 sm:px-2.5 sm:py-1 rounded-2xl border transition-all duration-200 select-none cursor-pointer group ${
                  userDropdownOpen
                    ? 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-300 dark:border-cyan-700 shadow-sm'
                    : 'bg-white/80 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                {/* User Avatar Image or Gradient Initials Badge */}
                <div className="relative h-8 w-8 rounded-full overflow-hidden bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs ring-1 ring-white dark:ring-slate-900">
                  {user?.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.full_name || 'User Avatar'}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>{user?.full_name?.charAt(0) || user?.email?.charAt(0).toUpperCase() || 'U'}</span>
                  )}
                  {uploadingAvatar && (
                    <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
                      <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                {/* User Info (Hidden on very small screens) */}
                <div className="hidden sm:flex flex-col text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[120px]">
                      {user?.full_name || user?.email?.split('@')[0] || 'User'}
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-cyan-600 dark:text-cyan-400 capitalize">
                    {primaryRole}
                  </span>
                </div>

                <ChevronDown
                  className={`h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-transform duration-200 ${
                    userDropdownOpen ? 'rotate-180 text-cyan-600 dark:text-cyan-400' : ''
                  }`}
                />
              </button>

              {/* User Dropdown Menu Card */}
              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 py-2 z-50 animate-in fade-in-0 zoom-in-95 duration-150">
                  {/* Dropdown Header with Avatar & Photo Upload Trigger */}
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center space-x-3">
                      <div className="relative group/avatar">
                        <div className="h-12 w-12 rounded-2xl overflow-hidden bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
                          {user?.avatar_url ? (
                            <img
                              src={user.avatar_url}
                              alt={user.full_name || 'User Avatar'}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span>{user?.full_name?.charAt(0) || user?.email?.charAt(0).toUpperCase() || 'U'}</span>
                          )}
                        </div>

                        {/* Quick Photo Upload Overlay */}
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingAvatar}
                          className="absolute inset-0 bg-slate-950/60 rounded-2xl flex flex-col items-center justify-center text-white opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-150 cursor-pointer"
                          title="Upload Profile Photo"
                        >
                          <Camera className="h-4 w-4" />
                          <span className="text-[8px] font-bold mt-0.5">Edit</span>
                        </button>
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {user?.full_name || 'User'}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
                        <div className="mt-1 flex items-center gap-1.5">
                          {userRoles[0] && (
                            <StatusBadge status={userRoles[0]} className="text-[9px] px-1.5 py-0 font-bold" />
                          )}
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="Online" />
                        </div>
                      </div>
                    </div>

                    {/* Direct Upload Photo Button */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/50 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 border border-cyan-200 dark:border-cyan-800 transition-colors cursor-pointer"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      <span>{uploadingAvatar ? 'Uploading...' : 'Change Profile Photo'}</span>
                    </button>
                  </div>

                  {/* Dropdown Navigation Actions */}
                  <div className="px-2 py-1.5 space-y-0.5">
                    <Link
                      to="/profile"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
                    >
                      <div className="flex items-center gap-2.5">
                        <User className="h-4 w-4 text-slate-400 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors" />
                        <span>My Profile & Account Details</span>
                      </div>
                      <ExternalLink className="h-3 w-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>

                    {userRoles.includes('crc_admin') && (
                      <Link
                        to="/system"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
                      >
                        <div className="flex items-center gap-2.5">
                          <SettingsIcon className="h-4 w-4 text-slate-400 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors" />
                          <span>System Configuration</span>
                        </div>
                      </Link>
                    )}
                  </div>

                  {/* Divider & Sign Out */}
                  <div className="px-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Container */}
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto flex-1">{children}</div>

        {/* Operational Copilot Drawer */}
        <CopilotDrawer />
      </main>
    </div>
  );
};
