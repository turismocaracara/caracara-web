import { requireAdmin } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AsignacionesManager, {
  type InstanceRow,
  type GuideOption,
  type AssignmentRow,
} from '@/components/admin/AsignacionesManager';

export default async function AsignacionesPage() {
  const user = await requireAdmin();

  const today    = new Date().toISOString().slice(0, 10);
  const horizon  = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [instancesRes, guidesRes, assignmentsRes] = await Promise.all([
    supabase
      .from('tour_instances')
      .select('id, tour_slug, date, booking_type, current_pax, status, tours ( name_es )')
      .gte('date', today)
      .lte('date', horizon)
      .neq('status', 'cancelled')
      .order('date'),
    supabase
      .from('team_members')
      .select('id, name, role')
      .eq('active', true)
      .in('role', ['guide', 'admin', 'admin_secondary'])
      .order('name'),
    supabase
      .from('tour_assignments')
      .select('tour_instance_id, team_member_id'),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const instances: InstanceRow[] = ((instancesRes.data ?? []) as unknown as Record<string, any>[]).map(inst => ({
    id:           inst.id           as string,
    tour_slug:    inst.tour_slug    as string,
    tour_name:    (inst.tours?.name_es ?? inst.tour_slug) as string,
    date:         inst.date         as string,
    booking_type: inst.booking_type as string,
    current_pax:  inst.current_pax  as number,
    status:       inst.status       as string,
  }));

  const guides:      GuideOption[]   = (guidesRes.data ?? []) as GuideOption[];
  const assignments: AssignmentRow[] = (assignmentsRes.data ?? []) as AssignmentRow[];

  return (
    <div className="flex min-h-screen">
      <AdminSidebar userEmail={user.email ?? ''} />
      <main className="flex-1 ml-56 p-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Asignaciones</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Asigna guía/conductor a los tours de los próximos 14 días
            {assignmentsRes.error?.message.includes('schema cache') && (
              <span className="block text-red-500 mt-1">
                Falta crear la tabla tour_assignments — revisa el SQL indicado más abajo.
              </span>
            )}
          </p>
        </div>

        {assignmentsRes.error?.message.includes('schema cache') ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-800">
            <p className="font-semibold mb-2">La tabla <code>tour_assignments</code> no existe aún.</p>
            <p className="mb-3">Ejecuta este SQL en Supabase:</p>
            <pre className="bg-white border border-amber-100 rounded-lg p-3 text-xs overflow-auto font-mono whitespace-pre-wrap">{`create table if not exists public.tour_assignments (
  id                uuid primary key default gen_random_uuid(),
  tour_instance_id  uuid not null references public.tour_instances(id) on delete cascade,
  team_member_id    uuid not null references public.team_members(id) on delete cascade,
  role_in_tour      text not null default 'guide_driver' check (role_in_tour in ('guide', 'driver', 'guide_driver')),
  created_at        timestamptz not null default now(),
  unique (tour_instance_id)
);`}</pre>
          </div>
        ) : (
          <AsignacionesManager
            instances={instances}
            guides={guides}
            initialAssignments={assignments}
          />
        )}
      </main>
    </div>
  );
}
