import { ApiErrorResponse } from '@meditory/shared';

const CORS_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'http://localhost:3000',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

export interface ApiResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export function successResponse(
  body: unknown,
  statusCode: number = 200,
  extraHeaders: Record<string, string> = {}
): ApiResponse {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, ...extraHeaders },
    body: JSON.stringify(body),
  };
}

export function errorResponse(
  statusCode: number,
  error: string,
  message: string,
  extraHeaders: Record<string, string> = {}
): ApiResponse {
  const payload: ApiErrorResponse = {
    statusCode,
    error,
    message,
  };
  return {
    statusCode,
    headers: { ...CORS_HEADERS, ...extraHeaders },
    body: JSON.stringify(payload),
  };
}

export function badRequest(message: string): ApiResponse {
  return errorResponse(400, 'BAD_REQUEST', message);
}

export function unauthorized(message: string = 'Authentication required. Invalid or missing token.'): ApiResponse {
  return errorResponse(401, 'UNAUTHORIZED', message);
}

export function forbidden(message: string = 'Access denied. You can only manage inventory for your assigned clinic.'): ApiResponse {
  return errorResponse(403, 'FORBIDDEN', message);
}

export function notFound(message: string = 'Requested resource not found.'): ApiResponse {
  return errorResponse(404, 'NOT_FOUND', message);
}
