import {
  STORES,
  putRecord,
  getRecord,
  getAllRecords,
  deleteRecord,
  clearRecords,
} from './indexeddb';
import { api } from './api-client';

export interface QueuedAction {
  clientActionId: string;
  action: 'DISPENSE' | 'RESTOCK';
  drugId: string;
  drugName?: string;
  quantity: number;
  dispensedTo?: string;
  patientName?: string;
  notes?: string;
  batchNumber?: string;
  timestamp: string;
}

type SyncListener = (state: {
  isOffline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncAt: string | null;
}) => void;

let listeners: SyncListener[] = [];
let simulatedOffline = false;
let isSyncInProgress = false;
let lastSyncTimestamp: string | null = null;

export function isOfflineMode(): boolean {
  if (typeof window === 'undefined') return false;
  return simulatedOffline || !navigator.onLine;
}

export function setSimulatedOffline(val: boolean): void {
  simulatedOffline = val;
  notifyListeners();
}

export function getSimulatedOffline(): boolean {
  return simulatedOffline;
}

async function notifyListeners() {
  const pendingCount = await getPendingCount();
  const isOffline = isOfflineMode();
  for (const l of listeners) {
    l({
      isOffline,
      pendingCount,
      isSyncing: isSyncInProgress,
      lastSyncAt: lastSyncTimestamp,
    });
  }
}

export function subscribeToSync(listener: SyncListener): () => void {
  listeners.push(listener);
  // Emit initial state
  notifyListeners();
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

// Setup browser online/offline listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    notifyListeners();
    // Auto-sync when back online
    syncPendingActions().catch(() => {});
  });

  window.addEventListener('offline', () => {
    notifyListeners();
  });
}

/**
 * Cache complete shelf inventory in IndexedDB
 */
export async function cacheShelfInventory(items: any[]): Promise<void> {
  if (typeof window === 'undefined' || !items || !Array.isArray(items)) return;
  try {
    // Clear old/duplicate cached records first so local IndexedDB strictly mirrors authoritative DB state
    await clearRecords(STORES.INVENTORY);
    for (const item of items) {
      if (item.drugId) {
        await putRecord(STORES.INVENTORY, item);
      }
    }
    lastSyncTimestamp = new Date().toISOString();
    await putRecord(STORES.METADATA, { key: 'lastSyncTimestamp', value: lastSyncTimestamp });
    notifyListeners();
  } catch (err) {
    console.warn('[OfflineManager] Failed to cache inventory in IndexedDB:', err);
  }
}

/**
 * Retrieve shelf inventory from IndexedDB cache
 */
export async function getCachedShelfInventory(): Promise<any[]> {
  if (typeof window === 'undefined') return [];
  try {
    return await getAllRecords(STORES.INVENTORY);
  } catch {
    return [];
  }
}

/**
 * Optimistically apply offline dispense and queue action
 */
export async function queueOfflineDispense(
  drugId: string,
  quantity: number = 1,
  requestingClinicOrName?: string,
  notes?: string
): Promise<{ success: boolean; newQuantity: number; drugName: string; clientActionId: string }> {
  const clientActionId = `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  // 1. Get cached record and decrement optimistically
  let drugName = drugId;
  let newQuantity = 0;

  try {
    const cachedItem = await getRecord<any>(STORES.INVENTORY, drugId);
    if (cachedItem) {
      drugName = cachedItem.drugName || drugId;
      newQuantity = Math.max(0, (cachedItem.quantity || 0) - quantity);
      cachedItem.quantity = newQuantity;
      cachedItem.status = newQuantity <= 0 ? 'OUT_OF_STOCK' : newQuantity < (cachedItem.threshold || 10) ? 'LOW_STOCK' : 'IN_STOCK';
      cachedItem.lastDispensedAt = now;
      await putRecord(STORES.INVENTORY, cachedItem);
    }
  } catch (e) {
    console.warn('[OfflineManager] Could not update local item in IndexedDB:', e);
  }

  // 2. Add to offline queue (strictly Clinic-to-Clinic requisition mandate)
  const effectiveClinic = requestingClinicOrName?.trim() || 'Authorized Clinic Requisition';
  const actionRecord: QueuedAction = {
    clientActionId,
    action: 'DISPENSE',
    drugId,
    drugName,
    quantity,
    dispensedTo: effectiveClinic,
    notes: notes?.trim() || undefined,
    timestamp: now,
  };

  await putRecord(STORES.OFFLINE_QUEUE, actionRecord);
  await notifyListeners();

  return {
    success: true,
    newQuantity,
    drugName,
    clientActionId,
  };
}

/**
 * Optimistically apply offline restock and queue action
 */
export async function queueOfflineRestock(
  drugId: string,
  quantity: number,
  challanNumber?: string,
  drugMeta?: {
    drugName?: string;
    genericName?: string;
    category?: string;
    form?: string;
    unit?: string;
    threshold?: number;
    tier?: 'EMERGENCY' | 'ESSENTIAL' | 'ROUTINE';
    batchNumber?: string;
    expiryDate?: string;
    storageLocation?: string;
  }
): Promise<{ success: boolean; newQuantity: number; drugName: string; clientActionId: string }> {
  const clientActionId = `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  let drugName = drugMeta?.drugName || drugId;
  let newQuantity = quantity;

  try {
    const cachedItem = await getRecord<any>(STORES.INVENTORY, drugId);
    if (cachedItem) {
      drugName = cachedItem.drugName || drugMeta?.drugName || drugId;
      newQuantity = (cachedItem.quantity || 0) + quantity;
      cachedItem.quantity = newQuantity;
      cachedItem.status = newQuantity < (cachedItem.threshold || 10) ? 'LOW_STOCK' : 'IN_STOCK';
      cachedItem.lastRestockedAt = now;
      if (drugMeta?.batchNumber) cachedItem.batchNumber = drugMeta.batchNumber;
      if (drugMeta?.expiryDate) cachedItem.expiryDate = drugMeta.expiryDate;
      await putRecord(STORES.INVENTORY, cachedItem);
    } else if (drugMeta) {
      // New drug restocked while offline
      await putRecord(STORES.INVENTORY, {
        facilityId: 'PHC-ALIBAG-01',
        drugId,
        drugName: drugMeta.drugName || drugId,
        genericName: drugMeta.genericName || drugMeta.drugName || drugId,
        category: drugMeta.category || 'General',
        form: drugMeta.form || 'Tablet',
        quantity,
        unit: drugMeta.unit || 'Units',
        threshold: drugMeta.threshold || 20,
        tier: drugMeta.tier || 'ESSENTIAL',
        isCritical: drugMeta.tier === 'EMERGENCY',
        status: 'IN_STOCK',
        batchNumber: drugMeta.batchNumber,
        expiryDate: drugMeta.expiryDate,
        storageLocation: drugMeta.storageLocation,
        lastRestockedAt: now,
      });
    }
  } catch (e) {
    console.warn('[OfflineManager] Could not update local item in IndexedDB:', e);
  }

  const actionRecord: QueuedAction = {
    clientActionId,
    action: 'RESTOCK',
    drugId,
    drugName,
    quantity,
    dispensedTo: challanNumber ? `District Medical Depot (${challanNumber})` : 'Offline Depot Intake',
    notes: challanNumber ? `Challan: ${challanNumber}` : undefined,
    timestamp: now,
  };

  await putRecord(STORES.OFFLINE_QUEUE, actionRecord);
  await notifyListeners();

  return {
    success: true,
    newQuantity,
    drugName,
    clientActionId,
  };
}

/**
 * Get count of pending actions in queue
 */
export async function getPendingCount(): Promise<number> {
  if (typeof window === 'undefined') return 0;
  try {
    const records = await getAllRecords<QueuedAction>(STORES.OFFLINE_QUEUE);
    return records.length;
  } catch {
    return 0;
  }
}

/**
 * Get all queued offline actions
 */
export async function getQueuedActions(): Promise<QueuedAction[]> {
  if (typeof window === 'undefined') return [];
  try {
    return await getAllRecords<QueuedAction>(STORES.OFFLINE_QUEUE);
  } catch {
    return [];
  }
}

/**
 * Synchronize all pending offline actions with the backend
 */
export async function syncPendingActions(): Promise<{
  syncedCount: number;
  totalQueued: number;
  errors: string[];
}> {
  if (typeof window === 'undefined' || isSyncInProgress) {
    return { syncedCount: 0, totalQueued: 0, errors: [] };
  }

  if (isOfflineMode()) {
    throw new Error('Cannot sync: Workstation is currently offline or offline simulation is enabled.');
  }

  const queuedActions = await getQueuedActions();
  if (queuedActions.length === 0) {
    return { syncedCount: 0, totalQueued: 0, errors: [] };
  }

  isSyncInProgress = true;
  notifyListeners();

  try {
    const payload = {
      actions: queuedActions.map((a) => ({
        clientActionId: a.clientActionId,
        action: a.action,
        drugId: a.drugId,
        quantity: a.quantity,
        dispensedTo: a.dispensedTo,
        patientName: a.patientName,
        notes: a.notes,
        timestamp: a.timestamp,
      })),
    };

    const res = await api.post<{
      success: boolean;
      syncedCount: number;
      results: Array<{ clientActionId: string; success: boolean; error?: string }>;
      updatedInventory: any[];
    }>('/api/clinic/sync-batch', payload);

    const errors: string[] = [];

    // Delete confirmed actions from IndexedDB queue
    if (res.results && Array.isArray(res.results)) {
      for (const r of res.results) {
        // Delete action whether success or permanent rejection so it does not permanently poison the queue
        await deleteRecord(STORES.OFFLINE_QUEUE, r.clientActionId);
        if (r.error) {
          errors.push(r.error);
        }
      }
    }

    // Refresh local cache with server's confirmed stock
    if (res.updatedInventory && Array.isArray(res.updatedInventory)) {
      await cacheShelfInventory(res.updatedInventory);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('meditory:inventory-synced', {
            detail: res.updatedInventory,
          })
        );
      }
    }

    lastSyncTimestamp = new Date().toISOString();
    return {
      syncedCount: res.syncedCount || 0,
      totalQueued: queuedActions.length,
      errors,
    };
  } finally {
    isSyncInProgress = false;
    notifyListeners();
  }
}

/**
 * Explicitly clear all queued offline actions (e.g. to recover from stuck mock items)
 */
export async function clearOfflineQueue(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await clearRecords(STORES.OFFLINE_QUEUE);
    await notifyListeners();
  } catch (err) {
    console.warn('[OfflineManager] Failed to clear offline queue:', err);
  }
}
