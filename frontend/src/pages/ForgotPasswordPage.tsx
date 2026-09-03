import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  KeyRound,
  Mail,
  Lock,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  RotateCcw,
  ShieldCheck,
  Check,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { CosmicBackground } from '../components/CosmicBackground';
import { ThemeSwitcher } from '../components/ThemeSwitcher';
import { Logo } from '../components/Logo';

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState<string>(searchParams.get('email') || '');
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState<number>(0);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Resend countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // Handle Step 1: Send OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/forgot-password/request-otp', { email: email.trim().toLowerCase() });
      setStep(2);
      setResendTimer(30);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to send verification code. Please check your email.');
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP digit changes
  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Pasted full OTP
      const pastedDigits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newOtp = [...otp];
      pastedDigits.forEach((d, i) => {
        if (i < 6) newOtp[i] = d;
      });
      setOtp(newOtp);
      const nextIdx = Math.min(pastedDigits.length, 5);
      inputRefs.current[nextIdx]?.focus();
      return;
    }

    const digit = value.replace(/\D/g, '');
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Handle Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const code = otp.join('');
    if (code.length !== 6) {
      setError('Please enter all 6 digits of your verification code.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/forgot-password/verify-otp', {
        email: email.trim().toLowerCase(),
        code,
      });
      setStep(3);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid or expired verification code.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Resend OTP
  const handleResend = async () => {
    if (resendTimer > 0) return;
    setError(null);
    setLoading(true);
    try {
      await api.post('/auth/forgot-password/request-otp', { email: email.trim().toLowerCase() });
      setResendTimer(30);
      setOtp(['', '', '', '', '', '']);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to resend code.');
    } finally {
      setLoading(false);
    }
  };

  // Password Policy Rules Evaluation (Identical to Orion Platform Registration)
  const pwdRules = {
    minLength: newPassword.length >= 8,
    hasUpper: /[A-Z]/.test(newPassword),
    hasLower: /[a-z]/.test(newPassword),
    hasNumber: /[0-9]/.test(newPassword),
    hasSpecial: /[^A-Za-z0-9]/.test(newPassword),
    matches: Boolean(newPassword && confirmPassword && newPassword === confirmPassword),
  };

  const isPasswordValid =
    pwdRules.minLength &&
    pwdRules.hasUpper &&
    pwdRules.hasLower &&
    pwdRules.hasNumber &&
    pwdRules.hasSpecial &&
    pwdRules.matches;

  // Handle Step 3: Set New Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isPasswordValid) {
      setError('Please satisfy all password complexity requirements and ensure passwords match.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/forgot-password/reset', {
        email: email.trim().toLowerCase(),
        code: otp.join(''),
        new_password: newPassword,
      });
      navigate('/login?reset=success');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#060919] text-slate-900 dark:text-slate-100 flex flex-col justify-between relative overflow-hidden transition-colors duration-300">
      {/* Background canvas */}
      <CosmicBackground />

      {/* Top Navbar */}
      <header className="relative z-20 w-full px-6 py-4 flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/40 backdrop-blur-md bg-white/40 dark:bg-slate-950/40">
        <div className="flex items-center gap-3">
          <Logo className="h-9 w-auto" />
        </div>
        <ThemeSwitcher />
      </header>

      {/* Main Content Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  step === s
                    ? 'w-8 bg-gradient-to-r from-cyan-500 to-blue-600'
                    : step > s
                    ? 'w-4 bg-emerald-500'
                    : 'w-4 bg-slate-200 dark:bg-slate-800'
                }`}
              />
            ))}
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2.5 animate-fadeIn">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Enter Registered Email */}
          {step === 1 && (
            <form onSubmit={handleRequestOtp} className="space-y-5">
              <div className="text-center space-y-2">
                <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 dark:bg-cyan-500/15 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mx-auto shadow-xs">
                  <KeyRound className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Forgot Password?</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                  Enter your registered institutional email address. We will dispatch a 6-digit verification code to your inbox.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Registered Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@mile.education"
                    className="w-full bg-slate-50/90 dark:bg-slate-950/80 border border-slate-300/80 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 hover:from-blue-500 hover:via-cyan-500 hover:to-indigo-500 text-white shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? 'Sending Code...' : 'Send Verification Code'}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </button>

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
                </Link>
              </div>
            </form>
          )}

          {/* STEP 2: Enter 6-Digit OTP */}
          {step === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="text-center space-y-2">
                <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 dark:bg-cyan-500/15 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mx-auto shadow-xs">
                  <Mail className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Check Your Email</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                  We have sent a 6-digit verification code to <span className="font-semibold text-cyan-600 dark:text-cyan-400">{email}</span>.
                </p>
              </div>

              {/* 6-Digit PIN Boxes */}
              <div className="flex justify-center gap-2 sm:gap-2.5 my-2">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (inputRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    className="w-11 h-13 text-center text-xl font-bold font-mono bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 focus:bg-cyan-50/10 transition-all shadow-inner"
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={loading || otp.join('').length !== 6}
                className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? 'Verifying Code...' : 'Verify Code & Proceed'}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </button>

              {/* Resend Action */}
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="hover:text-slate-800 dark:hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Change Email
                </button>

                <button
                  type="button"
                  disabled={resendTimer > 0 || loading}
                  onClick={handleResend}
                  className={`font-semibold flex items-center gap-1 transition-colors ${
                    resendTimer > 0
                      ? 'text-slate-400 cursor-not-allowed'
                      : 'text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer'
                  }`}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {resendTimer > 0 ? `Resend code (${resendTimer}s)` : 'Resend Code'}
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: Enter New Password */}
          {step === 3 && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="text-center space-y-2">
                <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-xs">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Create New Password</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                  Set a new, secure password for <span className="font-semibold text-cyan-600 dark:text-cyan-400">{email}</span>.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Create new password"
                    className="w-full bg-slate-50/90 dark:bg-slate-950/80 border border-slate-300/80 dark:border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full bg-slate-50/90 dark:bg-slate-950/80 border border-slate-300/80 dark:border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Visual Password Policy Checklist */}
              <div className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
                <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Password Requirements
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                  {/* 1. Min 8 chars */}
                  <div
                    className={`flex items-center gap-1.5 transition-colors ${
                      pwdRules.minLength
                        ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {pwdRules.minLength ? (
                      <Check className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <X className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    )}
                    <span>Min 8 characters</span>
                  </div>

                  {/* 2. One uppercase */}
                  <div
                    className={`flex items-center gap-1.5 transition-colors ${
                      pwdRules.hasUpper
                        ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {pwdRules.hasUpper ? (
                      <Check className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <X className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    )}
                    <span>One capital letter (A-Z)</span>
                  </div>

                  {/* 3. One lowercase */}
                  <div
                    className={`flex items-center gap-1.5 transition-colors ${
                      pwdRules.hasLower
                        ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {pwdRules.hasLower ? (
                      <Check className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <X className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    )}
                    <span>One small letter (a-z)</span>
                  </div>

                  {/* 4. One number */}
                  <div
                    className={`flex items-center gap-1.5 transition-colors ${
                      pwdRules.hasNumber
                        ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {pwdRules.hasNumber ? (
                      <Check className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <X className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    )}
                    <span>One numeric digit (0-9)</span>
                  </div>

                  {/* 5. One special char */}
                  <div
                    className={`flex items-center gap-1.5 transition-colors ${
                      pwdRules.hasSpecial
                        ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {pwdRules.hasSpecial ? (
                      <Check className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <X className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    )}
                    <span>One special character</span>
                  </div>

                  {/* 6. Passwords match */}
                  <div
                    className={`flex items-center gap-1.5 transition-colors ${
                      pwdRules.matches
                        ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                        : confirmPassword
                        ? 'text-rose-500 dark:text-rose-400 font-semibold'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {pwdRules.matches ? (
                      <Check className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <X className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    )}
                    <span>Passwords match</span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !isPasswordValid}
                className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? 'Updating Password...' : 'Save New Password & Sign In'}
                {!loading && <CheckCircle2 className="h-4 w-4" />}
              </button>
            </form>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-4 text-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200/50 dark:border-slate-800/40">
        © 2026 Lexicon MILE. Powered by HyperBuild.
      </footer>
    </div>
  );
};
