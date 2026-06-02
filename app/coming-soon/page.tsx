import type { Metadata } from 'next';
import Image from 'next/image';
import { Playfair_Display } from 'next/font/google';

const playfair = Playfair_Display({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'En creación — Turismo CaraCara',
  description: 'Tours privados en Chile. We make it happen.',
};

export default function ComingSoonPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        backgroundImage: "url('https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1920&q=70')",
        backgroundSize: 'cover',
        backgroundPosition: 'center 40%',
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-teal/95 via-teal/90 to-teal/95" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 gap-8 max-w-xl">
        {/* Logo */}
        <Image
          src="/images/logo.png"
          alt="Turismo CaraCara"
          width={220}
          height={82}
          className="h-16 w-auto brightness-0 invert"
          priority
        />

        {/* Heading */}
        <div className="flex flex-col gap-3">
          <p className="text-orange/90 text-sm font-semibold tracking-widest uppercase">Tours privados · Santiago, Chile</p>
          <h1 className={`${playfair.className} text-5xl sm:text-6xl font-bold text-white leading-tight`}>
            En creación
          </h1>
          <p className={`${playfair.className} text-orange text-2xl italic`}>We make it happen</p>
        </div>

        {/* Description */}
        <p className="text-white/65 text-lg leading-relaxed">
          Estamos construyendo algo increíble. Tours privados en la zona central de Chile —
          Cajón del Maipo, Valparaíso, viñedos y más — en español, inglés y portugués.
        </p>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
          <a
            href="https://wa.me/56991384957?text=Hola%2C%20me%20interesa%20un%20tour%20privado%20en%20Chile"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-orange hover:bg-[#a83d12] text-white font-semibold px-8 py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Consultar por WhatsApp
          </a>
          <a
            href="mailto:turismocaracara@gmail.com"
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-semibold px-8 py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            turismocaracara@gmail.com
          </a>
        </div>

        {/* Footer strip */}
        <div className="flex flex-wrap items-center justify-center gap-3 text-white/35 text-sm mt-2 border-t border-white/10 pt-6 w-full">
          <span>Español · English · Português</span>
          <span>·</span>
          <a
            href="https://instagram.com/turismocaracara"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white/60 transition-colors"
          >
            @turismocaracara
          </a>
          <span>·</span>
          <span>La Reina, Santiago, Chile</span>
        </div>
      </div>
    </div>
  );
}
