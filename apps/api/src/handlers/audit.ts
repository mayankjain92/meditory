import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { TABLE_NAMES, AuditLogEntry, GetAuditLogsResponse } from '@meditory/shared';
import { docClient } from '../shared/ddb.js';
import { getAuthenticatedSession, enforceClinicScope } from '../authorizer/index.js';
import { successResponse, unauthorized, forbidden } from '../shared/response.js';

/**
 * GET /clinic/audit
 * Returns the immutable audit trail of dispensing and restocking events for the caller's clinic
 */
export async function auditHandler(event: APIGatewayProxyEventV2) {
  const session = getAuthenticatedSession(event);
  if (!session) {
    return unauthorized();
  }

  const queryFacilityId = event.queryStringParameters?.facilityId;
  if (queryFacilityId) {
    try {
      enforceClinicScope(session, queryFacilityId);
    } catch {
      return forbidden(`Access denied. You cannot view the audit log of clinic ${queryFacilityId}.`);
    }
  }

  const facilityId = session.facilityId;

  // Query audit logs for this facility, ordered descending (newest first)
  const auditRes = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAMES.AUDIT_LOGS,
      KeyConditionExpression: 'facilityId = :fId',
      ExpressionAttributeValues: {
        ':fId': facilityId,
      },
      ScanIndexForward: false, // Newest first
      Limit: 50,
    })
  );

  const logs = (auditRes.Items || []) as AuditLogEntry[];

  const responsePayload: GetAuditLogsResponse = {
    facilityId,
    logs,
  };

  return successResponse(responsePayload);
}
