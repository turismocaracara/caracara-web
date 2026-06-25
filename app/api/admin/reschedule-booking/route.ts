import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTeamMember, isOpsViewer } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';
import { resolveTourInstance, releaseBookingCapacity, isDateBookable } from '@/lib/booking-engine';

interface RawInstance { tour_slug: string; date: string; }

/**
 * Mueve una reserva grupal a otro tour y/o fecha -- "cambio de fecha" (mismo
 * tour) y "tour alternativo" (otro tour) del protocolo "nunca cancelar" usan
 * este mismo endpoint, ya que la diferencia es solo si new_tour_slug viene o
 * no. El acuerdo con el cliente ya se negoció por WhatsApp; esto solo ejecuta
 * el cambio en el sistema.
 */
export async function POST(req: NextRequest) {
  const member = await getCurrentTeamMember();
  if (!isOpsViewer(member)) {
    return NextResponse.json({ error: 'No tienes permiso para esta acción' }, { status: 403 });
  }

  const body = await req.json() as { booking_id: string; new_tour_slug?: string; new_date: string };
  if (!body.booking_id || !body.new_date) {
    return NextResponse.json({ error: 'booking_id y new_date son requeridos' }, { status: 400 });
  }

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select(`
      id, status, booking_type, pax, internal_notes,
      tour_instance_id, secondary_instance_id, secondary_pax,
      tour_instances!tour_instance_id ( tour_slug, date )
    `)
    .eq('id', body.booking_id)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
  }
  if (booking.status === 'cancelled' || booking.status === 'refunded') {
    return NextResponse.json({ error: 'Esta reserva ya está cancelada' }, { status: 409 });
  }

  const currentInstance = (Array.isArray(booking.tour_instances) ? booking.tour_instances[0] : booking.tour_instances) as RawInstance | null;
  if (!currentInstance) {
    return NextResponse.json({ error: 'Reserva sin tour asignado' }, { status: 422 });
  }

  const targetSlug = body.new_tour_slug ?? currentInstance.tour_slug;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (new Date(body.new_date + 'T00:00:00') < today) {
    return NextResponse.json({ error: 'La nueva fecha ya pasó' }, { status: 422 });
  }

  // Sin cutoff -- es el admin coordinando manualmente un acuerdo ya negociado.
  const bookable = await isDateBookable(targetSlug, body.new_date, false);
  if (!bookable.ok) {
    return NextResponse.json({ error: bookable.reason }, { status: 422 });
  }

  const instanceResult = await resolveTourInstance(targetSlug, body.new_date, booking.booking_type, booking.pax);
  if (!instanceResult.instanceId) {
    return NextResponse.json({ error: instanceResult.error ?? 'Sin cupo para esa fecha' }, { status: 409 });
  }

  await releaseBookingCapacity(booking);

  const note = `Reagendado desde ${currentInstance.tour_slug} ${currentInstance.date} a ${targetSlug} ${body.new_date} por ${member?.name ?? 'admin'} el ${new Date().toISOString().slice(0, 10)}.`;

  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      tour_instance_id:      instanceResult.instanceId,
      secondary_instance_id: instanceResult.secondaryInstanceId ?? null,
      secondary_pax:          instanceResult.secondaryPax ?? null,
      status:                'waiting_min',
      reserved_until:        null,
      internal_notes:        booking.internal_notes ? `${booking.internal_notes}\n${note}` : note,
    })
    .eq('id', booking.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
