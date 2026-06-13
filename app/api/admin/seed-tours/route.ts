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

  const descEs = (messagesEs as Record<string, Record<string, string>>).tourDesc ?? {};
  const descEn = (messagesEn as Record<string, Record<string, string>>).tourDesc ?? {};
  const descPt = (messagesPt as Record<string, Record<string, string>>).tourDesc ?? {};

  const updates = TOURS.map(tour => ({
    slug:            tour.slug,
    category:        tour.category,
    difficulty:      tour.difficulty,
    hide_difficulty: tour.hideDifficulty ?? false,
    duration_hrs:    tour.durationHours,
    max_pax:         tour.maxPax,
    hide_pax:        tour.hidePax ?? false,
    highlights:      tour.highlights,
    includes_keys:   tour.includesKeys   ?? [],
    excludes_keys:   tour.excludesKeys   ?? [],
    itinerary:       tour.itinerary      ?? [],
    wine_convenios:  tour.wineConvenios  ?? [],
    images:          [],
    description_es:  descEs[tour.slug]   ?? null,
    description_en:  descEn[tour.slug]   ?? null,
    description_pt:  descPt[tour.slug]   ?? null,
  }));

  const { error } = await supabase
    .from('tours')
    .upsert(updates, { onConflict: 'slug' });

  if (error) {
    console.error('[seed-tours] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, seeded: updates.length });
}
