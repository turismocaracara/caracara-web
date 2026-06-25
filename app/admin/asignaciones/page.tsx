import { redirect } from 'next/navigation';
import { requireAdmin, getCurrentTeamMember, hasPermission } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AsignacionesManager, {
  type InstanceRow,
  type GuideOption,
  type AssignmentRow,
} from '@/components/admin/AsignacionesManager';

export default async function AsignacionesPage() {
  const user   = await requireAdmin();
  const member = await getCurrentTeamMember();

  // Quien puede asignar gente a tours (admin o admin secundario con el permiso)
  // ve el manager completo y editable. Un guía puro solo ve sus propios tours,
  // de solo lectura — no los de sus compañeros.
  const canManage = hasPermission(member, 'manage_team');
  const isGuideOnly = !canManage && !!member?.is_guide;

  if (!canManage && !isGuideOnly) redirect('/admin');

  const today    = new Date().toISOString().slice(0, 10);
  const horizon  = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [instancesRes, guidesRes, assignmentsRes] = await Promise.all([
    supabase
      .from('tour_instances')
      .select(`
        id, tour_slug, date, booking_type, current_pax, status,
        tours ( name_es ),
        bookings!tour_instance_id (
          id, status, tour_languages,
          passengers ( name, id_type, id_number, birth_date, is_lead )
        )
      `)
      .gte('date', today)
      .lte('date', horizon)
      .neq('status', 'cancelled')
      .order('date'),
    canManage
      ? supabase.from('team_members').select('id, name, role').eq('active', true).order('name')
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('tour_assignments')
      .select('tour_instance_id, team_member_id'),
  ]);

  interface RawPassenger {
    name: string; id_type: string; id_number: string; birth_date: string | null; is_lead: boolean;
  }
  interface RawBooking {
    status: string; tour_languages: string[] | null;
    passengers: RawPassenger | RawPassenger[] | null;
  }
  interface RawInstance {
    id: string; tour_slug: string; date: string; booking_type: string; current_pax: number; status: string;
    tours: { name_es: string } | { name_es: string }[] | null;
    bookings: RawBooking | RawBooking[] | null;
  }

  let instances: InstanceRow[] = ((instancesRes.data ?? []) as unknown as RawInstance[]).map(inst => {
    const bookingsRaw = Array.isArray(inst.bookings) ? inst.bookings : (inst.bookings ? [inst.bookings] : []);
    const activeBookings = bookingsRaw.filter(b => b.status !== 'cancelled' && b.status !== 'refunded');
    const tour = Array.isArray(inst.tours) ? inst.tours[0] : inst.tours;

    const passengers = activeBookings.flatMap(b => {
      const ps = Array.isArray(b.passengers) ? b.passengers : (b.passengers ? [b.passengers] : []);
      return ps.map(p => ({
        name:       p.name,
        id_type:    p.id_type,
        id_number:  p.id_number,
        birth_date: p.birth_date ?? null,
        is_lead:    !!p.is_lead,
      }));
    });

    const tourLanguages = Array.from(new Set(activeBookings.flatMap(b => (b.tour_languages ?? []) as string[])));

    return {
      id:             inst.id           as string,
      tour_slug:      inst.tour_slug    as string,
      tour_name:      tour?.name_es ?? inst.tour_slug,
      date:           inst.date         as string,
      booking_type:   inst.booking_type as string,
      current_pax:    inst.current_pax  as number,
      status:         inst.status       as string,
      passengers,
      tour_languages: tourLanguages,
    };
  });

  const guides:      GuideOption[]   = (guidesRes.data ?? []) as GuideOption[];
  let assignments: AssignmentRow[] = (assignmentsRes.data ?? []) as AssignmentRow[];

  // Vista de guía: solo sus propios tours asignados, nada de los demás.
  if (isGuideOnly && member) {
    const myInstanceIds = new Set(
      assignments.filter(a => a.team_member_id === member.id).map(a => a.tour_instance_id)
    );
    instances   = instances.filter(inst => myInstanceIds.has(inst.id));
    assignments = assignments.filter(a => a.team_member_id === member.id);
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar userEmail={user.email ?? ''} />
      <main className="flex-1 ml-56 p-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">
            {canManage ? 'Asignaciones' : 'Mis tours'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {canManage
              ? 'Asigna guía/conductor a los tours de los próximos 14 días'
              : 'Tours de los próximos 14 días en los que estás asignado'}
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
            readOnly={!canManage}
          />
        )}
      </main>
    </div>
  );
}
