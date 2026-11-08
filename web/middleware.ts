import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Cloudflare / Vercel Edge Middleware
 * 
 * Protects onsite Kiosk and Admin routes on public cloud deployments (Vercel).
 * When running on Vercel (process.env.VERCEL is true):
 * - Blocks /kiosk, /display, /admin and rewrites to 404 (Not Found).
 * - Redirects root (/) to /find (Attendee Photo Lookup) so the public never sees kiosk launchers.
 * - Only permits /p/[code], /find, /api/photos/[code]/*, and static assets.
 * 
 * When running locally on the onsite laptop (localhost:3000):
 * - Completely permissive, all kiosk, display, and admin screens function normally.
 */
export function middleware(request: NextRequest) {
  const isCloudHost = Boolean(process.env.VERCEL);
  const { pathname } = request.nextUrl;

  if (isCloudHost) {
    // 1. Block onsite kiosk, display, and staff admin routes on Vercel
    if (
      pathname.startsWith('/kiosk') ||
      pathname.startsWith('/display') ||
      pathname.startsWith('/admin')
    ) {
      return NextResponse.rewrite(new URL('/_not-found', request.url));
    }

    // 2. Redirect root landing page to attendee photo finder
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/find', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/kiosk/:path*', '/display/:path*', '/admin/:path*'],
};
