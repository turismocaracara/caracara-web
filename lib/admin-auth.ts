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
  id:                 string;
  name:               string;
  email:              string | null;
  role:               'admin' | 'admin_secondary' | 'guide';
  is_admin_secondary: boolean;
  is_guide:           boolean;
  permissions:        Record<string, boolean>;
}

/**
 * Admin secundario y guía no son excluyentes — alguien puede ser ambos a la vez
 * (ej. tiene permisos de oficina Y también sale a guiar tours puntuales). Por eso
 * viven en columnas booleanas independientes, no en el viejo `role` (que solo
 * sigue significando algo para 'admin', el rol superior y excluyente).
 */
export async function getCurrentTeamMember(): Promise<TeamMemberInfo | null> {
  const client = createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user?.email) return null;

  const { data } = await supabase
    .from('team_members')
    .select('id, name, email, role, is_admin_secondary, is_guide, permissions')
    .eq('email', user.email)
    .eq('active', true)
    .maybeSingle();

  return data as TeamMemberInfo | null;
}

/** Ve finanzas/clientes/operación general — admin, o admin secundario (con o sin el flag de guía también). */
export function isOpsViewer(member: TeamMemberInfo | null): boolean {
  return member?.role === 'admin' || !!member?.is_admin_secondary;
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
