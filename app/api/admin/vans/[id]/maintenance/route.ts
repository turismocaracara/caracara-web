import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentTeamMember, hasPermission } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';

const MaintSchema = z.object({
  date:        z.string(),
  type:        z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  cost:        z.number().int().min(0).optional(),
  workshop:    z.string().max(200).optional(),
  km_at:       z.number().int().min(0).optional(),
  next_km:     z.number().int().min(0).optional(),
  file_url:    z.string().nullable().optional(),
});

const DeleteSchema = z.object({ id: z.string().uuid() });

export async function POST(
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

  const parsed = MaintSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 422 });
  }

  const { data, error } = await supabase
    .from('van_maintenance')
    .insert({ van_id: params.id, ...parsed.data })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
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

  const parsed = DeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 422 });
  }

  const { error } = await supabase
    .from('van_maintenance')
    .delete()
    .eq('id', parsed.data.id)
    .eq('van_id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
