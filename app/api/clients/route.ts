import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const withinLimit = await checkRateLimit(`clients:${ip}`, 20, 600);
  if (!withinLimit) {
    return NextResponse.json({}, { status: 429 });
  }

  const email = req.nextUrl.searchParams.get('email');
  if (!email) return NextResponse.json({}, { status: 400 });

  // No incluir id_type/id_number: este endpoint es público (autocompletado del
  // formulario) y no debe exponer documentos de identidad por solo conocer un email.
  const { data } = await supabase
    .from('clients')
    .select('name, phone, country')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (!data) return NextResponse.json({}, { status: 404 });

  return NextResponse.json(data);
}
