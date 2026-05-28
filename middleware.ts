import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';

const handleI18n = createMiddleware({
  locales: ['es', 'en', 'pt'],
  defaultLocale: 'es',
  localePrefix: 'always',
});

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  const { pathname } = request.nextUrl;

  // En el dominio de producción (no localhost ni vercel.app) → mostrar coming-soon
  const isProductionDomain =
    !host.includes('localhost') &&
    !host.includes('.vercel.app') &&
    !host.includes('.vercel.dev');

  if (isProductionDomain && pathname !== '/coming-soon') {
    const url = request.nextUrl.clone();
    url.pathname = '/coming-soon';
    return NextResponse.redirect(url, 302);
  }

  // Resto del tráfico: routing i18n normal
  return handleI18n(request);
}

export const config = {
  matcher: ['/((?!_next|_vercel|api|.*\\..*).*)'],
};
