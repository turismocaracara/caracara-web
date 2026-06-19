import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTeamMember } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const member = await getCurrentTeamMember();
  if (member?.role !== 'admin') {
    return NextResponse.json({ error: 'Solo un admin puede editar tours' }, { status: 403 });
  }

  const body = await req.json() as { active?: boolean };
  if (typeof body.active !== 'boolean') {
    return NextResponse.json({ error: 'Campo "active" requerido (boolean)' }, { status: 400 });
  }

  const { error } = await supabase
    .from('tours')
    .update({ active: body.active })
    .eq('slug', params.slug);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
