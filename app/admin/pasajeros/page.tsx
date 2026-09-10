import { redirect } from 'next/navigation';
import { requireAdmin, getCurrentTeamMember, hasPermission, isOpsViewer } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';
import AdminSidebar from '@/components/admin/AdminSidebar';
import PasajerosTable, { type PasajeroRow } from '@/components/admin/PasajerosTable';

export default async function PasajerosPage() {
  const user   = await requireAdmin();
  const member = await getCurrentTeamMember();
  if (!isOpsViewer(member)) redirect('/admin/asignaciones');

  const canEdit = hasPermission(member, 'manual_booking');

  const { data, error } = await supabase
    .from('passengers')
    .select('id, name, id_type, id_number, email, phone, country, birth_date, is_lead')
    .order('created_at', { ascending: false })
    .limit(2000);

  const rows: PasajeroRow[] = ((data ?? []) as PasajeroRow[]).map(p => ({
    id:         p.id,
    name:       p.name,
    id_type:    p.id_type,
    id_number:  p.id_number,
    email:      p.email     ?? null,
    phone:      p.phone     ?? null,
    country:    p.country   ?? null,
    birth_date: p.birth_date ?? null,
    is_lead:    !!p.is_lead,
  }));

  return (
    <div className="flex min-h-screen">
      <AdminSidebar userEmail={user.email ?? ''} />
      <main className="flex-1 ml-56 p-6 overflow-x-hidden">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Pasajeros</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {rows.length} pasajero{rows.length !== 1 ? 's' : ''} registrados
            {error && <span className="ml-2 text-red-500">· Error: {error.message}</span>}
          </p>
        </div>
        <PasajerosTable initialRows={rows} canEdit={canEdit} />
      </main>
    </div>
  );
}
