import { supabase } from './supabase';

function nowInSantiago(): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '0';
  return new Date(
    Number(get('year')), Number(get('month')) - 1, Number(get('day')),
    Number(get('hour')), Number(get('minute'))
  );
}

type BookableResult = { ok: true } | { ok: false; reason: string };

/**
 * Replica en el backend las mismas reglas de bloqueo que ya se usan para pintar
 * el calendario público (GET /api/availability): feriados recurrentes, fechas
 * bloqueadas específicas y meses en que el tour no opera. Sin esto, una request
 * directa (o un calendario con caché vieja) podía crear una reserva para un día
 * cerrado. enforceCutoff se desactiva para reservas manuales (el admin ya
 * coordinó la reserva fuera del plazo normal de corte).
 */
export async function isDateBookable(
  tourSlug: string,
  dateStr: string,
  enforceCutoff = true
): Promise<BookableResult> {
  const { data: tour } = await supabase
    .from('tours')
    .select('available_months, booking_cutoff_time')
    .eq('slug', tourSlug)
    .single();

  if (!tour) return { ok: false, reason: 'Tour no encontrado' };

  const d = new Date(dateStr + 'T00:00:00');
  const month = d.getMonth() + 1;
  const day   = d.getDate();

  const availableMonths: number[] = tour.available_months ?? [1,2,3,4,5,6,7,8,9,10,11,12];
  if (!availableMonths.includes(month)) {
    return { ok: false, reason: 'El tour no opera en ese mes' };
  }

  const [blackoutsRes, tourBlackoutsRes] = await Promise.all([
    supabase
      .from('recurring_blackouts')
      .select('month, day')
      .eq('active', true)
      .or(`tour_slug.is.null,tour_slug.eq.${tourSlug}`),
    supabase
      .from('tour_blackout_dates')
      .select('date')
      .or(`tour_slug.is.null,tour_slug.eq.${tourSlug}`)
      .eq('date', dateStr),
  ]);

  if ((blackoutsRes.data ?? []).some(b => b.month === month && b.day === day)) {
    return { ok: false, reason: 'Fecha bloqueada (feriado)' };
  }
  if ((tourBlackoutsRes.data ?? []).length > 0) {
    return { ok: false, reason: 'Fecha bloqueada' };
  }

  if (enforceCutoff) {
    const now = nowInSantiago();
    const todayStr    = now.toISOString().slice(0, 10);
    const tomorrow     = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    if (dateStr === todayStr) {
      return { ok: false, reason: 'No se aceptan reservas para el mismo día' };
    }

    if (dateStr === tomorrowStr) {
      const [cutoffH, cutoffM] = (tour.booking_cutoff_time ?? '20:00').split(':').map(Number);
      const pastCutoff = now.getHours() > cutoffH || (now.getHours() === cutoffH && now.getMinutes() >= cutoffM);
      if (pastCutoff) {
        return { ok: false, reason: 'Ya pasó la hora límite para reservar esta fecha' };
      }
    }
  }

  return { ok: true };
}

export async function getAvailableVans(date: string): Promise<number> {
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

/**
 * Libera el cupo que una reserva había ocupado en su tour_instance (pago rechazado,
 * hold vencido, o cancelación). Si la instancia queda en 0 pax y aún no fue confirmada,
 * se cancela para no seguir bloqueando la van ese día.
 */
export async function releaseInstanceCapacity(tourInstanceId: string, pax: number): Promise<void> {
  const { data: inst } = await supabase
    .from('tour_instances')
    .select('current_pax, status')
    .eq('id', tourInstanceId)
    .single();

  if (!inst) return;

  const newPax = Math.max(0, inst.current_pax - pax);
  const update: Record<string, unknown> = { current_pax: newPax };

  if (newPax === 0 && inst.status === 'forming') {
    update.status = 'cancelled';
  }

  await supabase.from('tour_instances').update(update).eq('id', tourInstanceId);
}

/**
 * Cancela reservas cuyo hold de pago venció sin confirmarse (cliente abandonó el
 * checkout de MercadoPago) y libera el cupo que ocupaban. Se ejecuta de forma
 * perezosa —en cada intento de reserva y en cada consulta de disponibilidad— en
 * vez de depender de un cron de alta frecuencia (el plan free de Vercel solo
 * permite crons una vez al día).
 */
export async function sweepExpiredHolds(): Promise<number> {
  const nowIso = new Date().toISOString();

  const { data: expired } = await supabase
    .from('bookings')
    .select('id, tour_instance_id, pax')
    .in('status', ['pending_payment', 'waiting_min'])
    .is('mp_payment_id', null)
    .not('reserved_until', 'is', null)
    .lt('reserved_until', nowIso);

  if (!expired || expired.length === 0) return 0;

  for (const b of expired) {
    await supabase
      .from('bookings')
      .update({
        status:              'cancelled',
        cancelled_at:        nowIso,
        cancellation_reason: 'payment_timeout',
        cancellation_by:     'system',
      })
      .eq('id', b.id);

    if (b.tour_instance_id) {
      await releaseInstanceCapacity(b.tour_instance_id, b.pax);
    }
  }

  return expired.length;
}

export async function getPaymentHoldMinutes(): Promise<number> {
  const { data } = await supabase
    .from('config')
    .select('value')
    .eq('key', 'payment_hold_minutes')
    .maybeSingle();
  const minutes = Number(data?.value);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 20;
}

export function generateBookingCode(year: number, seq: number): string {
  return `CC-${year}-${String(seq).padStart(4, '0')}`;
}

export function generateCancellationToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

type InstanceResult = { instanceId: string; error?: undefined } | { instanceId?: undefined; error: string };

const MAX_RACE_RETRIES = 3;

/**
 * Resuelve a qué tour_instance se asigna una reserva, verificando cupo real.
 * Tour grupal: suma pax a una instancia existente con espacio, o crea una nueva (sin redistribuir — eso ocurre en el cron de las 20:00).
 * Tour privado: siempre requiere una van nueva.
 *
 * Dos mitigaciones contra condiciones de carrera (dos reservas simultáneas para
 * el mismo cupo, ej. el último asiento de una van):
 * 1. Sumar pax a una instancia existente usa un UPDATE atómico con guarda
 *    (`current_pax <= 9 - pax`) en vez de leer-y-luego-escribir. Si pierde la
 *    carrera, reintenta recalculando desde cero (hasta MAX_RACE_RETRIES veces).
 * 2. Crear una instancia nueva (van nueva) se valida DESPUÉS de insertar: si la
 *    inserción hizo que se exceda la cantidad de vans disponibles ese día
 *    (porque otra request insertó al mismo tiempo), se revierte el insert.
 */
export async function resolveTourInstance(
  tourSlug: string,
  tourDate: string,
  bookingType: 'private' | 'group',
  pax: number,
  attempt = 0
): Promise<InstanceResult> {
  if (attempt === 0) await sweepExpiredHolds();

  if (attempt > MAX_RACE_RETRIES) {
    return { error: 'No se pudo confirmar el cupo, por favor intenta nuevamente' };
  }

  if (bookingType === 'group') {
    const { data: groupInstances } = await supabase
      .from('tour_instances')
      .select('id, current_pax')
      .eq('tour_slug', tourSlug)
      .eq('date', tourDate)
      .eq('booking_type', 'group')
      .in('status', ['forming', 'confirmed']);

    const instances    = groupInstances ?? [];
    const currentTotal = instances.reduce((sum, i) => sum + i.current_pax, 0);
    const freeVans      = await getAvailableVans(tourDate);
    const maxCapacity   = (instances.length + freeVans) * 9;

    if (currentTotal + pax > maxCapacity) {
      return { error: 'No hay cupos disponibles para esta fecha' };
    }

    const fittingInstance = instances.find(i => i.current_pax + pax <= 9);

    if (fittingInstance) {
      const { data: updated } = await supabase
        .from('tour_instances')
        .update({ current_pax: fittingInstance.current_pax + pax })
        .eq('id', fittingInstance.id)
        .lte('current_pax', 9 - pax)
        .select('id')
        .maybeSingle();

      if (updated) return { instanceId: updated.id };
      // Otra reserva ocupó el cupo justo antes — recalcular desde cero
      return resolveTourInstance(tourSlug, tourDate, bookingType, pax, attempt + 1);
    }

    const { data: newInstance, error } = await supabase
      .from('tour_instances')
      .insert({
        tour_slug:    tourSlug,
        date:         tourDate,
        booking_type: 'group',
        current_pax:  pax,
        max_pax:      9,
        status:       'forming',
      })
      .select('id')
      .single();
    if (error || !newInstance) return { error: 'Failed to create tour instance' };

    if (await getAvailableVans(tourDate) < 0) {
      await supabase.from('tour_instances').delete().eq('id', newInstance.id);
      return { error: 'No hay cupos disponibles para esta fecha' };
    }
    return { instanceId: newInstance.id };
  }

  // Tour privado: siempre necesita van nueva
  const freeVans = await getAvailableVans(tourDate);
  if (freeVans <= 0) {
    return { error: 'No hay disponibilidad para esta fecha. Por favor elige otra fecha.' };
  }
  const { data: newInstance, error } = await supabase
    .from('tour_instances')
    .insert({
      tour_slug:    tourSlug,
      date:         tourDate,
      booking_type: bookingType,
      current_pax:  pax,
      max_pax:      9,
      status:       'forming',
    })
    .select('id')
    .single();
  if (error || !newInstance) return { error: 'Failed to create tour instance' };

  if (await getAvailableVans(tourDate) < 0) {
    await supabase.from('tour_instances').delete().eq('id', newInstance.id);
    return { error: 'No hay disponibilidad para esta fecha. Por favor elige otra fecha.' };
  }
  return { instanceId: newInstance.id };
}
