import React from 'react';

export const PageContentSkeleton: React.FC = () => {
  return (
    <div className="w-full space-y-6 animate-pulse transition-opacity duration-200">
      {/* Top Page Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-slate-200 dark:bg-slate-800/80 rounded-lg" />
          <div className="h-4 w-72 bg-slate-100 dark:bg-slate-800/40 rounded-md" />
        </div>
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-28 bg-slate-200 dark:bg-slate-800/70 rounded-xl" />
          <div className="h-9 w-32 bg-slate-200 dark:bg-slate-800/70 rounded-xl" />
        </div>
      </div>

      {/* KPI Cards Skeleton Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-5 rounded-2xl bg-white/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/60 shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-8 w-8 rounded-xl bg-slate-200 dark:bg-slate-800/80" />
            </div>
            <div className="h-7 w-24 bg-slate-300 dark:bg-slate-700/80 rounded" />
            <div className="h-3 w-36 bg-slate-100 dark:bg-slate-800/50 rounded" />
          </div>
        ))}
      </div>

      {/* Main Content Area Skeleton */}
      <div className="p-6 rounded-2xl bg-white/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/60 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="h-5 w-40 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800/70 rounded-lg" />
        </div>
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="flex items-center gap-4 py-2.5">
              <div className="h-10 w-10 rounded-xl bg-slate-200 dark:bg-slate-800/70 shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div className="h-4 w-1/3 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-3 w-1/4 bg-slate-100 dark:bg-slate-800/40 rounded" />
              </div>
              <div className="h-6 w-16 bg-slate-200 dark:bg-slate-800/60 rounded-full" />
              <div className="h-6 w-20 bg-slate-200 dark:bg-slate-800/60 rounded-lg hidden sm:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
