export type { FacilityType, DrugTier, StockStatus, AuditAction, RequisitionStatus, RequisitionUrgency } from './constants';
import type { FacilityType, DrugTier, StockStatus, AuditAction, RequisitionStatus, RequisitionUrgency } from './constants';

/**
 * Public Health Clinic / Facility Entity
 */
export interface Facility {
  id: string;              // e.g. "PHC-RAIGAD-01"
  name: string;            // e.g. "Alibag Primary Health Centre"
  districtId: string;      // e.g. "DISTRICT-RAIGAD"
  districtName: string;    // e.g. "Raigad"
  type: FacilityType;      // "PHC" | "CHC" | "SUB_CENTRE"
  phone: string;           // Clinic emergency contact
  address: string;
  latitude: number;
  longitude: number;
  createdAt: string;
}

/**
 * Facility Healthcare Worker / Staff Record
 */
export interface FacilityWorker {
  id: string;              // e.g. "USR-ALIBAG-01"
  facilityId: string;      // Scoped clinic ID
  name: string;            // e.g. "Dr. Ramesh Patil" / "Sunita Shinde"
  email: string;           // Work email (unique username for login)
  role: 'facility_worker'; // Single authenticated role
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  lastLoginAt?: string;
}

/**
 * Worker Record stored in DynamoDB (includes bcrypt password hash)
 */
export interface WorkerRecordDDB extends FacilityWorker {
  passwordHash: string;
}

/**
 * Master Drug Catalog Item
 */
export interface MasterDrug {
  id: string;              // e.g. "DRUG-ASV-01"
  genericName: string;     // e.g. "Polyvalent Anti-Snake Venom Serum"
  commonNames: string[];   // ["Anti-Snake Venom", "ASV", "Snakebite serum"]
  category: string;        // e.g. "Antidotes & Antivenoms"
  form: string;            // "10ml Injection Vial"
  tier: DrugTier;          // EMERGENCY | ESSENTIAL | ROUTINE
  isCritical: boolean;     // Emergency critical flag (triggers CloudWatch alarms)
  defaultThreshold: number;// e.g. 5 vials
}

/**
 * Clinic Inventory Shelf Item
 */
export interface InventoryItem {
  facilityId: string;
  drugId: string;
  drugName: string;
  genericName: string;
  category: string;
  form: string;
  quantity: number;
  unit: string;            // "vials", "tablets", "packets"
  threshold: number;       // Safety alert threshold
  tier: DrugTier;
  isCritical: boolean;
  status: StockStatus;     // IN_STOCK | LOW_STOCK | OUT_OF_STOCK
  lastDispensedAt?: string;
  lastRestockedAt?: string;
  updatedAt: string;
}

/**
 * Immutable Audit Trail Entry
 */
export interface AuditLogEntry {
  facilityId: string;
  timestamp: string;       // ISO string used as Sort Key (SK: AUDIT#<timestamp>)
  action: AuditAction;     // DISPENSE | RESTOCK | ADJUSTMENT
  delta: number;           // e.g. -1 for dispense, +10 for restock
  previousQuantity: number;
  newQuantity: number;
  drugId: string;
  drugName: string;
  workerId: string;
  workerName: string;
  dispensedTo?: string;    // Patient Name / OPD Case / Emergency Bed / Supplier Depot
  patientName?: string;    // Specific Patient Name if recorded
  notes?: string;          // Clinical or prescription reference notes
  batchNumber?: string;    // Lot / Batch reference
}

/**
 * Decoded JWT Session Payload
 */
export interface JWTPayload {
  userId: string;
  facilityId: string;
  facilityName: string;
  name: string;
  email: string;
  role: 'facility_worker';
  iat?: number;
  exp?: number;
}

/**
 * Inter-Clinic Medicine Requisition Entity (Two-Way Handshake)
 */
export interface Requisition {
  id: string;                      // e.g. "REQ-1726830000000-AB12"
  requesterFacilityId: string;     // e.g. "PHC-ALIBAG-01"
  requesterFacilityName: string;   // e.g. "Alibag Primary Health Centre"
  donorFacilityId: string;         // e.g. "CHC-PEN-01"
  donorFacilityName: string;       // e.g. "Pen Community Health Centre"
  drugId: string;                  // e.g. "DRUG-ASV-01"
  drugName: string;                // e.g. "Anti-Snake Venom (ASV) Polyvalent"
  genericName?: string;
  quantity: number;                // e.g. 2
  unit: string;                    // e.g. "vials"
  urgency: RequisitionUrgency;     // "EMERGENCY" | "ESSENTIAL" | "ROUTINE"
  status: RequisitionStatus;       // "PENDING" | "APPROVED" | "REJECTED" | "IN_TRANSIT" | "COMPLETED" | "CANCELLED"
  handshakePin?: string;           // 6-digit cryptographic PIN for pickup verification (e.g. "839201")
  patientNotes?: string;           // Emergency referral notes / patient case reference
  rejectionReason?: string;
  requestedByWorkerId: string;
  requestedByWorkerName: string;
  respondedByWorkerId?: string;
  respondedByWorkerName?: string;
  dispensedAt?: string;
  createdAt: string;               // ISO String
  updatedAt: string;               // ISO String
  completedAt?: string;            // ISO String
}
