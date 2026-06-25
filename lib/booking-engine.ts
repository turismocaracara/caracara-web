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
 * Igual que releaseInstanceCapacity, pero para una reserva completa — libera la
 * van principal y, si el grupo se repartió en 2 vans (>9 pax), también la
 * secundaria. Usar esta función en vez de releaseInstanceCapacity directamente
 * en cualquier lugar que cancele/libere una reserva grupal, para no dejar cupo
 * fantasma ocupado en la segunda van cuando corresponde liberarla.
 */
export async function releaseBookingCapacity(booking: {
  tour_instance_id: string | null;
  secondary_instance_id?: string | null;
  secondary_pax?: number | null;
  pax: number;
}): Promise<void> {
  if (!booking.tour_instance_id) return;
  const primaryPax = booking.secondary_instance_id ? booking.pax - (booking.secondary_pax ?? 0) : booking.pax;
  await releaseInstanceCapacity(booking.tour_instance_id, primaryPax);
  if (booking.secondary_instance_id && booking.secondary_pax) {
    await releaseInstanceCapacity(booking.secondary_instance_id, booking.secondary_pax);
  }
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
    .select('id, tour_instance_id, secondary_instance_id, secondary_pax, pax')
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
      await releaseBookingCapacity(b);
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

/**
 * Determina si una reserva representa plata realmente recibida — para reportes
 * financieros. 'confirmed' siempre implica pago (online vía webhook, crédito que
 * cubre el 100%, o entrada manual de un admin que coordinó el pago fuera del
 * sistema). 'waiting_min' es ambiguo para tours grupales: el mismo estado se usa
 * tanto recién creada (sin pagar aún) como ya pagada y esperando el mínimo de
 * pax — por eso se exige evidencia de pago (mp_payment_id, crédito aplicado, o
 * que haya sido ingresada manualmente por el equipo). 'pending_payment' y el
 * resto de estados nunca cuentan como ingreso.
 */
export function isBookingPaid(b: {
  status: string;
  source?: string | null;
  mp_payment_id?: string | null;
  credit_applied?: number | null;
}): boolean {
  if (b.status === 'confirmed') return true;
  if (b.status === 'waiting_min') {
    return b.source === 'manual' || !!b.mp_payment_id || (b.credit_applied ?? 0) > 0;
  }
  return false;
}

export function generateCancellationToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

interface PackItem { bookingId: string | null; pax: number; currentInstanceId: string | null; }
interface Bin { pax: number; items: PackItem[]; }

/**
 * Cuando un grupo nuevo no cabe en ninguna instancia 'forming' existente ni hay van
 * libre para abrir una nueva, intenta reempaquetar los grupos YA asignados (cada
 * booking es la unidad indivisible) junto con el nuevo, para ver si consolidándolos
 * en menos vans se libera espacio. Ej: Van1=[4], Van2=[5] (9 en total, cabrían juntos)
 * + nuevo grupo de 6 → repacking junta [4,5] en una van y deja la otra libre para el 6.
 * Sin esto, esa reserva se rechazaría aunque sí hay espacio combinado.
 *
 * Usa first-fit-decreasing (suficiente dado el tamaño chico del problema: pocos
 * grupos, máx. 9 pax por van) en vez de buscar la partición óptima exacta.
 *
 * No corre dentro de una transacción de Postgres (igual que el resto de este
 * archivo) — el riesgo de carrera es aceptable porque esta ruta solo se activa
 * cuando ya falló el camino rápido (sin cupo directo ni van libre), un caso poco
 * frecuente dado el volumen de este negocio.
 */
async function tryRebalanceGroupInstances(
  tourSlug: string,
  tourDate: string,
  newPax: number,
  maxBins: number
): Promise<{ instanceId: string } | null> {
  const { data: instances } = await supabase
    .from('tour_instances')
    .select('id, bookings!tour_instance_id ( id, pax, status, secondary_instance_id )')
    .eq('tour_slug', tourSlug)
    .eq('date', tourDate)
    .eq('booking_type', 'group')
    .eq('status', 'forming');

  const existingInstances = (instances ?? []) as unknown as {
    id: string; bookings: { id: string; pax: number; status: string; secondary_instance_id: string | null }[] | null;
  }[];

  // Una reserva dividida en 2 vans (>9 pax) ocupa un chunk en esta instancia y
  // otro en otra distinta — reempaquetarla aquí con su pax TOTAL la trataría
  // como si necesitara un solo van de ese tamaño, lo que nunca cabe (>9) y
  // arruinaría el resultado. Es un caso rarísimo (requiere una reserva >9 pax Y
  // que el camino rápido ya haya fallado); ante esa combinación, simplemente no
  // se intenta reempaquetar en vez de manejarlo mal.
  const hasSplitBooking = existingInstances.some(inst =>
    (inst.bookings ?? []).some(b => b.status === 'waiting_min' && b.secondary_instance_id)
  );
  if (hasSplitBooking) return null;

  const items: PackItem[] = existingInstances.flatMap(inst =>
    (inst.bookings ?? [])
      .filter(b => b.status === 'waiting_min')
      .map(b => ({ bookingId: b.id, pax: b.pax, currentInstanceId: inst.id }))
  );
  items.push({ bookingId: null, pax: newPax, currentInstanceId: null });
  items.sort((a, b) => b.pax - a.pax);

  const bins: Bin[] = [];
  for (const item of items) {
    const fitting = bins.find(bin => bin.pax + item.pax <= 9);
    if (fitting) {
      fitting.pax += item.pax;
      fitting.items.push(item);
    } else if (bins.length < maxBins) {
      bins.push({ pax: item.pax, items: [item] });
    } else {
      return null; // no existe una repartición válida dentro de los vans disponibles
    }
  }

  // Aplicar: reutilizar instancias existentes para los primeros bins, crear nuevas
  // para el resto, mover los bookings que cambiaron de instancia, y cerrar las
  // instancias existentes que quedaron sin reservas.
  let newPaxInstanceId = '';
  const usedExistingIds = new Set<string>();

  for (let i = 0; i < bins.length; i++) {
    const bin = bins[i];
    let instanceId: string;

    if (i < existingInstances.length) {
      instanceId = existingInstances[i].id;
      usedExistingIds.add(instanceId);
    } else {
      const { data: created, error } = await supabase
        .from('tour_instances')
        .insert({ tour_slug: tourSlug, date: tourDate, booking_type: 'group', current_pax: 0, max_pax: 9, status: 'forming' })
        .select('id')
        .single();
      if (error || !created) return null;
      instanceId = created.id;
    }

    for (const item of bin.items) {
      if (item.bookingId === null) {
        newPaxInstanceId = instanceId;
      } else if (item.currentInstanceId !== instanceId) {
        await supabase.from('bookings').update({ tour_instance_id: instanceId }).eq('id', item.bookingId);
      }
    }

    await supabase.from('tour_instances').update({ current_pax: bin.pax }).eq('id', instanceId);
  }

  // Instancias existentes que ya no recibieron ningún grupo tras el reempaquetado
  for (const inst of existingInstances) {
    if (!usedExistingIds.has(inst.id)) {
      await supabase.from('tour_instances').update({ current_pax: 0, status: 'cancelled' }).eq('id', inst.id);
    }
  }

  return { instanceId: newPaxInstanceId };
}

type InstanceResult =
  | { instanceId: string; secondaryInstanceId?: string; secondaryPax?: number; error?: undefined }
  | { instanceId?: undefined; error: string };

const MAX_RACE_RETRIES = 3;

interface VanSlot { instanceId?: string; freeCap: number; }

/**
 * Un grupo de más de 9 pax es indivisible como EXPERIENCIA (viajan juntos al mismo
 * tour) pero no como vehículo: se reparte en 2 vans, llenando la primera lo más
 * posible. El espacio que les sobra en la segunda van queda disponible para que
 * otros grupos independientes lo reserven (es la misma van compartida de siempre).
 * Por eso esto NO usa tryRebalanceGroupInstances (que trata cada booking como una
 * unidad indivisible de un solo van) — un booking >9 pax es, a efectos de cupo,
 * 2 unidades en 2 vans distintas desde el principio.
 */
async function resolveLargeGroupSplit(
  tourSlug: string,
  tourDate: string,
  pax: number,
  attempt = 0
): Promise<InstanceResult> {
  if (attempt > MAX_RACE_RETRIES) {
    return { error: 'No se pudo confirmar el cupo, por favor intenta nuevamente' };
  }

  const { data: groupInstances } = await supabase
    .from('tour_instances')
    .select('id, current_pax')
    .eq('tour_slug', tourSlug)
    .eq('date', tourDate)
    .eq('booking_type', 'group')
    .in('status', ['forming', 'confirmed']);

  const instances = groupInstances ?? [];
  const freeVans  = await getAvailableVans(tourDate);

  const slots: VanSlot[] = instances.map(i => ({ instanceId: i.id, freeCap: 9 - i.current_pax }));
  for (let i = 0; i < freeVans; i++) slots.push({ freeCap: 9 });
  slots.sort((a, b) => b.freeCap - a.freeCap);

  if (slots.length < 2 || slots[0].freeCap + slots[1].freeCap < pax) {
    return { error: 'No hay cupos disponibles para esta fecha (se necesitan 2 vans para más de 9 pasajeros)' };
  }

  const primaryPax   = Math.min(slots[0].freeCap, 9, pax);
  const secondaryPax = pax - primaryPax;
  if (secondaryPax <= 0 || secondaryPax > slots[1].freeCap) {
    return { error: 'No hay cupos disponibles para esta fecha (se necesitan 2 vans para más de 9 pasajeros)' };
  }

  async function claimSlot(slot: VanSlot, slotPax: number): Promise<string | null> {
    if (slot.instanceId) {
      const currentPaxBefore = 9 - slot.freeCap;
      const { data: updated } = await supabase
        .from('tour_instances')
        .update({ current_pax: currentPaxBefore + slotPax })
        .eq('id', slot.instanceId)
        .lte('current_pax', 9 - slotPax)
        .select('id')
        .maybeSingle();
      return updated?.id ?? null;
    }
    const { data: created, error } = await supabase
      .from('tour_instances')
      .insert({ tour_slug: tourSlug, date: tourDate, booking_type: 'group', current_pax: slotPax, max_pax: 9, status: 'forming' })
      .select('id')
      .single();
    return (!error && created) ? created.id : null;
  }

  const primaryInstanceId = await claimSlot(slots[0], primaryPax);
  if (!primaryInstanceId) {
    // otra reserva ocupó ese cupo justo antes — recalcular desde cero
    return resolveLargeGroupSplit(tourSlug, tourDate, pax, attempt + 1);
  }

  const secondaryInstanceId = await claimSlot(slots[1], secondaryPax);
  if (!secondaryInstanceId) {
    // revertir lo ya reservado en la primera van para no dejar cupo fantasma
    await releaseInstanceCapacity(primaryInstanceId, primaryPax);
    return resolveLargeGroupSplit(tourSlug, tourDate, pax, attempt + 1);
  }

  return { instanceId: primaryInstanceId, secondaryInstanceId, secondaryPax };
}

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

  // Grupo de más de 9 pax: viajan juntos al mismo tour pero necesitan 2 vans
  // (capacidad 9 cada una) — camino dedicado, ver resolveLargeGroupSplit.
  if (bookingType === 'group' && pax > 9) {
    return resolveLargeGroupSplit(tourSlug, tourDate, pax);
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

    // No cabe en ninguna instancia existente. Si no hay van libre para abrir una
    // nueva, antes de rechazar la reserva, intentar reempaquetar los grupos
    // 'forming' ya asignados — puede que consolidándolos en menos vans se libere
    // el espacio que este grupo necesita (ver tryRebalanceGroupInstances).
    if (freeVans <= 0) {
      const rebalanced = await tryRebalanceGroupInstances(tourSlug, tourDate, pax, instances.length);
      if (rebalanced) return rebalanced;
      return { error: 'No hay cupos disponibles para esta fecha' };
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
