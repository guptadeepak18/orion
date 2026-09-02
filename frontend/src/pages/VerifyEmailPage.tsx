import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { ThemeSwitcher } from '../components/ThemeSwitcher';
import { Logo } from '../components/Logo';
import { CosmicBackground } from '../components/CosmicBackground';
import { Mail, AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react';

const OTP_LENGTH = 6;

export const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialEmail = searchParams.get('email') || '';

  const [email, setEmail] = useState<string>(initialEmail);
  const [isEditingEmail, setIsEditingEmail] = useState<boolean>(!initialEmail);
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(initialEmail ? 30 : 0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (initialEmail) {
      inputRefs.current[0]?.focus();
    }
  }, [initialEmail]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleDigitChange = (index: number, value: string) => {
    const val = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = val;
    setDigits(newDigits);
    if (val && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    const newDigits = [...digits];
    for (let i = 0; i < pasted.length; i++) newDigits[i] = pasted[i];
    setDigits(newDigits);
    const next = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[next]?.focus();
  };

  const handleVerify = async () => {
    const code = digits.join('');
    if (!email.trim()) { setError('Please enter your registered email address.'); return; }
    if (code.length < OTP_LENGTH) { setError('Please enter the complete 6-digit code'); return; }
    setError(''); setLoading(true);
    try {
      await api.post('/auth/verify-email', { email: email.trim(), code });
      setSuccess('Email verified! Your account is now pending administrator review.');
      setTimeout(() => navigate('/login?verified=1'), 2000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid or expired code. Please try again.');
      setDigits(Array(OTP_LENGTH).fill(''));
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (!email.trim()) { setError('Please enter your email address to resend code.'); return; }
    setResendLoading(true); setError(''); setSuccess('');
    try {
      await api.post('/auth/resend-verification', { email: email.trim() });
      setSuccess('A fresh verification code has been dispatched to your email.');
      setResendCooldown(60);
      setIsEditingEmail(false);
      setDigits(Array(OTP_LENGTH).fill(''));
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to resend code.');
    } finally { setResendLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 text-slate-900 dark:text-slate-100">
      <CosmicBackground />
      <div className="absolute top-6 right-6 z-20"><ThemeSwitcher /></div>

      <div className="w-full max-w-md z-10">
        <div className="flex justify-center mb-6"><Logo size="md" /></div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-8 text-center">
          {/* Mail icon */}
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 rounded-2xl bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 flex items-center justify-center">
              <Mail className="h-8 w-8 text-cyan-600 dark:text-cyan-400" />
            </div>
          </div>

          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Check Your Email</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
            We sent a 6-digit verification code to:
          </p>
          
          {isEditingEmail ? (
            <div className="flex items-center gap-2 mb-6">
              <input
                type="email"
                placeholder="student.name@mile.education"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={handleResend}
                disabled={resendLoading || !email}
                className="px-3 py-1.5 rounded-xl bg-cyan-600 text-white font-bold text-xs shrink-0 disabled:opacity-50"
              >
                Send Code
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 mb-6">
              <span className="text-sm font-semibold text-cyan-600 dark:text-cyan-400 break-all">{email}</span>
              <button
                type="button"
                onClick={() => setIsEditingEmail(true)}
                className="text-[11px] text-slate-400 hover:text-cyan-600 underline font-medium"
              >
                Change
              </button>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 p-3 mb-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 text-sm text-left">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-3 p-3 mb-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-sm text-left">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* OTP boxes */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {digits.map((d, i) => (
              <input key={i}
                ref={el => { inputRefs.current[i] = el; }}
                type="text" inputMode="numeric" maxLength={1}
                value={d}
                onChange={e => handleDigitChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                onPaste={i === 0 ? handlePaste : undefined}
                className={`w-11 h-14 text-center text-xl font-bold rounded-xl border-2 transition-all outline-none
                  bg-slate-50 dark:bg-slate-800
                  text-slate-900 dark:text-white
                  ${d ? 'border-cyan-500 dark:border-cyan-500' : 'border-slate-300 dark:border-slate-700'}
                  focus:border-cyan-500 dark:focus:border-cyan-400`}
              />
            ))}
          </div>

          <button onClick={handleVerify} disabled={loading || digits.join('').length < OTP_LENGTH}
            className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-500 dark:hover:bg-cyan-600 text-white font-semibold text-sm transition-colors disabled:opacity-50 mb-4">
            {loading ? 'Verifying...' : 'Verify Email'}
          </button>

          <div className="text-sm text-slate-500 dark:text-slate-400">
            {resendCooldown > 0 ? (
              <span>Resend code in <span className="font-semibold text-cyan-600 dark:text-cyan-400">{resendCooldown}s</span></span>
            ) : (
              <button onClick={handleResend} disabled={resendLoading}
                className="flex items-center gap-1.5 mx-auto text-cyan-600 dark:text-cyan-400 font-semibold hover:underline disabled:opacity-50">
                <RotateCcw className="h-3.5 w-3.5" />
                {resendLoading ? 'Sending...' : 'Resend Code'}
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
          <Link to="/register" className="text-cyan-600 dark:text-cyan-400 font-semibold hover:underline">← Back to Registration</Link>
        </p>
      </div>
    </div>
  );
};
