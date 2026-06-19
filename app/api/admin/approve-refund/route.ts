import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getCurrentTeamMember, hasPermission } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const member = await getCurrentTeamMember();
  if (!hasPermission(member, 'view_financials')) {
    return NextResponse.json({ error: 'No tienes permiso para gestionar devoluciones' }, { status: 403 });
  }

  const body = await req.json() as { booking_id: string; action: 'approve' | 'mark_processed' };
  if (!body.booking_id || !body.action) {
    return NextResponse.json({ error: 'booking_id y action son requeridos' }, { status: 400 });
  }

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, booking_code, refund_amount, refund_status, clients ( name, email )')
    .eq('id', body.booking_id)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
  }

  const client = Array.isArray(booking.clients) ? booking.clients[0] : booking.clients;

  if (body.action === 'approve') {
    if (booking.refund_status !== 'pending_approval') {
      return NextResponse.json({ error: 'Esta devolución no está pendiente de aprobación' }, { status: 409 });
    }
    await supabase.from('bookings').update({ refund_status: 'approved' }).eq('id', booking.id);

    if (client?.email) {
      try {
        await resend.emails.send({
          from:    'Turismo CaraCara <reservas@turismocaracara.cl>',
          to:      client.email,
          subject: `Devolución aprobada — ${booking.booking_code}`,
          html: `
            <p>Hola ${client.name ?? ''},</p>
            <p>Tu devolución de <strong>$${(booking.refund_amount ?? 0).toLocaleString('es-CL')}</strong> para la reserva ${booking.booking_code} fue aprobada.</p>
            <p>Será procesada por MercadoPago en los próximos días hábiles.</p>
            <p>Turismo CaraCara</p>
          `,
        });
      } catch (e) { console.error('[approve-refund] email error', e); }
    }
  } else {
    if (booking.refund_status !== 'approved') {
      return NextResponse.json({ error: 'Esta devolución aún no fue aprobada' }, { status: 409 });
    }
    await supabase
      .from('bookings')
      .update({ refund_status: 'processed', refund_processed_at: new Date().toISOString() })
      .eq('id', booking.id);
  }

  return NextResponse.json({ ok: true });
}
