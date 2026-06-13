import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { TOURS } from '@/lib/tours';
import messagesEs from '@/messages/es.json';
import messagesEn from '@/messages/en.json';
import messagesPt from '@/messages/pt.json';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const msgs = {
    es: messagesEs as unknown as Record<string, Record<string, string>>,
    en: messagesEn as unknown as Record<string, Record<string, string>>,
    pt: messagesPt as unknown as Record<string, Record<string, string>>,
  };

  const nameEs = msgs.es.tourNames ?? {};
  const nameEn = msgs.en.tourNames ?? {};
  const namePt = msgs.pt.tourNames ?? {};
  const descEs = msgs.es.tourDesc  ?? {};
  const descEn = msgs.en.tourDesc  ?? {};
  const descPt = msgs.pt.tourDesc  ?? {};

  const updates = TOURS.map(tour => ({
    slug:            tour.slug,
    name_es:         nameEs[tour.slug] ?? tour.slug,
    name_en:         nameEn[tour.slug] ?? tour.slug,
    name_pt:         namePt[tour.slug] ?? tour.slug,
    category:        tour.category,
    difficulty:      tour.difficulty,
    hide_difficulty: tour.hideDifficulty ?? false,
    duration_hrs:    tour.durationHours,
    max_pax:         tour.maxPax,
    hide_pax:        tour.hidePax ?? false,
    highlights:      tour.highlights,
    includes_keys:   tour.includesKeys  ?? [],
    excludes_keys:   tour.excludesKeys  ?? [],
    itinerary:       tour.itinerary     ?? [],
    wine_convenios:  tour.wineConvenios ?? [],
    images:          [],
    description_es:  descEs[tour.slug]  ?? null,
    description_en:  descEn[tour.slug]  ?? null,
    description_pt:  descPt[tour.slug]  ?? null,
  }));

  let errorCount = 0;
  for (const { slug, name_es, name_en, name_pt, ...fields } of updates) {
    const { error } = await supabase
      .from('tours')
      .update(fields)
      .eq('slug', slug);
    if (error) {
      console.error(`[seed-tours] error updating ${slug}:`, error.message);
      errorCount++;
    }
  }

  if (errorCount > 0) {
    return NextResponse.json({ error: `${errorCount} tours fallaron al actualizar` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: updates.length });
}
