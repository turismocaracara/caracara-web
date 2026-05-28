import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const descriptions: Record<string, string> = {
    es: 'Somos Turismo CaraCara, operador turístico privado en Santiago. Guías expertos en español, inglés y portugués.',
    en: 'We are Turismo CaraCara, a private tour operator in Santiago. Expert guides in Spanish, English and Portuguese.',
    pt: 'Somos a Turismo CaraCara, operador turístico privado em Santiago. Guias especialistas em espanhol, inglês e português.',
  };
  return { title: 'Nosotros — Turismo CaraCara', description: descriptions[locale] };
}

const CONVENIOS = [
  'Cousiño Macul', 'Casa Silva', 'Santa Rita', 'Casas del Bosque',
  'Undurraga', 'Emiliana', 'Viñamar', 'Kingston Family',
  'Odfjell', 'Matetic', 'Clos Apalta', 'Villard', 'Aquitania', 'VSPT San Pedro',
];

export default function NosotrosPage() {
  const t = useTranslations('about');
  const ct = useTranslations('common');

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-teal py-20">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-white mb-2">{t('title')}</h1>
          <p className="text-orange font-semibold text-xl italic">{t('subtitle')}</p>
        </div>
      </div>

      {/* Story */}
      <section className="bg-white py-20">
        <div className="max-w-3xl mx-auto px-4">
          <p className="text-gray-700 text-xl leading-relaxed mb-6 font-display italic">
            {t('story')}
          </p>
          <p className="text-gray-600 text-lg leading-relaxed">{t('story2')}</p>
        </div>
      </section>

      {/* Mission */}
      <section className="bg-teal py-16">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="font-display text-2xl font-bold text-white mb-4">{t('missionTitle')}</h2>
          <p className="text-white/80 text-lg leading-relaxed">{t('mission')}</p>
        </div>
      </section>

      {/* Team */}
      <section className="bg-cream py-20">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="font-display text-3xl font-bold text-ink text-center mb-12">{t('teamTitle')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Sebastián */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="w-14 h-14 bg-teal rounded-full flex items-center justify-center text-white font-display text-xl font-bold mb-4">
                SA
              </div>
              <h3 className="font-bold text-ink text-lg">{t('sebastianName')}</h3>
              <p className="text-orange text-sm font-medium mb-2">{t('sebastianRole')}</p>
              <p className="text-gray-600 text-sm leading-relaxed mb-3">{t('sebastianDesc')}</p>
              <p className="text-xs text-teal font-medium">{t('sebastianLangs')}</p>
            </div>
            {/* Cristóbal */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="w-14 h-14 bg-orange rounded-full flex items-center justify-center text-white font-display text-xl font-bold mb-4">
                CA
              </div>
              <h3 className="font-bold text-ink text-lg">{t('cristobalName')}</h3>
              <p className="text-orange text-sm font-medium mb-2">{t('cristobalRole')}</p>
              <p className="text-gray-600 text-sm leading-relaxed mb-3">{t('cristobalDesc')}</p>
              <p className="text-xs text-teal font-medium">{t('cristobalLangs')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Fleet */}
      <section className="bg-white py-16">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="font-display text-2xl font-bold text-ink mb-4">{t('fleetTitle')}</h2>
          <p className="text-gray-600 leading-relaxed">{t('fleetDesc')}</p>
        </div>
      </section>

      {/* Convenios */}
      <section className="bg-cream py-16">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="font-display text-2xl font-bold text-ink text-center mb-2">{t('conveniosTitle')}</h2>
          <p className="text-gray-500 text-center mb-8">{t('conveniosDesc')}</p>
          <div className="flex flex-wrap justify-center gap-3">
            {CONVENIOS.map((w) => (
              <span key={w} className="bg-white border border-red-100 text-red-700 text-sm px-4 py-2 rounded-full shadow-sm">
                {w}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-teal py-16">
        <div className="max-w-2xl mx-auto px-4 text-center flex flex-col gap-4">
          <p className="text-white/80 text-lg">¿Tienes preguntas?</p>
          <Link
            href="/contacto"
            className="bg-orange hover:bg-orange-dark text-white font-semibold px-8 py-3 rounded-xl transition-colors w-fit mx-auto"
          >
            {ct('cta.contact')}
          </Link>
        </div>
      </section>
    </div>
  );
}
