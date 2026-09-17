export interface InventoryItemState {
  facilityId: string;
  drugId: string;
  drugName: string;
  genericName: string;
  category: string;
  form: string;
  batchNumber: string;
  expiryDate: string;
  storageLocation: string;
  quantity: number;
  unit: string;
  threshold: number;
  tier: 'EMERGENCY' | 'ESSENTIAL' | 'ROUTINE';
  isCritical: boolean;
  status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  updatedAt: string;
}

export interface AuditLogItem {
  id: string;
  facilityId: string;
  timestamp: string;
  action: 'DISPENSE' | 'RESTOCK' | 'ADJUSTMENT';
  delta: number;
  previousQuantity: number;
  newQuantity: number;
  drugId: string;
  drugName: string;
  batchNumber: string;
  workerId: string;
  workerName: string;
  sha256Hash: string;
}

// In-memory persistent state during server runtime
export const globalInventory: InventoryItemState[] = [
  {
    facilityId: 'PHC-SECTOR4-01',
    drugId: 'DRUG-ASV-01',
    drugName: 'Anti-Snake Venom (ASV)',
    genericName: 'Polyvalent Anti-Snake Venom Serum',
    category: 'Antidotes & Antivenoms',
    form: '10ml Injection Vial',
    batchNumber: 'ASV-2024-88A',
    expiryDate: 'Feb 2027',
    storageLocation: 'ILR Unit 1 (3.1°C)',
    quantity: 28,
    unit: 'vials',
    threshold: 10,
    tier: 'EMERGENCY',
    isCritical: true,
    status: 'IN_STOCK',
    updatedAt: '2026-09-17T13:30:00.000Z',
  },
  {
    facilityId: 'PHC-SECTOR4-01',
    drugId: 'DRUG-ARV-01',
    drugName: 'Anti-Rabies Vaccine (ARV)',
    genericName: 'Purified Chick Embryo Cell Vaccine',
    category: 'Biologicals & Vaccines',
    form: '0.5ml Injection Vial',
    batchNumber: 'RBV-992-B',
    expiryDate: 'Dec 2025',
    storageLocation: 'ILR Unit 2 (3.4°C)',
    quantity: 4,
    unit: 'vials',
    threshold: 15,
    tier: 'EMERGENCY',
    isCritical: true,
    status: 'LOW_STOCK',
    updatedAt: '2026-09-17T13:30:00.000Z',
  },
  {
    facilityId: 'PHC-SECTOR4-01',
    drugId: 'DRUG-ADR-01',
    drugName: 'Adrenaline (Epinephrine)',
    genericName: 'Adrenaline Injection IP 1:1000',
    category: 'Cardiovascular & Emergency',
    form: '1ml Ampoule',
    batchNumber: 'ADR-2024-19C',
    expiryDate: 'Nov 2026',
    storageLocation: 'Emergency Crash Cart A',
    quantity: 42,
    unit: 'ampoules',
    threshold: 20,
    tier: 'EMERGENCY',
    isCritical: true,
    status: 'IN_STOCK',
    updatedAt: '2026-09-17T13:30:00.000Z',
  },
  {
    facilityId: 'PHC-SECTOR4-01',
    drugId: 'DRUG-OXY-01',
    drugName: 'Oxytocin Injection IP',
    genericName: 'Oxytocin 10 IU/ml',
    category: 'Maternal Health',
    form: '1ml Ampoule',
    batchNumber: 'OXY-881-A',
    expiryDate: 'Aug 2026',
    storageLocation: 'Cold Storage Shelf C (4°C)',
    quantity: 18,
    unit: 'ampoules',
    threshold: 15,
    tier: 'EMERGENCY',
    isCritical: true,
    status: 'IN_STOCK',
    updatedAt: '2026-09-17T13:30:00.000Z',
  },
  {
    facilityId: 'PHC-SECTOR4-01',
    drugId: 'DRUG-PCM-01',
    drugName: 'Paracetamol Tablets IP',
    genericName: 'Paracetamol 500mg',
    category: 'Analgesics & Antipyretics',
    form: 'Blister Pack (10 tabs)',
    batchNumber: 'PCM-2024-110',
    expiryDate: 'Oct 2027',
    storageLocation: 'Shelf A-3 (Dry Storage)',
    quantity: 850,
    unit: 'tablets',
    threshold: 200,
    tier: 'ESSENTIAL',
    isCritical: false,
    status: 'IN_STOCK',
    updatedAt: '2026-09-17T13:30:00.000Z',
  },
  {
    facilityId: 'PHC-SECTOR4-01',
    drugId: 'DRUG-ORS-01',
    drugName: 'Oral Rehydration Salts (ORS)',
    genericName: 'WHO Standard Oral Rehydration Formula',
    category: 'Gastrointestinal & Fluids',
    form: '20.5g Sachet Packet',
    batchNumber: 'ORS-904-D',
    expiryDate: 'Jan 2028',
    storageLocation: 'Shelf B-1',
    quantity: 340,
    unit: 'packets',
    threshold: 100,
    tier: 'ESSENTIAL',
    isCritical: false,
    status: 'IN_STOCK',
    updatedAt: '2026-09-17T13:30:00.000Z',
  },
  {
    facilityId: 'PHC-SECTOR4-01',
    drugId: 'DRUG-AMX-01',
    drugName: 'Amoxicillin Capsules IP',
    genericName: 'Amoxicillin 500mg',
    category: 'Antibiotics & Antimicrobial',
    form: 'Strip of 10 Capsules',
    batchNumber: 'AMX-551-F',
    expiryDate: 'Mar 2026',
    storageLocation: 'Shelf C-2',
    quantity: 65,
    unit: 'capsules',
    threshold: 100,
    tier: 'ESSENTIAL',
    isCritical: false,
    status: 'LOW_STOCK',
    updatedAt: '2026-09-17T13:30:00.000Z',
  },
  {
    facilityId: 'PHC-SECTOR4-01',
    drugId: 'DRUG-MET-01',
    drugName: 'Metformin Hydrochloride Tablets',
    genericName: 'Metformin 500mg',
    category: 'Chronic NCDs (Endocrine)',
    form: 'Blister Pack (15 tabs)',
    batchNumber: 'MET-2024-91',
    expiryDate: 'May 2027',
    storageLocation: 'Shelf NCD-1',
    quantity: 520,
    unit: 'tablets',
    threshold: 150,
    tier: 'ESSENTIAL',
    isCritical: false,
    status: 'IN_STOCK',
    updatedAt: '2026-09-17T13:30:00.000Z',
  },
  {
    facilityId: 'PHC-SECTOR4-01',
    drugId: 'DRUG-AML-01',
    drugName: 'Amlodipine Besylate Tablets',
    genericName: 'Amlodipine 5mg',
    category: 'Chronic NCDs (Hypertension)',
    form: 'Strip of 10 Tablets',
    batchNumber: 'AML-440-C',
    expiryDate: 'Sep 2026',
    storageLocation: 'Shelf NCD-2',
    quantity: 210,
    unit: 'tablets',
    threshold: 100,
    tier: 'ESSENTIAL',
    isCritical: false,
    status: 'IN_STOCK',
    updatedAt: '2026-09-17T13:30:00.000Z',
  },
];

export const globalAuditLogs: AuditLogItem[] = [
  {
    id: 'TXN-882194',
    facilityId: 'PHC-SECTOR4-01',
    timestamp: '2026-09-17T13:18:24.000Z',
    action: 'DISPENSE',
    delta: -1,
    previousQuantity: 5,
    newQuantity: 4,
    drugId: 'DRUG-ARV-01',
    drugName: 'Anti-Rabies Vaccine (ARV)',
    batchNumber: 'RBV-992-B',
    workerId: 'USR-ALIBAG-01',
    workerName: 'Dr. Rahul Sharma',
    sha256Hash: 'a7f0c89e21...84db',
  },
  {
    id: 'TXN-882190',
    facilityId: 'PHC-SECTOR4-01',
    timestamp: '2026-09-17T12:45:12.000Z',
    action: 'RESTOCK',
    delta: 50,
    previousQuantity: 800,
    newQuantity: 850,
    drugId: 'DRUG-PCM-01',
    drugName: 'Paracetamol Tablets IP',
    batchNumber: 'PCM-2024-110',
    workerId: 'USR-ALIBAG-01',
    workerName: 'Dr. Rahul Sharma',
    sha256Hash: 'e92a44bd10...67ec',
  },
  {
    id: 'TXN-882181',
    facilityId: 'PHC-SECTOR4-01',
    timestamp: '2026-09-17T11:20:00.000Z',
    action: 'DISPENSE',
    delta: -2,
    previousQuantity: 30,
    newQuantity: 28,
    drugId: 'DRUG-ASV-01',
    drugName: 'Anti-Snake Venom (ASV)',
    batchNumber: 'ASV-2024-88A',
    workerId: 'STF-71092-PHC',
    workerName: 'Anita Deshmukh (Staff Nurse)',
    sha256Hash: '1c049bf92d...44aa',
  },
];
