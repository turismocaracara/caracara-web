import { redirect } from 'next/navigation';
import { requireAdmin, getCurrentTeamMember } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';
import { isBookingPaid, sweepExpiredHolds } from '@/lib/booking-engine';
import AdminSidebar from '@/components/admin/AdminSidebar';

interface TodayInstance {
  id: string;
  tour_slug: string;
  date: string;
  booking_type: string;
  current_pax: number;
  status: string;
  tours: { name_es: string } | null;
  bookings: { id: string; booking_code: string; pax: number; status: string }[] | null;
}

interface RecentBooking {
  id: string;
  booking_code: string;
  booking_type: string;
  pax: number;
  status: string;
  total_amount: number | null;
  created_at: string;
  tour_instances: { tour_slug: string; date: string; tours: { name_es: string } | null } | null;
  clients: { name: string } | null;
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
};

export default async function AdminDashboard() {
  const user   = await requireAdmin();
  const member = await getCurrentTeamMember();
  // Ingresos del mes + lista de clientes recientes — no es "tour propio del guía".
  if (member?.role === 'guide') redirect('/admin/asignaciones');

  // Sin esto, un hold de pago vencido pero todavía no barrido por el lazy-sweep
  // se contaría como ingreso real en el KPI del mes.
  await sweepExpiredHolds();

  const today      = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';
  const monthEnd   = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)
    .toISOString().slice(0, 10);

  const [todayInstancesRes, recentRes, statsRes] = await Promise.all([
    // Tours de hoy: consultar via tour_instances
    supabase
      .from('tour_instances')
      .select(`
        id, tour_slug, date, booking_type, current_pax, status,
        tours ( name_es ),
        bookings ( id, booking_code, pax, status )
      `)
      .eq('date', today)
      .neq('status', 'cancelled'),

    // Últimas 10 reservas con join a tour_instances y clients
    supabase
      .from('bookings')
      .select(`
        id, booking_code, booking_type, pax, status, total_amount, created_at,
        tour_instances ( tour_slug, date, tours ( name_es ) ),
        clients ( name )
      `)
      .order('created_at', { ascending: false })
      .limit(10),

    // Métricas del mes (por created_at)
    supabase
      .from('bookings')
      .select('status, total_amount, credit_applied, source, mp_payment_id, pax')
      .gte('created_at', monthStart + 'T00:00:00')
      .lte('created_at', monthEnd + 'T23:59:59')
      .neq('status', 'cancelled'),
  ]);

  const todayInstances = todayInstancesRes.data ?? [];
  const recentBookings = recentRes.data ?? [];
  const monthData      = statsRes.data ?? [];

  // Ingresos solo de reservas con pago confirmado, netos del crédito aplicado
  // (esa parte ya había entrado como plata en una reserva anterior).
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
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* KPIs del mes */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard label="Reservas del mes"           value={String(monthCount)} />
          <StatCard label="Pasajeros del mes"          value={String(monthPax)} />
          <StatCard label="Ingresos del mes"           value={monthTotal > 0 ? fmtCLP(monthTotal) : '—'} />
          <StatCard label="Pendientes de confirmar"    value={String(pendingCount)} highlight={pendingCount > 0} />
        </div>

        {/* Tours de hoy */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
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
                  <tr className="border-b border-gray-50">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Tour</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Tipo</th>
                    <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500">Pax</th>
                    <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500">Reservas</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Estado instancia</th>
                  </tr>
                </thead>
                <tbody>
                  {(todayInstances as unknown as TodayInstance[]).map((inst, i) => (
                    <tr key={inst.id} className={i > 0 ? 'border-t border-gray-50' : ''}>
                      <td className="px-4 py-3 text-gray-800">{inst.tours?.name_es ?? inst.tour_slug}</td>
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

        {/* Últimas reservas */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Últimas reservas
            </h2>
            <a href="/admin/reservas" className="text-xs text-teal hover:underline">
              Ver todas →
            </a>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Código</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Cliente</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Tour</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Fecha tour</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500">Pax</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Estado</th>
                </tr>
              </thead>
              <tbody>
                {(recentBookings as unknown as RecentBooking[]).map((b, i) => (
                  <tr key={b.id} className={i > 0 ? 'border-t border-gray-50' : ''}>
                    <td className="px-4 py-3 font-mono text-xs text-teal">{b.booking_code}</td>
                    <td className="px-4 py-3 text-gray-600">{b.clients?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-800 max-w-[140px] truncate">
                      {b.tour_instances?.tours?.name_es ?? b.tour_instances?.tour_slug ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {b.tour_instances?.date ? fmtDate(b.tour_instances.date) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-800">{b.pax}</td>
                    <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`bg-white rounded-xl border p-4 ${highlight ? 'border-orange-200 bg-orange-50' : 'border-gray-100'}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${highlight ? 'text-orange-600' : 'text-gray-900'}`}>{value}</p>
    </div>
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
