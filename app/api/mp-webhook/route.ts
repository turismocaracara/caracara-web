import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { supabase } from '@/lib/supabase';
import crypto from 'crypto';

const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
});

function verifySignature(req: NextRequest, _rawBody: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true; // sin secret configurado, saltar verificación (solo en dev)

  const xSignature  = req.headers.get('x-signature') ?? '';
  const xRequestId  = req.headers.get('x-request-id') ?? '';
  const dataId      = new URL(req.url).searchParams.get('data.id') ?? '';

  // Formato: ts=TIMESTAMP,v1=HASH
  const parts = Object.fromEntries(xSignature.split(',').map(p => p.split('=')));
  const ts = parts['ts'];
  const v1 = parts['v1'];
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!verifySignature(req, rawBody)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let notification: { type?: string; data?: { id?: string } };
  try {
    notification = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Solo procesar notificaciones de tipo "payment"
  if (notification.type !== 'payment' || !notification.data?.id) {
    return NextResponse.json({ ok: true });
  }

  const paymentId = String(notification.data.id);

  // Obtener detalles del pago desde MP
  let payment;
  try {
    const paymentClient = new Payment(mp);
    payment = await paymentClient.get({ id: paymentId });
  } catch {
    console.error('Error fetching payment from MP:', paymentId);
    return NextResponse.json({ error: 'MP API error' }, { status: 502 });
  }

  const externalRef = payment.external_reference; // booking_code
  const mpStatus    = payment.status;              // approved | rejected | pending | etc.

  if (!externalRef) {
    return NextResponse.json({ ok: true });
  }

  // Mapear estado MP → estado booking
  let bookingStatus: string | null = null;
  if (mpStatus === 'approved') {
    // El estado final depende del tipo de reserva (lo obtenemos de la DB)
    const { data: booking } = await supabase
      .from('bookings')
      .select('booking_type')
      .eq('booking_code', externalRef)
      .single();
    bookingStatus = booking?.booking_type === 'group' ? 'waiting_min' : 'confirmed';
  } else if (mpStatus === 'rejected' || mpStatus === 'cancelled') {
    bookingStatus = 'cancelled';
  }
  // pending / in_process: no cambiamos el estado aún

  if (bookingStatus) {
    const { error } = await supabase
      .from('bookings')
      .update({
        mp_payment_id: paymentId,
        status:        bookingStatus,
      })
      .eq('booking_code', externalRef);

    if (error) {
      console.error('Error updating booking status:', error);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    console.log(`Booking ${externalRef} → ${bookingStatus} (MP payment ${paymentId})`);
  }

  return NextResponse.json({ ok: true });
}
