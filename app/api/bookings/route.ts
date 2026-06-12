import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { Resend } from 'resend';
import { render } from '@react-email/render';
import { BookingConfirmedEmail } from '@/emails/BookingConfirmed';
import { NewBookingAdminEmail } from '@/emails/NewBookingAdmin';

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
});

async function getAvailableVans(date: string): Promise<number> {
  const [instancesRes, vansRes, blocksRes] = await Promise.all([
    supabase
      .from('tour_instances')
      .select('id')
      .in('status', ['forming', 'confirmed'])
      .eq('date', date),
    supabase
      .from('vans')
      .select('id')
      .eq('active', true),
    supabase
      .from('van_blocks')
      .select('van_id')
      .eq('date', date),
  ]);
  const totalVans   = vansRes.data?.length ?? 0;
  const blockedVans = new Set((blocksRes.data ?? []).map(b => b.van_id)).size;
  const usedVans    = instancesRes.data?.length ?? 0;
  return totalVans - blockedVans - usedVans;
}

function generateBookingCode(year: number, seq: number): string {
  return `CC-${year}-${String(seq).padStart(4, '0')}`;
}

function generateCancellationToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(req: NextRequest) {
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
    .select('slug, name_es, name_en, name_pt, booking_cutoff_time, has_picnic, active')
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

  // ─── Crear o reutilizar tour_instance con validación de disponibilidad ───
  let instanceId: string;

  if (data.booking_type === 'group') {
    // Tour grupal: buscar instancia forming del mismo tour+fecha para reutilizar
    const { data: existingInstance } = await supabase
      .from('tour_instances')
      .select('id, current_pax, max_pax')
      .eq('tour_slug', data.tour_slug)
      .eq('date', data.tour_date)
      .eq('booking_type', 'group')
      .eq('status', 'forming')
      .maybeSingle();

    if (existingInstance) {
      // Hay instancia grupal activa: sumar pax si cabe
      const newPax = existingInstance.current_pax + data.pax;
      if (newPax > existingInstance.max_pax) {
        return NextResponse.json({ error: 'No hay cupos disponibles para esta fecha' }, { status: 409 });
      }
      await supabase
        .from('tour_instances')
        .update({ current_pax: newPax })
        .eq('id', existingInstance.id);
      instanceId = existingInstance.id;
    } else {
      // No hay instancia grupal: necesita van nueva → verificar disponibilidad
      const freeVans = await getAvailableVans(data.tour_date);
      if (freeVans <= 0) {
        return NextResponse.json({ error: 'No hay disponibilidad para esta fecha. Por favor elige otra fecha.' }, { status: 409 });
      }
      const { data: newInstance, error: instanceError } = await supabase
        .from('tour_instances')
        .insert({
          tour_slug:    data.tour_slug,
          date:         data.tour_date,
          booking_type: 'group',
          current_pax:  data.pax,
          max_pax:      9,
          status:       'forming',
        })
        .select('id')
        .single();
      if (instanceError || !newInstance) {
        console.error('Instance insert error:', instanceError);
        return NextResponse.json({ error: 'Failed to create tour instance' }, { status: 500 });
      }
      instanceId = newInstance.id;
    }
  } else {
    // Tour privado: siempre necesita van nueva → verificar disponibilidad
    const freeVans = await getAvailableVans(data.tour_date);
    if (freeVans <= 0) {
      return NextResponse.json({ error: 'No hay disponibilidad para esta fecha. Por favor elige otra fecha.' }, { status: 409 });
    }
    const { data: newInstance, error: instanceError } = await supabase
      .from('tour_instances')
      .insert({
        tour_slug:    data.tour_slug,
        date:         data.tour_date,
        booking_type: data.booking_type,
        current_pax:  data.pax,
        max_pax:      9,
        status:       'forming',
      })
      .select('id')
      .single();
    if (instanceError || !newInstance) {
      console.error('Instance insert error:', instanceError);
      return NextResponse.json({ error: 'Failed to create tour instance' }, { status: 500 });
    }
    instanceId = newInstance.id;
  }

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
    booking_code: bookingCode,
    status:       booking.status ?? 'pending',
  }, { status: 201 });
}
