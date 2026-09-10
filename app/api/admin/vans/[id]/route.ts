import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentTeamMember, hasPermission } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';

const VanPatchSchema = z.object({
  name:     z.string().min(1).max(100).optional(),
  brand:    z.string().max(80).nullable().optional(),
  model:    z.string().max(80).nullable().optional(),
  year:     z.number().int().min(1990).max(2100).nullable().optional(),
  capacity: z.number().int().min(1).max(80).optional(),
  plate:    z.string().max(20).nullable().optional(),
  color:    z.string().max(60).nullable().optional(),
  notes:    z.string().max(1000).nullable().optional(),
  active:   z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const member = await getCurrentTeamMember();
  if (!hasPermission(member, 'manage_vans')) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = VanPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 422 });
  }

  const { data, error } = await supabase
    .from('vans')
    .update(parsed.data)
    .eq('id', params.id)
    .select('id, name, brand, model, year, capacity, plate, color, notes, active')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const member = await getCurrentTeamMember();
  if (!hasPermission(member, 'manage_vans')) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  const { error } = await supabase
    .from('vans')
    .delete()
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
