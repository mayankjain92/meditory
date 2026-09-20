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
  // Administrators have district-wide purview across all facilities
  if (session.role === 'admin') {
    return;
  }
  if (targetFacilityId && targetFacilityId !== session.facilityId) {
    const err = new Error(`Access forbidden. Your session is restricted to clinic ${session.facilityId}.`);
    (err as unknown as { statusCode: number }).statusCode = 403;
    throw err;
  }
}

/**
 * Validates that an incoming request has a valid JWT session with 'admin' role.
 * Returns the authenticated admin payload or failure status with explanatory message.
 */
export function requireAdminSession(event: {
  headers?: Record<string, string | undefined>;
  cookies?: string[];
}): { session: JWTPayload | null; error?: string; statusCode?: number } {
  const session = getAuthenticatedSession(event);
  if (!session) {
    return {
      session: null,
      error: 'Authentication token is required.',
      statusCode: 401,
    };
  }
  if (session.role !== 'admin') {
    return {
      session: null,
      error: 'Access forbidden. District Health Authority administrator privileges required.',
      statusCode: 403,
    };
  }
  return { session };
}

