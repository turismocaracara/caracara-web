import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from './supabase-server';
import { supabase } from './supabase';

/**
 * Exige sesión de Supabase Auth Y que esa persona sea un team_member activo.
 * Una cuenta de Auth sin fila en team_members (huérfana, o creada fuera del
 * flujo de invite) no debe poder ver ninguna pantalla del panel — ahí hay
 * datos reales de clientes (nombre, email, teléfono, ingresos).
 */
export async function requireAdmin() {
  const client = createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect('/admin/login');

  const member = await getCurrentTeamMember();
  if (!member) redirect('/admin/login');

  return user;
}

export interface TeamMemberInfo {
  id:          string;
  name:        string;
  email:       string | null;
  role:        'admin' | 'admin_secondary' | 'guide';
  permissions: Record<string, boolean>;
}

/** Busca el team_member asociado al usuario autenticado actual (por email). */
export async function getCurrentTeamMember(): Promise<TeamMemberInfo | null> {
  const client = createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user?.email) return null;

  const { data } = await supabase
    .from('team_members')
    .select('id, name, email, role, permissions')
    .eq('email', user.email)
    .eq('active', true)
    .maybeSingle();

  return data as TeamMemberInfo | null;
}

/** Admin tiene todos los permisos implícitamente; admin_secondary solo los listados en permissions. */
export function hasPermission(member: TeamMemberInfo | null, permission: string): boolean {
  if (!member) return false;
  if (member.role === 'admin') return true;
  return !!member.permissions?.[permission];
}

/** Para Server Components: exige permiso o redirige a /admin. */
export async function requirePermission(permission: string) {
  const user   = await requireAdmin();
  const member = await getCurrentTeamMember();
  if (!hasPermission(member, permission)) redirect('/admin');
  return { user, member };
}
