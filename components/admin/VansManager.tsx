'use client';

import { useState } from 'react';

export interface VanRow {
  id: string;
  name: string;
  capacity: number;
  plate: string | null;
  active: boolean;
}

export interface VanBlockRow {
  id: string;
  van_id: string;
  date: string;
  reason: string | null;
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-CL', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

export default function VansManager({
  vans,
  initialBlocks,
}: {
  vans: VanRow[];
  initialBlocks: VanBlockRow[];
}) {
  const [blocks, setBlocks]   = useState(initialBlocks);
  const [vanId, setVanId]     = useState(vans[0]?.id ?? '');
  const [date, setDate]       = useState('');
  const [reason, setReason]   = useState('');
  const [saving, setSaving]   = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError]     = useState('');

  const today = new Date().toISOString().slice(0, 10);

  async function addBlock() {
    if (!vanId || !date) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/van-blocks', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ van_id: vanId, date, reason: reason || undefined }),
      });
      const data = await res.json() as { ok?: boolean; id?: string; error?: string };
      if (!res.ok) { setError(data.error ?? 'Error'); return; }
      setBlocks(prev => [
        ...prev,
        { id: data.id!, van_id: vanId, date, reason: reason || null },
      ].sort((a, b) => a.date.localeCompare(b.date)));
      setDate('');
      setReason('');
    } finally {
      setSaving(false);
    }
  }

  async function removeBlock(id: string) {
    setDeleting(id);
    try {
      await fetch('/api/admin/van-blocks', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id }),
      });
      setBlocks(prev => prev.filter(b => b.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Lista de vans */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Flota</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {vans.map(van => (
            <div key={van.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">{van.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Cap. {van.capacity} pax
                  {van.plate && <> · {van.plate}</>}
                </p>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                van.active
                  ? 'bg-green-50 text-green-700'
                  : 'bg-gray-50 text-gray-400'
              }`}>
                {van.active ? 'Activa' : 'Inactiva'}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Agregar bloqueo */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Agregar bloqueo (mantención / uso personal)
        </h2>
        <div className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Van</label>
              <select
                value={vanId}
                onChange={e => setVanId(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal bg-white"
              >
                {vans.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Fecha</label>
              <input
                type="date"
                min={today}
                value={date}
                onChange={e => setDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Motivo (opcional)</label>
              <input
                type="text"
                placeholder="Ej: Revisión técnica"
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal"
              />
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="button"
            onClick={addBlock}
            disabled={saving || !vanId || !date}
            className="self-start bg-teal text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-teal/90 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Guardando…' : 'Bloquear fecha'}
          </button>
        </div>
      </section>

      {/* Bloqueos existentes */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Bloqueos próximos ({blocks.filter(b => b.date >= today).length})
        </h2>
        {blocks.filter(b => b.date >= today).length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center bg-white rounded-xl border border-gray-100">
            Sin bloqueos programados
          </p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 bg-gray-50/60">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Van</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Fecha</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Motivo</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {blocks
                  .filter(b => b.date >= today)
                  .map((b, i) => {
                    const vanName = vans.find(v => v.id === b.van_id)?.name ?? b.van_id;
                    return (
                      <tr key={b.id} className={i > 0 ? 'border-t border-gray-50' : ''}>
                        <td className="px-4 py-3 text-gray-700 font-medium">{vanName}</td>
                        <td className="px-4 py-3 text-gray-600">{fmtDate(b.date)}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{b.reason ?? '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => removeBlock(b.id)}
                            disabled={deleting === b.id}
                            className="text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-40"
                          >
                            {deleting === b.id ? '…' : 'Eliminar'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
