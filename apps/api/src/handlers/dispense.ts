import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import {
  TABLE_NAMES,
  STOCK_STATUS,
  AUDIT_ACTION,
  DispenseRequest,
  DispenseResponse,
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
 * POST /clinic/dispense
 * Atomically dispenses a medicine from the clinic shelf.
 * Supports custom quantity input (default = 1 for emergency injectables, custom for oral meds).
 */
export async function dispenseHandler(event: APIGatewayProxyEventV2) {
  const session = getAuthenticatedSession(event);
  if (!session) {
    return unauthorized();
  }

  if (!event.body) {
    return badRequest('Request body is required.');
  }

  let body: DispenseRequest & { facilityId?: string; quantity?: number };
  try {
    body = JSON.parse(event.body);
  } catch {
    return badRequest('Invalid JSON payload.');
  }

  const { drugId } = body;
  // Custom quantity input: accepts positive quantity or negative delta (defaults to 1)
  const rawQty =
    typeof body.quantity === 'number' && body.quantity > 0
      ? body.quantity
      : typeof (body as { delta?: number }).delta === 'number' && (body as { delta?: number }).delta !== 0
      ? Math.abs((body as { delta?: number }).delta!)
      : 1;
  const dispenseQty = Math.floor(rawQty);

  if (!drugId) {
    return badRequest('drugId is required.');
  }

  // Clinic-to-Clinic boundary enforcement
  if (body.facilityId) {
    try {
      enforceClinicScope(session, body.facilityId);
    } catch {
      return forbidden(`Access denied. You cannot dispense medicines for clinic ${body.facilityId}.`);
    }
  }

  const facilityId = session.facilityId;

  // 1. Fetch current shelf item
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
  if (previousQuantity < dispenseQty) {
    return badRequest(
      `Insufficient stock. Requested: ${dispenseQty} ${currentItem.unit}, Available: ${previousQuantity} ${currentItem.unit}.`
    );
  }

  const newQuantity = previousQuantity - dispenseQty;
  const newStatus = computeStockStatus(newQuantity, currentItem.threshold);
  const now = new Date().toISOString();

  const rawDispensedTo = body.dispensedTo?.trim() || body.patientName?.trim();
  if (
    rawDispensedTo &&
    (rawDispensedTo.toLowerCase() === 'walk-in' ||
      rawDispensedTo.toLowerCase() === 'anyone' ||
      rawDispensedTo.toLowerCase() === 'unverified')
  ) {
    return badRequest(
      'Restricted Policy: Meditory is a Clinic-to-Clinic network. Medicines can only be dispensed for internal in-clinic patient treatment or upon an authorized request from a clinic (not to unverified walk-ins).'
    );
  }

  const dispensedTo =
    rawDispensedTo ||
    (body.notes?.trim() ? `In-Clinic Use (${body.notes.trim()})` : 'Internal Clinic Patient Care & Administration');
  const patientName = body.patientName?.trim() || undefined;
  const notes = body.notes?.trim() || undefined;

  // 2. Prepare immutable audit log record
  const auditEntry = {
    facilityId,
    timestamp: now,
    action: AUDIT_ACTION.DISPENSE,
    delta: -dispenseQty,
    previousQuantity,
    newQuantity,
    drugId,
    drugName: currentItem.drugName,
    workerId: session.userId,
    workerName: session.name,
    dispensedTo,
    patientName,
    notes,
    batchNumber: currentItem.batchNumber || undefined,
  };

  // 3. Atomic DynamoDB Transaction (Inventory Conditional Decrement + Audit Log Insertion)
  try {
    await docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: TABLE_NAMES.INVENTORY,
              Key: { facilityId, drugId },
              UpdateExpression:
                'SET quantity = quantity - :qty, updatedAt = :now, lastDispensedAt = :now, #st = :status',
              ConditionExpression: 'quantity >= :qty',
              ExpressionAttributeNames: {
                '#st': 'status',
              },
              ExpressionAttributeValues: {
                ':qty': dispenseQty,
                ':now': now,
                ':status': newStatus,
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
  } catch (err: unknown) {
    const errName = (err as { name?: string }).name;
    if (errName === 'TransactionCanceledException' || errName === 'ConditionalCheckFailedException') {
      return badRequest(
        `Atomic transaction failed: Another worker dispensed this medicine concurrently or stock fell below ${dispenseQty}.`
      );
    }
    throw err;
  }

  // 4. Observability: Emit CloudWatch Embedded Metric Format (EMF) log
  const isAlarmTriggered = currentItem.isCritical && newQuantity < currentItem.threshold;
  console.log(
    JSON.stringify({
      _aws: {
        Timestamp: Date.now(),
        CloudWatchMetrics: [
          {
            Namespace: 'Meditory/Clinics',
            Dimensions: [['FacilityId', 'DrugId']],
            Metrics: [
              { Name: 'StockLevel', Unit: 'Count' },
              { Name: 'DispenseQuantity', Unit: 'Count' },
            ],
          },
        ],
      },
      FacilityId: facilityId,
      DrugId: drugId,
      StockLevel: newQuantity,
      DispenseQuantity: dispenseQty,
      IsAlarmTriggered: isAlarmTriggered,
      Staff: session.name,
    })
  );

  const responsePayload: DispenseResponse = {
    success: true,
    drugId,
    drugName: currentItem.drugName,
    previousQuantity,
    newQuantity,
    status: newStatus,
    auditEntry,
    alarmTriggered: isAlarmTriggered,
  };

  return successResponse(responsePayload);
}
