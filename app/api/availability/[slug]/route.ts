import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sweepExpiredHolds } from '@/lib/booking-engine';

export type AvailabilityStatus = 'available' | 'forming' | 'full' | 'blocked' | 'past';

export interface DayAvailability {
  status: AvailabilityStatus;
  spots: number;           // cupos para un grupo nuevo
  pax_booked: number;      // pax ya reservados ese día
  group_confirmed?: boolean; // forming + grupo ya alcanzó el mínimo para realizarse
}

interface RouteParams {
  params: { slug: string };
}

// Santiago, Chile: UTC-3 (verano) / UTC-4 (invierno)
// Usamos la API de Intl para obtener la hora local correcta
function nowInSantiago(): Date {
  const now = new Date();
  const santiagoParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now);

  const get = (type: string) => santiagoParts.find(p => p.type === type)?.value ?? '0';
  return new Date(
    Number(get('year')), Number(get('month')) - 1, Number(get('day')),
    Number(get('hour')), Number(get('minute'))
  );
}

function dateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { slug } = params;

  // slug se interpola directo en un filtro .or() de PostgREST más abajo — sin esta
  // validación, una coma o paréntesis en la URL podría inyectar condiciones de filtro.
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: 'Tour no encontrado' }, { status: 404 });
  }

  const monthParam = req.nextUrl.searchParams.get('month'); // formato: YYYY-MM

  // Validar parámetro month
  if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
    return NextResponse.json(
      { error: 'Parámetro month requerido en formato YYYY-MM' },
      { status: 400 }
    );
  }

  const [yearStr, monthStr] = monthParam.split('-');
  const year  = Number(yearStr);
  const month = Number(monthStr); // 1-12

  if (month < 1 || month > 12) {
    return NextResponse.json({ error: 'Mes inválido' }, { status: 400 });
  }

  // Liberar holds de pago vencidos antes de calcular cupos, para no mostrar
  // como "ocupado" un cupo que en realidad fue abandonado en el checkout.
  await sweepExpiredHolds();

  // ─── Consultas paralelas a Supabase ────────────────────────────────────────
  const startDate = dateStr(year, month, 1);
  const endDate   = dateStr(year, month, daysInMonth(year, month));

  const [tourRes, blackoutsRes, tourBlackoutsRes, vanBlocksRes, instancesRes, allInstancesRes, vansRes] =
    await Promise.all([
      // Tour info
      supabase
        .from('tours')
        .select('slug, name_es, available_months, group_min_pax, booking_cutoff_time, has_picnic, active')
        .eq('slug', slug)
        .single(),

      // Feriados recurrentes (globales o para este tour)
      supabase
        .from('recurring_blackouts')
        .select('month, day, tour_slug')
        .eq('active', true)
        .or(`tour_slug.is.null,tour_slug.eq.${slug}`),

      // Fechas bloqueadas específicas
      supabase
        .from('tour_blackout_dates')
        .select('date, tour_slug')
        .or(`tour_slug.is.null,tour_slug.eq.${slug}`)
        .gte('date', startDate)
        .lte('date', endDate),

      // Vans bloqueadas (mantención)
      supabase
        .from('van_blocks')
        .select('van_id, date')
        .gte('date', startDate)
        .lte('date', endDate),

      // Instancias de ESTE tour en el mes (para lógica grupal y forming)
      supabase
        .from('tour_instances')
        .select('id, date, booking_type, current_pax, max_pax, status, van_id')
        .eq('tour_slug', slug)
        .in('status', ['forming', 'confirmed'])
        .gte('date', startDate)
        .lte('date', endDate),

      // TODAS las instancias del mes (para contar vans usadas globalmente)
      supabase
        .from('tour_instances')
        .select('id, date')
        .in('status', ['forming', 'confirmed'])
        .gte('date', startDate)
        .lte('date', endDate),

      // Total de vans activas
      supabase
        .from('vans')
        .select('id, capacity')
        .eq('active', true),
    ]);

  if (tourRes.error || !tourRes.data) {
    return NextResponse.json({ error: 'Tour no encontrado' }, { status: 404 });
  }

  const tour      = tourRes.data;
  const blackouts = blackoutsRes.data ?? [];
  const tourBlackouts = new Set(
    (tourBlackoutsRes.data ?? []).map(b => b.date.slice(0, 10))
  );
  const vanBlocks   = vanBlocksRes.data ?? [];
  const instances   = instancesRes.data ?? [];
  const allInstances = allInstancesRes.data ?? [];
  const allVans     = vansRes.data ?? [];
  const totalVans   = allVans.length;

  if (!tour.active) {
    return NextResponse.json({ error: 'Tour inactivo' }, { status: 404 });
  }

  // Meses en que opera este tour (1-12)
  const availableMonths: number[] = tour.available_months ?? [1,2,3,4,5,6,7,8,9,10,11,12];

  // Hora actual en Santiago
  const now = nowInSantiago();
  const todayStr = dateStr(now.getFullYear(), now.getMonth() + 1, now.getDate());

  // Cutoff: hora límite para reservar (default 20:00)
  const [cutoffH, cutoffM] = (tour.booking_cutoff_time ?? '20:00').split(':').map(Number);

  // Sets para lookups rápidos
  const blackoutSet = new Set(
    blackouts.map(b => `${String(b.month).padStart(2, '0')}-${String(b.day).padStart(2, '0')}`)
  );

  // Van blocks por fecha: fecha → Set<van_id>
  const vanBlocksByDate = new Map<string, Set<string>>();
  for (const vb of vanBlocks) {
    const d = vb.date.slice(0, 10);
    if (!vanBlocksByDate.has(d)) vanBlocksByDate.set(d, new Set());
    vanBlocksByDate.get(d)!.add(vb.van_id);
  }

  // Instancias de este tour por fecha
  const instancesByDate = new Map<string, typeof instances>();
  for (const inst of instances) {
    const d = inst.date.slice(0, 10);
    if (!instancesByDate.has(d)) instancesByDate.set(d, []);
    instancesByDate.get(d)!.push(inst);
  }

  // Todas las instancias por fecha (para contar vans usadas globalmente)
  const allInstancesByDate = new Map<string, number>();
  for (const inst of allInstances) {
    const d = inst.date.slice(0, 10);
    allInstancesByDate.set(d, (allInstancesByDate.get(d) ?? 0) + 1);
  }

  // ─── Calcular disponibilidad por día ──────────────────────────────────────
  const availability: Record<string, DayAvailability> = {};
  const totalDays = daysInMonth(year, month);

  for (let day = 1; day <= totalDays; day++) {
    const ds = dateStr(year, month, day);

    // 1. Pasado
    if (ds < todayStr) {
      availability[ds] = { status: 'past', spots: 0, pax_booked: 0 };
      continue;
    }

    // 2. Hoy: bloqueado por defecto (sin reservas el mismo día)
    if (ds === todayStr) {
      availability[ds] = { status: 'blocked', spots: 0, pax_booked: 0 };
      continue;
    }

    // 3. Cutoff: si es mañana y ya pasó la hora límite
    if (ds === dateStr(now.getFullYear(), now.getMonth() + 1, now.getDate() + 1)) {
      const pastCutoff = now.getHours() > cutoffH ||
        (now.getHours() === cutoffH && now.getMinutes() >= cutoffM);
      if (pastCutoff) {
        availability[ds] = { status: 'blocked', spots: 0, pax_booked: 0 };
        continue;
      }
    }

    // 3. Mes no disponible para este tour
    if (!availableMonths.includes(month)) {
      availability[ds] = { status: 'blocked', spots: 0, pax_booked: 0 };
      continue;
    }

    // 4. Feriado recurrente
    const mmdd = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (blackoutSet.has(mmdd)) {
      availability[ds] = { status: 'blocked', spots: 0, pax_booked: 0 };
      continue;
    }

    // 5. Fecha bloqueada explícitamente
    if (tourBlackouts.has(ds)) {
      availability[ds] = { status: 'blocked', spots: 0, pax_booked: 0 };
      continue;
    }

    // 6. Calcular vans disponibles ese día
    const blockedVanIds = vanBlocksByDate.get(ds) ?? new Set<string>();
    const availableVans = totalVans - blockedVanIds.size;

    if (availableVans === 0) {
      availability[ds] = { status: 'blocked', spots: 0, pax_booked: 0 };
      continue;
    }

    // 7. Calcular vans realmente libres (considerando todos los tours ese día)
    const allVansUsedToday = allInstancesByDate.get(ds) ?? 0;
    const freeVans = availableVans - allVansUsedToday;

    // Instancias de ESTE tour ese día (para lógica grupal)
    const dayInstances = instancesByDate.get(ds) ?? [];
    const totalPaxBooked = dayInstances.reduce((sum, i) => sum + (i.current_pax ?? 0), 0);

    // Cupos = vans libres × capacidad + espacio restante en instancias grupales forming de este tour
    const formingGroupRemaining = dayInstances
      .filter(i => i.booking_type === 'group' && i.status === 'forming')
      .reduce((sum, i) => sum + Math.max(0, (i.max_pax ?? 9) - (i.current_pax ?? 0)), 0);
    const spots = Math.max(0, freeVans * 9 + formingGroupRemaining);

    if (spots === 0) {
      availability[ds] = { status: 'full', spots: 0, pax_booked: totalPaxBooked };
      continue;
    }

    // Si no hay vans libres pero quedan cupos en instancia grupal → forming
    // (los cupos restantes son solo para grupo, no para privado)
    const hasGroupRemaining = formingGroupRemaining > 0;

    if (freeVans === 0 && hasGroupRemaining) {
      const groupMinPax: number = tour.group_min_pax ?? 4;
      const groupPaxBooked = dayInstances
        .filter(i => i.booking_type === 'group')
        .reduce((sum, i) => sum + (i.current_pax ?? 0), 0);
      const group_confirmed = groupPaxBooked >= groupMinPax;
      availability[ds] = { status: 'forming', spots, pax_booked: totalPaxBooked, group_confirmed };
    } else {
      availability[ds] = { status: 'available', spots, pax_booked: totalPaxBooked };
    }
  }

  return NextResponse.json({
    tour: {
      slug:             tour.slug,
      name_es:          tour.name_es,
      available_months: availableMonths,
      group_min_pax:    tour.group_min_pax ?? 4,
    },
    month:        monthParam,
    availability,
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  });
}
