import { requireAdmin } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';
import AdminSidebar from '@/components/admin/AdminSidebar';
import ReservasTable from '@/components/admin/ReservasTable';

export interface BookingRow {
  id: string;
  booking_code: string;
  tour_slug: string;
  tour_date: string;
  booking_type: string;
  pax: number;
  status: string;
  total_amount: number | null;
  locale: string;
  created_at: string;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
}

export default async function ReservasPage({
  searchParams,
}: {
  searchParams: { status?: string; q?: string };
}) {
  const user = await requireAdmin();

  let query = supabase
    .from('bookings')
    .select(`
      id, booking_code, booking_type, pax, status, total_amount, locale, created_at,
      tour_instances ( tour_slug, date ),
      clients ( name, email, phone )
    `)
    .order('created_at', { ascending: false })
    .limit(200);

  if (searchParams.status && searchParams.status !== 'all') {
    query = query.eq('status', searchParams.status);
  }

  const { data, error } = await query;

  const rows: BookingRow[] = (data ?? []).map((b: any) => ({
    id:           b.id,
    booking_code: b.booking_code,
    tour_slug:    b.tour_instances?.tour_slug ?? '—',
    tour_date:    b.tour_instances?.date ?? '',
    booking_type: b.booking_type,
    pax:          b.pax,
    status:       b.status,
    total_amount: b.total_amount,
    locale:       b.locale,
    created_at:   b.created_at,
    client_name:  b.clients?.name  ?? null,
    client_email: b.clients?.email ?? null,
    client_phone: b.clients?.phone ?? null,
  }));

  // Filtro por texto — lado servidor
  const q = (searchParams.q ?? '').toLowerCase();
  const filtered = q
    ? rows.filter(r =>
        r.booking_code.toLowerCase().includes(q) ||
        (r.client_name  ?? '').toLowerCase().includes(q) ||
        (r.client_email ?? '').toLowerCase().includes(q) ||
        r.tour_slug.toLowerCase().includes(q)
      )
    : rows;

  return (
    <div className="flex min-h-screen">
      <AdminSidebar userEmail={user.email ?? ''} />
      <main className="flex-1 ml-56 p-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Reservas</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
            {error && <span className="ml-2 text-red-500">· Error: {error.message}</span>}
          </p>
        </div>

        <ReservasTable initialBookings={filtered} />
      </main>
    </div>
  );
}
