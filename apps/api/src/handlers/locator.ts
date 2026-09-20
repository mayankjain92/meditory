import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { QueryCommand, ScanCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import {
  TABLE_NAMES,
  INDEX_NAMES,
  STOCK_STATUS,
  Facility,
  InventoryItem,
  StockLocatorResponse,
  StockLocatorFacilityResult,
} from '@meditory/shared';
import { docClient } from '../shared/ddb.js';
import { getAuthenticatedSession } from '../authorizer/index.js';
import { successResponse, badRequest, unauthorized, notFound } from '../shared/response.js';

/**
 * Calculates straight-line distance (km) using Haversine formula
 */
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10; // Round to 1 decimal place
}

/**
 * GET /network/stock-locator?drugId=...
 * Locates available stock of a specific medicine across neighboring clinics for emergency referral
 */
export async function locatorHandler(event: APIGatewayProxyEventV2) {
  const session = getAuthenticatedSession(event);
  if (!session) {
    return unauthorized();
  }

  const drugId = event.queryStringParameters?.drugId;
  if (!drugId) {
    return badRequest('drugId query parameter is required.');
  }

  const callerFacilityId = session.facilityId;

  // 1. Fetch caller clinic metadata for distance calculation
  const callerFacRes = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAMES.FACILITIES,
      Key: { id: callerFacilityId },
    })
  );
  const callerFacility = callerFacRes.Item as Facility | undefined;

  // 2. Query all clinic stock for this drug via GSI
  const drugStockRes = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAMES.INVENTORY,
      IndexName: INDEX_NAMES.INVENTORY_BY_DRUG,
      KeyConditionExpression: 'drugId = :dId',
      ExpressionAttributeValues: {
        ':dId': drugId,
      },
    })
  );

  // 3. Fetch all facilities metadata for coordinates and contact
  const allFacRes = await docClient.send(new ScanCommand({ TableName: TABLE_NAMES.FACILITIES }));
  const facilityMap = new Map<string, Facility>();
  (allFacRes.Items || []).forEach((f) => facilityMap.set(f.id, f as Facility));

  const inventoryEntries = (drugStockRes.Items || []) as InventoryItem[];
  if (inventoryEntries.length === 0) {
    // Graceful fallback: When no positive shelf stock is reported for this drug in the database,
    // return all neighboring approved network facilities (with 0 quantity) so clinicians can
    // still contact neighboring facilities and submit inter-clinic transfer requisitions.
    const emptyResults: StockLocatorFacilityResult[] = [];
    for (const fac of Array.from(facilityMap.values())) {
      if (fac.id === callerFacilityId || (fac as any).approvalStatus === 'REJECTED') continue;
      let distanceKm = 0;
      if (callerFacility?.latitude && callerFacility?.longitude && fac.latitude && fac.longitude) {
        distanceKm = calculateDistanceKm(
          callerFacility.latitude,
          callerFacility.longitude,
          fac.latitude,
          fac.longitude
        );
      }
      emptyResults.push({
        facilityId: fac.id,
        facilityName: fac.name,
        facilityType: fac.type,
        districtName: fac.districtName,
        phone: fac.phone,
        address: fac.address,
        distanceKm,
        quantity: 0,
        unit: 'units',
        status: STOCK_STATUS.OUT_OF_STOCK,
        lastVerifiedAt: new Date().toISOString(),
      });
    }
    emptyResults.sort((a, b) => a.distanceKm - b.distanceKm);

    const emptyResponse: StockLocatorResponse = {
      drugId,
      drugName: drugId,
      genericName: drugId,
      isCritical: false,
      localQuantity: 0,
      results: emptyResults,
    };
    return successResponse(emptyResponse);
  }

  const referenceItem = inventoryEntries[0];
  const localItem = inventoryEntries.find((i) => i.facilityId === callerFacilityId);
  const localQuantity = localItem ? localItem.quantity : 0;

  // 4. Build results for other clinics with stock
  const results: StockLocatorFacilityResult[] = [];

  for (const item of inventoryEntries) {
    // Exclude caller's own clinic from the referral list
    if (item.facilityId === callerFacilityId) continue;

    const fac = facilityMap.get(item.facilityId);
    if (!fac) continue;

    let distanceKm = 0;
    if (callerFacility?.latitude && callerFacility?.longitude && fac.latitude && fac.longitude) {
      distanceKm = calculateDistanceKm(
        callerFacility.latitude,
        callerFacility.longitude,
        fac.latitude,
        fac.longitude
      );
    }

    results.push({
      facilityId: fac.id,
      facilityName: fac.name,
      facilityType: fac.type,
      districtName: fac.districtName,
      phone: fac.phone,
      address: fac.address,
      distanceKm,
      quantity: item.quantity,
      unit: item.unit,
      status: item.status,
      lastVerifiedAt: item.updatedAt,
    });
  }

  // 5. Sort: IN_STOCK first, then by closest distance
  results.sort((a, b) => {
    if (a.status === STOCK_STATUS.IN_STOCK && b.status !== STOCK_STATUS.IN_STOCK) return -1;
    if (a.status !== STOCK_STATUS.IN_STOCK && b.status === STOCK_STATUS.IN_STOCK) return 1;
    return a.distanceKm - b.distanceKm;
  });

  const responsePayload: StockLocatorResponse = {
    drugId,
    drugName: referenceItem.drugName,
    genericName: referenceItem.genericName,
    isCritical: referenceItem.isCritical,
    localQuantity,
    results,
  };

  return successResponse(responsePayload);
}
