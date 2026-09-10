import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTeamMember, hasPermission } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const member = await getCurrentTeamMember();
  if (!hasPermission(member, 'manage_vans')) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  const { id } = params;

  const [docs, odo, maint, fuel, tags, tours] = await Promise.all([
    supabase
      .from('van_documents')
      .select('id, type, expires_at, issuer, policy_number, notes, updated_at')
      .eq('van_id', id),

    supabase
      .from('van_odometer')
      .select('id, km, recorded_at, notes')
      .eq('van_id', id)
      .order('recorded_at', { ascending: false })
      .limit(20),

    supabase
      .from('van_maintenance')
      .select('id, date, type, description, cost, workshop, km_at, next_km')
      .eq('van_id', id)
      .order('date', { ascending: false })
      .limit(30),

    supabase
      .from('van_fuel')
      .select('id, date, liters, cost, km_at, station')
      .eq('van_id', id)
      .order('date', { ascending: false })
      .limit(30),

    supabase
      .from('van_tag_costs')
      .select('id, month, cost, notes')
      .eq('van_id', id)
      .order('month', { ascending: false })
      .limit(24),

    supabase
      .from('tour_instances')
      .select('id, date, status, tour_slug, tours(name_es)')
      .eq('van_id', id)
      .order('date', { ascending: false })
      .limit(20),
  ]);

  return NextResponse.json({
    documents:   docs.data   ?? [],
    odometer:    odo.data    ?? [],
    maintenance: maint.data  ?? [],
    fuel:        fuel.data   ?? [],
    tags:        tags.data   ?? [],
    tours:       tours.data  ?? [],
  });
}
