import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabase } from '@/lib/supabase';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const authClient = createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
