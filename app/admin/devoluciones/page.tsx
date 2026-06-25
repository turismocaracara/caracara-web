import { redirect } from 'next/navigation';
import { requireAdmin, getCurrentTeamMember, hasPermission } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';
import AdminSidebar from '@/components/admin/AdminSidebar';
import DevolucionesManager, { type RefundRow } from '@/components/admin/DevolucionesManager';

interface RawRow {
  id: string;
  booking_code: string;
  total_amount: number | null;
  refund_amount: number | null;
  refund_status: string;
  cancelled_at: string | null;
  tour_instances: { tours: { name_es: string } | { name_es: string }[] | null } | { tours: { name_es: string } | { name_es: string }[] | null }[] | null;
  clients: { name: string; email: string } | { name: string; email: string }[] | null;
}

export default async function DevolucionesPage() {
  const user   = await requireAdmin();
  const member = await getCurrentTeamMember();
  if (!hasPermission(member, 'view_financials')) redirect('/admin');

  const { data } = await supabase
    .from('bookings')
    .select(`
      id, booking_code, total_amount, refund_amount, refund_status, cancelled_at,
      tour_instances!tour_instance_id ( tours ( name_es ) ),
      clients ( name, email )
    `)
    .in('refund_status', ['pending_approval', 'approved'])
    .order('cancelled_at', { ascending: false });

  const rows: RefundRow[] = ((data ?? []) as unknown as RawRow[]).map(r => {
    const inst   = Array.isArray(r.tour_instances) ? r.tour_instances[0] : r.tour_instances;
    const tour   = inst ? (Array.isArray(inst.tours) ? inst.tours[0] : inst.tours) : null;
    const client = Array.isArray(r.clients) ? r.clients[0] : r.clients;
    return {
      id:            r.id,
      booking_code:  r.booking_code,
      tour_name:     tour?.name_es ?? '—',
      total_amount:  r.total_amount,
      refund_amount: r.refund_amount,
      refund_status: r.refund_status,
      cancelled_at:  r.cancelled_at,
      client_name:   client?.name  ?? '—',
      client_email:  client?.email ?? '—',
    };
  });

  return (
    <div className="flex min-h-screen">
      <AdminSidebar userEmail={user.email ?? ''} />
      <main className="flex-1 ml-56 p-6 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Devoluciones</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Solicitudes de cancelación con devolución de dinero pendiente
          </p>
        </div>

        <DevolucionesManager initialRows={rows} />
      </main>
    </div>
  );
}
