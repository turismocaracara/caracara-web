import { redirect } from 'next/navigation';
import { requireAdmin, getCurrentTeamMember, hasPermission, isOpsViewer } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';
import AdminSidebar from '@/components/admin/AdminSidebar';
import ReservasTable from '@/components/admin/ReservasTable';
import NewBookingButton from '@/components/admin/NewBookingButton';
import type { AdminTourOption } from '@/components/admin/ManualBookingForm';
import type { Agency } from '@/components/admin/AgencyRegistrationModal';
import type { ServiceProvider } from '@/components/admin/ServiceProviderModal';

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
  const user   = await requireAdmin();
  const member = await getCurrentTeamMember();
  if (!isOpsViewer(member)) redirect('/admin/asignaciones');
  const canCreateManual = hasPermission(member, 'manual_booking');

  let bookingsQuery = supabase
    .from('bookings')
    .select(`
      id, booking_code, booking_type, pax, status, total_amount, locale, created_at,
      tour_instances!tour_instance_id ( tour_slug, date, tours ( name_es ) ),
      clients ( name, email, phone )
    `)
    .order('created_at', { ascending: false })
    .limit(200);

  if (searchParams.status && searchParams.status !== 'all') {
    bookingsQuery = bookingsQuery.eq('status', searchParams.status);
  }

  const [
    { data, error },
    activeToursRes,
    agenciesRes,
    guidesRes,
    vansRes,
    serviceProvidersRes,
  ] = await Promise.all([
    bookingsQuery,
    supabase.from('tours').select('slug, name_es, has_picnic, duration_hours').eq('active', true).order('name_es'),
    supabase.from('agencies').select('id, fantasy_name, rut, razon_social, giro, address, comuna, city, billing_email, phone, contact_name').order('fantasy_name'),
    supabase.from('team_members').select('id, name, role').eq('active', true).order('name'),
    supabase.from('vans').select('id, name, plate, capacity').eq('active', true).order('name'),
    supabase.from('service_providers').select('id, name, type, phone, email, rut, notes').eq('active', true).order('name'),
  ]);

  const activeTours      = (activeToursRes.data      ?? []) as AdminTourOption[];
  const agencies         = (agenciesRes.data          ?? []) as Agency[];
  const guides           = (guidesRes.data            ?? []) as { id: string; name: string; role: string }[];
  const vans             = (vansRes.data              ?? []) as { id: string; name: string; plate: string | null; capacity: number }[];
  const serviceProviders = (serviceProvidersRes.data  ?? []) as ServiceProvider[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: BookingRow[] = ((data ?? []) as unknown as Record<string, any>[]).map((b) => {
    const inst   = Array.isArray(b.tour_instances) ? b.tour_instances[0] : b.tour_instances;
    const client = Array.isArray(b.clients)        ? b.clients[0]        : b.clients;
    return {
      id:           b.id            as string,
      booking_code: b.booking_code  as string,
      tour_slug:    (inst?.tours?.name_es ?? inst?.tour_slug ?? '—') as string,
      tour_date:    (inst?.date      ?? '')   as string,
      booking_type: b.booking_type  as string,
      pax:          b.pax           as number,
      status:       b.status        as string,
      total_amount: b.total_amount  as number | null,
      locale:       b.locale        as string,
      created_at:   b.created_at    as string,
      client_name:  (client?.name   ?? null) as string | null,
      client_email: (client?.email  ?? null) as string | null,
      client_phone: (client?.phone  ?? null) as string | null,
    };
  });

  return (
    <div className="flex min-h-screen">
      <AdminSidebar userEmail={user.email ?? ''} />
      <main className="flex-1 ml-56 p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Reservas</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {rows.length} reserva{rows.length !== 1 ? 's' : ''}
              {error && <span className="ml-2 text-red-500">· Error: {error.message}</span>}
            </p>
          </div>
          {canCreateManual && (
            <NewBookingButton
              tours={activeTours}
              agencies={agencies}
              guides={guides}
              vans={vans}
              serviceProviders={serviceProviders}
            />
          )}
        </div>

        <ReservasTable initialBookings={rows} initialSearch={searchParams.q ?? ''} />
      </main>
    </div>
  );
}
