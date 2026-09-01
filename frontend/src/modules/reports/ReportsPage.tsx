import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, DollarSign, MapPin, BookOpen, ShieldCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../../components/Card';
import { DataTable, Column } from '../../components/DataTable';
import { useRoleAccess } from '../../lib/useRoleAccess';

export const ReportsPage: React.FC = () => {
  const { isAdmin, isCoordinator, isFinance, isApprover, isAuditor } = useRoleAccess();
  
  // Decide default tab
  const canSeeRemuneration = isAdmin || isFinance || isApprover || isAuditor;
  const canSeeVenue = isAdmin || isCoordinator || isAuditor;
  const canSeeAudit = isAdmin || isAuditor;
  
  const defaultTab = canSeeRemuneration ? 'remuneration' : canSeeVenue ? 'venue' : 'syllabus';
  const [reportType, setReportType] = useState<'remuneration' | 'venue' | 'syllabus' | 'audit'>(defaultTab);

  const { data: remData, isLoading: remLoading } = useQuery({
    queryKey: ['report_remuneration'],
    queryFn: async () => {
      const res = await api.get('/reports/remuneration-statement');
      return res.data.data;
    },
    enabled: reportType === 'remuneration',
  });

  const { data: venueData, isLoading: venueLoading } = useQuery({
    queryKey: ['report_venue'],
    queryFn: async () => {
      const res = await api.get('/reports/venue-utilization');
      return res.data.data;
    },
    enabled: reportType === 'venue',
  });

  const { data: sylData, isLoading: sylLoading } = useQuery({
    queryKey: ['report_syllabus'],
    queryFn: async () => {
      const res = await api.get('/reports/syllabus-completion');
      return res.data.data;
    },
    enabled: reportType === 'syllabus',
  });

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['report_audit'],
    queryFn: async () => {
      const res = await api.get('/reports/audit-trail');
      return res.data.data;
    },
    enabled: reportType === 'audit',
  });

  const handleExport = (type: string) => {
    window.open(`/api/v1/reports/export?report_type=${type}`, '_blank');
  };

  const remColumns: Column<any>[] = [
    { header: 'Faculty Name', accessor: 'faculty_name', className: 'font-semibold text-slate-900 dark:text-slate-100' },
    { header: 'Organization', accessor: 'organization', className: 'text-slate-600 dark:text-slate-400' },
    { header: 'Topic Delivered', accessor: 'topic_delivered', className: 'text-slate-700 dark:text-slate-300' },
    { header: 'Hours', accessor: 'hours', className: 'text-cyan-600 dark:text-cyan-400 font-mono font-semibold' },
    { header: 'Rate', accessor: 'rate', className: 'text-slate-600 dark:text-slate-400' },
    { header: 'Net Payable', accessor: (r) => `₹${r.net_payable?.toLocaleString()}`, className: 'font-bold text-emerald-600 dark:text-emerald-400' },
  ];

  const venueColumns: Column<any>[] = [
    { header: 'Venue / Facility', accessor: 'venue', className: 'font-semibold text-slate-900 dark:text-slate-100' },
    { header: 'Total Sessions', accessor: 'total_sessions', className: 'text-slate-700 dark:text-slate-300' },
    { header: 'Total Hours', accessor: (r) => `${r.total_hours}h`, className: 'font-mono text-cyan-600 dark:text-cyan-400 font-semibold' },
    {
      header: 'Utilization %',
      accessor: (r) => (
        <div className="flex items-center space-x-2">
          <div className="w-24 bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-cyan-500 h-full rounded-full"
              style={{ width: `${Math.min(100, r.utilization_percentage)}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{r.utilization_percentage}%</span>
        </div>
      ),
    },
  ];

  const sylColumns: Column<any>[] = [
    { header: 'Code', accessor: 'subject_code', className: 'font-mono text-indigo-600 dark:text-indigo-400 font-semibold' },
    { header: 'Subject Name', accessor: 'subject_name', className: 'font-semibold text-slate-900 dark:text-slate-100' },
    { header: 'Topics Delivered', accessor: (r) => `${r.completed_topics} / ${r.total_topics}`, className: 'text-slate-700 dark:text-slate-300 font-mono' },
    {
      header: 'Completion Index',
      accessor: (r) => (
        <span className={`text-xs font-bold ${r.completion_index >= 75 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
          {r.completion_index}%
        </span>
      ),
    },
  ];

  const auditColumns: Column<any>[] = [
    { header: 'Agent Name', accessor: 'agent_name', className: 'font-mono text-cyan-600 dark:text-cyan-400 font-semibold' },
    { header: 'Triggered By', accessor: 'triggered_by', className: 'capitalize text-slate-600 dark:text-slate-400' },
    { header: 'Action Taken', accessor: 'action_taken', className: 'text-slate-700 dark:text-slate-300' },
    { header: 'Timestamp', accessor: 'timestamp', className: 'font-mono text-xs text-slate-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight gradient-text">Analytical Reporting & Audit Trail</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Pre-aggregated institutional intelligence, remuneration statements, venue metrics, and audit logs.
          </p>
        </div>

        <button
          onClick={() => handleExport(reportType)}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm transition-all"
        >
          <Download className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
          <span>Export CSV Report</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-6 overflow-x-auto">
        {canSeeRemuneration && (
          <button
            onClick={() => setReportType('remuneration')}
            className={`pb-3 text-sm font-semibold border-b-2 flex items-center space-x-2 whitespace-nowrap transition-colors ${
              reportType === 'remuneration' ? 'border-cyan-500 text-cyan-700 dark:border-cyan-400 dark:text-cyan-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <DollarSign className="h-4 w-4" />
            <span>Remuneration Statement</span>
          </button>
        )}
        {canSeeVenue && (
          <button
            onClick={() => setReportType('venue')}
            className={`pb-3 text-sm font-semibold border-b-2 flex items-center space-x-2 whitespace-nowrap transition-colors ${
              reportType === 'venue' ? 'border-cyan-500 text-cyan-700 dark:border-cyan-400 dark:text-cyan-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <MapPin className="h-4 w-4" />
            <span>Venue Utilization</span>
          </button>
        )}
        <button
          onClick={() => setReportType('syllabus')}
          className={`pb-3 text-sm font-semibold border-b-2 flex items-center space-x-2 whitespace-nowrap transition-colors ${
            reportType === 'syllabus' ? 'border-cyan-500 text-cyan-700 dark:border-cyan-400 dark:text-cyan-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          <span>Syllabus Index</span>
        </button>
        {canSeeAudit && (
          <button
            onClick={() => setReportType('audit')}
            className={`pb-3 text-sm font-semibold border-b-2 flex items-center space-x-2 whitespace-nowrap transition-colors ${
              reportType === 'audit' ? 'border-cyan-500 text-cyan-700 dark:border-cyan-400 dark:text-cyan-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Activity & Audit Trail</span>
          </button>
        )}
      </div>

      {reportType === 'remuneration' && (
        <Card title="Faculty Remuneration Statement">
          {remLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-4">Loading remuneration report...</p>
          ) : (
            <DataTable columns={remColumns} data={remData || []} keyExtractor={(r) => r.faculty_name + r.topic_delivered} emptyMessage="No remuneration records found." />
          )}
        </Card>
      )}

      {reportType === 'venue' && (
        <Card title="Venue Utilization Matrix">
          {venueLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-4">Loading venue utilization...</p>
          ) : (
            <DataTable columns={venueColumns} data={venueData || []} keyExtractor={(r) => r.venue} emptyMessage="No venue data recorded yet." />
          )}
        </Card>
      )}

      {reportType === 'syllabus' && (
        <Card title="Academic Syllabus Completion Index">
          {sylLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-4">Loading syllabus index...</p>
          ) : (
            <DataTable columns={sylColumns} data={sylData || []} keyExtractor={(r) => r.subject_code} emptyMessage="No subject syllabus data recorded." />
          )}
        </Card>
      )}

      {reportType === 'audit' && (
        <Card title="System Activity & Automated Action Log">
          {auditLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-4">Loading activity log...</p>
          ) : (
            <DataTable columns={auditColumns} data={auditData || []} keyExtractor={(r) => r.id} emptyMessage="No automated system activity recorded." />
          )}
        </Card>
      )}
    </div>
  );
};
