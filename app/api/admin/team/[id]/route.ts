import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTeamMember, hasPermission } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const member = await getCurrentTeamMember();
  if (!hasPermission(member, 'manage_team')) {
    return NextResponse.json({ error: 'No tienes permiso para gestionar el equipo' }, { status: 403 });
  }

  const body = await req.json() as {
    role?:        string;
    permissions?: Record<string, boolean>;
    active?:      boolean;
  };

  // Solo un admin puede otorgar el rol admin a otra persona (evita que un
  // admin_secondary con permiso manage_team se auto-promueva)
  if (body.role === 'admin' && member?.role !== 'admin') {
    return NextResponse.json({ error: 'Solo un admin puede asignar el rol admin' }, { status: 403 });
  }

  const update: Record<string, unknown> = {};
  if (body.role        !== undefined) update.role        = body.role;
  if (body.permissions !== undefined) update.permissions = body.permissions;
  if (body.active      !== undefined) update.active      = body.active;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
  }

  const { error } = await supabase
    .from('team_members')
    .update(update)
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const member = await getCurrentTeamMember();
  if (!hasPermission(member, 'manage_team')) {
    return NextResponse.json({ error: 'No tienes permiso para gestionar el equipo' }, { status: 403 });
  }

  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
