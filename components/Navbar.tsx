'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/navigation';
import LocaleSwitcher from './LocaleSwitcher';

export default function Navbar({ locale: _locale }: { locale: string }) {
  const t = useTranslations('common.nav');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isHome = pathname === '/';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { href: '/tours' as const, label: t('tours') },
    { href: '/nosotros' as const, label: t('about') },
    { href: '/contacto' as const, label: t('contact') },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled || !isHome
          ? 'bg-teal shadow-2xl'
          : 'bg-transparent shadow-none'
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex-shrink-0">
          <Image
            src="/images/logo.png"
            alt="Turismo CaraCara"
            width={140}
            height={52}
            className="h-10 w-auto brightness-0 invert"
            priority
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors ${
                pathname === link.href
                  ? 'text-orange'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="hidden md:flex items-center gap-4">
          <LocaleSwitcher />
          <Link
            href="/contacto"
            className="bg-orange hover:bg-orange-dark text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            {t('book')}
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-white p-2"
          onClick={() => setOpen(!open)}
          aria-label="Menú"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-teal-dark border-t border-white/10 px-4 py-4 flex flex-col gap-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-white/90 font-medium py-2"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <LocaleSwitcher />
            <Link
              href="/contacto"
              className="bg-orange text-white text-sm font-semibold px-4 py-2 rounded-lg"
              onClick={() => setOpen(false)}
            >
              {t('book')}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
