import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  KeyRound,
  Mail,
  AlertCircle,
  CheckCircle2,
  Shield,
  CalendarDays,
  UserCheck,
  BookOpen,
  GraduationCap,
  ArrowRight,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';
import { ThemeSwitcher } from '../components/ThemeSwitcher';
import { CosmicBackground } from '../components/CosmicBackground';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { setAuth, accessToken, user: currentUser } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const isResetSuccess = searchParams.get('reset') === 'success';

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
        'Login failed. Please check your credentials or network connection.';
      setError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await doLogin(email, password);
  };

  return (
    <div className="min-h-screen relative flex flex-col justify-between overflow-x-hidden font-sans text-slate-900 dark:text-slate-100 selection:bg-cyan-500/30">
      {/* Dynamic Cosmic Background with Twinkling Stars & Comets */}
      <CosmicBackground />

      {/* Top Header / Brand Bar */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center">
          {/* High-Resolution Transparent Logo (2x Size) */}
          <img
            src="/logo-light.png"
            alt="Orion"
            className="h-24 sm:h-28 lg:h-32 w-auto object-contain block dark:hidden drop-shadow-sm transition-transform duration-200 hover:scale-[1.02]"
          />
          <img
            src="/logo-dark.png"
            alt="Orion"
            className="h-24 sm:h-28 lg:h-32 w-auto object-contain hidden dark:block drop-shadow-[0_0_30px_rgba(56,189,248,0.4)] transition-transform duration-200 hover:scale-[1.02]"
          />
        </div>

        {/* Top Right Controls */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/60 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 backdrop-blur-md text-xs font-medium text-slate-600 dark:text-slate-300 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Academic Portal Live</span>
          </div>
          <ThemeSwitcher />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-6 py-4 lg:py-6 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
        {/* Left Platform Overview Column */}
        <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.1]">
            Your central hub for{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 dark:from-cyan-400 dark:via-blue-400 dark:to-indigo-400">
              classes, attendance & learning.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
            Welcome to Orion — the unified portal for students and faculty. Access your daily schedules, monitor real-time attendance compliance, review subject materials, and access industry case studies.
          </p>

          {/* 4 Academic Hub Feature Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-w-2xl pt-2">
            <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 backdrop-blur-xl shadow-sm hover:border-cyan-500/40 transition-colors flex items-start gap-3.5">
              <div className="h-10 w-10 rounded-xl bg-cyan-500/10 dark:bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0 text-cyan-600 dark:text-cyan-400">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Class Schedule & Timetable
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal mt-0.5">
                  Daily & weekly routines, classroom venues, and faculty allocations.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 backdrop-blur-xl shadow-sm hover:border-cyan-500/40 transition-colors flex items-start gap-3.5">
              <div className="h-10 w-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Attendance & Compliance
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal mt-0.5">
                  Personal attendance tracking, subject percentages, and correction requests.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 backdrop-blur-xl shadow-sm hover:border-cyan-500/40 transition-colors flex items-start gap-3.5">
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 dark:bg-purple-500/15 border border-purple-500/30 flex items-center justify-center shrink-0 text-purple-600 dark:text-purple-400">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Subject LMS & Resources
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal mt-0.5">
                  Unit outlines, lecture presentations, notes, and course activities.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 backdrop-blur-xl shadow-sm hover:border-cyan-500/40 transition-colors flex items-start gap-3.5">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Case Studies & Discussions
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal mt-0.5">
                  Interactive real-world business cases and structured study notes.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Authentication Card (Dedicated Sign In) */}
        <div className="lg:col-span-5 w-full max-w-md mx-auto">
          <div className="relative rounded-3xl p-7 sm:p-9 bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl border border-slate-200/90 dark:border-slate-800/90 shadow-2xl shadow-cyan-500/5 transition-all duration-200">
            {/* Ambient Card Glow */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-cyan-500/10 dark:bg-cyan-500/15 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-500/10 dark:bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />

            {/* Card Header (Centered & Larger Title) */}
            <div className="mb-7 text-center">
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                Sign In
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-xs mx-auto">
                Enter your official <span className="font-semibold text-cyan-600 dark:text-cyan-400">@mile.education</span> credentials to access your portal.
              </p>
            </div>

            {/* Error Notification */}
            {isResetSuccess && (
              <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs flex items-center space-x-2.5 animate-fadeIn">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Password updated successfully! Please sign in with your new password.</span>
              </div>
            )}

            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-center space-x-2.5 animate-fadeIn">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
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
                    className="w-full bg-slate-50/80 dark:bg-slate-950/70 border border-slate-300/80 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all duration-200"
                    placeholder="name@mile.education"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-semibold text-cyan-600 hover:text-cyan-500 dark:text-cyan-400 dark:hover:text-cyan-300 transition-colors"
                  >
                    Forgot Password?
                  </Link>
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50/80 dark:bg-slate-950/70 border border-slate-300/80 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all duration-200"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 hover:from-blue-500 hover:via-cyan-500 hover:to-indigo-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? 'Authenticating...' : 'Sign in to Orion'}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>

            {/* Security Note */}
            <div className="mt-5 pt-4 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <Shield className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>Authorized personnel, faculty & students</span>
            </div>

            {/* Register Link */}
            <div className="mt-4 text-center">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                New student?{' '}
                <Link
                  to="/register"
                  className="text-cyan-600 dark:text-cyan-400 font-bold hover:underline"
                >
                  Register with @mile.education →
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200/50 dark:border-slate-800/50 mt-8">
        <p>© 2026 Lexicon MILE. Powered by HyperBuild</p>
      </footer>
    </div>
  );
};
