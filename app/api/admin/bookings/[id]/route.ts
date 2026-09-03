import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTeamMember, isOpsViewer } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const member = await getCurrentTeamMember();
  if (!isOpsViewer(member)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id, booking_code, booking_type, pax, status,
      price_per_person, total_amount, credit_applied,
      amount_usd_approx, fx_rate_at_booking, display_currency,
      locale, tour_languages, source, agency_name, groups_count, internal_notes, mp_payment_id, created_at,
      reserved_until, entered_by,
      cancelled_at, cancellation_reason, cancellation_by,
      refund_amount, refund_status, refund_processed_at,
      tour_instances!tour_instance_id (
        id, date, current_pax, max_pax, outsourced, guide_notes,
        tours ( name_es, slug, duration_hours, has_picnic, category ),
        vans ( name, plate, capacity )
      ),
      clients ( name, email, phone, country ),
      passengers (
        id, name, id_type, id_number, email, phone, country, birth_date, is_lead,
        pickup_type, pickup_address, hotel_name
      )
    `)
    .eq('id', params.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = data as any;
  const instId:      string | undefined = Array.isArray(raw.tour_instances) ? raw.tour_instances[0]?.id : raw.tour_instances?.id;
  const enteredById: string | undefined = raw.entered_by ?? undefined;

  // Guías y "ingresado por" en paralelo
  const [assignRes, enteredByRes] = await Promise.all([
    instId
      ? supabase.from('tour_assignments').select('team_members!team_member_id ( name, role )').eq('tour_instance_id', instId)
      : Promise.resolve({ data: null }),
    enteredById
      ? supabase.from('team_members').select('name, role').eq('id', enteredById).single()
      : Promise.resolve({ data: null }),
  ]);

  const guides: { name: string; role: string }[] = [];
  if (assignRes.data) {
    for (const a of assignRes.data as Record<string, unknown>[]) {
      const tm = a.team_members;
      if (!tm) continue;
      if (Array.isArray(tm)) guides.push(...(tm as { name: string; role: string }[]));
      else guides.push(tm as { name: string; role: string });
    }
  }

  const enteredByMember = (enteredByRes.data as { name: string; role: string } | null) ?? null;

  return NextResponse.json({ ...data, guides, entered_by_member: enteredByMember });
}
