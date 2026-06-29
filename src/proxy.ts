import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function proxy(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET!,
  });

  const isLoggedIn = !!token;
  const pathname = req.nextUrl.pathname;

  if (
    (pathname.startsWith('/docs') || pathname.startsWith('/dashboard')) &&
    !isLoggedIn
  ) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (pathname === '/login' && isLoggedIn) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};