import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTeamMember } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const member = await getCurrentTeamMember();
  if (!member || member.role === 'guide') {
    return NextResponse.json({ error: 'No tienes permiso para esta acción' }, { status: 403 });
  }

  const body = await req.json() as { booking_id: string };
  if (!body.booking_id) {
    return NextResponse.json({ error: 'booking_id requerido' }, { status: 400 });
  }

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, client_id, total_amount, status')
    .eq('id', body.booking_id)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
  }

  if (booking.status === 'cancelled') {
    return NextResponse.json({ error: 'La reserva ya estaba cancelada' }, { status: 409 });
  }

  const amount = booking.total_amount ?? 0;

  const { error: creditError } = await supabase
    .from('client_credits')
    .insert({
      client_id:  booking.client_id,
      amount_clp: amount,
      reason:     'min_not_reached',
    });

  if (creditError) return NextResponse.json({ error: creditError.message }, { status: 500 });

  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      status:              'cancelled',
      cancelled_at:        new Date().toISOString(),
      cancellation_reason: 'min_not_reached',
      cancellation_by:     'admin',
      refund_status:       'credit_issued',
    })
    .eq('id', booking.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true, credit_amount: amount });
}
