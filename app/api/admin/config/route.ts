import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTeamMember } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';

export async function PATCH(req: NextRequest) {
  const member = await getCurrentTeamMember();
  if (member?.role !== 'admin') {
    return NextResponse.json({ error: 'Solo un admin puede editar la configuración' }, { status: 403 });
  }

  const body = await req.json() as { key: string; value: unknown };
  if (!body.key || body.value === undefined) {
    return NextResponse.json({ error: 'key y value son requeridos' }, { status: 400 });
  }

  const { error } = await supabase
    .from('config')
    .upsert({ key: body.key, value: body.value, updated_at: new Date().toISOString() });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
