'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Phone,
  PhoneCall,
  Search,
  Building2,
  MapPin,
  Copy,
  Check,
  X,
  Navigation,
} from 'lucide-react';
import {
  NearbyClinic,
  getNearbyClinics,
  fetchAndCacheNearbyClinics,
  subscribeToNearbyClinics,
} from '@/lib/directory-manager';

interface EmergencyDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedFacilityName?: string;
  preselectedDrugName?: string;
}

export default function EmergencyDirectoryModal({
  isOpen,
  onClose,
}: EmergencyDirectoryModalProps) {
  const [clinics, setClinics] = useState<NearbyClinic[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    if (!isOpen) return;

    // Load pre-cached nearby clinics from IndexedDB immediately
    getNearbyClinics().then((items) => {
      setClinics(items);
    });

    // Fetch fresh records in background if online
    fetchAndCacheNearbyClinics().catch(() => {});

    const unsubscribe = subscribeToNearbyClinics((items) => {
      setClinics(items);
    });

    return () => unsubscribe();
  }, [isOpen]);

  // Filter clinics by search query (name, phone, address, taluka)
  const filteredClinics = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return clinics;
    return clinics.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.altPhone && c.altPhone.includes(q)) ||
        c.address.toLowerCase().includes(q) ||
        (c.taluka && c.taluka.toLowerCase().includes(q)) ||
        c.type.toLowerCase().includes(q)
    );
  }, [clinics, searchQuery]);

  const handleCopyPhone = (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(phone);
    setCopiedNumber(phone);
    showToast(`📋 Copied: ${phone}`);
    setTimeout(() => setCopiedNumber(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">
                  Nearby Clinics Phone Directory
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-500/30">
                  📱 Offline Ready
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Direct emergency telephone numbers of Primary & Community Health Centres
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
            title="Close Directory"
            type="button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Floating Toast Notification */}
        {toastMessage && (
          <div className="bg-slate-900 text-white text-xs px-4 py-2 border-b border-slate-800 text-center font-medium">
            {toastMessage}
          </div>
        )}

        {/* Search Strip */}
        <div className="p-4 bg-slate-50 border-b border-slate-200/80 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search nearby clinics by name or phone..."
              className="w-full h-10 pl-9 pr-8 rounded-lg bg-white text-sm text-slate-900 placeholder:text-slate-400 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 font-medium"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Nearby Clinics List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-slate-100">
          {filteredClinics.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <Building2 className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold">No clinics found</p>
              <p className="text-xs text-slate-400 mt-1">
                No clinics match &ldquo;{searchQuery}&rdquo;. Try another name or phone.
              </p>
            </div>
          ) : (
            filteredClinics.map((clinic) => (
              <div
                key={clinic.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  clinic.isCurrent
                    ? 'bg-blue-50/50 border-blue-200/80'
                    : 'bg-white border-slate-200/80 hover:border-emerald-300 hover:shadow-xs'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left: Clinic Details */}
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-slate-900 tracking-tight">
                        {clinic.name}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {clinic.type}
                      </span>
                      {clinic.isCurrent && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                          Your Clinic
                        </span>
                      )}
                      {clinic.distance && (
                        <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                          <Navigation className="w-3 h-3 text-slate-400" />
                          {clinic.distance}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{clinic.address}</span>
                    </div>

                    {/* Secondary Phone if available */}
                    {clinic.altPhone && (
                      <div className="text-[11px] text-slate-500 font-mono">
                        Alt line: {clinic.altPhone}
                      </div>
                    )}
                  </div>

                  {/* Right: Prominent Phone Number & Calling Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                    {/* Phone Number Display */}
                    <div className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 font-mono font-bold text-sm tracking-wide flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{clinic.phone}</span>
                    </div>

                    {/* Copy Button */}
                    <button
                      type="button"
                      onClick={(e) => handleCopyPhone(clinic.phone, e)}
                      className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200"
                      title="Copy phone number"
                    >
                      {copiedNumber === clinic.phone ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>

                    {/* Direct Call Button */}
                    <a
                      href={`tel:${clinic.phone.replace(/[^0-9+]/g, '')}`}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all active:scale-95"
                      title={`Call ${clinic.name}`}
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                      <span>Call</span>
                    </a>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between shrink-0">
          <span>{filteredClinics.length} nearby clinic phone lines available</span>
          <span className="font-mono text-[11px] text-slate-400">Raigad District Health Network</span>
        </div>
      </div>
    </div>
  );
}
