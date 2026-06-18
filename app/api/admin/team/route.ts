import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabase } from '@/lib/supabase';

const VALID_ROLES = ['admin', 'admin_secondary', 'guide'] as const;
type Role = typeof VALID_ROLES[number];

export async function POST(req: NextRequest) {
  const authClient = createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    email: string;
    name:  string;
    role:  Role;
    permissions?: Record<string, boolean>;
  };

  if (!body.email || !body.name || !VALID_ROLES.includes(body.role)) {
    return NextResponse.json({ error: 'email, name y role son requeridos' }, { status: 400 });
  }

  // Invitar al usuario vía Supabase Auth (le llega un email con link de activación)
  const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
    body.email,
    { data: { name: body.name } }
  );

  if (inviteError) {
    // Si el usuario ya existe en auth, continuar igual
    if (!inviteError.message.includes('already been registered')) {
      return NextResponse.json({ error: inviteError.message }, { status: 500 });
    }
  }

  // Crear registro en team_members
  const { data, error } = await supabase
    .from('team_members')
    .insert({
      user_id:     inviteData?.user?.id ?? null,
      name:        body.name,
      email:       body.email,
      role:        body.role,
      permissions: body.permissions ?? {},
      active:      true,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
