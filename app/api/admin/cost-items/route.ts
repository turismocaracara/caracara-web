import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTeamMember, hasPermission } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const member = await getCurrentTeamMember();
  if (!hasPermission(member, 'view_financials')) {
    return NextResponse.json({ error: 'No tienes permiso para gestionar costos' }, { status: 403 });
  }

  const body = await req.json() as {
    tour_slug: string; concept: string; amount_clp: number; unit: 'per_person' | 'per_van' | 'fixed';
  };
  if (!body.tour_slug || !body.concept || !body.amount_clp || !body.unit) {
    return NextResponse.json({ error: 'Todos los campos son requeridos' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('tour_cost_items')
    .insert({
      tour_slug:  body.tour_slug,
      concept:    body.concept,
      amount_clp: body.amount_clp,
      unit:       body.unit,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}

export async function DELETE(req: NextRequest) {
  const member = await getCurrentTeamMember();
  if (!hasPermission(member, 'view_financials')) {
    return NextResponse.json({ error: 'No tienes permiso para gestionar costos' }, { status: 403 });
  }

  const { id } = await req.json() as { id: string };
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  const { error } = await supabase.from('tour_cost_items').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
