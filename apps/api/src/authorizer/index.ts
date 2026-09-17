import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { extractToken, verifyToken } from '../shared/auth-utils.js';
import { JWTPayload } from '@meditory/shared';

export interface AuthorizerContext {
  userId: string;
  facilityId: string;
  facilityName: string;
  name: string;
  email: string;
  role: string;
}

/**
 * AWS API Gateway HTTP API v2 Lambda Authorizer
 * Returns simple isAuthorized boolean with attached context
 */
export async function handler(event: APIGatewayProxyEventV2) {
  const token = extractToken(event.headers, event.cookies);
  if (!token) {
    return { isAuthorized: false };
  }

  const payload = verifyToken(token);
  if (!payload) {
    return { isAuthorized: false };
  }

  return {
    isAuthorized: true,
    context: {
      userId: payload.userId,
      facilityId: payload.facilityId,
      facilityName: payload.facilityName,
      name: payload.name,
      email: payload.email,
      role: payload.role,
    },
  };
}

/**
 * Standalone authorization middleware for handlers and local dev server
 */
export function getAuthenticatedSession(event: {
  headers?: Record<string, string | undefined>;
  cookies?: string[];
}): JWTPayload | null {
  const token = extractToken(event.headers || {}, event.cookies);
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Enforces strict clinic-to-clinic isolation.
 * Throws an error with 403 status if targetFacilityId doesn't match session.facilityId.
 */
export function enforceClinicScope(session: JWTPayload, targetFacilityId?: string): void {
  if (targetFacilityId && targetFacilityId !== session.facilityId) {
    const err = new Error(`Access forbidden. Your session is restricted to clinic ${session.facilityId}.`);
    (err as unknown as { statusCode: number }).statusCode = 403;
    throw err;
  }
}
