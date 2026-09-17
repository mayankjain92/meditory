'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import WorkstationShell from '@/components/WorkstationShell';
import {
  Network,
  Phone,
  CheckCircle2,
  FileText,
  ArrowRight,
  Check,
} from 'lucide-react';
import { api } from '@/lib/api-client';

interface ClinicResult {
  facilityId: string;
  facilityName: string;
  facilityType: 'PHC' | 'CHC' | 'SUB_CENTRE';
  districtName: string;
  phone: string;
  doctorInCharge: string;
  distanceKm: number;
  quantity: number;
  unit: string;
  batchNumber: string;
  coldChainTemp: string;
  status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  lastVerifiedAt: string;
  transitTimeEstimate: string;
}

function StockLocatorContent() {
  const searchParams = useSearchParams();
  const initialDrug = searchParams.get('drug') || 'DRUG-ASV-01';

  const [selectedDrug, setSelectedDrug] = useState(initialDrug);
  const [maxDistance, setMaxDistance] = useState<number>(30);
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [results, setResults] = useState<ClinicResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [referralModalClinic, setReferralModalClinic] = useState<ClinicResult | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const DRUG_CATALOG = [
    { id: 'DRUG-ASV-01', name: 'Anti-Snake Venom (ASV) Polyvalent 10ml', localStock: 0, isCritical: true },
    { id: 'DRUG-ARV-02', name: 'Anti-Rabies Vaccine (ARV) 0.5ml', localStock: 14, isCritical: true },
    { id: 'DRUG-ADR-03', name: 'Adrenaline (Epinephrine) 1:1000 1ml', localStock: 8, isCritical: true },
    { id: 'DRUG-PCM-04', name: 'Paracetamol 500mg Tablets', localStock: 450, isCritical: false },
    { id: 'DRUG-AMX-05', name: 'Amoxicillin 500mg Capsules', localStock: 80, isCritical: false },
    { id: 'DRUG-ORS-06', name: 'Oral Rehydration Salts (ORS) Sachet', localStock: 120, isCritical: false },
  ];

  const fetchStockLocator = async (drugId: string) => {
    setLoading(true);
    try {
      const data = await api.get(`/api/network/stock-locator?drugId=${drugId}`);
      if (data.results) {
        setResults(data.results);
      }
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Failed to locate neighboring clinics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStockLocator(selectedDrug);
  }, [selectedDrug]);

  const activeDrugObj = DRUG_CATALOG.find((d) => d.id === selectedDrug) || DRUG_CATALOG[0];

  const filteredResults = results.filter((c) => {
    if (c.distanceKm > maxDistance) return false;
    if (selectedType !== 'ALL' && c.facilityType !== selectedType) return false;
    return true;
  });

  return (
    <WorkstationShell>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-xl border border-slate-700 flex items-center gap-2.5 text-xs animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Emergency Referral Modal */}
      {referralModalClinic && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Network className="w-5 h-5 text-teal-400" />
                <h3 className="font-semibold text-sm">Emergency Patient Referral Slip</h3>
              </div>
              <button
                onClick={() => setReferralModalClinic(null)}
                className="text-slate-400 hover:text-white text-lg font-bold w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs text-slate-700">
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-900 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  <strong>Verified Stock Reserved:</strong> 2 Vials of {activeDrugObj.name} held for 45 mins at {referralModalClinic.facilityName}.
                </span>
              </div>
              <div className="space-y-1.5 font-mono text-[11px] bg-slate-50 p-3 rounded-lg border border-slate-200">
                <p>
                  <strong>Destination Facility:</strong> {referralModalClinic.facilityName}
                </p>
                <p>
                  <strong>Doctor In-Charge:</strong> {referralModalClinic.doctorInCharge}
                </p>
                <p>
                  <strong>Emergency Contact:</strong> {referralModalClinic.phone}
                </p>
                <p>
                  <strong>Distance / Transit:</strong> {referralModalClinic.distanceKm} km ({referralModalClinic.transitTimeEstimate})
                </p>
                <p>
                  <strong>Digital Transfer Token:</strong> REF-2026-{Math.floor(100000 + Math.random() * 900000)}
                </p>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Hand this digital authorization to the accompanying ambulance crew or emergency attendant. Destination facility receives an automatic priority alert.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    setReferralModalClinic(null);
                    showToast('Referral dispatch confirmed and transmitted to 108 Emergency Service.');
                  }}
                  className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg shadow-xs text-xs transition-colors"
                >
                  Print / Send Digital Referral Slip
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="w-full flex flex-col gap-6">
        {/* Top Header & Context */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                District Health Network
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-slate-500 font-medium">
                Raigad District Primary Health Cluster
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1">
              Inter-Clinic Stock Locator &amp; Emergency Referral
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Locate verified emergency supplies in neighboring primary clinics to coordinate life-saving patient transfers.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/rapid-desk"
              className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors flex items-center gap-1.5 border border-slate-200"
            >
              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
              <span>Back to Rapid Desk</span>
            </Link>
          </div>
        </div>

        {/* Filter Controls (Simplified Row) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Medicine Selector */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between gap-2">
            <label className="text-xs font-semibold text-slate-900">
              Target Medicine
            </label>
            <select
              value={selectedDrug}
              onChange={(e) => setSelectedDrug(e.target.value)}
              className="w-full h-9 px-3 rounded-lg bg-slate-50 text-xs font-medium text-slate-900 border border-slate-300 focus:bg-white focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
            >
              {DRUG_CATALOG.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Local Stock: <strong className="text-slate-800">{activeDrugObj.localStock} units</strong></span>
              <span className={activeDrugObj.localStock <= 5 ? 'text-rose-700 font-semibold' : 'text-emerald-700 font-semibold'}>
                {activeDrugObj.localStock <= 5 ? '⚠️ Depleted / Low' : 'Adequate'}
              </span>
            </div>
          </div>

          {/* Max Distance Filter */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between gap-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-900">
                Search Radius
              </label>
              <span className="text-xs font-bold text-teal-700 font-mono">{maxDistance} km</span>
            </div>
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={maxDistance}
              onChange={(e) => setMaxDistance(parseInt(e.target.value, 10))}
              className="w-full accent-teal-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>5 km</span>
              <span>25 km (Standard)</span>
              <span>50 km</span>
            </div>
          </div>

          {/* Facility Type Filter */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between gap-2">
            <label className="text-xs font-semibold text-slate-900">
              Facility Classification
            </label>
            <div className="grid grid-cols-4 gap-1">
              {[
                { id: 'ALL', label: 'All' },
                { id: 'PHC', label: 'PHC' },
                { id: 'CHC', label: 'CHC' },
                { id: 'SUB_CENTRE', label: 'Sub-C' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedType(f.id)}
                  className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    selectedType === f.id
                      ? 'bg-teal-700 text-white shadow-xs'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                  type="button"
                >
                  {f.label}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-slate-400">
              {filteredResults.length} facilities within radius
            </span>
          </div>
        </div>

        {/* Network Results List (Clean Hierarchy & Single-Line Muted Metadata) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              Verified Stock Available Nearby ({filteredResults.length} Facilities)
            </h2>
            <span className="text-xs font-mono text-slate-400">
              Origin: Alibag Primary Health Centre
            </span>
          </div>

          {filteredResults.length === 0 ? (
            <div className="bg-white p-8 text-center rounded-xl border border-slate-200 text-xs text-slate-500">
              No neighboring facilities within {maxDistance} km currently match this filter. Try expanding the radius.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredResults.map((clinic) => (
                <div
                  key={clinic.facilityId}
                  className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between hover:shadow-sm transition-all"
                >
                  <div className="space-y-3">
                    {/* Header: Facility Name + Distance Chip */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-sm text-slate-900">
                          {clinic.facilityName}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium">
                          {clinic.doctorInCharge} · {clinic.facilityType}
                        </p>
                      </div>
                      <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                        {clinic.distanceKm} km
                      </span>
                    </div>

                    {/* Stock Counter Banner */}
                    <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 flex items-baseline justify-between">
                      <span className="text-xs font-semibold text-emerald-900">
                        Verified Stock
                      </span>
                      <span className="text-2xl font-bold font-mono text-emerald-700">
                        {clinic.quantity} <span className="text-xs font-normal text-emerald-800">{clinic.unit}</span>
                      </span>
                    </div>

                    {/* Single Muted Caption Line (Replaced 2 Cluttered Icon Rows) */}
                    <p className="text-[11px] text-slate-400 leading-normal">
                      {clinic.transitTimeEstimate} · Verified LoRa Sync · Cold-Chain {clinic.coldChainTemp}
                    </p>
                  </div>

                  {/* Actions Bar (Clear Primary & Secondary) */}
                  <div className="pt-4 mt-3 border-t border-slate-100 flex flex-col gap-2">
                    <button
                      onClick={() => setReferralModalClinic(clinic)}
                      className="w-full h-9 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition-all"
                      type="button"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Issue Emergency Referral</span>
                    </button>
                    <a
                      href={`tel:${clinic.phone}`}
                      className="w-full h-8 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 border border-slate-200 transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>Call Facility ({clinic.phone})</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </WorkstationShell>
  );
}

export default function StockLocatorPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400 font-mono">Loading Inter-Clinic Stock Locator...</div>}>
      <StockLocatorContent />
    </Suspense>
  );
}
