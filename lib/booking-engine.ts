import { supabase } from './supabase';

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

export function generateBookingCode(year: number, seq: number): string {
  return `CC-${year}-${String(seq).padStart(4, '0')}`;
}

export function generateCancellationToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

type InstanceResult = { instanceId: string; error?: undefined } | { instanceId?: undefined; error: string };

/**
 * Resuelve a qué tour_instance se asigna una reserva, verificando cupo real.
 * Tour grupal: suma pax a una instancia existente con espacio, o crea una nueva (sin redistribuir — eso ocurre en el cron de las 20:00).
 * Tour privado: siempre requiere una van nueva.
 */
export async function resolveTourInstance(
  tourSlug: string,
  tourDate: string,
  bookingType: 'private' | 'group',
  pax: number
): Promise<InstanceResult> {
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
      await supabase
        .from('tour_instances')
        .update({ current_pax: fittingInstance.current_pax + pax })
        .eq('id', fittingInstance.id);
      return { instanceId: fittingInstance.id };
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
  return { instanceId: newInstance.id };
}
