import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentTeamMember } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';

const ItineraryStopSchema = z.object({
  time:    z.string().max(20),
  place:   z.string().max(160),
  isLunch: z.boolean().optional(),
  // Solo tiene sentido en la primera parada — dirección geolocalizable usada
  // para calcular el horario de pickup personalizado (ver lib/pickup-route.ts).
  address: z.string().max(200).optional(),
});

const TourUpdateSchema = z.object({
  active:          z.boolean().optional(),
  name_es:         z.string().min(2).max(120).optional(),
  name_en:         z.string().max(120).nullable().optional(),
  name_pt:         z.string().max(120).nullable().optional(),
  description_es:  z.string().max(3000).nullable().optional(),
  description_en:  z.string().max(3000).nullable().optional(),
  description_pt:  z.string().max(3000).nullable().optional(),
  category:        z.enum(['cajon', 'valparaiso', 'santiago', 'vinedos', 'trekking', 'aventura']).optional(),
  difficulty:      z.enum(['low', 'medium', 'high']).nullable().optional(),
  hide_difficulty: z.boolean().optional(),
  duration_hrs:    z.number().int().min(1).max(24).nullable().optional(),
  max_pax:         z.number().int().min(1).max(18).nullable().optional(),
  hide_pax:        z.boolean().optional(),
  highlights:      z.array(z.string()).max(20).optional(),
  includes_keys:   z.array(z.string()).max(20).optional(),
  excludes_keys:   z.array(z.string()).max(20).optional(),
  itinerary:       z.array(ItineraryStopSchema).max(20).optional(),
  wine_convenios:  z.array(z.string().max(80)).max(30).optional(),
  images:          z.array(z.string().max(500)).max(20).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const member = await getCurrentTeamMember();
  if (member?.role !== 'admin') {
    return NextResponse.json({ error: 'Solo un admin puede editar tours' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = TourUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 });
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'Sin campos para actualizar' }, { status: 400 });
  }

  const { error } = await supabase
    .from('tours')
    .update(parsed.data)
    .eq('slug', params.slug);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
