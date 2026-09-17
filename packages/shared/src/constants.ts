/**
 * DynamoDB Table Names
 */
export const TABLE_NAMES = {
  FACILITIES: 'Meditory_Facilities',
  WORKERS: 'Meditory_Workers',
  INVENTORY: 'Meditory_Inventory',
  AUDIT_LOGS: 'Meditory_AuditLogs',
} as const;

/**
 * Secondary Indexes
 */
export const INDEX_NAMES = {
  INVENTORY_BY_DRUG: 'DrugLookupIndex', // To find which clinics have a specific medicine
} as const;

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
