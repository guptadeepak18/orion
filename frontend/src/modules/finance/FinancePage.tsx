import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileCheck, CheckCircle2, AlertTriangle, Sparkles, CreditCard,
  Calculator, DollarSign, ShieldAlert, Eye, X, Building, User, Receipt, Search
} from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../../components/Card';
import { DataTable, Column } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { useRoleAccess } from '../../lib/useRoleAccess';

export interface ExternalBilling {
  id: string;
  session_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  duration_hours: number;
  venue: string;
  session_status: string;
  program_name?: string;
  batch_name?: string;
  subject_code?: string;
  subject_name?: string;
  topic_delivered: string;

  // Faculty Details
  faculty_id: string;
  faculty_name: string;
  faculty_designation?: string;
  organization?: string;
  email: string;
  phone?: string;
  is_gst_applicable: boolean;
  pan?: string;
  gst_number?: string;
  bank_name?: string;
  bank_account_no?: string;
  bank_ifsc?: string;

  // Remuneration & Billing Details
  rate_type: string;
  rate_value: number;
  gross_amount: number;
  tax_percent: number;
  tax_amount: number;
  net_payable: number;
  is_anomaly_flagged: boolean;
  anomaly_reason?: string;

  // Status
  approval_status: string;
  payment_status: string;
  invoice_number?: string;
  invoice_status?: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  total_amount: number;
  gst_amount: number;
  ocr_mismatch: boolean;
  submitted_at: string;
}

interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  status: string;
  payment_reference?: string;
}

export const FinancePage: React.FC = () => {
  const { canManageFinance } = useRoleAccess();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'remuneration' | 'invoices' | 'payments'>(
    urlTab === 'invoices' || urlTab === 'payments' ? urlTab : 'remuneration'
  );
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedBilling, setSelectedBilling] = useState<ExternalBilling | null>(null);

  const [extractedAmt, setExtractedAmt] = useState('10620');
  const [refNo] = useState('TXN-10293847');

  const queryClient = useQueryClient();

  const handleTabChange = (t: 'remuneration' | 'invoices' | 'payments') => {
    setActiveTab(t);
    const next = new URLSearchParams(searchParams);
    next.set('tab', t);
    setSearchParams(next);
  };

  const updateUrlModal = (m: string | null, params: Record<string, string | undefined> = {}) => {
    const next = new URLSearchParams(searchParams);
    if (!m) {
      next.delete('modal');
      next.delete('id');
    } else {
      next.set('modal', m);
      Object.entries(params).forEach(([k, v]) => {
        if (v) next.set(k, v);
        else next.delete(k);
      });
    }
    setSearchParams(next);
  };

  const handleOpenBilling = (b: ExternalBilling, syncUrl = true) => {
    setSelectedBilling(b);
    if (syncUrl) updateUrlModal('voucherDossier', { id: b.id });
  };

  const handleCloseBilling = (syncUrl = true) => {
    setSelectedBilling(null);
    if (syncUrl) updateUrlModal(null);
  };

  const handleOpenInvoice = (inv: Invoice, syncUrl = true) => {
    setSelectedInvoice(inv);
    if (syncUrl) updateUrlModal('verifyOcr', { id: inv.id });
  };

  const handleCloseInvoice = (syncUrl = true) => {
    setSelectedInvoice(null);
    if (syncUrl) updateUrlModal(null);
  };

  // Queries
  const { data: billings = [] } = useQuery({
    queryKey: ['remuneration_billings'],
    queryFn: async () => {
      const res = await api.get('/remuneration/billings');
      return res.data.data as ExternalBilling[];
    },
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const res = await api.get('/invoices');
      return res.data.data as Invoice[];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      const res = await api.get('/payments');
      return res.data.data as Payment[];
    },
  });

  // URL sync effect
  const urlModal = searchParams.get('modal');
  const urlId = searchParams.get('id');

  useEffect(() => {
    if (urlTab && (urlTab === 'remuneration' || urlTab === 'invoices' || urlTab === 'payments') && urlTab !== activeTab) {
      setActiveTab(urlTab);
    }
  }, [urlTab]);

  useEffect(() => {
    if (!urlModal) {
      if (selectedBilling) handleCloseBilling(false);
      if (selectedInvoice) handleCloseInvoice(false);
      return;
    }

    if (urlId) {
      if (urlModal === 'voucherDossier' && billings.length > 0) {
        const found = billings.find((b: ExternalBilling) => b.id === urlId);
        if (found && (!selectedBilling || selectedBilling.id !== found.id)) {
          handleOpenBilling(found, false);
        }
      } else if (urlModal === 'verifyOcr' && invoices.length > 0) {
        const found = invoices.find((i: Invoice) => i.id === urlId);
        if (found && (!selectedInvoice || selectedInvoice.id !== found.id)) {
          handleOpenInvoice(found, false);
        }
      }
    }
  }, [urlModal, urlId, billings, invoices]);

  const verifyMutation = useMutation({
    mutationFn: async ({ id, file_path, extracted_amount }: any) => {
      const res = await api.post(`/invoices/${id}/verify`, { file_path, extracted_amount });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      handleCloseInvoice();
    },
  });

  const releaseMutation = useMutation({
    mutationFn: async ({ id, reference_no }: any) => {
      const res = await api.post(`/payments/${id}/release`, { reference_no });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });

  // Calculate Aggregates
  const totalNetPayable = billings.reduce((sum, b) => sum + b.net_payable, 0);
  const totalGross = billings.reduce((sum, b) => sum + b.gross_amount, 0);
  const totalTax = billings.reduce((sum, b) => sum + b.tax_amount, 0);
  const anomalyCount = billings.filter((b) => b.is_anomaly_flagged).length;

  const filteredBillings = billings.filter((b) =>
    (b.faculty_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.subject_name || b.subject_code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.organization || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.invoice_number || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Billing Columns
  const billingColumns: Column<ExternalBilling>[] = [
    {
      header: 'External Faculty & Org',
      accessor: (r) => (
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-xl bg-cyan-100 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 flex items-center justify-center font-bold text-cyan-600 dark:text-cyan-400 text-sm">
            {r.faculty_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100">{r.faculty_name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{r.organization || 'Independent Expert'}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Completed Class & Date',
      accessor: (r) => (
        <div className="text-xs">
          <p className="font-semibold text-slate-800 dark:text-slate-200">
            {r.subject_code ? `${r.subject_code} · ` : ''}{r.subject_name || r.topic_delivered}
          </p>
          <p className="text-slate-500 dark:text-slate-400">
            {r.session_date} ({r.start_time}–{r.end_time}) · {r.venue}
          </p>
        </div>
      ),
    },
    {
      header: 'Profile Cost Rate',
      accessor: (r) => (
        <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
          ₹{r.rate_value.toLocaleString()} / {r.rate_type.replace('_', ' ')}
        </span>
      ),
    },
    {
      header: 'Billing Breakdown (inc. GST)',
      accessor: (r) => (
        <div className="text-xs">
          <p className="font-bold text-emerald-600 dark:text-emerald-400">
            ₹{r.net_payable.toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
            Gross ₹{r.gross_amount.toLocaleString()} + GST ₹{r.tax_amount.toLocaleString()} ({r.duration_hours}h)
          </p>
        </div>
      ),
    },
    {
      header: 'Status & Anomaly',
      accessor: (r) => (
        <div className="space-y-1">
          <StatusBadge status={r.payment_status === 'invoiced' ? 'active' : r.payment_status} label={r.payment_status.toUpperCase()} />
          {r.is_anomaly_flagged && (
            <span className="flex items-center space-x-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-500/30">
              <AlertTriangle className="h-3 w-3" />
              <span>Anomaly</span>
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Actions',
      accessor: (r) => (
        <button
          onClick={() => handleOpenBilling(r)}
          className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 transition-colors"
        >
          <Eye className="h-3.5 w-3.5" />
          <span>Voucher</span>
        </button>
      ),
    },
  ];

  const invoiceColumns: Column<Invoice>[] = [
    { header: 'Invoice #', accessor: 'invoice_number', className: 'font-mono text-cyan-600 dark:text-cyan-400 font-semibold' },
    { header: 'Total (inc. GST)', accessor: (r) => `₹${r.total_amount.toLocaleString()}`, className: 'font-bold text-slate-900 dark:text-slate-100' },
    { header: 'GST Amount', accessor: (r) => `₹${r.gst_amount.toLocaleString()}`, className: 'text-slate-600 dark:text-slate-300' },
    {
      header: 'OCR Check',
      accessor: (r) =>
        r.ocr_mismatch ? (
          <span className="flex items-center space-x-1 text-xs font-semibold text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-500/10 dark:border-rose-500/30 px-2 py-0.5 rounded-md border">
            <AlertTriangle className="h-3 w-3" />
            <span>Mismatch</span>
          </span>
        ) : (
          <span className="flex items-center space-x-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/30 px-2 py-0.5 rounded-md border">
            <CheckCircle2 className="h-3 w-3" />
            <span>Matched</span>
          </span>
        ),
    },
    { header: 'Status', accessor: (r) => <StatusBadge status={r.status} /> },
    {
      header: 'Action',
      accessor: (r) =>
        canManageFinance ? (
          r.status === 'draft' ? (
            <button
              onClick={() => handleOpenInvoice(r)}
              className="px-3 py-1 text-xs font-semibold rounded-lg bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 transition-colors"
            >
              Verify OCR & Upload
            </button>
          ) : (
            <span className="text-xs text-slate-500">Verified</span>
          )
        ) : (
          <span className="text-xs text-slate-400">View only</span>
        ),
    },
  ];

  const paymentColumns: Column<Payment>[] = [
    { header: 'Payment ID', accessor: (r) => r.id.substring(0, 8), className: 'font-mono text-indigo-600 dark:text-indigo-400 font-semibold' },
    { header: 'Amount', accessor: (r) => `₹${r.amount.toLocaleString()}`, className: 'font-bold text-slate-900 dark:text-slate-100' },
    { header: 'Reference #', accessor: (r) => r.payment_reference || 'Pending Release', className: 'font-mono text-xs text-slate-600 dark:text-slate-300' },
    { header: 'Status', accessor: (r) => <StatusBadge status={r.status} /> },
    {
      header: 'Action',
      accessor: (r) =>
        canManageFinance ? (
          r.status === 'pending' ? (
            <button
              onClick={() => releaseMutation.mutate({ id: r.id, reference_no: refNo })}
              className="px-3 py-1 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors"
            >
              Release Payment
            </button>
          ) : (
            <span className="text-xs text-slate-500">Released</span>
          )
        ) : (
          <span className="text-xs text-slate-400">View only</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight gradient-text">External Faculty Remuneration & Finance Hub</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Automated remuneration billing based on agreed fee structures, GST calculations, voucher verifications, and disbursements.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl glass-card border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Class Billing</p>
            <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">₹{totalNetPayable.toLocaleString()}</p>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">Net payable across completed sessions</p>
        </div>

        <div className="p-4 rounded-2xl glass-card border border-cyan-200 dark:border-cyan-500/30 bg-cyan-50/40 dark:bg-cyan-950/20">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Gross Remuneration</p>
            <Calculator className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">₹{totalGross.toLocaleString()}</p>
          <p className="text-[11px] text-cyan-600 dark:text-cyan-400 mt-0.5 font-medium">Calculated base teaching fees</p>
        </div>

        <div className="p-4 rounded-2xl glass-card border border-purple-200 dark:border-purple-500/30 bg-purple-50/40 dark:bg-purple-950/20">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">GST Tax (18%)</p>
            <Receipt className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">₹{totalTax.toLocaleString()}</p>
          <p className="text-[11px] text-purple-600 dark:text-purple-400 mt-0.5 font-medium">Accumulated GST tax component</p>
        </div>

        <div className="p-4 rounded-2xl glass-card border border-amber-200 dark:border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/20">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Flagged Sessions</p>
            <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">{anomalyCount}</p>
          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5 font-medium">Sessions requiring rate or policy verification</p>
        </div>
      </div>

      {/* Automation Status Banner */}
      <div className="p-4 rounded-2xl glass-card border border-cyan-200 dark:border-cyan-500/30 bg-cyan-50/50 dark:bg-cyan-950/20 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-cyan-100 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-200">Automatic Payment Calculation Active</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Completed external sessions automatically compute gross remuneration, 18% GST, and draft payment vouchers using the faculty's profile rate structure.
            </p>
          </div>
        </div>
        <StatusBadge status="active" label="Active" />
      </div>

      {/* Navigation Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-200 dark:border-slate-800 gap-4 pb-1">
        <div className="flex space-x-6 w-full sm:w-auto">
          <button
            onClick={() => handleTabChange('remuneration')}
            className={`pb-3 text-sm font-semibold border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'remuneration'
                ? 'border-cyan-500 text-cyan-700 dark:border-cyan-400 dark:text-cyan-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Calculator className="h-4 w-4" />
            <span>Class Remuneration & Billing ({billings.length})</span>
          </button>
          <button
            onClick={() => handleTabChange('invoices')}
            className={`pb-3 text-sm font-semibold border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'invoices'
                ? 'border-cyan-500 text-cyan-700 dark:border-cyan-400 dark:text-cyan-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <FileCheck className="h-4 w-4" />
            <span>Invoices & Vouchers ({invoices.length})</span>
          </button>
          <button
            onClick={() => handleTabChange('payments')}
            className={`pb-3 text-sm font-semibold border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'payments'
                ? 'border-cyan-500 text-cyan-700 dark:border-cyan-400 dark:text-cyan-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <CreditCard className="h-4 w-4" />
            <span>Payments & Disbursements ({payments.length})</span>
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search external faculty, classes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>
      </div>

      {/* Remuneration View */}
      {activeTab === 'remuneration' && (
        <Card title={`External Faculty Class Billing Ledger (${filteredBillings.length})`}>
          <DataTable<ExternalBilling>
            data={filteredBillings}
            columns={billingColumns}
            keyExtractor={(r) => r.id}
            emptyMessage="No external faculty billing records found for completed sessions."
          />
        </Card>
      )}

      {/* Invoices View */}
      {activeTab === 'invoices' && (
        <Card title={`Automated & Draft Invoices Vault (${invoices.length})`}>
          <DataTable<Invoice>
            data={invoices}
            columns={invoiceColumns}
            keyExtractor={(r) => r.id}
            emptyMessage="No invoices generated yet."
          />
        </Card>
      )}

      {/* Payments View */}
      {activeTab === 'payments' && (
        <Card title={`Disbursements & Settlements (${payments.length})`}>
          <DataTable<Payment>
            data={payments}
            columns={paymentColumns}
            keyExtractor={(r) => r.id}
            emptyMessage="No payment disbursements recorded yet."
          />
        </Card>
      )}

      {/* Voucher Modal */}
      {selectedBilling && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="glass-panel w-full max-w-xl rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="h-9 w-9 rounded-xl bg-cyan-100 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">External Faculty Session Remuneration Voucher</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Voucher Reference #{selectedBilling.id.substring(0, 8).toUpperCase()}</p>
                </div>
              </div>
              <button
                onClick={() => handleCloseBilling()}
                className="p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 my-4 text-xs">
              {/* Faculty Profile Card */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <User className="h-4 w-4 text-cyan-500" /> Faculty Details
                </h4>
                <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                  <p><span className="font-semibold text-slate-500">Name:</span> {selectedBilling.faculty_name}</p>
                  <p><span className="font-semibold text-slate-500">Org:</span> {selectedBilling.organization || 'Independent'}</p>
                  <p><span className="font-semibold text-slate-500">Email:</span> {selectedBilling.email}</p>
                  <p><span className="font-semibold text-slate-500">Phone:</span> {selectedBilling.phone || 'N/A'}</p>
                  <p><span className="font-semibold text-slate-500">PAN:</span> {selectedBilling.pan || 'N/A'}</p>
                  <p><span className="font-semibold text-slate-500">GSTIN:</span> {selectedBilling.gst_number || 'N/A'}</p>
                </div>
              </div>

              {/* Class & Subject Details */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Building className="h-4 w-4 text-indigo-500" /> Session Particulars
                </h4>
                <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                  <p><span className="font-semibold text-slate-500">Subject:</span> {selectedBilling.subject_name || selectedBilling.topic_delivered}</p>
                  <p><span className="font-semibold text-slate-500">Batch:</span> {selectedBilling.batch_name || 'PGDM'}</p>
                  <p><span className="font-semibold text-slate-500">Class Date:</span> {selectedBilling.session_date}</p>
                  <p><span className="font-semibold text-slate-500">Time:</span> {selectedBilling.start_time} – {selectedBilling.end_time}</p>
                  <p><span className="font-semibold text-slate-500">Venue:</span> {selectedBilling.venue}</p>
                  <p><span className="font-semibold text-slate-500">Status:</span> {selectedBilling.session_status}</p>
                </div>
              </div>

              {/* Cost Calculation Breakdown */}
              <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200 dark:border-emerald-500/30 space-y-3">
                <h4 className="font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Calculator className="h-4 w-4 text-emerald-500" /> Remuneration Calculation Breakdown
                </h4>
                <div className="space-y-1.5 text-slate-700 dark:text-slate-300">
                  <div className="flex justify-between py-1 border-b border-emerald-100 dark:border-emerald-500/20">
                    <span>Faculty Profile Cost Structure:</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">
                      ₹{selectedBilling.rate_value.toLocaleString()} / {selectedBilling.rate_type.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-emerald-100 dark:border-emerald-500/20">
                    <span>Base Gross Remuneration:</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">₹{selectedBilling.gross_amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-emerald-100 dark:border-emerald-500/20">
                    <span>GST Status:</span>
                    <span className={`font-mono font-semibold ${selectedBilling.is_gst_applicable ? 'text-purple-600 dark:text-purple-400' : 'text-slate-500'}`}>
                      {selectedBilling.is_gst_applicable ? `+ ₹${selectedBilling.tax_amount.toLocaleString()} (GST ${selectedBilling.tax_percent}%)` : 'GST Exempt / Non-GST (₹0 tax)'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                    <span>Total Net Billing / Payable:</span>
                    <span className="font-mono text-lg">₹{selectedBilling.net_payable.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => handleCloseBilling()}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                Close Voucher
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verify OCR Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Verify Invoice #{selectedInvoice.invoice_number}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
              Expected Total: <span className="text-emerald-600 dark:text-emerald-400 font-bold">₹{selectedInvoice.total_amount.toLocaleString()}</span>
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                verifyMutation.mutate({
                  id: selectedInvoice.id,
                  file_path: '/uploads/invoice_doc.pdf',
                  extracted_amount: parseFloat(extractedAmt),
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  OCR Extracted Amount (₹)
                </label>
                <input
                  type="number"
                  required
                  value={extractedAmt}
                  onChange={(e) => setExtractedAmt(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => handleCloseInvoice()}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyMutation.isPending}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-cyan-600 hover:bg-cyan-700 text-white disabled:opacity-50"
                >
                  {verifyMutation.isPending ? 'Verifying...' : 'Run OCR Verification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
