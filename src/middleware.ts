import { NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';

const intlMiddleware = createMiddleware({
  locales: ['ja', 'en'],
  defaultLocale: 'ja'
});

export default function middleware(request: NextRequest) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (
    pathname === '/' ||
    pathname.startsWith('/splash') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api/gallery/review')
  ) {
    return NextResponse.next();
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
