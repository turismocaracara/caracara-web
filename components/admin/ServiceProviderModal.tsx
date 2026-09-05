'use client';

import { useState } from 'react';

export interface ServiceProvider {
  id:    string;
  name:  string;
  type:  'guide' | 'agency';
  phone: string | null;
  email: string | null;
  rut:   string | null;
  notes: string | null;
}

const inputClass = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal w-full';

export default function ServiceProviderModal({
  initialName = '',
  onClose,
  onSaved,
}: {
  initialName?: string;
  onClose:      () => void;
  onSaved:      (provider: ServiceProvider) => void;
}) {
  const [name,  setName]  = useState(initialName);
  const [type,  setType]  = useState<'guide' | 'agency'>('guide');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [rut,   setRut]   = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const valid = name.trim().length >= 2;

  async function handleSave() {
    if (!valid) return;
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/admin/service-providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(), type,
          phone: phone || null, email: email || null,
          rut: rut || null, notes: notes || null,
        }),
      });
      const data = await res.json() as ServiceProvider & { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar');
      onSaved(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900 text-base">Registrar proveedor</h2>
            <p className="text-xs text-gray-400 mt-0.5">Guía externo o agencia que opera el tour</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">

          {/* Tipo */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-gray-600">Tipo de proveedor<span className="text-orange ml-0.5">*</span></span>
            <div className="grid grid-cols-2 gap-2">
              {([
                { v:'guide',  l:'Guía externo',  d:'Persona independiente' },
                { v:'agency', l:'Agencia externa', d:'Empresa o tour operador' },
              ] as const).map(opt => (
                <button key={opt.v} type="button" onClick={() => setType(opt.v)}
                  className={`flex flex-col gap-0.5 text-left border-2 rounded-xl px-3 py-2.5 transition-all ${
                    type === opt.v ? 'border-teal bg-teal/5' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <span className={`text-xs font-semibold ${type===opt.v ? 'text-teal' : 'text-gray-600'}`}>{opt.l}</span>
                  <span className="text-[11px] text-gray-400">{opt.d}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Nombre */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-600">
              Nombre<span className="text-orange ml-0.5">*</span>
            </label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder={type === 'guide' ? 'Nombre completo del guía' : 'Nombre de la agencia'}
              className={inputClass} />
          </div>

          {/* Contacto */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-600">Teléfono</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="+56 9 1234 5678" className={inputClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-600">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="contacto@proveedor.cl" className={inputClass} />
            </div>
          </div>

          {/* RUT */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-600">RUT</label>
            <input value={rut} onChange={e => setRut(e.target.value)}
              placeholder="12.345.678-9" className={`${inputClass} max-w-xs`} />
          </div>

          {/* Notas */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-600">Notas internas</label>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Especialidad, condiciones, forma de pago habitual…"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal resize-none w-full" />
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-xl hover:border-gray-300 transition-colors">
            Cancelar
          </button>
          <button type="button" onClick={handleSave} disabled={!valid || saving}
            className="flex-1 bg-teal text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-teal/90 disabled:opacity-50 transition-colors">
            {saving ? 'Guardando…' : 'Registrar proveedor'}
          </button>
        </div>
      </div>
    </div>
  );
}
