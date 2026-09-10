import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTeamMember, hasPermission } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';

async function requireFinancials() {
  const member = await getCurrentTeamMember();
  const ok = member?.role === 'admin' || hasPermission(member, 'view_financials');
  return { member, ok };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { ok } = await requireFinancials();
  if (!ok) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  const { data, error } = await supabase
    .from('member_payment_items')
    .select('*')
    .eq('member_id', params.id)
    .order('item_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { ok } = await requireFinancials();
  if (!ok) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  const body = await req.json() as {
    type:        string;
    description: string;
    amount:      number;
    item_date?:  string | null;
    notes?:      string | null;
  };

  if (!body.description?.trim() || !body.amount || !body.type) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 422 });
  }

  const { data, error } = await supabase
    .from('member_payment_items')
    .insert({
      member_id:   params.id,
      type:        body.type,
      description: body.description.trim(),
      amount:      body.amount,
      item_date:   body.item_date ?? null,
      notes:       body.notes ?? null,
      status:      'pendiente',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// Marcar todos los pendientes como pagados
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

// Actualizar un ítem (cambiar estado, corregir monto, etc.)
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
