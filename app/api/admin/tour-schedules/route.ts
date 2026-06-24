import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTeamMember } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const member = await getCurrentTeamMember();
  if (member?.role !== 'admin') {
    return NextResponse.json({ error: 'Solo un admin puede editar horarios de pickup' }, { status: 403 });
  }

  const body = await req.json() as { tour_slug?: string; season?: string; pickup_time?: string };
  if (!body.tour_slug || !body.season || !body.pickup_time) {
    return NextResponse.json({ error: 'tour_slug, season y pickup_time son requeridos' }, { status: 400 });
  }
  if (!['summer', 'winter'].includes(body.season)) {
    return NextResponse.json({ error: 'season debe ser summer o winter' }, { status: 400 });
  }
  if (!/^\d{2}:\d{2}$/.test(body.pickup_time)) {
    return NextResponse.json({ error: 'pickup_time debe tener formato HH:MM' }, { status: 400 });
  }

  // Upsert manual por tour_slug+season — la tabla no tiene un constraint único
  // sobre ese par, así que no se puede usar onConflict.
  const { data: existing } = await supabase
    .from('tour_schedules')
    .select('id')
    .eq('tour_slug', body.tour_slug)
    .eq('season', body.season)
    .maybeSingle();

  const { data, error } = existing
    ? await supabase.from('tour_schedules').update({ pickup_time: body.pickup_time }).eq('id', existing.id).select('id').single()
    : await supabase.from('tour_schedules').insert({ tour_slug: body.tour_slug, season: body.season, pickup_time: body.pickup_time }).select('id').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}

export async function DELETE(req: NextRequest) {
  const member = await getCurrentTeamMember();
  if (member?.role !== 'admin') {
    return NextResponse.json({ error: 'Solo un admin puede editar horarios de pickup' }, { status: 403 });
  }

  const { id } = await req.json() as { id?: string };
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  const { error } = await supabase.from('tour_schedules').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
