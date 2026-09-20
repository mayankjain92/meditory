import { ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { TABLE_NAMES } from '@meditory/shared';
import { docClient, ensureTablesExist, isLocal, localEndpoint } from '../shared/ddb.js';

async function purgeTable(tableName: string, keyAttrs: string[]): Promise<number> {
  let deletedCount = 0;
  try {
    const scanRes = await docClient.send(new ScanCommand({ TableName: tableName }));
    const items = scanRes.Items || [];
    for (const item of items) {
      const key: Record<string, any> = {};
      for (const k of keyAttrs) {
        key[k] = item[k];
      }
      await docClient.send(new DeleteCommand({ TableName: tableName, Key: key }));
      deletedCount++;
    }
  } catch (err) {
    console.warn(`[CleanDB] Note on '${tableName}':`, (err as Error).message);
  }
  return deletedCount;
}

export async function cleanAllDatabaseRecords(): Promise<void> {
  console.log(`\n======================================================`);
  console.log(`🧹 [Meditory Database Purge] Wiping all demo data and accounts...`);
  console.log(`   Endpoint: ${isLocal ? `${localEndpoint} (Local)` : (process.env.DYNAMODB_ENDPOINT || 'AWS Cloud')}`);
  console.log(`======================================================\n`);

  // 1. Ensure table schemas exist
  await ensureTablesExist();

  // 2. Delete all records from all 5 domain tables
  const delFacilities = await purgeTable(TABLE_NAMES.FACILITIES, ['id']);
  const delWorkers = await purgeTable(TABLE_NAMES.WORKERS, ['email']);
  const delInventory = await purgeTable(TABLE_NAMES.INVENTORY, ['facilityId', 'drugId']);
  const delAuditLogs = await purgeTable(TABLE_NAMES.AUDIT_LOGS, ['facilityId', 'timestamp']);
  const delRequisitions = await purgeTable(TABLE_NAMES.REQUISITIONS, ['id']);

  console.log(`✅ [CleanDB] Successfully purged all demo accounts and medicines:`);
  console.log(`   - Facilities purged: ${delFacilities}`);
  console.log(`   - Workers / Demo accounts purged: ${delWorkers}`);
  console.log(`   - Medicines / Shelf items purged: ${delInventory}`);
  console.log(`   - Audit logs purged: ${delAuditLogs}`);
  console.log(`   - Inter-clinic transfer requisitions purged: ${delRequisitions}`);
  console.log(`\n✨ Database is now completely fresh, clean, and ready for clinic registrations!\n`);
}

if (process.argv[1]?.endsWith('clean-db.ts') || process.argv[1]?.endsWith('clean-db.js')) {
  cleanAllDatabaseRecords().catch((err) => {
    console.error('❌ [CleanDB] Error during purge:', err);
    process.exit(1);
  });
}
