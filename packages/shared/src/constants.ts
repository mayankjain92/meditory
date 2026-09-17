/**
 * DynamoDB Single-Table Key Prefixes & Identifiers
 */
export const DDB_PREFIX = {
  FACILITY: 'FACILITY#',
  USER: 'USER#',
  DRUG: 'DRUG#',
  AUDIT: 'AUDIT#',
  STATUS: 'STATUS#',
  DISTRICT: 'DISTRICT#',
  METADATA: 'METADATA',
} as const;

export const GSI1_INDEX_NAME = 'GSI1';

/**
 * Standard Stock Statuses
 */
export const STOCK_STATUS = {
  IN_STOCK: 'IN_STOCK',
  LOW_STOCK: 'LOW_STOCK',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
} as const;

export type StockStatus = (typeof STOCK_STATUS)[keyof typeof STOCK_STATUS];

/**
 * Indian Public Health Standards (IPHS) Medicine Priority Tiers
 */
export const DRUG_TIER = {
  EMERGENCY: 'EMERGENCY', // Anti-Snake Venom, Anti-Rabies Vaccine, Adrenaline
  ESSENTIAL: 'ESSENTIAL', // ORS, Paracetamol, Amoxicillin, Metformin
  ROUTINE: 'ROUTINE',     // Multivitamins, Antacids, Iron-Folic Acid
} as const;

export type DrugTier = (typeof DRUG_TIER)[keyof typeof DRUG_TIER];

/**
 * Facility Types according to National Health Mission (NHM)
 */
export const FACILITY_TYPE = {
  SUB_CENTRE: 'SUB_CENTRE',
  PHC: 'PHC', // Primary Health Centre
  CHC: 'CHC', // Community Health Centre
} as const;

export type FacilityType = (typeof FACILITY_TYPE)[keyof typeof FACILITY_TYPE];

/**
 * Inventory Mutation Audit Actions
 */
export const AUDIT_ACTION = {
  DISPENSE: 'DISPENSE',
  RESTOCK: 'RESTOCK',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;

export type AuditAction = (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION];
