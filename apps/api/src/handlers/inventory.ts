import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { TABLE_NAMES, DRUG_TIER, STOCK_STATUS, InventoryItem, Facility, GetInventoryResponse } from '@meditory/shared';
import { docClient } from '../shared/ddb.js';
import { getAuthenticatedSession, enforceClinicScope } from '../authorizer/index.js';
import { successResponse, unauthorized, forbidden, notFound } from '../shared/response.js';

/**
 * GET /clinic/inventory
 * Returns the current clinic's inventory prioritized by emergency tier
 */
export async function inventoryHandler(event: APIGatewayProxyEventV2) {
  const session = getAuthenticatedSession(event);
  if (!session) {
    return unauthorized();
  }

  // Clinic-to-Clinic boundary check:
  // If request specifies a facilityId query param, it MUST match the worker's assigned facilityId
  const queryFacilityId = event.queryStringParameters?.facilityId;
  if (queryFacilityId) {
    try {
      enforceClinicScope(session, queryFacilityId);
    } catch {
      return forbidden(`Access denied. You cannot view the inventory of ${queryFacilityId}.`);
    }
  }

  const facilityId = session.facilityId;

  // 1. Fetch Facility Metadata
  const facilityRes = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAMES.FACILITIES,
      Key: { id: facilityId },
    })
  );

  const facility = facilityRes.Item as Facility | undefined;
  if (!facility) {
    return notFound(`Clinic facility '${facilityId}' not found.`);
  }

  // 2. Query Clinic Inventory Shelf Items
  const invRes = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAMES.INVENTORY,
      KeyConditionExpression: 'facilityId = :fId',
      ExpressionAttributeValues: {
        ':fId': facilityId,
      },
    })
  );

  const items = (invRes.Items || []) as InventoryItem[];

  // 3. Sort by priority tier: EMERGENCY first, then ESSENTIAL, then ROUTINE
  const tierWeight = {
    [DRUG_TIER.EMERGENCY]: 1,
    [DRUG_TIER.ESSENTIAL]: 2,
    [DRUG_TIER.ROUTINE]: 3,
  };

  items.sort((a, b) => {
    const weightDiff = (tierWeight[a.tier] || 99) - (tierWeight[b.tier] || 99);
    if (weightDiff !== 0) return weightDiff;
    return a.drugName.localeCompare(b.drugName);
  });

  // 4. Compute dashboard counts
  const lowStockCount = items.filter((i) => i.status === STOCK_STATUS.LOW_STOCK).length;
  const criticalStockoutCount = items.filter(
    (i) => i.status === STOCK_STATUS.OUT_OF_STOCK && i.isCritical
  ).length;

  const responsePayload: GetInventoryResponse = {
    facility,
    items,
    totalDrugs: items.length,
    lowStockCount,
    criticalStockoutCount,
  };

  return successResponse(responsePayload);
}
