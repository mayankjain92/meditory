'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import WorkstationShell from '@/components/WorkstationShell';
import {
  Search,
  Network,
  Phone,
  Navigation,
  CheckCircle2,
  Clock,
  Building2,
  AlertCircle,
  FileText,
  Share2,
  ArrowRight,
  ShieldCheck,
  Check,
  User,
  Radio,
  ExternalLink,
} from 'lucide-react';

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
  const initialDrug = searchParams.get('drug') || 'DRUG-ARV-01';

  const [selectedDrug, setSelectedDrug] = useState(initialDrug);
  const [maxDistance, setMaxDistance] = useState<number>(25);
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
    { id: 'DRUG-ARV-01', name: 'Anti-Rabies Vaccine (ARV) 0.5ml', localStock: 4, isCritical: true },
    { id: 'DRUG-ASV-01', name: 'Anti-Snake Venom (ASV) Polyvalent 10ml', localStock: 28, isCritical: true },
    { id: 'DRUG-ADR-01', name: 'Adrenaline (Epinephrine) 1:1000 1ml', localStock: 42, isCritical: true },
    { id: 'DRUG-OXY-01', name: 'Oxytocin Injection 10 IU/ml', localStock: 18, isCritical: true },
  ];

  const fetchStockLocator = async (drugId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/network/stock-locator?drugId=${drugId}`);
      const data = await res.json();
      if (data.results) {
        setResults(data.results);
      }
    } catch (e) {
      console.error(e);
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
        <div className="fixed top-20 right-6 z-50 bg-primary-container text-white px-4 py-3 rounded-lg shadow-xl border border-primary-fixed-dim/30 flex items-center gap-2 text-xs animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-secondary-fixed shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Emergency Referral Modal */}
      {referralModalClinic && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest max-w-md w-full rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-primary-container p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Network className="w-5 h-5 text-secondary-fixed" />
                <h3 className="font-bold text-sm">Emergency Patient Referral Slip</h3>
              </div>
              <button
                onClick={() => setReferralModalClinic(null)}
                className="text-white/80 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs text-on-surface">
              <div className="p-3 bg-secondary-fixed/30 rounded-lg border border-secondary/20 flex items-center gap-2">
                <Check className="w-4 h-4 text-secondary shrink-0" />
                <span>
                  <strong>Verified Stock Reserved:</strong> 2 Vials of {activeDrugObj.name} held for 45
                  mins at {referralModalClinic.facilityName}.
                </span>
              </div>
              <div className="space-y-1.5 font-mono text-[11px] bg-surface-container-low p-3 rounded-lg border border-slate-200/50">
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
                  <strong>Distance / Transit:</strong> {referralModalClinic.distanceKm} km (
                  {referralModalClinic.transitTimeEstimate})
                </p>
                <p>
                  <strong>Digital Transfer Token:</strong> REF-2026-
                  {Math.floor(100000 + Math.random() * 900000)}
                </p>
              </div>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                Hand this digital authorization to the accompanying ambulance crew or emergency attendant.
                Destination facility receives an automatic priority alert.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    setReferralModalClinic(null);
                    showToast('Referral dispatch confirmed and transmitted to 108 Emergency Service.');
                  }}
                  className="w-full py-2.5 bg-primary-container hover:bg-primary text-white font-bold rounded-lg shadow-sm text-xs"
                >
                  Print / Send Digital Referral Slip
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="w-full max-w-[1440px] mx-auto px-6 py-6 flex flex-col gap-6">
        {/* Top Header & Context */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-container-lowest p-5 rounded-xl border border-slate-200/70 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-secondary bg-secondary-fixed/40 px-2 py-0.5 rounded-full">
                District Health Network
              </span>
              <span className="text-xs text-outline">•</span>
              <span className="text-xs text-on-surface-variant font-medium">
                Raigad District Primary Health Cluster
              </span>
            </div>
            <h1 className="text-xl font-bold text-primary tracking-tight mt-1">
              Inter-Clinic Stock Locator &amp; Emergency Referral
            </h1>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Instantly locate verified emergency supplies in neighboring primary clinics to coordinate
              life-saving patient transfers or inter-facility balancing.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/rapid-desk"
              className="px-3.5 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-semibold text-xs transition-colors flex items-center gap-1.5"
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
              <span>Back to Rapid Desk</span>
            </Link>
          </div>
        </div>

        {/* Medicine Selector & Distance Filter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Medicine Selector */}
          <div className="bg-surface-container-lowest p-4 rounded-xl border border-slate-200/70 shadow-sm flex flex-col gap-2">
            <label className="text-[11px] font-bold uppercase text-on-surface tracking-wide">
              Target Emergency Medicine
            </label>
            <select
              value={selectedDrug}
              onChange={(e) => setSelectedDrug(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-surface-container-low text-xs font-semibold text-on-surface border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-container/20"
            >
              {DRUG_CATALOG.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} (Local: {d.localStock} units)
                </option>
              ))}
            </select>
            <div className="flex items-center justify-between text-[11px] text-on-surface-variant pt-1">
              <span>Local Stock: <strong>{activeDrugObj.localStock} units</strong></span>
              <span className={activeDrugObj.localStock <= 5 ? 'text-tertiary font-bold' : 'text-secondary font-semibold'}>
                {activeDrugObj.localStock <= 5 ? '⚠️ Depleted / Buffer Low' : 'Adequate'}
              </span>
            </div>
          </div>

          {/* Max Distance Filter */}
          <div className="bg-surface-container-lowest p-4 rounded-xl border border-slate-200/70 shadow-sm flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-bold uppercase text-on-surface tracking-wide">
                Maximum Radius
              </label>
              <span className="text-xs font-bold text-primary font-mono">{maxDistance} km</span>
            </div>
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={maxDistance}
              onChange={(e) => setMaxDistance(parseInt(e.target.value, 10))}
              className="w-full accent-primary-container cursor-pointer mt-2"
            />
            <div className="flex justify-between text-[10px] text-outline font-mono">
              <span>5 km</span>
              <span>25 km (Default)</span>
              <span>50 km</span>
            </div>
          </div>

          {/* Facility Type Filter */}
          <div className="bg-surface-container-lowest p-4 rounded-xl border border-slate-200/70 shadow-sm flex flex-col gap-2">
            <label className="text-[11px] font-bold uppercase text-on-surface tracking-wide">
              Facility Classification
            </label>
            <div className="grid grid-cols-4 gap-1 pt-1">
              {[
                { id: 'ALL', label: 'All' },
                { id: 'PHC', label: 'PHC' },
                { id: 'CHC', label: 'CHC' },
                { id: 'SUB_CENTRE', label: 'Sub-C' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedType(f.id)}
                  className={`py-1.5 text-xs font-bold rounded-md transition-all ${
                    selectedType === f.id
                      ? 'bg-primary-container text-white shadow-xs'
                      : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'
                  }`}
                  type="button"
                >
                  {f.label}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-outline mt-1">
              Showing {filteredResults.length} verified facilities
            </span>
          </div>
        </div>

        {/* Network Results List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-on-surface">
              Verified Stock Available Nearby ({filteredResults.length} Facilities)
            </h2>
            <span className="text-xs font-mono text-outline">
              Origin: PHC Sector 4 (Static Terminal)
            </span>
          </div>

          {filteredResults.length === 0 ? (
            <div className="bg-surface-container-lowest p-8 text-center rounded-xl border border-slate-200 text-xs text-on-surface-variant">
              No neighboring facilities within {maxDistance} km currently meet this filter. Try expanding the radius.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredResults.map((clinic) => (
                <div
                  key={clinic.facilityId}
                  className="bg-surface-container-lowest p-5 rounded-xl border border-slate-200/70 shadow-sm flex flex-col justify-between hover:shadow-md transition-all"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-container-high text-primary uppercase">
                          {clinic.facilityType} Node
                        </span>
                        <h3 className="font-bold text-sm text-on-surface mt-1">
                          {clinic.facilityName}
                        </h3>
                        <p className="text-[11px] text-on-surface-variant">
                          {clinic.doctorInCharge}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-base font-bold text-primary block">
                          {clinic.distanceKm} km
                        </span>
                        <span className="text-[10px] text-outline">Distance</span>
                      </div>
                    </div>

                    {/* Stock Counter Badge */}
                    <div className="p-3 bg-secondary-fixed/30 rounded-lg border border-secondary/20 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-on-secondary-fixed block">
                          Verified Available Stock
                        </span>
                        <span className="text-xl font-bold font-mono text-secondary">
                          {clinic.quantity} {clinic.unit}
                        </span>
                      </div>
                      <div className="text-right text-[11px] font-mono text-outline">
                        <div className="text-secondary font-semibold">Cold: {clinic.coldChainTemp}</div>
                        <div>Batch: {clinic.batchNumber}</div>
                      </div>
                    </div>

                    <div className="space-y-1 text-[11px] text-on-surface-variant">
                      <div className="flex items-center gap-1.5">
                        <Navigation className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>{clinic.transitTimeEstimate}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-outline shrink-0" />
                        <span>{clinic.lastVerifiedAt} via LoRa Mesh Sync</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-4 mt-3 border-t border-slate-200/60 flex flex-col gap-2">
                    <button
                      onClick={() => setReferralModalClinic(clinic)}
                      className="w-full py-2 bg-primary-container hover:bg-primary text-white text-xs font-bold rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition-all"
                      type="button"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Issue Emergency Referral</span>
                    </button>
                    <a
                      href={`tel:${clinic.phone}`}
                      className="w-full py-2 bg-surface-container hover:bg-surface-container-high text-primary text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5" />
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
    <Suspense fallback={<div className="p-8 text-center text-xs text-outline font-mono">Loading Inter-Clinic Stock Locator...</div>}>
      <StockLocatorContent />
    </Suspense>
  );
}

