'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AvailabilityStatus, DayAvailability } from '@/app/api/availability/[slug]/route';

interface Props {
  tourSlug:     string;
  bookingType:  'private' | 'group';
  selected:     string; // YYYY-MM-DD
  onSelect:     (date: string, status: AvailabilityStatus, spots: number) => void;
  locale:       'es' | 'en' | 'pt';
}

const MONTH_NAMES = {
  es: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  pt: ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'],
};

const DAY_NAMES = {
  es: ['Lu','Ma','Mi','Ju','Vi','Sá','Do'],
  en: ['Mo','Tu','We','Th','Fr','Sa','Su'],
  pt: ['Se','Te','Qu','Qu','Se','Sá','Do'],
};

const STATUS_COLORS: Record<AvailabilityStatus, string> = {
  available: 'bg-green-50 hover:bg-green-100 text-green-800 border-green-200 cursor-pointer',
  forming:   'bg-yellow-50 hover:bg-yellow-100 text-yellow-800 border-yellow-200 cursor-pointer',
  full:      'bg-red-50 text-red-300 border-red-100 cursor-not-allowed',
  blocked:   'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed',
  past:      'bg-white text-gray-200 border-transparent cursor-not-allowed',
};

const STATUS_SELECTED = 'bg-teal text-white border-teal';

const LEGEND = {
  es: { available: 'Disponible', forming: 'En formación', full: 'Sin cupo', blocked: 'No disponible' },
  en: { available: 'Available',  forming: 'Forming',      full: 'Full',     blocked: 'Unavailable' },
  pt: { available: 'Disponível', forming: 'Em formação',  full: 'Lotado',   blocked: 'Indisponível' },
};

export default function BookingCalendar({ tourSlug, selected, onSelect, locale }: Props) {
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1); // 1-12
  const [availability, setAvailability] = useState<Record<string, DayAvailability>>({});
  const [loading, setLoading] = useState(false);

  const monthKey = `${viewYear}-${String(viewMonth).padStart(2, '0')}`;

  const fetchAvailability = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/availability/${tourSlug}?month=${monthKey}`);
      if (!res.ok) return;
      const data = await res.json() as { availability: Record<string, DayAvailability> };
      setAvailability(prev => ({ ...prev, ...data.availability }));
    } finally {
      setLoading(false);
    }
  }, [tourSlug, monthKey]);

  useEffect(() => { fetchAvailability(); }, [fetchAvailability]);

  function prevMonth() {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1); }
    else setViewMonth(m => m + 1);
  }

  // Construir grilla del calendario (lunes primero)
  const firstDayOfMonth = new Date(viewYear, viewMonth - 1, 1).getDay(); // 0=domingo
  const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;  // ajuste lunes=0
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const grid: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Completar última fila
  while (grid.length % 7 !== 0) grid.push(null);

  const isPast = viewYear < today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth < today.getMonth() + 1);

  return (
    <div className="flex flex-col gap-3">
      {/* Navegación mes */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          disabled={isPast}
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
        >
          ←
        </button>
        <span className="font-semibold text-ink text-sm">
          {MONTH_NAMES[locale][viewMonth - 1]} {viewYear}
          {loading && <span className="ml-2 text-gray-400 text-xs">...</span>}
        </span>
        <button type="button" onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          →
        </button>
      </div>

      {/* Días de la semana */}
      <div className="grid grid-cols-7 gap-1">
        {DAY_NAMES[locale].map(d => (
          <div key={d} className="text-center text-xs text-gray-400 font-medium py-1">{d}</div>
        ))}

        {/* Días */}
        {grid.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;
          const ds = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const info = availability[ds];
          const status: AvailabilityStatus = info?.status ?? 'available';
          const isSelected = ds === selected;
          const isClickable = status === 'available' || status === 'forming';

          return (
            <button
              key={ds}
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onSelect(ds, status, info?.spots ?? 0)}
              title={info ? `${LEGEND[locale][status as keyof typeof LEGEND.es] ?? ''} — ${info.spots} cupos` : ''}
              className={`
                aspect-square flex items-center justify-center rounded-lg border text-sm font-medium
                transition-colors
                ${isSelected ? STATUS_SELECTED : STATUS_COLORS[status]}
              `}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
        {(['available', 'forming', 'full', 'blocked'] as const).map(s => (
          <div key={s} className="flex items-center gap-1.5 text-xs text-gray-500">
            <div className={`w-3 h-3 rounded border ${STATUS_COLORS[s].split(' ')[0]} ${STATUS_COLORS[s].split(' ')[2]}`} />
            {LEGEND[locale][s]}
          </div>
        ))}
      </div>

      {/* Info del día seleccionado */}
      {selected && availability[selected] && (
        <div className={`text-xs px-3 py-2 rounded-lg border ${
          availability[selected].status === 'forming'
            ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
            : 'bg-green-50 border-green-200 text-green-700'
        }`}>
          {availability[selected].status === 'forming'
            ? locale === 'es'
              ? `Tour en formación — ${availability[selected].spots} cupo(s) disponible(s). Se confirma si se alcanza el mínimo de pasajeros.`
              : locale === 'en'
              ? `Tour forming — ${availability[selected].spots} spot(s) available. Confirmed once minimum passengers is reached.`
              : `Tour em formação — ${availability[selected].spots} vaga(s) disponível. Confirmado ao atingir o mínimo de passageiros.`
            : locale === 'es'
            ? `${availability[selected].spots} cupo(s) disponible(s)`
            : locale === 'en'
            ? `${availability[selected].spots} spot(s) available`
            : `${availability[selected].spots} vaga(s) disponível`
          }
        </div>
      )}
    </div>
  );
}
