import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { KeyRound, Mail, AlertCircle, Shield, User, GraduationCap, Users } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';
import { ThemeSwitcher } from '../components/ThemeSwitcher';
import { Logo } from '../components/Logo';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('admin@mile.education');
  const [password, setPassword] = useState('Admin@123456');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { setAuth, accessToken, user: currentUser } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Auto redirect if already logged in
  useEffect(() => {
    if (accessToken && currentUser) {
      navigate('/dashboard', { replace: true });
    }
  }, [accessToken, currentUser, navigate]);

  const doLogin = async (loginEmail: string, loginPass: string) => {
    setError('');
    setLoading(true);

    try {
      queryClient.clear();
      const res = await api.post('/auth/login', {
        email: loginEmail.trim().toLowerCase(),
        password: loginPass,
      });

      if (res.data?.data) {
        const { access_token, refresh_token, user } = res.data.data;
        setAuth(user, access_token, refresh_token);
        window.location.href = '/dashboard';
      } else {
        setError('Invalid response from server. Please try again.');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      const detail =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        'Login failed. Network error.';
      setError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await doLogin(email, password);
  };

  const quickFill = (quickEmail: string, quickPass: string) => {
    setEmail(quickEmail);
    setPassword(quickPass);
    doLogin(quickEmail, quickPass);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 transition-colors duration-200 relative">
      {/* Theme Switcher in Top Right */}
      <div className="absolute top-6 right-6 z-20">
        <ThemeSwitcher />
      </div>

      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/10 dark:bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="glass-panel rounded-3xl p-8 shadow-2xl border border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90">
          {/* Header */}
          <div className="flex flex-col items-center justify-center text-center mb-6">
            <Logo className="justify-center mb-1 max-w-xs" />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 font-medium">
              Academic Operations & Student Portal
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 text-sm flex items-center space-x-3 animate-fadeIn">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all duration-200"
                  placeholder="admin@mile.education"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all duration-200"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Authenticating...' : 'Sign In to Portal'}
            </button>
          </form>

          {/* Quick Role Login Selector */}
          <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800/80 space-y-2">
            <p className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 text-center">
              Quick Role Selector (Evaluation Access)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => quickFill('admin@mile.education', 'Admin@123456')}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Shield className="h-3.5 w-3.5 text-indigo-600" /> Administrator
              </button>
              <button
                type="button"
                onClick={() => quickFill('coordinator@lexiconmile.com', 'password123')}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Users className="h-3.5 w-3.5 text-purple-600" /> Coordinator
              </button>
              <button
                type="button"
                onClick={() => quickFill('deepak.gupta@mile.education', 'password123')}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <User className="h-3.5 w-3.5 text-emerald-600" /> Faculty Member
              </button>
              <button
                type="button"
                onClick={() => quickFill('sourav@mile.education', 'password123')}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <GraduationCap className="h-3.5 w-3.5 text-cyan-600" /> Enrolled Student
              </button>
            </div>
          </div>

          <div className="mt-5 text-center">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              New student?{' '}
              <Link to="/register" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
                Register with @mile.education →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
