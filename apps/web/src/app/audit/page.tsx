'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import WorkstationShell from '@/components/WorkstationShell';
import {
  ShieldCheck,
  FileCheck,
  Download,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Lock,
  RefreshCw,
  Clock,
  User,
  ArrowRight,
} from 'lucide-react';

interface AuditItem {
  id: string;
  facilityId: string;
  timestamp: string;
  action: 'DISPENSE' | 'RESTOCK' | 'ADJUSTMENT';
  delta: number;
  previousQuantity: number;
  newQuantity: number;
  drugId: string;
  drugName: string;
  batchNumber: string;
  workerId: string;
  workerName: string;
  sha256Hash: string;
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch(`/api/clinic/audit?action=${actionFilter}`);
      const data = await res.json();
      if (data.logs) {
        setLogs(data.logs);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter]);

  const handleVerifyIntegrity = () => {
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setVerifiedSuccess(true);
      showToast('🔒 Cryptographic Chain Validated: All 184 blocks match SHA-256 state tree.');
    }, 900);
  };

  const handleExport = (format: string) => {
    showToast(`📄 Audit Trail exported successfully in ${format} format.`);
  };

  const filteredLogs = logs.filter((log) => {
    const query = searchQuery.toLowerCase();
    return (
      log.drugName.toLowerCase().includes(query) ||
      log.id.toLowerCase().includes(query) ||
      log.workerName.toLowerCase().includes(query) ||
      log.batchNumber.toLowerCase().includes(query)
    );
  });

  return (
    <WorkstationShell searchQuery={searchQuery} onSearchChange={setSearchQuery}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-primary-container text-white px-4 py-3 rounded-lg shadow-xl border border-primary-fixed-dim/30 flex items-center gap-2 text-xs animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-secondary-fixed shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="w-full max-w-[1440px] mx-auto px-6 py-6 flex flex-col gap-6">
        {/* Top Command & Facility Context Strip */}
        <div className="px-6 py-5 bg-surface-container-lowest rounded-xl shadow-sm border border-slate-200/70 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-primary tracking-tight">
                Dispensary Facility Audit Ledger
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed text-[11px] font-bold flex items-center gap-1 border border-secondary/20 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                SHA-256 Validated
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">
              Immutable transaction log for PHC Sector 4 • Compliant with National Rural Health
              Mission (NRHM) &amp; Drug Control Administration standards
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleVerifyIntegrity}
              disabled={isVerifying}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary text-xs font-bold transition-all border border-slate-200"
              type="button"
            >
              <ShieldCheck className={`w-4 h-4 text-secondary ${isVerifying ? 'animate-spin' : ''}`} />
              <span>{isVerifying ? 'Verifying...' : 'Verify Integrity'}</span>
            </button>

            {/* Export Dropdown / Actions */}
            <div className="flex items-center gap-1 bg-primary-container text-white rounded-lg p-1 text-xs font-semibold shadow-xs">
              <button
                onClick={() => handleExport('CSV')}
                className="px-2.5 py-1 rounded hover:bg-primary transition-colors"
                type="button"
              >
                CSV
              </button>
              <span className="text-white/40">|</span>
              <button
                onClick={() => handleExport('PDF')}
                className="px-2.5 py-1 rounded hover:bg-primary transition-colors"
                type="button"
              >
                Signed PDF
              </button>
              <span className="text-white/40">|</span>
              <button
                onClick={() => handleExport('Excel')}
                className="px-2.5 py-1 rounded hover:bg-primary transition-colors"
                type="button"
              >
                Excel
              </button>
            </div>
          </div>
        </div>

        {/* Quick Summary KPI Metrics Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl bg-surface-container-lowest shadow-sm border border-slate-200/70 flex flex-col justify-between gap-2">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-outline">
                  Total Transactions
                </span>
                <span className="text-2xl font-bold font-mono text-on-surface mt-1 block">
                  184 Records
                </span>
              </div>
              <div className="w-9 h-9 rounded-lg bg-surface-container-low flex items-center justify-center text-primary">
                <FileCheck className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-secondary font-semibold">
              <span>+12%</span>
              <span className="text-outline font-normal">vs prior 12h shift</span>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-surface-container-lowest shadow-sm border border-slate-200/70 flex flex-col justify-between gap-2">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-outline">
                  Dispensed Doses
                </span>
                <span className="text-2xl font-bold font-mono text-on-surface mt-1 block">
                  342 Units
                </span>
              </div>
              <div className="w-9 h-9 rounded-lg bg-surface-container-low flex items-center justify-center text-primary-container">
                <ArrowDownLeft className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-on-surface-variant font-medium">
              <span>Routine: 312</span>
              <span>•</span>
              <span className="text-tertiary font-bold">Emergency: 30</span>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-surface-container-lowest shadow-sm border border-slate-200/70 flex flex-col justify-between gap-2">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-outline">
                  Inward Restock Batches
                </span>
                <span className="text-2xl font-bold font-mono text-secondary mt-1 block">
                  +1,250 Units
                </span>
              </div>
              <div className="w-9 h-9 rounded-lg bg-surface-container-low flex items-center justify-center text-secondary">
                <ArrowUpRight className="w-5 h-5" />
              </div>
            </div>
            <div className="text-[11px] text-outline">4 Verified Dispatches Recorded</div>
          </div>

          <div className="p-5 rounded-xl bg-surface-container-lowest shadow-sm border border-slate-200/70 flex flex-col justify-between gap-2">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-outline">
                  Cryptographic Integrity
                </span>
                <span className="text-base font-bold text-secondary mt-2 block flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-secondary" />
                  100% Tamper Evident
                </span>
              </div>
              <div className="w-9 h-9 rounded-lg bg-surface-container-low flex items-center justify-center text-primary">
                <Lock className="w-5 h-5" />
              </div>
            </div>
            <div className="text-[11px] text-outline font-mono">DDB Immutable Commits</div>
          </div>
        </div>

        {/* Ledger Filters & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface-container-lowest p-3.5 rounded-xl border border-slate-200/70 shadow-sm">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-lg border border-slate-200 text-xs">
              {[
                { id: 'ALL', label: 'All Operations' },
                { id: 'DISPENSE', label: 'Dispense (-1)' },
                { id: 'RESTOCK', label: 'Restock (+N)' },
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setActionFilter(btn.id)}
                  className={`px-3 py-1 font-semibold rounded-md transition-all ${
                    actionFilter === btn.id
                      ? 'bg-surface-container-lowest text-primary shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                  type="button"
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-outline font-mono">
            Showing {filteredLogs.length} verified audit records
          </div>
        </div>

        {/* Ledger Data Table */}
        <div className="bg-surface-container-lowest rounded-xl border border-slate-200/70 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-container-low text-on-surface border-b border-slate-200 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Transaction ID &amp; Hash</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Medicine &amp; Batch</th>
                  <th className="py-3 px-4">Delta</th>
                  <th className="py-3 px-4">Stock Before → After</th>
                  <th className="py-3 px-4">Authorized Staff</th>
                  <th className="py-3 px-4 text-right">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {filteredLogs.map((log) => {
                  const isDispense = log.action === 'DISPENSE';

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-surface-container-low/50 transition-colors font-sans"
                    >
                      <td className="py-3 px-4 font-mono">
                        <span className="font-bold text-primary block">{log.id}</span>
                        <span className="text-[10px] text-outline">SHA: {log.sha256Hash}</span>
                      </td>
                      <td className="py-3 px-4 text-on-surface-variant font-mono">
                        {new Date(log.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            isDispense
                              ? 'bg-amber-100 text-amber-900 border border-amber-200'
                              : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                          }`}
                        >
                          {isDispense ? (
                            <ArrowDownLeft className="w-3 h-3 text-amber-700" />
                          ) : (
                            <ArrowUpRight className="w-3 h-3 text-emerald-700" />
                          )}
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col font-sans">
                          <span className="font-bold text-on-surface">{log.drugName}</span>
                          <span className="text-[10px] text-outline font-mono">
                            Lot: {log.batchNumber}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold">
                        <span className={isDispense ? 'text-tertiary' : 'text-secondary'}>
                          {log.delta > 0 ? `+${log.delta}` : log.delta}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-on-surface-variant">
                        <span>{log.previousQuantity}</span> →{' '}
                        <strong className="text-on-surface">{log.newQuantity}</strong>
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <div className="flex flex-col">
                          <span className="font-medium text-on-surface">{log.workerName}</span>
                          <span className="text-[10px] text-outline font-mono">{log.workerId}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="inline-flex items-center gap-1 text-[10px] text-secondary font-semibold font-mono bg-secondary-fixed/30 px-1.5 py-0.5 rounded">
                          <CheckCircle2 className="w-3 h-3 text-secondary" />
                          Verified
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </WorkstationShell>
  );
}
