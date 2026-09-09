import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentTeamMember, hasPermission } from '@/lib/admin-auth';

const BUCKET = 'booking-docs';
const MAX_MB = 20;

export async function POST(req: NextRequest) {
  const member = await getCurrentTeamMember();
  if (!hasPermission(member, 'manual_booking')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  let form: FormData;
  try { form = await req.formData(); }
  catch { return NextResponse.json({ error: 'Invalid form data' }, { status: 400 }); }

  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
  if (file.size > MAX_MB * 1024 * 1024) {
    return NextResponse.json({ error: `El archivo no puede superar ${MAX_MB} MB` }, { status: 413 });
  }

  // Ensure bucket exists (idempotent)
  await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {});

  const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${Date.now()}_${rand}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (error) {
    console.error('[upload-booking-doc]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
