import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link } from '@/navigation';
import { getTourBySlug, TOURS, type TourCategory } from '@/lib/tours';
import BookingForm from '@/components/BookingForm';

export async function generateMetadata({ params: { locale, slug } }: { params: { locale: string; slug: string } }): Promise<Metadata> {
  const tour = getTourBySlug(slug);
  if (!tour) return {};
  const t = await getTranslations({ locale, namespace: 'tourNames' });
  const td = await getTranslations({ locale, namespace: 'tourDesc' });
  const name = t(slug);
  const desc = td(slug).slice(0, 155);
  return {
    title: `${name} — Turismo CaraCara`,
    description: desc,
    openGraph: { title: name, description: desc, type: 'website' },
  };
}

const CATEGORY_LABELS: Record<TourCategory, string> = {
  cajon: 'Cajón del Maipo',
  valparaiso: 'Valparaíso',
  santiago: 'Santiago',
  vinedos: 'Viñedos',
  trekking: 'Trekking',
  aventura: 'Aventura',
};

const DIFFICULTY_STYLES = {
  low:    { dot: 'bg-green-400',  text: 'text-green-300' },
  medium: { dot: 'bg-yellow-400', text: 'text-yellow-300' },
  high:   { dot: 'bg-red-400',    text: 'text-red-300' },
};

export function generateStaticParams() {
  return TOURS.map((t) => ({ slug: t.slug }));
}

export default function TourDetailPage({ params }: { params: { slug: string; locale: string } }) {
  const tour = getTourBySlug(params.slug);
  if (!tour) notFound();

  const t = useTranslations();
  const tourName = t(`tourNames.${tour.slug}`);
  const description = t(`tourDesc.${tour.slug}`);

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
            <span className="text-xs font-semibold bg-orange/20 text-orange-light border border-orange/30 px-3 py-1 rounded-full">
              {CATEGORY_LABELS[tour.category]}
            </span>
            <span className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-white/10 ${DIFFICULTY_STYLES[tour.difficulty].text}`}>
              <span className={`w-2 h-2 rounded-full ${DIFFICULTY_STYLES[tour.difficulty].dot}`} />
              {t(`common.difficulty.${tour.difficulty}`)}
            </span>
            <span className="text-xs font-medium bg-white/10 text-white/80 px-3 py-1 rounded-full">
              {t('common.privateTour')}
            </span>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-white mb-4">
            {tourName}
          </h1>
          <div className="flex flex-wrap gap-6 text-white/70 text-sm">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {t('common.duration')}: {tour.durationHours}h
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              {t('common.maxPax', { n: tour.maxPax })}
            </span>
            <span className="text-orange font-medium">
              {tour.price ? `$${tour.price.toLocaleString()} CLP` : t('common.price.consult')}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Left: content */}
          <div className="lg:col-span-2 flex flex-col gap-8">
            {/* Description */}
            <div>
              <p className="text-gray-700 text-lg leading-relaxed font-display italic">
                {description}
              </p>
            </div>

            {/* Highlights */}
            <div>
              <h2 className="font-semibold text-ink text-lg mb-4">{t('common.highlights')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {tour.highlights.map((h) => (
                  <div key={h} className="flex items-center gap-2 bg-white rounded-xl px-4 py-3 text-sm text-gray-700">
                    <span className="w-2 h-2 bg-orange rounded-full flex-shrink-0" />
                    {t(`highlights.${h}`)}
                  </div>
                ))}
              </div>
            </div>

            {/* Wineries */}
            {tour.wineConvenios && tour.wineConvenios.length > 0 && (
              <div>
                <h2 className="font-semibold text-ink text-lg mb-4">{t('common.wineries')}</h2>
                <div className="flex flex-wrap gap-2">
                  {tour.wineConvenios.map((w) => (
                    <span key={w} className="bg-red-50 text-red-700 border border-red-100 text-sm px-3 py-1 rounded-full">
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: booking form */}
          <div>
            <div className="bg-white rounded-2xl shadow-sm p-6 sticky top-24">
              <h2 className="font-display text-xl font-bold text-ink mb-1">
                {t('booking.title', { tourName })}
              </h2>
              <p className="text-sm text-gray-500 mb-5">{t('booking.subtitle')}</p>
              <BookingForm tourName={tourName} tourSlug={tour.slug} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
