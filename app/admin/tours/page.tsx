import { redirect } from 'next/navigation';
import { requireAdmin, getCurrentTeamMember } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';
import AdminSidebar from '@/components/admin/AdminSidebar';
import ToursTable, { type AdminTourRow } from '@/components/admin/ToursTable';
import PickupSchedulesManager, { type ScheduleRow } from '@/components/admin/PickupSchedulesManager';

export default async function ToursPage() {
  const user   = await requireAdmin();
  const member = await getCurrentTeamMember();
  if (member?.role !== 'admin') redirect('/admin');

  const [toursRes, schedulesRes] = await Promise.all([
    supabase
      .from('tours')
      .select('slug, name_es, category, difficulty, duration_hrs, max_pax, active')
      .order('name_es'),
    supabase
      .from('tour_schedules')
      .select('id, tour_slug, season, pickup_time'),
  ]);

  const { data, error } = toursRes;
  const schedules: ScheduleRow[] = (schedulesRes.data ?? []) as ScheduleRow[];

  const tours: AdminTourRow[] = (data ?? []) as AdminTourRow[];

  return (
    <div className="flex min-h-screen">
      <AdminSidebar userEmail={user.email ?? ''} />
      <main className="flex-1 ml-56 p-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Tours</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {tours.length} tours · activa o desactiva la visibilidad pública
            {error && <span className="ml-2 text-red-500">· Error: {error.message}</span>}
          </p>
        </div>

        <ToursTable initialTours={tours} />

        <div className="mt-6">
          <PickupSchedulesManager
            tours={tours.map(t => ({ slug: t.slug, name_es: t.name_es }))}
            initialSchedules={schedules}
          />
        </div>
      </main>
    </div>
  );
}
