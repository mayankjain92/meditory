'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import WorkstationShell from '@/components/WorkstationShell';
import {
  AlertTriangle,
  MinusCircle,
  Plus,
  Network,
  CheckCircle2,
  Refrigerator,
  ShieldCheck,
  Flame,
  ArrowRight,
  Filter,
  Check,
  X,
  Clock,
  Radio,
  Share2,
  PackagePlus,
  FileCheck,
  Boxes,
  Truck,
  Building2,
} from 'lucide-react';

interface DrugItem {
  facilityId: string;
  drugId: string;
  drugName: string;
  genericName: string;
  category: string;
  form: string;
  batchNumber: string;
  expiryDate: string;
  storageLocation: string;
  quantity: number;
  unit: string;
  threshold: number;
  tier: 'EMERGENCY' | 'ESSENTIAL' | 'ROUTINE';
  isCritical: boolean;
  status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
}

function RapidDeskContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEmergencyMode = searchParams.get('mode') === 'emergency';

  const [items, setItems] = useState<DrugItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Inward Stock Intake Modal State
  const [showInwardModal, setShowInwardModal] = useState(false);
  const [inwardDrugId, setInwardDrugId] = useState('DRUG-ARV-01');
  const [inwardQty, setInwardQty] = useState(50);
  const [inwardBatch, setInwardBatch] = useState('BATCH-2026-99');
  const [inwardExpiry, setInwardExpiry] = useState('2027-12');
  const [inwardStorage, setInwardStorage] = useState('ILR Unit 2 (3.4°C)');
  const [inwardChallan, setInwardChallan] = useState('DEPOT-RAIGAD-CH-4819');
  const [isSubmittingInward, setIsSubmittingInward] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchInventory = async () => {
    try {
      const res = await fetch('/api/clinic/inventory');
      const data = await res.json();
      if (data.items) {
        setItems(data.items);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  // 1-Tap Dispense (-1) with Optimistic Latency
  const handleDispense = async (drugId: string) => {
    const targetItem = items.find((i) => i.drugId === drugId);
    if (!targetItem || targetItem.quantity <= 0) {
      showToast(`⚠️ Cannot dispense: Zero vials in stock!`);
      return;
    }

    // 0ms Optimistic UI update
    setItems((prev) =>
      prev.map((item) => {
        if (item.drugId === drugId && item.quantity > 0) {
          const next = item.quantity - 1;
          const status = next === 0 ? 'OUT_OF_STOCK' : next <= item.threshold ? 'LOW_STOCK' : 'IN_STOCK';
          return { ...item, quantity: next, status };
        }
        return item;
      })
    );

    showToast(`✅ Dispensed 1 unit of ${targetItem.drugName}. Audit recorded.`);

    try {
      const res = await fetch('/api/clinic/dispense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drugId, delta: -1 }),
      });
      const result = await res.json();
      if (result.alarmTriggered) {
        showToast(`🚨 CloudWatch Metric Alarm: ${result.drugName} dropped below safety buffer (${result.newQuantity} left)!`);
      }
    } catch (err) {
      console.error('Dispense commit error:', err);
    }
  };

  // Quick Restock (+10, +50, +100)
  const handleQuickRestock = async (drugId: string, qty: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.drugId === drugId) {
          const next = item.quantity + qty;
          const status = next <= item.threshold ? 'LOW_STOCK' : 'IN_STOCK';
          return { ...item, quantity: next, status };
        }
        return item;
      })
    );

    const targetItem = items.find((i) => i.drugId === drugId);
    showToast(`📦 Restocked +${qty} units of ${targetItem?.drugName || drugId}.`);

    try {
      await fetch('/api/clinic/restock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drugId, quantity: qty }),
      });
    } catch (err) {
      console.error('Restock commit error:', err);
    }
  };

  // Full Inward Stock Intake Commit
  const handleInwardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inwardDrugId || inwardQty <= 0) {
      showToast('⚠️ Please specify a valid medicine and positive quantity.');
      return;
    }

    setIsSubmittingInward(true);

    const selectedDrug = items.find((i) => i.drugId === inwardDrugId);

    // Optimistic Update
    setItems((prev) =>
      prev.map((item) => {
        if (item.drugId === inwardDrugId) {
          const next = item.quantity + inwardQty;
          const status = next <= item.threshold ? 'LOW_STOCK' : 'IN_STOCK';
          return {
            ...item,
            quantity: next,
            status,
            batchNumber: inwardBatch.trim() || item.batchNumber,
            storageLocation: inwardStorage || item.storageLocation,
          };
        }
        return item;
      })
    );

    try {
      await fetch('/api/clinic/restock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drugId: inwardDrugId,
          quantity: inwardQty,
          batchNumber: inwardBatch,
          expiryDate: inwardExpiry,
          storageLocation: inwardStorage,
          challanNumber: inwardChallan,
        }),
      });

      showToast(`📦 Inward Stock Committed: +${inwardQty} ${selectedDrug?.unit || 'units'} of ${selectedDrug?.drugName} added to shelf.`);
      setShowInwardModal(false);
    } catch (err) {
      console.error('Inward stock commit error:', err);
      showToast('Failed to record inward stock.');
    } finally {
      setIsSubmittingInward(false);
    }
  };

  // Open modal with target drug pre-selected
  const openInwardModalFor = (drugId: string) => {
    const item = items.find((i) => i.drugId === drugId);
    setInwardDrugId(drugId);
    if (item) {
      setInwardBatch(`LOT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
      setInwardStorage(item.storageLocation);
    }
    setShowInwardModal(true);
  };

  // Filter Items
  const emergencyItems = items.filter((i) => i.tier === 'EMERGENCY');
  const filteredLedgerItems = items.filter((i) => {
    const matchesSearch =
      i.drugName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.genericName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.batchNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.category.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (selectedCategory === 'ALL') return true;
    if (selectedCategory === 'CRITICAL') return i.isCritical || i.status === 'LOW_STOCK';
    if (selectedCategory === 'COLD_CHAIN') return i.storageLocation.includes('ILR') || i.storageLocation.includes('Cold');
    if (selectedCategory === 'MATERNAL') return i.category.includes('Maternal');
    if (selectedCategory === 'NCD') return i.category.includes('NCD');
    return true;
  });

  return (
    <WorkstationShell
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onEmergencyClick={() => {
        const el = document.getElementById('emergency-section');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }}
    >
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-primary-container text-white px-4 py-3 rounded-lg shadow-xl border border-primary-fixed-dim/30 flex items-center gap-2 text-xs animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-secondary-fixed shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* INWARD STOCK INTAKE & RESTOCK MODAL */}
      {/* ========================================================================= */}
      {showInwardModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest max-w-lg w-full rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="bg-primary-container p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PackagePlus className="w-5 h-5 text-secondary-fixed" />
                <div>
                  <h3 className="font-bold text-sm">Enter Inward Medicine Stock (Direct Intake)</h3>
                  <p className="text-[11px] text-on-primary-container">
                    Receive warehouse dispatch or record physical shelf delivery into PHC Sector 4
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowInwardModal(false)}
                className="text-white/80 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleInwardSubmit} className="p-6 space-y-4 text-xs text-on-surface">
              {/* Medicine Select */}
              <div className="space-y-1">
                <label className="font-bold uppercase text-[10px] tracking-wide text-on-surface">
                  Select Medicine to Restock
                </label>
                <select
                  value={inwardDrugId}
                  onChange={(e) => setInwardDrugId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-surface-container-low border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-container/20"
                >
                  {items.map((item) => (
                    <option key={item.drugId} value={item.drugId}>
                      {item.drugName} (Current Physical Stock: {item.quantity} {item.unit})
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity Input + Quick Pills */}
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <label className="font-bold uppercase text-[10px] tracking-wide text-on-surface">
                    Inward Quantity Received
                  </label>
                  <span className="text-[11px] text-outline">
                    Current: <strong>{items.find((i) => i.drugId === inwardDrugId)?.quantity}</strong> {items.find((i) => i.drugId === inwardDrugId)?.unit}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    required
                    value={inwardQty}
                    onChange={(e) => setInwardQty(Math.max(1, parseInt(e.target.value, 10) || 0))}
                    className="w-full h-11 px-3 rounded-lg bg-surface-container-low border border-slate-200 text-base font-mono font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary-container/20"
                    placeholder="Enter quantity received (e.g. 50)"
                  />
                  <span className="text-xs font-semibold text-outline uppercase shrink-0">
                    {items.find((i) => i.drugId === inwardDrugId)?.unit || 'Units'}
                  </span>
                </div>

                {/* Quick Add Pills */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-outline font-medium">Quick Presets:</span>
                  {[10, 25, 50, 100, 250, 500].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setInwardQty(preset)}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border transition-colors ${
                        inwardQty === preset
                          ? 'bg-primary-container text-white border-primary-container'
                          : 'bg-white text-primary border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      +{preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Batch Number & Expiry Date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold uppercase text-[10px] tracking-wide text-on-surface">
                    Batch / Lot Number
                  </label>
                  <input
                    type="text"
                    required
                    value={inwardBatch}
                    onChange={(e) => setInwardBatch(e.target.value)}
                    placeholder="e.g., ASV-2026-99A"
                    className="w-full h-10 px-3 rounded-lg bg-surface-container-low border border-slate-200 text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-primary-container/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold uppercase text-[10px] tracking-wide text-on-surface">
                    Expiry Date
                  </label>
                  <input
                    type="month"
                    required
                    value={inwardExpiry}
                    onChange={(e) => setInwardExpiry(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-surface-container-low border border-slate-200 text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-primary-container/20"
                  />
                </div>
              </div>

              {/* Storage Location & Dispatch Challan */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold uppercase text-[10px] tracking-wide text-on-surface">
                    Storage Shelf / Cold ILR
                  </label>
                  <input
                    type="text"
                    value={inwardStorage}
                    onChange={(e) => setInwardStorage(e.target.value)}
                    placeholder="e.g., ILR Unit 1 (3.1°C) or Shelf B"
                    className="w-full h-10 px-3 rounded-lg bg-surface-container-low border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-primary-container/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold uppercase text-[10px] tracking-wide text-on-surface">
                    Depot Invoice / Challan #
                  </label>
                  <input
                    type="text"
                    value={inwardChallan}
                    onChange={(e) => setInwardChallan(e.target.value)}
                    placeholder="e.g., DEPOT-RAIGAD-CH-4819"
                    className="w-full h-10 px-3 rounded-lg bg-surface-container-low border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary-container/20"
                  />
                </div>
              </div>

              {/* Verified Attribution Note */}
              <div className="p-3 bg-surface-container-low rounded-lg border border-slate-200 text-[11px] text-on-surface-variant flex items-center justify-between">
                <span>
                  Receiving Officer: <strong>Dr. Rahul Sharma</strong> (Staff ID: USR-ALIBAG-01)
                </span>
                <span className="text-secondary font-semibold flex items-center gap-1 font-mono">
                  <ShieldCheck className="w-3.5 h-3.5" /> Immutable Audit
                </span>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInwardModal(false)}
                  className="px-4 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingInward}
                  className="px-6 py-2.5 rounded-lg bg-primary-container hover:bg-primary text-white text-xs font-bold shadow-sm flex items-center gap-2 disabled:opacity-50"
                >
                  <PackagePlus className="w-4 h-4 text-secondary-fixed" />
                  <span>
                    {isSubmittingInward ? 'Committing...' : `Commit Inward Stock (+${inwardQty} Units)`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1. TOP EMERGENCY BUFFER ALERT BANNER */}
      {!alertDismissed && (
        <div className="w-full bg-tertiary-container text-on-tertiary px-6 py-3.5 shadow-sm border-b border-tertiary">
          <div className="max-w-[1440px] mx-auto flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded bg-white/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-tertiary-fixed animate-pulse" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-white/15 text-tertiary-fixed px-2 py-0.5 rounded">
                    Critical Stock Alert
                  </span>
                  <span className="font-mono text-[11px] text-tertiary-fixed-dim">
                    ID: REQ-ARV-0941-EMERGENCY
                  </span>
                </div>
                <p className="text-xs text-on-tertiary leading-snug mt-0.5">
                  <strong>Anti-Rabies Vaccine (ARV)</strong> is below safety buffer threshold (only{' '}
                  <strong>{items.find((i) => i.drugId === 'DRUG-ARV-01')?.quantity ?? 4} vials</strong>{' '}
                  remaining in Cold-Chain ILR 2). You can enter inward restock delivery or request an inter-clinic stock shift.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end lg:self-center shrink-0">
              {/* PRIMARY INWARD RESTOCK BUTTON IN ALERT BANNER */}
              <button
                onClick={() => openInwardModalFor('DRUG-ARV-01')}
                className="px-3.5 py-1.5 bg-secondary hover:bg-secondary-fixed-dim text-white text-xs font-bold rounded shadow-sm flex items-center gap-1.5 transition-all"
                type="button"
              >
                <PackagePlus className="w-4 h-4 text-white" />
                <span>+ Enter Inward Restock</span>
              </button>

              <Link
                href="/locator?drug=DRUG-ARV-01"
                className="px-3.5 py-1.5 bg-white text-tertiary hover:bg-slate-100 text-xs font-bold rounded shadow-sm flex items-center gap-1.5 transition-all"
              >
                <Network className="w-4 h-4" />
                <span>Inter-Clinic Transfer</span>
              </Link>
              <button
                onClick={() => setAlertDismissed(true)}
                className="px-3 py-1.5 bg-transparent text-on-tertiary hover:bg-white/10 text-xs font-semibold rounded transition-colors"
                type="button"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. MAIN WORKSPACE CONTAINER */}
      <div className="w-full max-w-[1440px] mx-auto px-6 py-6 flex flex-col gap-8">
        {/* SECTION 1: EMERGENCY PRIORITY SUPPLIES */}
        <section id="emergency-section" className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-secondary animate-ping"></div>
              <h2 className="text-lg font-bold text-primary tracking-tight">
                Emergency Priority Supplies
              </h2>
              <span className="text-outline font-mono text-xs hidden sm:inline">
                — Immediate Counter Dispensing &amp; Rapid Restock Buffer
              </span>
            </div>

            {/* ACTION TOOLBAR: ENTER STOCK INTAKE BUTTON */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => {
                  setInwardDrugId('DRUG-ARV-01');
                  setShowInwardModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-secondary text-white hover:bg-secondary-fixed-dim text-xs font-bold transition-all shadow-sm active:scale-95"
                type="button"
              >
                <PackagePlus className="w-4 h-4 text-white" />
                <span>+ Enter Inward Stock / Restock</span>
              </button>

              <div className="flex items-center gap-1.5 text-on-surface-variant text-[11px] bg-surface-container px-2.5 py-1 rounded font-medium border border-slate-200/50 hidden md:flex">
                <ShieldCheck className="w-3.5 h-3.5 text-secondary" />
                <span>WHO Cold-Chain (2–8°C)</span>
              </div>
            </div>
          </div>

          {/* 3 Rapid Action Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {emergencyItems.slice(0, 3).map((item) => {
              const isLow = item.status === 'LOW_STOCK';
              const isOut = item.quantity === 0;
              const percent = Math.min(100, Math.round((item.quantity / (item.threshold * 2.5)) * 100));

              return (
                <div
                  key={item.drugId}
                  className={`bg-surface-container-lowest rounded-xl p-5 shadow-sm border flex flex-col justify-between transition-all ${
                    isLow
                      ? 'border-tertiary/40 ring-1 ring-tertiary/20'
                      : 'border-slate-200/70 hover:shadow-md'
                  }`}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-[10px] text-outline uppercase font-semibold">
                          ATC: {item.drugId.includes('ASV') ? 'J06AA03 • ANTIDOTE' : item.drugId.includes('ARV') ? 'J07BG01 • BIOLOGICAL' : 'C01CA24 • RESUSCITATION'}
                        </span>
                        <h3 className="text-base font-bold text-on-surface leading-snug mt-0.5">
                          {item.drugName}
                        </h3>
                        <span className="text-xs text-on-surface-variant font-normal">
                          {item.form}
                        </span>
                      </div>
                      <span
                        className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${
                          isLow
                            ? 'bg-tertiary-fixed text-on-tertiary-fixed border border-tertiary/20'
                            : 'bg-secondary-fixed text-on-secondary-fixed border border-secondary/20'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isLow ? 'bg-tertiary animate-pulse' : 'bg-secondary'
                          }`}
                        ></span>
                        {item.status}
                      </span>
                    </div>

                    {/* Cold Chain / Batch Pill */}
                    <div className="bg-surface-container-low p-2.5 rounded-lg flex flex-col gap-1 mt-1 border border-slate-200/40 text-xs">
                      <div className="flex items-center justify-between text-on-surface-variant">
                        <span className="flex items-center gap-1 text-[11px]">
                          <Refrigerator className="w-3.5 h-3.5 text-primary" />
                          {item.storageLocation}
                        </span>
                        <span className="font-mono text-[10px] text-outline">
                          Batch: {item.batchNumber}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-outline">
                          Buffer Threshold: {item.threshold} {item.unit}
                        </span>
                        <span className={isLow ? 'text-tertiary font-bold' : 'text-secondary font-semibold'}>
                          Exp: {item.expiryDate}
                        </span>
                      </div>
                    </div>

                    {/* Stock Display Counter */}
                    <div
                      className={`flex items-baseline justify-between mt-1 px-3 py-2 rounded-lg ${
                        isLow ? 'bg-error-container/40' : 'bg-surface-container-low'
                      }`}
                    >
                      <span className="text-xs font-semibold text-on-surface-variant">
                        Physical Stock Level
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span
                          className={`text-2xl font-bold font-mono ${
                            isLow ? 'text-tertiary' : 'text-primary'
                          }`}
                        >
                          {item.quantity}
                        </span>
                        <span className="text-xs text-on-surface-variant font-medium">
                          {item.unit}
                        </span>
                      </div>
                    </div>

                    {/* Stock Level Progress Bar */}
                    <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isLow ? 'bg-tertiary' : 'bg-secondary'
                        }`}
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Restock & 1-Tap Dispense Action Bar */}
                  <div className="flex flex-col gap-2 mt-4 pt-3 border-t border-slate-200/60 bg-surface-container-low/40 -mx-5 -mb-5 p-5 rounded-b-xl">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => openInwardModalFor(item.drugId)}
                        className="text-secondary hover:text-secondary-fixed-dim text-xs font-bold flex items-center gap-1 hover:underline"
                        type="button"
                      >
                        <PackagePlus className="w-3.5 h-3.5" />
                        <span>+ Enter Inward Batch</span>
                      </button>

                      {/* Quick Restock Buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleQuickRestock(item.drugId, 10)}
                          className="px-2 py-0.5 bg-white hover:bg-slate-100 text-primary font-mono text-[11px] font-bold rounded border border-slate-200 shadow-2xs transition-colors"
                          title="Restock +10 units"
                          type="button"
                        >
                          +10
                        </button>
                        <button
                          onClick={() => handleQuickRestock(item.drugId, 50)}
                          className="px-2 py-0.5 bg-white hover:bg-slate-100 text-primary font-mono text-[11px] font-bold rounded border border-slate-200 shadow-2xs transition-colors"
                          title="Restock +50 units"
                          type="button"
                        >
                          +50
                        </button>
                        <button
                          onClick={() => handleQuickRestock(item.drugId, 100)}
                          className="px-2 py-0.5 bg-white hover:bg-slate-100 text-primary font-mono text-[11px] font-bold rounded border border-slate-200 shadow-2xs transition-colors"
                          title="Restock +100 units"
                          type="button"
                        >
                          +100
                        </button>
                      </div>
                    </div>

                    {/* Primary -1 Rapid Dispense Button */}
                    <button
                      onClick={() => handleDispense(item.drugId)}
                      disabled={isOut}
                      className="w-full h-10 bg-primary-container hover:bg-primary text-white text-xs font-bold rounded flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group"
                      type="button"
                    >
                      <MinusCircle className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                      <span>-1 Rapid Dispense</span>
                      <span className="text-[10px] opacity-70 font-mono">(&lt;10ms DDB Commit)</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 2: ESSENTIAL & ROUTINE MEDICINES LEDGER */}
        <section className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-on-surface tracking-tight">
                Dispensary Shelf Stock Ledger
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Primary healthcare dispensary formulary • Atomic conditional cloud updates
              </p>
            </div>

            {/* Category Filter Pills & Inward Button */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setInwardDrugId(items[0]?.drugId || 'DRUG-PCM-01');
                  setShowInwardModal(true);
                }}
                className="px-3 py-1 bg-secondary text-white text-xs font-bold rounded-md flex items-center gap-1 shadow-xs hover:bg-secondary-fixed-dim"
                type="button"
              >
                <PackagePlus className="w-3.5 h-3.5" />
                <span>+ Inward Delivery</span>
              </button>

              <div className="flex flex-wrap items-center gap-1 bg-surface-container-low p-1 rounded-lg border border-slate-200/50">
                {[
                  { id: 'ALL', label: `All (${items.length})` },
                  { id: 'CRITICAL', label: 'Critical / Low' },
                  { id: 'COLD_CHAIN', label: 'Cold-Chain' },
                  { id: 'MATERNAL', label: 'Maternal' },
                  { id: 'NCD', label: 'NCDs' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedCategory(tab.id)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                      selectedCategory === tab.id
                        ? 'bg-surface-container-lowest text-primary shadow-xs'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                    type="button"
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Ledger Data Table */}
          <div className="bg-surface-container-lowest rounded-xl border border-slate-200/70 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-container-low text-on-surface border-b border-slate-200 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Medicine &amp; Formulation</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Batch &amp; Expiry</th>
                    <th className="py-3 px-4">Safety Buffer</th>
                    <th className="py-3 px-4">Physical Stock</th>
                    <th className="py-3 px-4 text-center">Stock Intake / Restock</th>
                    <th className="py-3 px-4 text-center">1-Tap Dispense</th>
                    <th className="py-3 px-4 text-right">Referral</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLedgerItems.map((item) => {
                    const isLow = item.status === 'LOW_STOCK';
                    const isOut = item.quantity === 0;

                    return (
                      <tr
                        key={item.drugId}
                        className="hover:bg-surface-container-low/50 transition-colors group"
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-on-surface text-sm">
                              {item.drugName}
                            </span>
                            <span className="text-[11px] text-on-surface-variant">
                              {item.genericName} • {item.form}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-medium text-[11px]">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col font-mono text-[11px]">
                            <span className="text-on-surface font-medium">{item.batchNumber}</span>
                            <span className={isLow ? 'text-tertiary font-semibold' : 'text-outline'}>
                              Exp: {item.expiryDate}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <span className="font-mono font-medium">{item.threshold}</span>
                            <span className="text-outline">{item.unit}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-base font-bold font-mono ${
                                isLow ? 'text-tertiary' : 'text-on-surface'
                              }`}
                            >
                              {item.quantity}
                            </span>
                            <span className="text-[11px] text-outline font-medium">
                              {item.unit}
                            </span>
                            {isLow && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed font-bold">
                                LOW
                              </span>
                            )}
                          </div>
                        </td>
                        {/* INWARD STOCK / RESTOCK COLUMN */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => openInwardModalFor(item.drugId)}
                              className="px-2.5 py-1 bg-secondary/10 hover:bg-secondary text-secondary hover:text-white font-bold rounded border border-secondary/30 transition-all text-xs flex items-center gap-1"
                              title="Enter Inward Delivery Batch"
                              type="button"
                            >
                              <PackagePlus className="w-3.5 h-3.5" />
                              <span>+ Restock</span>
                            </button>
                            <button
                              onClick={() => handleQuickRestock(item.drugId, 50)}
                              className="px-2 py-1 bg-surface-container hover:bg-surface-container-high text-primary font-mono font-bold rounded border border-slate-200 transition-colors"
                              title="Quick +50 units"
                              type="button"
                            >
                              +50
                            </button>
                          </div>
                        </td>
                        {/* 1-TAP DISPENSE COLUMN */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => handleDispense(item.drugId)}
                            disabled={isOut}
                            className="px-3 py-1 bg-primary-container hover:bg-primary text-white font-bold rounded shadow-2xs transition-all active:scale-95 disabled:opacity-40"
                            title="1-Tap Dispense (-1)"
                            type="button"
                          >
                            -1 Dispense
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Link
                            href={`/locator?drug=${item.drugId}`}
                            className="inline-flex items-center gap-1 text-primary hover:text-primary-container text-xs font-semibold hover:underline"
                          >
                            <Network className="w-3.5 h-3.5 text-secondary" />
                            <span>Locate</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </WorkstationShell>
  );
}

export default function RapidDeskPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-outline font-mono">Loading Rapid Desk...</div>}>
      <RapidDeskContent />
    </Suspense>
  );
}
