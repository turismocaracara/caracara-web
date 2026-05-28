import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import Image from 'next/image';

export default function Footer() {
  const t = useTranslations('common.footer');
  const nav = useTranslations('common.nav');
  const year = new Date().getFullYear();

  return (
    <footer className="bg-teal-dark text-white/80">
      {/* Trust strip */}
      <div className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap items-center justify-center gap-6 text-xs text-white/50">
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-orange" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 1l2.39 4.847 5.348.777-3.869 3.769.913 5.318L10 13.347l-4.782 2.364.913-5.318L2.262 6.624l5.348-.777L10 1z" clipRule="evenodd" />
            </svg>
            Tours 100% privados
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
            Español · English · Português
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Empresa registrada · RUT 77.780.561-4
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-orange" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Respuesta en &lt; 24h
          </span>
        </div>
      </div>

      {/* Main footer */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Brand */}
          <div className="flex flex-col gap-4">
            <Image
              src="/images/logo.png"
              alt="Turismo CaraCara"
              width={180}
              height={67}
              className="h-14 w-auto brightness-0 invert"
            />
            <p className="text-sm text-white/60 italic">{t('tagline')}</p>
            <div className="flex gap-3 mt-1">
              <a
                href="https://wa.me/56991384957"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-green-600 flex items-center justify-center transition-colors"
                aria-label="WhatsApp"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </a>
              <a
                href="https://instagram.com/turismocaracara"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-pink-600 flex items-center justify-center transition-colors"
                aria-label="Instagram"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
                </svg>
              </a>
              <a
                href="mailto:turismocaracara@gmail.com"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-teal flex items-center justify-center transition-colors"
                aria-label="Email"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="text-white font-semibold mb-4">{t('quickLinks')}</h4>
            <ul className="flex flex-col gap-2 text-sm">
              <li><Link href="/tours" className="hover:text-orange transition-colors">{nav('tours')}</Link></li>
              <li><Link href="/nosotros" className="hover:text-orange transition-colors">{nav('about')}</Link></li>
              <li><Link href="/contacto" className="hover:text-orange transition-colors">{nav('contact')}</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white font-semibold mb-4">{t('contact')}</h4>
            <ul className="flex flex-col gap-2 text-sm">
              <li>
                <a href="https://wa.me/56991384957" target="_blank" rel="noopener noreferrer" className="hover:text-orange transition-colors">
                  WhatsApp: {t('whatsapp')}
                </a>
              </li>
              <li>
                <a href={`mailto:${t('email')}`} className="hover:text-orange transition-colors">
                  {t('email')}
                </a>
              </li>
              <li>
                <a href="https://instagram.com/turismocaracara" target="_blank" rel="noopener noreferrer" className="hover:text-orange transition-colors">
                  {t('instagram')}
                </a>
              </li>
              <li className="text-white/50 flex items-center gap-1.5 mt-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {t('address')}
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-10 pt-6 text-xs text-white/40 text-center">
          {t('rights', { year })}
        </div>
      </div>
    </footer>
  );
}
