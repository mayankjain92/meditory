import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  ResourceNotFoundException,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { TABLE_NAMES, INDEX_NAMES } from '@meditory/shared';

export { TABLE_NAMES, INDEX_NAMES };

export const isLocal =
  process.env.USE_AWS === 'true' || process.env.TARGET_AWS === 'true'
    ? false
    : !!process.env.DYNAMODB_ENDPOINT || !process.env.AWS_LAMBDA_FUNCTION_NAME;
export const localEndpoint = process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000';

/**
 * DynamoDB Client with Dual-Mode configuration:
 * 1. If running locally or DYNAMODB_ENDPOINT is provided, connects to local Docker container.
 * 2. Otherwise connects to real AWS using standard credential provider chain.
 */
export const ddbClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1',
  ...(isLocal
    ? {
        endpoint: localEndpoint,
        credentials: {
          accessKeyId: 'localMockKey',
          secretAccessKey: 'localMockSecret',
        },
      }
    : {}),
});

/**
 * DynamoDB DocumentClient with automatic object unmarshalling
 */
export const docClient = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

/**
 * Creates a table if it doesn't already exist
 */
async function createTableIfNotExists(command: CreateTableCommand): Promise<void> {
  const tableName = command.input.TableName!;
  try {
    await ddbClient.send(new DescribeTableCommand({ TableName: tableName }));
    console.log(`[DDB] Table '${tableName}' already exists.`);
  } catch (error) {
    if (error instanceof ResourceNotFoundException || (error as { name?: string }).name === 'ResourceNotFoundException') {
      await ddbClient.send(command);
      console.log(`[DDB] Table '${tableName}' created successfully.`);
    } else {
      throw error;
    }
  }
}

/**
 * Ensures all clean domain tables are created
 */
export async function ensureTablesExist(): Promise<void> {
  // 1. Facilities Table (PK: id)
  await createTableIfNotExists(
    new CreateTableCommand({
      TableName: TABLE_NAMES.FACILITIES,
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
      BillingMode: 'PAY_PER_REQUEST',
    })
  );

  // 2. Workers Table (PK: email)
  await createTableIfNotExists(
    new CreateTableCommand({
      TableName: TABLE_NAMES.WORKERS,
      KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
      AttributeDefinitions: [{ AttributeName: 'email', AttributeType: 'S' }],
      BillingMode: 'PAY_PER_REQUEST',
    })
  );

  // 3. Inventory Table (PK: facilityId, SK: drugId, GSI: DrugLookupIndex)
  await createTableIfNotExists(
    new CreateTableCommand({
      TableName: TABLE_NAMES.INVENTORY,
      KeySchema: [
        { AttributeName: 'facilityId', KeyType: 'HASH' },
        { AttributeName: 'drugId', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'facilityId', AttributeType: 'S' },
        { AttributeName: 'drugId', AttributeType: 'S' },
        { AttributeName: 'status', AttributeType: 'S' },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: INDEX_NAMES.INVENTORY_BY_DRUG,
          KeySchema: [
            { AttributeName: 'drugId', KeyType: 'HASH' },
            { AttributeName: 'status', KeyType: 'RANGE' },
          ],
          Projection: {
            ProjectionType: 'ALL',
          },
        },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    })
  );

  // 4. Audit Logs Table (PK: facilityId, SK: timestamp)
  await createTableIfNotExists(
    new CreateTableCommand({
      TableName: TABLE_NAMES.AUDIT_LOGS,
      KeySchema: [
        { AttributeName: 'facilityId', KeyType: 'HASH' },
        { AttributeName: 'timestamp', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'facilityId', AttributeType: 'S' },
        { AttributeName: 'timestamp', AttributeType: 'S' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    })
  );

  // 5. Inter-Clinic Requisitions Table (PK: id, GSIs: DonorIndex, RequesterIndex)
  await createTableIfNotExists(
    new CreateTableCommand({
      TableName: TABLE_NAMES.REQUISITIONS,
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' },
        { AttributeName: 'donorFacilityId', AttributeType: 'S' },
        { AttributeName: 'requesterFacilityId', AttributeType: 'S' },
        { AttributeName: 'createdAt', AttributeType: 'S' },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: INDEX_NAMES.REQUISITIONS_BY_DONOR,
          KeySchema: [
            { AttributeName: 'donorFacilityId', KeyType: 'HASH' },
            { AttributeName: 'createdAt', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
        {
          IndexName: INDEX_NAMES.REQUISITIONS_BY_REQUESTER,
          KeySchema: [
            { AttributeName: 'requesterFacilityId', KeyType: 'HASH' },
            { AttributeName: 'createdAt', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    })
  );
}

