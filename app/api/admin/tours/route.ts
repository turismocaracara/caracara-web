import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentTeamMember } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

const NewTourSchema = z.object({
  name_es: z.string().min(2).max(120),
  name_en: z.string().max(120).nullable().optional(),
  name_pt: z.string().max(120).nullable().optional(),
  category: z.enum(['cajon', 'valparaiso', 'santiago', 'vinedos', 'trekking', 'aventura']).optional(),
});

export async function POST(req: NextRequest) {
  const member = await getCurrentTeamMember();
  if (member?.role !== 'admin') {
    return NextResponse.json({ error: 'Solo un admin puede crear tours' }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = NewTourSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 });
  }

  const baseSlug = slugify(parsed.data.name_es);
  let slug = baseSlug;

  // Ensure unique slug
  const { data: existing } = await supabase
    .from('tours')
    .select('slug')
    .like('slug', `${baseSlug}%`);

  if (existing && existing.length > 0) {
    const taken = new Set(existing.map((r: { slug: string }) => r.slug));
    let i = 2;
    while (taken.has(slug)) { slug = `${baseSlug}-${i++}`; }
  }

  const { error } = await supabase.from('tours').insert({
    slug,
    name_es: parsed.data.name_es,
    name_en: parsed.data.name_en ?? null,
    name_pt: parsed.data.name_pt ?? null,
    category: parsed.data.category ?? null,
    active: false,
    highlights: [],
    includes_keys: [],
    excludes_keys: [],
    itinerary: [],
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ slug }, { status: 201 });
}
