import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/navigation';
import { CATEGORIES, type TourCategory } from '@/lib/tours';
import { supabase } from '@/lib/supabase';
import TourCard, { type CardTour } from '@/components/TourCard';
import AnimateIn from '@/components/AnimateIn';

export const revalidate = 300;

async function getFeaturedTours(): Promise<CardTour[]> {
  const { data } = await supabase
    .from('tours')
    .select('slug, name_es, name_en, name_pt, category, difficulty, hide_difficulty, duration_hrs, max_pax, hide_pax, highlights')
    .eq('active', true)
    .order('name_es');
  const tours = (data ?? []) as CardTour[];
  return tours.filter((_, i) => i % 4 === 0).slice(0, 3);
}

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const descriptions: Record<string, string> = {
    es: 'Tours privados en la zona central de Chile. Cajón del Maipo, Valparaíso, viñedos y más. Guías expertos en español, inglés y portugués.',
    en: 'Private tours in central Chile. Cajón del Maipo, Valparaíso, wineries and more. Expert guides in Spanish, English and Portuguese.',
    pt: 'Tours privados na zona central do Chile. Cajón del Maipo, Valparaíso, vinícolas e mais. Guias especialistas em espanhol, inglês e português.',
  };
  return {
    title: 'Turismo CaraCara — We make it happen',
    description: descriptions[locale] ?? descriptions.es,
    openGraph: {
      title: 'Turismo CaraCara',
      description: descriptions[locale] ?? descriptions.es,
      siteName: 'Turismo CaraCara',
      locale,
      type: 'website',
    },
  };
}

const CATEGORY_GRADIENTS: Record<TourCategory, string> = {
  cajon:      'from-teal to-teal-light',
  valparaiso: 'from-blue-600 to-blue-400',
  santiago:   'from-purple-700 to-purple-500',
  vinedos:    'from-red-800 to-red-500',
  trekking:   'from-green-700 to-green-500',
  aventura:   'from-orange to-orange-light',
};

const CATEGORY_ICONS: Record<TourCategory, React.ReactNode> = {
  cajon: (
    <svg className="w-14 h-14 text-white/90" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 20h18M3 20l5.5-11 4 6 3-4.5L22 20" />
    </svg>
  ),
  valparaiso: (
    <svg className="w-14 h-14 text-white/90" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3a2 2 0 110 4 2 2 0 010-4zm0 4v13M5.5 11h13M7.5 20.5c0-3 9-3 9 0" />
    </svg>
  ),
  santiago: (
    <svg className="w-14 h-14 text-white/90" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21V11l4-4v14M9 21V7l4-4 4 4v14M17 21v-8l3 2v6" />
    </svg>
  ),
  vinedos: (
    <svg className="w-14 h-14 text-white/90" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h10l2 7a7 7 0 01-14 0L7 3zM12 17v4M9 21h6" />
    </svg>
  ),
  trekking: (
    <svg className="w-14 h-14 text-white/90" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm-1.5 4l-2 5.5 3 1.5 2 6h2l-2-6 1.5-2-1-5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 20H6l2-5" />
    </svg>
  ),
  aventura: (
    <svg className="w-14 h-14 text-white/90" fill="currentColor" viewBox="0 0 24 24">
      <path d="M13 2L3 14h7.5l-1.5 8L20 10h-7.5L13 2z" />
    </svg>
  ),
};

const WHY_ICONS = [
  // Guide / storyteller
  <svg key="1" className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M9 11V5a3 3 0 016 0v6" />
  </svg>,
  // Private / shield
  <svg key="2" className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>,
  // Wineries / wine glass
  <svg key="3" className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h10l2 7a7 7 0 01-14 0L7 3zM12 17v4M9 21h6" />
  </svg>,
  // Languages / globe
  <svg key="4" className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
  </svg>,
];

async function HomePage({ params: { locale } }: { params: { locale: string } }) {
  const [t, ct, featured] = await Promise.all([
    getTranslations({ locale, namespace: 'home' }),
    getTranslations({ locale, namespace: 'common' }),
    getFeaturedTours(),
  ]);

  return (
    <>
      {/* HERO */}
      <section
        className="relative min-h-[92vh] flex items-center overflow-hidden -mt-16"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1920&q=70')",
          backgroundSize: 'cover',
          backgroundPosition: 'center 40%',
        }}
      >
        {/* Gradient overlay: opaque left → semi-transparent right */}
        <div className="absolute inset-0 bg-gradient-to-r from-teal/95 via-teal/88 to-teal/55" />

        <div className="relative z-10 max-w-6xl mx-auto px-4 py-20 flex flex-col gap-6">
          <div className="inline-flex items-center gap-2 bg-orange/20 text-orange-light border border-orange/30 rounded-full px-4 py-1.5 text-sm font-medium w-fit">
            Tours privados · Santiago, Chile
          </div>

          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight max-w-3xl">
            {t('hero.headline')}
            <br />
            <span className="text-orange">{t('hero.headline2')}</span>
          </h1>

          <p className="text-white/75 text-lg max-w-xl">{t('hero.sub')}</p>

          <div className="flex flex-wrap gap-4 mt-2">
            <Link
              href="/tours"
              className="bg-orange hover:bg-orange-dark text-white font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              {t('hero.cta1')}
            </Link>
            <a
              href="https://wa.me/56991384957"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white/10 hover:bg-white/20 text-white border border-white/25 font-semibold px-6 py-3 rounded-xl transition-colors backdrop-blur-sm"
            >
              {t('hero.cta2')}
            </a>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/15 max-w-xs">
            <div>
              <div className="text-orange font-bold text-2xl">14</div>
              <div className="text-white/60 text-xs">viñas convenio</div>
            </div>
            <div>
              <div className="text-orange font-bold text-2xl">25+</div>
              <div className="text-white/60 text-xs">tours</div>
            </div>
            <div>
              <div className="text-orange font-bold text-2xl">3</div>
              <div className="text-white/60 text-xs">idiomas</div>
            </div>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <svg className="w-6 h-6 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="bg-cream py-20">
        <div className="max-w-6xl mx-auto px-4">
          <AnimateIn>
            <div className="text-center mb-12">
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-ink mb-3">
                {t('categories.title')}
              </h2>
              <p className="text-gray-500 text-lg">{t('categories.subtitle')}</p>
            </div>
          </AnimateIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {CATEGORIES.map((cat, i) => (
              <AnimateIn key={cat} delay={i * 80}>
                <Link
                  href={`/tours?category=${cat}`}
                  className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 block"
                >
                  {/* Visual header with icon */}
                  <div className={`h-36 bg-gradient-to-br ${CATEGORY_GRADIENTS[cat]} flex items-center justify-center relative overflow-hidden`}>
                    <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-white/10 rounded-full" />
                    <div className="absolute -left-3 -top-3 w-16 h-16 bg-white/10 rounded-full" />
                    <div className="relative z-10">{CATEGORY_ICONS[cat]}</div>
                  </div>
                  {/* Text */}
                  <div className="p-5">
                    <h3 className="font-display text-xl font-bold text-ink mb-1 group-hover:text-teal transition-colors">
                      {t(`categories.${cat}`)}
                    </h3>
                    <p className="text-gray-500 text-sm leading-relaxed">{t(`categories.${cat}Desc`)}</p>
                    <span className="inline-block mt-3 text-orange text-sm font-semibold">
                      {ct('cta.seeTours')} →
                    </span>
                  </div>
                </Link>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* WHY US */}
      <section className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-4">
          <AnimateIn>
            <div className="text-center mb-12">
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-ink">
                {t('why.title')}
              </h2>
            </div>
          </AnimateIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <AnimateIn key={i} delay={(i - 1) * 100}>
                <div className="flex flex-col gap-4 p-6 bg-cream rounded-2xl h-full">
                  <div className="w-12 h-12 bg-teal rounded-xl flex items-center justify-center flex-shrink-0">
                    {WHY_ICONS[i - 1]}
                  </div>
                  <h3 className="font-semibold text-ink">{t(`why.item${i}Title`)}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{t(`why.item${i}Desc`)}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="bg-white py-20 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4">
          <AnimateIn>
            <div className="text-center mb-12">
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-ink mb-3">
                {t('testimonials.title')}
              </h2>
              <p className="text-gray-500">{t('testimonials.subtitle')}</p>
            </div>
          </AnimateIn>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(['1', '2', '3'] as const).map((key, i) => (
              <AnimateIn key={key} delay={i * 100}>
                <div className="bg-cream rounded-2xl p-7 flex flex-col gap-4 h-full">
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, s) => (
                      <svg key={s} className="w-4 h-4 text-orange" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-gray-700 text-sm leading-relaxed italic flex-1">
                    &ldquo;{t(`testimonials.${key}.text`)}&rdquo;
                  </p>
                  <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
                    <div className="w-9 h-9 rounded-full bg-teal flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {t(`testimonials.${key}.name`).slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-ink text-sm">{t(`testimonials.${key}.name`)}</div>
                      <div className="text-xs text-gray-500">{t(`testimonials.${key}.origin`)} · {t(`testimonials.${key}.tour`)}</div>
                    </div>
                  </div>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* A MEDIDA */}
      <section className="bg-teal-dark py-20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <AnimateIn className="flex flex-col gap-6">
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-white">
                {t('custom.title')}
              </h2>
              <p className="text-white/75 text-lg leading-relaxed">{t('custom.subtitle')}</p>
              <p className="text-white/55 text-sm">{t('custom.detail')}</p>
              <a
                href="https://wa.me/56991384957"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-orange hover:bg-orange-dark text-white font-semibold px-7 py-3 rounded-xl transition-colors w-fit"
              >
                {t('custom.button')} →
              </a>
            </AnimateIn>
            <AnimateIn delay={150} className="flex flex-col gap-4">
              {(['badge1', 'badge2', 'badge3'] as const).map((b, i) => {
                const icons = [
                  <path key="0" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />,
                  <path key="1" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />,
                  <path key="2" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />,
                ];
                return (
                  <div key={b} className="flex items-center gap-4 bg-white/10 rounded-xl px-5 py-4">
                    <div className="w-10 h-10 rounded-lg bg-orange/20 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-orange-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {icons[i]}
                      </svg>
                    </div>
                    <span className="text-white font-medium">{t(`custom.${b}`)}</span>
                  </div>
                );
              })}
            </AnimateIn>
          </div>
        </div>
      </section>

      {/* FEATURED TOURS */}
      <section className="bg-cream-dark py-20">
        <div className="max-w-6xl mx-auto px-4">
          <AnimateIn>
            <div className="flex items-end justify-between mb-10">
              <h2 className="font-display text-3xl font-bold text-ink">Tours destacados</h2>
              <Link href="/tours" className="text-orange font-semibold hover:underline text-sm">
                {ct('cta.seeTours')} →
              </Link>
            </div>
          </AnimateIn>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featured.map((tour, i) => (
              <AnimateIn key={tour.slug} delay={i * 100}>
                <TourCard tour={tour} />
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-teal py-20">
        <AnimateIn>
          <div className="max-w-2xl mx-auto px-4 text-center flex flex-col gap-6">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-white">
              {t('cta.title')}
            </h2>
            <p className="text-white/70 text-lg">{t('cta.subtitle')}</p>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="https://wa.me/56991384957"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-orange hover:bg-orange-dark text-white font-semibold px-8 py-3 rounded-xl transition-colors"
              >
                {t('cta.button')}
              </a>
              <Link
                href="/contacto"
                className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-semibold px-8 py-3 rounded-xl transition-colors"
              >
                {ct('cta.contact')}
              </Link>
            </div>
          </div>
        </AnimateIn>
      </section>
    </>
  );
}

export default HomePage;
