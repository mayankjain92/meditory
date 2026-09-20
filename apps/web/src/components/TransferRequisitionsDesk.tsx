'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeftRight,
  CheckCircle2,
  Clock,
  Truck,
  ShieldCheck,
  AlertTriangle,
  X,
  KeyRound,
  Check,
  Building2,
  Pill,
  Send,
  Sparkles,
  RefreshCw,
  Phone,
  Users,
  MapPin,
  Plus,
} from 'lucide-react';
import { api } from '@/lib/api-client';

export interface RequisitionItem {
  id: string;
  requesterFacilityId: string;
  requesterFacilityName: string;
  donorFacilityId: string;
  donorFacilityName: string;
  drugId: string;
  drugName: string;
  genericName?: string;
  quantity: number;
  unit: string;
  urgency: 'EMERGENCY' | 'ESSENTIAL' | 'ROUTINE';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';
  handshakePin?: string;
  patientNotes?: string;
  rejectionReason?: string;
  requestedByWorkerName: string;
  respondedByWorkerName?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

interface TransferRequisitionsDeskProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
  defaultTab?: 'incoming' | 'outgoing' | 'request' | 'network';
}

export default function TransferRequisitionsDesk({
  isOpen,
  onClose,
  onUpdate,
  defaultTab = 'incoming',
}: TransferRequisitionsDeskProps) {
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing' | 'request' | 'network'>(defaultTab);
  const [incoming, setIncoming] = useState<RequisitionItem[]>([]);
  const [outgoing, setOutgoing] = useState<RequisitionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Network Clinics & Staff Directory State
  const [registeredClinics, setRegisteredClinics] = useState<
    Array<{ id: string; name: string; type: string; phone: string; address?: string; isCurrent?: boolean }>
  >([]);
  const [registeredDoctors, setRegisteredDoctors] = useState<
    Array<{ id: string; name: string; role: string; facilityName: string; phone: string; email?: string }>
  >([]);

  // Requisition Composer State
  const [composerFacilityId, setComposerFacilityId] = useState<string>('');
  const [composerDrugId, setComposerDrugId] = useState<string>('DRUG-ASV-01');
  const [composerDrugName, setComposerDrugName] = useState<string>('Anti-Snake Venom (ASV) Polyvalent');
  const [composerQuantity, setComposerQuantity] = useState<number>(2);
  const [composerUrgency, setComposerUrgency] = useState<'EMERGENCY' | 'ESSENTIAL' | 'ROUTINE'>('EMERGENCY');
  const [composerNotes, setComposerNotes] = useState<string>('Emergency referral transfer');
  const [isSubmittingRequisition, setIsSubmittingRequisition] = useState<boolean>(false);

  // Dispense Handshake Input state (donor entering PIN provided by transport)
  const [pinInputs, setPinInputs] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchRequisitions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<{
        incoming: RequisitionItem[];
        outgoing: RequisitionItem[];
        counts: { pendingIncoming: number; activeOutgoing: number };
      }>('/api/requisitions');
      setIncoming(res.incoming || []);
      setOutgoing(res.outgoing || []);
    } catch {
      // ignore in silent poll
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFacilitiesAndDoctors = useCallback(async () => {
    try {
      const res = await api.get<{
        currentFacility: any;
        facilities: any[];
        doctors: any[];
      }>('/api/clinic/doctors');
      if (res) {
        if (Array.isArray(res.facilities)) {
          setRegisteredClinics(res.facilities);
          const donorCandidate = res.facilities.find((f) => !f.isCurrent);
          if (donorCandidate && !composerFacilityId) {
            setComposerFacilityId(donorCandidate.id);
          }
        }
        if (Array.isArray(res.doctors)) {
          setRegisteredDoctors(res.doctors);
        }
      }
    } catch (err) {
      console.warn('[TransferDesk] Could not fetch facilities/doctors:', err);
    }
  }, [composerFacilityId]);

  useEffect(() => {
    if (isOpen) {
      fetchRequisitions();
      fetchFacilitiesAndDoctors();
      const interval = setInterval(fetchRequisitions, 8000);
      return () => clearInterval(interval);
    }
  }, [isOpen, fetchRequisitions, fetchFacilitiesAndDoctors]);

  // Transmit new inter-clinic requisition
  const handleSendRequisition = async () => {
    if (!composerFacilityId) {
      showToast('⚠️ Please select a destination donor clinic.');
      return;
    }
    const cleanDrugId = composerDrugId.trim() || 'DRUG-ASV-01';
    const cleanDrugName = composerDrugName.trim() || cleanDrugId;
    if (composerQuantity <= 0) {
      showToast('⚠️ Quantity must be at least 1.');
      return;
    }

    try {
      setIsSubmittingRequisition(true);
      const targetClinic = registeredClinics.find((c) => c.id === composerFacilityId);
      const res = await api.post<{ success: boolean; requisition: RequisitionItem }>('/api/requisitions/request', {
        donorFacilityId: composerFacilityId,
        drugId: cleanDrugId,
        drugName: cleanDrugName,
        quantity: composerQuantity,
        urgency: composerUrgency,
        patientNotes: composerNotes.trim() || 'Emergency transfer requisition',
      });

      showToast(`Requisition sent to ${res.requisition?.donorFacilityName || targetClinic?.name || 'clinic'}!`);
      if (res.requisition) {
        setOutgoing((prev) => [res.requisition, ...prev]);
      } else {
        await fetchRequisitions();
      }
      setActiveTab('outgoing');
      if (onUpdate) onUpdate();
      setComposerNotes('');
    } catch (err: unknown) {
      showToast((err as Error).message || 'Failed to send requisition.');
    } finally {
      setIsSubmittingRequisition(false);
    }
  };

  // Handle Approve / Reject
  const handleRespond = async (requisitionId: string, action: 'APPROVE' | 'REJECT') => {
    try {
      setActionLoading((prev) => ({ ...prev, [requisitionId]: true }));
      let reason: string | undefined;
      if (action === 'REJECT') {
        const inputReason = prompt('Enter reason for declining requisition:', 'Low local stock reserves');
        if (inputReason === null) {
          setActionLoading((prev) => ({ ...prev, [requisitionId]: false }));
          return;
        }
        reason = inputReason;
      }

      await api.post('/api/requisitions/respond', {
        requisitionId,
        action,
        reason,
      });

      showToast(
        action === 'APPROVE'
          ? 'Requisition approved! 6-digit Handshake PIN generated for pickup.'
          : 'Requisition declined.'
      );
      await fetchRequisitions();
      if (onUpdate) onUpdate();
    } catch (err: unknown) {
      showToast((err as Error).message || 'Failed to update requisition.');
    } finally {
      setActionLoading((prev) => ({ ...prev, [requisitionId]: false }));
    }
  };

  // Handle Handshake Dispense (Donor verifying PIN)
  const handleHandshakeDispense = async (requisitionId: string) => {
    const pin = pinInputs[requisitionId]?.trim();
    if (!pin || pin.length !== 6) {
      showToast('Please enter the 6-digit Handshake PIN provided by the transport crew.');
      return;
    }

    try {
      setActionLoading((prev) => ({ ...prev, [requisitionId]: true }));
      await api.post('/api/requisitions/handshake-dispense', {
        requisitionId,
        handshakePin: pin,
      });

      showToast('Handshake PIN verified! Stock dispensed and marked In-Transit.');
      setPinInputs((prev) => ({ ...prev, [requisitionId]: '' }));
      await fetchRequisitions();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('meditory:inventory-synced'));
      }
      if (onUpdate) onUpdate();
    } catch (err: unknown) {
      showToast((err as Error).message || 'PIN verification failed.');
    } finally {
      setActionLoading((prev) => ({ ...prev, [requisitionId]: false }));
    }
  };

  // Handle Confirm Intake (Requester receiving stock)
  const handleConfirmIntake = async (requisitionId: string) => {
    try {
      setActionLoading((prev) => ({ ...prev, [requisitionId]: true }));
      const res = await api.post<{ success: boolean; newLocalQuantity: number }>(
        '/api/requisitions/confirm-intake',
        { requisitionId }
      );

      showToast(`Medicine received! Shelf stock incremented (New total: ${res.newLocalQuantity}).`);
      await fetchRequisitions();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('meditory:inventory-synced'));
      }
      if (onUpdate) onUpdate();
    } catch (err: unknown) {
      showToast((err as Error).message || 'Failed to confirm intake.');
    } finally {
      setActionLoading((prev) => ({ ...prev, [requisitionId]: false }));
    }
  };

  if (!isOpen) return null;

  const pendingIncomingCount = incoming.filter((r) => r.status === 'PENDING').length;
  const activeOutgoingCount = outgoing.filter((r) =>
    ['PENDING', 'APPROVED', 'IN_TRANSIT'].includes(r.status)
  ).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white max-w-2xl w-full rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-sm">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold tracking-tight">Inter-Clinic Transfer Desk</h3>
                <span className="text-[10px] uppercase font-bold bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded border border-teal-400/30">
                  Two-Way Handshake
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Mutual verification, secure PIN dispatch, and atomic stock transfers
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('request')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs ${
                activeTab === 'request'
                  ? 'bg-teal-400 text-slate-950 font-extrabold shadow-sm'
                  : 'bg-teal-600 hover:bg-teal-500 text-white'
              }`}
              type="button"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Request Medicines</span>
            </button>
            <button
              onClick={fetchRequisitions}
              disabled={loading}
              title="Refresh Transfers"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-teal-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveTab('incoming')}
            className={`pb-2.5 px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'incoming'
                ? 'border-teal-700 text-teal-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Incoming (Donor)</span>
            {pendingIncomingCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-rose-600 text-white font-mono animate-pulse">
                {pendingIncomingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('outgoing')}
            className={`pb-2.5 px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'outgoing'
                ? 'border-teal-700 text-teal-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Outgoing (Sent)</span>
            {activeOutgoingCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-teal-700 text-white font-mono">
                {activeOutgoingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('request')}
            className={`pb-2.5 px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'request'
                ? 'border-teal-700 text-teal-900'
                : 'border-transparent text-teal-700 hover:text-teal-900'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Request Medicines</span>
          </button>

          <button
            onClick={() => setActiveTab('network')}
            className={`pb-2.5 px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'network'
                ? 'border-teal-700 text-teal-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-teal-600" />
            <span>Registered Network ({registeredClinics.length})</span>
          </button>
        </div>

        {/* Toast Alert */}
        {toastMessage && (
          <div className="mx-4 mt-3 p-3 rounded-lg bg-slate-900 text-white text-xs flex items-center gap-2 shadow-md animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'incoming' ? (
            /* ================= INCOMING (DONOR DESK) ================= */
            incoming.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Building2 className="w-10 h-10 mx-auto mb-2 opacity-40 text-slate-300" />
                <p className="text-xs font-semibold text-slate-600">No incoming inter-clinic requests</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Requests from neighboring clinics for emergency medicines will appear here in real-time.
                </p>
              </div>
            ) : (
              incoming.map((req) => (
                <div
                  key={req.id}
                  className={`p-4 rounded-xl border transition-all ${
                    req.status === 'PENDING'
                      ? 'border-rose-300 bg-rose-50/40 shadow-xs'
                      : req.status === 'APPROVED'
                      ? 'border-teal-300 bg-teal-50/40 shadow-xs'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                            req.status === 'PENDING'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : req.status === 'APPROVED'
                              ? 'bg-amber-100 text-amber-900 border border-amber-200'
                              : req.status === 'IN_TRANSIT'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : req.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {req.status.replace('_', ' ')}
                        </span>
                        <span className="text-xs font-bold text-slate-900">
                          {req.requesterFacilityName}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Pill className="w-4 h-4 text-teal-700" />
                        <span>
                          {req.quantity} {req.unit} of {req.drugName}
                        </span>
                      </div>

                      {req.patientNotes && (
                        <p className="text-xs text-slate-600 mt-1 bg-white/80 p-2 rounded border border-slate-200/80">
                          <strong className="text-slate-700">Patient / Case:</strong> {req.patientNotes}
                        </p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                        <span>Requested by {req.requestedByWorkerName}</span>
                        <span>•</span>
                        <span>{new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-mono text-slate-400">ID: {req.id.split('-').slice(1).join('-')}</span>
                    </div>
                  </div>

                  {/* ACTION SECTION FOR DONOR */}
                  {req.status === 'PENDING' && (
                    <div className="mt-4 pt-3 border-t border-rose-200 flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleRespond(req.id, 'REJECT')}
                        disabled={actionLoading[req.id]}
                        className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-300 transition-colors"
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => handleRespond(req.id, 'APPROVE')}
                        disabled={actionLoading[req.id]}
                        className="px-4 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Accept & Generate Handshake PIN</span>
                      </button>
                    </div>
                  )}

                  {req.status === 'APPROVED' && (
                    <div className="mt-4 pt-3 border-t border-teal-200 bg-white p-3 rounded-lg border">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                            <KeyRound className="w-4 h-4 text-teal-600" />
                            <span>Transport Handshake Verification</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            When the 108 ambulance driver or messenger arrives, ask for their 6-digit Handshake PIN to authorize physical dispense.
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            maxLength={6}
                            value={pinInputs[req.id] || ''}
                            onChange={(e) =>
                              setPinInputs((prev) => ({ ...prev, [req.id]: e.target.value.replace(/\D/g, '') }))
                            }
                            placeholder="Enter 6-digit PIN"
                            className="w-32 h-8 text-center font-mono font-bold text-xs tracking-widest bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/30"
                          />
                          <button
                            onClick={() => handleHandshakeDispense(req.id)}
                            disabled={actionLoading[req.id] || (pinInputs[req.id] || '').length !== 6}
                            className="px-3 h-8 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Verify & Dispense</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {req.status === 'IN_TRANSIT' && (
                    <div className="mt-3 pt-2 text-xs text-blue-700 flex items-center gap-1.5 font-medium">
                      <Truck className="w-4 h-4" />
                      <span>Handshake completed. Medicine is currently en-route to {req.requesterFacilityName}.</span>
                    </div>
                  )}

                  {req.status === 'COMPLETED' && (
                    <div className="mt-3 pt-2 text-xs text-emerald-700 flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Transfer completed and safely checked into recipient clinic shelf.</span>
                    </div>
                  )}
                </div>
              ))
            )
          ) : activeTab === 'outgoing' ? (
            /* ================= OUTGOING (REQUESTER DESK) ================= */
            outgoing.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Send className="w-10 h-10 mx-auto mb-2 opacity-40 text-slate-300" />
                <p className="text-xs font-semibold text-slate-600">No outgoing requisitions</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  When you locate medicine at neighboring clinics and click &quot;Request Transfer&quot;, they will appear here.
                </p>
              </div>
            ) : (
              outgoing.map((req) => (
                <div
                  key={req.id}
                  className={`p-4 rounded-xl border transition-all ${
                    req.status === 'APPROVED'
                      ? 'border-emerald-300 bg-emerald-50/40 shadow-xs'
                      : req.status === 'IN_TRANSIT'
                      ? 'border-amber-300 bg-amber-50/40 shadow-xs'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                            req.status === 'PENDING'
                              ? 'bg-slate-100 text-slate-700 border border-slate-200'
                              : req.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : req.status === 'IN_TRANSIT'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : req.status === 'COMPLETED'
                              ? 'bg-teal-100 text-teal-800 border border-teal-200'
                              : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {req.status.replace('_', ' ')}
                        </span>
                        <span className="text-xs font-bold text-slate-900">
                          To: {req.donorFacilityName}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Pill className="w-4 h-4 text-teal-700" />
                        <span>
                          {req.quantity} {req.unit} of {req.drugName}
                        </span>
                      </div>

                      {req.patientNotes && (
                        <p className="text-xs text-slate-600 mt-1 bg-white/80 p-2 rounded border border-slate-200/80">
                          <strong className="text-slate-700">Patient / Case:</strong> {req.patientNotes}
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-mono text-slate-400">ID: {req.id.split('-').slice(1).join('-')}</span>
                    </div>
                  </div>

                  {/* OUTGOING STATUS DETAILS */}
                  {req.status === 'PENDING' && (
                    <div className="mt-3 pt-2 text-xs text-slate-600 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-slate-400 animate-spin" />
                      <span>Waiting for {req.donorFacilityName} to review and approve requisition...</span>
                    </div>
                  )}

                  {req.status === 'APPROVED' && (
                    <div className="mt-4 pt-3 border-t border-emerald-200 bg-white p-3 rounded-lg border border-emerald-300">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">
                            Requisition Approved by Donor
                          </span>
                          <p className="text-xs text-slate-600 mt-0.5">
                            Provide this 6-digit Handshake PIN to your 108 ambulance driver or transport staff for collection at {req.donorFacilityName}:
                          </p>
                        </div>
                        <div className="px-4 py-2 bg-emerald-50 rounded-lg border border-emerald-300 text-emerald-900 font-mono text-lg font-bold tracking-widest text-center shadow-2xs">
                          {req.handshakePin}
                        </div>
                      </div>
                    </div>
                  )}

                  {req.status === 'IN_TRANSIT' && (
                    <div className="mt-4 pt-3 border-t border-amber-200 bg-white p-3 rounded-lg border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                          <Truck className="w-4 h-4 text-amber-600 animate-pulse" />
                          <span>Medicine In Transit to Your Clinic</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Donor clinic verified handshake and physically released stock. Click below once delivered to add to your shelf.
                        </p>
                      </div>

                      <button
                        onClick={() => handleConfirmIntake(req.id)}
                        disabled={actionLoading[req.id]}
                        className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors shrink-0"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirm Arrival & Intake</span>
                      </button>
                    </div>
                  )}

                  {req.status === 'COMPLETED' && (
                    <div className="mt-3 pt-2 text-xs text-teal-800 flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-teal-600" />
                      <span>Intake verified. Added {req.quantity} {req.unit} to your clinic shelf.</span>
                    </div>
                  )}

                  {req.status === 'REJECTED' && (
                    <div className="mt-3 pt-2 text-xs text-rose-700 flex items-center gap-1.5 font-medium">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      <span>Declined by donor: {req.rejectionReason || 'No stock available'}</span>
                    </div>
                  )}
                </div>
              ))
            )
          ) : activeTab === 'request' ? (
            /* ================= REQUEST MEDICINES COMPOSER ================= */
            <div className="space-y-4">
              <div className="p-3.5 bg-teal-50/90 rounded-xl border border-teal-200 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-teal-950 uppercase tracking-wide">
                    Dispatch Two-Way Handshake Requisition
                  </h4>
                  <p className="text-[11px] text-teal-800 mt-0.5">
                    Send an authorized emergency medicine request to any neighboring registered primary clinic or community health centre in the district cluster.
                  </p>
                </div>
              </div>

              {/* Donor Facility Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-teal-600" />
                    <span>Select Donor Clinic (Destination)</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    {registeredClinics.filter((c) => !c.isCurrent).length} neighboring clinics in network
                  </span>
                </label>
                <select
                  value={composerFacilityId}
                  onChange={(e) => setComposerFacilityId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-white border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/30"
                >
                  <option value="">-- Choose Donor Facility --</option>
                  {registeredClinics
                    .filter((c) => !c.isCurrent)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.type}) • {c.phone}
                      </option>
                    ))}
                </select>
              </div>

              {/* Target Medicine Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Pill className="w-3.5 h-3.5 text-teal-600" />
                  <span>Required Medicine</span>
                </label>

                {/* Quick Select Chips for Essential Life-Saving Drugs */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'DRUG-ASV-01', name: 'Anti-Snake Venom (ASV) Polyvalent' },
                    { id: 'DRUG-ARV-02', name: 'Anti-Rabies Vaccine (ARV)' },
                    { id: 'DRUG-ADR-03', name: 'Adrenaline 1:1000' },
                    { id: 'DRUG-PCM-04', name: 'Paracetamol 500mg Tablets' },
                    { id: 'DRUG-AMX-05', name: 'Amoxicillin 500mg Capsules' },
                    { id: 'DRUG-ORS-06', name: 'Oral Rehydration Salts (ORS)' },
                  ].map((drug) => (
                    <button
                      key={drug.id}
                      type="button"
                      onClick={() => {
                        setComposerDrugId(drug.id);
                        setComposerDrugName(drug.name);
                      }}
                      className={`px-2.5 py-1 text-[11px] rounded-lg border font-medium transition-all ${
                        composerDrugId === drug.id
                          ? 'bg-teal-700 text-white border-teal-800 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {drug.name}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  <input
                    type="text"
                    value={composerDrugName}
                    onChange={(e) => {
                      setComposerDrugName(e.target.value);
                      setComposerDrugId(
                        'DRUG-' + e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '-').slice(0, 15)
                      );
                    }}
                    placeholder="Or type medicine name (e.g. Insulin, Atropine)..."
                    className="h-9 px-3 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/30"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={composerDrugId}
                      onChange={(e) => setComposerDrugId(e.target.value)}
                      placeholder="Drug Code (e.g. DRUG-ASV-01)"
                      className="h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-600 w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Quantity & Urgency Stepper */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800">
                    Required Quantity
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setComposerQuantity((q) => Math.max(1, q - 1))}
                      className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-base flex items-center justify-center border border-slate-200"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={composerQuantity}
                      onChange={(e) => setComposerQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="h-8 w-16 text-center rounded-lg bg-white border border-slate-300 font-bold font-mono text-xs text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setComposerQuantity((q) => q + 1)}
                      className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-base flex items-center justify-center border border-slate-200"
                    >
                      +
                    </button>
                    <div className="flex gap-1">
                      {[2, 5, 10, 25].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setComposerQuantity(preset)}
                          className={`px-1.5 py-1 text-[10px] font-bold rounded border ${
                            composerQuantity === preset
                              ? 'bg-teal-700 text-white border-teal-800'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          +{preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Urgency Level */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800">
                    Urgency Level
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { id: 'EMERGENCY', label: 'EMERGENCY', color: 'border-rose-400 bg-rose-50 text-rose-800' },
                      { id: 'ESSENTIAL', label: 'ESSENTIAL', color: 'border-amber-400 bg-amber-50 text-amber-900' },
                      { id: 'ROUTINE', label: 'ROUTINE', color: 'border-slate-300 bg-slate-50 text-slate-700' },
                    ].map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setComposerUrgency(u.id as any)}
                        className={`py-1.5 text-[10px] font-bold rounded-lg border transition-all ${
                          composerUrgency === u.id
                            ? `${u.color} ring-2 ring-teal-600/30 shadow-xs`
                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {u.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Clinical Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800">
                  Clinical Rationale / Emergency Referral Notes
                </label>
                <textarea
                  value={composerNotes}
                  onChange={(e) => setComposerNotes(e.target.value)}
                  placeholder="E.g. Acute venomous bite triage at casualty. Patient admitted, immediate antivenom administration required..."
                  rows={2}
                  className="w-full p-2.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/30 placeholder:text-slate-400"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveTab('outgoing')}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendRequisition}
                  disabled={isSubmittingRequisition || !composerFacilityId || !composerDrugId || composerQuantity <= 0}
                  className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all active:scale-98"
                >
                  {isSubmittingRequisition ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Transmitting Requisition...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Transmit Two-Way Handshake Requisition</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* ================= REGISTERED NETWORK CLINICS & USERS ================= */
            <div className="space-y-4">
              <div className="p-3.5 bg-emerald-50/80 rounded-xl border border-emerald-200 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                    Connected Health Facilities &amp; Registered Staff
                  </h4>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    {registeredClinics.length} Health Facilities • {registeredDoctors.length} Registered Healthcare Staff
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('request')}
                  className="px-3 py-1.5 rounded-lg bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs hover:bg-teal-800"
                >
                  <Send className="w-3 h-3" />
                  <span>Request Medicine</span>
                </button>
              </div>

              {/* Registered Clinics Grid */}
              <div className="space-y-2">
                <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Registered Health Facilities ({registeredClinics.length})
                </h5>
                <div className="grid grid-cols-1 gap-2">
                  {registeredClinics.map((clinic) => (
                    <div
                      key={clinic.id}
                      className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                        clinic.isCurrent
                          ? 'bg-blue-50/60 border-blue-200'
                          : 'bg-white border-slate-200 hover:border-teal-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 truncate">
                            {clinic.name}
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {clinic.type}
                          </span>
                          {clinic.isCurrent && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                              Your Clinic
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate flex items-center gap-2">
                          <span>{clinic.address}</span>
                          {clinic.phone && <span>• 📞 {clinic.phone}</span>}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {clinic.phone && (
                          <a
                            href={`tel:${clinic.phone.replace(/\s+/g, '')}`}
                            className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold border border-slate-200 flex items-center gap-1"
                          >
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>Call</span>
                          </a>
                        )}
                        {!clinic.isCurrent && (
                          <button
                            type="button"
                            onClick={() => {
                              setComposerFacilityId(clinic.id);
                              setActiveTab('request');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 text-[11px] font-bold border border-teal-200 flex items-center gap-1"
                          >
                            <Send className="w-3 h-3 text-teal-600" />
                            <span>Request</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Registered Staff / Users List */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Registered Doctors &amp; Healthcare Staff ({registeredDoctors.length})
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {registeredDoctors.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-xs text-slate-900 block truncate">
                          {doc.name}
                        </span>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">
                          {doc.facilityName} • {doc.role}
                        </p>
                        {doc.email && (
                          <p className="text-[10px] font-mono text-slate-400 truncate">
                            {doc.email}
                          </p>
                        )}
                      </div>
                      {doc.phone && (
                        <a
                          href={`tel:${doc.phone.replace(/\s+/g, '')}`}
                          className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 shrink-0"
                          title={`Call ${doc.name}`}
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            <span>Cryptographic Handshake Protocol • National Health Mission</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
