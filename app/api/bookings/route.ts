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

// ─── Algoritmo de redistribución de grupos indivisibles ──────────────────────

// Encuentra la partición de grupos en vans que maximiza pax en van[0].
// Devuelve assignment[i] = índice de van para el grupo i, o null si es imposible.
function findBestPartition(
  groupPax: number[],
  numVans: number,
  vanCapacity = 9,
  minPax = 4
): number[] | null {
  let bestAssignment: number[] | null = null;
  let bestVan0Pax = -1;

  const vanPax = new Array(numVans).fill(0);
  const assignment: number[] = [];

  function backtrack(idx: number) {
    if (idx === groupPax.length) {
      // Validar: cada van con al menos un grupo debe tener ≥ minPax
      const vanUsed = new Array(numVans).fill(false);
      for (const a of assignment) vanUsed[a] = true;
      const valid = vanPax.every((pax, v) => !vanUsed[v] || pax >= minPax);
      if (valid && (bestAssignment === null || vanPax[0] > bestVan0Pax)) {
        bestAssignment = [...assignment];
        bestVan0Pax = vanPax[0];
      }
      return;
    }
    for (let v = 0; v < numVans; v++) {
      if (vanPax[v] + groupPax[idx] <= vanCapacity) {
        vanPax[v] += groupPax[idx];
        assignment.push(v);
        backtrack(idx + 1);
        assignment.pop();
        vanPax[v] -= groupPax[idx];
      }
    }
  }

  backtrack(0);
  return bestAssignment;
}

// Intenta redistribuir grupos existentes + nuevo grupo entre vans disponibles.
// Devuelve el tour_instance_id donde debe ir el nuevo booking, o null si es imposible.
async function tryGroupRedistribution(
  tourSlug: string,
  tourDate: string,
  newGroupPax: number,
  groupMinPax: number,
  freeVans: number
): Promise<string | null> {

  // 1. Obtener todas las instancias grupales activas para este tour+fecha
  const { data: existingInstances } = await supabase
    .from('tour_instances')
    .select('id, current_pax, status')
    .eq('tour_slug', tourSlug)
    .eq('date', tourDate)
    .eq('booking_type', 'group')
    .in('status', ['forming', 'confirmed']);

  const instances = existingInstances ?? [];
  const totalVans = instances.length + freeVans;
  if (totalVans < 2) return null; // necesita al menos 2 vans

  // 2. Obtener bookings individuales de esas instancias (grupos indivisibles)
  const instanceIds = instances.map(i => i.id);
  const { data: existingBookings } = await supabase
    .from('bookings')
    .select('id, tour_instance_id, pax')
    .in('tour_instance_id', instanceIds)
    .neq('status', 'cancelled');

  const bookings = existingBookings ?? [];
  const newGroupIdx = bookings.length; // índice del nuevo grupo en el array

  // 3. Construir array de pax (grupos existentes + nuevo)
  const allPax = [...bookings.map(b => b.pax), newGroupPax];

  // 4. Ejecutar algoritmo (limitado a 2 vans por ahora — máximo de vans propias)
  const numVans = Math.min(totalVans, 2);
  const assignment = findBestPartition(allPax, numVans, 9, groupMinPax);
  if (!assignment) return null;

  // 5. Crear instancias nuevas para vans que no tienen instancia aún
  const vanToInstance: (string | null)[] = instances.map(i => i.id);
  for (let v = instances.length; v < numVans; v++) {
    if (freeVans > v - instances.length) {
      const { data: newInst } = await supabase
        .from('tour_instances')
        .insert({
          tour_slug:    tourSlug,
          date:         tourDate,
          booking_type: 'group',
          current_pax:  0,
          max_pax:      9,
          status:       'forming',
        })
        .select('id')
        .single();
      vanToInstance[v] = newInst?.id ?? null;
    } else {
      vanToInstance[v] = null;
    }
  }

  // 6. Calcular nuevo current_pax por instancia
  const newVanPax = new Array(numVans).fill(0);
  for (let i = 0; i < allPax.length; i++) {
    newVanPax[assignment[i]] += allPax[i];
  }

  // 7. Mover bookings que cambian de instancia
  for (let i = 0; i < bookings.length; i++) {
    const targetInstId = vanToInstance[assignment[i]];
    if (targetInstId && bookings[i].tour_instance_id !== targetInstId) {
      await supabase
        .from('bookings')
        .update({ tour_instance_id: targetInstId })
        .eq('id', bookings[i].id);
      console.log(`[redistrib] booking ${bookings[i].id} (${bookings[i].pax} pax) → instancia ${targetInstId}`);
    }
  }

  // 8. Actualizar current_pax de todas las instancias
  for (let v = 0; v < numVans; v++) {
    const instId = vanToInstance[v];
    if (instId) {
      await supabase
        .from('tour_instances')
        .update({ current_pax: newVanPax[v] })
        .eq('id', instId);
    }
  }

  console.log(`[redistrib] resultado: ${vanToInstance.map((id, v) => `van${v+1}=${newVanPax[v]}pax`).join(', ')}`);

  // 9. Retornar la instancia donde va el nuevo booking
  const targetVan = assignment[newGroupIdx];
  return vanToInstance[targetVan] ?? null;
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
    // Tour grupal: obtener todas las instancias forming del mismo tour+fecha
    const { data: formingInstances } = await supabase
      .from('tour_instances')
      .select('id, current_pax, max_pax')
      .eq('tour_slug', data.tour_slug)
      .eq('date', data.tour_date)
      .eq('booking_type', 'group')
      .eq('status', 'forming');

    const instances = formingInstances ?? [];

    // Paso 1: fit simple — buscar instancia donde el nuevo grupo quepa directamente
    const fittingInstance = instances.find(inst => inst.current_pax + data.pax <= inst.max_pax);

    if (fittingInstance) {
      await supabase
        .from('tour_instances')
        .update({ current_pax: fittingInstance.current_pax + data.pax })
        .eq('id', fittingInstance.id);
      instanceId = fittingInstance.id;
    } else if (instances.length === 0) {
      // Primera reserva grupal para este tour+fecha: necesita van nueva
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
    } else {
      // Hay instancias pero ninguna tiene cupo directo → intentar redistribución
      const freeVans = await getAvailableVans(data.tour_date);
      const groupMinPax = (tour as { group_min_pax?: number }).group_min_pax ?? 4;

      const redistribInstId = await tryGroupRedistribution(
        data.tour_slug, data.tour_date, data.pax, groupMinPax, freeVans
      );

      if (redistribInstId) {
        instanceId = redistribInstId;
      } else {
        return NextResponse.json({ error: 'No hay cupos disponibles para esta fecha' }, { status: 409 });
      }
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
    booking_id:   booking.id,
    booking_code: bookingCode,
    status:       booking.status ?? 'pending',
  }, { status: 201 });
}
