import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabase } from '@/lib/supabase';
import { releaseInstanceCapacity } from '@/lib/booking-engine';
import { getRefundPercent, daysBeforeTour } from '@/lib/cancellation';
import { escapeHtml } from '@/lib/html';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const resend = new Resend(process.env.RESEND_API_KEY);

interface RawInstance { tour_slug: string; date: string; }
interface RawClient { name: string; email: string; }

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const withinLimit = await checkRateLimit(`cancel-booking:${ip}`, 15, 600);
  if (!withinLimit) {
    return NextResponse.json({ error: 'Demasiadas solicitudes, intenta más tarde' }, { status: 429 });
  }

  const body = await req.json() as { booking_code?: string; token?: string };
  if (!body.booking_code || !body.token) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
  }

  const { data: booking, error } = await supabase
    .from('bookings')
    .select(`
      id, booking_code, cancellation_token, status, total_amount, pax, tour_instance_id,
      tour_instances ( tour_slug, date ),
      clients ( name, email )
    `)
    .eq('booking_code', body.booking_code.toUpperCase())
    .single();

  if (error || !booking) {
    return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
  }
  if (!booking.cancellation_token || booking.cancellation_token !== body.token) {
    return NextResponse.json({ error: 'Enlace inválido' }, { status: 403 });
  }
  if (booking.status === 'cancelled') {
    return NextResponse.json({ error: 'Esta reserva ya estaba cancelada' }, { status: 409 });
  }

  const instance = (Array.isArray(booking.tour_instances) ? booking.tour_instances[0] : booking.tour_instances) as RawInstance | null;
  const client   = (Array.isArray(booking.clients) ? booking.clients[0] : booking.clients) as RawClient | null;

  if (!instance) {
    return NextResponse.json({ error: 'Reserva inválida' }, { status: 500 });
  }

  const daysBefore    = daysBeforeTour(instance.date);
  const refundPercent = await getRefundPercent(instance.tour_slug, daysBefore);
  const totalAmount   = booking.total_amount ?? 0;
  const refundAmount  = Math.round(totalAmount * refundPercent / 100);

  await supabase
    .from('bookings')
    .update({
      status:              'cancelled',
      cancelled_at:         new Date().toISOString(),
      cancellation_reason: 'client_request',
      cancellation_by:     'client',
      refund_amount:       refundAmount,
      refund_status:       refundAmount > 0 ? 'pending_approval' : 'not_applicable',
    })
    .eq('id', booking.id);

  if (booking.tour_instance_id) {
    await releaseInstanceCapacity(booking.tour_instance_id, booking.pax);
  }

  const adminEmail = process.env.ADMIN_EMAIL ?? 'turismocaracara@gmail.com';
  try {
    await resend.emails.send({
      from:    'CaraCara Sistema <sistema@turismocaracara.cl>',
      to:      adminEmail,
      subject: `Solicitud de cancelación — ${booking.booking_code}`,
      html: `
        <h2>Un cliente solicitó cancelar su reserva</h2>
        <p><strong>Código:</strong> ${booking.booking_code}</p>
        <p><strong>Cliente:</strong> ${escapeHtml(client?.name ?? '—')} (${escapeHtml(client?.email ?? '—')})</p>
        <p><strong>Días antes del tour:</strong> ${daysBefore}</p>
        <p><strong>Monto pagado:</strong> $${totalAmount.toLocaleString('es-CL')}</p>
        <p><strong>Devolución según política (${refundPercent}%):</strong> $${refundAmount.toLocaleString('es-CL')}</p>
        ${refundAmount > 0
          ? '<p>Ingresa al panel de administración → Devoluciones para aprobarla.</p>'
          : '<p>No corresponde devolución según la política de cancelación vigente.</p>'}
      `,
    });
  } catch (emailError) {
    console.error('[cancel-booking] email error (non-fatal):', emailError);
  }

  return NextResponse.json({ ok: true, refund_percent: refundPercent, refund_amount: refundAmount });
}
