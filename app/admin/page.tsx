import { requireAdmin } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';
import AdminSidebar from '@/components/admin/AdminSidebar';

function fmtCLP(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending:        { label: 'Pendiente',    cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  waiting_min:    { label: 'En espera',    cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  confirmed:      { label: 'Confirmada',   cls: 'bg-green-50 text-green-700 border-green-200' },
  cancelled:      { label: 'Cancelada',    cls: 'bg-red-50 text-red-600 border-red-200' },
  refunded:       { label: 'Devuelta',     cls: 'bg-gray-50 text-gray-500 border-gray-200' },
};

export default async function AdminDashboard() {
  const user = await requireAdmin();

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';
  const monthEnd   = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)
    .toISOString().slice(0, 10);

  const [todayRes, recentRes, statsRes] = await Promise.all([
    // Reservas de hoy
    supabase
      .from('bookings')
      .select('id, booking_code, tour_slug, booking_type, pax, status, total_amount, created_at')
      .eq('tour_date', today)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false }),

    // Últimas 10 reservas
    supabase
      .from('bookings')
      .select('id, booking_code, tour_slug, booking_type, pax, status, total_amount, tour_date, created_at')
      .order('created_at', { ascending: false })
      .limit(10),

    // Métricas del mes
    supabase
      .from('bookings')
      .select('status, total_amount, pax')
      .gte('tour_date', monthStart)
      .lte('tour_date', monthEnd)
      .neq('status', 'cancelled'),
  ]);

  const todayBookings  = todayRes.data  ?? [];
  const recentBookings = recentRes.data ?? [];
  const monthData      = statsRes.data  ?? [];

  const monthTotal  = monthData.reduce((s, b) => s + (b.total_amount ?? 0), 0);
  const monthPax    = monthData.reduce((s, b) => s + (b.pax ?? 0), 0);
  const monthCount  = monthData.length;
  const pendingCount = monthData.filter(b => b.status === 'pending' || b.status === 'waiting_min').length;

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
          <StatCard label="Reservas del mes"  value={String(monthCount)} />
          <StatCard label="Pasajeros del mes" value={String(monthPax)} />
          <StatCard label="Ingresos del mes"  value={monthTotal > 0 ? fmtCLP(monthTotal) : '—'} />
          <StatCard
            label="Pendientes de confirmar"
            value={String(pendingCount)}
            highlight={pendingCount > 0}
          />
        </div>

        {/* Tours de hoy */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Tours de hoy
          </h2>
          {todayBookings.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center bg-white rounded-xl border border-gray-100">
              Sin tours programados para hoy
            </p>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Código</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Tour</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Tipo</th>
                    <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500">Pax</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {todayBookings.map((b, i) => (
                    <tr key={b.id} className={i > 0 ? 'border-t border-gray-50' : ''}>
                      <td className="px-4 py-3 font-mono text-xs text-teal">{b.booking_code}</td>
                      <td className="px-4 py-3 text-gray-800">{b.tour_slug}</td>
                      <td className="px-4 py-3 text-gray-500 capitalize">{b.booking_type}</td>
                      <td className="px-4 py-3 text-center text-gray-800">{b.pax}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={b.status} />
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
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Tour</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Fecha tour</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500">Pax</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Estado</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Creada</th>
                </tr>
              </thead>
              <tbody>
                {recentBookings.map((b, i) => (
                  <tr key={b.id} className={i > 0 ? 'border-t border-gray-50' : ''}>
                    <td className="px-4 py-3 font-mono text-xs text-teal">{b.booking_code}</td>
                    <td className="px-4 py-3 text-gray-800 max-w-[160px] truncate">{b.tour_slug}</td>
                    <td className="px-4 py-3 text-gray-600">{fmtDate(b.tour_date)}</td>
                    <td className="px-4 py-3 text-center text-gray-800">{b.pax}</td>
                    <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(b.created_at).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
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
