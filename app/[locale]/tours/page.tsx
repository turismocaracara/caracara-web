import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/navigation';
import { CATEGORIES, type TourCategory } from '@/lib/tours';
import { supabase } from '@/lib/supabase';
import TourCard, { type CardTour } from '@/components/TourCard';

export const revalidate = 300;

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const titles: Record<string, string> = { es: 'Tours — Turismo CaraCara', en: 'Tours — Turismo CaraCara', pt: 'Tours — Turismo CaraCara' };
  const descriptions: Record<string, string> = {
    es: 'Catálogo completo de tours privados en Chile: Cajón del Maipo, Valparaíso, viñedos, trekking y aventura.',
    en: 'Full catalog of private tours in Chile: Cajón del Maipo, Valparaíso, wineries, trekking and adventure.',
    pt: 'Catálogo completo de tours privados no Chile: Cajón del Maipo, Valparaíso, vinícolas, trekking e aventura.',
  };
  return { title: titles[locale], description: descriptions[locale] };
}

async function getTours(category?: TourCategory): Promise<CardTour[]> {
  let query = supabase
    .from('tours')
    .select('slug, name_es, name_en, name_pt, category, difficulty, hide_difficulty, duration_hrs, max_pax, hide_pax, highlights')
    .eq('active', true)
    .order('name_es');
  if (category) query = query.eq('category', category);

  const [{ data }, { data: pricing }] = await Promise.all([
    query,
    supabase.from('group_pricing').select('tour_slug, price_per_person'),
  ]);

  const priceBySlug = new Map((pricing ?? []).map(p => [p.tour_slug, p.price_per_person]));
  return (data ?? []).map(t => ({ ...t, group_price: priceBySlug.get(t.slug) ?? null })) as CardTour[];
}

export default async function ToursPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams: { category?: string };
}) {
  const activeCategory = searchParams.category as TourCategory | undefined;
  const [t, ct, tours] = await Promise.all([
    getTranslations({ locale, namespace: 'tours' }),
    getTranslations({ locale, namespace: 'common' }),
    getTours(activeCategory),
  ]);

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <div className="bg-teal py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="font-display text-4xl font-bold text-white mb-2">{t('title')}</h1>
          <p className="text-white/70 text-lg">{t('subtitle')}</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-10">
        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-10">
          <Link
            href="/tours"
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              !activeCategory
                ? 'bg-teal text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            {t('filters.all')}
          </Link>
          {CATEGORIES.map((cat) => (
            <Link
              key={cat}
              href={`/tours?category=${cat}`}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-teal text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              {t(`filters.${cat}`)}
            </Link>
          ))}
        </div>

        {/* Tour grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {tours.map((tour) => (
            <TourCard key={tour.slug} tour={tour} />
          ))}
        </div>

        {tours.length === 0 && (
          <p className="text-center text-gray-500 py-20">{ct('cta.seeMore')}</p>
        )}
      </div>
    </div>
  );
}
