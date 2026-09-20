import { NextRequest } from 'next/server';

export const BACKEND_URL = process.env.BACKEND_API_URL || 'http://localhost:3001';

/**
 * Extracts the session JWT token from incoming request headers or cookies.
 * Returns null if no valid token is present (zero-trust authentication).
 */
export async function getBackendToken(req?: NextRequest): Promise<string | null> {
  if (req) {
    // 1. Authorization header: Bearer <token>
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }

    // 2. Cookie: meditory_session=<token>
    const cookieHeader = req.headers.get('cookie');
    if (cookieHeader) {
      const match = cookieHeader.match(/meditory_session=([^;]+)/);
      if (match) {
        return decodeURIComponent(match[1]);
      }
    }
  }

  return null;
}

