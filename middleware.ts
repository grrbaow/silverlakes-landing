import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.SESSION_SECRET!);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Admin routes
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const adminCookie = req.cookies.get('sl_admin')?.value;
    if (adminCookie !== process.env.ADMIN_PASSWORD) {
      return NextResponse.redirect(new URL('/admin/login', req.url));
    }
    return NextResponse.next();
  }

  // Protected investor routes
  if (pathname.startsWith('/data-room') || pathname.startsWith('/sign-nda')) {
    const token = req.cookies.get('sl_session')?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/access', req.url));
    }
    try {
      const { payload } = await jwtVerify(token, secret);

      // /sign-nda: if already signed, skip straight to data room
      if (pathname.startsWith('/sign-nda')) {
        if ((payload as { signed?: boolean }).signed) {
          return NextResponse.redirect(new URL('/data-room', req.url));
        }
        return NextResponse.next();
      }

      // /data-room requires signed NDA or allowlist (checked server-side in page)
      return NextResponse.next();
    } catch {
      return NextResponse.redirect(new URL('/access', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/data-room/:path*', '/sign-nda', '/admin/:path*'],
};
