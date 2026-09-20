import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_PREFIXES = ['/rapid-desk', '/locator', '/audit', '/admin'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const sessionCookie = request.cookies.get('meditory_session')?.value;
  const isAuthenticated =
    Boolean(sessionCookie) &&
    sessionCookie?.trim() !== '' &&
    sessionCookie !== 'emergency_override_token';

  const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  // 1. Block unauthenticated access to protected routes
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    const response = NextResponse.redirect(loginUrl);
    // Ensure any stale or invalid emergency override cookie is purged
    response.cookies.delete('meditory_session');
    return response;
  }

  // 2. Redirect authenticated users away from /login or / to the workstation
  if (isAuthenticated && (pathname === '/login' || pathname === '/')) {
    const rapidDeskUrl = new URL('/rapid-desk', request.url);
    return NextResponse.redirect(rapidDeskUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (svg, png, jpg, etc.)
     * - api routes (/api/*)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
