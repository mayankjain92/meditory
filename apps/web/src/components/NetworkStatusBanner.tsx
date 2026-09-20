'use client';

import React, { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ChevronDown,
  X,
  Database,
  ArrowUpCircle,
} from 'lucide-react';
import {
  isOfflineMode,
  getPendingCount,
  getQueuedActions,
  syncPendingActions,
  clearOfflineQueue,
  subscribeToSync,
  QueuedAction,
} from '@/lib/offline-sync-manager';

export default function NetworkStatusBanner({ onSyncComplete }: { onSyncComplete?: () => void }) {
  const [isOffline, setIsOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isQueueModalOpen, setIsQueueModalOpen] = useState(false);
  const [queuedActions, setQueuedActions] = useState<QueuedAction[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    const unsubscribe = subscribeToSync((state) => {
      setIsOffline(state.isOffline);
      setPendingCount(state.pendingCount);
      setIsSyncing(state.isSyncing);
      setLastSync(state.lastSyncAt);
    });

    return () => unsubscribe();
  }, []);

  const handleSyncClick = async () => {
    if (isOffline) {
      showToast('Cannot sync while offline. Please reconnect first.');
      return;
    }
    if (pendingCount === 0) {
      showToast('No pending offline actions. Inventory is up to date.');
      return;
    }

    try {
      const res = await syncPendingActions();
      showToast(`Successfully synchronized ${res.syncedCount} queued actions with backend!`);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('meditory:inventory-synced'));
      }
      if (onSyncComplete) onSyncComplete();
    } catch (err: unknown) {
      showToast((err as Error).message || 'Sync failed.');
    }
  };

  const handleClearQueue = async () => {
    await clearOfflineQueue();
    setQueuedActions([]);
    showToast('🗑️ Cleared offline queue.');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('meditory:inventory-synced'));
    }
  };

  const handleOpenQueueModal = async () => {
    const actions = await getQueuedActions();
    setQueuedActions(actions);
    setIsQueueModalOpen(true);
  };

  return (
    <>
      {/* Navbar Telemetry Widget */}
      <div className="flex items-center gap-2">
        {/* Network State Pill */}
        <div
          onClick={handleOpenQueueModal}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all border ${
            isOffline
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : pendingCount > 0
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
          title="Click to view pending offline actions"
        >
          {isOffline ? (
            <WifiOff className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
          ) : (
            <Wifi className="w-3.5 h-3.5 text-emerald-600" />
          )}

          <span>
            {isOffline
              ? 'Offline'
              : pendingCount > 0
              ? 'Online'
              : 'Online • Synced'}
          </span>

          {pendingCount > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] font-bold ${
                isOffline ? 'bg-rose-600 text-white animate-pulse' : 'bg-amber-600 text-white'
              }`}
            >
              {pendingCount} queued
            </span>
          )}
        </div>

        {/* Sync Now Button */}
        <button
          type="button"
          onClick={handleSyncClick}
          disabled={isSyncing || isOffline || pendingCount === 0}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shadow-xs border ${
            pendingCount > 0 && !isOffline
              ? 'bg-teal-700 hover:bg-teal-800 text-white border-teal-800 animate-pulse active:scale-95 cursor-pointer'
              : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
          }`}
          title={
            isOffline
              ? 'Reconnect to sync queued actions'
              : pendingCount === 0
              ? 'All actions synced to cloud'
              : `Sync ${pendingCount} pending offline actions now`
          }
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-white' : ''}`} />
          <span>{isSyncing ? 'Syncing...' : '⚡ Sync Now'}</span>
        </button>
      </div>

      {/* Floating Offline Queue Drawer / Modal */}
      {isQueueModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-teal-400" />
                <div>
                  <h3 className="font-bold text-sm">Offline Action Queue</h3>
                  <p className="text-[10px] text-slate-400">Local emergency storage for offline dispensary shifts</p>
                </div>
              </div>
              <button
                onClick={() => setIsQueueModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs text-slate-700 max-h-[60vh] overflow-y-auto">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Queue Status</span>
                  <p className="text-xs font-bold text-slate-900">
                    {queuedActions.length} Pending Actions in Local Queue
                  </p>
                </div>
                <button
                  onClick={handleSyncClick}
                  disabled={isSyncing || isOffline || queuedActions.length === 0}
                  className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-40 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Sync to Cloud</span>
                </button>
              </div>

              {queuedActions.length === 0 ? (
                <div className="py-8 text-center text-slate-400 space-y-1">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500/60" />
                  <p className="font-semibold text-xs text-slate-600">Local Queue Empty</p>
                  <p className="text-[11px]">All clinic dispenses and restocks are fully synchronized.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {queuedActions.map((action) => (
                    <div
                      key={action.clientActionId}
                      className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${
                            action.action === 'DISPENSE'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {action.action}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {new Date(action.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="font-semibold text-slate-900">
                        {action.action === 'DISPENSE' ? '-' : '+'}
                        {action.quantity} {action.drugName || action.drugId}
                      </p>
                      {action.dispensedTo && (
                        <p className="text-[11px] text-slate-500">Recipient: {action.dispensedTo}</p>
                      )}
                      <p className="text-[10px] font-mono text-slate-400 truncate">
                        ID: {action.clientActionId}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
              {queuedActions.length > 0 ? (
                <button
                  type="button"
                  onClick={handleClearQueue}
                  className="px-2.5 py-1 text-rose-700 hover:text-rose-900 hover:bg-rose-50 border border-rose-200 rounded font-semibold transition-colors"
                >
                  Clear Queue ({queuedActions.length})
                </button>
              ) : (
                <span>Auto-replays when online</span>
              )}
              <button
                onClick={() => setIsQueueModalOpen(false)}
                className="px-3 py-1 bg-white border border-slate-300 rounded text-slate-700 font-semibold hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-2.5 text-xs animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </>
  );
}
