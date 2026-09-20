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
  ArrowLeftRight,
  Loader2,
  Pill,
  ShieldCheck,
  Clock,
  Share2,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import TransferRequisitionsDesk, { RequisitionItem } from '@/components/TransferRequisitionsDesk';
import { formatEmergencyReferralText, getWhatsAppShareUrl } from '@/lib/referral-templates';

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
  const [originFacilityName, setOriginFacilityName] = useState<string>('Your Health Centre');
  const [networkCounts, setNetworkCounts] = useState<{ clinics: number; doctors: number }>({ clinics: 9, doctors: 15 });

  // Two-Way Handshake Requisition State
  const [transferQuantity, setTransferQuantity] = useState<number>(2);
  const [transferNotes, setTransferNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [createdReq, setCreatedReq] = useState<RequisitionItem | null>(null);
  const [isDeskOpen, setIsDeskOpen] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleOpenReferralModal = (clinic: ClinicResult) => {
    setReferralModalClinic(clinic);
    setTransferQuantity(Math.min(2, Math.max(1, clinic.quantity)));
    setTransferNotes('Acute clinical emergency - patient referral transfer');
    setCreatedReq(null);
  };

  const handleCreateRequisition = async () => {
    if (!referralModalClinic) return;
    try {
      setIsSubmitting(true);
      const res = await api.post<{ success: boolean; requisition: RequisitionItem }>('/api/requisitions/request', {
        donorFacilityId: referralModalClinic.facilityId,
        drugId: selectedDrug,
        quantity: transferQuantity,
        urgency: 'EMERGENCY',
        patientNotes: transferNotes.trim() || 'Acute emergency patient transfer',
      });
      setCreatedReq(res.requisition);
      showToast(`Requisition transmitted to ${referralModalClinic.facilityName}!`);
    } catch (err: unknown) {
      showToast((err as Error).message || 'Failed to transmit transfer requisition.');
    } finally {
      setIsSubmitting(false);
    }
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
    try {
      const storedFacility = sessionStorage.getItem('meditory_facility') || localStorage.getItem('meditory_facility');
      if (storedFacility) {
        const parsed = JSON.parse(storedFacility);
        if (parsed.name) setOriginFacilityName(parsed.name);
      }
    } catch {}
    api.get<{ currentFacility?: any; facilities?: any[]; doctors?: any[] }>('/api/clinic/doctors')
      .then((res) => {
        if (res?.currentFacility?.name) {
          setOriginFacilityName(res.currentFacility.name);
        }
        if (res?.facilities && res?.doctors) {
          setNetworkCounts({ clinics: res.facilities.length, doctors: res.doctors.length });
        }
      })
      .catch(() => {});
  }, []);

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

      {/* Emergency Requisition / Handshake Modal */}
      {referralModalClinic && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white">
                  <ArrowLeftRight className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Inter-Clinic Transfer Requisition</h3>
                  <span className="text-[10px] text-teal-300 font-medium">Two-Way Handshake Protocol</span>
                </div>
              </div>
              <button
                onClick={() => setReferralModalClinic(null)}
                className="text-slate-400 hover:text-white text-lg font-bold w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-700">
              {!createdReq ? (
                <>
                  {/* Target Facility & Drug Banner */}
                  <div className="p-3 bg-teal-50 rounded-xl border border-teal-200 text-teal-950 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-teal-800 tracking-wide">
                        Donor Destination Facility
                      </span>
                      <span className="font-mono text-xs font-bold text-teal-900">
                        {referralModalClinic.distanceKm} km away
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-900">{referralModalClinic.facilityName}</p>
                    <p className="text-[11px] text-teal-800">
                      Doctor In-Charge: {referralModalClinic.doctorInCharge} • Phone: {referralModalClinic.phone}
                    </p>
                  </div>

                  {/* Medicine & Quantity Selector */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Requested Medicine & Dosage
                    </label>
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-2 font-semibold text-slate-900">
                      <Pill className="w-4 h-4 text-teal-700 shrink-0" />
                      <span>{activeDrugObj.name}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Quantity ({referralModalClinic.unit})
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={referralModalClinic.quantity}
                        value={transferQuantity}
                        onChange={(e) => setTransferQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/30"
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">
                        Available at donor: {referralModalClinic.quantity} {referralModalClinic.unit}
                      </span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Urgency Tier
                      </label>
                      <div className="h-9 px-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 font-bold text-xs flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse"></span>
                        <span>EMERGENCY</span>
                      </div>
                    </div>
                  </div>

                  {/* Clinical Referral Notes */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Patient Reference / Emergency Notes
                    </label>
                    <textarea
                      rows={2}
                      value={transferNotes}
                      onChange={(e) => setTransferNotes(e.target.value)}
                      placeholder="e.g. Acute venom bite case, 108 Ambulance dispatched for pickup"
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/30"
                    />
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Under the <strong>Two-Way Handshake Protocol</strong>, the donor clinic must review and accept this request. Upon acceptance, a 6-digit Handshake PIN will be issued for ambulance verification.
                  </p>

                  <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setReferralModalClinic(null)}
                      className="px-4 py-2 text-slate-600 hover:text-slate-900 text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateRequisition}
                      disabled={isSubmitting}
                      className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-lg shadow-xs text-xs flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Transmitting...</span>
                        </>
                      ) : (
                        <>
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                          <span>Transmit Handshake Requisition</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                /* Post-Submission Handshake Status Card */
                <div className="space-y-4 py-2">
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-xs">Requisition Transmitted Successfully!</h4>
                      <p className="text-[11px] text-emerald-800 mt-0.5">
                        Transmitted to <strong>{createdReq.donorFacilityName}</strong> for {createdReq.quantity} {createdReq.unit} of {createdReq.drugName}.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-[11px] font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Requisition ID:</span>
                      <span className="font-bold text-slate-800">{createdReq.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Current Status:</span>
                      <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        {createdReq.status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Handshake PIN:</span>
                      <span className="text-slate-600">Pending Donor Acceptance</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    The medical officer at {createdReq.donorFacilityName} is now reviewing the request. Once accepted, your 6-digit Handshake PIN will be visible in the <strong>Transfers Desk</strong>. Give this PIN to your 108 ambulance crew for pickup.
                  </p>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setReferralModalClinic(null)}
                      className="px-3 py-2 text-slate-600 hover:text-slate-900 text-xs font-semibold"
                    >
                      Done
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const referralText = formatEmergencyReferralText({
                          patientName: 'Emergency Triage Referral',
                          diagnosis: transferNotes || `${activeDrugObj.name} Urgent Administration`,
                          drugNeeded: activeDrugObj.name,
                          dosageOrQty: `${transferQuantity} ${referralModalClinic.unit}`,
                          urgency: 'CRITICAL (Immediate Ambulance)',
                          referringFacility: 'Alibag Primary Health Centre',
                          referringDoctor: 'Dr. Rahul Sharma',
                          referringPhone: '+91 2141 222045',
                          receivingFacility: createdReq.donorFacilityName,
                          receivingPhone: referralModalClinic.phone,
                          ambulanceStatus: '108 Ambulance Dispatched',
                          clinicalNotes: `Meditory Requisition ID: ${createdReq.id}`,
                        });
                        const url = getWhatsAppShareUrl(referralModalClinic.phone, referralText);
                        window.open(url, '_blank');
                      }}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs text-xs flex items-center gap-1.5 transition-colors"
                      title="Share transfer details directly via WhatsApp"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>WhatsApp Slip</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReferralModalClinic(null);
                        setIsDeskOpen(true);
                      }}
                      className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-lg shadow-xs text-xs flex items-center gap-1.5 transition-colors"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                      <span>Open Transfers Desk</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* Main Container */}
      <div className="w-full flex flex-col gap-6">
        {/* Top Header & Context */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                District Health Network
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>{networkCounts.clinics} Registered Clinics • {networkCounts.doctors} Registered Staff</span>
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1">
              Inter-Clinic Stock Locator &amp; Emergency Referral
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Locate verified emergency supplies in neighboring primary clinics or request emergency transfer requisitions.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsDeskOpen(true)}
              className="px-3.5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-xs"
              type="button"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Open Transfer Desk</span>
            </button>
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
              Origin: {originFacilityName}
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
                      onClick={() => handleOpenReferralModal(clinic)}
                      className="w-full h-9 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-98"
                      type="button"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                      <span>Request Emergency Transfer</span>
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href={`tel:${clinic.phone.replace(/\s+/g, '')}`}
                        className="h-8 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 border border-slate-200 transition-colors"
                        title={`Call ${clinic.facilityName} (${clinic.phone})`}
                      >
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>Call Facility</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          const referralText = formatEmergencyReferralText({
                            patientName: 'Emergency Triage Patient',
                            diagnosis: `${activeDrugObj.name} Urgent Administration`,
                            drugNeeded: activeDrugObj.name,
                            dosageOrQty: `2 ${clinic.unit}`,
                            urgency: 'CRITICAL (Immediate Ambulance)',
                            referringFacility: 'Alibag Primary Health Centre',
                            referringDoctor: 'Dr. Rahul Sharma',
                            referringPhone: '+91 2141 222045',
                            receivingFacility: clinic.facilityName,
                            receivingDoctor: clinic.doctorInCharge,
                            receivingPhone: clinic.phone,
                            ambulanceStatus: '108 Ambulance Dispatched',
                          });
                          const url = getWhatsAppShareUrl(clinic.phone, referralText);
                          window.open(url, '_blank');
                        }}
                        className="h-8 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 border border-emerald-200 transition-colors"
                        title="Send clinical referral template via WhatsApp"
                      >
                        <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>WhatsApp Slip</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Inter-Clinic Transfers Desk Drawer / Dialog */}
      <TransferRequisitionsDesk
        isOpen={isDeskOpen}
        onClose={() => {
          setIsDeskOpen(false);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('meditory:inventory-synced'));
          }
        }}
        onUpdate={() => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('meditory:inventory-synced'));
          }
        }}
        defaultTab="outgoing"
      />
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
