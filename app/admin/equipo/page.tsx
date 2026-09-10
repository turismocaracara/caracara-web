import { redirect } from 'next/navigation';
import { requireAdmin, getCurrentTeamMember, hasPermission } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';
import AdminSidebar from '@/components/admin/AdminSidebar';
import EquipoManager, { type TeamMemberRow } from '@/components/admin/EquipoManager';

export default async function EquipoPage() {
  const user   = await requireAdmin();
  const member = await getCurrentTeamMember();
  if (!hasPermission(member, 'manage_team')) redirect('/admin');

  const canViewFinancials = member?.role === 'admin' || hasPermission(member, 'view_financials');

  const { data, error } = await supabase
    .from('team_members')
    .select(
      'id, name, email, role, is_admin_secondary, is_guide, permissions, active, created_at,' +
      'phone, emergency_name, emergency_phone, rut, birthdate, address, civil_status,' +
      'blood_type, allergies, notes, languages, license_class, courses,' +
      'employment_type, contract_type, contract_start, contract_end,' +
      'afp, health_insurance_type, health_insurance_name, honorarios_payment_type,' +
      'salary_base, has_bonus, bonus_description, honorarios_rate_per_tour,' +
      'bank_name, bank_account_type, bank_account_number'
    )
    .order('created_at');

  const members = (data ?? []) as unknown as TeamMemberRow[];

  return (
    <div className="flex min-h-screen">
      <AdminSidebar userEmail={user.email ?? ''} />
      <main className="flex-1 ml-56 p-6 max-w-5xl">
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
          canViewFinancials={canViewFinancials}
        />
      </main>
    </div>
  );
}
