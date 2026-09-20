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
  defaultTab?: 'incoming' | 'outgoing';
}

export default function TransferRequisitionsDesk({
  isOpen,
  onClose,
  onUpdate,
  defaultTab = 'incoming',
}: TransferRequisitionsDeskProps) {
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>(defaultTab);
  const [incoming, setIncoming] = useState<RequisitionItem[]>([]);
  const [outgoing, setOutgoing] = useState<RequisitionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  useEffect(() => {
    if (isOpen) {
      fetchRequisitions();
      const interval = setInterval(fetchRequisitions, 8000);
      return () => clearInterval(interval);
    }
  }, [isOpen, fetchRequisitions]);

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
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-2">
          <button
            onClick={() => setActiveTab('incoming')}
            className={`pb-2.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'incoming'
                ? 'border-teal-700 text-teal-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Incoming Requisitions (Donor)</span>
            {pendingIncomingCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-rose-600 text-white font-mono animate-pulse">
                {pendingIncomingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('outgoing')}
            className={`pb-2.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'outgoing'
                ? 'border-teal-700 text-teal-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Outgoing Requests (Sent)</span>
            {activeOutgoingCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-teal-700 text-white font-mono">
                {activeOutgoingCount}
              </span>
            )}
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
          ) : (
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
