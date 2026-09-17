import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { GetCommand, UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import {
  TABLE_NAMES,
  STOCK_STATUS,
  AUDIT_ACTION,
  RestockRequest,
  RestockResponse,
  StockStatus,
} from '@meditory/shared';
import { docClient } from '../shared/ddb.js';
import { getAuthenticatedSession, enforceClinicScope } from '../authorizer/index.js';
import { successResponse, badRequest, unauthorized, forbidden, notFound } from '../shared/response.js';

function computeStockStatus(quantity: number, threshold: number): StockStatus {
  if (quantity <= 0) return STOCK_STATUS.OUT_OF_STOCK;
  if (quantity < threshold) return STOCK_STATUS.LOW_STOCK;
  return STOCK_STATUS.IN_STOCK;
}

/**
 * POST /clinic/restock
 * Atomically increments medicine inventory count (stepped or custom batch) and logs to audit trail.
 */
export async function restockHandler(event: APIGatewayProxyEventV2) {
  const session = getAuthenticatedSession(event);
  if (!session) {
    return unauthorized();
  }

  if (!event.body) {
    return badRequest('Request body is required.');
  }

  let body: RestockRequest & { facilityId?: string };
  try {
    body = JSON.parse(event.body);
  } catch {
    return badRequest('Invalid JSON payload.');
  }

  const { drugId, quantity } = body;
  if (!drugId || typeof quantity !== 'number' || quantity <= 0) {
    return badRequest('Valid drugId and positive restock quantity are required.');
  }

  const restockQty = Math.floor(quantity);

  // Clinic-to-Clinic boundary enforcement
  if (body.facilityId) {
    try {
      enforceClinicScope(session, body.facilityId);
    } catch {
      return forbidden(`Access denied. You cannot restock medicines for clinic ${body.facilityId}.`);
    }
  }

  const facilityId = session.facilityId;

  // 1. Fetch current item
  const currentItemRes = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAMES.INVENTORY,
      Key: { facilityId, drugId },
    })
  );

  const currentItem = currentItemRes.Item;
  if (!currentItem) {
    return notFound(`Medicine '${drugId}' not found on shelf for clinic '${facilityId}'.`);
  }

  const previousQuantity: number = currentItem.quantity;
  const newQuantity = previousQuantity + restockQty;
  const newStatus = computeStockStatus(newQuantity, currentItem.threshold);
  const now = new Date().toISOString();

  // 2. Atomic DynamoDB Update
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAMES.INVENTORY,
      Key: { facilityId, drugId },
      UpdateExpression:
        'SET quantity = quantity + :qty, updatedAt = :now, lastRestockedAt = :now, #st = :status',
      ExpressionAttributeNames: {
        '#st': 'status',
      },
      ExpressionAttributeValues: {
        ':qty': restockQty,
        ':now': now,
        ':status': newStatus,
      },
    })
  );

  // 3. Write immutable audit log record
  const auditEntry = {
    facilityId,
    timestamp: now,
    action: AUDIT_ACTION.RESTOCK,
    delta: restockQty,
    previousQuantity,
    newQuantity,
    drugId,
    drugName: currentItem.drugName,
    workerId: session.userId,
    workerName: session.name,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAMES.AUDIT_LOGS,
      Item: auditEntry,
    })
  );

  const responsePayload: RestockResponse = {
    success: true,
    drugId,
    drugName: currentItem.drugName,
    previousQuantity,
    newQuantity,
    status: newStatus,
    auditEntry,
  };

  return successResponse(responsePayload);
}
