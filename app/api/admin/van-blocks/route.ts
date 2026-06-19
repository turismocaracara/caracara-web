import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTeamMember, hasPermission } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const member = await getCurrentTeamMember();
  if (!hasPermission(member, 'manage_vans')) {
    return NextResponse.json({ error: 'No tienes permiso para gestionar vans' }, { status: 403 });
  }

  const body = await req.json() as { van_id: string; date: string; reason?: string };
  if (!body.van_id || !body.date) {
    return NextResponse.json({ error: 'van_id y date son requeridos' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('van_blocks')
    .insert({ van_id: body.van_id, date: body.date, reason: body.reason ?? null })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}

export async function DELETE(req: NextRequest) {
  const member = await getCurrentTeamMember();
  if (!hasPermission(member, 'manage_vans')) {
    return NextResponse.json({ error: 'No tienes permiso para gestionar vans' }, { status: 403 });
  }

  const { id } = await req.json() as { id: string };
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  const { error } = await supabase.from('van_blocks').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
