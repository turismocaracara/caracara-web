import { requireAdmin } from '@/lib/admin-auth';
import AdminSidebar from '@/components/admin/AdminSidebar';

export default async function VansPage() {
  const user = await requireAdmin();
  return (
    <div className="flex min-h-screen">
      <AdminSidebar userEmail={user.email ?? ''} />
      <main className="flex-1 ml-56 p-6">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Vans</h1>
        <p className="text-sm text-gray-500">Próximamente — gestión de vans y bloqueos.</p>
      </main>
    </div>
  );
}
