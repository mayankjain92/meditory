import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
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

  let body: RestockRequest & {
    facilityId?: string;
    drugName?: string;
    genericName?: string;
    category?: string;
    form?: string;
    unit?: string;
    threshold?: number;
    tier?: 'EMERGENCY' | 'ESSENTIAL' | 'ROUTINE';
    batchNumber?: string;
    expiryDate?: string;
    storageLocation?: string;
    challanNumber?: string;
  };
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
  let previousQuantity = 0;
  let newQuantity = restockQty;
  let drugName = body.drugName || drugId;
  let newStatus: StockStatus;
  const now = new Date().toISOString();

  if (!currentItem) {
    if (!body.drugName) {
      return notFound(`Medicine '${drugId}' not found on shelf for clinic '${facilityId}'.`);
    }

    const threshold = typeof body.threshold === 'number' ? body.threshold : 20;
    newStatus = computeStockStatus(newQuantity, threshold);
    const category = body.category || 'Essential Formulary';
    const form = body.form || 'Unit';
    const unit = body.unit || (form.split(' ')[1] || 'units');
    const tier = body.tier || 'ESSENTIAL';
    const isCritical = tier === 'EMERGENCY';

    const newItem = {
      facilityId,
      drugId,
      drugName,
      genericName: body.genericName || drugName,
      category,
      form,
      quantity: newQuantity,
      unit,
      threshold,
      tier,
      isCritical,
      status: newStatus,
      batchNumber: body.batchNumber,
      expiryDate: body.expiryDate,
      storageLocation: body.storageLocation,
      updatedAt: now,
      lastRestockedAt: now,
    };

    const auditEntry = {
      facilityId,
      timestamp: now,
      action: AUDIT_ACTION.RESTOCK,
      delta: restockQty,
      previousQuantity: 0,
      newQuantity,
      drugId,
      drugName,
      workerId: session.userId,
      workerName: session.name,
      dispensedTo: body.challanNumber
        ? `District Medical Depot (${body.challanNumber})`
        : 'District Medical Depot Intake',
      batchNumber: body.batchNumber || undefined,
    };

    // 2. Atomic DynamoDB Transaction for New Item + Audit Log
    await docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: TABLE_NAMES.INVENTORY,
              Item: newItem,
            },
          },
          {
            Put: {
              TableName: TABLE_NAMES.AUDIT_LOGS,
              Item: auditEntry,
            },
          },
        ],
      })
    );

    const responsePayload: RestockResponse = {
      success: true,
      drugId,
      drugName,
      previousQuantity: 0,
      newQuantity,
      status: newStatus,
      auditEntry,
    };

    return successResponse(responsePayload);
  } else {
    previousQuantity = currentItem.quantity;
    newQuantity = previousQuantity + restockQty;
    drugName = currentItem.drugName;
    newStatus = computeStockStatus(newQuantity, currentItem.threshold);

    const auditEntry = {
      facilityId,
      timestamp: now,
      action: AUDIT_ACTION.RESTOCK,
      delta: restockQty,
      previousQuantity,
      newQuantity,
      drugId,
      drugName,
      workerId: session.userId,
      workerName: session.name,
      dispensedTo: body.challanNumber
        ? `District Medical Depot (${body.challanNumber})`
        : 'District Medical Depot Intake',
      batchNumber: body.batchNumber || undefined,
    };

    // 2. Atomic DynamoDB Transaction for Stock Increment + Audit Log
    await docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: TABLE_NAMES.INVENTORY,
              Key: { facilityId, drugId },
              UpdateExpression:
                'SET quantity = quantity + :qty, updatedAt = :now, lastRestockedAt = :now, #st = :status' +
                (body.batchNumber ? ', batchNumber = :batch' : '') +
                (body.expiryDate ? ', expiryDate = :expiry' : '') +
                (body.storageLocation ? ', storageLocation = :storage' : ''),
              ExpressionAttributeNames: {
                '#st': 'status',
              },
              ExpressionAttributeValues: {
                ':qty': restockQty,
                ':now': now,
                ':status': newStatus,
                ...(body.batchNumber ? { ':batch': body.batchNumber } : {}),
                ...(body.expiryDate ? { ':expiry': body.expiryDate } : {}),
                ...(body.storageLocation ? { ':storage': body.storageLocation } : {}),
              },
            },
          },
          {
            Put: {
              TableName: TABLE_NAMES.AUDIT_LOGS,
              Item: auditEntry,
            },
          },
        ],
      })
    );

    const responsePayload: RestockResponse = {
      success: true,
      drugId,
      drugName,
      previousQuantity,
      newQuantity,
      status: newStatus,
      auditEntry,
    };

    return successResponse(responsePayload);
  }
}


