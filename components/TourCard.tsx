import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import type { Tour, TourCategory, TourDifficulty } from '@/lib/tours';

const CATEGORY_COLORS: Record<TourCategory, string> = {
  cajon: 'bg-teal/10 text-teal',
  valparaiso: 'bg-blue-100 text-blue-700',
  santiago: 'bg-purple-100 text-purple-700',
  vinedos: 'bg-red-100 text-red-700',
  trekking: 'bg-green-100 text-green-700',
  aventura: 'bg-orange/10 text-orange',
};

const DIFFICULTY_STYLES: Record<TourDifficulty, { dot: string; label: string }> = {
  low:    { dot: 'bg-green-400',  label: 'text-green-700' },
  medium: { dot: 'bg-yellow-400', label: 'text-yellow-700' },
  high:   { dot: 'bg-red-400',    label: 'text-red-700' },
};

export default function TourCard({ tour }: { tour: Tour }) {
  const t = useTranslations();
  const name = t(`tourNames.${tour.slug}`);
  const categoryLabel = t(`tours.filters.${tour.category}`);
  const difficultyLabel = t(`common.difficulty.${tour.difficulty}`);
  const diff = DIFFICULTY_STYLES[tour.difficulty];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all hover:-translate-y-0.5 flex flex-col">
      {/* Color header */}
      <div className="h-3 bg-gradient-to-r from-teal to-teal-light" />

      <div className="p-5 flex flex-col gap-3 flex-1">
        {/* Top badges row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full w-fit ${CATEGORY_COLORS[tour.category]}`}>
            {categoryLabel}
          </span>
          <span className="text-xs font-medium bg-teal/8 text-teal px-2 py-0.5 rounded-full border border-teal/15">
            {t('common.privateTour')}
          </span>
        </div>

        {/* Name */}
        <h3 className="font-display text-lg font-bold text-ink leading-snug">{name}</h3>

        {/* Meta */}
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {tour.durationHours}h
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {t('common.maxPax', { n: tour.maxPax })}
          </span>
          {/* Difficulty */}
          <span className={`flex items-center gap-1 text-xs font-medium ${diff.label}`}>
            <span className={`w-2 h-2 rounded-full ${diff.dot}`} />
            {difficultyLabel}
          </span>
        </div>

        {/* Highlights */}
        <div className="flex flex-wrap gap-1.5 mt-1">
          {tour.highlights.slice(0, 3).map((h) => (
            <span key={h} className="text-xs bg-cream text-teal px-2 py-0.5 rounded-full">
              {t(`highlights.${h}`)}
            </span>
          ))}
        </div>

        {/* Price + CTA */}
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
          <span className="text-sm font-medium text-gray-500">
            {tour.price ? `$${tour.price.toLocaleString()}` : t('common.price.consult')}
          </span>
          <Link
            href={`/tours/${tour.slug}`}
            className="bg-orange hover:bg-orange-dark text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            {t('common.cta.seeMore')}
          </Link>
        </div>
      </div>
    </div>
  );
}
