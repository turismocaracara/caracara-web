import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { getCurrentTeamMember, hasPermission, isOpsViewer } from '@/lib/admin-auth';

const Schema = z.object({
  name:  z.string().min(2).max(200),
  type:  z.enum(['guide', 'agency']),
  phone: z.string().max(30).nullable().optional(),
  email: z.string().email().nullable().optional(),
  rut:   z.string().max(20).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export async function GET() {
  const member = await getCurrentTeamMember();
  if (!isOpsViewer(member)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  const { data, error } = await supabase
    .from('service_providers')
    .select('id, name, type, phone, email, rut, notes')
    .eq('active', true)
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const member = await getCurrentTeamMember();
  if (!hasPermission(member, 'manual_booking')) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 422 });

  const { data, error } = await supabase
    .from('service_providers')
    .insert(parsed.data)
    .select('id, name, type, phone, email, rut, notes')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
