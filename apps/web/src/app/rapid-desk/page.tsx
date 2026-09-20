'use client';

import React, { useState, useEffect, Suspense, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import WorkstationShell from '@/components/WorkstationShell';
import {
  AlertTriangle,
  MinusCircle,
  Network,
  CheckCircle2,
  PackagePlus,
  Pill,
  AlertCircle,
  Layers,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Snowflake,
  Thermometer,
  Sparkles,
  ArrowRight,
  Clock,
  Calendar,
  Building2,
  FileCheck,
  ArrowUpRight,
  Check,
  Search,
  Send,
  Zap,
  User,
  MapPin,
  Stethoscope,
  X,
  Phone,
  Building,
  ListPlus,
  Trash2,
  Plus,
  Minus,
  ShoppingCart,
  ClipboardList,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import {
  isOfflineMode,
  cacheShelfInventory,
  getCachedShelfInventory,
  queueOfflineDispense,
  queueOfflineRestock,
} from '@/lib/offline-sync-manager';

interface DrugItem {
  facilityId: string;
  drugId: string;
  drugName: string;
  genericName: string;
  category: string;
  form: string;
  batchNumber?: string;
  expiryDate?: string;
  storageLocation?: string;
  quantity: number;
  unit: string;
  threshold: number;
  tier: 'EMERGENCY' | 'ESSENTIAL' | 'ROUTINE';
  isCritical: boolean;
  status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
}

interface ShiftTransaction {
  id: string;
  type: 'RESTOCK' | 'DISPENSE';
  timestamp: string;
  drugId: string;
  drugName: string;
  quantity: number;
  unit: string;
  batchNumber?: string;
  expiryDate?: string;
  counterparty: string; // Patient Name or Depot Challan
  notes?: string;
  workerName: string;
}

interface ClinicDoctor {
  id: string;
  name: string;
  email: string;
  role: string;
  facilityId: string;
  facilityName: string;
  facilityAddress: string;
  facilityDistrict: string;
  phone?: string;
}

interface ClinicFacility {
  id: string;
  name: string;
  type: string;
  address: string;
  districtName: string;
  phone?: string;
  isCurrent?: boolean;
}

interface QueuedStockItem {
  id: string;
  drugId: string;
  drugName: string;
  genericName: string;
  category: string;
  form: string;
  unit: string;
  quantity: number;
  batchNumber?: string;
  expiryDate?: string;
  storageLocation?: string;
  challanNumber?: string;
  threshold?: number;
  tier?: 'EMERGENCY' | 'ESSENTIAL' | 'ROUTINE';
  availableStock?: number;
}

type DeskView = 'important' | 'cold-storage' | 'stock-entry' | 'all';

function RapidDeskContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Active View State: default to 'all' or URL param
  const initialView = (searchParams.get('view') as DeskView) || 'all';
  const [activeView, setActiveView] = useState<DeskView>(initialView);

  const [items, setItems] = useState<DrugItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Progressive Disclosure: Expanded table row state
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // =========================================================================
  // UNIFIED STOCK OPERATIONS DESK STATE (RESTOCK & DISPENSE)
  // =========================================================================
  const [stockOpMode, setStockOpMode] = useState<'RESTOCK' | 'DISPENSE'>('RESTOCK');
  const [activityFilter, setActivityFilter] = useState<'ALL' | 'RESTOCK' | 'DISPENSE'>('ALL');

  // Shared Medicine Selection State
  const [medicineQuery, setMedicineQuery] = useState<string>('');
  const [isMedicineDropdownOpen, setIsMedicineDropdownOpen] = useState(false);
  const [selectedDrugId, setSelectedDrugId] = useState<string>('');
  const [customGenericName, setCustomGenericName] = useState<string>('');
  const [customCategory, setCustomCategory] = useState<string>('Analgesics & Antipyretics');
  const [customForm, setCustomForm] = useState<string>('500mg Tablet');
  const [customUnit, setCustomUnit] = useState<string>('Tablets');
  const [customTier, setCustomTier] = useState<'EMERGENCY' | 'ESSENTIAL' | 'ROUTINE'>('ESSENTIAL');
  const [customThreshold, setCustomThreshold] = useState<number>(50);

  // Inward Restock Specific State
  const [intakeQty, setIntakeQty] = useState<number>(50);
  const [intakeBatch, setIntakeBatch] = useState<string>('');
  const [intakeExpiry, setIntakeExpiry] = useState<string>('');
  const [intakeStorage, setIntakeStorage] = useState<string>('');
  const [intakeChallan, setIntakeChallan] = useState<string>('');
  const [isSubmittingIntake, setIsSubmittingIntake] = useState(false);

  // Outward Dispense / Stock Reduction Specific State
  const [dispensePurpose, setDispensePurpose] = useState<'INTERNAL' | 'TRANSFER' | 'DISPOSAL'>('INTERNAL');
  const [internalDept, setInternalDept] = useState<string>('OPD Patient Treatment');
  const [dispenseQty, setDispenseQty] = useState<number>(1);
  const [dispenseRecipient, setDispenseRecipient] = useState<string>('');
  const [dispenseNotes, setDispenseNotes] = useState<string>('');
  const [isSubmittingDispense, setIsSubmittingDispense] = useState(false);

  // DB-Backed Clinic Doctors & Location Attribution
  const [clinicDoctors, setClinicDoctors] = useState<ClinicDoctor[]>([]);
  const [clinicFacilities, setClinicFacilities] = useState<ClinicFacility[]>([]);
  const [currentClinicFacility, setCurrentClinicFacility] = useState<ClinicFacility | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<ClinicDoctor | null>(null);
  const [isDoctorDropdownOpen, setIsDoctorDropdownOpen] = useState(false);
  const doctorDropdownRef = useRef<HTMLDivElement>(null);

  // Batch Staging Queues (Multi-Medicine Orders)
  const [queuedRestockItems, setQueuedRestockItems] = useState<QueuedStockItem[]>([]);
  const [queuedDispenseItems, setQueuedDispenseItems] = useState<QueuedStockItem[]>([]);
  const [isExecutingBatch, setIsExecutingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; drugName: string } | null>(null);

  // Live Shift Transactions (Consolidating both Restocks & Dispenses)
  const [shiftTransactions, setShiftTransactions] = useState<ShiftTransaction[]>([
    {
      id: 'TX-2026-091',
      type: 'DISPENSE',
      timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
      drugId: 'DRUG-PCM-04',
      drugName: 'Paracetamol Tablets',
      quantity: 10,
      unit: 'Tablet',
      batchNumber: 'LOT-2026-44',
      counterparty: 'Sunita Jadhav (OPD Case #4891)',
      notes: 'OPD-2026-4891',
      workerName: 'Dr. Rahul Sharma',
    },
    {
      id: 'TX-2026-090',
      type: 'DISPENSE',
      timestamp: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
      drugId: 'DRUG-ARV-02',
      drugName: 'Anti-Rabies Vaccine',
      quantity: 1,
      unit: 'Vial',
      batchNumber: 'LOT-2026-19',
      counterparty: 'Ramesh Patil (Casualty Bite Protocol)',
      notes: 'Post-Exposure Prophylaxis',
      workerName: 'Dr. Rahul Sharma',
    },
    {
      id: 'TX-2026-089',
      type: 'RESTOCK',
      timestamp: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
      drugId: 'DRUG-PCM-04',
      drugName: 'Paracetamol Tablets',
      quantity: 200,
      unit: 'Tablet',
      batchNumber: 'LOT-2026-44',
      expiryDate: '2028-06',
      counterparty: 'District Depot (DEPOT-RAIGAD-CH-4819)',
      notes: 'DEPOT-RAIGAD-CH-4819',
      workerName: 'Dr. Rahul Sharma',
    },
    {
      id: 'TX-2026-088',
      type: 'RESTOCK',
      timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      drugId: 'DRUG-ORS-03',
      drugName: 'Oral Rehydration Salts',
      quantity: 50,
      unit: 'Packet',
      batchNumber: 'LOT-2026-12',
      expiryDate: '2027-11',
      counterparty: 'District Depot (DEPOT-RAIGAD-CH-4815)',
      notes: 'DEPOT-RAIGAD-CH-4815',
      workerName: 'Dr. Rahul Sharma',
    },
  ]);

  // Sync view from URL param when navigation occurs
  useEffect(() => {
    const viewParam = searchParams.get('view') as DeskView;
    if (viewParam && ['important', 'cold-storage', 'stock-entry', 'all'].includes(viewParam)) {
      setActiveView(viewParam);
    }
  }, [searchParams]);

  // Helper to switch view and update URL query param
  const switchView = (view: DeskView) => {
    setActiveView(view);
    const url = new URL(window.location.href);
    url.searchParams.set('view', view);
    router.replace(url.pathname + url.search);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const selectMedicine = (drug: DrugItem) => {
    setMedicineQuery(drug.drugName);
    setSelectedDrugId(drug.drugId);
    setIntakeStorage(
      (drug.storageLocation || '').includes('ILR') || drug.tier === 'EMERGENCY' || drug.category.includes('Cold')
        ? 'Cold-Chain ILR Unit 2 (3.4°C)'
        : 'Pharmacy Shelf Unit 3'
    );
    setIsMedicineDropdownOpen(false);
  };

  const fetchInventory = async () => {
    try {
      if (isOfflineMode()) {
        const cached = await getCachedShelfInventory();
        if (cached && cached.length > 0) {
          setItems(cached);
          showToast('📱 Loaded shelf inventory from offline storage.');
          return;
        }
      }
      const data = await api.get('/api/clinic/inventory');
      if (data.items) {
        setItems(data.items);
        await cacheShelfInventory(data.items);
        if (data.items.length > 0 && !medicineQuery) {
          const first = data.items[0];
          setMedicineQuery(first.drugName);
          setSelectedDrugId(first.drugId);
          setIntakeBatch(`LOT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
          setIntakeExpiry(`${new Date().getFullYear() + 2}-12`);
          setIntakeStorage(
            first.tier === 'EMERGENCY' || first.category.includes('Cold')
              ? 'Cold-Chain ILR Unit 2 (3.4°C)'
              : 'Pharmacy Shelf Unit 3'
          );
          setIntakeChallan(`DEPOT-CH-${Math.floor(1000 + Math.random() * 9000)}`);
        }
      }
    } catch (e: any) {
      console.warn('Network error while loading inventory, trying cached shelf storage:', e);
      const cached = await getCachedShelfInventory();
      if (cached && cached.length > 0) {
        setItems(cached);
        showToast('📱 Offline: Loaded shelf inventory from offline storage.');
      } else {
        showToast(e.message || 'Failed to load clinic inventory.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch clinic doctors and facilities with physical addresses directly from DB
  const fetchDoctorsAndFacilities = async () => {
    try {
      const data = await api.get('/api/clinic/doctors');
      if (data) {
        if (data.doctors && Array.isArray(data.doctors)) {
          setClinicDoctors(data.doctors);
        }
        if (data.facilities && Array.isArray(data.facilities)) {
          setClinicFacilities(data.facilities);
        }
        if (data.currentFacility) {
          setCurrentClinicFacility(data.currentFacility);
        }
      }
    } catch (err: unknown) {
      console.error('Failed to load clinic doctors from DB:', err);
    }
  };

  useEffect(() => {
    try {
      const storedFacility = sessionStorage.getItem('meditory_facility') || localStorage.getItem('meditory_facility');
      if (storedFacility) {
        const parsed = JSON.parse(storedFacility);
        if (parsed.id) {
          setCurrentClinicFacility(parsed);
        }
      }
    } catch (e) {
      console.warn('Could not rehydrate facility from storage:', e);
    }
    fetchInventory();
    fetchDoctorsAndFacilities();

    const handleSynced = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setItems(e.detail);
      } else {
        fetchInventory();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('meditory:inventory-synced', handleSynced);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('meditory:inventory-synced', handleSynced);
      }
    };
  }, []);

  // Close doctor dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (doctorDropdownRef.current && !doctorDropdownRef.current.contains(event.target as Node)) {
        setIsDoctorDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelectDoctor = (doctor: ClinicDoctor) => {
    setSelectedDoctor(doctor);
    setDispenseRecipient(doctor.name);
    setIsDoctorDropdownOpen(false);
  };

  const handleSelectWard = (wardName: string) => {
    setSelectedDoctor(null);
    setDispenseRecipient(`${wardName} - ${currentClinicFacility?.name || 'Clinic'}`);
    setIsDoctorDropdownOpen(false);
  };

  const handleSelectFacility = (fac: ClinicFacility) => {
    setSelectedDoctor(null);
    setDispenseRecipient(`Transfer to ${fac.name} (${fac.address})`);
    setIsDoctorDropdownOpen(false);
  };

  // Open Stock Operations desk with a specific medicine pre-selected and mode set
  const openStockEntryForDrug = (
    drugId: string,
    mode: 'RESTOCK' | 'DISPENSE' = 'RESTOCK',
    purpose: 'INTERNAL' | 'TRANSFER' | 'DISPOSAL' = 'INTERNAL'
  ) => {
    setStockOpMode(mode);
    if (mode === 'DISPENSE') {
      setDispensePurpose(purpose);
      if (purpose === 'INTERNAL') {
        setDispenseRecipient(`Internal Clinic Administration - ${internalDept}`);
      }
    }
    const item = items.find((i) => i.drugId === drugId);
    if (item) {
      selectMedicine(item);
      const defaultQty =
        item.form.toLowerCase().includes('tablet') || item.form.toLowerCase().includes('capsule')
          ? 10
          : 1;
      setDispenseQty(Math.min(defaultQty, Math.max(1, item.quantity)));
    } else {
      setSelectedDrugId(drugId);
    }
    switchView('stock-entry');
  };

  // Execute Dispense API Call
  const executeDispense = async (drugId: string, quantity: number, notes?: string, recipient?: string) => {
    const targetItem = items.find((i) => i.drugId === drugId);
    if (!targetItem || targetItem.quantity <= 0) {
      showToast(`⚠️ Cannot dispense: ${targetItem?.drugName || 'Item'} is currently out of stock!`);
      return false;
    }

    if (quantity > targetItem.quantity) {
      showToast(
        `⚠️ Cannot dispense ${quantity} units: Only ${targetItem.quantity} ${targetItem.unit} remaining on shelf.`
      );
      return false;
    }

    const effectiveDispensedTo = selectedDoctor
      ? `Clinic Request: ${selectedDoctor.facilityName} (${selectedDoctor.name})`
      : recipient?.trim() || (notes ? `In-Clinic Use (${notes})` : 'Internal Clinic Patient Care');

    // Offline-first interception
    if (isOfflineMode()) {
      const offlineRes = await queueOfflineDispense(drugId, quantity, effectiveDispensedTo, notes);
      const newQty = offlineRes.newQuantity;
      const newStatus = newQty <= 0 ? 'OUT_OF_STOCK' : newQty <= (targetItem.threshold || 10) ? 'LOW_STOCK' : 'IN_STOCK';
      setItems((prev) =>
        prev.map((item) => (item.drugId === drugId ? { ...item, quantity: newQty, status: newStatus } : item))
      );
      showToast(`⚡ Offline Dispense Queued: ${quantity} ${targetItem.unit} of ${targetItem.drugName} saved locally.`);
      return true;
    }

    try {
      const result = await api.post('/api/clinic/dispense', {
        drugId,
        quantity,
        notes,
        dispensedTo: effectiveDispensedTo,
        patientName: recipient?.trim() || undefined,
      });

      let updatedList: DrugItem[] = [];
      setItems((prev) => {
        updatedList = prev.map((item) => {
          if (item.drugId === drugId) {
            return {
              ...item,
              quantity: result.newQuantity,
              status: result.status,
            };
          }
          return item;
        });
        return updatedList;
      });

      if (updatedList.length > 0) {
        cacheShelfInventory(updatedList).catch(() => {});
      }

      showToast(`✅ Recorded Stock Deduction: -${quantity} ${targetItem.unit} of ${targetItem.drugName} (${effectiveDispensedTo}).`);
      if (result.alarmTriggered) {
        showToast(
          `🚨 Buffer Alert: ${result.drugName} dropped below safety buffer (${result.newQuantity} left)!`
        );
      }
      return true;
    } catch (err: any) {
      console.warn('Dispense API encountered error:', err);
      const isAuthErr =
        err?.message?.toLowerCase().includes('unauthorized') ||
        err?.message?.toLowerCase().includes('token') ||
        err?.message?.toLowerCase().includes('forbidden') ||
        err?.message?.toLowerCase().includes('access denied');

      if (isAuthErr) {
        showToast(`⚠️ Authentication Required: Please log in to your clinic account to record stock deductions.`);
        return false;
      }

      const offlineRes = await queueOfflineDispense(drugId, quantity, effectiveDispensedTo, notes);
      const newQty = offlineRes.newQuantity;
      const newStatus = newQty <= 0 ? 'OUT_OF_STOCK' : newQty <= (targetItem.threshold || 10) ? 'LOW_STOCK' : 'IN_STOCK';
      setItems((prev) =>
        prev.map((item) => (item.drugId === drugId ? { ...item, quantity: newQty, status: newStatus } : item))
      );
      showToast(`⚡ Network unavailable: Stock reduction queued offline.`);
      return true;
    }
  };

  // Dispense Form Submission from Unified Stock Desk
  const handleDispenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetItem = items.find(
      (i) =>
        (selectedDrugId && i.drugId === selectedDrugId) ||
        (medicineQuery.trim() && i.drugName.toLowerCase() === medicineQuery.trim().toLowerCase()) ||
        (medicineQuery.trim() && i.genericName.toLowerCase() === medicineQuery.trim().toLowerCase())
    );

    if (!targetItem) {
      showToast('⚠️ Please select a valid in-stock medicine to dispense or deduct.');
      return;
    }
    if (targetItem.quantity <= 0) {
      showToast(`⚠️ Cannot deduct: ${targetItem.drugName} is currently out of stock!`);
      return;
    }
    if (dispenseQty <= 0) {
      showToast('⚠️ Please enter a positive quantity to deduct.');
      return;
    }
    if (dispenseQty > targetItem.quantity) {
      showToast(`⚠️ Cannot deduct ${dispenseQty} units: Only ${targetItem.quantity} ${targetItem.unit} remaining on shelf.`);
      return;
    }

    let recipient = '';
    if (dispensePurpose === 'INTERNAL') {
      const facilityName = currentClinicFacility?.name || 'Current Clinic';
      recipient = dispenseRecipient.trim()
        ? `Internal Clinic Use - ${dispenseRecipient.trim()} (${facilityName})`
        : `Internal Clinic Use - ${internalDept} (${facilityName})`;
    } else if (dispensePurpose === 'DISPOSAL') {
      recipient = `Disposal / Write-off: ${dispenseRecipient.trim() || 'Expired / Damaged Stock'}`;
    } else {
      if (!selectedDoctor && !dispenseRecipient.trim()) {
        showToast('⚠️ Inter-Clinic Transfer: Please select the requesting clinic or doctor.');
        return;
      }
      recipient = selectedDoctor
        ? `Clinic Request: ${selectedDoctor.facilityName} (${selectedDoctor.name})`
        : dispenseRecipient.trim();
    }

    if (
      recipient.trim().toLowerCase() === 'walk-in' ||
      recipient.trim().toLowerCase() === 'anyone'
    ) {
      showToast('⚠️ Blocked: Please attribute to internal clinic ward/treatment or requesting facility.');
      return;
    }

    setIsSubmittingDispense(true);
    const success = await executeDispense(
      targetItem.drugId,
      dispenseQty,
      dispenseNotes.trim() || undefined,
      recipient
    );
    setIsSubmittingDispense(false);

    if (success) {
      // Record in live shift transactions
      const newTx: ShiftTransaction = {
        id: `TX-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
        type: 'DISPENSE',
        timestamp: new Date().toISOString(),
        drugId: targetItem.drugId,
        drugName: targetItem.drugName,
        quantity: dispenseQty,
        unit: targetItem.unit,
        batchNumber: targetItem.batchNumber,
        counterparty: recipient,
        notes: dispenseNotes || (dispensePurpose === 'INTERNAL' ? internalDept : undefined),
        workerName: selectedDoctor?.name || 'Dr. Rahul Sharma',
      };
      setShiftTransactions((prev) => [newTx, ...prev]);
      setDispenseRecipient('');
      setSelectedDoctor(null);
      setDispenseNotes(`OPD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    }
  };

  // Execute Stock Intake from dedicated desk (Supports both Typing & Formulary Selection)
  const handleIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedQuery = medicineQuery.trim();
    if (!trimmedQuery || intakeQty <= 0) {
      showToast('⚠️ Please enter a medicine name and positive restock quantity.');
      return;
    }

    const normQuery = trimmedQuery.toLowerCase().replace(/[^a-z0-9]/g, '');
    const match = items.find(
      (i) =>
        (selectedDrugId && i.drugId === selectedDrugId) ||
        i.drugName.toLowerCase() === trimmedQuery.toLowerCase() ||
        i.genericName.toLowerCase() === trimmedQuery.toLowerCase() ||
        i.drugName.toLowerCase().replace(/[^a-z0-9]/g, '') === normQuery ||
        i.genericName.toLowerCase().replace(/[^a-z0-9]/g, '') === normQuery
    );

    let effectiveDrugId = '';
    let effectiveDrugName = '';
    let effectiveGenericName = '';
    let effectiveCategory = '';
    let effectiveForm = '';
    let effectiveUnit = 'Units';
    let effectiveTier: 'EMERGENCY' | 'ESSENTIAL' | 'ROUTINE' = 'ESSENTIAL';
    let effectiveThreshold = 50;

    if (match) {
      effectiveDrugId = match.drugId;
      effectiveDrugName = match.drugName;
      effectiveGenericName = match.genericName;
      effectiveCategory = match.category;
      effectiveForm = match.form;
      effectiveUnit = match.unit;
      effectiveTier = match.tier;
      effectiveThreshold = match.threshold;
    } else {
      const cleanSlug = normQuery.slice(0, 16).toUpperCase() || 'MED';
      effectiveDrugId = `DRUG-${cleanSlug}`;
      effectiveDrugName = trimmedQuery;
      effectiveGenericName = customGenericName.trim() || trimmedQuery;
      effectiveCategory = customCategory;
      effectiveForm = customForm || '500mg Tablet';
      effectiveUnit = customUnit || 'Tablets';
      effectiveTier = customTier;
      effectiveThreshold = customThreshold || 50;
    }

    setIsSubmittingIntake(true);

    if (isOfflineMode()) {
      try {
        const offlineRes = await queueOfflineRestock(effectiveDrugId, intakeQty, intakeChallan, {
          drugName: effectiveDrugName,
          genericName: effectiveGenericName,
          category: effectiveCategory,
          form: effectiveForm,
          unit: effectiveUnit,
          threshold: effectiveThreshold,
          tier: effectiveTier,
          batchNumber: intakeBatch,
          expiryDate: intakeExpiry,
          storageLocation: intakeStorage,
        });

        setItems((prev) => {
          const exists = prev.some(
            (i) =>
              i.drugId === effectiveDrugId ||
              i.drugName.toLowerCase().replace(/[^a-z0-9]/g, '') === normQuery
          );
          if (exists) {
            return prev.map((item) => {
              if (
                item.drugId === effectiveDrugId ||
                item.drugName.toLowerCase().replace(/[^a-z0-9]/g, '') === normQuery
              ) {
                return {
                  ...item,
                  drugId: effectiveDrugId,
                  quantity: offlineRes.newQuantity,
                  status: offlineRes.newQuantity <= 0 ? 'OUT_OF_STOCK' : offlineRes.newQuantity <= item.threshold ? 'LOW_STOCK' : 'IN_STOCK',
                  batchNumber: intakeBatch || item.batchNumber,
                  expiryDate: intakeExpiry || item.expiryDate,
                  storageLocation: intakeStorage || item.storageLocation,
                };
              }
              return item;
            });
          } else {
            const newItem: DrugItem = {
              facilityId: currentClinicFacility?.id || 'PHC-ALIBAG-01',
              drugId: effectiveDrugId,
              drugName: effectiveDrugName,
              genericName: effectiveGenericName,
              category: effectiveCategory,
              form: effectiveForm,
              quantity: offlineRes.newQuantity,
              unit: effectiveUnit,
              threshold: effectiveThreshold,
              tier: effectiveTier,
              isCritical: effectiveTier === 'EMERGENCY',
              status: 'IN_STOCK',
              batchNumber: intakeBatch,
              expiryDate: intakeExpiry,
              storageLocation: intakeStorage,
            };
            return [newItem, ...prev];
          }
        });

        const newTx: ShiftTransaction = {
          id: `TX-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
          type: 'RESTOCK',
          timestamp: new Date().toISOString(),
          drugId: effectiveDrugId,
          drugName: effectiveDrugName,
          quantity: intakeQty,
          unit: effectiveUnit,
          batchNumber: intakeBatch,
          expiryDate: intakeExpiry,
          counterparty: intakeChallan ? `District Depot (${intakeChallan})` : 'District Medical Depot Intake',
          notes: intakeChallan || undefined,
          workerName: selectedDoctor?.name || 'Dr. Rahul Sharma',
        };
        setShiftTransactions((prev) => [newTx, ...prev]);

        showToast(`📦 Restock recorded offline: +${intakeQty} ${effectiveUnit} of ${effectiveDrugName} (queued locally).`);
        setIntakeBatch(`LOT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
        setIntakeChallan(`DEPOT-CH-${Math.floor(1000 + Math.random() * 9000)}`);
      } catch (err: any) {
        console.error('Offline restock error:', err);
        showToast(`❌ Failed to queue offline restock: ${err.message}`);
      } finally {
        setIsSubmittingIntake(false);
      }
      return;
    }

    try {
      const result = await api.post('/api/clinic/restock', {
        drugId: effectiveDrugId,
        quantity: intakeQty,
        drugName: effectiveDrugName,
        genericName: effectiveGenericName,
        category: effectiveCategory,
        form: effectiveForm,
        unit: effectiveUnit,
        tier: effectiveTier,
        threshold: effectiveThreshold,
        batchNumber: intakeBatch || `LOT-${new Date().getFullYear()}-01`,
        expiryDate: intakeExpiry || `${new Date().getFullYear() + 2}-12`,
        storageLocation:
          intakeStorage ||
          (effectiveCategory.includes('Cold') || effectiveTier === 'EMERGENCY'
            ? 'Cold-Chain ILR Unit 2 (3.4°C)'
            : 'Pharmacy Shelf Unit 3'),
        challanNumber: intakeChallan,
      });

      let updatedList: DrugItem[] = [];
      setItems((prev) => {
        const exists = prev.some(
          (i) =>
            i.drugId === effectiveDrugId ||
            i.drugName.toLowerCase().replace(/[^a-z0-9]/g, '') === normQuery
        );
        if (exists) {
          updatedList = prev.map((item) => {
            if (
              item.drugId === effectiveDrugId ||
              item.drugName.toLowerCase().replace(/[^a-z0-9]/g, '') === normQuery
            ) {
              return {
                ...item,
                drugId: effectiveDrugId,
                quantity: result.newQuantity,
                status: result.status,
                batchNumber: intakeBatch || item.batchNumber,
                expiryDate: intakeExpiry || item.expiryDate,
                storageLocation: intakeStorage || item.storageLocation,
              };
            }
            return item;
          });
        } else {
          const newItem: DrugItem = {
            facilityId: currentClinicFacility?.id || 'PHC-ALIBAG-01',
            drugId: effectiveDrugId,
            drugName: effectiveDrugName,
            genericName: effectiveGenericName,
            category: effectiveCategory,
            form: effectiveForm,
            quantity: result.newQuantity,
            unit: effectiveUnit,
            threshold: effectiveThreshold,
            tier: effectiveTier,
            isCritical: effectiveTier === 'EMERGENCY',
            status: result.status,
            batchNumber: intakeBatch,
            expiryDate: intakeExpiry,
            storageLocation: intakeStorage,
          };
          updatedList = [newItem, ...prev];
        }
        return updatedList;
      });

      // Keep IndexedDB shelf cache immediately synchronized with DynamoDB
      if (updatedList.length > 0) {
        cacheShelfInventory(updatedList).catch(() => {});
      }

      // Record in live shift transactions ledger
      const newTx: ShiftTransaction = {
        id: `TX-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
        type: 'RESTOCK',
        timestamp: new Date().toISOString(),
        drugId: effectiveDrugId,
        drugName: result.drugName || effectiveDrugName,
        quantity: intakeQty,
        unit: effectiveUnit,
        batchNumber: intakeBatch,
        expiryDate: intakeExpiry,
        counterparty: intakeChallan ? `District Depot (${intakeChallan})` : 'District Medical Depot Intake',
        notes: intakeChallan || undefined,
        workerName: selectedDoctor?.name || 'Authorized Medical Officer',
      };
      setShiftTransactions((prev) => [newTx, ...prev]);

      showToast(`✅ Saved to Database: +${intakeQty} ${effectiveUnit} of ${effectiveDrugName} added to ${currentClinicFacility?.name || 'Clinic'} shelf.`);

      setIntakeBatch(`LOT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
      setIntakeChallan(`DEPOT-CH-${Math.floor(1000 + Math.random() * 9000)}`);
    } catch (err: any) {
      console.warn('Restock API encountered error:', err);
      const isAuthErr =
        err?.message?.toLowerCase().includes('unauthorized') ||
        err?.message?.toLowerCase().includes('token') ||
        err?.message?.toLowerCase().includes('forbidden') ||
        err?.message?.toLowerCase().includes('access denied');

      if (isAuthErr) {
        showToast(`⚠️ Authentication Required: Please log in to your clinic account to save stock to the database.`);
      } else {
        // Genuine network failure: queue in IndexedDB
        try {
          const offlineRes = await queueOfflineRestock(effectiveDrugId, intakeQty, intakeChallan, {
            drugName: effectiveDrugName,
            genericName: effectiveGenericName,
            category: effectiveCategory,
            form: effectiveForm,
            unit: effectiveUnit,
            threshold: effectiveThreshold,
            tier: effectiveTier,
            batchNumber: intakeBatch,
            expiryDate: intakeExpiry,
            storageLocation: intakeStorage,
          });

          setItems((prev) =>
            prev.map((item) =>
              item.drugId === effectiveDrugId
                ? {
                    ...item,
                    quantity: offlineRes.newQuantity,
                    status: offlineRes.newQuantity <= 0 ? 'OUT_OF_STOCK' : offlineRes.newQuantity <= item.threshold ? 'LOW_STOCK' : 'IN_STOCK',
                  }
                : item
            )
          );
          showToast(`⚡ Network unavailable: Restock queued offline.`);
        } catch (queueErr) {
          showToast(`❌ Restock failed: ${err.message}`);
        }
      }
    } finally {
      setIsSubmittingIntake(false);
    }
  };

  // =========================================================================
  // MULTI-MEDICINE BATCH ORDER QUEUE MANAGEMENT (RESTOCK & DISPENSE)
  // =========================================================================

  const totalRestockUnits = queuedRestockItems.reduce((acc, item) => acc + item.quantity, 0);
  const totalDispenseUnits = queuedDispenseItems.reduce((acc, item) => acc + item.quantity, 0);

  // Add medicine to Inward Restock Queue (Depot Delivery Manifest)
  const addMedicineToRestockQueue = () => {
    const trimmedQuery = medicineQuery.trim();
    const norm = trimmedQuery.toLowerCase().replace(/[^a-z0-9]/g, '');
    const match = items.find(
      (i) =>
        (selectedDrugId && i.drugId === selectedDrugId) ||
        (trimmedQuery && i.drugName.toLowerCase() === trimmedQuery.toLowerCase()) ||
        (trimmedQuery && i.genericName.toLowerCase() === trimmedQuery.toLowerCase()) ||
        (norm && i.drugName.toLowerCase().replace(/[^a-z0-9]/g, '') === norm) ||
        (norm && i.genericName.toLowerCase().replace(/[^a-z0-9]/g, '') === norm)
    );

    const cleanSlug = norm.slice(0, 16).toUpperCase() || 'MED';
    const effectiveDrugId =
      match?.drugId ||
      selectedDrugId ||
      `DRUG-${cleanSlug}`;
    const effectiveDrugName = match?.drugName || trimmedQuery || 'Custom Formulation';
    const effectiveGenericName = match?.genericName || customGenericName.trim() || effectiveDrugName;
    const effectiveCategory = match?.category || customCategory;
    const effectiveForm = match?.form || customForm;
    const effectiveUnit = match?.unit || customUnit;
    const effectiveThreshold = match?.threshold || customThreshold;
    const effectiveTier = match?.tier || customTier;

    if (!effectiveDrugName) {
      showToast('⚠️ Please enter or select a medicine name first.');
      return;
    }
    if (intakeQty <= 0) {
      showToast('⚠️ Please enter a positive inward quantity.');
      return;
    }

    const batch = intakeBatch.trim() || `LOT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
    const expiry = intakeExpiry.trim() || `${new Date().getFullYear() + 2}-12`;
    const storage = intakeStorage.trim() || 'Pharmacy Shelf Unit 3';
    const challan = intakeChallan.trim() || `DEPOT-CH-${Math.floor(1000 + Math.random() * 9000)}`;

    const existingIndex = queuedRestockItems.findIndex(
      (item) => item.drugId === effectiveDrugId && item.batchNumber === batch
    );

    if (existingIndex >= 0) {
      setQueuedRestockItems((prev) =>
        prev.map((item, idx) =>
          idx === existingIndex ? { ...item, quantity: item.quantity + intakeQty } : item
        )
      );
      showToast(`Updated ${effectiveDrugName} quantity in restock list (+${intakeQty}).`);
    } else {
      const newItem: QueuedStockItem = {
        id: `QUEUED-RESTOCK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        drugId: effectiveDrugId,
        drugName: effectiveDrugName,
        genericName: effectiveGenericName,
        category: effectiveCategory,
        form: effectiveForm,
        unit: effectiveUnit,
        quantity: intakeQty,
        batchNumber: batch,
        expiryDate: expiry,
        storageLocation: storage,
        challanNumber: challan,
        threshold: effectiveThreshold,
        tier: effectiveTier,
      };
      setQueuedRestockItems((prev) => [...prev, newItem]);
      showToast(`✅ Added ${effectiveDrugName} (${intakeQty} ${effectiveUnit}) to restock list.`);
    }

    // Reset input for next medicine, but preserve the shared challan number
    setMedicineQuery('');
    setSelectedDrugId('');
    setIntakeQty(50);
    setIntakeBatch(`LOT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
  };

  // Add medicine to Outward Dispense Queue (Prescription Order)
  const addMedicineToDispenseQueue = () => {
    const targetItem = items.find(
      (i) =>
        (selectedDrugId && i.drugId === selectedDrugId) ||
        (medicineQuery.trim() && i.drugName.toLowerCase() === medicineQuery.trim().toLowerCase()) ||
        (medicineQuery.trim() && i.genericName.toLowerCase() === medicineQuery.trim().toLowerCase())
    );

    if (!targetItem) {
      showToast('⚠️ Please select an available medicine from stock.');
      return;
    }
    if (targetItem.quantity <= 0) {
      showToast(`⚠️ Cannot dispense: ${targetItem.drugName} is currently out of stock!`);
      return;
    }
    if (dispenseQty <= 0) {
      showToast('⚠️ Please enter a positive quantity to dispense.');
      return;
    }

    const alreadyQueued = queuedDispenseItems
      .filter((item) => item.drugId === targetItem.drugId)
      .reduce((sum, item) => sum + item.quantity, 0);

    const totalRequested = alreadyQueued + dispenseQty;
    if (totalRequested > targetItem.quantity) {
      showToast(
        `⚠️ Insufficient stock: Shelf has ${targetItem.quantity} ${targetItem.unit}. You already have ${alreadyQueued} in the order list.`
      );
      return;
    }

    const existingIndex = queuedDispenseItems.findIndex((item) => item.drugId === targetItem.drugId);
    if (existingIndex >= 0) {
      setQueuedDispenseItems((prev) =>
        prev.map((item, idx) =>
          idx === existingIndex ? { ...item, quantity: item.quantity + dispenseQty } : item
        )
      );
      showToast(`Updated ${targetItem.drugName} quantity in dispense list (+${dispenseQty}).`);
    } else {
      const newItem: QueuedStockItem = {
        id: `QUEUED-DISPENSE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        drugId: targetItem.drugId,
        drugName: targetItem.drugName,
        genericName: targetItem.genericName,
        category: targetItem.category,
        form: targetItem.form,
        unit: targetItem.unit,
        quantity: dispenseQty,
        availableStock: targetItem.quantity,
        batchNumber: targetItem.batchNumber,
        expiryDate: targetItem.expiryDate,
        tier: targetItem.tier,
      };
      setQueuedDispenseItems((prev) => [...prev, newItem]);
      showToast(`✅ Added ${targetItem.drugName} (${dispenseQty} ${targetItem.unit}) to dispense list.`);
    }

    // Reset input for next medicine
    setMedicineQuery('');
    setSelectedDrugId('');
    setDispenseQty(1);
  };

  // Remove item from queue
  const removeQueuedItem = (id: string, mode: 'RESTOCK' | 'DISPENSE') => {
    if (mode === 'RESTOCK') {
      setQueuedRestockItems((prev) => prev.filter((i) => i.id !== id));
    } else {
      setQueuedDispenseItems((prev) => prev.filter((i) => i.id !== id));
    }
  };

  // Adjust queued quantity (+ / -)
  const updateQueuedItemQuantity = (id: string, delta: number, mode: 'RESTOCK' | 'DISPENSE') => {
    if (mode === 'RESTOCK') {
      setQueuedRestockItems((prev) =>
        prev
          .map((item) => {
            if (item.id === id) {
              const newQty = item.quantity + delta;
              return newQty > 0 ? { ...item, quantity: newQty } : null;
            }
            return item;
          })
          .filter(Boolean) as QueuedStockItem[]
      );
    } else {
      setQueuedDispenseItems((prev) =>
        prev
          .map((item) => {
            if (item.id === id) {
              const maxAvailable = item.availableStock || 9999;
              const newQty = Math.min(maxAvailable, item.quantity + delta);
              return newQty > 0 ? { ...item, quantity: newQty } : null;
            }
            return item;
          })
          .filter(Boolean) as QueuedStockItem[]
      );
    }
  };

  // Execute Batch Inward Restock Order
  const executeBatchRestock = async () => {
    if (queuedRestockItems.length === 0) {
      showToast('⚠️ No medicines in restock list to commit.');
      return;
    }

    setIsExecutingBatch(true);
    let successCount = 0;
    const newTransactions: ShiftTransaction[] = [];

    for (let i = 0; i < queuedRestockItems.length; i++) {
      const item = queuedRestockItems[i];
      setBatchProgress({
        current: i + 1,
        total: queuedRestockItems.length,
        drugName: item.drugName,
      });

      if (isOfflineMode()) {
        try {
          const offlineRes = await queueOfflineRestock(item.drugId, item.quantity, item.challanNumber || intakeChallan, {
            drugName: item.drugName,
            genericName: item.genericName,
            category: item.category,
            form: item.form,
            unit: item.unit,
            threshold: item.threshold || 50,
            tier: item.tier || 'ESSENTIAL',
            batchNumber: item.batchNumber,
            expiryDate: item.expiryDate,
            storageLocation: item.storageLocation,
          });

          setItems((prev) => {
            const exists = prev.some((p) => p.drugId === item.drugId);
            if (exists) {
              return prev.map((p) =>
                p.drugId === item.drugId
                  ? {
                      ...p,
                      quantity: offlineRes.newQuantity,
                      status: offlineRes.newQuantity <= 0 ? 'OUT_OF_STOCK' : offlineRes.newQuantity <= (p.threshold || 10) ? 'LOW_STOCK' : 'IN_STOCK',
                      batchNumber: item.batchNumber || p.batchNumber,
                      expiryDate: item.expiryDate || p.expiryDate,
                      storageLocation: item.storageLocation || p.storageLocation,
                    }
                  : p
              );
            } else {
              return [
                ...prev,
                {
                  facilityId: currentClinicFacility?.id || 'PHC-ALIBAG-01',
                  drugId: item.drugId,
                  drugName: item.drugName,
                  genericName: item.genericName,
                  category: item.category,
                  form: item.form,
                  quantity: offlineRes.newQuantity,
                  unit: item.unit,
                  threshold: item.threshold || 50,
                  tier: item.tier || 'ESSENTIAL',
                  isCritical: item.tier === 'EMERGENCY',
                  status: 'IN_STOCK',
                  batchNumber: item.batchNumber,
                  expiryDate: item.expiryDate,
                  storageLocation: item.storageLocation,
                },
              ];
            }
          });

          newTransactions.push({
            id: `TX-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
            type: 'RESTOCK',
            timestamp: new Date().toISOString(),
            drugId: item.drugId,
            drugName: item.drugName,
            quantity: item.quantity,
            unit: item.unit,
            batchNumber: item.batchNumber,
            expiryDate: item.expiryDate,
            counterparty: `District Depot (${item.challanNumber || intakeChallan})`,
            notes: item.challanNumber || intakeChallan,
            workerName: selectedDoctor?.name || 'Dr. Rahul Sharma',
          });

          successCount++;
        } catch (err: unknown) {
          console.error(`Failed to queue offline restock for ${item.drugName}:`, err);
        }
        continue;
      }

      try {
        const result = await api.post('/api/clinic/restock', {
          drugId: item.drugId,
          quantity: item.quantity,
          batchNumber: item.batchNumber,
          expiryDate: item.expiryDate,
          storageLocation: item.storageLocation,
          challanNumber: item.challanNumber || intakeChallan,
          drugName: item.drugName,
          genericName: item.genericName,
          category: item.category,
          form: item.form,
          unit: item.unit,
          threshold: item.threshold || 50,
          tier: item.tier || 'ESSENTIAL',
        });

        // Update local items state
        const normBatchDrug = item.drugName.toLowerCase().replace(/[^a-z0-9]/g, '');
        let updatedList: DrugItem[] = [];
        setItems((prev) => {
          const exists = prev.some(
            (p) =>
              p.drugId === item.drugId ||
              p.drugName.toLowerCase().replace(/[^a-z0-9]/g, '') === normBatchDrug
          );
          if (exists) {
            updatedList = prev.map((p) =>
              p.drugId === item.drugId ||
              p.drugName.toLowerCase().replace(/[^a-z0-9]/g, '') === normBatchDrug
                ? {
                    ...p,
                    quantity: result.newQuantity,
                    status: result.status,
                    batchNumber: item.batchNumber || p.batchNumber,
                    expiryDate: item.expiryDate || p.expiryDate,
                    storageLocation: item.storageLocation || p.storageLocation,
                  }
                : p
            );
          } else {
            const newItem: DrugItem = {
              facilityId: currentClinicFacility?.id || 'PHC-ALIBAG-01',
              drugId: item.drugId,
              drugName: item.drugName,
              genericName: item.genericName,
              category: item.category,
              form: item.form,
              quantity: result.newQuantity,
              unit: item.unit,
              threshold: item.threshold || 50,
              tier: item.tier || 'ESSENTIAL',
              isCritical: item.tier === 'EMERGENCY',
              status: result.status,
              batchNumber: item.batchNumber,
              expiryDate: item.expiryDate,
              storageLocation: item.storageLocation,
            };
            updatedList = [newItem, ...prev];
          }
          return updatedList;
        });

        if (updatedList.length > 0) {
          cacheShelfInventory(updatedList).catch(() => {});
        }

        newTransactions.push({
          id: `TX-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
          type: 'RESTOCK',
          timestamp: new Date().toISOString(),
          drugId: item.drugId,
          drugName: item.drugName,
          quantity: item.quantity,
          unit: item.unit,
          batchNumber: item.batchNumber,
          expiryDate: item.expiryDate,
          counterparty: `District Depot (${item.challanNumber || intakeChallan})`,
          notes: item.challanNumber || intakeChallan,
          workerName: selectedDoctor?.name || 'Dr. Rahul Sharma',
        });

        successCount++;
      } catch (err: unknown) {
        console.warn(`Network restock failed for ${item.drugName}, falling back to offline queue:`, err);
        try {
          const offlineRes = await queueOfflineRestock(item.drugId, item.quantity, item.challanNumber || intakeChallan, {
            drugName: item.drugName,
            genericName: item.genericName,
            category: item.category,
            form: item.form,
            unit: item.unit,
            threshold: item.threshold || 50,
            tier: item.tier || 'ESSENTIAL',
            batchNumber: item.batchNumber,
            expiryDate: item.expiryDate,
            storageLocation: item.storageLocation,
          });
          setItems((prev) =>
            prev.map((p) =>
              p.drugId === item.drugId
                ? {
                    ...p,
                    quantity: offlineRes.newQuantity,
                    status: offlineRes.newQuantity <= 0 ? 'OUT_OF_STOCK' : offlineRes.newQuantity <= (p.threshold || 10) ? 'LOW_STOCK' : 'IN_STOCK',
                  }
                : p
            )
          );
          successCount++;
        } catch {
          showToast(`❌ Failed to restock ${item.drugName}`);
        }
      }
    }

    if (newTransactions.length > 0) {
      setShiftTransactions((prev) => [...newTransactions, ...prev]);
    }

    setIsExecutingBatch(false);
    setBatchProgress(null);
    setQueuedRestockItems([]);

    showToast(`🎉 Batch Restock Complete! ${successCount} of ${queuedRestockItems.length} medicines processed.`);
  };

  // Execute Batch Outward Dispense Order
  const executeBatchDispense = async () => {
    if (queuedDispenseItems.length === 0) {
      showToast('⚠️ No medicines in dispense list to authorize.');
      return;
    }

    if (!selectedDoctor && !dispenseRecipient.trim()) {
      showToast('⚠️ Dispense Restricted: Medicines can ONLY be dispensed upon an authorized request from a clinic (not to individual walk-ins).');
      return;
    }

    const recipient = selectedDoctor
      ? `Clinic Request: ${selectedDoctor.facilityName} (${selectedDoctor.name})`
      : dispenseRecipient.trim() || 'Authorized Clinic Requisition';

    const effectiveDispensedTo = recipient;

    setIsExecutingBatch(true);
    let successCount = 0;
    const newTransactions: ShiftTransaction[] = [];
    const triggeredAlarms: string[] = [];

    for (let i = 0; i < queuedDispenseItems.length; i++) {
      const item = queuedDispenseItems[i];
      setBatchProgress({
        current: i + 1,
        total: queuedDispenseItems.length,
        drugName: item.drugName,
      });

      if (isOfflineMode()) {
        try {
          const offlineRes = await queueOfflineDispense(item.drugId, item.quantity, effectiveDispensedTo, dispenseNotes.trim() || undefined);
          setItems((prev) =>
            prev.map((p) =>
              p.drugId === item.drugId
                ? {
                    ...p,
                    quantity: offlineRes.newQuantity,
                    status: offlineRes.newQuantity <= 0 ? 'OUT_OF_STOCK' : offlineRes.newQuantity <= (p.threshold || 10) ? 'LOW_STOCK' : 'IN_STOCK',
                  }
                : p
            )
          );

          newTransactions.push({
            id: `TX-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
            type: 'DISPENSE',
            timestamp: new Date().toISOString(),
            drugId: item.drugId,
            drugName: item.drugName,
            quantity: item.quantity,
            unit: item.unit,
            batchNumber: item.batchNumber,
            counterparty: recipient,
            notes: dispenseNotes || undefined,
            workerName: selectedDoctor?.name || 'Dr. Rahul Sharma',
          });

          successCount++;
        } catch (err: unknown) {
          console.error(`Failed to queue offline dispense for ${item.drugName}:`, err);
        }
        continue;
      }

      try {
        const result = await api.post('/api/clinic/dispense', {
          drugId: item.drugId,
          quantity: item.quantity,
          notes: dispenseNotes.trim() || undefined,
          dispensedTo: effectiveDispensedTo,
          patientName: selectedDoctor?.name || recipient,
        });

        setItems((prev) =>
          prev.map((p) =>
            p.drugId === item.drugId
              ? {
                  ...p,
                  quantity: result.newQuantity,
                  status: result.status,
                }
              : p
          )
        );

        if (result.alarmTriggered) {
          triggeredAlarms.push(item.drugName);
        }

        newTransactions.push({
          id: `TX-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
          type: 'DISPENSE',
          timestamp: new Date().toISOString(),
          drugId: item.drugId,
          drugName: item.drugName,
          quantity: item.quantity,
          unit: item.unit,
          batchNumber: item.batchNumber,
          counterparty: recipient,
          notes: dispenseNotes || undefined,
          workerName: selectedDoctor?.name || 'Dr. Rahul Sharma',
        });

        successCount++;
      } catch (err: unknown) {
        console.warn(`Network dispense failed for ${item.drugName}, falling back to offline queue:`, err);
        try {
          const offlineRes = await queueOfflineDispense(item.drugId, item.quantity, effectiveDispensedTo, dispenseNotes.trim() || undefined);
          setItems((prev) =>
            prev.map((p) =>
              p.drugId === item.drugId
                ? {
                    ...p,
                    quantity: offlineRes.newQuantity,
                    status: offlineRes.newQuantity <= 0 ? 'OUT_OF_STOCK' : offlineRes.newQuantity <= (p.threshold || 10) ? 'LOW_STOCK' : 'IN_STOCK',
                  }
                : p
            )
          );
          successCount++;
        } catch {
          showToast(`❌ Dispense failed for ${item.drugName}`);
        }
      }
    }

    if (newTransactions.length > 0) {
      setShiftTransactions((prev) => [...newTransactions, ...prev]);
    }

    setIsExecutingBatch(false);
    setBatchProgress(null);
    setQueuedDispenseItems([]);
    setDispenseRecipient('');
    setSelectedDoctor(null);
    setDispenseNotes(`OPD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);

    showToast(`🎉 Order Dispensed! ${successCount} medicines successfully dispensed to ${recipient}.`);
    if (triggeredAlarms.length > 0) {
      setTimeout(() => {
        showToast(`🚨 Buffer Alert: ${triggeredAlarms.join(', ')} fell below safety buffer!`);
      }, 1500);
    }
  };

  // Categorized item sets
  const emergencyItems = items.filter((i) => i.tier === 'EMERGENCY');
  const urgentEmergencyItems = emergencyItems.filter(
    (i) => i.status === 'LOW_STOCK' || i.status === 'OUT_OF_STOCK'
  );
  const nominalEmergencyItems = emergencyItems.filter((i) => i.status === 'IN_STOCK');

  const coldStorageItems = items.filter(
    (i) =>
      (i.storageLocation || '').toLowerCase().includes('ilr') ||
      (i.category || '').toLowerCase().includes('vaccine') ||
      (i.category || '').toLowerCase().includes('antivenom') ||
      (i.category || '').toLowerCase().includes('anaphylaxis') ||
      i.tier === 'EMERGENCY'
  );

  const filteredLedgerItems = items.filter((i) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      i.drugName.toLowerCase().includes(q) ||
      i.genericName.toLowerCase().includes(q) ||
      i.category.toLowerCase().includes(q) ||
      i.drugId.toLowerCase().includes(q);

    if (!matchesSearch) return false;
    if (selectedCategory === 'ALL') return true;
    if (selectedCategory === 'EMERGENCY') return i.tier === 'EMERGENCY';
    if (selectedCategory === 'COLD_CHAIN')
      return (
        (i.storageLocation || '').toLowerCase().includes('ilr') ||
        (i.category || '').toLowerCase().includes('vaccine') ||
        (i.category || '').toLowerCase().includes('antivenom') ||
        i.tier === 'EMERGENCY'
      );
    if (selectedCategory === 'ESSENTIAL') return i.tier === 'ESSENTIAL';
    if (selectedCategory === 'CRITICAL')
      return i.isCritical || i.status === 'LOW_STOCK' || i.status === 'OUT_OF_STOCK';
    return true;
  });

  const matchedIntakeItem = items.find(
    (i) =>
      (selectedDrugId && i.drugId === selectedDrugId) ||
      (medicineQuery.trim() && i.drugName.toLowerCase() === medicineQuery.trim().toLowerCase()) ||
      (medicineQuery.trim() && i.genericName.toLowerCase() === medicineQuery.trim().toLowerCase())
  );
  const effectiveIntakeUnit = matchedIntakeItem ? matchedIntakeItem.unit : customUnit || 'Units';

  return (
    <WorkstationShell
      activeView={activeView}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onEmergencyClick={() => switchView('important')}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-xl border border-slate-700 flex items-center gap-2.5 text-xs animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2. TOP WORKSTATION SEGMENTED VIEW SWITCHER                            */}
      {/* ===================================================================== */}
      <div className="mb-6 bg-white p-2 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Tab 1: Important Medicines */}
          <button
            onClick={() => switchView('important')}
            type="button"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeView === 'important'
                ? 'bg-rose-700 text-white shadow-sm'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <AlertTriangle className={`w-4 h-4 ${activeView === 'important' ? 'text-white' : 'text-rose-600'}`} />
            <span>Important Medicines</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                activeView === 'important'
                  ? 'bg-white/20 text-white'
                  : urgentEmergencyItems.length > 0
                  ? 'bg-rose-100 text-rose-700 font-bold'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {urgentEmergencyItems.length > 0 ? `${urgentEmergencyItems.length} Urgent` : `${emergencyItems.length}`}
            </span>
          </button>

          {/* Tab 2: Cold Storage */}
          <button
            onClick={() => switchView('cold-storage')}
            type="button"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeView === 'cold-storage'
                ? 'bg-cyan-800 text-white shadow-sm'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Snowflake className={`w-4 h-4 ${activeView === 'cold-storage' ? 'text-white' : 'text-cyan-600'}`} />
            <span>Cold Storage (ILR)</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                activeView === 'cold-storage'
                  ? 'bg-white/20 text-white'
                  : 'bg-cyan-100 text-cyan-800 font-bold'
              }`}
            >
              2°C–8°C
            </span>
          </button>

          {/* Tab 3: Unified Stock Operations Desk */}
          <button
            onClick={() => switchView('stock-entry')}
            type="button"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeView === 'stock-entry'
                ? 'bg-teal-700 text-white shadow-sm'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <PackagePlus className={`w-4 h-4 ${activeView === 'stock-entry' ? 'text-white' : 'text-teal-600'}`} />
            <span>Stock Operations Desk</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                activeView === 'stock-entry'
                  ? 'bg-white/20 text-white'
                  : 'bg-teal-100 text-teal-800 font-bold'
              }`}
            >
              Restock & Dispense
            </span>
          </button>

          {/* Tab 4: All Shelf Stock */}
          <button
            onClick={() => switchView('all')}
            type="button"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeView === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Layers className={`w-4 h-4 ${activeView === 'all' ? 'text-white' : 'text-slate-500'}`} />
            <span>All Shelf Stock</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                activeView === 'all'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {items.length} items
            </span>
          </button>
        </div>

        {/* Workstation Status Telemetry Indicator */}
        <div className="hidden lg:flex items-center gap-3 text-xs text-slate-500 pr-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-semibold text-slate-700">Cloud Synced</span>
          </div>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-1 font-mono text-[11px] text-cyan-800 bg-cyan-50 px-2 py-1 rounded-md border border-cyan-200/60">
            <Thermometer className="w-3 h-3 text-cyan-600" />
            <span>ILR: 3.4°C</span>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. VIEW 1: IMPORTANT & LIFE-SAVING MEDICINES (TIER-1 TRIAGE)          */}
      {/* ===================================================================== */}
      {activeView === 'important' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-rose-900 via-rose-800 to-slate-900 p-6 rounded-2xl text-white shadow-md relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/30 text-rose-200 text-[10px] font-bold tracking-wider uppercase mb-2">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>National Health Mission • Tier-1 Life Critical</span>
                </div>
                <h2 className="text-xl font-bold tracking-tight">Important & Emergency Formulary</h2>
                <p className="text-xs text-rose-100/80 mt-1 max-w-xl">
                  High-priority antivenoms, vaccines, and resuscitation ampoules. Requires immediate 1-tap dispense
                  or automatic inter-clinic referral dispatch during stockouts.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  onClick={() => openStockEntryForDrug(emergencyItems[0]?.drugId || '', 'RESTOCK')}
                  className="px-4 py-2 bg-white text-rose-900 hover:bg-rose-50 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
                  type="button"
                >
                  <Zap className="w-3.5 h-3.5 text-rose-700" />
                  <span>⚡ Stock Operations Desk</span>
                </button>
                <Link
                  href="/locator?drug=DRUG-ASV-01"
                  className="px-4 py-2 bg-rose-700/80 hover:bg-rose-700 text-white border border-rose-500/40 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
                >
                  <Network className="w-3.5 h-3.5 text-rose-200" />
                  <span>Inter-Clinic Referral</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Urgent Triage Cards (Shortages / Low Buffers) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
                <h3 className="text-sm font-bold text-slate-900">Urgent Attention & Stockout Triage</h3>
                <span className="text-xs text-slate-400 font-mono">({urgentEmergencyItems.length} items)</span>
              </div>
              <span className="text-[11px] text-slate-500">Auto-routes to regional CHC when stock is zero</span>
            </div>

            {urgentEmergencyItems.length === 0 ? (
              <div className="bg-white p-6 rounded-2xl border border-emerald-200 shadow-xs text-center py-10 space-y-2">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-sm text-slate-900">All Emergency Reserves Are Adequate</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Anti-Snake Venom, Rabies Vaccine, and Adrenaline inventories are currently above safety buffer
                  thresholds.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {urgentEmergencyItems.map((item) => {
                  const qtyNum = Number(item.quantity) || 0;
                  const isOut = qtyNum <= 0 || item.status === 'OUT_OF_STOCK';
                  const pct = Math.min(100, Math.round((qtyNum / (item.threshold || 1)) * 100));

                  return (
                    <div
                      key={item.drugId}
                      className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                        isOut
                          ? 'bg-rose-50/30 border-rose-300 ring-2 ring-rose-200 shadow-sm'
                          : 'bg-amber-50/30 border-amber-300 ring-2 ring-amber-200 shadow-sm'
                      }`}
                    >
                      <div>
                        {/* Top Status Strip */}
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                              isOut ? 'bg-rose-200 text-rose-900 font-mono' : 'bg-amber-200 text-amber-900 font-mono'
                            }`}
                          >
                            {isOut ? 'CRITICAL STOCKOUT' : 'BELOW BUFFER'}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">{item.drugId}</span>
                        </div>

                        {/* Medicine Details */}
                        <h4 className="font-bold text-slate-900 text-base leading-tight">{item.drugName}</h4>
                        <p className="text-xs text-slate-600 mt-0.5 font-medium">{item.genericName}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{item.form}</p>

                        {/* Big Stock Metric */}
                        <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-baseline justify-between">
                          <div>
                            <span className="text-[10px] text-slate-500 font-semibold block uppercase">
                              Physical Shelf Stock
                            </span>
                            <div className="flex items-baseline gap-1.5">
                              <span
                                className={`text-3xl font-extrabold font-mono ${
                                  isOut ? 'text-rose-700' : 'text-amber-700'
                                }`}
                              >
                                {item.quantity}
                              </span>
                              <span className="text-xs text-slate-500 font-bold uppercase">{item.unit}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-500 block">Buffer Target</span>
                            <span className="font-mono text-xs font-bold text-slate-700">
                              {item.threshold} {item.unit}
                            </span>
                          </div>
                        </div>

                        {/* Buffer Gauge Bar */}
                        <div className="mt-2 space-y-1">
                          <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className={`h-full transition-all ${isOut ? 'bg-rose-600' : 'bg-amber-500'}`}
                              style={{ width: `${Math.max(4, pct)}%` }}
                            ></div>
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                            <span>{pct}% of safety buffer</span>
                            <span>{item.quantity < item.threshold ? `-${item.threshold - item.quantity} deficit` : 'Safe'}</span>
                          </div>
                        </div>

                        {/* Storage Location Badge */}
                        <div className="mt-3 p-2 rounded-lg bg-white/80 border border-slate-200/80 text-[11px] flex items-center justify-between text-slate-600">
                          <span className="flex items-center gap-1">
                            <Snowflake className="w-3 h-3 text-cyan-600" />
                            <span>{item.storageLocation || 'Cold-Chain ILR 2 (3.4°C)'}</span>
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">{item.batchNumber || 'LOT-2026-01'}</span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="mt-5 pt-3 border-t border-slate-200/80 space-y-2">
                        {isOut ? (
                          <>
                            <Link
                              href={`/locator?drug=${item.drugId}`}
                              className="w-full py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm flex items-center justify-center gap-2 transition-all"
                            >
                              <Network className="w-3.5 h-3.5" />
                              <span>Find in Nearby Clinics (Referral) →</span>
                            </Link>
                            <button
                              onClick={() => openStockEntryForDrug(item.drugId, 'RESTOCK')}
                              className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 transition-colors"
                              type="button"
                            >
                              <span>⚡ Manage in Stock Desk →</span>
                            </button>
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openStockEntryForDrug(item.drugId, 'DISPENSE')}
                              className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 transition-colors"
                              type="button"
                            >
                              <span>⚡ Manage in Stock Desk →</span>
                            </button>
                            <Link
                              href={`/locator?drug=${item.drugId}`}
                              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 text-xs font-bold flex items-center"
                              title="Check network stock"
                            >
                              <Network className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Nominal Reserves (Emergency Items In-Stock) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <h3 className="text-sm font-bold text-slate-900">Nominal Emergency Reserves (Safe Buffer)</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {nominalEmergencyItems.map((item) => (
                <div
                  key={item.drugId}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-emerald-300 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                        ✓ In Safe Stock
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">{item.drugId}</span>
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm">{item.drugName}</h4>
                    <p className="text-xs text-slate-500">{item.genericName}</p>
                    <div className="mt-3 flex items-baseline justify-between border-t border-slate-100 pt-2 font-mono">
                      <span className="text-2xl font-bold text-emerald-700">{item.quantity}</span>
                      <span className="text-xs text-slate-400 font-sans">
                        Buffer: {item.threshold} {item.unit}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-2 border-t border-slate-100 flex items-center gap-2">
                    <button
                      onClick={() => openStockEntryForDrug(item.drugId, 'DISPENSE')}
                      className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5"
                      type="button"
                    >
                      <span>⚡ Manage in Stock Desk →</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* National Clinical Emergency Protocols Box */}
          <div className="p-4 bg-slate-100/80 rounded-2xl border border-slate-200 text-xs text-slate-600 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-900 block">
                National Guidelines: Anti-Snake Venom (ASV) & Anti-Rabies Vaccine (ARV) Protocol
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                ASV must never be withheld for administrative or billing reasons. For zero-stock emergencies,
                the Meditory Referral Gateway automatically queries neighboring CHCs (Pen CHC & Vadkhal PHC)
                along the NH-66 corridor with verified cold-chain transit logs.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 4. VIEW 2: COLD STORAGE MEDICINES (COLD-CHAIN & ILR MANAGEMENT)       */}
      {/* ===================================================================== */}
      {activeView === 'cold-storage' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Top Cold-Chain Hardware Telemetry Bar */}
          <div className="bg-gradient-to-r from-cyan-950 via-slate-900 to-teal-950 p-6 rounded-2xl text-white shadow-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold tracking-wider uppercase mb-2 border border-cyan-500/30">
                  <Snowflake className="w-3.5 h-3.5" />
                  <span>Ice-Lined Refrigerator (ILR) Network • Cold Chain Protocol</span>
                </div>
                <h2 className="text-xl font-bold tracking-tight">Cold Storage Formulary & Telemetry</h2>
                <p className="text-xs text-cyan-100/80 mt-1 max-w-xl">
                  Real-time temperature telemetry for biologicals, antivenoms, and vaccines under National Cold Chain
                  Management Information System (NCCMIS).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => openStockEntryForDrug('DRUG-ASV-01')}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
                  type="button"
                >
                  <PackagePlus className="w-3.5 h-3.5" />
                  <span>+ Receive Cold Batch</span>
                </button>
              </div>
            </div>

            {/* Hardware Telemetry Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-6 pt-5 border-t border-cyan-800/40">
              {/* Unit 1 */}
              <div className="bg-slate-900/80 border border-cyan-800/50 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                    <Thermometer className="w-3.5 h-3.5 text-cyan-400" />
                    ILR Refrigerator 01 (Vaccines)
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-white">+3.4°C</span>
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                    Optimal (2°C–8°C)
                  </span>
                </div>
                <p className="text-[10px] text-cyan-200/60 font-mono">
                  Sensor DDL-04 • AC Mains + Battery Backup Active (98%)
                </p>
              </div>

              {/* Unit 2 */}
              <div className="bg-slate-900/80 border border-cyan-800/50 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                    <Thermometer className="w-3.5 h-3.5 text-cyan-400" />
                    ILR Refrigerator 02 (Antivenoms)
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-white">+3.8°C</span>
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                    Normal (2°C–8°C)
                  </span>
                </div>
                <p className="text-[10px] text-cyan-200/60 font-mono">
                  Sensor DDL-09 • Verified at 08:30 AM Shift Handover
                </p>
              </div>

              {/* Deep Freeze */}
              <div className="bg-slate-900/80 border border-cyan-800/50 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                    <Snowflake className="w-3.5 h-3.5 text-cyan-400" />
                    Deep Freezer (Ice Packs)
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-white">-18.2°C</span>
                  <span className="text-[10px] font-semibold text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800">
                    Conditioned (-15°C to -25°C)
                  </span>
                </div>
                <p className="text-[10px] text-cyan-200/60 font-mono">
                  24 Conditioned packs ready for referral transit carriers
                </p>
              </div>
            </div>
          </div>

          {/* Cold Chain Compliance Assurance Banner */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <span className="text-xs font-bold text-slate-900">
                  Zero Temperature Excursions in Past 30 Days
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Continuous digital data logger logging conforms to WHO/PQS and MoHFW guidelines.
                </span>
              </div>
            </div>
            <span className="font-mono text-xs text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 shrink-0">
              Last Calibration: 15 Aug 2026
            </span>
          </div>

          {/* Cold Chain Inventory Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Snowflake className="w-4 h-4 text-cyan-600" />
                <h3 className="text-sm font-bold text-slate-900">Cold-Chain Refrigerator Inventory</h3>
                <span className="text-xs text-slate-400 font-mono">({coldStorageItems.length} items)</span>
              </div>
              <span className="text-[11px] text-slate-500">2°C to 8°C continuous storage</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {coldStorageItems.map((item) => {
                const qtyNum = Number(item.quantity) || 0;
                const isOut = qtyNum <= 0 || item.status === 'OUT_OF_STOCK';
                const isLow = !isOut && (qtyNum < (item.threshold || 10) || item.status === 'LOW_STOCK');

                return (
                  <div
                    key={item.drugId}
                    className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-cyan-400 transition-all space-y-4"
                  >
                    <div>
                      {/* Top Pill Bar */}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-800 border border-cyan-200 font-mono">
                          ❄️ 2°C–8°C Cold Chain
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isOut
                              ? 'bg-rose-100 text-rose-800'
                              : isLow
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isOut ? 'Out of Stock' : isLow ? 'Low Buffer' : 'In Stock'}
                        </span>
                      </div>

                      <h4 className="font-bold text-slate-900 text-base mt-2.5 leading-tight">{item.drugName}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{item.genericName}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{item.form}</p>

                      {/* Storage Shelf & Hardware Attribution */}
                      <div className="mt-3 p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1 text-[11px]">
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="text-slate-400">Assigned Unit:</span>
                          <strong className="text-slate-800 font-mono">
                            {item.storageLocation || 'ILR Unit 2, Rack 3'}
                          </strong>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="text-slate-400">Batch / Lot:</span>
                          <strong className="text-slate-800 font-mono">{item.batchNumber || 'LOT-2026-01'}</strong>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="text-slate-400">Expiry Date:</span>
                          <strong className="text-slate-800 font-mono">{item.expiryDate || '2027-12'}</strong>
                        </div>
                      </div>

                      {/* Stock Level Display */}
                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-baseline justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase font-medium">Shelf Vials</span>
                          <div className="flex items-baseline gap-1 font-mono">
                            <span
                              className={`text-2xl font-bold ${
                                isOut ? 'text-rose-700' : isLow ? 'text-amber-700' : 'text-slate-900'
                              }`}
                            >
                              {item.quantity}
                            </span>
                            <span className="text-xs text-slate-400 font-sans">{item.unit}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block uppercase font-medium">Safety Buffer</span>
                          <span className="text-xs font-mono font-bold text-slate-700">
                            {item.threshold} {item.unit}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                      <button
                        onClick={() => openStockEntryForDrug(item.drugId, item.quantity > 0 ? 'DISPENSE' : 'RESTOCK')}
                        className="flex-1 py-2 px-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs"
                        type="button"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>⚡ Manage in Stock Desk →</span>
                      </button>
                      {isOut && (
                        <Link
                          href={`/locator?drug=${item.drugId}`}
                          className="px-2.5 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-bold border border-rose-200 flex items-center"
                          title="Locate in neighboring clinics"
                        >
                          <Network className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 5. VIEW 3: UNIFIED STOCK OPERATIONS DESK (RESTOCK & DISPENSE)         */}
      {/* ===================================================================== */}
      {activeView === 'stock-entry' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header Banner with Operation Mode Switcher */}
          <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 p-6 rounded-2xl text-white shadow-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-500/30 text-teal-200 text-[10px] font-bold tracking-wider uppercase mb-2">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Central Dispensary • Single Stock Operations Desk</span>
                </div>
                <h2 className="text-xl font-bold tracking-tight">Unified Stock Management</h2>
                <p className="text-xs text-teal-100/80 mt-1 max-w-xl">
                  Unified terminal for processing Inward Restock deliveries (+), In-Clinic Stock Reductions (-), and Outward Requisitions (-).
                  All transactions cryptographically sign into the tamper-evident audit ledger.
                </p>
              </div>

              {/* Mode Switcher Buttons */}
              <div className="flex items-center bg-slate-950/70 p-1.5 rounded-2xl border border-teal-500/40 shadow-inner">
                <button
                  type="button"
                  onClick={() => setStockOpMode('RESTOCK')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    stockOpMode === 'RESTOCK'
                      ? 'bg-emerald-500 text-white shadow-md scale-[1.02]'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <PackagePlus className="w-4 h-4" />
                  <span>📥 Inward Restock (+)</span>
                  {queuedRestockItems.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white text-emerald-800 shadow-xs">
                      {queuedRestockItems.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setStockOpMode('DISPENSE')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    stockOpMode === 'DISPENSE'
                      ? 'bg-teal-500 text-white shadow-md scale-[1.02]'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  <span>📤 In-Clinic Use / Reduce Stock (-)</span>
                  {queuedDispenseItems.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white text-teal-800 shadow-xs">
                      {queuedDispenseItems.length}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* 2-Column Grid: Form Left, Shift Activity & Quality Protocol Right */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Operation Form */}
            <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
              {/* Form Title & Context */}
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    {stockOpMode === 'RESTOCK' ? (
                      <>
                        <PackagePlus className="w-4 h-4 text-emerald-600" />
                        <span>Record Inward Stock Shipment (+)</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 text-teal-600" />
                        <span>Deduct Stock / In-Clinic Use / Dispense (-)</span>
                      </>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {stockOpMode === 'RESTOCK'
                      ? 'Select medication and enter delivery challan details to replenish live shelf levels'
                      : 'Deduct stock for internal clinic use (OPD, Emergency, Ward) or inter-clinic transfer with tamper-evident audit logging'}
                  </p>
                </div>

                <span
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider font-mono ${
                    stockOpMode === 'RESTOCK'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-teal-100 text-teal-800 border border-teal-200'
                  }`}
                >
                  {stockOpMode === 'RESTOCK' ? '+ INWARD RESTOCK' : '- STOCK REDUCTION'}
                </span>
              </div>

              {stockOpMode === 'RESTOCK' ? (
                <>
                  {/* ======================== RESTOCK FORM ======================== */}
                  <form onSubmit={handleIntakeSubmit} className="space-y-4 text-xs">
                  {/* 1. Medicine Formulary Entry: Direct Typing + Smart Autocomplete */}
                  <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <label className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>1. Medicine to Replenish</span>
                        <span className="text-rose-600">*</span>
                      </label>
                      {matchedIntakeItem ? (
                        <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
                          <span>✓ Existing Shelf Stock: {matchedIntakeItem.quantity} {matchedIntakeItem.unit}</span>
                        </span>
                      ) : medicineQuery.trim() ? (
                        <span className="text-[11px] font-bold text-teal-800 bg-teal-100 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-teal-200">
                          <span>✨ New Medicine Registration</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">
                          Directly type any medicine name or select below
                        </span>
                      )}
                    </div>

                    {/* Searchable Text Input with Autocomplete Dropdown */}
                    <div className="relative">
                      <div className="relative flex items-center">
                        <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                          <Search className="w-4 h-4 text-emerald-600" />
                        </div>
                        <input
                          type="text"
                          required
                          value={medicineQuery}
                          onChange={(e) => {
                            const val = e.target.value;
                            setMedicineQuery(val);
                            setIsMedicineDropdownOpen(true);
                            const match = items.find(
                              (i) =>
                                i.drugName.toLowerCase() === val.trim().toLowerCase() ||
                                i.genericName.toLowerCase() === val.trim().toLowerCase()
                            );
                            if (match) {
                              setSelectedDrugId(match.drugId);
                              setIntakeStorage(
                                match.storageLocation ||
                                  (match.tier === 'EMERGENCY' || match.category.includes('Cold')
                                    ? 'Cold-Chain ILR Unit 2 (3.4°C)'
                                    : 'Pharmacy Shelf Unit 3')
                              );
                            } else {
                              setSelectedDrugId('');
                            }
                          }}
                          onFocus={() => setIsMedicineDropdownOpen(true)}
                          placeholder="Type medicine name (e.g. Paracetamol, Ceftriaxone 1g, Adrenaline, ORS...)"
                          className="w-full h-11 pl-10 pr-24 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 shadow-2xs"
                        />
                        <div className="absolute right-2 flex items-center gap-1">
                          {medicineQuery && (
                            <button
                              type="button"
                              onClick={() => {
                                setMedicineQuery('');
                                setSelectedDrugId('');
                                setIsMedicineDropdownOpen(false);
                              }}
                              className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 text-xs"
                              title="Clear"
                            >
                              ✕
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setIsMedicineDropdownOpen((prev) => !prev)}
                            className="px-2 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors flex items-center gap-0.5"
                            title="Browse formulary medicines"
                          >
                            <span>List</span>
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Autocomplete Suggestions Popover */}
                      {isMedicineDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 max-h-64 overflow-y-auto divide-y divide-slate-100">
                          {medicineQuery.trim() &&
                            !items.some(
                              (i) => i.drugName.toLowerCase() === medicineQuery.trim().toLowerCase()
                            ) && (
                              <div
                                onClick={() => {
                                  setSelectedDrugId('');
                                  setIsMedicineDropdownOpen(false);
                                }}
                                className="p-3 bg-emerald-50 hover:bg-emerald-100 cursor-pointer flex items-center justify-between text-xs transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-base">✨</span>
                                  <div>
                                    <strong className="text-emerald-900 block font-bold">
                                      Add as New Medicine: &ldquo;{medicineQuery.trim()}&rdquo;
                                    </strong>
                                    <span className="text-[11px] text-emerald-700">
                                      Register this unlisted medicine into clinic formulary
                                    </span>
                                  </div>
                                </div>
                                <span className="px-2 py-0.5 bg-emerald-700 text-white rounded text-[10px] font-bold">
                                  + New Medicine
                                </span>
                              </div>
                            )}

                          {items
                            .filter(
                              (item) =>
                                !medicineQuery.trim() ||
                                item.drugName.toLowerCase().includes(medicineQuery.toLowerCase()) ||
                                item.genericName.toLowerCase().includes(medicineQuery.toLowerCase())
                            )
                            .map((item) => (
                              <div
                                key={item.drugId}
                                onClick={() => selectMedicine(item)}
                                className="p-3 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-xs transition-colors"
                              >
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-900">{item.drugName}</span>
                                    <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                                      {item.drugId}
                                    </span>
                                    {item.tier === 'EMERGENCY' && (
                                      <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded">
                                        EMERGENCY
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500 flex items-center gap-2">
                                    <span>{item.genericName}</span>
                                    <span>•</span>
                                    <span>{item.form}</span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span
                                    className={`inline-block font-mono font-bold text-xs px-2 py-0.5 rounded-full ${
                                      item.quantity === 0
                                        ? 'bg-rose-100 text-rose-800'
                                        : item.quantity < item.threshold
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-emerald-100 text-emerald-800'
                                    }`}
                                  >
                                    {item.quantity} {item.unit}
                                  </span>
                                  <span className="block text-[10px] text-slate-400 mt-0.5">
                                    {(item.storageLocation || '').includes('ILR') ? '❄️ Cold ILR' : 'Shelf'}
                                  </span>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                    {/* Quick Select Chips */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="text-[11px] text-slate-400 font-medium">Quick Select:</span>
                      {items.slice(0, 5).map((item) => (
                        <button
                          key={item.drugId}
                          type="button"
                          onClick={() => selectMedicine(item)}
                          className={`px-2 py-0.5 rounded-md border text-[11px] font-medium transition-all ${
                            selectedDrugId === item.drugId
                              ? 'bg-emerald-700 text-white border-emerald-700 font-bold shadow-2xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                          }`}
                        >
                          {item.drugName.split(' ')[0]} ({item.quantity})
                        </button>
                      ))}
                    </div>

                    {/* New Medicine Specification Card (revealed when entering unlisted medicine) */}
                    {!matchedIntakeItem && medicineQuery.trim().length > 0 && (
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3 animate-in fade-in">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 text-[11px]">
                            ✨ New Medicine Formulary Specifications
                          </span>
                          <span className="text-[10px] text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded font-bold">
                            Registering to Clinic Inventory
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <span className="font-semibold text-slate-700 text-[11px]">Generic / Active Salt</span>
                            <input
                              type="text"
                              value={customGenericName}
                              onChange={(e) => setCustomGenericName(e.target.value)}
                              placeholder="e.g. Ceftriaxone Sodium or Paracetamol IP"
                              className="w-full h-9 px-3 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="font-semibold text-slate-700 text-[11px]">Therapeutic Category</span>
                            <select
                              value={customCategory}
                              onChange={(e) => {
                                const cat = e.target.value;
                                setCustomCategory(cat);
                                if (cat.includes('Vaccines') || cat.includes('Antivenom') || cat.includes('Cold')) {
                                  setIntakeStorage('Cold-Chain ILR Unit 2 (3.4°C)');
                                }
                              }}
                              className="w-full h-9 px-2.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                            >
                              <option value="Analgesics & Antipyretics">Analgesics & Antipyretics</option>
                              <option value="Antimicrobials & Antibiotics">Antimicrobials & Antibiotics</option>
                              <option value="Vaccines & Immunoglobulins">Vaccines & Immunoglobulins (Cold-Chain)</option>
                              <option value="Antidotes & Antivenoms">Antidotes & Antivenoms (Emergency)</option>
                              <option value="Cardiovascular & Emergency">Cardiovascular & Resuscitation</option>
                              <option value="Electrolytes & Fluids">Electrolytes & Fluids (ORS)</option>
                              <option value="Gastrointestinal & Antacids">Gastrointestinal & Antacids</option>
                              <option value="Vitamins & Minerals">Vitamins & Minerals</option>
                              <option value="Other Essential Formulary">Other Essential Formulary</option>
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <span className="font-semibold text-slate-700 text-[11px]">Dosage Form</span>
                            <input
                              type="text"
                              value={customForm}
                              onChange={(e) => setCustomForm(e.target.value)}
                              placeholder="e.g. 10ml Vial, 500mg Tablet"
                              className="w-full h-9 px-3 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="font-semibold text-slate-700 text-[11px]">Dispensing Unit</span>
                            <select
                              value={customUnit}
                              onChange={(e) => setCustomUnit(e.target.value)}
                              className="w-full h-9 px-2.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                            >
                              <option value="Vials">Vials</option>
                              <option value="Tablets">Tablets</option>
                              <option value="Capsules">Capsules</option>
                              <option value="Ampoules">Ampoules</option>
                              <option value="Packets">Packets</option>
                              <option value="Bottles">Bottles</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <span className="font-semibold text-slate-700 text-[11px]">Priority Tier</span>
                            <select
                              value={customTier}
                              onChange={(e) => setCustomTier(e.target.value as any)}
                              className="w-full h-9 px-2.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                            >
                              <option value="ESSENTIAL">Essential Formulary</option>
                              <option value="EMERGENCY">Emergency (Life-Saving)</option>
                              <option value="ROUTINE">Routine OPD</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. Current vs Incoming Calculation Card */}
                  {(() => {
                    const currentQty = matchedIntakeItem ? matchedIntakeItem.quantity : 0;
                    const displayUnit = effectiveIntakeUnit;
                    const displayName = matchedIntakeItem
                      ? matchedIntakeItem.drugName
                      : medicineQuery.trim() || 'New Medicine';

                    return (
                      <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-emerald-900">
                            Stock Replenishment Transition for {displayName}:
                          </span>
                          <span className="font-mono font-bold text-emerald-800 text-[11px]">
                            {matchedIntakeItem ? matchedIntakeItem.drugId : 'NEW-FORMULARY'}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center pt-1 font-mono">
                          <div className="p-2 bg-white rounded-lg border border-emerald-100">
                            <span className="text-[10px] text-slate-400 font-sans block">Current Shelf</span>
                            <strong className="text-sm text-slate-800">
                              {currentQty} {displayUnit}
                            </strong>
                          </div>
                          <div className="p-2 bg-white rounded-lg border border-emerald-100">
                            <span className="text-[10px] text-emerald-600 font-sans block">+ Inward Intake</span>
                            <strong className="text-sm text-emerald-700">+{intakeQty}</strong>
                          </div>
                          <div className="p-2 bg-emerald-600 text-white rounded-lg">
                            <span className="text-[10px] text-emerald-100 font-sans block">Updated Total</span>
                            <strong className="text-sm text-white">
                              {currentQty + intakeQty} {displayUnit}
                            </strong>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 3. Inward Quantity + Quick Presets */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-900">
                        2. Inward Quantity Received <span className="text-rose-600">*</span>
                      </label>
                      <span className="text-[11px] text-slate-400 font-mono">
                        Unit: {effectiveIntakeUnit}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        required
                        value={intakeQty}
                        onChange={(e) => setIntakeQty(Math.max(1, parseInt(e.target.value, 10) || 0))}
                        className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-300 text-base font-mono font-bold text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                        placeholder="e.g. 50"
                      />
                      <span className="text-xs font-bold text-slate-600 shrink-0 uppercase px-3 py-3 bg-slate-100 rounded-xl border border-slate-200">
                        {effectiveIntakeUnit}
                      </span>
                    </div>

                    {/* Preset Pills */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] text-slate-500 font-medium mr-1">Quick Presets:</span>
                      {[10, 25, 50, 100, 250, 500].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setIntakeQty(preset)}
                          className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border transition-all ${
                            intakeQty === preset
                              ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          +{preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 4. Batch / Lot Number & Expiry Date */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-900">
                        3. Batch / Lot Number <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={intakeBatch}
                        onChange={(e) => setIntakeBatch(e.target.value)}
                        placeholder="e.g. LOT-2026-99"
                        className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-900">
                        4. Expiry Date <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="month"
                        required
                        value={intakeExpiry}
                        onChange={(e) => setIntakeExpiry(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                      />
                    </div>
                  </div>

                  {/* 5. Destination Storage Location & Depot Challan # */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-900">
                        5. Storage Shelf / Cold-Chain Unit <span className="text-rose-600">*</span>
                      </label>
                      <select
                        value={intakeStorage}
                        onChange={(e) => setIntakeStorage(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                      >
                        <option value="Cold-Chain ILR Unit 1 (2°C–8°C)">Cold-Chain ILR Unit 1 (2°C–8°C) — Vaccines</option>
                        <option value="Cold-Chain ILR Unit 2 (2°C–8°C)">Cold-Chain ILR Unit 2 (2°C–8°C) — Antivenoms</option>
                        <option value="Pharmacy Shelf Unit 3">Pharmacy Shelf Unit 3 (Ambient)</option>
                        <option value="Bulk Storage Rack B">Bulk Storage Rack B (Oral Solids/Salts)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-900">
                        6. Depot Delivery Challan # <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={intakeChallan}
                        onChange={(e) => setIntakeChallan(e.target.value)}
                        placeholder="e.g. DEPOT-RAIGAD-CH-4819"
                        className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                      />
                    </div>
                  </div>

                  {/* Action Buttons: Add to Delivery Manifest OR Solo Commit */}
                  <div className="pt-3 space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={addMedicineToRestockQueue}
                        disabled={intakeQty <= 0 || (!matchedIntakeItem && !medicineQuery.trim())}
                        className="sm:col-span-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-[0.99]"
                      >
                        <ListPlus className="w-4 h-4" />
                        <span>+ Add Medicine to Inward Delivery List</span>
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmittingIntake || intakeQty <= 0 || (!matchedIntakeItem && !medicineQuery.trim())}
                        className="py-3 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-300 flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all"
                        title="Commit only this single item immediately"
                      >
                        <PackagePlus className="w-3.5 h-3.5" />
                        <span>Solo (+{intakeQty})</span>
                      </button>
                    </div>
                  </div>
                </form>

                {/* Staged Inward Restock Delivery Manifest */}
                {queuedRestockItems.length > 0 && (
                  <div className="p-4 rounded-2xl bg-emerald-50/60 border-2 border-emerald-300/80 shadow-sm space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold shadow-2xs">
                          <ClipboardList className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                            <span>Inward Delivery Manifest</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                              {queuedRestockItems.length} Medicines Queued
                            </span>
                          </h4>
                          <p className="text-[11px] text-slate-500 font-mono">
                            Challan: {intakeChallan || 'DEPOT-DELIVERY'} • Total: {totalRestockUnits} units
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setQueuedRestockItems([])}
                        className="text-[11px] text-slate-500 hover:text-rose-600 font-medium px-2 py-1 rounded-md hover:bg-white transition-colors"
                      >
                        Clear List
                      </button>
                    </div>

                    {/* Manifest Items List */}
                    <div className="divide-y divide-emerald-100/80 max-h-[260px] overflow-y-auto pr-1">
                      {queuedRestockItems.map((item, index) => (
                        <div key={item.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                                {index + 1}
                              </span>
                              <span className="font-bold text-slate-900 truncate">{item.drugName}</span>
                              <span className="text-[10px] text-slate-500 font-normal">({item.form})</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 font-mono pl-7">
                              <span>Lot: {item.batchNumber}</span>
                              <span>•</span>
                              <span>Exp: {item.expiryDate}</span>
                              <span>•</span>
                              <span className="truncate">{item.storageLocation}</span>
                            </div>
                          </div>

                          {/* Quantity Stepper & Remove */}
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center border border-emerald-300 rounded-lg bg-white shadow-2xs">
                              <button
                                type="button"
                                onClick={() => updateQueuedItemQuantity(item.id, -10, 'RESTOCK')}
                                className="px-2 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-l-md font-bold text-xs"
                                title="Decrease 10"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="px-2.5 py-1 font-mono font-bold text-xs text-emerald-900 min-w-[40px] text-center">
                                +{item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateQueuedItemQuantity(item.id, 10, 'RESTOCK')}
                                className="px-2 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-r-md font-bold text-xs"
                                title="Increase 10"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                            <span className="text-[10px] font-semibold text-slate-500 w-10 truncate">{item.unit}</span>
                            <button
                              type="button"
                              onClick={() => removeQueuedItem(item.id, 'RESTOCK')}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Remove from delivery manifest"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Progress Feedback during execution */}
                    {isExecutingBatch && batchProgress && (
                      <div className="p-2.5 bg-emerald-100/70 rounded-xl space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold text-emerald-900">
                          <span className="flex items-center gap-1.5">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" />
                            <span>Receiving: {batchProgress.drugName}</span>
                          </span>
                          <span>
                            {batchProgress.current} / {batchProgress.total}
                          </span>
                        </div>
                        <div className="w-full bg-emerald-200 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-600 h-full transition-all duration-300"
                            style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Primary Batch Execution Action Button */}
                    <button
                      type="button"
                      disabled={isExecutingBatch || queuedRestockItems.length === 0}
                      onClick={executeBatchRestock}
                      className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-[0.99]"
                    >
                      {isExecutingBatch ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Committing Batch Delivery ({batchProgress?.current || 1}/{queuedRestockItems.length})...</span>
                        </>
                      ) : (
                        <>
                          <PackagePlus className="w-4 h-4" />
                          <span>
                            Commit Batch Restock ({queuedRestockItems.length} Medicines • +{totalRestockUnits} Units)
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* ======================== DISPENSE FORM ======================== */}
                <form onSubmit={handleDispenseSubmit} className="space-y-4 text-xs">
                  {/* 1. Medicine Selection for Dispense */}
                  <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <label className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>1. Medicine to Dispense</span>
                        <span className="text-rose-600">*</span>
                      </label>
                      {matchedIntakeItem ? (
                        <span
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border ${
                            matchedIntakeItem.quantity === 0
                              ? 'bg-rose-100 text-rose-800 border-rose-200'
                              : matchedIntakeItem.quantity < matchedIntakeItem.threshold
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          <span>
                            Available: {matchedIntakeItem.quantity} {matchedIntakeItem.unit}
                          </span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">Select medicine from current stock</span>
                      )}
                    </div>

                    {/* Searchable Text Input with Autocomplete Dropdown */}
                    <div className="relative">
                      <div className="relative flex items-center">
                        <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                          <Search className="w-4 h-4 text-teal-600" />
                        </div>
                        <input
                          type="text"
                          required
                          value={medicineQuery}
                          onChange={(e) => {
                            const val = e.target.value;
                            setMedicineQuery(val);
                            setIsMedicineDropdownOpen(true);
                            const match = items.find(
                              (i) =>
                                i.drugName.toLowerCase() === val.trim().toLowerCase() ||
                                i.genericName.toLowerCase() === val.trim().toLowerCase()
                            );
                            if (match) {
                              setSelectedDrugId(match.drugId);
                            } else {
                              setSelectedDrugId('');
                            }
                          }}
                          onFocus={() => setIsMedicineDropdownOpen(true)}
                          placeholder="Select medicine to dispense (e.g. Paracetamol, Adrenaline, ORS...)"
                          className="w-full h-11 pl-10 pr-24 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs"
                        />
                        <div className="absolute right-2 flex items-center gap-1">
                          {medicineQuery && (
                            <button
                              type="button"
                              onClick={() => {
                                setMedicineQuery('');
                                setSelectedDrugId('');
                                setIsMedicineDropdownOpen(false);
                              }}
                              className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 text-xs"
                              title="Clear"
                            >
                              ✕
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setIsMedicineDropdownOpen((prev) => !prev)}
                            className="px-2 py-1 text-[11px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg border border-teal-200 transition-colors flex items-center gap-0.5"
                            title="Browse formulary medicines"
                          >
                            <span>List</span>
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Dropdown suggestions */}
                      {isMedicineDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 max-h-64 overflow-y-auto divide-y divide-slate-100">
                          {items
                            .filter(
                              (item) =>
                                !medicineQuery.trim() ||
                                item.drugName.toLowerCase().includes(medicineQuery.toLowerCase()) ||
                                item.genericName.toLowerCase().includes(medicineQuery.toLowerCase())
                            )
                            .map((item) => (
                              <div
                                key={item.drugId}
                                onClick={() => selectMedicine(item)}
                                className="p-3 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-xs transition-colors"
                              >
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-900">{item.drugName}</span>
                                    <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                                      {item.drugId}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {item.genericName} • {item.form}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span
                                    className={`inline-block font-mono font-bold text-xs px-2 py-0.5 rounded-full ${
                                      item.quantity === 0
                                        ? 'bg-rose-100 text-rose-800'
                                        : item.quantity < item.threshold
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-emerald-100 text-emerald-800'
                                    }`}
                                  >
                                    {item.quantity} {item.unit}
                                  </span>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                    {/* Quick Select Chips */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="text-[11px] text-slate-400 font-medium">In-Stock Presets:</span>
                      {items
                        .filter((i) => i.quantity > 0)
                        .slice(0, 5)
                        .map((item) => (
                          <button
                            key={item.drugId}
                            type="button"
                            onClick={() => selectMedicine(item)}
                            className={`px-2 py-0.5 rounded-md border text-[11px] font-medium transition-all ${
                              selectedDrugId === item.drugId
                                ? 'bg-teal-700 text-white border-teal-700 font-bold shadow-2xs'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                            }`}
                          >
                            {item.drugName.split(' ')[0]} ({item.quantity})
                          </button>
                        ))}
                    </div>

                    {/* Zero Stock Warning with Locator Link */}
                    {matchedIntakeItem && matchedIntakeItem.quantity === 0 && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs animate-in fade-in">
                        <div className="flex items-center gap-2 text-rose-800">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                          <span>
                            <strong>Out of Stock:</strong> Cannot dispense {matchedIntakeItem.drugName}.
                          </span>
                        </div>
                        <Link
                          href={`/locator?drug=${matchedIntakeItem.drugId}`}
                          className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold text-xs flex items-center gap-1"
                        >
                          <Network className="w-3 h-3" />
                          <span>Locate in Nearby Clinics →</span>
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* 2. Dispense Calculation Card */}
                  {matchedIntakeItem && (
                    <div
                      className={`p-4 rounded-xl border space-y-2 transition-colors ${
                        dispenseQty > matchedIntakeItem.quantity
                          ? 'bg-rose-50 border-rose-300'
                          : 'bg-teal-50/70 border-teal-200'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span
                          className={`font-bold ${
                            dispenseQty > matchedIntakeItem.quantity ? 'text-rose-900' : 'text-teal-900'
                          }`}
                        >
                          {dispenseQty > matchedIntakeItem.quantity
                            ? '⚠️ Over-Dispense Warning (Exceeds Shelf Stock)'
                            : `Stock Deduction for ${matchedIntakeItem.drugName}:`}
                        </span>
                        <span className="font-mono font-bold text-slate-500 text-[11px]">
                          {matchedIntakeItem.drugId}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center pt-1 font-mono">
                        <div className="p-2 bg-white rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-400 font-sans block">Current Shelf</span>
                          <strong className="text-sm text-slate-800">
                            {matchedIntakeItem.quantity} {matchedIntakeItem.unit}
                          </strong>
                        </div>
                        <div className="p-2 bg-white rounded-lg border border-slate-200">
                          <span className="text-[10px] text-rose-600 font-sans block">- Dispensing</span>
                          <strong className="text-sm text-rose-700">-{dispenseQty}</strong>
                        </div>
                        <div
                          className={`p-2 rounded-lg text-white ${
                            dispenseQty > matchedIntakeItem.quantity ? 'bg-rose-600' : 'bg-teal-600'
                          }`}
                        >
                          <span className="text-[10px] text-white/80 font-sans block">Remaining Balance</span>
                          <strong className="text-sm">
                            {Math.max(0, matchedIntakeItem.quantity - dispenseQty)} {matchedIntakeItem.unit}
                          </strong>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3. Dispense Quantity Field + Quick Presets */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-900">
                        2. Quantity to Dispense <span className="text-rose-600">*</span>
                      </label>
                      <span className="text-[11px] text-slate-400 font-mono">
                        Unit: {matchedIntakeItem?.unit || 'Units'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max={matchedIntakeItem ? matchedIntakeItem.quantity : undefined}
                        required
                        value={dispenseQty}
                        onChange={(e) => setDispenseQty(Math.max(1, parseInt(e.target.value, 10) || 0))}
                        className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-300 text-base font-mono font-bold text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                        placeholder="e.g. 10"
                      />
                      <span className="text-xs font-bold text-slate-600 shrink-0 uppercase px-3 py-3 bg-slate-100 rounded-xl border border-slate-200">
                        {matchedIntakeItem?.unit || 'Units'}
                      </span>
                    </div>

                    {/* Presets */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] text-slate-500 font-medium mr-1">Quick Presets:</span>
                      {[1, 2, 5, 10, 20, 30].map((preset) => {
                        if (matchedIntakeItem && preset > matchedIntakeItem.quantity && matchedIntakeItem.quantity > 0)
                          return null;
                        return (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setDispenseQty(preset)}
                            className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border transition-all ${
                              dispenseQty === preset
                                ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {preset}
                          </button>
                        );
                      })}
                      {matchedIntakeItem && matchedIntakeItem.quantity > 0 && (
                        <button
                          type="button"
                          onClick={() => setDispenseQty(matchedIntakeItem.quantity)}
                          className="px-3 py-1 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        >
                          All ({matchedIntakeItem.quantity})
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 4. Purpose / Use-Case Selector */}
                  <div className="space-y-2 pt-1">
                    <label className="font-bold text-slate-900 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span>3. Reason & Destination for Stock Reduction</span>
                        <span className="text-rose-600">*</span>
                      </span>
                      <span className="text-[10px] font-semibold text-teal-700 uppercase tracking-wider">
                        {dispensePurpose === 'INTERNAL'
                          ? '🏥 In-Clinic Use'
                          : dispensePurpose === 'TRANSFER'
                          ? '🔄 Inter-Clinic Requisition'
                          : '🗑️ Quality Disposal'}
                      </span>
                    </label>

                    {/* 3-Way Segmented Purpose Switcher */}
                    <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => {
                          setDispensePurpose('INTERNAL');
                          setSelectedDoctor(null);
                          setDispenseRecipient(`Internal Clinic Administration - ${internalDept}`);
                        }}
                        className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
                          dispensePurpose === 'INTERNAL'
                            ? 'bg-white text-teal-900 shadow-sm border border-teal-200'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                        }`}
                      >
                        <Building2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        <span className="truncate">🏥 In-Clinic Use</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDispensePurpose('TRANSFER');
                          setDispenseRecipient('');
                        }}
                        className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
                          dispensePurpose === 'TRANSFER'
                            ? 'bg-white text-teal-900 shadow-sm border border-teal-200'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                        }`}
                      >
                        <Network className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        <span className="truncate">🔄 Inter-Clinic Transfer</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDispensePurpose('DISPOSAL');
                          setSelectedDoctor(null);
                          setDispenseRecipient('Expired Batch Disposal');
                        }}
                        className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
                          dispensePurpose === 'DISPOSAL'
                            ? 'bg-white text-amber-950 shadow-sm border border-amber-300'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="truncate">🗑️ Disposal / Write-Off</span>
                      </button>
                    </div>

                    {/* ================= PURPOSE 1: INTERNAL IN-CLINIC CONSUMPTION ================= */}
                    {dispensePurpose === 'INTERNAL' && (
                      <div className="space-y-3 pt-1 animate-in fade-in duration-150">
                        {/* Facility Identification Banner */}
                        <div className="p-3 bg-teal-50/90 border border-teal-200 rounded-xl flex items-start gap-2.5 text-xs text-teal-950">
                          <Building2 className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-teal-900 block truncate">
                                🏥 {currentClinicFacility?.name || 'Local Health Facility'} (In-House Administration)
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-teal-200/70 text-teal-900">
                                Current Clinic
                              </span>
                            </div>
                            <p className="text-[11px] text-teal-800 mt-0.5 leading-relaxed">
                              Deducting stock for in-clinic patient care, emergency triage, or doctor-administered procedures.
                            </p>
                          </div>
                        </div>

                        {/* Internal Department Quick Presets */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                            <span>Select Internal Clinic Department / Station:</span>
                          </label>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                            {[
                              { id: 'OPD Patient Treatment', icon: '🩺', label: 'OPD Patient Care' },
                              { id: 'Emergency Triage (ER)', icon: '🚨', label: 'Emergency Room (ER)' },
                              { id: 'In-Patient Ward (IPD)', icon: '🛏️', label: 'In-Patient Ward' },
                              { id: 'Labour & Delivery', icon: '👶', label: 'Labour & Delivery' },
                              { id: 'Doctor Administered (Procedure)', icon: '👨‍⚕️', label: 'Doctor Procedure' },
                              { id: 'Dressing & Minor OT', icon: '🩹', label: 'Minor OT / Dressing' },
                            ].map((dept) => {
                              const isDeptActive = internalDept === dept.id;
                              return (
                                <button
                                  key={dept.id}
                                  type="button"
                                  onClick={() => {
                                    setInternalDept(dept.id);
                                    setDispenseRecipient(dept.id);
                                  }}
                                  className={`p-2 rounded-xl text-left border text-xs font-semibold transition-all flex items-center gap-2 ${
                                    isDeptActive
                                      ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                                      : 'bg-white text-slate-750 border-slate-200 hover:border-teal-400 hover:bg-teal-50/50'
                                  }`}
                                >
                                  <span className="text-sm">{dept.icon}</span>
                                  <span className="truncate text-[11px]">{dept.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Patient Reference / Case ID / Clinical Notes */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div className="space-y-1">
                            <label className="font-bold text-slate-900 flex items-center justify-between">
                              <span>Patient / OPD Case Ref # <span className="text-slate-400 font-normal">(Optional)</span></span>
                            </label>
                            <input
                              type="text"
                              value={dispenseNotes}
                              onChange={(e) => setDispenseNotes(e.target.value)}
                              placeholder="e.g. OPD-2026-4891 or ER Protocol"
                              className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="font-bold text-slate-900">
                              Active Batch & Storage
                            </label>
                            <div className="h-10 px-3 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-between text-xs font-mono text-slate-700">
                              <span>{matchedIntakeItem?.batchNumber || 'LOT-2026-01'}</span>
                              <span className="text-slate-500 text-[11px]">Exp: {matchedIntakeItem?.expiryDate || '2027-12'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ================= PURPOSE 2: INTER-CLINIC REQUISITION TRANSFER ================= */}
                    {dispensePurpose === 'TRANSFER' && (
                      <div className="space-y-2 pt-1 animate-in fade-in duration-150" ref={doctorDropdownRef}>
                        {/* Policy Banner */}
                        <div className="p-3 bg-emerald-50/90 border border-emerald-300 rounded-xl flex items-start gap-2.5 text-xs text-emerald-950">
                          <Building2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold block text-emerald-900">Inter-Clinic Transfer Requisition</span>
                            <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                              Dispensing medicines to another registered clinic or hospital in the district network upon their authorized requisition.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <label className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                            <Building2 className="w-3.5 h-3.5 text-teal-600" />
                            <span>Select Requesting Health Facility</span>
                            <span className="text-rose-600">*</span>
                          </label>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Clinic Request Required
                          </span>
                        </div>

                        {/* Interactive Combobox Input & Dropdown Menu */}
                        <div className="relative">
                          <div className="relative flex items-center">
                            <div className="absolute left-3 text-slate-400 pointer-events-none">
                              <Building2 className="w-4 h-4 text-teal-600" />
                            </div>
                            <input
                              type="text"
                              required
                              value={dispenseRecipient}
                              onFocus={() => setIsDoctorDropdownOpen(true)}
                              onChange={(e) => {
                                setDispenseRecipient(e.target.value);
                                if (selectedDoctor && e.target.value !== selectedDoctor.name) {
                                  setSelectedDoctor(null);
                                }
                                setIsDoctorDropdownOpen(true);
                              }}
                              placeholder="Select requesting clinic (e.g. Vadkhal PHC, Pen CHC, Roha SDH)..."
                              className="w-full h-11 pl-9 pr-24 rounded-xl bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-xs"
                            />
                            <div className="absolute right-2 flex items-center gap-1">
                              {dispenseRecipient && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDispenseRecipient('');
                                    setSelectedDoctor(null);
                                  }}
                                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
                                  title="Clear recipient"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setIsDoctorDropdownOpen((prev) => !prev)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 border border-teal-200 text-[11px] font-bold text-teal-800 transition-colors"
                              >
                                <span>Clinics</span>
                                <ChevronDown
                                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                    isDoctorDropdownOpen ? 'rotate-180' : ''
                                  }`}
                                />
                              </button>
                            </div>
                          </div>

                          {/* Dropdown Menu Popover */}
                          {isDoctorDropdownOpen && (
                            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-2xl border border-slate-200 divide-y divide-slate-100 z-50 max-h-[380px] overflow-y-auto">
                              <div className="p-2">
                                <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                                  <span className="flex items-center gap-1 text-teal-800">
                                    <Building2 className="w-3.5 h-3.5 text-teal-600" />
                                    Registered Requesting Health Clinics
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-normal">Network Facilities</span>
                                </div>
                                <div className="space-y-1 mt-1">
                                  {clinicFacilities.map((fac) => (
                                    <button
                                      key={fac.id}
                                      type="button"
                                      onClick={() => handleSelectFacility(fac)}
                                      className={`w-full text-left p-2 rounded-lg border transition-all flex items-start gap-2.5 ${
                                        dispenseRecipient.includes(fac.name)
                                          ? 'bg-teal-50/90 border-teal-400 text-teal-950 font-semibold'
                                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                                      }`}
                                    >
                                      <Building2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs font-bold text-slate-800 truncate">{fac.name}</span>
                                          <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                            {fac.type}
                                          </span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                                          <MapPin className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                                          <span>{fac.address}</span>
                                        </p>
                                      </div>
                                      {dispenseRecipient.includes(fac.name) && (
                                        <Check className="w-4 h-4 text-teal-600 shrink-0 mt-1" />
                                      )}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="p-2 bg-slate-50/50">
                                <div className="px-2 py-1 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                  <span className="flex items-center gap-1 text-teal-800">
                                    <Stethoscope className="w-3 h-3 text-teal-600" />
                                    Clinic Medical Officers ({clinicDoctors.length})
                                  </span>
                                </div>
                                <div className="space-y-1 mt-1">
                                  {clinicDoctors
                                    .filter((doc) => {
                                      if (!dispenseRecipient.trim() || selectedDoctor) return true;
                                      const q = dispenseRecipient.toLowerCase();
                                      return (
                                        doc.name.toLowerCase().includes(q) ||
                                        doc.facilityName.toLowerCase().includes(q) ||
                                        doc.facilityAddress.toLowerCase().includes(q)
                                      );
                                    })
                                    .map((doc) => {
                                      const isSelected = selectedDoctor?.id === doc.id || dispenseRecipient === doc.name;
                                      return (
                                        <button
                                          key={doc.id}
                                          type="button"
                                          onClick={() => handleSelectDoctor(doc)}
                                          className={`w-full text-left p-2 rounded-lg transition-all flex items-start gap-2.5 ${
                                            isSelected
                                              ? 'bg-teal-50/90 border border-teal-400 text-teal-950'
                                              : 'hover:bg-slate-50 border border-transparent text-slate-800'
                                          }`}
                                        >
                                          <div className="w-7 h-7 rounded-full bg-teal-100 border border-teal-300 text-teal-800 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                                            {doc.name.replace('Dr. ', '').charAt(0)}
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-1">
                                              <span className="text-xs font-bold text-slate-900 truncate">{doc.name}</span>
                                              <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-slate-100 text-slate-600">
                                                MO
                                              </span>
                                            </div>
                                            <p className="text-[11px] text-slate-500 truncate">{doc.facilityName}</p>
                                            <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                                              <MapPin className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                                              <span>{doc.facilityAddress}</span>
                                            </p>
                                          </div>
                                          {isSelected && <Check className="w-4 h-4 text-teal-600 shrink-0 mt-1" />}
                                        </button>
                                      );
                                    })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Selected Clinic Attribution Badge */}
                        {selectedDoctor && (
                          <div className="p-2.5 rounded-xl bg-teal-50/80 border border-teal-200 flex items-start justify-between gap-3 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                                🏥
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-slate-900 text-xs">{selectedDoctor.facilityName}</span>
                                  <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-teal-200/80 text-teal-900">
                                    Requesting Clinic
                                  </span>
                                </div>
                                <p className="text-[11px] text-teal-950 font-medium mt-0.5 flex items-center gap-1 truncate">
                                  <span>Requisitioning Officer: {selectedDoctor.name}</span>
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDoctor(null);
                                setDispenseRecipient('');
                              }}
                              className="text-[11px] text-slate-400 hover:text-rose-600 font-semibold shrink-0 p-1"
                              title="Clear clinic selection"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div className="space-y-1">
                            <label className="font-bold text-slate-900">
                              Requisition Memo / Reference # <span className="text-slate-400 font-normal">(Optional)</span>
                            </label>
                            <input
                              type="text"
                              value={dispenseNotes}
                              onChange={(e) => setDispenseNotes(e.target.value)}
                              placeholder="e.g. REQ-2026-9042 or Transfer Memo"
                              className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="font-bold text-slate-900">
                              Active Lot & Storage
                            </label>
                            <div className="h-10 px-3 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-between text-xs font-mono text-slate-700">
                              <span>{matchedIntakeItem?.batchNumber || 'LOT-2026-01'}</span>
                              <span className="text-slate-500 text-[11px]">Exp: {matchedIntakeItem?.expiryDate || '2027-12'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ================= PURPOSE 3: DISPOSAL / WRITE-OFF ================= */}
                    {dispensePurpose === 'DISPOSAL' && (
                      <div className="space-y-3 pt-1 animate-in fade-in duration-150">
                        <div className="p-3 bg-amber-50/90 border border-amber-300 rounded-xl flex items-start gap-2.5 text-xs text-amber-950">
                          <Trash2 className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold block text-amber-900">Inventory Write-Off & Disposal</span>
                            <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                              Deducting expired, broken, or temperature-breached medicines from active shelf stock to maintain clinic audit compliance.
                            </p>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-700">
                            Select Disposal Reason:
                          </label>
                          <div className="grid grid-cols-2 gap-1.5">
                            {[
                              'Expired Batch Disposal',
                              'Cold-Chain Temperature Breach',
                              'Broken / Contaminated Vial',
                              'Quality Recall Write-Off',
                            ].map((reason) => (
                              <button
                                key={reason}
                                type="button"
                                onClick={() => setDispenseRecipient(reason)}
                                className={`p-2 rounded-xl text-left border text-xs font-semibold transition-all ${
                                  dispenseRecipient === reason
                                    ? 'bg-amber-700 text-white border-amber-700'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50/50'
                                }`}
                              >
                                {reason}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-slate-900">
                            Disposal Incident Memo / Report # <span className="text-slate-400 font-normal">(Optional)</span>
                          </label>
                          <input
                            type="text"
                            value={dispenseNotes}
                            onChange={(e) => setDispenseNotes(e.target.value)}
                            placeholder="e.g. INCIDENT-2026-DISP-09"
                            className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons: Add to Prescription Order OR Solo Dispense */}
                  <div className="pt-3 space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={addMedicineToDispenseQueue}
                        disabled={
                          dispenseQty <= 0 ||
                          !matchedIntakeItem ||
                          matchedIntakeItem.quantity <= 0 ||
                          dispenseQty > matchedIntakeItem.quantity
                        }
                        className="sm:col-span-2 py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-[0.99]"
                      >
                        <ListPlus className="w-4 h-4" />
                        <span>+ Add Medicine to Prescription Order</span>
                      </button>
                      <button
                        type="submit"
                        disabled={
                          isSubmittingDispense ||
                          dispenseQty <= 0 ||
                          !matchedIntakeItem ||
                          matchedIntakeItem.quantity <= 0 ||
                          dispenseQty > matchedIntakeItem.quantity
                        }
                        className="py-3 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-300 flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all"
                        title="Dispense only this single medicine immediately"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Solo (-{dispenseQty})</span>
                      </button>
                    </div>
                  </div>
                </form>

                {/* Staged Prescription Dispense Order Manifest */}
                {queuedDispenseItems.length > 0 && (
                  <div className="p-4 rounded-2xl bg-teal-50/60 border-2 border-teal-300/80 shadow-sm space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between border-b border-teal-200/80 pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold shadow-2xs">
                          <ClipboardList className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                            <span>Prescription Dispense Order</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-teal-100 text-teal-800 font-bold border border-teal-300">
                              {queuedDispenseItems.length} Medicines Queued
                            </span>
                          </h4>
                          <p className="text-[11px] text-slate-600 flex items-center gap-1">
                            <span>
                              Requesting Clinic: <strong>{dispenseRecipient || selectedDoctor?.facilityName || 'Authorized Clinic Request'}</strong>
                            </span>
                            {dispenseNotes && <span className="font-mono text-slate-400">({dispenseNotes})</span>}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setQueuedDispenseItems([])}
                        className="text-[11px] text-slate-500 hover:text-rose-600 font-medium px-2 py-1 rounded-md hover:bg-white transition-colors"
                      >
                        Clear Order
                      </button>
                    </div>

                    {/* Recipient & Doctor attribution badge if selected */}
                    {selectedDoctor && (
                      <div className="p-2 rounded-xl bg-white border border-teal-200 flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-2">
                          <Stethoscope className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span className="font-semibold text-slate-800">{selectedDoctor.name}</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-600 truncate">{selectedDoctor.facilityName}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-rose-500" />
                          <span className="truncate">{selectedDoctor.facilityAddress}</span>
                        </span>
                      </div>
                    )}

                    {/* Manifest Items List */}
                    <div className="divide-y divide-teal-100/80 max-h-[260px] overflow-y-auto pr-1">
                      {queuedDispenseItems.map((item, index) => (
                        <div key={item.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                                {index + 1}
                              </span>
                              <span className="font-bold text-slate-900 truncate">{item.drugName}</span>
                              <span className="text-[10px] text-slate-500 font-normal">({item.form})</span>
                              {item.tier === 'EMERGENCY' && (
                                <span className="text-[9px] px-1 py-0.2 rounded font-bold bg-rose-100 text-rose-700">
                                  EMERGENCY
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 pl-7">
                              <span>
                                Available Shelf:{' '}
                                <strong className="text-slate-700">
                                  {item.availableStock} {item.unit}
                                </strong>
                              </span>
                              {item.batchNumber && <span>• Lot: {item.batchNumber}</span>}
                            </div>
                          </div>

                          {/* Quantity Stepper & Remove */}
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center border border-teal-300 rounded-lg bg-white shadow-2xs">
                              <button
                                type="button"
                                onClick={() => updateQueuedItemQuantity(item.id, -1, 'DISPENSE')}
                                className="px-2 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-l-md font-bold text-xs"
                                title="Decrease 1"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="px-2.5 py-1 font-mono font-bold text-xs text-teal-950 min-w-[36px] text-center">
                                -{item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateQueuedItemQuantity(item.id, 1, 'DISPENSE')}
                                disabled={(item.availableStock || 9999) <= item.quantity}
                                className="px-2 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-r-md font-bold text-xs disabled:opacity-30"
                                title="Increase 1"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                            <span className="text-[10px] font-semibold text-slate-500 w-10 truncate">{item.unit}</span>
                            <button
                              type="button"
                              onClick={() => removeQueuedItem(item.id, 'DISPENSE')}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Remove from dispense order"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Progress Feedback during execution */}
                    {isExecutingBatch && batchProgress && (
                      <div className="p-2.5 bg-teal-100/70 rounded-xl space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold text-teal-950">
                          <span className="flex items-center gap-1.5">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-700" />
                            <span>Dispensing: {batchProgress.drugName}</span>
                          </span>
                          <span>
                            {batchProgress.current} / {batchProgress.total}
                          </span>
                        </div>
                        <div className="w-full bg-teal-200 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-teal-600 h-full transition-all duration-300"
                            style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Primary Batch Execution Action Button */}
                    <button
                      type="button"
                      disabled={isExecutingBatch || queuedDispenseItems.length === 0}
                      onClick={executeBatchDispense}
                      className="w-full py-3.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-[0.99]"
                    >
                      {isExecutingBatch ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Authorizing & Dispensing ({batchProgress?.current || 1}/{queuedDispenseItems.length})...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>
                            Authorize & Dispense Complete Order ({queuedDispenseItems.length} Medicines • -{totalDispenseUnits} Units)
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
            </div>

            {/* Right Column: Dynamic Safety Protocol & Shift Activity Ledger */}
            <div className="lg:col-span-5 space-y-4">
              {/* Dynamic Safety Checklist based on Active Mode */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                    <FileCheck className="w-4 h-4 text-teal-600" />
                    <span>
                      {stockOpMode === 'RESTOCK'
                        ? 'Depot Intake Quality Checklist'
                        : '5-Rights Clinical Dispensing Protocol'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">SOP Compliant</span>
                </div>

                {stockOpMode === 'RESTOCK' ? (
                  <div className="space-y-2 text-[11px] text-slate-600">
                    <div className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Inspect outer carton seal and tamper-evident band integrity.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Verify Vaccine Vial Monitor (VVM) indicator on cold-chain biologics.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Confirm physical count matches Depot Delivery Challan quantity.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Confirm remaining shelf life exceeds mandatory 12-month window.</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-[11px] text-slate-600">
                    <div className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                      <span><strong>Right Patient:</strong> Verify recipient identification against OPD card.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                      <span><strong>Right Medication:</strong> Double check generic salt and dosage form.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                      <span><strong>Right Dose & Quantity:</strong> Confirm prescribed unit count on label.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                      <span><strong>Audit Trail:</strong> Signed and permanently attributed to duty medical officer.</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Live Shift Activity Ledger (Restocks + Dispenses with Filters) */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <h4 className="font-bold text-xs text-slate-900">Duty Shift Stock Activity</h4>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">Real-time</span>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setActivityFilter('ALL')}
                    className={`flex-1 py-1 rounded-lg text-center transition-all ${
                      activityFilter === 'ALL'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    All ({shiftTransactions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivityFilter('RESTOCK')}
                    className={`flex-1 py-1 rounded-lg text-center transition-all ${
                      activityFilter === 'RESTOCK'
                        ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    📥 Restocks ({shiftTransactions.filter((t) => t.type === 'RESTOCK').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivityFilter('DISPENSE')}
                    className={`flex-1 py-1 rounded-lg text-center transition-all ${
                      activityFilter === 'DISPENSE'
                        ? 'bg-teal-600 text-white shadow-2xs font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    📤 Dispenses ({shiftTransactions.filter((t) => t.type === 'DISPENSE').length})
                  </button>
                </div>

                {/* List */}
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {shiftTransactions
                    .filter((t) => (activityFilter === 'ALL' ? true : t.type === activityFilter))
                    .map((tx) => (
                      <div
                        key={tx.id}
                        className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5 text-xs hover:border-slate-300 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                tx.type === 'RESTOCK' ? 'bg-emerald-500' : 'bg-teal-600'
                              }`}
                            ></span>
                            <span className="font-bold text-slate-900">{tx.drugName}</span>
                          </div>
                          <span
                            className={`font-mono font-bold px-2 py-0.5 rounded border text-[11px] ${
                              tx.type === 'RESTOCK'
                                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                : 'text-teal-800 bg-teal-50 border-teal-200'
                            }`}
                          >
                            {tx.type === 'RESTOCK' ? `+${tx.quantity}` : `-${tx.quantity}`} {tx.unit}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
                          <span>
                            {tx.type === 'RESTOCK'
                              ? `Challan: ${tx.notes || tx.counterparty || 'Depot Inward'}`
                              : `To: ${tx.counterparty || 'OPD Patient'}`}
                          </span>
                          <span className="font-mono text-slate-400">
                            {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-200/60 font-mono">
                          <span>{tx.workerName || 'Dr. Rahul Sharma'}</span>
                          <span>{tx.id}</span>
                        </div>
                      </div>
                    ))}
                </div>

                <div className="pt-1 text-center">
                  <Link
                    href="/audit"
                    className="text-[11px] font-semibold text-teal-700 hover:text-teal-900 hover:underline inline-flex items-center gap-1"
                  >
                    <span>View Cryptographic Audit Trail →</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 6. VIEW 4: ALL DISPENSARY FORMULARY LEDGER (MASTER INVENTORY)         */}
      {/* ===================================================================== */}
      {activeView === 'all' && (
        <section className="space-y-4 animate-in fade-in duration-200">
          {/* Executive KPI Summary Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
            <div
              onClick={() => setSelectedCategory('ALL')}
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs cursor-pointer hover:border-teal-500/50 transition-all"
            >
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold">Total Formulary</span>
                <Layers className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-slate-900">{items.length}</span>
                <span className="text-xs text-slate-500">active medicines</span>
              </div>
            </div>

            <div
              onClick={() => setSelectedCategory('ALL')}
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs cursor-pointer hover:border-emerald-500/50 transition-all"
            >
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold">Adequate Stock</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-emerald-700">
                  {items.filter((i) => (Number(i.quantity) || 0) > Number(i.threshold || 0) && i.status !== 'OUT_OF_STOCK').length}
                </span>
                <span className="text-xs text-emerald-600">above threshold</span>
              </div>
            </div>

            <div
              onClick={() => switchView('important')}
              className={`bg-white p-4 rounded-xl border shadow-xs cursor-pointer hover:border-amber-400 transition-all ${
                items.filter((i) => (Number(i.quantity) || 0) > 0 && ((Number(i.quantity) || 0) <= Number(i.threshold || 10) || i.status === 'LOW_STOCK')).length > 0
                  ? 'border-amber-300 bg-amber-50/20'
                  : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold">Low Buffer Attention</span>
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-amber-700">
                  {items.filter((i) => (Number(i.quantity) || 0) > 0 && ((Number(i.quantity) || 0) <= Number(i.threshold || 10) || i.status === 'LOW_STOCK')).length}
                </span>
                <span className="text-xs text-amber-600">important triage →</span>
              </div>
            </div>

            <div
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('open-stock-alert-center'));
                }
              }}
              className={`bg-white p-4 rounded-xl border shadow-xs cursor-pointer hover:border-rose-400 transition-all ${
                items.filter((i) => (Number(i.quantity) || 0) <= 0 || i.status === 'OUT_OF_STOCK').length > 0
                  ? 'border-rose-300 bg-rose-50/20'
                  : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold">Stockouts</span>
                <AlertCircle className="w-4 h-4 text-rose-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-rose-700">
                  {items.filter((i) => (Number(i.quantity) || 0) <= 0 || i.status === 'OUT_OF_STOCK').length}
                </span>
                <span className="text-xs text-rose-600">open alert center →</span>
              </div>
            </div>
          </div>

          {/* Table Header Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3 pt-2">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Dispensary Shelf Stock Ledger
                </h2>
                <span className="text-xs font-mono text-slate-400">
                  ({filteredLedgerItems.length} of {items.length} items)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Authoritative single source of truth • Click any row for lot, storage, and referral details
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => switchView('stock-entry')}
                className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition-all"
                type="button"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>⚡ Stock Operations Desk</span>
              </button>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap items-center gap-1 bg-white p-1 rounded-lg border border-slate-200">
                {[
                  { id: 'ALL', label: 'All' },
                  { id: 'EMERGENCY', label: 'Emergency' },
                  { id: 'COLD_CHAIN', label: 'Cold Storage' },
                  { id: 'ESSENTIAL', label: 'Essential' },
                  { id: 'CRITICAL', label: 'Low / Critical' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedCategory(tab.id)}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                      selectedCategory === tab.id
                        ? 'bg-teal-700 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                    type="button"
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Streamlined 5-Column Ledger Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4 w-[35%]">Medicine</th>
                    <th className="py-3 px-4 w-[20%]">Category</th>
                    <th className="py-3 px-4 w-[18%]">Shelf Stock</th>
                    <th className="py-3 px-4 w-[12%]">Status</th>
                    <th className="py-3 px-4 w-[15%] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLedgerItems.map((item) => {
                    const qtyNum = Number(item.quantity) || 0;
                    const isOut = qtyNum <= 0 || item.status === 'OUT_OF_STOCK';
                    const isLow = !isOut && (item.status === 'LOW_STOCK' || qtyNum <= Number(item.threshold || 10));
                    const isExpanded = expandedRow === item.drugId;

                    return (
                      <React.Fragment key={item.drugId}>
                        <tr
                          onClick={() => setExpandedRow(isExpanded ? null : item.drugId)}
                          className={`cursor-pointer transition-colors ${
                            isExpanded ? 'bg-slate-50/90' : 'hover:bg-slate-50/60'
                          }`}
                        >
                          {/* 1. Medicine: Name & Generic */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-start gap-2">
                              <span className="text-slate-400 mt-0.5 shrink-0">
                                {isExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5 text-teal-700" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5" />
                                )}
                              </span>
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-900 text-sm">{item.drugName}</span>
                                <span className="text-xs text-slate-500 font-normal">
                                  {item.genericName} · {item.form}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* 2. Category */}
                          <td className="py-3.5 px-4">
                            <span className="text-xs text-slate-600 font-medium">{item.category}</span>
                          </td>

                          {/* 3. Shelf Stock */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-baseline gap-1.5 font-mono">
                              <span
                                className={`text-base font-bold ${
                                  isOut ? 'text-rose-700' : isLow ? 'text-amber-700' : 'text-slate-900'
                                }`}
                              >
                                {item.quantity}
                              </span>
                              <span className="text-xs text-slate-400 font-sans font-normal">{item.unit}</span>
                            </div>
                          </td>

                          {/* 4. Status Pill */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                isOut
                                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                                  : isLow
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              }`}
                            >
                              {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                            </span>
                          </td>

                          {/* 5. Actions */}
                          <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openStockEntryForDrug(item.drugId, 'RESTOCK')}
                                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold rounded-lg transition-all flex items-center gap-1 text-[11px]"
                                type="button"
                                title="Add inward restock shipment"
                              >
                                <Plus className="w-3 h-3 text-emerald-700" />
                                <span>Restock</span>
                              </button>
                              <button
                                onClick={() => openStockEntryForDrug(item.drugId, 'DISPENSE', 'INTERNAL')}
                                disabled={isOut}
                                className="px-2.5 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:hover:bg-teal-600 text-white font-bold rounded-lg shadow-2xs transition-all flex items-center gap-1 text-[11px]"
                                type="button"
                                title="Deduct stock for in-clinic patient treatment or procedure"
                              >
                                <Minus className="w-3 h-3" />
                                <span>Use / Reduce</span>
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Progressive Disclosure: Expandable Detail */}
                        {isExpanded && (
                          <tr className="bg-slate-50/80 border-y border-slate-200/80">
                            <td colSpan={5} className="py-3 px-6 text-xs text-slate-600">
                              <div className="flex flex-wrap items-center justify-between gap-4">
                                <div className="flex flex-wrap items-center gap-6 text-[11px] text-slate-500 font-mono">
                                  <div>
                                    <span className="text-slate-400 font-sans">Batch:</span>{' '}
                                    <strong className="text-slate-800">{item.batchNumber || 'LOT-2026-01'}</strong>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 font-sans">Expiry:</span>{' '}
                                    <strong className="text-slate-800">{item.expiryDate || '2027-12'}</strong>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 font-sans">Safety Buffer:</span>{' '}
                                    <strong className="text-slate-800">
                                      {item.threshold} {item.unit}
                                    </strong>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 font-sans">Storage:</span>{' '}
                                    <strong className="text-slate-800">
                                      {item.storageLocation ||
                                        (item.tier === 'EMERGENCY' ? 'Cold-Chain ILR' : 'Shelf Rack 3')}
                                    </strong>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 text-xs">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openStockEntryForDrug(item.drugId, 'DISPENSE', 'INTERNAL');
                                    }}
                                    disabled={isOut}
                                    className="text-teal-700 hover:text-teal-900 font-bold hover:underline flex items-center gap-1 disabled:opacity-50"
                                    type="button"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                    <span>🏥 In-Clinic Patient Use</span>
                                  </button>
                                  <span className="text-slate-300">·</span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openStockEntryForDrug(item.drugId, 'RESTOCK');
                                    }}
                                    className="text-emerald-700 hover:text-emerald-900 font-bold hover:underline flex items-center gap-1"
                                    type="button"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>📥 Inward Restock</span>
                                  </button>
                                  <span className="text-slate-300">·</span>
                                  <Link
                                    href={`/locator?drug=${item.drugId}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-slate-600 hover:text-teal-700 font-medium hover:underline flex items-center gap-1"
                                  >
                                    <Network className="w-3 h-3 text-teal-600" />
                                    <span>Locate in network</span>
                                  </Link>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </WorkstationShell>
  );
}

export default function RapidDeskPage() {
  return (
    <Suspense
      fallback={<div className="p-8 text-center text-xs text-slate-400 font-mono">Loading Meditory Workstation...</div>}
    >
      <RapidDeskContent />
    </Suspense>
  );
}
