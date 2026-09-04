import { SearchableVenueSelect } from "./SearchableVenueSelect";
import React, { useState, useEffect } from 'react';
import {
  X,
  UploadCloud,
  Trash2,
  Eye,
  ExternalLink,
} from 'lucide-react';
import { api } from '../../lib/api';

export interface AcademicEventItem {
  id: string;
  title: string;
  event_category: string;
  program_id?: string;
  program_name?: string;
  program_code?: string;
  batch_id?: string;
  batch_name?: string;
  batch_code?: string;
  division_id?: string;
  division_name?: string;
  division_code?: string;
  start_date: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  is_all_day: boolean;
  venue?: string;
  mode: string;
  organizer_name?: string;
  speaker_guest_details?: string;
  description?: string;
  target_audience?: string;
  is_mandatory: boolean;
  registration_link?: string;
  status: string;
  color_code?: string;
  poster_url?: string;
  poster_filename?: string;
  created_by_name?: string;
  created_at?: string;
  updated_at?: string;
}

export const EVENT_CATEGORIES: {
  value: string;
  label: string;
}[] = [
  { value: 'guest_lecture', label: 'Guest Lecture / Masterclass' },
  { value: 'workshop', label: 'Workshop / Boot Camp' },
  { value: 'exam_midterm', label: 'Mid-Term Examination' },
  { value: 'exam_endterm', label: 'End-Term Examination' },
  { value: 'milestone_deadline', label: 'Academic Milestone / Submission' },
  { value: 'placement_drive', label: 'Placement Drive / PPT / GD-PI' },
  { value: 'conclave', label: 'Academic Conclave / Symposium' },
  { value: 'industrial_visit', label: 'Industrial Visit / Field Immersion' },
  { value: 'orientation', label: 'Orientation & Induction' },
  { value: 'holiday', label: 'Institutional Holiday / Break' },
  { value: 'faculty_meeting', label: 'Faculty / Academic Council Meeting' },
  { value: 'other', label: 'Other Academic Event' },
];

interface AcademicEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: AcademicEventItem | null;
  onSuccess: () => void;
  programs: any[];
  batches: any[];
  divisions: any[];
}

export const AcademicEventModal: React.FC<AcademicEventModalProps> = ({
  isOpen,
  onClose,
  event,
  onSuccess,
  programs,
  batches,
  divisions,
}) => {
  const isEditing = !!event;

  // Form State
  const [title, setTitle] = useState('');
  const [eventCategory, setEventCategory] = useState('guest_lecture');
  const [programId, setProgramId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('12:00');
  const [isAllDay, setIsAllDay] = useState(false);
  const [venue, setVenue] = useState('');
  const [mode, setMode] = useState('offline');
  const [organizerName, setOrganizerName] = useState('');
  const [speakerGuestDetails, setSpeakerGuestDetails] = useState('');
  const [description, setDescription] = useState('');
  const [targetAudience, setTargetAudience] = useState('all_students');
  const [isMandatory, setIsMandatory] = useState(true);
  const [registrationLink, setRegistrationLink] = useState('');
  const [status, setStatus] = useState('scheduled');
  const [posterUrl, setPosterUrl] = useState('');
  const [posterFilename, setPosterFilename] = useState('');
  const [isUploadingPoster, setIsUploadingPoster] = useState(false);
  const [showPosterPreview, setShowPosterPreview] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [notifyStudents, setNotifyStudents] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      setEventCategory(event.event_category || 'other');
      setProgramId(event.program_id || '');
      setBatchId(event.batch_id || '');
      setDivisionId(event.division_id || '');
      setStartDate(event.start_date || new Date().toISOString().split('T')[0]);
      setEndDate(event.end_date || event.start_date || new Date().toISOString().split('T')[0]);
      setStartTime(event.start_time ? event.start_time.slice(0, 5) : '10:00');
      setEndTime(event.end_time ? event.end_time.slice(0, 5) : '12:00');
      setIsAllDay(event.is_all_day || false);
      setVenue(event.venue || '');
      setMode(event.mode || 'offline');
      setOrganizerName(event.organizer_name || '');
      setSpeakerGuestDetails(event.speaker_guest_details || '');
      setDescription(event.description || '');
      setTargetAudience(event.target_audience || 'all_students');
      setIsMandatory(event.is_mandatory ?? true);
      setRegistrationLink(event.registration_link || '');
      setStatus(event.status || 'scheduled');
      setPosterUrl(event.poster_url || '');
      setPosterFilename(event.poster_filename || '');
    } else {
      setTitle('');
      setEventCategory('guest_lecture');
      setProgramId('');
      setBatchId('');
      setDivisionId('');
      const today = new Date().toISOString().split('T')[0];
      setStartDate(today);
      setEndDate(today);
      setStartTime('10:00');
      setEndTime('12:00');
      setIsAllDay(false);
      setVenue('');
      setMode('offline');
      setOrganizerName('');
      setSpeakerGuestDetails('');
      setDescription('');
      setTargetAudience('all_students');
      setIsMandatory(true);
      setRegistrationLink('');
      setStatus('scheduled');
      setPosterUrl('');
      setPosterFilename('');
    }
    setErrorMsg(null);
  }, [event, isOpen]);

  // Filter batches based on selected program
  const filteredBatches = programId
    ? batches.filter((b) => b.program_id === programId)
    : batches;

  // Filter divisions based on selected batch
  const filteredDivisions = batchId
    ? divisions.filter((d) => d.batch_id === batchId)
    : divisions;

  if (!isOpen) return null;

  const handlePosterFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setErrorMsg('Creative file size must be less than 15MB.');
      return;
    }

    setIsUploadingPoster(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/academic-events/upload-poster', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.data?.file_url) {
        setPosterUrl(res.data.data.file_url);
        setPosterFilename(res.data.data.file_name || file.name);
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to upload creative image.');
    } finally {
      setIsUploadingPoster(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Event title is required.');
      return;
    }
    if (!startDate) {
      setErrorMsg('Start date is required.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      const payload = {
        title: title.trim(),
        event_category: eventCategory,
        program_id: programId || null,
        batch_id: batchId || null,
        division_id: divisionId || null,
        start_date: startDate,
        end_date: endDate || startDate,
        start_time: isAllDay ? null : (startTime ? startTime + ':00' : null),
        end_time: isAllDay ? null : (endTime ? endTime + ':00' : null),
        is_all_day: isAllDay,
        venue: venue.trim() || null,
        mode,
        organizer_name: organizerName.trim() || null,
        speaker_guest_details: speakerGuestDetails.trim() || null,
        description: description.trim() || null,
        target_audience: targetAudience || 'all_students',
        is_mandatory: isMandatory,
        registration_link: registrationLink.trim() || null,
        status,
        poster_url: posterUrl || null,
        poster_filename: posterFilename || null,
        notify_students: notifyStudents,
      };

      if (isEditing && event) {
        await api.put(`/academic-events/${event.id}`, payload);
      } else {
        await api.post('/academic-events', payload);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to save event. Please check inputs.');
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass = "w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium text-xs outline-none focus:border-slate-400";
  const selectClass = "w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium text-xs outline-none cursor-pointer focus:border-slate-400";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {isEditing ? 'Edit Academic Event' : 'Schedule Academic Event'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          {/* Event Title */}
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Event Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. CXO Masterclass, Mid-Term Exams, Capstone Viva"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Category & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Category *
              </label>
              <select
                value={eventCategory}
                onChange={(e) => setEventCategory(e.target.value)}
                className={selectClass}
              >
                {EVENT_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={selectClass}
              >
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="postponed">Postponed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Program, Batch, Division */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Program (Optional)
              </label>
              <select
                value={programId}
                onChange={(e) => {
                  setProgramId(e.target.value);
                  setBatchId('');
                  setDivisionId('');
                }}
                className={selectClass}
              >
                <option value="">All Programs</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Batch (Optional)
              </label>
              <select
                value={batchId}
                onChange={(e) => {
                  setBatchId(e.target.value);
                  setDivisionId('');
                }}
                className={selectClass}
              >
                <option value="">All Batches</option>
                {filteredBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Division (Optional)
              </label>
              <select
                value={divisionId}
                onChange={(e) => setDivisionId(e.target.value)}
                className={selectClass}
              >
                <option value="">All Divisions</option>
                {filteredDivisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dates & Timing */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Start Date *
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (!endDate || endDate < e.target.value) {
                    setEndDate(e.target.value);
                  }
                }}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                End Date (Optional)
              </label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isAllDayToggle"
              checked={isAllDay}
              onChange={(e) => setIsAllDay(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <label htmlFor="isAllDayToggle" className="font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
              All-Day Event
            </label>
          </div>

          {!isAllDay && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {/* Mode & Venue */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Delivery Mode
              </label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className={selectClass}
              >
                <option value="offline">Offline (In-Person)</option>
                <option value="online">Online (Virtual)</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Venue / Room
              </label>
              <SearchableVenueSelect
                value={venue}
                onChange={(val) => setVenue(val)}
                placeholder="Select or search classroom / lab / hall"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Meeting Link (Optional)
            </label>
            <input
              type="url"
              placeholder="https://..."
              value={registrationLink}
              onChange={(e) => setRegistrationLink(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Speaker & Organizer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Speaker / Guest (Optional)
              </label>
              <input
                type="text"
                placeholder="Guest speaker or resource person"
                value={speakerGuestDetails}
                onChange={(e) => setSpeakerGuestDetails(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Organizer (Optional)
              </label>
              <input
                type="text"
                placeholder="Department or coordinator"
                value={organizerName}
                onChange={(e) => setOrganizerName(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Audience
              </label>
              <select
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className={selectClass}
              >
                <option value="all_students">All Students in Scope</option>
                <option value="batch_only">Selected Batch Only</option>
                <option value="faculty_only">Faculty Only</option>
                <option value="open_to_all">Open to All Campus</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="isMandatoryToggle"
                checked={isMandatory}
                onChange={(e) => setIsMandatory(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <label htmlFor="isMandatoryToggle" className="font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                Mandatory Attendance
              </label>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description / Agenda (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="Event details, schedule, or instructions..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Event Creative (Optional) */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="block font-semibold text-slate-700 dark:text-slate-300">
              Event Creative (Optional)
            </label>
            <p className="text-[11px] text-slate-500">
              Upload event creative if any (PNG, JPG, WEBP up to 15MB)
            </p>

            {posterUrl ? (
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div
                    onClick={() => setShowPosterPreview(true)}
                    className="h-14 w-20 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-black/10 cursor-pointer shrink-0"
                  >
                    <img
                      src={posterUrl.startsWith('http') ? posterUrl : `${api.defaults.baseURL || ''}${posterUrl}`}
                      alt="Event Creative"
                      className="h-full w-full object-cover"
                      onError={(e: any) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                  <div className="truncate">
                    <p className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate">
                      {posterFilename || 'Event Creative'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowPosterPreview(true)}
                      className="text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1 mt-0.5"
                    >
                      <Eye className="h-3 w-3" /> View Preview
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setPosterUrl('');
                    setPosterFilename('');
                  }}
                  className="text-xs text-rose-500 hover:text-rose-700 font-semibold p-1 shrink-0 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-4 text-center">
                <input
                  type="file"
                  id="posterUploadInput"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,application/pdf"
                  onChange={handlePosterFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="posterUploadInput"
                  className="cursor-pointer flex flex-col items-center justify-center space-y-1.5"
                >
                  <UploadCloud className="h-5 w-5 text-slate-400" />
                  <span className="font-semibold text-xs text-slate-700 dark:text-slate-300 hover:underline">
                    {isUploadingPoster ? 'Uploading creative...' : 'Choose image file'}
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Email Notification Option for New Events */}
          {!isEditing && (
            <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-800/50 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyStudents}
                onChange={(e) => setNotifyStudents(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300 cursor-pointer"
              />
              <div className="text-xs space-y-0.5">
                <span className="font-bold text-slate-900 dark:text-white">
                  Notify targeted students via official email on schedule
                </span>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                  Automatically sends announcement emails with date, timings, venue & creative banner to targeted cohort.
                </p>
              </div>
            </label>
          )}

          {/* Lightbox Modal Preview */}
          {showPosterPreview && posterUrl && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
              onClick={() => setShowPosterPreview(false)}
            >
              <div
                className="relative max-w-2xl w-full bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                    {posterFilename || 'Event Creative'}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPosterPreview(false)}
                    className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="p-4 bg-slate-950 flex items-center justify-center max-h-[70vh] overflow-auto">
                  <img
                    src={posterUrl.startsWith('http') ? posterUrl : `${api.defaults.baseURL || ''}${posterUrl}`}
                    alt="Event Creative"
                    className="max-h-[65vh] w-auto object-contain rounded-lg shadow-lg"
                  />
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-500 text-[11px]">Event Creative</span>
                  <a
                    href={posterUrl.startsWith('http') ? posterUrl : `${api.defaults.baseURL || ''}${posterUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold text-xs transition-colors flex items-center gap-1.5"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Open Full Image
                  </a>
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={handleSubmit}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold text-xs disabled:opacity-50 transition-colors cursor-pointer"
          >
            {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Schedule Event'}
          </button>
        </div>
      </div>
    </div>
  );
};
