import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentTeamMember, hasPermission } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  const member = await getCurrentTeamMember();
  if (!hasPermission(member, 'isOpsViewer')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 3) return NextResponse.json([], { status: 200 });

  // Busca por email exacto, RUT/pasaporte exacto, o nombre parcial (ilike)
  const isEmail = q.includes('@');
  const looksLikeDoc = /^[\d\-\.kK]+$/.test(q);

  let query = supabase
    .from('clients')
    .select('id, name, email, phone, country, id_type, id_number, birth_date')
    .limit(8)
    .order('name');

  if (isEmail) {
    query = query.ilike('email', `%${q}%`);
  } else if (looksLikeDoc) {
    query = query.ilike('id_number', `%${q}%`);
  } else {
    query = query.ilike('name', `%${q}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json([], { status: 200 });

  return NextResponse.json(data ?? []);
}
