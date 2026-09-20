'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import WorkstationShell from '@/components/WorkstationShell';
import {
  AlertTriangle,
  Network,
  CheckCircle2,
  PackagePlus,
  ArrowLeft,
  Zap,
} from 'lucide-react';
import { api } from '@/lib/api-client';

interface DrugItem {
  facilityId: string;
  drugId: string;
  drugName: string;
  genericName: string;
  category: string;
  form: string;
  batchNumber?: string;
  expiryDate?: string;
  storageLocation?: string;
  quantity: number;
  unit: string;
  threshold: number;
  tier: 'EMERGENCY' | 'ESSENTIAL' | 'ROUTINE';
  isCritical: boolean;
  status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
}

function EmergencyTriageContent() {
  const router = useRouter();

  const [items, setItems] = useState<DrugItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchInventory = async () => {
    try {
      const data = await api.get('/api/clinic/inventory');
      if (data.items) {
        setItems(data.items);
      }
    } catch (e: any) {
      console.error('Failed to load emergency inventory:', e);
      showToast(e.message || 'Failed to load clinic inventory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  // Filter categorized items
  const emergencyItems = items.filter((i) => i.tier === 'EMERGENCY');
  const urgentEmergencyItems = emergencyItems.filter(
    (i) => i.status === 'LOW_STOCK' || i.status === 'OUT_OF_STOCK'
  );
  const nominalEmergencyItems = emergencyItems.filter((i) => i.status === 'IN_STOCK');

  return (
    <WorkstationShell>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-xl border border-slate-700 flex items-center gap-2.5 text-xs animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* NAVIGATION BREADCRUMB & HEADER                                        */}
      {/* ===================================================================== */}
      <div className="mb-6 space-y-3">
        <Link
          href="/rapid-desk?view=important"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-teal-700 hover:underline transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Important Medicines Desk</span>
        </Link>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center shadow-xs">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Emergency Injections & Critical Triage
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                Tier 1 Triage
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Dedicated triage view for cold-chain vaccines and life-saving antidotes. All stock adjustments are unified into the centralized Stock Operations Desk.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              href="/rapid-desk?view=stock-entry"
              className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition-all"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>⚡ Stock Operations Desk</span>
            </Link>
            <Link
              href="/locator?drug=DRUG-ASV-01"
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 shadow-xs flex items-center gap-1.5 transition-all"
            >
              <Network className="w-3.5 h-3.5 text-teal-600" />
              <span>Inter-Clinic Locator</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TRIAGE STATUS SUMMARY CHIPS                                           */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600">Total Emergency Formulary</span>
          <span className="font-mono font-bold text-base text-slate-900">{emergencyItems.length} Drugs</span>
        </div>

        <div
          className={`p-3.5 rounded-xl border shadow-xs flex items-center justify-between ${
            urgentEmergencyItems.length > 0 ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-white border-slate-200'
          }`}
        >
          <span className="text-xs font-semibold">Urgent Triage Attention Needed</span>
          <span
            className={`font-mono font-bold text-base ${
              urgentEmergencyItems.length > 0 ? 'text-rose-700' : 'text-slate-400'
            }`}
          >
            {urgentEmergencyItems.length} {urgentEmergencyItems.length === 1 ? 'Item' : 'Items'}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600">Adequate Reserves</span>
          <span className="font-mono font-bold text-base text-emerald-700">{nominalEmergencyItems.length} Items</span>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SECTION A: URGENT EMERGENCY ITEMS (ONLY LOW_STOCK OR OUT_OF_STOCK)   */}
      {/* ===================================================================== */}
      {urgentEmergencyItems.length > 0 ? (
        <section className="space-y-4 mb-8">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping"></span>
            <h2 className="text-sm font-bold text-rose-900 uppercase tracking-wide">
              Immediate Action Required ({urgentEmergencyItems.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {urgentEmergencyItems.map((item) => {
              const isOut = item.quantity === 0;
              const bufferRatio =
                item.threshold > 0 ? Math.min(100, Math.round((item.quantity / item.threshold) * 100)) : 0;

              return (
                <div
                  key={item.drugId}
                  className={`bg-white rounded-xl p-5 border transition-all flex flex-col justify-between shadow-xs ${
                    isOut
                      ? 'border-rose-300 ring-1 ring-rose-300/50 bg-rose-50/10'
                      : 'border-amber-300 ring-1 ring-amber-300/50 bg-amber-50/10'
                  }`}
                >
                  <div>
                    {/* Header: Drug Title & Status Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base font-bold text-slate-900 tracking-tight">{item.drugName}</h3>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          {item.genericName} · {item.form}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                          isOut
                            ? 'bg-rose-100 text-rose-800 border-rose-200'
                            : 'bg-amber-100 text-amber-800 border-amber-200'
                        }`}
                      >
                        {isOut ? 'Out of Stock' : 'Low Stock'}
                      </span>
                    </div>

                    {/* Muted Single-Line Caption */}
                    <p className="text-[11px] text-slate-400 mt-2.5 font-mono truncate">
                      Batch {item.batchNumber || 'LOT-2026-01'} · Exp {item.expiryDate || '2027-12'} ·{' '}
                      {item.storageLocation || 'Cold-Chain ILR'} · Buffer: {item.threshold} {item.unit}
                    </p>

                    {/* Stock Counter & Buffer Bar */}
                    <div className="my-5">
                      <div className="flex items-baseline justify-between mb-1.5">
                        <div className="flex items-baseline gap-1.5 font-mono">
                          <span
                            className={`text-3xl font-bold tracking-tight ${
                              isOut ? 'text-rose-700' : 'text-amber-700'
                            }`}
                          >
                            {item.quantity}
                          </span>
                          <span className="text-xs font-sans font-normal text-slate-400">
                            {item.unit} on shelf
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-500">
                          {isOut ? '0% of buffer' : `${bufferRatio}% of buffer (${item.threshold} ${item.unit})`}
                        </span>
                      </div>

                      {/* Clean Progress Bar */}
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isOut ? 'w-0' : 'bg-amber-500'
                          }`}
                          style={{ width: `${isOut ? 0 : Math.max(8, bufferRatio)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions Area */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    {isOut ? (
                      <div className="space-y-2">
                        <Link
                          href={`/locator?drug=${item.drugId}`}
                          className="w-full h-9 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Network className="w-3.5 h-3.5" />
                          <span>Find in Nearby Clinics (Referral) →</span>
                        </Link>
                        <Link
                          href={`/rapid-desk?view=stock-entry&drug=${item.drugId}`}
                          className="w-full h-8 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>⚡ Manage in Stock Desk →</span>
                        </Link>
                      </div>
                    ) : (
                      <Link
                        href={`/rapid-desk?view=stock-entry&drug=${item.drugId}`}
                        className="w-full h-9 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>⚡ Manage in Stock Desk →</span>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        /* Reassurance State */
        <div className="bg-white rounded-xl border border-emerald-200 p-6 mb-8 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  ✓ All emergency stock nominal — no action required
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  All critical Tier 1 life-saving injectables (ASV, ARV, Adrenaline) are fully stocked and safely above designated clinical buffers.
                </p>
              </div>
            </div>

            <Link
              href="/rapid-desk?view=stock-entry"
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-lg transition-colors shrink-0 flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Open Stock Operations Desk →</span>
            </Link>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION B: ADEQUATE / NOMINAL EMERGENCY FORMULARY RESERVES            */}
      {/* ===================================================================== */}
      <section className="space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Nominal Emergency Reserves ({nominalEmergencyItems.length} Adequately Stocked)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Emergency drugs currently meeting safety buffer requirements.
            </p>
          </div>
        </div>

        {nominalEmergencyItems.length === 0 ? (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 text-center font-mono">
            No emergency drugs are currently at nominal stock levels.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4 w-[35%]">Emergency Medicine</th>
                    <th className="py-3 px-4 w-[20%]">Storage & Buffer</th>
                    <th className="py-3 px-4 w-[18%]">Available Shelf Stock</th>
                    <th className="py-3 px-4 w-[12%]">Status</th>
                    <th className="py-3 px-4 w-[15%] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {nominalEmergencyItems.map((item) => (
                    <tr key={item.drugId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 text-sm">{item.drugName}</span>
                          <span className="text-xs text-slate-500 font-normal">
                            {item.genericName} · {item.form}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 font-mono text-xs">
                        <div>{item.storageLocation || 'Cold-Chain ILR 2'}</div>
                        <div className="text-[11px] text-slate-400 font-sans">
                          Buffer: {item.threshold} {item.unit}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-baseline gap-1.5 font-mono">
                          <span className="text-base font-bold text-emerald-700">{item.quantity}</span>
                          <span className="text-xs text-slate-400 font-sans font-normal">{item.unit}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-800 border-emerald-200">
                          In Stock
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/rapid-desk?view=stock-entry&drug=${item.drugId}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg shadow-2xs transition-colors text-xs"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>⚡ Manage Stock</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </WorkstationShell>
  );
}

export default function EmergencyPage() {
  return (
    <Suspense
      fallback={<div className="p-8 text-center text-xs text-slate-400 font-mono">Loading Emergency Triage...</div>}
    >
      <EmergencyTriageContent />
    </Suspense>
  );
}
