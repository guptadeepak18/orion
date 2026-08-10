import { create } from 'zustand';

export type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeState {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  applyTheme: (mode: ThemeMode) => void;
}

const getInitialTheme = (): ThemeMode => {
  const saved = localStorage.getItem('crc_theme') as ThemeMode;
  return saved || 'system';
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: getInitialTheme(),
  setTheme: (mode: ThemeMode) => {
    localStorage.setItem('crc_theme', mode);
    set({ theme: mode });
    get().applyTheme(mode);
  },
  applyTheme: (mode: ThemeMode) => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');

    let effectiveTheme = mode;
    if (mode === 'system') {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.add('light');
    }
  },
}));
