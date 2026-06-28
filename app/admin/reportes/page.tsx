import { redirect } from 'next/navigation';
import { requireAdmin, getCurrentTeamMember, hasPermission } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';
import { isBookingPaid, sweepExpiredHolds } from '@/lib/booking-engine';
import AdminSidebar from '@/components/admin/AdminSidebar';
import ReportesManager, {
  type MonthlyRevenue,
  type TourMonthRevenue,
  type CostItemRow,
  type TourOption,
  type MonthlyAbandoned,
  type TourAbandoned,
  type AbandonedStage,
} from '@/components/admin/ReportesManager';

interface RawBooking {
  pax: number;
  total_amount: number | null;
  credit_applied: number | null;
  status: string;
  source: string | null;
  mp_payment_id: string | null;
  tour_instances:
    | { tour_slug: string; date: string; tours: { name_es: string } | { name_es: string }[] | null }
    | { tour_slug: string; date: string; tours: { name_es: string } | { name_es: string }[] | null }[]
    | null;
}

interface RawAbandonedBooking {
  total_amount: number | null;
  mp_preference_id: string | null;
  created_at: string;
  tour_instances:
    | { tour_slug: string; tours: { name_es: string } | { name_es: string }[] | null }
    | { tour_slug: string; tours: { name_es: string } | { name_es: string }[] | null }[]
    | null;
}

export default async function ReportesPage() {
  const user   = await requireAdmin();
  const member = await getCurrentTeamMember();
  if (!hasPermission(member, 'view_financials')) redirect('/admin');

  // Limpiar holds de pago vencidos antes de calcular ingresos — si no, una reserva
  // sin pagar que ya expiró pero todavía no fue barrida por el lazy-sweep se
  // contaría como ingreso real hasta que algo más dispare el sweep.
  await sweepExpiredHolds();

  const today      = new Date();
  const thisMonth  = today.toISOString().slice(0, 7);
  const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);

  const [bookingsRes, costItemsRes, toursRes, instancesRes, abandonedRes] = await Promise.all([
    supabase
      .from('bookings')
      .select(`
        pax, total_amount, credit_applied, status, source, mp_payment_id,
        tour_instances!tour_instance_id ( tour_slug, date, tours ( name_es ) )
      `)
      .not('status', 'in', '("cancelled","refunded")'),
    supabase.from('tour_cost_items').select('id, tour_slug, concept, amount_clp, unit').order('tour_slug'),
    supabase.from('tours').select('slug, name_es').eq('active', true).order('name_es'),
    supabase
      .from('tour_instances')
      .select('tour_slug, date')
      .in('status', ['confirmed', 'executed'])
      .gte('date', `${thisMonth}-01`),

    // Ventas no concretadas — holds de pago vencidos sin pagar (ver sweepExpiredHolds)
    supabase
      .from('bookings')
      .select(`
        total_amount, mp_preference_id, created_at,
        tour_instances!tour_instance_id ( tour_slug, tours ( name_es ) )
      `)
      .eq('cancellation_reason', 'payment_timeout')
      .gte('created_at', sixMonthsAgo.toISOString()),
  ]);

  const bookings = (bookingsRes.data ?? []) as unknown as RawBooking[];
  const abandonedBookings = (abandonedRes.data ?? []) as unknown as RawAbandonedBooking[];

  // ─── Ingresos mensuales (últimos 6 meses) ───
  const monthlyMap = new Map<string, { revenue: number; pax: number; count: number }>();
  for (let i = 0; i < 6; i++) {
    const d = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth() + i, 1);
    monthlyMap.set(d.toISOString().slice(0, 7), { revenue: 0, pax: 0, count: 0 });
  }

  // ─── Este mes por tour ───
  const tourMonthMap = new Map<string, { tour_name: string; revenue: number; pax: number; count: number }>();

  for (const b of bookings) {
    if (!isBookingPaid(b)) continue;
    const inst = Array.isArray(b.tour_instances) ? b.tour_instances[0] : b.tour_instances;
    if (!inst) continue;
    const tour = Array.isArray(inst.tours) ? inst.tours[0] : inst.tours;
    const month = inst.date.slice(0, 7);
    // Ingreso real = lo que efectivamente entró como plata nueva, sin contar la
    // parte cubierta con crédito (esa plata ya había entrado en una reserva anterior).
    const amount = (b.total_amount ?? 0) - (b.credit_applied ?? 0);

    if (monthlyMap.has(month)) {
      const m = monthlyMap.get(month)!;
      m.revenue += amount;
      m.pax     += b.pax;
      m.count   += 1;
    }

    if (month === thisMonth) {
      const key = inst.tour_slug;
      const existing = tourMonthMap.get(key) ?? { tour_name: tour?.name_es ?? key, revenue: 0, pax: 0, count: 0 };
      existing.revenue += amount;
      existing.pax     += b.pax;
      existing.count   += 1;
      tourMonthMap.set(key, existing);
    }
  }

  const instanceCountByTour = new Map<string, number>();
  for (const inst of instancesRes.data ?? []) {
    instanceCountByTour.set(inst.tour_slug, (instanceCountByTour.get(inst.tour_slug) ?? 0) + 1);
  }

  const monthlyRevenue: MonthlyRevenue[] = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, ...v }));

  const tourMonthRevenue: TourMonthRevenue[] = Array.from(tourMonthMap.entries()).map(([slug, v]) => ({
    tour_slug: slug,
    tour_name: v.tour_name,
    revenue:   v.revenue,
    pax:       v.pax,
    count:     v.count,
    instances: instanceCountByTour.get(slug) ?? 0,
  }));

  const costItems: CostItemRow[] = (costItemsRes.data ?? []) as CostItemRow[];
  const tours:     TourOption[]  = (toursRes.data ?? []) as TourOption[];

  // ─── Ventas no concretadas — por mes (últimos 6), por tour (este mes) y por
  // etapa en la que se quedó (antes/después de llegar a MercadoPago) ───
  const abandonedMonthlyMap = new Map<string, { count: number; amount: number }>();
  for (let i = 0; i < 6; i++) {
    const d = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth() + i, 1);
    abandonedMonthlyMap.set(d.toISOString().slice(0, 7), { count: 0, amount: 0 });
  }

  const abandonedTourMap = new Map<string, { tour_name: string; count: number; amount: number }>();
  let abandonedBeforeMp = { count: 0, amount: 0 };
  let abandonedAtMp     = { count: 0, amount: 0 };

  for (const b of abandonedBookings) {
    const month = b.created_at.slice(0, 7);
    const amount = b.total_amount ?? 0;

    if (abandonedMonthlyMap.has(month)) {
      const m = abandonedMonthlyMap.get(month)!;
      m.count  += 1;
      m.amount += amount;
    }

    if (month === thisMonth) {
      const inst = Array.isArray(b.tour_instances) ? b.tour_instances[0] : b.tour_instances;
      if (inst) {
        const tour = Array.isArray(inst.tours) ? inst.tours[0] : inst.tours;
        const key = inst.tour_slug;
        const existing = abandonedTourMap.get(key) ?? { tour_name: tour?.name_es ?? key, count: 0, amount: 0 };
        existing.count  += 1;
        existing.amount += amount;
        abandonedTourMap.set(key, existing);
      }

      if (b.mp_preference_id) {
        abandonedAtMp = { count: abandonedAtMp.count + 1, amount: abandonedAtMp.amount + amount };
      } else {
        abandonedBeforeMp = { count: abandonedBeforeMp.count + 1, amount: abandonedBeforeMp.amount + amount };
      }
    }
  }

  const monthlyAbandoned: MonthlyAbandoned[] = Array.from(abandonedMonthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, ...v }));

  const tourAbandoned: TourAbandoned[] = Array.from(abandonedTourMap.entries())
    .map(([slug, v]) => ({ tour_slug: slug, ...v }))
    .sort((a, b) => b.count - a.count);

  const abandonedStages: AbandonedStage[] = [
    { stage: 'before_mp', label: 'No llegó a MercadoPago', ...abandonedBeforeMp },
    { stage: 'at_mp',     label: 'Llegó a MercadoPago y no pagó', ...abandonedAtMp },
  ];

  return (
    <div className="flex min-h-screen">
      <AdminSidebar userEmail={user.email ?? ''} />
      <main className="flex-1 ml-56 p-6 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Reportes financieros</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Ingresos por reservas y rentabilidad estimada por tour
            {costItemsRes.error?.message.includes('schema cache') && (
              <span className="block text-red-500 mt-1">
                Falta crear la tabla tour_cost_items — revisa el SQL indicado más abajo.
              </span>
            )}
          </p>
        </div>

        {costItemsRes.error?.message.includes('schema cache') ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-800">
            <p className="font-semibold mb-2">La tabla <code>tour_cost_items</code> no existe aún.</p>
            <p className="mb-3">Ejecuta este SQL en Supabase:</p>
            <pre className="bg-white border border-amber-100 rounded-lg p-3 text-xs overflow-auto font-mono whitespace-pre-wrap">{`create table if not exists public.tour_cost_items (
  id          uuid primary key default gen_random_uuid(),
  tour_slug   text not null references public.tours(slug) on delete cascade,
  concept     text not null,
  amount_clp  int not null,
  unit        text not null check (unit in ('per_person', 'per_van', 'fixed')),
  created_at  timestamptz not null default now()
);`}</pre>
          </div>
        ) : (
          <ReportesManager
            monthlyRevenue={monthlyRevenue}
            tourMonthRevenue={tourMonthRevenue}
            costItems={costItems}
            tours={tours}
            monthlyAbandoned={monthlyAbandoned}
            tourAbandoned={tourAbandoned}
            abandonedStages={abandonedStages}
          />
        )}
      </main>
    </div>
  );
}
