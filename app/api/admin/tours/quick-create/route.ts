import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { getCurrentTeamMember, hasPermission } from '@/lib/admin-auth';

const Schema = z.object({
  name_es: z.string().min(2).max(200),
});

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
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
  if (!parsed.success) {
    return NextResponse.json({ error: 'Nombre inválido' }, { status: 422 });
  }

  const name_es = parsed.data.name_es.trim();
  let slug = toSlug(name_es);

  // Garantizar slug único — si colisiona agrega sufijo numérico
  const { data: existing } = await supabase
    .from('tours')
    .select('slug')
    .like('slug', `${slug}%`);

  if (existing && existing.length > 0) {
    const taken = new Set(existing.map((t: { slug: string }) => t.slug));
    if (taken.has(slug)) {
      let i = 2;
      while (taken.has(`${slug}-${i}`)) i++;
      slug = `${slug}-${i}`;
    }
  }

  const { data, error } = await supabase
    .from('tours')
    .insert({ slug, name_es, active: true, has_picnic: false })
    .select('slug, name_es, has_picnic, duration_hours')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
