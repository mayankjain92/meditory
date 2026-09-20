/**
 * Universal Authenticated API Client for Meditory Web
 * Ensures HttpOnly cookies (credentials: 'include') and Bearer header fallback are always sent.
 * Supports cross-storage fallback (sessionStorage + localStorage) and auto-recovery.
 */

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const sToken = sessionStorage.getItem('meditory_token');
    if (sToken && sToken.trim()) return sToken.trim();
    const lToken = localStorage.getItem('meditory_token');
    if (lToken && lToken.trim()) {
      // Re-hydrate sessionStorage for consistency
      sessionStorage.setItem('meditory_token', lToken.trim());
      return lToken.trim();
    }
  } catch {
    // Storage access restricted in some iframes/modes
  }
  return null;
}

export function setStoredSession(token: string, user?: any, facility?: any) {
  if (typeof window === 'undefined') return;
  try {
    if (token) {
      sessionStorage.setItem('meditory_token', token);
      localStorage.setItem('meditory_token', token);
    }
    if (user) {
      const uStr = JSON.stringify(user);
      sessionStorage.setItem('meditory_user', uStr);
      localStorage.setItem('meditory_user', uStr);
    }
    if (facility) {
      const fStr = JSON.stringify(facility);
      sessionStorage.setItem('meditory_facility', fStr);
      localStorage.setItem('meditory_facility', fStr);
    }
  } catch (e) {
    console.warn('[ApiClient] Failed to persist session to browser storage:', e);
  }
}

export function clearStoredSession() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem('meditory_token');
    sessionStorage.removeItem('meditory_user');
    sessionStorage.removeItem('meditory_facility');
    localStorage.removeItem('meditory_token');
    localStorage.removeItem('meditory_user');
    localStorage.removeItem('meditory_facility');
  } catch {
    // ignore
  }
}

let sessionRestorationPromise: Promise<string | null> | null = null;

/**
 * Automatically establishes or refreshes an authenticated session for the terminal.
 * Fallback to default pre-seeded clinic terminal (Alibag PHC) if no stored session is available.
 */
export async function ensureTerminalSession(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  const existing = getStoredToken();
  if (existing && existing !== 'emergency_override_token') {
    return existing;
  }

  // Prevent multiple concurrent login requests
  if (sessionRestorationPromise) {
    return sessionRestorationPromise;
  }

  sessionRestorationPromise = (async () => {
    try {
      // Try restoring from /api/auth/me using HttpOnly session cookie
      const meRes = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
      });
      if (meRes.ok) {
        const data = await meRes.json().catch(() => ({}));
        if (data.session && data.session.userId) {
          // Cookie is valid
          return getStoredToken() || 'cookie_session_active';
        }
      }
    } catch (e) {
      console.warn('[ApiClient] Session check failed:', e);
    } finally {
      sessionRestorationPromise = null;
    }
    return getStoredToken();
  })();

  return sessionRestorationPromise;
}

export async function apiRequest<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  let token = getStoredToken();

  // If token is missing and request is to an authenticated endpoint, try auto-restoring
  const isAuthRoute =
    path.startsWith('/api/auth/') ||
    path.startsWith('/api/facilities/register') ||
    path.startsWith('/api/admin/');

  if (!token && !isAuthRoute) {
    token = await ensureTerminalSession();
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    ...options,
    credentials: 'include',
    headers,
  });

  // Handle 401 Unauthorized by attempting a one-time session recovery
  if (res.status === 401 && !isAuthRoute) {
    const refreshedToken = await ensureTerminalSession();
    if (refreshedToken && refreshedToken !== token) {
      headers['Authorization'] = `Bearer ${refreshedToken}`;
      const retryRes = await fetch(path, {
        ...options,
        credentials: 'include',
        headers,
      });
      const retryData = await retryRes.json().catch(() => ({}));
      if (retryRes.ok) {
        return retryData as T;
      }
    }
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMsg = data.message || data.error || `HTTP error ${res.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

export const api = {
  get: <T = any>(path: string) => apiRequest<T>(path, { method: 'GET' }),
  post: <T = any>(path: string, body?: any) =>
    apiRequest<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
};
