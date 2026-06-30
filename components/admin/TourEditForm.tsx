'use client';

import { useState, useRef, useEffect } from 'react';

export interface ItineraryStop {
  time:    string;
  place:   string;
  isLunch?: boolean;
  address?: string;
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
  highlights:      string[] | null;
  includes_keys:   string[] | null;
  excludes_keys:   string[] | null;
  itinerary:       ItineraryStop[] | null;
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

// All 67 predefined highlight keys with Spanish labels
const HIGHLIGHT_OPTIONS: KeyOption[] = [
  { key: 'embalse_yeso',       label: 'Embalse El Yeso a 2.475 msnm' },
  { key: 'laguna_turquesa',    label: 'Agua turquesa de los Andes' },
  { key: 'andes_view',         label: 'Panorámica de la cordillera' },
  { key: 'lunch_included',     label: 'Almuerzo incluido' },
  { key: 'snack_included',     label: 'Snack incluido' },
  { key: 'las_melosas',        label: 'Valle de Las Melosas' },
  { key: 'two_destinations',   label: 'Dos destinos en un día' },
  { key: 'thermal_pools',      label: 'Termas naturales' },
  { key: 'mountain_scenery',   label: 'Paisaje cordillerano' },
  { key: 'relax',              label: 'Experiencia de relajación' },
  { key: 'san_jose_volcano',   label: 'Volcán San José' },
  { key: 'maipo_river',        label: 'Río Maipo' },
  { key: 'villages',           label: 'Pueblos del cajón' },
  { key: 'cerros_valpo',       label: 'Cerros de Valparaíso' },
  { key: 'street_art',         label: 'Arte urbano y murales' },
  { key: 'vina_beach',         label: 'Costa de Viña del Mar' },
  { key: 'wine_tasting',       label: 'Degustación de vinos' },
  { key: 'casablanca_valley',  label: 'Valle de Casablanca' },
  { key: 'pablo_neruda_house', label: 'Casa museo de Pablo Neruda' },
  { key: 'undurraga_winery',   label: 'Viña Undurraga' },
  { key: 'sea_views',          label: 'Vistas al mar' },
  { key: 'casas_bosque_winery',label: 'Viña Casas del Bosque' },
  { key: 'farellones_village', label: 'Pueblo de Farellones' },
  { key: 'andes_views',        label: 'Vistas a los Andes' },
  { key: 'snow_optional',      label: 'Nieve (según temporada)' },
  { key: 'plaza_de_armas',     label: 'Plaza de Armas' },
  { key: 'santa_lucia',        label: 'Cerro Santa Lucía' },
  { key: 'barrio_italia',      label: 'Barrio Italia' },
  { key: 'sauvignon_blanc',    label: 'Sauvignon Blanc del Pacífico' },
  { key: 'pinot_noir',         label: 'Pinot Noir de clima frío' },
  { key: 'top_wineries',       label: 'Las mejores bodegas de Chile' },
  { key: 'premium_tasting',    label: 'Degustación premium' },
  { key: 'gourmet_lunch',      label: 'Almuerzo gourmet' },
  { key: 'cellar_tour',        label: 'Visita a la bodega' },
  { key: 'colchagua_valley',   label: 'Valle de Colchagua' },
  { key: 'carmenere',          label: 'Carménère premiado' },
  { key: 'santa_cruz_town',    label: 'Pueblo colonial de Santa Cruz' },
  { key: 'santa_rita_estate',  label: 'Hacienda Santa Rita siglo XIX' },
  { key: 'museum_tour',        label: 'Museo de la hacienda' },
  { key: 'santiago_wineries',  label: 'Viñas en Santiago' },
  { key: 'cousino_macul',      label: 'Cousiño Macul (1856)' },
  { key: 'undurraga',          label: 'Viña Undurraga (1885)' },
  { key: 'sunset_views',       label: 'Atardecer en el viñedo' },
  { key: 'intimate_experience',label: 'Experiencia íntima' },
  { key: 'condor_sighting',    label: 'Avistamiento de cóndores' },
  { key: 'mountain_trail',     label: 'Sendero de montaña' },
  { key: 'andes_panorama',     label: 'Panorámica andina' },
  { key: 'glacier_trek',       label: 'Trek hasta el glaciar' },
  { key: 'mountain_lake',      label: 'Laguna de montaña' },
  { key: 'andes_scenery',      label: 'Paisaje andino' },
  { key: 'inca_lagoon',        label: 'Laguna del Inca' },
  { key: 'andean_altitude',    label: 'Alta cordillera' },
  { key: 'border_scenery',     label: 'Paisaje fronterizo' },
  { key: 'darwin_trail',       label: 'Sendero histórico de Darwin' },
  { key: 'native_forest',      label: 'Bosque nativo' },
  { key: 'palma_chilena',      label: 'Palma chilena' },
  { key: 'hiking',             label: 'Trekking' },
  { key: 'rafting_combo',      label: 'Rafting en el río Maipo' },
  { key: 'maipo_rafting',      label: 'Rafting Clase III-IV' },
  { key: 'traditional_asado',  label: 'Asado chileno tradicional' },
  { key: 'adrenaline',         label: 'Adrenalina pura' },
  { key: 'full_day',           label: 'Jornada completa' },
  { key: 'horseback_riding',   label: 'Cabalgata en los Andes' },
  { key: 'andean_foothills',   label: 'Pie de monte andino' },
  { key: 'farellones_park',    label: 'Parque Farellones' },
  { key: 'zip_line',           label: 'Tirolesa' },
  { key: 'mountain_biking',    label: 'Mountain bike' },
];

const INCLUDE_OPTIONS: KeyOption[] = [
  { key: 'pickup_dropoff',       label: 'Pick-up y drop-off en tu hotel' },
  { key: 'bilingual_guide',      label: 'Guía bilingüe certificado' },
  { key: 'wine_tasting_vineyard',label: 'Degustación y tour en las viñas' },
  { key: 'lunch',                label: 'Almuerzo' },
  { key: 'snacks_water',         label: 'Snacks y agua' },
  { key: 'entry_fees',           label: 'Entradas incluidas' },
  { key: 'equipment',            label: 'Equipamiento' },
  { key: 'tour_photos',          label: 'Fotografías del tour' },
];

const EXCLUDE_OPTIONS: KeyOption[] = [
  { key: 'lunch',              label: 'Almuerzo' },
  { key: 'personal_expenses',  label: 'Gastos personales' },
  { key: 'tips',               label: 'Propinas' },
  { key: 'entry_fees_excl',    label: 'Entradas a parques y atracciones' },
  { key: 'personal_insurance', label: 'Seguro personal de viaje' },
];

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

// Returns the display label for a highlight/include/exclude key
// Predefined keys return the key name; custom: prefix returns raw text
export function getItemLabel(value: string, catalog: KeyOption[]): string {
  if (value.startsWith('custom:')) return value.slice(7);
  return catalog.find(o => o.key === value)?.label ?? value;
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="border-b border-gray-100 pb-2">
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

// Auto-translate button + preview panel
function TranslatePanel({
  esText,
  enValue,
  ptValue,
  onEnChange,
  onPtChange,
  multiline,
}: {
  esText: string;
  enValue: string;
  ptValue: string;
  onEnChange: (v: string) => void;
  onPtChange: (v: string) => void;
  multiline?: boolean;
}) {
  const [translating, setTranslating] = useState(false);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');

  async function translate() {
    if (!esText.trim()) return;
    setTranslating(true);
    setErr('');
    try {
      const [enRes, ptRes] = await Promise.all([
        fetch('/api/admin/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: esText, targetLang: 'en' }),
        }),
        fetch('/api/admin/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: esText, targetLang: 'pt' }),
        }),
      ]);
      const enData = await enRes.json() as { translated?: string; error?: string };
      const ptData = await ptRes.json() as { translated?: string; error?: string };
      if (enData.translated) { onEnChange(enData.translated); setOpen(true); }
      if (ptData.translated) { onPtChange(ptData.translated); setOpen(true); }
      if (enData.error || ptData.error) setErr(enData.error ?? ptData.error ?? 'Error');
    } catch {
      setErr('Error de conexión');
    } finally {
      setTranslating(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={translate}
          disabled={translating || !esText.trim()}
          className="flex items-center gap-1.5 text-xs bg-teal/10 text-teal hover:bg-teal/20 disabled:opacity-40 font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          {translating ? (
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
          )}
          Traducir → EN / PT
        </button>
        {(enValue || ptValue) && (
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            {open ? 'Ocultar traducciones' : 'Ver traducciones'}
          </button>
        )}
        {err && <span className="text-xs text-red-500">{err}</span>}
      </div>

      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-gray-50 rounded-lg p-3">
          <Field label="EN">
            {multiline
              ? <textarea rows={3} value={enValue} onChange={e => onEnChange(e.target.value)} className={textareaClass} />
              : <input value={enValue} onChange={e => onEnChange(e.target.value)} className={inputClass} />
            }
          </Field>
          <Field label="PT">
            {multiline
              ? <textarea rows={3} value={ptValue} onChange={e => onPtChange(e.target.value)} className={textareaClass} />
              : <input value={ptValue} onChange={e => onPtChange(e.target.value)} className={inputClass} />
            }
          </Field>
        </div>
      )}
    </div>
  );
}

// Autocomplete highlight search input
function HighlightAutocomplete({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [query, setQuery]   = useState('');
  const [open, setOpen]     = useState(false);
  const inputRef            = useRef<HTMLInputElement>(null);
  const dropdownRef         = useRef<HTMLDivElement>(null);

  const lower = query.toLowerCase().trim();
  const filtered = lower
    ? HIGHLIGHT_OPTIONS.filter(o => o.label.toLowerCase().includes(lower) && !selected.includes(o.key))
    : [];

  const exactMatch = HIGHLIGHT_OPTIONS.find(o => o.label.toLowerCase() === lower);
  const showCreate = lower && !exactMatch && !selected.some(s => s === `custom:${query.trim()}`);

  function add(value: string) {
    if (!selected.includes(value)) onChange([...selected, value]);
    setQuery('');
    setOpen(false);
    inputRef.current?.focus();
  }

  function remove(value: string) {
    onChange(selected.filter(s => s !== value));
  }

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          placeholder="Buscar highlight… o escribir uno nuevo"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className={inputClass}
        />
        {open && (filtered.length > 0 || showCreate) && (
          <div
            ref={dropdownRef}
            className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
          >
            {filtered.slice(0, 8).map(opt => (
              <button
                key={opt.key}
                type="button"
                onMouseDown={e => { e.preventDefault(); add(opt.key); }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-teal/5 hover:text-teal transition-colors"
              >
                {opt.label}
              </button>
            ))}
            {showCreate && (
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); add(`custom:${query.trim()}`); }}
                className="w-full text-left px-3 py-2 text-sm text-teal font-medium hover:bg-teal/5 border-t border-gray-100"
              >
                + Crear &ldquo;{query.trim()}&rdquo;
              </button>
            )}
          </div>
        )}
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map(h => (
            <span
              key={h}
              className="flex items-center gap-1.5 bg-teal/10 text-teal text-xs font-medium px-2.5 py-1 rounded-full"
            >
              {getItemLabel(h, HIGHLIGHT_OPTIONS)}
              <button
                type="button"
                onClick={() => remove(h)}
                className="text-teal/60 hover:text-teal ml-0.5"
                aria-label="Quitar"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Custom items input for includes/excludes
function CustomItemInput({
  list,
  onChange,
  placeholder,
}: {
  list: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [val, setVal] = useState('');

  function add() {
    const trimmed = val.trim();
    if (!trimmed) return;
    const key = `custom:${trimmed}`;
    if (!list.includes(key)) onChange([...list, key]);
    setVal('');
  }

  const customItems = list.filter(k => k.startsWith('custom:'));

  return (
    <div className="mt-2 flex flex-col gap-2">
      {customItems.map(k => (
        <div key={k} className="flex items-center gap-1.5">
          <span className="text-xs text-gray-600 flex-1 bg-gray-50 rounded px-2 py-1">{k.slice(7)}</span>
          <button
            type="button"
            onClick={() => onChange(list.filter(x => x !== k))}
            className="text-xs text-red-400 hover:text-red-600 px-1"
          >
            ✕
          </button>
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={placeholder}
          className="border border-dashed border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-teal flex-1"
        />
        <button
          type="button"
          onClick={add}
          disabled={!val.trim()}
          className="text-xs text-teal disabled:opacity-40 hover:underline font-medium whitespace-nowrap"
        >
          + Agregar
        </button>
      </div>
    </div>
  );
}

export default function TourEditForm({
  tour,
  initialSchedules,
  onSaved,
}: {
  tour: TourDetail | null;
  initialSchedules: ScheduleRow[];
  onSaved?: (slug: string) => void;
}) {
  const isNew = !tour;

  const [nameEs, setNameEs] = useState(tour?.name_es ?? '');
  const [nameEn, setNameEn] = useState(tour?.name_en ?? '');
  const [namePt, setNamePt] = useState(tour?.name_pt ?? '');
  const [descEs, setDescEs] = useState(tour?.description_es ?? '');
  const [descEn, setDescEn] = useState(tour?.description_en ?? '');
  const [descPt, setDescPt] = useState(tour?.description_pt ?? '');
  const [category, setCategory]     = useState(tour?.category ?? 'cajon');
  const [difficulty, setDifficulty] = useState(tour?.difficulty ?? 'low');
  const [hideDifficulty, setHideDifficulty] = useState(!!tour?.hide_difficulty);
  const [durationHrs, setDurationHrs] = useState(tour?.duration_hrs ?? 8);
  const [highlights, setHighlights]   = useState<string[]>(tour?.highlights ?? []);
  const [includesKeys, setIncludesKeys] = useState<string[]>(tour?.includes_keys ?? []);
  const [excludesKeys, setExcludesKeys] = useState<string[]>(tour?.excludes_keys ?? []);
  const [itinerary, setItinerary]   = useState<ItineraryStop[]>(tour?.itinerary?.length ? tour.itinerary : []);
  const [images, setImages]         = useState<string[]>(tour?.images ?? []);
  const [newImageUrl, setNewImageUrl] = useState('');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState('');

  const [schedules, setSchedules] = useState<Record<'summer' | 'winter', string>>({
    summer: initialSchedules.find(s => s.season === 'summer')?.pickup_time?.slice(0, 5) ?? '',
    winter: initialSchedules.find(s => s.season === 'winter')?.pickup_time?.slice(0, 5) ?? '',
  });
  const [savingSchedule, setSavingSchedule] = useState<'summer' | 'winter' | null>(null);
  const [savedSlug, setSavedSlug] = useState(tour?.slug ?? '');

  function toggleKey(list: string[], setList: (v: string[]) => void, key: string) {
    setList(list.includes(key) ? list.filter(k => k !== key) : [...list, key]);
  }

  function updateItinerary(i: number, field: keyof ItineraryStop, value: string | boolean) {
    setItinerary(prev => prev.map((stop, idx) => idx === i ? { ...stop, [field]: value } : stop));
  }

  function addImage() {
    const url = newImageUrl.trim();
    if (url && !images.includes(url)) setImages(prev => [...prev, url]);
    setNewImageUrl('');
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      const payload = {
        name_es: nameEs, name_en: nameEn || null, name_pt: namePt || null,
        description_es: descEs || null, description_en: descEn || null, description_pt: descPt || null,
        category, difficulty, hide_difficulty: hideDifficulty,
        duration_hrs: durationHrs,
        highlights, includes_keys: includesKeys, excludes_keys: excludesKeys,
        itinerary: itinerary.filter(s => s.time || s.place),
        images: images.filter(Boolean),
      };

      let slug = savedSlug;

      if (isNew) {
        const res = await fetch('/api/admin/tours', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ name_es: nameEs, name_en: nameEn || null, name_pt: namePt || null, category }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? 'Error al crear');
        }
        const data = await res.json() as { slug: string };
        slug = data.slug;
        setSavedSlug(slug);
      }

      const res = await fetch(`/api/admin/tours/${slug}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? 'Error al guardar');
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSaved?.(slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function saveSchedule(season: 'summer' | 'winter') {
    const slug = savedSlug || tour?.slug;
    if (!slug) return;
    setSavingSchedule(season);
    try {
      await fetch('/api/admin/tour-schedules', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tour_slug: slug, season, pickup_time: schedules[season] }),
      });
    } finally {
      setSavingSchedule(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">

      {/* 1. Nombre */}
      <Section title="Nombre del tour">
        <Field label="Nombre (español)">
          <input
            value={nameEs}
            onChange={e => setNameEs(e.target.value)}
            placeholder="Ej: Embalse El Yeso"
            className={inputClass}
          />
        </Field>
        <TranslatePanel
          esText={nameEs}
          enValue={nameEn}
          ptValue={namePt}
          onEnChange={setNameEn}
          onPtChange={setNamePt}
        />
      </Section>

      {/* 2. Clasificación */}
      <Section title="Clasificación">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Categoría">
            <select value={category} onChange={e => setCategory(e.target.value)} className={selectClass}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Duración (horas)">
            <input
              type="number" min={1} max={24}
              value={durationHrs}
              onChange={e => setDurationHrs(Number(e.target.value))}
              className={inputClass}
            />
          </Field>
          <Field label="Dificultad">
            <div className="flex flex-col gap-1.5">
              <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className={selectClass}>
                {DIFFICULTIES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
              <label className="flex items-center gap-1.5 text-xs text-gray-500">
                <input type="checkbox" checked={hideDifficulty} onChange={e => setHideDifficulty(e.target.checked)} />
                Ocultar en tarjeta
              </label>
            </div>
          </Field>
        </div>
      </Section>

      {/* 3. Descripción */}
      <Section title="Descripción" hint="Texto largo mostrado en la página del tour">
        <Field label="Descripción (español)">
          <textarea
            rows={5}
            value={descEs}
            onChange={e => setDescEs(e.target.value)}
            placeholder="Describe el tour en español..."
            className={textareaClass}
          />
        </Field>
        <TranslatePanel
          esText={descEs}
          enValue={descEn}
          ptValue={descPt}
          onEnChange={setDescEn}
          onPtChange={setDescPt}
          multiline
        />
      </Section>

      {/* 4. Imágenes */}
      <Section title="Imágenes" hint="Se muestran como galería en la página del tour (imagen principal + miniaturas)">
        <div className="flex flex-col gap-2">
          {images.map((img, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-5 text-right flex-shrink-0">{i + 1}</span>
              <div className="w-10 h-10 flex-shrink-0 rounded overflow-hidden border border-gray-100 bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
              <input
                value={img}
                onChange={e => setImages(prev => prev.map((x, idx) => idx === i ? e.target.value : x))}
                className={`${inputClass} flex-1 text-xs`}
              />
              <button
                type="button"
                onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                className="text-xs text-red-400 hover:text-red-600 px-1 flex-shrink-0"
              >
                ✕
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2 mt-1">
            <input
              type="url"
              value={newImageUrl}
              onChange={e => setNewImageUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addImage())}
              placeholder="https://... URL de imagen"
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              onClick={addImage}
              disabled={!newImageUrl.trim()}
              className="text-xs text-teal disabled:opacity-40 hover:underline font-medium whitespace-nowrap px-2"
            >
              + Agregar
            </button>
          </div>
        </div>
      </Section>

      {/* 5. Itinerario */}
      <Section
        title="Itinerario"
        hint="La primera parada define el punto de llegada para calcular los pickups — necesita una dirección geolocalizable."
      >
        <div className="flex flex-col gap-3">
          {itinerary.map((stop, i) => (
            <div key={i} className="border border-gray-100 rounded-lg p-3 flex flex-col gap-2 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-gray-300 w-4 flex-shrink-0">{i + 1}</span>
                <input
                  type="text" placeholder="09:00" value={stop.time}
                  onChange={e => updateItinerary(i, 'time', e.target.value)}
                  className={`${inputClass} max-w-[90px]`}
                />
                <input
                  type="text" placeholder="Lugar / parada" value={stop.place}
                  onChange={e => updateItinerary(i, 'place', e.target.value)}
                  className={inputClass}
                />
                <label className="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={!!stop.isLunch}
                    onChange={e => updateItinerary(i, 'isLunch', e.target.checked)}
                  />
                  Almuerzo
                </label>
                <button
                  type="button"
                  onClick={() => setItinerary(prev => prev.filter((_, idx) => idx !== i))}
                  className="text-xs text-red-400 hover:text-red-600 px-1 flex-shrink-0"
                >
                  ✕
                </button>
              </div>
              {i === 0 && (
                <input
                  type="text"
                  placeholder="Dirección exacta del primer punto (para calcular pickups), ej: Embalse El Yeso, Cajón del Maipo"
                  value={stop.address ?? ''}
                  onChange={e => updateItinerary(i, 'address', e.target.value)}
                  className={`${inputClass} bg-white text-xs`}
                />
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setItinerary(prev => [...prev, { time: '', place: '' }])}
            className="self-start text-xs text-teal hover:underline"
          >
            + Agregar parada
          </button>
        </div>
      </Section>

      {/* 6. Incluye / No incluye */}
      <Section title="Qué incluye / Qué no incluye">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Incluye
            </p>
            <div className="flex flex-col gap-1.5">
              {INCLUDE_OPTIONS.map(opt => (
                <label key={opt.key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includesKeys.includes(opt.key)}
                    onChange={() => toggleKey(includesKeys, setIncludesKeys, opt.key)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            <CustomItemInput
              list={includesKeys}
              onChange={setIncludesKeys}
              placeholder="Otro ítem personalizado..."
            />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              No incluye
            </p>
            <div className="flex flex-col gap-1.5">
              {EXCLUDE_OPTIONS.map(opt => (
                <label key={opt.key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={excludesKeys.includes(opt.key)}
                    onChange={() => toggleKey(excludesKeys, setExcludesKeys, opt.key)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            <CustomItemInput
              list={excludesKeys}
              onChange={setExcludesKeys}
              placeholder="Otro ítem personalizado..."
            />
          </div>
        </div>
      </Section>

      {/* 7. Highlights */}
      <Section title="Puntos destacados" hint="Los primeros 3 se muestran en la tarjeta del catálogo">
        <HighlightAutocomplete selected={highlights} onChange={setHighlights} />
      </Section>

      {/* 8. Horario de llegada por temporada */}
      <Section
        title="Horario de llegada al primer punto"
        hint="Hora a la que el grupo debe estar EN la primera parada (no es la hora de salida). Varía por temporada."
      >
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
                  disabled={savingSchedule === season || (!savedSlug && !tour?.slug)}
                  className="bg-teal text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-teal/90 disabled:opacity-50 whitespace-nowrap"
                >
                  {savingSchedule === season ? '…' : 'Guardar'}
                </button>
              </div>
            </Field>
          ))}
        </div>
        {isNew && !savedSlug && (
          <p className="text-xs text-gray-400">Guarda el tour primero para poder asignar horarios de temporada.</p>
        )}
      </Section>

      {/* Save bar */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={save}
          disabled={saving || !nameEs.trim()}
          className="bg-teal text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-teal/90 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Guardando…' : isNew ? 'Crear tour' : 'Guardar cambios'}
        </button>
        {saved && <span className="text-sm text-teal font-medium">✓ Guardado</span>}
        {savedSlug && isNew && (
          <span className="text-xs text-gray-400 font-mono">slug: {savedSlug}</span>
        )}
      </div>
    </div>
  );
}
