import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import ContactForm from '@/components/ContactForm';

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const descriptions: Record<string, string> = {
    es: 'Contáctanos para reservar tu tour privado en Chile. WhatsApp: +56 9 9138 4957.',
    en: 'Contact us to book your private tour in Chile. WhatsApp: +56 9 9138 4957.',
    pt: 'Fale conosco para reservar seu tour privado no Chile. WhatsApp: +56 9 9138 4957.',
  };
  return { title: 'Contacto — Turismo CaraCara', description: descriptions[locale] };
}

export default function ContactoPage() {
  const t = useTranslations('contact');

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-teal py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="font-display text-4xl font-bold text-white mb-2">{t('title')}</h1>
          <p className="text-white/70 text-lg">{t('subtitle')}</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Form */}
          <div className="bg-white rounded-2xl shadow-sm p-8">
            <h2 className="font-display text-2xl font-bold text-ink mb-6">{t('formTitle')}</h2>
            <ContactForm />
          </div>

          {/* Info */}
          <div className="flex flex-col gap-8">
            <div>
              <h2 className="font-display text-2xl font-bold text-ink mb-6">{t('infoTitle')}</h2>
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-teal">{t('directContact')}</span>
                  <a
                    href="https://wa.me/56991384957"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-green-50 hover:bg-green-100 border border-green-200 text-green-800 font-medium px-4 py-3 rounded-xl text-sm transition-colors flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    WhatsApp: +56 9 9138 4957
                  </a>
                  <a
                    href="mailto:turismocaracara@gmail.com"
                    className="text-teal hover:underline text-sm"
                  >
                    turismocaracara@gmail.com
                  </a>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-teal">{t('hours')}</span>
                  <p className="text-gray-600 text-sm">{t('hoursValue')}</p>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-teal">Instagram</span>
                  <a
                    href="https://instagram.com/turismocaracara"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-600 hover:text-teal text-sm transition-colors"
                  >
                    @turismocaracara
                  </a>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-teal">Ubicación</span>
                  <p className="text-gray-600 text-sm">La Reina, Santiago, Chile</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
