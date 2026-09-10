import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTeamMember, hasPermission } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';

async function requireFinancials() {
  const member = await getCurrentTeamMember();
  const ok = member?.role === 'admin' || hasPermission(member, 'view_financials');
  return { member, ok };
}

// ─── GET — tours asignados + ítems manuales ───────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { ok } = await requireFinancials();
  if (!ok) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  // 1. Asignaciones de este miembro
  const { data: assignments } = await supabase
    .from('tour_assignments')
    .select('tour_instance_id, role_in_tour')
    .eq('team_member_id', params.id);

  const instanceIds = (assignments ?? []).map(a => a.tour_instance_id);

  // 2. Instancias de tour asignadas (no canceladas)
  const { data: instances } = instanceIds.length > 0
    ? await supabase
        .from('tour_instances')
        .select('id, date, status, tour_slug, tours(name_es)')
        .in('id', instanceIds)
        .neq('status', 'cancelled')
        .order('date', { ascending: false, nullsFirst: false })
    : { data: [] };

  // 3. Ítems de pago vinculados a esas instancias
  const { data: tourPayments } = instanceIds.length > 0
    ? await supabase
        .from('member_payment_items')
        .select('*')
        .eq('member_id', params.id)
        .in('tour_instance_id', instanceIds)
    : { data: [] };

  // 4. Ítems manuales (sin tour vinculado)
  const { data: manualItems, error: itemsErr } = await supabase
    .from('member_payment_items')
    .select('*')
    .eq('member_id', params.id)
    .is('tour_instance_id', null)
    .order('item_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 });

  // Merge instancias con sus pagos
  const tours = (instances ?? []).map(inst => {
    const asgn    = (assignments ?? []).find(a => a.tour_instance_id === inst.id);
    const payment = (tourPayments ?? []).find(p => p.tour_instance_id === inst.id) ?? null;
    const tourObj = Array.isArray(inst.tours) ? inst.tours[0] : inst.tours;
    return {
      instance_id: inst.id,
      date:        inst.date,
      tour_name:   (tourObj as { name_es: string } | null)?.name_es ?? inst.tour_slug,
      role:        asgn?.role_in_tour ?? 'guide',
      tour_status: inst.status,
      payment,
    };
  });

  return NextResponse.json({ tours, items: manualItems ?? [] });
}

// ─── POST — crear ítem (manual o de tour) ────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { ok } = await requireFinancials();
  if (!ok) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  const body = await req.json() as {
    type:              string;
    description:       string;
    amount:            number;
    item_date?:        string | null;
    notes?:            string | null;
    tour_instance_id?: string | null;
  };

  if (!body.description?.trim() || !body.amount || !body.type) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 422 });
  }

  const { data, error } = await supabase
    .from('member_payment_items')
    .insert({
      member_id:        params.id,
      type:             body.type,
      description:      body.description.trim(),
      amount:           body.amount,
      item_date:        body.item_date        ?? null,
      notes:            body.notes            ?? null,
      tour_instance_id: body.tour_instance_id ?? null,
      status:           'pendiente',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// ─── PUT — marcar todos los pendientes como pagados ──────────────────────────

export async function PUT(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { ok } = await requireFinancials();
  if (!ok) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  const { error } = await supabase
    .from('member_payment_items')
    .update({ status: 'pagado', paid_at: new Date().toISOString() })
    .eq('member_id', params.id)
    .eq('status', 'pendiente');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// ─── PATCH — actualizar ítem ──────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { ok } = await requireFinancials();
  if (!ok) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  const body = await req.json() as {
    id:           string;
    status?:      string;
    paid_at?:     string | null;
    amount?:      number;
    description?: string;
    notes?:       string | null;
  };

  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 422 });

  const { error } = await supabase
    .from('member_payment_items')
    .update(updates)
    .eq('id', id)
    .eq('member_id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// ─── DELETE — eliminar ítem ───────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { ok } = await requireFinancials();
  if (!ok) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  const { id } = await req.json() as { id: string };
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 422 });

  const { error } = await supabase
    .from('member_payment_items')
    .delete()
    .eq('id', id)
    .eq('member_id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
