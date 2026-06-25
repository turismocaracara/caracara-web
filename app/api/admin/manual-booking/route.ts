import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { Resend } from 'resend';
import { render } from '@react-email/render';
import { BookingConfirmedEmail } from '@/emails/BookingConfirmed';
import { getCurrentTeamMember, hasPermission } from '@/lib/admin-auth';
import { resolveTourInstance, generateBookingCode, generateCancellationToken, isDateBookable } from '@/lib/booking-engine';

const resend = new Resend(process.env.RESEND_API_KEY);

// Mismo criterio que el flujo público: el titular completa todo, el resto del
// grupo solo nombre + documento.
const PassengerSchema = z.object({
  name:       z.string().min(2).max(120),
  id_type:    z.enum(['rut', 'passport']),
  id_number:  z.string().min(3).max(30),
  email:      z.string().email().optional(),
  phone:      z.string().min(6).max(25).optional(),
  country:    z.string().min(2).max(60).optional(),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  is_lead:    z.boolean().default(false),
});

const ManualBookingSchema = z.object({
  tour_slug:      z.string().min(3).max(80),
  tour_date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  booking_type:   z.enum(['private', 'group']),
  pax:            z.number().int().min(1).max(18),
  passengers:     z.array(PassengerSchema).min(1).max(18),
  tour_languages: z.array(z.enum(['es', 'en', 'pt'])).optional(),
  locale:         z.enum(['es', 'en', 'pt']).default('es'),
  notes:          z.string().max(500).optional(),
  total_amount:   z.number().int().min(0).optional(),
}).refine(data => data.pax === data.passengers.length, {
  message: 'pax debe coincidir con la cantidad de pasajeros',
  path:    ['pax'],
}).refine(data => {
  const lead = data.passengers.find(p => p.is_lead) ?? data.passengers[0];
  return !!lead.email && !!lead.phone && !!lead.country;
}, {
  message: 'El pasajero titular debe completar email, teléfono y país',
  path:    ['passengers'],
});

export async function POST(req: NextRequest) {
  const member = await getCurrentTeamMember();
  if (!hasPermission(member, 'manual_booking')) {
    return NextResponse.json({ error: 'No tienes permiso para crear reservas manuales' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = ManualBookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 });
  }

  const data = parsed.data;
  // El .refine() de arriba ya garantizó que el titular tiene email/phone/country.
  const lead = data.passengers.find(p => p.is_lead) ?? data.passengers[0];
  const leadEmail = lead.email!;
  const leadPhone = lead.phone!;
  const leadCountry = lead.country!;

  const { data: tour, error: tourError } = await supabase
    .from('tours')
    .select('slug, name_es, name_en, name_pt, active')
    .eq('slug', data.tour_slug)
    .eq('active', true)
    .single();

  if (tourError || !tour) {
    return NextResponse.json({ error: 'Tour no encontrado o inactivo' }, { status: 404 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tourDate = new Date(data.tour_date + 'T00:00:00');
  if (tourDate < today) {
    return NextResponse.json({ error: 'La fecha del tour ya pasó' }, { status: 422 });
  }

  // Feriados / fechas bloqueadas / meses no disponibles igual que el flujo público —
  // sin cutoff de horario, porque el admin coordina manualmente fuera de ese plazo
  const bookable = await isDateBookable(data.tour_slug, data.tour_date, false);
  if (!bookable.ok) {
    return NextResponse.json({ error: bookable.reason }, { status: 422 });
  }

  // Upsert cliente
  const { data: existingClient } = await supabase
    .from('clients')
    .select('id')
    .eq('email', leadEmail.toLowerCase())
    .maybeSingle();

  let clientId: string;
  if (existingClient) {
    clientId = existingClient.id;
  } else {
    const { data: newClient, error: clientError } = await supabase
      .from('clients')
      .insert({
        name:      lead.name,
        email:     leadEmail.toLowerCase(),
        phone:     leadPhone,
        country:   leadCountry,
        id_type:   lead.id_type,
        id_number: lead.id_number,
        locale:    data.locale,
      })
      .select('id')
      .single();

    if (clientError || !newClient) {
      console.error('[manual-booking] Client insert error:', clientError);
      return NextResponse.json({ error: 'Error al crear el cliente' }, { status: 500 });
    }
    clientId = newClient.id;
  }

  // Verificar disponibilidad real — sin excepción, ni siquiera para reservas manuales
  const instanceResult = await resolveTourInstance(data.tour_slug, data.tour_date, data.booking_type, data.pax);
  if (!instanceResult.instanceId) {
    return NextResponse.json({ error: instanceResult.error }, { status: 409 });
  }
  const instanceId = instanceResult.instanceId;

  const { data: seqResult } = await supabase.rpc('get_next_booking_seq');
  const year = new Date().getFullYear();
  const seq = typeof seqResult === 'number' ? seqResult : Math.floor(Math.random() * 9000) + 1000;
  const bookingCode = generateBookingCode(year, seq);
  const cancellationToken = generateCancellationToken();

  // Privado: se asume coordinado/pagado fuera del sistema → confirmado directo.
  // Grupal: igual que online — espera el mínimo, lo decide el cron de las 20:00.
  const status = data.booking_type === 'private' ? 'confirmed' : 'waiting_min';

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      tour_instance_id:      instanceId,
      secondary_instance_id: instanceResult.secondaryInstanceId ?? null,
      secondary_pax:         instanceResult.secondaryPax ?? null,
      client_id:          clientId,
      booking_type:        data.booking_type,
      source:              'manual',
      entered_by:          member?.id ?? null,
      pax:                 data.pax,
      total_amount:        data.total_amount ?? null,
      booking_code:        bookingCode,
      cancellation_token:  cancellationToken,
      status,
      locale:              data.locale,
      tour_languages:      data.tour_languages ?? [data.locale],
      internal_notes:      data.notes ?? null,
    })
    .select('id, booking_code, status')
    .single();

  if (bookingError || !booking) {
    console.error('[manual-booking] Booking insert error:', bookingError);
    return NextResponse.json({ error: 'Error al crear la reserva' }, { status: 500 });
  }

  const passengersToInsert = data.passengers.map((p, i) => ({
    booking_id: booking.id,
    name:       p.name,
    id_type:    p.id_type,
    id_number:  p.id_number,
    email:      p.email?.toLowerCase() ?? null,
    phone:      p.phone ?? null,
    country:    p.country ?? null,
    birth_date: p.birth_date ?? null,
    is_lead:    i === 0 || p.is_lead,
  }));

  await supabase.from('passengers').insert(passengersToInsert);

  // Email de confirmación al cliente (best-effort, no bloquea la respuesta)
  const tourName = data.locale === 'en' ? tour.name_en : data.locale === 'pt' ? tour.name_pt : tour.name_es;
  try {
    const html = await render(BookingConfirmedEmail({
      bookingCode,
      tourName:    tourName ?? tour.name_es,
      tourDate:    data.tour_date,
      pax:         data.pax,
      bookingType: data.booking_type,
      leadName:    lead.name,
      locale:      data.locale,
      cancellationToken,
    }));
    const { error: emailError } = await resend.emails.send({
      from:    'Turismo CaraCara <reservas@turismocaracara.cl>',
      to:      leadEmail,
      subject: `Reserva confirmada — ${bookingCode}`,
      html,
    });
    if (emailError) console.error('[manual-booking] Email error:', emailError);
  } catch (emailError) {
    console.error('[manual-booking] Email error (non-fatal):', emailError);
  }

  return NextResponse.json({
    success:      true,
    booking_id:   booking.id,
    booking_code: bookingCode,
    status:       booking.status,
  }, { status: 201 });
}
