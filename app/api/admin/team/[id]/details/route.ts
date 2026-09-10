import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTeamMember, hasPermission } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const member = await getCurrentTeamMember();
  if (!hasPermission(member, 'manage_team')) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  const { data: docs } = await supabase
    .from('member_documents')
    .select('id, type, expires_at, notes, file_url, updated_at')
    .eq('member_id', params.id);

  return NextResponse.json({ documents: docs ?? [] });
}
