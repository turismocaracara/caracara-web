import { notFound, redirect } from 'next/navigation';
import { requireAdmin, getCurrentTeamMember } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';
import AdminSidebar from '@/components/admin/AdminSidebar';
import TourEditForm, { type TourDetail, type ScheduleRow } from '@/components/admin/TourEditForm';
import esMessages from '@/messages/es.json';

export default async function TourEditPage({ params }: { params: { slug: string } }) {
  const user   = await requireAdmin();
  const member = await getCurrentTeamMember();
  if (member?.role !== 'admin') redirect('/admin');

  const [tourRes, schedulesRes] = await Promise.all([
    supabase.from('tours').select('*').eq('slug', params.slug).maybeSingle(),
    supabase.from('tour_schedules').select('id, tour_slug, season, pickup_time').eq('tour_slug', params.slug),
  ]);

  if (!tourRes.data) notFound();

  const highlightOptions = Object.entries(esMessages.highlights as Record<string, string>)
    .map(([key, label]) => ({ key, label }));
  const includeOptions = Object.entries(esMessages.tourIncludeItems as Record<string, string>)
    .map(([key, label]) => ({ key, label }));
  const excludeOptions = Object.entries(esMessages.tourExcludeItems as Record<string, string>)
    .map(([key, label]) => ({ key, label }));

  return (
    <div className="flex min-h-screen">
      <AdminSidebar userEmail={user.email ?? ''} />
      <main className="flex-1 ml-56 p-6 max-w-4xl">
        <div className="mb-6 flex items-center gap-3">
          <a href="/admin/tours" className="text-sm text-gray-400 hover:text-gray-600">← Tours</a>
        </div>
        <TourEditForm
          tour={tourRes.data as TourDetail}
          initialSchedules={(schedulesRes.data ?? []) as ScheduleRow[]}
          highlightOptions={highlightOptions}
          includeOptions={includeOptions}
          excludeOptions={excludeOptions}
        />
      </main>
    </div>
  );
}
