'use client';

import { useState, useEffect } from 'react';

export interface Agency {
  id:            string;
  fantasy_name:  string;
  rut:           string;
  razon_social:  string;
  giro:          string;
  address:       string;
  comuna:        string;
  city:          string;
  billing_email: string | null;
  phone:         string | null;
  contact_name:  string | null;
}

const inputClass  = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal w-full';

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-gray-600">
        {label}{required && <span className="text-orange ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

function formatRut(raw: string): string {
  const clean = raw.replace(/[^0-9kK]/g, '').toUpperCase();
  if (clean.length < 2) return clean;
  const dv   = clean.slice(-1);
  const body = clean.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${body}-${dv}`;
}

export default function AgencyRegistrationModal({
  initialName,
  onClose,
  onSaved,
}: {
  initialName: string;
  onClose:     () => void;
  onSaved:     (agency: Agency) => void;
}) {
  const [form, setForm] = useState({
    fantasy_name:  initialName,
    rut:           '',
    razon_social:  '',
    giro:          '',
    address:       '',
    comuna:        '',
    city:          '',
    billing_email: '',
    phone:         '',
    contact_name:  '',
  });

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  // Bloquear scroll y cerrar con Escape
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  function set(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function handleRut(value: string) {
    set('rut', formatRut(value));
  }

  function isValid() {
    return (
      form.fantasy_name.trim().length >= 2 &&
      form.rut.trim().length >= 8 &&
      form.razon_social.trim().length >= 3 &&
      form.giro.trim().length >= 3 &&
      form.address.trim().length >= 3 &&
      form.comuna.trim().length >= 2 &&
      form.city.trim().length >= 2
    );
  }

  async function handleSubmit() {
    setLoading(true);
    setError('');
    try {
      const payload: Record<string, string | undefined> = {
        fantasy_name: form.fantasy_name.trim(),
        rut:          form.rut.trim(),
        razon_social: form.razon_social.trim(),
        giro:         form.giro.trim(),
        address:      form.address.trim(),
        comuna:       form.comuna.trim(),
        city:         form.city.trim(),
      };
      if (form.billing_email.trim()) payload.billing_email = form.billing_email.trim();
      if (form.phone.trim())         payload.phone         = form.phone.trim();
      if (form.contact_name.trim())  payload.contact_name  = form.contact_name.trim();

      const res  = await fetch('/api/admin/agencies', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const json = await res.json() as Agency & { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Error al guardar la agencia');
      onSaved(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="relative z-10 w-full max-w-lg mx-4 my-6 bg-white rounded-2xl shadow-2xl flex flex-col max-h-[calc(100vh-48px)]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900 text-base">Registrar nueva agencia</h2>
            <p className="text-xs text-gray-400 mt-0.5">Los datos se guardan para facturación y uso futuro.</p>
          </div>
          <button type="button" onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-5">

          {/* Identidad */}
          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Identidad</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nombre de fantasía" required hint="Cómo aparece en las reservas">
                <input value={form.fantasy_name} onChange={e => set('fantasy_name', e.target.value)} className={inputClass} />
              </Field>
              <Field label="RUT empresa" required hint="Ej: 76.543.210-K">
                <input
                  value={form.rut}
                  onChange={e => handleRut(e.target.value)}
                  placeholder="76.543.210-K"
                  className={inputClass}
                />
              </Field>
              <Field label="Razón social" required hint="Nombre legal según SII" >
                <input value={form.razon_social} onChange={e => set('razon_social', e.target.value)}
                  placeholder="Agencia de Viajes XYZ SpA" className={`${inputClass} sm:col-span-2`} />
              </Field>
            </div>
          </div>

          {/* Datos tributarios */}
          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Datos tributarios</p>
            <Field label="Giro comercial" required hint="Ej: Agencias de viajes y turismo">
              <input value={form.giro} onChange={e => set('giro', e.target.value)}
                placeholder="Agencias de viajes y turismo" className={inputClass} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Dirección" required>
                <input value={form.address} onChange={e => set('address', e.target.value)}
                  placeholder="Av. Providencia 1234, Of. 5" className={inputClass} />
              </Field>
              <Field label="Comuna" required>
                <input value={form.comuna} onChange={e => set('comuna', e.target.value)}
                  placeholder="Providencia" className={inputClass} />
              </Field>
              <Field label="Ciudad" required>
                <input value={form.city} onChange={e => set('city', e.target.value)}
                  placeholder="Santiago" className={inputClass} />
              </Field>
            </div>
          </div>

          {/* Contacto operativo */}
          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Contacto operativo <span className="normal-case font-normal text-gray-300">— opcional</span></p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Email de facturación">
                <input type="email" value={form.billing_email} onChange={e => set('billing_email', e.target.value)}
                  placeholder="facturas@agencia.cl" className={inputClass} />
              </Field>
              <Field label="Teléfono">
                <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
                  placeholder="+56 9 1234 5678" className={inputClass} />
              </Field>
              <Field label="Nombre del contacto">
                <input value={form.contact_name} onChange={e => set('contact_name', e.target.value)}
                  placeholder="María González" className={inputClass} />
              </Field>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button type="button" onClick={onClose}
            className="border border-gray-200 text-gray-600 text-sm font-medium px-4 py-2 rounded-lg hover:border-gray-300 transition-colors">
            Cancelar
          </button>
          <button type="button" onClick={handleSubmit} disabled={!isValid() || loading}
            className="bg-teal text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-teal/90 disabled:opacity-50 transition-colors">
            {loading ? 'Guardando…' : 'Registrar agencia'}
          </button>
        </div>
      </div>
    </div>
  );
}
