'use client';

import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

const NAV = [
  { href: '/admin',          label: 'Dashboard',     icon: '◉' },
  { href: '/admin/reservas', label: 'Reservas',       icon: '📋' },
  { href: '/admin/riesgo',   label: 'Tours en riesgo', icon: '⚠️' },
  { href: '/admin/asignaciones', label: 'Asignaciones', icon: '🧭' },
  { href: '/admin/tours',    label: 'Tours',          icon: '🗺' },
  { href: '/admin/vans',     label: 'Vans',           icon: '🚐' },
  { href: '/admin/equipo',   label: 'Equipo',         icon: '👥' },
  { href: '/admin/config',   label: 'Configuración',  icon: '⚙' },
];

export default function AdminSidebar({ userEmail }: { userEmail: string }) {
  const pathname  = usePathname();
  const router    = useRouter();

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
    router.refresh();
  }

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-56 bg-white border-r border-gray-100 flex flex-col z-20">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100">
        <Image
          src="/images/logo.png"
          alt="CaraCara"
          width={120}
          height={45}
          className="h-8 w-auto"
        />
        <p className="text-[10px] text-gray-400 mt-1 font-medium tracking-wide uppercase">
          Panel interno
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 flex flex-col gap-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon }) => {
          const isActive = href === '/admin'
            ? pathname === '/admin'
            : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-teal/10 text-teal'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className="text-base leading-none w-5 text-center">{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-gray-100">
        <p className="text-xs text-gray-500 mb-2 truncate" title={userEmail}>
          {userEmail}
        </p>
        <button
          onClick={handleLogout}
          className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
        >
          Cerrar sesión →
        </button>
      </div>
    </aside>
  );
}
