'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/navigation';
import { locales, type Locale } from '@/navigation';

export default function LocaleSwitcher() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();

  function switchLocale(next: Locale) {
    router.replace(pathname, { locale: next });
  }

  return (
    <div className="flex items-center gap-1 text-sm font-medium">
      {locales.map((l, i) => (
        <span key={l} className="flex items-center gap-1">
          {i > 0 && <span className="text-white/30">|</span>}
          <button
            onClick={() => switchLocale(l)}
            className={`px-1 py-0.5 rounded transition-colors ${
              l === locale
                ? 'text-orange font-bold'
                : 'text-white/70 hover:text-white'
            }`}
          >
            {l.toUpperCase()}
          </button>
        </span>
      ))}
    </div>
  );
}
