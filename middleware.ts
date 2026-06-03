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
    // /preview → activa cookie 30 días y redirige al sitio completo
    if (pathname === '/preview') {
      const res = NextResponse.redirect(new URL('/es', request.url));
      res.cookies.set(PREVIEW_COOKIE, '1', {
        httpOnly: false,
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
        sameSite: 'lax',
      });
      return res;
    }

    // /salir-preview → limpia la cookie y vuelve a "en creación"
    if (pathname === '/salir-preview') {
      const res = NextResponse.redirect(new URL('/coming-soon', request.url));
      res.cookies.delete(PREVIEW_COOKIE);
      return res;
    }

    // Si tiene cookie de preview → acceso completo (pasa a i18n normal)
    if (request.cookies.get(PREVIEW_COOKIE)?.value === '1') {
      return handleI18n(request);
    }

    // Sin cookie en /coming-soon → servir la página directamente, sin pasar por i18n
    if (pathname === '/coming-soon') {
      return NextResponse.next();
    }

    // Panel admin → siempre accesible (la propia ruta maneja la autenticación)
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      return NextResponse.next();
    }

    // Todo lo demás → redirigir a "en creación"
    // ─── LANZAMIENTO: eliminar estas 3 líneas ───
    return NextResponse.redirect(new URL('/coming-soon', request.url));
    // ────────────────────────────────────────────
  }

  // Panel admin → excluir del i18n en todos los entornos
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return NextResponse.next();
  }

  // Localhost / vercel.app → routing i18n normal
  return handleI18n(request);
}

export const config = {
  matcher: ['/((?!_next|_vercel|api|.*\\..*).*)'],
};
