'use client';

import { useState } from 'react';

export interface ScheduleRow {
  id: string;
  tour_slug: string;
  season: 'summer' | 'winter';
  pickup_time: string;
}

export interface TourOption {
  slug: string;
  name_es: string;
}

const SEASON_LABEL: Record<string, string> = {
  summer: 'Verano (oct–mar)',
  winter: 'Invierno (abr–sep)',
};

export default function PickupSchedulesManager({
  tours,
  initialSchedules,
}: {
  tours: TourOption[];
  initialSchedules: ScheduleRow[];
}) {
  const [schedules, setSchedules] = useState(initialSchedules);
  const [tourSlug, setTourSlug]   = useState(tours[0]?.slug ?? '');
  const [season, setSeason]       = useState<'summer' | 'winter'>('summer');
  const [time, setTime]           = useState('07:30');
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState<string | null>(null);

  const tourName = (slug: string) => tours.find(t => t.slug === slug)?.name_es ?? slug;

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/tour-schedules', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tour_slug: tourSlug, season, pickup_time: time }),
      });
      if (res.ok) {
        const { id } = await res.json() as { id: string };
        setSchedules(prev => {
          const without = prev.filter(s => !(s.tour_slug === tourSlug && s.season === season));
          return [...without, { id, tour_slug: tourSlug, season, pickup_time: time }];
        });
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setDeleting(id);
    try {
      const res = await fetch('/api/admin/tour-schedules', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id }),
      });
      if (res.ok) setSchedules(prev => prev.filter(s => s.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-4">
      <div>
        <h3 className="font-semibold text-gray-800 text-sm">Horarios de pickup</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Hora base de recogida por tour y temporada. Se envía automáticamente al confirmar un tour grupal a las 20:00.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Tour</label>
          <select
            value={tourSlug}
            onChange={e => setTourSlug(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal"
          >
            {tours.map(t => <option key={t.slug} value={t.slug}>{t.name_es}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Temporada</label>
          <select
            value={season}
            onChange={e => setSeason(e.target.value as 'summer' | 'winter')}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal"
          >
            <option value="summer">Verano (oct–mar)</option>
            <option value="winter">Invierno (abr–sep)</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Hora de pickup</label>
          <input
            type="time"
            value={time}
            onChange={e => setTime(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal"
          />
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving || !tourSlug}
          className="bg-teal text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-teal/90 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      <div className="border-t border-gray-50 pt-3">
        {schedules.length === 0 ? (
          <p className="text-xs text-gray-400">Sin horarios configurados aún.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {schedules
                .slice()
                .sort((a, b) => tourName(a.tour_slug).localeCompare(tourName(b.tour_slug)))
                .map(s => (
                  <tr key={s.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 text-gray-800">{tourName(s.tour_slug)}</td>
                    <td className="py-2 text-gray-500 text-xs">{SEASON_LABEL[s.season] ?? s.season}</td>
                    <td className="py-2 text-gray-700 font-mono text-xs">{s.pickup_time}</td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => remove(s.id)}
                        disabled={deleting === s.id}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-50"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
