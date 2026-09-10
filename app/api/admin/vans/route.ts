import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentTeamMember, hasPermission } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';

const VanSchema = z.object({
  name:     z.string().min(1).max(100),
  brand:    z.string().max(80).optional().nullable(),
  model:    z.string().max(80).optional().nullable(),
  year:     z.number().int().min(1990).max(2100).optional().nullable(),
  capacity: z.number().int().min(1).max(80).default(9),
  plate:    z.string().max(20).optional().nullable(),
  color:    z.string().max(60).optional().nullable(),
  notes:    z.string().max(1000).optional().nullable(),
  active:   z.boolean().default(true),
});

export async function GET() {
  const member = await getCurrentTeamMember();
  if (!hasPermission(member, 'manage_vans')) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('vans')
    .select('id, name, brand, model, year, capacity, plate, color, notes, active')
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const member = await getCurrentTeamMember();
  if (!hasPermission(member, 'manage_vans')) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = VanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 422 });
  }

  const { data, error } = await supabase
    .from('vans')
    .insert(parsed.data)
    .select('id, name, brand, model, year, capacity, plate, color, notes, active')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
