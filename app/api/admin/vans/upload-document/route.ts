import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTeamMember, hasPermission } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';

const MAX_SIZE   = 20 * 1024 * 1024;
const ALLOWED    = ['image/jpeg','image/png','image/webp','application/pdf'];
const BUCKET     = 'van-documents';

export async function POST(req: NextRequest) {
  const member = await getCurrentTeamMember();
  if (!hasPermission(member, 'manage_vans')) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  let form: FormData;
  try { form = await req.formData(); }
  catch { return NextResponse.json({ error: 'Invalid form data' }, { status: 400 }); }

  const file  = form.get('file')   as File   | null;
  const vanId = form.get('van_id') as string | null;

  if (!file || !vanId) {
    return NextResponse.json({ error: 'file y van_id son requeridos' }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: 'Solo se permiten PDF, JPG, PNG o WEBP' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'El archivo supera el límite de 20 MB' }, { status: 400 });
  }

  const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
  const path = `${vanId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      upsert: false,
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return NextResponse.json({ url: publicUrl });
}
