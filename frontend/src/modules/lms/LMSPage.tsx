import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  GraduationCap,
  BookOpen,
  Search,
  CheckSquare,
  CalendarCheck,
  Clock,
  Award,
  X,
  ChevronRight,
  LayoutGrid,
  List,
  Users,
  Zap,
  Filter,
  BookMarked,
  ArrowDownUp,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../lib/store';

interface EnrolledSubjectCard {
  id: string;
  name: string;
  code: string;
  course_code?: string;
  trimester: number;
  credits: number;
  is_non_credit: boolean;
  total_hours?: number;
  course_category?: string;
  elective_domain?: string;
  program_id?: string;
  program_name?: string;
  batch_id?: string;
  batch_name?: string;
  faculty_name?: string;
  attendance_percentage: number;
  resources_count: number;
  recordings_count: number;
  activities_count: number;
  assessments_count: number;
  units_count?: number;
  case_studies_count?: number;
  course_overview?: string;
  total_marks?: number;
}

// Deterministic color per subject code
const CARD_ACCENTS = [
  { bg: 'from-indigo-500 to-violet-600', light: 'bg-indigo-50 dark:bg-indigo-950/50', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-800', badge: 'bg-indigo-600' },
  { bg: 'from-sky-500 to-cyan-600',      light: 'bg-sky-50 dark:bg-sky-950/50',      text: 'text-sky-600 dark:text-sky-400',      border: 'border-sky-200 dark:border-sky-800',      badge: 'bg-sky-600' },
  { bg: 'from-violet-500 to-purple-600', light: 'bg-violet-50 dark:bg-violet-950/50',text: 'text-violet-600 dark:text-violet-400',border: 'border-violet-200 dark:border-violet-800',badge: 'bg-violet-600' },
  { bg: 'from-emerald-500 to-teal-600',  light: 'bg-emerald-50 dark:bg-emerald-950/50',text: 'text-emerald-600 dark:text-emerald-400',border: 'border-emerald-200 dark:border-emerald-800',badge: 'bg-emerald-600' },
  { bg: 'from-amber-500 to-orange-600',  light: 'bg-amber-50 dark:bg-amber-950/50',  text: 'text-amber-600 dark:text-amber-400',  border: 'border-amber-200 dark:border-amber-800',  badge: 'bg-amber-600' },
  { bg: 'from-rose-500 to-pink-600',     light: 'bg-rose-50 dark:bg-rose-950/50',     text: 'text-rose-600 dark:text-rose-400',     border: 'border-rose-200 dark:border-rose-800',     badge: 'bg-rose-600' },
];

function getAccent(code: string) {
  let hash = 0;
  for (let i = 0; i < code.length; i++) hash = (hash * 31 + code.charCodeAt(i)) % CARD_ACCENTS.length;
  return CARD_ACCENTS[hash];
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function getTrimesterLabel(trimester: number) {
  const labels = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];
  return labels[trimester] || String(trimester);
}

function getAttendanceStatus(percentage: number): { 
  color: string; 
  bg: string; 
  border: string; 
  label: string; 
  icon: string;
} {
  if (percentage >= 75) {
    return { 
      color: 'text-emerald-600 dark:text-emerald-400', 
      bg: 'bg-emerald-500', 
      border: 'border-emerald-200 dark:border-emerald-800',
      label: '✓ Safe',
      icon: '✓'
    };
  } else if (percentage >= 60) {
    return { 
      color: 'text-amber-600 dark:text-amber-400', 
      bg: 'bg-amber-500', 
      border: 'border-amber-200 dark:border-amber-800',
      label: '⚠ Warning',
      icon: '⚠'
    };
  } else {
    return { 
      color: 'text-rose-600 dark:text-rose-400', 
      bg: 'bg-rose-500', 
      border: 'border-rose-200 dark:border-rose-800',
      label: '🔴 Critical',
      icon: '🔴'
    };
  }
}


// ─── Skeleton Card ────────────────────────────────────────────────────────────
const SkeletonCard: React.FC = () => (
  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden animate-pulse flex flex-col h-full">
    <div className="h-1 bg-slate-200 dark:bg-slate-700" />
    <div className="p-5 space-y-4 flex-1">
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 rounded-xl bg-slate-200 dark:bg-slate-700 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <div className="h-4 w-14 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-4 w-20 rounded bg-slate-100 dark:bg-slate-800" />
          </div>
          <div className="h-4 w-4/5 rounded bg-slate-200 dark:bg-slate-700" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 pt-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-9 rounded-xl bg-slate-100 dark:bg-slate-800" />
        ))}
      </div>
    </div>
    <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30 flex justify-between items-center">
      <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="h-5 w-5 rounded bg-slate-200 dark:bg-slate-700" />
    </div>
  </div>
);

// ─── Course Card (Grid) ───────────────────────────────────────────────────────
interface CourseCardGridProps {
  s: EnrolledSubjectCard;
  accent: typeof CARD_ACCENTS[0];
  isStudent: boolean;
  onClick: () => void;
  index: number;
}

const CourseCardGrid: React.FC<CourseCardGridProps> = ({ s, accent, isStudent, onClick }) => {
  const attStatus = getAttendanceStatus(s.attendance_percentage);

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-slate-950/60 hover:-translate-y-1 hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200 flex flex-col justify-between"
    >
      {/* Top gradient accent line */}
      <div className={`h-1.5 bg-gradient-to-r ${accent.bg}`} />

      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        {/* Header: Avatar, Badges & Title */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${accent.bg} text-white flex items-center justify-center text-sm font-black shrink-0 shadow-sm relative overflow-hidden`}>
              {getInitials(s.name)}
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black font-mono uppercase ${accent.light} ${accent.text} border ${accent.border}`}>
                  {s.code}
                </span>
                {s.course_code && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                    {s.course_code}
                  </span>
                )}
                {s.course_category === 'elective' && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                    Elective
                  </span>
                )}
              </div>

              <h3 className={`text-base font-extrabold text-slate-900 dark:text-white group-hover:${accent.text} transition-colors line-clamp-2 leading-snug`}>
                {s.name}
              </h3>
            </div>
          </div>

          {/* Program & Batch line */}
          {(s.program_name || s.batch_name) && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium truncate flex items-center gap-1">
              <Users className="h-3 w-3 shrink-0 text-slate-400" />
              <span>{s.program_name || ''}{s.batch_name ? ` · ${s.batch_name}` : ''}</span>
            </p>
          )}
        </div>

        {/* Key Academic Metrics Grid (2x2) */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            <BookMarked className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
            <span className="truncate">Trimester {s.trimester} ({getTrimesterLabel(s.trimester)})</span>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            <Clock className="h-3.5 w-3.5 text-sky-500 shrink-0" />
            <span className="truncate">{s.total_hours || 30} Hours</span>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            <Award className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span className="truncate">{s.is_non_credit ? 'Non-Credit' : `${s.credits} Credits`}</span>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            <CheckSquare className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span className="truncate">{s.units_count ? `${s.units_count} Units` : `${s.total_marks || 100}M Eval`}</span>
          </div>
        </div>

        {/* Faculty Name (if available) */}
        {s.faculty_name && (
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate flex items-center gap-1.5 pt-0.5">
            <span className="text-slate-400">Faculty:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">{s.faculty_name}</span>
          </div>
        )}

        {/* Student Attendance Bar */}
        {isStudent && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[10px] font-bold">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <CalendarCheck className="h-3 w-3" /> Attendance
              </span>
              <span className={attStatus.color}>{s.attendance_percentage}%</span>
            </div>
            <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden relative">
              <div
                className={`h-full rounded-full transition-all duration-500 ${attStatus.bg}`}
                style={{ width: `${Math.min(s.attendance_percentage, 100)}%` }}
              />
              <div className="absolute top-0 bottom-0 w-px bg-slate-300/80 dark:bg-slate-600/60" style={{ left: '75%' }} />
            </div>
          </div>
        )}
      </div>

      {/* Card Footer CTA */}
      <div className={`px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between text-xs font-bold ${accent.text}`}>
        <span>Enter Course LMS</span>
        <div className={`h-6 w-6 rounded-lg ${accent.light} border ${accent.border} flex items-center justify-center group-hover:translate-x-1 transition-transform`}>
          <ChevronRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </div>
  );
};

// ─── Course Row (List) ────────────────────────────────────────────────────────
const CourseRowList: React.FC<{ s: EnrolledSubjectCard; accent: typeof CARD_ACCENTS[0]; isStudent: boolean; onClick: () => void }> = ({ s, accent, isStudent, onClick }) => {
  return (
  <div
    onClick={onClick}
    className="group cursor-pointer flex items-center gap-4 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-700 hover:-translate-y-px transition-all duration-200"
  >
    {/* Colored left stripe */}
    <div className={`h-12 w-1.5 rounded-full bg-gradient-to-b ${accent.bg} shrink-0`} />

    {/* Avatar */}
    <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${accent.bg} text-white flex items-center justify-center text-sm font-black shrink-0 shadow-sm`}>
      {getInitials(s.name)}
    </div>

    {/* Title + meta */}
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className={`text-sm font-bold text-slate-900 dark:text-white group-hover:${accent.text} transition-colors truncate`}>{s.name}</h3>
        <span className={`px-2 py-0.5 rounded text-[10px] font-black font-mono uppercase ${accent.light} ${accent.text} border ${accent.border} shrink-0`}>{s.code}</span>
        {s.course_code && (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0">{s.course_code}</span>
        )}
        {s.course_category === 'elective' && (
          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 shrink-0">Elective</span>
        )}
      </div>
      <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px] text-slate-400 dark:text-slate-500 font-medium">
        {s.program_name && <span className="truncate flex items-center gap-1"><Users className="h-3 w-3" /> {s.program_name}</span>}
        <span>·</span>
        <span className="flex items-center gap-1"><BookMarked className="h-3 w-3" /> T{s.trimester}</span>
        <span>·</span>
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {s.total_hours || 30}h</span>
        <span>·</span>
        <span className="flex items-center gap-1"><Award className="h-3 w-3" /> {s.is_non_credit ? 'Non-Credit' : `${s.credits} Credits`}</span>
      </div>
    </div>

    {/* Academic details */}
    <div className="hidden md:flex items-center gap-2 shrink-0">
      {s.units_count != null && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
          <BookOpen className="h-3 w-3 text-violet-500" /> {s.units_count} Units
        </span>
      )}
      {s.total_marks != null && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
          <CheckSquare className="h-3 w-3 text-emerald-500" /> {s.total_marks}M
        </span>
      )}
      {s.faculty_name && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 max-w-[150px] truncate">
          <Users className="h-3 w-3 text-rose-500 shrink-0" /> <span className="truncate">{s.faculty_name}</span>
        </span>
      )}
    </div>

    {/* Attendance (student) - enhanced with status color */}
    {isStudent && (
      <div className={`shrink-0 px-3 py-1.5 rounded-full text-[10.5px] font-black border transition-all ${
        s.attendance_percentage >= 75 
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
          : s.attendance_percentage >= 60
          ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800'
          : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800'
      }`}>
        <span className="flex items-center gap-1">
          <CalendarCheck className="h-3 w-3" /> {s.attendance_percentage}%
        </span>
      </div>
    )}

    {/* Arrow */}
    <ChevronRight className={`h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600 group-hover:${accent.text} group-hover:translate-x-1 transition-all`} />
  </div>
  );
};


// ─── Main Page ────────────────────────────────────────────────────────────────
export const LMSPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTerm, setSelectedTerm] = useState<string>('all');
  const [selectedProgram, setSelectedProgram] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'code' | 'trimester' | 'attendance' | 'activity'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const isStudent =
    user?.roles.includes('student') &&
    !user?.roles.some((r) => ['crc_admin', 'crc_coordinator'].includes(r));

  const { data: programsData = [] } = useQuery<any[]>({
    queryKey: ['programs'],
    queryFn: async () => { const res = await api.get('/academic/programs'); return res.data.data; },
  });

  const { data: subjects = [], isLoading, isFetching, refetch } = useQuery<EnrolledSubjectCard[]>({
    queryKey: ['lms-enrolled-subjects', user?.id],
    queryFn: async () => { const res = await api.get('/lms/my-subjects'); return res.data; },
    staleTime: 60 * 1000,
  });

  // Sort subjects
  const sortedSubjects = useMemo(() => {
    return [...subjects].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'code':
          comparison = a.code.localeCompare(b.code);
          break;
        case 'trimester':
          comparison = a.trimester - b.trimester;
          break;
        case 'attendance':
          comparison = a.attendance_percentage - b.attendance_percentage;
          break;
        case 'activity':
          comparison = (b.activities_count + b.assessments_count) - (a.activities_count + a.assessments_count);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [subjects, sortBy, sortOrder]);

  const filteredSubjects = useMemo(() => sortedSubjects.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) ||
      (s.course_code?.toLowerCase().includes(q)) || (s.program_name?.toLowerCase().includes(q));
    const matchesTerm = selectedTerm === 'all' || s.trimester.toString() === selectedTerm;
    const matchesProgram = selectedProgram === 'all' || s.program_name?.toLowerCase().includes(selectedProgram.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || (s.course_category || 'core').toLowerCase() === selectedCategory.toLowerCase();
    return matchesSearch && matchesTerm && matchesProgram && matchesCategory;
  }), [sortedSubjects, searchQuery, selectedTerm, selectedProgram, selectedCategory]);



  const hasFilters = searchQuery || selectedProgram !== 'all' || selectedTerm !== 'all' || selectedCategory !== 'all';
  const clearFilters = () => { setSearchQuery(''); setSelectedProgram('all'); setSelectedTerm('all'); setSelectedCategory('all'); };

  const avgAttendance = isStudent && subjects.length
    ? Math.round(subjects.reduce((a, c) => a + (c.attendance_percentage || 0), 0) / subjects.length)
    : null;

  // Keyboard shortcut: Cmd/Ctrl+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('lms-search') as HTMLInputElement;
        searchInput?.focus();
      }
      if (e.key === 'Escape') {
        if (searchQuery) setSearchQuery('');
        setShowFilters(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery]);

  return (
    <div className="space-y-5 animate-fadeIn pb-14">

      {/* ── Hero Header ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
        {/* Subtle gradient glow */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06]"
          style={{ backgroundImage: 'radial-gradient(ellipse at 30% 50%, #6366f1 0%, transparent 60%)' }} />
        <div className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

        <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left: Title */}
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                <GraduationCap className="h-3.5 w-3.5" />
                {isStudent ? 'Learning Portal' : 'LMS Hub'}
              </span>
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Active · 2025–26
              </span>
              {isStudent && avgAttendance !== null && (
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                  avgAttendance >= 75 
                    ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : avgAttendance >= 60
                    ? 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                    : 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                }`}>
                  Avg Attendance · {avgAttendance}%
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-[1.85rem] font-black tracking-tight text-slate-900 dark:text-white leading-snug">
              {isStudent ? 'My Courses & Learning Hub' : 'Course Directory & Content Hub'}
            </h1>
            <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 leading-relaxed">
              {isStudent
                ? 'Access syllabi, learning activities, case studies, session plans, lecture archives, assessments & attendance tracking — all in one place.'
                : 'Manage syllabi, PPTs, recorded lectures, continuous assessments, session plans and student submissions across programs.'}
            </p>
          </div>
        </div>
      </div>


      {/* ── Search + Controls Bar ────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <label htmlFor="lms-search" className="sr-only">Search courses</label>
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            id="lms-search"
            type="search"
            placeholder="Search courses, codes, programs… (⌘K)"
            className="w-full pl-10 pr-12 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 transition-all shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoComplete="off"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')} 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(v => !v)}
          className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-bold transition-all shadow-sm cursor-pointer ${showFilters ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600'}`}
        >
          <Filter className="h-4 w-4" />
          Filters
          {hasFilters && <span className="h-2 w-2 rounded-full bg-rose-400 animate-pulse" />}
        </button>

        {/* Sort Dropdown */}
        <div className="relative hidden sm:block">
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [newSortBy, newSortOrder] = e.target.value.split('-');
              setSortBy(newSortBy as typeof sortBy);
              setSortOrder(newSortOrder as typeof sortOrder);
            }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-3 pr-10 text-sm font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer appearance-none shadow-sm"
            aria-label="Sort courses"
          >
            <option value="name-asc">Name A-Z</option>
            <option value="name-desc">Name Z-A</option>
            <option value="code-asc">Code A-Z</option>
            <option value="code-desc">Code Z-A</option>
            <option value="trimester-asc">Trimester 1-6</option>
            <option value="trimester-desc">Trimester 6-1</option>
            {isStudent && <option value="attendance-asc">Attendance ↑</option>}
            {isStudent && <option value="attendance-desc">Attendance ↓</option>}
            <option value="activity-desc">Most Activity</option>
            <option value="activity-asc">Least Activity</option>
          </select>
          <ArrowDownUp className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        </div>

        {/* View toggle */}
        <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 shadow-sm">
          {[{ mode: 'grid', Icon: LayoutGrid, label: 'Grid view' }, { mode: 'list', Icon: List, label: 'List view' }].map(({ mode, Icon, label }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode as 'grid' | 'list')}
              className={`p-2.5 rounded-lg transition-all cursor-pointer ${viewMode === mode ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
              aria-label={label}
              aria-pressed={viewMode === mode}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>

        {/* Refresh button */}
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm disabled:opacity-50"
          aria-label="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
        </button>

        {/* Results count */}
        {!isLoading && (
          <span className="text-sm text-slate-400 dark:text-slate-500 font-semibold whitespace-nowrap hidden sm:block">
            {filteredSubjects.length} of {subjects.length} course{subjects.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── Expanded Filters ─────────────────────────────────────────────────── */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm animate-fadeIn">
          {programsData.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> Program
              </span>
              <select
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                value={selectedProgram}
                onChange={(e) => setSelectedProgram(e.target.value)}
              >
                <option value="all">All Programs</option>
                {programsData.map((p: any) => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" /> Trimester
            </span>
            <select
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
            >
              <option value="all">All Trimesters</option>
              {[1,2,3,4,5,6].map(n => <option key={n} value={String(n)}>Trimester {n}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap flex items-center gap-1">
              <Zap className="h-3.5 w-3.5" /> Category
            </span>
            <select
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">All Categories</option>
              <option value="core">Core Courses</option>
              <option value="elective">Electives</option>
            </select>
          </div>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all cursor-pointer border border-rose-200 dark:border-rose-800"
            >
              <X className="h-3.5 w-3.5" /> Clear All
            </button>
          )}
        </div>
      )}

      {/* ── Course Grid / List ───────────────────────────────────────────────── */}
      {isLoading ? (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5' : 'space-y-3'}>
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filteredSubjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 gap-5 text-center">
          <div className="h-16 w-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <BookOpen className="h-8 w-8 text-slate-400" />
          </div>
          <div>
            <p className="text-base font-bold text-slate-700 dark:text-slate-300">
              {hasFilters ? 'No courses match your filters' : 'No courses found'}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {hasFilters 
                ? 'Try adjusting your search or filter criteria to see more results.'
                : 'You are not enrolled in any courses yet.'}
            </p>
          </div>
          {hasFilters && (
            <button 
              onClick={clearFilters} 
              className="mt-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-all shadow-md hover:shadow-lg cursor-pointer"
            >
              Clear All Filters
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSubjects.map((s, idx) => (
            <CourseCardGrid
              key={s.id}
              s={s}
              accent={getAccent(s.code)}
              isStudent={!!isStudent}
              onClick={() => navigate(`/lms/subjects/${s.code.toLowerCase()}`)}
              index={idx}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredSubjects.map((s) => (
            <CourseRowList
              key={s.id}
              s={s}
              accent={getAccent(s.code)}
              isStudent={!!isStudent}
              onClick={() => navigate(`/lms/subjects/${s.code.toLowerCase()}`)}
            />
          ))}
        </div>
      )}

      {/* Mobile-only results count */}
      <div className="sm:hidden text-sm text-slate-400 dark:text-slate-500 font-semibold text-center py-2">
        {filteredSubjects.length} of {subjects.length} course{subjects.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
};
