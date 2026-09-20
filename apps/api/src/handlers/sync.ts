import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { GetCommand, UpdateCommand, PutCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import {
  TABLE_NAMES,
  STOCK_STATUS,
  AUDIT_ACTION,
  SyncBatchRequest,
  SyncBatchResponse,
  SyncActionResult,
  StockStatus,
  InventoryItem,
  AuditLogEntry,
} from '@meditory/shared';
import { docClient } from '../shared/ddb.js';
import { getAuthenticatedSession } from '../authorizer/index.js';
import { successResponse, badRequest, unauthorized } from '../shared/response.js';

function computeStockStatus(quantity: number, threshold: number): StockStatus {
  if (quantity <= 0) return STOCK_STATUS.OUT_OF_STOCK;
  if (quantity < threshold) return STOCK_STATUS.LOW_STOCK;
  return STOCK_STATUS.IN_STOCK;
}

/**
 * POST /clinic/sync-batch
 * Synchronizes a batch of offline-queued dispense and restock actions idempotently.
 */
export async function syncBatchHandler(event: APIGatewayProxyEventV2) {
  const session = getAuthenticatedSession(event);
  if (!session) {
    return unauthorized();
  }

  if (!event.body) {
    return badRequest('Request body is required.');
  }

  let body: SyncBatchRequest;
  try {
    body = JSON.parse(event.body);
  } catch {
    return badRequest('Invalid JSON payload.');
  }

  const { actions } = body;
  if (!Array.isArray(actions)) {
    return badRequest('Actions must be an array of queued operations.');
  }

  const facilityId = session.facilityId;
  const results: SyncActionResult[] = [];
  let syncedCount = 0;

  // 1. Fetch recent audit logs for idempotency check
  const recentLogsRes = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAMES.AUDIT_LOGS,
      KeyConditionExpression: 'facilityId = :fId',
      ExpressionAttributeValues: { ':fId': facilityId },
      ScanIndexForward: false,
      Limit: 100,
    })
  );
  const recentLogs = (recentLogsRes.Items || []) as (AuditLogEntry & { clientActionId?: string })[];
  const processedActionIds = new Set<string>();
  for (const log of recentLogs) {
    if (log.clientActionId) {
      processedActionIds.add(log.clientActionId);
    }
  }

  // 2. Process each queued offline action sequentially
  for (const item of actions) {
    const { clientActionId, action, drugId, quantity } = item;

    if (!clientActionId || !action || !drugId || typeof quantity !== 'number' || quantity <= 0) {
      results.push({
        clientActionId: clientActionId || `invalid-${Math.random()}`,
        success: false,
        drugId: drugId || 'UNKNOWN',
        action: action || 'DISPENSE',
        error: 'Missing required action parameters or non-positive quantity.',
      });
      continue;
    }

    // Idempotency: Skip already-processed actions to prevent double-dispensing
    if (processedActionIds.has(clientActionId)) {
      results.push({
        clientActionId,
        success: true,
        drugId,
        action,
        error: 'Action was already synchronized (idempotent replay skipped).',
      });
      syncedCount++;
      continue;
    }

    const now = new Date().toISOString();
    const qty = Math.floor(quantity);

    // Fetch current shelf record
    const invRes = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAMES.INVENTORY,
        Key: { facilityId, drugId },
      })
    );
    const shelfItem = invRes.Item as InventoryItem | undefined;

    if (!shelfItem) {
      if (action === 'RESTOCK') {
        const threshold = 50;
        const newQuantity = qty;
        const newStatus = computeStockStatus(newQuantity, threshold);
        const rawItem = item as any;
        const newItem: any = {
          facilityId,
          drugId,
          drugName: rawItem.drugName || drugId,
          genericName: rawItem.drugName || drugId,
          category: 'General Medicines',
          form: 'Unit',
          quantity: newQuantity,
          unit: 'Units',
          threshold,
          tier: 'ESSENTIAL',
          isCritical: false,
          status: newStatus,
          batchNumber: rawItem.batchNumber,
          updatedAt: now,
          lastRestockedAt: now,
        };

        const auditEntry = {
          facilityId,
          timestamp: now,
          action: AUDIT_ACTION.RESTOCK,
          delta: qty,
          previousQuantity: 0,
          newQuantity,
          drugId,
          drugName: rawItem.drugName || drugId,
          workerId: session.userId,
          workerName: session.name,
          dispensedTo: item.dispensedTo || 'Offline Queue Restock Intake',
          notes: item.notes ? `${item.notes} [Synced from Offline Queue]` : '[Synced from Offline Queue]',
          batchNumber: item.batchNumber || undefined,
          clientActionId,
          clientTimestamp: item.timestamp,
        };

        try {
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
        } catch (err: unknown) {
          results.push({
            clientActionId,
            success: false,
            drugId,
            action,
            error: (err as Error).message || 'Failed to initialize medicine from restock queue.',
          });
          continue;
        }

        processedActionIds.add(clientActionId);
        syncedCount++;
        results.push({
          clientActionId,
          success: true,
          drugId,
          action,
          newQuantity,
        });
        continue;
      }

      results.push({
        clientActionId,
        success: false,
        drugId,
        action,
        error: `Medicine '${drugId}' does not exist on clinic shelf.`,
      });
      continue;
    }

    if (action === 'DISPENSE') {
      const rawDispensedTo = (item.dispensedTo || item.patientName || '').trim();
      if (
        rawDispensedTo &&
        (rawDispensedTo.toLowerCase().includes('walk-in') ||
          rawDispensedTo.toLowerCase().includes('anyone') ||
          rawDispensedTo.toLowerCase().includes('unverified'))
      ) {
        results.push({
          clientActionId,
          success: false,
          drugId,
          action,
          error:
            'Restricted Policy: Meditory is a Clinic-to-Clinic network. Medicines can only be dispensed when there is an authorized request from a clinic (not to individual walk-ins).',
        });
        continue;
      }

      const previousQuantity = shelfItem.quantity;
      if (previousQuantity < qty) {
        results.push({
          clientActionId,
          success: false,
          drugId,
          action,
          error: `Insufficient stock for offline dispense. Available: ${previousQuantity}, Queued: ${qty}.`,
        });
        continue;
      }

      const newQuantity = previousQuantity - qty;
      const newStatus = computeStockStatus(newQuantity, shelfItem.threshold);

      const auditEntry = {
        facilityId,
        timestamp: now,
        action: AUDIT_ACTION.DISPENSE,
        delta: -qty,
        previousQuantity,
        newQuantity,
        drugId,
        drugName: shelfItem.drugName,
        workerId: session.userId,
        workerName: session.name,
        dispensedTo: rawDispensedTo || 'Authorized Clinic Network Requisition',
        patientName: item.patientName,
        notes: item.notes ? `${item.notes} [Synced from Offline Queue]` : '[Synced from Offline Queue]',
        batchNumber: (shelfItem as unknown as { batchNumber?: string }).batchNumber || item.batchNumber || undefined,
        clientActionId,
        clientTimestamp: item.timestamp,
      };

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
                  ExpressionAttributeNames: { '#st': 'status' },
                  ExpressionAttributeValues: {
                    ':qty': qty,
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
        results.push({
          clientActionId,
          success: false,
          drugId,
          action,
          error: (err as Error).message || 'Atomic deduction failed.',
        });
        continue;
      }

      processedActionIds.add(clientActionId);
      syncedCount++;
      results.push({
        clientActionId,
        success: true,
        drugId,
        action,
        newQuantity,
      });
    } else if (action === 'RESTOCK') {
      const previousQuantity = shelfItem.quantity;
      const newQuantity = previousQuantity + qty;
      const newStatus = computeStockStatus(newQuantity, shelfItem.threshold);

      const auditEntry = {
        facilityId,
        timestamp: now,
        action: AUDIT_ACTION.RESTOCK,
        delta: qty,
        previousQuantity,
        newQuantity,
        drugId,
        drugName: shelfItem.drugName,
        workerId: session.userId,
        workerName: session.name,
        dispensedTo: item.dispensedTo || 'Offline Queue Restock',
        notes: item.notes ? `${item.notes} [Synced from Offline Queue]` : '[Synced from Offline Queue]',
        batchNumber: (shelfItem as unknown as { batchNumber?: string }).batchNumber || item.batchNumber || undefined,
        clientActionId,
        clientTimestamp: item.timestamp,
      };

      try {
        await docClient.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Update: {
                  TableName: TABLE_NAMES.INVENTORY,
                  Key: { facilityId, drugId },
                  UpdateExpression:
                    'SET quantity = quantity + :qty, updatedAt = :now, lastRestockedAt = :now, #st = :status',
                  ExpressionAttributeNames: { '#st': 'status' },
                  ExpressionAttributeValues: {
                    ':qty': qty,
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
        results.push({
          clientActionId,
          success: false,
          drugId,
          action,
          error: (err as Error).message || 'Atomic increment failed.',
        });
        continue;
      }

      processedActionIds.add(clientActionId);
      syncedCount++;
      results.push({
        clientActionId,
        success: true,
        drugId,
        action,
        newQuantity,
      });
    }
  }

  // 3. Fetch latest full inventory for the clinic to return to client
  const updatedInvRes = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAMES.INVENTORY,
      KeyConditionExpression: 'facilityId = :fId',
      ExpressionAttributeValues: { ':fId': facilityId },
    })
  );
  const updatedInventory = (updatedInvRes.Items || []) as InventoryItem[];

  const responsePayload: SyncBatchResponse = {
    success: true,
    syncedCount,
    results,
    updatedInventory,
  };

  return successResponse(responsePayload);
}
