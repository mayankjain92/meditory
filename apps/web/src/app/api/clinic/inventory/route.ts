import { NextRequest, NextResponse } from 'next/server';
import { globalInventory } from '@/lib/inventory-store';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const drugId = url.searchParams.get('drugId');

  if (drugId) {
    const item = globalInventory.find((i) => i.drugId === drugId);
    if (!item) {
      return NextResponse.json({ error: 'NotFound', message: 'Item not found' }, { status: 404 });
    }
    return NextResponse.json(item);
  }

  const lowStockCount = globalInventory.filter((i) => i.status === 'LOW_STOCK').length;
  const criticalStockoutCount = globalInventory.filter((i) => i.quantity === 0 && i.isCritical).length;

  return NextResponse.json({
    facility: {
      id: 'PHC-SECTOR4-01',
      name: 'PHC Sector 4 — Dispensary Terminal A',
      districtId: 'DISTRICT-RAIGAD',
      districtName: 'Raigad',
      type: 'PHC',
      phone: '+91 2141 223190',
    },
    items: globalInventory,
    totalDrugs: globalInventory.length,
    lowStockCount,
    criticalStockoutCount,
  });
}
