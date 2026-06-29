'use client';

import { useState } from 'react';

export interface ItineraryStop {
  time:    string;
  place:   string;
  isLunch?: boolean;
  address?: string; // solo relevante en la primera parada — ver lib/pickup-route.ts
}

export interface TourDetail {
  slug:            string;
  name_es:         string;
  name_en:         string | null;
  name_pt:         string | null;
  description_es:  string | null;
  description_en:  string | null;
  description_pt:  string | null;
  category:        string | null;
  difficulty:      string | null;
  hide_difficulty: boolean | null;
  duration_hrs:    number | null;
  max_pax:         number | null;
  hide_pax:        boolean | null;
  highlights:      string[] | null;
  includes_keys:   string[] | null;
  excludes_keys:   string[] | null;
  itinerary:       ItineraryStop[] | null;
  wine_convenios:  string[] | null;
  images:          string[] | null;
  active:          boolean;
}

export interface ScheduleRow {
  id: string;
  tour_slug: string;
  season: 'summer' | 'winter';
  pickup_time: string;
}

export interface KeyOption { key: string; label: string; }

const CATEGORIES = [
  { value: 'cajon',      label: 'Cajón del Maipo' },
  { value: 'valparaiso', label: 'Valparaíso' },
  { value: 'santiago',   label: 'Santiago' },
  { value: 'vinedos',    label: 'Viñedos' },
  { value: 'trekking',   label: 'Trekking' },
  { value: 'aventura',   label: 'Aventura' },
];

const DIFFICULTIES = [
  { value: 'low',    label: 'Fácil' },
  { value: 'medium', label: 'Moderado' },
  { value: 'high',   label: 'Exigente' },
];

const inputClass    = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal w-full';
const textareaClass = `${inputClass} resize-none`;
const selectClass   = `${inputClass} bg-white`;

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-4">
      <div>
        <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
        {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      {children}
    </div>
  );
}

export default function TourEditForm({
  tour,
  initialSchedules,
  highlightOptions,
  includeOptions,
  excludeOptions,
}: {
  tour: TourDetail;
  initialSchedules: ScheduleRow[];
  highlightOptions: KeyOption[];
  includeOptions: KeyOption[];
  excludeOptions: KeyOption[];
}) {
  const [nameEs, setNameEs] = useState(tour.name_es);
  const [nameEn, setNameEn] = useState(tour.name_en ?? '');
  const [namePt, setNamePt] = useState(tour.name_pt ?? '');
  const [descEs, setDescEs] = useState(tour.description_es ?? '');
  const [descEn, setDescEn] = useState(tour.description_en ?? '');
  const [descPt, setDescPt] = useState(tour.description_pt ?? '');
  const [category, setCategory]     = useState(tour.category ?? 'cajon');
  const [difficulty, setDifficulty] = useState(tour.difficulty ?? 'low');
  const [hideDifficulty, setHideDifficulty] = useState(!!tour.hide_difficulty);
  const [durationHrs, setDurationHrs] = useState(tour.duration_hrs ?? 8);
  const [maxPax, setMaxPax]   = useState(tour.max_pax ?? 9);
  const [hidePax, setHidePax] = useState(!!tour.hide_pax);
  const [highlights, setHighlights] = useState<string[]>(tour.highlights ?? []);
  const [includesKeys, setIncludesKeys] = useState<string[]>(tour.includes_keys ?? []);
  const [excludesKeys, setExcludesKeys] = useState<string[]>(tour.excludes_keys ?? []);
  const [itinerary, setItinerary] = useState<ItineraryStop[]>(tour.itinerary?.length ? tour.itinerary : []);
  const [wineConvenios, setWineConvenios] = useState<string[]>(tour.wine_convenios ?? []);
  const [images, setImages] = useState<string[]>(tour.images ?? []);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState('');

  const [schedules, setSchedules] = useState<Record<'summer' | 'winter', string>>({
    summer: initialSchedules.find(s => s.season === 'summer')?.pickup_time?.slice(0, 5) ?? '',
    winter: initialSchedules.find(s => s.season === 'winter')?.pickup_time?.slice(0, 5) ?? '',
  });
  const [savingSchedule, setSavingSchedule] = useState<'summer' | 'winter' | null>(null);

  function toggleKey(list: string[], setList: (v: string[]) => void, key: string) {
    setList(list.includes(key) ? list.filter(k => k !== key) : [...list, key]);
  }

  function updateItinerary(i: number, field: keyof ItineraryStop, value: string | boolean) {
    setItinerary(prev => prev.map((stop, idx) => idx === i ? { ...stop, [field]: value } : stop));
  }
  function addItineraryStop() {
    setItinerary(prev => [...prev, { time: '', place: '' }]);
  }
  function removeItineraryStop(i: number) {
    setItinerary(prev => prev.filter((_, idx) => idx !== i));
  }

  function updateListItem(list: string[], setList: (v: string[]) => void, i: number, value: string) {
    setList(list.map((item, idx) => idx === i ? value : item));
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/tours/${tour.slug}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name_es: nameEs, name_en: nameEn || null, name_pt: namePt || null,
          description_es: descEs || null, description_en: descEn || null, description_pt: descPt || null,
          category, difficulty, hide_difficulty: hideDifficulty,
          duration_hrs: durationHrs, max_pax: maxPax, hide_pax: hidePax,
          highlights, includes_keys: includesKeys, excludes_keys: excludesKeys,
          itinerary: itinerary.filter(s => s.time || s.place),
          wine_convenios: wineConvenios.filter(Boolean),
          images: images.filter(Boolean),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? 'Error al guardar');
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function saveSchedule(season: 'summer' | 'winter') {
    setSavingSchedule(season);
    try {
      await fetch('/api/admin/tour-schedules', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tour_slug: tour.slug, season, pickup_time: schedules[season] }),
      });
    } finally {
      setSavingSchedule(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{tour.name_es}</h1>
        <p className="text-xs text-gray-400 font-mono mt-0.5">{tour.slug}</p>
      </div>

      <Section title="Identidad">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Nombre (ES)"><input value={nameEs} onChange={e => setNameEs(e.target.value)} className={inputClass} /></Field>
          <Field label="Nombre (EN)"><input value={nameEn} onChange={e => setNameEn(e.target.value)} className={inputClass} /></Field>
          <Field label="Nombre (PT)"><input value={namePt} onChange={e => setNamePt(e.target.value)} className={inputClass} /></Field>
        </div>
      </Section>

      <Section title="Descripción" hint="Texto largo mostrado en la página del tour">
        <Field label="Descripción (ES)"><textarea rows={4} value={descEs} onChange={e => setDescEs(e.target.value)} className={textareaClass} /></Field>
        <Field label="Descripción (EN)"><textarea rows={4} value={descEn} onChange={e => setDescEn(e.target.value)} className={textareaClass} /></Field>
        <Field label="Descripción (PT)"><textarea rows={4} value={descPt} onChange={e => setDescPt(e.target.value)} className={textareaClass} /></Field>
      </Section>

      <Section title="Clasificación">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Categoría">
            <select value={category} onChange={e => setCategory(e.target.value)} className={selectClass}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Duración (horas)">
            <input type="number" min={1} max={24} value={durationHrs} onChange={e => setDurationHrs(Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Dificultad">
            <div className="flex items-center gap-2">
              <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className={selectClass}>
                {DIFFICULTIES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
              <label className="flex items-center gap-1.5 text-xs text-gray-500 whitespace-nowrap">
                <input type="checkbox" checked={hideDifficulty} onChange={e => setHideDifficulty(e.target.checked)} />
                Ocultar en card
              </label>
            </div>
          </Field>
          <Field label="Máximo de pasajeros">
            <div className="flex items-center gap-2">
              <input type="number" min={1} max={18} value={maxPax} onChange={e => setMaxPax(Number(e.target.value))} className={inputClass} />
              <label className="flex items-center gap-1.5 text-xs text-gray-500 whitespace-nowrap">
                <input type="checkbox" checked={hidePax} onChange={e => setHidePax(e.target.checked)} />
                Ocultar en card
              </label>
            </div>
          </Field>
        </div>
      </Section>

      <Section title="Highlights" hint="Se muestran como tags en la card del catálogo (máx. 3 visibles)">
        <div className="flex flex-wrap gap-2">
          {highlightOptions.map(opt => (
            <button
              key={opt.key}
              type="button"
              onClick={() => toggleKey(highlights, setHighlights, opt.key)}
              className={`border rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                highlights.includes(opt.key) ? 'border-teal bg-teal/10 text-teal' : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Section>

      <Section
        title="Qué incluye / qué no incluye"
        hint="Lista acotada a conceptos ya traducidos a los 3 idiomas. Agregar un concepto nuevo requiere editarlo primero en messages/es.json (y en/pt) — avísame si necesitas uno nuevo."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Incluye</p>
            <div className="flex flex-col gap-1.5">
              {includeOptions.map(opt => (
                <label key={opt.key} className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={includesKeys.includes(opt.key)} onChange={() => toggleKey(includesKeys, setIncludesKeys, opt.key)} />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">No incluye</p>
            <div className="flex flex-col gap-1.5">
              {excludeOptions.map(opt => (
                <label key={opt.key} className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={excludesKeys.includes(opt.key)} onChange={() => toggleKey(excludesKeys, setExcludesKeys, opt.key)} />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Itinerario"
        hint="Paradas mostradas en la página del tour. La PRIMERA parada además define el punto de llegada usado para calcular el pickup — necesita una dirección real (geolocalizable)."
      >
        <div className="flex flex-col gap-3">
          {itinerary.map((stop, i) => (
            <div key={i} className="border border-gray-100 rounded-lg p-3 flex flex-col gap-2 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <input
                  type="text" placeholder="07:30" value={stop.time}
                  onChange={e => updateItinerary(i, 'time', e.target.value)}
                  className={`${inputClass} max-w-[100px]`}
                />
                <input
                  type="text" placeholder="Lugar / parada" value={stop.place}
                  onChange={e => updateItinerary(i, 'place', e.target.value)}
                  className={inputClass}
                />
                <label className="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap">
                  <input type="checkbox" checked={!!stop.isLunch} onChange={e => updateItinerary(i, 'isLunch', e.target.checked)} />
                  Almuerzo
                </label>
                <button type="button" onClick={() => removeItineraryStop(i)} className="text-xs text-red-400 hover:text-red-600 px-1">✕</button>
              </div>
              {i === 0 && (
                <input
                  type="text"
                  placeholder="Dirección exacta del primer punto (para calcular pickup), ej: Embalse El Yeso, Cajón del Maipo"
                  value={stop.address ?? ''}
                  onChange={e => updateItinerary(i, 'address', e.target.value)}
                  className={`${inputClass} bg-white`}
                />
              )}
            </div>
          ))}
          <button type="button" onClick={addItineraryStop} className="self-start text-xs text-teal hover:underline">+ Agregar parada</button>
        </div>
      </Section>

      <Section title="Horario de llegada al primer punto" hint="Hora a la que el grupo debe estar EN la primera parada del itinerario (no la hora de salida). Varía por temporada.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(['summer', 'winter'] as const).map(season => (
            <Field key={season} label={season === 'summer' ? 'Verano (oct–mar)' : 'Invierno (abr–sep)'}>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={schedules[season]}
                  onChange={e => setSchedules(prev => ({ ...prev, [season]: e.target.value }))}
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => saveSchedule(season)}
                  disabled={savingSchedule === season}
                  className="bg-teal text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-teal/90 disabled:opacity-50 whitespace-nowrap"
                >
                  {savingSchedule === season ? '…' : 'Guardar'}
                </button>
              </div>
            </Field>
          ))}
        </div>
      </Section>

      <Section title="Convenios de viñedos" hint="Solo relevante para tours de la categoría Viñedos">
        <div className="flex flex-col gap-2">
          {wineConvenios.map((w, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={w} onChange={e => updateListItem(wineConvenios, setWineConvenios, i, e.target.value)} className={inputClass} />
              <button type="button" onClick={() => setWineConvenios(prev => prev.filter((_, idx) => idx !== i))} className="text-xs text-red-400 hover:text-red-600 px-1">✕</button>
            </div>
          ))}
          <button type="button" onClick={() => setWineConvenios(prev => [...prev, ''])} className="self-start text-xs text-teal hover:underline">+ Agregar viña</button>
        </div>
      </Section>

      <Section title="Imágenes" hint="URLs de imágenes para la galería del tour (sin subida de archivos por ahora)">
        <div className="flex flex-col gap-2">
          {images.map((img, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={img} onChange={e => updateListItem(images, setImages, i, e.target.value)} placeholder="https://…" className={inputClass} />
              <button type="button" onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))} className="text-xs text-red-400 hover:text-red-600 px-1">✕</button>
            </div>
          ))}
          <button type="button" onClick={() => setImages(prev => [...prev, ''])} className="self-start text-xs text-teal hover:underline">+ Agregar imagen</button>
        </div>
      </Section>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="bg-teal text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-teal/90 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
        {saved && <span className="text-sm text-teal">✓ Guardado</span>}
      </div>
    </div>
  );
}
