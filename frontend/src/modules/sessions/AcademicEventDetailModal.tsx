import React, { useState } from 'react';
import {
  X,
  Calendar,
  Clock,
  MapPin,
  Users,
  Mic,
  ExternalLink,
  Mail,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Maximize2,
  Building2,
} from 'lucide-react';
import { api } from '../../lib/api';
import { AcademicEventItem, EVENT_CATEGORIES } from './AcademicEventModal';
import { StatusBadge } from '../../components/StatusBadge';

interface AcademicEventDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: AcademicEventItem | null;
  canManage?: boolean;
  onEdit?: (event: AcademicEventItem) => void;
  onDelete?: (event: AcademicEventItem) => void;
}

export const AcademicEventDetailModal: React.FC<AcademicEventDetailModalProps> = ({
  isOpen,
  onClose,
  event,
  canManage = false,
  onEdit,
  onDelete,
}) => {
  const [isNotifying, setIsNotifying] = useState(false);
  const [notifySuccessMsg, setNotifySuccessMsg] = useState<string | null>(null);
  const [notifyErrorMsg, setNotifyErrorMsg] = useState<string | null>(null);
  const [showFullPoster, setShowFullPoster] = useState(false);

  if (!isOpen || !event) return null;

  const catConfig = EVENT_CATEGORIES.find((c) => c.value === event.event_category);
  const catLabel = catConfig?.label || (event.event_category || 'other').replace(/_/g, ' ');
  const isMultiDay = event.end_date && event.end_date !== event.start_date;

  const posterFullUrl = event.poster_url
    ? event.poster_url.startsWith('http')
      ? event.poster_url
      : `${api.defaults.baseURL || ''}${event.poster_url}`
    : null;

  const handleNotifyStudents = async () => {
    try {
      setIsNotifying(true);
      setNotifyErrorMsg(null);
      setNotifySuccessMsg(null);

      const res = await api.post(`/academic-events/${event.id}/notify`);
      const data = res.data?.data;
      setNotifySuccessMsg(data?.message || 'Notification emails dispatched successfully to targeted students!');
    } catch (err: any) {
      setNotifyErrorMsg(err.response?.data?.detail || 'Failed to dispatch email notifications.');
    } finally {
      setIsNotifying(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col animate-fadeIn"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60">
                {catLabel}
              </span>
              <StatusBadge status={event.status} />
              <span
                className={`px-2 py-0.5 rounded-md font-bold uppercase text-[10px] ${
                  event.is_mandatory
                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}
              >
                {event.is_mandatory ? 'Mandatory' : 'Optional'}
              </span>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="overflow-y-auto p-6 space-y-6 flex-1">
            {/* Creative Banner Preview */}
            {posterFullUrl && (
              <div className="relative group overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-950 shadow-md">
                <img
                  src={posterFullUrl}
                  alt={event.title}
                  className="w-full max-h-72 object-cover object-center cursor-pointer group-hover:scale-102 transition-transform duration-300"
                  onClick={() => setShowFullPoster(true)}
                />
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <button
                    onClick={() => setShowFullPoster(true)}
                    className="px-3 py-1.5 rounded-xl bg-black/60 hover:bg-black/80 backdrop-blur-md text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg cursor-pointer transition-colors"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                    <span>View Creative</span>
                  </button>
                </div>
              </div>
            )}

            {/* Title & Headline */}
            <div>
              <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white leading-tight">
                {event.title}
              </h2>
              {event.organizer_name && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                  <Building2 className="h-3.5 w-3.5 text-slate-400" />
                  <span>Organized by <strong>{event.organizer_name}</strong></span>
                </div>
              )}
            </div>

            {/* Feedback Banners for Notification */}
            {notifySuccessMsg && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-3 text-emerald-800 dark:text-emerald-200 text-xs font-medium">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                <div className="flex-1">{notifySuccessMsg}</div>
                <button
                  onClick={() => setNotifySuccessMsg(null)}
                  className="text-emerald-600 hover:text-emerald-800 text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            )}

            {notifyErrorMsg && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-start gap-3 text-rose-800 dark:text-rose-200 text-xs font-medium">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                <div className="flex-1">{notifyErrorMsg}</div>
                <button
                  onClick={() => setNotifyErrorMsg(null)}
                  className="text-rose-600 hover:text-rose-800 text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Schedule & Venue Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 shrink-0">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Date</p>
                  <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                    {event.start_date}
                    {isMultiDay ? ` to ${event.end_date}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 shrink-0">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Time</p>
                  <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                    {event.is_all_day
                      ? 'All Day Milestone'
                      : `${event.start_time ? event.start_time.slice(0, 5) : '09:00'} - ${event.end_time ? event.end_time.slice(0, 5) : '17:00'}`}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 shrink-0">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Venue & Mode</p>
                  <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                    {event.venue || 'Campus / Auditorium'}{' '}
                    <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase">
                      ({event.mode || 'offline'})
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 shrink-0">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Target Scope</p>
                  <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                    {event.batch_name || event.program_name || 'All Batches (Institute-Wide)'}
                  </p>
                </div>
              </div>
            </div>

            {/* Speaker / Guest Details */}
            {event.speaker_guest_details && (
              <div className="p-4 rounded-2xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/50 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-700 dark:text-purple-300">
                  <Mic className="h-4 w-4" />
                  <span>Speaker / Chief Guest</span>
                </div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white pl-6">
                  {event.speaker_guest_details}
                </p>
              </div>
            )}

            {/* Full Event Description & Agenda */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                About the Event
              </h4>
              <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                {event.description || 'No detailed description provided for this academic event.'}
              </div>
            </div>

            {/* Registration / External Link */}
            {event.registration_link && (
              <div className="pt-2">
                <a
                  href={event.registration_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-600/25 transition-all cursor-pointer"
                >
                  <span>Join / Open Registration Link</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Close
            </button>

            {canManage && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleNotifyStudents}
                  disabled={isNotifying}
                  className="px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
                  title="Dispatch email notification to targeted student cohort"
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span>{isNotifying ? 'Sending...' : 'Notify Students'}</span>
                </button>

                {onEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onEdit(event);
                    }}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                    title="Edit Event"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                )}

                {onDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onDelete(event);
                    }}
                    className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 transition-colors cursor-pointer"
                    title="Delete Event"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full-Screen Poster Lightbox if requested */}
      {showFullPoster && posterFullUrl && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fadeIn"
          onClick={() => setShowFullPoster(false)}
        >
          <div
            className="relative max-w-4xl w-full bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950">
              <h3 className="font-bold text-sm text-white truncate max-w-md">
                {event.title} — Creative Banner
              </h3>
              <button
                type="button"
                onClick={() => setShowFullPoster(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 flex items-center justify-center max-h-[75vh] overflow-auto bg-black">
              <img
                src={posterFullUrl}
                alt={event.title}
                className="max-h-[70vh] w-auto object-contain rounded-xl"
              />
            </div>

            <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {event.poster_filename || 'Event Creative'}
              </span>
              <a
                href={posterFullUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-xl bg-white text-slate-900 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Open in New Tab</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
