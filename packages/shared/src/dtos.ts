import { Facility, FacilityWorker, InventoryItem, AuditLogEntry, StockStatus, Requisition, RequisitionUrgency } from './types';

/**
 * Standard API Error Response
 */
export interface ApiErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  details?: unknown;
}

/**
 * Authentication DTOs
 */
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: FacilityWorker;
  facility: Facility;
}

/**
 * Clinic Inventory DTOs
 */
export interface GetInventoryResponse {
  facility: Facility;
  items: InventoryItem[];
  totalDrugs: number;
  lowStockCount: number;
  criticalStockoutCount: number;
}

/**
 * 1-Tap Dispense DTOs
 */
export interface DispenseRequest {
  drugId: string;
  delta?: number; // Defaults to -1
  quantity?: number;
  dispensedTo?: string; // Patient Name / OPD Case / Emergency Bed
  patientName?: string;
  notes?: string;
}

export interface DispenseResponse {
  success: boolean;
  drugId: string;
  drugName: string;
  previousQuantity: number;
  newQuantity: number;
  status: StockStatus;
  auditEntry: AuditLogEntry;
  alarmTriggered?: boolean;
}

/**
 * Stepped Restock DTOs
 */
export interface RestockRequest {
  drugId: string;
  quantity: number; // e.g. 10, 50, 100
}

export interface RestockResponse {
  success: boolean;
  drugId: string;
  drugName: string;
  previousQuantity: number;
  newQuantity: number;
  status: StockStatus;
  auditEntry: AuditLogEntry;
}

/**
 * Clinic Audit Trail DTOs
 */
export interface GetAuditLogsResponse {
  facilityId: string;
  logs: AuditLogEntry[];
}

/**
 * Inter-Clinic Referral & Stock Locator DTOs
 */
export interface StockLocatorFacilityResult {
  facilityId: string;
  facilityName: string;
  facilityType: string;
  districtName: string;
  phone: string;
  address: string;
  distanceKm: number;
  quantity: number;
  unit: string;
  status: StockStatus;
  lastVerifiedAt: string;
}

export interface StockLocatorResponse {
  drugId: string;
  drugName: string;
  genericName: string;
  isCritical: boolean;
  localQuantity: number;
  results: StockLocatorFacilityResult[];
}

/**
 * Inter-Clinic Requisition DTOs (Two-Way Handshake)
 */
export interface CreateRequisitionRequest {
  donorFacilityId: string;
  drugId: string;
  quantity: number;
  urgency?: RequisitionUrgency;
  patientNotes?: string;
}

export interface CreateRequisitionResponse {
  success: boolean;
  requisition: Requisition;
}

export interface GetRequisitionsResponse {
  incoming: Requisition[];
  outgoing: Requisition[];
  counts: {
    pendingIncoming: number;
    activeOutgoing: number;
  };
}

export interface RespondRequisitionRequest {
  requisitionId: string;
  action: 'APPROVE' | 'REJECT';
  reason?: string;
}

export interface RespondRequisitionResponse {
  success: boolean;
  requisition: Requisition;
}

export interface HandshakeDispenseRequest {
  requisitionId: string;
  handshakePin: string;
}

export interface HandshakeDispenseResponse {
  success: boolean;
  requisition: Requisition;
  newDonorQuantity: number;
}

export interface ConfirmIntakeRequest {
  requisitionId: string;
}

export interface ConfirmIntakeResponse {
  success: boolean;
  requisition: Requisition;
  newLocalQuantity: number;
}

/**
 * Offline-First Batch Synchronization DTOs
 */
export interface OfflineActionItem {
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

export interface SyncBatchRequest {
  actions: OfflineActionItem[];
}

export interface SyncActionResult {
  clientActionId: string;
  success: boolean;
  drugId: string;
  action: 'DISPENSE' | 'RESTOCK';
  newQuantity?: number;
  error?: string;
}

export interface SyncBatchResponse {
  success: boolean;
  syncedCount: number;
  results: SyncActionResult[];
  updatedInventory: InventoryItem[];
}

/**
 * Emergency Doctor & Clinic Phone Directory DTOs
 */
export interface DistrictDirectoryItem {
  id: string;
  name: string;
  email: string;
  role: string;
  facilityId: string;
  facilityName: string;
  facilityType: string;
  facilityAddress: string;
  facilityDistrict: string;
  facilityPhone: string;
  phone: string;
  isCurrentFacility?: boolean;
}

export interface ClinicDoctorsResponse {
  currentFacility: {
    id: string;
    name: string;
    address: string;
    districtName: string;
    phone: string;
    type: string;
  };
  doctors: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    facilityId: string;
    facilityName: string;
    facilityAddress: string;
    facilityDistrict: string;
    phone: string;
  }>;
  facilities: Array<{
    id: string;
    name: string;
    type: string;
    address: string;
    districtName: string;
    phone: string;
    isCurrent: boolean;
  }>;
  directory: DistrictDirectoryItem[];
}

