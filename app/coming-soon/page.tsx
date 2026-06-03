import type { Metadata } from 'next';
import Image from 'next/image';
import { Playfair_Display } from 'next/font/google';

const playfair = Playfair_Display({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Turismo CaraCara',
  description: 'Tours privados en Chile.',
  robots: 'noindex',
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
      <div className="relative z-10 flex flex-col items-center text-center px-6 gap-8">
        <Image
          src="/images/logo.png"
          alt="Turismo CaraCara"
          width={220}
          height={82}
          className="h-16 w-auto brightness-0 invert"
          priority
        />

        <div className="flex flex-col gap-3">
          <p className="text-orange/90 text-sm font-semibold tracking-widest uppercase">
            Tours privados · Santiago, Chile
          </p>
          <h1 className={`${playfair.className} text-5xl sm:text-6xl font-bold text-white leading-tight`}>
            En construcción
          </h1>
          <p className={`${playfair.className} text-orange text-2xl italic`}>
            We make it happen
          </p>
        </div>

        <p className="text-white/50 text-base">
          turismocaracara@gmail.com · +56 9 9138 4957
        </p>
      </div>
    </div>
  );
}
