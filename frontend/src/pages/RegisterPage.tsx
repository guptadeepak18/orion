import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { ThemeSwitcher } from '../components/ThemeSwitcher';
import { Logo } from '../components/Logo';
import { ArrowRight, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', 'Unknown'];
const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];

interface FormData {
  email: string; password: string; confirmPassword: string; prn_number: string;
  first_name: string; last_name: string; gender: string;
  mobile_number: string; email_personal: string; father_name: string; mother_name: string; blood_group: string;
  emergency_contact_name: string; emergency_contact_number: string; emergency_contact_relation: string;
  alternate_contact_number: string; ug_degree: string; ug_score_type: string; ug_score: string;
}

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');

  const [form, setForm] = useState<FormData>({
    email: '', password: '', confirmPassword: '', prn_number: '',
    first_name: '', last_name: '', gender: 'Male',
    mobile_number: '', email_personal: '', father_name: '', mother_name: '', blood_group: 'O+',
    emergency_contact_name: '', emergency_contact_number: '', emergency_contact_relation: '',
    alternate_contact_number: '', ug_degree: '', ug_score_type: 'cgpa', ug_score: '',
  });

  const set = (key: keyof FormData, value: string) => setForm(f => ({ ...f, [key]: value }));

  const validateEmail = (val: string) => {
    if (!val) { setEmailError(''); return; }
    if (!val.endsWith('@mile.education')) {
      setEmailError('Only @mile.education email addresses are allowed');
    } else { setEmailError(''); }
  };

  const validateStep1 = () => {
    if (!form.email || emailError) { setError('Please enter a valid @mile.education email'); return false; }
    if (!form.prn_number) { setError('PRN Number is required'); return false; }
    if (!form.password || form.password.length < 8) { setError('Password must be at least 8 characters'); return false; }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return false; }
    return true;
  };

  const validateStep2 = () => {
    if (!form.first_name) { setError('First name is required'); return false; }
    if (!form.mobile_number) { setError('Mobile number is required'); return false; }
    if (!form.father_name) { setError("Father's name is required"); return false; }
    if (!form.mother_name) { setError("Mother's name is required"); return false; }
    return true;
  };

  const validateStep3 = () => {
    if (!form.emergency_contact_name) { setError('Emergency contact name is required'); return false; }
    if (!form.emergency_contact_number) { setError('Emergency contact number is required'); return false; }
    if (!form.emergency_contact_relation) { setError('Emergency contact relation is required'); return false; }
    if (!form.ug_degree) { setError('UG Degree is required'); return false; }
    if (!form.ug_score) { setError('UG Score is required'); return false; }
    return true;
  };

  const nextStep = () => {
    setError('');
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep(s => s + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validateStep3()) return;
    setLoading(true);
    try {
      await api.post('/auth/register', {
        email: form.email, password: form.password, confirm_password: form.confirmPassword,
        prn_number: form.prn_number,
        first_name: form.first_name, last_name: form.last_name || null, gender: form.gender,
        mobile_number: form.mobile_number, email_personal: form.email_personal || null,
        father_name: form.father_name, mother_name: form.mother_name, blood_group: form.blood_group,
        emergency_contact_name: form.emergency_contact_name,
        emergency_contact_number: form.emergency_contact_number,
        emergency_contact_relation: form.emergency_contact_relation,
        alternate_contact_number: form.alternate_contact_number || null,
        ug_degree: form.ug_degree, ug_score_type: form.ug_score_type,
        ug_score: parseFloat(form.ug_score) || 0,
      });
      navigate(`/verify-email?email=${encodeURIComponent(form.email)}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.');
    } finally { setLoading(false); }
  };

  const inputCls = "w-full bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-500 transition-colors placeholder-slate-400 dark:placeholder-slate-500";
  const labelCls = "block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5";

  const steps = ['Account Setup', 'Personal Details', 'Background'];

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-8 transition-colors duration-200 relative">
      <div className="absolute top-6 right-6 z-20"><ThemeSwitcher /></div>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-lg z-10">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Logo size="md" />
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6 px-2">
          {steps.map((label, i) => {
            const n = i + 1;
            const active = step === n;
            const done = step > n;
            return (
              <div key={n} className="flex items-center gap-2 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  done ? 'bg-cyan-500 border-cyan-500 text-white' :
                  active ? 'border-cyan-500 text-cyan-500 dark:text-cyan-400' :
                  'border-slate-300 dark:border-slate-700 text-slate-400'
                }`}>
                  {done ? <CheckCircle2 className="h-4 w-4" /> : n}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${active ? 'text-cyan-600 dark:text-cyan-400' : done ? 'text-slate-600 dark:text-slate-400' : 'text-slate-400'}`}>{label}</span>
                {i < steps.length - 1 && <div className={`h-0.5 flex-1 mx-2 rounded ${done ? 'bg-cyan-500' : 'bg-slate-200 dark:bg-slate-700'}`} />}
              </div>
            );
          })}
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
            {step === 1 ? 'Create Your Account' : step === 2 ? 'Personal Details' : 'Academic Background'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            {step === 1 ? 'Use your official @mile.education email to register' :
             step === 2 ? 'Tell us more about you' : 'Your academic background and emergency contact'}
          </p>

          {error && (
            <div className="flex items-start gap-3 p-3 mb-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={step < 3 ? (e) => { e.preventDefault(); nextStep(); } : handleSubmit} className="space-y-4">
            {/* Step 1 */}
            {step === 1 && <>
              <div>
                <label className={labelCls}>Official Email <span className="text-rose-500">*</span></label>
                <input type="email" className={`${inputCls} ${emailError ? 'border-rose-400' : ''}`} placeholder="yourname@mile.education"
                  value={form.email} onChange={e => { set('email', e.target.value); validateEmail(e.target.value); }} required />
                {emailError && <p className="text-xs text-rose-500 mt-1">{emailError}</p>}
              </div>
              <div>
                <label className={labelCls}>PRN Number <span className="text-rose-500">*</span></label>
                <input className={inputCls} placeholder="e.g. 2025MBA001" value={form.prn_number} onChange={e => set('prn_number', e.target.value)} required />
              </div>
              <div>
                <label className={labelCls}>Password <span className="text-rose-500">*</span></label>
                <input type="password" className={inputCls} placeholder="Minimum 8 characters" value={form.password} onChange={e => set('password', e.target.value)} required />
              </div>
              <div>
                <label className={labelCls}>Confirm Password <span className="text-rose-500">*</span></label>
                <input type="password" className={inputCls} placeholder="Re-enter your password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} required />
              </div>
            </>}

            {/* Step 2 */}
            {step === 2 && <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>First Name <span className="text-rose-500">*</span></label>
                  <input className={inputCls} placeholder="First name" value={form.first_name} onChange={e => set('first_name', e.target.value)} required />
                </div>
                <div>
                  <label className={labelCls}>Last Name</label>
                  <input className={inputCls} placeholder="Last name" value={form.last_name} onChange={e => set('last_name', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Gender</label>
                  <select className={inputCls} value={form.gender} onChange={e => set('gender', e.target.value)}>
                    {GENDERS.map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Blood Group</label>
                  <select className={inputCls} value={form.blood_group} onChange={e => set('blood_group', e.target.value)}>
                    {BLOOD_GROUPS.map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Mobile Number <span className="text-rose-500">*</span></label>
                <input className={inputCls} placeholder="+91 98765 43210" value={form.mobile_number} onChange={e => set('mobile_number', e.target.value)} required />
              </div>
              <div>
                <label className={labelCls}>Personal Email</label>
                <input type="email" className={inputCls} placeholder="personal@email.com" value={form.email_personal} onChange={e => set('email_personal', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Father's Name <span className="text-rose-500">*</span></label>
                <input className={inputCls} placeholder="Father's full name" value={form.father_name} onChange={e => set('father_name', e.target.value)} required />
              </div>
              <div>
                <label className={labelCls}>Mother's Name <span className="text-rose-500">*</span></label>
                <input className={inputCls} placeholder="Mother's full name" value={form.mother_name} onChange={e => set('mother_name', e.target.value)} required />
              </div>
            </>}

            {/* Step 3 */}
            {step === 3 && <>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Emergency Contact</p>
                <div>
                  <label className={labelCls}>Name <span className="text-rose-500">*</span></label>
                  <input className={inputCls} placeholder="Contact person's name" value={form.emergency_contact_name} onChange={e => set('emergency_contact_name', e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Phone <span className="text-rose-500">*</span></label>
                    <input className={inputCls} placeholder="+91 98765 43210" value={form.emergency_contact_number} onChange={e => set('emergency_contact_number', e.target.value)} required />
                  </div>
                  <div>
                    <label className={labelCls}>Relation <span className="text-rose-500">*</span></label>
                    <input className={inputCls} placeholder="e.g. Parent, Spouse" value={form.emergency_contact_relation} onChange={e => set('emergency_contact_relation', e.target.value)} required />
                  </div>
                </div>
              </div>
              <div>
                <label className={labelCls}>Alternate Contact Number</label>
                <input className={inputCls} placeholder="Optional alternate number" value={form.alternate_contact_number} onChange={e => set('alternate_contact_number', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>UG Degree <span className="text-rose-500">*</span></label>
                <input className={inputCls} placeholder="e.g. B.Com, BBA, B.Tech" value={form.ug_degree} onChange={e => set('ug_degree', e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Score Type <span className="text-rose-500">*</span></label>
                  <select className={inputCls} value={form.ug_score_type} onChange={e => set('ug_score_type', e.target.value)}>
                    <option value="cgpa">CGPA</option>
                    <option value="percentage">Percentage</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Score <span className="text-rose-500">*</span></label>
                  <input type="number" step="0.01" className={inputCls} placeholder={form.ug_score_type === 'cgpa' ? '0.00 – 10.00' : '0 – 100'} value={form.ug_score} onChange={e => set('ug_score', e.target.value)} required />
                </div>
              </div>
            </>}

            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              {step > 1 ? (
                <button type="button" onClick={() => { setError(''); setStep(s => s - 1); }}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
              ) : <div />}
              <button type="submit" disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-500 dark:hover:bg-cyan-600 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                {loading ? 'Submitting...' : step < 3 ? <><span>Continue</span><ArrowRight className="h-4 w-4" /></> : 'Submit Registration'}
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
          Already registered?{' '}
          <Link to="/login" className="text-cyan-600 dark:text-cyan-400 font-semibold hover:underline">Sign In</Link>
        </p>
      </div>
    </div>
  );
};
