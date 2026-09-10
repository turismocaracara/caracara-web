import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { getCurrentTeamMember } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB antes de procesar
const ALLOWED_TYPES  = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(req: NextRequest) {
  const member = await getCurrentTeamMember();
  if (member?.role !== 'admin') {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ error: 'Formato inválido' }, { status: 400 }); }

  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Sin archivo' }, { status: 400 });

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Solo se aceptan imágenes JPG, PNG, WEBP o GIF' }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'El archivo supera el límite de 20 MB' }, { status: 400 });
  }

  const raw = Buffer.from(await file.arrayBuffer());

  // GIFs animados se suben sin procesar para no perder la animación
  let processed: Buffer;
  let contentType: string;
  if (file.type === 'image/gif') {
    processed   = raw;
    contentType = 'image/gif';
  } else {
    // Redimensionar a máx 1920×1080 conservando proporción (nunca agranda)
    // y convertir a WebP para reducir peso ~40-60 %
    processed = await sharp(raw)
      .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    contentType = 'image/webp';
  }

  const ext      = contentType === 'image/gif' ? 'gif' : 'webp';
  const filename = `tours/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage
    .from('tour-images')
    .upload(filename, processed, { contentType, upsert: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: { publicUrl } } = supabase.storage
    .from('tour-images')
    .getPublicUrl(filename);

  return NextResponse.json({ url: publicUrl });
}
