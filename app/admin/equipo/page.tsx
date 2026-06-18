import { requireAdmin } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';
import AdminSidebar from '@/components/admin/AdminSidebar';
import EquipoManager, { type TeamMemberRow } from '@/components/admin/EquipoManager';

export default async function EquipoPage() {
  const user = await requireAdmin();

  const { data, error } = await supabase
    .from('team_members')
    .select('id, name, email, role, permissions, active, created_at')
    .order('created_at');

  const members: TeamMemberRow[] = (data ?? []) as TeamMemberRow[];

  return (
    <div className="flex min-h-screen">
      <AdminSidebar userEmail={user.email ?? ''} />
      <main className="flex-1 ml-56 p-6 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Equipo</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Guías, conductores y administradores de CaraCara
            {error && <span className="ml-2 text-red-500">· Error: {error.message}</span>}
          </p>
        </div>

        <EquipoManager
          initialMembers={members}
          currentUserEmail={user.email ?? ''}
        />
      </main>
    </div>
  );
}
