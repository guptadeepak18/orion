import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar as CalendarIcon, Clock, MapPin } from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../../components/Card';
import { StatusBadge } from '../../components/StatusBadge';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  venue: string;
  mode: string;
  faculty_type: string;
  status: string;
}

export const CalendarPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<'agenda' | 'month'>('agenda');

  const { data: events, isLoading } = useQuery({
    queryKey: ['calendar_events'],
    queryFn: async () => {
      const res = await api.get('/calendar/events');
      return res.data.data as CalendarEvent[];
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight gradient-text">Master Calendar & Schedule</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Consolidated academic schedule views across programs, batches, venues, and faculty engagements.
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setViewMode('agenda')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'agenda' ? 'bg-cyan-600 dark:bg-cyan-500 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Agenda View
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'month' ? 'bg-cyan-600 dark:bg-cyan-500 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Month Grid
          </button>
        </div>
      </div>

      {/* Content */}
      <Card title="Scheduled Academic Events">
        {isLoading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-4">Loading calendar events...</p>
        ) : !events || events.length === 0 ? (
          <div className="py-12 text-center">
            <CalendarIcon className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-600 mb-3" />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-300">No scheduled calendar events found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <div
                key={event.id}
                className="p-4 rounded-xl glass-card border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 flex items-center justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-sm"
              >
                <div className="flex items-center space-x-4">
                  <div className="h-12 w-12 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 flex flex-col items-center justify-center text-cyan-700 dark:text-cyan-400">
                    <span className="text-xs font-bold uppercase">{event.date.split('-')[1]}</span>
                    <span className="text-base font-bold leading-tight">{event.date.split('-')[2]}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{event.title}</h4>
                    <div className="flex items-center space-x-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                      <span className="flex items-center space-x-1">
                        <Clock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                        <span>{event.start_time} - {event.end_time}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                        <span>{event.venue}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">{event.mode}</span>
                  <StatusBadge status={event.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
