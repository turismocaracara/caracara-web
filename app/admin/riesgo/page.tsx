import { redirect } from 'next/navigation';
import { requireAdmin, getCurrentTeamMember, isOpsViewer } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';
import { isBookingPaid, sweepExpiredHolds } from '@/lib/booking-engine';
import AdminSidebar from '@/components/admin/AdminSidebar';
import RiesgoManager, { type RiskGroupRow } from '@/components/admin/RiesgoManager';

export default async function RiesgoPage() {
  const user   = await requireAdmin();
  const member = await getCurrentTeamMember();
  // Expone email/teléfono de clientes de grupos en riesgo de toda la operación —
  // no es información que un guía deba ver por defecto.
  if (!isOpsViewer(member)) redirect('/admin/asignaciones');

  // Sin esto, una reserva con el hold de pago vencido pero todavía no barrida
  // por el lazy-sweep podía mostrarse aquí como "sin pagar todavía" en vez de
  // ya estar cancelada (igual que en el dashboard y reportes).
  await sweepExpiredHolds();

  const today = new Date().toISOString().slice(0, 10);

  const [{ data, error }, toursRes] = await Promise.all([
    supabase
      .from('tour_instances')
      .select(`
        id, date, tour_slug,
        tours ( name_es, group_min_pax ),
        bookings!tour_instance_id ( id, pax, status, source, mp_payment_id, credit_applied, client_id, clients ( name, email, phone ) )
      `)
      .eq('booking_type', 'group')
      .eq('status', 'forming')
      .gte('date', today)
      .order('date'),
    supabase.from('tours').select('slug, name_es').eq('active', true).order('name_es'),
  ]);

  const tours = (toursRes.data ?? []) as { slug: string; name_es: string }[];

  interface RawBooking {
    id: string;
    pax: number;
    status: string;
    source: string | null;
    mp_payment_id: string | null;
    credit_applied: number | null;
    clients: { name: string; email: string; phone: string | null } | { name: string; email: string; phone: string | null }[] | null;
  }
  interface RawInstance {
    id: string;
    date: string;
    tour_slug: string;
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

      // Solo cuenta para el mínimo lo que el cron de confirmación también cuenta
      // (pago confirmado, crédito aplicado, o reserva manual) — una reserva
      // 'waiting_min' sin pagar todavía puede evaporarse, así que no basta con
      // que la suma de pax nominal ya alcance el mínimo.
      const paidPax = bookingsRaw.filter(isBookingPaid).reduce((sum, b) => sum + b.pax, 0);

      return {
        instance_id: inst.id as string,
        tour_slug:   inst.tour_slug as string,
        tour_name:   (tour?.name_es ?? 'Tour') as string,
        date:        inst.date as string,
        min_pax:     (tour?.group_min_pax ?? 4) as number,
        paidPax,
        bookings,
      };
    })
    .filter(g => g.bookings.length > 0 && g.paidPax < g.min_pax)
    .map(({ paidPax, ...g }) => g);

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

        <RiesgoManager groups={groups} tours={tours} />
      </main>
    </div>
  );
}
