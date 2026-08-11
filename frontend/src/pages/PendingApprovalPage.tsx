import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock, CheckCircle2, XCircle, Mail, AlertCircle, LogOut } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';
import { Logo } from '../components/Logo';
import { ThemeSwitcher } from '../components/ThemeSwitcher';

interface RegistrationStatus {
  status: string;
  rejection_reason?: string;
  full_name: string;
  email: string;
  is_email_verified: boolean;
  submitted_at: string;
}

export const PendingApprovalPage: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  const { data, isLoading } = useQuery<RegistrationStatus>({
    queryKey: ['registration-status'],
    queryFn: async () => {
      const res = await api.get('/auth/registration-status');
      return res.data.data;
    },
    refetchInterval: 60000,
    retry: false,
  });

  // Auto-redirect if approved
  useEffect(() => {
    if (data?.status === 'approved') {
      navigate('/dashboard');
    }
  }, [data?.status, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending_verification':
        return { icon: <Mail className="h-8 w-8 text-amber-500" />, color: 'amber', title: 'Verify Your Email', desc: 'Please check your email and verify your address to proceed.' };
      case 'pending_review':
        return { icon: <Clock className="h-8 w-8 text-cyan-500" />, color: 'cyan', title: 'Under Review', desc: 'Your registration has been submitted and is being reviewed by the admin team. This typically takes 1-2 business days.' };
      case 'rejected':
        return { icon: <XCircle className="h-8 w-8 text-rose-500" />, color: 'rose', title: 'Registration Rejected', desc: 'Unfortunately, your registration was not approved.' };
      default:
        return { icon: <Clock className="h-8 w-8 text-slate-400" />, color: 'slate', title: 'Processing', desc: 'Please wait...' };
    }
  };

  const config = data ? getStatusConfig(data.status) : getStatusConfig('pending_review');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
        <Logo size="sm" />
        <div className="flex items-center gap-3">
          <ThemeSwitcher />
          <button onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </div>

      {/* Background glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-[80vh]">
          <div className="h-8 w-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="max-w-2xl mx-auto px-4 py-16">
          {/* Status icon */}
          <div className="flex justify-center mb-8">
            <div className={`w-24 h-24 rounded-3xl bg-${config.color}-50 dark:bg-${config.color}-500/10 border border-${config.color}-200 dark:border-${config.color}-500/30 flex items-center justify-center`}>
              {config.icon}
            </div>
          </div>

          <h1 className="text-3xl font-bold text-slate-900 dark:text-white text-center mb-3">
            {config.title}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-center mb-8 max-w-md mx-auto leading-relaxed">
            {config.desc}
          </p>

          {/* Rejection reason */}
          {data?.status === 'rejected' && data.rejection_reason && (
            <div className="flex items-start gap-3 p-4 mb-6 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30">
              <AlertCircle className="h-5 w-5 text-rose-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-rose-700 dark:text-rose-400 mb-1">Reason for rejection:</p>
                <p className="text-sm text-rose-600 dark:text-rose-300">{data.rejection_reason}</p>
                <p className="text-xs text-rose-500 dark:text-rose-400 mt-2">Please contact the admin team for further assistance.</p>
              </div>
            </div>
          )}

          {/* Verify email action */}
          {data?.status === 'pending_verification' && (
            <div className="flex justify-center mb-6">
              <button onClick={() => navigate(`/verify-email?email=${encodeURIComponent(data.email)}`)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm transition-colors">
                <Mail className="h-4 w-4" /> Go to Email Verification
              </button>
            </div>
          )}

          {/* Info card */}
          {data && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Registration Summary</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  { label: 'Full Name', value: data.full_name },
                  { label: 'Email', value: data.email },
                  { label: 'Email Verified', value: data.is_email_verified ? '✓ Verified' : '✗ Not Verified' },
                  { label: 'Submitted', value: new Date(data.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) },
                ].map(item => (
                  <div key={item.label}>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">{item.label}</p>
                    <p className="font-medium text-slate-900 dark:text-white">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Status timeline */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs text-slate-600 dark:text-slate-400">Registration submitted</span>
                </div>
                <div className="flex items-center gap-3 mb-2">
                  {data.is_email_verified
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    : <div className="h-4 w-4 rounded-full border-2 border-amber-400" />}
                  <span className="text-xs text-slate-600 dark:text-slate-400">Email verified</span>
                </div>
                <div className="flex items-center gap-3">
                  {data.status === 'approved'
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    : data.status === 'rejected'
                    ? <XCircle className="h-4 w-4 text-rose-500" />
                    : <div className="h-4 w-4 rounded-full border-2 border-slate-300 dark:border-slate-600" />}
                  <span className="text-xs text-slate-600 dark:text-slate-400">Admin approval</span>
                </div>
              </div>
            </div>
          )}

          <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-6">
            This page refreshes automatically every 60 seconds.
          </p>
        </div>
      )}
    </div>
  );
};
