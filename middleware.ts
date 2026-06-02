import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';

const handleI18n = createMiddleware({
  locales: ['es', 'en', 'pt'],
  defaultLocale: 'es',
  localePrefix: 'always',
});

const PREVIEW_COOKIE = 'cc_preview';

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  const { pathname } = request.nextUrl;

  const isProductionDomain =
    !host.includes('localhost') &&
    !host.includes('.vercel.app') &&
    !host.includes('.vercel.dev');

  if (isProductionDomain) {
    // /preview → activa acceso completo (cookie 30 días) y redirige al sitio
    if (pathname === '/preview') {
      const url = request.nextUrl.clone();
      url.pathname = '/es';
      const res = NextResponse.redirect(url, 302);
      res.cookies.set(PREVIEW_COOKIE, '1', {
        httpOnly: false,
        maxAge: 60 * 60 * 24 * 30, // 30 días
        path: '/',
        sameSite: 'lax',
      });
      return res;
    }

    // Si tiene la cookie → acceso completo al sitio
    if (request.cookies.get(PREVIEW_COOKIE)?.value === '1') {
      return handleI18n(request);
    }

    // Sin cookie → página "en creación"
    // ─── LANZAMIENTO: eliminar las 3 líneas de abajo ───
    if (pathname !== '/coming-soon') {
      const url = request.nextUrl.clone();
      url.pathname = '/coming-soon';
      return NextResponse.redirect(url, 302);
    }
    // ───────────────────────────────────────────────────
  }

  return handleI18n(request);
}

export const config = {
  matcher: ['/((?!_next|_vercel|api|.*\\..*).*)'],
};
