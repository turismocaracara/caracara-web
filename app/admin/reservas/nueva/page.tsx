import { redirect } from 'next/navigation';
import { requireAdmin, getCurrentTeamMember, hasPermission } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';
import AdminSidebar from '@/components/admin/AdminSidebar';
import ManualBookingForm, { type AdminTourOption } from '@/components/admin/ManualBookingForm';

export default async function NuevaReservaPage() {
  const user   = await requireAdmin();
  const member = await getCurrentTeamMember();

  if (!hasPermission(member, 'manual_booking')) redirect('/admin/reservas');

  const { data } = await supabase
    .from('tours')
    .select('slug, name_es')
    .eq('active', true)
    .order('name_es');

  const tours: AdminTourOption[] = (data ?? []) as AdminTourOption[];

  return (
    <div className="flex min-h-screen">
      <AdminSidebar userEmail={user.email ?? ''} />
      <main className="flex-1 ml-56 p-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Nueva reserva manual</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Crea una reserva directamente desde el panel (pago coordinado por WhatsApp, transferencia, etc.)
          </p>
        </div>

        {tours.length === 0 ? (
          <p className="text-sm text-gray-400">No hay tours activos disponibles.</p>
        ) : (
          <ManualBookingForm tours={tours} />
        )}
      </main>
    </div>
  );
}
