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
    return await handleCheckout(body);
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

async function handleCheckout(body: unknown) {

  const { booking_id } = body as { booking_id?: string };
  if (!booking_id) {
    return NextResponse.json({ error: 'booking_id requerido' }, { status: 400 });
  }

  // Obtener booking con tour instance y cliente
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select(`
      id, booking_code, booking_type, pax, locale, status,
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
  const client     = booking.clients       as unknown as { name: string; email: string };
  const tourSlug   = instance.tour_slug;
  const tourDate   = instance.date;
  const clientName = client.name;
  const clientEmail = client.email;

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

  // Guardar precio en booking
  await supabase
    .from('bookings')
    .update({ price_per_person: pricePerPerson, total_amount: totalAmount })
    .eq('id', booking_id);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://turismocaracara.cl';
  const locale = booking.locale ?? 'es';

  // Crear preferencia en MercadoPago
  const preference = new Preference(mp);
  const pref = await preference.create({
    body: {
      external_reference: booking.booking_code,
      items: [{
        id:          tourSlug,
        title:       `${tourName} — ${booking.booking_type === 'group' ? 'Tour grupal' : 'Tour privado'} · ${tourDate}`,
        quantity:    booking.pax,
        unit_price:  pricePerPerson,
        currency_id: 'CLP',
      }],
      payer: {
        name:  clientName,
        email: clientEmail,
      },
      back_urls: {
        success: `${baseUrl}/${locale}/reservas/${booking.booking_code}`,
        failure: `${baseUrl}/${locale}/reservas/${booking.booking_code}`,
        pending: `${baseUrl}/${locale}/reservas/${booking.booking_code}`,
      },
      auto_return:          'approved',
      notification_url:     `${baseUrl}/api/mp-webhook`,
      statement_descriptor: 'TURISMO CARACARA',
    },
  });

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
