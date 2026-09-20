import { APIGatewayProxyEventV2 } from 'aws-lambda';
import bcrypt from 'bcryptjs';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { TABLE_NAMES, LoginRequest, LoginResponse, Facility, FacilityWorker } from '@meditory/shared';
import { docClient } from '../shared/ddb.js';
import { signToken, buildCookieHeader, buildClearCookieHeader } from '../shared/auth-utils.js';
import { getAuthenticatedSession } from '../authorizer/index.js';
import { successResponse, badRequest, unauthorized, notFound } from '../shared/response.js';

/**
 * POST /auth/login
 * Authenticates clinic worker and sets httpOnly session cookie
 */
export async function loginHandler(event: APIGatewayProxyEventV2) {
  if (!event.body) {
    return badRequest('Request body is required.');
  }

  let body: LoginRequest;
  try {
    body = JSON.parse(event.body);
  } catch {
    return badRequest('Invalid JSON payload.');
  }

  const { email, password } = body;
  if (!email || !password) {
    return badRequest('Email and password are required.');
  }

  // 1. Fetch worker record by email
  const workerRes = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAMES.WORKERS,
      Key: { email: email.toLowerCase().trim() },
    })
  );

  const worker = workerRes.Item;
  if (!worker) {
    return unauthorized('Invalid email or password.');
  }

  // 2. Verify password with bcrypt
  const isMatch = bcrypt.compareSync(password, worker.passwordHash);
  if (!isMatch) {
    return unauthorized('Invalid email or password.');
  }

  if (worker.status !== 'ACTIVE') {
    return unauthorized('Clinic worker account is inactive or pending district authority approval.');
  }

  // 3. Fetch clinic metadata
  const facilityRes = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAMES.FACILITIES,
      Key: { id: worker.facilityId },
    })
  );

  const facility = facilityRes.Item as
    | (Facility & { isApproved?: boolean; approvalStatus?: string })
    | undefined;
  if (!facility) {
    return notFound('Assigned clinic facility not found in registry.');
  }

  if (facility.isApproved === false || facility.approvalStatus === 'PENDING') {
    return unauthorized(
      'Clinic registration is pending District Health Authority approval. Please contact state administration.'
    );
  }
  if (facility.approvalStatus === 'REJECTED') {
    return unauthorized('Clinic registration was rejected by District Health Authority.');
  }

  // 4. Generate signed JWT
  const token = signToken({
    userId: worker.id,
    facilityId: worker.facilityId,
    facilityName: facility.name,
    name: worker.name,
    email: worker.email,
    role: worker.role,
  });

  const safeWorker: FacilityWorker = {
    id: worker.id,
    facilityId: worker.facilityId,
    name: worker.name,
    email: worker.email,
    role: worker.role,
    status: worker.status,
    createdAt: worker.createdAt,
    lastLoginAt: new Date().toISOString(),
  };

  const responseBody: LoginResponse = {
    token,
    user: safeWorker,
    facility,
  };

  const cookieHeader = buildCookieHeader(token);

  return successResponse(responseBody, 200, {
    'Set-Cookie': cookieHeader,
  });
}

/**
 * GET /auth/me
 * Retrieves current active session profile and clinic
 */
export async function meHandler(event: APIGatewayProxyEventV2) {
  const session = getAuthenticatedSession(event);
  if (!session) {
    return unauthorized();
  }

  const facilityRes = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAMES.FACILITIES,
      Key: { id: session.facilityId },
    })
  );

  return successResponse({
    user: {
      id: session.userId,
      facilityId: session.facilityId,
      name: session.name,
      email: session.email,
      role: session.role,
    },
    facility: facilityRes.Item,
  });
}

/**
 * POST /auth/logout
 * Clears the session cookie
 */
export async function logoutHandler() {
  const clearCookie = buildClearCookieHeader();
  return successResponse(
    { message: 'Logged out successfully.' },
    200,
    { 'Set-Cookie': clearCookie }
  );
}
