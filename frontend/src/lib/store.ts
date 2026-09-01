import { create } from 'zustand';

export interface UserSummary {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  avatar_url?: string | null;
  is_active: boolean;
  roles: string[];
}

interface AuthState {
  user: UserSummary | null;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (user: UserSummary, accessToken: string, refreshToken: string) => void;
  updateUser: (updatedUser: Partial<UserSummary>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  accessToken: localStorage.getItem('access_token'),
  refreshToken: localStorage.getItem('refresh_token'),
  setAuth: (user, accessToken, refreshToken) => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    set({ user, accessToken, refreshToken });
  },
  updateUser: (updatedFields) => {
    set((state) => {
      if (!state.user) return state;
      const updated = { ...state.user, ...updatedFields };
      localStorage.setItem('user', JSON.stringify(updated));
      return { user: updated };
    });
  },
  logout: () => {
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    set({ user: null, accessToken: null, refreshToken: null });
  },
}));
