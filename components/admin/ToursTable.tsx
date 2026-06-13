'use client';

import { useState } from 'react';

export interface AdminTourRow {
  slug: string;
  name_es: string;
  category: string | null;
  difficulty: string | null;
  duration_hrs: number | null;
  max_pax: number | null;
  active: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  cajon:      'Cajón del Maipo',
  valparaiso: 'Valparaíso',
  santiago:   'Santiago',
  vinedos:    'Viñedos',
  trekking:   'Trekking',
  aventura:   'Aventura',
};

const DIFF: Record<string, { label: string; cls: string }> = {
  low:    { label: 'Fácil',     cls: 'bg-green-50 text-green-700' },
  medium: { label: 'Moderado',  cls: 'bg-yellow-50 text-yellow-700' },
  high:   { label: 'Exigente',  cls: 'bg-red-50 text-red-700' },
};

export default function ToursTable({ initialTours }: { initialTours: AdminTourRow[] }) {
  const [tours, setTours]     = useState(initialTours);
  const [toggling, setToggling] = useState<string | null>(null);
  const [search, setSearch]   = useState('');

  const filtered = search
    ? tours.filter(t =>
        t.name_es.toLowerCase().includes(search.toLowerCase()) ||
        t.slug.includes(search.toLowerCase())
      )
    : tours;

  async function toggleActive(slug: string, current: boolean) {
    setToggling(slug);
    try {
      const res = await fetch(`/api/admin/tours/${slug}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ active: !current }),
      });
      if (res.ok) {
        setTours(prev => prev.map(t => t.slug === slug ? { ...t, active: !current } : t));
      }
    } finally {
      setToggling(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <input
        type="text"
        placeholder="Buscar por nombre o slug…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full max-w-xs border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal"
      />

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Tour</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Categoría</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Dificultad</th>
              <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500">Duración</th>
              <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500">Máx. pax</th>
              <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500">Activo</th>
              <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500">Ver</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((tour, i) => (
              <tr
                key={tour.slug}
                className={`${i > 0 ? 'border-t border-gray-50' : ''} transition-opacity ${!tour.active ? 'opacity-40' : ''}`}
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{tour.name_es}</p>
                  <p className="text-[11px] text-gray-400 font-mono mt-0.5">{tour.slug}</p>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {tour.category ? (CATEGORY_LABELS[tour.category] ?? tour.category) : '—'}
                </td>
                <td className="px-4 py-3">
                  {tour.difficulty ? (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${DIFF[tour.difficulty]?.cls ?? 'bg-gray-50 text-gray-600'}`}>
                      {DIFF[tour.difficulty]?.label ?? tour.difficulty}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-center text-gray-600 text-xs">
                  {tour.duration_hrs ? `${tour.duration_hrs}h` : '—'}
                </td>
                <td className="px-4 py-3 text-center text-gray-600 text-xs">
                  {tour.max_pax ?? '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => toggleActive(tour.slug, tour.active)}
                    disabled={toggling === tour.slug}
                    title={tour.active ? 'Desactivar tour' : 'Activar tour'}
                    className={`relative inline-flex w-9 h-5 rounded-full transition-colors duration-200 disabled:opacity-50 focus:outline-none ${
                      tour.active ? 'bg-teal' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 bg-white rounded-full shadow transition-transform duration-200 ${
                        tour.active ? 'translate-x-4' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <a
                    href={`/es/tours/${tour.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-teal hover:text-teal/80 transition-colors"
                    title="Ver en el sitio público"
                  >
                    ↗
                  </a>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                  Sin resultados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        {tours.filter(t => t.active).length} de {tours.length} tours activos
      </p>
    </div>
  );
}
