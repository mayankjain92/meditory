import { Facility, FacilityWorker, InventoryItem, AuditLogEntry, StockStatus } from './types';

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
  quantity?: number; // Defaults to 1; supports prescribed batches like 2, 5, 10
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
