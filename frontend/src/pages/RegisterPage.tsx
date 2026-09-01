import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { ThemeSwitcher } from '../components/ThemeSwitcher';
import { Logo } from '../components/Logo';
import { CosmicBackground } from '../components/CosmicBackground';
import {
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  Check,
  X,
  GraduationCap,
} from 'lucide-react';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', 'Unknown'];
const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];

const UG_DEGREES = [
  'B.Tech / B.E.',
  'BBA / BMS',
  'B.Com (Hons / General)',
  'B.Sc (Comp Sci / IT / Math)',
  'BCA',
  'BA (Economics / Arts)',
  'Other Bachelor Degree',
];

const SPECIALIZATIONS = [
  'Marketing',
  'Finance',
  'Human Resources',
  'Research & Business Analytics',
];

interface ProgramOption {
  id: string;
  code: string;
  name: string;
  description?: string;
}

const DEFAULT_PROGRAMS: ProgramOption[] = [
  {
    id: 'pgdm-default',
    code: 'PGDM',
    name: 'Post Graduate Diploma in Management',
    description: 'AICTE Approved 2-Year Full Time Program',
  },
  {
    id: 'gmba-default',
    code: 'GMBA',
    name: 'MBA Global',
    description: 'Global MBA Program',
  },
  {
    id: 'bba-default',
    code: 'BBA',
    name: 'Bachelors in Business Administration',
    description: 'Undergraduate Management Degree',
  },
  {
    id: 'hmct-default',
    code: 'HMCT',
    name: 'Hotel Management & Catering Technology',
    description: 'Hospitality & Culinary Arts',
  },
];

interface FormData {
  email: string;
  password: string;
  confirmPassword: string;
  program_code: string;
  program_name: string;
  prn_number: string;
  first_name: string;
  last_name: string;
  gender: string;
  mobile_number: string;
  email_personal: string;
  father_name: string;
  mother_name: string;
  blood_group: string;
  emergency_contact_name: string;
  emergency_contact_number: string;
  emergency_contact_relation: string;
  alternate_contact_number: string;
  ug_degree: string;
  ug_score_type: string;
  ug_score: string;
  specialization_major: string;
  specialization_minor: string;
}

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [prnError, setPrnError] = useState('');

  const [programs, setPrograms] = useState<ProgramOption[]>(DEFAULT_PROGRAMS);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [form, setForm] = useState<FormData>({
    email: '',
    password: '',
    confirmPassword: '',
    program_code: 'PGDM',
    program_name: 'Post Graduate Diploma in Management',
    prn_number: '',
    first_name: '',
    last_name: '',
    gender: 'Male',
    mobile_number: '',
    email_personal: '',
    father_name: '',
    mother_name: '',
    blood_group: 'O+',
    emergency_contact_name: '',
    emergency_contact_number: '',
    emergency_contact_relation: '',
    alternate_contact_number: '',
    ug_degree: 'BBA / BMS',
    ug_score_type: 'cgpa',
    ug_score: '',
    specialization_major: 'Marketing',
    specialization_minor: 'None / Not Decided',
  });

  // Fetch programs defined in the backend
  useEffect(() => {
    const fetchPrograms = async () => {
      try {
        const res = await api.get('/auth/public-programs');
        if (res.data?.data && Array.isArray(res.data.data) && res.data.data.length > 0) {
          setPrograms(res.data.data);
          // Set initial program if PGDM exists
          const pgdm = res.data.data.find((p: ProgramOption) => p.code.toUpperCase() === 'PGDM');
          if (pgdm) {
            setForm((prev) => ({
              ...prev,
              program_code: pgdm.code,
              program_name: pgdm.name,
            }));
          }
        }
      } catch {
        // Fallback to DEFAULT_PROGRAMS
      }
    };
    fetchPrograms();
  }, []);

  const set = (key: keyof FormData, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const isPgdmSelected =
    form.program_code.toUpperCase() === 'PGDM' ||
    form.program_name.toUpperCase().includes('PGDM') ||
    form.program_name.toUpperCase().includes('POST GRADUATE DIPLOMA');

  // Password Policy Rules Evaluation
  const pwdRules = {
    minLength: form.password.length >= 8,
    hasUpper: /[A-Z]/.test(form.password),
    hasLower: /[a-z]/.test(form.password),
    hasNumber: /[0-9]/.test(form.password),
    hasSpecial: /[^A-Za-z0-9]/.test(form.password),
    matches: Boolean(form.password && form.confirmPassword && form.password === form.confirmPassword),
  };

  const isPasswordValid =
    pwdRules.minLength &&
    pwdRules.hasUpper &&
    pwdRules.hasLower &&
    pwdRules.hasNumber &&
    pwdRules.hasSpecial &&
    pwdRules.matches;

  const validateEmail = (val: string) => {
    if (!val) {
      setEmailError('');
      return;
    }
    if (!val.endsWith('@mile.education')) {
      setEmailError('Only @mile.education email addresses are allowed');
    } else {
      setEmailError('');
    }
  };

  const validatePrn = (val: string, programCode: string) => {
    if (!val) {
      setPrnError('');
      return;
    }
    const isPgdm = programCode.toUpperCase() === 'PGDM' || programCode.includes('PGDM');
    if (isPgdm) {
      if (!/^\d+$/.test(val)) {
        setPrnError('For PGDM, PRN must contain digits only');
      } else if (val.length !== 14) {
        setPrnError(`For PGDM, PRN must be exactly 14 numeric digits (currently ${val.length}/14)`);
      } else {
        setPrnError('');
      }
    } else {
      setPrnError('');
    }
  };

  const handleProgramChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedCode = e.target.value;
    const prog = programs.find((p) => p.code === selectedCode);
    const newName = prog ? prog.name : selectedCode;

    setForm((prev) => ({
      ...prev,
      program_code: selectedCode,
      program_name: newName,
      // If switching to PGDM, clean non-digits and slice to 14
      prn_number:
        selectedCode === 'PGDM'
          ? prev.prn_number.replace(/\D/g, '').slice(0, 14)
          : prev.prn_number,
    }));

    validatePrn(
      selectedCode === 'PGDM' ? form.prn_number.replace(/\D/g, '').slice(0, 14) : form.prn_number,
      selectedCode
    );
  };

  const handlePrnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;
    if (isPgdmSelected) {
      raw = raw.replace(/\D/g, '').slice(0, 14);
    }
    set('prn_number', raw);
    validatePrn(raw, form.program_code);
  };

  const validateStep1 = () => {
    if (!form.email || emailError) {
      setError('Please enter a valid @mile.education email');
      return false;
    }
    if (!form.program_code) {
      setError('Please select your academic program');
      return false;
    }
    if (!form.prn_number) {
      setError('PRN Number is required');
      return false;
    }
    if (isPgdmSelected) {
      if (!/^\d{14}$/.test(form.prn_number)) {
        setError('For PGDM, PRN must be exactly 14 numeric digits');
        return false;
      }
    }
    if (!isPasswordValid) {
      setError('Please satisfy all password policy criteria and ensure passwords match');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!form.first_name) {
      setError('First name is required');
      return false;
    }
    if (!form.mobile_number) {
      setError('Mobile number is required');
      return false;
    }
    if (!form.father_name) {
      setError("Father's name is required");
      return false;
    }
    if (!form.mother_name) {
      setError("Mother's name is required");
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!form.emergency_contact_name) {
      setError('Emergency contact name is required');
      return false;
    }
    if (!form.emergency_contact_number) {
      setError('Emergency contact number is required');
      return false;
    }
    if (!form.emergency_contact_relation) {
      setError('Emergency contact relation is required');
      return false;
    }
    if (!form.ug_degree) {
      setError('UG Degree is required');
      return false;
    }
    if (!form.ug_score) {
      setError('UG Score is required');
      return false;
    }
    if (!form.specialization_major) {
      setError('Major Specialization is required');
      return false;
    }
    return true;
  };

  const nextStep = () => {
    setError('');
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep((s) => s + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validateStep3()) return;
    setLoading(true);
    try {
      await api.post('/auth/register', {
        email: form.email,
        password: form.password,
        confirm_password: form.confirmPassword,
        program_code: form.program_code,
        program_name: form.program_name,
        prn_number: form.prn_number,
        first_name: form.first_name,
        last_name: form.last_name || null,
        gender: form.gender,
        mobile_number: form.mobile_number,
        email_personal: form.email_personal || null,
        father_name: form.father_name,
        mother_name: form.mother_name,
        blood_group: form.blood_group,
        emergency_contact_name: form.emergency_contact_name,
        emergency_contact_number: form.emergency_contact_number,
        emergency_contact_relation: form.emergency_contact_relation,
        alternate_contact_number: form.alternate_contact_number || null,
        ug_degree: form.ug_degree,
        ug_score_type: form.ug_score_type,
        ug_score: parseFloat(form.ug_score) || 0,
        specialization_major: form.specialization_major,
        specialization_minor:
          form.specialization_minor === 'None / Not Decided' ? null : form.specialization_minor,
      });
      navigate(`/verify-email?email=${encodeURIComponent(form.email)}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    'w-full bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-500 transition-colors placeholder-slate-400 dark:placeholder-slate-500';
  const labelCls =
    'block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5';

  const steps = ['Account Setup', 'Personal Details', 'Academic Details'];

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 py-8 text-slate-900 dark:text-slate-100">
      <CosmicBackground />
      <div className="absolute top-6 right-6 z-20">
        <ThemeSwitcher />
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
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                    done
                      ? 'bg-cyan-500 border-cyan-500 text-white'
                      : active
                      ? 'border-cyan-500 text-cyan-500 dark:text-cyan-400'
                      : 'border-slate-300 dark:border-slate-700 text-slate-400'
                  }`}
                >
                  {done ? <CheckCircle2 className="h-4 w-4" /> : n}
                </div>
                <span
                  className={`text-xs font-medium hidden sm:block ${
                    active
                      ? 'text-cyan-600 dark:text-cyan-400'
                      : done
                      ? 'text-slate-600 dark:text-slate-400'
                      : 'text-slate-400'
                  }`}
                >
                  {label}
                </span>
                {i < steps.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-2 rounded ${
                      done ? 'bg-cyan-500' : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
            {step === 1
              ? 'Create Your Account'
              : step === 2
              ? 'Personal Details'
              : 'Academic & Specialization'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-6">
            {step === 1
              ? 'Use your official @mile.education email and select your academic program'
              : step === 2
              ? 'Tell us more about your personal and family details'
              : 'Select your degree background and preferred specializations'}
          </p>

          {error && (
            <div className="flex items-start gap-3 p-3 mb-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form
            onSubmit={
              step < 3
                ? (e) => {
                    e.preventDefault();
                    nextStep();
                  }
                : handleSubmit
            }
            className="space-y-4"
          >
            {/* ──────── STEP 1: ACCOUNT SETUP ──────── */}
            {step === 1 && (
              <>
                {/* 1. Official Email */}
                <div>
                  <label className={labelCls}>
                    Official Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    className={inputCls}
                    placeholder="name@mile.education"
                    value={form.email}
                    onChange={(e) => {
                      set('email', e.target.value);
                      validateEmail(e.target.value);
                    }}
                    required
                  />
                  {emailError && <p className="text-xs text-rose-500 mt-1">{emailError}</p>}
                </div>

                {/* 2. Program Selection */}
                <div>
                  <label className={labelCls}>
                    Program / Course <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      className={`${inputCls} appearance-none pr-10 cursor-pointer font-medium`}
                      value={form.program_code}
                      onChange={handleProgramChange}
                      required
                    >
                      {programs.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.name} ({p.code})
                        </option>
                      ))}
                    </select>
                    <GraduationCap className="absolute right-3.5 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* 3. PRN Number (With PGDM 14-digit numeric rule) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      PRN Number <span className="text-rose-500">*</span>
                    </label>
                    {isPgdmSelected && (
                      <span
                        className={`text-[11px] font-mono font-bold ${
                          form.prn_number.length === 14
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {form.prn_number.length}/14 Digits (Numeric)
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    className={`${inputCls} ${
                      isPgdmSelected ? 'font-mono' : ''
                    } ${prnError ? 'border-rose-400 dark:border-rose-500 focus:border-rose-500' : ''}`}
                    placeholder={
                      isPgdmSelected
                        ? '14-digit numeric PRN (e.g. 20261029384756)'
                        : 'e.g. 26GMBA042'
                    }
                    maxLength={isPgdmSelected ? 14 : 50}
                    value={form.prn_number}
                    onChange={handlePrnChange}
                    required
                  />
                  {prnError ? (
                    <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {prnError}
                    </p>
                  ) : isPgdmSelected && form.prn_number.length === 14 ? (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                      <Check className="h-3 w-3" /> Valid 14-digit PGDM PRN
                    </p>
                  ) : null}
                </div>

                {/* 4. SEPARATE PASSWORD SECTION */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-3.5">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-lg bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold">
                      <Lock className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                        Create Password for Orion
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Must satisfy security complexity requirements
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Create Password */}
                    <div>
                      <label className={labelCls}>
                        Create Password <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          className={`${inputCls} pr-10`}
                          placeholder="Create password"
                          value={form.password}
                          onChange={(e) => set('password', e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Repeat Password */}
                    <div>
                      <label className={labelCls}>
                        Repeat Password <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          className={`${inputCls} pr-10`}
                          placeholder="Repeat password"
                          value={form.confirmPassword}
                          onChange={(e) => set('confirmPassword', e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
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
                            : form.confirmPassword
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
                </div>
              </>
            )}

            {/* ──────── STEP 2: PERSONAL DETAILS ──────── */}
            {step === 2 && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>
                      First Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      className={inputCls}
                      placeholder="First name"
                      value={form.first_name}
                      onChange={(e) => set('first_name', e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Last Name</label>
                    <input
                      className={inputCls}
                      placeholder="Last name"
                      value={form.last_name}
                      onChange={(e) => set('last_name', e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Gender</label>
                    <select
                      className={inputCls}
                      value={form.gender}
                      onChange={(e) => set('gender', e.target.value)}
                    >
                      {GENDERS.map((g) => (
                        <option key={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Blood Group</label>
                    <select
                      className={inputCls}
                      value={form.blood_group}
                      onChange={(e) => set('blood_group', e.target.value)}
                    >
                      {BLOOD_GROUPS.map((b) => (
                        <option key={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>
                    Mobile Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    className={inputCls}
                    placeholder="+91 98765 43210"
                    value={form.mobile_number}
                    onChange={(e) => set('mobile_number', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Personal Email</label>
                  <input
                    type="email"
                    className={inputCls}
                    placeholder="personal@email.com"
                    value={form.email_personal}
                    onChange={(e) => set('email_personal', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    Father's Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    className={inputCls}
                    placeholder="Father's full name"
                    value={form.father_name}
                    onChange={(e) => set('father_name', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    Mother's Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    className={inputCls}
                    placeholder="Mother's full name"
                    value={form.mother_name}
                    onChange={(e) => set('mother_name', e.target.value)}
                    required
                  />
                </div>
              </>
            )}

            {/* ──────── STEP 3: ACADEMIC DETAILS ──────── */}
            {step === 3 && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>
                      Emergency Contact Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      className={inputCls}
                      placeholder="Contact name"
                      value={form.emergency_contact_name}
                      onChange={(e) => set('emergency_contact_name', e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelCls}>
                      Emergency Contact Relation <span className="text-rose-500">*</span>
                    </label>
                    <input
                      className={inputCls}
                      placeholder="e.g. Father, Mother"
                      value={form.emergency_contact_relation}
                      onChange={(e) => set('emergency_contact_relation', e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>
                    Emergency Contact Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    className={inputCls}
                    placeholder="+91 98765 43210"
                    value={form.emergency_contact_number}
                    onChange={(e) => set('emergency_contact_number', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Alternate Contact Number (Optional)</label>
                  <input
                    className={inputCls}
                    placeholder="+91 98765 43210"
                    value={form.alternate_contact_number}
                    onChange={(e) => set('alternate_contact_number', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>
                      UG Degree <span className="text-rose-500">*</span>
                    </label>
                    <select
                      className={inputCls}
                      value={form.ug_degree}
                      onChange={(e) => set('ug_degree', e.target.value)}
                    >
                      {UG_DEGREES.map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>
                      Score Type <span className="text-rose-500">*</span>
                    </label>
                    <select
                      className={inputCls}
                      value={form.ug_score_type}
                      onChange={(e) => set('ug_score_type', e.target.value)}
                    >
                      <option value="cgpa">CGPA (out of 10)</option>
                      <option value="percentage">Percentage (%)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>
                    UG Score <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className={inputCls}
                    placeholder={form.ug_score_type === 'cgpa' ? 'e.g. 8.45' : 'e.g. 78.50'}
                    value={form.ug_score}
                    onChange={(e) => set('ug_score', e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>
                      Major Specialization <span className="text-rose-500">*</span>
                    </label>
                    <select
                      className={inputCls}
                      value={form.specialization_major}
                      onChange={(e) => set('specialization_major', e.target.value)}
                    >
                      {SPECIALIZATIONS.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Minor Specialization (Optional)</label>
                    <select
                      className={inputCls}
                      value={form.specialization_minor}
                      onChange={(e) => set('specialization_minor', e.target.value)}
                    >
                      <option>None / Not Decided</option>
                      {SPECIALIZATIONS.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center gap-3 pt-4">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setStep((s) => s - 1);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
              )}
              <button
                type="submit"
                disabled={
                  loading ||
                  (step === 1 &&
                    (!form.email ||
                      Boolean(emailError) ||
                      Boolean(prnError) ||
                      !form.prn_number ||
                      (isPgdmSelected && form.prn_number.length !== 14) ||
                      !isPasswordValid))
                }
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-sm shadow-md shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {loading
                  ? 'Submitting...'
                  : step === 3
                  ? 'Complete Registration'
                  : 'Continue'}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </form>

          {/* Sign In Link */}
          <div className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
            Already registered?{' '}
            <Link
              to="/login"
              className="text-cyan-600 dark:text-cyan-400 font-semibold hover:underline"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
