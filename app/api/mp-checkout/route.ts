import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { supabase } from '@/lib/supabase';

const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    return await handleCheckout(req, body);
  } catch (err) {
    let msg = 'Error interno';
    if (err instanceof Error) {
      msg = err.message;
    } else if (typeof err === 'string') {
      msg = err;
    } else {
      try { msg = JSON.stringify(err); } catch { /* noop */ }
    }
    console.error('[mp-checkout] error:', msg, err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function handleCheckout(req: NextRequest, body: unknown) {

  const { booking_id } = body as { booking_id?: string };
  if (!booking_id) {
    return NextResponse.json({ error: 'booking_id requerido' }, { status: 400 });
  }

  // Obtener booking con tour instance y cliente
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select(`
      id, booking_code, booking_type, pax, locale, status, client_id,
      tour_instances!inner ( tour_slug, date ),
      clients!inner ( name, email )
    `)
    .eq('id', booking_id)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
  }

  if (booking.status !== 'pending_payment' && booking.status !== 'waiting_min') {
    return NextResponse.json({ error: 'Esta reserva ya fue procesada' }, { status: 409 });
  }

  const instance   = booking.tour_instances as unknown as { tour_slug: string; date: string };
  const tourSlug   = instance.tour_slug;
  const tourDate   = instance.date;

  // Obtener nombre del tour
  const { data: tour } = await supabase
    .from('tours')
    .select('name_es, name_en, name_pt')
    .eq('slug', tourSlug)
    .single();

  const tourName = booking.locale === 'en' ? tour?.name_en
    : booking.locale === 'pt' ? tour?.name_pt
    : tour?.name_es;

  // Calcular precio según tipo de reserva
  let pricePerPerson = 0;

  if (booking.booking_type === 'group') {
    const { data: gp } = await supabase
      .from('group_pricing')
      .select('price_per_person')
      .eq('tour_slug', tourSlug)
      .maybeSingle();
    pricePerPerson = gp?.price_per_person ?? 0;
  } else {
    const { data: pp } = await supabase
      .from('private_pricing')
      .select('price_per_person')
      .eq('tour_slug', tourSlug)
      .lte('pax_min', booking.pax)
      .gte('pax_max', booking.pax)
      .maybeSingle();
    pricePerPerson = pp?.price_per_person ?? 0;
  }

  if (pricePerPerson === 0) {
    return NextResponse.json({ error: 'Precio no configurado para este tour' }, { status: 422 });
  }

  const totalAmount = pricePerPerson * booking.pax;

  // Crédito disponible del cliente (por email) — se aplica automáticamente, el más grande primero
  const { data: credit } = await supabase
    .from('client_credits')
    .select('id, amount_clp')
    .eq('client_id', booking.client_id)
    .is('used_at', null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order('amount_clp', { ascending: false })
    .limit(1)
    .maybeSingle();

  const creditApplied = credit ? Math.min(credit.amount_clp, totalAmount) : 0;
  const creditId       = credit?.id ?? null;
  const amountDue       = totalAmount - creditApplied;

  // Guardar precio y crédito en booking
  await supabase
    .from('bookings')
    .update({
      price_per_person: pricePerPerson,
      total_amount:      totalAmount,
      credit_applied:    creditApplied,
      credit_id:         creditId,
    })
    .eq('id', booking_id);

  // Derivar baseUrl limpio desde env var (trim elimina tabs/newlines invisibles)
  const proto   = req.headers.get('x-forwarded-proto') ?? 'https';
  const host    = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'turismocaracara.cl';
  const envBase = process.env.NEXT_PUBLIC_BASE_URL?.trim().replace(/\/+$/, '');
  const baseUrl = envBase ?? `${proto}://${host}`;
  const locale  = booking.locale ?? 'es';

  const successUrl = `${baseUrl}/${locale}/reservas/${booking.booking_code}`;
  console.log('[mp-checkout] back_url (json):', JSON.stringify(successUrl));

  // Crédito cubre el 100% → confirmar directo, sin pasar por MercadoPago
  if (amountDue <= 0) {
    const finalStatus = booking.booking_type === 'group' ? 'waiting_min' : 'confirmed';
    await supabase.from('bookings').update({ status: finalStatus }).eq('id', booking_id);

    if (creditId) {
      await supabase
        .from('client_credits')
        .update({ used_at: new Date().toISOString(), used_in_booking_id: booking_id })
        .eq('id', creditId);
    }

    return NextResponse.json({
      fully_paid:   true,
      redirect_url: `${successUrl}?status=approved`,
    });
  }

  const typeLabel = booking.booking_type === 'group' ? 'Grupal' : 'Privado';
  const itemTitle = creditApplied > 0
    ? `${tourName ?? tourSlug} - ${typeLabel} - ${tourDate} (crédito $${creditApplied.toLocaleString('es-CL')} aplicado)`
    : `${tourName ?? tourSlug} - ${typeLabel} - ${tourDate}`;

  // Crear preferencia en MercadoPago — un solo ítem por el monto neto a pagar
  const preference = new Preference(mp);
  const pref = await preference.create({
    body: {
      external_reference: booking.booking_code,
      items: [{
        id:          tourSlug,
        title:       itemTitle,
        quantity:    1,
        unit_price:  Math.round(amountDue),
        currency_id: 'CLP',
      }],
      back_urls: {
        success: successUrl,
        failure: successUrl,
        pending: successUrl,
      },
      notification_url: `${baseUrl}/api/mp-webhook`,
    },
  });

  console.log('[mp-checkout] init_point:', JSON.stringify(pref.init_point));
  console.log('[mp-checkout] sandbox_init_point:', JSON.stringify(pref.sandbox_init_point));

  // Guardar preference id en booking
  await supabase
    .from('bookings')
    .update({ mp_preference_id: pref.id })
    .eq('id', booking_id);

  return NextResponse.json({
    preference_id: pref.id,
    init_point:    pref.init_point,
    sandbox_init_point: pref.sandbox_init_point,
  });
}
