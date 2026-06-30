import { redirect } from 'next/navigation';
import { requireAdmin, getCurrentTeamMember } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';
import AdminSidebar from '@/components/admin/AdminSidebar';
import ToursTable, { type AdminTourRow } from '@/components/admin/ToursTable';

export default async function ToursPage() {
  const user   = await requireAdmin();
  const member = await getCurrentTeamMember();
  if (member?.role !== 'admin') redirect('/admin');

  const { data, error } = await supabase
    .from('tours')
    .select('slug, name_es, category, difficulty, duration_hrs, active')
    .order('name_es');

  const tours: AdminTourRow[] = (data ?? []) as AdminTourRow[];

  return (
    <div className="flex min-h-screen">
      <AdminSidebar userEmail={user.email ?? ''} />
      <main className="flex-1 ml-56 p-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Tours</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {tours.length} tours · activa/desactiva la visibilidad pública o edita el contenido completo
            {error && <span className="ml-2 text-red-500">· Error: {error.message}</span>}
          </p>
        </div>

        <ToursTable initialTours={tours} />
      </main>
    </div>
  );
}
