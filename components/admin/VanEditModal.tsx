'use client';

import { useState, useEffect } from 'react';
import type { VanRow } from './VansManager';

const inputClass    = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal w-full';
const textareaClass = `${inputClass} resize-none`;

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-gray-600">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function VanEditModal({
  van,
  onClose,
  onSaved,
}: {
  van:     VanRow | null;  // null = crear nueva
  onClose: () => void;
  onSaved: (saved: VanRow) => void;
}) {
  const isNew = van === null;

  const [name,     setName]     = useState(van?.name     ?? '');
  const [brand,    setBrand]    = useState(van?.brand    ?? '');
  const [model,    setModel]    = useState(van?.model    ?? '');
  const [year,     setYear]     = useState<string>(van?.year ? String(van.year) : '');
  const [capacity, setCapacity] = useState<string>(String(van?.capacity ?? 9));
  const [plate,    setPlate]    = useState(van?.plate    ?? '');
  const [color,    setColor]    = useState(van?.color    ?? '');
  const [notes,    setNotes]    = useState(van?.notes    ?? '');
  const [active,   setActive]   = useState(van?.active   ?? true);

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  async function save() {
    if (!name.trim()) { setError('El nombre es obligatorio'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name:     name.trim(),
        brand:    brand.trim()    || null,
        model:    model.trim()    || null,
        year:     year  ? Number(year)     : null,
        capacity: Number(capacity) || 9,
        plate:    plate.trim()    || null,
        color:    color.trim()    || null,
        notes:    notes.trim()    || null,
        active,
      };

      const res = await fetch(
        isNew ? '/api/admin/vans' : `/api/admin/vans/${van!.id}`,
        {
          method:  isNew ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        }
      );
      const data = await res.json() as VanRow & { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar');
      onSaved(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <div className="relative z-10 w-full max-w-lg mx-4 my-8 bg-white rounded-2xl shadow-2xl flex flex-col max-h-[calc(100vh-64px)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-semibold text-gray-900">
            {isNew ? 'Nueva van' : `Editar — ${van!.name}`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-6 flex flex-col gap-4">
          <Field label="Nombre" required>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Van Principal, Mercedes Grande"
              className={inputClass}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Marca">
              <input
                value={brand}
                onChange={e => setBrand(e.target.value)}
                placeholder="Toyota"
                className={inputClass}
              />
            </Field>
            <Field label="Modelo">
              <input
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder="Hiace"
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Año">
              <input
                type="number"
                min={1990}
                max={2100}
                value={year}
                onChange={e => setYear(e.target.value)}
                placeholder="2022"
                className={inputClass}
              />
            </Field>
            <Field label="Capacidad (pax)">
              <input
                type="number"
                min={1}
                max={80}
                value={capacity}
                onChange={e => setCapacity(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Patente">
              <input
                value={plate}
                onChange={e => setPlate(e.target.value.toUpperCase())}
                placeholder="ABCD-12"
                className={inputClass}
              />
            </Field>
            <Field label="Color">
              <input
                value={color}
                onChange={e => setColor(e.target.value)}
                placeholder="Blanca"
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Notas internas">
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Observaciones, revisiones pendientes…"
              className={textareaClass}
            />
          </Field>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <button
              type="button"
              onClick={() => setActive(a => !a)}
              className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${active ? 'bg-teal' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${active ? 'translate-x-5' : 'translate-x-1'}`} />
            </button>
            <span className="text-sm text-gray-700">
              {active ? 'Van activa (disponible para tours)' : 'Van inactiva'}
            </span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !name.trim()}
            className="bg-teal text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-teal/90 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Guardando…' : isNew ? 'Crear van' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}
