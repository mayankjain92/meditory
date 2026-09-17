import jwt from 'jsonwebtoken';
import { JWTPayload } from '@meditory/shared';

const JWT_SECRET = process.env.JWT_SECRET || 'meditory_development_secret_key_bharat_2026';
const TOKEN_EXPIRY = '24h';
export const AUTH_COOKIE_NAME = 'meditory_session';

/**
 * Signs a JWT payload for a clinic worker
 */
export function signToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

/**
 * Verifies a JWT token and returns the typed payload, or null if invalid/expired
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Creates an HttpOnly, SameSite=Lax Set-Cookie header string
 */
export function buildCookieHeader(token: string, maxAgeSeconds: number = 86400): string {
  const isSecure = process.env.NODE_ENV === 'production' ? 'Secure; ' : '';
  return `${AUTH_COOKIE_NAME}=${token}; Path=/; ${isSecure}HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

/**
 * Creates a clear-cookie header string to log out
 */
export function buildClearCookieHeader(): string {
  return `${AUTH_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

/**
 * Extracts the JWT token from incoming request headers or cookies
 * Prioritizes:
 * 1. Authorization: Bearer <token>
 * 2. Cookie header: meditory_session=<token>
 * 3. API Gateway v2 cookies array
 */
export function extractToken(
  headers: Record<string, string | undefined> = {},
  cookies?: string[]
): string | null {
  // 1. Check Authorization header
  const authHeader = headers['authorization'] || headers['Authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  // 2. Check cookies array (API Gateway v2 format)
  if (cookies && Array.isArray(cookies)) {
    for (const c of cookies) {
      const parts = c.split(';');
      for (const part of parts) {
        const [k, v] = part.trim().split('=');
        if (k === AUTH_COOKIE_NAME && v) {
          return decodeURIComponent(v);
        }
      }
    }
  }

  // 3. Check Cookie header string
  const rawCookie = headers['cookie'] || headers['Cookie'];
  if (rawCookie) {
    const parts = rawCookie.split(';');
    for (const part of parts) {
      const [k, v] = part.trim().split('=');
      if (k === AUTH_COOKIE_NAME && v) {
        return decodeURIComponent(v);
      }
    }
  }

  return null;
}
