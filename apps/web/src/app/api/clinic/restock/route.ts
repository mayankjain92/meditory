import { NextRequest, NextResponse } from 'next/server';
import { globalInventory, globalAuditLogs } from '@/lib/inventory-store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { drugId, quantity, workerName = 'Dr. Rahul Sharma', workerId = 'USR-ALIBAG-01' } = body;

    const item = globalInventory.find((i) => i.drugId === drugId);
    if (!item) {
      return NextResponse.json({ error: 'ItemNotFound', message: 'Medicine not found on shelf.' }, { status: 404 });
    }

    const previousQuantity = item.quantity;
    const increment = parseInt(quantity, 10) || 10;
    const newQuantity = previousQuantity + increment;
    item.quantity = newQuantity;
    item.status = newQuantity <= item.threshold ? 'LOW_STOCK' : 'IN_STOCK';
    item.updatedAt = new Date().toISOString();

    const auditEntry = {
      id: `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
      facilityId: item.facilityId,
      timestamp: new Date().toISOString(),
      action: 'RESTOCK' as const,
      delta: increment,
      previousQuantity,
      newQuantity,
      drugId: item.drugId,
      drugName: item.drugName,
      batchNumber: item.batchNumber,
      workerId,
      workerName,
      sha256Hash: `${Math.random().toString(36).substring(2, 10)}...${Math.random().toString(36).substring(2, 6)}`,
    };

    globalAuditLogs.unshift(auditEntry);

    return NextResponse.json({
      success: true,
      drugId: item.drugId,
      drugName: item.drugName,
      previousQuantity,
      newQuantity,
      status: item.status,
      auditEntry,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'RestockError', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
