import { NextRequest, NextResponse } from 'next/server';
import { globalInventory, globalAuditLogs } from '@/lib/inventory-store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { drugId, delta = -1, workerName = 'Dr. Rahul Sharma', workerId = 'USR-ALIBAG-01' } = body;

    const item = globalInventory.find((i) => i.drugId === drugId);
    if (!item) {
      return NextResponse.json({ error: 'ItemNotFound', message: 'Medicine not found on shelf.' }, { status: 404 });
    }

    if (item.quantity <= 0) {
      return NextResponse.json(
        {
          error: 'STOCKOUT',
          message: `Cannot dispense ${item.drugName}: Physical stock is already 0.`,
        },
        { status: 400 }
      );
    }

    const previousQuantity = item.quantity;
    const decrement = Math.abs(delta);
    const newQuantity = Math.max(0, previousQuantity - decrement);
    item.quantity = newQuantity;
    item.status = newQuantity === 0 ? 'OUT_OF_STOCK' : newQuantity <= item.threshold ? 'LOW_STOCK' : 'IN_STOCK';
    item.updatedAt = new Date().toISOString();

    const auditEntry = {
      id: `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
      facilityId: item.facilityId,
      timestamp: new Date().toISOString(),
      action: 'DISPENSE' as const,
      delta: -decrement,
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

    const alarmTriggered = item.isCritical && newQuantity <= item.threshold;

    return NextResponse.json({
      success: true,
      drugId: item.drugId,
      drugName: item.drugName,
      previousQuantity,
      newQuantity,
      status: item.status,
      auditEntry,
      alarmTriggered,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'DispenseError', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
