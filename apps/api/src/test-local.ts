import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAMES, INDEX_NAMES } from './shared/ddb.js';

async function verifyMultiTable() {
  console.log(`\n--- 1. Direct User Login Lookup in '${TABLE_NAMES.WORKERS}' ---`);
  const userRes = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAMES.WORKERS,
      Key: {
        email: 'rahul.sharma@phc-alibag.in',
      },
    })
  );
  console.log(`Found Staff: ${userRes.Item?.name} | Assigned Clinic: ${userRes.Item?.facilityId} | Role: ${userRes.Item?.role}`);

  console.log(`\n--- 2. Direct Clinic Inventory Query in '${TABLE_NAMES.INVENTORY}' ---`);
  const invRes = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAMES.INVENTORY,
      KeyConditionExpression: 'facilityId = :fId',
      ExpressionAttributeValues: {
        ':fId': 'PHC-ALIBAG-01',
      },
    })
  );
  console.log(`Alibag PHC Inventory Count: ${invRes.Items?.length} items`);
  invRes.Items?.forEach((item) => {
    console.log(`  - ${item.drugName}: ${item.quantity} ${item.unit} [${item.status}]`);
  });

  console.log(`\n--- 3. Inter-Clinic Stock Locator via '${INDEX_NAMES.INVENTORY_BY_DRUG}' on '${TABLE_NAMES.INVENTORY}' ---`);
  const referralRes = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAMES.INVENTORY,
      IndexName: INDEX_NAMES.INVENTORY_BY_DRUG,
      KeyConditionExpression: 'drugId = :dId',
      ExpressionAttributeValues: {
        ':dId': 'DRUG-ASV-01',
      },
    })
  );
  console.log(`Clinics with Anti-Snake Venom stock:`);
  referralRes.Items?.forEach((item) => {
    console.log(`  - Clinic: ${item.facilityId} | Stock: ${item.quantity} ${item.unit} (${item.status})`);
  });
}

verifyMultiTable().catch(console.error);
