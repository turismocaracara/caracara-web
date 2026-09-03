import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { getCurrentTeamMember, isOpsViewer, hasPermission } from '@/lib/admin-auth';

const AgencySchema = z.object({
  fantasy_name:  z.string().min(2).max(120),
  rut:           z.string().min(8).max(12),
  razon_social:  z.string().min(3).max(200),
  giro:          z.string().min(3).max(200),
  address:       z.string().min(3).max(200),
  comuna:        z.string().min(2).max(100),
  city:          z.string().min(2).max(100),
  billing_email: z.string().email().optional(),
  phone:         z.string().min(6).max(25).optional(),
  contact_name:  z.string().min(2).max(120).optional(),
});

export async function GET() {
  const member = await getCurrentTeamMember();
  if (!isOpsViewer(member)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('agencies')
    .select('id, fantasy_name, rut, razon_social, giro, address, comuna, city, billing_email, phone, contact_name, created_at')
    .order('fantasy_name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const member = await getCurrentTeamMember();
  if (!hasPermission(member, 'manual_booking')) {
    return NextResponse.json({ error: 'No tienes permiso para registrar agencias' }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = AgencySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 });
  }

  const { data, error } = await supabase
    .from('agencies')
    .insert(parsed.data)
    .select('id, fantasy_name')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Ya existe una agencia con ese RUT' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
