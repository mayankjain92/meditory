import bcrypt from 'bcryptjs';
import { PutCommand, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import {
  TABLE_NAMES,
  STOCK_STATUS,
  DRUG_TIER,
  FACILITY_TYPE,
  AUDIT_ACTION,
  Facility,
  FacilityWorker,
  InventoryItem,
  MasterDrug,
  StockStatus,
} from '@meditory/shared';
import { docClient, ensureTablesExist, isLocal, localEndpoint } from '../shared/ddb.js';

const SEED_PASSWORD = 'Password@123';
const hashedPassword = bcrypt.hashSync(SEED_PASSWORD, 10);

/**
 * 1. Health Facilities in Raigad District, Maharashtra
 */
export const SEED_FACILITIES: Facility[] = [
  {
    id: 'PHC-ALIBAG-01',
    name: 'Alibag Primary Health Centre',
    districtId: 'DISTRICT-RAIGAD',
    districtName: 'Raigad',
    type: FACILITY_TYPE.PHC,
    phone: '+91 2141 222045',
    address: 'Near Civil Hospital, Rewas Road, Alibag, Raigad - 402201',
    latitude: 18.6414,
    longitude: 72.8722,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'PHC-VADKHAL-02',
    name: 'Vadkhal Primary Health Centre',
    districtId: 'DISTRICT-RAIGAD',
    districtName: 'Raigad',
    type: FACILITY_TYPE.PHC,
    phone: '+91 2143 252110',
    address: 'NH 66 Junction, Vadkhal Naka, Pen Taluka, Raigad - 402107',
    latitude: 18.7231,
    longitude: 73.0845,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'CHC-PEN-03',
    name: 'Pen Community Health Centre',
    districtId: 'DISTRICT-RAIGAD',
    districtName: 'Raigad',
    type: FACILITY_TYPE.CHC,
    phone: '+91 2143 252030',
    address: 'Sub-District Hospital Complex, Antora Road, Pen, Raigad - 402107',
    latitude: 18.7354,
    longitude: 73.0976,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

/**
 * 2. Clinic Staff Accounts (Login Credentials)
 */
export const SEED_WORKERS = [
  {
    id: 'USR-ALIBAG-01',
    facilityId: 'PHC-ALIBAG-01',
    name: 'Dr. Rahul Sharma',
    email: 'rahul.sharma@phc-alibag.in',
    role: 'facility_worker' as const,
    status: 'ACTIVE' as const,
    passwordHash: hashedPassword,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'USR-ALIBAG-02',
    facilityId: 'PHC-ALIBAG-01',
    name: 'Dr. Anjali Deshmukh',
    email: 'anjali.deshmukh@phc-alibag.in',
    role: 'facility_worker' as const,
    status: 'ACTIVE' as const,
    passwordHash: hashedPassword,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'USR-ALIBAG-03',
    facilityId: 'PHC-ALIBAG-01',
    name: 'Dr. Suresh Gaikwad',
    email: 'suresh.gaikwad@phc-alibag.in',
    role: 'facility_worker' as const,
    status: 'ACTIVE' as const,
    passwordHash: hashedPassword,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'USR-ALIBAG-04',
    facilityId: 'PHC-ALIBAG-01',
    name: 'Dr. Sneha Patil',
    email: 'sneha.patil@phc-alibag.in',
    role: 'facility_worker' as const,
    status: 'ACTIVE' as const,
    passwordHash: hashedPassword,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'USR-ALIBAG-05',
    facilityId: 'PHC-ALIBAG-01',
    name: 'Dr. Vikram Shinde',
    email: 'vikram.shinde@phc-alibag.in',
    role: 'facility_worker' as const,
    status: 'ACTIVE' as const,
    passwordHash: hashedPassword,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'USR-VADKHAL-02',
    facilityId: 'PHC-VADKHAL-02',
    name: 'Dr. Priya Deshmukh',
    email: 'priya.deshmukh@phc-vadkhal.in',
    role: 'facility_worker' as const,
    status: 'ACTIVE' as const,
    passwordHash: hashedPassword,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'USR-VADKHAL-03',
    facilityId: 'PHC-VADKHAL-02',
    name: 'Dr. Rohan Mhatre',
    email: 'rohan.mhatre@phc-vadkhal.in',
    role: 'facility_worker' as const,
    status: 'ACTIVE' as const,
    passwordHash: hashedPassword,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'USR-PEN-03',
    facilityId: 'CHC-PEN-03',
    name: 'Dr. Amit Patil',
    email: 'amit.patil@chc-pen.in',
    role: 'facility_worker' as const,
    status: 'ACTIVE' as const,
    passwordHash: hashedPassword,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'USR-PEN-04',
    facilityId: 'CHC-PEN-03',
    name: 'Dr. Kavita Joshi',
    email: 'kavita.joshi@chc-pen.in',
    role: 'facility_worker' as const,
    status: 'ACTIVE' as const,
    passwordHash: hashedPassword,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

/**
 * 3. Master Medicines Catalog
 */
export const SEED_DRUGS: MasterDrug[] = [
  {
    id: 'DRUG-ASV-01',
    genericName: 'Polyvalent Anti-Snake Venom Serum',
    commonNames: ['Anti-Snake Venom', 'ASV', 'Snakebite injection'],
    category: 'Antidotes & Antivenoms',
    form: '10ml Injection Vial',
    tier: DRUG_TIER.EMERGENCY,
    isCritical: true,
    defaultThreshold: 5,
  },
  {
    id: 'DRUG-ARV-02',
    genericName: 'Anti-Rabies Vaccine (Purified Chick Embryo)',
    commonNames: ['Anti-Rabies Vaccine', 'ARV', 'Dog bite vaccine'],
    category: 'Vaccines & Immunoglobulins',
    form: '1ml Injection Vial',
    tier: DRUG_TIER.EMERGENCY,
    isCritical: true,
    defaultThreshold: 10,
  },
  {
    id: 'DRUG-ADR-05',
    genericName: 'Adrenaline Injection (1:1000)',
    commonNames: ['Adrenaline', 'Epinephrine'],
    category: 'Cardiovascular & Anaphylaxis',
    form: '1mg/ml Ampoule',
    tier: DRUG_TIER.EMERGENCY,
    isCritical: true,
    defaultThreshold: 5,
  },
  {
    id: 'DRUG-ORS-03',
    genericName: 'Oral Rehydration Salts (WHO Formula)',
    commonNames: ['ORS', 'Electral'],
    category: 'Electrolytes & Fluids',
    form: '20.5g Powder Packet',
    tier: DRUG_TIER.ESSENTIAL,
    isCritical: false,
    defaultThreshold: 50,
  },
  {
    id: 'DRUG-PCM-04',
    genericName: 'Paracetamol Tablets',
    commonNames: ['Paracetamol', 'PCM', 'Crocin'],
    category: 'Analgesics & Antipyretics',
    form: '500mg Tablet',
    tier: DRUG_TIER.ESSENTIAL,
    isCritical: false,
    defaultThreshold: 100,
  },
  {
    id: 'DRUG-AMX-06',
    genericName: 'Amoxicillin Capsules',
    commonNames: ['Amoxicillin', 'Mox'],
    category: 'Antimicrobials',
    form: '500mg Capsule',
    tier: DRUG_TIER.ESSENTIAL,
    isCritical: false,
    defaultThreshold: 50,
  },
];

/**
 * 4. Realistic Inventory Distribution Across Clinics
 */
const INVENTORY_MATRIX = [
  // Alibag PHC (Demonstrates Stock-Out on ASV -> Emergency Referral Demo)
  { facilityId: 'PHC-ALIBAG-01', drugId: 'DRUG-ASV-01', quantity: 0, threshold: 5 },
  { facilityId: 'PHC-ALIBAG-01', drugId: 'DRUG-ARV-02', quantity: 14, threshold: 10 },
  { facilityId: 'PHC-ALIBAG-01', drugId: 'DRUG-ADR-05', quantity: 8, threshold: 5 },
  { facilityId: 'PHC-ALIBAG-01', drugId: 'DRUG-ORS-03', quantity: 120, threshold: 50 },
  { facilityId: 'PHC-ALIBAG-01', drugId: 'DRUG-PCM-04', quantity: 450, threshold: 100 },
  { facilityId: 'PHC-ALIBAG-01', drugId: 'DRUG-AMX-06', quantity: 80, threshold: 50 },

  // Vadkhal PHC (Demonstrates Low Stock on ASV -> CloudWatch Alarm Demo)
  { facilityId: 'PHC-VADKHAL-02', drugId: 'DRUG-ASV-01', quantity: 2, threshold: 5 },
  { facilityId: 'PHC-VADKHAL-02', drugId: 'DRUG-ARV-02', quantity: 4, threshold: 10 },
  { facilityId: 'PHC-VADKHAL-02', drugId: 'DRUG-ADR-05', quantity: 6, threshold: 5 },
  { facilityId: 'PHC-VADKHAL-02', drugId: 'DRUG-ORS-03', quantity: 45, threshold: 50 },
  { facilityId: 'PHC-VADKHAL-02', drugId: 'DRUG-PCM-04', quantity: 210, threshold: 100 },
  { facilityId: 'PHC-VADKHAL-02', drugId: 'DRUG-AMX-06', quantity: 30, threshold: 50 },

  // Pen CHC (High Stock -> Referral Destination with 25 Vials of ASV)
  { facilityId: 'CHC-PEN-03', drugId: 'DRUG-ASV-01', quantity: 25, threshold: 5 },
  { facilityId: 'CHC-PEN-03', drugId: 'DRUG-ARV-02', quantity: 40, threshold: 10 },
  { facilityId: 'CHC-PEN-03', drugId: 'DRUG-ADR-05', quantity: 18, threshold: 5 },
  { facilityId: 'CHC-PEN-03', drugId: 'DRUG-ORS-03', quantity: 320, threshold: 50 },
  { facilityId: 'CHC-PEN-03', drugId: 'DRUG-PCM-04', quantity: 1100, threshold: 100 },
  { facilityId: 'CHC-PEN-03', drugId: 'DRUG-AMX-06', quantity: 240, threshold: 50 },
];

function calculateStatus(quantity: number, threshold: number): StockStatus {
  if (quantity <= 0) return STOCK_STATUS.OUT_OF_STOCK;
  if (quantity < threshold) return STOCK_STATUS.LOW_STOCK;
  return STOCK_STATUS.IN_STOCK;
}

export async function runSeed(): Promise<void> {
  console.log(`\n======================================================`);
  console.log(`[Seed] Initializing Meditory Multi-Table Seed Sequence...`);
  console.log(`[Seed] Tables: ${Object.values(TABLE_NAMES).join(', ')}`);
  console.log(`[Seed] Endpoint: ${isLocal ? localEndpoint : 'AWS Cloud'}`);
  console.log(`======================================================\n`);

  await ensureTablesExist();

  // 1. Seed Facilities
  console.log(`[Seed] Seeding ${SEED_FACILITIES.length} Health Facilities into '${TABLE_NAMES.FACILITIES}'...`);
  for (const fac of SEED_FACILITIES) {
    await docClient.send(new PutCommand({ TableName: TABLE_NAMES.FACILITIES, Item: fac }));
  }

  // 2. Seed Workers
  console.log(`[Seed] Seeding ${SEED_WORKERS.length} Clinic Workers into '${TABLE_NAMES.WORKERS}'...`);
  for (const worker of SEED_WORKERS) {
    await docClient.send(new PutCommand({ TableName: TABLE_NAMES.WORKERS, Item: worker }));
  }

  // 3. Seed Inventories & Initial Audit Logs
  console.log(`[Seed] Seeding ${INVENTORY_MATRIX.length} Inventory Records into '${TABLE_NAMES.INVENTORY}'...`);
  const now = new Date().toISOString();

  // Clear unseeded ephemeral inventory items ONLY for the 3 demo baseline facilities
  try {
    const existingInv = await docClient.send(new ScanCommand({ TableName: TABLE_NAMES.INVENTORY }));
    if (existingInv.Items) {
      const demoFacilityIds = new Set(['PHC-ALIBAG-01', 'PHC-VADKHAL-02', 'CHC-PEN-03']);
      for (const item of existingInv.Items) {
        if (demoFacilityIds.has(item.facilityId)) {
          const isMatrix = INVENTORY_MATRIX.some((m) => m.facilityId === item.facilityId && m.drugId === item.drugId);
          if (!isMatrix) {
            await docClient.send(new DeleteCommand({ TableName: TABLE_NAMES.INVENTORY, Key: { facilityId: item.facilityId, drugId: item.drugId } }));
          }
        }
      }
    }
  } catch {}

  for (const inv of INVENTORY_MATRIX) {
    const drugMeta = SEED_DRUGS.find((d) => d.id === inv.drugId)!;
    const status = calculateStatus(inv.quantity, inv.threshold);

    const inventoryItem: InventoryItem = {
      facilityId: inv.facilityId,
      drugId: inv.drugId,
      drugName: drugMeta.commonNames[0],
      genericName: drugMeta.genericName,
      category: drugMeta.category,
      form: drugMeta.form,
      quantity: inv.quantity,
      unit: drugMeta.form.split(' ')[1] || 'units',
      threshold: inv.threshold,
      tier: drugMeta.tier,
      isCritical: drugMeta.isCritical,
      status,
      updatedAt: now,
      lastRestockedAt: now,
    };

    await docClient.send(new PutCommand({ TableName: TABLE_NAMES.INVENTORY, Item: inventoryItem }));

    // Create an initial audit log entry
    const auditItem = {
      facilityId: inv.facilityId,
      timestamp: now,
      action: AUDIT_ACTION.RESTOCK,
      delta: inv.quantity,
      previousQuantity: 0,
      newQuantity: inv.quantity,
      drugId: inv.drugId,
      drugName: drugMeta.commonNames[0],
      workerId: 'SYSTEM_INIT',
      workerName: 'District Supply Onboarding',
      dispensedTo: 'Raigad District Medical Depot (Initial Allocation)',
      batchNumber: 'LOT-2026-01',
    };

    await docClient.send(new PutCommand({ TableName: TABLE_NAMES.AUDIT_LOGS, Item: auditItem }));
  }

  // Pre-seed a few realistic patient dispenses for Alibag PHC audit trail
  const sampleDispenses = [
    {
      facilityId: 'PHC-ALIBAG-01',
      timestamp: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
      action: AUDIT_ACTION.DISPENSE,
      delta: -10,
      previousQuantity: 500,
      newQuantity: 490,
      drugId: 'DRUG-PCM-04',
      drugName: 'Paracetamol',
      workerId: 'USR-ALIBAG-01',
      workerName: 'Dr. Rahul Sharma',
      dispensedTo: 'Sunita Jadhav (OPD-2026-4891)',
      patientName: 'Sunita Jadhav',
      notes: 'OPD-2026-4891: High Fever & Body Ache',
      batchNumber: 'LOT-2026-44',
    },
    {
      facilityId: 'PHC-ALIBAG-01',
      timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      action: AUDIT_ACTION.DISPENSE,
      delta: -1,
      previousQuantity: 14,
      newQuantity: 13,
      drugId: 'DRUG-ARV-02',
      drugName: 'Anti-Rabies Vaccine',
      workerId: 'USR-ALIBAG-01',
      workerName: 'Dr. Rahul Sharma',
      dispensedTo: 'Ramesh Patil (Casualty Bite Protocol)',
      patientName: 'Ramesh Patil',
      notes: 'Post-Exposure Prophylaxis (Stray Dog Bite, Grade III)',
      batchNumber: 'LOT-2026-19',
    },
  ];

  for (const dispense of sampleDispenses) {
    await docClient.send(new PutCommand({ TableName: TABLE_NAMES.AUDIT_LOGS, Item: dispense }));
  }

  console.log(`\n✅ [Seed] Successfully seeded all data across separate domain tables!`);
  console.log(`\n📋 Pre-seeded Credentials for Hackathon Demo:`);
  console.log(`------------------------------------------------------------------------`);
  console.log(`1. Alibag PHC (Demonstrates 0 ASV Stock & Referral to Pen CHC):`);
  console.log(`   Email: rahul.sharma@phc-alibag.in | Password: ${SEED_PASSWORD}`);
  console.log(`2. Vadkhal PHC (Demonstrates Low Stock Alarm Trigger on ASV):`);
  console.log(`   Email: priya.deshmukh@phc-vadkhal.in | Password: ${SEED_PASSWORD}`);
  console.log(`3. Pen CHC (Demonstrates High Stock & Referral Destination):`);
  console.log(`   Email: amit.patil@chc-pen.in | Password: ${SEED_PASSWORD}`);
  console.log(`------------------------------------------------------------------------\n`);
}

if (process.argv[1]?.endsWith('seed-data.ts') || process.argv[1]?.endsWith('seed-data.js')) {
  runSeed().catch((err) => {
    console.error(`❌ [Seed] Error seeding database:`, err);
    process.exit(1);
  });
}
