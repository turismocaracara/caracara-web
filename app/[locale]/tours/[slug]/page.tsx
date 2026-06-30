import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link } from '@/navigation';
import { supabase } from '@/lib/supabase';
import BookingForm from '@/components/BookingForm';

export const revalidate = 300;

interface TourRow {
  slug: string;
  name_es: string; name_en: string | null; name_pt: string | null;
  description_es: string | null; description_en: string | null; description_pt: string | null;
  category: string | null;
  difficulty: string | null;
  hide_difficulty: boolean | null;
  duration_hrs: number | null;
  highlights: string[];
  includes_keys: string[];
  excludes_keys: string[];
  itinerary: { time: string; place: string; isLunch?: boolean }[];
  images: string[] | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  cajon:      'Cajón del Maipo',
  valparaiso: 'Valparaíso',
  santiago:   'Santiago',
  vinedos:    'Viñedos',
  trekking:   'Trekking',
  aventura:   'Aventura',
};

const DIFFICULTY_STYLES: Record<string, { dot: string; text: string }> = {
  low:    { dot: 'bg-green-400',  text: 'text-green-300' },
  medium: { dot: 'bg-yellow-400', text: 'text-yellow-300' },
  high:   { dot: 'bg-red-400',    text: 'text-red-300' },
};

function fmtCLP(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
}

async function getTourFromDB(slug: string): Promise<TourRow | null> {
  const { data } = await supabase
    .from('tours')
    .select(`
      slug, name_es, name_en, name_pt,
      description_es, description_en, description_pt,
      category, difficulty, hide_difficulty,
      duration_hrs, highlights, includes_keys, excludes_keys,
      itinerary, images, active
    `)
    .eq('slug', slug)
    .eq('active', true)
    .single();

  return data as TourRow | null;
}

async function getPricingFromDB(slug: string) {
  const [groupRes, privateRes] = await Promise.all([
    supabase.from('group_pricing').select('price_per_person').eq('tour_slug', slug).maybeSingle(),
    supabase.from('private_pricing').select('pax_min, pax_max, price_per_person').eq('tour_slug', slug).order('pax_min'),
  ]);
  return {
    groupPrice:     groupRes.data?.price_per_person ?? undefined,
    privatePricing: privateRes.data?.map(r => ({ paxMin: r.pax_min, paxMax: r.pax_max, price: r.price_per_person })) ?? undefined,
  };
}

export async function generateMetadata(
  { params: { locale, slug } }: { params: { locale: string; slug: string } }
): Promise<Metadata> {
  const tour = await getTourFromDB(slug);
  if (!tour) return {};
  const name = locale === 'en' ? (tour.name_en ?? tour.name_es)
             : locale === 'pt' ? (tour.name_pt ?? tour.name_es)
             : tour.name_es;
  const desc = (locale === 'en' ? tour.description_en : locale === 'pt' ? tour.description_pt : tour.description_es) ?? '';
  return {
    title:       `${name} — Turismo CaraCara`,
    description: desc.slice(0, 155),
    openGraph:   { title: name, description: desc.slice(0, 155), type: 'website' },
  };
}

export async function generateStaticParams() {
  const { data } = await supabase.from('tours').select('slug').eq('active', true);
  return (data ?? []).map(t => ({ slug: t.slug }));
}

export default async function TourDetailPage(
  { params }: { params: { slug: string; locale: string } }
) {
  const { slug, locale } = params;
  const [tour, pricing, t] = await Promise.all([
    getTourFromDB(slug),
    getPricingFromDB(slug),
    getTranslations({ locale }),
  ]);

  if (!tour) notFound();

  const tourName = locale === 'en' ? (tour.name_en ?? tour.name_es)
                 : locale === 'pt' ? (tour.name_pt ?? tour.name_es)
                 : tour.name_es;

  const description = locale === 'en' ? (tour.description_en ?? tour.description_es ?? '')
                    : locale === 'pt' ? (tour.description_pt ?? tour.description_es ?? '')
                    : (tour.description_es ?? '');

  const difficulty  = tour.difficulty ?? 'medium';
  const diffStyle   = DIFFICULTY_STYLES[difficulty] ?? DIFFICULTY_STYLES.medium;

  const minPrice = pricing.groupPrice
    ?? pricing.privatePricing?.reduce((min, tier) => Math.min(min, tier.price), Infinity)
    ?? null;

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <div className="bg-teal py-16">
        <div className="max-w-6xl mx-auto px-4">
          <Link
            href="/tours"
            className="inline-flex items-center gap-1 text-white/60 hover:text-white text-sm mb-4 transition-colors"
          >
            ← {t('common.cta.back')}
          </Link>
          <div className="flex items-center gap-2 mb-3">
            {tour.category && (
              <span className="text-xs font-semibold bg-orange/20 text-orange-light border border-orange/30 px-3 py-1 rounded-full">
                {CATEGORY_LABELS[tour.category] ?? tour.category}
              </span>
            )}
            {!tour.hide_difficulty && (
              <span className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-white/10 ${diffStyle.text}`}>
                <span className={`w-2 h-2 rounded-full ${diffStyle.dot}`} />
                {t(`common.difficulty.${difficulty}`)}
              </span>
            )}
            <span className="text-xs font-medium bg-white/10 text-white/80 px-3 py-1 rounded-full">
              {t('common.privateTour')}
            </span>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-white mb-4">
            {tourName}
          </h1>
          <div className="flex flex-wrap gap-6 text-white/70 text-sm">
            {tour.duration_hrs && (
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t('common.duration')}: {tour.duration_hrs}h
              </span>
            )}
            {minPrice !== null && minPrice !== Infinity ? (
              <span className="text-orange font-medium">
                {t('common.from')} {fmtCLP(minPrice)} {t('common.price.perPerson')}
              </span>
            ) : (
              <span className="text-orange font-medium">{t('common.price.consult')}</span>
            )}
          </div>
        </div>
      </div>

      {/* Photos */}
      <div className="bg-teal/5 border-b border-teal/10">
        <div className="max-w-6xl mx-auto px-4 py-6">
          {tour.images && tour.images.length > 0 ? (
            <div className="grid grid-cols-3 gap-2 h-52 sm:h-72 rounded-2xl overflow-hidden">
              {/* Main image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={tour.images[0]}
                alt={tourName}
                className="col-span-2 w-full h-full object-cover rounded-l-2xl"
              />
              {/* Up to 2 thumbnails */}
              <div className="flex flex-col gap-2">
                {tour.images[1] ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={tour.images[1]}
                    alt=""
                    className="flex-1 w-full object-cover rounded-tr-2xl"
                  />
                ) : (
                  <div className="flex-1 bg-gradient-to-br from-orange/10 to-orange/5 rounded-tr-2xl" />
                )}
                {tour.images[2] ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={tour.images[2]}
                    alt=""
                    className="flex-1 w-full object-cover rounded-br-2xl"
                  />
                ) : (
                  <div className="flex-1 bg-gradient-to-br from-teal/15 to-teal/5 rounded-br-2xl" />
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 h-52 sm:h-72 rounded-2xl overflow-hidden">
              <div className="col-span-2 bg-gradient-to-br from-teal/20 to-teal/10 rounded-l-2xl flex items-center justify-center">
                <div className="text-center text-teal/40">
                  <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm font-medium">Fotos próximamente</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex-1 bg-gradient-to-br from-orange/10 to-orange/5 rounded-tr-2xl" />
                <div className="flex-1 bg-gradient-to-br from-teal/15 to-teal/5 rounded-br-2xl" />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

          {/* Left: content */}
          <div className="lg:col-span-2 flex flex-col gap-8">

            {/* Description */}
            {description && (
              <div>
                <p className="text-gray-700 text-lg leading-relaxed font-display italic">
                  {description}
                </p>
              </div>
            )}

            {/* Itinerary */}
            {tour.itinerary && tour.itinerary.length > 0 && (
              <div>
                <h2 className="font-semibold text-ink text-lg mb-5">{t('common.itinerary')}</h2>
                <div className="relative pl-2">
                  <div className="absolute left-[67px] top-5 bottom-5 w-px bg-gray-200" aria-hidden="true" />
                  <div className="flex flex-col gap-3">
                    {tour.itinerary.map((stop, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <span className="w-12 text-right text-xs font-mono font-semibold text-gray-400 flex-shrink-0">
                          {stop.time}
                        </span>
                        <div className="relative z-10 flex-shrink-0">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center bg-white ${stop.isLunch ? 'border-orange' : 'border-teal'}`}>
                            <div className={`w-2 h-2 rounded-full ${stop.isLunch ? 'bg-orange' : 'bg-teal'}`} />
                          </div>
                        </div>
                        <div className={`flex-1 rounded-xl px-4 py-2.5 flex items-center justify-between ${stop.isLunch ? 'bg-orange/5 border border-orange/20' : 'bg-white border border-gray-100'}`}>
                          <p className={`text-sm font-medium ${stop.isLunch ? 'text-orange-700' : 'text-gray-800'}`}>
                            {stop.place}
                          </p>
                          {stop.isLunch && (
                            <span className="text-xs bg-orange/10 text-orange-600 font-medium px-2 py-0.5 rounded-full ml-3 flex-shrink-0">
                              {t('common.lunch')}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Includes / Excludes */}
            {((tour.includes_keys?.length > 0) || (tour.excludes_keys?.length > 0)) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {tour.includes_keys?.length > 0 && (
                  <div className="bg-green-50 border border-green-100 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {t('common.includes')}
                    </h3>
                    <ul className="flex flex-col gap-2">
                      {tour.includes_keys.map(key => (
                        <li key={key} className="flex items-start gap-2 text-sm text-green-700">
                          <svg className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          {key.startsWith('custom:') ? key.slice(7) : t(`tourIncludeItems.${key}`)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {tour.excludes_keys?.length > 0 && (
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      {t('common.tourExcludes')}
                    </h3>
                    <ul className="flex flex-col gap-2">
                      {tour.excludes_keys.map(key => (
                        <li key={key} className="flex items-start gap-2 text-sm text-gray-500">
                          <svg className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          {key.startsWith('custom:') ? key.slice(7) : t(`tourExcludeItems.${key}`)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Highlights */}
            {tour.highlights?.length > 0 && (
              <div>
                <h2 className="font-semibold text-ink text-lg mb-4">{t('common.highlights')}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {tour.highlights.map(h => (
                    <div key={h} className="flex items-center gap-2 bg-white rounded-xl px-4 py-3 text-sm text-gray-700">
                      <span className="w-2 h-2 bg-orange rounded-full flex-shrink-0" />
                      {h.startsWith('custom:') ? h.slice(7) : t(`highlights.${h}`)}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Right: pricing + booking */}
          <div className="flex flex-col gap-4">

            {/* Pricing card */}
            {(pricing.groupPrice !== undefined || pricing.privatePricing) && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                  {t('common.prices')}
                </h2>
                {pricing.groupPrice !== undefined && (
                  <div className={`${pricing.privatePricing ? 'mb-4 pb-4 border-b border-gray-100' : ''}`}>
                    <p className="text-xs text-gray-400 mb-1">{t('common.group')}</p>
                    <p className="text-2xl font-bold text-ink">
                      {fmtCLP(pricing.groupPrice)}
                      <span className="text-sm font-normal text-gray-400 ml-1">{t('common.price.perPerson')}</span>
                    </p>
                  </div>
                )}
                {pricing.privatePricing && (
                  <div>
                    <p className="text-xs text-gray-400 mb-3">{t('common.private')}</p>
                    <div className="flex flex-col gap-2">
                      {pricing.privatePricing.map(tier => (
                        <div key={tier.paxMin} className="flex items-center justify-between py-1">
                          <span className="text-sm text-gray-600">
                            {tier.paxMin}–{tier.paxMax} {t('common.people')}
                          </span>
                          <span className="text-sm font-semibold text-ink">
                            {fmtCLP(tier.price)}{' '}
                            <span className="text-xs text-gray-400 font-normal">{t('common.price.perPerson')}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Booking form */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sticky top-24">
              <h2 className="font-display text-xl font-bold text-ink mb-1">
                {t('booking.title', { tourName })}
              </h2>
              <p className="text-sm text-gray-500 mb-5">{t('booking.subtitle')}</p>
              <BookingForm
                tourName={tourName}
                tourSlug={tour.slug}
                groupPrice={pricing.groupPrice}
                privatePricing={pricing.privatePricing}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
