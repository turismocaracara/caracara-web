import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTeamMember, isOpsViewer } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';
import { releaseBookingCapacity } from '@/lib/booking-engine';

export async function POST(req: NextRequest) {
  const member = await getCurrentTeamMember();
  if (!isOpsViewer(member)) {
    return NextResponse.json({ error: 'No tienes permiso para esta acción' }, { status: 403 });
  }

  const body = await req.json() as { booking_id: string; action?: 'credit' | 'refund' };
  if (!body.booking_id) {
    return NextResponse.json({ error: 'booking_id requerido' }, { status: 400 });
  }
  const action = body.action ?? 'credit';

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, client_id, total_amount, status, tour_instance_id, secondary_instance_id, secondary_pax, pax')
    .eq('id', body.booking_id)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
  }

  if (booking.status === 'cancelled') {
    return NextResponse.json({ error: 'La reserva ya estaba cancelada' }, { status: 409 });
  }

  const amount = booking.total_amount ?? 0;

  if (action === 'credit') {
    const { error: creditError } = await supabase
      .from('client_credits')
      .insert({
        client_id:  booking.client_id,
        amount_clp: amount,
        reason:     'min_not_reached',
      });

    if (creditError) return NextResponse.json({ error: creditError.message }, { status: 500 });
  }

  // La devolución no se marca 'approved' aca mismo -- entra a la misma cola de
  // /admin/devoluciones (pending_approval) que ya usan las cancelaciones de
  // cliente, para mantener un solo lugar donde se aprueba y se procesa el
  // reembolso real en MercadoPago.
  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      status:              'cancelled',
      cancelled_at:        new Date().toISOString(),
      cancellation_reason: 'min_not_reached',
      cancellation_by:     'admin',
      refund_amount:       action === 'refund' ? amount : 0,
      refund_status:       action === 'refund' ? 'pending_approval' : 'credit_issued',
    })
    .eq('id', booking.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  if (booking.tour_instance_id) {
    await releaseBookingCapacity(booking);
  }

  return NextResponse.json({ ok: true, amount });
}
