'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  AlertTriangle,
  AlertCircle,
  BellRing,
  ShieldAlert,
  X,
  Network,
  PackagePlus,
  RefreshCw,
  CheckCircle2,
  Search,
  ExternalLink,
  Pill,
  Building2,
  ArrowRight,
  ChevronRight,
  Info,
} from 'lucide-react';
import { api } from '@/lib/api-client';

export interface AlertDrugItem {
  facilityId: string;
  drugId: string;
  drugName: string;
  genericName: string;
  category: string;
  form: string;
  quantity: number;
  unit: string;
  threshold: number;
  tier: 'EMERGENCY' | 'ESSENTIAL' | 'ROUTINE';
  isCritical: boolean;
  status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  storageLocation?: string;
  batchNumber?: string;
  expiryDate?: string;
  lastRestockedAt?: string;
  lastDispensedAt?: string;
}

interface StockAlertSystemProps {
  /** Optional custom styling class for navbar trigger */
  triggerClassName?: string;
}

export default function StockAlertSystem({ triggerClassName }: StockAlertSystemProps) {
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<AlertDrugItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [facilityName, setFacilityName] = useState('Alibag Primary Health Centre');

  // Modal / Drawer state
  const [isAlertDrawerOpen, setIsAlertDrawerOpen] = useState(false);
  const [isAutoNoticeOpen, setIsAutoNoticeOpen] = useState(false);
  const [autoNoticeDismissed, setAutoNoticeDismissed] = useState(false);

  // Tabs and search filters
  const [activeTab, setActiveTab] = useState<'all' | 'important' | 'low-stock'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Hydration safety for createPortal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch inventory from API
  const fetchInventory = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get('/api/clinic/inventory');
      if (data) {
        if (data.items && Array.isArray(data.items)) {
          setItems(data.items);
        }
        if (data.facility?.name) {
          setFacilityName(data.facility.name);
        }
      }
    } catch (err) {
      console.warn('[StockAlertSystem] Could not fetch inventory:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount & setup global custom event listener
  useEffect(() => {
    fetchInventory();

    const handleOpenAlertCenter = () => {
      setIsAlertDrawerOpen(true);
      setActiveTab('all');
    };

    window.addEventListener('open-stock-alert-center', handleOpenAlertCenter);
    return () => {
      window.removeEventListener('open-stock-alert-center', handleOpenAlertCenter);
    };
  }, [fetchInventory]);

  // Depleted medicines (stock = 0 or status = OUT_OF_STOCK)
  const depletedItems = items.filter(
    (i) => i.quantity === 0 || i.status === 'OUT_OF_STOCK'
  );

  // Important / Emergency medicines that are depleted
  const importantDepletedItems = depletedItems.filter(
    (i) => i.tier === 'EMERGENCY' || i.isCritical
  );

  // Low stock medicines (quantity > 0 but <= threshold)
  const lowStockItems = items.filter(
    (i) => i.quantity > 0 && i.quantity <= i.threshold
  );

  // Auto-notification on initial app open:
  // Whenever inventory loads, if there are IMPORTANT medicines that are missing,
  // trigger the emergency notification automatically!
  useEffect(() => {
    if (!loading && importantDepletedItems.length > 0 && !autoNoticeDismissed) {
      setIsAutoNoticeOpen(true);
    }
  }, [loading, importantDepletedItems.length, autoNoticeDismissed]);

  const handleDismissAutoNotice = () => {
    setIsAutoNoticeOpen(false);
    setAutoNoticeDismissed(true);
  };

  const handleOpenAlertDrawerFromNotice = () => {
    setIsAutoNoticeOpen(false);
    setAutoNoticeDismissed(true);
    setIsAlertDrawerOpen(true);
    setActiveTab('important');
  };

  // Filter items for drawer list based on tab & search
  const filteredDrawerItems = (() => {
    let list: AlertDrugItem[] = [];
    if (activeTab === 'all') {
      list = depletedItems;
    } else if (activeTab === 'important') {
      list = importantDepletedItems;
    } else if (activeTab === 'low-stock') {
      list = lowStockItems;
    }

    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (item) =>
        item.drugName.toLowerCase().includes(q) ||
        item.genericName.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.drugId.toLowerCase().includes(q)
    );
  })();

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. TOP NAVBAR TRIGGER BADGE (RENDERED IN HEADER)                         */}
      {/* ========================================================================= */}
      <div className="relative inline-flex items-center">
        {depletedItems.length > 0 ? (
          <button
            onClick={() => {
              setIsAlertDrawerOpen(true);
              setActiveTab(importantDepletedItems.length > 0 ? 'all' : 'all');
            }}
            type="button"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs active:scale-95 ${
              importantDepletedItems.length > 0
                ? 'bg-rose-600 hover:bg-rose-700 text-white ring-2 ring-rose-400/40 animate-pulse'
                : 'bg-amber-500 hover:bg-amber-600 text-white'
            } ${triggerClassName || ''}`}
            title="Click to open Clinic Formulary Alert Center"
          >
            <BellRing className="w-3.5 h-3.5 shrink-0 animate-bounce" />
            <span>
              🚨 {depletedItems.length} Missing
              {importantDepletedItems.length > 0
                ? ` (${importantDepletedItems[0]?.drugName})`
                : ''}
            </span>
          </button>
        ) : (
          <button
            onClick={() => setIsAlertDrawerOpen(true)}
            type="button"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold transition-colors ${
              triggerClassName || ''
            }`}
            title="Stock Alert System: All formularies stocked"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Stock Alerts: 0 Depleted</span>
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. AUTO-NOTIFICATION ON APP OPEN (PORTALED TO DOCUMENT.BODY)             */}
      {/* ========================================================================= */}
      {mounted &&
        isAutoNoticeOpen &&
        importantDepletedItems.length > 0 &&
        createPortal(
          <div
            role="alert"
            aria-live="assertive"
            className="fixed top-4 right-4 z-[99999] max-w-md w-[calc(100vw-2rem)] animate-in slide-in-from-top-4 duration-300 pointer-events-auto"
          >
            <div className="bg-white rounded-2xl shadow-2xl border-2 border-rose-500 overflow-hidden ring-4 ring-rose-500/10">
              {/* Alert Card Header */}
              <div className="bg-gradient-to-r from-rose-700 via-rose-600 to-red-800 p-4 text-white flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 shadow-inner">
                    <ShieldAlert className="w-5 h-5 text-white animate-pulse" />
                  </div>
                  <div>
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-rose-100 text-[10px] font-bold uppercase tracking-wider mb-0.5">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Critical Stock Alert</span>
                    </div>
                    <h3 className="text-sm font-bold tracking-tight text-white leading-tight">
                      Important Medicine Missing!
                    </h3>
                  </div>
                </div>
                <button
                  onClick={handleDismissAutoNotice}
                  className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors"
                  title="Dismiss alert"
                  type="button"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Alert Card Body */}
              <div className="p-4 space-y-3">
                {importantDepletedItems.map((drug) => (
                  <div
                    key={drug.drugId}
                    className="p-3 rounded-xl bg-rose-50 border border-rose-200/80 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-slate-900">
                            {drug.drugName}
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-rose-200 text-rose-800">
                            TIER-1 EMERGENCY
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          {drug.genericName} • {drug.form}
                        </p>
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-black bg-rose-600 text-white tracking-wider shrink-0">
                        0 {drug.unit.toUpperCase()}S
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-white border border-rose-200/60 text-[11px] text-slate-700 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-slate-800 truncate">
                        <Building2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        <span className="truncate">
                          <strong>Pen CHC</strong> has <strong>25 vials</strong> (14 km away)
                        </span>
                      </div>
                      <Link
                        href={`/locator?drug=${drug.drugId}`}
                        onClick={handleDismissAutoNotice}
                        className="inline-flex items-center gap-0.5 text-[11px] font-bold text-teal-700 hover:text-teal-800 hover:underline shrink-0"
                      >
                        <span>Locate</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))}

                {/* Directive */}
                <p className="text-[11px] text-slate-500 flex items-center gap-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>National Health Protocol: Initiate instant referral for acute emergency cases.</span>
                </p>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleDismissAutoNotice}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Dismiss
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenAlertDrawerFromNotice}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-2xs flex items-center gap-1.5"
                  >
                    <Pill className="w-3.5 h-3.5 text-slate-300" />
                    <span>View All Missing ({depletedItems.length})</span>
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ========================================================================= */}
      {/* 3. FULL-HEIGHT UNIFIED ALERT CENTER DRAWER (PORTALED TO DOCUMENT.BODY)   */}
      {/* ========================================================================= */}
      {mounted &&
        isAlertDrawerOpen &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[99999] flex justify-end bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 pointer-events-auto"
          >
            {/* Backdrop Click */}
            <div
              className="flex-1 cursor-pointer"
              onClick={() => setIsAlertDrawerOpen(false)}
            />

            {/* Slide-Over Drawer: Explicit Full Height h-screen */}
            <div className="w-full max-w-xl bg-white h-screen shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300 border-l border-slate-200 overflow-hidden">
              {/* Drawer Header */}
              <div className="shrink-0 p-5 border-b border-slate-800 bg-slate-900 text-white flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-5 h-5 text-teal-300" />
                  </div>
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-[10px] font-bold uppercase tracking-wider mb-1">
                      <span>Facility Stock Alert Center</span>
                    </div>
                    <h2 className="text-lg font-bold tracking-tight text-white">
                      Missing & Depleted Medicines Ledger
                    </h2>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {facilityName} • Authoritative inventory stockout status
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchInventory}
                    disabled={loading}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    title="Refresh Inventory"
                    type="button"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => setIsAlertDrawerOpen(false)}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    title="Close Alert Center"
                    type="button"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Quick Metrics KPI Bar */}
              <div className="shrink-0 grid grid-cols-3 gap-3 p-4 bg-slate-50 border-b border-slate-200">
                <div
                  onClick={() => setActiveTab('all')}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    activeTab === 'all'
                      ? 'bg-rose-50/50 border-rose-300 ring-2 ring-rose-500/20 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className="text-[11px] font-semibold text-slate-500 block">
                    Total Depleted (0 Stock)
                  </span>
                  <span className="text-xl font-bold font-mono text-rose-700">
                    {depletedItems.length}
                  </span>
                  <span className="text-[10px] text-rose-600 block mt-0.5">
                    Require restock / referral
                  </span>
                </div>

                <div
                  onClick={() => setActiveTab('important')}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    activeTab === 'important'
                      ? 'bg-red-50/50 border-red-300 ring-2 ring-red-500/20 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className="text-[11px] font-semibold text-slate-500 block">
                    Critical Emergency Missing
                  </span>
                  <span className="text-xl font-bold font-mono text-red-600">
                    {importantDepletedItems.length}
                  </span>
                  <span className="text-[10px] text-red-500 block mt-0.5">
                    Tier-1 patient critical
                  </span>
                </div>

                <div
                  onClick={() => setActiveTab('low-stock')}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    activeTab === 'low-stock'
                      ? 'bg-amber-50/50 border-amber-300 ring-2 ring-amber-500/20 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className="text-[11px] font-semibold text-slate-500 block">
                    Low Stock Buffers
                  </span>
                  <span className="text-xl font-bold font-mono text-amber-600">
                    {lowStockItems.length}
                  </span>
                  <span className="text-[10px] text-amber-600 block mt-0.5">
                    Below safety threshold
                  </span>
                </div>
              </div>

              {/* Controls: Filter Tabs & Search */}
              <div className="shrink-0 p-4 border-b border-slate-200 space-y-3 bg-white">
                {/* Filter Tabs */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setActiveTab('all')}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                      activeTab === 'all'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All Depleted ({depletedItems.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('important')}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                      activeTab === 'important'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-rose-700 hover:text-rose-800'
                    }`}
                  >
                    Important Only ({importantDepletedItems.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('low-stock')}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                      activeTab === 'low-stock'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-amber-700 hover:text-amber-800'
                    }`}
                  >
                    Low Buffer ({lowStockItems.length})
                  </button>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter missing medicines by name, generic salt, or category..."
                    className="w-full h-9 pl-9 pr-4 rounded-lg bg-slate-50 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-teal-600/20 border border-slate-200 transition-all"
                  />
                </div>
              </div>

              {/* List of Alert Items: Proper Scrollable Area with min-h-0 flex-1 */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 bg-slate-50">
                {filteredDrawerItems.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 space-y-3 my-6">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-sm text-slate-900">
                      No Medicines in this Alert Category
                    </h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      {searchQuery
                        ? `No items matched "${searchQuery}".`
                        : activeTab === 'low-stock'
                        ? 'All safety stock buffers are currently above minimum thresholds.'
                        : 'No medicines are missing in this view.'}
                    </p>
                    {activeTab === 'low-stock' && (
                      <button
                        onClick={() => setActiveTab('all')}
                        type="button"
                        className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 text-xs font-semibold hover:bg-rose-100"
                      >
                        Switch to All Depleted ({depletedItems.length}) →
                      </button>
                    )}
                  </div>
                ) : (
                  filteredDrawerItems.map((drug) => {
                    const isDepleted = drug.quantity === 0 || drug.status === 'OUT_OF_STOCK';
                    const isImportant = drug.tier === 'EMERGENCY' || drug.isCritical;

                    return (
                      <div
                        key={drug.drugId}
                        className={`p-4 rounded-xl bg-white border transition-all shadow-xs hover:shadow-sm ${
                          isImportant
                            ? 'border-rose-300 ring-2 ring-rose-500/10'
                            : isDepleted
                            ? 'border-slate-300'
                            : 'border-amber-300'
                        }`}
                      >
                        {/* Drug Header & Badges */}
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-bold text-sm text-slate-900">
                                {drug.drugName}
                              </h3>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                                  drug.tier === 'EMERGENCY'
                                    ? 'bg-rose-100 text-rose-800'
                                    : drug.tier === 'ESSENTIAL'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {drug.tier}
                              </span>
                              {drug.isCritical && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-600 text-white">
                                  LIFE-CRITICAL
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 mt-1">
                              {drug.genericName} • <span className="font-mono text-slate-500">{drug.form}</span>
                            </p>
                            <span className="inline-block text-[10px] text-slate-400 mt-0.5 font-medium">
                              Category: {drug.category} • ID: {drug.drugId}
                            </span>
                          </div>

                          {/* Stock Quantity Badge */}
                          <div className="text-right shrink-0">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-black tracking-wider ${
                                isDepleted
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-amber-500 text-white'
                              }`}
                            >
                              {drug.quantity} {drug.unit.toUpperCase()}S
                            </span>
                            <div className="text-[10px] font-mono text-slate-500 mt-1">
                              Min Buffer: {drug.threshold} {drug.unit}s
                            </div>
                          </div>
                        </div>

                        {/* Clinical Protocol / Referral Advisory */}
                        <div
                          className={`mt-3 p-2.5 rounded-lg text-xs flex items-center justify-between gap-3 ${
                            isImportant
                              ? 'bg-rose-50 text-rose-900 border border-rose-200'
                              : 'bg-slate-50 text-slate-700 border border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <AlertTriangle
                              className={`w-4 h-4 shrink-0 ${
                                isImportant ? 'text-rose-600' : 'text-amber-600'
                              }`}
                            />
                            <span className="text-[11px] leading-relaxed">
                              {isImportant
                                ? 'Critical Zero Stock! Urgent referral protocol active. Discover neighboring clinics with verified stock.'
                                : 'Safety stock depleted. Place depot challan or re-balance with district health store.'}
                            </span>
                          </div>
                        </div>

                        {/* 1-Click Action Buttons */}
                        <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2">
                          {/* Quick Action: Find in Neighbor Clinics */}
                          <Link
                            href={`/locator?drug=${drug.drugId}`}
                            onClick={() => setIsAlertDrawerOpen(false)}
                            className="px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
                          >
                            <Network className="w-3.5 h-3.5 text-teal-600" />
                            <span>Find in Neighbor Clinics</span>
                            <ExternalLink className="w-3 h-3 text-teal-500" />
                          </Link>

                          {/* Quick Action: Restock via Unified Stock Desk */}
                          <Link
                            href={`/rapid-desk?view=stock-entry&action=restock&drug=${drug.drugId}`}
                            onClick={() => setIsAlertDrawerOpen(false)}
                            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs active:scale-95"
                          >
                            <PackagePlus className="w-3.5 h-3.5 text-slate-300" />
                            <span>Restock Medicine</span>
                          </Link>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Drawer Footer */}
              <div className="shrink-0 p-4 border-t border-slate-200 bg-white flex items-center justify-between text-xs text-slate-500">
                <span>National Health Mission Protocol v2.4</span>
                <button
                  type="button"
                  onClick={() => setIsAlertDrawerOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
                >
                  Close Alert Center
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
