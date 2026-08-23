import { redirect } from 'next/navigation';
import { requireAdmin, getCurrentTeamMember, isOpsViewer } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';
import AdminSidebar from '@/components/admin/AdminSidebar';
import PasajerosTable, { type PasajeroRow } from '@/components/admin/PasajerosTable';

export default async function PasajerosPage() {
  const user   = await requireAdmin();
  const member = await getCurrentTeamMember();
  if (!isOpsViewer(member)) redirect('/admin/asignaciones');

  const { data, error } = await supabase
    .from('passengers')
    .select(`
      id, name, id_type, id_number, email, phone, country, birth_date, is_lead,
      bookings!booking_id (
        booking_code, booking_type, status,
        tour_instances!tour_instance_id (
          date,
          tours ( name_es )
        )
      )
    `)
    .order('created_at', { ascending: false })
    .limit(2000);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: PasajeroRow[] = ((data ?? []) as unknown as Record<string, any>[]).map(p => {
    const booking = Array.isArray(p.bookings) ? p.bookings[0] : p.bookings;
    const inst    = booking ? (Array.isArray(booking.tour_instances) ? booking.tour_instances[0] : booking.tour_instances) : null;
    const tour    = inst    ? (Array.isArray(inst.tours)             ? inst.tours[0]             : inst.tours)             : null;
    return {
      id:             p.id             as string,
      name:           p.name           as string,
      id_type:        p.id_type        as string,
      id_number:      p.id_number      as string,
      email:          (p.email         ?? null) as string | null,
      phone:          (p.phone         ?? null) as string | null,
      country:        (p.country       ?? null) as string | null,
      birth_date:     (p.birth_date    ?? null) as string | null,
      is_lead:        !!p.is_lead,
      booking_code:   (booking?.booking_code  ?? '—') as string,
      booking_type:   (booking?.booking_type  ?? '—') as string,
      booking_status: (booking?.status        ?? '—') as string,
      tour_name:      (tour?.name_es          ?? '—') as string,
      tour_date:      (inst?.date             ?? '')   as string,
    };
  });

  return (
    <div className="flex min-h-screen">
      <AdminSidebar userEmail={user.email ?? ''} />
      <main className="flex-1 ml-56 p-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Pasajeros</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {rows.length} pasajero{rows.length !== 1 ? 's' : ''} registrados
            {error && <span className="ml-2 text-red-500">· Error: {error.message}</span>}
          </p>
        </div>
        <PasajerosTable initialRows={rows} />
      </main>
    </div>
  );
}
