import React, { useEffect } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useThemeStore, ThemeMode } from '../lib/themeStore';

export const ThemeSwitcher: React.FC = () => {
  const { theme, setTheme, applyTheme } = useThemeStore();

  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  const options: { mode: ThemeMode; label: string; icon: React.FC<{ className?: string }> }[] = [
    { mode: 'dark', label: 'Dark', icon: Moon },
    { mode: 'light', label: 'Light', icon: Sun },
    { mode: 'system', label: 'System', icon: Monitor },
  ];

  return (
    <div className="flex items-center bg-slate-100 dark:bg-slate-900/90 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-200">
      {options.map((opt) => {
        const Icon = opt.icon;
        const isActive = theme === opt.mode;
        return (
          <button
            type="button"
            key={opt.mode}
            onClick={() => setTheme(opt.mode)}
            title={`Switch to ${opt.label} theme`}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-200 ${
              isActive
                ? 'bg-cyan-600 dark:bg-cyan-500 text-white shadow-md shadow-cyan-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
};

