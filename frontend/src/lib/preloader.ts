/**
 * Route preloading utility to eliminate lazy-loading latency on page transitions.
 * Prefetches route bundles on hover, touch, or during background idle time.
 */

export const routeLoaders: Record<string, () => Promise<unknown>> = {
  '/dashboard': () => import('../pages/DashboardPage'),
  '/profile': () => import('../pages/StudentProfilePage'),
  '/academic': () => import('../modules/academic/AcademicPage'),
  '/subjects': () => import('../modules/subjects/SubjectsPage'),
  '/students': () => import('../modules/students/StudentsPage'),
  '/sessions': () => import('../modules/sessions/SessionsPage'),
  '/attendance': () => import('../modules/attendance/AttendancePage'),
  '/faculty': () => import('../modules/faculty/FacultyPage'),
  '/reports': () => import('../modules/reports/ReportsPage'),
  '/finance': () => import('../modules/finance/FinancePage'),
  '/approvals': () => import('../modules/approvals/ApprovalsPage'),
  '/feedback': () => import('../modules/feedback/FeedbackPage'),
  '/lms': () => import('../modules/lms/LMSPage'),
  '/gradebook': () => import('../modules/gradebook/GradebookPage'),
  '/case-studies': () => import('../modules/case-studies/CaseStudyBankPage'),
  '/ai-intelligence': () => import('../modules/ai/ProactiveIntelligenceHub'),
  '/users': () => import('../modules/users/UsersPage'),
  '/system': () => import('../modules/system/SystemSettingsPage'),
  '/email-templates': () => import('../modules/system/EmailTemplatesPage'),
};

const preloadedSet = new Set<string>();

/**
 * Preloads a specific route's JavaScript bundle.
 * Safe to call multiple times; only executes the fetch once.
 */
export function preloadRoute(path: string): void {
  if (!path) return;
  const cleanPath = path.split('?')[0].split('#')[0];
  const loader = routeLoaders[cleanPath];
  if (loader && !preloadedSet.has(cleanPath)) {
    preloadedSet.add(cleanPath);
    loader().catch(() => {
      // If network fails, allow retrying later
      preloadedSet.delete(cleanPath);
    });
  }
}

/**
 * Preloads all primary high-frequency routes during browser idle time.
 * Runs in background after initial page render without blocking the UI.
 */
export function preloadCoreRoutes(): void {
  const coreRoutes = [
    '/dashboard',
    '/attendance',
    '/sessions',
    '/academic',
    '/subjects',
    '/students',
    '/reports',
    '/profile',
  ];

  const runPreload = () => {
    coreRoutes.forEach((route, idx) => {
      // Stagger slightly to avoid saturating network concurrency
      setTimeout(() => preloadRoute(route), idx * 60);
    });
  };

  if (typeof window !== 'undefined') {
    if ('requestIdleCallback' in window) {
      (window as unknown as { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void }).requestIdleCallback(
        runPreload,
        { timeout: 3000 }
      );
    } else {
      setTimeout(runPreload, 1000);
    }
  }
}
