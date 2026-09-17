import { NextRequest, NextResponse } from 'next/server';

export interface ClinicStockResult {
  facilityId: string;
  facilityName: string;
  facilityType: 'PHC' | 'CHC' | 'SUB_CENTRE';
  districtName: string;
  phone: string;
  doctorInCharge: string;
  distanceKm: number;
  quantity: number;
  unit: string;
  batchNumber: string;
  coldChainTemp: string;
  status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  lastVerifiedAt: string;
  transitTimeEstimate: string;
}

const NETWORK_STOCK_DIRECTORY: Record<string, ClinicStockResult[]> = {
  'DRUG-ASV-01': [
    {
      facilityId: 'PHC-ALIBAG-01',
      facilityName: 'Alibag Primary Health Centre',
      facilityType: 'PHC',
      districtName: 'Raigad',
      phone: '+91 2141 222045',
      doctorInCharge: 'Dr. Ramesh Patil (MO)',
      distanceKm: 4.2,
      quantity: 32,
      unit: 'vials',
      batchNumber: 'ASV-2024-91B',
      coldChainTemp: '3.1°C',
      status: 'IN_STOCK',
      lastVerifiedAt: '12 mins ago',
      transitTimeEstimate: '11 mins (Emergency Ambulance 108)',
    },
    {
      facilityId: 'PHC-VADKHAL-02',
      facilityName: 'Vadkhal Primary Health Centre',
      facilityType: 'PHC',
      districtName: 'Raigad',
      phone: '+91 2143 252110',
      doctorInCharge: 'Dr. Priya Deshmukh (MO)',
      distanceKm: 12.8,
      quantity: 14,
      unit: 'vials',
      batchNumber: 'ASV-2024-85C',
      coldChainTemp: '3.4°C',
      status: 'IN_STOCK',
      lastVerifiedAt: '24 mins ago',
      transitTimeEstimate: '22 mins (State Highway 66)',
    },
    {
      facilityId: 'CHC-PEN-03',
      facilityName: 'Pen Community Health Centre',
      facilityType: 'CHC',
      districtName: 'Raigad',
      phone: '+91 2143 252030',
      doctorInCharge: 'Dr. Amit Patil (Medical Supdt)',
      distanceKm: 19.5,
      quantity: 56,
      unit: 'vials',
      batchNumber: 'ASV-2024-102',
      coldChainTemp: '3.2°C',
      status: 'IN_STOCK',
      lastVerifiedAt: '6 mins ago',
      transitTimeEstimate: '32 mins (Express Corridor)',
    },
  ],
  'DRUG-ARV-01': [
    {
      facilityId: 'PHC-ALIBAG-01',
      facilityName: 'Alibag Primary Health Centre',
      facilityType: 'PHC',
      districtName: 'Raigad',
      phone: '+91 2141 222045',
      doctorInCharge: 'Dr. Ramesh Patil (MO)',
      distanceKm: 4.2,
      quantity: 18,
      unit: 'vials',
      batchNumber: 'RBV-2024-33D',
      coldChainTemp: '2.9°C',
      status: 'IN_STOCK',
      lastVerifiedAt: '8 mins ago',
      transitTimeEstimate: '11 mins (Emergency Ambulance 108)',
    },
    {
      facilityId: 'SUB-REVAS-04',
      facilityName: 'Revas Coastal Sub-Centre',
      facilityType: 'SUB_CENTRE',
      districtName: 'Raigad',
      phone: '+91 2141 229104',
      doctorInCharge: 'Sunita Gaikwad (ANM Officer)',
      distanceKm: 7.1,
      quantity: 8,
      unit: 'vials',
      batchNumber: 'RBV-2024-21A',
      coldChainTemp: '3.6°C',
      status: 'IN_STOCK',
      lastVerifiedAt: '15 mins ago',
      transitTimeEstimate: '16 mins (Coastal Road)',
    },
    {
      facilityId: 'CHC-PEN-03',
      facilityName: 'Pen Community Health Centre',
      facilityType: 'CHC',
      districtName: 'Raigad',
      phone: '+91 2143 252030',
      doctorInCharge: 'Dr. Amit Patil (Medical Supdt)',
      distanceKm: 19.5,
      quantity: 42,
      unit: 'vials',
      batchNumber: 'RBV-2024-55E',
      coldChainTemp: '3.2°C',
      status: 'IN_STOCK',
      lastVerifiedAt: '4 mins ago',
      transitTimeEstimate: '32 mins (Express Corridor)',
    },
  ],
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const drugId = url.searchParams.get('drugId') || 'DRUG-ARV-01';

  const results = NETWORK_STOCK_DIRECTORY[drugId] || [
    {
      facilityId: 'PHC-ALIBAG-01',
      facilityName: 'Alibag Primary Health Centre',
      facilityType: 'PHC',
      districtName: 'Raigad',
      phone: '+91 2141 222045',
      doctorInCharge: 'Dr. Ramesh Patil',
      distanceKm: 4.2,
      quantity: 24,
      unit: 'units',
      batchNumber: 'GEN-2024-99',
      coldChainTemp: '3.5°C',
      status: 'IN_STOCK',
      lastVerifiedAt: '10 mins ago',
      transitTimeEstimate: '12 mins',
    },
  ];

  return NextResponse.json({
    drugId,
    queryTimestamp: new Date().toISOString(),
    district: 'Raigad District Health Network',
    results,
  });
}
