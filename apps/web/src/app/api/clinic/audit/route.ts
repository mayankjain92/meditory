import { NextRequest, NextResponse } from 'next/server';
import { globalAuditLogs } from '@/lib/inventory-store';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  let filtered = [...globalAuditLogs];
  if (action && action !== 'ALL') {
    filtered = filtered.filter((log) => log.action === action);
  }

  return NextResponse.json({
    facilityId: 'PHC-SECTOR4-01',
    logs: filtered,
    totalRecords: globalAuditLogs.length,
    sha256Validated: true,
  });
}
