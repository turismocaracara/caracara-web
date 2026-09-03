import { redirect } from 'next/navigation';
import { requireAdmin, getCurrentTeamMember, hasPermission, isOpsViewer } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';
import { isBookingPaid, sweepExpiredHolds } from '@/lib/booking-engine';
import { getSeason } from '@/lib/pickup-route';
import AdminSidebar from '@/components/admin/AdminSidebar';
import NewBookingButton from '@/components/admin/NewBookingButton';
import RecentBookingsTable, { type RecentBookingRow } from '@/components/admin/RecentBookingsTable';
import type { AdminTourOption } from '@/components/admin/ManualBookingForm';
import type { Agency } from '@/components/admin/AgencyRegistrationModal';

interface TodayInstance {
  id: string;
  tour_slug: string;
  date: string;
  booking_type: string;
  current_pax: number;
  status: string;
  pickup_time?: string;
  tours: { name_es: string } | null;
  bookings: { id: string; booking_code: string; pax: number; status: string }[] | null;
}

interface UpcomingInstance {
  id: string;
  tour_slug: string;
  date: string;
  booking_type: string;
  current_pax: number;
  status: string;
  tours: { name_es: string } | null;
}


function fmtCLP(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  reserved:        { label: 'Reservado',   cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  pending_payment: { label: 'Pago pend.',  cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  waiting_min:     { label: 'En espera',   cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  confirmed:       { label: 'Confirmada',  cls: 'bg-green-50 text-green-700 border-green-200' },
  cancelled:       { label: 'Cancelada',   cls: 'bg-red-50 text-red-600 border-red-200' },
  refunded:        { label: 'Devuelta',    cls: 'bg-gray-50 text-gray-500 border-gray-200' },
  forming:         { label: 'Formando',    cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
};

export default async function AdminDashboard() {
  const user   = await requireAdmin();
  const member = await getCurrentTeamMember();
  if (!isOpsViewer(member)) redirect('/admin/asignaciones');

  await sweepExpiredHolds();

  const today      = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';
  const monthEnd   = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)
    .toISOString().slice(0, 10);

  // Próximos 7 días (mañana → +7)
  const todayDate    = new Date(today + 'T12:00:00');
  const endDate      = new Date(todayDate);
  endDate.setDate(endDate.getDate() + 7);
  const endDateStr   = endDate.toISOString().slice(0, 10);
  const tomorrowDate = new Date(todayDate);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr  = tomorrowDate.toISOString().slice(0, 10);

  const currentSeason = getSeason(today);
  const canCreateManual = hasPermission(member, 'manual_booking');

  const [
    todayInstancesRes,
    recentRes,
    statsRes,
    abandonedRes,
    upcomingRes,
    pendingRefundsRes,
    atRiskRes,
    schedulesRes,
    activeToursRes,
    agenciesRes,
  ] = await Promise.all([
    // Tours de hoy
    supabase
      .from('tour_instances')
      .select(`
        id, tour_slug, date, booking_type, current_pax, status,
        tours ( name_es ),
        bookings!tour_instance_id ( id, booking_code, pax, status )
      `)
      .eq('date', today)
      .neq('status', 'cancelled'),

    // Últimas 10 reservas
    supabase
      .from('bookings')
      .select(`
        id, booking_code, booking_type, pax, status, total_amount, created_at,
        tour_instances!tour_instance_id ( tour_slug, date, tours ( name_es ) ),
        clients ( name )
      `)
      .order('created_at', { ascending: false })
      .limit(10),

    // Métricas del mes
    supabase
      .from('bookings')
      .select('status, total_amount, credit_applied, source, mp_payment_id, pax')
      .gte('created_at', monthStart + 'T00:00:00')
      .lte('created_at', monthEnd + 'T23:59:59')
      .neq('status', 'cancelled'),

    // Ventas no concretadas del mes
    supabase
      .from('bookings')
      .select('total_amount, mp_preference_id')
      .eq('cancellation_reason', 'payment_timeout')
      .gte('created_at', monthStart + 'T00:00:00')
      .lte('created_at', monthEnd + 'T23:59:59'),

    // Próximos 7 días
    supabase
      .from('tour_instances')
      .select(`id, tour_slug, date, booking_type, current_pax, status, tours ( name_es )`)
      .gt('date', today)
      .lte('date', endDateStr)
      .neq('status', 'cancelled')
      .order('date'),

    // Devoluciones pendientes (solo pending_approval)
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('refund_status', 'pending_approval'),

    // Grupos en riesgo (forming, fechas futuras o hoy)
    supabase
      .from('tour_instances')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'forming')
      .gte('date', today),

    // Horarios de la temporada actual (para "Tours de hoy")
    supabase
      .from('tour_schedules')
      .select('tour_slug, pickup_time')
      .eq('season', currentSeason),

    // Tours activos para modal de nueva reserva
    supabase
      .from('tours')
      .select('slug, name_es, has_picnic, duration_hours')
      .eq('active', true)
      .order('name_es'),

    // Agencias registradas para autocomplete
    supabase
      .from('agencies')
      .select('id, fantasy_name, rut, razon_social, giro, address, comuna, city, billing_email, phone, contact_name')
      .order('fantasy_name'),
  ]);

  const todayInstances  = todayInstancesRes.data ?? [];
  const recentBookings  = recentRes.data ?? [];
  const monthData       = statsRes.data ?? [];
  const abandonedData   = abandonedRes.data ?? [];
  const upcomingData    = (upcomingRes.data ?? []) as unknown as UpcomingInstance[];
  const pendingRefunds  = pendingRefundsRes.count ?? 0;
  const atRiskCount     = atRiskRes.count ?? 0;
  const abandonedCount  = abandonedData.length;
  const abandonedAmount = abandonedData.reduce((s, b) => s + (b.total_amount ?? 0), 0);
  const activeTours = (activeToursRes.data ?? []) as AdminTourOption[];
  const agencies    = (agenciesRes.data ?? []) as Agency[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recentRows: RecentBookingRow[] = ((recentBookings) as unknown as Record<string, any>[]).map(b => {
    const inst   = Array.isArray(b.tour_instances) ? b.tour_instances[0] : b.tour_instances;
    const client = Array.isArray(b.clients)        ? b.clients[0]        : b.clients;
    return {
      id:           b.id           as string,
      booking_code: b.booking_code as string,
      booking_type: b.booking_type as string,
      pax:          b.pax          as number,
      status:       b.status       as string,
      tour_name:    (inst?.tours?.name_es ?? inst?.tour_slug ?? '—') as string,
      tour_date:    (inst?.date ?? '')                               as string,
      client_name:  (client?.name ?? null)                          as string | null,
    };
  });

  // Mapa tourSlug → pickup_time para "Tours de hoy"
  const scheduleMap: Record<string, string> = {};
  for (const s of schedulesRes.data ?? []) {
    if (s.tour_slug && s.pickup_time) {
      scheduleMap[s.tour_slug] = (s.pickup_time as string).slice(0, 5);
    }
  }

  // KPIs del mes
  const monthTotal = monthData
    .filter(isBookingPaid)
    .reduce((s, b) => s + (b.total_amount ?? 0) - (b.credit_applied ?? 0), 0);
  const monthPax     = monthData.reduce((s, b) => s + (b.pax ?? 0), 0);
  const monthCount   = monthData.length;
  const pendingCount = monthData.filter(b =>
    b.status === 'pending_payment' || b.status === 'waiting_min' || b.status === 'reserved'
  ).length;

  return (
    <div className="flex min-h-screen">
      <AdminSidebar userEmail={user.email ?? ''} />
      <main className="flex-1 ml-56 p-6 max-w-5xl">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          {canCreateManual && <NewBookingButton tours={activeTours} agencies={agencies} />}
        </div>

        {/* KPIs del mes */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <StatCard label="Reservas del mes"        value={String(monthCount)}                           href="/admin/reservas" />
          <StatCard label="Pasajeros del mes"       value={String(monthPax)}                            href="/admin/pasajeros" />
          <StatCard label="Ingresos del mes"        value={monthTotal > 0 ? fmtCLP(monthTotal) : '—'}  href="/admin/reportes" />
          <StatCard label="Pendientes de confirmar" value={String(pendingCount)} highlight={pendingCount > 0} href="/admin/reservas?status=waiting_min" />
        </div>

        {/* KPIs de alerta — con link */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <AlertCard
            label="Grupos en riesgo"
            value={atRiskCount}
            href="/admin/riesgo"
            highlight={atRiskCount > 0}
            emptyText="Todos los grupos están bien"
          />
          <AlertCard
            label="Devoluciones pendientes"
            value={pendingRefunds}
            href="/admin/devoluciones"
            highlight={pendingRefunds > 0}
            emptyText="Sin devoluciones pendientes"
          />
          <AlertCard
            label="Ventas no concretadas"
            value={abandonedCount}
            href="/admin/reportes"
            highlight={abandonedCount > 0}
            sub={abandonedAmount > 0 ? `${fmtCLP(abandonedAmount)} potencial` : undefined}
            emptyText="Sin abandonos este mes"
          />
        </div>

        {/* Tours de hoy */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-100 pb-2 mb-3">
            Tours de hoy
          </h2>
          {todayInstances.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center bg-white rounded-xl border border-gray-100">
              Sin tours programados para hoy
            </p>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Tour</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Horario</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Tipo</th>
                    <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500">Pax</th>
                    <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500">Reservas</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {(todayInstances as unknown as TodayInstance[]).map((inst, i) => (
                    <tr key={inst.id} className={i > 0 ? 'border-t border-gray-100' : ''}>
                      <td className="px-4 py-3 text-gray-800 font-medium">
                        {inst.tours?.name_es ?? inst.tour_slug}
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                        {scheduleMap[inst.tour_slug] ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 capitalize">{inst.booking_type}</td>
                      <td className="px-4 py-3 text-center text-gray-800 font-semibold">{inst.current_pax}</td>
                      <td className="px-4 py-3 text-center text-gray-500">
                        {Array.isArray(inst.bookings) ? inst.bookings.length : 0}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={inst.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Próximos 7 días */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-100 pb-2 mb-3">
            Próximos 7 días
            <span className="ml-2 text-gray-400 normal-case font-normal">
              {tomorrowStr} → {endDateStr}
            </span>
          </h2>
          {upcomingData.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center bg-white rounded-xl border border-gray-100">
              Sin tours programados los próximos 7 días
            </p>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Fecha</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Tour</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Tipo</th>
                    <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500">Pax</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingData.map((inst, i) => (
                    <tr key={inst.id} className={i > 0 ? 'border-t border-gray-100' : ''}>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(inst.date)}</td>
                      <td className="px-4 py-3 text-gray-800 font-medium">
                        {inst.tours?.name_es ?? inst.tour_slug}
                      </td>
                      <td className="px-4 py-3 text-gray-500 capitalize">{inst.booking_type}</td>
                      <td className="px-4 py-3 text-center text-gray-800 font-semibold">{inst.current_pax}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={inst.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Últimas reservas */}
        <section>
          <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-3">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Últimas reservas
            </h2>
            <a href="/admin/reservas" className="text-xs text-teal hover:underline">
              Ver todas →
            </a>
          </div>
          <RecentBookingsTable bookings={recentRows} />
        </section>
      </main>
    </div>
  );
}

function StatCard({ label, value, highlight, href }: { label: string; value: string; highlight?: boolean; href?: string }) {
  const inner = (
    <>
      <p className="text-xs text-gray-500 mb-1.5">{label}</p>
      <p className={`text-3xl font-bold tracking-tight ${highlight ? 'text-orange-600' : 'text-gray-900'}`}>{value}</p>
      {href && <p className="text-xs text-teal mt-2 opacity-0 group-hover:opacity-100 transition-opacity">Ver detalle →</p>}
    </>
  );
  const cls = `group bg-white rounded-xl border p-4 transition-colors ${highlight ? 'border-orange-200 bg-orange-50' : 'border-gray-100'} ${href ? 'hover:border-teal/30 cursor-pointer' : ''}`;
  return href
    ? <a href={href} className={cls}>{inner}</a>
    : <div className={cls}>{inner}</div>;
}

function AlertCard({
  label, value, href, highlight, sub, emptyText,
}: {
  label: string;
  value: number;
  href: string;
  highlight?: boolean;
  sub?: string;
  emptyText: string;
}) {
  return (
    <a
      href={href}
      className={`block bg-white rounded-xl border p-4 transition-colors hover:border-teal/30 group ${
        highlight ? 'border-orange-200 bg-orange-50' : 'border-gray-100'
      }`}
    >
      <p className="text-xs text-gray-500 mb-1.5">{label}</p>
      {highlight ? (
        <>
          <p className="text-3xl font-bold tracking-tight text-orange-600">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
          <p className="text-xs text-teal mt-2 group-hover:underline">Ver detalle →</p>
        </>
      ) : (
        <p className="text-sm text-gray-400 mt-1">{emptyText}</p>
      )}
    </a>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? { label: status, cls: 'bg-gray-50 text-gray-500 border-gray-200' };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${s.cls}`}>
      {s.label}
    </span>
  );
}
