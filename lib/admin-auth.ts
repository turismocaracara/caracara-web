import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from './supabase-server';

export async function requireAdmin() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');
  return user;
}
