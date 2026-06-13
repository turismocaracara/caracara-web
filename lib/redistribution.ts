import { supabase } from '@/lib/supabase';

// Encuentra la partición de grupos en vans que maximiza pax en van[0].
// Retorna assignment[i] = índice de van para el grupo i, o null si imposible.
export function findBestPartition(
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

export interface GroupBooking {
  id: string;
  tour_instance_id: string;
  pax: number;
}

export interface DistributionResult {
  // instance_id → array de booking_ids asignados
  vanAssignments: Record<string, string[]>;
  // instancias nuevas que hay que crear (índices que no tenían instancia previa)
  newInstancesNeeded: number;
  vanPax: number[];
}

// Distribuye los bookings de un tour+fecha entre las vans disponibles.
// Retorna la asignación óptima o null si es imposible (< minPax total).
export async function distributeGroups(
  tourSlug: string,
  tourDate: string,
  groupMinPax: number,
): Promise<{ success: boolean; totalPax: number; vans: number; error?: string }> {

  // 1. Obtener todas las instancias grupales activas para este tour+fecha
  const { data: instances } = await supabase
    .from('tour_instances')
    .select('id, current_pax')
    .eq('tour_slug', tourSlug)
    .eq('date', tourDate)
    .eq('booking_type', 'group')
    .in('status', ['forming', 'confirmed']);

  if (!instances || instances.length === 0) {
    return { success: false, totalPax: 0, vans: 0, error: 'sin_instancias' };
  }

  // 2. Obtener todos los bookings activos de esas instancias
  const instanceIds = instances.map(i => i.id);
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, tour_instance_id, pax')
    .in('tour_instance_id', instanceIds)
    .not('status', 'in', '("cancelled","refunded")');

  const groups = bookings ?? [];
  const totalPax = groups.reduce((sum, b) => sum + b.pax, 0);

  // 3. Verificar mínimo operacional
  if (totalPax < groupMinPax) {
    return { success: false, totalPax, vans: instances.length, error: 'min_no_alcanzado' };
  }

  // 4. Determinar cuántas vans se necesitan (máx 2)
  const numVans = Math.min(instances.length, 2);
  const groupPax = groups.map(b => b.pax);
  const assignment = findBestPartition(groupPax, numVans, 9, groupMinPax);

  if (!assignment) {
    return { success: false, totalPax, vans: numVans, error: 'sin_particion_valida' };
  }

  // 5. Calcular pax por van
  const vanPax = new Array(numVans).fill(0);
  for (let i = 0; i < groupPax.length; i++) vanPax[assignment[i]] += groupPax[i];

  // 6. Mover bookings que cambian de instancia
  const vanToInstance = instances.map(i => i.id);
  for (let i = 0; i < groups.length; i++) {
    const targetInstId = vanToInstance[assignment[i]];
    if (targetInstId && groups[i].tour_instance_id !== targetInstId) {
      await supabase
        .from('bookings')
        .update({ tour_instance_id: targetInstId })
        .eq('id', groups[i].id);
    }
  }

  // 7. Actualizar current_pax y confirmar instancias activas
  for (let v = 0; v < numVans; v++) {
    if (vanPax[v] > 0) {
      await supabase
        .from('tour_instances')
        .update({ current_pax: vanPax[v], status: 'confirmed' })
        .eq('id', vanToInstance[v]);
    }
  }

  // 8. Cancelar instancias que quedaron vacías tras la redistribución
  for (let v = numVans; v < instances.length; v++) {
    await supabase
      .from('tour_instances')
      .update({ status: 'cancelled' })
      .eq('id', instances[v].id);
  }

  // 9. Actualizar bookings a 'confirmed'
  await supabase
    .from('bookings')
    .update({ status: 'confirmed' })
    .in('tour_instance_id', instanceIds)
    .not('status', 'in', '("cancelled","refunded")');

  const usedVans = vanPax.filter(p => p > 0).length;
  console.log(`[redistrib] ${tourSlug} ${tourDate}: ${totalPax} pax → ${usedVans} van(s), dist: [${vanPax.join(', ')}]`);

  return { success: true, totalPax, vans: usedVans };
}
