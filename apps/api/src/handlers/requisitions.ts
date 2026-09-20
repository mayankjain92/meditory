import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { GetCommand, PutCommand, UpdateCommand, QueryCommand, ScanCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import {
  TABLE_NAMES,
  INDEX_NAMES,
  REQUISITION_STATUS,
  STOCK_STATUS,
  AUDIT_ACTION,
  Requisition,
  CreateRequisitionRequest,
  RespondRequisitionRequest,
  HandshakeDispenseRequest,
  ConfirmIntakeRequest,
  StockStatus,
  RequisitionStatus,
  Facility,
  InventoryItem,
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
 * POST /requisitions/request
 * Initiates an inter-clinic medicine requisition from a donor clinic.
 */
export async function createRequisitionHandler(event: APIGatewayProxyEventV2) {
  const session = getAuthenticatedSession(event);
  if (!session) {
    return unauthorized();
  }

  if (!event.body) {
    return badRequest('Request body is required.');
  }

  let body: CreateRequisitionRequest;
  try {
    body = JSON.parse(event.body);
  } catch {
    return badRequest('Invalid JSON payload.');
  }

  const { donorFacilityId, drugId, quantity, urgency = 'EMERGENCY', patientNotes } = body;

  if (!donorFacilityId || !drugId || typeof quantity !== 'number' || quantity <= 0) {
    return badRequest('donorFacilityId, drugId, and positive quantity are required.');
  }

  if (donorFacilityId === session.facilityId) {
    return badRequest('Cannot request medicines from your own clinic.');
  }

  const reqQty = Math.floor(quantity);

  // 1. Fetch donor facility details
  const donorFacRes = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAMES.FACILITIES,
      Key: { id: donorFacilityId },
    })
  );
  const donorFacility = donorFacRes.Item as Facility | undefined;
  if (!donorFacility) {
    return notFound(`Donor facility '${donorFacilityId}' not found.`);
  }

  // 2. Fetch drug metadata from donor shelf or catalog
  let drugName = drugId;
  let genericName: string | undefined;
  let unit = 'units';

  const donorInvRes = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAMES.INVENTORY,
      Key: { facilityId: donorFacilityId, drugId },
    })
  );
  const donorItem = donorInvRes.Item as InventoryItem | undefined;

  if (donorItem) {
    drugName = donorItem.drugName;
    genericName = donorItem.genericName;
    unit = donorItem.unit;
  } else {
    // Fallback: check requester's shelf
    const reqInvRes = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAMES.INVENTORY,
        Key: { facilityId: session.facilityId, drugId },
      })
    );
    const reqItem = reqInvRes.Item as InventoryItem | undefined;
    if (reqItem) {
      drugName = reqItem.drugName;
      genericName = reqItem.genericName;
      unit = reqItem.unit;
    }
  }

  const now = new Date().toISOString();
  const requisitionId = `REQ-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const requisition: Requisition = {
    id: requisitionId,
    requesterFacilityId: session.facilityId,
    requesterFacilityName: session.facilityName,
    donorFacilityId,
    donorFacilityName: donorFacility.name,
    drugId,
    drugName,
    genericName,
    quantity: reqQty,
    unit,
    urgency,
    status: REQUISITION_STATUS.PENDING,
    patientNotes: patientNotes?.trim() || undefined,
    requestedByWorkerId: session.userId,
    requestedByWorkerName: session.name,
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAMES.REQUISITIONS,
      Item: requisition,
    })
  );

  return successResponse({ success: true, requisition }, 201);
}

/**
 * GET /requisitions
 * Returns incoming (donor) and outgoing (requester) requisitions for the authenticated clinic.
 */
export async function getRequisitionsHandler(event: APIGatewayProxyEventV2) {
  const session = getAuthenticatedSession(event);
  if (!session) {
    return unauthorized();
  }

  const facilityId = session.facilityId;
  let incoming: Requisition[] = [];
  let outgoing: Requisition[] = [];

  try {
    // 1. Query incoming requests via GSI
    const inRes = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAMES.REQUISITIONS,
        IndexName: INDEX_NAMES.REQUISITIONS_BY_DONOR,
        KeyConditionExpression: 'donorFacilityId = :fId',
        ExpressionAttributeValues: { ':fId': facilityId },
        ScanIndexForward: false, // Newest first
      })
    );
    incoming = (inRes.Items || []) as Requisition[];
  } catch {
    // Fallback: Scan if GSI not yet active
    const scanRes = await docClient.send(new ScanCommand({ TableName: TABLE_NAMES.REQUISITIONS }));
    const all = (scanRes.Items || []) as Requisition[];
    incoming = all.filter((r) => r.donorFacilityId === facilityId);
    outgoing = all.filter((r) => r.requesterFacilityId === facilityId);
  }

  if (outgoing.length === 0) {
    try {
      // 2. Query outgoing requests via GSI
      const outRes = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAMES.REQUISITIONS,
          IndexName: INDEX_NAMES.REQUISITIONS_BY_REQUESTER,
          KeyConditionExpression: 'requesterFacilityId = :fId',
          ExpressionAttributeValues: { ':fId': facilityId },
          ScanIndexForward: false,
        })
      );
      outgoing = (outRes.Items || []) as Requisition[];
    } catch {
      // already caught in scan fallback above
    }
  }

  // Sort descending by createdAt
  incoming.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  outgoing.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const counts = {
    pendingIncoming: incoming.filter((r) => r.status === REQUISITION_STATUS.PENDING).length,
    activeOutgoing: outgoing.filter((r) =>
      ([REQUISITION_STATUS.PENDING, REQUISITION_STATUS.APPROVED, REQUISITION_STATUS.IN_TRANSIT] as RequisitionStatus[]).includes(r.status)
    ).length,
  };

  return successResponse({ incoming, outgoing, counts });
}

/**
 * POST /requisitions/respond
 * Donor clinic accepts (with Handshake PIN generation) or rejects the requisition.
 */
export async function respondRequisitionHandler(event: APIGatewayProxyEventV2) {
  const session = getAuthenticatedSession(event);
  if (!session) {
    return unauthorized();
  }

  if (!event.body) {
    return badRequest('Request body is required.');
  }

  let body: RespondRequisitionRequest;
  try {
    body = JSON.parse(event.body);
  } catch {
    return badRequest('Invalid JSON payload.');
  }

  const { requisitionId, action, reason } = body;
  if (!requisitionId || !action || !['APPROVE', 'REJECT'].includes(action)) {
    return badRequest('requisitionId and valid action (APPROVE or REJECT) are required.');
  }

  // 1. Fetch current requisition
  const reqRes = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAMES.REQUISITIONS,
      Key: { id: requisitionId },
    })
  );
  const requisition = reqRes.Item as Requisition | undefined;
  if (!requisition) {
    return notFound(`Requisition '${requisitionId}' not found.`);
  }

  // 2. Strict Clinic Authorization: caller MUST be donor facility
  if (requisition.donorFacilityId !== session.facilityId) {
    return forbidden('Access denied. Only the donor facility can approve or reject this requisition.');
  }

  if (requisition.status !== REQUISITION_STATUS.PENDING) {
    return badRequest(`Requisition is already ${requisition.status} and cannot be modified.`);
  }

  const now = new Date().toISOString();

  if (action === 'APPROVE') {
    // 3. Check donor's shelf inventory to verify stock is available
    const invRes = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAMES.INVENTORY,
        Key: { facilityId: session.facilityId, drugId: requisition.drugId },
      })
    );
    const donorStock = invRes.Item as InventoryItem | undefined;
    if (!donorStock || donorStock.quantity < requisition.quantity) {
      return badRequest(
        `Cannot accept: Insufficient stock. Available: ${donorStock?.quantity || 0} ${requisition.unit}, Requested: ${requisition.quantity} ${requisition.unit}.`
      );
    }

    // 4. Generate secure 6-digit Handshake PIN
    const handshakePin = Math.floor(100000 + Math.random() * 900000).toString();

    requisition.status = REQUISITION_STATUS.APPROVED;
    requisition.handshakePin = handshakePin;
    requisition.respondedByWorkerId = session.userId;
    requisition.respondedByWorkerName = session.name;
    requisition.updatedAt = now;

    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAMES.REQUISITIONS,
        Key: { id: requisitionId },
        UpdateExpression:
          'SET #st = :status, handshakePin = :pin, respondedByWorkerId = :wId, respondedByWorkerName = :wName, updatedAt = :now',
        ExpressionAttributeNames: { '#st': 'status' },
        ExpressionAttributeValues: {
          ':status': REQUISITION_STATUS.APPROVED,
          ':pin': handshakePin,
          ':wId': session.userId,
          ':wName': session.name,
          ':now': now,
        },
      })
    );
  } else {
    // REJECT
    requisition.status = REQUISITION_STATUS.REJECTED;
    requisition.rejectionReason = reason?.trim() || 'Declined by donor clinic (insufficient local reserves).';
    requisition.respondedByWorkerId = session.userId;
    requisition.respondedByWorkerName = session.name;
    requisition.updatedAt = now;

    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAMES.REQUISITIONS,
        Key: { id: requisitionId },
        UpdateExpression:
          'SET #st = :status, rejectionReason = :reason, respondedByWorkerId = :wId, respondedByWorkerName = :wName, updatedAt = :now',
        ExpressionAttributeNames: { '#st': 'status' },
        ExpressionAttributeValues: {
          ':status': REQUISITION_STATUS.REJECTED,
          ':reason': requisition.rejectionReason,
          ':wId': session.userId,
          ':wName': session.name,
          ':now': now,
        },
      })
    );
  }

  return successResponse({ success: true, requisition });
}

/**
 * POST /requisitions/handshake-dispense
 * Verifies the 6-digit Handshake PIN, dispenses stock from donor shelf, and sets status to IN_TRANSIT.
 */
export async function handshakeDispenseHandler(event: APIGatewayProxyEventV2) {
  const session = getAuthenticatedSession(event);
  if (!session) {
    return unauthorized();
  }

  if (!event.body) {
    return badRequest('Request body is required.');
  }

  let body: HandshakeDispenseRequest;
  try {
    body = JSON.parse(event.body);
  } catch {
    return badRequest('Invalid JSON payload.');
  }

  const { requisitionId, handshakePin } = body;
  if (!requisitionId || !handshakePin) {
    return badRequest('requisitionId and 6-digit handshakePin are required.');
  }

  // 1. Fetch requisition
  const reqRes = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAMES.REQUISITIONS,
      Key: { id: requisitionId },
    })
  );
  const requisition = reqRes.Item as Requisition | undefined;
  if (!requisition) {
    return notFound(`Requisition '${requisitionId}' not found.`);
  }

  // 2. Caller must be donor facility
  if (requisition.donorFacilityId !== session.facilityId) {
    return forbidden('Access denied. Only the donor facility can verify the handshake and dispense.');
  }

  if (requisition.status !== REQUISITION_STATUS.APPROVED) {
    return badRequest(`Requisition is in status '${requisition.status}'. Must be in 'APPROVED' status to dispense.`);
  }

  // 3. Verify Handshake PIN
  if (requisition.handshakePin !== handshakePin.trim()) {
    return badRequest('Invalid Handshake PIN. Please verify PIN with the transport staff / requester clinic.');
  }

  // 4. Fetch current donor stock
  const currentItemRes = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAMES.INVENTORY,
      Key: { facilityId: session.facilityId, drugId: requisition.drugId },
    })
  );
  const currentItem = currentItemRes.Item as InventoryItem | undefined;
  if (!currentItem || currentItem.quantity < requisition.quantity) {
    return badRequest(
      `Insufficient donor shelf stock. Available: ${currentItem?.quantity || 0}, Required: ${requisition.quantity}.`
    );
  }

  const previousQuantity = currentItem.quantity;
  const newDonorQuantity = previousQuantity - requisition.quantity;
  const newStatus = computeStockStatus(newDonorQuantity, currentItem.threshold);
  const now = new Date().toISOString();

  // 5. Prepare audit log entry and updated requisition object
  const auditEntry = {
    facilityId: session.facilityId,
    timestamp: now,
    action: AUDIT_ACTION.DISPENSE,
    delta: -requisition.quantity,
    previousQuantity,
    newQuantity: newDonorQuantity,
    drugId: requisition.drugId,
    drugName: requisition.drugName,
    workerId: session.userId,
    workerName: session.name,
    dispensedTo: `Inter-Clinic Transfer: Handshake verified to ${requisition.requesterFacilityName}`,
    notes: `Transfer Requisition ${requisition.id}. Transport Handshake PIN verified.`,
    batchNumber: (currentItem as unknown as { batchNumber?: string }).batchNumber || undefined,
  };

  requisition.status = REQUISITION_STATUS.IN_TRANSIT;
  requisition.dispensedAt = now;
  requisition.updatedAt = now;

  // 6. Atomic DynamoDB Transaction (Donor Shelf Deduction + Audit Log + Requisition Status IN_TRANSIT)
  try {
    await docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: TABLE_NAMES.INVENTORY,
              Key: { facilityId: session.facilityId, drugId: requisition.drugId },
              UpdateExpression:
                'SET quantity = quantity - :qty, updatedAt = :now, lastDispensedAt = :now, #st = :status',
              ConditionExpression: 'quantity >= :qty',
              ExpressionAttributeNames: { '#st': 'status' },
              ExpressionAttributeValues: {
                ':qty': requisition.quantity,
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
          {
            Update: {
              TableName: TABLE_NAMES.REQUISITIONS,
              Key: { id: requisitionId },
              UpdateExpression: 'SET #st = :status, dispensedAt = :now, updatedAt = :now',
              ConditionExpression: '#st = :approvedStatus',
              ExpressionAttributeNames: { '#st': 'status' },
              ExpressionAttributeValues: {
                ':status': REQUISITION_STATUS.IN_TRANSIT,
                ':approvedStatus': REQUISITION_STATUS.APPROVED,
                ':now': now,
              },
            },
          },
        ],
      })
    );
  } catch (err: unknown) {
    const errName = (err as { name?: string }).name;
    if (errName === 'TransactionCanceledException' || errName === 'ConditionalCheckFailedException') {
      return badRequest('Atomic transaction failed: Requisition status changed or stock was dispensed concurrently.');
    }
    throw err;
  }

  return successResponse({
    success: true,
    requisition,
    newDonorQuantity,
  });
}

/**
 * POST /requisitions/confirm-intake
 * Requester clinic confirms delivery, atomically credits medicine to shelf, and marks COMPLETED.
 */
export async function confirmIntakeHandler(event: APIGatewayProxyEventV2) {
  const session = getAuthenticatedSession(event);
  if (!session) {
    return unauthorized();
  }

  if (!event.body) {
    return badRequest('Request body is required.');
  }

  let body: ConfirmIntakeRequest;
  try {
    body = JSON.parse(event.body);
  } catch {
    return badRequest('Invalid JSON payload.');
  }

  const { requisitionId } = body;
  if (!requisitionId) {
    return badRequest('requisitionId is required.');
  }

  // 1. Fetch requisition
  const reqRes = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAMES.REQUISITIONS,
      Key: { id: requisitionId },
    })
  );
  const requisition = reqRes.Item as Requisition | undefined;
  if (!requisition) {
    return notFound(`Requisition '${requisitionId}' not found.`);
  }

  // 2. Caller must be requester facility
  if (requisition.requesterFacilityId !== session.facilityId) {
    return forbidden('Access denied. Only the requesting facility can confirm medicine intake.');
  }

  if (requisition.status !== REQUISITION_STATUS.IN_TRANSIT) {
    return badRequest(`Requisition is in status '${requisition.status}'. Must be 'IN_TRANSIT' to confirm intake.`);
  }

  const now = new Date().toISOString();

  // 3. Fetch current stock at requester shelf
  const currentItemRes = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAMES.INVENTORY,
      Key: { facilityId: session.facilityId, drugId: requisition.drugId },
    })
  );
  const currentItem = currentItemRes.Item as InventoryItem | undefined;

  let previousQuantity = 0;
  let newLocalQuantity = requisition.quantity;
  let newStatus: StockStatus;

  if (!currentItem) {
    newStatus = computeStockStatus(newLocalQuantity, 5);
  } else {
    previousQuantity = currentItem.quantity;
    newLocalQuantity = previousQuantity + requisition.quantity;
    newStatus = computeStockStatus(newLocalQuantity, currentItem.threshold);
  }

  // 4. Prepare audit log entry and updated requisition object
  const auditEntry = {
    facilityId: session.facilityId,
    timestamp: now,
    action: AUDIT_ACTION.RESTOCK,
    delta: requisition.quantity,
    previousQuantity,
    newQuantity: newLocalQuantity,
    drugId: requisition.drugId,
    drugName: requisition.drugName,
    workerId: session.userId,
    workerName: session.name,
    dispensedTo: `Inter-Clinic Intake Received from ${requisition.donorFacilityName}`,
    notes: `Transfer Requisition ${requisition.id} successfully received and verified on shelf.`,
  };

  requisition.status = REQUISITION_STATUS.COMPLETED;
  requisition.completedAt = now;
  requisition.updatedAt = now;

  // 5. Atomic DynamoDB Transaction (Shelf Intake + Audit Log + Requisition Status COMPLETED)
  const requisitionUpdateItem = {
    Update: {
      TableName: TABLE_NAMES.REQUISITIONS,
      Key: { id: requisitionId },
      UpdateExpression: 'SET #st = :status, completedAt = :now, updatedAt = :now',
      ConditionExpression: '#st = :inTransitStatus',
      ExpressionAttributeNames: { '#st': 'status' },
      ExpressionAttributeValues: {
        ':status': REQUISITION_STATUS.COMPLETED,
        ':inTransitStatus': REQUISITION_STATUS.IN_TRANSIT,
        ':now': now,
      },
    },
  };

  const auditLogPutItem = {
    Put: {
      TableName: TABLE_NAMES.AUDIT_LOGS,
      Item: auditEntry,
    },
  };

  try {
    if (!currentItem) {
      await docClient.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: TABLE_NAMES.INVENTORY,
                Item: {
                  facilityId: session.facilityId,
                  drugId: requisition.drugId,
                  drugName: requisition.drugName,
                  genericName: requisition.genericName || requisition.drugName,
                  category: 'Emergency Transfer Formulary',
                  form: 'Vial',
                  quantity: newLocalQuantity,
                  unit: requisition.unit,
                  threshold: 5,
                  tier: requisition.urgency,
                  isCritical: requisition.urgency === 'EMERGENCY',
                  status: newStatus,
                  updatedAt: now,
                  lastRestockedAt: now,
                },
              },
            },
            auditLogPutItem,
            requisitionUpdateItem,
          ],
        })
      );
    } else {
      await docClient.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: TABLE_NAMES.INVENTORY,
                Key: { facilityId: session.facilityId, drugId: requisition.drugId },
                UpdateExpression:
                  'SET quantity = quantity + :qty, updatedAt = :now, lastRestockedAt = :now, #st = :status',
                ExpressionAttributeNames: { '#st': 'status' },
                ExpressionAttributeValues: {
                  ':qty': requisition.quantity,
                  ':now': now,
                  ':status': newStatus,
                },
              },
            },
            auditLogPutItem,
            requisitionUpdateItem,
          ],
        })
      );
    }
  } catch (err: unknown) {
    const errName = (err as { name?: string }).name;
    if (errName === 'TransactionCanceledException' || errName === 'ConditionalCheckFailedException') {
      return badRequest('Atomic transaction failed: Requisition was already completed or updated concurrently.');
    }
    throw err;
  }

  return successResponse({
    success: true,
    requisition,
    newLocalQuantity,
  });
}
