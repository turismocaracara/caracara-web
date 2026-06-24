import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { Resend } from 'resend';
import { render } from '@react-email/render';
import { BookingConfirmedEmail } from '@/emails/BookingConfirmed';
import { NewBookingAdminEmail } from '@/emails/NewBookingAdmin';
import { resolveTourInstance, generateBookingCode, generateCancellationToken, getPaymentHoldMinutes, isDateBookable } from '@/lib/booking-engine';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const resend = new Resend(process.env.RESEND_API_KEY);

const PassengerSchema = z.object({
  name:      z.string().min(2).max(120),
  id_type:   z.enum(['rut', 'passport']),
  id_number: z.string().min(3).max(30),
  email:     z.string().email(),
  phone:     z.string().min(6).max(25),
  country:   z.string().min(2).max(60),
  is_lead:   z.boolean().default(false),
  pickup_address: z.string().max(200).optional(),
});

const BookingSchema = z.object({
  tour_slug:    z.string().min(3).max(80),
  tour_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  booking_type: z.enum(['private', 'group']),
  pax:          z.number().int().min(1).max(18),
  passengers:   z.array(PassengerSchema).min(1).max(18),
  locale:       z.enum(['es', 'en', 'pt']).default('es'),
  notes:        z.string().max(500).optional(),
}).refine(data => data.pax === data.passengers.length, {
  message: 'pax debe coincidir con la cantidad de pasajeros',
  path:    ['pax'],
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const withinLimit = await checkRateLimit(`bookings:${ip}`, 8, 600);
  if (!withinLimit) {
    return NextResponse.json({ error: 'Demasiadas solicitudes, intenta más tarde' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = BookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 });
  }

  const data = parsed.data;
  const lead = data.passengers.find(p => p.is_lead) ?? data.passengers[0];

  // Verificar que el tour existe y está activo
  const { data: tour, error: tourError } = await supabase
    .from('tours')
    .select('slug, name_es, name_en, name_pt, booking_cutoff_time, has_picnic, active, group_min_pax')
    .eq('slug', data.tour_slug)
    .eq('active', true)
    .single();

  if (tourError || !tour) {
    return NextResponse.json({ error: 'Tour not found or inactive' }, { status: 404 });
  }

  // Validar que la fecha no sea pasada
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tourDate = new Date(data.tour_date + 'T00:00:00');
  if (tourDate < today) {
    return NextResponse.json({ error: 'Tour date is in the past' }, { status: 422 });
  }

  // Validar feriados, fechas bloqueadas, meses no disponibles y cutoff —
  // las mismas reglas que ya se muestran en el calendario público
  const bookable = await isDateBookable(data.tour_slug, data.tour_date, true);
  if (!bookable.ok) {
    return NextResponse.json({ error: bookable.reason }, { status: 422 });
  }

  // Upsert cliente (buscar por email, crear si no existe)
  const { data: existingClient } = await supabase
    .from('clients')
    .select('id')
    .eq('email', lead.email.toLowerCase())
    .maybeSingle();

  let clientId: string;
  if (existingClient) {
    clientId = existingClient.id;
  } else {
    const { data: newClient, error: clientError } = await supabase
      .from('clients')
      .insert({
        name:      lead.name,
        email:     lead.email.toLowerCase(),
        phone:     lead.phone,
        country:   lead.country,
        id_type:   lead.id_type,
        id_number: lead.id_number,
        locale:    data.locale,
      })
      .select('id')
      .single();

    if (clientError || !newClient) {
      console.error('Client insert error:', clientError);
      return NextResponse.json({ error: 'Failed to create client' }, { status: 500 });
    }
    clientId = newClient.id;
  }

  // Generar código de reserva
  const { data: seqResult } = await supabase.rpc('get_next_booking_seq');
  const year = new Date().getFullYear();
  const seq = typeof seqResult === 'number' ? seqResult : Math.floor(Math.random() * 9000) + 1000;
  const bookingCode = generateBookingCode(year, seq);
  const cancellationToken = generateCancellationToken();

  // ─── Resolver tour_instance con validación de disponibilidad real ───
  const instanceResult = await resolveTourInstance(data.tour_slug, data.tour_date, data.booking_type, data.pax);
  if (instanceResult.error) {
    return NextResponse.json({ error: instanceResult.error }, { status: 409 });
  }
  const instanceId = instanceResult.instanceId;

  // Hold de pago: si el cliente no completa el pago en este plazo, el cupo se libera solo
  const holdMinutes = await getPaymentHoldMinutes();
  const reservedUntil = new Date(Date.now() + holdMinutes * 60_000).toISOString();

  // Crear booking
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      tour_instance_id:   instanceId,
      client_id:          clientId,
      booking_type:       data.booking_type,
      source:             'online',
      pax:                data.pax,
      booking_code:       bookingCode,
      cancellation_token: cancellationToken,
      status:             data.booking_type === 'group' ? 'waiting_min' : 'pending_payment',
      reserved_until:      reservedUntil,
      locale:             data.locale,
      internal_notes:     data.notes ?? null,
    })
    .select('id, booking_code, status')
    .single();

  if (bookingError || !booking) {
    console.error('Booking insert error:', bookingError);
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
  }

  // Crear pasajeros
  const passengersToInsert = data.passengers.map((p, i) => ({
    booking_id: booking.id,
    name:           p.name,
    id_type:        p.id_type,
    id_number:      p.id_number,
    email:          p.email.toLowerCase(),
    phone:          p.phone,
    country:        p.country,
    is_lead:        i === 0 || p.is_lead,
    pickup_address: p.pickup_address ?? null,
  }));

  await supabase.from('passengers').insert(passengersToInsert);

  // Enviar emails
  const tourName = data.locale === 'en' ? tour.name_en : data.locale === 'pt' ? tour.name_pt : tour.name_es;
  const adminEmail = process.env.ADMIN_EMAIL ?? 'turismocaracara@gmail.com';

  try {
    const [htmlCliente, htmlAdmin] = await Promise.all([
      render(BookingConfirmedEmail({
        bookingCode,
        tourName:    tourName ?? tour.name_es,
        tourDate:    data.tour_date,
        pax:         data.pax,
        bookingType: data.booking_type,
        leadName:    lead.name,
        locale:      data.locale,
        cancellationToken,
      })),
      render(NewBookingAdminEmail({
        bookingCode,
        tourName:    tourName ?? tour.name_es,
        tourDate:    data.tour_date,
        pax:         data.pax,
        bookingType: data.booking_type,
        leadName:    lead.name,
        leadEmail:   lead.email,
        leadPhone:   lead.phone,
        passengers:  data.passengers.length,
      })),
    ]);

    const [r1, r2] = await Promise.all([
      resend.emails.send({
        from:    'Turismo CaraCara <reservas@turismocaracara.cl>',
        to:      lead.email,
        subject: `Reserva recibida — ${bookingCode}`,
        html:    htmlCliente,
      }),
      resend.emails.send({
        from:    'CaraCara Sistema <sistema@turismocaracara.cl>',
        to:      adminEmail,
        subject: `Nueva reserva ${bookingCode} — ${tourName}`,
        html:    htmlAdmin,
      }),
    ]);
    if (r1.error) console.error('Email cliente error:', r1.error);
    if (r2.error) console.error('Email admin error:', r2.error);
    if (!r1.error && !r2.error) console.log(`Emails enviados OK: ${bookingCode}`);
  } catch (emailError) {
    console.error('Email error (non-fatal):', emailError);
    // No fallamos la reserva por error de email
  }

  return NextResponse.json({
    success:      true,
    booking_id:   booking.id,
    booking_code: bookingCode,
    status:       booking.status ?? 'pending',
  }, { status: 201 });
}
