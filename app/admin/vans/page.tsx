import { requireAdmin } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';
import AdminSidebar from '@/components/admin/AdminSidebar';
import VansManager, { type VanRow, type VanBlockRow } from '@/components/admin/VansManager';

export default async function VansPage() {
  const user = await requireAdmin();

  const today = new Date().toISOString().slice(0, 10);

  const [vansRes, blocksRes] = await Promise.all([
    supabase.from('vans').select('id, name, capacity, plate, active').order('name'),
    supabase
      .from('van_blocks')
      .select('id, van_id, date, reason')
      .gte('date', today)
      .order('date'),
  ]);

  const vans:   VanRow[]      = (vansRes.data   ?? []) as VanRow[];
  const blocks: VanBlockRow[] = (blocksRes.data  ?? []) as VanBlockRow[];

  return (
    <div className="flex min-h-screen">
      <AdminSidebar userEmail={user.email ?? ''} />
      <main className="flex-1 ml-56 p-6 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Vans</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Gestión de flota y bloqueos por mantención o uso personal
          </p>
        </div>

        <VansManager vans={vans} initialBlocks={blocks} />
      </main>
    </div>
  );
}
