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
  name:           z.string().min(2).max(120),
  id_type:        z.enum(['rut', 'passport']).optional(),
  id_number:      z.string().min(3).max(30).optional(),
  email:          z.string().email().optional(),
  phone:          z.string().min(6).max(25).optional(),
  country:        z.string().min(2).max(60).optional(),
  birth_date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  is_lead:        z.boolean().default(false),
  pickup_address: z.string().max(300).optional(),
  hotel_name:     z.string().max(200).optional(),
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
  agency_name:    z.string().min(2).max(120).optional(),
  agency_id:      z.string().uuid().optional(),
  groups_count:   z.number().int().min(1).optional(),
  has_picnic:      z.boolean().optional(),
  duration_hours:  z.number().positive().max(24).optional(),
  picnic_notes:    z.string().max(500).optional(),
  guide_notes:      z.string().max(1000).optional(),
  outsourced:       z.boolean().optional(),
  // Operaciones CaraCara
  guide_id:         z.string().uuid().optional(),
  van_id:           z.string().uuid().optional(),
  guide_fee:        z.number().int().min(0).optional(),
  // Operaciones externas — solo uno de los dos estará relleno
  op_agency_id:     z.string().uuid().optional(),   // agencia ya registrada que opera el tour
  op_provider_id:   z.string().uuid().optional(),   // proveedor nuevo (service_providers)
  provider_fee:     z.number().int().min(0).optional(),
  provider_scope:   z.string().max(1000).optional(),
  payment_status:  z.enum(['pending', 'partial', 'paid']).optional(),
  payment_method:  z.enum(['cash', 'transfer', 'deposit', 'mercadopago', 'invoice', 'other']).optional(),
  amount_paid:     z.number().int().min(0).optional(),
  receipt_ref:     z.string().max(100).optional(),
  price_per_person: z.number().int().min(0).optional(),
  billing_notes:   z.string().max(500).optional(),
}).refine(data => data.passengers.length >= 1 && data.pax >= data.passengers.length, {
  message: 'El número de pasajeros registrados no puede superar el pax declarado',
  path:    ['pax'],
}).refine(data => {
  const isAgencyGroup = !!data.agency_name && data.booking_type === 'group';
  return data.passengers.every(p => {
    if (isAgencyGroup) return !!p.name && !!p.phone;
    // Solo el titular (is_lead) tiene requisitos estrictos
    if (p.is_lead) return !!p.email && !!p.phone && !!p.country;
    return !!p.name;
  });
}, {
  message: 'Faltan datos obligatorios en uno o más titulares',
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
      internal_notes:      data.notes         ?? null,
      agency_name:         data.agency_name   ?? null,
      agency_id:           data.agency_id     ?? null,
      groups_count:        data.groups_count  ?? null,
      price_per_person:    data.price_per_person ?? null,
      payment_status:      data.payment_status  ?? null,
      payment_method:      data.payment_method  ?? null,
      amount_paid:         data.amount_paid     ?? null,
      receipt_ref:         data.receipt_ref     ?? null,
      billing_notes:       data.billing_notes   ?? null,
    })
    .select('id, booking_code, status')
    .single();

  if (bookingError || !booking) {
    console.error('[manual-booking] Booking insert error:', bookingError);
    return NextResponse.json({ error: 'Error al crear la reserva' }, { status: 500 });
  }

  const passengersToInsert = data.passengers.map((p, i) => ({
    booking_id:     booking.id,
    name:           p.name,
    id_type:        p.id_type   ?? null,
    id_number:      p.id_number ?? null,
    email:          p.email?.toLowerCase() ?? null,
    phone:          p.phone   ?? null,
    country:        p.country ?? null,
    birth_date:     p.birth_date     ?? null,
    pickup_address: p.pickup_address ?? null,
    hotel_name:     p.hotel_name     ?? null,
    is_lead:        i === 0 || p.is_lead,
  }));

  await supabase.from('passengers').insert(passengersToInsert);

  // ── Operaciones → tour_instance ──────────────────────────────────────────
  const instanceUpdate: Record<string, unknown> = {};
  if (data.guide_notes   !== undefined) instanceUpdate.guide_notes    = data.guide_notes;
  if (data.outsourced    !== undefined) instanceUpdate.outsourced      = data.outsourced;
  if (data.van_id        !== undefined) instanceUpdate.van_id          = data.van_id;
  if (data.guide_fee     !== undefined) instanceUpdate.guide_fee       = data.guide_fee;
  if (data.op_agency_id   !== undefined) instanceUpdate.op_agency_id   = data.op_agency_id;
  if (data.op_provider_id !== undefined) instanceUpdate.op_provider_id = data.op_provider_id;
  if (data.provider_fee   !== undefined) instanceUpdate.provider_fee   = data.provider_fee;
  if (data.provider_scope !== undefined) instanceUpdate.provider_scope = data.provider_scope;
  if (Object.keys(instanceUpdate).length > 0) {
    await supabase.from('tour_instances').update(instanceUpdate).eq('id', instanceId);
  }

  // ── Asignación de guía interno → tour_assignments ─────────────────────────
  if (data.guide_id) {
    await supabase.from('tour_assignments').upsert(
      { tour_instance_id: instanceId, team_member_id: data.guide_id, role_in_tour: 'guide_driver' },
      { onConflict: 'tour_instance_id' }
    );
  }

  // ── Historial picnic + duración ───────────────────────────────────────────
  if (data.has_picnic !== undefined) {
    await supabase.from('tour_picnic_history').insert({
      tour_slug:  data.tour_slug,
      booking_id: booking.id,
      had_picnic: data.has_picnic,
      notes:      data.picnic_notes ?? null,
    });

    // Calcular nuevo promedio y actualizar el tour
    const { data: history } = await supabase
      .from('tour_picnic_history')
      .select('had_picnic')
      .eq('tour_slug', data.tour_slug);

    if (history && history.length > 0) {
      const trueCount = history.filter((h: { had_picnic: boolean }) => h.had_picnic).length;
      const newDefault = trueCount / history.length >= 0.5;
      await supabase.from('tours').update({ has_picnic: newDefault }).eq('slug', data.tour_slug);
    }
  }

  if (data.duration_hours !== undefined) {
    await supabase.from('tour_duration_history').insert({
      tour_slug:      data.tour_slug,
      booking_id:     booking.id,
      duration_hours: data.duration_hours,
    });
    await supabase.from('tours').update({ duration_hours: data.duration_hours }).eq('slug', data.tour_slug);
  }

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
