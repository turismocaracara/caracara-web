import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

// Endpoint público: devuelve datos de un pasajero por documento o email.
// Diseñado para auto-fill del formulario de reserva web (sólo el titular).
// No devuelve historial de reservas ni datos sensibles adicionales.

function normalizeIdNumber(id_type: string, id_number: string): string {
  if (id_type === 'rut') return id_number.replace(/\./g, '').toUpperCase();
  return id_number.toUpperCase().trim();
}

function validateRut(rut: string): boolean {
  const clean   = rut.replace(/[.\s]/g, '').toUpperCase();
  const dashIdx = clean.lastIndexOf('-');
  if (dashIdx < 1) return false;
  const body = clean.slice(0, dashIdx);
  const dv   = clean.slice(dashIdx + 1);
  if (!/^\d+$/.test(body) || body.length < 6) return false;
  let sum = 0, mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const rem      = sum % 11;
  const expected = rem === 1 ? 'K' : rem === 0 ? '0' : String(11 - rem);
  return dv === expected;
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const ok = await checkRateLimit(`passenger-lookup:${ip}`, 15, 600);
  if (!ok) return NextResponse.json({}, { status: 429 });

  const params   = req.nextUrl.searchParams;
  const id_type  = params.get('id_type')?.trim()  ?? '';
  const id_number = params.get('id_number')?.trim() ?? '';
  const email    = params.get('email')?.trim()     ?? '';

  // ── Búsqueda por documento ───────────────────────────────────────────────
  if (id_type && id_number) {
    if (id_type !== 'rut' && id_type !== 'passport') {
      return NextResponse.json({}, { status: 400 });
    }
    // Para RUT, validar dígito verificador antes de consultar
    if (id_type === 'rut' && !validateRut(id_number)) {
      return NextResponse.json({}, { status: 404 });
    }
    const normalized = normalizeIdNumber(id_type, id_number);

    // Buscar en clients primero (datos más completos), luego en passengers
    const [{ data: clientRow }, { data: passengerRows }] = await Promise.all([
      supabase
        .from('clients')
        .select('name, email, phone, country, birth_date')
        .eq('id_type', id_type)
        .ilike('id_number', normalized.replace(/-/, '%'))   // tolera formato con/sin puntos
        .maybeSingle(),
      supabase
        .from('passengers')
        .select('name, email, phone, country, birth_date')
        .eq('id_type', id_type)
        .ilike('id_number', normalized.replace(/-/, '%'))
        .order('created_at', { ascending: false })
        .limit(1),
    ]);

    const hit = clientRow ?? passengerRows?.[0] ?? null;
    if (!hit || !hit.name) return NextResponse.json({}, { status: 404 });

    return NextResponse.json({
      name:       hit.name,
      email:      hit.email      ?? null,
      phone:      hit.phone      ?? null,
      country:    hit.country    ?? null,
      birth_date: hit.birth_date ?? null,
    });
  }

  // ── Búsqueda por email ───────────────────────────────────────────────────
  if (email && email.includes('@')) {
    const [{ data: clientRow }, { data: passengerRows }] = await Promise.all([
      supabase
        .from('clients')
        .select('name, phone, country, birth_date, id_type, id_number')
        .eq('email', email.toLowerCase())
        .maybeSingle(),
      supabase
        .from('passengers')
        .select('name, phone, country, birth_date, id_type, id_number')
        .eq('email', email.toLowerCase())
        .order('created_at', { ascending: false })
        .limit(1),
    ]);

    const hit = clientRow ?? passengerRows?.[0] ?? null;
    if (!hit || !hit.name) return NextResponse.json({}, { status: 404 });

    return NextResponse.json({
      name:       hit.name,
      phone:      hit.phone      ?? null,
      country:    hit.country    ?? null,
      birth_date: hit.birth_date ?? null,
      // No devolvemos id_number en búsqueda por email (no confirmado como propio)
    });
  }

  return NextResponse.json({}, { status: 400 });
}
