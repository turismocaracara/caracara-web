import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTeamMember, hasPermission } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const member = await getCurrentTeamMember();
  if (!hasPermission(member, 'manage_team')) {
    return NextResponse.json({ error: 'No tienes permiso para asignar guías' }, { status: 403 });
  }

  const body = await req.json() as {
    tour_instance_id: string;
    team_member_id:   string;
    role_in_tour:     'guide' | 'driver';
  };

  if (!body.tour_instance_id || !body.team_member_id || !body.role_in_tour) {
    return NextResponse.json(
      { error: 'tour_instance_id, team_member_id y role_in_tour son requeridos' },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from('tour_assignments')
    .upsert(
      {
        tour_instance_id: body.tour_instance_id,
        team_member_id:   body.team_member_id,
        role_in_tour:     body.role_in_tour,
      },
      { onConflict: 'tour_instance_id,role_in_tour' }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const member = await getCurrentTeamMember();
  if (!hasPermission(member, 'manage_team')) {
    return NextResponse.json({ error: 'No tienes permiso para asignar guías' }, { status: 403 });
  }

  const body = await req.json() as {
    tour_instance_id: string;
    role_in_tour:     'guide' | 'driver';
  };

  if (!body.tour_instance_id || !body.role_in_tour) {
    return NextResponse.json(
      { error: 'tour_instance_id y role_in_tour son requeridos' },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from('tour_assignments')
    .delete()
    .eq('tour_instance_id', body.tour_instance_id)
    .eq('role_in_tour', body.role_in_tour);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
