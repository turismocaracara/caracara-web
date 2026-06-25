import { redirect } from 'next/navigation';
import { requireAdmin, getCurrentTeamMember } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';
import AdminSidebar from '@/components/admin/AdminSidebar';
import RiesgoManager, { type RiskGroupRow } from '@/components/admin/RiesgoManager';

export default async function RiesgoPage() {
  const user   = await requireAdmin();
  const member = await getCurrentTeamMember();
  // Expone email/teléfono de clientes de grupos en riesgo de toda la operación —
  // no es información que un guía deba ver por defecto.
  if (member?.role === 'guide') redirect('/admin/asignaciones');

  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('tour_instances')
    .select(`
      id, date,
      tours ( name_es, group_min_pax ),
      bookings!tour_instance_id ( id, pax, status, client_id, clients ( name, email, phone ) )
    `)
    .eq('booking_type', 'group')
    .eq('status', 'forming')
    .gte('date', today)
    .order('date');

  interface RawBooking {
    id: string;
    pax: number;
    status: string;
    clients: { name: string; email: string; phone: string | null } | { name: string; email: string; phone: string | null }[] | null;
  }
  interface RawInstance {
    id: string;
    date: string;
    tours: { name_es: string; group_min_pax: number } | { name_es: string; group_min_pax: number }[] | null;
    bookings: RawBooking | RawBooking[] | null;
  }

  const groups: RiskGroupRow[] = ((data ?? []) as unknown as RawInstance[])
    .map(inst => {
      const tour = Array.isArray(inst.tours) ? inst.tours[0] : inst.tours;
      const bookingsRaw = Array.isArray(inst.bookings) ? inst.bookings : (inst.bookings ? [inst.bookings] : []);

      const bookings = bookingsRaw
        .filter(b => b.status !== 'cancelled' && b.status !== 'refunded')
        .map(b => {
          const client = Array.isArray(b.clients) ? b.clients[0] : b.clients;
          return {
            booking_id:   b.id,
            pax:          b.pax,
            client_name:  client?.name  ?? '—',
            client_email: client?.email ?? '—',
            client_phone: client?.phone ?? null,
          };
        });

      return {
        instance_id: inst.id as string,
        tour_name:   (tour?.name_es ?? 'Tour') as string,
        date:        inst.date as string,
        min_pax:     (tour?.group_min_pax ?? 4) as number,
        bookings,
      };
    })
    .filter(g => g.bookings.length > 0);

  return (
    <div className="flex min-h-screen">
      <AdminSidebar userEmail={user.email ?? ''} />
      <main className="flex-1 ml-56 p-6 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Tours en riesgo</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Tours grupales que no han alcanzado el mínimo de pasajeros — protocolo &quot;nunca cancelar&quot;
            {error && <span className="ml-2 text-red-500">· Error: {error.message}</span>}
          </p>
        </div>

        <RiesgoManager groups={groups} />
      </main>
    </div>
  );
}
