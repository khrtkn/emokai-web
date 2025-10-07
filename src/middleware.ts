import { NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';

const intlMiddleware = createMiddleware({
  locales: ['ja', 'en'],
  defaultLocale: 'ja'
});

export default function middleware(request: Request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (pathname === '/' || pathname.startsWith('/splash')) {
    return NextResponse.next();
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
