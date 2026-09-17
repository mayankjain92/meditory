import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAMES } from './shared/ddb.js';

async function inspectDatabase() {
  console.log(`\n======================================================`);
  console.log(`🔍 [Meditory DDB Inspector] Multi-Table Overview`);
  console.log(`   Endpoint: ${process.env.DYNAMODB_ENDPOINT || 'AWS Cloud'}`);
  console.log(`======================================================\n`);

  // 1. Health Facilities Table
  const facRes = await docClient.send(new ScanCommand({ TableName: TABLE_NAMES.FACILITIES }));
  const facilities = (facRes.Items || []).map((f) => ({
    ID: f.id,
    Name: f.name,
    Type: f.type,
    District: f.districtName,
    Phone: f.phone,
    Address: f.address,
  }));
  console.log(`🏥 TABLE: ${TABLE_NAMES.FACILITIES} (${facilities.length} clinics)`);
  console.table(facilities);

  // 2. Healthcare Workers Table
  const workRes = await docClient.send(new ScanCommand({ TableName: TABLE_NAMES.WORKERS }));
  const workers = (workRes.Items || []).map((w) => ({
    ID: w.id,
    Name: w.name,
    Email: w.email,
    Facility: w.facilityId,
    Role: w.role,
    Status: w.status,
  }));
  console.log(`\n👨‍⚕️ TABLE: ${TABLE_NAMES.WORKERS} (${workers.length} staff logins)`);
  console.table(workers);

  // 3. Clinic Inventories Table
  const invRes = await docClient.send(new ScanCommand({ TableName: TABLE_NAMES.INVENTORY }));
  const inventory = (invRes.Items || [])
    .map((inv) => ({
      Clinic: inv.facilityId,
      Medicine: inv.drugName,
      Stock: `${inv.quantity} ${inv.unit}`,
      Threshold: inv.threshold,
      Tier: inv.tier,
      Status: inv.status,
    }))
    .sort((a, b) => a.Clinic.localeCompare(b.Clinic));
  console.log(`\n💊 TABLE: ${TABLE_NAMES.INVENTORY} (${inventory.length} shelf stocks)`);
  console.table(inventory);

  // 4. Audit Logs Table
  const audRes = await docClient.send(new ScanCommand({ TableName: TABLE_NAMES.AUDIT_LOGS }));
  const auditLogs = (audRes.Items || []).map((a) => ({
    Clinic: a.facilityId,
    Timestamp: a.timestamp,
    Action: a.action,
    Delta: a.delta,
    NewStock: a.newQuantity,
    Drug: a.drugName,
    Staff: a.workerName,
  }));
  console.log(`\n📜 TABLE: ${TABLE_NAMES.AUDIT_LOGS} (${auditLogs.length} audit entries)`);
  console.table(auditLogs);
}

inspectDatabase().catch(console.error);
