import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { supabase as adminSupabase } from '@/lib/supabase';

const MAX_ATTEMPTS    = 5;
const LOCKOUT_MINUTES = 15;

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 });
  }

  const normalizedEmail = String(email).toLowerCase();

  const { data: attemptRow } = await adminSupabase
    .from('login_attempts')
    .select('attempts, locked_until')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (attemptRow?.locked_until && new Date(attemptRow.locked_until) > new Date()) {
    const minutesLeft = Math.ceil((new Date(attemptRow.locked_until).getTime() - Date.now()) / 60_000);
    return NextResponse.json(
      { error: `Demasiados intentos fallidos. Intenta nuevamente en ${minutesLeft} minuto(s).` },
      { status: 429 }
    );
  }

  // Respuesta inicial — las cookies se setean sobre ella
  const response = NextResponse.json({ ok: true });

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, { ...options, httpOnly: true, sameSite: 'lax' });
          });
        },
      },
    }
  );

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    const attempts    = (attemptRow?.attempts ?? 0) + 1;
    const lockedUntil = attempts >= MAX_ATTEMPTS
      ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString()
      : null;

    await adminSupabase
      .from('login_attempts')
      .upsert({ email: normalizedEmail, attempts, locked_until: lockedUntil, updated_at: new Date().toISOString() });

    return NextResponse.json(
      { error: 'Credenciales incorrectas' },
      { status: 401 }
    );
  }

  // Login exitoso: limpiar contador de intentos fallidos
  await adminSupabase.from('login_attempts').delete().eq('email', normalizedEmail);

  return response;
}
